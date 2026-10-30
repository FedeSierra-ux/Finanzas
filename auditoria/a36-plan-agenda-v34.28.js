// Los arreglos de Plan, Agenda, cuotas, dólar y parsing de la v34.28 (auditoría
// de la v34.27: A2, A6, A7, A8, A12, A13, A21, A22, A23, A25 y C16), cada uno
// con la reproducción que lo encontró. Cada sección arma su propio dispositivo
// con su reloj. Con la v34.27 casi todas terminan en ✗.
const L = require('./lib');
const { ok, eq, is, section } = L;

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const cuenta = { id: 'galicia', name: 'Galicia', type: 'bancaria', amount: 5000000, currency: 'ARS' };
  const errores = [];

  // Un dispositivo nuevo con el reloj en `t0`. fin_last_open se borra: es la
  // primera apertura (si no, el salto del reloj real al de la prueba dispararía
  // el aviso de "fecha dudosa", que solo prueba la sección A8).
  const fresh = async (t0, seed = { accounts: [cuenta] }) => {
    const d = await L.device(browser, { myName: 'fede', compBin: null, seed });
    await d.page.waitForTimeout(300);
    const waitApp = async () => {
      await d.page.waitForFunction(() => typeof S === 'object' && S !== null && typeof save === 'function');
      await d.page.waitForTimeout(300);
      await d.ev(() => { clearInterval(_sharedAutoTimer); clearInterval(_tcAutoTimer); window.__toasts = []; const st = window.showToast; window.showToast = (m, a, b, c) => { window.__toasts.push(String(m)); return st(m, a, b, c); }; });
    };
    await d.ev(() => localStorage.removeItem('fin_last_open'));
    await d.page.clock.install({ time: t0 });
    await d.page.reload(); await waitApp();
    const setClock = async (t, { keepOpen = false } = {}) => {
      await d.page.clock.setSystemTime(t);
      if (!keepOpen) await d.ev(() => localStorage.removeItem('fin_last_open'));
      await d.page.reload(); await waitApp();
    };
    return { d, ev: d.ev, setClock, waitApp, fin: async () => { errores.push(...d.errors); await d.close(); } };
  };
  const pagar = (ev, kind, name) => ev(async ({ kind, name }) => {
    const it = kind === 'cuota' ? S.agenda.cuotas.find(x => x.name === name) : (kind === 'sub' ? S.agenda.subs : S.agenda.vencimientos).find(x => x.name === name);
    if (kind === 'cuota') markCuotaPaid(it.id); else if (kind === 'sub') markSubPaid(it.id); else markVencPaid(it.id);
    await new Promise(r => setTimeout(r, 40));
    document.querySelector('#pay-acct-list button').click();
    await new Promise(r => setTimeout(r, 40));
  }, { kind, name });
  const altaTarjeta = (ev, o) => ev(o => { _gSaving = false; openGastoModal(); $('gdesc').value = o.desc; $('gamt').value = String(o.amt); $('g-date-inp').value = o.date;
    document.querySelector('#ov-gasto .chip[data-v="tarjeta"]').click(); $('gct').value = String(o.ct); $('gca').value = '1'; document.querySelector('#ov-gasto .btnp').click(); }, o);

  // ═══ A2 ═══════════════════════════════════════════════════════════════════
  section('A2 · Editar importe/total de una cuota en la Agenda no se revierte al recargar');
  {
    const x = await fresh(new Date(2026, 9, 15, 12));
    await altaTarjeta(x.ev, { desc: 'Prestamo UVA', amt: 10000, date: '2026-10-10', ct: 12 });
    const e = await x.ev(() => { const cq = S.agenda.cuotas[0]; editAgenda('cuota', cq.id); $('ecq-fee').value = '12000'; $('ecq-total').value = '18'; doSaveEditCuota();
      return { fee: cq.fee, total: cq.total, plan: Object.values(S.plan[0].months)[0] }; });
    eq(e, { fee: 12000, total: 18, plan: 12000 }, 'editada a 12.000 en 18 cuotas (por UVA): Agenda y Plan');
    await x.setClock(new Date(2026, 10, 10, 12));
    eq(await x.ev(() => ({ fee: S.agenda.cuotas[0].fee, total: S.agenda.cuotas[0].total })), { fee: 12000, total: 18 }, 'al recargar sigue en 12.000 y 18 (antes volvía a 10.000 y 12)');
    await pagar(x.ev, 'cuota', 'Prestamo UVA');
    eq(await x.ev(() => S.gastos.map(g => g.amount)), [10000, 12000], 'pagar la cuota 2 registra 12.000');
    await x.setClock(new Date(2026, 11, 10, 12));
    eq(await x.ev(() => ({ fee: S.agenda.cuotas[0].fee, plan: Object.values(S.plan[0].months)[0] })), { fee: 12000, plan: 12000 }, 'un mes después, la Agenda y el Plan siguen en 12.000');
    // Corregir el importe de la cuota en Gastos sigue bajando a la Agenda
    await x.ev(() => { const g = S.gastos[1]; g.amount = 12500; syncGastoCuotaToAgenda(g, g.desc); save(); });
    await x.setClock(new Date(2026, 11, 11, 12));
    eq(await x.ev(() => S.agenda.cuotas[0].fee), 12500, 'y corregir el importe de un gasto de la compra en Gastos sí actualiza la Agenda');
    await x.fin();
  }

  // ═══ A6 ═══════════════════════════════════════════════════════════════════
  section('A6 · Editar un campo de una cuota recortada a fin de mes no corre dueDay');
  {
    const x = await fresh(new Date(2027, 0, 31, 12));
    await altaTarjeta(x.ev, { desc: 'TV', amt: 10000, date: '2027-01-31', ct: 6 });
    const a = await x.ev(() => { const cq = S.agenda.cuotas.find(c => c.name === 'TV'); return { next: cq.nextDueDate, dueDay: cq.dueDay }; });
    eq(a, { next: '2027-02-28', dueDay: 31 }, 'compra del 31/01: la cuota 2 vence el 28/02 con dueDay 31');
    const b = await x.ev(() => { const cq = S.agenda.cuotas.find(c => c.name === 'TV'); editAgenda('cuota', cq.id); $('ecq-name').value = 'TV Samsung'; doSaveEditCuota(); return { next: cq.nextDueDate, dueDay: cq.dueDay }; });
    eq(b, { next: '2027-02-28', dueDay: 31 }, 'renombrarla no toca dueDay (antes: 28)');
    await pagar(x.ev, 'cuota', 'TV Samsung');
    eq(await x.ev(() => S.agenda.cuotas[0].nextDueDate), '2027-03-31', 'pagada la 2, la cuota 3 vence el 31/03 (antes el 28/03)');
    const c = await x.ev(() => { const cq = S.agenda.cuotas[0]; editAgenda('cuota', cq.id); $('ecq-date').value = '2027-03-15'; doSaveEditCuota(); return { next: cq.nextDueDate, dueDay: cq.dueDay }; });
    eq(c, { next: '2027-03-15', dueDay: 15 }, 'cambiar la fecha a mano sí cambia dueDay');
    await x.fin();
  }

  // ═══ A7 ═══════════════════════════════════════════════════════════════════
  section('A7 · Plan "+ Gasto › Suscripciones › Una vez": una sola vez en el Plan y en la Agenda');
  {
    const x = await fresh(new Date(2026, 9, 15, 12));
    const uiPlan = o => x.ev(o => { openProjModal('gasto'); $('prn').value = o.name; $('pra').value = o.amount;
      document.querySelector(`#pr-cadence .chip[data-v="${o.cadence}"]`).click(); document.querySelector('#pr-cats .chip[data-v="suscripciones"]').click();
      document.querySelector('#ov-proj .btnp').click(); }, o);
    await uiPlan({ name: 'Curso', amount: 7000, cadence: 12 });
    await uiPlan({ name: 'Revista', amount: 5000, cadence: 1 });
    const r = await x.ev(() => { const p = n => S.plan.find(x => x.name === n), s = n => S.agenda.subs.find(x => x.name === n);
      return { curso: { meses: Object.keys(p('Curso').months), rep: p('Curso').rep || null, per: s('Curso').period },
               rev: { rep: !!p('Revista').rep, per: s('Revista').period } }; });
    eq(r.curso, { meses: ['2026-10'], rep: null, per: 'unica' }, '"Una vez": un solo mes, sin repetición, y en la Agenda "una vez" (antes: anual en el Plan y mensual en la Agenda)');
    eq(r.rev, { rep: true, per: 'mensual' }, 'la mensual sigue igual');
    await x.setClock(new Date(2028, 9, 16, 12));
    const deuda = await x.ev(() => planAtrasadoFila(S.plan.find(p => p.name === 'Curso') || { name: 'Curso', months: {} }));
    eq(deuda, 7000, 'dos años después sin pagar, el Curso debe 7.000 una vez (antes ~24 meses: 168.000)');
    await x.fin();
  }

  // ═══ A8 ═══════════════════════════════════════════════════════════════════
  section('A8 · Un reloj mal puesto no rueda la Agenda ni poda el Plan sin preguntar');
  {
    const x = await fresh(new Date(2026, 9, 15, 12), { accounts: [{ id: 'galicia', name: 'Galicia', type: 'bancaria', amount: 1000000, currency: 'ARS' }] });
    await x.ev(() => {
      openAgendaModal('sub'); $('ag-name').value = 'Netflix'; $('ag-amount').value = '12000'; $('ag-date').value = '2026-10-25'; document.querySelector('#ov-agenda .btnp').click();
      openAgendaModal('venc'); $('ag-name').value = 'Alquiler'; $('ag-amount').value = '400000'; $('ag-date').value = '2026-10-28'; document.querySelector('#ov-agenda .btnp').click();
      openProjModal('ingreso'); $('prn').value = 'Sueldo'; $('pra').value = '900000'; document.querySelector('#ov-proj .btnp').click(); });
    const estado = () => x.ev(() => ({ nf: S.agenda.subs[0].date, debe: (S.agenda.subs[0].debe || []).length, sueldo: Object.keys(S.plan.find(p => p.name === 'Sueldo').months).length,
      abierto: $('ov-confirm').classList.contains('open'), titulo: $('confirm-title').textContent, ultimo: localStorage.getItem('fin_last_open') }));
    const base = await estado();
    eq([base.nf, base.debe, base.abierto], ['2026-10-25', 0, false], 'arranque normal: sin aviso');
    const meses0 = base.sueldo;
    // Dentro de lo normal (36 días): rueda sin preguntar
    await x.setClock(new Date(2026, 10, 20, 12), { keepOpen: true });
    let e = await estado();
    eq([e.nf, e.debe, e.abierto], ['2026-11-25', 1, false], 'a los 36 días rueda la Agenda (octubre queda adeudado) y no pregunta');
    // Un reloj adelantado 7 meses
    await x.setClock(new Date(2027, 5, 15, 12), { keepOpen: true });
    await x.d.page.waitForTimeout(1200);
    e = await estado();
    is(e.abierto && /fecha/.test(e.titulo), `salto de 7 meses: pregunta con el diálogo de la app (${e.titulo})`);
    eq([e.nf, e.debe, e.sueldo], ['2026-11-25', 1, meses0], 'y mientras tanto no rueda la Agenda ni poda el Plan');
    await x.ev(() => confirmResolve(false));
    await x.d.page.waitForTimeout(100);
    e = await estado();
    eq([e.nf, e.debe, e.ultimo], ['2026-11-25', 1, '2026-11-20'], 'Cancelar deja todo como estaba y no actualiza el último día de apertura');
    // El reloj vuelve a la normalidad: no queda daño
    await x.setClock(new Date(2026, 10, 21, 12), { keepOpen: true });
    await x.d.page.waitForTimeout(1200);
    e = await estado();
    eq([e.nf, e.debe, e.sueldo, e.abierto], ['2026-11-25', 1, meses0, false], 'al volver el reloj a la fecha real todo sigue igual (antes: Plan podado, Agenda rodada)');
    // Retroceso
    await x.setClock(new Date(2026, 10, 5, 12), { keepOpen: true });
    await x.d.page.waitForTimeout(1200);
    e = await estado();
    is(e.abierto, 'si el reloj retrocede más de un día también pregunta');
    await x.ev(() => confirmResolve(true));
    await x.d.page.waitForTimeout(200);
    eq((await estado()).ultimo, '2026-11-05', 'confirmar actualiza el último día de apertura');
    // Confirmar un salto real: ahora sí rueda y poda
    await x.setClock(new Date(2027, 5, 15, 12), { keepOpen: true });
    await x.d.page.waitForTimeout(1200);
    await x.ev(() => confirmResolve(true));
    await x.d.page.waitForTimeout(300);
    e = await estado();
    is(e.debe >= 7 && e.nf >= '2027-06-25', `"Sí, es correcta" rueda la Agenda (debe ${e.debe}, próxima ${e.nf})`);
    await x.fin();
  }

  // ═══ A12 ═══════════════════════════════════════════════════════════════════
  section('A12 · Dólar: a mano no se pisa, `compra` para tenencias, se aplica con change y con piso');
  {
    const x = await fresh(new Date(2026, 9, 15, 12), { accounts: [{ id: 'usd', name: 'USD', type: 'varios', amount: 1000, currency: 'USD' }] });
    await x.ev(() => { const real = window.fetch; window.__tcCalls = 0;
      window.fetch = async (u, o) => { if (/dolarapi/.test(String(u))) { window.__tcCalls++; return new Response(JSON.stringify({ compra: 1380, venta: 1420 }), { status: 200 }); } return real(u, o); }; });
    const tipear = v => x.ev(v => { const tc = $('tc'); tc.value = v; tc.dispatchEvent(new Event('input')); return S.tc; }, v);
    eq(await tipear('1450'), 1300, 'tipear (evento input) no aplica nada mientras se escribe');
    const ch = await x.ev(() => { const tc = $('tc'); tc.value = '1450'; tc.dispatchEvent(new Event('change')); return { tc: S.tc, manual: !!S.tcManual, chip: $('tc-chip-val').textContent }; });
    eq([ch.tc, ch.manual], [1450, true], 'al terminar (change) se aplica 1.450 y queda marcado como a mano');
    await x.ev(() => fetchTC());
    eq(await x.ev(() => ({ tc: S.tc, llamadas: window.__tcCalls })), { tc: 1450, llamadas: 0 }, 'el auto-refresco no lo pisa ni siquiera pide la cotización (antes: a los 30 min la venta)');
    eq(await x.ev(() => ($('tc-date').textContent)), 'a mano', 'el recuadro dice "a mano"');
    const bajo = await x.ev(() => { const tc = $('tc'); tc.value = '14'; tc.dispatchEvent(new Event('change')); return { tc: S.tc, campo: tc.value }; });
    eq(bajo, { tc: 1450, campo: '1450' }, 'un valor menor a 100 se rechaza y el campo vuelve a 1.450');
    await x.ev(() => fetchTC(true));
    eq(await x.ev(() => ({ tc: S.tc, manual: !!S.tcManual, patrimonio: S.accounts[0].amount * S.tc })), { tc: 1380, manual: false, patrimonio: 1380000 }, '↻ vuelve al automático y toma la compra (1.380), no la venta (1.420)');
    await x.setClock(new Date(2026, 9, 16, 12));
    await x.ev(() => fetchTC());
    eq(await x.ev(() => S.tc), 1380, 'ya en automático, el refresco sigue actualizando');
    await x.fin();
  }

  // ═══ A13 + A23 ═════════════════════════════════════════════════════════════
  section('A13 · Las cuotas de tarjeta generan avisos de vencimiento');
  {
    const x = await fresh(new Date(2027, 0, 31, 12));
    await x.ev(() => {
      S.agenda.cuotas.push({ id: 'cq1', name: 'Tele', fee: 5000, total: 6, paid: 1, startDate: '2026-12-01', nextDueDate: '2027-02-03', dueDay: 3 });
      S.agenda.vencimientos.push({ id: 'v9', name: 'Patente', amount: 9000, date: '2027-02-03', period: 'mensual' }); save();
      localStorage.setItem('fin_push_worker_url', 'https://w.example'); localStorage.setItem('fin_sync_bin_id', 'bin1');
      window.__post = null; const real = window.fetch;
      window.fetch = async (u, o) => { if (/w\.example\/sync-agenda/.test(String(u))) { window.__post = JSON.parse(o.body); return new Response('{}', { status: 200 }); } return real(u, o); }; });
    const avisos = await x.ev(() => avisosVencimiento({ vencTime: '09:00', vencDays: 1 }, Date.now()).map(a => a.body));
    eq(avisos.length, 2, `avisos: el vencimiento y la cuota (${avisos.join(' | ')})`);
    is(avisos.some(b => /Tele.*cuota 2\/6.*mañana|Tele.*cuota 2\/6.*en 1 días|Tele.*cuota 2\/6/.test(b)), 'el aviso de la cuota nombra la compra y el número de cuota');
    await x.ev(() => syncAgendaToWorker({ vencOn: true, vencTime: '09:00', vencDays: 1 }));
    await x.d.page.waitForTimeout(100);
    const post = await x.ev(() => window.__post);
    eq(post && post.items.map(i => i.name.split(' (')[0]).sort(), ['Patente', 'Tele'], 'el Worker recibe también la cuota');
    await x.setClock(new Date(2027, 1, 1, 12));
    const urg = await x.ev(() => checkAgendaAlerts().map(u => u.name.split(' (')[0]).sort());
    eq(urg, ['Patente', 'Tele'], 'la franja de alerta de Agenda incluye la cuota');
    const wid = await x.ev(async () => { goTo('saldos'); await new Promise(r => setTimeout(r, 700)); return [...document.querySelectorAll('.wr-bell-title')].map(e => e.textContent.trim()); });
    is(wid.some(t => /Tele/i.test(t)), `el widget de Saldos muestra la cuota que vence en 2 días (${wid.join(', ')})`);
    await x.fin();
  }
  section('A23 · Google Calendar: el día original de fin de mes, no el recortado');
  {
    const x = await fresh(new Date(2027, 0, 31, 12));
    await x.ev(() => { openAgendaModal('sub'); $('ag-name').value = 'Gym'; $('ag-amount').value = '20000'; $('ag-date').value = '2027-01-31'; document.querySelector('#ov-agenda .btnp').click(); });
    await pagar(x.ev, 'sub', 'Gym');
    await x.ev(() => { openAgendaModal('sub'); $('ag-name').value = 'Club'; $('ag-amount').value = '9000'; $('ag-date').value = '2027-01-30'; document.querySelector('#ov-agenda .btnp').click(); });
    await pagar(x.ev, 'sub', 'Club');
    await altaTarjeta(x.ev, { desc: 'Heladera', amt: 30000, date: '2027-01-31', ct: 6 });
    const r = await x.ev(() => { const it = n => buildAgendaItems().find(i => i.name === n); const out = {};
      for (const n of ['Gym', 'Club', 'Heladera']) out[n] = { date: it(n).date, dueDay: it(n).dueDay, rrule: gcalRRule(it(n)), url: decodeURIComponent(gcalEventUrl(it(n))) };
      return out; });
    eq([r.Gym.date, r.Gym.dueDay], ['2027-02-28', 31], 'Gym del 31/01 pagada: próxima 28/02 con dueDay 31');
    eq(r.Gym.rrule, 'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1', 'Google Calendar: BYMONTHDAY=-1 (fin de mes), no el 28 (antes: FREQ=MONTHLY pelado)');
    is(r.Gym.url.includes('BYMONTHDAY=-1'), 'y el link del evento lleva la regla');
    eq(r.Club.rrule, 'RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29,30;BYSETPOS=-1', 'día 30 recortado a 28/02: 28, 29 o 30, el último que exista');
    eq(r.Heladera.rrule, 'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=5', 'cuotas del 31: fin de mes y 5 repeticiones');
    await x.fin();
  }

  // ═══ A21 ═══════════════════════════════════════════════════════════════════
  section('A21 · Reglas aprendidas: exacta primero, palabra entera, la más larga, mínimo 4 letras');
  {
    const x = await fresh(new Date(2026, 9, 15, 12), {});
    const r = await x.ev(() => {
      const cat = d => (findCategoryRule(d) || {}).cat || null;
      const out = {};
      localStorage.setItem('fin_cat_rules', '[]'); upsertCategoryRule('Dia', 'super');
      out.dia = ['Dia', 'Media luna', 'Diabetes tira reactiva', 'Dia del niño regalo'].map(cat);
      localStorage.setItem('fin_cat_rules', '[]'); upsertCategoryRule('Uber Eats', 'comida'); upsertCategoryRule('Uber', 'transporte');
      out.uber = ['Uber', 'Uber Eats', 'Uber Eats pedido', 'Uber viaje al centro', 'Cuber'].map(cat);
      localStorage.setItem('fin_cat_rules', '[]'); upsertCategoryRule('Uber', 'transporte'); upsertCategoryRule('Uber Eats', 'comida');
      out.larga = cat('Pedido Uber Eats cena');
      localStorage.setItem('fin_cat_rules', '[]'); upsertCategoryRule('Carrefour Express', 'super');
      out.corto = [cat('Ca'), cat('car'), cat('Carrefour Express'), cat('Compra en Carrefour Express')];
      out.acento = (() => { localStorage.setItem('fin_cat_rules', '[]'); upsertCategoryRule('Café Martínez', 'comida'); return [cat('Café Martínez'), cat('Un café Martínez rico')]; })();
      return out; });
    eq(r.dia, ['super', null, null, null], '"dia" (3 letras): solo la igualdad exacta; ya no atrapa "Media luna" ni "Diabetes…"');
    eq(r.uber, ['transporte', 'comida', 'comida', 'transporte', null], 'Uber exacta gana aunque haya otra que la contenga; "Uber Eats" > "Uber"; "Cuber" no es "uber"');
    eq(r.larga, 'comida', 'entre dos coincidencias gana la más larga, sin importar el orden');
    eq(r.corto, [null, null, 'super', 'super'], 'lo tipeado a medias ("Ca", "car") ya no dispara una regla; la frase completa sí');
    eq(r.acento, ['comida', 'comida'], 'con acentos y mayúsculas el límite de palabra anda');
    await x.fin();
  }

  // ═══ A22 ═══════════════════════════════════════════════════════════════════
  section('A22 · Plan "+ Gasto › Tarjeta" valida cuotas');
  {
    const x = await fresh(new Date(2026, 9, 15, 12));
    const plan = (ct, ca) => x.ev(({ ct, ca }) => { document.querySelectorAll('.ferr').forEach(e => e.remove());
      openProjModal('gasto'); $('prn').value = 'Cuota loca'; $('pra').value = '1000'; document.querySelector('#pr-cats .chip[data-v="tarjeta"]').click(); $('pr-ct').value = ct; $('pr-ca').value = ca;
      const t = performance.now(); document.querySelector('#ov-proj .btnp').click();
      const err = document.querySelector('#ov-proj .ferr'); return { err: err && err.textContent, cuotas: S.agenda.cuotas.length, plan: S.plan.length, ms: Math.round(performance.now() - t) }; }, { ct, ca });
    let r = await plan('20000', '1');
    eq([r.err, r.cuotas, r.plan], ['Entre 1 y 120 cuotas', 0, 0], '20.000 cuotas: error en el campo y no guarda nada (antes: 20.000 meses en el Plan)');
    r = await plan('6', '8');
    eq([r.err, r.cuotas, r.plan], ['La cuota actual no puede ser mayor al total', 0, 0], 'cuota actual 8 de 6: error y no guarda');
    r = await plan('6', '0');
    eq([r.err, r.cuotas], ['La cuota actual es 1 o más', 0], 'cuota actual 0: error');
    r = await plan('', '1');
    eq([r.err, r.cuotas], ['Entre 1 y 120 cuotas', 0], 'total vacío: error');
    r = await plan('6', '2');
    eq([r.err, r.cuotas, r.plan], [null, 1, 1], '6 cuotas, va por la 2: se guarda');
    await x.fin();
  }

  // ═══ A25 ═══════════════════════════════════════════════════════════════════
  section('A25 · parseNumAR: formato US sin romper el argentino');
  {
    const x = await fresh(new Date(2026, 9, 15, 12), {});
    const tabla = [['1,234.56', 1234.56], ['0.500', 0.5], ['1,234,567.89', 1234567.89], ['1,234,567', 1234567], ['-0.500', -0.5],
      ['1.234,56', 1234.56], ['1,234', 1.234], ['1,5', 1.5], ['1.234', 1234], ['1.234.567', 1234567], ['100.000', 100000], ['7500.5', 7500.5], ['7500,5', 7500.5], ['0,5', 0.5], ['12', 12], ['1.234.567,8', 1234567.8]];
    const got = await x.ev(t => t.map(([s]) => parseNumAR(s)), tabla);
    tabla.forEach(([s, v], i) => eq(got[i], v, `parseNumAR('${s}') = ${v}`));
    eq(await x.ev(() => [parseNumAR('abc'), parseNumAR(''), parseNumAR('1e5')].map(n => Number.isNaN(n))), [true, true, true], 'lo que no es un monto sigue siendo NaN');
    await x.fin();
  }

  // ═══ C16 ═══════════════════════════════════════════════════════════════════
  section('C16 · "termina …" es el mes de la última cuota que falta');
  {
    const seed = { accounts: [cuenta], agenda: { subs: [], vencimientos: [], inversiones: [], cuotas: [
      { id: 'c1', name: 'Sillon', fee: 1000, total: 6, paid: 2, startDate: '2026-08-01', nextDueDate: '2026-10-20', dueDay: 20 },
      { id: 'c2', name: 'Mesa', fee: 2000, total: 6, paid: 2, paidSkip: [6], startDate: '2026-08-01', nextDueDate: '2026-10-20', dueDay: 20 }] } };
    const x = await fresh(new Date(2026, 9, 15, 12), seed);
    const r = await x.ev(async () => {
      const lista = n => buildAgendaItems().find(i => i.name === n);
      const fila = n => buildAgendaRows().find(i => i.name === n);
      const out = { lista: [lista('Sillon').detail, lista('Mesa').detail], filas: [fila('Sillon').detail, fila('Mesa').detail], gcal: decodeURIComponent(gcalEventUrl(lista('Sillon'))).replace(/\+/g, ' ') };
      goTo('agenda'); switchAgendaTab('agenda'); openAgendaSheet('cuota');
      out.hoja = [...document.querySelectorAll('#ag-sheet-content .ag-card')].map(c => c.querySelector('.ag-detail').textContent);
      closeAgendaSheet();
      const cq = S.agenda.cuotas[0]; markCuotaPaid(cq.id); await new Promise(r => setTimeout(r, 40)); out.pagar = $('pay-modal-sub').textContent; closeOv('ov-pay');
      return out; });
    is(/termina enero de 2027/.test(r.lista[0]), `Sillon (cuotas 3 a 6: oct, nov, dic, ene): la lista dice enero (${r.lista[0]})`);
    is(/termina diciembre de 2026/.test(r.lista[1]), `Mesa (la 6 pagada por adelantado: oct, nov, dic): diciembre, no febrero (${r.lista[1]})`);
    is(/termina enero de 2027/.test(r.filas[0]) && /termina diciembre de 2026/.test(r.filas[1]), `las filas de la Agenda coinciden (${r.filas.join(' | ')})`);
    is(/termina enero de 2027/.test(r.gcal), 'el detalle del evento de Google Calendar también');
    is(r.hoja.some(t => /termina enero de 2027/.test(t)) && r.hoja.some(t => /termina diciembre de 2026/.test(t)), `la hoja de cuotas coincide (${r.hoja.join(' | ')})`);
    is(/Terminás de pagar en enero de 2027/.test(r.pagar), `y la hoja de pagar dice lo mismo (${r.pagar.replace(/\s+/g, ' ')})`);
    await x.fin();
  }

  eq(errores, [], 'sin errores de JS');
  await browser.close();
  console.log(`\n${'─'.repeat(50)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
