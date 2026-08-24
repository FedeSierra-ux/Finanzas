// AUDITORÍA 4 — MENÚS Y EDICIÓN: que cada modal tenga sus opciones y que
// editar por la interfaz real cambie el dato.
const L = require('./lib');
const { eq, is, section } = L;
const BIN = 'bin4';

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const d = await L.device(browser, { myName: 'fede', compBin: BIN });
  const P = d.page;

  const visible = sel => P.evaluate(s => {
    const el = document.querySelector(s);
    if (!el) return null;
    return !el.closest('.hidden') && el.offsetParent !== null;
  }, sel);
  const existe = sel => P.evaluate(s => !!document.querySelector(s), sel);
  const val = sel => P.evaluate(s => (document.querySelector(s) || {}).value, sel);

  // ════ ALTA EN AGENDA ═════════════════════════════════════════════════
  section('MENÚS · alta en Agenda');
  await d.ev(() => openAgendaModal('venc'));
  await P.waitForTimeout(450); // el modal enfoca a los 340ms
  for (const [sel, label] of [
    ['#ag-name', 'nombre'], ['#ag-amount', 'importe'], ['#ag-date', 'fecha'],
    ['#ag-period', 'periodicidad'], ['#ag-shared-section', 'sección de compartido'],
  ]) is(await existe(sel), `el alta de vencimiento tiene campo de ${label}`);
  const periodos = await P.evaluate(() => [...document.querySelectorAll('#ag-period .chip')].map(c => c.textContent.trim()));
  is(periodos.length >= 3, `la periodicidad ofrece varias opciones (${periodos.join(' / ')})`);
  const tipos = await P.evaluate(() => [...document.querySelectorAll('.amo-btn')].map(b => b.dataset.t));
  is(tipos.includes('sub') && tipos.includes('venc'), `se puede elegir el tipo (${tipos.join(', ')})`);

  // Alta real por el DOM.
  await P.fill('#ag-name', 'Prepaga');
  await P.fill('#ag-amount', '85000');
  await P.fill('#ag-date', '2026-09-10');
  await d.ev(() => doSaveAgenda());
  await P.waitForTimeout(150);
  const v = await d.ev(() => S.agenda.vencimientos.find(x => x.name === 'Prepaga'));
  is(!!v, 'guardar por la interfaz crea el vencimiento');
  eq(v && v.amount, 85000, 'con el importe cargado');
  eq(v && v.date, '2026-09-10', 'y la fecha elegida');

  // ════ EDITAR EN AGENDA ═══════════════════════════════════════════════
  section('MENÚS · editar un vencimiento');
  await d.ev((id) => editAgenda('venc', id), v.id);
  await P.waitForTimeout(450);
  eq(await val('#ag-name'), 'Prepaga', 'el modal de edición viene precargado con el nombre');
  eq(await val('#ag-amount'), '85000', 'y con el importe');
  eq(await P.evaluate(() => document.querySelector('#ag-save-btn').textContent), 'Actualizar',
    'y el botón dice "Actualizar", no "Guardar"');
  await P.fill('#ag-amount', '92000');
  await d.ev(() => doSaveAgenda());
  await P.waitForTimeout(150);
  eq(await d.ev((id) => (S.agenda.vencimientos.find(x => x.id === id) || {}).amount, v.id), 92000,
    'editar por la interfaz cambia el importe');
  eq(await d.ev(() => S.agenda.vencimientos.filter(x => x.name === 'Prepaga').length), 1,
    'y no duplica el vencimiento');

  // ════ EDITAR UNA CUOTA ═══════════════════════════════════════════════
  section('MENÚS · editar una compra en cuotas');
  await d.ev(() => {
    S.agenda.cuotas.push({ id: 'c1', name: 'Heladera', fee: 50000, total: 6, paid: 2, nextDueDate: '2026-09-10' });
    save();
  });
  await d.ev(() => editAgenda('cuota', 'c1'));
  await P.waitForTimeout(150);
  for (const [sel, label] of [['#ecq-name', 'nombre'], ['#ecq-fee', 'importe de la cuota'],
    ['#ecq-total', 'total de cuotas'], ['#ecq-paid', 'cuántas van pagas'], ['#ecq-date', 'próximo vencimiento']])
    is(await existe(sel), `el editor de cuota tiene campo de ${label}`);
  eq(await val('#ecq-name'), 'Heladera', 'precargado con el nombre');
  eq(await val('#ecq-paid'), '2', 'y con las cuotas ya pagas (se puede corregir si estaba mal)');
  await P.fill('#ecq-fee', '58000');
  await P.fill('#ecq-paid', '3');
  await d.ev(() => doSaveEditCuota());
  await P.waitForTimeout(150);
  const c1 = await d.ev(() => S.agenda.cuotas.find(x => x.id === 'c1'));
  eq(c1.fee, 58000, 'editar cambia el importe de la cuota');
  eq(c1.paid, 3, 'y el número de cuota, que es lo que no se podía corregir antes');

  // ════ COMPARTIDOS: editar un gasto ═══════════════════════════════════
  section('MENÚS · editar un gasto compartido desde Compartidos');
  await d.ev(async () => {
    S.gastos.push({ id: 'gs', desc: 'Cena', amount: 30000, cat: 'salidas', month: 7, year: 2026,
      addedAt: new Date(2026, 7, 9, 12).getTime(), shared: { active: true, paidBy: 'fede', splitPct: 50 } });
    save(); await upsertSharedBinGasto(S.gastos.find(g => g.id === 'gs'));
  });
  await d.settle();
  await d.ev(() => openEditSharedGasto(S.gastos.find(g => g.id === 'gs')));
  await P.waitForTimeout(150);
  for (const [sel, label] of [['#esg-desc', 'descripción'], ['#esg-amt', 'importe'],
    ['#esg-date', 'fecha']])
    is(await existe(sel), `el editor de gasto compartido tiene ${label}`);
  // La división es por botones: 50/50, todo de uno o todo del otro. El campo
  // para escribir un porcentaje a mano se sacó, así que no debe volver.
  is(!(await existe('#esg-split-pct')), 'y la división se elige con botones, sin campo de porcentaje');
  const repartos = await P.evaluate(() => [...document.querySelectorAll('#ov-edit-shared [data-esg-split]')].map(b => b.dataset.esgSplit));
  eq(repartos.join(','), '50,solo-fede,solo-mile', 'las tres opciones de reparto');
  const quienes = await P.evaluate(() => [...document.querySelectorAll('#ov-edit-shared [id^="esg-pb-"]')].map(b => b.id));
  is(quienes.length >= 2, `se puede elegir quién pagó (${quienes.join(', ')})`);
  eq(await val('#esg-amt'), '30000', 'precargado con el importe');

  await P.fill('#esg-amt', '36000');
  // "Solo Mile" con Fede como pagador = 0% del que pagó.
  await P.click('#ov-edit-shared [data-esg-split="solo-mile"]');
  eq(await P.evaluate(() => document.querySelectorAll('#ov-edit-shared [data-esg-split].on').length), 1, 'queda marcada una sola opción');
  await d.ev(() => doSaveEditShared());
  await d.settle(); await P.waitForTimeout(200); await d.settle();
  const gs = await d.ev(() => S.gastos.find(g => g.id === 'gs'));
  eq(gs.amount, 36000, 'editar por la interfaz cambia el importe');
  eq(gs.shared.splitPct, 0, 'y la división elegida (todo del otro = 0% del que pagó)');
  const enBin = ((L.bins[BIN] || {}).gastos || []).find(g => g.id === 'gs');
  eq(enBin && enBin.amount, 36000, 'y la corrección llega al bin');
  eq(enBin && enBin.shared.splitPct, 0, 'con la división nueva');
  eq(await d.ev(() => sharedPendientes().total), 0, 'sin quedar nada pendiente');

  // ════ LA DIVISIÓN, DESDE EL EDITOR DE GASTOS ═════════════════════════
  // El mismo gasto compartido se puede editar desde la lista de Gastos, con
  // otro menú. Ahí también se sacó el campo de porcentaje: las tres opciones
  // tienen que dar el mismo resultado que las del editor de Compartidos.
  section('MENÚS · cómo se divide, editando desde Gastos');
  await d.ev(() => { goTo('gastos'); openEditGasto(S.gastos.find(g => g.id === 'gs')); });
  await P.waitForTimeout(200);
  is(!(await existe('#eg-split-pct')), 'tampoco hay campo de porcentaje a mano');
  const egNombres = await P.evaluate(() => [document.getElementById('eg-split-solo-a').textContent.trim(),
                                            document.getElementById('eg-split-solo-b').textContent.trim()]);
  is(egNombres.every(t => /Solo \w/.test(t)), `los "Solo X" llevan los nombres reales (${egNombres.join(' / ')})`);
  // El gasto quedó en "todo de Mile" (0%) en la sección anterior: al abrirlo,
  // ese botón tiene que estar marcado, no el de 50/50.
  eq(await P.evaluate(() => [...document.querySelectorAll('#eg-split-presets .on')].map(b => b.id)).then(a => a.join(',')),
    'eg-split-solo-b', 'al abrir, queda marcado el reparto guardado');
  // Cambiar quién pagó no puede dar vuelta el significado: "Solo Mile" sigue
  // siendo "Solo Mile", aunque el porcentaje relativo al pagador se invierta.
  await P.click('#eg-pb-mile');
  eq(await d.ev(() => ({ pct: _egSplitPct, quien: _egSoloWho })), { pct: 100, quien: 'mile' },
    'si ahora pagó Mile, "Solo Mile" pasa a 100% del que pagó');
  eq(await P.evaluate(() => [...document.querySelectorAll('#eg-split-presets .on')].map(b => b.id)).then(a => a.join(',')),
    'eg-split-solo-b', 'y sigue marcado el mismo botón');
  await P.click('#eg-split-50');
  await d.ev(() => doSaveEditGasto());
  await P.waitForTimeout(200);
  eq(await d.ev(() => S.gastos.find(g => g.id === 'gs').shared.splitPct), 50, 'volver a 50/50 se guarda');

  // Un porcentaje que no sea 0/50/100 solo puede venir del bot: no se marca
  // ninguna opción y el desglose lo dice, en vez de mentir un 50/50.
  await d.ev(() => {
    const g = S.gastos.find(x => x.id === 'gs');
    g.shared.splitPct = 30; save();
    goTo('compartidos'); openEditSharedGasto({ id: 'gs' });
  });
  await P.waitForTimeout(250);
  eq(await P.evaluate(() => document.querySelectorAll('#ov-edit-shared [data-esg-split].on').length), 0,
    'un reparto a medida no marca ninguna de las tres');
  is(await P.evaluate(() => document.getElementById('esg-split-preview').textContent.startsWith('Reparto a medida: 30%')),
    'y el desglose avisa que es a medida');
  await d.ev(() => closeOv('ov-edit-shared'));

  // ════ CATEGORÍAS: cuatro por fila ════════════════════════════════════
  section('MENÚS · las categorías entran de a cuatro por fila');
  await d.ev(() => { goTo('gastos'); openGastoModal(); });
  await P.waitForTimeout(250);
  for (const id of ['gcats', 'eg-cats', 'esg-cats'])
    eq(await P.evaluate((x) => getComputedStyle(document.getElementById(x)).gridTemplateColumns.split(' ').length, id), 4,
      `#${id} se dibuja en cuatro columnas`);
  eq(await P.evaluate(() => {
    const c = document.getElementById('gcats'), filas = {};
    c.querySelectorAll('.chip').forEach(ch => { const k = Math.round(ch.getBoundingClientRect().top); filas[k] = (filas[k] || 0) + 1; });
    return Object.values(filas).join(',');
  }), '4,4,4,1', 'las doce categorías más el ➕ quedan en 4+4+4+1');
  eq(await P.evaluate(() => [...document.querySelectorAll('#gcats .chip')].filter(c => c.scrollWidth > c.clientWidth + 1).length), 0,
    'y ninguna etiqueta queda cortada');
  // Con el teclado abierto los chips vuelven a ser una fila que scrollea.
  eq(await P.evaluate(() => {
    const c = document.getElementById('gcats');
    c.classList.add('chips-kb');
    const v = getComputedStyle(c).display;
    c.classList.remove('chips-kb');
    return v;
  }), 'flex', 'con el teclado abierto vuelven a ser una fila horizontal');
  await d.ev(() => closeOv('ov-gasto'));

  // ════ COMPARTIDOS: liquidar y editar la transferencia ═════════════════
  section('MENÚS · liquidar y corregir la transferencia');
  await d.ev(() => openSharedPaymentModal());
  await P.waitForTimeout(150);
  for (const [sel, label] of [['#sp-amount', 'importe'], ['#sp-desc', 'descripción'], ['#sp-date', 'fecha']])
    is(await existe(sel), `el modal de liquidar tiene ${label}`);
  await P.fill('#sp-amount', '50000');
  await P.fill('#sp-desc', 'Transferencia agosto');
  await d.ev(() => doSaveSharedPayment());
  await d.settle(); await P.waitForTimeout(200); await d.settle();
  let pays = await d.ev(() => getSharedPayments());
  eq(pays.length, 1, 'liquidar registra la transferencia');
  eq(pays[0].amount, 50000, 'por el importe cargado');
  const payEnBin = ((L.bins[BIN] || {}).payments || []).length;
  eq(payEnBin, 1, 'y sube al bin');

  await d.ev((id) => openEditSharedPayment(id), pays[0].id);
  await P.waitForTimeout(150);
  eq(await val('#sp-amount'), '50000', 'el editor de la transferencia viene precargado');
  await P.fill('#sp-amount', '65000');
  await d.ev(() => doSaveSharedPayment());
  await d.settle(); await P.waitForTimeout(200); await d.settle();
  pays = await d.ev(() => getSharedPayments());
  eq(pays.length, 1, 'corregir la transferencia no crea otra');
  eq(pays[0].amount, 65000, 'y deja el importe corregido');
  const payBin = ((L.bins[BIN] || {}).payments || [])[0];
  eq(payBin && payBin.amount, 65000, 'la corrección también llega al bin');

  // ════ BOTONES DE CADA FILA ═══════════════════════════════════════════
  section('MENÚS · los botones que tiene cada fila');
  await d.ev(() => { goTo('compartidos'); renderCompartidos(); });
  await P.waitForTimeout(400);
  const acciones = await P.evaluate(() => {
    const el = document.querySelector('.sh-actions');
    return el ? [...el.querySelectorAll('button')].map(b => (b.getAttribute('onclick') || '').split('(')[0]) : [];
  });
  is(acciones.includes('openSharedPaymentModal'), 'la cabecera de Compartidos tiene Liquidar');
  is(acciones.includes('syncCompartidos'), 'tiene Sincronizar');
  is(acciones.includes('exportCompartidosData'), 'y tiene el de control/exportar');
  // El onclick completo, no solo el prefijo: los borrados van envueltos en
  // appConfirm(...).then(...), así que mirar la primera función no alcanza.
  const onclicksComp = await P.evaluate(() =>
    [...document.querySelectorAll('#compartidos-list [onclick]')].map(b => b.getAttribute('onclick')));
  is(onclicksComp.some(x => /openEditSharedGasto/.test(x)), 'cada gasto compartido se puede editar desde la lista');
  is(onclicksComp.some(x => /removeSharedBinGasto/.test(x)), 'y se puede borrar');
  is(onclicksComp.some(x => /appConfirm/.test(x) && /removeSharedBinGasto/.test(x)), 'con confirmación antes de borrar');
  is(onclicksComp.some(x => /openEditSharedPayment/.test(x)), 'y la transferencia también se puede editar desde la lista');
  is(onclicksComp.some(x => /deleteSharedPayment/.test(x)), 'y borrar');

  await d.ev(() => { goTo('agenda'); renderAgenda(); });
  await P.waitForTimeout(400);
  const agBtns = await P.evaluate(() => [...document.querySelectorAll('#pg-agenda [onclick]')]
    .map(b => b.getAttribute('onclick')));
  is(agBtns.some(x => /markVencPaid/.test(x)), 'las filas de vencimiento tienen el botón de pagar');
  is(agBtns.some(x => /markCuotaPaid/.test(x)), 'las de cuota también');
  is(agBtns.some(x => /editAgenda/.test(x)), 'todas tienen el de editar');
  is(agBtns.some(x => /delAgenda/.test(x)), 'y el de borrar');
  is(agBtns.some(x => /appConfirm/.test(x) && /delAgenda/.test(x)), 'con confirmación antes de borrar');
  is(agBtns.some(x => /openAgendaModal/.test(x)), 'y hay por dónde dar de alta algo nuevo');

  // ════ BUSCADOR ══════════════════════════════════════════════════════
  // Busca sobre todos los meses cargados, no sobre el que está en pantalla.
  section('BUSCADOR · encuentra un gasto de otro mes y deja abrirlo');
  await d.ev(() => {
    const hace3 = new Date(); hace3.setMonth(hace3.getMonth() - 3);
    S.gastos.push({ id: 'viejo1', desc: 'Cena Don Julio', cat: 'salidas', amount: 98000,
      month: hace3.getMonth(), year: hace3.getFullYear(), day: 8, addedAt: hace3.getTime() });
    save(); goTo('gastos'); switchGastosTab('gastos'); renderGastos();
  });
  await P.waitForTimeout(400);
  await d.ev(() => buscarGastos('gastos', 'don julio'));
  await P.waitForTimeout(250);
  const busq = await P.evaluate(() => {
    const cont = document.getElementById('sq-res-gastos');
    return { visible: !cont.classList.contains('hidden'),
             listaOculta: document.getElementById('gastos-list').classList.contains('hidden'),
             donutOculto: getComputedStyle(document.querySelector('#gt-view-gastos .donut-wrap')).display === 'none',
             filas: cont.querySelectorAll('.sq-row').length,
             resalta: !!cont.querySelector('.sq-desc mark'),
             abre: [...cont.querySelectorAll('.sq-row')].every(r => /openEditGasto/.test(r.getAttribute('onclick') || '')),
             cabecera: (cont.querySelector('.sq-head-sub') || {}).textContent || '' };
  });
  is(busq.visible && busq.listaOculta, 'con texto, los resultados reemplazan la lista del mes');
  is(busq.donutOculto, 'y el donut se aparta para dejarles la pantalla');
  is(busq.filas >= 1, `encuentra el gasto de hace tres meses (${busq.filas} resultado/s)`);
  is(busq.resalta, 'resalta la parte que coincide');
  is(busq.abre, 'y cada resultado abre la edición de ese gasto');
  is(/meses/.test(busq.cabecera) || /mes/.test(busq.cabecera), 'la cabecera dice en cuántos meses buscó');
  await d.ev(() => buscarGastos('gastos', 'zzz-no-existe'));
  await P.waitForTimeout(200);
  is(await P.evaluate(() => !!document.querySelector('#sq-res-gastos .sq-empty')), 'sin resultados lo dice, no queda en blanco');
  await d.ev(() => limpiarBusqueda('gastos'));
  await P.waitForTimeout(250);
  is(await P.evaluate(() => document.getElementById('sq-res-gastos').classList.contains('hidden')
      && !document.getElementById('gastos-list').classList.contains('hidden')
      && getComputedStyle(document.querySelector('#gt-view-gastos .donut-wrap')).display !== 'none'),
    'al limpiar vuelve todo a su lugar');
  await d.ev(() => { goTo('compartidos'); });
  await P.waitForTimeout(600);
  await d.ev(() => buscarGastos('comp', 'super'));
  await P.waitForTimeout(250);
  is(await P.evaluate(() => {
    const c = document.getElementById('sq-res-comp');
    return !c.classList.contains('hidden')
      && document.getElementById('compartidos-list').classList.contains('hidden')
      && [...c.querySelectorAll('.sq-row')].every(r => /openEditSharedGasto/.test(r.getAttribute('onclick') || ''));
  }), 'en Compartidos busca igual y abre la edición compartida');
  await d.ev(() => limpiarBusqueda('comp'));
  await P.waitForTimeout(300);
  // Cambiar de mes o de sección no puede dejar resultados viejos en pantalla.
  await d.ev(() => { const i = document.getElementById('sq-inp-comp'); i.value = 'super'; buscarGastos('comp', 'super'); moveSharedMonth(-1); });
  await P.waitForTimeout(400);
  is(await P.evaluate(() => document.getElementById('sq-inp-comp').value === ''
      && document.getElementById('sq-res-comp').classList.contains('hidden')),
    'al cambiar de mes la búsqueda se limpia sola');
  await d.ev(() => moveSharedMonth(1));
  await P.waitForTimeout(400);

  // ════ LIQUIDACIONES ═════════════════════════════════════════════════
  section('LIQUIDACIONES · tocar la deuda abre el historial de transferencias');
  const tap = await P.evaluate(() => {
    const el = document.querySelector('#pg-compartidos .sh-debt-tap');
    return el ? (el.getAttribute('onclick') || '') : '(no está)';
  });
  is(/openLiquidaciones/.test(tap), 'el monto de la deuda es tocable');
  await d.ev(() => openLiquidaciones());
  await P.waitForTimeout(400);
  const liq = await P.evaluate(() => {
    const ov = document.getElementById('ov-liq');
    const filas = [...ov.querySelectorAll('.liq-row')];
    return { abierto: ov.classList.contains('open'),
             filas: filas.length,
             direcciones: filas.map(f => (f.querySelector('.liq-dir') || {}).textContent || ''),
             fechas: filas.every(f => (f.querySelector('.liq-date') || {}).textContent),
             montos: filas.every(f => /\$/.test((f.querySelector('.liq-amt') || {}).textContent || '')),
             totales: ov.querySelectorAll('.liq-tot-val').length };
  });
  is(liq.abierto, 'se abre el historial');
  is(liq.filas >= 1, `lista las transferencias hechas (${liq.filas})`);
  is(liq.direcciones.every(t => /→/.test(t)), 'cada una dice quién le transfirió a quién');
  is(liq.fechas, 'con la fecha');
  is(liq.montos, 'y el monto');
  eq(liq.totales, 2, 'y arriba los dos totales, uno por lado');
  await d.ev(() => closeOv('ov-liq'));
  await P.waitForTimeout(250);

  // ════ ATAJOS ════════════════════════════════════════════════════════
  section('GASTOS · los atajos de gastos frecuentes se sacaron');
  is(await P.evaluate(() => !document.getElementById('quick-chips-wrap')
      && !document.getElementById('ov-quick-chips')
      && typeof window.renderQuickChips === 'undefined'), 'no queda la fila, ni el editor, ni el código');

  section('ERRORES · JS durante toda la corrida');
  eq(d.errors, [], 'ningún error de página');

  console.log(`\n${'─'.repeat(52)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  await browser.close();
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error('ERROR:', e); process.exit(2); });
