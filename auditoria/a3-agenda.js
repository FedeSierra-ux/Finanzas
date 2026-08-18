// AUDITORÍA 3 — AGENDA ↔ GASTOS ↔ PROYECCIÓN ↔ SALDOS ↔ COMPARTIDOS.
const L = require('./lib');
const { eq, is, section } = L;
const BIN = 'bin3';

const hoy = () => new Date().toISOString().slice(0, 10);

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const d = await L.device(browser, { myName: 'fede', compBin: BIN });
  const mile = await L.device(browser, { myName: 'mile', compBin: BIN });

  const st = () => d.ev(() => ({
    gastos: S.gastos.map(g => ({ id: g.id, desc: g.desc, amount: g.amount, cat: g.cat, shared: !!(g.shared && g.shared.active) })),
    subs: S.agenda.subs.map(s => ({ id: s.id, name: s.name, amount: s.amount, date: s.date })),
    vencs: S.agenda.vencimientos.map(v => ({ id: v.id, name: v.name, amount: v.amount, date: v.date, period: v.period })),
    cuotas: S.agenda.cuotas.map(c => ({ id: c.id, name: c.name, fee: c.fee, total: c.total, paid: c.paid })),
    plan: S.plan.map(p => ({ id: p.id, name: p.name, cat: p.cat, months: p.months })),
    saldo: S.accounts[0].amount,
  }));

  // ════ SUSCRIPCIÓN ════════════════════════════════════════════════════
  section('AGENDA · pagar una suscripción');
  await d.ev(() => {
    S.agenda.subs.push({ id: 's1', name: 'Netflix', amount: 12000, date: '2026-08-05', period: 'mensual' });
    save(); ensureAgendaInPlan(); save();
  });
  let a = await st();
  const filaNetflix = a.plan.find(p => p.name === 'Netflix');
  is(!!filaNetflix, 'crear la suscripción crea su fila en la Proyección');
  eq(filaNetflix && filaNetflix.cat, 'suscripciones', 'con la categoría correcta');

  const saldoAntes = a.saldo;
  await d.ev(() => { markSubPaid('s1'); confirmPayDeduct('acc1'); });
  await d.page.waitForTimeout(120);
  a = await st();

  const gNet = a.gastos.find(g => g.desc === 'Netflix');
  is(!!gNet, 'pagar la suscripción registra el gasto');
  eq(gNet && gNet.amount, 12000, 'por el importe de la suscripción');
  eq(gNet && gNet.cat, 'suscripciones', 'y en la categoría "suscripciones"');
  eq(a.saldo, saldoAntes - 12000, 'y descuenta el importe de la cuenta elegida');
  const sub1 = a.subs.find(s => s.id === 's1');
  is(sub1 && sub1.date > hoy(), 'la suscripción avanza a un vencimiento futuro');
  const mesActual = new Date().getMonth();
  is(!(a.plan.find(p => p.name === 'Netflix') || { months: {} }).months[mesActual],
    'y el mes ya pagado sale de la Proyección (no se proyecta dos veces)');

  // Deshacer
  section('AGENDA · deshacer el pago de la suscripción');
  await d.ev(() => undoLast());
  await d.page.waitForTimeout(120);
  a = await st();
  is(!a.gastos.find(g => g.desc === 'Netflix'), 'deshacer borra el gasto que se había registrado');
  eq(a.saldo, saldoAntes, 'devuelve la plata a la cuenta');
  eq(a.subs.find(s => s.id === 's1').date, '2026-08-05', 'y la suscripción vuelve a su fecha');
  eq((a.plan.find(p => p.name === 'Netflix') || {}).months[mesActual], 12000, 'y el mes vuelve a la Proyección');

  // ════ VENCIMIENTO ÚNICO ══════════════════════════════════════════════
  section('AGENDA · pagar un vencimiento de una sola vez');
  await d.ev(() => {
    S.agenda.vencimientos.push({ id: 'v1', name: 'Patente', amount: 45000, date: '2026-08-12', period: 'unica' });
    save(); ensureAgendaInPlan(); save();
  });
  const saldo2 = (await st()).saldo;
  await d.ev(() => { markVencPaid('v1'); confirmPayDeduct('acc1'); });
  await d.page.waitForTimeout(120);
  a = await st();
  is(!!a.gastos.find(g => g.desc === 'Patente'), 'se registra el gasto');
  eq(a.gastos.find(g => g.desc === 'Patente').cat, 'hogar', 'con la categoría de vencimiento');
  eq(a.saldo, saldo2 - 45000, 'se descuenta de la cuenta');
  is(!a.vencs.find(v => v.id === 'v1'), 'el vencimiento único sale de la Agenda al cumplirse');
  is(!a.plan.find(p => p.name === 'Patente'), 'y su fila sale de la Proyección (no queda proyectando para siempre)');

  await d.ev(() => undoLast());
  await d.page.waitForTimeout(120);
  a = await st();
  is(!!a.vencs.find(v => v.id === 'v1'), 'deshacer devuelve el vencimiento a la Agenda');
  is(!!a.plan.find(p => p.name === 'Patente'), 'y su fila a la Proyección');
  eq(a.saldo, saldo2, 'con el saldo restituido');

  // ════ VENCIMIENTO COMPARTIDO ═════════════════════════════════════════
  section('AGENDA · pagar un vencimiento compartido lo manda a Compartidos');
  await d.ev(() => {
    S.agenda.vencimientos.push({ id: 'v2', name: 'Expensas', amount: 90000, date: '2026-08-15',
      period: 'mensual', shared: { active: true, paidBy: 'fede', splitPct: 50 } });
    save();
  });
  await d.ev(() => { markVencPaid('v2'); confirmPayDeduct('acc1'); });
  await d.settle();
  await d.page.waitForTimeout(200);
  await d.settle();
  a = await st();
  const gExp = a.gastos.find(g => g.desc === 'Expensas');
  is(!!gExp, 'se registra el gasto');
  eq(gExp && gExp.shared, true, 'y queda marcado como compartido');
  const enBin = ((L.bins[BIN] || {}).gastos || []).some(g => g.desc === 'Expensas');
  eq(enBin, true, 'y sube al bin compartido sin tener que hacer nada más');
  await mile.ev(() => syncCompartidos(null)); await mile.settle();
  const loVeMile = await mile.ev(() => _sharedBinGastos.some(g => g.desc === 'Expensas'));
  eq(loVeMile, true, 'la pareja lo ve del otro lado');
  const deudaMile = await mile.ev(() => calcSharedDebtDetail().leDebés);
  eq(deudaMile, 45000, 'y le suma la mitad a lo que debe');
  eq(await d.ev(() => sharedPendientes().total), 0, 'sin nada pendiente de subir');

  // ════ CUOTAS ═════════════════════════════════════════════════════════
  section('CUOTAS · alta desde un gasto de tarjeta');
  await d.ev(() => {
    const now = new Date();
    S.gastos.push({ id: 'gc', desc: 'Notebook', cat: 'tarjeta', amount: 100000,
      month: now.getMonth(), year: now.getFullYear(), day: 3, addedAt: now.getTime(),
      cuotaActual: 1, cuotaTotal: 3 });
    save(); syncCuotasToAgenda(); ensureAgendaInPlan(); save();
  });
  a = await st();
  const cq = a.cuotas.find(c => c.name === 'Notebook');
  is(!!cq, 'la compra en cuotas aparece en la Agenda');
  eq(cq && cq.total, 3, 'con el total de cuotas');
  const filaCuota = a.plan.find(p => /^Notebook/.test(p.name));
  is(!!filaCuota, 'y con su fila en la Proyección');
  is(filaCuota && /\(\d+c\)$/.test(filaCuota.name), `la fila lleva el sufijo de cuotas que faltan (${filaCuota && filaCuota.name})`);

  section('CUOTAS · pagarlas hasta terminar');
  const saldo3 = (await st()).saldo;
  const cqId = cq.id;
  await d.ev((id) => { markCuotaPaid(id); confirmCuotaPay('acc1'); }, cqId);
  await d.page.waitForTimeout(150);
  a = await st();
  eq(a.cuotas.find(c => c.id === cqId).paid, 2, 'pagar una cuota avanza el contador');
  const gCuota = a.gastos.find(g => g.desc === 'Notebook' && g.id !== 'gc');
  is(!!gCuota, 'y registra el gasto de esa cuota');
  eq(gCuota && gCuota.cat, 'tarjeta', 'en la categoría tarjeta');
  eq(gCuota && gCuota.amount, 100000, 'por el importe de la cuota');
  eq(a.saldo, saldo3 - 100000, 'descontando de la cuenta');

  await d.ev((id) => { markCuotaPaid(id); confirmCuotaPay('acc1'); }, cqId);
  await d.page.waitForTimeout(150);
  a = await st();
  const cqFin = a.cuotas.find(c => c.id === cqId);
  eq(cqFin.paid, 3, 'la última cuota deja la compra en 3/3');
  is(!a.plan.find(p => /^Notebook/.test(p.name)), 'y la fila sale de la Proyección (ya no proyecta gasto)');

  // ════ BORRAR UNA CUOTA (el arreglo de #156, punta a punta) ═══════════
  section('CUOTAS · borrar una cuota no se deshace al recargar');
  await d.ev(() => {
    const now = new Date();
    S.gastos.push({ id: 'gp', desc: 'Prueba', cat: 'tarjeta', amount: 1,
      month: now.getMonth(), year: now.getFullYear(), day: 4, addedAt: now.getTime(),
      cuotaActual: 1, cuotaTotal: 3 });
    save(); syncCuotasToAgenda(); ensureAgendaInPlan(); save();
  });
  const idPrueba = await d.ev(() => (S.agenda.cuotas.find(c => c.name === 'Prueba') || {}).id);
  is(!!idPrueba, 'la cuota de prueba se creó');
  await d.ev((id) => delAgenda('cuota', id), idPrueba);
  await d.page.waitForTimeout(100);
  is(!(await st()).cuotas.find(c => c.name === 'Prueba'), 'borrarla la saca de la Agenda');
  // Recarga real de la app: load() vuelve a correr syncCuotasToAgenda().
  await d.page.reload();
  await d.page.waitForFunction(() => typeof S === 'object' && typeof syncCuotasToAgenda === 'function');
  await d.page.waitForTimeout(300);
  const trasRecarga = await d.ev(() => ({
    cuota: S.agenda.cuotas.some(c => c.name === 'Prueba'),
    fila: S.plan.some(p => /^Prueba/.test(p.name)),
    gasto: S.gastos.some(g => g.id === 'gp'),
  }));
  eq(trasRecarga.cuota, false, 'y tras RECARGAR la app sigue borrada');
  eq(trasRecarga.fila, false, 'sin volver a la Proyección');
  eq(trasRecarga.gasto, true, 'el gasto ya pagado se conserva en el historial (no se borra plata)');

  // El caso real reportado: la compra se anota con la fecha del vencimiento del
  // resumen (el 31, o un mes que todavía no llegó), así que el gasto queda con
  // fecha futura. Con la marca de borrado sellada solo con el reloj, el gasto
  // contaba como "compra nueva" y la cuota volvía en cada recarga.
  await d.ev(() => {
    const f = new Date(); f.setDate(f.getDate() + 20);
    S.gastos.push({ id: 'gz', desc: 'Cuota zapatillad', cat: 'tarjeta', amount: 36083,
      month: f.getMonth(), year: f.getFullYear(), day: f.getDate(), addedAt: f.getTime(),
      cuotaActual: 1, cuotaTotal: 3 });
    save(); syncCuotasToAgenda(); ensureAgendaInPlan(); save();
  });
  const idZapa = await d.ev(() => (S.agenda.cuotas.find(c => c.name === 'Cuota zapatillad') || {}).id);
  is(!!idZapa, 'una compra con fecha futura crea su cuota');
  await d.ev((id) => delAgenda('cuota', id), idZapa);
  await d.page.waitForTimeout(100);
  await d.page.reload();
  await d.page.waitForFunction(() => typeof S === 'object' && typeof syncCuotasToAgenda === 'function');
  await d.page.waitForTimeout(300);
  const trasRecargaFutura = await d.ev(() => ({
    cuota: S.agenda.cuotas.some(c => c.name === 'Cuota zapatillad'),
    fila: S.plan.some(p => /^Cuota zapatillad/.test(p.name)),
    marca: (S.agenda.cuotasBorradas || []).some(x => x.name === 'cuota zapatillad'),
  }));
  eq(trasRecargaFutura.cuota, false, 'borrada, no vuelve al recargar aunque el gasto sea futuro');
  eq(trasRecargaFutura.fila, false, 'ni reaparece su fila en la Proyección');
  eq(trasRecargaFutura.marca, true, 'y la marca de borrado sigue puesta después de recargar');

  // ════ PROYECCIÓN ↔ AGENDA ════════════════════════════════════════════
  section('PROYECCIÓN ↔ AGENDA · editar de un lado llega al otro');
  await d.ev(() => {
    const pi = S.plan.find(p => p.name === 'Netflix');
    syncPlanEditToAgenda('Netflix', 'Netflix', 15000);
    save();
  });
  eq(await d.ev(() => (S.agenda.subs.find(s => s.name === 'Netflix') || {}).amount), 15000,
    'cambiar el importe en la Proyección baja a la Agenda');
  await d.ev(() => { syncAgendaEditToPlan('Netflix', 'Netflix', 18000, '2026-09-05', 'mensual'); save(); });
  eq(await d.ev(() => (S.plan.find(p => p.name === 'Netflix') || { months: {} }).months[8]), 18000,
    'y editarlo en la Agenda sube a la Proyección');

  // ════ BORRAR DESDE LA PROYECCIÓN ═════════════════════════════════════
  section('PROYECCIÓN · borrar un concepto se lleva su ítem de Agenda');
  const idNetflix = await d.ev(() => (S.plan.find(p => p.name === 'Netflix') || {}).id);
  await d.ev((id) => deletePlanItemWithSync(id, 'Netflix'), idNetflix);
  a = await st();
  is(!a.plan.find(p => p.name === 'Netflix'), 'sale de la Proyección');
  is(!a.subs.find(s => s.name === 'Netflix'), 'y también de la Agenda (si no, volvería a aparecer sola)');

  section('ERRORES · JS durante toda la corrida');
  eq(d.errors, [], 'ningún error de página');
  eq(mile.errors, [], 'tampoco en el segundo dispositivo');

  console.log(`\n${'─'.repeat(52)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  await browser.close();
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error('ERROR:', e); process.exit(2); });
