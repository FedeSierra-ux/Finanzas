// v34.25: abrir un editor (gasto, gasto compartido, transferencia, concepto del
// Plan) ya no abre el teclado solo; el alta sí, como siempre. Y la flecha de
// volver de las hojas está centrada en su círculo (antes era el carácter ‹,
// que quedaba corrido según la letra). Con la v34.24 todo termina en ✗.
const L = require('./lib');

(async () => {
  const browser = await L.launch();
  const f = new Date();
  L.resetBins();
  const d = await L.device(browser, { myName: 'fede', compBin: 'bin28', seed: {
    gastos: [{ id: 'g1', desc: 'Verdulería', cat: 'super', amount: 6712, month: f.getMonth(), year: f.getFullYear(), day: 1, addedAt: Date.now() },
             { id: 'g2', desc: 'Cena', cat: 'salidas', amount: 18000, month: f.getMonth(), year: f.getFullYear(), day: 1, addedAt: Date.now(), shared: { active: true, paidBy: 'mile', splitPct: 50 } }],
    plan: [{ id: 'p1', name: 'Alquiler', cat: 'gasto', months: {}, order: 1 }],
  } });
  const P = d.page;
  const foco = async (abrir, ov) => {
    await d.ev(abrir);
    await P.waitForTimeout(600);
    const r = await d.ev(o => ({ abierto: $(o).classList.contains('open'), foco: document.activeElement && document.activeElement.tagName === 'INPUT' ? document.activeElement.id : null }), ov);
    await d.ev(o => closeOv(o), ov);
    await P.waitForTimeout(300);
    return r;
  };

  L.section('Abrir un editor no abre el teclado');
  const eg = await foco(() => openEditGasto(S.gastos.find(g => g.id === 'g1')), 'ov-edit-gasto');
  L.eq(eg, { abierto: true, foco: null }, 'Editar gasto: abre sin ningún campo enfocado');
  const esg = await foco(() => openEditSharedGasto({ id: 'g2' }), 'ov-edit-shared');
  L.eq(esg, { abierto: true, foco: null }, 'Editar gasto compartido: abre sin ningún campo enfocado');
  const ep = await foco(() => openEditProj(S.plan[0]), 'ov-edit-proj');
  L.eq(ep, { abierto: true, foco: null }, 'Editar concepto del Plan: abre sin ningún campo enfocado');

  L.section('El alta sigue abriendo el teclado');
  const alta = await foco(() => openGastoModal(), 'ov-gasto');
  L.eq(alta, { abierto: true, foco: 'gdesc' }, 'Registrar gasto: la descripción queda enfocada, lista para escribir');

  L.section('La flecha de volver está centrada en su círculo');
  await d.ev(() => openGastoModal());
  await P.waitForTimeout(500);
  const c = await d.ev(() => {
    const b = document.querySelector('#ov-gasto .ov-back'), g = b && b.querySelector('svg');
    if (!b || !g) return null;
    const rb = b.getBoundingClientRect(), rg = g.getBoundingClientRect();
    return { dx: Math.abs((rb.left + rb.width / 2) - (rg.left + rg.width / 2)), dy: Math.abs((rb.top + rb.height / 2) - (rg.top + rg.height / 2)) };
  });
  L.is(!!c, 'la flecha es un dibujo (SVG) y no el carácter ‹');
  L.is(c && c.dx < 1 && c.dy < 1, `y su centro coincide con el del círculo (corrida ${c ? c.dx.toFixed(1) + ' × ' + c.dy.toFixed(1) : '?'} px)`);

  L.eq(d.errors, [], 'sin errores de JS');
  await d.close();
  await browser.close();
  console.log(`\n${'─'.repeat(50)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
