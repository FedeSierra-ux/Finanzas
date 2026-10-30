// v34.26: los arreglos de UX y pantallas de la auditoría de la v34.25 (bugs
// 16, 21, 23-26, 29-33), en contexto iPhone con el teclado simulado por el
// mismo camino que usa la app (un visualViewport que se achica):
//   · editar una cuenta con el saldo vacío avisa en el campo y no guarda $ 0;
//   · "Revisar gastos de Mercado Pago" con controles de 36-44px y la fuente de la app;
//   · guardar vacío avisa en el campo en los seis menús que no decían nada;
//   · el error de "Nombre" en Nuevo vencimiento va debajo del campo, no al lado;
//   · el mensaje del Plan vacío no se corta por el ancho de la tabla;
//   · los estados vacíos de Agenda y Tarjetas dicen cómo se agrega de verdad;
//   · el toast del alta dice "Coto · $ 48.900 guardado", no "Super guardado.";
//   · Ajustes se achica con el teclado como los demás menús;
//   · tocables de ≥44px (dibujo + área táctil), íconos de cabecera de 36px con 8px entre sí;
//   · tokens de contraste (--muted, --dim y los tres casos del tema claro) ≥ 4,5:1 / ≥ 3,6:1;
//   · nombres unificados (Plan, Copias de gastos / de compartidos, Pagué, ID de
//     sincronización / Clave) y borrar cuenta con confirmación.
// Con la v34.25 casi todo termina en ✗. A31_SHOTS=/ruta guarda capturas.
const L = require('./lib');
const fs = require('fs');

