// AUDITORÍA 4 — MENÚS Y EDICIÓN: que cada modal tenga sus opciones y que
// editar por la interfaz real cambie el dato.
const L = require('./lib');
const { eq, is, section } = L;
const BIN = 'bin4';

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const d = await L.device(browser, { myName: 'fede', compBin: BIN });
  const P = d.page;

  const visible = sel => P.evaluate(s => {
    const el = document.querySelector(s);
    if (!el) return null;
    return !el.closest('.hidden') && el.offsetParent !== null;
  }, sel);
  const existe = sel => P.evaluate(s => !!document.querySelector(s), sel);
  const val = sel => P.evaluate(s => (document.querySelector(s) || {}).value, sel);

  // ════ ALTA EN AGENDA ═════════════════════════════════════════════════
  section('MENÚS · alta en Agenda');
  await d.ev(() => openAgendaModal('venc'));
  await P.waitForTimeout(450); // el modal enfoca a los 340ms
  for (const [sel, label] of [
    ['#ag-name', 'nombre'], ['#ag-amount', 'importe'], ['#ag-date', 'fecha'],
    ['#ag-period', 'periodicidad'], ['#ag-shared-section', 'sección de compartido'],
  ]) is(await existe(sel), `el alta de vencimiento tiene campo de ${label}`);
  const periodos = await P.evaluate(() => [...document.querySelectorAll('#ag-period .chip')].map(c => c.textContent.trim()));
  is(periodos.length >= 3, `la periodicidad ofrece varias opciones (${periodos.join(' / ')})`);
  const tipos = await P.evaluate(() => [...document.querySelectorAll('.amo-btn')].map(b => b.dataset.t));
  is(tipos.includes('sub') && tipos.includes('venc'), `se puede elegir el tipo (${tipos.join(', ')})`);

  // Alta real por el DOM.
  await P.fill('#ag-name', 'Prepaga');
  await P.fill('#ag-amount', '85000');
  await P.fill('#ag-date', '2026-09-10');
  await d.ev(() => doSaveAgenda());
  await P.waitForTimeout(150);
  const v = await d.ev(() => S.agenda.vencimientos.find(x => x.name === 'Prepaga'));
  is(!!v, 'guardar por la interfaz crea el vencimiento');
  eq(v && v.amount, 85000, 'con el importe cargado');
  eq(v && v.date, '2026-09-10', 'y la fecha elegida');

  // ════ EDITAR EN AGENDA ═══════════════════════════════════════════════
  section('MENÚS · editar un vencimiento');
  await d.ev((id) => editAgenda('venc', id), v.id);
  await P.waitForTimeout(450);
  eq(await val('#ag-name'), 'Prepaga', 'el modal de edición viene precargado con el nombre');
  eq(await val('#ag-amount'), '85000', 'y con el importe');
  eq(await P.evaluate(() => document.querySelector('#ag-save-btn').textContent), 'Actualizar',
    'y el botón dice "Actualizar", no "Guardar"');
  await P.fill('#ag-amount', '92000');
  await d.ev(() => doSaveAgenda());
  await P.waitForTimeout(150);
  eq(await d.ev((id) => (S.agenda.vencimientos.find(x => x.id === id) || {}).amount, v.id), 92000,
    'editar por la interfaz cambia el importe');
  eq(await d.ev(() => S.agenda.vencimientos.filter(x => x.name === 'Prepaga').length), 1,
    'y no duplica el vencimiento');

  // ════ EDITAR UNA CUOTA ═══════════════════════════════════════════════
  section('MENÚS · editar una compra en cuotas');
  await d.ev(() => {
    S.agenda.cuotas.push({ id: 'c1', name: 'Heladera', fee: 50000, total: 6, paid: 2, nextDueDate: '2026-09-10' });
    save();
  });
  await d.ev(() => editAgenda('cuota', 'c1'));
  await P.waitForTimeout(150);
  for (const [sel, label] of [['#ecq-name', 'nombre'], ['#ecq-fee', 'importe de la cuota'],
    ['#ecq-total', 'total de cuotas'], ['#ecq-paid', 'cuántas van pagas'], ['#ecq-date', 'próximo vencimiento']])
    is(await existe(sel), `el editor de cuota tiene campo de ${label}`);
  eq(await val('#ecq-name'), 'Heladera', 'precargado con el nombre');
  eq(await val('#ecq-paid'), '2', 'y con las cuotas ya pagas (se puede corregir si estaba mal)');
  await P.fill('#ecq-fee', '58000');
  await P.fill('#ecq-paid', '3');
  await d.ev(() => doSaveEditCuota());
  await P.waitForTimeout(150);
  const c1 = await d.ev(() => S.agenda.cuotas.find(x => x.id === 'c1'));
  eq(c1.fee, 58000, 'editar cambia el importe de la cuota');
  eq(c1.paid, 3, 'y el número de cuota, que es lo que no se podía corregir antes');

  // ════ COMPARTIDOS: editar un gasto ═══════════════════════════════════
  section('MENÚS · editar un gasto compartido desde Compartidos');
  await d.ev(async () => {
    S.gastos.push({ id: 'gs', desc: 'Cena', amount: 30000, cat: 'salidas', month: 7, year: 2026,
      addedAt: new Date(2026, 7, 9, 12).getTime(), shared: { active: true, paidBy: 'fede', splitPct: 50 } });
    save(); await upsertSharedBinGasto(S.gastos.find(g => g.id === 'gs'));
  });
  await d.settle();
  await d.ev(() => openEditSharedGasto(S.gastos.find(g => g.id === 'gs')));
  await P.waitForTimeout(150);
  for (const [sel, label] of [['#esg-desc', 'descripción'], ['#esg-amt', 'importe'],
    ['#esg-date', 'fecha'], ['#esg-split-pct', 'porcentaje de división']])
    is(await existe(sel), `el editor de gasto compartido tiene ${label}`);
  const quienes = await P.evaluate(() => [...document.querySelectorAll('#ov-edit-shared [id^="esg-pb-"]')].map(b => b.id));
  is(quienes.length >= 2, `se puede elegir quién pagó (${quienes.join(', ')})`);
  eq(await val('#esg-amt'), '30000', 'precargado con el importe');

  await P.fill('#esg-amt', '36000');
  await P.fill('#esg-split-pct', '30');
  await d.ev(() => doSaveEditShared());
  await d.settle(); await P.waitForTimeout(200); await d.settle();
  const gs = await d.ev(() => S.gastos.find(g => g.id === 'gs'));
  eq(gs.amount, 36000, 'editar por la interfaz cambia el importe');
  eq(gs.shared.splitPct, 30, 'y el porcentaje de división');
  const enBin = ((L.bins[BIN] || {}).gastos || []).find(g => g.id === 'gs');
  eq(enBin && enBin.amount, 36000, 'y la corrección llega al bin');
  eq(enBin && enBin.shared.splitPct, 30, 'con la división nueva');
  eq(await d.ev(() => sharedPendientes().total), 0, 'sin quedar nada pendiente');

  // ════ COMPARTIDOS: liquidar y editar la transferencia ═════════════════
  section('MENÚS · liquidar y corregir la transferencia');
  await d.ev(() => openSharedPaymentModal());
  await P.waitForTimeout(150);
  for (const [sel, label] of [['#sp-amount', 'importe'], ['#sp-desc', 'descripción'], ['#sp-date', 'fecha']])
    is(await existe(sel), `el modal de liquidar tiene ${label}`);
  await P.fill('#sp-amount', '50000');
  await P.fill('#sp-desc', 'Transferencia agosto');
  await d.ev(() => doSaveSharedPayment());
  await d.settle(); await P.waitForTimeout(200); await d.settle();
  let pays = await d.ev(() => getSharedPayments());
  eq(pays.length, 1, 'liquidar registra la transferencia');
  eq(pays[0].amount, 50000, 'por el importe cargado');
  const payEnBin = ((L.bins[BIN] || {}).payments || []).length;
  eq(payEnBin, 1, 'y sube al bin');

  await d.ev((id) => openEditSharedPayment(id), pays[0].id);
  await P.waitForTimeout(150);
  eq(await val('#sp-amount'), '50000', 'el editor de la transferencia viene precargado');
  await P.fill('#sp-amount', '65000');
  await d.ev(() => doSaveSharedPayment());
  await d.settle(); await P.waitForTimeout(200); await d.settle();
  pays = await d.ev(() => getSharedPayments());
  eq(pays.length, 1, 'corregir la transferencia no crea otra');
  eq(pays[0].amount, 65000, 'y deja el importe corregido');
  const payBin = ((L.bins[BIN] || {}).payments || [])[0];
  eq(payBin && payBin.amount, 65000, 'la corrección también llega al bin');

  // ════ BOTONES DE CADA FILA ═══════════════════════════════════════════
  section('MENÚS · los botones que tiene cada fila');
  await d.ev(() => { goTo('gastos'); switchGastosTab('compartidos'); renderCompartidos(); });
  await P.waitForTimeout(400);
  const acciones = await P.evaluate(() => {
    const el = document.querySelector('.sh-actions');
    return el ? [...el.querySelectorAll('button')].map(b => (b.getAttribute('onclick') || '').split('(')[0]) : [];
  });
  is(acciones.includes('openSharedPaymentModal'), 'la cabecera de Compartidos tiene Liquidar');
  is(acciones.includes('syncCompartidos'), 'tiene Sincronizar');
  is(acciones.includes('exportCompartidosData'), 'y tiene el de control/exportar');
  // El onclick completo, no solo el prefijo: los borrados van envueltos en
  // appConfirm(...).then(...), así que mirar la primera función no alcanza.
  const onclicksComp = await P.evaluate(() =>
    [...document.querySelectorAll('#compartidos-list [onclick]')].map(b => b.getAttribute('onclick')));
  is(onclicksComp.some(x => /openEditSharedGasto/.test(x)), 'cada gasto compartido se puede editar desde la lista');
  is(onclicksComp.some(x => /removeSharedBinGasto/.test(x)), 'y se puede borrar');
  is(onclicksComp.some(x => /appConfirm/.test(x) && /removeSharedBinGasto/.test(x)), 'con confirmación antes de borrar');
  is(onclicksComp.some(x => /openEditSharedPayment/.test(x)), 'y la transferencia también se puede editar desde la lista');
  is(onclicksComp.some(x => /deleteSharedPayment/.test(x)), 'y borrar');

  await d.ev(() => { goTo('agenda'); renderAgenda(); });
  await P.waitForTimeout(400);
  const agBtns = await P.evaluate(() => [...document.querySelectorAll('#pg-agenda [onclick]')]
    .map(b => b.getAttribute('onclick')));
  is(agBtns.some(x => /markVencPaid/.test(x)), 'las filas de vencimiento tienen el botón de pagar');
  is(agBtns.some(x => /markCuotaPaid/.test(x)), 'las de cuota también');
  is(agBtns.some(x => /editAgenda/.test(x)), 'todas tienen el de editar');
  is(agBtns.some(x => /delAgenda/.test(x)), 'y el de borrar');
  is(agBtns.some(x => /appConfirm/.test(x) && /delAgenda/.test(x)), 'con confirmación antes de borrar');
  is(agBtns.some(x => /openAgendaModal/.test(x)), 'y hay por dónde dar de alta algo nuevo');

  section('ERRORES · JS durante toda la corrida');
  eq(d.errors, [], 'ningún error de página');

  console.log(`\n${'─'.repeat(52)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  await browser.close();
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error('ERROR:', e); process.exit(2); });
