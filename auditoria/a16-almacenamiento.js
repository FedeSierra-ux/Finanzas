// AUDITORÍA 16 — ALMACENAMIENTO PERSONAL (v34.3): los meses de más de 18 meses pasan a IndexedDB (comprimidos) sin
// perder visibilidad, la migración resiste cortes en cada paso, sin IndexedDB se sigue como antes, el backup
// lleva el archivo y hay un aviso al 80% del tope de localStorage.
const L = require('./lib');
const { eq, is, section } = L;
const pad = n => String(n).padStart(2, '0');
const NOW = new Date();
const rel = (off, day) => { const f = new Date(NOW.getFullYear(), NOW.getMonth() + off, 1); return { y: f.getFullYear(), m: f.getMonth(), d: day }; };
const gasto = (id, off, day, amount, extra = {}) => { const r = rel(off, day); return { id, desc: 'Viejo ' + id, cat: 'compras', amount, month: r.m, year: r.y, day, addedAt: new Date(r.y, r.m, day, 12).getTime(), ...extra }; };
const viejos = () => [
  gasto('v1', -20, 5, 11111), gasto('v2', -20, 9, 22222), gasto('v3', -21, 3, 33333), gasto('v4', -24, 1, 44444),
  gasto('v5', -19, 15, 55555, { shared: { active: true, paidBy: 'fede', splitPct: 50 } }),
];
const recientes = () => [gasto('r1', -2, 4, 1000), gasto('r2', 0, 2, 2000)];
const todos = () => [...viejos(), ...recientes()];
const esperadoIds = todos().map(g => g.id).sort();
const idb = (dev) => dev.ev(async () => {
  const db = await idbAbrir(); const regs = await idbLeerTodo(db); db.close();
  const out = {}; for (const r of regs) out[r.k] = { n: r.n, gz: typeof r.gz === 'string' && r.gz.startsWith('gz1:'), ids: (await archDesempacar(r)).map(g => g.id).sort() };
  return out;
});
const estado = (dev) => dev.ev(() => ({ s: S.gastos.map(g => g.id).sort(), ls: (() => { try { return JSON.parse(localStorage.getItem('fin_gastos_archive') || 'null'); } catch (e) { return 'mal'; } })(), mem: getArchivedGastos().map(g => g.id).sort() }));
const arrancar = async (browser, opts = {}) => {
  const d = await L.device(browser, { myName: 'fede', compBin: 'a16', seed: { gastos: opts.gastos || todos() }, initScript: opts.sinIDB ? () => { Object.defineProperty(window, 'indexedDB', { value: undefined }); } : null });
  await d.ev(() => clearInterval(_sharedAutoTimer));
  await d.page.waitForTimeout(400);
  return d;
};
const recargar = async (d, espera = 3900) => { await d.page.reload(); await d.page.waitForFunction(() => typeof S === 'object' && typeof archiveOldGastos === 'function'); await d.page.waitForTimeout(espera); };

