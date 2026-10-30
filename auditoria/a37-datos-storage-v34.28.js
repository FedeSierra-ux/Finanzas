// Los arreglos de almacenamiento, backup y sync personal de la v34.28 (auditoría de la v34.27, ítems A9, A10,
// A10b, A11, A24, B4, B8, B10 y B14), cada uno con la reproducción con la que se encontró. Con la v34.27 casi
// todas las secciones terminan en ✗.
const L = require('./lib');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { eq, is, section } = L;

// ── utilidades ──────────────────────────────────────────────────────────────
// Gastos de prueba. `desc` lleva texto al azar para que la compresión no los achique de más.
const gen = (n, pref, { meses = 1, atras = 0 } = {}) => {
  const now = new Date(), out = [];
  for (let i = 0; i < n; i++) {
    const dt = new Date(now.getFullYear(), now.getMonth() - atras - (i % meses), 1 + (i % 27), 12);
    out.push({ id: pref + i, desc: 'Compra ' + i + ' ' + Math.random().toString(36).slice(2, 10), cat: 'comida', amount: 1000 + (i % 977) * 13,
      month: dt.getMonth(), year: dt.getFullYear(), day: dt.getDate(), addedAt: dt.getTime() + i, weeklyBudget: true, extraBudgetId: null, shared: null });
  }
  return out;
};
const nuevo = async (browser, opts = {}) => {
  const d = await L.device(browser, { myName: 'fede', compBin: 'a37', ...opts });
  await d.ev(() => {
    try { clearInterval(_sharedAutoTimer); } catch (e) { }
    try { clearInterval(_tcAutoTimer); } catch (e) { }
    _avisoAlmacenamientoTs = Date.now();   // que el aviso del 80% no se cruce con lo que se mide
  });
  await d.page.waitForTimeout(300);
  return d;
};
const esperarApp = async d => {
  await d.page.waitForFunction(() => typeof S === 'object' && S !== null && typeof save === 'function' && typeof syncCompartidos === 'function');
  await d.page.waitForTimeout(500);
  await d.ev(() => {
    try { clearInterval(_sharedAutoTimer); } catch (e) { }
    try { clearInterval(_tcAutoTimer); } catch (e) { }
    _avisoAlmacenamientoTs = Date.now();
    window.__toasts = []; const st = window.showToast; window.showToast = (m, a, b, c) => { window.__toasts.push(String(m)); return st(m, a, b, c); };
  });
};
// Llena localStorage hasta dejar `libre` caracteres.
const llenar = (d, libre) => d.ev((libre) => {
  const k = 'zz_relleno'; localStorage.removeItem(k);
  let lo = 0, hi = 6000000;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); try { localStorage.setItem(k, 'x'.repeat(mid)); lo = mid; } catch (e) { hi = mid - 1; } }
  localStorage.setItem(k, 'x'.repeat(Math.max(0, lo - libre)));
  return lo;
}, libre);
// A partir de acá, escribir las claves que empiecen con alguna de `claves` falla como con el disco lleno.
const romper = (d, claves) => d.ev((claves) => {
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (claves.some(c => String(k).startsWith(c))) { const e = new Error('lleno'); e.name = 'QuotaExceededError'; throw e; }
    return orig.call(this, k, v);
  };
  window.__arreglarSetItem = () => { Storage.prototype.setItem = orig; };
}, claves);
const arreglar = d => d.ev(() => { if (window.__arreglarSetItem) window.__arreglarSetItem(); });
const textoVisible = (d, sel, re) => d.ev(({ sel, re }) => [...document.querySelectorAll(sel)].some(e => e.getClientRects().length && new RegExp(re, 'i').test(e.innerText || '')), { sel, re });

