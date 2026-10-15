// La v34.22 en el Plan: abajo quedan "Resultado del mes" (saldo en bancos + lo
// que falta cobrar − lo que falta pagar) y "Neto" (inversiones + resultado), y
// ya no está "Cierre del mes". El caso que lo disparó: cargar el sueldo,
// cobrarlo a una cuenta y corregir el saldo del banco dejaba el Resultado en
// +3,9M, porque el sueldo contaba en la cuenta y otra vez en el Resultado. El
// "Neto proyectado" de Saldos suma también las inversiones. Con la v34.21 cada
// sección termina en ✗.
const L = require('./lib');

(async () => {
  const browser = await L.launch();
  const now = new Date(), M = now.getMonth(), Y = now.getFullYear();
  const pk = i => { const d = new Date(Y, M + i, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const mens = (v, desde) => Object.fromEntries([0, 1, 2, 3, 4, 5].filter(i => i >= desde).map(i => [pk(i), v]));
  L.resetBins();
  const d = await L.device(browser, { myName: 'fede', compBin: null, seed: {
    accounts: [{ id: 'a1', name: 'Galicia', type: 'bancaria', amount: 590000, currency: 'ARS' },
               { id: 'a2', name: 'FCI', type: 'inversión', amount: 1200000, currency: 'ARS' }],
    plan: [{ id: 'i1', name: 'Sueldos', cat: 'ingreso', months: mens(3900000, 0), order: 1 },
           { id: 'g1', name: 'Alquiler', cat: 'gasto', months: mens(699000, 1), order: 2 },
           { id: 'g2', name: 'Uber one', cat: 'gasto', months: mens(5400, 0), order: 3 },
           { id: 'g3', name: 'Rappi Pro', cat: 'gasto', months: { [pk(0)]: 3900 }, order: 4 }],
  } });
  const leer = () => d.ev(() => {
    goTo('agenda'); switchAgendaTab('plan'); renderProj();
    const fila = t => { const tr = [...document.querySelectorAll('#ptable tbody tr')].find(r => r.cells[0] && r.cells[0].textContent.trim() === t);
      return tr ? [...tr.cells].slice(1, 3).map(c => c.textContent.trim()) : null; };
    return { res: fila('Resultado del mes'), neto: fila('Neto'), cierre: fila('Cierre del mes'), saldo: fila('Saldo bancos'),
      orden: [...document.querySelectorAll('#ptable tbody tr')].map(r => r.cells[0] && r.cells[0].textContent.trim()).slice(-2) };
  });

  L.section('Abajo del Plan: Resultado del mes y Neto');
  const a = await leer();
  L.eq(a.orden, ['Resultado del mes', 'Neto'], 'las dos últimas filas son Resultado del mes y Neto');
  L.eq(a.cierre, null, 'ya no está "Cierre del mes"');
  // Octubre: 590.000 + 3.900.000 − 5.400 − 3.900 = 4.480.700 → "4,5M"
  L.eq(a.res && a.res[0], '4,5M', 'Resultado = saldo bancos + el sueldo que falta cobrar − lo que falta pagar');
  // Neto = 1.200.000 + 4.480.700 = 5.680.700 → "5,7M"
  L.eq(a.neto && a.neto[0], '5,7M', 'Neto = inversiones + resultado del mes');

  L.section('Sueldo cobrado a una cuenta y banco corregido: no se cuenta dos veces');
  await d.ev(() => { openCollectModal('i1', pkNow()); confirmCollect('a1'); });
  const b = await leer();
  L.eq(b.res && b.res[0], '4,5M', 'cobrar el sueldo no cambia el Resultado (pasa de "por cobrar" al banco)');
  // Se corrige el saldo del banco a lo que de verdad hay: 500.000.
  await d.ev(() => { S.accounts.find(x => x.id === 'a1').amount = 500000; save(); });
  const c = await leer();
  L.eq(c.saldo && c.saldo[0], '500k', 'Saldo bancos muestra lo corregido');
  // 500.000 − 5.400 − 3.900 = 490.700 → "491k" (antes la fila Resultado decía "+3,9M")
  L.eq(c.res && c.res[0], '491k', 'el Resultado es el saldo corregido menos lo que falta pagar (antes sumaba el sueldo otra vez: +3,9M)');
  L.eq(c.neto && c.neto[0], '1,7M', 'y el Neto, inversiones + ese resultado');

  L.section('Saldos: el "Neto proyectado" suma todo');
  const w = await d.ev(async () => { goTo('saldos'); await new Promise(r => setTimeout(r, 600));
    const v = (document.querySelector('.wr-neto-val') || {}).textContent || ''; return { v, n: (v.includes('-') ? -1 : 1) * Number(v.replace(/[^\d]/g, '')), esp: planCierreAt(pkAdd(pkNow(), 1)) + 1200000 }; });
  L.eq(w.n, w.esp, `"Neto proyectado" del mes que viene = Resultado del mes de ese mes + inversiones (${w.v.trim()})`);
  L.eq(d.errors, [], 'sin errores de JS');
  await d.close();
  await browser.close();
  console.log(`\n${'─'.repeat(50)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
