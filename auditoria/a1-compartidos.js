// AUDITORÍA 1 — COMPARTIDOS: meses de uso entre dos dispositivos.
const L = require('./lib');
const { eq, is, section } = L;

const BIN = 'binCompartido';

// Un gasto compartido tal como lo crea la app.
const gasto = (id, { desc, amount, cat = 'super', paidBy, splitPct = 50, mes, anio = 2026, dia = 10 }) => ({
  id, desc, amount, cat, month: mes, year: anio, day: dia,
  addedAt: new Date(anio, mes, dia, 12).getTime(),
  shared: { active: true, paidBy, splitPct },
});

// Alta de un gasto compartido por el camino real de sync.
const alta = (dev, g) => dev.ev(async (g) => {
  S.gastos.push(g); save();
  await upsertSharedBinGasto(S.gastos[S.gastos.length - 1]);
}, g);

const estado = (dev) => dev.ev(() => ({
  saldo: calcSharedDebtDetail().saldo,
  laParejaTeDebe: calcSharedDebtDetail().laParejaTeDebe,
  leDebes: calcSharedDebtDetail().leDebés,
  gastosContados: calcSharedDebtDetail().gastosContados,
  pagosContados: calcSharedDebtDetail().pagosContados,
  pendientes: sharedPendientes().total,
  binIds: _sharedBinGastos.map(g => g.id).sort(),
  binPays: _sharedBinPayments.map(p => p.id).sort(),
  locales: S.gastos.filter(g => g.shared && g.shared.active).map(g => g.id).sort(),
  yo: getMyName(),
}));

const sync = async (dev) => { await dev.ev(() => syncCompartidos(null)); await dev.settle(); };

