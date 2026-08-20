// AUDITORÍA 8 — NAVEGACIÓN (v31).
//
// La v31 movió tres cosas de lugar: Compartidos dejó de ser pestaña de Gastos y
// pasó a sección propia en la barra de abajo, el Plan dejó de ser sección y
// pasó a ser la tercera pestaña de Agenda, y la pestaña Calendario se sacó.
// Esta auditoría fija esa estructura: que cada sección muestre lo suyo, que el
// mes siga siendo uno solo entre Gastos y Compartidos, que el "+" flotante abra
// lo que corresponde en cada lado, y que los nombres viejos —goTo('plan'),
// switchGastosTab('compartidos'), un tab 'cal' guardado— sigan llevando a algún
// lado en vez de dejar la app en una pantalla vacía.
//
// Corre en el contexto de un iPhone porque los dos arreglos de UI que fueron
// con el mismo cambio —la flecha de volver que pisaba el título y el degradado
// negro al pie de los menús— se ven ahí: pantalla angosta y menús largos.
const L = require('./lib');
const { eq, is, section } = L;
const IPHONE = {
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
};
const SIN_APIS = () => {
  try { delete window.Notification; } catch (e) { window.Notification = undefined; }
  try { delete navigator.vibrate; } catch (e) {}
};
(async () => {
  const browser = await L.launch();
  L.resetBins();
  const now = new Date(), M = now.getMonth(), Y = now.getFullYear();
  const d = await L.device(browser, {
    myName: 'fede', compBin: 'binR', contexto: IPHONE, initScript: SIN_APIS,
    seed: {
      gastos: [
        ...Array.from({ length: 10 }, (_, i) => ({ id: 'g' + i, desc: 'Gasto ' + i, cat: ['comida','transporte','salidas','hogar','compras','super'][i % 6],
          amount: 1000 * (i + 3), month: M, year: Y, day: 1 + (i % 27), addedAt: Date.now() - i * 3600e3 })),
        { id: 'sh1', desc: 'Super compartido', cat: 'super', amount: 40000, month: M, year: Y, day: 5,
          addedAt: Date.now() - 7200e3, shared: { active: true, paidBy: 'fede', splitPct: 50 } },
        { id: 'sh2', desc: 'Alquiler', cat: 'depto', amount: 300000, month: M, year: Y, day: 2,
          addedAt: Date.now() - 9200e3, shared: { active: true, paidBy: 'mile', splitPct: 50 } },
      ],
      plan: [{ id: 'p1', name: 'Sueldo', cat: 'ingreso', months: { [M]: 2000000 }, order: 1 },
             { id: 'p2', name: 'Alquiler', cat: 'hogar', months: { [M]: 500000 }, order: 2 }],
      agenda: {
        subs: [{ id: 's1', name: 'Netflix', amount: 12000, date: new Date(Y, M, 25).toISOString().slice(0,10), period: 'mensual' }],
        vencimientos: [{ id: 'v1', name: 'Patente', amount: 45000, date: new Date(Y, M, 20).toISOString().slice(0,10), period: 'unica' }],
        cuotas: [{ id: 'c1', name: 'Notebook', fee: 120000, total: 6, paid: 1 }],
        inversiones: [],
      },
    },
  });
  const P = d.page;
  await d.ev(() => { render(); renderGastos(); renderProj(); renderAgenda(); });
  await P.waitForTimeout(400);

  // ════ 1. NAVEGACIÓN ══════════════════════════════════════════════════
  section('v31 · la barra de abajo tiene las cuatro secciones nuevas');
  const nav = await d.ev(() => [...document.querySelectorAll('.nav .nb')].map(b => ({ id: b.id, txt: b.textContent.trim() })));
  eq(nav.map(n => n.id).join(','), 'nav-saldos,nav-gastos,nav-compartidos,nav-agenda', 'en el orden pedido');
  eq(nav.map(n => n.txt).join(' · '), 'Saldos · Gastos · Compartidos · Agenda', 'con las etiquetas correctas');
  const anchoNav = await d.ev(() => [...document.querySelectorAll('.nav .nb')].map(b => {
    const r = b.getBoundingClientRect();
    const t = document.createRange(); t.selectNodeContents(b);
    return Math.round(t.getBoundingClientRect().width) <= Math.round(r.width);
  }));
  is(anchoNav.every(Boolean), 'y ninguna etiqueta se pasa de su botón a 390px');

  section('v31 · cada sección muestra su vista y prende su botón');
  for (const [pg, sel] of [['saldos','#pg-saldos'],['gastos','#pg-gastos'],['compartidos','#pg-compartidos'],['agenda','#pg-agenda']]) {
    await d.ev(x => goTo(x), pg); await P.waitForTimeout(280);
    const r = await d.ev(({ pg, sel }) => ({
      visible: !document.querySelector(sel).classList.contains('hidden'),
      otras: [...document.querySelectorAll('.page')].filter(p => p.id !== sel.slice(1) && !p.classList.contains('hidden')).map(p => p.id),
      on: [...document.querySelectorAll('.nav .nb.on')].map(b => b.id),
      cur: curPage,
    }), { pg, sel });
    is(r.visible && r.otras.length === 0, `${pg}: se ve solo su página`);
    eq(r.on.join(','), 'nav-' + pg, `${pg}: prende solo su botón`);
  }

  section('v31 · Gastos quedó con dos pestañas y Compartidos salió de ahí');
  const tabsG = await d.ev(() => [...document.querySelectorAll('#pg-gastos .pg-tab')].map(b => b.textContent.trim()));
  eq(tabsG.join(' · '), '📊 Gastos · 💰 Presupuesto', 'Gastos: Gastos + Presupuesto');
  eq(await d.ev(() => !!document.getElementById('gt-view-compartidos')), false, 'ya no queda la vista vieja de compartidos adentro de Gastos');

  section('v31 · Agenda quedó con Agenda · Tarjetas · Plan');
  const tabsA = await d.ev(() => [...document.querySelectorAll('#pg-agenda .ag-tab')].map(b => b.textContent.trim()));
  eq(tabsA.join(' · '), '📋 Agenda · 💳 Tarjetas · 📋 Plan', 'las tres pestañas');
  eq(await d.ev(() => !!document.getElementById('ag-view-cal')), false, 'el calendario ya no está en el DOM');
  eq(await d.ev(() => typeof renderCalendar), 'undefined', 'ni su código');
  for (const t of ['lista', 'tarjetas', 'plan']) {
    await d.ev(() => goTo('agenda'));
    await d.ev(x => switchAgendaTab(x), t); await P.waitForTimeout(280);
    const r = await d.ev(() => ({
      vis: ['ag-view-lista','ag-view-tarjetas','ag-view-plan'].filter(id => !document.getElementById(id).classList.contains('hidden')),
      on: [...document.querySelectorAll('#pg-agenda .ag-tab.on')].map(b => b.id),
    }));
    eq(r.vis.join(','), 'ag-view-' + t, `Agenda/${t}: una sola vista visible`);
    eq(r.on.join(','), 'ag-tab-' + t, `Agenda/${t}: una sola pestaña prendida`);
  }
  is(await d.ev(() => { switchAgendaTab('plan'); return document.querySelector('#ag-view-plan #ptable tbody, #ag-view-plan #ptable tr') !== null; }), 'el Plan se dibuja adentro de Agenda');
  is(await d.ev(() => { switchAgendaTab('plan'); planScroll(1); return true; }), 'y las flechas de meses del Plan siguen enganchadas a la tabla');

  section('v31 · lo viejo sigue respondiendo (atajos, bot, auditorías)');
  await d.ev(() => goTo('plan')); await P.waitForTimeout(250);
  eq(await d.ev(() => curPage + '/' + _curAgendaTab), 'agenda/plan', "goTo('plan') lleva a la pestaña Plan de Agenda");
  await d.ev(() => switchGastosTab('compartidos')); await P.waitForTimeout(250);
  eq(await d.ev(() => curPage), 'compartidos', "switchGastosTab('compartidos') lleva a la sección Compartidos");
  await d.ev(() => { goTo('agenda'); switchAgendaTab('cal'); }); await P.waitForTimeout(200);
  eq(await d.ev(() => _curAgendaTab), 'lista', "y una pestaña 'cal' guardada de antes cae en la lista, no en el vacío");

  // ════ 2. EL MES COMPARTIDO ═══════════════════════════════════════════
  section('v31 · Gastos y Compartidos siguen mirando el mismo mes');
  await d.ev(() => goTo('compartidos')); await P.waitForTimeout(300);
  const m0 = await d.ev(() => ({ g: $('mlbl').textContent, c: $('mlbl-comp').textContent, cur: curMonth, sh: _sharedMonth, pr: _presupMonth }));
  eq(m0.g, m0.c, 'las dos franjas arrancan diciendo lo mismo');
  is(m0.cur === m0.sh && m0.cur === m0.pr, 'y el mes es uno solo por dentro');
  await d.ev(() => moveSharedMonth(-1)); await P.waitForTimeout(300);
  const m1 = await d.ev(() => ({ g: $('mlbl').textContent, c: $('mlbl-comp').textContent, cur: curMonth, sh: _sharedMonth, pr: _presupMonth }));
  eq(m1.c, m1.g, 'retrocediendo desde Compartidos, Gastos queda en el mismo mes');
  is(m1.cur === m1.sh && m1.cur === m1.pr, 'los tres espejos siguen alineados');
  await d.ev(() => { goTo('gastos'); chMonth(1); }); await P.waitForTimeout(300);
  const m2 = await d.ev(() => ({ g: $('mlbl').textContent, c: $('mlbl-comp').textContent }));
  eq(m2.c, m2.g, 'y avanzando desde Gastos, Compartidos también');
  eq(m2.g, m0.g, 'vuelve al mes de partida');

  section('v31 · Compartidos se dibuja cuando corresponde');
  await d.ev(() => goTo('compartidos')); await P.waitForTimeout(500);
  is(await d.ev(() => document.getElementById('compartidos-list').children.length > 0), 'la lista tiene contenido al entrar');
  is(await d.ev(() => document.querySelector('#pg-compartidos .month-strip') !== null), 'y su propia franja de mes');

  // ════ 3. EL "+" CONTEXTUAL ═══════════════════════════════════════════
  section('v31 · el "+" flotante abre lo que corresponde a cada sección');
  const abrio = async (setup) => {
    await d.ev(setup); await P.waitForTimeout(200);
    await d.ev(() => document.querySelectorAll('.overlay.open').forEach(o => closeOv(o.id)));
    await P.waitForTimeout(150);
    await d.ev(() => fabTap({ clientX: 100, clientY: 100 }));
    await P.waitForTimeout(350);
    const id = await d.ev(() => (document.querySelector('.overlay.open') || {}).id || '(ninguno)');
    const shared = await d.ev(() => { const t = document.getElementById('g-shared-fields'); return t ? !t.classList.contains('hidden') : null; });
    await d.ev(() => document.querySelectorAll('.overlay.open').forEach(o => closeOv(o.id)));
    await P.waitForTimeout(200);
    return { id, shared };
  };
  eq((await abrio(() => goTo('gastos'))).id, 'ov-gasto', 'Gastos → alta de gasto');
  const comp = await abrio(() => goTo('compartidos'));
  eq(comp.id, 'ov-gasto', 'Compartidos → alta de gasto');
  eq(comp.shared, true, 'con el bloque de compartido ya abierto');
  eq((await abrio(() => { goTo('agenda'); switchAgendaTab('lista'); })).id, 'ov-agenda', 'Agenda/lista → vencimiento');
  eq((await abrio(() => { goTo('agenda'); switchAgendaTab('plan'); })).id, 'ov-proj', 'Agenda/Plan → gasto fijo del proyectado');

  // ════ 4. MODALES: FLECHA, TÍTULO Y PIE ═══════════════════════════════
  section('v31 · en todos los menús el título no queda debajo de la flecha');
  const modales = await d.ev(() => {
    const out = [];
    document.querySelectorAll('.overlay').forEach(ov => {
      const panel = ov.querySelector(':scope>.modal,:scope>.modal-panel');
      if (!panel) return;
      const back = panel.querySelector(':scope>.ov-back') || panel.querySelector('.ov-back');
      const title = panel.querySelector('.mtitle,.mbar,.modal-hdr');
      if (!back || !title) { out.push({ id: ov.id, back: !!back, title: !!title, ok: null }); return; }
      ov.classList.add('open');
      const rb = back.getBoundingClientRect();
      const rg = document.createRange(); rg.selectNodeContents(title);
      const rt = rg.getBoundingClientRect();
      ov.classList.remove('open');
      out.push({ id: ov.id, back: true, title: true, gap: Math.round(rt.left - rb.right), ok: rt.width === 0 || rt.left >= rb.right });
    });
    return out;
  });
  const pisados = modales.filter(m => m.ok === false);
  eq(pisados.length, 0, `ningún título pisa la flecha (${modales.length} menús revisados)`);
  if (pisados.length) console.log('    pisados:', JSON.stringify(pisados));
  const sinFlecha = modales.filter(m => m.back === false).map(m => m.id);
  eq(sinFlecha.filter(id => id !== 'ov-confirm').join(', '), '', 'y todos los menús con título tienen su flecha de volver (ov-confirm se excluye a propósito)');

  section('v31 · el degradado negro del pie de los menús ya no está');
  const fades = await d.ev(() => {
    const out = [];
    document.querySelectorAll('.overlay').forEach(ov => {
      const body = ov.querySelector('.modal-body');
      if (!body) return;
      ov.classList.add('open');
      const c = getComputedStyle(body, '::after');
      if (c.content && c.content !== 'none' && c.content !== 'normal') out.push(ov.id + ' ' + c.content);
      ov.classList.remove('open');
    });
    return out;
  });
  eq(fades.length, 0, 'ningún .modal-body dibuja el ::after que tapaba el contenido');
  eq(await d.ev(() => {
    const s = [...document.styleSheets].flatMap(ss => { try { return [...ss.cssRules]; } catch (e) { return []; } });
    return s.filter(r => r.selectorText && /\.modal-body::after/.test(r.selectorText)).length;
  }), 0, 'ni queda la regla en el CSS');

  // ════ 5. NADA SE PASA DE 390px ═══════════════════════════════════════
  section('iOS · las pantallas y los menús entran en 390px');
  for (const pg of ['saldos', 'gastos', 'compartidos', 'agenda', 'plan']) {
    await d.ev(x => goTo(x), pg); await P.waitForTimeout(300);
    const fuera = await d.ev(() => {
      const vw = innerWidth, out = [];
      document.querySelectorAll('.page:not(.hidden) *').forEach(el => {
        const b = el.getBoundingClientRect();
        if (!b.width || !b.height) return;
        if (b.right <= vw + 1.5 && b.left >= -1.5) return;
        const s = getComputedStyle(el);
        if (s.overflowX === 'auto' || s.overflowX === 'scroll') return;
        if (el.closest('[style*="overflow-x"],.proj-scroll,.chips,.ag-tiles-scroll,.quick-chips')) return;
        out.push((el.id || el.className || el.tagName) + ' ' + Math.round(b.left) + '→' + Math.round(b.right));
      });
      return out.slice(0, 6);
    });
    eq(fuera.join(' | '), '', `${pg}: nada se sale de la pantalla`);
  }
  eq(await d.ev(() => Math.round(document.documentElement.scrollWidth) <= Math.round(innerWidth) + 1), true, 'el documento no scrollea de costado');

  section('iOS · ningún campo dispara el zoom de Safari (font-size < 16px)');
  const chicos = await d.ev(() => {
    const out = [];
    document.querySelectorAll('input,select,textarea').forEach(el => {
      if (['hidden','checkbox','radio','file','range'].includes(el.type)) return;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 16) out.push((el.id || el.className || el.type) + ' ' + fs + 'px');
    });
    return out;
  });
  eq(chicos.join(', '), '', 'todos los campos miden 16px o más');

  section('iOS · lo que se toca llega al mínimo táctil');
  // Los botones chicos de las filas de Compartidos (✎/✕, 24x22) vienen de antes
  // de la v31 y se miran aparte: acá solo se fija lo que este cambio movió.
  await d.ev(() => goTo('compartidos')); await P.waitForTimeout(300);
  const chicosTap = await d.ev(() => {
    const out = [];
    document.querySelectorAll('.nav .nb, #pg-agenda .ag-tab, #pg-gastos .pg-tab, #pg-compartidos .month-strip button').forEach(b => {
      const r = b.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (r.height < 30 || r.width < 30) out.push((b.id || b.className) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    });
    return out;
  });
  eq(chicosTap.join(', '), '', 'la barra de abajo, las pestañas y la franja de mes se pueden tocar');

  // ════ 6. FLUJOS QUE TOCAN EL PLAN Y LOS COMPARTIDOS ══════════════════
  section('v31 · los flujos que redibujaban el Plan siguen funcionando');
  await d.ev(() => { goTo('agenda'); switchAgendaTab('plan'); }); await P.waitForTimeout(300);
  eq(await d.ev(() => planIsVisible()), true, 'planIsVisible() es true con la pestaña Plan abierta');
  eq(await d.ev(() => { switchAgendaTab('lista'); return planIsVisible(); }), false, 'y false en las otras pestañas');
  eq(await d.ev(() => { goTo('gastos'); return planIsVisible(); }), false, 'y en otra sección');
  eq(await d.ev(() => { goTo('agenda'); switchAgendaTab('plan'); try { refreshPlanViews(); refreshAgendaViews(); refreshGastosViews(); return 'ok'; } catch (e) { return String(e.message); } }), 'ok',
    'los refresh de las tres vistas no rompen');
  eq(await d.ev(() => { goTo('agenda'); switchAgendaTab('plan'); const antes = S.plan.length; deletePlanItemWithSync('p2', 'Alquiler'); return S.plan.length === antes - 1; }), true,
    'borrar un concepto del Plan desde la pestaña sigue andando');

  section('v31 · alta y edición de un gasto compartido desde la sección nueva');
  await d.ev(() => goTo('compartidos')); await P.waitForTimeout(300);
  const antesComp = await d.ev(() => S.gastos.filter(g => g.shared && g.shared.active).length);
  await d.ev(() => {
    openGastoModalShared();
    document.getElementById('gdesc').value = 'Verdulería';
    document.getElementById('gamt').value = '12000';
  });
  await P.waitForTimeout(200);
  await d.ev(() => doSaveGasto());
  await P.waitForTimeout(600);
  eq(await d.ev(() => S.gastos.filter(g => g.shared && g.shared.active).length), antesComp + 1, 'el gasto compartido nuevo queda guardado');
  is(await d.ev(() => document.getElementById('compartidos-list').textContent.includes('Verdulería')), 'y aparece en la lista de Compartidos sin recargar');

  // ════ 7. LA PILA DE ABAJO ════════════════════════════════════════════
  // La barra, el aviso de instalar, los botones flotantes y el toast viven los
  // cuatro pegados al piso. Cada uno elegía su "bottom" sin mirar a los otros y
  // con dos visibles se pisaban.
  section('v31 · con todo visible a la vez, nada de abajo se pisa');
  const caja = (pila, k) => pila[k];
  const cruza = (a, b) => a && b && Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5;
  const medirPila = () => d.ev(() => {
    const r = el => { if (!el) return null; const b = el.getBoundingClientRect();
      if (!b.width || !b.height) return null;
      return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
    return { nav: r(document.querySelector('.nav')), banner: r(document.getElementById('install-banner')),
             fab: r(document.getElementById('fab')),
             toast: r(document.querySelector('.toast-bar.show')) };
  });
  // El "+" es el único botón flotante desde que se sacó el asistente, y ahora
  // está también en Saldos.
  for (const [pg, flotante] of [['compartidos', 'fab'], ['saldos', 'fab']]) {
    await d.ev(x => { goTo(x); setInstallBannerShown(true); showToast('👫 2 gastos compartidos nuevos', 'success', 9000); }, pg);
    await P.waitForTimeout(800);
    const pila = await medirPila();
    is(pila.toast && pila.banner && pila[flotante], `${pg}: se ven el toast, el aviso de instalar y el botón flotante`);
    const pares = [['toast', flotante], ['toast', 'banner'], ['toast', 'nav'], ['banner', flotante], ['banner', 'nav'], [flotante, 'nav']];
    const pisadas = pares.filter(([x, y]) => cruza(caja(pila, x), caja(pila, y))).map(x => x.join(' ∩ '));
    eq(pisadas.join(', '), '', `${pg}: ninguno se superpone con otro`);
    await d.ev(() => { setInstallBannerShown(false); document.querySelector('.toast-bar')?.classList.remove('show'); });
    await P.waitForTimeout(300);
  }
  eq(await d.ev(() => getComputedStyle(document.documentElement).getPropertyValue('--install-h').trim()), '0px',
    'y al cerrar el aviso, lo que se había corrido vuelve a su lugar');

  section('iOS · los botones de Compartidos llegan al área táctil mínima');
  await d.ev(() => goTo('compartidos')); await P.waitForTimeout(500);
  // El área que responde al dedo es el botón más lo que crece su ::after.
  const areas = await d.ev(() => {
    const px = v => parseFloat(v) || 0;
    const caja = el => { const r = el.getBoundingClientRect(); const a = getComputedStyle(el, '::after');
      if (!a.content || a.content === 'none' || a.content === 'normal') return { l: r.left, t: r.top, r: r.right, b: r.bottom };
      return { l: r.left + px(a.left), t: r.top + px(a.top), r: r.right - px(a.right), b: r.bottom - px(a.bottom) }; };
    const els = [...document.querySelectorAll('#pg-compartidos button')].filter(b => b.getBoundingClientRect().width);
    const chicos = [], solapes = [];
    els.forEach(el => { const c = caja(el);
      if (c.r - c.l < 40 || c.b - c.t < 40) chicos.push((el.className || '?') + ' ' + Math.round(c.r - c.l) + 'x' + Math.round(c.b - c.t)); });
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const A = caja(els[i]), B = caja(els[j]);
      if (Math.min(A.r, B.r) - Math.max(A.l, B.l) > 0.5 && Math.min(A.b, B.b) - Math.max(A.t, B.t) > 0.5)
        solapes.push((els[i].className || '?') + ' ∩ ' + (els[j].className || '?'));
    }
    return { chicos, solapes, total: els.length };
  });
  eq(areas.chicos.join(', '), '', `ninguno queda abajo de 40x40 (${areas.total} botones)`);
  eq(areas.solapes.join(', '), '', 'y ninguna área táctil se mete en la del botón de al lado');

  // ════ 8. ERRORES ═════════════════════════════════════════════════════
  section('ERRORES · JS durante toda la corrida');
  eq(d.errors.join(' | '), '', 'ningún error de página');

  await d.close();
  await browser.close();
  const { pass, fail } = L.results;
  console.log(`\n────────────────────────────────────────────────────\n${pass + fail} checks: ${pass} ok, ${fail} fallaron`);
  process.exit(fail ? 1 : 0);
})();
