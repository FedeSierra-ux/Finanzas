// AUDITORÍA 19 — UN AÑO DE COMPARTIDOS EN DOS TELÉFONOS A LA PAR.
//
// Fede y Mile usan la app durante 12 meses, cada uno en su teléfono (contexto
// aislado, su propio localStorage), contra el mismo bin compartido falso de
// lib.js. Cargan, corrigen, borran y liquidan por la UI real, a veces uno
// detrás del otro, a veces al mismo tiempo (Promise.all antes de sincronizar),
// a veces sin señal, y con el reloj de un teléfono corrido ±5 minutos.
//
// Las fechas salen del reloj de verdad: el año simulado son los 11 meses
// anteriores al actual más el actual, y cada teléfono corre con page.clock
// puesto en el día simulado. Nada depende de en qué fecha se corra.
//
// La cuenta de referencia (qué gastos hay, de quién, cuánto debe cada uno, qué
// tiene que decir la pantalla de estadísticas) se lleva acá, en JS, sin usar
// ninguna función de la app.
const L = require('./lib');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { eq, is, section, bad } = L;

const BIN = 'bin19';
const T_START = Date.now();
const NOW = new Date();
const Y0 = NOW.getFullYear(), M0 = NOW.getMonth();
const pad = n => String(n).padStart(2, '0');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
// Mes simulado k (0..11): el 0 es hace 11 meses, el 11 es el mes en curso.
const mesK = k => { const f = new Date(Y0, M0 - 11 + k, 1); return { y: f.getFullYear(), m: f.getMonth() }; };
const ds = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const at = (k, d, h = 9, min = 0) => { const { y, m } = mesK(k); return new Date(y, m, d, h, min).getTime(); };
const MIN = 60 * 1000;
const KMAX = Math.min(12, Number(process.env.A19_MESES) || 12);   // para depurar: correr menos meses
const DEBUG = !!process.env.A19_DEBUG;
const dbg = (...a) => { if (DEBUG) console.log('     [dbg]', ...a); };
const other = w => (w === 'fede' ? 'mile' : 'fede');

// PRNG determinista: la misma corrida en cualquier fecha.
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(19190919);
const pick = arr => arr[Math.floor(R() * arr.length)];
const entre = (a, b) => a + Math.floor(R() * (b - a + 1));

// ── Cuenta independiente ────────────────────────────────────────────────────
// gastos compartidos: id → {id, desc, amount, cat, paidBy, split, date, owner}
// split = porcentaje de quien pagó (50, 100 = todo suyo, 0 = todo del otro).
const MG = new Map();
const MP = new Map();          // transferencias: id → {id, paidBy, amount, date}
const MOWN = [];               // gastos propios (no compartidos): {who, amount, y, m}
const owes = it => Math.round((it.amount - Math.round(it.amount * it.split / 100)) * 100) / 100;
// + = la pareja le debe a `who`
function saldoModel(who) {
  let s = 0;
  for (const it of MG.values()) s += it.paidBy === who ? owes(it) : -owes(it);
  for (const p of MP.values()) s += p.paidBy === who ? p.amount : -p.amount;
  return s;
}
// Parte de `who` de un gasto compartido, en pesos enteros (quien pagó redondea, el otro se queda con el resto).
const parte = (it, who) => (it.paidBy === who ? Math.round(it.amount * it.split / 100) : Math.round(it.amount - Math.round(it.amount * it.split / 100)));
const fmt = n => '$ ' + Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
// Un número redondeado por la pantalla contra la cuenta exacta: tolera solo el redondeo.
const cerca = (shown, exact) => Number.isFinite(shown) && Math.abs(shown - exact) <= 0.5000001;
const ymOf = date => ({ y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) - 1 });
const itemsDelMes = (y, m) => [...MG.values()].filter(it => { const o = ymOf(it.date); return o.y === y && o.m === m; });
const pagosDelMes = (y, m) => [...MP.values()].filter(p => { const o = ymOf(p.date); return o.y === y && o.m === m; });
const soloDe = it => (it.split === 100 ? it.paidBy : it.split === 0 ? other(it.paidBy) : null);
// Lo que hace el editor de Compartidos con cada cambio, escrito acá.
function aplicarCambio(it, ch) {
  if (ch.desc != null) it.desc = ch.desc;
  if (ch.amount != null) it.amount = ch.amount;
  if (ch.cat) it.cat = ch.cat;
  if (ch.paidBy && ch.paidBy !== it.paidBy) { const s = soloDe(it); it.paidBy = ch.paidBy; if (s) it.split = s === it.paidBy ? 100 : 0; }
  if (ch.split === 50) it.split = 50;
  if (ch.solo) it.split = ch.solo === it.paidBy ? 100 : 0;
}