(async () => {
  const browser = await L.launch();
  L.resetBins();

  const fede = await L.device(browser, { myName: 'fede', compBin: BIN });
  const mile = await L.device(browser, { myName: 'mile', compBin: BIN });

  // ── Meses de gastos alternados ────────────────────────────────────────
  section('COMPARTIDOS · seis meses de gastos entre dos dispositivos');

  // mes → [ {quien, desc, monto, pagó, split} ]
  const meses = [
    [['fede', 'Super', 48200, 'fede', 50], ['mile', 'Verdulería', 12400, 'mile', 50], ['fede', 'Luz', 31000, 'fede', 50]],
    [['fede', 'Super', 52100, 'fede', 50], ['mile', 'Farmacia', 8900, 'mile', 0], ['mile', 'Cena', 41000, 'mile', 50]],
    [['fede', 'Alquiler', 480000, 'fede', 50], ['fede', 'Regalo Mile', 60000, 'fede', 100], ['mile', 'Super', 44300, 'mile', 50]],
    [['mile', 'Internet', 29900, 'mile', 50], ['fede', 'Super', 51200, 'fede', 50], ['fede', 'Nafta', 38000, 'fede', 70]],
    [['fede', 'Super', 55000, 'fede', 50], ['mile', 'Gimnasio', 27300, 'mile', 0], ['mile', 'Delivery', 19500, 'mile', 50]],
    [['fede', 'Alquiler', 510000, 'fede', 50], ['mile', 'Super', 47800, 'mile', 50], ['fede', 'Peluquería', 22000, 'fede', 0]],
  ];

  let n = 0;
  const esperado = { pareja: 0, mia: 0 }; // calculado a mano, desde la óptica de fede
  for (let mi = 0; mi < meses.length; mi++) {
    for (const [quien, desc, monto, pago, split] of meses[mi]) {
      const dev = quien === 'fede' ? fede : mile;
      const g = gasto('g' + (++n), { desc, amount: monto, paidBy: pago, splitPct: split, mes: 2 + mi });
      await alta(dev, g);
      // Contabilidad de referencia, independiente de la app: el que NO pagó
      // debe (100-split)% del gasto.
      const debeElOtro = Math.round(monto * (100 - split) / 100);
      if (pago === 'fede') esperado.pareja += debeElOtro; else esperado.mia += debeElOtro;
    }
    await fede.settle(); await mile.settle();
    await sync(fede); await sync(mile); await sync(fede);
  }

  const eF = await estado(fede), eM = await estado(mile);
  eq(eF.binIds.length, n, `los ${n} gastos de los seis meses están en el bin`);
  eq(eF.binIds, eM.binIds, 'los dos dispositivos ven exactamente el mismo conjunto');
  eq(new Set(eF.binIds).size, eF.binIds.length, 'sin ids duplicados en el bin');
  eq(eF.gastosContados, n, 'la deuda se calcula sobre todos los gastos');
  eq(eM.gastosContados, n, 'y la pareja cuenta los mismos');
  eq(eF.pendientes, 0, 'nada quedó sin subir en el dispositivo de Fede');
  eq(eM.pendientes, 0, 'ni en el de Mile');

  // Contabilidad: el saldo tiene que coincidir con la cuenta hecha aparte.
  eq(eF.laParejaTeDebe, esperado.pareja, 'lo que la pareja le debe a Fede coincide con la cuenta a mano');
  eq(eF.leDebes, esperado.mia, 'y lo que Fede le debe también');
  eq(eF.saldo, esperado.pareja - esperado.mia, 'el saldo de Fede es la diferencia');
  eq(eM.saldo, -eF.saldo, 'y el de Mile es exactamente el opuesto (misma deuda, dos ópticas)');

  // ── Los porcentajes raros ─────────────────────────────────────────────
  section('COMPARTIDOS · cómo cae cada porcentaje de división');
  const detalle = await fede.ev(() => calcSharedDebtDetail().gastos);
  const porDesc = d => detalle.find(x => x.desc === d);
  eq(porDesc('Regalo Mile').leDebeAlOtro, 0, 'split 100% (todo mío) no genera deuda del otro');
  eq(porDesc('Farmacia').leDebeAlOtro, 8900, 'split 0% (todo del otro) genera la deuda completa');
  eq(porDesc('Gimnasio').leDebeAlOtro, 27300, 'y también cuando lo pagó la pareja');
  eq(porDesc('Nafta').leDebeAlOtro, Math.round(38000 * 0.3), 'un 70/30 reparte proporcional');
  eq(porDesc('Super').leDebeAlOtro, Math.round(48200 * 0.5), 'el 50/50 parte al medio');

  // ── Liquidar ──────────────────────────────────────────────────────────
  section('COMPARTIDOS · liquidar la deuda');
  const antes = (await estado(fede)).saldo;
  const montoLiq = 100000;
  // Mile le transfiere a Fede: baja lo que la pareja le debe a Fede.
  await mile.ev(async (m) => {
    _spPayer = 'mile';
    const p = stampShared({ id: 'pay1', paidBy: 'mile', amount: m, desc: 'Transferencia', date: '2026-08-20', addedAt: Date.now() });
    const arr = getSharedPayments(); arr.push(p); saveSharedPayments(arr);
    _sharedBinPayments = [..._sharedBinPayments, p];
    await queueSharedBinWrite(async () => { await fetchSharedBin(); await pushSharedBin(); });
  }, montoLiq);
  await mile.settle();
  await sync(fede); await sync(mile);

  const desp = await estado(fede), despM = await estado(mile);
  eq(desp.saldo, antes - montoLiq, 'la transferencia de Mile baja la deuda exactamente en su importe');
  eq(despM.saldo, -desp.saldo, 'y los dos dispositivos siguen viendo la misma deuda');
  eq(desp.pagosContados, 1, 'la transferencia se cuenta una sola vez');
  eq(despM.pagosContados, 1, 'también del otro lado');
  eq(desp.binPays, ['pay1'], 'y viajó al bin');

  // ── Edición cruzada ───────────────────────────────────────────────────
  section('COMPARTIDOS · editar un gasto que cargó el otro');
  const saldoPrevio = (await estado(fede)).saldo;
  // Mile corrige el importe de un gasto que cargó Fede (g1: Super 48200 → 60000).
  await mile.ev(async () => {
    const g = _sharedBinGastos.find(x => x.id === 'g1');
    const local = { ...g, amount: 60000 };
    const li = S.gastos.findIndex(x => x.id === 'g1');
    if (li >= 0) S.gastos[li] = local; else S.gastos.push(local);
    save();
    await upsertSharedBinGasto(S.gastos.find(x => x.id === 'g1'));
  });
  await mile.settle();
  await sync(fede); await sync(mile);

  const eF2 = await estado(fede);
  const g1F = await fede.ev(() => (_sharedBinGastos.find(g => g.id === 'g1') || {}).amount);
  eq(g1F, 60000, 'la corrección de Mile llega al bin');
  eq(eF2.saldo, saldoPrevio + Math.round((60000 - 48200) * 0.5), 'y el saldo se recalcula con el importe nuevo');
  eq(eF2.binIds.length, n, 'editar no duplica el gasto');
  const g1Local = await fede.ev(() => (S.gastos.find(g => g.id === 'g1') || {}).amount);
  eq(g1Local, 60000, 'y la copia local de Fede también queda corregida (no solo la vista Compartidos)');

  // ── Borrado con tombstone ─────────────────────────────────────────────
  section('COMPARTIDOS · borrar un gasto y que no vuelva');
  const saldoAntesDel = (await estado(fede)).saldo;
  const montoBorrado = 22000; // Peluquería, split 0, pagó fede → la pareja debe 22000
  await fede.ev(async () => { await removeSharedBinGasto("g18"); });
  await fede.settle();
  await sync(fede); await sync(mile); await sync(fede); await sync(mile);

  const eF3 = await estado(fede), eM3 = await estado(mile);
  is(!eF3.binIds.includes('g18'), 'el gasto borrado sale del bin');
  is(!eM3.binIds.includes('g18'), 'y desaparece también en el otro dispositivo');
  eq(eF3.saldo, saldoAntesDel - montoBorrado, 'la deuda baja en lo que aportaba ese gasto');
  eq(eM3.saldo, -eF3.saldo, 'y los dos siguen de acuerdo');

  // Varias vueltas más: el tombstone tiene que aguantar.
  for (let i = 0; i < 3; i++) { await sync(fede); await sync(mile); }
  const eF4 = await estado(fede), eM4 = await estado(mile);
  is(!eF4.binIds.includes('g18'), 'después de varias sincronizaciones sigue borrado');
  is(!eM4.binIds.includes('g18'), 'en los dos dispositivos');
  eq(eF4.locales.includes('g18'), false, 'y tampoco vuelve a la lista local');

  // ── Caída de red y reintento ──────────────────────────────────────────
  section('COMPARTIDOS · se corta la red mientras se carga');
  L.net.putFail = true;
  await fede.clearToasts();
  for (let i = 0; i < 3; i++) {
    await alta(fede, gasto('sin' + i, { desc: 'Sin red ' + i, amount: 1000 * (i + 1), paidBy: 'fede', splitPct: 50, mes: 7, dia: 25 }));
  }
  await fede.settle();
  const caida = await estado(fede);
  eq(caida.pendientes, 3, 'los tres gastos quedan marcados como pendientes de subir');
  const toasts = await fede.toasts();
  const avisos = toasts.filter(t => /no se pudo|Sin conexión|No se pudo/i.test(t));
  is(avisos.length <= 1, `no se encima un cartel por gasto (salieron ${avisos.length})`);

  // Vuelve la red: el reintento automático tiene que resolverlo solo.
  L.net.putFail = false;
  await fede.ev(() => reintentarPendientesCompartidos());
  await fede.settle();
  await sync(mile);
  const rec = await estado(fede), recM = await estado(mile);
  eq(rec.pendientes, 0, 'al volver la red el reintento sube todo lo pendiente');
  is(['sin0', 'sin1', 'sin2'].every(id => rec.binIds.includes(id)), 'los tres gastos están en el bin');
  is(['sin0', 'sin1', 'sin2'].every(id => recM.binIds.includes(id)), 'y le llegan a la pareja');
  eq(recM.saldo, -rec.saldo, 'la deuda vuelve a coincidir en los dos lados');

  // ── El GET cae: no se puede pisar el bin ──────────────────────────────
  section('COMPARTIDOS · con el bin ilegible no se sobreescribe nada');
  const binAntes = JSON.stringify(L.bins[BIN]);
  L.net.getFail = true;
  await fede.ev(async () => {
    S.gastos.push({ id: 'zz', desc: 'Fantasma', amount: 999, cat: 'super', month: 7, year: 2026,
      addedAt: Date.now(), shared: { active: true, paidBy: 'fede', splitPct: 50 } });
    save();
    await upsertSharedBinGasto(S.gastos[S.gastos.length - 1]);
  });
  await fede.settle();
  await fede.ev(() => syncCompartidos(null));
  await fede.settle();
  L.net.getFail = false;
  eq(JSON.stringify(L.bins[BIN]) === binAntes, true, 'con el GET caído el bin remoto queda intacto (no se pisa con caché vieja)');

  // Y al volver la red, ese gasto sube.
  await sync(fede); await sync(mile);
  const fin = await estado(fede), finM = await estado(mile);
  is(fin.binIds.includes('zz'), 'recuperada la red, el gasto que había quedado local sube');
  is(finM.binIds.includes('zz'), 'y le llega a la pareja');
  eq(fin.pendientes, 0, 'sin pendientes al final');
  eq(finM.pendientes, 0, 'de ninguno de los dos lados');
  eq(finM.saldo, -fin.saldo, 'y la deuda cierra igual en los dos');

  // ── Errores de página ─────────────────────────────────────────────────
  section('COMPARTIDOS · errores de JS durante toda la corrida');
  eq(fede.errors, [], 'ningún error de página en el dispositivo de Fede');
  eq(mile.errors, [], 'ninguno en el de Mile');

  console.log(`\nRequests al bin: ${L.stats.get} GET + ${L.stats.put} PUT = ${L.stats.http}`);
  console.log(`\n${'─'.repeat(52)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  await browser.close();
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error('ERROR:', e); process.exit(2); });
