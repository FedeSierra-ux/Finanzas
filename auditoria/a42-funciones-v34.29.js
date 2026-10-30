// Las cuatro funciones de la v34.29 que el usuario aprobó del preview:
//   63  Tarjetas y Agenda: "faltan 9 cuotas · termina junio de 2027"
//   77  "Se repite todos los meses" en el alta de gasto (crea la suscripción)
//   59  "guardado en noviembre · Ver" cuando el gasto cae en otro mes
//   80  los avisos no pisan un "Deshacer" y se pueden deshacer varias bajas
// En un iPhone con el teclado simulado (como a24). Con la v34.28 casi todo
// termina en ✗.
const L = require('./lib');
const { ok, eq, is, section } = L;

const iphone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' };
const tecladoFalso = () => {
  const ls = {}; const vv = { height: window.innerHeight || 844, width: 390, offsetTop: 0, offsetLeft: 0, scale: 1,
    addEventListener: (t, f) => { (ls[t] = ls[t] || []).push(f); }, removeEventListener() {} };
  Object.defineProperty(window, 'visualViewport', { get: () => vv, configurable: true });
  window.__teclado = h => { vv.height = window.innerHeight - h; (ls.resize || []).forEach(f => f()); };
};

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const errores = [];
  const cuenta = { id: 'galicia', name: 'Galicia', type: 'bancaria', amount: 5000000, currency: 'ARS' };

  // Un iPhone nuevo con el reloj en `t0` (15/10/2026 por defecto).
  const fresh = async (seed = { accounts: [cuenta] }, t0 = new Date(2026, 9, 15, 12)) => {
    const d = await L.device(browser, { myName: 'fede', compBin: null, seed, contexto: iphone, initScript: tecladoFalso });
    await d.page.waitForTimeout(300);
    const waitApp = async () => {
      await d.page.waitForFunction(() => typeof S === 'object' && S !== null && typeof save === 'function');
      await d.page.waitForTimeout(300);
      await d.ev(() => { clearInterval(_sharedAutoTimer); clearInterval(_tcAutoTimer); window.__toasts = []; const st = window.showToast; window.showToast = (m, a, b, c) => { window.__toasts.push(String(m)); return st(m, a, b, c); }; });
    };
    await d.ev(() => localStorage.removeItem('fin_last_open'));
    await d.page.clock.install({ time: t0 });
    await d.page.reload(); await waitApp();
    const setClock = async t => { await d.page.clock.setSystemTime(t); await d.ev(() => localStorage.removeItem('fin_last_open')); await d.page.reload(); await waitApp(); };
    return { d, P: d.page, ev: d.ev, setClock, fin: async () => { errores.push(...d.errors); await d.close(); } };
  };
  const toastVisible = ev => ev(() => ({ show: $('toast-bar').classList.contains('show'), msg: $('toast-msg').textContent.replace(/\u00a0/g, ' '),
    undo: $('toast-bar').querySelector('.toast-undo').style.display !== 'none', ver: !!$('toast-ver') && $('toast-ver').style.display !== 'none' }));
  // Alta por la pantalla, como una persona (con el teclado abierto).
  const alta = async (x, o) => {
    await x.ev(() => { _gSaving = false; goTo('gastos'); openGastoModal(); });
    await x.P.waitForTimeout(400);
    await x.P.focus('#gdesc'); await x.P.keyboard.type(o.desc);
    await x.ev(() => window.__teclado(336));
    await x.ev(o => { $('gamt').value = String(o.amt); $('g-date-inp').value = o.date; if (o.cat) document.querySelector(`#ov-gasto .chip[data-v="${o.cat}"]`).click(); }, o);
    if (o.repite) await x.P.locator('#g-rep-toggle').tap();
    await x.ev(() => document.querySelector('#ov-gasto .btnp').click());
    await x.P.waitForTimeout(250);
    await x.ev(() => window.__teclado(0));
  };
  const pagar = (ev, kind, name) => ev(async ({ kind, name }) => {
    const it = (kind === 'sub' ? S.agenda.subs : S.agenda.vencimientos).find(x => x.name === name);
    if (kind === 'sub') markSubPaid(it.id); else markVencPaid(it.id);
    await new Promise(r => setTimeout(r, 40));
    document.querySelector('#pay-acct-list button').click();
    await new Promise(r => setTimeout(r, 40));
  }, { kind, name });

  // ═══ 63 ═══════════════════════════════════════════════════════════════════
  section('63 · Tarjetas y Agenda: "faltan 9 cuotas · termina junio de 2027"');
  {
    const x = await fresh({ accounts: [cuenta], agenda: { subs: [], vencimientos: [], inversiones: [], cuotas: [
      { id: 'c1', name: 'Notebook', fee: 10000, total: 12, paid: 3, startDate: '2026-08-01', nextDueDate: '2026-10-20', dueDay: 20 },
      { id: 'c2', name: 'Heladera', fee: 20000, total: 6, paid: 5, startDate: '2026-05-01', nextDueDate: '2026-10-25', dueDay: 25 },
      { id: 'c3', name: 'Sillon', fee: 5000, total: 12, paid: 3, paidSkip: [12], startDate: '2026-08-01', nextDueDate: '2026-10-22', dueDay: 22 } ] } });
    const r = await x.ev(() => {
      const lbl = n => cuotaFinLbl(S.agenda.cuotas.find(c => c.name === n));
      goTo('agenda'); switchAgendaTab('tarjetas'); renderTarjetasResumen();
      const filas = [...document.querySelectorAll('.tj-det-row')].map(r => ({ n: r.querySelector('.tj-name').textContent.trim(), t: r.textContent.replace(/\s+/g, ' ').trim(), cap: r.querySelector('.u-cap').textContent.replace(/\s+/g, ' ').trim() }));
      switchAgendaTab('lista'); renderAgenda();
      const lista = [...document.querySelectorAll('#agenda-content .tl-row[data-type="cuota"]')].map(r => r.querySelector('.tl-row-sb').textContent.replace(/\s+/g, ' ').trim());
      return { filas, lista, lbl: { Notebook: lbl('Notebook'), Heladera: lbl('Heladera'), Sillon: lbl('Sillon') } };
    });
    const fila = n => r.filas.find(f => f.n === n);
    is(fila('Notebook').cap.includes(`faltan 9 cuotas · termina ${r.lbl.Notebook}`) && /junio de 2027/.test(r.lbl.Notebook), `Tarjetas, Notebook: "faltan 9 cuotas · termina ${r.lbl.Notebook}" (${fila('Notebook').cap})`);
    is(/cuota 4 de 12/.test(fila('Notebook').t) && /10\.000/.test(fila('Notebook').cap), 'sigue diciendo el importe y "cuota 4 de 12"');
    is(fila('Sillon').cap.includes(`faltan 8 cuotas · termina ${r.lbl.Sillon}`) && r.lbl.Sillon !== r.lbl.Notebook, `con la cuota 12 pagada por adelantado: faltan 8 y termina antes (${fila('Sillon').cap})`);
    is(fila('Heladera').cap.includes(`falta 1 cuota · termina ${r.lbl.Heladera}`), `una sola: "falta 1 cuota" (${fila('Heladera').cap})`);
    is(!r.filas.some(f => /\brest\b/.test(f.t)), 'en ningún lado dice "rest"');
    is(r.lista.some(t => t.includes(`faltan 9 cuotas · termina ${r.lbl.Notebook}`)) && r.lista.some(t => t.includes(`faltan 8 cuotas · termina ${r.lbl.Sillon}`)), `la lista de la Agenda dice lo mismo (${r.lista.join(' | ')})`);
    is(r.lista.some(t => /cuota 4 de 12/.test(t)), 'y conserva "cuota 4 de 12"');
    await x.fin();
  }

  // ═══ 77 ═══════════════════════════════════════════════════════════════════
  section('77 · "Se repite todos los meses" en el alta de gasto');
  {
    const x = await fresh();
    const ui = await x.ev(() => { openGastoModal(); const t = $('g-rep-toggle'); return { hay: !!t, on: t && t.getAttribute('aria-pressed'), oculto: !!t && !!t.closest('.hidden') && true }; });
    is(ui.hay && ui.on === 'false' && !ui.oculto, 'el interruptor está en el alta y arranca desmarcado');
    const tarj = await x.ev(() => { document.querySelector('#ov-gasto .chip[data-v="tarjeta"]').click(); const s = $('g-rep-toggle').closest('#g-rep-section'); const o = s.classList.contains('hidden'); document.querySelector('#ov-gasto .chip[data-v="comida"]').click(); return { oculto: o, vuelve: !s.classList.contains('hidden') }; });
    eq(tarj, { oculto: true, vuelve: true }, 'con la categoría Tarjeta (cuotas) se esconde');
    await x.ev(() => closeOv('ov-gasto'));

    // Desmarcado: nada cambia
    await alta(x, { desc: 'Almuerzo', amt: 4000, date: '2026-10-15' });
    eq(await x.ev(() => ({ g: S.gastos.length, subs: S.agenda.subs.length, plan: S.plan.length })), { g: 1, subs: 0, plan: 0 }, 'sin marcar: un gasto y nada en Agenda ni Plan');

    // Marcado
    await alta(x, { desc: 'Netflix', amt: 5000, date: '2026-10-15', cat: 'suscripciones', repite: true });
    const r = await x.ev(() => { const s = S.agenda.subs.find(s => s.name === 'Netflix'); const p = S.plan.find(p => p.name === 'Netflix');
      return { gastos: S.gastos.filter(g => g.desc === 'Netflix').map(g => [g.amount, g.month, g.year, g.cat]), subs: S.agenda.subs.filter(s => s.name === 'Netflix').length,
        sub: s && { amount: s.amount, period: s.period, date: s.date, dueDay: s.dueDay, debe: s.debe || null },
        plan: p && { oct: p.months['2026-10'] || 0, nov: p.months['2026-11'], dic: p.months['2026-12'] }, toast: window.__toasts.slice(-1)[0] }; });
    eq(r.gastos, [[5000, 9, 2026, 'suscripciones']], 'el gasto de octubre queda cargado una sola vez');
    eq(r.sub, { amount: 5000, period: 'mensual', date: '2026-11-15', dueDay: 15, debe: null }, 'la suscripción mensual arranca el 15/11 (el mes que viene), sin deuda');
    eq(r.plan, { oct: 0, nov: 5000, dic: 5000 }, 'el Plan no cuenta octubre otra vez: empieza en noviembre');
    is(/Netflix/.test(r.toast) && /guardado/.test(r.toast), `el aviso sigue nombrando el gasto (${r.toast})`);
    // Pasa un mes: se paga como cualquier suscripción
    await x.setClock(new Date(2026, 10, 15, 12));
    await x.ev(() => { goTo('agenda'); renderAgenda(); });
    await pagar(x.ev, 'sub', 'Netflix');
    const p2 = await x.ev(() => ({ gastos: S.gastos.filter(g => g.desc === 'Netflix').map(g => [g.month, g.amount]), date: S.agenda.subs.find(s => s.name === 'Netflix').date, debe: S.agenda.subs.find(s => s.name === 'Netflix').debe || null }));
    eq(p2, { gastos: [[9, 5000], [10, 5000]], date: '2026-12-15', debe: null }, 'en noviembre se paga normal: un gasto por mes y la fecha pasa a diciembre');
    // Cargarlo otra vez marcado no duplica la suscripción
    await alta(x, { desc: 'Netflix', amt: 5000, date: '2026-11-16', cat: 'suscripciones', repite: true });
    await x.ev(() => { const w = $('dup-warn'); if (w && w.classList.contains('show')) document.querySelector('#ov-gasto .btnp').click(); });
    eq(await x.ev(() => ({ subs: S.agenda.subs.filter(s => s.name === 'Netflix').length, plan: S.plan.filter(p => p.name === 'Netflix').length })), { subs: 1, plan: 1 }, 'con el mismo nombre no se duplica la suscripción ni la fila del Plan');
    await x.fin();

    // Fecha atrasada: la suscripción arranca en el próximo vencimiento futuro, no deja meses adeudados.
    const y = await fresh();
    await alta(y, { desc: 'Gimnasio', amt: 9000, date: '2026-08-05', repite: true });
    eq(await y.ev(() => { const s = S.agenda.subs.find(s => s.name === 'Gimnasio'); agRoll(); return { date: s.date, debe: s.debe || null }; }), { date: '2026-11-05', debe: null }, 'gasto de agosto: la suscripción arranca el 5/11, sin meses adeudados');
    await y.fin();

    // Compartido: la suscripción lo hereda
    const z = await fresh();
    await z.ev(() => { _gSaving = false; openGastoModal(); $('gdesc').value = 'Expensas'; $('gamt').value = '30000'; toggleSharedGasto(); toggleRepiteGasto(); document.querySelector('#ov-gasto .btnp').click(); });
    await z.P.waitForTimeout(250);
    eq(await z.ev(() => { const s = S.agenda.subs.find(s => s.name === 'Expensas'); return s && s.shared; }), { active: true, paidBy: 'fede', splitPct: 50 }, 'si el gasto es compartido, la suscripción también (quién pagó y cómo se divide)');
    await z.fin();
  }

  // ═══ 59 ═══════════════════════════════════════════════════════════════════
  section('59 · "guardado en noviembre · Ver" cuando el gasto cae en otro mes');
  {
    const x = await fresh();
    await alta(x, { desc: 'Coto', amt: 48900, date: '2026-11-20', cat: 'super' });
    let t = await toastVisible(x.ev);
    eq([t.show, t.msg, t.ver], [true, 'Coto · Super · $ 48.900 guardado en noviembre.', true], `alta con fecha de noviembre: categoría y mes en el aviso, con "Ver" (${t.msg})`);
    eq(await x.ev(() => [curMonth, $('mlbl').textContent]), [9, 'Octubre 2026'], 'se sigue viendo octubre hasta tocar "Ver"');
    await x.ev(() => $('toast-ver').click());
    eq(await x.ev(() => [curMonth, curYear, $('mlbl').textContent, $('mlbl-comp').textContent, _presupMonth, _sharedMonth]), [10, 2026, 'Noviembre 2026', 'Noviembre 2026', 10, 10], '"Ver" cambia el mes de las tres pestañas de Gastos (y Compartidos)');
    eq(await x.ev(() => [...document.querySelectorAll('#gastos-list .gasto-row .gdesc')].map(e => e.textContent.trim())), ['Coto'], 'y el gasto está en la lista');
    t = await toastVisible(x.ev);
    is(!t.show, 'sin otra acción, el aviso se va al tocar "Ver"');

    await alta(x, { desc: 'Pan', amt: 1500, date: '2026-11-21', cat: 'comida' });
    t = await toastVisible(x.ev);
    eq([t.msg, t.ver], ['Pan · Comida · $ 1.500 guardado.', false], 'mismo mes que se está viendo: el aviso queda como antes, sin "Ver"');

    await alta(x, { desc: 'Pasaje', amt: 90000, date: '2027-01-10', cat: 'transporte' });
    t = await toastVisible(x.ev);
    is(/guardado en enero 2027\.$/.test(t.msg) && t.ver, `otro año: dice el año (${t.msg})`);
    await x.ev(() => $('toast-ver').click());
    eq(await x.ev(() => $('mlbl').textContent), 'Enero 2027', '"Ver" va a enero 2027');

    // Edición de fecha
    await x.ev(() => { setGastosMonth(9, 2026); openEditGasto(S.gastos.find(g => g.desc === 'Almuerzo' || g.desc === 'Coto')); });
    await x.ev(() => { const g = _editGastoId; $('eg-date').value = '2026-12-02'; doSaveEditGasto(); });
    t = await toastVisible(x.ev);
    is(/Gasto actualizado/.test(t.msg) && /diciembre/.test(t.msg) && t.ver && t.undo, `editar la fecha a otro mes: avisa el mes, con "Ver" y "Deshacer" (${t.msg})`);
    await x.ev(() => $('toast-ver').click());
    t = await toastVisible(x.ev);
    eq(await x.ev(() => $('mlbl').textContent), 'Diciembre 2026', '"Ver" salta a diciembre');
    is(t.show && t.undo && !t.ver, 'el "Deshacer" sigue a la vista después de "Ver"');
    // Editar sin cambiar el mes: igual que antes
    await x.ev(() => { setGastosMonth(10, 2026); openEditGasto(S.gastos.find(g => g.desc === 'Pan')); $('eg-amt').value = '1600'; doSaveEditGasto(); });
    t = await toastVisible(x.ev);
    eq([t.msg, t.ver], ['Gasto actualizado.', false], 'editar el importe: el aviso no cambia');
    await x.fin();
  }

  // ═══ 80 ═══════════════════════════════════════════════════════════════════
  section('80 · Cola de avisos y "Deshacer" de varias bajas');
  {
    const seed = { accounts: [cuenta], gastos: [
      { id: 'ga', desc: 'Uno', cat: 'comida', amount: 1000, month: 9, year: 2026, day: 10, addedAt: new Date(2026, 9, 10, 12).getTime() },
      { id: 'gb', desc: 'Dos', cat: 'comida', amount: 2000, month: 9, year: 2026, day: 11, addedAt: new Date(2026, 9, 11, 12).getTime() },
      { id: 'gc', desc: 'Tres', cat: 'comida', amount: 3000, month: 9, year: 2026, day: 12, addedAt: new Date(2026, 9, 12, 12).getTime() } ] };
    const x = await fresh(seed);
    const borrar = id => x.ev(async id => {
      const row = document.querySelector(`#gastos-list .gasto-row[data-id="${id}"]`);
      row.querySelector('.rmore').click(); await new Promise(r => setTimeout(r, 50));
      [...row.querySelectorAll('.rmenu button')].find(b => /Eliminar/.test(b.textContent)).click();
      await new Promise(r => setTimeout(r, 100));
      confirmResolve(true); await new Promise(r => setTimeout(r, 150));
    }, id);
    const ids = () => x.ev(() => S.gastos.map(g => g.id).sort());
    await x.ev(() => { goTo('gastos'); renderGastos(); });
    await borrar('ga'); await borrar('gb');
    eq(await ids(), ['gc'], 'se borraron dos gastos seguidos');
    // Un aviso de sync llega con el "Deshacer" a la vista
    await x.ev(() => showToast('👫 1 gasto compartido nuevo de Mile', 'success'));
    let t = await toastVisible(x.ev);
    eq([t.show, t.msg, t.undo], [true, 'Gasto eliminado', true], 'el aviso no pisa el "Gasto eliminado · Deshacer"');
    eq(await x.ev(() => window.__toasts.includes('👫 1 gasto compartido nuevo de Mile')), true, 'el aviso se pidió igual (queda registrado)');
    await x.ev(() => undoLast());
    eq(await ids(), ['gb', 'gc'], 'Deshacer repone el último borrado (Dos)');
    t = await toastVisible(x.ev);
    eq([t.show, t.msg, t.undo], [true, 'Gasto eliminado', true], 'y el "Deshacer" del anterior queda a la vista');
    await x.ev(() => undoLast());
    eq(await ids(), ['ga', 'gb', 'gc'], 'un segundo Deshacer repone el primero (Uno)');
    await x.P.waitForTimeout(700);
    t = await toastVisible(x.ev);
    is(t.show && /compartido nuevo de Mile/.test(t.msg) && !t.undo, `y recién ahí aparece el aviso que esperaba (${t.msg})`);
    await x.P.waitForTimeout(100);
    eq(await x.ev(() => _undoFn), null, 'sin "Deshacer" pendiente');

    // La cola respeta el orden, no repite y se vacía sola
    await x.ev(() => { showToast('Uno', () => { }, 'info', 1500); showToast('Aviso A', 'success', 800); showToast('Aviso B', 'warning', 800); showToast('Aviso A', 'success', 800); });
    eq((await toastVisible(x.ev)).msg, 'Uno', 'con "Deshacer" a la vista los avisos esperan');
    await x.P.waitForTimeout(1900);
    eq((await toastVisible(x.ev)).msg, 'Aviso A', 'termina el "Deshacer" y sale el primer aviso');
    await x.P.waitForTimeout(1000);
    eq((await toastVisible(x.ev)).msg, 'Aviso B', 'después el segundo (el repetido no se muestra dos veces)');
    await x.P.waitForTimeout(1300);
    eq((await toastVisible(x.ev)).show, false, 'y la cola queda vacía');

    // Una baja vieja (el aviso ya se fue) no vuelve a ofrecerse
    await x.ev(() => { window.__log = []; showToast('Vieja', () => window.__log.push('vieja'), 'info', 500); });
    await x.P.waitForTimeout(1100);
    await x.ev(() => showToast('Nueva', () => window.__log.push('nueva'), 'info', 3000));
    await x.ev(() => undoLast());
    eq(await x.ev(() => window.__log), ['nueva'], 'una baja cuyo aviso ya se fue no queda en la pila');
    eq((await toastVisible(x.ev)).show, false, 'y no reaparece su "Deshacer"');

    // Sin "Deshacer" a la vista, un aviso reemplaza a otro como siempre
    await x.ev(() => { showToast('Primero', 'success', 3000); showToast('Segundo', 'success', 3000); });
    eq((await toastVisible(x.ev)).msg, 'Segundo', 'sin "Deshacer" en curso los avisos se reemplazan igual que antes');
    await x.fin();
  }

  eq(errores, [], 'sin errores de JS');
  await browser.close();
  console.log(`\n${'─'.repeat(50)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