// Montos como los tipea una persona: "12400", "12.400", "3456,78", "1.234,5".
function monto() {
  const r = R();
  let cents;
  if (r < 0.55) cents = entre(15, 1200) * 100 * (R() < 0.5 ? 10 : 1);               // redondo
  else if (r < 0.85) cents = entre(150000, 9000000);                                   // con centavos
  else cents = (entre(1000, 30000) * 2 + 1) * 100;                                     // impar (al 50% no se parte justo)
  const amount = cents / 100;
  const ent = Math.floor(cents / 100), dec = cents % 100;
  const miles = String(ent).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  let txt;
  if (dec) txt = (R() < 0.5 ? miles : String(ent)) + ',' + (dec % 10 === 0 && R() < 0.5 ? String(dec / 10) : pad(dec));
  else txt = ent >= 1000 && R() < 0.4 ? miles : String(ent);
  return { amount, txt };
}
const DESCS = {
  super: ['Coto', 'Día', 'Chino de la esquina', 'Jumbo', 'Carrefour', 'Verdulería'],
  comida: ['Pizza', 'Sushi', 'Empanadas', 'Café', 'Helado', 'Parrilla'],
  salidas: ['Cine', 'Bar', 'Teatro', 'Recital'],
  hogar: ['Luz', 'Gas', 'Agua', 'Internet', 'Limpieza'],
  transporte: ['Nafta', 'Uber', 'Peaje', 'Estacionamiento'],
  varios: ['Farmacia', 'Ferretería', 'Lavandería'],
  regalos: ['Regalo cumple', 'Regalo amigos'],
  compras: ['Sábanas', 'Vajilla', 'Lámpara'],
  depto: ['Pintura', 'Plomero', 'Cerrajero'],
};
const CATS_BASE = Object.keys(DESCS);

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-'));

  // ── Teléfonos con reloj propio ──────────────────────────────────────────
  const skew = { fede: 0, mile: 0 };
  let simNow = at(0, 1, 8);
  const waitApp = d => d.page.waitForFunction(() => typeof S === 'object' && S !== null && typeof save === 'function' && typeof syncCompartidos === 'function');
  // Después de cada carga: sin el timer de 3 min (las sincronizaciones las hace
  // el guion, llamando a lo mismo que llama el timer), con los toasts anotados y
  // con una red por teléfono que se puede cortar o hacer lenta.
  const prep = d => d.ev(() => {
    if (_sharedAutoTimer) { clearInterval(_sharedAutoTimer); _sharedAutoTimer = null; }
    window.__toasts = window.__toasts || [];
    if (!window.__toastWrapped) { const st = window.showToast; window.showToast = (msg, a, b, c) => { window.__toasts.push(String(msg)); return st(msg, a, b, c); }; window.__toastWrapped = true; }
    if (!window.__netWrapped) {
      const f = window.fetch;
      window.fetch = async (url, opts) => {
        if (window.__delay) await new Promise(r => setTimeout(r, window.__delay));
        if (window.__offline) throw new TypeError('Failed to fetch');
        // Retener los PUT: deja un push "en vuelo" el tiempo que haga falta.
        if (window.__holdPut && String((opts || {}).method || '').toUpperCase() === 'PUT') await new Promise(r => (window.__held = window.__held || []).push(r));
        return f(url, opts);
      };
      window.__netWrapped = true;
    }
  });
  const mk = async (name) => {
    const d = await L.device(browser, { myName: name, compBin: BIN });
    d.name = name;
    await d.page.waitForTimeout(450);          // que el guardado con debounce de la semilla llegue a localStorage
    await d.page.clock.install({ time: new Date(simNow) });
    await d.page.reload(); await waitApp(d); await d.page.waitForTimeout(300);
    await d.page.clock.setSystemTime(new Date(simNow + skew[name]));
    await prep(d);
    return d;
  };
  const fede = await mk('fede');
  const mile = await mk('mile');
  const devs = [fede, mile];
  const dev = w => (w === 'fede' ? fede : mile);
  const setClock = async (t) => {
    simNow = t;
    await Promise.all(devs.map(d => d.page.clock.setSystemTime(new Date(t + skew[d.name]))));
    await Promise.all(devs.map(prep));
  };
  // El reloj de los teléfonos sigue corriendo entre un setClock y otro: avanzar
  // siempre desde la hora que marcan ahora, así nunca vuelve para atrás.
  const advance = async ms => { const ahora = (await fede.ev(() => Date.now())) - skew.fede; await setClock(Math.max(simNow, ahora) + ms); };
  const red = (d, o) => d.ev((o) => { if ('offline' in o) window.__offline = o.offline; if ('delay' in o) window.__delay = o.delay; }, o);
  const offline = async (d, on) => { await red(d, { offline: on }); await d.ctx.setOffline(on); };

  // ── Sincronizar como la app ─────────────────────────────────────────────
  const settle = async (d) => { await d.settle(); await d.settle(); };
  const sync = async (d) => { await d.ev(() => syncCompartidos(null)); await settle(d); };
  const syncAll = async () => { await sync(fede); await sync(mile); await sync(fede); };
  // Lo mismo que hace una vuelta del timer de 3 minutos.
  const autoTick = async (d) => { await d.ev(() => (sharedPendientes().total ? reintentarPendientesCompartidos() : fetchSharedBin())); await settle(d); };

  // ── Conducción de la UI ─────────────────────────────────────────────────
  // Alta por el modal de gasto, tocando lo mismo que una persona.
  const uiGasto = (d, o) => d.ev(async (o) => {
    _gSaving = false;
    const before = S.gastos.length;
    openGastoModal();
    $('gdesc').value = o.desc; onGastoDescInput(o.desc);
    const chip = document.querySelector(`#gcats .chip[data-v="${o.cat}"]`);
    if (!chip) { closeOv('ov-gasto'); return { err: 'sin chip de categoría ' + o.cat }; }
    chip.click();
    $('gamt').value = o.txt;
    $('g-date-inp').value = o.date;
    if (o.cat === 'tarjeta') { $('gct').value = o.ct; $('gca').value = o.ca || 1; }
    if (o.sh) {
      $('g-shared-toggle').click();
      const pb = [$('g-paidby-fede'), $('g-paidby-mile')].find(b => b && b.dataset.who === o.sh.paidBy);
      if (!pb) return { err: 'sin botón de quién pagó' };
      pb.click();
      if (o.sh.solo) {
        const b = [...document.querySelectorAll('#g-split-presets [data-split^="solo-"]')].find(x => x.textContent.includes('Solo ' + (o.sh.solo === 'fede' ? 'Fede' : 'Mile')));
        if (!b) return { err: 'sin botón Solo' };
        b.click();
      } else document.querySelector('#g-split-presets [data-split="50"]').click();
    }
    const btn = document.querySelector('#ov-gasto .btnp');
    btn.click();
    if ($('dup-warn').classList.contains('show')) { _gSaving = false; btn.click(); }
    const nuevo = S.gastos.length > before ? S.gastos[S.gastos.length - 1] : null;
    return { added: S.gastos.length - before, id: nuevo && nuevo.id, amount: nuevo && nuevo.amount, split: nuevo && nuevo.shared && nuevo.shared.splitPct, open: $('ov-gasto').classList.contains('open') };
  }, o);
  let altasRechazadas = [];
  // Alta de un compartido y su registro en la cuenta independiente.
  const altaComp = async (who, o) => {
    const sh = { paidBy: o.paidBy || who };
    if (o.solo) sh.solo = o.solo;
    const r = await uiGasto(dev(who), { desc: o.desc, cat: o.cat, txt: o.txt, date: o.date, ct: o.ct, ca: o.ca, sh });
    if (r.added !== 1 || !r.id) { altasRechazadas.push(`${who} ${o.desc} ${o.txt}: ${JSON.stringify(r)}`); return null; }
    const split = o.solo ? (o.solo === sh.paidBy ? 100 : 0) : 50;
    MG.set(r.id, { id: r.id, desc: o.desc, amount: o.amount, cat: o.cat, paidBy: sh.paidBy, split, date: o.date, owner: who });
    dbg(who, 'alta', r.id, o.desc, o.cat, o.txt, '→', r.amount, sh.paidBy, split, o.date);
    return r.id;
  };
  const altaPropia = async (who, o) => {
    const r = await uiGasto(dev(who), { desc: o.desc, cat: o.cat, txt: o.txt, date: o.date });
    if (r.added !== 1) { altasRechazadas.push(`${who} propio ${o.desc}: ${JSON.stringify(r)}`); return; }
    const { y, m } = ymOf(o.date);
    MOWN.push({ who, amount: o.amount, y, m });
  };
  // Editor de Compartidos: desde la fila de la lista o abierto directo.
  const uiEditShared = (d, id, ch, opt = {}) => d.ev(async ({ id, ch, opt }) => {
    if (opt.viaRow) {
      const g = _sharedBinGastos.find(x => x.id === id) || S.gastos.find(x => x.id === id);
      if (!g) return { err: 'no está' };
      const f = new Date(g.addedAt); setGastosMonth(f.getMonth(), f.getFullYear()); goTo('compartidos'); renderCompartidos();
      const row = [...document.querySelectorAll('#compartidos-list .sh-grow')].find(r => (r.getAttribute('onclick') || '').includes(`'${id}'`));
      if (!row) return { err: 'sin fila en Compartidos' };
      row.click();
    } else openEditSharedGasto({ id });
    if (!$('ov-edit-shared').classList.contains('open')) return { err: 'el editor no abrió' };
    if (ch.desc != null) $('esg-desc').value = ch.desc;
    if (ch.txt != null) $('esg-amt').value = ch.txt;
    if (ch.cat) { const c = document.querySelector(`#esg-cats .chip[data-v="${ch.cat}"]`); if (!c) return { err: 'sin chip ' + ch.cat }; c.click(); }
    if (ch.paidBy) $('esg-pb-' + ch.paidBy).click();
    if (ch.split === 50) $('esg-split-50').click();
    if (ch.solo) $('esg-split-solo-' + ch.solo).click();
    if (opt.keepOpen) return { open: true };
    document.querySelector('#ov-edit-shared .btnp').click();
    return { open: $('ov-edit-shared').classList.contains('open') };
  }, { id, ch, opt });
  // Eliminar desde el ⋯ de la fila en Compartidos, con la confirmación.
  const uiDelShared = (d, id) => d.ev(async (id) => {
    const g = _sharedBinGastos.find(x => x.id === id) || S.gastos.find(x => x.id === id);
    if (!g) return { err: 'no está' };
    const f = new Date(g.addedAt); setGastosMonth(f.getMonth(), f.getFullYear()); goTo('compartidos'); renderCompartidos();
    const row = [...document.querySelectorAll('#compartidos-list .sh-grow')].find(r => (r.getAttribute('onclick') || '').includes(`'${id}'`));
    if (!row) return { err: 'sin fila' };
    row.querySelector('.rmore').click();
    const b = [...row.querySelectorAll('.rmenu button')].find(x => /Eliminar/.test(x.textContent));
    b.click();
    await new Promise(r => setTimeout(r, 30));
    $('confirm-ok').click();
    await new Promise(r => setTimeout(r, 30));
    return { ok: true };
  }, id);
  // "Registrar pago" (Liquidar): devuelve lo que el modal propuso.
  const uiPago = (d, o) => d.ev(async (o) => {
    goTo('compartidos');
    renderCompartidos();
    const liq = document.querySelector('#compartidos-list .sh-btn-liq');
    if (liq) liq.click(); else openSharedPaymentModal();
    const pre = { amt: $('sp-amount').value, payer: _spPayer };
    if (o.payer) $('sp-payer-' + o.payer).click();
    if (o.txt != null) $('sp-amount').value = o.txt;
    if (o.desc) $('sp-desc').value = o.desc;
    $('sp-date').value = o.date;
    const n0 = getSharedPayments().length;
    $('sp-save-btn').click();
    await new Promise(r => setTimeout(r, 30));
    const ps = getSharedPayments();
    const p = ps.length > n0 ? ps[ps.length - 1] : null;
    return { pre, id: p && p.id, amount: p && p.amount, paidBy: p && p.paidBy, date: p && p.date };
  }, o);
  const uiEditPago = (d, id, txt) => d.ev(({ id, txt }) => { openEditSharedPayment(id); $('sp-amount').value = txt; $('sp-save-btn').click(); return !$('ov-shared-payment').classList.contains('open'); }, { id, txt });
  const uiDelPago = (d, id, y, m) => d.ev(async ({ id, y, m }) => {
    setGastosMonth(m, y); goTo('compartidos'); renderCompartidos();
    const row = [...document.querySelectorAll('#compartidos-list .sh-grow')].find(r => r.innerHTML.includes(`deleteSharedPayment('${id}')`));
    if (!row) return { err: 'sin fila de la transferencia' };
    row.querySelector('.rmore').click();
    [...row.querySelectorAll('.rmenu button')].find(x => /Eliminar/.test(x.textContent)).click();
    await new Promise(r => setTimeout(r, 30));
    $('confirm-ok').click();
    await new Promise(r => setTimeout(r, 30));
    return { ok: true };
  }, { id, y, m });

  // ── Estado de cada teléfono (lo que ve la app, no la cuenta) ──────────────
  const estado = (d) => d.ev(() => {
    const mios = S.gastos.filter(g => g.shared && g.shared.active);
    const enBin = new Set(_sharedBinGastos.map(g => g.id));
    const todos = [..._sharedBinGastos.filter(g => g.shared && g.shared.active), ...mios.filter(g => !enBin.has(g.id))];
    const fecha = ts => { const f = new Date(ts); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`; };
    const items = todos.map(g => ({ id: g.id, amount: g.amount, desc: g.desc, cat: g.cat, paidBy: g.shared.paidBy, split: g.shared.splitPct ?? 50, date: fecha(g.addedAt) }))
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    // La copia local (la que usa Gastos) tiene que decir lo mismo que el bin.
    const localDiff = mios.filter(g => { const b = _sharedBinGastos.find(x => x.id === g.id); return b && (b.amount !== g.amount || b.desc !== g.desc || b.cat !== g.cat || b.shared.paidBy !== g.shared.paidBy || (b.shared.splitPct ?? 50) !== (g.shared.splitPct ?? 50)); }).map(g => g.id);
    const det = calcSharedDebtDetail();
    const pays = _allKnownPayments().map(p => ({ id: p.id, paidBy: p.paidBy, amount: p.amount, date: String(p.date || '').slice(0, 10) })).sort((a, b) => (a.id < b.id ? -1 : 1));
    const ids = _sharedBinGastos.map(g => g.id);
    return { items, pays, saldo: det.saldo, pend: sharedPendientes().total, localDiff, dupIds: ids.length - new Set(ids).size };
  });
  const campos = (d, id) => d.ev((id) => {
    const g = _sharedBinGastos.find(x => x.id === id && x.shared && x.shared.active) || S.gastos.find(x => x.id === id && x.shared && x.shared.active);
    return g ? { desc: g.desc, amount: g.amount, cat: g.cat, paidBy: g.shared.paidBy, split: g.shared.splitPct ?? 50 } : null;
  }, id);
  const modelItems = () => [...MG.values()].map(it => ({ id: it.id, amount: it.amount, desc: it.desc, cat: it.cat, paidBy: it.paidBy, split: it.split, date: it.date })).sort((a, b) => (a.id < b.id ? -1 : 1));
  const modelPays = () => [...MP.values()].map(p => ({ id: p.id, paidBy: p.paidBy, amount: p.amount, date: p.date })).sort((a, b) => (a.id < b.id ? -1 : 1));
  // Diferencias legibles entre dos listas por id (máximo 6).
  const difs = (a, b, na = 'A', nb = 'B') => {
    const out = []; const ma = new Map(a.map(x => [x.id, x])), mb = new Map(b.map(x => [x.id, x]));
    for (const [id, x] of ma) {
      const y = mb.get(id);
      if (!y) { out.push(`${id} (${x.desc || ''} ${x.amount}) solo en ${na}`); continue; }
      for (const k of Object.keys(x)) if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) out.push(`${id} ${x.desc || ''}: ${k} ${JSON.stringify(x[k])} en ${na} vs ${JSON.stringify(y[k])} en ${nb}`);
    }
    for (const [id, y] of mb) if (!ma.has(id)) out.push(`${id} (${y.desc || ''} ${y.amount}) solo en ${nb}`);
    return out.slice(0, 6);
  };
  // Si los dos teléfonos coinciden entre sí pero no con la cuenta, la cuenta
  // adopta lo de los teléfonos (después de informarlo una vez) para que un
  // hallazgo no se arrastre como falla en todos los meses siguientes.
  const adoptar = (ef, em) => {
    if (difs(ef.items, em.items).length) return false;
    const prev = new Map(MG); MG.clear();
    for (const x of ef.items) MG.set(x.id, { ...x, owner: (prev.get(x.id) || {}).owner || '?' });
    if (!difs(ef.pays, em.pays).length) { MP.clear(); for (const p of ef.pays) MP.set(p.id, { ...p }); }
    return true;
  };
  const adoptarItem = async (id) => {
    const a = await campos(fede, id), b = await campos(mile, id);
    if (JSON.stringify(a) !== JSON.stringify(b)) return;
    if (!a) MG.delete(id); else if (MG.has(id)) Object.assign(MG.get(id), a);
  };

  // Pantalla Compartidos + Estadísticas del mes, leídas del DOM.
  const leerComp = (d, y, m) => d.ev(async ({ y, m }) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const num = s => { const t = String(s || '').replace(/[^\d-]/g, ''); return t === '' ? NaN : Number(t); };
    setGastosMonth(m, y); goTo('compartidos'); await sleep(40); renderCompartidos();
    const list = $('compartidos-list');
    const lbl = (list.querySelector('.sh-debt-lbl') || {}).textContent || '';
    const val = list.querySelector('.sh-debt-val'), okEl = list.querySelector('.sh-debt-ok');
    const tot = list.querySelector('.sh-cat-total');
    const out = {
      lbl, ok: !!okEl, debt: okEl ? 0 : (val ? num(val.textContent) : NaN),
      cardTotal: tot ? num(tot.textContent) : 0,
      pendBadge: (list.querySelector('.sh-pend') || {}).textContent || '',
      syncLbl: ((document.getElementById('shared-sync-btn') || {}).textContent || '').trim(),
      rows: list.querySelectorAll('.sh-grow').length,
      fotos: [...list.querySelectorAll('.sh-grow .who-ava')].map(e => e.tagName + ':' + (e.dataset.who || '')),
      text: list.innerText || list.textContent,
    };
    openSharedMonthDetail();
    const st = document.getElementById('shared-stats');
    out.statsAbre = !!st;
    out.filas = st ? [...st.querySelectorAll('.sh-mcat')].map(r => ({
      cat: ((r.getAttribute('onclick') || '').match(/openSharedCatDetail\('([^']+)'\)/) || [])[1] || 'otros',
      label: r.querySelector('.u-name').textContent.trim(),
      total: num(r.querySelector('.sh-st-amt-v').textContent),
      n: parseInt(r.querySelector('.sh-sub').textContent, 10),
    })) : [];
    out.ctr = st && st.querySelector('.sh-st-ctr-v') ? num(st.querySelector('.sh-st-ctr-v').textContent) : 0;
    out.statsText = st ? (st.innerText || st.textContent) : '';
    out.statsVacio = st ? !!st.querySelector('.sh-empty') : null;
    cerrarSharedStats();
    return out;
  }, { y, m });
  const leerTotalGastos = (d, y, m) => d.ev(async ({ y, m }) => {
    setGastosMonth(m, y); goTo('gastos'); renderGastos();
    await new Promise(r => setTimeout(r, 850));   // el total del donut se anima 650 ms
    const t = String($('dval').textContent).replace(/[^\d-]/g, '');
    return t === '' ? NaN : Number(t);
  }, { y, m });
  const BASURA = /\bNaN\b|\bundefined\b|Infinity|\[object \w+\]|\bnull\b/;
  const lineasBasura = txt => String(txt).split('\n').filter(l => BASURA.test(l)).map(l => l.trim().slice(0, 80)).slice(0, 4);

  // ── Comprobación de fin de mes ──────────────────────────────────────────
  const errIdx = { fede: 0, mile: 0 };
  const verificar = async (etq, y, m, { pantallas = true } = {}) => {
    await settle(fede); await settle(mile);
    await syncAll(); await sync(mile);
    const [ef, em] = await Promise.all([estado(fede), estado(mile)]);
    const dTel = difs(ef.items, em.items, 'Fede', 'Mile');
    eq(dTel, [], `${etq}: los dos teléfonos tienen los mismos ${ef.items.length} gastos compartidos (id, importe, detalle, categoría, quién pagó, reparto, fecha)`);
    eq(difs(ef.items, modelItems(), 'Fede', 'la cuenta'), [], `${etq}: y son los ${MG.size} de la cuenta independiente`);
    if (DEBUG) for (const x of difs(ef.items, modelItems())) {
      const id = x.split(' ')[0];
      const binRec = ((L.bins[BIN] || {}).gastos || []).find(g => g && g.id === id);
      for (const d of devs) dbg(d.name, id, JSON.stringify(await d.ev((id) => ({ bin: _sharedBinGastos.find(g => g.id === id), local: S.gastos.find(g => g.id === id), tomb: (S._gTombs || {})[id], now: Date.now() }), id)));
      dbg('bin', id, JSON.stringify(binRec), 'tomb', ((L.bins[BIN] || {}).tombstones || {})[id]);
    }
    eq(difs(ef.pays, em.pays, 'Fede', 'Mile'), [], `${etq}: las mismas ${ef.pays.length} transferencias en los dos`);
    eq(difs(ef.pays, modelPays(), 'Fede', 'la cuenta'), [], `${etq}: y son las de la cuenta`);
    eq([ef.dupIds, em.dupIds], [0, 0], `${etq}: sin ids repetidos en la copia del bin`);
    const sF = saldoModel('fede');
    is(Math.abs(ef.saldo - sF) < 0.01, `${etq}: deuda en el teléfono de Fede = cuenta (${sF > 0 ? 'Mile le debe' : 'le debe a Mile'} ${fmt(sF)}; app ${ef.saldo})`);
    is(Math.abs(em.saldo + sF) < 0.01, `${etq}: deuda en el de Mile = la misma, del otro lado (app ${em.saldo})`);
    is(Math.abs(ef.saldo + em.saldo) < 0.01, `${etq}: los dos ven la misma deuda con signo opuesto`);
    eq([ef.pend, em.pend], [0, 0], `${etq}: contador de "sin subir" en 0 en los dos tras sincronizar`);
    eq([ef.localDiff, em.localDiff], [[], []], `${etq}: la copia local de cada gasto propio (la que suma Gastos) dice lo mismo que el bin`);
    if (pantallas) {
      const [cf, cm] = await Promise.all([leerComp(fede, y, m), leerComp(mile, y, m)]);
      const its = itemsDelMes(y, m), pgs = pagosDelMes(y, m);
      const lblF = Math.abs(sF) < 1 ? /Sin deuda/ : sF > 0 ? /Mile te debe/ : /Le debés a Mile/;
      const lblM = Math.abs(sF) < 1 ? /Sin deuda/ : sF > 0 ? /Le debés a Fede/ : /Fede te debe/;
      is(lblF.test(cf.lbl) && cerca(cf.debt, Math.abs(sF) < 1 ? 0 : Math.abs(sF)), `${etq}: Fede ve "${cf.lbl} ${cf.ok ? 'Al día' : fmt(cf.debt)}" (cuenta: ${fmt(sF)})`);
      is(lblM.test(cm.lbl) && cerca(cm.debt, Math.abs(sF) < 1 ? 0 : Math.abs(sF)), `${etq}: Mile ve "${cm.lbl} ${cm.ok ? 'Al día' : fmt(cm.debt)}"`);
      eq([cf.rows, cm.rows], [its.length + pgs.length, its.length + pgs.length], `${etq}: la lista del mes tiene ${its.length} gastos + ${pgs.length} transferencias en los dos`);
      eq([cf.pendBadge, cm.pendBadge, /\(\d+\)/.test(cf.syncLbl + cm.syncLbl)], ['', '', false], `${etq}: sin globito de pendientes ni "Sincronizar (N)"`);
      // Estadísticas: total del mes, cada categoría (solo 50/50) y "Otros repartos".
      const total = its.reduce((s, it) => s + it.amount, 0);
      const porCat = {};
      for (const it of its) { const k = it.split === 50 ? it.cat : 'otros'; (porCat[k] = porCat[k] || { total: 0, n: 0 }).total += it.amount; porCat[k].n++; }
      for (const [nom, c] of [['Fede', cf], ['Mile', cm]]) {
        is(c.statsAbre, `${etq}: ${nom} abre Estadísticas tocando el total`);
        is(cerca(c.ctr, total) && cerca(c.cardTotal, total), `${etq}: Estadísticas de ${nom}: total del mes ${fmt(c.ctr)} (tarjeta ${fmt(c.cardTotal)}) = cuenta ${fmt(total)}`);
        const mal = [];
        const vistas = new Map(c.filas.map(f => [f.cat, f]));
        for (const [k, v] of Object.entries(porCat)) {
          const f = vistas.get(k);
          if (!f) mal.push(`falta ${k}`); else if (!cerca(f.total, v.total) || f.n !== v.n) mal.push(`${k}: ${f.total}/${f.n} vs ${v.total}/${v.n}`);
        }
        for (const k of vistas.keys()) if (!porCat[k]) mal.push(`sobra ${k}`);
        eq(mal, [], `${etq}: Estadísticas de ${nom}: cada categoría (${Object.keys(porCat).length}) con su importe y cantidad`);
        eq([...lineasBasura(c.text), ...lineasBasura(c.statsText)], [], `${etq}: sin NaN/undefined/Infinity en Compartidos ni en Estadísticas de ${nom}`);
      }
      // Gastos de cada uno: lo propio + su parte de cada compartido del mes.
      const [gF, gM] = await Promise.all([leerTotalGastos(fede, y, m), leerTotalGastos(mile, y, m)]);
      const espF = MOWN.filter(o => o.who === 'fede' && o.y === y && o.m === m).reduce((s, o) => s + Math.round(o.amount), 0) + its.reduce((s, it) => s + parte(it, 'fede'), 0);
      const espM = MOWN.filter(o => o.who === 'mile' && o.y === y && o.m === m).reduce((s, o) => s + Math.round(o.amount), 0) + its.reduce((s, it) => s + parte(it, 'mile'), 0);
      eq([gF, gM], [espF, espM], `${etq}: Gastos de cada uno (propios + su parte de los compartidos) = cuenta`);
    }
    const raw = JSON.stringify(L.bins[BIN] || {});
    const kb = Buffer.byteLength(raw) / 1024, gz = zlib.gzipSync(raw).length / 1024;
    is(kb < 85, `${etq}: el bin pesa ${kb.toFixed(1)} kb tal como viaja (${gz.toFixed(1)} kb en gzip), lejos de los 100 de JSONBin`);
    for (const d of devs) {
      eq(d.errors.slice(errIdx[d.name]), [], `${etq}: ningún error de JS en el teléfono de ${d.name === 'fede' ? 'Fede' : 'Mile'}`);
      errIdx[d.name] = d.errors.length;
    }
    if (altasRechazadas.length) { eq(altasRechazadas, [], `${etq}: todas las altas por el modal entraron`); altasRechazadas = []; }
    if (dTel.length === 0 && (difs(ef.items, modelItems()).length || difs(ef.pays, modelPays()).length)) {
      adoptar(ef, em);
      console.log('   · (la cuenta adopta lo que muestran los dos teléfonos para no arrastrar la diferencia)');
    }
    return { ef, em, sF };
  };

  // ── Elección de gastos para editar/borrar ────────────────────────────────
  const usados = new Set();
  const elegir = (k, filtro = () => true) => {
    const { y, m } = mesK(k);
    const c = itemsDelMes(y, m).filter(it => !usados.has(it.id) && !/^(Expensas|Heladera|Pasajes)/.test(it.desc) && filtro(it));
    const it = c.length ? c[Math.floor(R() * c.length)] : null;
    if (it) usados.add(it.id);
    return it;
  };
  const conflictoCheck = async (etq, id, esperado) => {
    await syncAll(); await sync(mile); await sync(fede);
    const a = await campos(fede, id), b = await campos(mile, id);
    eq(a, b, `${etq}: los dos teléfonos terminan con el mismo dato`);
    if (esperado !== undefined) eq(a, esperado, `${etq}: ${esperado === null ? 'queda borrado' : 'queda ' + JSON.stringify(esperado)}`);
    const [ef, em] = await Promise.all([estado(fede), estado(mile)]);
    is(Math.abs(ef.saldo + em.saldo) < 0.01, `${etq}: y la deuda es la misma en los dos (Fede ${ef.saldo} / Mile ${em.saldo})`);
    await adoptarItem(id);
    return a;
  };
  const exp = (it) => ({ desc: it.desc, amount: it.amount, cat: it.cat, paidBy: it.paidBy, split: it.split });

  // ═════════════════════════════════════════════════════════════════════════
  const DIAS = [2, 6, 10, 14, 18, 22, 26];
  let catMasc = null, catBebe = null, expensasId = null;
  let undoInfo = [];
  const cuotasPlan = [];   // {who, name, fee, txt, ct, k0, d}
  const fotoDe = (d, color) => d.ev((color) => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 64, 64); return c.toDataURL('image/jpeg', .8); }, color);
  let fotos = {};

  for (let k = 0; k < KMAX; k++) {
    const { y, m } = mesK(k);
    section(`MES ${k + 1}/12 · ${MESES[m]} ${y}`);
    for (const d of DIAS) {
      await setClock(at(k, d, 9, 0));
      const fecha = ds(y, m, d);

      // ── Lo de una sola vez ──
      if (k === 0 && d === 2) {
        // Categorías propias, fotos, el vencimiento compartido de la Agenda.
        catMasc = await fede.ev(() => { openAddCatModal('gcats'); $('newcat-name').value = 'Mascotas'; saveNewCat(); return (Object.entries(loadCustomCats()).find(([, c]) => /Mascotas/.test(c.label)) || [])[0] || null; });
        is(!!catMasc, 'Fede crea la categoría propia "Mascotas" por el modal');
        fotos.fede = await fotoDe(fede, '#0ea5e9'); fotos.mile = await fotoDe(mile, '#f472b6');
        await fede.ev((img) => _guardarFoto('fede', img), fotos.fede);
        await mile.ev((img) => _guardarFoto('mile', img), fotos.mile);
        expensasId = await fede.ev((f) => {
          openAgendaModal('venc');
          $('ag-name').value = 'Expensas'; $('ag-amount').value = '95.000'; $('ag-date').value = f;
          $('ag-shared-toggle').click(); $('ag-paidby-fede').click();
          document.querySelector('#ag-shared-fields [data-split="50"]').click();
          $('ag-save-btn').click();
          const v = S.agenda.vencimientos.find(x => x.name === 'Expensas');
          return v && v.shared && v.shared.active ? v.id : null;
        }, ds(y, m, 10));
        is(!!expensasId, 'Fede carga en la Agenda el vencimiento compartido "Expensas" ($95.000, mensual, 50/50)');
        await settle(fede); await settle(mile);
      }
      if (k === 3 && d === 2) {
        catBebe = await mile.ev(() => { openAddCatModal('gcats'); $('newcat-name').value = 'Bebé'; saveNewCat(); return (Object.entries(loadCustomCats()).find(([, c]) => /Beb/.test(c.label)) || [])[0] || null; });
        is(!!catBebe, 'Mile crea la categoría propia "Bebé"');
      }

      // ── Altas del día ── (algunos días cada uno en lo suyo, otros al mismo tiempo)
      const cats = [...CATS_BASE, ...(catMasc ? [catMasc] : []), ...(catBebe ? [catBebe] : [])];
      const altasDe = (who) => {
        const n = entre(1, 2) + (d === 26 && R() < 0.5 ? 1 : 0);
        const out = [];
        for (let i = 0; i < n; i++) {
          const cat = pick(cats);
          const base = DESCS[cat] ? pick(DESCS[cat]) : (cat === catMasc ? pick(['Veterinaria', 'Alimento perro']) : pick(['Pañales', 'Pediatra']));
          const mo = monto();
          const r = R();
          const o = { desc: base, cat, ...mo, date: ds(y, m, Math.max(1, d - (R() < 0.2 ? entre(1, 3) : 0))) };
          if (r < 0.12) o.paidBy = other(who);                 // carga lo que pagó la pareja
          const s = R();
          if (s < 0.14) o.solo = who; else if (s < 0.26) o.solo = other(who);
          out.push(o);
        }
        return out;
      };
      const lf = altasDe('fede'), lm = altasDe('mile');
      if (d % 4 === 2 && d !== 2) {
        // A la par: los dos cargan al mismo tiempo, antes de que ninguno sincronice.
        const corre = async (who, lista) => { for (const o of lista) await altaComp(who, o); };
        await Promise.all([corre('fede', lf), corre('mile', lm)]);
      } else {
        for (let i = 0; i < Math.max(lf.length, lm.length); i++) {
          if (lf[i]) await altaComp('fede', lf[i]);
          if (lm[i]) await altaComp('mile', lm[i]);
        }
      }
      // Gastos propios (no compartidos), un par por mes cada uno.
      if (d === 6 || d === 18) {
        for (const who of ['fede', 'mile']) { const mo = monto(); await altaPropia(who, { desc: pick(['Almuerzo', 'Kiosco', 'Corte de pelo', 'Libro']), cat: pick(['comida', 'varios', 'compras']), ...mo, date: fecha }); }
      }

      // ── Agenda: el vencimiento compartido de cada mes, el día 10 ──
      if (d === 10 && expensasId) {
        const paidBy = k % 3 === 2 ? 'mile' : 'fede';
        const soloF = k === 5;
        const r = await fede.ev(async ({ paidBy, soloF }) => {
          const v = S.agenda.vencimientos.find(x => x.name === 'Expensas');
          if (!v) return { err: 'no está en la Agenda' };
          markVencPaid(v.id);
          await new Promise(r => setTimeout(r, 30));
          if ($('pay-shared-fields').classList.contains('hidden')) return { err: 'el modal de pago no ofrece compartirlo' };
          $('pay-paidby-' + paidBy).click();
          document.querySelector(`#pay-split-presets [data-split="${soloF ? 'solo-fede' : '50'}"]`).click();
          const n0 = S.gastos.length;
          document.querySelector('#pay-acct-list button').click();
          await new Promise(r => setTimeout(r, 30));
          const g = S.gastos.length > n0 ? S.gastos[S.gastos.length - 1] : null;
          const f = g && new Date(g.addedAt);
          return g ? { id: g.id, amount: g.amount, cat: g.cat, sh: g.shared, date: `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`, next: v.date } : { err: 'no registró el gasto' };
        }, { paidBy, soloF });
        const split = soloF ? (paidBy === 'fede' ? 100 : 0) : 50;
        if (r.id) {
          eq([r.amount, r.sh && r.sh.active, r.sh && r.sh.paidBy, r.sh && r.sh.splitPct, r.date], [95000, true, paidBy, split, fecha], `Agenda: pagar "Expensas" crea el gasto compartido del día (pagó ${paidBy}, ${split === 50 ? '50/50' : 'solo Fede'})`);
          MG.set(r.id, { id: r.id, desc: 'Expensas', amount: 95000, cat: r.cat, paidBy, split, date: fecha, owner: 'fede' });
        } else bad('Agenda: pagar Expensas', r);
      }
      // ── Compras compartidas en cuotas, pagadas mes a mes desde la Agenda ──
      if (k === 1 && d === 10) {
        const id = await altaComp('fede', { desc: 'Heladera', cat: 'tarjeta', amount: 85000.5, txt: '85.000,50', date: fecha, ct: 6, ca: 1 });
        cuotasPlan.push({ who: 'fede', name: 'Heladera', fee: 85000.5, ct: 6, k0: k, d, paidBy: 'fede', split: 50 });
        is(!!id, 'Fede compra una heladera compartida en 6 cuotas de $85.000,50');
      }
      if (k === 5 && d === 14) {
        const id = await altaComp('mile', { desc: 'Pasajes', cat: 'tarjeta', amount: 120000, txt: '120000', date: fecha, ct: 3, ca: 1 });
        cuotasPlan.push({ who: 'mile', name: 'Pasajes', fee: 120000, ct: 3, k0: k, d, paidBy: 'mile', split: 50 });
        is(!!id, 'Mile compra pasajes compartidos en 3 cuotas de $120.000');
      }
      for (const c of cuotasPlan) {
        const n = k - c.k0 + 1;
        if (n < 2 || n > c.ct || d !== c.d) continue;
        const r = await dev(c.who).ev(async (name) => {
          const cq = S.agenda.cuotas.find(x => x.name === name);
          if (!cq) return { err: 'la compra no está en la Agenda' };
          markCuotaPaid(cq.id);
          const n0 = S.gastos.length;
          document.querySelector('#pay-acct-list button').click();
          await new Promise(r => setTimeout(r, 30));
          const g = S.gastos.length > n0 ? S.gastos[S.gastos.length - 1] : null;
          const f = g && new Date(g.addedAt);
          return g ? { id: g.id, n: g.cuotaActual, amount: g.amount, cat: g.cat, sh: !!(g.shared && g.shared.active), paidBy: g.shared && g.shared.paidBy, split: g.shared && g.shared.splitPct, date: `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}` } : { err: 'no registró la cuota' };
        }, c.name);
        eq(r.err ? r : [r.n, r.amount, r.sh, r.paidBy, r.split, r.date], [n, c.fee, true, c.paidBy, c.split, fecha], `Agenda: la cuota ${n}/${c.ct} de "${c.name}" se paga y sigue compartida, en el mes que vence`);
        if (r.id) MG.set(r.id, { id: r.id, desc: c.name, amount: c.fee, cat: 'tarjeta', paidBy: c.paidBy, split: r.split ?? c.split, date: r.date, owner: c.who });
      }

      // ── Correcciones de la pareja (quien no lo cargó) ──
      if (d === 14 || d === 22) {
        for (const editor of ['fede', 'mile']) {
          await sync(dev(editor));   // abre la app y ve lo último antes de corregir
          const vis = new Set((await estado(dev(editor))).items.map(x => x.id));   // solo puede corregir lo que ve
          const it = elegir(k, x => x.owner === other(editor) && vis.has(x.id));
          if (!it) continue;
          const tipo = pick(['amount', 'desc', 'cat', 'split', 'paidBy']);
          const ch = {};
          if (tipo === 'amount') { const mo = monto(); ch.amount = mo.amount; ch.txt = mo.txt; }
          if (tipo === 'desc') ch.desc = it.desc + ' (corregido)';
          if (tipo === 'cat') ch.cat = pick(CATS_BASE.filter(c => c !== it.cat));
          if (tipo === 'split') { if (it.split === 50) ch.solo = pick(['fede', 'mile']); else ch.split = 50; }
          if (tipo === 'paidBy') ch.paidBy = other(it.paidBy);
          const r = await uiEditShared(dev(editor), it.id, ch, { viaRow: R() < 0.6 });
          dbg(editor, 'corrige', it.id, it.desc, JSON.stringify(ch), JSON.stringify(r), 'ts', await dev(editor).ev((id) => { const g = _sharedBinGastos.find(x => x.id === id); return [g && g.updatedAt, g && g.amount, Date.now()]; }, it.id));
          if (r.err || r.open) { bad(`${editor} corrige ${it.desc} (${it.id})`, r, 'guardado'); continue; }
          aplicarCambio(it, ch);
        }
      }
      // ── Un borrado por mes desde el ⋯ de Compartidos ──
      if (d === 18) {
        const quien = pick(['fede', 'mile']);
        await sync(dev(quien));
        const vis = new Set((await estado(dev(quien))).items.map(x => x.id));
        const it = elegir(k, x => vis.has(x.id));
        if (it) {
          const r = await uiDelShared(dev(quien), it.id);
          dbg(quien, 'borra', it.id, it.desc, JSON.stringify(r));
          if (r.ok) MG.delete(it.id); else bad(`${quien} borra ${it.desc} (${it.id})`, r, 'borrado');
        }
      }

      // ═══ Escenarios ═══
      // (a) Los dos corrigen campos DISTINTOS del mismo gasto antes de sincronizar.
      if ((k === 1 || k === 9) && d === 14) {
        await syncAll();
        const it = elegir(k, x => x.owner === 'fede' && x.split === 50);
        const mo = monto();
        const nuevaDesc = it.desc + ' (Fede)';
        await Promise.all([
          uiEditShared(fede, it.id, { desc: nuevaDesc }),
          uiEditShared(mile, it.id, { txt: mo.txt }),
        ]);
        await settle(fede); await settle(mile);
        aplicarCambio(it, { desc: nuevaDesc, amount: mo.amount });
        await conflictoCheck(`[campos-distintos] mes ${k + 1}: Fede corrige el detalle y Mile el importe al mismo tiempo → quedan las dos correcciones`, it.id, exp(it));
      }
      if (k === 5 && d === 6) {
        // Variante con un teléfono sin señal: Mile cambia la categoría sin conexión, Fede el reparto con conexión.
        await syncAll();
        const it = elegir(k, x => x.owner === 'mile' && x.split === 50);
        const nuevaCat = pick(CATS_BASE.filter(c => c !== it.cat));
        await offline(mile, true);
        await uiEditShared(mile, it.id, { cat: nuevaCat }); await settle(mile);
        await advance(2 * MIN);
        await uiEditShared(fede, it.id, { solo: 'fede' }); await settle(fede);
        await offline(mile, false); await mile.page.waitForTimeout(400); await settle(mile);
        aplicarCambio(it, { cat: nuevaCat, solo: 'fede' });
        await conflictoCheck('[campos-distintos] Mile cambia la categoría sin señal, Fede el reparto con señal → quedan las dos', it.id, exp(it));
      }
      // (b) Los dos corrigen el MISMO campo: gana la corrección posterior.
      if (k === 2 && d === 6) {
        for (const [primero, segundo] of [['fede', 'mile'], ['mile', 'fede']]) {
          await syncAll();
          const it = elegir(k, x => x.split === 50);
          const a1 = monto(), a2 = monto();
          await offline(dev(primero), true);
          await uiEditShared(dev(primero), it.id, { txt: a1.txt }); await settle(dev(primero));
          await advance(2 * MIN);
          await uiEditShared(dev(segundo), it.id, { txt: a2.txt }); await settle(dev(segundo));
          await offline(dev(primero), false); await dev(primero).page.waitForTimeout(400); await settle(dev(primero));
          aplicarCambio(it, { amount: a2.amount });
          await conflictoCheck(`[mismo-campo] ${primero} corrige el importe sin señal, 2 min después ${segundo} lo corrige con señal → gana el de ${segundo}`, it.id, exp(it));
        }
      }
      if (k === 10 && d === 10) {
        // Al mismo tiempo con conexión, el de Mile medio minuto después.
        await syncAll();
        const it = elegir(k, x => x.split === 50);
        const a1 = monto(), a2 = monto();
        await uiEditShared(fede, it.id, { txt: a1.txt });
        await advance(30 * 1000);
        await uiEditShared(mile, it.id, { txt: a2.txt });
        await settle(fede); await settle(mile);
        aplicarCambio(it, { amount: a2.amount });
        await conflictoCheck('[mismo-campo] los dos corrigen el importe casi a la vez (Mile 30 s después) → gana el de Mile', it.id, exp(it));
      }
      // (c) Uno borra mientras el otro corrige.
      if (k === 3 && d === 6) {
        await syncAll();
        const it = elegir(k, x => x.owner === 'fede');
        const mo = monto();
        await offline(mile, true);
        await uiEditShared(mile, it.id, { txt: mo.txt }); await settle(mile);
        await advance(2 * MIN);
        await uiDelShared(fede, it.id); await settle(fede);
        await offline(mile, false); await mile.page.waitForTimeout(400); await settle(mile);
        MG.delete(it.id);
        await conflictoCheck('[borrar-vs-editar] Mile corrige sin señal y 2 min después Fede lo borra → queda borrado en los dos', it.id, null);
      }
      if (k === 3 && d === 14) {
        await syncAll();
        const it = elegir(k, x => x.owner === 'fede');
        const mo = monto();
        await offline(fede, true);
        await uiDelShared(fede, it.id); await settle(fede);
        const pendBorrado = await fede.ev(() => sharedPendientes().total);
        console.log(`   · (dato) Fede borró sin señal: el contador de "sin subir" marca ${pendBorrado}`);
        await advance(2 * MIN);
        await uiEditShared(mile, it.id, { txt: mo.txt }); await settle(mile);
        await offline(fede, false); await fede.page.waitForTimeout(400); await settle(fede);
        await autoTick(fede);
        aplicarCambio(it, { amount: mo.amount });
        const fin = await conflictoCheck('[borrar-vs-editar] Fede lo borra sin señal y 2 min después Mile lo corrige → gana la corrección (posterior) en los dos', it.id, exp(it));
        if (fin) {
          const enGastos = await fede.ev((id) => S.gastos.some(g => g.id === id), it.id);
          // El total de Gastos del mes lo compara verificar() al cierre (Gastos lo suma desde la copia del bin).
          console.log(`   · (dato) el gasto revivido ${enGastos ? 'volvió' : 'no volvió'} a S.gastos de Fede: ${enGastos ? '' : 'en Gastos figura como de la pareja (solo lectura) aunque lo cargó él'}`);
        }
      }
      if (k === 9 && d === 22) {
        await syncAll();
        const it = elegir(k);
        const mo = monto();
        await Promise.all([uiDelShared(fede, it.id), uiEditShared(mile, it.id, { txt: mo.txt })]);
        await settle(fede); await settle(mile);
        const a = await conflictoCheck('[borrar-vs-editar] al mismo tiempo, los dos con señal: el resultado es uno solo', it.id);
        console.log(`   · borrar y corregir a la vez: ${a ? 'queda corregido ($' + a.amount + ')' : 'queda borrado'}`);
      }
      // (d) Teléfono con el reloj corrido 5 minutos.
      if ((k === 4 || k === 6) && d === 10) {
        const off = k === 4 ? 5 * MIN : -5 * MIN;
        const sg = off > 0 ? '+5' : '−5';
        await syncAll();
        skew.mile = off; await advance(MIN);
        // d1: los dos corrigen el importe al mismo tiempo
        {
          const it = elegir(k, x => x.split === 50);
          const a1 = monto(), a2 = monto();
          await Promise.all([uiEditShared(fede, it.id, { txt: a1.txt }), uiEditShared(mile, it.id, { txt: a2.txt })]);
          await settle(fede); await settle(mile);
          const a = await conflictoCheck(`[reloj ${sg} min] corrección simultánea del importe`, it.id);
          console.log(`   · con el reloj de Mile ${sg} min, la simultánea la gana ${a && a.amount === a1.amount ? 'Fede' : a && a.amount === a2.amount ? 'Mile' : '?'}`);
        }
        // d2: Mile corrige, sincronizan, y Fede corrige después: gana Fede
        {
          const it = elegir(k, x => x.split === 50);
          const a1 = monto(), a2 = monto();
          await uiEditShared(mile, it.id, { txt: a1.txt }); await settle(mile); await syncAll();
          await advance(MIN);
          await uiEditShared(fede, it.id, { txt: a2.txt }); await settle(fede);
          aplicarCambio(it, { amount: a2.amount });
          await conflictoCheck(`[reloj ${sg} min] Mile corrige, sincronizan y Fede corrige después → gana Fede`, it.id, exp(it));
        }
        // d3: Fede corrige, sincronizan y Mile corrige después: gana Mile
        {
          const it = elegir(k, x => x.split === 50);
          const a1 = monto(), a2 = monto();
          await uiEditShared(fede, it.id, { txt: a1.txt }); await settle(fede); await syncAll();
          await advance(MIN);
          await uiEditShared(mile, it.id, { txt: a2.txt }); await settle(mile);
          aplicarCambio(it, { amount: a2.amount });
          await conflictoCheck(`[reloj ${sg} min] Fede corrige, sincronizan y Mile corrige después → gana Mile`, it.id, exp(it));
        }
        // d4: uno corrige, sincronizan, el otro borra → queda borrado (en los dos sentidos)
        for (const [ed, br] of [['fede', 'mile'], ['mile', 'fede']]) {
          const it = elegir(k);
          const a1 = monto();
          await uiEditShared(dev(ed), it.id, { txt: a1.txt }); await settle(dev(ed)); await syncAll();
          await advance(MIN);
          await uiDelShared(dev(br), it.id); await settle(dev(br));
          MG.delete(it.id);
          await conflictoCheck(`[reloj ${sg} min] ${ed} corrige, sincronizan y ${br} lo borra → queda borrado`, it.id, null);
        }
        // d5: altas de los dos con el reloj corrido, y borrar simultáneo con corrección
        {
          const it = elegir(k);
          const a1 = monto();
          await Promise.all([uiDelShared(fede, it.id), uiEditShared(mile, it.id, { txt: a1.txt })]);
          await settle(fede); await settle(mile);
          await conflictoCheck(`[reloj ${sg} min] Fede borra mientras Mile corrige, a la vez`, it.id);
        }
        skew.mile = 0; await advance(10 * MIN);
      }
      // (e) Correcciones sin señal y reconexión: el contador vuelve a 0 solo.
      if ((k === 2 && d === 14) || (k === 7 && d === 14)) {
        await syncAll();
        const ajeno = elegir(k, x => x.owner === 'fede');
        const propio = elegir(k, x => x.owner === 'mile');
        await offline(mile, true);
        await mile.clearToasts();
        const mo1 = monto();
        await uiEditShared(mile, ajeno.id, { txt: mo1.txt }); aplicarCambio(ajeno, { amount: mo1.amount });
        await uiEditShared(mile, propio.id, { desc: propio.desc + ' (sin señal)' }); aplicarCambio(propio, { desc: propio.desc + ' (sin señal)' });
        for (let i = 0; i < 2; i++) { const mo = monto(); await altaComp('mile', { desc: 'Sin señal ' + (i + 1), cat: pick(CATS_BASE), ...mo, date: fecha }); }
        const pg = await uiPago(mile, { payer: 'mile', txt: '1500', date: fecha, desc: 'Transferencia sin señal' });
        if (pg.id) MP.set(pg.id, { id: pg.id, paidBy: 'mile', amount: 1500, date: fecha });
        await settle(mile);
        const pend = await mile.ev(() => sharedPendientes().total);
        eq(pend, 5, `[sin-señal] mes ${k + 1}: Mile sin conexión corrige un gasto de Fede, uno suyo, carga 2 y registra una transferencia → 5 "sin subir"`);
        const avisos = (await mile.toasts()).filter(t => /No se pudo|Sin conexión|sin conexión|no se pudo/.test(t));
        is(avisos.length <= 2, `[sin-señal] y no se le enciman carteles de error (salieron ${avisos.length})`);
        if (k === 7) {
          // Una semana sin señal: sigue cargando cuatro días después.
          await advance(4 * 24 * 60 * MIN);
          const mo = monto(); await altaComp('mile', { desc: 'Sin señal 3', cat: pick(CATS_BASE), ...mo, date: ds(y, m, 18) });
          eq(await mile.ev(() => sharedPendientes().total), 6, '[sin-señal] cuatro días después sigue sin señal: 6 sin subir');
        }
        await offline(mile, false);
        await mile.page.waitForTimeout(600); await settle(mile);
        eq(await mile.ev(() => sharedPendientes().total), 0, `[sin-señal] al volver la señal se sube todo solo (sin tocar Sincronizar): contador en 0`);
        await syncAll();
        const a = await campos(fede, ajeno.id), b = await campos(fede, propio.id);
        eq([a && a.amount, b && b.desc], [ajeno.amount, propio.desc], '[sin-señal] y a Fede le llegan las dos correcciones');
      }
      // Corregir un gasto de la pareja mientras el teléfono todavía está subiendo otra cosa.
      if (k === 8 && d === 14) {
        await syncAll();
        const it = elegir(k, x => x.owner === 'mile' && x.split === 50);
        await fede.ev(() => { window.__holdPut = true; });
        const mo = monto();
        await altaComp('fede', { desc: 'Kiosco', cat: 'comida', ...mo, date: fecha });
        await fede.page.waitForFunction(() => (window.__held || []).length > 0, null, { timeout: 5000 });
        const mo2 = monto();
        const r = await uiEditShared(fede, it.id, { txt: mo2.txt });
        const enMemoria = await campos(fede, it.id);
        await fede.ev(() => { window.__holdPut = false; (window.__held || []).splice(0).forEach(r => r()); });
        await settle(fede);
        const pend = await fede.ev(() => sharedPendientes().total);
        console.log(`   · guardado con el PUT del alta en vuelo: ${JSON.stringify(r)}, en memoria ${enMemoria && enMemoria.amount}; al terminar el PUT, ${((await campos(fede, it.id)) || {}).amount} y ${pend} sin subir`);
        aplicarCambio(it, { amount: mo2.amount });
        await conflictoCheck('[edición-en-vuelo] Fede corrige el importe de un gasto de Mile mientras su teléfono todavía está subiendo un alta → la corrección no se pierde', it.id, exp(it));
      }
      // (f) Editor abierto mientras la pareja corrige: guardar solo el detalle no pisa el importe.
      if ((k === 1 || k === 10) && d === 22) {
        await syncAll();
        const it = elegir(k, x => x.split === 50);
        await uiEditShared(fede, it.id, {}, { keepOpen: true, viaRow: true });
        const mo = monto();
        const ch = k === 1 ? { txt: mo.txt } : { solo: 'mile' };
        await uiEditShared(mile, it.id, ch); await settle(mile);
        await sync(fede);
        await fede.ev(() => { $('esg-desc').value = $('esg-desc').value + ' ✎'; document.querySelector('#ov-edit-shared .btnp').click(); });
        await settle(fede);
        aplicarCambio(it, k === 1 ? { amount: mo.amount, desc: it.desc + ' ✎' } : { solo: 'mile', desc: it.desc + ' ✎' });
        await conflictoCheck(`[editor-abierto] Fede deja el editor abierto, Mile cambia ${k === 1 ? 'el importe' : 'el reparto'}, Fede guarda solo el detalle → queda lo de Mile y el detalle de Fede`, it.id, exp(it));
      }
      // Deshacer un borrado (Gastos → ⋯ → Eliminar → Deshacer), con red lenta.
      if ((k === 2 || k === 7) && d === 26) {
        await syncAll();
        const mo = monto();
        const id = await altaComp('fede', { desc: 'Para deshacer', cat: 'super', ...mo, date: fecha });
        await settle(fede); await syncAll();
        await red(fede, { delay: 250 });
        const espera = k === 2 ? 1800 : 120;   // la persona toca "Deshacer" a los 1,8 s (k=2) o enseguida (k=7)
        const r = await fede.ev(async ({ id, espera }) => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          const g = S.gastos.find(x => x.id === id);
          setGastosMonth(g.month, g.year); goTo('gastos'); renderGastos(); await sleep(120);
          const row = document.querySelector(`#gastos-list .gasto-row[data-id="${id}"]`);
          if (!row) return { err: 'sin fila en Gastos' };
          row.querySelector('.rmore').click(); await sleep(20);
          [...row.querySelectorAll('.rmenu button')].find(b => /Eliminar/.test(b.textContent)).click();
          await sleep(20); $('confirm-ok').click();
          await sleep(espera);
          const u = document.querySelector('.toast-undo');
          const visible = !!u && u.style.display !== 'none' && $('toast-bar').classList.contains('show');
          const msg = $('toast-msg').textContent;
          if (visible) u.click();
          return { visible, msg };
        }, { id, espera });
        await red(fede, { delay: 0 });
        await settle(fede); await syncAll(); await sync(mile);
        const vuelve = [await campos(fede, id), await campos(mile, id)];
        undoInfo.push({ k, ...r });
        is(r.visible, `[deshacer] mes ${k + 1}: ${espera} ms después de borrar un compartido en Gastos el cartel sigue ofreciendo "Deshacer" (dice "${r.msg}")`);
        if (r.visible) {
          is(!!vuelve[0] && !!vuelve[1], `[deshacer] y al tocarlo el gasto vuelve en los dos teléfonos`);
          if (!(vuelve[0] && vuelve[1])) MG.delete(id);
        } else MG.delete(id);
      }

      // ── Liquidaciones ──
      if (d === 22 && [2, 4, 6, 8, 11].includes(k)) {
        await syncAll();
        const s = saldoModel('fede');
        const deudor = s > 0 ? 'mile' : 'fede';
        const tipo = { 2: 'parcial', 4: 'total', 6: 'pasarse', 8: 'parcial', 11: 'total' }[k];
        const quien = k === 8 ? other(deudor) : deudor;   // a veces la carga el que recibe
        const exacto = Math.round(Math.abs(s) * 100) / 100;
        const montoP = tipo === 'total' ? null : tipo === 'parcial' ? Math.round(Math.abs(s) * 0.4) : Math.round(Math.abs(s)) + 25000;
        const r = await uiPago(dev(quien), { payer: deudor, txt: montoP == null ? null : String(montoP), date: fecha });
        if (quien === deudor) eq([Number(r.pre.amt), r.pre.payer], [exacto, deudor], `Liquidar (${quien}): el modal propone la deuda exacta (${fmt(exacto)}) y como pagador a quien debe`);
        if (r.id) MP.set(r.id, { id: r.id, paidBy: deudor, amount: montoP == null ? exacto : montoP, date: fecha }); else bad('Liquidar', r);
        await settle(dev(quien));
        console.log(`   · liquidación ${tipo}: ${deudor} transfiere ${fmt(montoP == null ? exacto : montoP)} (deuda ${fmt(s)})`);
        if (tipo === 'pasarse') { await syncAll(); is(Math.sign(saldoModel('fede')) === -Math.sign(s), 'pasarse: la deuda cambia de lado'); }
      }
      if (k === 3 && d === 22) {
        // Corregir desde el otro teléfono la transferencia del mes pasado
        const p = [...MP.values()].find(x => x.desc !== 'x' && x.amount > 2000);
        if (p) { const nuevo = Math.round(p.amount * 0.9); await uiEditPago(p.paidBy === 'fede' ? mile : fede, p.id, String(nuevo)); p.amount = nuevo; await settle(fede); await settle(mile); }
      }
      if (k === 9 && d === 26) {
        // Borrar una transferencia desde el ⋯ de su fila
        const p = [...MP.values()].filter(x => ymOf(x.date).y === mesK(8).y && ymOf(x.date).m === mesK(8).m)[0];
        if (p) { const o = ymOf(p.date); const r = await uiDelPago(mile, p.id, o.y, o.m); if (r.ok) MP.delete(p.id); else bad('borrar transferencia', r); await settle(mile); }
      }

      // ── Red: el bin no deja escribir un día, o no deja leer ──
      if (k === 5 && d === 18) {
        await settle(fede); await settle(mile); await syncAll();
        L.net.putFail = true;
        const mo = monto(), mo2 = monto();
        await altaComp('fede', { desc: 'Con el bin caído', cat: 'super', ...mo, date: fecha });
        await altaComp('mile', { desc: 'También caído', cat: 'comida', ...mo2, date: fecha });
        await settle(fede); await settle(mile);
        await autoTick(fede); await autoTick(mile);
        eq([await fede.ev(() => sharedPendientes().total), await mile.ev(() => sharedPendientes().total)], [1, 1], 'JSONBin no acepta escrituras: cada uno queda con su gasto "sin subir" (el reintento automático no lo da por subido)');
        L.net.putFail = false;
      }
      if (k === 9 && d === 6) {
        await settle(fede); await settle(mile); await syncAll();
        L.net.getFail = true;
        const mo = monto();
        await altaComp('mile', { desc: 'Sin lectura', cat: 'varios', ...mo, date: fecha });
        await settle(mile); await autoTick(mile);
        eq(await mile.ev(() => sharedPendientes().total), 1, 'JSONBin no deja leer: el gasto queda pendiente y el bin no se pisa');
        L.net.getFail = false;
      }

      // ── Backup en el teléfono de Mile ──
      if (k === 8 && d === 26) {
        // Dos vueltas: con una sola, lo que el otro teléfono subió en esa misma
        // vuelta todavía no llegó a este y la foto de "antes" quedaba corta.
        await syncAll(); await syncAll(); await mile.page.waitForTimeout(400);
        const antes = await estado(mile);
        const [dl] = await Promise.all([mile.page.waitForEvent('download', { timeout: 8000 }), mile.ev(() => exportBackup())]);
        const bk = path.join(tmpDir, 'mile-backup.json');
        await dl.saveAs(bk);
        await mile.ev(() => localStorage.clear());
        await mile.page.reload(); await waitApp(mile); await mile.page.clock.setSystemTime(new Date(simNow)); await prep(mile);
        await mile.page.locator('input[type=file][accept=".json"]').setInputFiles(bk);
        await mile.page.waitForTimeout(500);
        await mile.page.locator('#confirm-ok').click({ force: true }).catch(() => mile.ev(() => confirmResolve(true)));
        await mile.page.waitForTimeout(2200);
        await waitApp(mile); await mile.page.clock.setSystemTime(new Date(simNow)); await prep(mile);
        const cfg = await mile.ev(() => ({ yo: localStorage.getItem('fin_my_name'), bin: localStorage.getItem('fin_comp_bin_id') }));
        eq(cfg, { yo: 'mile', bin: BIN }, 'Backup: tras importarlo, el teléfono sigue siendo de Mile y con el mismo bin compartido');
        // La clave del bin no viaja en el archivo (a propósito): se vuelve a cargar en Ajustes.
        await mile.ev(() => { $('comp-bin-id').value = localStorage.getItem('fin_comp_bin_id'); $('comp-api-key').value = 'k'; saveCompBinConfig(); });
        await settle(mile); await prep(mile); await sync(mile);
        const desp = await estado(mile);
        eq(difs(desp.items, antes.items, 'después', 'antes'), [], 'Backup: los gastos compartidos son los mismos que antes de exportar');
        eq(difs(desp.pays, antes.pays, 'después', 'antes'), [], 'Backup: y las transferencias');
        is(Math.abs(desp.saldo - antes.saldo) < 0.01 && desp.pend === 0, `Backup: misma deuda (${desp.saldo}) y nada sin subir (${desp.pend})`);
        eq(await mile.ev(() => [!!getFoto('fede'), !!getFoto('mile'), (CATS[Object.keys(loadCustomCats()).find(k => /Beb/.test(loadCustomCats()[k].label))] || {}).label || null]), [true, true, 'Bebé'], 'Backup: las fotos vuelven del bin y la categoría propia del archivo');
      }

      // ── Sincronización periódica, como el timer de la app ──
      if (d % 4 === 2) { await autoTick(fede); await autoTick(mile); }
      else if (R() < 0.5) await autoTick(pick(devs));
    }

    // Fin de mes: todo sincronizado y comparado contra la cuenta.
    await setClock(at(k, 28, 21, 0));
    await verificar(`${MESES[m].slice(0, 3)} ${y}`, y, m);
  }

  // ═══ Cierre del año ═════════════════════════════════════════════════════
  section('AÑO COMPLETO · Estadísticas de los 12 meses en los dos teléfonos');
  {
    const malF = [], malM = [];
    for (let k = 0; k < 12; k++) {
      const { y, m } = mesK(k);
      const its = itemsDelMes(y, m);
      const total = its.reduce((s, it) => s + it.amount, 0);
      const [cf, cm] = await Promise.all([leerComp(fede, y, m), leerComp(mile, y, m)]);
      if (!cerca(cf.ctr, total)) malF.push(`${MESES[m]}: ${cf.ctr} vs ${total}`);
      if (!cerca(cm.ctr, total)) malM.push(`${MESES[m]}: ${cm.ctr} vs ${total}`);
    }
    eq(malF, [], 'al final del año, el total de Estadísticas de cada mes sigue igual a la cuenta en el teléfono de Fede');
    eq(malM, [], 'y en el de Mile');
    const nIt = MG.size, nPg = MP.size;
    console.log(`   · ${nIt} gastos compartidos vivos, ${nPg} transferencias, deuda final ${fmt(saldoModel('fede'))} (${saldoModel('fede') > 0 ? 'Mile le debe a Fede' : 'Fede le debe a Mile'})`);
    is(nIt >= 12 * 15, `entre 15 y 30 compartidos por mes (${nIt} en el año)`);
  }
  section('AÑO COMPLETO · categorías propias y fotos en los dos teléfonos');
  {
    const v = await Promise.all(devs.map(d => d.ev(({ a, b }) => [(CATS[a] || {}).label, (CATS[b] || {}).label], { a: catMasc, b: catBebe })));
    eq(v, [['Mascotas', 'Bebé'], ['Mascotas', 'Bebé']], 'las categorías propias de cada uno se ven con su nombre en el teléfono del otro');
    const f = await Promise.all(devs.map(d => d.ev(() => [getFoto('fede'), getFoto('mile')])));
    eq(f.map(x => [x[0] === fotos.fede, x[1] === fotos.mile]), [[true, true], [true, true]], 'cada teléfono tiene la foto de los dos');
    const { y, m } = mesK(11);
    const c = await leerComp(fede, y, m);
    is(c.fotos.length > 0 && c.fotos.every(x => x.startsWith('IMG:')), `en la lista, cada fila lleva la foto de quién pagó (${c.fotos.length} filas)`);
  }
  section('AÑO COMPLETO · tercera vuelta sin cambios y errores');
  {
    await syncAll();
    const put0 = L.stats.put;
    await syncAll(); await syncAll();
    eq(L.stats.put - put0, 0, 'dos vueltas más de sincronización sin cambios no escriben el bin');
    eq(fede.errors, [], 'ningún pageerror/console.error en el teléfono de Fede en todo el año');
    eq(mile.errors, [], 'ninguno en el de Mile');
  }

  const seg = ((Date.now() - T_START) / 1000).toFixed(0);
  console.log(`\nRequests al bin: ${L.stats.get} GET + ${L.stats.put} PUT · ${seg} s`);
  console.log(`\n${'─'.repeat(52)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  await browser.close();
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error('ERROR:', e); process.exit(2); });
