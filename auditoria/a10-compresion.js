// AUDITORÍA 10 — COMPRESIÓN DEL BIN PERSONAL: que solo se comprima cuando el
// payload no entra en los 100kb de JSONBin, que un payload que entra viaje
// exactamente igual que antes, y que otro dispositivo (y la pareja) lo lea.
const L = require('./lib');
const { eq, is, section } = L;

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const now = new Date(), M = now.getMonth(), Y = now.getFullYear();
  const mkGastos = (n) => Array.from({ length: n }, (_, i) => ({
    id: 'g' + i, desc: 'Gasto número ' + i + ' en algún lugar', cat: ['comida', 'super', 'salidas', 'hogar'][i % 4],
    amount: 1000 + (i * 37) % 90000, month: (M - (i % 12) + 12) % 12, year: M - (i % 12) < 0 ? Y - 1 : Y, day: 1 + (i % 27),
    addedAt: new Date(Y, M, 1 + (i % 27), 12).getTime() - i * 1000,
    ...(i % 5 === 0 ? { shared: { active: true, paidBy: i % 2 ? 'mile' : 'fede', splitPct: 50 } } : {}),
  }));
  const conf = (d, bin) => d.ev((b) => { localStorage.setItem('fin_sync_bin_id', b); localStorage.setItem('fin_sync_api_key', 'k'); }, bin);

  section('COMPRESIÓN · un payload que entra en 100kb viaja igual que siempre');
  const a = await L.device(browser, { myName: 'fede', compBin: 'cmpA', seed: { gastos: mkGastos(40) } });
  await conf(a, 'personalA');
  await a.page.waitForTimeout(300);
  await a.ev(() => syncPush(true));
  await a.page.waitForTimeout(400);
  const chico = L.bins.personalA;
  is(!!chico, 'se subió el bin');
  is(chico && typeof chico.fin_v6 === 'object', 'fin_v6 va como objeto, sin comprimir');

  section('COMPRESIÓN · uno que no entra se comprime y se sube');
  await a.ev((g) => { S.gastos = g; save(); }, mkGastos(2600));
  await a.page.waitForTimeout(400);
  const crudo = await a.ev(() => new Blob([JSON.stringify(buildSyncPayload())]).size);
  is(crudo > 100 * 1024, `sin comprimir pesaría ${(crudo / 1024).toFixed(0)}kb (más que el tope)`);
  await a.ev(() => syncPush(true));
  await a.page.waitForTimeout(800);
  const grande = L.bins.personalA;
  is(typeof grande.fin_v6 === 'string' && grande.fin_v6.startsWith('gz1:'), 'fin_v6 viaja comprimido');
  const peso = Buffer.byteLength(JSON.stringify(grande));
  is(peso < 100 * 1024, `y el bin queda en ${(peso / 1024).toFixed(0)}kb`);
  is(typeof grande.shared_payments !== 'string' && typeof grande._syncTs === 'number', 'lo demás (transferencias, sello de tiempo) sigue sin comprimir');
  const estado = await a.ev(() => document.getElementById('sync-status-box')?.textContent || '');
  is(/comprimido/.test(estado), `el cartel de estado lo dice ("${estado.trim().slice(0, 60)}")`);

  section('COMPRESIÓN · otro dispositivo lo lee');
  const b = await L.device(browser, { myName: 'fede', compBin: 'cmpA', seed: { gastos: [] } });
  await conf(b, 'personalA');
  await b.page.waitForTimeout(300);
  await b.ev(() => { localStorage.removeItem('fin_v6'); S.gastos = []; });
  await b.ev(() => syncPull(true));
  await b.page.waitForTimeout(800);
  eq(await b.ev(() => JSON.parse(localStorage.getItem('fin_v6')).gastos.length), 2600, 'el segundo dispositivo baja los 2600 gastos');

  section('COMPRESIÓN · la pareja lee los compartidos del bin comprimido');
  const m = await L.device(browser, { myName: 'mile', compBin: 'cmpA', partnerBin: 'personalA' });
  await m.ev(() => { localStorage.setItem('fin_sync_api_key', 'k'); });
  await m.ev(() => fetchPartnerGastos());
  await m.page.waitForTimeout(600);
  eq(await m.ev(() => _partnerGastos.length), 520, 'Mile ve los 520 gastos compartidos de Fede');

  section('ERRORES · JS durante toda la corrida');
  eq(a.errors, [], 'ningún error de página');
  eq(b.errors.concat(m.errors), [], 'tampoco en los otros dispositivos');

  console.log(`\n${'─'.repeat(52)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  await browser.close();
  process.exit(L.results.fail ? 1 : 0);
})();
