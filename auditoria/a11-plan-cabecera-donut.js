// AUDITORÍA 11 — lo que cambió en la v33.1, en contexto iPhone: el Plan sin
// totales (Saldo bancos arriba, Resultado y Cierre del mes abajo, sin tacho en
// las filas), el tipo de cambio como etiqueta al lado de 🌙 y ⚙, y el donut
// con las cuatro categorías principales al lado.
const L = require('./lib');
const { eq, is, section } = L;

const IPHONE = {
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
};

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const now = new Date(), M = now.getMonth(), Y = now.getFullYear();
  const pk = (i) => { const d = new Date(Y, M + i, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const cats = ['comida', 'super', 'salidas', 'hogar', 'transporte', 'regalos'];
  const gastos = Array.from({ length: 24 }, (_, i) => ({ id: 'g' + i, desc: 'Gasto ' + i, cat: cats[i % 6],
    amount: 1000 * (i + 1), month: M, year: Y, day: 1 + (i % 27), addedAt: new Date(Y, M, 1 + (i % 27), 12).getTime() }));
  const d = await L.device(browser, {
    myName: 'fede', compBin: 'bin11', contexto: IPHONE,
    seed: {
      accounts: [{ id: 'a1', name: 'Galicia', type: 'bancaria', amount: 1000000, currency: 'ARS' },
                 { id: 'a2', name: 'IOL', type: 'inversión', amount: 5000000, currency: 'ARS' }],
      gastos,
      plan: [{ id: 'p1', name: 'Sueldo', cat: 'ingreso', months: { [pk(0)]: 500000, [pk(1)]: 500000 }, order: 1 },
             { id: 'p2', name: 'Alquiler', cat: 'hogar', months: { [pk(0)]: 200000, [pk(1)]: 12000 }, order: 1 }],
    },
  });
  const P = d.page;
  await P.waitForTimeout(400);

  section('PLAN · Saldo bancos arriba, sin totales, con Resultado y Cierre');
  const plan = await d.ev(() => {
    goTo('agenda'); switchAgendaTab('plan');
    const filas = [...document.querySelectorAll('#ptable tbody tr')].map(tr => tr.querySelector('td')?.textContent.trim() || '');
    const celdas = (txt) => {
      const tr = [...document.querySelectorAll('#ptable tbody tr')].find(t => (t.querySelector('td')?.textContent || '').includes(txt));
      // Las celdas de un concepto son campos editables: el valor está en el input.
      return tr ? [...tr.querySelectorAll('td')].slice(1, 3).map(td => (td.querySelector('input') ? td.querySelector('input').value : td.textContent).trim()) : null;
    };
    return { filas, saldo: celdas('Saldo bancos'), res: celdas('Resultado del mes'), cierre: celdas('Cierre del mes'),
      alq: celdas('Alquiler'), tachos: document.querySelectorAll('#ptable .tdel').length };
  });
  const idx = (t) => plan.filas.findIndex(f => f.includes(t));
  is(idx('Inversiones') >= 0, 'Inversiones sigue como línea');
  is(idx('Saldo bancos') >= 0 && idx('Saldo bancos') < idx('Ingresos'), 'Saldo bancos va arriba, afuera de Ingresos');
  is(idx('Total ingresos') < 0 && idx('Total gastos') < 0, 'no hay Total ingresos ni Total gastos');
  is(idx('Resultado del mes') > idx('Gastos') && idx('Cierre del mes') > idx('Resultado del mes'), 'abajo quedan Resultado del mes y Cierre del mes, en ese orden');
  is(idx('Neto') < 0, 'la fila "Neto" pasó a llamarse Cierre del mes');
  eq(plan.res, ['+300k', '+488k'], 'resultado = ingresos − gastos de cada mes');
  eq(plan.cierre, ['1,3M', '1,8M'], 'cierre = saldo bancos + resultado');
  eq(plan.saldo[1], plan.cierre[0], 'y el saldo del mes siguiente arranca con el cierre del anterior');
  eq(plan.alq[1], '−12k', 'sin ",0" colgando');
  eq(plan.tachos, 0, 'las filas ya no tienen tacho');
  const del = await d.ev(async () => {
    openEditProj(S.plan.find(p => p.name === 'Alquiler'));
    await new Promise(r => setTimeout(r, 380));
    const btn = document.getElementById('ep-del-btn');
    const visible = !!btn && btn.getBoundingClientRect().width > 0;
    btn.click(); await new Promise(r => setTimeout(r, 120));
    confirmResolve(true); await new Promise(r => setTimeout(r, 150));
    return { visible, sigue: S.plan.some(p => p.name === 'Alquiler'), cerrado: !document.getElementById('ov-edit-proj').classList.contains('open') };
  });
  is(del.visible, 'el tacho está en el menú de edición');
  is(!del.sigue && del.cerrado, 'y borra el concepto y cierra el menú');

  section('CABECERA · el tipo de cambio va al lado de 🌙 y ⚙');
  const cab = await d.ev(() => {
    goTo('saldos'); render();
    const chip = document.getElementById('tc-chip'), tema = document.getElementById('theme-toggle-btn-inline');
    const fecha = document.getElementById('dtag');
    const c = chip.getBoundingClientRect(), t = tema.getBoundingClientRect();
    return { texto: chip.textContent.trim(), misma: Math.abs((c.top + c.bottom) / 2 - (t.top + t.bottom) / 2) < 3,
      pegado: t.left - c.right >= 0 && t.left - c.right < 16, fechaUnRenglon: fecha.scrollHeight <= fecha.clientHeight + 1,
      popOculto: document.getElementById('tc-pop').classList.contains('hidden') };
  });
  eq(cab.texto, 'US$ 1.300', 'la etiqueta muestra la cotización');
  is(cab.misma && cab.pegado, 'en el mismo renglón, pegada al botón del tema');
  is(cab.fechaUnRenglon, 'y la fecha entra en un renglón');
  is(cab.popOculto, 'el recuadro arranca cerrado');
  await P.tap('#tc-chip'); await P.waitForTimeout(150);
  is(!(await d.ev(() => document.getElementById('tc-pop').classList.contains('hidden'))), 'tocar la etiqueta abre el recuadro');
  await P.fill('#tc', '1450'); await P.waitForTimeout(250);
  const tc = await d.ev(() => ({ s: S.tc, chip: document.getElementById('tc-chip').textContent.trim() }));
  eq(tc.s, 1450, 'cambiar el valor ahí cambia la cotización, como antes');
  eq(tc.chip, 'US$ 1.450', 'y la etiqueta se actualiza');
  is(await d.ev(() => typeof fetchTC === 'function' && document.getElementById('tc-fetch-btn').getAttribute('onclick') === 'fetchTC(true)'), 'el ↻ sigue llamando a la misma actualización');
  await P.tap('.widget-res'); await P.waitForTimeout(150);
  is(await d.ev(() => document.getElementById('tc-pop').classList.contains('hidden')), 'tocar afuera lo cierra');

  section('DONUT · solo, con "Ver categorías" y el detalle al tocar');
  const don = await d.ev(() => {
    goTo('gastos'); renderGastos();
    const q = document.getElementById('sq-wrap-gastos'), m = document.querySelector('#pg-gastos .month-strip');
    return { filas: document.querySelectorAll('#donut-legend .dl-row[data-cat]').length, mas: (document.querySelector('#donut-legend .dl-more')||{}).textContent || '', cmpBtn: !!document.getElementById('cmp-open-btn'),
      buscadorArriba: !!(q.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING),
      toggle: getComputedStyle(document.getElementById('cat-collapse-btn')).display };
  });
  eq(don.filas, 5, 'a la derecha del donut van las cinco categorías que más pesan');
  is(/\+ 1 más/.test(don.mas), `y "+ 1 más" para el resto (${don.mas.trim()})`);
  is(!don.cmpBtn, 'sin botón de comparar');
  is(don.buscadorArriba, 'el buscador va arriba de la franja del mes');
  eq(don.toggle, 'none', 'el botón "Ver categorías" no se ve: lo reemplaza "+ N más"');
  await P.tap('#donut-legend .dl-more'); await P.waitForTimeout(200);
  is(await d.ev(() => document.querySelectorAll('#cat-list .cat-item').length === 6), 'abre la lista completa (6 categorías)');
  await d.ev(() => document.querySelector('#cat-list .cat-item').click()); await P.waitForTimeout(250);
  is(await d.ev(() => document.getElementById('cat-detail-panel').style.display === 'block' && document.getElementById('donut-lbl-txt').textContent !== 'Total'), 'tocar una categoría abre su detalle');
  const busq = await d.ev(() => { buscarGastos('gastos', 'gasto 1'); const v = getComputedStyle(document.querySelector('#gt-view-gastos .donut-card')).display; limpiarBusqueda('gastos'); return v; });
  eq(busq, 'none', 'mientras se busca, el donut se aparta');
  section('COMPARAR MESES · mantener apretado el mes');
  const cmp = await d.ev(() => { closeOv('ov-compare'); document.getElementById('mlbl').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); return document.getElementById('ov-compare').classList.contains('open'); });
  is(cmp, 'mantener apretado el mes abre la comparación');
  section('MAYÚSCULA · primera letra');
  eq(await d.ev(() => capF('carniceria') + '|' + capF('  verdura') + '|' + capF('') + '|' + capF('Ya')), 'Carniceria|  Verdura||Ya', 'capF pone la primera letra en mayúscula');

  section('ERRORES · JS durante toda la corrida');
  eq(d.errors, [], 'ningún error de página');

  console.log(`\n${'─'.repeat(52)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  await browser.close();
  process.exit(L.results.fail ? 1 : 0);
})();