(async () => {
  const browser = await L.launch();
  L.resetBins();

  section('ARCHIVO · meses viejos a IndexedDB, comprimidos, y siguen visibles');
  {
    const d = await arrancar(browser);
    await recargar(d);
    const e = await estado(d), a = await idb(d);
    eq(e.s, ['r1', 'r2'], 'solo los gastos recientes quedan en la lista principal (localStorage)');
    eq(Object.keys(a).length, 4, 'IndexedDB guarda un registro por mes (4 meses)');
    is(Object.values(a).every(r => r.gz), 'y cada uno va comprimido (gz1)');
    eq(Object.values(a).flatMap(r => r.ids).sort(), ['v1', 'v2', 'v3', 'v4', 'v5'], 'con todos los gastos viejos, sin perder ninguno');
    is(e.ls === null, 'y el archivo viejo de localStorage no existe (nada de duplicado ocupando lugar)');
    eq(e.mem, ['v1', 'v2', 'v3', 'v4', 'v5'], 'la app los tiene en memoria para mostrarlos');
    // visibles: el mes, los totales y el buscador
    const f = rel(-20, 1);
    const ver = await d.ev(async (f) => {
      goTo('gastos'); setGastosMonth(f.m, f.y); await new Promise(r => setTimeout(r, 900));
      const filas = [...document.querySelectorAll('#gastos-list .gasto-row .gamt')].map(x => x.textContent.replace(/[^\d]/g, ''));
      const tot = document.getElementById('dval').textContent.replace(/[^\d]/g, '');
      buscarGastos('gastos', 'Viejo v3'); const busca = document.querySelectorAll('#sq-res-gastos .sq-row').length; buscarGastos('gastos', '');
      return { filas, tot, busca };
    }, f);
    eq(ver.filas.sort(), ['11111', '22222'], 'el mes de hace 20 meses muestra sus gastos archivados');
    eq(ver.tot, '33333', 'y su total');
    eq(ver.busca, 1, 'el buscador los encuentra');
    // peso en localStorage
    const peso = await d.ev(() => usoAlmacenamiento().chars);
    console.log('   · localStorage usado tras archivar:', peso, 'caracteres');
    await d.close();
  }

  section('ARCHIVO · migración del archivo viejo de localStorage');
  {
    const d = await arrancar(browser, { gastos: recientes() });
    await d.ev((v) => { localStorage.setItem('fin_gastos_archive', JSON.stringify(v)); }, viejos());
    await recargar(d);
    const e = await estado(d), a = await idb(d);
    eq(Object.values(a).flatMap(r => r.ids).sort(), ['v1', 'v2', 'v3', 'v4', 'v5'], 'el archivo de localStorage pasa entero a IndexedDB');
    is(e.ls === null, 'y recién verificado se borra de localStorage');
    eq(e.mem, ['v1', 'v2', 'v3', 'v4', 'v5'], 'sin perder visibilidad');
    await d.close();
  }

  section('ARCHIVO · cortes a mitad de la migración (recarga en cada paso): nunca se pierde un gasto');
  for (const punto of ['antes-escribir', 'despues-escribir', 'antes-sacar', 'antes-borrar-ls']) {
    const d = await arrancar(browser);
    await d.ev((v) => { localStorage.setItem('fin_gastos_archive', JSON.stringify(v.slice(0, 2).map(g => ({ ...g, id: 'ls' + g.id })))); }, viejos());
    await d.page.waitForTimeout(300);
    // Se congela la migración en ese paso (la promesa no se resuelve nunca) y se mata la app con una recarga.
    await d.ev((punto) => { _archPunto = (n) => (n === punto ? new Promise(() => { }) : undefined); archiveOldGastos().catch(() => { }); }, punto);
    await d.page.waitForTimeout(700);
    const cortes = await d.ev(() => document.readyState);
    await d.page.waitForTimeout(250);   // que alcance a escribir el guardado con demora
    // "Se mató la app": al volver a abrir todo tiene que estar, se haya cortado donde se haya cortado.
    await recargar(d, 4200);
    const e = await estado(d), a = await idb(d);
    const enIDB = Object.values(a).flatMap(r => r.ids);
    const visibles = new Set([...e.s, ...e.mem, ...(Array.isArray(e.ls) ? e.ls.map(g => g.id) : [])]);
    const esperados = [...esperadoIds, 'lsv1', 'lsv2'];
    eq(esperados.filter(id => !visibles.has(id) && !enIDB.includes(id)), [], `corte en "${punto}" (app matada ahí): tras reabrir no falta ningún gasto`);
    const f = rel(-20, 1);
    const ver = await d.ev(async (f) => { goTo('gastos'); setGastosMonth(f.m, f.y); await new Promise(r => setTimeout(r, 800)); return [...document.querySelectorAll('#gastos-list .gasto-row .gamt')].map(x => x.textContent.replace(/[^\d]/g, '')).sort(); }, f);
    eq(ver, ['11111', '11111', '22222', '22222'], `corte en "${punto}": el mes archivado se ve completo (los dos de más son las copias lsv1/lsv2 del archivo viejo, con otro id) y sin repetir ninguno`);
    eq(e.s.filter(id => id.startsWith('v')), [], `corte en "${punto}": los viejos terminan fuera de la lista principal`);
    await d.close();
  }

  section('ARCHIVO · la verificación falla (lo leído no coincide): no se saca nada');
  {
    const d = await arrancar(browser);
    await d.ev(() => { idbEscribir = async () => true; });   // "escribe" pero no guarda nada
    const r = await d.ev(async () => ({ n: await archiveOldGastos(), s: S.gastos.map(g => g.id).sort(), ls: JSON.parse(localStorage.getItem('fin_gastos_archive') || '[]').map(g => g.id).sort() }));
    console.log('   · con la verificación rota, la app cae al archivo en localStorage:', JSON.stringify(r));
    const todosLosIds = [...r.s, ...r.ls].sort();
    eq(todosLosIds, esperadoIds, 'ningún gasto se pierde: o siguen en la lista o quedaron en el archivo de localStorage');
    await d.close();
  }

  section('ARCHIVO · sin IndexedDB (modo privado antiguo, WebView raro): se sigue como hasta ahora');
  {
    const d = await arrancar(browser, { sinIDB: true });
    await recargar(d);
    const e = await estado(d);
    is(await d.ev(() => !idbDisponible()), 'IndexedDB no está disponible en este dispositivo');
    eq(e.s, ['r1', 'r2'], 'igual se archivan los viejos…');
    eq(e.ls && e.ls.map(g => g.id).sort(), ['v1', 'v2', 'v3', 'v4', 'v5'], '…en localStorage');
    eq(e.mem, ['v1', 'v2', 'v3', 'v4', 'v5'], 'y se siguen viendo');
    await d.close();
  }

  section('ARCHIVO · el backup incluye los meses archivados en IndexedDB');
  {
    const d = await arrancar(browser);
    await recargar(d);
    const [dl] = await Promise.all([d.page.waitForEvent('download', { timeout: 8000 }), d.ev(() => exportBackup())]);
    const ruta = require('path').join(require('os').tmpdir(), 'a16-backup.json');
    await dl.saveAs(ruta);
    const bk = JSON.parse(require('fs').readFileSync(ruta, 'utf8'));
    const arch = JSON.parse(bk.data.fin_gastos_archive || '[]').map(g => g.id).sort();
    eq(arch, ['v1', 'v2', 'v3', 'v4', 'v5'], 'el archivo de backup trae los 5 gastos archivados (mismo formato de siempre)');
    await d.close();
  }

  section('ALMACENAMIENTO · aviso al 80% del tope de localStorage');
  {
    const d = await arrancar(browser, { gastos: recientes() });
    const u0 = await d.ev(() => usoAlmacenamiento().pct);
    await d.ev(() => { window.__antes = document.querySelector('.overlay.open') ? 1 : 0; });
    // bajo el 80%: nada
    await d.ev(() => { _avisoAlmacenamientoTs = 0; localStorage.removeItem('fin_quota_aviso_ts'); });
    await d.ev(async () => { await revisarAlmacenamiento(); });
    eq(await d.ev(() => document.getElementById('ov-confirm').classList.contains('open')), false, `con el ${u0}% usado no se avisa nada`);
    // llenar hasta ~82%
    const lleno = await d.ev(() => { const k = 'zz_relleno'; const n = Math.round(STORAGE_LIMITE * 0.82 - usoAlmacenamiento().chars); localStorage.setItem(k, 'x'.repeat(n)); return usoAlmacenamiento().pct; });
    is(lleno >= 80 && lleno < 100, `el almacenamiento queda al ${lleno}%`);
    const aviso = d.ev(async () => { _avisoAlmacenamientoTs = 0; localStorage.removeItem('fin_quota_aviso_ts'); await Promise.race([revisarAlmacenamiento(), new Promise(r => setTimeout(r, 6000))]); return true; });
    await d.page.waitForTimeout(500);
    const txt = await d.ev(() => ({ abierto: document.getElementById('ov-confirm').classList.contains('open'), titulo: document.getElementById('confirm-title').textContent, cuerpo: document.getElementById('confirm-msg').textContent, ok: document.getElementById('confirm-ok').textContent }));
    is(txt.abierto && /8\d%|9\d%/.test(txt.titulo), `al superar el 80% aparece el aviso: "${txt.titulo}"`);
    is(/backup/i.test(txt.cuerpo) && /Bajar backup/.test(txt.ok), 'y ofrece bajar un backup');
    const [dl] = await Promise.all([d.page.waitForEvent('download', { timeout: 8000 }), d.ev(() => confirmResolve(true))]);
    is(/finanzas-backup/.test(dl.suggestedFilename()), 'aceptar baja el backup');
    await aviso;
    // no vuelve a molestar el mismo día
    await d.ev(async () => { await revisarAlmacenamiento(); });
    eq(await d.ev(() => document.getElementById('ov-confirm').classList.contains('open')), false, 'y no insiste el mismo día');
    await d.close();
  }

  section('ERRORES');
  console.log(`\n${'─'.repeat(52)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  await browser.close();
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error('ERROR:', e); process.exit(2); });
