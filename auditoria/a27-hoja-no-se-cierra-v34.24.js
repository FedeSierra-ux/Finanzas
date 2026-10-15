// v34.24: con el teclado abierto, tocar un botón de la hoja (por ejemplo
// "Suscripción" en "Nuevo vencimiento") cerraba el menú. El toque le sacaba el
// foco al campo, el teclado se cerraba, la hoja bajaba y el click terminaba en
// el fondo, que cierra el menú. Ahora los botones de la hoja no le sacan el foco
// al campo y el fondo solo cierra si el toque empezó en el fondo. Con la v34.23
// las dos primeras secciones terminan en ✗.
const L = require('./lib');

const android = { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36' };

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const d = await L.device(browser, { myName: 'fede', compBin: null, contexto: android, seed: {} });
  const P = d.page;
  const abrir = async () => {
    await d.ev(() => { document.querySelectorAll('.overlay.open').forEach(o => closeOv(o.id)); goTo('agenda'); openAgendaModal('venc'); });
    await P.waitForTimeout(500);
    await P.focus('#ag-name');
  };

  L.section('Tocar "Suscripción" con el teclado abierto no le saca el foco al nombre');
  await abrir();
  const caja = await d.ev(() => { const r = document.querySelector('.amo-btn[data-t="sub"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await P.touchscreen.tap(caja.x, caja.y);
  await P.waitForTimeout(250);
  const r1 = await d.ev(() => ({ abierto: $('ov-agenda').classList.contains('open'), tipo: agendaModalType, foco: document.activeElement && document.activeElement.id }));
  L.eq([r1.abierto, r1.tipo], [true, 'sub'], 'el menú sigue abierto y pasa a Suscripción');
  L.eq(r1.foco, 'ag-name', 'y el nombre conserva el foco (el teclado no se cierra en pleno toque)');

  L.section('Si la hoja se mueve en pleno toque, el click que cae en el fondo no cierra el menú');
  await abrir();
  // Se reproduce lo que pasa en el teléfono: el dedo baja sobre "Vencimiento", la hoja
  // se corre y el dedo se levanta encima del fondo.
  const r2 = await d.ev(() => {
    const btn = document.querySelector('.amo-btn[data-t="venc"]'), ov = $('ov-agenda');
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    ov.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return ov.classList.contains('open');
  });
  L.eq(r2, true, 'el menú sigue abierto');

  L.section('Tocar el fondo sigue cerrando el menú');
  await abrir();
  await P.touchscreen.tap(200, 40);
  await P.waitForTimeout(300);
  L.eq(await d.ev(() => $('ov-agenda').classList.contains('open')), false, 'un toque que empieza y termina en el fondo cierra el menú');

  L.eq(d.errors, [], 'sin errores de JS');
  await d.close();
  await browser.close();
  console.log(`\n${'─'.repeat(50)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
