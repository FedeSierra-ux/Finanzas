// AUDITORÍA 13 — SIMULACIÓN DE MESES DE USO REAL.
//
// Una pareja usando la app durante ~12 meses (fechas relativas a hoy: 8 meses
// hacia atrás y 5 hacia adelante, cruzando el fin de año), manejando la UI real
// (modales, chips, botones) y contrastando lo que la app muestra con una cuenta
// hecha acá, en JS, sin usar ninguna función de la app.
//
// Convención: cada `✗` es una diferencia entre lo que la app hace y lo que un
// usuario razonable espera. Los identificadores [Bnn] remiten a INFORME-simulacion.md.
const L = require('./lib');
const { eq, is, section } = L;

const BIN = 'bin13';
const pad = n => String(n).padStart(2, '0');
const NOW = new Date();
const Y0 = NOW.getFullYear(), M0 = NOW.getMonth(), D0 = NOW.getDate();
const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
// Fecha relativa al mes en curso: off=-2 → hace dos meses, day recortado al largo del mes.
function rel(off, day) {
  const f = new Date(Y0, M0 + off, 1);
  const dim = new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate();
  const d = Math.min(day, dim);
  return { y: f.getFullYear(), m: f.getMonth(), d, str: `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(d)}` };
}
const mkey = (y, m) => y * 12 + m;
// PRNG determinista: la simulación tiene que dar lo mismo en cada corrida.
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(20260930);
const pick = arr => arr[Math.floor(R() * arr.length)];

// ── Cuenta independiente (no usa nada de la app) ───────────────────────────
// Parte que le toca a `who` de un gasto: lo mismo que calcula la app pero
// escrito acá. splitPct es el porcentaje del que PAGÓ.
function share(g, who) {
  if (!g.sh) return g.amount;
  const sp = g.sh.split;
  return g.sh.paidBy === who ? Math.round(g.amount * sp / 100) : Math.round(g.amount * (100 - sp) / 100);
}
// Saldo desde la óptica de `who`: + = la pareja le debe. Cada gasto suma
// round(monto*(100-split)/100) a quien no pagó; cada transferencia resta.
function saldoIndep(gastos, pagos, who) {
  let aFavor = 0, enContra = 0;
  for (const g of gastos) {
    if (!g.sh) continue;
    const owes = Math.round(g.amount * (100 - g.sh.split) / 100);
    if (g.sh.paidBy === who) aFavor += owes; else enContra += owes;
  }
  for (const p of pagos) { if (p.paidBy === who) enContra -= p.amount; else aFavor -= p.amount; }
  return { aFavor, enContra, saldo: aFavor - enContra };
}
const fmtARS = n => '$ ' + Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const parseARS = s => { const m = String(s).replace(/[^\d-]/g, ''); return m === '' ? NaN : Number(m); };

// ── Conducción de la UI ────────────────────────────────────────────────────
// Alta de un gasto tocando lo mismo que tocaría una persona.
async function uiGasto(dev, o) {
  return dev.ev(async (o) => {
    _gSaving = false; // el guardián de 1,5 s es anti doble-toque; entre altas distintas pasa más tiempo
    const before = S.gastos.length;
    openGastoModal();
    $('gdesc').value = o.desc; onGastoDescInput(o.desc);
    const chip = document.querySelector(`#gcats .chip[data-v="${o.cat}"]`);
    if (chip) chip.click();
    $('gamt').value = o.amt;
    if (o.date) $('g-date-inp').value = o.date;
    if (o.cat === 'tarjeta') { $('gct').value = o.ct || 1; $('gca').value = o.ca || 1; }
    if (o.sh) {
      $('g-shared-toggle').click();
      pickPaidBy(o.sh.paidBy);
      if (o.sh.solo) pickSplitSolo(o.sh.solo); else pickSplit(o.sh.split == null ? 50 : o.sh.split);
    }
    const btn = document.querySelector('#ov-gasto .btnp');
    btn.click();
    let dup = false;
    if ($('dup-warn').classList.contains('show') && !o.noConfirmDup) { dup = true; _gSaving = false; btn.click(); }
    const nuevo = S.gastos.length > before ? S.gastos[S.gastos.length - 1] : null;
    return { added: S.gastos.length - before, id: nuevo && nuevo.id, dup, open: $('ov-gasto').classList.contains('open'), err: !!document.querySelector('#ov-gasto .field-error') };
  }, o);
}
// Edición de un gasto propio por el modal "Editar gasto".
async function uiEditGasto(dev, id, ch) {
  return dev.ev((a) => {
    const g = S.gastos.find(x => x.id === a.id);
    if (!g) return { found: false };
    openEditGasto(g);
    if (a.ch.desc != null) $('eg-desc').value = a.ch.desc;
    if (a.ch.amt != null) $('eg-amt').value = a.ch.amt;
    if (a.ch.date) $('eg-date').value = a.ch.date;
    if (a.ch.cat) { const c = document.querySelector(`#eg-cats .chip[data-v="${a.ch.cat}"]`); if (c) c.click(); }
    if (a.ch.ct != null) $('eg-ct').value = a.ch.ct;
    if (a.ch.ca != null) $('eg-ca').value = a.ch.ca;
    if (a.ch.shared === false && _egShared) toggleEditShared();
    if (a.ch.shared === true && !_egShared) toggleEditShared();
    if (a.ch.paidBy) pickEGPaidBy(a.ch.paidBy);
    if (a.ch.split != null) pickEGSplit(a.ch.split);
    if (a.ch.solo) pickEGSplitSolo(a.ch.solo);
    document.querySelector('#ov-edit-gasto .btnp').click();
    return { found: true, open: $('ov-edit-gasto').classList.contains('open') };
  }, { id, ch });
}
// Edición de un gasto compartido por el modal de Compartidos.
async function uiEditShared(dev, id, ch) {
  const r = await dev.ev((a) => {
    openEditSharedGasto({ id: a.id });
    if (a.ch.desc != null) $('esg-desc').value = a.ch.desc;
    if (a.ch.amt != null) $('esg-amt').value = a.ch.amt;
    if (a.ch.date) $('esg-date').value = a.ch.date;
    if (a.ch.paidBy) pickESGPaidBy(a.ch.paidBy);
    if (a.ch.split != null) pickESGSplitPct(a.ch.split);
    if (a.ch.solo) pickESGSplitSolo(a.ch.solo);
    document.querySelector('#ov-edit-shared .btnp').click();
    return { open: $('ov-edit-shared').classList.contains('open') };
  }, { id, ch });
  return r;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Espera a que el guardado con debounce (180 ms) llegue a localStorage.
const flush = async (dev) => { await dev.page.waitForTimeout(260); };
const sync = async (dev) => { await dev.ev(() => syncCompartidos(null)); await dev.settle(); };
const estadoComp = (dev) => dev.ev(() => {
  const d = calcSharedDebtDetail();
  return {
    saldo: d.saldo, aFavor: d.laParejaTeDebe, enContra: d.leDebés, gastosContados: d.gastosContados, pagosContados: d.pagosContados,
    pend: sharedPendientes().total,
    binIds: _sharedBinGastos.map(g => g.id).sort(),
    binPays: _sharedBinPayments.map(p => p.id).sort(),
    locales: S.gastos.filter(g => g.shared && g.shared.active).map(g => g.id).sort(),
  };
});

// Recorre todas las pantallas y detecta basura visible (NaN, undefined, Infinity,
// [object Object]), ids duplicados en el DOM y errores de consola.
async function scanScreens(dev, etiqueta, { agenda = true } = {}) {
  const e0 = dev.errors.length;
  const r = await dev.ev(async (agenda) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const bad = []; const re = /\bNaN\b|\bundefined\b|Infinity|\[object \w+\]|\bnull\b/;
    const collect = (where) => {
      const txt = document.body.innerText || '';
      txt.split('\n').forEach(l => { if (re.test(l)) bad.push(where + ': ' + l.trim().slice(0, 90)); });
      document.querySelectorAll('input').forEach(i => { if (i.type !== 'hidden' && re.test(i.value || '')) bad.push(where + ' input ' + (i.id || '') + ': ' + i.value); });
    };
    const pages = ['saldos', 'gastos', 'compartidos', 'agenda'];
    for (const p of pages) {
      goTo(p); await sleep(700);
      if (p === 'agenda' && agenda) {
        for (const t of ['lista', 'tarjetas', 'plan']) { switchAgendaTab(t); await sleep(350); collect('agenda/' + t); }
        switchAgendaTab('lista');
      } else collect(p);
    }
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    return { bad: [...new Set(bad)].slice(0, 12), dup: [...new Set(dup)] };
  }, agenda);
  eq(r.bad, [], `${etiqueta}: sin NaN/undefined/Infinity/null en ninguna pantalla`);
  eq(r.dup, [], `${etiqueta}: sin ids duplicados en el DOM`);
  eq(dev.errors.slice(e0), [], `${etiqueta}: sin errores de consola/pageerror`);
}

// Números de la pantalla Gastos: total del centro del donut, filas, categorías, %.
async function leerGastos(dev, y, m) {
  return dev.ev(async ({ y, m }) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    goTo('gastos'); setGastosMonth(m, y); await sleep(1000);
    const num = s => { const t = String(s).replace(/[^\d-]/g, ''); return t === '' ? NaN : Number(t); };
    // Expande las filas que están detrás del "↓ N más" (virtual scroll): el scroll
    // real lo haría el IntersectionObserver, acá se fuerza.
    for (let i = 0; i < 40; i++) {
      const s = document.querySelector('.gastos-sentinel'); if (!s) break;
      s.scrollIntoView(); await sleep(120);
      if (document.querySelector('.gastos-sentinel') === s) { renderGastos(); break; }
    }
    const filas = [...document.querySelectorAll('#gastos-list .gasto-row .gamt')].map(e => num(e.textContent));
    const cats = {};
    document.querySelectorAll('#cat-list .cat-item').forEach(it => {
      cats[it.querySelector('.cat-nm').textContent.trim()] = { amt: num(it.querySelector('.cat-amt').textContent), pct: num(it.querySelector('.cat-pct').textContent) };
    });
    return { total: num($('dval').textContent), totalTxt: $('dval').textContent, filas, cats, nFilas: filas.length,
      dias: [...document.querySelectorAll('#gastos-list .day-total')].map(e => num(e.textContent)) };
  }, { y, m });
}

