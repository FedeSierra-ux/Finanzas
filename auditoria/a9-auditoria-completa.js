// AUDITORÍA 9 — lo que salió de la auditoría completa de la v32.3.
//
// Cada bloque fija un defecto encontrado y arreglado, en contexto iPhone:
//  1. Agenda: cerrar una edición sin guardar dejaba el modal "pegado" en modo
//     edición; el alta siguiente pisaba el ítem editado o no guardaba nada
//     (con toast de "guardado"). Cambiar el tipo mientras se editaba perdía
//     el cambio.
//  2. Cuotas: una compra del 29/30/31 ponía la próxima cuota en el mes
//     siguiente al que correspondía (31/08 → 01/10).
//  3. La pila de abajo: con el aviso de instalar visible (en iPhone aparece
//     solo a los 3 s), la última fila de cada sección quedaba debajo del ＋.
//  4. Los menús: flecha "‹" y título en el mismo renglón en todos, con la
//     manija arriba y sin pisar el borde de la hoja.
//  5. Tema claro: los toasts y el panel de Mercado Pago quedaban con texto
//     oscuro sobre fondo oscuro.
//  6. Almacenamiento: las copias diarias de gastos no se rehacen en cada
//     guardado y, si el espacio se llena, se sacrifican antes que los datos.
const L = require('./lib');
const { eq, is, section } = L;
const IPHONE = {
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
};

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const now = new Date(), M = now.getMonth(), Y = now.getFullYear();
  const gastos = Array.from({ length: 30 }, (_, i) => ({ id: 'g' + i, desc: 'Gasto ' + i, cat: 'comida', amount: 1000 * (i + 1),
    month: M, year: Y, day: 1 + (i % 27), addedAt: new Date(Y, M, 1 + (i % 27), 12).getTime(),
    ...(i % 4 === 0 ? { shared: { active: true, paidBy: i % 8 ? 'mile' : 'fede', splitPct: 50 } } : {}) }));
  const d = await L.device(browser, {
    myName: 'fede', compBin: 'bin9', contexto: IPHONE,
    seed: {
      gastos,
      agenda: {
        subs: [{ id: 's1', name: 'Netflix', amount: 12000, date: '2026-10-25', period: 'mensual' }],
        vencimientos: [{ id: 'v1', name: 'Patente', amount: 45000, date: '2026-10-20', period: 'unica' }],
        cuotas: [{ id: 'c1', name: 'Heladera', fee: 58000, total: 6, paid: 1, nextDueDate: '2026-10-15', startDate: '2026-09-01' }],
        inversiones: [],
      },
    },
  });
  const P = d.page;
  await P.waitForTimeout(400);

  // ════ 1. AGENDA ═════════════════════════════════════════════════════
  section('Agenda · cerrar una edición sin guardar no deja el modal pegado');
  let r = await d.ev(() => {
    goTo('agenda'); editAgenda('sub', 's1'); closeOv('ov-agenda');
    openAgendaModal('venc');
    const titulo = document.querySelector('#ov-agenda .mtitle').textContent;
    const boton = document.getElementById('ag-save-btn').textContent;
    document.getElementById('ag-name').value = 'Luz'; document.getElementById('ag-amount').value = '30000';
    doSaveAgenda();
    return { titulo, boton, netflix: S.agenda.subs.find(s => s.id === 's1').amount, luz: S.agenda.vencimientos.some(v => v.name === 'Luz') };
  });
  eq(r.titulo, 'Nuevo vencimiento', 'el alta dice "Nuevo vencimiento", no "Editar suscripción"');
  eq(r.boton, 'Guardar', 'y el botón vuelve a "Guardar"');
  is(r.luz, 'el vencimiento nuevo se guarda');
  eq(r.netflix, 12000, 'y la suscripción que se estaba editando queda intacta');

  r = await d.ev(() => {
    editAgenda('cuota', 'c1'); closeOv('ov-edit-cuota');
    openAgendaModal('venc');
    document.getElementById('ag-name').value = 'Gas'; document.getElementById('ag-amount').value = '9000';
    doSaveAgenda();
    return S.agenda.vencimientos.some(v => v.name === 'Gas');
  });
  is(r, 'después de cancelar la edición de una cuota, el alta también guarda');

  r = await d.ev(() => {
    openAgendaModal('sub');
    const t1 = document.querySelector('#ov-agenda .mtitle').textContent;
    switchAgendaType('venc');
    const t2 = document.querySelector('#ov-agenda .mtitle').textContent;
    closeOv('ov-agenda');
    return [t1, t2];
  });
  eq(r, ['Nueva suscripción', 'Nuevo vencimiento'], 'el título sigue al tipo elegido');

  r = await d.ev(() => {
    editAgenda('venc', 'v1'); switchAgendaType('sub');
    document.getElementById('ag-amount').value = '50000';
    doSaveAgenda();
    return { enVencs: S.agenda.vencimientos.some(v => v.id === 'v1'), sub: S.agenda.subs.find(s => s.id === 'v1') };
  });
  is(!r.enVencs && r.sub && r.sub.amount === 50000, 'editar un vencimiento y pasarlo a suscripción lo mueve con el cambio');

  // ════ 2. CUOTAS DEL 31 ══════════════════════════════════════════════
  section('Cuotas · una compra del 31 no se saltea el mes siguiente');
  r = await d.ev(() => {
    const g = { id: 'q1', desc: 'Tele', cat: 'tarjeta', amount: 50000, month: 7, year: 2026, day: 31,
      addedAt: new Date(2026, 7, 31, 12).getTime(), cuotaActual: 1, cuotaTotal: 6 };
    S.gastos.push(g); syncGastoCuotaToAgenda(g);
    return (S.agenda.cuotas.find(c => c.name === 'Tele') || {}).nextDueDate;
  });
  eq(r, '2026-09-30', 'compra del 31/08 → próxima cuota el 30/09');

  // ════ 3. PILA DE ABAJO ══════════════════════════════════════════════
  section('Con el aviso de instalar visible, la última fila se puede sacar de abajo del ＋');
  for (const pg of ['saldos', 'gastos', 'compartidos', 'agenda']) {
    r = await d.ev(async (pg) => {
      goTo(pg); setInstallBannerShown(true);
      await new Promise(res => setTimeout(res, 350));
      document.documentElement.style.scrollBehavior = 'auto';
      scrollTo(0, 1e7); await new Promise(res => setTimeout(res, 250));
      const fab = document.getElementById('fab').getBoundingClientRect();
      const els = [...document.querySelectorAll(`#pg-${pg} button, #pg-${pg} [onclick]`)].filter(e => e.getBoundingClientRect().height);
      const ultimo = Math.max(...els.map(e => e.getBoundingClientRect().bottom));
      setInstallBannerShown(false); scrollTo(0, 0); document.documentElement.style.scrollBehavior = '';
      return { ultimo: Math.round(ultimo), fab: Math.round(fab.top) };
    }, pg);
    is(r.ultimo <= r.fab, `${pg}: el último botón (${r.ultimo}) queda arriba del ＋ (${r.fab})`);
  }

  // ════ 4. CABECERA DE LOS MENÚS ══════════════════════════════════════
  section('Menús · flecha y título en el mismo renglón, manija sin pisar el borde');
  const ids = await d.ev(() => [...document.querySelectorAll('.overlay')].filter(o => o.querySelector(':scope>.modal>.ov-back')).map(o => o.id));
  const mal = [];
  for (const id of ids) {
    await d.ev(i => { document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open')); document.getElementById(i).classList.add('open'); }, id);
    await P.waitForTimeout(360);
    const m = await d.ev(i => {
      const modal = document.querySelector(`#${i}>.modal`);
      const back = modal.querySelector(':scope>.ov-back').getBoundingClientRect();
      const tit = modal.querySelector(':scope>.mtitle, :scope>.mbar');
      const h = modal.querySelector(':scope>.mhandle');
      const mr = modal.getBoundingClientRect();
      if (!tit) return modal.querySelector('.modal-body .mtitle, .modal-body > .mbar') ? { tituloEnElScroll: true } : { sinTitulo: true };
      const t = tit.getBoundingClientRect();
      const texto = document.createRange(); texto.selectNodeContents(tit.querySelector('span') || tit);
      const tr = texto.getBoundingClientRect();
      return {
        mismaFila: Math.abs((back.top + back.bottom) / 2 - (t.top + t.bottom) / 2) <= 3,
        textoLibre: tr.left >= back.right - 6,
        manija: h ? Math.round(h.getBoundingClientRect().top - mr.top) : null,
        fueraDelScroll: !modal.querySelector('.modal-body .mtitle, .modal-body > .mbar'),
      };
    }, id);
    if (m.sinTitulo) continue;
    if (m.tituloEnElScroll) { mal.push({ id, tituloEnElScroll: true }); continue; }
    if (!m.mismaFila || !m.textoLibre || (m.manija !== null && m.manija < 4) || !m.fueraDelScroll) mal.push({ id, ...m });
  }
  await d.ev(() => document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open')));
  is(ids.length >= 15, `se revisaron ${ids.length} menús`);
  eq(mal, [], 'en todos, la flecha y el título comparten renglón, el título no scrollea y la manija no toca el borde');

  // ════ 5. TEMA CLARO ═════════════════════════════════════════════════
  section('Tema claro · los avisos y el panel de Mercado Pago se leen');
  const lum = c => { const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]); };
  const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
  await d.ev(() => { document.documentElement.setAttribute('data-theme', 'light'); });
  for (const tipo of ['success', 'warning', 'error', 'info']) {
    const c = await d.ev(t => {
      showToast('Prueba de contraste', t);
      const bar = document.getElementById('toast-bar');
      const cs = getComputedStyle(bar);
      const bg = cs.backgroundImage !== 'none' ? (cs.backgroundImage.match(/rgba?\([^)]*\)/) || [cs.backgroundColor])[0] : cs.backgroundColor;
      return { bg, fg: getComputedStyle(document.getElementById('toast-msg')).color };
    }, tipo);
    const k = contraste(c.bg, c.fg);
    is(k >= 4.5, `toast ${tipo}: contraste ${k.toFixed(1)}:1 (mínimo 4.5)`);
  }
  const mp = await d.ev(() => {
    const ov = document.getElementById('ov-mp-import'); ov.classList.add('open');
    const panel = ov.querySelector('.modal-panel');
    const r = { bg: getComputedStyle(panel).backgroundColor, bgImg: getComputedStyle(panel).backgroundImage, fg: getComputedStyle(panel.querySelector('.modal-hdr div')).color };
    ov.classList.remove('open');
    return r;
  });
  is(mp.bgImg === 'none' && contraste(mp.bg, mp.fg) >= 4.5, `el panel de Mercado Pago usa el fondo claro (${mp.bg})`);

  // ════ 6. ALMACENAMIENTO ═════════════════════════════════════════════
  section('Almacenamiento · copias diarias agrupadas y los datos antes que las copias');
  r = await d.ev(async () => {
    _flushAutoBackupGastos(); await new Promise(res => setTimeout(res, 50));
    let escrituras = 0;
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === 'fin_gastos_bak') escrituras++; return orig.call(this, k, v); };
    for (let i = 0; i < 10; i++) { S.gastos[0].amount++; save(); await new Promise(res => setTimeout(res, 220)); }
    Storage.prototype.setItem = orig;
    return escrituras;
  });
  is(r <= 1, `diez guardados seguidos reescriben la copia diaria ${r} vez/veces (antes: 10)`);
  r = await d.ev(() => {
    const snap = { date: '2026-01-01', ts: 1, gastos: S.gastos, payments: [] };
    localStorage.setItem('fin_gastos_bak', JSON.stringify([snap, snap, snap]));
    // Simular el disco lleno: fin_v6 no entra mientras haya más de una copia.
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'fin_v6' && JSON.parse(localStorage.getItem('fin_gastos_bak') || '[]').length > 1) {
        const e = new Error('lleno'); e.name = 'QuotaExceededError'; throw e;
      }
      return orig.call(this, k, v);
    };
    try { persistJsonStorage('fin_v6', S); } finally { Storage.prototype.setItem = orig; }
    return { guardado: JSON.parse(localStorage.getItem('fin_v6')).gastos.length === S.gastos.length,
             copias: JSON.parse(localStorage.getItem('fin_gastos_bak') || '[]').length };
  });
  is(r.guardado, 'con el almacenamiento lleno, el guardado principal entra igual');
  eq(r.copias, 1, 'porque se descartan las copias viejas (queda la de hoy)');

  section('Sin errores');
  eq(d.errors, [], 'ningún error de página');

  console.log('\n' + '─'.repeat(52));
  console.log(`${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  await browser.close();
  process.exit(L.results.fail ? 1 : 0);
})();