const iphone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' };
const tecladoFalso = () => {
  const ls = {}; const vv = { height: window.innerHeight || 844, width: 390, offsetTop: 0, offsetLeft: 0, scale: 1,
    addEventListener: (t, f) => { (ls[t] = ls[t] || []).push(f); }, removeEventListener() {} };
  Object.defineProperty(window, 'visualViewport', { get: () => vv, configurable: true });
  window.__teclado = h => { vv.height = window.innerHeight - h; (ls.resize || []).forEach(f => f()); };
};
const SHOTS = process.env.A31_SHOTS || '';

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const f = new Date(), M = f.getMonth(), Y = f.getFullYear();
  const dk = (y, m, dd) => { const x = new Date(y, m, dd); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const pk = (y, m) => { const x = new Date(y, m, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
  const d = await L.device(browser, { myName: 'fede', compBin: 'bin31', contexto: iphone, initScript: tecladoFalso, seed: {
    accounts: [{ id: 'a1', name: 'Galicia', type: 'bancaria', amount: 150000, currency: 'ARS' }],
    gastos: [{ id: 'g1', desc: 'Verdulería', cat: 'super', amount: 6712, month: M, year: Y, day: 1, addedAt: Date.now() },
             { id: 'g2', desc: 'Cena', cat: 'salidas', amount: 18000, month: M, year: Y, day: 1, addedAt: Date.now(), shared: { active: true, paidBy: 'mile', splitPct: 50 } },
             { id: 'g3', desc: 'Nafta', cat: 'transporte', amount: 30000, month: M, year: Y, day: 2, addedAt: Date.now() },
             { id: 'g4', desc: 'Pizza', cat: 'comida', amount: 12000, month: M, year: Y, day: 2, addedAt: Date.now() },
             { id: 'g5', desc: 'Luz', cat: 'hogar', amount: 20000, month: M, year: Y, day: 3, addedAt: Date.now() },
             { id: 'g6', desc: 'Regalo', cat: 'regalos', amount: 9000, month: M, year: Y, day: 3, addedAt: Date.now() },
             { id: 'g7', desc: 'Farmacia', cat: 'compras', amount: 7000, month: M, year: Y, day: 4, addedAt: Date.now() }],
    plan: [{ id: 'p1', name: 'Alquiler', cat: 'gasto', months: { [pk(Y, M)]: 325000 }, order: 1 }],
    agenda: { subs: [{ id: 's1', name: 'Netflix', amount: 9000, date: dk(Y, M, 25), period: 'mensual' }],
      vencimientos: [{ id: 'v1', name: 'Expensas', amount: 80000, date: dk(Y, M + 1, 10), period: 'mensual' }],
      cuotas: [{ id: 'c1', name: 'Notebook', fee: 120000, total: 12, paid: 3, startDate: dk(Y, M - 3, 10), nextDueDate: dk(Y, M, 10), dueDay: 10 }], inversiones: [] },
  } });
  const P = d.page;
  const wait = ms => P.waitForTimeout(ms);
  const shot = async n => { if (SHOTS) await P.screenshot({ path: `${SHOTS}/a31-${n}.png` }); };
  const cerrar = () => d.ev(() => { document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open')); $('sync-modal-ov').classList.add('hidden'); document.querySelectorAll('.ferr').forEach(e => e.remove()); window.__teclado(0); if (document.activeElement) document.activeElement.blur(); });
  // Área que responde al dedo: el dibujo más lo que crece el ::after/::before
  // transparente (como las flechas del Plan y los botones de Compartidos).
  const TOCABLE = `(el) => { const r = el.getBoundingClientRect(); let t = r.top, b = r.bottom, l = r.left, rr = r.right;
    for (const ps of ['::after', '::before']) { const cs = getComputedStyle(el, ps); if (cs.content === 'none' || cs.position !== 'absolute') continue;
      const n = v => parseFloat(v) || 0; t = Math.min(t, r.top + n(cs.top)); l = Math.min(l, r.left + n(cs.left)); b = Math.max(b, r.bottom - n(cs.bottom)); rr = Math.max(rr, r.right - n(cs.right)); }
    return { w: Math.round(r.width), h: Math.round(r.height), tw: Math.round(rr - l), th: Math.round(b - t) }; }`;
  const ferrDe = ov => d.ev(ov => { const o = $(ov); const e = o.querySelector('.ferr'); return { abierto: o.classList.contains('open'), msg: e ? e.textContent : null }; }, ov);

  L.section('16 · Editar cuenta con el saldo vacío avisa y no guarda $ 0');
  {
    const r = await d.ev(() => { openEditAcc('a1'); $('edit-acc-amount').value = ''; saveEditAcc();
      const e = document.querySelector('#ov-edit-acc .ferr'); return { msg: e && e.textContent, abierto: $('ov-edit-acc').classList.contains('open'), saldo: S.accounts[0].amount, foco: document.activeElement.id }; });
    L.eq(r.msg, 'Ingresá el saldo', 'el campo marca "Ingresá el saldo"');
    L.is(r.abierto && r.saldo === 150000, `el menú sigue abierto y el saldo no se tocó (${r.saldo})`);
    L.eq(r.foco, 'edit-acc-amount', 'y el foco queda en el saldo');
    const r2 = await d.ev(() => { $('edit-acc-amount').value = 'abc'; saveEditAcc(); const e = document.querySelector('#ov-edit-acc .ferr'); return e && e.textContent; });
    L.eq(r2, 'El saldo no es un número válido', 'con texto que no es número también avisa en el campo');
    await shot('16-saldo-vacio'); await cerrar();
  }

  L.section('21 · Revisar gastos de Mercado Pago: controles de 36-44px con la fuente de la app');
  {
    await d.ev(() => { mpReviewItems = [
      { desc: 'Super Coto', amount: 12000, category: 'super', date: '2026-10-03', selected: true, isDuplicate: false, shared: false },
      { desc: 'Uber', amount: 4500, category: 'transporte', date: '2026-10-04', selected: true, isDuplicate: true, shared: true }]; showMPReviewModal(); });
    await wait(500);
    const r = await d.ev((T) => { const m = eval(T); const q = s => document.querySelector('#ov-mp-review ' + s);
      const fam = el => getComputedStyle(el).fontFamily;
      const btns = [...document.querySelectorAll('#mp-review-stats button')];
      return { accion: btns.map(b => [b.textContent.trim(), m(b).h]), chk: m(q('.mp-review-chk')), solo: m(q('.mp-shared-btn')), cat: m(q('.mp-review-cat-sel')),
        desc: m(q('.mp-review-desc')), monto: m(q('.mp-review-amt input')),
        fuentes: [btns[0], q('.mp-shared-btn'), q('.mp-review-cat-sel'), q('.mp-review-desc'), q('.mp-review-amt input')].map(fam).every(x => /Plus Jakarta/.test(x)) }; }, TOCABLE);
    L.eq(r.accion.map(a => a[0]), ['Todo', 'Nada', '👫+comp.'], 'están Todo / Nada / 👫+comp.');
    L.is(r.accion.every(a => a[1] >= 40), `los tres miden ≥40px de alto (${r.accion.map(a => a[1]).join(', ')}; antes 12)`);
    L.is(r.chk.w >= 24 && r.chk.h >= 24 && r.chk.tw >= 44 && r.chk.th >= 44, `la casilla mide ${r.chk.w}×${r.chk.h} con ${r.chk.tw}×${r.chk.th} de área táctil (antes 20×20)`);
    L.is(r.solo.h >= 36 && r.solo.th >= 44, `"○ Solo / 👫 50/50" mide ${r.solo.h}px (táctil ${r.solo.th}; antes 19)`);
    L.is(r.cat.h >= 36, `el selector de categoría mide ${r.cat.h}px`);
    L.is(r.desc.h >= 40, `la descripción mide ${r.desc.h}px (antes 24)`);
    L.is(r.monto.h >= 40, `el monto mide ${r.monto.h}px (antes 26)`);
    L.is(r.fuentes, 'todos con la fuente de la app');
    await shot('21-mp-review'); await cerrar();
  }

  L.section('23 · Guardar vacío avisa en el campo en los seis menús');
  {
    await d.ev(() => { openAccModal('bancaria'); $('mn').value = ''; doSaveAccount(); });
    L.eq(await ferrDe('ov-acc'), { abierto: true, msg: 'Ingresá un nombre' }, 'Nueva cuenta: "Ingresá un nombre" y el menú sigue abierto');
    await cerrar();
    await d.ev(() => { openProjModal('gasto'); $('prn').value = ''; doSavePlan(); });
    L.eq(await ferrDe('ov-proj'), { abierto: true, msg: 'Ingresá un nombre' }, 'Nuevo gasto fijo / ingreso: "Ingresá un nombre"');
    const prnDebajo = await d.ev(() => { const i = $('prn'), e = document.querySelector('#ov-proj .ferr'); const ri = i.getBoundingClientRect(), re = e.getBoundingClientRect(); return { debajo: re.top >= ri.bottom - 1, ancho: ri.width }; });
    L.is(prnDebajo.debajo && prnDebajo.ancho > 250, `y el aviso va debajo del campo, que sigue entero (${Math.round(prnDebajo.ancho)}px)`);
    await cerrar();
    await d.ev(() => { openEditProj(S.plan[0]); $('ep-name').value = ''; doSaveEditProj(); });
    L.eq(await ferrDe('ov-edit-proj'), { abierto: true, msg: 'Ingresá un nombre' }, 'Editar gasto fijo: "Ingresá un nombre"');
    L.eq(await d.ev(() => S.plan[0].name), 'Alquiler', 'y el concepto conserva su nombre');
    await cerrar();
    await d.ev(() => { openSharedPaymentModal(); $('sp-amount').value = ''; doSaveSharedPayment(); });
    L.eq(await ferrDe('ov-shared-payment'), { abierto: true, msg: 'Ingresá el monto' }, 'Registrar pago: "Ingresá el monto"');
    await cerrar();
    await d.ev(() => { $('fund-adjust-inp').value = ''; $('ov-fund-adjust').classList.add('open'); applyFundAdjustment(); });
    L.eq(await ferrDe('ov-fund-adjust'), { abierto: true, msg: 'Ingresá el monto' }, 'Mover fondo: "Ingresá el monto"');
    await cerrar();
    await d.ev(() => { openEditSharedGasto({ id: 'g2' }); $('esg-desc').value = ''; doSaveEditShared(); });
    L.eq(await ferrDe('ov-edit-shared'), { abierto: true, msg: 'Ingresá una descripción' }, 'Editar gasto compartido: "Ingresá una descripción"');
    await d.ev(() => { document.querySelectorAll('.ferr').forEach(e => e.remove()); $('esg-desc').value = 'Cena'; $('esg-amt').value = ''; doSaveEditShared(); });
    L.eq(await ferrDe('ov-edit-shared'), { abierto: true, msg: 'El monto debe ser mayor a 0' }, 'y con el monto vacío: "El monto debe ser mayor a 0"');
    L.eq(await d.ev(() => S.gastos.find(g => g.id === 'g2').amount), 18000, 'sin tocar el gasto');
    await shot('23-edit-shared'); await cerrar();
  }

  L.section('24 · El error de "Nombre" en Nuevo vencimiento va debajo del campo');
  {
    await d.ev(() => { openAgendaModal('venc'); $('ag-name').value = ''; doSaveAgenda(); });
    await wait(200);
    const r = await d.ev(() => { const i = $('ag-name'), e = document.querySelector('#ov-agenda .ferr'); if (!e) return null;
      const ri = i.getBoundingClientRect(), re = e.getBoundingClientRect(), fila = i.closest('.field').getBoundingClientRect();
      return { msg: e.textContent, debajo: re.top >= ri.bottom - 1, mismaIzq: Math.abs(re.left - ri.left) < 6, ancho: Math.round(ri.width), fila: Math.round(fila.width) }; });
    L.is(!!r, 'hay aviso en el campo');
    L.is(r && r.debajo, 'el aviso está debajo del campo, no al lado');
    L.is(r && r.ancho >= r.fila * 0.75, `el campo no se achica (${r && r.ancho}px de ${r && r.fila})`);
    await shot('24-ag-name'); await cerrar();
  }

  L.section('25 · El mensaje del Plan vacío no se corta');
  {
    const r = await d.ev(() => { const bk = S.plan, bka = S.agenda; S.plan = []; S.agenda = { subs: [], vencimientos: [], cuotas: [], inversiones: [] }; goTo('agenda'); switchAgendaTab('plan'); renderProj();
      const sc = document.querySelector('.proj-scroll'); const rs = sc.getBoundingClientRect();
      const out = [...document.querySelectorAll('.proj-empty')].map(e => { const r = e.getBoundingClientRect();
        return { txt: e.textContent, entra: r.left >= rs.left - 1 && r.right <= rs.right + 1 && e.scrollWidth <= e.clientWidth + 1, lineas: Math.round(r.height / parseFloat(getComputedStyle(e).lineHeight)) }; });
      S.plan = bk; S.agenda = bka; return out; });
    L.eq(r.length, 2, 'hay un mensaje para ingresos y otro para gastos');
    L.is(r.every(x => x.entra), 'los dos entran enteros en lo que se ve de la tabla (antes se cortaban en "agr…")');
    L.is(r.every(x => x.lineas >= 1 && /para agregar el primero\.$/.test(x.txt)), 'y el texto llega hasta "para agregar el primero."');
    await shot('25-plan-vacio');
    await d.ev(() => renderProj());
  }

  L.section('26 · Los estados vacíos dicen cómo se agrega de verdad');
  {
    const r = await d.ev(() => { const bk = S.agenda; S.agenda = { subs: [], vencimientos: [], cuotas: [], inversiones: [] };
      switchAgendaTab('lista'); renderAgenda(); const ag = $('ag-view-lista').innerText; switchAgendaTab('tarjetas'); renderTarjetasResumen(); const tj = $('ag-view-tarjetas').innerText;
      S.agenda = bk; switchAgendaTab('lista'); renderAgenda(); return { ag, tj }; });
    L.is(/Tocá \+ para agregar una suscripción o un vencimiento/.test(r.ag) && !/bot/.test(r.ag), 'Agenda vacía: "Tocá + para agregar una suscripción o un vencimiento" (no "Usá el bot")');
    L.is(/Las compras en cuotas se cargan desde Registrar gasto con la categoría Tarjeta, o desde Agenda › Cuotas/.test(r.tj) && !/tab Agenda/.test(r.tj), 'Tarjetas vacía: dice que se cargan desde Registrar gasto › Tarjeta o Agenda › Cuotas');
  }

  L.section('29 · El toast del alta nombra el gasto, no la categoría');
  {
    const r = await d.ev(() => { const real = window.showToast; const out = []; window.showToast = (m) => out.push(m);
      showExpenseSavedFeedback(48900, 'Coto', false, 'super', null); showExpenseSavedFeedback(500, '', false, 'comida', null); window.showToast = real; return out; });
    L.eq(r[0], 'Coto · Super · $ 48.900 guardado.', 'con descripción: "Coto · $ 48.900 guardado."');
    L.eq(r[1], 'Gasto · Comida guardado.', 'sin descripción: "Gasto · Comida guardado." (antes "Comida guardado.")');
  }

  L.section('30 · Ajustes se achica con el teclado como los demás menús');
  {
    await d.ev(() => { goTo('saldos'); openSyncModal(); });
    await wait(300);
    await d.ev(() => { $('sync-avanzado').open = true; $('sync-bin-id').focus(); window.__teclado(336); }); // v34.29: el ID vive en Avanzado
    await wait(500);
    const r = await d.ev(() => { const p = document.querySelector('.sync-modal').getBoundingClientRect(), i = $('sync-bin-id').getBoundingClientRect(), tope = innerHeight - 336;
      return { kb: document.documentElement.classList.contains('kb-open'), panelBottom: Math.round(p.bottom), tope, campoVisible: i.bottom <= tope && i.top >= 0, campoTop: Math.round(i.top) }; });
    L.is(r.kb, 'la app registra el teclado abierto');
    L.is(r.panelBottom <= r.tope + 1, `el panel termina arriba del teclado (${r.panelBottom} ≤ ${r.tope}; antes llegaba a 844)`);
    L.is(r.campoVisible, `y "Mi ID de sincronización" queda a la vista (top ${r.campoTop})`);
    await shot('30-ajustes-teclado');
    await d.ev(() => { window.__teclado(0); document.activeElement.blur(); });
    await wait(300);
    const r2 = await d.ev(() => Math.round(document.querySelector('.sync-modal').getBoundingClientRect().bottom));
    L.is(r2 >= 843, `al cerrar el teclado vuelve al piso (${r2})`);
    await cerrar();
  }

  L.section('31 · Tocables de 44px');
  {
    const med = (sel, fn) => d.ev(([T, sel]) => { const m = eval(T); const el = document.querySelector(sel); return el ? m(el) : null; }, [TOCABLE, sel]);
    const ok44 = (r, lbl) => L.is(r && r.th >= 44 && (r.tw >= 44), `${lbl}: ${r ? r.w + '×' + r.h + ' (táctil ' + r.tw + '×' + r.th + ')' : 'no está'}`);
    await d.ev(() => { goTo('agenda'); switchAgendaTab('lista'); renderAgenda(); }); await wait(300);
    const pays = await d.ev((T) => { const m = eval(T); return [...document.querySelectorAll('.tl-btn-pay')].map(m); }, TOCABLE);
    L.is(pays.length >= 2 && pays.every(p => p.th >= 44 && p.tw >= 44), `✓ de Agenda: ${pays.length} filas, todas con ≥44×44 de área táctil (${pays.map(p => p.w + '×' + p.h).join(', ')}; antes 32×34)`);
    L.eq(await d.ev(() => [...new Set([...document.querySelectorAll('.tl-btn-pay')].map(b => b.getAttribute('aria-label')))]), ['Pagué'], 'y el aria-label dice "Pagué"');
    await d.ev(() => { switchAgendaTab('tarjetas'); renderTarjetasResumen(); }); await wait(300);
    ok44(await med('#ag-view-tarjetas .tj-actions button'), '"✓ Pagué" de Tarjetas (antes 60×27)');
    await d.ev(() => { switchAgendaTab('plan'); renderProj(); }); await wait(300);
    ok44(await med('.proj-nav-r'), '‹ › del Plan');
    await d.ev(() => { goTo('compartidos'); renderCompartidos(); }); await wait(600);
    const chip = await med('.sh-cat-chip');
    L.is(chip && chip.h >= 36 && chip.th >= 44, `chip de categoría de Compartidos: ${chip && chip.w + '×' + chip.h} (táctil ${chip && chip.th}; antes 26 de alto)`);
    const liq = await med('.sh-btn-liq');
    L.is(liq && liq.h >= 36 && liq.h < 40 && liq.th >= 44, `"Liquidar": ${liq && liq.w + '×' + liq.h} (táctil ${liq && liq.th}; antes 31 de alto, y sigue chico al lado del saldo)`);
    ok44(await med('.sh-debt-tap'), 'la deuda tocable (antes 117×29)');
    await d.ev(() => { goTo('gastos'); switchGastosTab('cats'); }); await wait(400);
    const mas = await med('#donut-legend .dl-more');
    L.is(mas && mas.h >= 44, `"+ N más" del donut: ${mas && mas.w + '×' + mas.h} (antes 21 de alto)`);
    await d.ev(() => { goTo('saldos'); render(); }); await wait(300);
    const hdr = await d.ev((T) => { const m = eval(T); const ids = ['theme-toggle-btn-inline', 'compact-toggle', 'sync-btn-inline'];
      const rs = ids.map(i => document.getElementById(i).getBoundingClientRect()); return { m: ids.map(i => m(document.getElementById(i))), sep: [rs[1].left - rs[0].right, rs[2].left - rs[1].right].map(Math.round) }; }, TOCABLE);
    L.is(hdr.m.every(x => x.w === 36 && x.h === 36), `tema / compacto / ajustes miden 36×36 (${hdr.m.map(x => x.w + '×' + x.h).join(', ')}; antes 37×25 y 32×32)`);
    L.is(hdr.m.every(x => x.tw >= 44 && x.th >= 44), 'con 44×44 de área táctil');
    L.eq(hdr.sep, [8, 8], 'y 8px entre sí');
    await d.ev(() => $('install-banner').classList.add('show')); await wait(200);
    ok44(await med('.install-btn'), '"Instalar" del aviso de instalar');
    ok44(await med('.install-dismiss'), '"Ahora no" (antes 66×19)');
    await d.ev(() => $('install-banner').classList.remove('show'));
    await d.ev(() => { openSyncModal(); }); await wait(300);
    const crear = await d.ev((T) => { const m = eval(T); return [...document.querySelectorAll('#sync-modal-ov button')].filter(b => /Crear/.test(b.textContent)).map(m); }, TOCABLE);
    L.is(crear.length === 2 && crear.every(c => c.h >= 44), `"🆕 Crear" de Ajustes: ${crear.map(c => c.w + '×' + c.h).join(', ')} (antes 60×26)`);
    await cerrar();
    await d.ev(() => openAgendaModal('venc')); await wait(300);
    const cb = await d.ev(() => { const c = $('ag-addplan'), l = c.closest('label'); return { c: Math.round(c.getBoundingClientRect().width), l: Math.round(l.getBoundingClientRect().height), txt: l.textContent.trim() }; });
    L.is(cb.c >= 20 && cb.l >= 44, `la casilla "Agregar también al Plan" mide ${cb.c}px con etiqueta tocable de ${cb.l}px (antes 13×13)`);
    L.eq(cb.txt, 'Agregar también al Plan', 'y dice "Plan", no "Proyección mensual"');
    await cerrar();
  }

  L.section('32 · Contraste de los tokens');
  {
    // Mismo cálculo que el script de contraste del rediseño: el color con alfa
    // se compone sobre el fondo y se compara la luminancia relativa (WCAG).
    const medir = tema => d.ev((tema) => {
      const parse = c => { c = c.trim(); if (c[0] === '#') { const h = c.slice(1); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).concat([1]); }
        const m = c.match(/rgba?\(([^)]+)\)/); const a = m[1].split(',').map(Number); return [a[0], a[1], a[2], a[3] == null ? 1 : a[3]]; };
      const over = (fg, bg) => { const [r, g, b, al] = parse(fg); const [R, G, B] = parse(bg); return [r * al + R * (1 - al), g * al + G * (1 - al), b * al + B * (1 - al)]; };
      const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
      const ratio = (fg, bg) => { const x = lum(over(fg, bg)), y = lum(parse(bg).slice(0, 3)); return +((Math.max(x, y) + .05) / (Math.min(x, y) + .05)).toFixed(2); };
      localStorage.setItem('fin_theme', tema); applyTheme();
      const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
      const card = tok('--card'), bg = tok('--bg');
      const out = { raw: { muted: tok('--muted'), dim: tok('--dim'), card }, muted: ratio(tok('--muted'), card), dim: ratio(tok('--dim'), card) };
      if (tema === 'light') {
        goTo('agenda'); switchAgendaTab('plan'); renderProj();
        const ing = document.querySelector('tr.sec-ing td'), gas = document.querySelector('tr.sec-gas td');
        out.ing = ratio(getComputedStyle(ing).color, bg); out.gas = ratio(getComputedStyle(gas).color, bg);
        const g = document.createElement('button'); g.className = 'gcal-cta'; document.body.appendChild(g); out.gcal = ratio(getComputedStyle(g).color, card); g.remove();
        const mas = document.createElement('div'); mas.className = 'dl-more'; mas.innerHTML = '<span class="dl-h">+ 8 más</span>'; document.body.appendChild(mas); out.mas = ratio(getComputedStyle(mas.querySelector('.dl-h')).color, card); mas.remove();
      }
      return out; }, tema);
    const osc = await medir('dark');
    L.is(osc.muted >= 4.5, `oscuro: --muted ${osc.raw.muted} sobre --card ${osc.raw.card}: ${osc.muted}:1 (antes 4,0)`);
    L.is(osc.dim >= 3.6, `oscuro: --dim sobre --card ${osc.dim}:1 (antes 2,3)`);
    const cla = await medir('light');
    L.is(cla.muted >= 4.5, `claro: --muted ${cla.raw.muted} sobre --card ${cla.raw.card}: ${cla.muted}:1`);
    L.is(cla.dim >= 4, `claro: --dim sobre --card ${cla.dim}:1 (antes 2,9)`);
    L.is(cla.ing >= 4.5 && cla.gas >= 4.5, `claro: cabeceras INGRESOS ${cla.ing}:1 y GASTOS ${cla.gas}:1 del Plan (antes ≈2,2)`);
    L.is(cla.gcal >= 4.5, `claro: "Agregar a Google Calendar" ${cla.gcal}:1 (antes ≈2,1)`);
    L.is(cla.mas >= 4.5, `claro: "+ N más" ${cla.mas}:1 (antes ≈3,8)`);
    await shot('32-plan-claro');
    await d.ev(() => { localStorage.setItem('fin_theme', 'dark'); applyTheme(); goTo('saldos'); });
  }

  L.section('33 · Nombres unificados y borrar cuenta con confirmación');
  {
    const r = await d.ev(() => { openGastosBackupModal(); const bak = ($('ov-gastos-bak') || {}).innerText || ''; $('ov-gastos-bak') && $('ov-gastos-bak').remove();
      openSharedRestore(); const rest = ($('ov-shared-restore') || {}).innerText || ''; $('ov-shared-restore') && $('ov-shared-restore').remove();
      const aj = $('sync-modal-ov').innerText; const labels = [...document.querySelectorAll('#sync-modal-ov label')].map(l => l.textContent);
      return { bak, rest, aj, labels, ui: document.body.innerText }; });
    L.is(/Copias de gastos/.test(r.bak) && !/Snapshot/i.test(r.bak), 'las copias de gastos se llaman "Copias de gastos" (no "Snapshots")');
    L.is(/Copias de compartidos/.test(r.rest), 'y las de compartidos "Copias de compartidos"');
    L.is(/🕘 Copias de compartidos/.test(r.aj), 'el botón de Ajustes dice "Copias de compartidos" (antes "🕘 Copias")');
    L.is(!/Bin ID|API Key/.test(r.labels.join('|')), 'en Ajustes ninguna etiqueta dice "Bin ID" ni "API Key"');
    L.is(/Mi ID de sincronización/.test(r.aj) && /ID de sincronización compartidos/.test(r.aj) && /Clave compartidos/.test(r.aj), 'dicen "ID de sincronización" y "Clave"');
    L.is(/Avanzado/.test(r.aj) && /Cloudflare Worker URL/.test(r.labels.join('|')) && /VAPID Public Key/.test(r.labels.join('|')), 'y "Cloudflare Worker URL" / "VAPID Public Key" van dentro de "Avanzado" (v34.29)');
    L.is(!/Proyección mensual/.test(r.ui), 'ningún texto de la interfaz dice "Proyección mensual"');
    await d.ev(() => { openEditAcc('a1'); delEditAcc(); });
    await wait(300);
    const c = await d.ev(() => ({ confirm: $('ov-confirm').classList.contains('open'), cuentas: S.accounts.length, titulo: ($('ov-confirm').querySelector('.mtitle, h3, .confirm-title') || $('ov-confirm')).textContent.trim().slice(0, 40) }));
    L.is(c.confirm && c.cuentas === 1, `borrar la cuenta desde el editor pide confirmación antes de borrar (${c.titulo})`);
    await d.ev(() => confirmResolve(false)); await wait(200);
    L.eq(await d.ev(() => S.accounts.length), 1, 'con "Cancelar" la cuenta sigue');
    await d.ev(() => { delEditAcc(); }); await wait(300);
    await d.ev(() => confirmResolve(true)); await wait(300);
    L.eq(await d.ev(() => S.accounts.length), 0, 'y con "Eliminar" se borra (queda el deshacer del toast)');
    await cerrar();
  }

  L.eq(d.errors, [], 'sin errores de JS');
  await d.close();
  await browser.close();
  console.log(`\n${'─'.repeat(50)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