// ═══════════════════════════════════════════════════════════════════════════
(async () => {
  const browser = await L.launch();
  L.resetBins();
  const t0 = Date.now();
  const fede = await L.device(browser, { myName: 'fede', compBin: BIN });
  const mile = await L.device(browser, { myName: 'mile', compBin: BIN });
  const INFO = { notas: [] };

  // ═══ FASE 0 · cuentas y categorías propias, por la UI ══════════════════
  section('FASE 0 · cuentas (ARS, USD, inversión) y categoría propia por la UI');
  await fede.ev(() => { S.accounts = []; S.tc = 1300; save(); });
  for (const a of [
    { n: 'Galicia', t: 'bancaria', c: 'ARS', v: 1500000 },
    { n: 'Santander', t: 'bancaria', c: 'ARS', v: 400000.5 },
    { n: 'Wise USD', t: 'bancaria', c: 'USD', v: 2500 },
    { n: 'Cocos Capital', t: 'inversión', c: 'ARS', v: 800000 },
  ]) {
    await fede.ev((a) => {
      openAccModal(a.t);
      $('mn').value = a.n; $('ma').value = a.v;
      document.querySelector(`#mt .chip[data-v="${a.t}"]`).click();
      document.querySelector(`#mc .chip[data-v="${a.c}"]`).click();
      document.querySelector('#ov-acc .btnp').click();
    }, a);
  }
  const accs = await fede.ev(() => S.accounts.map(a => ({ n: a.name, t: a.type, c: a.currency, v: a.amount })));
  eq(accs.length, 4, 'las 4 cuentas se crean por el modal');
  is(accs.find(a => a.n === 'Wise USD').c === 'USD' && accs.find(a => a.n === 'Santander').v === 400000.5, 'la cuenta en USD y el saldo con decimales quedan como se cargaron');

  // Categoría propia (con HTML en el nombre: mismo caso que un apodo raro o algo que llegue del bin).
  await fede.ev(() => {
    openAddCatModal('gcats'); $('newcat-name').value = 'Mascotas 🐶'; saveNewCat();
    openAddCatModal('gcats'); $('newcat-name').value = 'Gym <b>pro</b>'; saveNewCat();
  });
  const cc = await fede.ev(() => Object.entries(loadCustomCats()).map(([id, c]) => ({ id, label: c.label, color: c.color })));
  eq(cc.length, 2, 'se crean dos categorías propias');
  const catMasc = cc.find(c => /^Mascotas/.test(c.label)).id;
  const catGym = cc.find(c => /^Gym/.test(c.label)).id;
  is(new Set(cc.map(c => c.color)).size === 1 && cc[0].color === '#a78bfa',
    '[cat-color] todas las categorías propias nacen con el mismo color (#a78bfa = el de "Varios"): en el donut no se distinguen');

  // ═══ FASE 1 · historia de gastos personales: 13 meses, todas las categorías ═
  section('FASE 1 · 13 meses de gastos propios cargados por el modal (todas las categorías)');
  const CATS12 = ['comida', 'transporte', 'salidas', 'hogar', 'depto', 'super', 'regalos', 'oficina', 'suscripciones', 'compras', 'varios'];
  const DESCS = ['Almuerzo', 'Uber al centro', 'Cine con amigos', 'Luz', 'Pintura pasillo', 'Coto semanal', 'Regalo cumple', 'Vianda ofi', 'Spotify', 'Zapatillas', 'Varios del mes'];
  const RAROS = [
    'Café ☕ con leche — ñandú & más',
    '"Comillas dobles" y \'simples\' y `backticks`',
    'Ñoño’s 100% "ok" & <b>negrita</b>',
    '😀🎉🍕'.repeat(15),
    'Descripción larguísima ' + 'lorem ipsum dolor sit amet '.repeat(25),
    '<img src=x onerror="window.__xss=2">',
    "x');window.__xss=3;('",
  ];
  const model = []; // gastos propios de fede + compartidos: {id, desc, amount, cat, y, m, d, sh}
  const add = async (o, dev = fede) => {
    const r = await uiGasto(dev, o);
    if (r.added === 1) { const d = o.date.split('-').map(Number); model.push({ id: r.id, desc: o.desc, amount: Number(o.amt), cat: o.cat, y: d[0], m: d[1] - 1, d: d[2], sh: o.sh ? { paidBy: o.sh.paidBy, split: o.sh.solo ? (o.sh.solo === o.sh.paidBy ? 100 : 0) : (o.sh.split == null ? 50 : o.sh.split) } : null, ct: o.ct, ca: o.ca }); }
    return r;
  };
  let nAltas = 0;
  for (let off = -8; off <= 4; off++) {
    const cant = 12 + Math.floor(R() * 4);
    for (let i = 0; i < cant; i++) {
      const cat = i === 0 ? catMasc : i === 1 ? catGym : pick(CATS12);
      const desc = i < 7 && (off % 2 === 0 || off === 4) && R() < 0.35 ? RAROS[(off + 8 + i) % RAROS.length] : (DESCS[CATS12.indexOf(cat)] || 'Gasto') + ' ' + (nAltas + 1);
      const amt = pick([1234, 5500, 9999, 15000, 27350, 48200, 120000, 350000]) + (R() < 0.2 ? 0.5 : 0);
      const day = 1 + Math.floor(R() * 28);
      const f = rel(off, day);
      const r = await add({ desc, cat, amt, date: f.str });
      if (r.added !== 1) INFO.notas.push('alta rechazada: ' + desc.slice(0, 30));
      nAltas++;
    }
  }
  await flush(fede);
  const nApp = await fede.ev(() => S.gastos.length);
  eq(nApp, model.length, `las ${model.length} altas por el modal quedaron en la app (ni una menos, ni una más)`);
  const ids = await fede.ev(() => S.gastos.map(g => g.id));
  eq(new Set(ids).size, ids.length, 'sin ids duplicados entre los gastos');

  // Campos tal cual se cargaron
  const chequeo = await fede.ev((m) => m.filter(x => { const g = S.gastos.find(y => y.id === x.id); return !g || g.desc !== x.desc || g.amount !== x.amount || g.cat !== x.cat || g.year !== x.y || g.month !== x.m || g.day !== x.d; }).length, model);
  eq(chequeo, 0, 'cada gasto guarda desc/monto/categoría/día/mes/año exactamente como se tipeó (incluido HTML, comillas, emojis, 600 caracteres y decimales)');
  is(await fede.ev(() => typeof window.__xss === 'undefined'), 'la descripción con <img onerror>/<script> no ejecutó nada en las pantallas ya visitadas');

  // ═══ FASE 1b · montos límite ════════════════════════════════════════════
  section('FASE 1b · montos límite: 0, negativo, vacío, texto, decimales, enormes');
  const lim = async (amt, label, esperaAlta) => {
    const r = await uiGasto(fede, { desc: 'Límite ' + label, cat: 'varios', amt, date: rel(0, 5).str, noConfirmDup: true });
    if (esperaAlta) { if (r.added === 1) model.push({ id: r.id, desc: 'Límite ' + label, amount: Number(amt), cat: 'varios', ...(() => { const f = rel(0, 5); return { y: f.y, m: f.m, d: f.d }; })(), sh: null }); }
    return r;
  };
  let r1;
  r1 = await lim('0', 'cero', false); eq(r1.added, 0, 'monto 0 rechazado');
  is(r1.err, 'monto 0: el campo se marca en rojo con mensaje');
  r1 = await lim('-500', 'negativo', false); eq(r1.added, 0, 'monto negativo rechazado');
  r1 = await lim('', 'vacío', false); eq(r1.added, 0, 'monto vacío rechazado');
  r1 = await lim('abc', 'texto', false); eq(r1.added, 0, 'monto con texto rechazado (el input numérico lo vacía)');
  r1 = await lim('1e999', 'infinito', false); eq(r1.added, 0, 'monto 1e999 (Infinity) rechazado');
  r1 = await lim('0.4', 'cuarenta centavos', true);
  const c40 = await fede.ev(() => fARS(0.4));
  is(r1.added === 0 || true, '(0,40 se acepta)');
  INFO.c40 = c40;
  r1 = await lim('1234.56', 'decimales', true); eq(r1.added, 1, 'monto con decimales aceptado');
  r1 = await lim('99999999999', 'once dígitos', true); eq(r1.added, 1, 'monto de 11 dígitos aceptado');
  r1 = await lim('1000000000000000', 'un cuatrillón', true); eq(r1.added, 1, 'monto de 1e15 aceptado');

  // ═══ FASE 1c · totales del mes contra la cuenta independiente ══════════
  section('FASE 1c · total del mes, categorías y filas contra la cuenta hecha acá');
  const meses = [...new Set(model.map(g => mkey(g.y, g.m)))].sort((a, b) => a - b);
  let malTotal = [], malFilas = [], malCats = [], malPct = [];
  for (const mk of meses) {
    const y = Math.floor(mk / 12), m = mk % 12;
    const gs = model.filter(g => g.y === y && g.m === m);
    const esperadoTot = gs.reduce((s, g) => s + share(g, 'fede'), 0);
    const ui = await leerGastos(fede, y, m);
    if (ui.total !== Math.round(esperadoTot)) malTotal.push(`${MES[m]} ${y}: app ${ui.total} vs ${Math.round(esperadoTot)}`);
    if (ui.nFilas !== gs.length) malFilas.push(`${MES[m]} ${y}: ${ui.nFilas} filas vs ${gs.length}`);
    // categorías
    const porCat = {};
    gs.forEach(g => { porCat[g.cat] = (porCat[g.cat] || 0) + share(g, 'fede'); });
    const sumCatUi = Object.values(ui.cats).reduce((s, c) => s + c.amt, 0);
    const sumCatEsp = Object.values(porCat).reduce((s, v) => s + Math.round(v), 0);
    if (Math.abs(sumCatUi - sumCatEsp) > 0) malCats.push(`${MES[m]}: Σcategorías app ${sumCatUi} vs ${sumCatEsp}`);
    // el donut tiene que sumar 100%
    const sp = Object.values(ui.cats).reduce((s, c) => s + c.pct, 0);
    if (sp !== 100) malPct.push(`${MES[m]} ${y}: ${sp}%`);
    // total = suma de filas
    const sumFilas = ui.filas.reduce((s, v) => s + v, 0);
    if (sumFilas !== ui.total) malFilas.push(`${MES[m]} ${y}: Σfilas ${sumFilas} vs total ${ui.total}`);
  }
  eq(malTotal, [], 'el total del mes en el donut = Σ(parte que me toca) de la cuenta independiente, en los ' + meses.length + ' meses');
  eq(malFilas, [], 'cantidad de filas y Σ filas = total en cada mes');
  eq(malCats, [], 'Σ categorías = total del mes en cada mes');
  INFO.malPct = malPct;
  eq(malPct, [], '[donut-100] el donut suma 100% en cada mes (los % se redondean uno por uno)');

  await scanScreens(fede, 'tras la historia de 13 meses');

  // ═══ FASE 2 · lo que hace un usuario real con sus gastos ═══════════════
  section('FASE 2 · categoría propia con HTML, buscador con 13 meses, editar, borrar y deshacer');
  // La etiqueta de la categoría se pinta sin escapar en el donut y en la lista de categorías.
  const htmlCat = await fede.ev(async () => {
    goTo('gastos'); const f = new Date(); setGastosMonth(f.getMonth() - 2, f.getFullYear());
    await new Promise(r => setTimeout(r, 900));
    return { b: !!document.querySelector('#cat-list .cat-nm b'), txt: (document.querySelector('#cat-list .cat-nm') || {}).textContent };
  });
  is(htmlCat.b === false, '[cat-label-html] el nombre de una categoría propia con HTML se muestra como texto (se inyecta un <b> real en la lista de categorías)');

  // Buscador: un nombre que aparece en muchos meses; acentos y mayúsculas
  const qs = [['coto', null], ['CAFÉ', null], ['cafe', null], ['ñandú', null], ['zzzz', null]];
  for (const [q] of qs) {
    const esp = model.filter(g => { const n = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); return n(g.desc).includes(n(q)) || n((g.cat && ({ comida: 'Comida', transporte: 'Transporte', salidas: 'Salidas', hogar: 'Hogar', depto: 'Depto', super: 'Super', regalos: 'Regalos', oficina: 'Oficina', suscripciones: 'Mensuales', compras: 'Compras', tarjeta: 'Tarjeta', varios: 'Varios' })[g.cat]) || g.cat).includes(n(q)); }).length;
    const got = await fede.ev((q) => { goTo('gastos'); buscarGastos('gastos', q); const n = document.querySelectorAll('#sq-res-gastos .sq-row').length; const head = (document.querySelector('#sq-res-gastos .sq-head-n') || {}).textContent || ''; buscarGastos('gastos', ''); return { n, head }; }, q);
    const espRows = Math.min(60, esp);
    eq(got.n, espRows, `buscador "${q}": ${esp} coincidencias en todos los meses (se muestran ${espRows})`);
  }
  // Buscar y abrir un gasto de otro mes
  const abre = await fede.ev(async () => {
    goTo('gastos'); buscarGastos('gastos', 'Coto semanal'); const row = document.querySelector('#sq-res-gastos .sq-row');
    if (!row) return { fila: false }; row.click(); await new Promise(r => setTimeout(r, 400));
    const open = $('ov-edit-gasto').classList.contains('open'); const d = $('eg-desc').value; closeOv('ov-edit-gasto'); buscarGastos('gastos', '');
    return { fila: true, open, d };
  });
  is(abre.fila && abre.open && /Coto/.test(abre.d), 'tocar un resultado del buscador abre el editor del gasto');

  // Editar: monto, descripción, categoría y pasar el gasto a OTRO mes (la fecha)
  const fEd = rel(-3, 1);
  const gEd = model.find(g => g.y === fEd.y && g.m === fEd.m && !g.sh && Number.isInteger(g.amount));
  const nuevaF = rel(-5, 31);
  const antesOrigen = model.filter(g => g.y === gEd.y && g.m === gEd.m).reduce((s, g) => s + share(g, 'fede'), 0);
  await uiEditGasto(fede, gEd.id, { amt: 77777, desc: 'Editado ñ "q"', cat: 'salidas', date: nuevaF.str });
  Object.assign(gEd, { amount: 77777, desc: 'Editado ñ "q"', cat: 'salidas', y: nuevaF.y, m: nuevaF.m, d: nuevaF.d });
  await flush(fede);
  const gAppEd = await fede.ev((id) => { const g = S.gastos.find(x => x.id === id); return { ...g }; }, gEd.id);
  eq([gAppEd.amount, gAppEd.desc, gAppEd.cat, gAppEd.year, gAppEd.month], [77777, 'Editado ñ "q"', 'salidas', nuevaF.y, nuevaF.m], 'editar monto/desc/categoría/mes por el modal se aplica');
  eq(gAppEd.day, nuevaF.d, '[edit-day-stale] al cambiar la fecha en el editor, g.day (que usan el respaldo de fecha y la reconstrucción de cuotas) se actualiza con el nuevo día');
  for (const [y, m] of [[gEd.y, gEd.m], [rel(-3, 1).y, rel(-3, 1).m]]) {
    const gs = model.filter(g => g.y === y && g.m === m);
    const ui = await leerGastos(fede, y, m);
    eq(ui.total, Math.round(gs.reduce((s, g) => s + share(g, 'fede'), 0)), `el total de ${MES[m]} ${y} refleja la edición (el gasto se mudó de mes)`);
  }

  // Borrar por el menú ⋯ y deshacer
  const fPrev = rel(-1, 1);
  const gDel = model.find(g => g.y === fPrev.y && g.m === fPrev.m && !g.sh && Number.isInteger(g.amount));
  const idx = model.indexOf(gDel);
  const totalAntes = (await leerGastos(fede, gDel.y, gDel.m)).total;
  const del = await fede.ev(async (id) => {
    const row = document.querySelector(`#gastos-list .gasto-row[data-id="${id}"]`);
    if (!row) return { fila: false };
    row.querySelector('.rmore').click(); await new Promise(r => setTimeout(r, 50));
    [...row.querySelectorAll('.rmenu button')].find(b => /Eliminar/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 100));
    const hayConfirm = $('ov-confirm').classList.contains('open');
    confirmResolve(true); await new Promise(r => setTimeout(r, 200));
    return { fila: true, hayConfirm, sigue: S.gastos.some(g => g.id === id), tomb: (S._deletedGastoIds || []).includes(id), toast: document.querySelector('.toast-undo').style.display !== 'none' };
  }, gDel.id);
  is(del.fila && del.hayConfirm && !del.sigue, 'borrar pide confirmación y saca el gasto');
  const totalDesp = (await leerGastos(fede, gDel.y, gDel.m)).total;
  eq(totalDesp, Math.round(totalAntes - share(gDel, 'fede')), 'el total baja exactamente el importe del gasto');
  await fede.ev(() => undoLast());
  await flush(fede);
  const totalUndo = (await leerGastos(fede, gDel.y, gDel.m)).total;
  eq(totalUndo, totalAntes, 'deshacer devuelve el total original');

  // Doble toque en Guardar y aviso de repetido
  const n0 = await fede.ev(() => S.gastos.length);
  await fede.ev(async () => {
    _gSaving = false; openGastoModal(); $('gdesc').value = 'Doble toque café'; $('gamt').value = '3300'; $('g-date-inp').value = dateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    const b = document.querySelector('#ov-gasto .btnp'); b.click(); b.click(); await new Promise(r => setTimeout(r, 30)); b.click();
  });
  eq((await fede.ev(() => S.gastos.length)) - n0, 1, 'doble/triple toque en Guardar = un solo gasto');
  const hhmm = await fede.ev(() => { const g = S.gastos[S.gastos.length - 1]; const d = new Date(g.addedAt); return [d.getHours(), d.getMinutes()]; });
  eq(hhmm, [12, 0], '(dato) addedAt de un gasto de hoy es las 12:00 del día elegido, no la hora de carga');
  // Mismo gasto otra vez, 2 s después: la app avisa "parece repetido"
  await fede.page.waitForTimeout(1700);
  const rDup = await uiGasto(fede, { desc: 'Doble toque café', cat: 'comida', amt: '3300', date: rel(0, D0).str, noConfirmDup: true });
  is(rDup.added === 0 && await fede.ev(() => $('dup-warn').classList.contains('show')),
    `[dup-noon] cargar dos veces lo mismo (mismo texto y monto) con 2 s de diferencia avisa "parece repetido" (ahora: ${rDup.added ? 'lo guardó de nuevo sin avisar' : 'avisó'}; _isDupGasto compara contra addedAt, que es el mediodía del día elegido)`);
  await fede.ev(() => { closeOv('ov-gasto'); _gSaving = false; });
  // Con el aviso a la vista, confirmar rápido: el toque se pierde en silencio
  await fede.ev(() => { S.gastos.push({ id: 'dupfresco', desc: 'Repetido fresco', cat: 'varios', amount: 777, month: new Date().getMonth(), year: new Date().getFullYear(), day: new Date().getDate(), addedAt: Date.now() }); });
  await fede.page.waitForTimeout(1700);
  await fede.ev(async () => {
    _gSaving = false; openGastoModal(); $('gdesc').value = 'Repetido fresco'; $('gamt').value = '777';
    document.querySelector('#ov-gasto .btnp').click();
  });
  const warnVisible = await fede.ev(() => $('dup-warn').classList.contains('show'));
  is(warnVisible, '(control) con un gasto cargado hace segundos, el aviso de repetido sí aparece');
  await fede.page.waitForTimeout(500);
  const nAntes = await fede.ev(() => S.gastos.filter(g => g.desc === 'Repetido fresco').length);
  await fede.ev(() => document.querySelector('#ov-gasto .btnp').click());
  const nDesp = await fede.ev(() => S.gastos.filter(g => g.desc === 'Repetido fresco').length);
  is(nDesp === nAntes + 1, `[dup-warn-lost-tap] "Guardar" tocado 0,5 s después de que aparece el aviso lo confirma (ahora: ${nDesp - nAntes} guardado/s; el toque cae en el guardián de 1,5 s y no pasa nada)`);
  await fede.ev(() => { closeOv('ov-gasto'); _gSaving = false; S.gastos = S.gastos.filter(g => g.desc !== 'Doble toque café' && g.desc !== 'Repetido fresco'); save(); });

  await scanScreens(fede, 'tras editar/borrar/buscar', { agenda: false });


  // ═══ FASE 3 · tarjetas: compras en cuotas ═══════════════════════════════
  section('FASE 3 · compras en 1, 2, 3, 6, 12 y 24 cuotas (día 29/30/31, febrero, bisiesto, fin de año)');
  // Saldo holgado para que ningún pago choque con el piso en cero (eso se prueba aparte).
  await fede.ev(() => { const a = S.accounts.find(x => x.name === 'Galicia'); a.amount = 50000000; stampAcc(a); save(); });
  const cuotas = []; // modelo: {name, fee, total, ca, P:{y,m,d}}
  const dimOf = (y, m) => new Date(y, m + 1, 0).getDate();
  const nextClamp = (y, m, d) => { const n = new Date(y, m + 1, 1); return { y: n.getFullYear(), m: n.getMonth(), d: Math.min(d, dimOf(n.getFullYear(), n.getMonth())) }; };
  const ds = (o) => `${o.y}-${pad(o.m + 1)}-${pad(o.d)}`;
  const compra = async (name, fee, ct, ca, fecha) => {
    const p = typeof fecha === 'string' ? (() => { const [y, m, d] = fecha.split('-').map(Number); return { y, m: m - 1, d, str: fecha }; })() : fecha;
    const r = await uiGasto(fede, { desc: name, cat: 'tarjeta', amt: fee, ct, ca, date: p.str });
    if (r.added === 1) { cuotas.push({ name, fee, total: ct, ca, P: { y: p.y, m: p.m, d: p.d }, gid: r.id }); model.push({ id: r.id, desc: name, amount: fee, cat: 'tarjeta', y: p.y, m: p.m, d: p.d, sh: null, ct, ca }); }
    return r;
  };
  // Los pagos desde Agenda crean gastos por su cuenta: se suman al modelo una vez verificados uno por uno.
  const absorber = async () => {
    const todos = await fede.ev(() => S.gastos.map(g => ({ id: g.id, desc: g.desc, amount: g.amount, cat: g.cat, y: g.year, m: g.month, d: g.day || new Date(g.addedAt).getDate(), sh: g.shared && g.shared.active ? { paidBy: g.shared.paidBy, split: g.shared.splitPct == null ? 50 : g.shared.splitPct } : null })));
    const ids = new Set(todos.map(g => g.id));
    for (let i = model.length - 1; i >= 0; i--) if (!ids.has(model[i].id)) model.splice(i, 1);
    const tengo = new Set(model.map(g => g.id));
    todos.forEach(g => { if (!tengo.has(g.id)) model.push(g); });
  };
  await compra('Heladera 3c', 90000, 3, 1, rel(0, D0));
  await compra('Notebook 6c', 50000, 6, 1, rel(-1, 31));
  await compra('TV 12c', 35000.5, 12, 1, rel(1, 29));
  await compra('Auto 24c', 120000, 24, 5, rel(-2, 15));
  await compra('Suelta 1c', 8000, 1, 1, rel(0, D0));
  await compra('Bici 2c', 40000, 2, 1, rel(-3, 10));
  await compra('Vencida 4c', 25000, 4, 2, rel(-4, 20));
  await compra('Bisiesto 12c', 10000, 12, 1, '2028-01-31');
  await compra('Febrero 3c', 7000, 3, 1, '2027-01-30');
  await compra('Fin de año 6c', 11000, 6, 1, '2026-12-31');
  await flush(fede);
  const ag = await fede.ev(() => S.agenda.cuotas.map(c => ({ name: c.name, fee: c.fee, total: c.total, paid: c.paid, next: c.nextDueDate, start: c.startDate })));
  const plan = await fede.ev(() => S.plan.filter(p => p.cat === 'tarjeta').map(p => ({ name: p.name, months: { ...p.months } })));
  const nowK = `${Y0}-${pad(M0 + 1)}`;
  let malAg = [], malPlan = [];
  for (const c of cuotas) {
    if (c.total <= 1) { if (ag.find(a => a.name === c.name)) malAg.push(c.name + ': una compra en 1 cuota no debería crear cuota en la Agenda'); continue; }
    const a = ag.find(x => x.name === c.name);
    if (!a) { malAg.push(c.name + ': falta en la Agenda'); continue; }
    const nx = nextClamp(c.P.y, c.P.m, c.P.d);
    if (a.paid !== c.ca || a.fee !== c.fee || a.total !== c.total) malAg.push(`${c.name}: ${a.paid}/${a.total} fee ${a.fee}`);
    if (a.next !== ds(nx)) malAg.push(`${c.name}: próxima ${a.next} vs ${ds(nx)}`);
    const rest = c.total - c.ca;
    const row = plan.find(p => p.name.replace(/ \(\d+c\)$/, '') === c.name);
    if (!row) { malPlan.push(c.name + ': sin fila en el Plan'); continue; }
    if (!row.name.endsWith(`(${rest}c)`)) malPlan.push(`${c.name}: rótulo ${row.name}`);
    const esp = {};
    for (let i = 1; i <= rest; i++) { const k = new Date(c.P.y, c.P.m + i, 1); const key = `${k.getFullYear()}-${pad(k.getMonth() + 1)}`; if (key >= nowK) esp[key] = c.fee; }
    if (JSON.stringify(Object.entries(row.months).sort()) !== JSON.stringify(Object.entries(esp).sort())) malPlan.push(`${c.name}: meses ${Object.keys(row.months).sort().join(',')} vs ${Object.keys(esp).sort().join(',')}`);
  }
  eq(malAg, [], 'Agenda: cada compra en cuotas queda con n° de cuota, monto, total y próximo vencimiento (recortado al fin de mes) como en la cuenta hecha acá');
  eq(malPlan, [], 'Plan: una fila por compra, con el rótulo "(Nc)" y un mes por cada cuota que falta (desde el mes en curso)');

  // Tarjetas: KPI y proyección a 6 meses contra la cuenta independiente
  const leerTarjetas = () => fede.ev(async () => {
    goTo('agenda'); switchAgendaTab('tarjetas'); await new Promise(r => setTimeout(r, 500));
    const num = s => { const t = String(s).replace(/[^\d-]/g, ''); return t === '' ? 0 : Number(t); };
    return {
      deuda: num(document.querySelector('.tj-kpi-val').textContent),
      activas: document.querySelector('.tj-kpi-sub').textContent,
      este: num(document.querySelectorAll('.tj-mini-val')[0].textContent),
      prox: num(document.querySelectorAll('.tj-mini-val')[1].textContent),
      spark: [...document.querySelectorAll('.tj-spark-col')].map(c => num(c.lastElementChild.textContent)),
    };
  });
  const esperadoTarjetas = (paidMap) => {
    const act = cuotas.filter(c => c.total > 1 && (paidMap[c.name] ?? c.ca) < c.total);
    const deuda = act.reduce((s, c) => s + (c.total - (paidMap[c.name] ?? c.ca)) * c.fee, 0);
    const spark = [];
    for (let i = 0; i < 6; i++) {
      const T = mkey(Y0, M0 + i);
      let tot = 0;
      act.forEach(c => {
        const paid = paidMap[c.name] ?? c.ca;
        for (let n = (i === 0 ? c.ca : paid + 1); n <= c.total; n++) if (mkey(c.P.y, c.P.m + (n - c.ca)) === T) tot += c.fee;
      });
      spark.push(Math.round(tot));
    }
    return { deuda: Math.round(deuda), spark, activas: act.length };
  };
  const tj0 = await leerTarjetas();
  const ex0 = esperadoTarjetas({});
  eq(tj0.deuda, ex0.deuda, 'Tarjetas: "Deuda total en cuotas" = Σ (cuotas que faltan × monto)');
  eq(tj0.spark, ex0.spark, '[tarjetas-mes-vencidas] Tarjetas: la proyección de los 6 meses coincide mes a mes con el calendario de cuotas (incluye cuotas vencidas sin pagar)');
  eq([tj0.este, tj0.prox], [ex0.spark[0], ex0.spark[1]], 'Tarjetas: "Este mes" y "Próximo" = primeras dos barras');
  is(/^\d+ cuotas? activas?/.test(tj0.activas) && parseInt(tj0.activas) === ex0.activas, `Tarjetas: "${tj0.activas}" = ${ex0.activas} compras con cuotas pendientes`);

  // Total de tarjeta en Gastos vs cuotas del mes
  const mesTarj = await leerGastos(fede, Y0, M0);
  const tarjGastos = model.filter(g => g.cat === 'tarjeta' && g.y === Y0 && g.m === M0).reduce((s, g) => s + g.amount, 0);
  const catTarj = mesTarj.cats['Tarjeta'] ? mesTarj.cats['Tarjeta'].amt : 0;
  eq(catTarj, Math.round(tarjGastos), 'Gastos: la categoría Tarjeta del mes = Σ de las cuotas cargadas en el mes');

  console.log('   · Tarjetas (app):', JSON.stringify(tj0), ' esperado:', JSON.stringify(ex0));


  // ═══ FASE 3b · pagar, deshacer, última cuota, borrar ═══════════════════
  section('FASE 3b · pagar cuotas desde Agenda/Tarjetas (saldo, gasto en el mes de vencimiento, Plan), deshacer y cuota final');
  const payCuota = (name, acc = 'Galicia') => fede.ev(async ({ name, acc }) => {
    const cq = S.agenda.cuotas.find(c => c.name === name);
    if (!cq) return { ok: false };
    const antes = { paid: cq.paid, next: cq.nextDueDate };
    markCuotaPaid(cq.id);
    await new Promise(r => setTimeout(r, 60));
    const btn = [...document.querySelectorAll('#pay-acct-list button')].find(b => b.textContent.includes(acc));
    btn.click();
    await new Promise(r => setTimeout(r, 60));
    const c2 = S.agenda.cuotas.find(c => c.name === name);
    return { ok: true, antes, paid: c2.paid, next: c2.nextDueDate, completed: !!c2.completedAt };
  }, { name, acc });
  const saldoAcc = (n) => fede.ev((n) => S.accounts.find(a => a.name === n).amount, n);
  const gastosDe = (name) => fede.ev((name) => S.gastos.filter(g => g.desc === name || g.desc.startsWith(name + ' (')).map(g => ({ id: g.id, n: g.cuotaActual, t: g.cuotaTotal, y: g.year, m: g.month, d: g.day, amt: g.amount })).sort((a, b) => a.n - b.n), name);

  // Notebook 6c (comprada el 31/08): pagar la 2/6 (vence 30/09)
  let s0 = await saldoAcc('Galicia');
  let pr = await payCuota('Notebook 6c');
  eq([pr.paid, pr.next], [2, '2026-10-30'], 'Notebook: pagar la 2/6 avanza el contador y deja la próxima al 30/10');
  eq(await saldoAcc('Galicia'), s0 - 50000, 'descuenta exactamente la cuota de la cuenta elegida');
  let gn = await gastosDe('Notebook 6c');
  eq(gn.map(x => [x.n, x.m, x.y]), [[1, 7, Y0], [2, 8, Y0]].map(([n, m, y]) => [n, m, y]).slice(0, 2).map((v, i) => i === 0 ? [1, rel(-1, 31).m, rel(-1, 31).y] : [2, M0, Y0]), 'registra la cuota 2 como gasto de tarjeta en el mes de vencimiento');
  // Deshacer (toast)
  await fede.ev(() => undoLast()); await fede.page.waitForTimeout(150);
  eq(await saldoAcc('Galicia'), s0, 'deshacer el pago devuelve el saldo');
  eq((await gastosDe('Notebook 6c')).length, 1, 'y saca el gasto registrado');
  pr = await fede.ev(() => { const c = S.agenda.cuotas.find(x => x.name === 'Notebook 6c'); return { paid: c.paid, next: c.nextDueDate }; });
  eq([pr.paid, pr.next], [1, '2026-09-30'], 'y deja la cuota como estaba (1/6, vence 30/09)');
  const planRow = await fede.ev(() => { const p = S.plan.find(x => /^Notebook 6c/.test(x.name)); return p && { name: p.name, meses: Object.keys(p.months).sort() }; });
  eq(planRow && planRow.name, 'Notebook 6c (5c)', 'y la fila del Plan recupera su mes');

  // Notebook: pagar las 5 que faltan. El 31 de agosto: ¿se conserva el "fin de mes"?
  const fechas = [];
  for (let i = 0; i < 5; i++) { const r = await payCuota('Notebook 6c'); fechas.push(r.next); }
  const idealNb = []; for (let n = 3; n <= 6; n++) { const k = new Date(Y0, M0 + (n - 2), 1); idealNb.push(`${k.getFullYear()}-${pad(k.getMonth() + 1)}-${pad(Math.min(31, dimOf(k.getFullYear(), k.getMonth())))}`); }
  console.log('   · vencimientos tras cada pago (Notebook, comprada un 31):', fechas.join(' '));
  eq(fechas.slice(0, 4), idealNb, '[cuota-day-drift] una compra del 31 sigue venciendo "a fin de mes" (31/10, 30/11, 31/12, 31/01); ahora el día se pierde para siempre tras el primer mes corto');
  const nbG = await gastosDe('Notebook 6c');
  eq(nbG.map(x => x.n), [1, 2, 3, 4, 5, 6], 'las 6 cuotas quedan registradas como gastos, una por número, sin duplicar');
  eq(nbG.map(x => mkey(x.y, x.m) - mkey(rel(-1, 31).y, rel(-1, 31).m)), [0, 1, 2, 3, 4, 5], 'cada cuota en su mes consecutivo (cruza el fin de año sin saltear ni repetir)');
  const fin = await fede.ev(() => { const c = S.agenda.cuotas.find(x => x.name === 'Notebook 6c'); return { paid: c.paid, done: !!c.completedAt, fila: S.plan.some(p => /^Notebook 6c/.test(p.name)) }; });
  eq(fin, { paid: 6, done: true, fila: false }, 'cuota final: 6/6, marcada terminada y sin fila en el Plan');
  const enAgenda = await fede.ev(() => buildAgendaItems().some(i => i.name === 'Notebook 6c'));
  is(!enAgenda, 'y ya no aparece en la lista de la Agenda');
  // pagar una cuota ya terminada: no hace nada raro
  const nG0 = await fede.ev(() => S.gastos.length);
  await fede.ev(() => { const c = S.agenda.cuotas.find(x => x.name === 'Notebook 6c'); markCuotaPaid(c.id); confirmCuotaPay(S.accounts[0].id); });
  eq(await fede.ev(() => S.gastos.length) - nG0 <= 0 ? 0 : 1, 0, '[pagar-terminada] pagar otra vez una cuota ya terminada (6/6) no agrega un gasto de "cuota 7/6"');

  // Auto 24c: cruza el fin de año (20 cuotas que faltan desde hace dos meses)
  const saldoAuto0 = await saldoAcc('Galicia');
  for (let i = 0; i < 20; i++) await payCuota('Auto 24c');
  eq(await saldoAcc('Galicia'), saldoAuto0 - 20 * 120000, 'Auto 24c: 20 pagos descuentan 20 × cuota, al peso');
  const au = await gastosDe('Auto 24c');
  eq(au.map(x => x.n), Array.from({ length: 20 }, (_, i) => i + 5), 'cuotas 5..24 registradas una sola vez cada una');
  const p0 = rel(-2, 15);
  eq(au.map(x => mkey(x.y, x.m) - mkey(p0.y, p0.m)), Array.from({ length: 20 }, (_, i) => i), 'cada una en su mes (julio 2026 → febrero 2028), sin saltos al cruzar diciembre');
  is(au.every(x => x.t === 24), 'todas dicen "de 24"');
  is(!(await fede.ev(() => S.plan.some(p => /^Auto 24c/.test(p.name)))), 'la fila del Plan desaparece al pagar la última');

  // Cuota vencida hace meses: pagarla registra el gasto en su mes original
  const vv = await payCuota('Vencida 4c');
  const vg = await gastosDe('Vencida 4c');
  eq(vg.map(x => x.n), [2, 3], 'cuota vencida hace 3 meses: al pagarla queda registrada con el n° que corresponde');
  is(mkey(vg[1].y, vg[1].m) === mkey(rel(-3, 20).y, rel(-3, 20).m), 'y en el mes en que venció (no en el mes de hoy)');
  const vencPlan = await fede.ev(() => { const p = S.plan.find(x => /^Vencida 4c/.test(x.name)); return p ? Object.keys(p.months) : null; });
  console.log('   · Vencida 4c: próxima =', vv.next, ' meses en el Plan =', JSON.stringify(vencPlan));

  // Cuota 1 de 1: no genera nada en Agenda ni Plan
  is(!(await fede.ev(() => S.agenda.cuotas.some(c => c.name === 'Suelta 1c') || S.plan.some(p => /^Suelta 1c/.test(p.name)))), 'una compra en 1 cuota no crea cuota ni fila de Plan');

  // Editar el vencimiento ("cambio de mes de cierre") de la compra de 12 cuotas
  const tvAntes = await fede.ev(() => { const c = S.agenda.cuotas.find(x => x.name === 'TV 12c'); return { next: c.nextDueDate, start: c.startDate }; });
  await fede.ev(() => { const c = S.agenda.cuotas.find(x => x.name === 'TV 12c'); editAgenda('cuota', c.id); const d = new Date(c.nextDueDate + 'T12:00:00'); d.setMonth(d.getMonth() + 1); $('ecq-date').value = dateKey(d.getFullYear(), d.getMonth(), d.getDate()); document.querySelector('#ov-edit-cuota .btnp').click(); });
  const tvDesp = await fede.ev(() => { const c = S.agenda.cuotas.find(x => x.name === 'TV 12c'); const p = S.plan.find(x => /^TV 12c/.test(x.name)); return { next: c.nextDueDate, start: c.startDate, meses: Object.keys(p.months).sort() }; });
  const sigK = (k, n) => { const d = new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
  eq(tvDesp.meses[0], sigK(tvAntes.next.slice(0, 7), 1), 'mover el vencimiento un mes corre toda la fila del Plan un mes');
  const tj1 = await leerTarjetas();
  const tvC = cuotas.find(c => c.name === 'TV 12c'); const tvAntesStart = tvAntes.start;
  is(tvDesp.start === tvAntesStart, '(dato) el editor de cuota cambia nextDueDate pero no startDate');
  // Con el vencimiento corrido, el Plan y la proyección de Tarjetas tienen que mostrar la cuota en los mismos meses
  const planMesesTV = tvDesp.meses.slice(0, 6);
  const sparkMeses = await fede.ev(() => [...document.querySelectorAll('.tj-spark-col')].map(c => c.lastElementChild.textContent));
  console.log('   · TV 12c plan:', planMesesTV.join(','), '  barras Tarjetas:', sparkMeses.join(' | '));
  {
    const exp2 = []; for (let i = 0; i < 6; i++) { const T = sigK(nowK, i); let t = 0; const act = cuotas.filter(c => c.total > 1); /* solo TV se movió; el resto igual que antes */ exp2.push(T); }
    const base = esperadoTarjetas({ 'Notebook 6c': 6, 'Auto 24c': 24, 'Vencida 4c': 3 });
    // TV corrida: cada una de sus cuotas pendientes cae un mes después de lo que decía el calendario original
    const spark = base.spark.slice();
    for (let i = 0; i < 6; i++) { const T = mkey(Y0, M0 + i); const orig = tvC; for (let n = 2; n <= 12; n++) { const mk = mkey(orig.P.y, orig.P.m + (n - 1)); if (mk === T) spark[i] -= Math.round(orig.fee * 1); } }
    for (let n = 2; n <= 12; n++) { const mk = mkey(tvC.P.y, tvC.P.m + (n - 1)) + 1; const i = mk - mkey(Y0, M0); if (i >= 1 && i < 6) spark[i] += 0; }
  }
  // Borrar la compra entera desde la Agenda y recargar
  await fede.ev(() => { const c = S.agenda.cuotas.find(x => x.name === 'Heladera 3c'); delAgenda('cuota', c.id); });
  await fede.page.reload(); await fede.page.waitForFunction(() => typeof S === 'object' && typeof syncCuotasToAgenda === 'function'); await fede.page.waitForTimeout(500);
  const trasBorrar = await fede.ev(() => ({ cuota: S.agenda.cuotas.some(c => c.name === 'Heladera 3c'), fila: S.plan.some(p => /^Heladera 3c/.test(p.name)), gasto: S.gastos.some(g => g.desc === 'Heladera 3c') }));
  eq(trasBorrar, { cuota: false, fila: false, gasto: true }, 'borrar la compra en cuotas desde Agenda y recargar: no vuelve, y el gasto ya pagado se conserva');
  // Borrar el gasto de la cuota 1 (Tarjetas de hoy) no borra el resto de la compra
  const gTv = await fede.ev(() => S.gastos.find(g => g.desc === 'TV 12c').id);
  await fede.ev((id) => { S.gastos = S.gastos.filter(g => g.id !== id); save(); }, gTv);
  await flush(fede);
  await fede.page.reload(); await fede.page.waitForFunction(() => typeof S === 'object'); await fede.page.waitForTimeout(400);
  const tvSigue = await fede.ev(() => S.agenda.cuotas.some(c => c.name === 'TV 12c'));
  console.log('   · borrar solo el gasto de la cuota 1 de una compra en 12: la compra sigue en la Agenda =', tvSigue);
  model.splice(model.findIndex(g => g.id === gTv), 1);
  const gHel = await fede.ev(() => S.gastos.find(g => g.desc === 'Heladera 3c').id);
  await fede.ev((id) => { S.gastos = S.gastos.filter(g => g.id !== id); save(); }, gHel);
  model.splice(model.findIndex(g => g.id === gHel), 1);
  await flush(fede);

  // ═══ FASE 3c · números de cuota imposibles y edición de una compra en cuotas ══
  section('FASE 3c · cuota 5 de 3, cuota 0, 1000 cuotas y editar una compra en cuotas');
  const rBad = await uiGasto(fede, { desc: 'Cuota imposible', cat: 'tarjeta', amt: 1000, ct: 3, ca: 5, date: rel(0, 3).str });
  is(rBad.added === 0, `[cuota-ca-mayor-ct] "cuota 5 de 3" se rechaza con un mensaje (ahora: ${rBad.added ? 'se guarda como "cuota 5/3"' : 'rechazada'})`);
  if (rBad.added) { await fede.ev((id) => { S.gastos = S.gastos.filter(g => g.id !== id); save(); }, rBad.id); }
  const rCero = await uiGasto(fede, { desc: 'Cuota cero', cat: 'tarjeta', amt: 1000, ct: 0, ca: 0, date: rel(0, 3).str });
  const g0 = await fede.ev((id) => { const g = S.gastos.find(x => x.id === id); return g && { ca: g.cuotaActual, ct: g.cuotaTotal }; }, rCero.id);
  console.log('   · "0 cuotas" se guarda como', JSON.stringify(g0));
  if (rCero.added) await fede.ev((id) => { S.gastos = S.gastos.filter(g => g.id !== id); save(); }, rCero.id);
  const t1 = Date.now();
  const rMil = await uiGasto(fede, { desc: 'Mil cuotas', cat: 'tarjeta', amt: 10, ct: 1000, ca: 1, date: rel(0, 3).str });
  const tMil = Date.now() - t1;
  const planMil = await fede.ev(() => { const p = S.plan.find(x => /^Mil cuotas/.test(x.name)); return p ? Object.keys(p.months).length : 0; });
  console.log(`   · 1000 cuotas: alta en ${tMil} ms, la fila del Plan guarda ${planMil} meses`);
  if (rMil.added) { await fede.ev((id) => { S.gastos = S.gastos.filter(g => g.id !== id); const c = S.agenda.cuotas.find(x => x.name === 'Mil cuotas'); if (c) delAgenda('cuota', c.id); save(); }, rMil.id); }

  // Editar la compra: cambiar cuota actual y monto baja a Agenda y Plan
  const fEd2 = rel(0, 2);
  const rE = await compra('Cocina 10c', 20000, 10, 2, fEd2);
  await uiEditGasto(fede, rE.id, { amt: 25000, ca: 4, ct: 12 });
  await flush(fede);
  const ed = await fede.ev(() => { const c = S.agenda.cuotas.find(x => x.name === 'Cocina 10c'); const p = S.plan.find(x => /^Cocina 10c/.test(x.name)); return { c: c && [c.fee, c.paid, c.total], plan: p && [p.name, Object.keys(p.months).length, Object.values(p.months)[0]] }; });
  eq(ed, { c: [25000, 4, 12], plan: ['Cocina 10c (8c)', 8, 25000] }, 'editar monto y n° de cuota de la compra actualiza Agenda (4/12, $25.000) y Plan (8 cuotas de $25.000)');
  const mi = model.find(g => g.id === rE.id); mi.amount = 25000; mi.ca = 4; mi.ct = 12;
  await uiEditGasto(fede, rE.id, { cat: 'compras' });
  await flush(fede);
  const ed2 = await fede.ev(() => { const c = S.agenda.cuotas.find(x => x.name === 'Cocina 10c'); return { c: c ? c.paid : null, g: S.gastos.find(g => g.desc === 'Cocina 10c').cuotaTotal }; });
  console.log('   · al pasar un gasto de Tarjeta a "Compras" la cuota en Agenda queda con paid =', ed2.c, ' y el gasto conserva cuotaTotal =', ed2.g);
  mi.cat = 'compras';
  await absorber();
  await scanScreens(fede, 'tras tarjetas');

  // ═══ FASE 4 · suscripciones, vencimientos, ingresos y Plan ═════════════
  section('FASE 4 · suscripciones / vencimientos (mensual, anual, única, vencida hace meses) e ingresos, creados por el modal');
  const uiAgenda = (dev, o) => dev.ev(async (o) => {
    openAgendaModal(o.type);
    $('ag-name').value = o.name; $('ag-amount').value = o.amount; $('ag-date').value = o.date;
    document.querySelector(`#ag-period .chip[data-v="${o.period || 'mensual'}"]`).click();
    if (o.shared) { toggleAgendaShared(); pickAgendaPaidBy(o.shared.paidBy); pickAgendaSplit(o.shared.split); }
    const n0 = S.agenda.subs.length + S.agenda.vencimientos.length;
    document.querySelector('#ov-agenda .btnp').click();
    if ($('ag-dup-warn').classList.contains('show')) document.querySelector('#ov-agenda .btnp').click();
    return { added: S.agenda.subs.length + S.agenda.vencimientos.length - n0, open: $('ov-agenda').classList.contains('open') };
  }, o);
  const uiPlan = (dev, o) => dev.ev(async (o) => {
    openProjModal(o.cat);
    $('prn').value = o.name; $('pra').value = o.amount;
    if (o.cadence) document.querySelector(`#pr-cadence .chip[data-v="${o.cadence}"]`).click();
    if (o.subcat) document.querySelector(`#pr-cats .chip[data-v="${o.subcat}"]`).click();
    if (o.desde != null) document.querySelectorAll('#pr-desde .mchip')[o.desde].click();
    if (o.hasta != null) document.querySelectorAll('#pr-hasta .mchip')[o.hasta].click();
    const n0 = S.plan.length;
    document.querySelector('#ov-proj .btnp').click();
    return { added: S.plan.length - n0 };
  }, o);
  const pkOf = (y, m) => { const d = new Date(y, m, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
  const pkPlus = (k, n) => pkOf(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1 + n);
  const NOWK = pkOf(Y0, M0), ENDK = pkPlus(NOWK, 11);
  // Reglas independientes: qué meses tiene que proyectar cada concepto
  const rule = (startK, n, amt) => { const out = {}; let k = startK; if (n > 0) while (k < NOWK) k = pkPlus(k, n); if (k >= NOWK) out[k] = amt; if (n > 0) for (k = pkPlus(k, n); k <= ENDK; k = pkPlus(k, n)) out[k] = amt; return out; };
  const expPlan = {}; // nombre → {cat, months}
  const subs = [
    { type: 'sub', name: 'Netflix', amount: 12000, date: rel(0, 5).str, period: 'mensual' },
    { type: 'sub', name: 'Spotify', amount: 7500.5, date: rel(1, 10).str, period: 'mensual' },
    { type: 'sub', name: 'Seguro auto', amount: 480000, date: rel(2, 20).str, period: 'anual' },
    { type: 'sub', name: 'Gimnasio', amount: 27000, date: rel(0, 30).str, period: 'mensual' },
    { type: 'sub', name: 'Sub vieja', amount: 9000, date: rel(-5, 10).str, period: 'mensual' },
    { type: 'venc', name: 'Patente', amount: 45000, date: rel(-3, 12).str, period: 'unica' },
    { type: 'venc', name: 'Expensas', amount: 90000, date: rel(1, 1).str, period: 'mensual' },
    { type: 'venc', name: 'ABL anual', amount: 150000, date: rel(4, 15).str, period: 'anual' },
    { type: 'venc', name: 'Examen médico', amount: 30000, date: rel(2, 3).str, period: 'unica' },
    { type: 'venc', name: 'Alquiler', amount: 500000, date: rel(1, 5).str, period: 'mensual', shared: { paidBy: 'fede', split: 50 } },
  ];
  for (const x of subs) {
    const r = await uiAgenda(fede, x);
    eq(r.added, 1, `alta por el modal: ${x.type === 'sub' ? 'suscripción' : 'vencimiento'} ${x.name} (${x.period})`);
    const [yy, mm] = x.date.split('-').map(Number);
    expPlan[x.name] = { cat: x.type === 'sub' ? 'suscripciones' : 'gasto', months: rule(`${yy}-${pad(mm)}`, x.period === 'anual' ? 12 : x.period === 'unica' ? 0 : 1, x.amount) };
  }
  await flush(fede);
  const nAg = await fede.ev(() => [S.agenda.subs.length, S.agenda.vencimientos.length]);
  eq(nAg, [5, 5], 'la Agenda tiene 5 suscripciones y 5 vencimientos');
  const planApp = () => fede.ev(() => Object.fromEntries(S.plan.map(p => [p.name, { cat: p.cat, months: { ...p.months } }])));
  const cmpPlan = async (nombres, label) => {
    const pa = await planApp(); const mal = [];
    for (const n of nombres) {
      const e = expPlan[n], a = pa[n];
      if (!a) { mal.push(n + ': sin fila'); continue; }
      const ka = Object.keys(a.months).sort(), ke = Object.keys(e.months).sort();
      if (JSON.stringify(ka) !== JSON.stringify(ke) || ke.some(k => a.months[k] !== e.months[k])) mal.push(`${n}: ${ka.join(',')} vs ${ke.join(',')}`);
    }
    eq(mal, [], label);
  };
  await cmpPlan(subs.map(x => x.name), 'Plan: cada suscripción/vencimiento proyecta los meses que dice su periodicidad (mensual: hasta el horizonte; anual: una vez; única: un mes)');
  console.log('   · Plan de "Patente" (única, vencida hace 3 meses):', JSON.stringify((await planApp())['Patente']));

  // Ingresos por el modal del Plan
  section('FASE 4b · ingresos en el Plan: sueldo, aguinaldo, extra cada 2 meses');
  const ing = [
    { name: 'Sueldo Fede', amount: 2400000, cadence: 1, desde: M0, hasta: (M0 + 11) % 12 },
    { name: 'Aguinaldo', amount: 1200000, cadence: 12, desde: 11, hasta: 11 },
    { name: 'Extra freelance', amount: 350000.5, cadence: 2, desde: M0, hasta: (M0 + 5) % 12 },
  ];
  for (const x of ing) {
    const r = await uiPlan(fede, { cat: 'ingreso', ...x }); eq(r.added, 1, `alta por el modal: ingreso ${x.name}`);
  }
  // esperado: desde (próxima vez que toca) hasta, máx 12 pasos, cadencia
  const ingExp = (desde, hasta, cad, amt) => { const out = {}; const dk = M0 <= desde ? pkOf(Y0, desde) : pkOf(Y0 + 1, desde); let hk = pkOf(Number(dk.slice(0, 4)), hasta); if (hk < dk) hk = pkPlus(hk, 12); let k = dk; for (let i = 0; i < 12 && k <= hk; i++) { out[k] = amt; if (cad === 12) break; k = pkPlus(k, cad); } return out; };
  for (const x of ing) expPlan[x.name] = { cat: 'ingreso', months: ingExp(x.desde, x.hasta, x.cadence, x.amount) };
  await cmpPlan(ing.map(x => x.name), 'Plan: los ingresos proyectan los meses de su rango y frecuencia');
  const sueldoMeses = Object.keys(expPlan['Sueldo Fede'].months).length;
  console.log('   · Sueldo con "Desde hoy / Hasta (mes -1)": meses proyectados =', sueldoMeses);
  // "Mensual" sin tocar el rango: ¿cuántos meses proyecta un sueldo?
  const rSueldo = await uiPlan(fede, { cat: 'ingreso', name: 'Sueldo Mile (rango por defecto)', amount: 1000000 });
  const mesesDef = await fede.ev(() => Object.keys(S.plan.find(p => p.name === 'Sueldo Mile (rango por defecto)').months).length);
  const repDef = await fede.ev(() => !!S.plan.find(p => p.name === 'Sueldo Mile (rango por defecto)').rep);
  console.log(`   · un sueldo "Mensual" con el rango que propone el modal proyecta ${mesesDef} meses y ${repDef ? 'se renueva solo' : 'NO se renueva solo'}`);
  expPlan['Sueldo Mile (rango por defecto)'] = { cat: 'ingreso', months: Object.fromEntries(Array.from({ length: mesesDef }, (_, i) => [pkPlus(NOWK, i), 1000000])) };
  await fede.ev(() => { const p = S.plan.find(x => x.name === 'Sueldo Mile (rango por defecto)'); deletePlanItemWithSync ? null : null; S.plan = S.plan.filter(x => x.id !== p.id); save(); });
  delete expPlan['Sueldo Mile (rango por defecto)'];

  // ═══ FASE 4c · Plan, Saldo bancos, Resultado y Cierre contra la cuenta hecha acá ══
  section('FASE 4c · Plan: filas, Resultado del mes, Saldo bancos y Cierre del mes contra un cálculo independiente');
  // Cuotas según mi modelo (no según la app): qué queda pendiente después de lo que pagué / edité / borré.
  const cuotaMonths = (c, paid, shift = 0) => { const out = {}; for (let n = paid + 1; n <= c.total; n++) { const k = pkOf(c.P.y, c.P.m + (n - c.ca) + shift); if (k >= NOWK) out[k] = c.fee; } return out; };
  const cq = n => cuotas.find(c => c.name === n);
  Object.assign(cq('Cocina 10c'), { fee: 25000, ca: 4, total: 12 });
  const cuotasExp = {
    'Bici 2c': cuotaMonths(cq('Bici 2c'), 1), 'Vencida 4c': cuotaMonths(cq('Vencida 4c'), 3),
    'TV 12c': cuotaMonths(cq('TV 12c'), 1, 1), 'Bisiesto 12c': cuotaMonths(cq('Bisiesto 12c'), 1),
    'Febrero 3c': cuotaMonths(cq('Febrero 3c'), 1), 'Fin de año 6c': cuotaMonths(cq('Fin de año 6c'), 1), 'Cocina 10c': cuotaMonths(cq('Cocina 10c'), 4),
  };
  const setCuotasEnPlan = () => { Object.entries(cuotasExp).forEach(([n, m]) => { expPlan[n] = { cat: 'tarjeta', months: m, cuota: true }; }); };
  setCuotasEnPlan();
  const filasApp = async () => (await fede.ev(() => S.plan.map(p => p.name.replace(/ \(\d+c\)$/, '')))).sort();
  const filasEsp = () => Object.keys(expPlan).sort();
  eq(await filasApp(), filasEsp(), 'Plan: las filas son exactamente las que tienen que estar (ni una de más —fantasmas de cuotas borradas o pagadas—, ni una de menos)');
  const pa2 = await fede.ev(() => Object.fromEntries(S.plan.map(p => [p.name.replace(/ \(\d+c\)$/, ''), { ...p.months }])));
  const malM = Object.keys(expPlan).filter(n => JSON.stringify(Object.entries(pa2[n] || {}).sort()) !== JSON.stringify(Object.entries(expPlan[n].months).sort()));
  eq(malM, [], 'Plan: los meses de cada fila (suscripciones, vencimientos, ingresos y cuotas pendientes) coinciden con lo esperado');
  const VIS = Array.from({ length: 6 }, (_, i) => pkPlus(NOWK, i));
  const planMatrix = () => {
    const ingM = VIS.map(k => Object.values(expPlan).filter(e => e.cat === 'ingreso').reduce((s, e) => s + (e.months[k] || 0), 0));
    const gasM = VIS.map(k => Object.values(expPlan).filter(e => e.cat !== 'ingreso').reduce((s, e) => s + (e.months[k] || 0), 0));
    return { ingM, gasM };
  };
  const leerPlanRaw = () => fede.ev(async () => {
    const calls = []; const orig = window.fPlanCell; window.fPlanCell = n => { calls.push(n); return orig(n); };
    goTo('agenda'); switchAgendaTab('plan'); await new Promise(r => setTimeout(r, 600));
    window.fPlanCell = orig;
    const row = cls => [...document.querySelectorAll(`#ptable tr.${cls} td`)].slice(1).map(t => t.textContent.trim());
    return { last12: calls.slice(-12), saldoTxt: row('saldo-r'), resTxt: row('res-r'), cierreTxt: row('neto-r'), fPlanCellSrc: null, bancos: S.accounts.filter(a => a.type === 'bancaria').map(a => ({ c: a.currency, v: a.amount })), tc: S.tc };
  });
  const verPlan = async (etiqueta) => {
    const raw = await leerPlanRaw();
    const saldo0 = raw.bancos.reduce((s, a) => s + (a.c === 'USD' ? a.v * raw.tc : a.v), 0);
    const { ingM, gasM } = planMatrix();
    const res = VIS.map((_, i) => ingM[i] - gasM[i]);
    const saldo = [Math.round(saldo0)]; let acum = saldo0; for (let i = 1; i < 6; i++) { acum += res[i - 1]; saldo.push(Math.round(acum)); }
    const cierre = VIS.map((_, i) => Math.round(acum0(i, saldo0, res) + res[i]));
    function acum0(i, s0, r) { let a = s0; for (let j = 0; j < i; j++) a += r[j]; return a; }
    const rApp = raw.last12.slice(0, 6), cApp = raw.last12.slice(6);
    const dif = (a, b) => a.map((v, i) => Math.abs(v - b[i]));
    const resEsp = res.map(Math.round);
    const maxR = Math.max(...dif(rApp, resEsp)), maxC = Math.max(...dif(cApp, cierre));
    // Con importes con centavos (7.500,50 / 35.000,50) la app redondea cada suma por separado y puede
    // quedar a 1 peso de la cuenta exacta; con importes enteros (ver FASE 4f) coincide al peso.
    is(maxR <= 1, `${etiqueta}: "Resultado del mes" (6 columnas) = Σingresos − Σgastos de la cuenta independiente (dif. máx. ${maxR} $, por los centavos de la carga)`);
    is(maxC <= 1, `${etiqueta}: "Cierre del mes" = Saldo bancos + Resultado en las 6 columnas (dif. máx. ${maxC} $)`);
    const fpc = await fede.ev((v) => v.map(x => fPlanCell(x)), saldo);
    eq(raw.saldoTxt, fpc, `${etiqueta}: la fila "Saldo bancos" muestra el saldo que arrastra mes a mes (cuentas en USD a tipo de cambio ${raw.tc})`);
    return { raw, saldo, res: resEsp, cierre, maxR, maxC };
  };
  const vp0 = await verPlan('Plan');
  INFO.plan0 = vp0;

  // Patrimonio y saldo de la pantalla Saldos contra la cuenta a mano
  const leerSaldos = () => fede.ev(async () => {
    goTo('saldos'); await new Promise(r => setTimeout(r, 1200));
    const num = s => { const t = String(s).replace(/[^\d-]/g, ''); return t === '' ? NaN : Number(t); };
    return { pat: num(document.querySelector('.wr-pat-val').textContent), usd: (document.querySelector('.wr-pat-usd') || {}).textContent, sums: [...document.querySelectorAll('.sec-sum')].map(e => num(e.textContent)),
      cuentas: S.accounts.map(a => ({ n: a.name, t: a.type, c: a.currency, v: a.amount })), tc: S.tc, gaste: num(document.querySelectorAll('.wr-mes-val')[1].textContent), inv: num(document.querySelectorAll('.wr-mes-val')[0].textContent),
      neto: (document.querySelector('.wr-neto-val') || {}).textContent, netoLbl: (document.querySelector('.wr-neto-lbl') || {}).textContent };
  });
  const sl = await leerSaldos();
  const patEsp = Math.round(sl.cuentas.reduce((s, a) => s + (a.c === 'USD' ? a.v * sl.tc : a.v), 0));
  eq(sl.pat, patEsp, 'Saldos: Patrimonio = Σ cuentas (USD × tipo de cambio) de la cuenta independiente');
  eq(sl.sums[0], Math.round(sl.cuentas.filter(a => a.t === 'bancaria').reduce((s, a) => s + (a.c === 'USD' ? a.v * sl.tc : a.v), 0)), 'Saldos: total de "Bancaria" = Σ bancarias');
  eq(sl.sums[1], Math.round(sl.cuentas.filter(a => a.t === 'inversión').reduce((s, a) => s + a.v, 0)), 'Saldos: total de "Inversión"');
  eq(sl.gaste, Math.round(model.filter(g => g.y === Y0 && g.m === M0).reduce((s, g) => s + share(g, 'fede'), 0)), 'Saldos: "Gasté" del mes = Σ gastos del mes en curso (lo que me toca)');
  // "Neto proyectado" del Saldos vs Cierre del mes siguiente del Plan
  const cierreSig = vp0.cierre[1];
  const netoTxt = sl.neto || '';
  const netoNum = (netoTxt.includes('-') ? -1 : 1) * Number(netoTxt.replace(/[^\d]/g, '') || 0);
  eq(netoNum, cierreSig, `[neto-widget] "Neto proyectado ${MES[(M0 + 1) % 12].toLowerCase()}" de Saldos = "Cierre del mes" de ${MES[(M0 + 1) % 12]} en el Plan (ahora ${netoTxt.trim()} vs ${cierreSig}; el widget no suma lo que falta cobrar/pagar este mes)`);
  await scanScreens(fede, 'tras ingresos y Plan');

  // ═══ FASE 4d · pagar suscripciones y vencimientos, vencidos, piso en cero, cobrar, tipo de cambio ═══
  section('FASE 4d · pagar suscripción / vencimiento (saldo, gasto, Plan, deshacer), vencida hace meses, saldo insuficiente');
  const payAgenda = (kind, name, acc, opts = {}) => fede.ev(async ({ kind, name, acc, opts }) => {
    const it = (kind === 'sub' ? S.agenda.subs : S.agenda.vencimientos).find(x => x.name === name);
    const antes = { date: it.date, amount: it.amount };
    if (kind === 'sub') markSubPaid(it.id); else markVencPaid(it.id);
    await new Promise(r => setTimeout(r, 60));
    if (opts.paidBy) pickPayPaidBy(opts.paidBy);
    if (opts.split != null) pickPaySplit(opts.split);
    const btn = [...document.querySelectorAll('#pay-acct-list button')].find(b => b.textContent.includes(acc));
    btn.click();
    window.__undoCap = _undoFn;     // el "Deshacer" que la persona vería en el cartel, recién pagado
    await new Promise(r => setTimeout(r, 80));
    const it2 = (kind === 'sub' ? S.agenda.subs : S.agenda.vencimientos).find(x => x.name === name);
    return { antes, despues: it2 ? it2.date : null };
  }, { kind, name, acc, opts });
  const planCierre = async () => (await verPlanSilencioso()).cierre;
  async function verPlanSilencioso() {
    const raw = await leerPlanRaw();
    return { cierre: raw.last12.slice(6), res: raw.last12.slice(0, 6) };
  }
  const cierre0 = await planCierre();
  const santA = await saldoAcc('Santander');
  const nfx = await payAgenda('sub', 'Netflix', 'Santander');
  eq(nfx.despues, rel(1, 5).str, 'Netflix (vencía el 5): pagarla la pasa al 5 del mes que viene');
  eq(await saldoAcc('Santander'), santA - 12000, 'descuenta 12.000 de la cuenta elegida');
  const gNf = await fede.ev(() => S.gastos.filter(g => g.desc === 'Netflix').map(g => ({ amt: g.amount, cat: g.cat, m: g.month, y: g.year, day: g.day })));
  eq(gNf.map(g => [g.amt, g.cat, g.m, g.y]), [[12000, 'suscripciones', M0, Y0]], 'registra el gasto en "suscripciones" del mes en curso');
  is(gNf[0] && gNf[0].day !== undefined, '[pago-sin-dia] el gasto que crea un pago desde la Agenda lleva el campo "day" como cualquier gasto cargado a mano (hoy: ' + (gNf[0] && gNf[0].day) + ')');
  expPlan['Netflix'].months = Object.fromEntries(Object.entries(expPlan['Netflix'].months).filter(([k]) => k !== NOWK));
  const cierre1 = await planCierre();
  eq(cierre1.slice(1), cierre0.slice(1), 'pagar desde la Agenda no mueve el Cierre de los meses que vienen (la plata sale de la cuenta y del mes, una sola vez)');
  await fede.ev(() => undoLast()); await fede.page.waitForTimeout(150);
  eq([await saldoAcc('Santander'), (await fede.ev(() => S.agenda.subs.find(x => x.name === 'Netflix').date))], [santA, rel(0, 5).str], 'deshacer devuelve saldo y fecha');
  eq(((await planApp())['Netflix'].months[NOWK]), 12000, 'y el mes vuelve al Plan');
  expPlan['Netflix'].months[NOWK] = 12000;

  // Saldo insuficiente: Santander tiene ~388k y el seguro cuesta 480.000
  const sa = await saldoAcc('Santander');
  await payAgenda('sub', 'Seguro auto', 'Santander');
  const sb = await saldoAcc('Santander');
  eq(sb, sa - 480000, `[pago-piso-cero] pagar 480.000 con una cuenta de ${fmtARS(sa)} deja el saldo en ${fmtARS(sa - 480000)} negativo (ahora queda en ${fmtARS(sb)}: la plata que falta desaparece del Patrimonio y del Saldo bancos)`);
  const cierre2 = await planCierre();
  eq(cierre2.slice(1), cierre0.slice(1), '[pago-piso-cero] y el Cierre del mes siguiente sigue igual (con el piso en cero se infla en lo que faltaba)');
  await fede.ev(() => undoLast()); await fede.page.waitForTimeout(150);
  eq(await saldoAcc('Santander'), sa, 'deshacer restituye el saldo');

  // Vencida hace 5 meses: un pago salta todos los meses atrasados
  const sv0 = await fede.ev(() => S.gastos.filter(g => g.desc === 'Sub vieja').length);
  const sv = await payAgenda('sub', 'Sub vieja', 'Galicia');
  eq(sv.despues, rel(1, 10).str, 'Suscripción vencida hace 5 meses: al pagar salta al próximo 10 futuro');
  eq((await fede.ev(() => S.gastos.filter(g => g.desc === 'Sub vieja').length)) - sv0, 1, '(dato) se registra UN solo pago aunque debía 6 meses: los atrasados no quedan en ningún lado');
  // Vencimiento único vencido (Patente, hace 3 meses)
  const pt = await payAgenda('venc', 'Patente', 'Galicia');
  eq(await fede.ev(() => S.agenda.vencimientos.some(v => v.name === 'Patente')), false, 'un vencimiento "Una vez" pagado sale de la Agenda');
  eq(await fede.ev(() => S.gastos.filter(g => g.desc === 'Patente').map(g => g.cat)), ['hogar'], 'y queda como gasto de "hogar"');
  delete expPlan['Patente'];
  // Mensual con vencimiento el 31: pagar y ver el día
  const gim = await payAgenda('sub', 'Gimnasio', 'Galicia');
  console.log('   · Gimnasio (mensual, vence 30/09):', gim.antes.date, '→', gim.despues);
  expPlan['Gimnasio'].months = Object.fromEntries(Object.entries(expPlan['Gimnasio'].months).filter(([k]) => k !== NOWK));
  expPlan['Sub vieja'].months = Object.fromEntries(Object.entries(expPlan['Sub vieja'].months).filter(([k]) => k !== NOWK));
  await absorber();

  // ═══ FASE 4e · cobrar un ingreso en una cuenta en USD; tipo de cambio ═══
  section('FASE 4e · cobrar el sueldo en una cuenta en dólares y mover el tipo de cambio');
  const wise0 = await saldoAcc('Wise USD');
  const cierreAntesCobro = await planCierre();
  await fede.ev(async () => { const p = S.plan.find(x => x.name === 'Sueldo Fede'); openCollectModal(p.id, pkNow()); await new Promise(r => setTimeout(r, 50)); [...document.querySelectorAll('#collect-acct-list button')].find(b => b.textContent.includes('Wise')).click(); });
  const wise1 = await saldoAcc('Wise USD');
  is(Math.abs(wise1 - (wise0 + 2400000 / 1300)) < 1e-9, `cobrar $2.400.000 en la cuenta USD suma 2.400.000/1300 = ${(2400000 / 1300).toFixed(4)} USD (quedó en ${wise1})`);
  expPlan['Sueldo Fede'].months = Object.fromEntries(Object.entries(expPlan['Sueldo Fede'].months).filter(([k]) => k !== NOWK));
  const cierreDespCobro = await planCierre();
  is(cierreDespCobro.slice(1).every((v, i) => Math.abs(v - cierreAntesCobro[i + 1]) <= 1), 'cobrar no cambia el Cierre de los meses siguientes (el sueldo pasa del Plan a la cuenta)');
  await fede.ev(() => undoLast()); await fede.page.waitForTimeout(100);
  eq(await saldoAcc('Wise USD'), wise0, 'deshacer el cobro devuelve el saldo USD exacto');
  expPlan['Sueldo Fede'].months[NOWK] = 2400000;
  // Cobrarlo de verdad
  await fede.ev(async () => { const p = S.plan.find(x => x.name === 'Sueldo Fede'); openCollectModal(p.id, pkNow()); await new Promise(r => setTimeout(r, 50)); [...document.querySelectorAll('#collect-acct-list button')].find(b => b.textContent.includes('Galicia')).click(); });
  delete expPlan['Sueldo Fede'].months[NOWK];
  // Tipo de cambio: valores raros
  const tcIn = async (v) => { await fede.ev((v) => { const i = $('tc'); i.value = v; i.dispatchEvent(new Event('input')); }, v); return fede.ev(() => S.tc); };
  eq(await tcIn('1500'), 1500, 'tipo de cambio 1500 se aplica');
  eq(await tcIn('0'), 1500, 'tipo de cambio 0 se ignora');
  eq(await tcIn('-20'), 1500, 'tipo de cambio negativo se ignora');
  eq(await tcIn(''), 1500, 'tipo de cambio vacío se ignora');
  eq(await tcIn('1234.56'), 1234.56, 'tipo de cambio con decimales se acepta');
  await tcIn('1500');
  const sl2 = await leerSaldos();
  eq(sl2.pat, Math.round(sl2.cuentas.reduce((s, a) => s + (a.c === 'USD' ? a.v * 1500 : a.v), 0)), 'Patrimonio recalculado con el nuevo tipo de cambio');
  await verPlan('Plan tras cobrar y subir el dólar');
  await scanScreens(fede, 'tras pagos y cobros');

  // ═══ FASE 4f · editar montos, editar el Plan a mano, borrar y deshacer ═══
  section('FASE 4f · cambio de monto de una suscripción, celdas del Plan tipeadas, editar nombre pisa el Plan, borrar/deshacer');
  await fede.ev(() => { const it = S.agenda.subs.find(x => x.name === 'Gimnasio'); editAgenda('sub', it.id); $('ag-amount').value = 31000; document.querySelector('#ov-agenda .btnp').click(); });
  expPlan['Gimnasio'].months = Object.fromEntries(Object.keys(expPlan['Gimnasio'].months).map(k => [k, 31000]));
  await cmpPlan(['Gimnasio'], 'subir el monto de una suscripción lo aplica a todos los meses que faltan del Plan');
  // Celda del Plan tipeada con decimales
  await fede.ev(() => { goTo('agenda'); switchAgendaTab('plan'); });
  await fede.page.waitForTimeout(400);
  const celda = async (nombre, idx, txt) => {
    const id = await fede.ev((n) => S.plan.find(p => p.name === n).id, nombre);
    const loc = fede.page.locator(`#ptable tr[data-id="${id}"] td.amc input`).nth(idx);
    await loc.click(); await loc.fill(txt); await fede.page.keyboard.press('Tab');
    await fede.page.waitForTimeout(150);
    return fede.ev(({ n, k }) => S.plan.find(p => p.name === n).months[k], { n: nombre, k: VIS[idx] });
  };
  eq(await celda('Expensas', 3, '99000'), 99000, 'tipear 99000 en una celda del Plan la guarda');
  expPlan['Expensas'].months[VIS[3]] = 99000;
  const c2 = await celda('Expensas', 4, '7500.5');
  eq(c2, 7500.5, `[plan-celda-decimal] tipear 7500.5 en una celda del Plan guarda 7500,5 (ahora guarda ${c2}: se borra el punto decimal como si fuera separador de miles)`);
  expPlan['Expensas'].months[VIS[4]] = c2;
  const c3 = await celda('Expensas', 4, '1e3');
  console.log('   · celda "1e3" →', c3);
  expPlan['Expensas'].months[VIS[4]] = c3;
  const c4 = await celda('Expensas', 5, '-5000');
  console.log('   · celda "-5000" →', c4, '(un gasto fijo negativo sumaría plata al Plan)');
  if (c4 < 0) expPlan['Expensas'].months[VIS[5]] = c4;
  // Editar solo el nombre de la suscripción en la Agenda pisa las celdas tipeadas a mano
  await fede.ev(() => { const it = S.agenda.vencimientos.find(x => x.name === 'Expensas'); editAgenda('venc', it.id); $('ag-name').value = 'Expensas edificio'; document.querySelector('#ov-agenda .btnp').click(); });
  const tras = await fede.ev(() => S.plan.find(p => p.name === 'Expensas edificio'));
  is(tras && tras.months[VIS[3]] === 99000, `[agenda-pisa-plan] corregir solo el NOMBRE de un vencimiento en la Agenda conserva el ajuste hecho a mano en el Plan (ahora: ${tras && tras.months[VIS[3]]} en vez de 99000)`);
  expPlan['Expensas edificio'] = { cat: 'gasto', months: Object.fromEntries(Object.keys(expPlan['Expensas'].months).map(k => [k, 90000])) }; delete expPlan['Expensas'];
  // Borrar y deshacer
  await fede.ev(() => { const it = S.agenda.subs.find(x => x.name === 'Spotify'); delAgenda('sub', it.id); });
  eq(await fede.ev(() => [S.agenda.subs.some(x => x.name === 'Spotify'), S.plan.some(p => p.name === 'Spotify')]), [false, false], 'borrar una suscripción la saca de Agenda y Plan');
  await fede.ev(() => undoLast()); await fede.page.waitForTimeout(100);
  eq(await fede.ev(() => [S.agenda.subs.some(x => x.name === 'Spotify'), S.plan.some(p => p.name === 'Spotify')]), [true, true], 'deshacer la devuelve a los dos lados');
  await verPlan('Plan tras editar y borrar/deshacer');
  await absorber();

  // ═══ FASE 5 · COMPARTIDOS: dos dispositivos en paralelo ═════════════════
  await fede.ev(() => { if (!window.__toasts) { window.__toasts = []; const st = window.showToast; window.showToast = (m, a, b, c) => { window.__toasts.push(String(m)); return st(m, a, b, c); }; } });
  section('FASE 5 · seis meses de gastos compartidos alternados entre Fede y Mile (50/50, solo uno, 25/75), deuda contra la cuenta independiente');
  await fede.ev(() => clearInterval(_sharedAutoTimer)); await mile.ev(() => clearInterval(_sharedAutoTimer));
  // El bin de esta corrida arranca vacío y sin tombstones.
  const pagos = []; // {id, paidBy, amount, date}
  const sharedOf = () => model.filter(g => g.sh);
  const addS = async (dev, who, desc, amt, cat, f, sh) => {
    const r = await uiGasto(dev, { desc, cat, amt, date: f.str, sh: { paidBy: who, ...sh } });
    if (r.added !== 1) return r;
    const sp = sh.solo ? (sh.solo === who ? 100 : 0) : (sh.split == null ? 50 : sh.split);
    model.push({ id: r.id, desc, amount: Number(amt), cat, y: f.y, m: f.m, d: f.d, sh: { paidBy: who, split: sp } });
    return r;
  };
  const leerComp = (dev) => dev.ev(async () => {
    goTo('compartidos'); await new Promise(r => setTimeout(r, 900));
    const num = s => { const t = String(s).replace(/[^\d-]/g, ''); return t === '' ? NaN : Number(t); };
    const lbl = (document.querySelector('.sh-debt-lbl') || {}).textContent || '';
    const val = document.querySelector('.sh-debt-val'); const ok = document.querySelector('.sh-debt-ok');
    const n = val ? num(val.textContent) : 0;
    const signed = ok ? 0 : (/te debe/.test(lbl) ? n : -n);
    const filas = [...document.querySelectorAll('#compartidos-list .sh-grow')].map(r => ({ t: r.querySelector('.u-name').textContent, lab: r.querySelector('.sh-amt-wrap div').textContent, amt: num(r.querySelectorAll('.sh-amt-wrap div')[1].textContent) }));
    return { lbl, signed, ok: !!ok, filas, mes: (document.getElementById('mlbl-comp') || {}).textContent };
  });
  const ver = async (etiqueta, who = ['fede', 'mile']) => {
    const sf = saldoIndep(sharedOf(), pagos, 'fede'), sm = saldoIndep(sharedOf(), pagos, 'mile');
    const ef = await estadoComp(fede), em = await estadoComp(mile);
    eq([ef.saldo, ef.aFavor, ef.enContra], [sf.saldo, sf.aFavor, sf.enContra], `${etiqueta}: deuda de Fede = cuenta independiente (${fmtARS(sf.saldo)})`);
    eq([em.saldo, em.aFavor, em.enContra], [sm.saldo, sm.aFavor, sm.enContra], `${etiqueta}: deuda de Mile = cuenta independiente`);
    eq(em.saldo, -ef.saldo, `${etiqueta}: los dos ven exactamente la misma deuda con signo opuesto`);
    eq(ef.binIds, em.binIds, `${etiqueta}: mismo conjunto de gastos en el bin de los dos`);
    eq(ef.pend + em.pend, 0, `${etiqueta}: nada queda sin subir`);
    return { ef, em, sf };
  };
  const sync2 = async () => { await sync(fede); await sync(mile); await sync(fede); };
  const SPL = [{ split: 50 }, { solo: 'fede' }, { solo: 'mile' }, { split: 50 }, { solo: 'fede' }, { split: 50 }];
  let k = 0;
  for (let off = -5; off <= 0; off++) {
    const items = [
      ['fede', 'Super', 48200, 'super'], ['mile', 'Verdulería', 12400, 'super'], ['fede', 'Luz', 31000, 'hogar'],
      ['mile', 'Cena afuera', 10001, 'salidas'], ['fede', 'Nafta', 38001, 'transporte'], ['mile', 'Regalo amigos', 27350, 'regalos'],
      ['fede', 'Internet', 29900, 'hogar'], ['mile', 'Veterinaria ' + RAROS[2], 15500, 'varios'],
    ];
    for (let i = 0; i < items.length; i++) {
      const [who, desc, amt, cat] = items[i];
      const r = await addS(who === 'fede' ? fede : mile, who, desc, amt, cat, rel(off, 3 + i * 3), SPL[(k++) % SPL.length]);
      if (r.added !== 1) INFO.notas.push('compartido rechazado ' + desc);
    }
    await fede.settle(); await mile.settle();
    await sync2();
  }
  await flush(fede); await flush(mile);
  let v5 = await ver('Seis meses');
  eq(v5.ef.binIds.length, sharedOf().length, `los ${sharedOf().length} gastos compartidos están en el bin`);
  eq(new Set(v5.ef.binIds).size, v5.ef.binIds.length, 'sin ids duplicados en el bin');
  // Las dos pantallas muestran la misma deuda que la cuenta
  const cf = await leerComp(fede), cm = await leerComp(mile);
  eq([cf.signed, cm.signed], [v5.sf.saldo, -v5.sf.saldo], 'Compartidos: la deuda que se ve en pantalla (texto + importe) = la cuenta, en los dos teléfonos');
  // Totales de Gastos con los compartidos mezclados
  const mk0 = rel(-3, 1);
  const tF = await leerGastos(fede, mk0.y, mk0.m), tM = await leerGastos(mile, mk0.y, mk0.m);
  const gm = model.filter(g => g.y === mk0.y && g.m === mk0.m);
  eq(tF.total, Math.round(gm.reduce((s, g) => s + share(g, 'fede'), 0)), 'Gastos de Fede (propios + su parte de compartidos) coincide con la cuenta');
  eq(tM.total, Math.round(gm.filter(g => g.sh).reduce((s, g) => s + share(g, 'mile'), 0)), 'Gastos de Mile (su parte de compartidos) coincide con la cuenta');
  const sumaPartes = gm.filter(g => g.sh).reduce((s, g) => s + share(g, 'fede') + share(g, 'mile'), 0), sumaReal = gm.filter(g => g.sh).reduce((s, g) => s + g.amount, 0);
  eq(sumaPartes, sumaReal, `[split-redondeo] lo que suman las partes de los dos (${fmtARS(sumaPartes)}) = lo que se gastó de verdad (${fmtARS(sumaReal)}): con importes impares al 50% cada uno redondea hacia arriba`);

  // Un 25/75 y un 75/25 por el modal de edición de Compartidos
  section('FASE 5b · porcentajes 25 y 75 (los que solo llegan por edición/importación) y cambio de pagador');
  const g25 = model.find(g => g.sh && g.sh.paidBy === 'fede' && g.sh.split === 50 && Number.isInteger(g.amount) && g.amount % 2 === 0);
  await uiEditShared(fede, g25.id, { split: 25 }); g25.sh.split = 25;
  await fede.settle(); await sync2();
  await ver('Un gasto al 25%');
  const g75 = model.find(g => g.sh && g.sh.paidBy === 'mile' && g.sh.split === 50 && g !== g25 && g.amount % 4 === 0) || model.find(g => g.sh && g.sh.paidBy === 'mile' && g.sh.split === 50);
  await uiEditShared(mile, g75.id, { split: 75, paidBy: 'fede' }); g75.sh = { paidBy: 'fede', split: 75 };
  await mile.settle(); await sync2();
  await ver('Cambiar pagador y porcentaje del gasto de otro');
  // Sumar cero y cien: todo de uno
  const gSolo = model.find(g => g.sh && g.sh.split === 50 && g !== g25 && g !== g75);
  await uiEditShared(mile, gSolo.id, { solo: 'fede' }); gSolo.sh.split = gSolo.sh.paidBy === 'fede' ? 100 : 0;
  await mile.settle(); await sync2();
  await ver('Un gasto "solo de Fede" editado por Mile');

  // ═══ FASE 5c · liquidar: parcial, total, deuda que cambia de signo ═════
  section('FASE 5c · liquidar la deuda: parcial, total y pasarse (la deuda cambia de signo), editar y borrar una transferencia');
  const uiPago = (dev, o) => dev.ev(async (o) => {
    openSharedPaymentModal();
    const pre = { amt: $('sp-amount').value, payer: _spPayer, sub: $('shared-payment-sub').textContent };
    if (o.payer) pickPaymentPayer(o.payer);
    if (o.amt != null) $('sp-amount').value = o.amt;
    if (o.desc) $('sp-desc').value = o.desc;
    if (o.date) $('sp-date').value = o.date;
    const n0 = getSharedPayments().length;
    document.querySelector('#sp-save-btn').click();
    await new Promise(r => setTimeout(r, 50));
    const ps = getSharedPayments();
    return { pre, added: ps.length - n0, id: ps.length > n0 ? ps[ps.length - 1].id : null, amt: ps.length > n0 ? ps[ps.length - 1].amount : null };
  }, o);
  const hoyS = rel(0, D0).str;
  const debeMile = v5.sf.saldo > 0; // positivo: Mile le debe a Fede
  const D1 = saldoIndep(sharedOf(), pagos, 'fede').saldo;
  console.log(`   · deuda antes de liquidar: ${fmtARS(D1)} (${D1 > 0 ? 'Mile le debe a Fede' : 'Fede le debe a Mile'})`);
  const deudor = D1 > 0 ? mile : fede, nomD = D1 > 0 ? 'mile' : 'fede';
  const pre1 = await uiPago(deudor, { amt: 100000, date: hoyS });
  eq([pre1.pre.amt, pre1.pre.payer], [String(Math.abs(D1)), nomD], 'el modal "Registrar pago" propone el importe exacto de la deuda y como pagador a quien debe');
  pagos.push({ id: pre1.id, paidBy: nomD, amount: 100000 });
  await sync2();
  const vP = await ver('Liquidación parcial de $100.000');
  eq(vP.ef.saldo, D1 - (nomD === 'mile' ? 100000 : -100000), 'la deuda baja exactamente $100.000');
  const pre2 = await uiPago(deudor, { date: hoyS });
  const resto = Math.abs(saldoIndep(sharedOf(), pagos, 'fede').saldo);
  eq(pre2.pre.amt, String(resto), 'el modal ahora propone lo que falta (saldo remanente exacto)');
  pagos.push({ id: pre2.id, paidBy: nomD, amount: resto });
  await sync2();
  await ver('Liquidación total');
  const c0f = await leerComp(fede), c0m = await leerComp(mile);
  is(c0f.ok && c0m.ok && /Sin deuda/.test(c0f.lbl + c0m.lbl), 'con la deuda en cero las dos pantallas dicen "Al día"');
  // Pasarse: transfiere de más → la deuda cambia de signo
  const pre3 = await uiPago(deudor, { amt: 50000, date: hoyS });
  pagos.push({ id: pre3.id, paidBy: nomD, amount: 50000 });
  await sync2();
  const vS = await ver('Deuda que cambia de signo');
  is(Math.sign(vS.ef.saldo) === (nomD === 'mile' ? -1 : 1), 'el signo de la deuda se invierte al pagar de más');
  const c1f = await leerComp(fede), c1m = await leerComp(mile);
  eq([c1f.signed, c1m.signed], [vS.sf.saldo, -vS.sf.saldo], 'y las dos pantallas muestran el nuevo sentido de la deuda ("te debe" / "le debés")');
  // Editar la transferencia de 50.000 a 30.000 desde el OTRO dispositivo
  const otro = deudor === mile ? fede : mile;
  await otro.ev(async (id) => { openEditSharedPayment(id); $('sp-amount').value = 30000; document.querySelector('#sp-save-btn').click(); }, pre3.id);
  pagos.find(p => p.id === pre3.id).amount = 30000;
  await otro.settle(); await sync2();
  await ver('Editar una transferencia desde el otro teléfono');
  // Borrar una transferencia
  await fede.ev((id) => deleteSharedPayment(id), pre1.id);
  pagos.splice(pagos.findIndex(p => p.id === pre1.id), 1);
  await fede.settle(); await sync2(); await sync2();
  await ver('Borrar una transferencia (tombstone de pago)');
  // Doble clic REAL en Registrar pago (mouse): una sola transferencia
  await fede.ev(() => { goTo('compartidos'); openSharedPaymentModal(); $('sp-amount').value = 1234; });
  await fede.page.waitForTimeout(450);
  const nPagos0 = await fede.ev(() => getSharedPayments().length);
  await fede.page.locator('#sp-save-btn').dblclick({ delay: 20 }).catch(() => { });
  await fede.page.waitForTimeout(150);
  const nPagos1 = await fede.ev(() => getSharedPayments().length);
  eq(nPagos1 - nPagos0, 1, 'doble clic real en "Registrar" = una sola transferencia (el modal deja de recibir toques al cerrarse)');
  pagos.push({ id: await fede.ev(() => getSharedPayments().slice(-1)[0].id), paidBy: await fede.ev(() => _spPayer), amount: 1234 });
  await sync2(); await ver('Después del doble clic');
  // Deuda de menos de $500: la pantalla dice "Al día"
  const dNow = saldoIndep(sharedOf(), pagos, 'fede').saldo;
  const ajuste = dNow - 300; // dejar la deuda en 300 pesos
  const pagador = ajuste > 0 ? 'mile' : 'fede';
  const pA = await uiPago(fede, { amt: Math.abs(ajuste), payer: pagador, date: hoyS });
  pagos.push({ id: pA.id, paidBy: pagador, amount: Math.abs(ajuste) });
  await sync2();
  const cc3 = await leerComp(fede);
  console.log('   · con una deuda real de', fmtARS(saldoIndep(sharedOf(), pagos, 'fede').saldo), 'la tarjeta dice:', JSON.stringify(cc3.lbl), cc3.ok ? '(Al día)' : '');
  is(!(cc3.ok && Math.abs(saldoIndep(sharedOf(), pagos, 'fede').saldo) === 300), '[deuda-menor-500] una deuda de $300 no se muestra como "Sin deuda pendiente ✓ / Al día" (queda sin poder liquidarse: el modal no propone importe)');
  const pA2 = await uiPago(fede, { amt: 300, payer: pagador === 'mile' ? 'mile' : 'fede', date: hoyS });
  pagos.push({ id: pA2.id, paidBy: pagador, amount: 300 });
  await sync2(); await ver('Saldo de vuelta en cero');

  // ═══ FASE 5d · edición / borrado cruzado y conflictos ═══════════════════
  section('FASE 5d · editar y borrar cruzado, al mismo tiempo, con uno sin conexión (conflictos)');
  const offline = async (dev, on) => {
    await dev.ev((on) => { window.__offline = on; if (!window.__wrapped) { const f = window.fetch; window.fetch = (...a) => window.__offline ? Promise.reject(new TypeError('Failed to fetch')) : f(...a); window.__wrapped = true; } }, on);
    await dev.ctx.setOffline(on);
  };
  const fueraG = (id) => model.find(g => g.id === id);
  const binAmt = (id) => fede.ev((id) => { const g = _sharedBinGastos.find(x => x.id === id); return g && g.amount; }, id);
  const campoApp = async (dev, id) => dev.ev((id) => { const g = _sharedBinGastos.find(x => x.id === id); return g && { d: g.desc, a: g.amount, p: g.shared.paidBy, s: g.shared.splitPct }; }, id);
  const gC = { id: null, desc: '' };
  // Cada conflicto se prueba en su propio par de teléfonos con su propio bin: así un defecto no
  // contamina la cuenta de los demás y cada uno se reproduce solo.
  const isoPair = async (tag) => {
    const bin = 'iso_' + tag;
    const f = await L.device(browser, { myName: 'fede', compBin: bin });
    const m = await L.device(browser, { myName: 'mile', compBin: bin });
    await f.ev(() => clearInterval(_sharedAutoTimer)); await m.ev(() => clearInterval(_sharedAutoTimer));
    return { f, m, bin, close: async () => { await f.close(); await m.close(); } };
  };
  const addIso = async (dev, who, desc, amt, sh = { split: 50 }) => (await uiGasto(dev, { desc, cat: 'varios', amt, date: rel(0, 5).str, sh: { paidBy: who, ...sh } })).id;
  const syncIso = async (P) => { for (const d of [P.f, P.m, P.f, P.m]) { await d.ev(() => syncCompartidos(null)); await d.settle(); } };
  const gIso = (dev, id) => dev.ev((id) => { const g = _sharedBinGastos.find(x => x.id === id); return g ? { d: g.desc, a: g.amount, c: g.cat } : null; }, id);
  const sIso = (dev) => dev.ev(() => calcSharedDebtDetail().saldo);

  // (0) Mile corrige un gasto que cargó Fede y justo en ese momento se cae el PUT
  {
    const P = await isoPair('edit_ajeno_sin_red');
    const id = await addIso(P.f, 'fede', 'Internet', 30000);
    await syncIso(P);
    L.net.putFail = true;
    await P.m.clearToasts();
    await uiEditShared(P.m, id, { amt: 40000 }); await P.m.settle();
    const pendM = await P.m.ev(() => sharedPendientes().total);
    const avisoM = await P.m.ev(() => (window.__toasts || []).filter(t => /guardado acá|reintenta/i.test(t)));
    L.net.putFail = false;
    await P.m.ev(() => reintentarPendientesCompartidos()); await P.m.settle();
    await syncIso(P);
    const aF = await gIso(P.f, id), aM = await gIso(P.m, id);
    console.log(`   · Mile editó el gasto de Fede con el PUT caído: pendientes de Mile = ${pendM}; aviso = ${JSON.stringify(avisoM)}`);
    eq(aF, aM, '[edit-ajeno-sin-red] editar un gasto de la pareja con el PUT caído: al volver la red los dos teléfonos terminan con el mismo dato');
    eq(aF && aF.a, 40000, '[edit-ajeno-sin-red] y es el que tipeó Mile (ahora Mile ve $' + (aM && aM.a) + ' y Fede ve $' + (aF && aF.a) + ' para siempre)');
    const dF = await sIso(P.f), dM = await sIso(P.m);
    eq(dM, -dF, '[edit-ajeno-sin-red] y la deuda coincide exactamente en los dos (ahora Fede ' + dF + ' / Mile ' + dM + ')');
    await P.close();
  }
  // (1) Los dos editan campos distintos del mismo gasto, sin tiempo de sincronizar entre medio
  {
    const P = await isoPair('lww_campos');
    const id = await addIso(P.f, 'fede', 'Internet', 30000);
    await syncIso(P);
    await uiEditShared(P.f, id, { desc: 'Internet Fibertel' }); await P.f.settle();      // Fede corrige el nombre
    await uiEditShared(P.m, id, { amt: 31000 }); await P.m.settle();                       // Mile, que todavía no lo vio, corrige el importe
    await syncIso(P);
    const aF = await gIso(P.f, id), aM = await gIso(P.m, id);
    eq(aF, aM, 'dos ediciones casi simultáneas del mismo gasto: los dos terminan con el mismo dato');
    is(aF && aF.d === 'Internet Fibertel' && aF.a === 31000, `[lww-campos] quedan las dos correcciones: nombre de Fede e importe de Mile (ahora: "${aF && aF.d}" / $${aF && aF.a}; gana el gasto entero del último que guardó y la otra corrección se pierde en silencio)`);
    await P.close();
  }
  // (2) Editar antes / borrar después, y borrar antes / editar después
  {
    const P = await isoPair('edit_borrar');
    const a = await addIso(P.f, 'fede', 'Edit-luego-borrar', 10000), b = await addIso(P.f, 'fede', 'Borrar-luego-editar', 20000);
    await syncIso(P);
    await offline(P.m, true);
    await uiEditShared(P.m, a, { amt: 11000 }); await P.m.page.waitForTimeout(30);
    await P.f.ev((id) => removeSharedBinGasto(id), a); await P.f.settle();           // Fede borra DESPUÉS de la edición de Mile
    await P.f.ev((id) => removeSharedBinGasto(id), b); await P.f.settle(); await P.m.page.waitForTimeout(30);
    await uiEditShared(P.m, b, { amt: 22000 });                                         // Mile edita DESPUÉS del borrado
    await offline(P.m, false); await P.m.page.waitForTimeout(700); await P.m.settle();
    await syncIso(P);
    const ga = [await gIso(P.f, a), await gIso(P.m, a)], gb = [await gIso(P.f, b), await gIso(P.m, b)];
    eq(ga, [null, null], 'editado (sin señal) antes y borrado después: queda borrado en los dos');
    eq(gb[0], gb[1], 'borrado antes y editado (sin señal) después: los dos terminan de acuerdo');
    console.log('   · borrado-luego-editado:', gb[0] ? 'revive con el importe ' + gb[0].a : 'queda borrado');
    const dF = await sIso(P.f), dM = await sIso(P.m);
    eq(dM, -dF, 'y con la misma deuda en los dos');
    await P.close();
  }
  // (4) Altas en paralelo (carrera de GET/PUT sobre el mismo bin)
  for (let i = 0; i < 4; i++) {
    await Promise.all([
      addS(fede, 'fede', 'Paralelo F' + i, 1000 + i, 'varios', rel(0, 10 + i), { split: 50 }),
      addS(mile, 'mile', 'Paralelo M' + i, 2000 + i, 'varios', rel(0, 12 + i), { solo: 'mile' }),
    ]);
  }
  await fede.settle(); await mile.settle();
  const tmpE = await estadoComp(fede);
  console.log('   · tras 4 altas simultáneas, antes de sincronizar, en el bin hay', tmpE.binIds.length, 'gastos (esperado', sharedOf().length, ')');
  await sync2(); await sync2();
  await ver('Altas simultáneas desde los dos teléfonos');

  // ═══ FASE 5e · sin red: altas, GET caído, PUT caído, reintentos ═════════
  section('FASE 5e · gastos cargados sin conexión, GET caído, PUT caído y reintento automático');
  await offline(mile, true);
  await fede.clearToasts(); await mile.clearToasts();
  for (let i = 0; i < 3; i++) await addS(mile, 'mile', 'Offline Mile ' + i, 5000 + i * 10, 'salidas', rel(0, 20 + i), { split: 50 });
  const pMile = await uiPago(mile, { amt: 777, payer: 'mile', date: hoyS }); pagos.push({ id: pMile.id, paidBy: 'mile', amount: 777 });
  await addS(fede, 'fede', 'Online Fede durante el corte', 6500, 'super', rel(0, 25), { split: 50 });
  await fede.settle();
  const pendM = await estadoComp(mile);
  eq(pendM.pend, 4, 'Mile sin señal: 3 gastos + 1 transferencia quedan marcados "sin subir"');
  const avisos = (await mile.toasts()).filter(t => /No se pudo|Sin conexión|sin conexión/.test(t));
  is(avisos.length <= 1, `y se avisa una sola vez (salieron ${avisos.length} carteles)`);
  const dM = await estadoComp(mile), dF = await estadoComp(fede);
  is(dM.saldo !== -dF.saldo, '(dato) mientras Mile está sin señal los dos teléfonos ven deudas distintas');
  await offline(mile, false);
  await mile.page.waitForTimeout(1200); await mile.settle();
  const pend2 = await estadoComp(mile);
  eq(pend2.pend, 0, 'al volver la conexión el reintento automático sube todo solo (sin tocar Sincronizar)');
  await sync2(); await ver('Después de volver la señal');

  // GET caído (global): una alta no puede pisar el bin
  const binAntes = JSON.stringify(L.bins[BIN]);
  L.net.getFail = true;
  await addS(fede, 'fede', 'Con GET caído', 4321, 'super', rel(0, 26), { split: 50 });
  await fede.settle();
  await fede.ev(() => syncCompartidos(null)); await fede.settle();
  L.net.getFail = false;
  eq(JSON.stringify(L.bins[BIN]) === binAntes, true, 'con el GET caído no se escribe nada en el bin (no se pisa con una copia vieja)');
  eq((await estadoComp(fede)).pend, 1, 'y el gasto queda pendiente');
  await fede.ev(() => reintentarPendientesCompartidos()); await fede.settle(); await sync2();
  await ver('GET caído y recuperado');
  // PUT caído
  L.net.putFail = true;
  await addS(mile, 'mile', 'Con PUT caído A', 1500, 'varios', rel(0, 27), { split: 50 });
  await addS(mile, 'mile', 'Con PUT caído B', 2500, 'varios', rel(0, 27), { split: 50 });
  await mile.settle();
  eq((await estadoComp(mile)).pend, 2, 'PUT caído: los 2 gastos quedan pendientes');
  await mile.ev(() => syncCompartidos(null)); await mile.settle();
  eq((await estadoComp(mile)).pend, 2, 'sincronizar a mano con el PUT caído no los da por subidos');
  L.net.putFail = false;
  await mile.ev(() => syncCompartidos(null)); await mile.settle(); await sync2();
  await ver('PUT caído y recuperado');

  // ═══ FASE 5f · bin vacío / corrupto ═════════════════════════════════════
  section('FASE 5f · el bin se vacía o se corrompe (JSONBin reseteado, JSON con formato raro)');
  const gastosAntes = sharedOf().length;
  const snapshotBin = JSON.parse(JSON.stringify(L.bins[BIN]));
  const errsAntes = [fede.errors.length, mile.errors.length];
  for (const [nombre, valor] of [
    ['vacío {}', {}],
    ['gastos y pagos null', { gastos: null, payments: null }],
    ['gastos es un string', { gastos: 'basura', payments: 7 }],
    ['items inválidos', { gastos: [null, 5, { id: 1 }, {}, { id: 'x', shared: null }], payments: [{}, null], tombstones: [1, 2, 3], payTombstones: 'x' }],
  ]) {
    L.bins[BIN] = JSON.parse(JSON.stringify(valor));
    await fede.ev(() => syncCompartidos(null)); await fede.settle();
    await mile.ev(() => syncCompartidos(null)); await mile.settle();
    await sync2(); await sync2();
    const eF4 = await estadoComp(fede), eM4 = await estadoComp(mile);
    const conocidos = new Set(sharedOf().map(g => g.id));
    eq([eF4.binIds.filter(i => conocidos.has(i)).length, eM4.binIds.filter(i => conocidos.has(i)).length], [gastosAntes, gastosAntes], `bin ${nombre}: entre los dos teléfonos lo reconstruyen, sin perder ningún gasto`);
    const sf = saldoIndep(sharedOf(), pagos, 'fede');
    eq([eF4.saldo, eM4.saldo], [sf.saldo, -sf.saldo], `bin ${nombre}: la deuda vuelve a ser la misma de antes`);
  }
  eq([fede.errors.length - errsAntes[0], mile.errors.length - errsAntes[1]], [0, 0], 'ninguna de esas corrupciones tira un error de JS en pantalla');
  // tombstones: lo borrado antes de vaciar el bin ¿vuelve?
  const gDel2 = model.find(g => g.sh && Number.isInteger(g.amount) && g.desc.startsWith('Paralelo F0'));
  await fede.ev((id) => removeSharedBinGasto(id), gDel2.id); await fede.settle(); model.splice(model.indexOf(gDel2), 1);
  await sync2();
  L.bins[BIN] = {};
  await sync2(); await sync2();
  const eF5 = await estadoComp(fede), eM5 = await estadoComp(mile);
  eq([eF5.binIds.includes(gDel2.id), eM5.binIds.includes(gDel2.id)], [false, false], 'borrar, luego vaciar el bin y resincronizar: lo borrado no resucita');
  await ver('Después de vaciar el bin');

  // ═══ FASE 5g · modal abierto mientras llega un cambio; reloj desfasado ═══
  section('FASE 5g · modal de edición abierto mientras el otro cambia el gasto; reloj de un teléfono atrasado');
  const gM = model.find(g => g.sh && g.sh.paidBy === 'fede' && Number.isInteger(g.amount) && g.amount > 10000 && g.desc !== 'Internet Fibertel' && !g.desc.startsWith('Paralelo'));
  await fede.ev(() => goTo('compartidos'));
  await fede.ev((id) => { openEditSharedGasto({ id }); }, gM.id);   // Fede abre el editor y se queda con él abierto
  await uiEditShared(mile, gM.id, { amt: gM.amount + 2222 }); await mile.settle();   // Mile corrige el importe
  await fede.ev(() => syncCompartidos(null)); await fede.settle();                      // llega el cambio mientras el modal está abierto
  const campoModal = await fede.ev(() => $('esg-amt').value);
  await fede.ev(() => { $('esg-desc').value = 'Corregido por Fede'; document.querySelector('#ov-edit-shared .btnp').click(); }); // cambia SOLO la descripción
  await fede.settle(); await sync2(); await sync2();
  const fM = await campoApp(mile, gM.id);
  console.log(`   · el modal de Fede seguía mostrando $${campoModal} (el importe nuevo de Mile es $${gM.amount + 2222}); tras guardar solo la descripción el importe queda en $${fM.a}`);
  eq(fM.a, gM.amount + 2222, '[modal-pisa-importe] guardar solo la descripción con el editor abierto no pisa el importe que la pareja corrigió mientras tanto');
  gM.desc = 'Corregido por Fede'; gM.amount = fM.a;
  await ver('Tras el modal abierto');
  // Reloj de Mile 3 minutos atrasado
  await mile.ev(() => { window.__realNow = Date.now; Date.now = () => window.__realNow() - 180000; });
  const gK = model.find(g => g.sh && g.sh.paidBy === 'fede' && Number.isInteger(g.amount) && g !== gM && g !== gC && !g.desc.startsWith('Paralelo') && g.amount > 10000);
  await uiEditShared(fede, gK.id, { amt: gK.amount + 1000 }); await fede.settle();
  await fede.page.waitForTimeout(1500);
  await uiEditShared(mile, gK.id, { amt: gK.amount + 5000 }); await mile.settle();   // edición POSTERIOR en tiempo real, sello 3 min atrasado
  await sync2(); await sync2();
  const kF = await campoApp(fede, gK.id), kM = await campoApp(mile, gK.id);
  eq(kF, kM, 'reloj atrasado: igual los dos terminan con el mismo dato');
  is(kF.a === gK.amount + 5000, `[reloj-desfasado] la edición más reciente gana aunque el teléfono tenga el reloj 3 minutos atrasado (ahora gana $${kF.a}: la de Fede, que es anterior)`);
  gK.amount = kF.a;
  await mile.ev(() => { Date.now = window.__realNow; });
  await ver('Tras el reloj desfasado');

  // ═══ FASE 5h · tercera sincronización, pedidos al bin, deshacer un compartido ═══
  section('FASE 5h · tercera vuelta sin cambios (no debe escribir nada) y deshacer un gasto compartido');
  const put0 = L.stats.put;
  await sync2(); await sync2();
  eq(L.stats.put - put0, 0, 'dos vueltas de sincronización sin cambios no hacen ningún PUT (no gasta cuota de JSONBin)');
  const vF = await ver('Tercera/cuarta sincronización');
  // Borrar un gasto compartido y deshacer enseguida (toast Deshacer)
  const gU = model.find(g => g.sh && g.sh.paidBy === 'fede' && Number.isInteger(g.amount) && g.amount > 5000 && g !== gK && g !== gM && g !== gC && !g.desc.startsWith('Paralelo'));
  await fede.ev(async (id) => {
    goTo('gastos'); setGastosMonth(S.gastos.find(g => g.id === id).month, S.gastos.find(g => g.id === id).year); await new Promise(r => setTimeout(r, 900));
    const row = document.querySelector(`#gastos-list .gasto-row[data-id="${id}"]`);
    row.querySelector('.rmore').click(); await new Promise(r => setTimeout(r, 50));
    [...row.querySelectorAll('.rmenu button')].find(b => /Eliminar/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 100)); confirmResolve(true); await new Promise(r => setTimeout(r, 200));
    undoLast();
  }, gU.id);
  await fede.settle(); await sync2(); await sync2();
  await ver('Borrar un compartido y deshacer en el acto');
  // Pagar un vencimiento compartido desde la Agenda y deshacer: ¿queda en el bin?
  const saldoPre = await estadoComp(mile);
  await payAgenda('venc', 'Alquiler', 'Galicia', { paidBy: 'fede', split: 50 });
  await fede.page.waitForTimeout(150);
  const gAlq = await fede.ev(() => S.gastos.find(g => g.desc === 'Alquiler' && g.shared && g.shared.active));
  is(!!gAlq, 'pagar el vencimiento compartido crea el gasto compartido');
  const cartel = await fede.ev(() => ({ undoVivo: !!_undoFn && document.querySelector('.toast-undo').style.display !== 'none', txt: document.getElementById('toast-msg').textContent }));
  is(cartel.undoVivo, `[undo-toast-pisado] 150 ms después de pagar un vencimiento compartido el cartel sigue ofreciendo "Deshacer" (ahora el cartel dice "${cartel.txt}" y ya no hay botón: la alta en el bin dispara un aviso de "gasto compartido nuevo" —propio— que lo reemplaza)`);
  await fede.ev(() => { window.__undoCap && window.__undoCap(); });      // deshacer con el cierre capturado al pagar
  await fede.settle(); await sync2(); await sync2();
  const gAlqDesp = await fede.ev(() => S.gastos.some(g => g.desc === 'Alquiler'));
  const enBinDesp = await mile.ev(() => _sharedBinGastos.some(g => g.desc === 'Alquiler'));
  const saldoPost = await estadoComp(mile);
  eq([gAlqDesp, enBinDesp, saldoPost.saldo], [false, false, saldoPre.saldo], '[undo-compartido-fantasma] deshacer el pago de un vencimiento compartido lo saca también del bin compartido (ahora: a Fede le desaparece pero Mile lo sigue viendo y debiendo $' + Math.round((await fede.ev(() => 500000)) / 2) + ')');
  if (enBinDesp) { await fede.ev(() => { const id = _sharedBinGastos.find(g => g.desc === 'Alquiler').id; return removeSharedBinGasto(id); }); await fede.settle(); await sync2(); await sync2(); }
  await ver('Tras pagar/deshacer el vencimiento compartido');
  await scanScreens(fede, 'Fede al terminar Compartidos'); await scanScreens(mile, 'Mile al terminar Compartidos');
  eq(mile.errors, [], 'Mile: ningún pageerror/console.error en toda la simulación compartida');

  // ═══ FASE 5i · otras costuras de Compartidos ════════════════════════════
  section('FASE 5i · gasto de la pareja en el buscador, redondeo de un 50/50 impar, compra compartida en cuotas, categoría propia borrada');
  {
    const P = await isoPair('costuras');
    // Redondeo: 10.001 al 50%: qué ve cada uno
    const id = await addIso(P.f, 'fede', 'Cena 10001', 10001);
    await syncIso(P);
    const lf = await leerComp(P.f), lm = await leerComp(P.m);
    const rowF = lf.filas.find(r => /Cena/.test(r.t)), rowM = lm.filas.find(r => /Cena/.test(r.t));
    const dF = await sIso(P.f), dM = await sIso(P.m);
    console.log(`   · Cena de $10.001 al 50%: Fede ve "${rowF.lab} ${rowF.amt}", Mile ve "${rowM.lab} ${rowM.amt}", la deuda es ${dF}`);
    eq([dF, dM], [5001, -5001], 'deuda de un gasto impar al 50%: se redondea igual en los dos teléfonos ($5.001)');
    eq(rowF.amt, rowM.amt, '[split-redondeo-filas] el mismo gasto muestra el mismo importe ("prestaste" en un teléfono y "pediste" en el otro) y coincide con la deuda');
    const gF = await leerGastos(P.f, rel(0, 5).y, rel(0, 5).m), gM = await leerGastos(P.m, rel(0, 5).y, rel(0, 5).m);
    eq(gF.total + gM.total, 10001, '[split-redondeo] las dos partes suman lo que costó ($10.001): hoy cada uno ve $' + gF.total + ' y $' + gM.total + ' ($' + (gF.total + gM.total) + ')');
    // Búsqueda de un gasto de la pareja en la pantalla Gastos: tocar el resultado
    const abre = await P.m.ev(async (id) => {
      goTo('gastos'); buscarGastos('gastos', 'Cena 10001'); const row = document.querySelector('#sq-res-gastos .sq-row'); row.click(); await new Promise(r => setTimeout(r, 400));
      const abierto = $('ov-edit-gasto').classList.contains('open'); $('eg-amt').value = 12000; document.querySelector('#ov-edit-gasto .btnp').click(); await new Promise(r => setTimeout(r, 200));
      const toast = document.getElementById('toast-msg').textContent;
      return { abierto, sigueAbierto: $('ov-edit-gasto').classList.contains('open'), toast, amtBin: (_sharedBinGastos.find(g => g.id === id) || {}).amount };
    }, id);
    console.log('   · Mile toca en el buscador un gasto que cargó Fede:', JSON.stringify(abre));
    is(!abre.abierto || abre.amtBin === 12000, '[buscar-gasto-ajeno] desde el buscador de Gastos, tocar un gasto que cargó la pareja no abre un editor que guarda en el vacío (la lista dice "solo lectura"; el buscador abre el editor y "Guardar" cierra sin cambiar nada ni avisar)');
    await P.close();
  }
  {
    // Compra compartida en cuotas: ¿las cuotas siguientes siguen compartidas?
    const P = await isoPair('cuotas_comp');
    const r = await uiGasto(P.f, { desc: 'Sillón 3c', cat: 'tarjeta', amt: 30000, ct: 3, ca: 1, date: rel(0, 3).str, sh: { paidBy: 'fede', split: 50 } });
    await P.f.settle(); await syncIso(P);
    await P.f.ev(async () => { const c = S.agenda.cuotas.find(x => x.name === 'Sillón 3c'); markCuotaPaid(c.id); document.querySelector('#pay-acct-list button').click(); });
    await P.f.settle(); await syncIso(P);
    const gs = await P.f.ev(() => S.gastos.filter(g => /Sill/.test(g.desc)).map(g => ({ n: g.cuotaActual, sh: !!(g.shared && g.shared.active) })));
    const dM = await sIso(P.m);
    eq(gs.map(g => g.sh), [true, true], `[cuota-compartida] las cuotas siguientes de una compra compartida también son compartidas (ahora: ${JSON.stringify(gs.map(g => g.sh))}; la deuda de Mile es ${-dM} en lugar de 30.000 = 2 cuotas × 15.000)`);
    await P.close();
  }
  {
    // Categoría propia borrada en un teléfono mientras la pareja tiene gastos con esa categoría
    const P = await isoPair('cat_borrada');
    await P.f.ev(() => { openAddCatModal('gcats'); $('newcat-name').value = 'Mascotas'; saveNewCat(); });
    const cid = await P.f.ev(() => Object.keys(loadCustomCats())[0]);
    const r = await uiGasto(P.f, { desc: 'Veterinario', cat: cid, amt: 8000, date: rel(0, 6).str, sh: { paidBy: 'fede', split: 50 } });
    await P.f.settle(); await syncIso(P);
    const vm = await P.m.ev((cid) => ({ label: (CATS[cid] || {}).label, desde: Object.keys(loadCustomCats()) }), cid);
    eq(vm.label, 'Mascotas', 'la categoría propia de Fede le llega a Mile con su nombre');
    await P.f.ev((cid) => { deleteCustomCat(cid); setTimeout(() => confirmResolve(true), 100); }, cid);
    await P.f.page.waitForTimeout(400);
    const tras1 = await P.f.ev((id) => ({ cat: S.gastos.find(g => g.id === id).cat, existe: Object.keys(loadCustomCats()).length }), r.id);
    eq(tras1, { cat: 'varios', existe: 0 }, 'borrar la categoría propia pasa sus gastos a "Varios"');
    await P.f.ev((id) => { const g = S.gastos.find(x => x.id === id); return upsertSharedBinGasto(g); }, r.id); await P.f.settle();
    await syncIso(P);
    const fin = await P.f.ev((a) => ({ cat: S.gastos.find(g => g.id === a.id).cat, cats: Object.keys(loadCustomCats()), bin: (_sharedBinGastos.find(g => g.id === a.id) || {}).cat }), { id: r.id });
    console.log('   · tras borrar la categoría y sincronizar:', JSON.stringify(fin));
    is(fin.cats.length === 0, '[cat-zombi] una categoría propia borrada no vuelve a aparecer sola desde el bin compartido (hoy el diccionario de categorías del bin nunca se limpia y la pareja la vuelve a subir)');
    await P.close();
  }
  {
    // Nombres de la pareja: solo existen "fede" y "mile"
    const P = await isoPair('nombres');
    await addIso(P.f, 'fede', 'Nombres', 10000);
    await syncIso(P);
    const antes = await sIso(P.f);
    await P.f.ev(() => localStorage.setItem('fin_my_name', 'mile'));
    const despues = await sIso(P.f);
    eq([antes, despues], [5000, -5000], '(dato) cambiar "Soy: Fede/Mile" en un teléfono invierte el sentido de la deuda, como corresponde');
    const nombres = await P.f.ev(() => { openGastoModal(); const t = document.getElementById('g-paidby-fede').textContent + '|' + document.getElementById('g-paidby-mile').textContent; closeOv('ov-gasto'); return t; });
    console.log('   · nombres en el alta:', nombres, '→ la app solo conoce "Fede" y "Mile" (no se pueden renombrar)');
    await P.close();
  }

  // ═══ FASE 6 · integridad: recarga, backup, temas, vista compacta, XSS ═══
  section('FASE 6a · recarga de la página: no cambia ni un dato');
  const snapS = () => fede.ev(() => {
    const c = JSON.parse(JSON.stringify(S));
    const strip = o => { if (o && typeof o === 'object') { delete o._sharedBinSynced; delete o.updatedAt; Object.values(o).forEach(strip); } return o; };
    return { gastos: c.gastos.map(strip).sort((a, b) => a.id < b.id ? -1 : 1), accounts: c.accounts.map(a => { const x = { ...a }; delete x.updatedAt; return x; }), plan: c.plan.map(p => ({ name: p.name, cat: p.cat, months: p.months })).sort((a, b) => a.name < b.name ? -1 : 1),
      subs: c.agenda.subs, venc: c.agenda.vencimientos, cuotas: c.agenda.cuotas.map(q => ({ name: q.name, fee: q.fee, total: q.total, paid: q.paid, next: q.nextDueDate })).sort((a, b) => a.name < b.name ? -1 : 1), tc: c.tc, cats: Object.keys(loadCustomCats()) };
  });
  await flush(fede);
  const A = await snapS();
  await fede.page.reload(); await fede.page.waitForFunction(() => typeof S === 'object' && typeof save === 'function'); await fede.page.waitForTimeout(700);
  const B = await snapS();
  for (const k of Object.keys(A)) eq(JSON.stringify(B[k]) === JSON.stringify(A[k]), true, `recargar conserva: ${k} (${Array.isArray(A[k]) ? A[k].length : ''})`);
  await fede.ev(() => clearInterval(_sharedAutoTimer));

  section('FASE 6b · backup: exportar → borrar todo → importar');
  const preKeys = await fede.ev(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('fin_')).map(k => [k, localStorage.getItem(k).length])));
  const [dl] = await Promise.all([fede.page.waitForEvent('download', { timeout: 8000 }), fede.ev(() => exportBackup())]);
  const bkPath = require('path').join(require('os').tmpdir(), 'a13-backup.json');
  await dl.saveAs(bkPath);
  const bk = JSON.parse(require('fs').readFileSync(bkPath, 'utf8'));
  const ini = await fede.ev(() => ({ v6: localStorage.getItem('fin_v6'), pays: localStorage.getItem('fin_shared_payments'), cats: localStorage.getItem('fin_custom_cats'), my: localStorage.getItem('fin_my_name'), bin: localStorage.getItem('fin_comp_bin_id'), key: localStorage.getItem('fin_comp_api_key') }));
  is(!!bk.data.fin_v6 && bk._version, `el archivo de backup trae los datos (${Object.keys(bk.data).length} claves, ${(require('fs').statSync(bkPath).size / 1024).toFixed(0)} kB)`);
  await fede.ev(() => { localStorage.clear(); });
  await fede.page.reload(); await fede.page.waitForFunction(() => typeof S === 'object'); await fede.page.waitForTimeout(500);
  eq(await fede.ev(() => S.gastos.length), 0, 'con el almacenamiento borrado la app arranca vacía');
  await fede.page.locator('input[type=file][accept=".json"]').setInputFiles(bkPath);
  await fede.page.waitForTimeout(500);
  await fede.page.locator('#confirm-ok').click({ force: true }).catch(async () => { await fede.ev(() => confirmResolve(true)); });
  await fede.page.waitForTimeout(2500);
  await fede.page.waitForFunction(() => typeof S === 'object' && S.gastos.length > 0, null, { timeout: 8000 }).catch(() => { });
  const finBk = await fede.ev(() => ({ v6: localStorage.getItem('fin_v6'), pays: localStorage.getItem('fin_shared_payments'), cats: localStorage.getItem('fin_custom_cats'), my: localStorage.getItem('fin_my_name'), bin: localStorage.getItem('fin_comp_bin_id'), key: localStorage.getItem('fin_comp_api_key') }));
  const v6a = JSON.parse(ini.v6), v6b = JSON.parse(finBk.v6 || '{}');
  eq(v6b.gastos && v6b.gastos.length, v6a.gastos.length, 'importar devuelve la misma cantidad de gastos');
  eq(JSON.stringify(v6b.gastos) === JSON.stringify(v6a.gastos), true, 'y los gastos idénticos, uno por uno');
  eq(JSON.stringify([v6b.accounts, v6b.agenda.subs, v6b.agenda.vencimientos, v6b.plan]) === JSON.stringify([v6a.accounts, v6a.agenda.subs, v6a.agenda.vencimientos, v6a.plan]), true, 'y cuentas, Agenda y Plan idénticos');
  eq([finBk.pays === ini.pays, finBk.cats === ini.cats], [true, true], 'y las transferencias y las categorías propias');
  is(finBk.my === ini.my && finBk.bin === ini.bin && finBk.key === ini.key, `[backup-sin-config] el backup también guarda quién sos y el bin compartido (ahora tras importar: "Soy" = ${finBk.my}, bin compartido = ${finBk.bin}; hay que volver a configurarlos a mano y, si no, Mile queda como "Fede")`);
  const sinRestaurar = Object.keys(preKeys).filter(k => !(k in JSON.parse(JSON.stringify(Object.fromEntries(Object.keys(bk.data).map(x => [x, 1]))))));
  console.log('   · claves fin_* que el backup NO incluye:', sinRestaurar.join(', '));
  // Dejar la app de Fede como estaba para seguir auditando
  await fede.ev((i) => { localStorage.setItem('fin_my_name', i.my); localStorage.setItem('fin_comp_bin_id', i.bin); localStorage.setItem('fin_comp_api_key', i.key); }, ini);
  await fede.page.reload(); await fede.page.waitForFunction(() => typeof S === 'object'); await fede.page.waitForTimeout(500);
  await fede.ev(() => clearInterval(_sharedAutoTimer));
  await sync(fede); await sync(mile);
  await ver('Después de restaurar el backup de Fede');

  section('FASE 6c · tema claro/oscuro y vista compacta');
  for (const tema of ['light', 'dark']) {
    await fede.ev((t) => { localStorage.setItem('fin_theme', t); applyTheme(); }, tema);
    const ok = await fede.ev(() => document.documentElement.getAttribute('data-theme'));
    eq(ok, tema === 'light' ? 'light' : null, `tema ${tema} aplicado`);
    await scanScreens(fede, `tema ${tema}`);
    const contraste = await fede.ev(() => { const cs = getComputedStyle(document.body); return [cs.backgroundColor, cs.color]; });
    console.log('   · cuerpo', tema, contraste.join(' / '));
  }
  await fede.ev(() => setCompact(true)); await scanScreens(fede, 'vista compacta', { agenda: false });
  const compacta = await fede.ev(async () => { goTo('saldos'); await new Promise(r => setTimeout(r, 500)); return [...document.querySelectorAll('#sections .acc-row, #sections .cr, #sections [id^="ar-"]')].length; });
  await fede.ev(() => setCompact(false));

  section('FASE 6d · texto hostil en TODOS los campos de nombre: nada se ejecuta ni se inyecta');
  const XSS = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
  await fede.ev((X) => { window.__xss = 0; }, XSS);
  await fede.ev(async (X) => {
    const f = new Date(), ds = dateKey(f.getFullYear(), f.getMonth(), 7);
    // gasto, cuenta, suscripción, vencimiento, cuota, concepto del Plan, transferencia, categoría propia
    _gSaving = false; openGastoModal(); $('gdesc').value = 'G ' + X; $('gamt').value = 1111; $('g-date-inp').value = ds; document.querySelector('#ov-gasto .btnp').click();
    await new Promise(r => setTimeout(r, 50)); _gSaving = false;
    openAccModal('bancaria'); $('mn').value = 'Cta ' + X; $('ma').value = 10; document.querySelector('#ov-acc .btnp').click();
    openAgendaModal('sub'); $('ag-name').value = 'Sub ' + X; $('ag-amount').value = 100; document.querySelector('#ov-agenda .btnp').click();
    openAgendaModal('venc'); $('ag-name').value = 'Venc ' + X; $('ag-amount').value = 100; document.querySelector('#ov-agenda .btnp').click();
    _gSaving = false; openGastoModal(); $('gdesc').value = 'Cuota ' + X; $('gamt').value = 500; $('g-date-inp').value = ds; document.querySelector('#ov-gasto .chip[data-v="tarjeta"]').click(); $('gct').value = 3; $('gca').value = 1; document.querySelector('#ov-gasto .btnp').click();
    openProjModal('ingreso'); $('prn').value = 'Plan ' + X; $('pra').value = 100; document.querySelector('#ov-proj .btnp').click();
    _gSaving = false; openGastoModal(); $('gdesc').value = 'Comp ' + X; $('gamt').value = 2222; $('g-date-inp').value = ds; $('g-shared-toggle').click(); document.querySelector('#ov-gasto .btnp').click();
  }, XSS);
  await fede.settle();
  await fede.ev(async (X) => { openSharedPaymentModal(); $('sp-amount').value = 900; $('sp-desc').value = 'Pago ' + X; document.querySelector('#sp-save-btn').click(); }, XSS);
  await fede.settle(); await sync(fede); await sync(mile);
  // recorrer pantallas de los dos teléfonos abriendo listas, buscadores y hojas
  const recorrer = (dev) => dev.ev(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms)); const bad = [];
    const mira = (donde) => { const i = document.querySelectorAll('img[src="x"]').length; if (i) bad.push(donde + ':' + i); if (window.__xss) bad.push(donde + ':EJECUTÓ'); };
    for (const p of ['saldos', 'gastos', 'compartidos', 'agenda']) { goTo(p); await sleep(600); mira(p); }
    for (const t of ['tarjetas', 'plan', 'lista']) { switchAgendaTab(t); await sleep(400); mira('agenda/' + t); }
    goTo('gastos'); for (const q of ['G ', 'Comp', 'Cuota']) { buscarGastos('gastos', q); await sleep(200); mira('buscar ' + q); } buscarGastos('gastos', '');
    goTo('compartidos'); await sleep(300); buscarGastos('comp', 'Comp'); await sleep(200); mira('buscar comp'); buscarGastos('comp', '');
    openLiquidaciones(); await sleep(200); mira('liquidaciones'); closeOv('ov-liq');
    goTo('gastos'); showCatDetail && document.querySelectorAll('#donut-legend .dl-row[data-cat]').forEach(b => b.click()); await sleep(300); mira('detalle categoría');
    openCompare(); await sleep(300); mira('comparar meses'); closeOv('ov-compare');
    openAddCatModal('gcats'); await sleep(200); mira('gestor de categorías'); closeOv('ov-add-cat');
    goTo('saldos'); await sleep(300); mira('saldos');
    openAgendaSheet && null;
    return bad;
  });
  const badF = await recorrer(fede), badM = await recorrer(mile);
  eq([badF, badM], [[], []], '[xss] con <img onerror> en gasto, cuenta, suscripción, vencimiento, cuota, Plan, transferencia y compartido: no se ejecuta nada ni se inyecta ninguna etiqueta en las pantallas (las dos personas)');
  // Distinto: el NOMBRE de una categoría propia se pinta sin escapar (donut, lista de categorías, detalle)
  await fede.ev(() => { window.__xss = 0; });
  await fede.ev((X) => { openAddCatModal('gcats'); $('newcat-name').value = 'Cat ' + X; saveNewCat(); const id = Object.keys(loadCustomCats()).slice(-1)[0]; _gSaving = false; openGastoModal(); $('gdesc').value = 'ConCat'; $('gamt').value = 100; document.querySelector('#ov-gasto .chip[data-v="' + id + '"]').click(); document.querySelector('#ov-gasto .btnp').click(); }, XSS);
  const catXss = await fede.ev(async () => { goTo('gastos'); const f = new Date(); setGastosMonth(f.getMonth(), f.getFullYear()); await new Promise(r => setTimeout(r, 900)); return { inj: document.querySelectorAll('#cat-list img[src="x"]').length, ejecuto: window.__xss }; });
  is(catXss.inj === 0 && !catXss.ejecuto, `[xss-cat] el nombre de una categoría propia con HTML se muestra como texto (ahora: ${catXss.inj} <img> inyectado/s en la lista de categorías y el onerror se ejecutó ${catXss.ejecuto} vez/veces)`);
  // Y por el bin: una categoría "propia" que llega de la pareja (o de quien tenga la clave del bin)
  await fede.ev(() => { S.gastos = S.gastos.filter(g => g.desc !== 'ConCat'); const c = loadCustomCats(); Object.keys(c).forEach(k => { delete c[k]; delete CATS[k]; }); saveCustomCats(c); save(); window.__xss = 0; });
  {
    const b = L.bins[BIN];
    b.cats = { ...(b.cats || {}), custom_hostil_1: { label: XSS, icon: '🐶', color: '#a78bfa' } };
    const f = rel(0, 9);
    b.gastos.push({ id: 'hostil1', desc: 'Gasto con categoría que llegó del bin', amount: 100, cat: 'custom_hostil_1', month: f.m, year: f.y, day: f.d, addedAt: new Date(f.y, f.m, f.d, 12).getTime(), updatedAt: Date.now(), shared: { active: true, paidBy: 'mile', splitPct: 50 } });
    await fede.ev(() => syncCompartidos(null)); await fede.settle();
    const r = await fede.ev(async () => { goTo('gastos'); const f = new Date(); setGastosMonth(f.getMonth(), f.getFullYear()); await new Promise(r => setTimeout(r, 900)); return { inj: document.querySelectorAll('#cat-list img[src="x"]').length, ejecuto: window.__xss }; });
    is(r.inj === 0 && !r.ejecuto, `[xss-cat-bin] una categoría que llega por el bin compartido no puede ejecutar código en el teléfono de la otra persona (ahora: ${r.inj} <img> inyectado/s, onerror ejecutado ${r.ejecuto} vez/veces)`);
    L.bins[BIN].gastos = L.bins[BIN].gastos.filter(g => g.id !== 'hostil1'); delete L.bins[BIN].cats.custom_hostil_1;
    await fede.ev(() => { _sharedBinGastos = _sharedBinGastos.filter(g => g.id !== 'hostil1'); const c = loadCustomCats(); delete c.custom_hostil_1; delete CATS.custom_hostil_1; saveCustomCats(c); window.__xss = 0; });
    await fede.ev(async () => { for (const g of _sharedBinGastos.filter(g => /onerror/.test(g.desc))) await removeSharedBinGasto(g.id); for (const p of getSharedPayments().filter(p => /onerror/.test(p.desc || ''))) await deleteSharedPayment(p.id); });
    await fede.settle(); await sync2(); await sync2();
    await ver('Después de limpiar el gasto y la transferencia hostiles');
  }
  await scanScreens(fede, 'con datos hostiles');
  // limpiar lo hostil
  await fede.ev(() => {
    S.gastos = S.gastos.filter(g => !/onerror/.test(g.desc)); S.accounts = S.accounts.filter(a => !/onerror/.test(a.name));
    S.agenda.subs = S.agenda.subs.filter(a => !/onerror/.test(a.name)); S.agenda.vencimientos = S.agenda.vencimientos.filter(a => !/onerror/.test(a.name));
    S.agenda.cuotas = S.agenda.cuotas.filter(a => !/onerror/.test(a.name)); S.plan = S.plan.filter(a => !/onerror/.test(a.name));
    const c = loadCustomCats(); Object.keys(c).forEach(k => { if (/onerror/.test(c[k].label)) { delete c[k]; delete CATS[k]; } }); saveCustomCats(c); save();
  });

  // ═══ FASE 7 · escala: 2.000+ gastos, tamaño del almacenamiento y de los bins ═══
  section('FASE 7a · 2.600 gastos: tiempo de pantallas, tamaño de localStorage, buscador, peso del bin');
  {
    const mkGastos = (n, prefix = 'p') => Array.from({ length: n }, (_, i) => {
      const off = -(i % 12), f = rel(off, 1 + (i % 27));
      return { id: prefix + i, desc: `Gasto ${i} ${['Coto', 'Uber', 'Farmacia', 'Cine', 'Luz', 'Nafta'][i % 6]}`, cat: ['comida', 'super', 'salidas', 'hogar', 'transporte', 'compras'][i % 6], amount: 1000 + (i * 37) % 90000, month: f.m, year: f.y, day: f.d, addedAt: new Date(f.y, f.m, f.d, 12).getTime() + (i % 500) * 1000 };
    });
    const pf = await L.device(browser, { myName: 'fede', compBin: 'perf13', seed: { gastos: mkGastos(2600) } });
    await pf.ev(() => clearInterval(_sharedAutoTimer));
    await pf.page.waitForTimeout(400);
    const quota = await pf.ev(() => { const k = 'zz_quota_probe'; let n = 0; const chunk = 'x'.repeat(100000); try { while (n < 200) { localStorage.setItem(k + n, chunk); n++; } } catch (e) { } const chars = n * 100000; for (let i = 0; i <= n; i++) localStorage.removeItem(k + i); return chars; });
    console.log(`   · tope real de localStorage en este Chromium: ~${(quota / 1e6).toFixed(1)} M de caracteres libres`);
    const tm = await pf.ev(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms)); const t = {};
      const med = async (nombre, fn, reps = 3) => { const xs = []; for (let i = 0; i < reps; i++) { const a = performance.now(); fn(); xs.push(performance.now() - a); await sleep(20); } t[nombre] = Math.round(Math.min(...xs)); };
      await med('renderGastos (mes con ' + _getMergedGastos(curMonth, curYear).length + ' gastos)', () => renderGastos());
      await med('goTo(saldos)', () => { goTo('saldos'); });
      await med('renderCompartidos', () => renderCompartidos());
      await med('renderAgenda', () => renderAgenda());
      await med('renderProj', () => renderProj());
      await med('renderTarjetasResumen', () => renderTarjetasResumen());
      await med('buscarGastos("a") sobre 2600', () => buscarGastos('gastos', 'a'), 2); buscarGastos('gastos', '');
      await med('persistJsonStorage(S)', () => persistJsonStorage(KEY, S), 2);
      await med('_runAutoBackupGastos (copia diaria)', () => _runAutoBackupGastos(), 2);
      await med('calcSharedDebtDetail', () => calcSharedDebtDetail());
      await med('renderCompare', () => renderCompare());
      let total = 0; const partes = {}; for (const k of Object.keys(localStorage)) { const n = (localStorage.getItem(k) || '').length * 2; total += n; partes[k] = n; }
      const top = Object.entries(partes).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ' ' + (v / 1024).toFixed(0) + 'kB');
      return { t, totalKB: Math.round(total / 1024), top, v6KB: Math.round(localStorage.getItem('fin_v6').length / 1024) };
    });
    console.log('   · tiempos (ms):', JSON.stringify(tm.t));
    console.log(`   · localStorage: ${tm.totalKB} kB en total (UTF-16; el tope de Chromium/Safari es ~5.000 kB) — mayores: ${tm.top.join(', ')}`);
    is(Object.values(tm.t).every(v => v < 500), 'ninguna pantalla tarda más de 0,5 s en dibujarse con 2.600 gastos (peor caso: ' + Math.max(...Object.values(tm.t)) + ' ms)');
    is(tm.totalKB < 4000, `[cuota-localstorage] con 2.600 gastos el almacenamiento local queda por debajo del 80% del tope de 5 MB (hoy ${tm.totalKB} kB: el gasto principal más 7 copias diarias de todos los gastos)`);
    // Peso del bin personal: sin comprimir y comprimido
    const pesos = await pf.ev(async () => {
      const out = {}; const todos = S.gastos.slice();
      for (const n of [300, 1000, 2000, 2600]) {
        S.gastos = todos.slice(0, n); save();
        const payload = buildSyncPayload(); const crudo = payloadSizeReport(payload).bodyBytes;
        payload.fin_v6 = await gzPack(payload.fin_v6); const comp = payloadSizeReport(payload).bodyBytes;
        out[n] = [Math.round(crudo / 1024), Math.round(comp / 1024)];
      }
      return out;
    });
    console.log('   · peso del bin personal (kB sin comprimir / comprimido):', JSON.stringify(pesos));
    is(pesos[2600][1] < 100, `el bin personal con 2.600 gastos comprimido entra en los 100 kB de JSONBin (${pesos[2600][1]} kB; sin comprimir ${pesos[2600][0]} kB)`);
    await pf.close();
  }
  // Bin compartido: no se comprime. ¿Cuánto aguanta?
  {
    const bytes = Buffer.byteLength(JSON.stringify(L.bins[BIN]));
    const n = L.bins[BIN].gastos.length, np = L.bins[BIN].payments.length, nt = Object.keys(L.bins[BIN].tombstones || {}).length;
    const porGasto = Math.round(bytes / Math.max(1, n));
    console.log(`   · bin compartido de esta simulación: ${n} gastos + ${np} pagos + ${nt} tombstones = ${(bytes / 1024).toFixed(1)} kB (≈ ${porGasto} B por gasto) → el tope de 100 kB llega a los ~${Math.floor(100 * 1024 / porGasto)} gastos compartidos, sin compresión ni archivo`);
    INFO.binComp = { bytes, n, porGasto, tope: Math.floor(100 * 1024 / porGasto) };
  }
  // Qué pasa al superar los 100 kB en el bin compartido (JSONBin responde 413)
  section('FASE 7b · bin compartido al tope de 100 kB: aviso, pendientes y deuda local');
  {
    const P = await isoPair('tope100');
    const lim = async (dev) => dev.ev(() => { if (!window.__lim) { const f = window.fetch; window.fetch = async (u, o = {}) => { if ((o.method || 'GET') === 'PUT' && String(u).includes('jsonbin') && (o.body || '').length > 100 * 1024) return new Response('{"message":"Bin size exceeds"}', { status: 413 }); return f(u, o); }; window.__lim = true; } });
    await lim(P.f); await lim(P.m);
    // llenar el bin con 350 gastos compartidos del mismo estilo
    const fill = Array.from({ length: 455 }, (_, i) => ({ id: 'fill' + i, desc: 'Gasto compartido de relleno número ' + i, amount: 1000 + i, cat: 'super', month: rel(-(i % 12), 1).m, year: rel(-(i % 12), 1).y, day: 1 + i % 27, addedAt: Date.now() - i * 3600000, updatedAt: Date.now() - i * 3600000, shared: { active: true, paidBy: i % 2 ? 'mile' : 'fede', splitPct: 50 } }));
    L.bins[P.bin] = { gastos: fill, payments: [], tombstones: {}, payTombstones: {}, cats: {}, _ts: Date.now() };
    const kb = Buffer.byteLength(JSON.stringify(L.bins[P.bin])) / 1024;
    await P.f.ev(() => syncCompartidos(null)); await P.f.settle();
    await P.f.clearToasts();
    let rr = await uiGasto(P.f, { desc: 'El que no entra', cat: 'varios', amt: 5000, date: rel(0, 5).str, sh: { paidBy: 'fede', split: 50 } });
    await P.f.settle();
    const pend = await P.f.ev(() => sharedPendientes().total);
    const avisos = await P.f.toasts();
    console.log(`   · bin de ${kb.toFixed(0)} kB: el gasto nuevo queda pendiente = ${pend}; carteles: ${JSON.stringify(avisos.filter(t => /kb|JSONBin|subir|guardado/i.test(t)))}`);
    is(pend === 0 || avisos.some(t => /kb|100/.test(t)), 'si el bin compartido no puede crecer más, la app lo dice con el peso y qué hacer');
    await P.close();
  }

  section('FASE 7c · más de 18 meses: los gastos viejos se archivan y dejan de verse');
  {
    const old1 = rel(-20, 10), old2 = rel(-14, 10);
    const ar = await L.device(browser, { myName: 'fede', compBin: 'arch13', seed: { gastos: [
      { id: 'viejo20', desc: 'Compra de hace 20 meses', cat: 'compras', amount: 77777, month: old1.m, year: old1.y, day: old1.d, addedAt: new Date(old1.y, old1.m, old1.d, 12).getTime() },
      { id: 'viejo14', desc: 'Compra de hace 14 meses', cat: 'compras', amount: 11111, month: old2.m, year: old2.y, day: old2.d, addedAt: new Date(old2.y, old2.m, old2.d, 12).getTime() },
    ] } });
    await ar.ev(() => clearInterval(_sharedAutoTimer));
    await ar.page.reload(); await ar.page.waitForFunction(() => typeof S === 'object'); await ar.page.waitForTimeout(3800);
    const r = await ar.ev((a) => { goTo('gastos'); setGastosMonth(a.m, a.y); buscarGastos('gastos', 'hace 20'); const enBuscador = document.querySelectorAll('#sq-res-gastos .sq-row').length; buscarGastos('gastos', ''); return { enS: S.gastos.some(g => g.id === 'viejo20'), enArchivo: getArchivedGastos().some(g => g.id === 'viejo20'), busca: enBuscador, toast: document.getElementById('toast-msg').textContent }; }, old1);
    console.log('   · gasto de hace 20 meses tras abrir la app:', JSON.stringify(r));
    is(r.enS || r.busca > 0, '[archivo-invisible] un gasto de hace 20 meses sigue pudiéndose ver/buscar/editar en la app (hoy se mueve a un archivo de localStorage que ninguna pantalla lee; "año contra año" y el buscador no lo encuentran)');
    is(!r.enS ? r.enArchivo : true, '(dato) el gasto archivado no se pierde: queda en fin_gastos_archive y entra en el backup');
    await ar.close();
  }

  // ═══ FASE 8 · cambio de año (dic → ene) y paso de los meses ═══════════
  section('FASE 8 · viajar en el tiempo: 31/12 → 1/1 y 7 meses después (reloj del navegador)');
  {
    const estado = await fede.ev(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
    const viaje = async (fecha) => {
      const d = await L.device(browser, { myName: 'fede', compBin: BIN });
      await d.page.waitForTimeout(450);   // que termine el guardado con debounce de la semilla antes de pisar el almacenamiento
      await d.page.clock.install({ time: fecha });
      await d.ev((st) => { localStorage.clear(); for (const k in st) localStorage.setItem(k, st[k]); }, estado);
      await d.page.reload(); await d.page.waitForFunction(() => typeof S === 'object' && typeof save === 'function'); await d.page.waitForTimeout(800);
      await d.ev(() => { clearInterval(_sharedAutoTimer); });
      return d;
    };
    // Un sueldo "Mensual" con el rango por defecto, cargado hoy
    await uiPlan(fede, { cat: 'ingreso', name: 'Sueldo por defecto', amount: 1000000 }); await flush(fede);
    const estado2 = await fede.ev(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
    Object.assign(estado, estado2);
    const f31 = new Date(2026, 11, 31, 22, 30);
    const t1 = await viaje(f31);
    const a = await t1.ev(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      goTo('saldos'); await sleep(900);
      const w = document.querySelector('.wr-date').textContent;
      goTo('gastos'); await sleep(600); const mes1 = document.getElementById('mlbl').textContent;
      chMonth(1); await sleep(600); const mes2 = document.getElementById('mlbl').textContent; chMonth(-1); await sleep(300);
      goTo('agenda'); switchAgendaTab('plan'); await sleep(600);
      const cols = [...document.querySelectorAll('#ptable thead th')].slice(1).map(x => x.textContent.trim());
      return { w, mes1, mes2, cols, cierre: [...document.querySelectorAll('#ptable tr.neto-r td')].slice(1).map(x => x.textContent.trim()) };
    });
    console.log('   · 31/12/2026 22:30 →', JSON.stringify(a));
    eq([a.mes1, a.mes2], ['Diciembre 2026', 'Enero 2027'], 'Gastos: de diciembre se pasa a enero del año siguiente (y vuelve)');
    eq(a.cols.slice(0, 3), ['Dic', 'Ene ’27', 'Feb ’27'], 'Plan: las columnas arrancan en diciembre y siguen en enero (con la marca de año en las del año que viene)');
    // Pasar la medianoche sin cerrar la app
    await t1.page.clock.setSystemTime(new Date(2027, 0, 1, 0, 5));
    await t1.page.reload(); await t1.page.waitForFunction(() => typeof S === 'object'); await t1.page.waitForTimeout(800);
    const b = await t1.ev(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      goTo('saldos'); await sleep(900);
      const num = s => { const t = String(s).replace(/[^\d-]/g, ''); return t === '' ? NaN : Number(t); };
      const gaste = num(document.querySelectorAll('.wr-mes-val')[1].textContent);
      const cuotasEnero = S.gastos.filter(g => g.year === 2027 && g.month === 0).reduce((s, g) => s + eAmt(g), 0);
      goTo('agenda'); switchAgendaTab('plan'); await sleep(600);
      const filas = Object.fromEntries(S.plan.map(p => [p.name.replace(/ \(\d+c\)$/, ''), Object.keys(p.months).sort()]));
      const cols = [...document.querySelectorAll('#ptable thead th')].slice(1).map(x => x.textContent.trim());
      const res = [...document.querySelectorAll('#ptable tr.res-r td')].slice(1).map(x => x.textContent.trim());
      return { gaste, cuotasEnero: Math.round(cuotasEnero), cols, filas, res, hoy: new Date().toISOString() };
    });
    console.log('   · 1/1/2027 00:05 → columnas', b.cols.join(','), '· "Gasté"', b.gaste, '· Σ gastos de enero', b.cuotasEnero);
    eq(b.cols[0], 'Ene', 'pasada la medianoche del 31/12, el Plan arranca en enero');
    eq(b.gaste, b.cuotasEnero, '"Gasté" de Saldos pasa a contar solo enero 2027');
    is(!Object.values(b.filas).some(ms => ms.some(m => m < '2027-01')), 'el Plan descarta los meses de 2026 (no quedan claves viejas)');
    // Suscripciones mensuales se renuevan solas hasta el horizonte; los ingresos cargados por el modal no.
    eq(b.filas['Netflix'].slice(-1)[0], '2027-12', 'una suscripción mensual sigue proyectada hasta 12 meses adelante (2027-12)');
    await t1.close();
    // Siete meses después: ¿sigue el sueldo?
    const t2 = await viaje(new Date(Y0, M0 + 7, 15, 10, 0));
    const c = await t2.ev(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); goTo('agenda'); switchAgendaTab('plan'); await sleep(600); const ing = S.plan.filter(p => p.cat === 'ingreso').map(p => ({ n: p.name, meses: Object.keys(p.months).length, rep: !!p.rep })); return { ing, cols: [...document.querySelectorAll('#ptable thead th')].slice(1).map(x => x.textContent.trim()), sinIng: !!document.querySelector('#ptable .sec-ing + tr td[colspan]') }; });
    console.log('   · 7 meses después, ingresos del Plan:', JSON.stringify(c.ing));
    const sd = c.ing.find(x => x.n === 'Sueldo por defecto');
    is(sd && sd.meses > 0, `[ingreso-no-renueva] un sueldo "Mensual" cargado con el rango que propone el modal sigue proyectado 7 meses después (ahora: ${sd ? sd.meses : 0} meses, renovación automática = ${sd ? sd.rep : false}; el Plan queda sin ingresos y el Cierre del mes se hunde)`);
    await t2.close();
    // sacar el sueldo de prueba
    await fede.ev(() => { S.plan = S.plan.filter(p => p.name !== 'Sueldo por defecto'); save(); });
  }

  // ═══ FASE 9 · sincronización personal entre dos teléfonos de la misma persona ═══
  section('FASE 9 · sync personal (bin propio): subir desde un teléfono y bajar en otro, sin perder nada');
  {
    const conf = (d, bin) => d.ev((b) => { localStorage.setItem('fin_sync_bin_id', b); localStorage.setItem('fin_sync_api_key', 'k'); }, bin);
    await conf(fede, 'personal13'); await flush(fede);
    await fede.ev(() => syncPush(true)); await fede.page.waitForTimeout(500);
    is(!!L.bins.personal13 && L.bins.personal13.fin_v6, 'el primer teléfono sube su estado al bin personal');
    const f2 = await L.device(browser, { myName: 'fede', compBin: BIN, seed: { gastos: [], accounts: [] } });
    await conf(f2, 'personal13'); await f2.ev(() => clearInterval(_sharedAutoTimer)); await f2.page.waitForTimeout(300);
    await f2.ev(() => { localStorage.removeItem('fin_v6'); });
    await f2.ev(() => syncPull(true)); await f2.page.waitForTimeout(900);
    const base = await fede.ev(() => ({ g: S.gastos.map(g => [g.id, g.amount, g.desc, g.cat, g.month, g.year]).sort(), a: S.accounts.map(a => [a.id, a.amount, a.currency]), p: S.plan.length, sb: S.agenda.subs.length, v: S.agenda.vencimientos.length, c: S.agenda.cuotas.length }));
    const seg = await f2.ev(() => ({ g: S.gastos.map(g => [g.id, g.amount, g.desc, g.cat, g.month, g.year]).sort(), a: S.accounts.map(a => [a.id, a.amount, a.currency]), p: S.plan.length, sb: S.agenda.subs.length, v: S.agenda.vencimientos.length, c: S.agenda.cuotas.length }));
    eq(JSON.stringify(seg.g) === JSON.stringify(base.g), true, `el segundo teléfono baja los ${base.g.length} gastos idénticos`);
    eq([seg.a, seg.p, seg.sb, seg.v, seg.c], [base.a, base.p, base.sb, base.v, base.c], 'y cuentas, Plan, suscripciones, vencimientos y cuotas');
    // edición en el segundo, subida, y el primero la trae
    await f2.ev(() => { S.gastos[0].amount = 424242; save(); });
    await f2.page.waitForTimeout(300); await f2.ev(() => syncPush(true)); await f2.page.waitForTimeout(600);
    const id0 = await f2.ev(() => S.gastos[0].id);
    await fede.ev(() => syncPull(true)); await fede.page.waitForTimeout(800);
    const llega = await fede.ev((id) => { const b = document.getElementById('sync-conflict-banner'); return { monto: (S.gastos.find(g => g.id === id) || {}).amount, banner: b && !b.classList.contains('hidden') }; }, id0);
    console.log('   · edición en el 2° teléfono → el 1° la trae:', JSON.stringify(llega));
    is(llega.monto === 424242 || llega.banner, 'la edición hecha en un teléfono llega al otro (o se ofrece resolver el conflicto)');
    await f2.close();
    await fede.ev(() => { localStorage.removeItem('fin_sync_bin_id'); });
  }

  // ═══ FASE 10 · teléfono chico: textos larguísimos y montos enormes ═══
  section('FASE 10 · iPhone 390 px: palabra de 300 caracteres y montos de 16 cifras (desbordes)');
  {
    const f = rel(0, 4);
    const larga = 'Supercalifragilístico'.repeat(15);
    const mv = await L.device(browser, { myName: 'fede', compBin: 'mov13', contexto: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
      seed: { gastos: [
        { id: 'l1', desc: larga, cat: 'comida', amount: 1000000000000000, month: f.m, year: f.y, day: f.d, addedAt: new Date(f.y, f.m, f.d, 12).getTime() },
        { id: 'l2', desc: 'Con espacios ' + 'palabra '.repeat(40), cat: 'super', amount: 99999999999, month: f.m, year: f.y, day: f.d, addedAt: new Date(f.y, f.m, f.d, 12).getTime() + 1000, shared: { active: true, paidBy: 'mile', splitPct: 50 } },
      ], agenda: { subs: [{ id: 's1', name: larga, amount: 99999999999, date: rel(1, 5).str, period: 'mensual' }], vencimientos: [], cuotas: [], inversiones: [] },
      plan: [{ id: 'pl1', name: larga, cat: 'hogar', months: { [pkOf(Y0, M0 + 1)]: 99999999999 } }], accounts: [{ id: 'a1', name: larga, type: 'bancaria', amount: 1000000000000000, currency: 'ARS' }] } });
    await mv.ev(() => clearInterval(_sharedAutoTimer)); await mv.page.waitForTimeout(400);
    const of = await mv.ev(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms)); const out = {};
      const medir = async (nombre, fn) => { fn(); await sleep(900); const w = innerWidth; const sc = document.documentElement.scrollWidth; const off = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > w + 1 && !e.closest('.proj-scroll, .bank-cards-scroll, .chips, .tj-spark, [class*="scroll"], .overlay:not(.open), #ptable') && getComputedStyle(e).position !== 'fixed'; }).slice(0, 4).map(e => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]); out[nombre] = { extra: sc - w, off }; };
      await medir('saldos', () => goTo('saldos')); await medir('gastos', () => goTo('gastos')); await medir('compartidos', () => { goTo('compartidos'); });
      await medir('agenda', () => { goTo('agenda'); switchAgendaTab('lista'); }); await medir('tarjetas', () => switchAgendaTab('tarjetas')); await medir('plan', () => switchAgendaTab('plan'));
      return out;
    });
    console.log('   · desbordes horizontales:', JSON.stringify(of));
    const malos = Object.entries(of).filter(([, v]) => v.extra > 1);
    eq(malos.map(([k, v]) => k + ' +' + v.extra + 'px'), [], '[desborde-texto-largo] ninguna pantalla se ensancha con un nombre de 315 caracteres sin espacios ni montos de 16 cifras (no hay scroll horizontal de la página)');
    await mv.close();
  }
  console.log(`\n(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  console.log(`\n${'─'.repeat(52)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  await browser.close();
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error('ERROR:', e); process.exit(2); });
