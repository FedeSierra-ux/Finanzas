// AUDITORÍA 20 — LOS 4 ARREGLOS Y LAS ANIMACIONES DE LA v34.15.
//
// 1. La fecha de la cabecera entra entera en 375 px aunque el día sea largo.
// 2. Lo vencido aparece en los avisos de Saldos, igual que en la Agenda.
// 3. "Liquidar" no aparece con la deuda en $ 0.
// 4. Un gasto propio que se borró sin conexión y la pareja editó después
//    vuelve a la lista propia, editable (antes se veía como de la pareja).
// Y las animaciones 8.1–8.8, con "reducir movimiento" respetado.
const L = require('./lib');
const { eq, is, section } = L;
const BIN = 'bin20';
const pad = n => String(n).padStart(2, '0');
const dKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await L.launch();
  const waitApp = d => d.page.waitForFunction(() => typeof S === 'object' && S !== null && typeof syncCompartidos === 'function');
  const prep = d => d.ev(() => {
    if (_sharedAutoTimer) { clearInterval(_sharedAutoTimer); _sharedAutoTimer = null; }
    if (!window.__netWrapped) {
      const f = window.fetch;
      window.fetch = async (url, opts) => { if (window.__offline) throw new TypeError('Failed to fetch'); return f(url, opts); };
      window.__netWrapped = true;
    }
  });
  const settle = async d => { await d.settle(); await d.settle(); };
  const sync = async d => { await d.ev(() => syncCompartidos(null)); await settle(d); };
  const offline = async (d, on) => { await d.ev(on => { window.__offline = on; }, on); await d.ctx.setOffline(on); };
  const iphone = { viewport: { width: 375, height: 760 }, deviceScaleFactor: 2, hasTouch: true };

  // ── 1 · Fecha de la cabecera ─────────────────────────────────────────────
  section('1 · La fecha de la cabecera entra entera');
  {
    const d = await L.device(browser, { myName: 'fede', compBin: BIN, contexto: iphone });
    await d.page.waitForTimeout(450);
    // Miércoles 30 de septiembre: el día más largo con el número de dos cifras.
    await d.page.clock.install({ time: new Date(2026, 8, 30, 10) });
    await d.page.reload(); await waitApp(d); await prep(d);
    const medir = (tc = 1465) => d.ev((tc) => { S.tc = tc; renderTcChip(); const el = $('dtag'); return { txt: el.textContent, entra: el.scrollWidth <= el.clientWidth, ancho: el.clientWidth }; }, tc);
    const largo = await medir();
    is(largo.entra, `"${largo.txt}" entra sin cortarse (${largo.ancho}px)`);
    is(/^Mié(rcoles)? 30 sep$/.test(largo.txt), `dice el día y la fecha: "${largo.txt}"`);
    await d.page.clock.setSystemTime(new Date(2026, 9, 4, 10)); // domingo 4 oct: entra el nombre entero
    const corto = await medir(0); // sin cotización ("US$ —") hay más lugar
    eq(corto.txt, 'Domingo 4 oct', 'con un día que entra va el nombre completo');
    is(corto.entra, 'y no se corta');
    const conDolar = await medir();
    is(conDolar.entra, `con "US$ 1.465" al lado se abrevia si hace falta ("${conDolar.txt}")`);
    await d.page.setViewportSize({ width: 320, height: 700 });
    await d.page.waitForTimeout(200);
    const angosto = await d.ev(() => { const el = $('dtag'); return { txt: el.textContent, entra: el.scrollWidth <= el.clientWidth }; });
    is(angosto.entra || angosto.txt === 'Dom 4 oct', `al achicar la ventana vuelve a medirse ("${angosto.txt}")`);
    eq(d.errors, [], 'sin errores de JS');
    await d.close();
  }

  // ── 2 · Avisos de Saldos ─────────────────────────────────────────────────
  section('2 · Lo vencido aparece en los avisos de Saldos');
  {
    const hoy = new Date(); hoy.setHours(12, 0, 0, 0);
    const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
    const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);
    const lejos = new Date(hoy); lejos.setDate(lejos.getDate() + 5);
    const agenda = { subs: [{ id: 's1', name: 'Netflix', amount: 9000, date: dKey(lejos), period: 'mensual' }],
      vencimientos: [{ id: 'v1', name: 'Patente', amount: 42000, date: dKey(ayer), period: 'unica' },
        { id: 'v2', name: 'Expensas', amount: 80000, date: dKey(manana), period: 'unica' }], cuotas: [], inversiones: [] };
    const d = await L.device(browser, { myName: 'fede', compBin: BIN, seed: { agenda } });
    const r = await d.ev(() => {
      goTo('saldos'); renderWidget();
      const cards = [...document.querySelectorAll('#widget-res .wr-bell-card')].map(c => ({ t: c.querySelector('.wr-bell-title').textContent,
        v: c.querySelector('.wr-bell-vence').textContent, w: c.querySelector('.wr-bell-when').textContent, venc: c.classList.contains('vencido'),
        color: getComputedStyle(c.querySelector('.wr-bell-when')).color }));
      const agenda = buildAgendaRows().filter(x => x.days < 0).map(x => x.name);
      return { cards, agenda, rojo: getComputedStyle(document.documentElement).getPropertyValue('--red') };
    });
    eq(r.agenda, ['Patente'], 'la Agenda lo marca vencido');
    eq(r.cards.map(c => c.t), ['Patente', 'Expensas'], 'Saldos lo muestra primero, antes de lo que vence mañana');
    eq([r.cards[0].v, r.cards[0].w], ['venció', 'ayer'], 'dice "venció ayer"');
    is(r.cards[0].venc && r.cards[1] && !r.cards[1].venc, 'en rojo solo lo vencido');
    eq([r.cards[1].v, r.cards[1].w], ['vence', 'mañana'], 'lo que viene sigue diciendo "vence mañana"');
    eq(d.errors, [], 'sin errores de JS');
    await d.close();
  }

  // ── 3 y 4 · Compartidos con dos teléfonos ────────────────────────────────
  L.resetBins();
  const mk = async name => { const d = await L.device(browser, { myName: name, compBin: BIN, contexto: iphone }); await prep(d); return d; };
  const fede = await mk('fede');
  const mile = await mk('mile');

  section('3 · "Liquidar" solo con deuda');
  const liq = d => d.ev(() => { goTo('compartidos'); renderCompartidos(); return { btn: !!document.querySelector('#compartidos-list .sh-btn-liq'), lbl: (document.querySelector('#compartidos-list .sh-debt-lbl') || {}).textContent }; });
  await sync(fede);
  const sinDeuda = await liq(fede);
  is(!sinDeuda.btn, `con la deuda en $ 0 no está el botón ("${sinDeuda.lbl}")`);
  // Alta por el modal, como una persona: Fede paga $ 30.000 a medias.
  const alta = await fede.ev(() => {
    _gSaving = false; openGastoModal();
    $('gdesc').value = 'Cena'; onGastoDescInput('Cena');
    document.querySelector('#gcats .chip[data-v="salidas"]').click();
    $('gamt').value = '30.000';
    $('g-shared-toggle').click();
    document.querySelector('#g-split-presets [data-split="50"]').click();
    document.querySelector('#ov-gasto .btnp').click();
    const g = S.gastos[S.gastos.length - 1];
    return { id: g && g.id, open: $('ov-gasto').classList.contains('open'), tilde: !!document.querySelector('.tilde-ok') };
  });
  await settle(fede);
  is(!!alta.id, 'el gasto compartido se guarda');
  const conDeuda = await liq(fede);
  is(conDeuda.btn, `con deuda vuelve el botón ("${conDeuda.lbl}")`);
  await sync(mile);
  is((await liq(mile)).btn, 'y la pareja, que debe, también lo ve');

  section('4 · Gasto propio borrado sin conexión que la pareja editó después');
  await offline(fede, true);
  // Borrar desde la lista de Gastos, igual que el ⋯ → Eliminar de la fila.
  await fede.ev(async id => {
    S.gastos = S.gastos.filter(x => x.id !== id);
    S._deletedGastoIds = (S._deletedGastoIds || []).concat(id);
    save();
    await removeSharedBinGasto(id).catch(() => {});
  }, alta.id);
  await fede.page.waitForTimeout(300);
  is(!(await fede.ev(id => S.gastos.some(x => x.id === id), alta.id)), 'Fede lo borra sin señal');
  await mile.page.waitForTimeout(50); // la edición de Mile es posterior al borrado
  const ed = await mile.ev(id => {
    openEditSharedGasto({ id });
    if (!$('ov-edit-shared').classList.contains('open')) return { err: 'el editor no abrió' };
    $('esg-amt').value = '31.000';
    document.querySelector('#ov-edit-shared .btnp').click();
    return { open: $('ov-edit-shared').classList.contains('open') };
  }, alta.id);
  await settle(mile);
  is(!ed.err && !ed.open, 'Mile corrige el importe a $ 31.000 con conexión');
  await offline(fede, false);
  await sync(fede); await sync(mile); await sync(fede);
  const vuelta = await fede.ev(id => {
    const g = S.gastos.find(x => x.id === id);
    const f = g && new Date(g.addedAt); if (f) setGastosMonth(f.getMonth(), f.getFullYear());
    goTo('gastos'); renderGastos();
    const row = document.querySelector(`#gastos-list .gasto-row[data-id="${id}"]`);
    if (row) row.click();
    const abre = $('ov-edit-gasto').classList.contains('open'); closeOv('ov-edit-gasto');
    return { local: !!g, amount: g && g.amount, borrado: (S._deletedGastoIds || []).includes(id), tomb: !!(S._gTombs || {})[id],
      fila: !!row, abre, enBin: _sharedBinGastos.filter(x => x.id === id).length, toasts: (window.__toasts || []).filter(t => /solo lectura/.test(t)) };
  }, alta.id);
  is(vuelta.local, 'el gasto vuelve a los gastos propios de Fede');
  eq(vuelta.amount, 31000, 'con la corrección de Mile');
  is(!vuelta.borrado && !vuelta.tomb, 'sin la marca de borrado (no se vuelve a borrar en el próximo sync)');
  is(vuelta.fila && vuelta.abre, 'tocar la fila abre la edición');
  eq(vuelta.toasts, [], 'y no dice "solo lectura"');
  eq(vuelta.enBin, 1, 'una sola vez en el bin');
  const deMile = await mile.ev(id => ({ suyo: S.gastos.some(x => x.id === id), ve: _sharedBinGastos.filter(x => x.id === id).length }), alta.id);
  is(!deMile.suyo && deMile.ve === 1, 'Mile lo sigue viendo una vez, como gasto de Fede');

  // ── Animaciones ──────────────────────────────────────────────────────────
  section('8.1 · La hoja sube con resorte');
  const hoja = await fede.ev(() => { openGastoModal(); const cs = getComputedStyle(document.querySelector('#ov-gasto .modal')); const r = { n: cs.animationName, t: cs.animationDuration, f: cs.animationTimingFunction }; closeOv('ov-gasto'); return r; });
  eq([hoja.n, hoja.t], ['sheetIn', '0.5s'], 'la hoja entra con sheetIn en 0,5 s');
  is(/cubic-bezier\(0\.32, 0\.72, 0, 1\)/.test(hoja.f), `con curva de resorte (${hoja.f})`);

  section('8.2 · La pastilla de la barra');
  eq(await fede.ev(() => { goTo('agenda'); return getComputedStyle(document.querySelector('#nav-agenda .ni')).animationName; }), 'niPop', 'la pastilla de la sección elegida se abre');

  section('8.3 · Los botones se hunden al apretarlos');
  const press = await fede.ev(() => {
    const reglas = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch (e) { return []; } });
    const act = reglas.find(r => r.selectorText && r.selectorText.includes('.btnp:active') && /scale\(0?\.97\)/.test(r.cssText));
    openGastoModal(); const tp = getComputedStyle(document.querySelector('#ov-gasto .btnp')).transitionProperty; closeOv('ov-gasto');
    return { act: !!act, sel: act ? act.selectorText.split(',').length : 0, tp };
  });
  is(press.act && press.sel >= 10, `una regla :active con scale(.97) para ${press.sel} tipos de botón`);
  is(/transform/.test(press.tp), 'con transición de transform');

  section('8.4 · Esqueleto mientras carga');
  const sk = await fede.ev(() => {
    _sharedBinLoaded = false; _sharedBinFetchFailed = false; goTo('compartidos'); renderCompartidos();
    const n = document.querySelectorAll('#compartidos-list .skel').length;
    const anim = n ? getComputedStyle(document.querySelector('#compartidos-list .skel')).animationName : '';
    const txt = document.querySelector('#compartidos-list').textContent.trim();
    return { n, anim, txt };
  });
  is(sk.n >= 10 && sk.anim === 'skel', `Compartidos muestra ${sk.n} bloques con brillo mientras sincroniza`);
  eq(sk.txt, '', 'sin el texto "Sincronizando compartidos..."');
  await settle(fede); await fede.page.waitForTimeout(200);
  is(await fede.ev(() => !document.querySelector('#compartidos-list .skel') && !!document.querySelector('#compartidos-list .sh-card')), 'y al llegar los datos lo reemplaza la tarjeta');
  is(/class="skel/.test(require('fs').readFileSync(L.APP_FILE, 'utf8').match(/<div class="widget-res" id="widget-res">.*<\/div><\/div>/)[0]), 'el resumen de Saldos arranca con esqueleto y no con "Cargando resumen…"');

  section('8.5 · Filas escalonadas al cambiar de mes');
  // Gastos propios en dos meses.
  const fil = await fede.ev(() => {
    const n = new Date(); const pm = new Date(n.getFullYear(), n.getMonth() - 1, 10, 12);
    for (let i = 0; i < 5; i++) S.gastos.push({ id: 'p' + i, desc: 'Viejo ' + i, amount: 1000 + i, cat: 'super', month: pm.getMonth(), year: pm.getFullYear(), day: 10, addedAt: pm.getTime() + i });
    save(); goTo('gastos'); setGastosMonth(n.getMonth(), n.getFullYear(), false); renderGastos();
    setGastosMonth(pm.getMonth(), pm.getFullYear());
    const filas = [...document.querySelectorAll('#gastos-list .gasto-row')];
    const con = filas.filter(r => r.classList.contains('fila-entra'));
    const delays = con.map(r => getComputedStyle(r).animationDelay);
    renderGastos(); // editar o sincronizar redibuja quieto
    const despues = document.querySelectorAll('#gastos-list .fila-entra').length;
    return { filas: filas.length, con: con.length, delays, despues };
  });
  eq(fil.con, fil.filas, `las ${fil.filas} filas del mes nuevo entran animadas`);
  eq(fil.delays.slice(0, 3), ['0.03s', '0.06s', '0.09s'], 'de a una, 30 ms entre cada una (la cabecera del día es la primera)');
  eq(fil.despues, 0, 'redibujar el mismo mes no las anima');

  section('8.6 · Los totales de Compartidos cuentan hasta su valor');
  const cu = await fede.ev(async () => {
    const n = new Date(); setGastosMonth(n.getMonth(), n.getFullYear(), false);
    goTo('compartidos'); await new Promise(r => setTimeout(r, 300));
    _lastShDebt = 0; _lastShTotal = 0; renderCompartidos();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const v = document.querySelector('#compartidos-list .sh-debt-val'), t = document.querySelector('#compartidos-list .sh-cat-total');
    const medio = [v.textContent, t.textContent];
    await new Promise(r => setTimeout(r, 900));
    return { medio, fin: [v.textContent, t.textContent] };
  });
  eq(cu.fin, ['$ 15.500', '$ 31.000'], 'terminan en la deuda y el total del mes');
  is(cu.medio[0] !== cu.fin[0] && cu.medio[1] !== cu.fin[1], `y arrancan desde abajo (${cu.medio.join(' · ')})`);

  section('8.7 · Tilde al guardar un gasto');
  is(alta.tilde && !alta.open, 'al guardar aparece el tilde y la hoja se cierra en el momento');
  const ti = await fede.ev(async () => {
    _gSaving = false; openGastoModal(); $('gdesc').value = 'Kiosco'; onGastoDescInput('Kiosco');
    document.querySelector('#gcats .chip[data-v="comida"]').click(); $('gamt').value = '2.500';
    document.querySelector('#ov-gasto .btnp').click();
    const t = document.querySelector('.tilde-ok');
    await new Promise(r => setTimeout(r, 450));
    const cs = t && getComputedStyle(t), dash = t && getComputedStyle(t.querySelector('path')).strokeDashoffset;
    const forma = t ? { w: t.getBoundingClientRect().width, h: t.getBoundingClientRect().height, bg: cs.backgroundColor, dash } : null;
    openGastoModal(); // volver a abrir enseguida no choca con el tilde
    await new Promise(r => setTimeout(r, 800));
    const r = { forma, sigue: !!document.querySelector('.tilde-ok'), abierta: $('ov-gasto').classList.contains('open'), verde: getComputedStyle(document.documentElement).getPropertyValue('--green').trim() };
    closeOv('ov-gasto');
    return r;
  });
  is(!!ti.forma && Math.abs(ti.forma.w - ti.forma.h) < 2, `el botón se vuelve un círculo (${ti.forma && Math.round(ti.forma.w)}×${ti.forma && Math.round(ti.forma.h)})`);
  is(!!ti.forma && parseFloat(ti.forma.dash) < 24, `y el tilde se dibuja (trazo pendiente ${ti.forma && ti.forma.dash})`);
  is(!ti.sigue, 'después se va solo');
  is(ti.abierta, 'reabrir la hoja enseguida la deja abierta');

  section('8.8 · Pestañas de Agenda');
  const tabs = await fede.ev(async () => {
    goTo('agenda'); switchAgendaTab('lista');
    await new Promise(r => setTimeout(r, 50));
    switchAgendaTab('plan');
    const ind = document.querySelector('.ag-tab-ind'), t = $('ag-tab-plan');
    const enViaje = getComputedStyle(ind).transitionProperty;
    await new Promise(r => setTimeout(r, 500));
    const ir = ind.getBoundingClientRect(), tr = t.getBoundingClientRect();
    const fondoTab = getComputedStyle(t).backgroundImage + getComputedStyle(t).backgroundColor;
    const r = { con: ind.closest('.ag-tab-row').classList.contains('con-ind'), dx: Math.abs(ir.left - tr.left), dw: Math.abs(ir.width - tr.width), enViaje, fondoTab,
      fade: getComputedStyle($('ag-view-plan')).animationName };
    switchAgendaTab('lista');
    return r;
  });
  is(tabs.con && tabs.dx < 1 && tabs.dw < 1, `la pastilla queda debajo de "Plan" (desvío ${tabs.dx.toFixed(1)}px)`);
  is(/transform/.test(tabs.enViaje), 'y viaja con transición');
  is(/none/.test(tabs.fondoTab) && /rgba\(0, 0, 0, 0\)|transparent/.test(tabs.fondoTab), 'la pestaña elegida no pinta un segundo fondo encima');
  eq(tabs.fade, 'tabFadeIn', 'el contenido cambia con fundido');
  // Con la página oculta no hay medidas: al volver se ubica sola.
  const oculta = await fede.ev(async () => {
    const cuadro = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    goTo('saldos'); await cuadro(); switchAgendaTab('tarjetas'); await cuadro(); goTo('agenda');
    await cuadro();
    const ir = document.querySelector('.ag-tab-ind').getBoundingClientRect(), tr = $('ag-tab-tarjetas').getBoundingClientRect();
    switchAgendaTab('lista');
    return Math.abs(ir.left - tr.left);
  });
  is(oculta < 1, 'elegida con la página oculta, la pastilla aparece en su lugar al volver');

  section('Reducir movimiento');
  await fede.page.emulateMedia({ reducedMotion: 'reduce' });
  const rm = await fede.ev(() => {
    _gSaving = false; openGastoModal(); $('gdesc').value = 'Pan'; onGastoDescInput('Pan');
    document.querySelector('#gcats .chip[data-v="comida"]').click(); $('gamt').value = '1.500';
    const dur = getComputedStyle(document.querySelector('#ov-gasto .modal')).animationDuration;
    document.querySelector('#ov-gasto .btnp').click();
    return { tilde: !!document.querySelector('.tilde-ok'), dur };
  });
  is(!rm.tilde, 'sin tilde animado');
  is(parseFloat(rm.dur) < 0.01, `la hoja aparece sin animación (${rm.dur})`);
  await fede.page.emulateMedia({ reducedMotion: 'no-preference' });

  section('Errores');
  eq(fede.errors, [], 'Fede sin errores de JS');
  eq(mile.errors, [], 'Mile sin errores de JS');

  console.log(`\n────────────────────────────────────────────────────\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  await browser.close();
  process.exitCode = L.results.fail ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
