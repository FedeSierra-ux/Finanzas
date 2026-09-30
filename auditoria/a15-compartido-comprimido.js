// AUDITORÍA 15 — BIN COMPARTIDO COMPRIMIDO (v34.3): crudo mientras entra en los 100 kB (así un teléfono con la
// versión anterior lo sigue leyendo), gz1 recién cuando no entra, lectura de los dos formatos, el aviso a la
// pareja y que nada se pierda al pasar de un formato al otro.
const L = require('./lib');
const { eq, is, section } = L;
const BIN = 'bin15';
const fill = (n, prefix = 'r') => Array.from({ length: n }, (_, i) => ({
  id: prefix + i, desc: 'Gasto compartido de relleno número ' + i, amount: 1000 + i, cat: ['super', 'hogar', 'salidas'][i % 3], month: i % 12, year: 2026, day: 1 + i % 27,
  addedAt: Date.UTC(2026, i % 12, 1 + i % 27, 15), updatedAt: Date.UTC(2026, i % 12, 1 + i % 27, 15),
  shared: { active: true, paidBy: i % 2 ? 'mile' : 'fede', splitPct: 50 },
}));
const kb = () => Buffer.byteLength(JSON.stringify(L.bins[BIN])) / 1024;
const alta = (dev, desc, amt) => dev.ev(async ({ desc, amt }) => {
  _gSaving = false; openGastoModal(); $('gdesc').value = desc; $('gamt').value = amt;
  $('g-shared-toggle').click(); document.querySelector('#ov-gasto .btnp').click();
}, { desc, amt });
const sync = async (d) => { await d.ev(() => syncCompartidos(null)); await d.settle(); };

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const fede = await L.device(browser, { myName: 'fede', compBin: BIN });
  const mile = await L.device(browser, { myName: 'mile', compBin: BIN });
  for (const d of [fede, mile]) await d.ev(() => clearInterval(_sharedAutoTimer));

  section('COMPARTIDO GZ · mientras entra, se sube crudo (compatible con la versión anterior)');
  L.bins[BIN] = { gastos: fill(60), payments: [], tombstones: {}, payTombstones: {}, cats: {}, _ts: 1 };
  await sync(fede); await alta(fede, 'Uno chico', 1500); await fede.settle();
  const r1 = L.bins[BIN];
  is(Array.isArray(r1.gastos) && !r1._fmt, 'el bin chico queda como siempre: { gastos, payments, … } sin comprimir');
  is(r1.gastos.length === 61 && kb() < 100, `61 gastos = ${kb().toFixed(0)} kB, crudo`);
  is(typeof r1.apps === 'object' && Object.values(r1.apps).includes(await fede.ev(() => APP_VERSION)), 'y lleva apps:{teléfono: versión} para saber quién está actualizado');

  section('COMPARTIDO GZ · cuando no entra, se comprime y cabe');
  L.bins[BIN] = { gastos: fill(445), payments: [], tombstones: {}, payTombstones: {}, cats: {}, _ts: 2 };
  const crudo = kb();
  is(crudo > 97 && crudo < 100, `el bin crudo ya está al borde (${crudo.toFixed(0)} kB)`);
  await fede.clearToasts();
  await sync(fede);
  await alta(fede, 'El que ya no entraba', 4321); await fede.settle();
  const r2 = L.bins[BIN];
  is(r2._fmt === 'gz1' && typeof r2.data === 'string' && r2.data.startsWith('gz1:'), 'pasa a formato gz1');
  is(kb() < 60, `y queda en ${kb().toFixed(0)} kB (antes ${crudo.toFixed(0)} kB)`);
  is(r2.gastos === undefined && /Actualiz/i.test(r2._upgrade || ''), 'una app vieja no encuentra `gastos` y el bin trae el cartel _upgrade');
  const aviso = (await fede.toasts()).filter(t => /comprimido/.test(t));
  is(aviso.length === 1, 'la app avisa una sola vez que la pareja tiene que actualizar (hoy no hay señal de que lo haya hecho)');
  eq(await fede.ev(() => sharedPendientes().total), 0, 'sin pendientes');

  section('COMPARTIDO GZ · la pareja lo lee y escribe de vuelta');
  await sync(mile);
  const eM = await mile.ev(() => ({ n: _sharedBinGastos.length, tiene: _sharedBinGastos.some(g => g.desc === 'El que ya no entraba'), saldo: calcSharedDebtDetail().saldo }));
  const eF = await fede.ev(() => ({ n: _sharedBinGastos.length, saldo: calcSharedDebtDetail().saldo }));
  eq([eM.n, eM.tiene], [eF.n, true], `Mile lee los ${eF.n} gastos del bin comprimido`);
  eq(eM.saldo, -eF.saldo, 'y la deuda coincide exactamente en los dos');
  await alta(mile, 'Respuesta de Mile', 999); await mile.settle();
  is(L.bins[BIN]._fmt === 'gz1', 'Mile escribe en el mismo formato');
  await sync(fede);
  eq(await fede.ev(() => _sharedBinGastos.some(g => g.desc === 'Respuesta de Mile')), true, 'y Fede recibe lo de Mile');
  is(Object.keys(L.bins[BIN].apps).length >= 2, 'con los dos teléfonos en el mapa apps, ya no hay motivo de aviso');

  section('COMPARTIDO GZ · borrar, tombstones y escala');
  const id = await fede.ev(() => _sharedBinGastos.find(g => g.desc === 'El que ya no entraba').id);
  await fede.ev((id) => removeSharedBinGasto(id), id); await fede.settle(); await sync(mile); await sync(fede);
  eq([await fede.ev((id) => _sharedBinGastos.some(g => g.id === id), id), await mile.ev((id) => _sharedBinGastos.some(g => g.id === id), id)], [false, false], 'un borrado viaja en el bin comprimido y nadie lo ve');
  L.bins[BIN].gastos === undefined;
  L.bins[BIN] = { gastos: fill(1500, 'e'), payments: [], tombstones: {}, payTombstones: {}, cats: {}, _ts: 3 };
  console.log(`   · bin de 1.500 gastos crudo: ${kb().toFixed(0)} kB`);
  await sync(fede); await alta(fede, 'Con mil quinientos', 100); await fede.settle();
  is(L.bins[BIN]._fmt === 'gz1' && kb() < 100, `1.500 gastos compartidos entran comprimidos (${kb().toFixed(0)} kB de 100)`);
  // Bin que alguien escribió comprimido con basura: no se pisa
  const antes = JSON.stringify(L.bins[BIN]);
  L.bins[BIN].data = 'gz1:AAAA';
  await fede.ev(() => syncCompartidos(null)); await fede.settle();
  is(JSON.stringify(L.bins[BIN]).includes('gz1:AAAA'), 'con el bin comprimido ilegible no se escribe nada encima (no se pierde la copia buena)');

  section('ERRORES');
  eq(fede.errors.concat(mile.errors), [], 'ningún error de JS');
  console.log(`\n${'─'.repeat(52)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  await browser.close();
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error('ERROR:', e); process.exit(2); });