(async () => {
  const browser = await L.launch();

  // ════ A10 · copias diarias comprimidas ═════════════════════════════════════
  section('A10 · la copia diaria se guarda comprimida (gz1) y se puede restaurar');
  {
    const d = await nuevo(browser);
    const gs = gen(800, 'g', { meses: 3 });
    await d.ev(async (gs) => { S.gastos = gs; save(); await new Promise(r => setTimeout(r, 400)); localStorage.removeItem('fin_gastos_bak'); await _runAutoBackupGastos(); }, gs);
    const r = await d.ev(() => { const raw = localStorage.getItem('fin_gastos_bak'); return { len: raw.length, crudo: JSON.stringify(S.gastos).length, gz: raw.includes('gz1:'), n: JSON.parse(raw).length }; });
    is(r.gz, 'la copia diaria lleva los gastos comprimidos (gz1:)');
    is(r.len < r.crudo / 3, `y pesa ${r.len} caracteres contra ${r.crudo} sin comprimir`);
    // La pantalla la lista y cuenta bien.
    await d.ev(() => { openGastosBackupModal(); });
    await d.page.waitForTimeout(400);
    const modal = await d.ev(() => document.getElementById('ov-gastos-bak')?.innerText || '');
    is(/800 gastos/.test(modal), 'Copias de gastos cuenta los 800 gastos de la copia comprimida');
    is(/última copia/i.test(modal), 'y dice cuándo fue la última copia real');
    await d.ev(() => document.getElementById('ov-gastos-bak')?.remove());
    // Restaurar y "Faltantes" leen la copia comprimida.
    const r2 = await d.ev(async () => {
      window.appConfirm = async () => true;
      S.gastos = S.gastos.slice(0, 10);
      await restoreGastosBakMerge(0);
      const faltantes = S.gastos.length;
      S.gastos = S.gastos.slice(0, 10);
      await restoreGastosBak(0);
      return { faltantes, restaurar: S.gastos.length };
    });
    eq(r2.faltantes, 800, '"Faltantes" recupera los 800 desde la copia comprimida');
    eq(r2.restaurar, 800, '"Restaurar" también');
    // Las copias viejas (sin comprimir) se siguen leyendo.
    const r3 = await d.ev(async () => {
      if (_bakTimer) { clearTimeout(_bakTimer); _bakTimer = null; }
      await (typeof _bakJob !== 'undefined' ? _bakJob : 0);
      localStorage.setItem('fin_gastos_bak', JSON.stringify([{ date: '2026-01-02', ts: Date.UTC(2026, 0, 2, 15), gastos: [
        { id: 'v1', desc: 'Viejo 1', cat: 'comida', amount: 10, month: 0, year: 2026, day: 2, addedAt: 1 },
        { id: 'v2', desc: 'Viejo 2', cat: 'comida', amount: 20, month: 0, year: 2026, day: 2, addedAt: 2 },
        { id: 'v3', desc: 'Viejo 3', cat: 'comida', amount: 30, month: 0, year: 2026, day: 2, addedAt: 3 }], payments: [] }]));
      openGastosBackupModal();
      const txt = document.getElementById('ov-gastos-bak')?.innerText || '';
      document.getElementById('ov-gastos-bak')?.remove();
      await restoreGastosBak(0);
      return { txt, ids: S.gastos.map(g => g.id).sort() };
    });
    is(/3 gastos/.test(r3.txt), 'una copia vieja (sin comprimir) se sigue mostrando');
    eq(r3.ids, ['v1', 'v2', 'v3'], 'y se sigue pudiendo restaurar');
    eq(d.errors, [], 'sin errores de JS');
    await d.close();
  }

  section('A10 · una copia que no entra avisa con un toast visible y la pantalla dice la verdad');
  {
    const d = await nuevo(browser);
    await d.ev(async () => { await _runAutoBackupGastos(); });   // una copia buena de base
    const gs = gen(1500, 'f', { meses: 3 });
    await d.ev((gs) => { S.gastos = gs; }, gs);
    await llenar(d, 3000);
    await d.ev(() => { window.__toasts.length = 0; });
    await d.ev(async () => { await _runAutoBackupGastos(); });
    const t = await d.toasts();
    is(t.some(x => /copia/i.test(x)), 'avisa con un toast que la copia diaria no se pudo guardar' + (t.length ? ' — toasts: ' + JSON.stringify(t) : ''));
    is(await d.ev(() => document.getElementById('toast-bar').classList.contains('show')), 'y el toast está a la vista');
    await d.ev(() => { openGastosBackupModal(); });
    await d.page.waitForTimeout(400);
    const modal = await d.ev(() => document.getElementById('ov-gastos-bak')?.innerText || '');
    is(/no se pudo|falló|no entr/i.test(modal), 'Copias de gastos dice que la última copia falló (no muestra una copia vieja como si fuera de hoy)');
    is(/última copia/i.test(modal), 'y muestra cuándo fue la última copia que sí se guardó');
    await d.close();
  }

  section('A10 · con ~4.000 gastos y siete días, las siete copias entran (antes se congelaban en la primera)');
  {
    const d = await nuevo(browser);
    const gs = gen(4000, 'm', { meses: 12 });
    await d.ev((gs) => { S.gastos = gs; localStorage.removeItem('fin_gastos_bak'); }, gs);
    await d.page.clock.install({ time: new Date(2026, 9, 20, 12) });
    for (let i = 0; i < 8; i++) {
      await d.page.clock.setSystemTime(new Date(2026, 9, 20 + i, 12));
      await d.ev(async () => { await _runAutoBackupGastos(); });
    }
    const r = await d.ev(() => { const raw = localStorage.getItem('fin_gastos_bak') || '[]'; const b = JSON.parse(raw); return { n: b.length, dias: new Set(b.map(x => x.date)).size, len: raw.length, tope: STORAGE_LIMITE }; });
    eq(r.n, 7, 'quedan las copias de los últimos 7 días');
    eq(r.dias, 7, 'cada una de un día distinto');
    is(r.len < r.tope * 0.25, `y ocupan el ${Math.round(r.len / r.tope * 100)}% del tope (no el 94% del informe)`);
    await d.close();
  }

  // ════ A10b · persistJsonStorage dice qué borró ═════════════════════════════
  section('A10b · si para guardar lo principal se borran copias, el toast dice cuáles');
  {
    const d = await nuevo(browser);
    const viejos = gen(500, 'c', { meses: 3 });
    await d.ev((g) => {
      const e = i => ({ date: '2026-01-0' + (i + 1), ts: i, gastos: g, payments: [] });
      localStorage.setItem('fin_gastos_bak', JSON.stringify([0, 1, 2, 3, 4, 5, 6].map(e)));
    }, viejos);
    await llenar(d, 20000);
    const gs = gen(900, 'p', { meses: 3 });
    const r = await d.ev((gs) => {
      S.gastos = gs; window.__toasts.length = 0;
      const ok = persistJsonStorage('fin_v6', S);
      return { ok, copias: JSON.parse(localStorage.getItem('fin_gastos_bak') || '[]').length, toasts: window.__toasts.slice(), n: JSON.parse(localStorage.getItem('fin_v6')).gastos.length };
    }, gs);
    is(r.ok && r.n === 900, 'el guardado principal entra');
    eq(r.copias, 1, 'porque se borraron copias diarias');
    is(r.toasts.some(t => /borr/i.test(t) && /copias diarias/i.test(t) && /\b6\b/.test(t)), 'y el toast dice qué se borró (6 de las 7 copias diarias): ' + JSON.stringify(r.toasts));
    await d.close();
  }

  // ════ A10 · el aviso del 80% no cuenta las copias ══════════════════════════
  section('A10 · el aviso de almacenamiento no cuenta las copias diarias como datos vivos');
  {
    const d = await nuevo(browser);
    await d.ev(() => {
      window.__av = []; window.appConfirm = async o => { window.__av.push(o); return false; };
      const e = i => ({ date: '2026-01-0' + (i + 1), ts: i, gastos: [], payments: [], pad: 'x'.repeat(300000) });
      localStorage.setItem('fin_gastos_bak', JSON.stringify([0, 1, 2, 3, 4, 5, 6].map(e)));
      localStorage.setItem('zz_vivo', 'x'.repeat(1900000));
    });
    const u = await d.ev(() => { const u = usoAlmacenamiento(); return { pct: u.pct, chars: u.chars }; });
    console.log('   · uso informado con copias de ~2,1M y datos vivos de ~1,9M:', u.pct + '%');
    await d.ev(async () => { _avisoAlmacenamientoTs = 0; localStorage.removeItem('fin_quota_aviso_ts'); await revisarAlmacenamiento(); });
    eq(await d.ev(() => window.__av.length), 0, 'con las copias ocupando casi la mitad y los datos vivos al ~40% no se avisa');
    // Con datos vivos de verdad al tope, sí.
    await d.ev(() => { window.__av = []; localStorage.removeItem('fin_gastos_bak'); localStorage.setItem('zz_vivo', 'x'.repeat(4300000)); });
    await d.ev(async () => { _avisoAlmacenamientoTs = 0; localStorage.removeItem('fin_quota_aviso_ts'); await revisarAlmacenamiento(); });
    const av = await d.ev(() => window.__av.map(o => ({ t: o.title, b: o.body })));
    eq(av.length, 1, 'con los datos vivos al ~86% sí avisa');
    is(av[0] && !/gastos_bak/.test(av[0].b), 'y no marca las copias diarias como "lo más pesado"');
    await d.close();
  }

  // ════ A9 + A11 · importBackup con archivo grande ═══════════════════════════
  const BAK_FILE = path.join(os.tmpdir(), 'a37-backup-grande.json');
  const hoy = Date.now();
  const v6bak = { tc: 1300, accounts: [{ id: 'acc1', name: 'Galicia', type: 'bancaria', amount: 1000, currency: 'ARS' }], gastos: gen(3, 'rec'), plan: [], agenda: { subs: [], vencimientos: [], cuotas: [], inversiones: [] }, paymentMemory: {} };
  const archivoBak = gen(11000, 'arch', { meses: 8, atras: 14 });
  fs.writeFileSync(BAK_FILE, JSON.stringify({ _exportTs: hoy, _version: '34.27', data: {
    fin_v6: JSON.stringify(v6bak), fin_gastos_archive: JSON.stringify(archivoBak),
    fin_theme: 'light', fin_compact: 'true', fin_push_worker_url: 'https://worker37.example.workers.dev', fin_push_vapid_public: 'BPvapid37', fin_cat_ico_comida: '1' } }));
  const importar = async (d, { reemplazar = true } = {}) => {
    await d.ev((reemplazar) => { window.__confirms = []; let n = 0; window.appConfirm = o => { window.__confirms.push(o.okLabel); return Promise.resolve(reemplazar ? n++ > 0 : true); }; window.__vivo = 'sí'; }, reemplazar);
    await d.page.setInputFiles('input[onchange="importBackup(this)"]', BAK_FILE);
    await d.page.waitForTimeout(1100);
    return d.ev(() => ({ toasts: window.__toasts.slice(), vivo: window.__vivo, confirms: window.__confirms }));
  };

  section('A9/A11 · importar un backup con archivo grande lo lleva a IndexedDB y "Reemplazar todo" vacía el archivo anterior');
  {
    const d = await nuevo(browser, { seed: { gastos: gen(1, 'orig') } });
    await d.ev(async () => { await archivarEnIDB([{ id: 'previo1', desc: 'Previo', cat: 'comida', amount: 5, month: 0, year: 2024, day: 3, addedAt: new Date(2024, 0, 3, 12).getTime() }]); _archivoMem = null; });
    await llenar(d, 600000);   // el archivo (≈2,6M) no entra en localStorage
    const r = await importar(d);
    is(r.toasts.some(t => /✅ Datos restaurados/.test(t)), 'avisa que restauró: ' + JSON.stringify(r.toasts));
    await d.page.waitForTimeout(2300);
    await esperarApp(d);
    const e = await d.ev(async () => { await _archivoListo; const ids = getArchivedGastos().map(g => g.id); return { n: ids.filter(i => i.startsWith('arch')).length, previo: ids.includes('previo1'), ls: localStorage.getItem('fin_gastos_archive') === null, gastos: S.gastos.map(g => g.id).sort() }; });
    eq(e.n, 11000, 'el archivo del backup (11.000 gastos) quedó entero en IndexedDB');
    is(!e.previo, 'y el archivo anterior de IndexedDB se vació antes (no queda "previo1")');
    is(e.ls, 'sin dejar una copia enorme en localStorage');
    eq(e.gastos, ['rec0', 'rec1', 'rec2'], 'y los gastos recientes son los del backup');
    await d.close();
  }

  section('A9 · sin IndexedDB y sin lugar en localStorage no dice "✅ Datos restaurados" ni pierde lo que había');
  {
    const d = await nuevo(browser, { seed: { gastos: gen(1, 'orig') }, initScript: () => { Object.defineProperty(window, 'indexedDB', { value: undefined }); } });
    await llenar(d, 600000);
    const r = await importar(d);
    is(!r.toasts.some(t => /✅ Datos restaurados/.test(t)), 'no dice "✅ Datos restaurados": ' + JSON.stringify(r.toasts));
    is(r.toasts.some(t => /archivo/i.test(t) && /(❌|⚠️)/.test(t)), 'avisa con claridad que el archivo no entró');
    const e = await d.ev(() => ({ ids: JSON.parse(localStorage.getItem('fin_v6')).gastos.map(g => g.id), vivo: window.__vivo }));
    eq(e.ids, ['orig0'], 'lo que había quedó como estaba (se abortó, no se pisó a medias)');
    eq(e.vivo, 'sí', 'y no recargó la app');
    await d.close();
  }

  section('A11 · el import de Excel y de Mercado Pago detecta repetidos también contra el archivo (IndexedDB)');
  {
    const d = await nuevo(browser);
    const f = await d.ev(() => {
      const dt = new Date(); dt.setMonth(dt.getMonth() - 14); dt.setDate(5); dt.setHours(12, 0, 0, 0);
      _archivoMem = [{ id: 'arch1', desc: 'Cena vieja del club', cat: 'comida', amount: 7777, month: dt.getMonth(), year: dt.getFullYear(), day: 5, addedAt: dt.getTime() }];
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-05`;
    });
    const x = await d.ev((f) => {
      const rows = [['Nombre', 'Categoría', 'Fecha', 'Monto', 'Semanal', 'Compartido', 'Pagador', '% Fede'], ['Cena vieja del club', 'varios', f, 7777, 'No', 'No', 'fede', 50]];
      window.XLSX = { read: () => ({ SheetNames: ['h'], Sheets: { h: {} } }), utils: { sheet_to_json: () => rows } };
      parseExcelFileWithSheetJS(new Uint8Array(0));
      return excelReviewItems.map(i => ({ n: i.nombre, dup: i.dup, sel: i.selected }));
    }, f);
    eq(x, [{ n: 'Cena vieja del club', dup: true, sel: false }], 'Excel: el gasto que ya está en el archivo viene desmarcado como repetido');
    const m = await d.ev(async (f) => {
      sessionStorage.setItem('fin_apikey', 'sk-prueba');
      mpFileData = 'AAAA'; mpFileType = 'image'; mpFileMimeType = 'image/png';
      window.fetch = async () => new Response(JSON.stringify({ content: [{ text: JSON.stringify({ gastos: [{ desc: 'Cena vieja del club', amount: 7777, date: f, category: 'comida' }] }) }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      await processMPWithClaude();
      return mpReviewItems.map(i => ({ d: i.desc, dup: i.isDuplicate, sel: i.selected }));
    }, f);
    eq(m, [{ d: 'Cena vieja del club', dup: true, sel: false }], 'Mercado Pago: igual');
    await d.close();
  }

  // ════ A24 · el backup lleva la configuración ═══════════════════════════════
  section('A24 · el backup incluye Worker/VAPID, tema, vista compacta e íconos, y ninguna clave secreta');
  {
    const d = await nuevo(browser);
    await d.ev(() => {
      localStorage.setItem('fin_push_worker_url', 'https://w.example.workers.dev'); localStorage.setItem('fin_push_vapid_public', 'BPxyz');
      localStorage.setItem('fin_theme', 'light'); localStorage.setItem('fin_compact', 'true'); localStorage.setItem('fin_cat_ico_comida', '1');
      localStorage.setItem('fin_apikey', 'sk-secreta'); localStorage.setItem('fin_sync_api_key', 'master-sync'); localStorage.setItem('fin_comp_api_key', 'master-comp');
    });
    const [dl] = await Promise.all([d.page.waitForEvent('download', { timeout: 8000 }), d.ev(() => exportBackup())]);
    const ruta = path.join(os.tmpdir(), 'a37-export.json'); await dl.saveAs(ruta);
    const k = JSON.parse(fs.readFileSync(ruta, 'utf8')).data;
    for (const c of ['fin_push_worker_url', 'fin_push_vapid_public', 'fin_theme', 'fin_compact', 'fin_cat_ico_comida']) is(k[c] !== undefined, `el backup trae ${c}`);
    is(!Object.keys(k).some(c => /api_?key|master/i.test(c)) && !JSON.stringify(k).includes('sk-secreta') && !JSON.stringify(k).includes('master-'), 'y no trae ninguna clave secreta (key de Anthropic ni master keys)');
    await d.close();
  }
  {
    const d = await nuevo(browser);
    await d.ev(() => { localStorage.setItem('fin_theme', 'dark'); localStorage.setItem('fin_compact', 'false'); });
    await importar(d);
    await d.page.waitForTimeout(2300);
    await esperarApp(d);
    const r = await d.ev(() => ({ th: localStorage.getItem('fin_theme'), cp: localStorage.getItem('fin_compact'), w: localStorage.getItem('fin_push_worker_url'), v: localStorage.getItem('fin_push_vapid_public'), ic: localStorage.getItem('fin_cat_ico_comida') }));
    eq(r, { th: 'light', cp: 'true', w: 'https://worker37.example.workers.dev', v: 'BPvapid37', ic: '1' }, 'restaurar el backup deja esa configuración en el teléfono nuevo');
    await d.close();
  }

  // ════ B4 · dos pestañas ════════════════════════════════════════════════════
  section('B4 · dos pestañas abiertas: una no pisa a la otra sin aviso');
  {
    const d = await nuevo(browser);
    const p2 = await d.ctx.newPage();
    const err2 = []; p2.on('pageerror', e => err2.push(String(e.message)));
    await p2.addInitScript(() => { window.fetch = () => Promise.reject(new TypeError('offline')); });
    await p2.goto(pathToFileURL(L.APP_FILE).href);
    await p2.waitForFunction(() => typeof S === 'object' && S !== null && typeof save === 'function' && typeof syncCompartidos === 'function');
    await p2.waitForTimeout(500);
    await p2.evaluate(() => { try { clearInterval(_sharedAutoTimer); clearInterval(_tcAutoTimer); } catch (e) { } });
    const g = id => ({ id, desc: 'Gasto ' + id, cat: 'comida', amount: 100, month: new Date().getMonth(), year: new Date().getFullYear(), day: 3, addedAt: Date.now() });
    // 1 · B guarda y A se entera sola.
    await d.ev(() => { window.__toasts.length = 0; });
    await p2.evaluate(g => { S.gastos.push(g); save(); }, g('deB'));
    await d.page.waitForTimeout(700);
    is(await d.ev(() => S.gastos.some(x => x.id === 'deB')), 'A recibe el gasto que B guardó (escucha el evento storage y recarga)');
    is((await d.toasts()).some(t => /otra (ventana|pesta)/i.test(t)), 'y lo avisa');
    // 2 · A guarda encima: no pisa lo de B.
    await d.ev(g => { S.gastos.push(g); save(); }, g('deA'));
    await d.page.waitForTimeout(700);
    const ls1 = await d.ev(() => JSON.parse(localStorage.getItem('fin_v6')).gastos.map(x => x.id).sort());
    eq(ls1, ['deA', 'deB'], 'lo guardado por A conserva el gasto de B');
    is(await p2.evaluate(() => S.gastos.some(x => x.id === 'deA')), 'y B recibe el de A');
    // 3 · Se perdió el evento (pestaña congelada): al guardar, A funde en vez de pisar.
    await d.ev(() => { if (typeof _onStorageExterno === 'function') window.removeEventListener('storage', _onStorageExterno); });
    await p2.evaluate(g => { S.gastos.push(g); save(); }, g('deB2'));
    await d.page.waitForTimeout(500);
    await d.ev(g => { S.gastos.push(g); save(); }, g('deA2'));
    await d.page.waitForTimeout(700);
    const ls2 = await d.ev(() => JSON.parse(localStorage.getItem('fin_v6')).gastos.map(x => x.id).sort());
    eq(ls2, ['deA', 'deA2', 'deB', 'deB2'], 'sin el evento, el guardado de A funde por id con lo que dejó B (no lo pisa)');
    // 4 · Al volver a primer plano también se pone al día.
    await p2.evaluate(g => { S.gastos.push(g); save(); }, g('deB3'));
    await d.page.waitForTimeout(500);
    await d.ev(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await d.page.waitForTimeout(500);
    is(await d.ev(() => S.gastos.some(x => x.id === 'deB3')), 'al volver a la pestaña se pone al día con lo que guardó la otra');
    eq(d.errors, [], 'A sin errores de JS');
    eq(err2, [], 'B sin errores de JS');
    await p2.close();
    await d.close();
  }

  // ════ B8 · aviso persistente al pasar los 100 kb ═══════════════════════════
  section('B8 · si el sync personal automático no sube por pasar los 100 kb, hay un aviso persistente a la vista');
  {
    const d = await nuevo(browser);
    await d.ev(() => { localStorage.setItem('fin_sync_bin_id', 'sb37'); localStorage.setItem('fin_sync_api_key', 'k'); goTo('saldos'); });
    const grandes = gen(4000, 'big', { meses: 6 }).map(g => ({ ...g, desc: g.desc + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) }));
    await d.ev(async (gs) => { S.gastos = gs; persistJsonStorage(KEY, S); await syncPush(false); }, grandes);
    await d.page.waitForTimeout(300);
    is(!L.bins.sb37, 'el bin no recibió nada (pasa los 100 kb comprimido)');
    is(await textoVisible(d, '#pg-saldos *', '100\\s*kb'), 'Saldos muestra un aviso con el tope de 100 kb');
    await d.page.reload(); await esperarApp(d);
    await d.ev(() => goTo('saldos'));
    is(await textoVisible(d, '#pg-saldos *', '100\\s*kb'), 'y sigue ahí al reabrir la app (persistente, no un toast)');
    await d.ev(async () => { S.gastos = S.gastos.slice(0, 50); persistJsonStorage(KEY, S); await syncPush(false); });
    await d.page.waitForTimeout(300);
    is(!!L.bins.sb37, 'al bajar el peso el sync vuelve a subir');
    is(!(await textoVisible(d, '#pg-saldos *', '100\\s*kb')), 'y el aviso se va');
    await d.close();
  }

  // ════ B10 · applyPayload ═══════════════════════════════════════════════════
  section('B10 · applyPayload no se corta a medias ni da por aplicado lo que falló');
  {
    const d = await nuevo(browser);
    const cloud = { tc: 1300, accounts: [], gastos: [{ id: 'cloud1', desc: 'De la nube', cat: 'comida', amount: 5, month: 9, year: 2026, day: 1, addedAt: 1 }], plan: [], agenda: { subs: [], vencimientos: [], cuotas: [], inversiones: [] }, paymentMemory: {} };
    await d.ev(() => { localStorage.setItem('fin_sync_ts', '1'); });
    await romper(d, ['fin_weekly_budgets']);
    const r = await d.ev((cloud) => {
      let err = null;
      try { applyPayload({ fin_v6: JSON.stringify(cloud), fin_weekly_budgets: JSON.stringify({ a: 1 }), _syncTs: 777 }); } catch (e) { err = e; }
      return { err: err && err.message, name: err && err.name, ids: S.gastos.map(g => g.id), ts: localStorage.getItem('fin_sync_ts') };
    }, cloud);
    await arreglar(d);
    is(r.name === 'Error' && /espacio|guardar/i.test(r.err || ''), 'un setItem posterior que falla se informa con un error claro: ' + r.name + ' ' + r.err);
    eq(r.ids, ['cloud1'], 'pero lo que sí se guardó (fin_v6) se recargó en la app');
    is(r.ts !== '777', 'y el sync no queda marcado como aplicado (fin_sync_ts=' + r.ts + ')');
    const r2 = await d.ev(() => {
      let err = null;
      try { applyPayload({ fin_v6: 'null', _syncTs: 888 }); } catch (e) { err = e; }
      return { err: !!err, ts: localStorage.getItem('fin_sync_ts') };
    });
    is(r2.ts !== '888', 'si el merge de fin_v6 falla, tampoco se marca el sync como aplicado (fin_sync_ts=' + r2.ts + ')');
    is(r2.err, 'y la falla sale como error para que el que llamó la vea');
    await d.close();
  }

  // ════ B14 · escrituras sin try, foto y TC ══════════════════════════════════
  section('B14 · escrituras de localStorage protegidas (instalar, tema, vista compacta, foto) y arranque sin lugar');
  {
    const d = await nuevo(browser);
    await romper(d, ['fin_install_dismissed', 'fin_theme', 'fin_compact', 'fin_foto_']);
    const r = await d.ev(() => {
      const out = {};
      const tryIt = (n, f) => { try { f(); out[n] = null; } catch (e) { out[n] = String(e.message); } };
      applyTheme('dark');
      tryIt('install', () => dismissInstall());
      tryIt('theme', () => toggleTheme());
      out.light = document.documentElement.getAttribute('data-theme');
      tryIt('theme2', () => toggleTheme());
      out.dark = document.documentElement.getAttribute('data-theme');
      tryIt('compact', () => setCompact(true));
      out.compact = _compact;
      window.__toasts.length = 0;
      tryIt('foto', () => _guardarFoto('fede', 'data:image/jpeg;base64,AAAA'));
      out.toasts = window.__toasts.slice();
      return out;
    });
    await arreglar(d);
    eq(r.install, null, 'dismissInstall no revienta si no puede guardar');
    eq([r.theme, r.theme2], [null, null], 'toggleTheme tampoco');
    eq([r.light, r.dark], ['light', null], 'y el tema igual cambia en la sesión (y vuelve)');
    eq([r.compact, r.compact === true], [true, true], 'la vista compacta cambia en la sesión aunque no se pueda guardar');
    eq(r.foto, null, '_guardarFoto no revienta');
    is(!r.toasts.some(t => /Foto de Fede ✓/.test(t)) && r.toasts.some(t => /foto/i.test(t) && /(no se pudo|espacio|lugar)/i.test(t)), 'y no dice que la foto se guardó: avisa que no hubo lugar ' + JSON.stringify(r.toasts));
    eq(d.errors, [], 'sin errores de JS');
    await d.close();
  }
  {
    // El id del dispositivo se escribe al cargar el script: si no hay lugar, la app tiene que arrancar igual.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e.message)));
    await page.addInitScript(() => {
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { if (k === 'fin_device_id' || k === 'fin_install_dismissed') { const e = new Error('lleno'); e.name = 'QuotaExceededError'; throw e; } return orig.call(this, k, v); };
    });
    await page.goto(pathToFileURL(L.APP_FILE).href);
    await page.waitForTimeout(1500);
    eq(errs, [], 'con el disco lleno para fin_device_id la app arranca sin errores');
    is(await page.evaluate(() => { try { return typeof _devId === 'function' && !!_devId(); } catch (e) { return false; } }), 'y igual tiene un id de dispositivo en memoria');
    await ctx.close();
  }

  section('B14 · el TC automático ignora variaciones de más de ±30% contra el valor previo');
  {
    const d = await nuevo(browser);
    const pedir = (venta, manual) => d.ev(async ({ venta, manual }) => {
      S.tc = 1300;
      window.fetch = async () => new Response(JSON.stringify({ venta, compra: venta, oficial: { value_avg: venta } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      await fetchTC(manual);
      return S.tc;
    }, { venta, manual });
    eq(await pedir(5000), 1300, 'una cotización de 5000 contra 1300 (+285%) se ignora');
    eq(await pedir(800), 1300, 'una de 800 (-38%) también');
    eq(await pedir(1650), 1650, 'una de 1650 (+27%) se acepta');
    eq(await pedir(1050), 1050, 'una de 1050 (-19%) se acepta');
    eq(await pedir(1700), 1300, 'una de 1700 (+31%) se ignora');
    await d.close();
  }

  await browser.close();
  console.log(`\n${'─'.repeat(52)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error('ERROR:', e); process.exit(2); });
