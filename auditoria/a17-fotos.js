// AUDITORÍA 17 — FOTOS DE FEDE Y MILE en Compartidos: se cargan en un teléfono,
// viajan en el bin compartido y la pareja las ve; la más nueva gana, quitar una
// también se propaga, y una versión vieja de la app que escribe el bin sin el
// campo fotos no las hace perder. En la lista, quién pagó se ve con la foto.
const L = require('./lib');
const { eq, is, section } = L;
const BIN = 'bin17';

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const fede = await L.device(browser, { myName: 'fede', compBin: BIN });
  const mile = await L.device(browser, { myName: 'mile', compBin: BIN });
  const sync = async (d) => { await d.ev(() => syncCompartidos(null)); await d.settle(); };

  // Una foto chica de verdad, hecha con canvas en el navegador.
  const foto = (d, color) => d.ev((color) => {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 96, 96);
    return c.toDataURL('image/jpeg', .8);
  }, color);

  section('FOTOS · se cargan en un teléfono y llegan al otro');
  const azul = await foto(fede, '#0ea5e9');
  await fede.ev((img) => _guardarFoto('fede', img), azul);
  await fede.settle();
  is(((L.bins[BIN] || {}).fotos || {}).fede?.img === azul, 'la foto de Fede sube al bin');
  await sync(mile);
  eq(await mile.ev(() => getFoto('fede')), azul, 'Mile la recibe');

  const rosa = await foto(mile, '#f472b6');
  await mile.ev((img) => _guardarFoto('mile', img), rosa);
  await mile.settle();
  await sync(fede);
  eq(await fede.ev(() => getFoto('mile')), rosa, 'y Fede recibe la de Mile');
  eq(await fede.ev(() => getFoto('fede')), azul, 'sin perder la suya');

  section('FOTOS · gana la más nueva, y quitar también viaja');
  const verde = await foto(mile, '#22c55e');
  await mile.ev((img) => _guardarFoto('fede', img), verde);
  await mile.settle();
  await sync(fede);
  eq(await fede.ev(() => getFoto('fede')), verde, 'la que cambió la pareja reemplaza a la vieja');
  await fede.ev(() => quitarFoto('mile'));
  await fede.settle();
  await sync(mile);
  eq(await mile.ev(() => getFoto('mile')), null, 'quitada en un teléfono, se quita en el otro');

  section('FOTOS · una app vieja que escribe el bin sin el campo no las borra');
  delete L.bins[BIN].fotos;
  await sync(fede);
  is(((L.bins[BIN] || {}).fotos || {}).fede?.img === verde, 'el próximo sync las vuelve a subir');

  section('FOTOS · lo que viene del bin se valida');
  L.bins[BIN].fotos = { fede: { img: 'javascript:alert(1)', ts: Date.now() + 1e6 }, mile: { img: 'x'.repeat(10), ts: 'mal' } };
  await mile.ev(async () => { await fetchSharedBin(); });
  await mile.settle();
  eq(await mile.ev(() => getFoto('fede')), verde, 'una imagen que no es data:image se ignora');

  section('COMPARTIDOS · la fila lleva la foto de quién pagó');
  const fila = await fede.ev(async () => {
    S.gastos.push({ id: 'g1', desc: 'Super', amount: 10000, cat: 'super', month: _sharedMonth, year: _sharedYear,
      addedAt: new Date(_sharedYear, _sharedMonth, 2, 12).getTime(), shared: { active: true, paidBy: 'fede', splitPct: 50 } });
    save(); await upsertSharedBinGasto(S.gastos[S.gastos.length - 1]);
    goTo('compartidos'); renderCompartidos();
    await new Promise(r => setTimeout(r, 300));
    const r = document.querySelector('#compartidos-list .sh-grow .sh-tile-wrap .who-ava');
    const f = [...document.querySelectorAll('#compartidos-list .sh-filter-row .who-ava')];
    return { tag: r?.tagName, src: r?.getAttribute('src'), who: r?.dataset.who, filtros: f.map(e => e.tagName) };
  });
  eq(fila.tag, 'IMG', 'con foto cargada, es la imagen');
  eq(fila.src, verde, 'la de quien pagó');
  eq(fila.filtros, ['IMG', 'SPAN'], 'en los filtros: foto de Fede, cara de Mile (que no tiene)');

  section('AJUSTES · elegir y quitar');
  const aj = await fede.ev(() => { renderFotosAjustes(); const el = document.getElementById('sync-fotos');
    return { n: el.querySelectorAll('input[type=file]').length, quitar: el.querySelectorAll('.foto-pick-del').length }; });
  eq(aj, { n: 2, quitar: 1 }, 'un selector por persona, "Quitar" solo donde hay foto');

  section('ERRORES · JS durante la corrida');
  eq(fede.errors, [], 'ningún error de página');
  eq(mile.errors, [], 'tampoco en el segundo dispositivo');

  console.log(`\n${'─'.repeat(52)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  await browser.close();
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error('ERROR:', e); process.exit(2); });
