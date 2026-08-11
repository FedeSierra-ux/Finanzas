// AUDITORÍA 5 — TRANSFERENCIAS: corregir una que ya estaba confirmada, con el
// PUT fallando. Es el caso que abrió el sacar la restricción de "solo el
// pagador edita": ahora la corrección se puede hacer desde los dos lados, así
// que tiene que llegar al bin igual que la de un gasto.
const L = require('./lib');
const { eq, is, section } = L;
const BIN = 'bin5';

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const fede = await L.device(browser, { myName: 'fede', compBin: BIN });
  const mile = await L.device(browser, { myName: 'mile', compBin: BIN });

  const sync = async (d) => { await d.ev(() => syncCompartidos(null)); await d.settle(); };

  section('TRANSFERENCIAS · corregir el importe con la red caída');

  // Un gasto para que haya deuda, y una transferencia que sí sube.
  await fede.ev(async () => {
    S.gastos.push({ id: 'g1', desc: 'Alquiler', amount: 400000, cat: 'hogar', month: 7, year: 2026,
      addedAt: new Date(2026, 7, 3, 12).getTime(), shared: { active: true, paidBy: 'fede', splitPct: 50 } });
    save(); await upsertSharedBinGasto(S.gastos[0]);
  });
  await fede.settle();

  await fede.ev(async () => {
    const p = stampShared({ id: 'p1', paidBy: 'mile', amount: 100000, desc: 'Transferencia',
      date: '2026-08-20', addedAt: Date.now() });
    const arr = getSharedPayments(); arr.push(p); saveSharedPayments(arr);
    _sharedBinPayments = [..._sharedBinPayments, p];
    await queueSharedBinWrite(async () => { await fetchSharedBin(); await pushSharedBin(); });
  });
  await fede.settle();

  eq(((L.bins[BIN] || {}).payments || []).map(p => p.amount), [100000], 'la transferencia arranca subida al bin');
  eq(await fede.ev(() => sharedPendientes().total), 0, 'y sin nada pendiente');

  // Ahora se corrige el importe (estaba mal tipeado) y el PUT falla.
  L.net.putFail = true;
  await fede.ev(() => {
    openEditSharedPayment('p1');
    _spPayer = 'mile';
    document.getElementById('sp-amount').value = '65000';
    document.getElementById('sp-desc').value = 'Transferencia';
    doSaveSharedPayment();
  });
  await fede.settle();
  await fede.page.waitForTimeout(150);
  await fede.settle();

  const local = await fede.ev(() => getSharedPayments().find(p => p.id === 'p1').amount);
  eq(local, 65000, 'la corrección queda guardada en local');
  eq(((L.bins[BIN] || {}).payments || [])[0].amount, 100000, 'y el bin remoto todavía tiene el importe viejo');

  const pend = await fede.ev(() => sharedPendientes());
  console.log('    pendientes tras el push fallido:', JSON.stringify({ total: pend.total, pays: pend.pays.map(p => p.id) }));
  eq(pend.total, 1, 'la transferencia corregida tiene que contar como pendiente de subir');

  // Vuelve la red: el reintento automático tiene que llevarla.
  L.net.putFail = false;
  await fede.ev(() => reintentarPendientesCompartidos());
  await fede.settle();
  const enBin = ((L.bins[BIN] || {}).payments || []);
  eq(enBin.length, 1, 'la corrección no duplica la transferencia en el bin');
  eq(enBin[0] && enBin[0].amount, 65000, 'y el bin queda con el importe corregido');

  // Y la pareja tiene que ver la misma deuda, no una distinta.
  await sync(mile);
  const dF = await fede.ev(() => calcSharedDebtDetail().saldo);
  const dM = await mile.ev(() => calcSharedDebtDetail().saldo);
  console.log('    saldo fede:', dF, ' saldo mile:', dM);
  eq(dM, -dF, 'los dos dispositivos ven la misma deuda (sin divergencia silenciosa)');
  eq(await mile.ev(() => _allKnownPayments().find(p => p.id === 'p1').amount), 65000,
    'y la pareja ve el importe corregido');
  eq(await fede.ev(() => sharedPendientes().total), 0, 'sin nada pendiente al final');

  section('ERRORES · JS durante la corrida');
  eq(fede.errors, [], 'ningún error de página');
  eq(mile.errors, [], 'tampoco en el segundo dispositivo');

  console.log(`\n${'─'.repeat(52)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  await browser.close();
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error('ERROR:', e); process.exit(2); });
