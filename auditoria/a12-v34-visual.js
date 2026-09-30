// AUDITORÍA 12 — el rediseño visual de la v34, en contexto iPhone. Lo que se
// eligió de la propuesta "menos ruido" y que no tiene que volver atrás sin
// querer: listas agrupadas por día, un solo ⋯ por fila, el buscador adentro
// de la franja del mes, el + en la barra, la cabecera de Saldos en una fila,
// los avisos de vencimiento con "vence / cuándo" a la derecha, Compartidos
// con balance verde/rojo, iniciales y total del día en gris, Agenda con
// tarjetas neutras, y los colores de categoría que van con su ícono.
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
  const iso = (off) => { const d = new Date(now); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };
  const g = (id, desc, cat, amount, day, hora, shared) => ({ id, desc, cat, amount, month: M, year: Y, day,
    addedAt: new Date(Y, M, day, hora).getTime(), ...(shared ? { shared } : {}) });
  // Dos gastos el día 2 (mismo grupo) y dos compartidos: uno que pagué yo y
  // otro que pagó ella, para ver las dos iniciales y los dos colores.
  const gastos = [
    g('a', 'Coto', 'super', 20000, 2, 10), g('b', 'Uber', 'transporte', 5000, 2, 12),
    g('c', 'Pedidos Ya', 'comida', 8000, 1, 20, { active: true, paidBy: 'fede', splitPct: 50 }),
    g('d', 'Nafta', 'transporte', 30000, 1, 9, { active: true, paidBy: 'mile', splitPct: 50 }),
  ];
  const d = await L.device(browser, {
    myName: 'fede', compBin: 'bin12', contexto: IPHONE,
    seed: {
      gastos,
      agenda: { subs: [{ id: 's1', name: 'Netflix', amount: 9000, date: iso(1), period: 'mensual' }],
        vencimientos: [{ id: 'v1', name: 'patente', amount: 45000, date: iso(2), period: 'mensual' }], cuotas: [], inversiones: [] },
    },
  });
  const P = d.page;
  await P.waitForTimeout(400);

  section('VERSIÓN');
  eq(await d.ev(() => APP_VERSION), '34.1', 'la app es la 34.1');

  section('CATEGORÍAS · el color va con el ícono y no se repite');
  const cats = await d.ev(() => ({ comida: CATS.comida.color, super: CATS.super.color, transporte: CATS.transporte.color,
    base: ['comida','transporte','salidas','hogar','depto','super','regalos','oficina','suscripciones','compras','tarjeta','varios'].map(k => CATS[k].color) }));
  eq(cats.comida, '#fb923c', 'comida (🍔) es naranja');
  eq(cats.super, '#4ade80', 'super (🛒) es verde');
  eq(cats.transporte, '#60a5fa', 'transporte (🚗) es azul');
  eq(new Set(cats.base).size, cats.base.length, 'ninguna de las doce categorías de fábrica comparte color');

  section('SALDOS · cabecera en una fila y avisos con "vence" a la derecha');
  const cab = await d.ev(() => {
    goTo('saldos'); render();
    const ids = ['dtag', 'ver-badge-top', 'tc-chip', 'theme-toggle-btn-inline', 'compact-toggle', 'sync-btn-inline'];
    const rs = ids.map(i => document.getElementById(i).getBoundingClientRect());
    const mid = r => (r.top + r.bottom) / 2;
    return { unaFila: rs.every(r => r.width > 0 && Math.abs(mid(r) - mid(rs[0])) < 4),
      viejos: !!document.getElementById('ct-btn-normal') || !!document.getElementById('ct-btn-compact'),
      version: document.getElementById('ver-badge-top').textContent.trim(),
      fecha: document.getElementById('dtag').textContent.trim(),
      fechaEntera: document.getElementById('dtag').scrollWidth <= document.getElementById('dtag').clientWidth + 1 };
  });
  is(cab.unaFila, 'fecha, versión, dólar, tema, vista compacta y ajustes van en el mismo renglón');
  is(!cab.viejos, 'ya no están las pastillas Normal / Compacto');
  eq(cab.version, '34.1', 'la versión sigue a la vista');
  is(/^\S+ \d{1,2} [a-zñ]{3}$/.test(cab.fecha), `el mes va abreviado (${cab.fecha})`);
  is(cab.fechaEntera, 'y la fecha entra sin cortarse');
  const compacto = await d.ev(() => { const b = document.getElementById('compact-toggle');
    const antes = _compact; b.click(); const r = [antes, _compact, b.getAttribute('aria-pressed'), localStorage.getItem('fin_compact')]; b.click(); return r; });
  eq(compacto, [false, true, 'true', 'true'], 'el ícono alterna la vista compacta y lo recuerda');
  const aviso = await d.ev(() => {
    const c = document.querySelector('#widget-res .wr-bell-card');
    return c ? { izq: c.querySelector('.wr-bell-title').textContent.trim(), monto: c.querySelector('.wr-bell-sub').textContent.replace(/\s+/g, ' ').trim(),
      vence: (c.querySelector('.wr-bell-r .wr-bell-vence') || {}).textContent, cuando: (c.querySelector('.wr-bell-r .wr-bell-when') || {}).textContent,
      derecha: c.querySelector('.wr-bell-r').getBoundingClientRect().left > c.querySelector('.wr-bell-title').getBoundingClientRect().right,
      gestionar: /gestionar/.test(c.textContent) } : null;
  });
  eq(aviso && aviso.izq, 'Netflix', 'a la izquierda, el nombre (solo)');
  eq(aviso && aviso.monto, '$ 9.000', 'y el monto abajo');
  eq(aviso && [aviso.vence, aviso.cuando], ['vence', 'mañana'], 'a la derecha, "vence" y cuándo');
  is(aviso && aviso.derecha && !aviso.gestionar, 'del otro lado de la fila, sin el "tocar para gestionar"');

  section('GASTOS · agrupados por día, sin franja, con un solo ⋯');
  const gl = await d.ev(() => {
    goTo('gastos'); renderGastos();
    const grupos = [...document.querySelectorAll('#gastos-list .day-group')];
    const row = document.querySelector('#gastos-list .gasto-row');
    return { grupos: grupos.length, porGrupo: grupos.map(x => x.querySelectorAll('.lgrp > .gasto-row').length),
      franja: getComputedStyle(row, '::before').content,
      botones: [...row.querySelectorAll(':scope > button')].map(b => b.className),
      lapiz: !!row.querySelector('.gasto-edit-hint,.gdel'),
      totalDia: getComputedStyle(document.querySelector('#gastos-list .day-total')).color,
      rojo: getComputedStyle(document.documentElement).getPropertyValue('--red').trim() };
  });
  eq(gl.porGrupo, [2, 2], 'dos días, cada uno con sus dos gastos en una sola superficie');
  is(gl.franja === 'none' || gl.franja === 'normal', 'sin la franja de color al costado');
  eq(gl.botones.join(','), 'rmore', 'en la fila queda un solo botón: el ⋯');
  is(!gl.lapiz, 'sin lápiz ni tacho sueltos');
  const menu = await d.ev(async () => {
    const row = [...document.querySelectorAll('#gastos-list .gasto-row')].find(r => r.dataset.id === 'b');
    row.querySelector('.rmore').click();
    const m = row.querySelector('.rmenu'); const r = m.getBoundingClientRect();
    const out = { abierto: !m.hidden, items: [...m.querySelectorAll('button')].map(b => b.textContent.trim()),
      entra: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight };
    m.querySelectorAll('button')[0].click();
    await new Promise(res => setTimeout(res, 350));
    out.edita = document.getElementById('ov-edit-gasto').classList.contains('open');
    out.cerrado = m.hidden;
    closeOv('ov-edit-gasto');
    return out;
  });
  is(menu.abierto, 'tocar ⋯ abre el menú');
  eq(menu.items, ['Editar', 'Eliminar'], 'con Editar y Eliminar');
  is(menu.entra, 'y el menú entra entero en la pantalla');
  is(menu.edita && menu.cerrado, 'Editar abre el editor y cierra el menú');
  await P.waitForTimeout(300);
  const borrar = await d.ev(async () => {
    const row = [...document.querySelectorAll('#gastos-list .gasto-row')].find(r => r.dataset.id === 'b');
    row.querySelector('.rmore').click();
    row.querySelectorAll('.rmenu button')[1].click();
    await new Promise(res => setTimeout(res, 150));
    const pide = document.getElementById('ov-confirm').classList.contains('open');
    confirmResolve(true);
    await new Promise(res => setTimeout(res, 150));
    return { pide, sigue: S.gastos.some(x => x.id === 'b') };
  });
  is(borrar.pide && !borrar.sigue, 'Eliminar pide confirmación y borra');
  eq(await d.ev(() => { document.body.click(); return document.querySelectorAll('.rmenu:not([hidden])').length; }), 0, 'tocar afuera cierra cualquier menú abierto');

  section('GASTOS · la lupa vive adentro de la franja del mes');
  const lupa = await d.ev(() => {
    const ms = document.getElementById('ms-gastos');
    const antes = { campo: getComputedStyle(document.getElementById('sq-wrap-gastos')).display, mes: getComputedStyle(document.getElementById('mlbl')).display };
    const sueltos = [...document.querySelectorAll('#pg-gastos > .sq-wrap')].length;
    ms.querySelector('.ms-lupa').click();
    const abierto = { campo: getComputedStyle(document.getElementById('sq-wrap-gastos')).display, mes: getComputedStyle(document.getElementById('mlbl')).display,
      foco: document.activeElement === document.getElementById('sq-inp-gastos') };
    buscarGastos('gastos', 'coto');
    const res = document.querySelectorAll('#sq-res-gastos .sq-row').length;
    cerrarBusqueda('gastos');
    return { antes, sueltos, abierto, res, cerrado: !ms.classList.contains('buscando') && document.getElementById('sq-res-gastos').classList.contains('hidden') };
  });
  eq(lupa.sueltos, 0, 'no hay una fila aparte para el buscador');
  eq([lupa.antes.campo, lupa.antes.mes], ['none', 'block'], 'de entrada se ve el mes, no el campo');
  is(lupa.abierto.campo === 'block' && lupa.abierto.mes === 'none' && lupa.abierto.foco, 'la lupa cambia la franja por el campo, con el foco puesto');
  eq(lupa.res, 1, 'busca igual que antes');
  is(lupa.cerrado, 'la ✕ vuelve al mes y limpia los resultados');

  section('GASTOS · el donut lleva el ícono de cada categoría');
  const ley = await d.ev(() => [...document.querySelectorAll('#donut-legend .dl-row[data-cat]')].map(b => b.querySelector('.dl-ico')?.textContent || ''));
  is(ley.length > 0 && ley.every(x => x.trim().length > 0), `cada categoría de la leyenda con su ícono (${ley.join(' ')})`);

  section('COMPARTIDOS · balance, un botón y el ⋯');
  const comp = await d.ev(async () => {
    goTo('compartidos'); renderCompartidos();
    await new Promise(r => setTimeout(r, 300));
    const card = document.querySelector('#compartidos-list .sh-card');
    const val = card.querySelector('.sh-debt-val');
    const liq = card.querySelector('.sh-btn-liq');
    const acc = [...card.querySelectorAll('.sh-actions .rmenu button')].map(b => b.getAttribute('onclick') || '');
    const chips = card.querySelector('.sh-cat-row');
    const lr = liq && liq.getBoundingClientRect(), vr = val && val.getBoundingClientRect(), cr = card.getBoundingClientRect();
    return { cls: val ? val.className : '',
      liqChico: !!lr && lr.width < cr.width * 0.4 && lr.height < 40 && lr.left > vr.right,
      flecha: /›/.test(card.querySelector('.sh-debt-tap').textContent) || getComputedStyle(card.querySelector('.sh-debt-tap'), '::after').content.includes('›'),
      liqOnclick: liq && liq.getAttribute('onclick'), menu: acc.map(x => x.replace(/^event\.stopPropagation\(\);closeRowMenus\(\);/, '').split('(')[0]),
      chipsFila: chips ? getComputedStyle(chips).flexWrap + ' ' + getComputedStyle(chips).overflowX : '',
      totalMes: ((card.querySelector('.sh-cat-head') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      alto: (() => { const dots = card.querySelector('.sh-actions .rmore'), lb = card.querySelector('.sh-debt-lbl');
        const [c, e] = [dots, lb].map(x => x.getBoundingClientRect()), cy = r => (r.top + r.bottom) / 2;
        return { liq: Math.abs(cy(lr) - cy(vr)) < 3, dots: Math.abs(cy(c) - cy(vr)) < 3, lblArriba: e.bottom <= vr.top + 1 && vr.top - e.bottom < 10 }; })() };
  });
  // Pedidos Ya: pagué 8.000, me deben 4.000. Nafta: pagó ella 30.000, debo 15.000. Neto: debo 11.000.
  is(/\bneg\b/.test(comp.cls), 'si debo, el saldo va en rojo');
  is(comp.liqChico && /openSharedPaymentModal/.test(comp.liqOnclick), 'Liquidar es un botón chico a la derecha del saldo');
  is(!comp.flecha, 'sin la flechita junto al saldo');
  eq(comp.menu, ['openLiquidaciones', 'syncCompartidos', 'exportCompartidosData'], 'el ⋯ lleva Historial de transferencias, Sincronizar y Exportar');
  eq(comp.chipsFila, 'wrap visible', 'las categorías bajan de renglón, como antes');
  is(/^Por categoría Total \S+ \$\s38\.000$/.test(comp.totalMes), `"Por categoría" y el total del mes (${comp.totalMes})`);
  is(comp.alto.liq, 'Liquidar a la altura del monto');
  is(comp.alto.dots, 'el ⋯ a la altura del monto');
  is(comp.alto.lblArriba, '"Mile te debe" arriba, pegado al monto');
  const pos = await d.ev(async () => {
    // Del otro lado: si me deben, verde.
    const x = S.gastos.find(g => g.id === 'd'); x.shared.paidBy = 'fede'; save(); renderCompartidos();
    await new Promise(r => setTimeout(r, 200));
    const cls = document.querySelector('#compartidos-list .sh-debt-val').className;
    x.shared.paidBy = 'mile'; save(); renderCompartidos();
    await new Promise(r => setTimeout(r, 200));
    return cls;
  });
  is(/\bpos\b/.test(pos), 'si me deben, en verde');

  section('COMPARTIDOS · filas con el ícono de la categoría y quién pagó, agrupadas por día');
  const filas = await d.ev(() => {
    const grupos = [...document.querySelectorAll('#compartidos-list .lgrp')];
    const rows = [...document.querySelectorAll('#compartidos-list .sh-grow')];
    const tot = document.querySelector('#compartidos-list .day-total');
    return { grupos: grupos.length, dentro: rows.every(r => r.parentElement.classList.contains('lgrp')),
      tile: rows.map(r => (r.querySelector(':scope > .sh-tile') || {}).textContent || ''),
      ava: document.querySelectorAll('#compartidos-list .sh-ava').length,
      sub: rows.map(r => r.querySelector('.sh-sub').textContent.trim()),
      colores: rows.map(r => r.querySelector('.sh-amt-wrap div:last-child').style.color),
      botones: rows.map(r => [...r.querySelectorAll(':scope > button')].map(b => b.className).join(',')),
      totalRojo: getComputedStyle(tot).color === getComputedStyle(document.createElement('i')).color ? null : getComputedStyle(tot).color,
      muted: (() => { const e = document.createElement('span'); e.style.color = 'var(--muted)'; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; })() };
  });
  eq(filas.grupos, 1, 'los dos compartidos del día 1 van en una sola superficie');
  is(filas.dentro, 'todas las filas adentro de su grupo');
  is(filas.tile.length === 2 && filas.tile.every(t => t.trim().length > 0), `el ícono de la categoría a la izquierda (${filas.tile.join(' ')})`);
  eq(filas.ava, 0, 'sin la inicial de quién pagó');
  is(/^👨🏻 Pagaste \$\s/.test(filas.sub[0]) && /^👩🏻 Mile pagó \$\s/.test(filas.sub[1]), `debajo del nombre, el emoji y quién pagó y cuánto (${filas.sub.join(' / ')})`);
  eq(filas.colores, ['var(--green)', 'var(--red)'], 'prestaste en verde, pediste en rojo');
  eq(filas.botones, ['rmore', 'rmore'], 'un solo ⋯ por fila (sin ✎ ni ✕)');
  eq(filas.totalRojo, filas.muted, 'el total del día va en gris, no en rojo');

  section('AGENDA · tarjetas neutras y el alta al pie de cada hoja');
  const ag = await d.ev(() => {
    goTo('agenda'); switchAgendaTab('lista'); renderAgenda();
    const tiles = [...document.querySelectorAll('#agenda-summary .ag-tile')];
    const txt = (() => { const e = document.createElement('span'); e.style.color = 'var(--text)'; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; })();
    return { n: tiles.length, mas: document.querySelectorAll('#agenda-summary .ag-tile-plus, #agenda-summary button').length,
      neutros: tiles.every(t => getComputedStyle(t.querySelector('.ag-tile-val')).color === txt),
      iconos: tiles.map(t => t.querySelector('.ag-tile-ico').textContent.trim()) };
  });
  eq(ag.n, 3, 'siguen las tres tarjetas');
  eq(ag.mas, 0, 'sin el + adentro de cada una');
  is(ag.neutros, 'el monto en el color del texto');
  eq(ag.iconos, ['🔄', '🔔', '💳'], 'el ícono es el único color');
  for (const [tipo, abre] of [['sub', 'ov-agenda'], ['venc', 'ov-agenda'], ['cuota', 'ov-gasto']]) {
    const r = await d.ev(async (tipo) => {
      document.querySelectorAll('.overlay.open').forEach(o => closeOv(o.id));
      openAgendaSheet(tipo);
      const btn = document.getElementById('ag-sheet-add'); const lbl = btn.textContent.trim();
      btn.click(); await new Promise(res => setTimeout(res, 350));
      const id = (document.querySelector('.overlay.open') || {}).id || '(ninguno)';
      const t = typeof agendaModalType === 'string' ? agendaModalType : '';
      document.querySelectorAll('.overlay.open').forEach(o => closeOv(o.id));
      return { lbl, id, t, hoja: document.getElementById('ag-sheet').classList.contains('open') };
    }, tipo);
    is(/^＋ Agregar/.test(r.lbl) && r.id === abre && !r.hoja && (tipo === 'cuota' || r.t === tipo), `la hoja de ${tipo} tiene "${r.lbl}" y abre su alta`);
  }

  section('INTERFAZ · el + en la barra y sin emojis en pestañas');
  const ui = await d.ev(() => {
    const fab = document.getElementById('fab');
    return { enNav: !!fab.closest('.nav'), flotante: getComputedStyle(fab).position,
      tabs: [...document.querySelectorAll('.pg-tab')].map(b => b.textContent.trim()),
      tabsAgenda: [...document.querySelectorAll('.ag-tab')].map(b => b.textContent.trim()),
      filtros: [...document.querySelectorAll('#compartidos-list .sh-filter-row button')].map(b => b.textContent.trim()) };
  });
  is(ui.enNav && ui.flotante !== 'fixed', 'el + es parte de la barra, ya no flota');
  is(ui.tabs.every(t => /^[A-Za-zÁÉÍÓÚáéíóúñ ]+$/.test(t)), `las pestañas de Gastos sin emoji (${ui.tabs.join(' · ')})`);
  eq(ui.tabsAgenda, ['📋 Agenda', '💳 Tarjetas', '🗓️ Plan'], 'las de Agenda, con su emoji como antes');

  section('ERRORES · JS durante toda la corrida');
  eq(d.errors, [], 'ningún error de página');

  console.log(`\n${'─'.repeat(52)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  await browser.close();
  process.exit(L.results.fail ? 1 : 0);
})();
