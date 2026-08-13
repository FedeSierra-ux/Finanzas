// AUDITORÍA 6 — CONSISTENCIA ENTRE MENÚS: que lo que se elige en un menú se
// pueda volver a elegir en los otros, que lo que se crea viaje al otro
// dispositivo y que sobreviva a un backup.
//
// Las auditorías 1-5 miran cada pantalla por dentro (que la cuenta cierre, que
// el sync no pierda nada, que cada fila tenga sus botones). Ésta mira las
// costuras: el mismo dato visto desde dos menús distintos, y el mismo dato
// visto desde dos dispositivos.
const L = require('./lib');
const { eq, is, section } = L;
const BIN = 'bin6';

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const d = await L.device(browser, { myName: 'fede', compBin: BIN });
  const P = d.page;
  const existe = sel => P.evaluate(s => !!document.querySelector(s), sel);

  // ════ EL MES DE CADA PESTAÑA ═════════════════════════════════════════
  // Gastos, Presupuesto y Compartidos viven en la misma página y muestran la
  // misma franja de mes (.month-strip, unificada visualmente en #148). Mover
  // una tiene que mover las tres: si no, el usuario ve el mismo control en el
  // mismo lugar diciendo dos meses distintos según la pestaña.
  section('MENÚS · el mes es el mismo en las tres pestañas de Gastos');
  await d.ev(() => { goTo('gastos'); });
  await P.waitForTimeout(120);
  const mesInicial = await d.ev(() => ({ g: curMonth, p: _presupMonth, c: _sharedMonth }));
  is(mesInicial.g === mesInicial.p && mesInicial.p === mesInicial.c,
    `los tres arrancan en el mismo mes (${JSON.stringify(mesInicial)})`);

  // Retroceder dos meses desde Gastos y mirar las otras dos pestañas.
  await d.ev(() => { chMonth(-1); chMonth(-1); });
  await P.waitForTimeout(120);
  const trasGastos = await d.ev(() => ({ g: curMonth, gy: curYear, p: _presupMonth, py: _presupYear, c: _sharedMonth, cy: _sharedYear }));
  eq(trasGastos.p, trasGastos.g, 'mover el mes en Gastos también mueve el de Presupuesto');
  eq(trasGastos.c, trasGastos.g, 'y el de Compartidos');
  eq(trasGastos.py, trasGastos.gy, 'con el mismo año en Presupuesto');
  eq(trasGastos.cy, trasGastos.gy, 'y en Compartidos');

  // Y al revés: mover desde Compartidos tiene que arrastrar a las otras dos.
  await d.ev(() => { switchGastosTab('compartidos'); moveSharedMonth(1); });
  await P.waitForTimeout(120);
  const trasComp = await d.ev(() => ({ g: curMonth, p: _presupMonth, c: _sharedMonth }));
  eq(trasComp.g, trasComp.c, 'mover el mes en Compartidos también mueve el de Gastos');
  eq(trasComp.p, trasComp.c, 'y el de Presupuesto');

  // Y desde Presupuesto.
  await d.ev(() => { switchGastosTab('presup'); movePresupMonth(-1); });
  await P.waitForTimeout(120);
  const trasPres = await d.ev(() => ({ g: curMonth, p: _presupMonth, c: _sharedMonth }));
  eq(trasPres.g, trasPres.p, 'mover el mes en Presupuesto también mueve el de Gastos');
  eq(trasPres.c, trasPres.p, 'y el de Compartidos');

  // La etiqueta que se ve en pantalla tiene que decir lo mismo en las tres.
  await d.ev(() => { renderGastos(); renderPresupuesto(); renderCompartidos(); });
  await P.waitForTimeout(300);
  const etiquetas = await d.ev(() => {
    const t = id => (document.getElementById(id) || {}).textContent || '';
    const c = document.querySelector('#compartidos-list .month-strip .mlbl');
    return { gastos: t('mlbl').trim(), presup: t('presup-month-lbl').trim(), comp: (c ? c.textContent : '').trim() };
  });
  is(etiquetas.gastos && etiquetas.gastos === etiquetas.presup,
    `la franja de mes dice lo mismo en Gastos y Presupuesto (${etiquetas.gastos} / ${etiquetas.presup})`);
  is(!etiquetas.comp || etiquetas.comp === etiquetas.gastos,
    `y en Compartidos (${etiquetas.comp || '—'})`);

  // Volver al mes actual para el resto de la auditoría.
  await d.ev(() => { const n = new Date(); curMonth = n.getMonth(); curYear = n.getFullYear(); _presupMonth = curMonth; _presupYear = curYear; _sharedMonth = curMonth; _sharedYear = curYear; });

  // ════ CATEGORÍAS PROPIAS ═════════════════════════════════════════════
  section('CATEGORÍAS PROPIAS · se pueden crear, editar y borrar');
  await d.ev(() => {
    openAddCatModal('gcats');
    document.getElementById('newcat-name').value = 'Mascota';
    _newCatIcon = '🐶';
    saveNewCat();
  });
  await P.waitForTimeout(120);
  const catId = await d.ev(() => Object.keys(loadCustomCats())[0]);
  is(!!catId, `la categoría propia se crea (${catId})`);

  is(await d.ev(() => typeof window.deleteCustomCat === 'function'),
    'hay forma de borrar una categoría propia');

  // Renombrar de verdad, por el modal: el id no cambia (los gastos lo guardan),
  // el rótulo y el ícono sí.
  await d.ev(id => { openAddCatModal('gcats'); startEditCustomCat(id); }, catId);
  await P.waitForTimeout(120);
  await P.fill('#newcat-name', 'Mascotas');
  await d.ev(() => { _newCatIcon = '🐱'; saveEditCustomCat(); });
  await P.waitForTimeout(120);
  const renombrada = await d.ev(id => loadCustomCats()[id], catId);
  eq(renombrada && renombrada.label, 'Mascotas', 'renombrar una categoría propia cambia el rótulo');
  eq(renombrada && renombrada.icon, '🐱', 'y el ícono');
  eq(await d.ev(() => Object.keys(loadCustomCats()).length), 1, 'sin duplicarla');

  section('CATEGORÍAS PROPIAS · aparecen en todos los menús que piden categoría');
  await d.ev(() => { openGastoModal(); });
  await P.waitForTimeout(120);
  is(await d.ev(id => !!document.querySelector(`#gcats .chip[data-v="${id}"]`), catId),
    'está en el alta de gasto');
  await d.ev(() => closeOv('ov-gasto'));

  const gid = await d.ev(cid => {
    const g = { id: 'gcust', desc: 'Veterinaria', amount: 40000, cat: cid, addedAt: Date.now(),
      month: new Date().getMonth(), year: new Date().getFullYear(),
      shared: { active: true, paidBy: 'fede', splitPct: 50 } };
    S.gastos.push(g); save(); return g.id;
  }, catId);

  await d.ev(id => openEditGasto(S.gastos.find(g => g.id === id)), gid);
  await P.waitForTimeout(120);
  is(await d.ev(id => !!document.querySelector(`#eg-cats .chip[data-v="${id}"]`), catId),
    'está en la edición de gasto');
  await d.ev(() => closeOv('ov-edit-gasto'));

  await d.ev(id => openEditSharedGasto({ id }), gid);
  await P.waitForTimeout(120);
  is(await d.ev(id => !!document.querySelector(`#esg-cats .chip[data-v="${id}"]`), catId),
    'y en la edición desde Compartidos');
  is(await d.ev(() => !!document.querySelector('#esg-cats .chip.on')),
    'al abrir la edición desde Compartidos queda marcada la categoría que tiene el gasto');
  await d.ev(() => closeOv('ov-edit-shared'));

  // ════ EL MISMO JUEGO DE CATEGORÍAS EN TODOS LOS MENÚS ════════════════
  section('CATEGORÍAS · el mismo juego en el alta, la edición y Compartidos');
  const juegos = await d.ev(() => {
    const cats = id => [...document.querySelectorAll('#' + id + ' .chip[data-v]')].map(c => c.dataset.v);
    return { alta: cats('gcats'), edicion: cats('eg-cats'), compartidos: cats('esg-cats') };
  });
  const faltanEnComp = juegos.edicion.filter(c => !juegos.compartidos.includes(c));
  eq(faltanEnComp, [], `Compartidos ofrece las mismas categorías que la edición de gasto (faltan: ${faltanEnComp.join(', ') || 'ninguna'})`);
  is(await existe('#esg-cats .cat-add-chip'), 'y también el botón de crear una categoría nueva');

  // ════ REPARTO LIBRE ══════════════════════════════════════════════════
  // El modelo guarda splitPct 0-100 y la edición deja escribirlo a mano; el
  // alta, en cambio, solo ofrece 50/50 y "solo uno". Un gasto 70/30 hay que
  // cargarlo mal y corregirlo después.
  section('COMPARTIDOS · el reparto se puede elegir al cargar, no solo al corregir');
  await d.ev(() => { openGastoModal(); toggleSharedGasto(); });
  await P.waitForTimeout(120);
  is(await existe('#g-split-pct'), 'el alta de gasto deja escribir un porcentaje libre');
  await d.ev(() => closeOv('ov-gasto'));
  is(await existe('#eg-split-pct'), 'la edición de gasto también');
  is(await existe('#esg-split-pct'), 'y la edición desde Compartidos');

  // ════ LO QUE VIAJA AL OTRO DISPOSITIVO ═══════════════════════════════
  section('SYNC · lo que se configura de un lado llega al otro');
  const payload = await d.ev(() => Object.keys(buildSyncPayload()));
  is(payload.includes('fin_custom_cats'), 'las categorías propias viajan en el sync');
  is(payload.includes('fin_quick_chips_v2'), 'y los atajos de gastos frecuentes también');

  section('BACKUP · exportar e importar no pierde nada');
  const claves = await d.ev(() => {
    const src = String(exportBackup);
    const m = src.match(/allKeys\s*=\s*\[([\s\S]*?)\]/);
    return m ? m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean) : [];
  });
  is(claves.includes('fin_custom_cats'), 'el backup incluye las categorías propias');
  is(claves.includes('fin_quick_chips_v2'), 'y los atajos de gastos frecuentes');

  // ════ LA PAREJA VE LA CATEGORÍA, NO EL ID INTERNO ════════════════════
  section('COMPARTIDOS · la pareja ve el nombre de la categoría, no el id interno');
  await d.ev(() => queueSharedBinWrite(async () => { await fetchSharedBin(); await pushSharedBin(); }));
  await d.settle();
  await P.waitForTimeout(200);

  const mile = await L.device(browser, { myName: 'mile', compBin: BIN });
  await mile.ev(() => { goTo('gastos'); switchGastosTab('compartidos'); });
  await mile.page.waitForTimeout(600);
  await mile.ev(() => fetchSharedBin());
  await mile.page.waitForTimeout(400);
  await mile.ev(() => renderCompartidos());
  await mile.page.waitForTimeout(300);

  const loQueVeMile = await mile.ev(() => {
    const el = document.getElementById('compartidos-list');
    return el ? el.textContent : '';
  });
  is(loQueVeMile.includes('Veterinaria'), 'a la pareja le llega el gasto compartido');
  is(!/custom_/.test(loQueVeMile),
    'y no ve el id interno de la categoría en pantalla');
  is(await mile.ev(cid => !!CATS[cid], catId),
    'la categoría propia también existe del otro lado');

  // ════ MENÚS QUE SE ABREN DESDE OTRO MENÚ ═════════════════════════════
  // El ➕ de las categorías sale desde tres modales distintos. Si el modal de
  // categoría queda en la misma banda de z-index que el que lo abrió, decide el
  // orden del DOM y se abre por debajo: el usuario ve el modal de siempre y el
  // foco puesto en un campo que no está en pantalla.
  section('MENÚS · un menú abierto desde otro queda por encima, no por debajo');
  const zDe = sel => P.evaluate(s => {
    const el = document.querySelector(s);
    return el ? parseInt(getComputedStyle(el).zIndex) || 0 : null;
  }, sel);
  const zAddCat = await zDe('#ov-add-cat');
  for (const [sel, nombre] of [['#ov-gasto', 'el alta de gasto'], ['#ov-edit-gasto', 'la edición de gasto'], ['#ov-edit-shared', 'la edición desde Compartidos']]) {
    is(zAddCat > await zDe(sel), `el modal de categoría queda por encima de ${nombre}`);
  }
  await d.ev(() => { openEditSharedGasto({ id: 'gcust' }); });
  await P.waitForTimeout(400);
  await d.ev(() => openAddCatModal('esg-cats'));
  await P.waitForTimeout(400);
  is(await d.ev(() => {
    const cat = document.getElementById('ov-add-cat').getBoundingClientRect();
    const el = document.elementFromPoint(cat.left + cat.width / 2, cat.top + cat.height - 40);
    return !!(el && el.closest('#ov-add-cat'));
  }), 'y abriéndolo de verdad, es el que recibe los toques');
  await d.ev(() => { closeOv('ov-add-cat'); closeOv('ov-edit-shared'); });

  // ════ BORRAR UNA CATEGORÍA NO BORRA GASTOS ═══════════════════════════
  section('CATEGORÍAS PROPIAS · borrarla no se lleva puestos los gastos');
  const antes = await d.ev(() => S.gastos.length);
  await d.ev(id => { window.appConfirm = async () => true; return deleteCustomCat(id); }, catId);
  await P.waitForTimeout(200);
  eq(await d.ev(() => S.gastos.length), antes, 'los gastos siguen estando');
  eq(await d.ev(g => (S.gastos.find(x => x.id === g) || {}).cat, gid), 'varios',
    'y el que la usaba queda en Varios, no sin categoría');
  eq(await d.ev(() => Object.keys(loadCustomCats()).length), 0, 'la categoría ya no está en la lista');

  // ════ ERRORES ════════════════════════════════════════════════════════
  section('ERRORES · JS durante toda la corrida');
  eq(d.errors, [], 'ningún error de página en el dispositivo de Fede');
  eq(mile.errors, [], 'ninguno en el de Mile');

  await d.close(); await mile.close(); await browser.close();
  console.log(`\n${'─'.repeat(52)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})();
