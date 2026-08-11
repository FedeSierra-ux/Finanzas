// Reproducción aislada de los dos hallazgos que salieron de la corrida larga.
const L = require('./lib');
const { eq, is, section } = L;
const BIN = 'bin2';

(async () => {
  const browser = await L.launch();

  // ══ HALLAZGO 1 ═════════════════════════════════════════════════════════
  // Editar un gasto compartido desde la pestaña GASTOS (doSaveEditGasto)
  // revierte la edición sola.
  L.resetBins();
  const d = await L.device(browser, { myName: 'fede', compBin: BIN });

  section('HALLAZGO 1 · editar un gasto compartido desde la pestaña Gastos');

  // Alta normal de un gasto compartido, subido al bin.
  await d.ev(async () => {
    S.gastos.push({ id: 'gx', desc: 'Super', amount: 10000, cat: 'super',
      month: 7, year: 2026, day: 5, addedAt: new Date(2026, 7, 5, 12).getTime(),
      shared: { active: true, paidBy: 'fede', splitPct: 50 } });
    save();
    await upsertSharedBinGasto(S.gastos[0]);
  });
  await d.settle();
  eq(await d.ev(() => (L => L)(_sharedBinGastos[0].amount)), 10000, 'el gasto arranca en $10.000 y está en el bin');
  const tsAntes = await d.ev(() => S.gastos[0].updatedAt);
  is(typeof tsAntes === 'number' && tsAntes > 0, 'y quedó sellado con updatedAt');

  // Ahora el usuario lo edita desde la pestaña Gastos: abre el modal, cambia el
  // importe y guarda. Se maneja el DOM real, no una simulación.
  await d.ev(() => { openEditGasto(S.gastos.find(x=>x.id==='gx')); });
  await d.page.waitForTimeout(120);
  await d.page.fill('#eg-amt', '99000');
  await d.page.fill('#eg-desc', 'Super corregido');
  await d.ev(() => { doSaveEditGasto(); });
  await d.settle();
  await d.page.waitForTimeout(200);
  await d.settle();

  const post = await d.ev(() => ({
    local: { desc: S.gastos[0].desc, amount: S.gastos[0].amount },
    bin: { desc: _sharedBinGastos[0].desc, amount: _sharedBinGastos[0].amount },
  }));
  console.log('    estado tras guardar:', JSON.stringify(post));
  eq(post.local.amount, 99000, 'el importe corregido queda en el gasto local');
  eq(post.local.desc, 'Super corregido', 'y la descripción corregida también');
  eq(post.bin.amount, 99000, 'y la corrección llega al bin (lo que ve la pareja)');
  eq(post.bin.desc, 'Super corregido', 'con la descripción nueva');

  // Y lo que quedó escrito de verdad en el bin remoto.
  const remoto = (L.bins[BIN].gastos || []).find(g => g.id === 'gx');
  eq(remoto && remoto.amount, 99000, 'el bin remoto termina con el importe corregido');

  await d.close();

  // ══ HALLAZGO 2 ═════════════════════════════════════════════════════════
  // Con el PUT fallando, _sharedBinGastos se actualiza igual, así que el
  // contador de pendientes dice 0 y el reintento automático no arranca.
  L.resetBins();
  const e = await L.device(browser, { myName: 'fede', compBin: BIN });

  section('HALLAZGO 2 · un push que falla no deja rastro de "falta subir"');

  L.net.putFail = true;
  await e.ev(async () => {
    S.gastos.push({ id: 'gy', desc: 'Sin red', amount: 5000, cat: 'super',
      month: 7, year: 2026, day: 6, addedAt: Date.now(),
      shared: { active: true, paidBy: 'fede', splitPct: 50 } });
    save();
    await upsertSharedBinGasto(S.gastos[0]);
  });
  await e.settle();

  const enBinRemoto = ((L.bins[BIN] || {}).gastos || []).some(g => g.id === 'gy');
  eq(enBinRemoto, false, 'con el PUT caído el gasto NO llegó al bin (la pareja no lo tiene)');

  const st = await e.ev(() => ({
    pendientes: sharedPendientes().total,
    enMemoria: _sharedBinGastos.some(g => g.id === 'gy'),
    marcadoSync: !!S.gastos[0]._sharedBinSynced,
  }));
  console.log('    estado tras el push fallido:', JSON.stringify(st));
  eq(st.pendientes, 1, 'el contador tiene que decir que falta subir 1');
  eq(st.enMemoria, true, '(la copia en memoria del bin sí lo tiene, por eso el contador se confunde)');

  // Y la consecuencia directa: el reintento automático no hace nada.
  L.net.putFail = false;
  const r = await e.ev(() => reintentarPendientesCompartidos());
  await e.settle();
  const trasReintento = ((L.bins[BIN] || {}).gastos || []).some(g => g.id === 'gy');
  eq(trasReintento, true, 'al volver la red, el reintento automático lo sube');
  console.log('    reintentarPendientesCompartidos() devolvió:', r);

  await e.close();

  console.log(`\n${'─'.repeat(52)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  await browser.close();
})().catch(e => { console.error('ERROR:', e); process.exit(2); });
