// v34.28 (auditoría v34.27, sección C de INFORME-v34.27.md): C2, C4, C6, C7, C8,
// C10, C12, C13, C14 y C17, con iPhone 390x844, SE 375x667 y escritorio 1280x800:
//   · C2  la categoría elegida en tema claro se lee (≥ 4,5:1) y conserva el anillo de su color;
//   · C4  el toast tras guardar nombra la categoría ("Coto · Super · $ 48.900 guardado.");
//   · C6  el aviso de instalar mide una línea (~56px), se va con el primer gasto, el aviso de
//         archivado no sale como toast (queda en Ajustes) y un toast cierra el menú ⋯ de la fila;
//   · C7  con importes de 9 dígitos no se rompen la tarjeta de banco, los tiles de Agenda, el
//         centro del donut ni el nombre del vencimiento en Saldos;
//   · C8  áreas táctiles de 44px (medidas con getBoundingClientRect + ::after) sin pisarse;
//   · C10 en escritorio la barra de abajo y el toast quedan dentro de la columna de 640px;
//   · C12 los editores con monto crudo lo muestran con miles al abrir y al salir del campo;
//   · C13 sin "bin compartido", "MI SYNC (JSONBIN)", "Worker de Cloudflare", "pediste/prestaste"
//         ni "(0 meses con gastos)" en lo que se ve;
//   · C14 "Copias de gastos" abre como el resto de las hojas;
//   · C17 Tendencia: las etiquetas no se pisan; Plan: la flecha › no tapa datos.
// Con la v34.27 casi todo termina en ✗. A40_SHOTS=/ruta guarda capturas.
const L = require('./lib');
const fs = require('fs');

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const iphone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce', userAgent: UA };
const se = { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce', userAgent: UA };
const desk = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce' };
const SHOTS = process.env.A40_SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

// Área que responde al dedo: el botón más lo que crece su ::after (igual que a31).
const TOCABLE = `(el) => { const r = el.getBoundingClientRect(); let t = r.top, b = r.bottom, l = r.left, rr = r.right;
  for (const ps of ['::after', '::before']) { const cs = getComputedStyle(el, ps); if (cs.content === 'none' || cs.position !== 'absolute') continue;
    const n = v => parseFloat(v) || 0; t = Math.min(t, r.top + n(cs.top)); l = Math.min(l, r.left + n(cs.left)); b = Math.max(b, r.bottom - n(cs.bottom)); rr = Math.max(rr, r.right - n(cs.right)); }
  return { w: Math.round(r.width), h: Math.round(r.height), tw: Math.round(rr - l), th: Math.round(b - t), box: { l, t, r: rr, b } }; }`;

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const f = new Date(), M = f.getMonth(), Y = f.getFullYear(), D = f.getDate();
  const dk = (y, m, dd) => { const x = new Date(y, m, dd); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const pk = (y, m) => { const x = new Date(y, m, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
  const mes = k => { const x = new Date(Y, M - k, 1); return { month: x.getMonth(), year: x.getFullYear() }; };
  // Seis meses con los importes de la captura de la auditoría: promedio ≈ 879k y la primera barra, 960k.
  const gastos = [{ id: 'sh1', desc: 'Cena', cat: 'salidas', amount: 200000, ...mes(0), day: 1, addedAt: Date.now(), shared: { active: true, paidBy: 'mile', splitPct: 50 } }];
  [960000, 875000, 843000, 760000, 958000, 680000].forEach((amount, i) => gastos.push({ id: 'tn' + i, desc: 'Mes ' + i, cat: 'super', amount, ...mes(5 - i), day: 1, addedAt: Date.now() }));
  ['comida', 'transporte', 'super', 'hogar'].forEach((cat, i) => gastos.push({ id: 'gc' + i, desc: 'Gasto ' + cat, cat, amount: 5000 + i, ...mes(0), day: 2, addedAt: Date.now() }));
  const months = {}; for (let k = 0; k < 8; k++) months[pk(Y, M + k)] = 325000 + k * 5000;
  const seed = {
    accounts: [{ id: 'a1', name: 'Galicia', type: 'bancaria', amount: 1250000, currency: 'ARS' }],
    gastos,
    plan: [{ id: 'p1', name: 'Alquiler', cat: 'gasto', months, order: 1 }, { id: 'p2', name: 'Expensas', cat: 'gasto', months: { [pk(Y, M)]: 85000 }, order: 2 },
           { id: 'p3', name: 'Sueldo', cat: 'ingreso', months: Object.fromEntries(Object.keys(months).map(k => [k, 1900000])), order: 3 }],
    agenda: { subs: [{ id: 's1', name: 'Netflix', amount: 9000, date: dk(Y, M, D + 2), period: 'mensual' }],
      vencimientos: [{ id: 'v1', name: 'Expensas', amount: 80000, date: dk(Y, M, D), period: 'mensual' }], cuotas: [], inversiones: [] },
  };
  const d = await L.device(browser, { myName: 'fede', compBin: 'bin40', contexto: iphone, seed });
  const P = d.page;
  const wait = ms => P.waitForTimeout(ms);
  const cerrar = () => d.ev(() => { document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open')); $('sync-modal-ov').classList.add('hidden'); document.getElementById('ov-gastos-bak')?.remove(); closeRowMenus(); document.querySelector('.toast-bar')?.classList.remove('show'); document.querySelectorAll('.ferr').forEach(e => e.remove()); if (document.activeElement) document.activeElement.blur(); });
  const shot = async (dev, name) => { if (SHOTS) await dev.page.screenshot({ path: `${SHOTS}/${name}.png` }); };
  const med = (dev, sel) => dev.ev(([T, sel]) => { const m = eval(T); const el = document.querySelector(sel); return el && el.getBoundingClientRect().width ? m(el) : null; }, [TOCABLE, sel]);
  const medAll = (dev, sel) => dev.ev(([T, sel]) => { const m = eval(T); return [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().width).map(m); }, [TOCABLE, sel]);
  const ok44 = (r, lbl) => L.is(r && r.th >= 44 && r.tw >= 44, `${lbl}: ${r ? r.w + '×' + r.h + ' (táctil ' + r.tw + '×' + r.th + ')' : 'no está'}`);
  const todos44 = (rs, lbl) => L.is(rs.length > 0 && rs.every(r => r.th >= 44 && r.tw >= 44), `${lbl}: ${rs.length} con ≥44×44 (${[...new Set(rs.map(r => r.tw + '×' + r.th))].join(', ')})`);
  const sinPisarse = (rs, lbl) => { let n = 0; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i].box, b = rs[j].box;
    if (Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5) n++; } L.eq(n, 0, `${lbl}: las áreas táctiles de vecinos no se superponen`); };

  // ════ C2 ════════════════════════════════════════════════════════════════
  L.section('C2 · Tema claro: la categoría elegida se lee y conserva el anillo de su color');
  {
    await d.ev(() => { localStorage.setItem('fin_theme', 'light'); applyTheme(); goTo('gastos'); openGastoModal(); }); await wait(500);
    const r = await d.ev(() => {
      const parse = c => { const n = (c.match(/-?[\d.]+(?:e-?\d+)?/g) || []).map(Number); return /^color\(/.test(c) ? n.slice(0, 3).map(v => Math.round(v * 255)) : n.slice(0, 3); };
      const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const out = []; document.querySelectorAll('#gcats .chip').forEach(c => { c.style.transition = 'none'; });
      document.querySelectorAll('#gcats .chip:not(.cat-add-chip)').forEach(chip => {
        document.querySelectorAll('#gcats .chip').forEach(c => c.classList.remove('on')); chip.classList.add('on');
        const cs = getComputedStyle(chip); const cc = cs.getPropertyValue('--cc').trim();
        out.push({ v: chip.dataset.v, cr: +cr(parse(cs.color), parse(cs.backgroundColor)).toFixed(2), texto: cs.color === getComputedStyle(document.body).color || cs.color,
          anillo: cs.boxShadow, cc });
      });
      return { out, text: getComputedStyle(document.body).getPropertyValue('--text').trim() };
    });
    L.is(r.out.length >= 12, `se midieron los ${r.out.length} chips de categoría`);
    L.is(r.out.every(x => x.cr >= 4.5), `la categoría elegida tiene ≥ 4,5:1 en las ${r.out.length} (peor ${Math.min(...r.out.map(x => x.cr))}; antes 1,5–2,0)`);
    L.is(r.out.every(x => x.cc && x.anillo.includes('inset')), 'y conserva el anillo del color de su categoría (sombra interna con --cc)');
    await d.ev(() => { document.querySelectorAll('#gcats .chip').forEach(c => c.classList.remove('on')); syncC('gcats', 'comida'); }); await wait(300);
    await shot(d, 'c2-alta-claro');
    await cerrar();
    await d.ev(() => { localStorage.setItem('fin_theme', 'dark'); applyTheme(); });
  }

  // ════ C4 ════════════════════════════════════════════════════════════════
  L.section('C4 · El toast tras guardar nombra la categoría');
  {
    await d.clearToasts();
    await d.ev(() => { goTo('gastos'); openGastoModal(); $('gdesc').value = 'Coto'; $('gamt').value = '48900'; pickGCat(document.querySelector('#gcats .chip[data-v="super"]')); doSaveGasto(); }); await wait(500);
    const t = await d.toasts();
    L.is(t.some(x => /^Coto · Super · \$\s48\.900 guardado\.$/.test(x)), `el toast dice "Coto · Super · $ 48.900 guardado." (${t.join(' | ')})`);
    await wait(1500);
    await d.ev(() => { openGastoModal(); $('gdesc').value = 'Pizza'; $('gamt').value = '9000'; pickGCat(document.querySelector('#gcats .chip[data-v="comida"]')); doSaveGasto(); }); await wait(400);
    const t3 = await d.toasts();
    L.is(t3.some(x => /Pizza · Comida ·/.test(x)), `y con otra categoría dice la que se guardó, Comida (${t3.slice(-2).join(' | ')})`);
    await cerrar();
  }

  // ════ C6 ════════════════════════════════════════════════════════════════
  L.section('C6 · Aviso de instalar de una línea, se va con el primer gasto; archivado en Ajustes; el toast cierra el ⋯');
  {
    const ds = await L.device(browser, { myName: 'fede', compBin: 'bin40s', contexto: se, seed });
    await ds.ev(() => { goTo('gastos'); setInstallBannerShown(true); }); await ds.page.waitForTimeout(600);
    const h = await ds.ev(() => Math.round($('install-banner').getBoundingClientRect().height));
    L.is(h <= 60, `el aviso de instalar mide ${h}px en un SE (antes 114)`);
    const bt = await ds.ev(() => [...document.querySelectorAll('.install-btn,.install-dismiss')].map(b => b.getBoundingClientRect().height));
    L.is(bt.length === 2, 'con "Instalar" y "Ahora no"');
    const ar = await medAll(ds, '.install-btn,.install-dismiss');
    todos44(ar, 'sus botones');
    sinPisarse(ar, 'Instalar / Ahora no');
    await shot(ds, 'c6-se-instalar');
    await ds.close();

    await d.ev(() => { localStorage.removeItem('fin_install_dismissed'); goTo('gastos'); setInstallBannerShown(true); }); await wait(400);
    L.is(await d.ev(() => $('install-banner').classList.contains('show')), 'el aviso está a la vista');
    await wait(1500);
    await d.ev(() => { openGastoModal(); $('gdesc').value = 'Kiosco'; $('gamt').value = '1500'; doSaveGasto(); }); await wait(500);
    L.is(await d.ev(() => !$('install-banner').classList.contains('show') && getComputedStyle(document.documentElement).getPropertyValue('--install-h').trim() === '0px'), 'al cargar el primer gasto el aviso se va (y lo que corría vuelve a su lugar)');
    L.eq(await d.ev(() => localStorage.getItem('fin_install_dismissed')), '1', 'y no vuelve en la próxima sesión');
    await cerrar();

    // Archivado: 20 meses atrás. Al abrir la app no sale un toast técnico; la cuenta queda en Ajustes.
    const viejo = mes(20);
    await d.ev(v => { S.gastos.push({ id: 'viejo1', desc: 'Compra vieja', cat: 'compras', amount: 7777, ...v, day: 3, addedAt: new Date(v.year, v.month, 3).getTime() }); save(); }, viejo);
    await P.reload(); await P.waitForFunction(() => typeof S === 'object' && S !== null && typeof showToast === 'function');
    await d.ev(() => { window.__t2 = []; const st = window.showToast; window.showToast = (m, a, b, c) => { window.__t2.push(String(m)); return st(m, a, b, c); }; });
    await wait(5200);
    const t2 = await d.ev(() => window.__t2.slice());
    L.is(!t2.some(m => /archivad/i.test(m)), `al abrir la app no sale el aviso técnico de archivado (${t2.length} toasts: ${t2.join(' | ').slice(0, 120)})`);
    const aj = await d.ev(async () => { const n = getArchivedGastos().length; openSyncModal(); await new Promise(r => setTimeout(r, 300)); return { n, txt: $('sync-weight').textContent }; });
    L.is(aj.n >= 1 && /archivado/.test(aj.txt), `la cuenta de archivados está en Ajustes: "${aj.txt.replace(/\s+/g, ' ').slice(-120)}"`);
    await cerrar();

    // El ⋯ de la fila no queda tapado por el toast.
    await d.ev(() => { goTo('gastos'); }); await wait(400);
    await P.click('.lgrp .rmore'); await wait(200);
    L.is(await d.ev(() => !!document.querySelector('.rmenu:not([hidden])')), 'el menú ⋯ de la fila está abierto');
    await d.ev(() => showToast('Listo', 'success')); await wait(200);
    L.is(await d.ev(() => !document.querySelector('.rmenu:not([hidden])')), 'cuando aparece un toast, el menú ⋯ se cierra');
    await cerrar();
  }

  // ════ C7 ════════════════════════════════════════════════════════════════
  L.section('C7 · Importes de 9 dígitos');
  {
    const gx = [{ id: 'e1', desc: 'Supermercado Mayorista', cat: 'super', amount: 987654321, ...mes(0), day: 1, addedAt: Date.now() },
      { id: 'e2', desc: 'Casa', cat: 'hogar', amount: 710500041, ...mes(0), day: 1, addedAt: Date.now() }];
    const LONG = 'Vencimiento ñoño Supermercado Mayorista Distribuidora Hermanos Rodríguez y Asociados Sociedad de Responsabilidad Limitada ñandú';
    const dx = await L.device(browser, { myName: 'fede', compBin: 'bin40x', contexto: iphone, seed: {
      accounts: [{ id: 'x0', name: 'Cuenta sueldo Supermercado Mayorista Distribuidora Hermanos Rodríguez', type: 'bancaria', amount: 987654321, currency: 'USD' },
                 { id: 'x1', name: 'Cuenta 3', type: 'bancaria', amount: 148000, currency: 'ARS' }, { id: 'x2', name: 'Otra', type: 'bancaria', amount: 5000, currency: 'ARS' }],
      gastos: gx, plan: [],
      agenda: { subs: [{ id: 's1', name: LONG, amount: 999999999, date: dk(Y, M, D + 1), period: 'mensual' }],
        vencimientos: [{ id: 'v1', name: LONG, amount: 123456789, date: dk(Y, M, Math.max(1, D - 3)), period: 'mensual' }],
        cuotas: [{ id: 'c1', name: 'Notebook', fee: 987654321, total: 24, paid: 3, startDate: dk(Y, M - 3, 10), nextDueDate: dk(Y, M, 10), dueDay: 10 }], inversiones: [] } } });
    await dx.ev(() => { localStorage.setItem('fin_theme', 'dark'); applyTheme(); goTo('saldos'); render(); }); await dx.page.waitForTimeout(800);
    const card = await dx.ev(() => { const c = document.querySelector('.bank-cards-scroll .bank-card'), a = c.querySelector('.bank-card-amount'), ar = a.getBoundingClientRect(), cr = c.getBoundingClientRect();
      return { dentro: ar.right <= cr.right - 4 + 0.5 && a.scrollWidth <= a.clientWidth + 1, txt: a.textContent, sw: a.scrollWidth, cw: a.clientWidth, ar: Math.round(ar.right), cr: Math.round(cr.right), nombreLineas: Math.round((c.querySelector('.bank-card-nm') || c.querySelector('.bank-card-top div')).getBoundingClientRect().height / 12) }; });
    L.is(card.dentro, `tarjeta de banco: "${card.txt}" entra en la tarjeta (derecha ${card.ar} de ${card.cr}; scroll ${card.sw}/${card.cw})`);
    L.is(card.nombreLineas <= 2, `y el nombre largo no pasa de 2 renglones (${card.nombreLineas})`);
    const vb = await dx.ev(() => { const t = [...document.querySelectorAll('.wr-bell-title')].map(e => { const lh = parseFloat(getComputedStyle(e).lineHeight) || 16; return Math.round(e.getBoundingClientRect().height / lh); }); return t; });
    L.is(vb.length >= 1 && vb.every(n => n <= 2), `nombre del vencimiento en Saldos: ${vb.join(' y ')} renglones como mucho 2 (antes 6)`);
    await shot(dx, 'c7-saldos');
    await dx.ev(() => { goTo('agenda'); switchAgendaTab('lista'); renderAgenda(); }); await dx.page.waitForTimeout(500);
    const tiles = await dx.ev(() => [...document.querySelectorAll('.ag-tile')].map(t => { const v = t.querySelector('.ag-tile-val'), vr = v.getBoundingClientRect(), tr = t.getBoundingClientRect();
      return { txt: v.textContent, dentro: vr.left >= tr.left - 0.5 && vr.right <= tr.right + 0.5 && v.scrollWidth <= v.clientWidth + 1, fs: getComputedStyle(v).fontSize }; }));
    const filaTiles = await dx.ev(() => { const s = document.querySelector('.ag-tiles-scroll'); return s.scrollWidth <= s.clientWidth + 1; });
    L.is(tiles.length === 3 && tiles.every(t => t.dentro) && filaTiles, `tiles de Agenda: los tres importes entran en su tile y los tres tiles en la pantalla, sin scroll (${tiles.map(t => t.txt + ' ' + t.fs).join(' · ')})`);
    await shot(dx, 'c7-agenda');
    await dx.ev(() => { goTo('gastos'); }); await dx.page.waitForTimeout(500);
    const dn = await dx.ev(() => { const c = document.querySelector('.donut-card .donut-ctr'), v = $('dval'), vr = v.getBoundingClientRect(), cr = c.getBoundingClientRect(), w = document.querySelector('.donut-card .donut-wrap').getBoundingClientRect();
      return { txt: v.textContent, w: Math.round(cr.width), centrado: Math.abs((vr.left + vr.right) / 2 - (w.left + w.right) / 2) < 3, dentro: v.scrollWidth <= v.clientWidth + 1 && vr.width <= 70.5, fs: getComputedStyle(v).fontSize }; });
    L.is(dn.dentro && dn.centrado, `donut de Gastos: "${dn.txt}" entra en el centro (${dn.fs}; centro de ${dn.w}px)`);
    await shot(dx, 'c7-gastos');
    await dx.close();
  }

  // ════ C8 ════════════════════════════════════════════════════════════════
  L.section('C8 · Toques de 44px');
  {
    await d.ev(() => { goTo('gastos'); }); await wait(500);
    const mn = await medAll(d, '.month-strip-page .mnbtn');
    todos44(mn, '‹ › y lupa de Gastos'); sinPisarse(mn, '‹ › y lupa');
    L.is(await d.ev(() => document.querySelector('.month-strip-page').getBoundingClientRect().height <= 48), 'y la franja del mes sigue en ≤ 48px');
    const rm = await medAll(d, '.lgrp .rmore'); todos44(rm, '⋯ de las filas de Gastos'); sinPisarse(rm, '⋯');
    const dl = await medAll(d, '#donut-legend .dl-row'); await d.ev(() => switchGastosTab('cats')); await wait(300);
    const dl2 = await medAll(d, '#donut-legend .dl-row'); todos44(dl2.length ? dl2 : dl, 'filas de la leyenda del donut'); sinPisarse(dl2.length ? dl2 : dl, 'leyenda');
    await d.ev(() => { goTo('compartidos'); }); await wait(600);
    todos44(await medAll(d, '#pg-compartidos .mnbtn'), '‹ › y lupa de Compartidos');
    todos44(await medAll(d, '#pg-compartidos .rmore'), '⋯ de Compartidos');
    ok44(await med(d, '.sh-btn-liq'), '"Liquidar"');
    await d.ev(() => { goTo('agenda'); switchAgendaTab('lista'); }); await wait(500);
    const tabs = await medAll(d, '.ag-tab'); todos44(tabs, 'pestañas de Agenda'); sinPisarse(tabs, 'pestañas de Agenda');
    await d.ev(() => { goTo('gastos'); openTendencia(); }); await wait(500);
    const seg = await medAll(d, '.tnd-seg button'); todos44(seg, '6 m / 12 m de Tendencia'); sinPisarse(seg, '6 m / 12 m');
    await cerrar();
    await d.ev(() => { goTo('saldos'); render(); }); await wait(500);
    ok44(await med(d, '#tc-chip'), 'cotización del dólar (#tc-chip)');
    const hdr = await medAll(d, '#tc-chip, #theme-toggle-btn-inline, #compact-toggle, #sync-btn-inline'); sinPisarse(hdr, 'cabecera de Saldos');
    await d.ev(() => openGastoModal()); await wait(500);
    const ch = await medAll(d, '#gcats .chip'); todos44(ch, 'chips de categoría del alta'); sinPisarse(ch, 'chips de categoría');
    const alto = await d.ev(() => { const c = document.querySelector('#gcats .chip'), cs = getComputedStyle(c); return { vis: c.getBoundingClientRect().height - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth) }; });
    L.is(alto.vis <= 40, `el dibujo del chip sigue de ${alto.vis}px (el resto es borde transparente)`);
    await cerrar();
    await d.ev(() => openAgendaModal('venc')); await wait(500);
    const cb = await d.ev(() => { const c = $('ag-addplan'), l = c.closest('label'); return { c: Math.round(c.getBoundingClientRect().width), l: Math.round(l.getBoundingClientRect().height), lw: Math.round(l.getBoundingClientRect().width) }; });
    L.is(cb.l >= 44 && cb.lw >= 200 && cb.c >= 24, `casilla del Plan: ${cb.c}px (antes 20) y toda la etiqueta (${cb.lw}×${cb.l}) la tilda`);
    await cerrar();
    await d.ev(() => openSyncModal()); await wait(500);
    const sa = await medAll(d, '#sync-modal-ov .sync-action-btn'); todos44(sa, 'botones de Ajustes (.sync-action-btn)');
    await cerrar();
    // SE: Liquidar y la barra
    const ds = await L.device(browser, { myName: 'fede', compBin: 'bin40se', contexto: se, seed });
    await ds.ev(() => goTo('compartidos')); await ds.page.waitForTimeout(700);
    ok44(await med(ds, '.sh-btn-liq'), '"Liquidar" en un SE (375×667)');
    const rs = await medAll(ds, '#pg-compartidos .sh-actions button'); sinPisarse(rs, 'Liquidar y ⋯ en el SE');
    await ds.ev(() => goTo('gastos')); await ds.page.waitForTimeout(500);
    todos44(await medAll(ds, '.month-strip-page .mnbtn'), '‹ › y lupa en un SE');
    await ds.close();
  }

  // ════ C10 ════════════════════════════════════════════════════════════════
  L.section('C10 · Escritorio: barra de abajo y toast dentro de la columna de 640px');
  {
    const dd = await L.device(browser, { myName: 'fede', compBin: 'bin40d', contexto: desk, seed });
    await dd.ev(() => { goTo('saldos'); showToast('Hola, esto es un toast', 'success', 9000); }); await dd.page.waitForTimeout(600);
    const r = await dd.ev(() => { const n = document.querySelector('.nav').getBoundingClientRect(), t = document.querySelector('.toast-bar.show').getBoundingClientRect();
      return { nav: [Math.round(n.left), Math.round(n.right)], toast: [Math.round(t.left), Math.round(t.right)], w: innerWidth }; });
    const c0 = (r.w - 640) / 2, c1 = c0 + 640;
    L.is(r.nav[0] >= c0 - 1 && r.nav[1] <= c1 + 1, `la barra ocupa ${r.nav.join('–')} dentro de la columna ${c0}–${c1} (antes 0–${r.w})`);
    L.is(r.toast[0] >= c0 - 1 && r.toast[1] <= c1 + 1, `el toast sale en ${r.toast.join('–')}, dentro de la columna (antes a la izquierda de todo)`);
    await shot(dd, 'c10-escritorio');
    await dd.close();
  }

  // ════ C12 ════════════════════════════════════════════════════════════════
  L.section('C12 · Montos con miles en los editores');
  {
    const miles = v => /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(v);
    await d.ev(() => { goTo('saldos'); openEditAcc('a1'); }); await wait(400);
    const v1 = await d.ev(() => $('edit-acc-amount').value); L.eq(v1, '1.250.000', 'Editar cuenta: el saldo dice 1.250.000 (antes 1250000)');
    const v1b = await d.ev(() => { const i = $('edit-acc-amount'); i.value = '1234567.5'; i.dispatchEvent(new Event('blur')); return i.value; }); L.eq(v1b, '1.234.567,5', 'y al salir del campo se formatea');
    await d.ev(() => saveEditAcc()); await wait(300);
    L.eq(await d.ev(() => S.accounts[0].amount), 1234567.5, 'guardar "1.234.567,5" guarda 1234567,5');
    await cerrar();
    await d.ev(() => { S.accounts[0].amount = 1250000; save(); });

    await d.ev(() => { goTo('agenda'); markVencPaid('v1'); }); await wait(400);
    const pv = await d.ev(() => ({ vis: !$('pay-amt-field').classList.contains('hidden'), v: $('pay-amt').value }));
    L.is(pv.vis && miles(pv.v), `Pagar: el importe dice ${pv.v} (el Plan dice otro que la Agenda)`);
    const pb = await d.ev(() => { const i = $('pay-amt'); i.value = '85000'; i.dispatchEvent(new Event('blur')); return [i.value, parseNumAR(i.value)]; }); L.eq(pb, ['85.000', 85000], 'y al salir del campo 85000 → 85.000 (se relee igual)');
    await cerrar();

    await d.ev(() => { goTo('agenda'); editAgenda('venc', 'v1'); }); await wait(400);
    const av = await d.ev(() => $('ag-amount').value); L.is(miles(av), `Agenda: el importe del vencimiento dice ${av} (antes 80000)`);
    const ab = await d.ev(() => { const i = $('ag-amount'); i.value = '120000'; i.dispatchEvent(new Event('blur')); return i.value; }); L.eq(ab, '120.000', 'y al salir del campo se formatea');
    await d.ev(() => doSaveAgenda()); await wait(400);
    L.eq(await d.ev(() => S.agenda.vencimientos.find(v => v.id === 'v1').amount), 120000, 'guardar "120.000" guarda 120000');
    await cerrar();

    await d.ev(() => { goTo('compartidos'); openEditSharedGasto({ id: 'sh1' }); }); await wait(500);
    const ev = await d.ev(() => $('esg-amt').value); L.is(miles(ev), `Editar gasto compartido: el monto dice ${ev} (antes 200000)`);
    const eb = await d.ev(() => { const i = $('esg-amt'); i.value = '250000'; i.dispatchEvent(new Event('blur')); return i.value; }); L.eq(eb, '250.000', 'y al salir del campo se formatea');
    await cerrar();

    await d.ev(() => { goTo('compartidos'); openSharedPaymentModal(); }); await wait(500);
    const sv = await d.ev(() => $('sp-amount').value); L.is(miles(sv), `Transferencia: el monto propuesto dice ${sv} (antes sin puntos)`);
    const sb = await d.ev(() => { const i = $('sp-amount'); i.value = '30000.5'; i.dispatchEvent(new Event('blur')); return [i.value, parseNumAR(i.value)]; }); L.eq(sb, ['30.000,5', 30000.5], 'y al salir del campo se formatea y se relee igual');
    await cerrar();
  }

  // ════ C13 ════════════════════════════════════════════════════════════════
  L.section('C13 · Sin jerga técnica en lo que se ve');
  {
    await d.ev(() => openSyncModal()); await wait(400);
    const aj = await d.ev(() => $('sync-modal-ov').innerText);
    L.is(!/bin compartido|bin compartidos/i.test(aj), 'Ajustes no dice "bin compartido(s)"');
    L.is(!/MI SYNC|\(JSONBIN\)/i.test(aj), 'ni "MI SYNC (JSONBIN)"');
    L.is(!/Worker de Cloudflare/i.test(aj), 'ni "Worker de Cloudflare" en los textos de ayuda');
    L.is(/MI SINCRONIZACIÓN/i.test(aj) && /GASTOS COMPARTIDOS/i.test(aj), 'las secciones son "Mi sincronización" y "Gastos compartidos"');
    L.is(/Mi ID de sincronización/.test(aj) && /Clave/.test(aj) && /VAPID Public Key/.test(aj), 'los campos técnicos (ID, Clave, VAPID) siguen donde hacen falta');
    await cerrar();
    await d.ev(() => { goTo('compartidos'); }); await wait(600);
    const fila = await d.ev(() => document.querySelector('#pg-compartidos').innerText);
    L.is(!/pediste|prestaste/.test(fila) && /debés|te deben/.test(fila), 'las filas de Compartidos dicen "te deben" / "debés" (antes "prestaste" / "pediste")');
    // Tendencia con un solo mes con datos
    await d.ev(() => { S.gastos = S.gastos.filter(g => !/^tn/.test(g.id)); save(); goTo('gastos'); openTendencia(); }); await wait(500);
    const tn = await d.ev(() => $('tnd-body').innerText);
    L.is(!/0 meses con gastos/.test(tn) && /Todavía no hay un mes cerrado/.test(tn), `Tendencia con un solo mes: sin "(0 meses con gastos)" ("${tn.split('\n').slice(-1)[0].slice(0, 70)}")`);
    await cerrar();
    await d.ev(gs => { gs.forEach(g => { if (/^tn/.test(g.id) && !S.gastos.some(x => x.id === g.id)) S.gastos.push(g); }); save(); }, gastos);
  }

  // ════ C14 ════════════════════════════════════════════════════════════════
  L.section('C14 · "Copias de gastos" abre como el resto de las hojas');
  {
    await d.ev(() => { openSyncModal(); openGastosBackupModal(); }); await wait(600);
    const r = await d.ev(() => { const o = document.getElementById('ov-gastos-bak'); const m = o && o.querySelector('.modal'); const sy = getComputedStyle($('sync-modal-ov')).zIndex;
      return o && { cls: o.className, modal: !!m, handle: !!(m && m.querySelector('.mhandle')), back: !!(m && m.querySelector(':scope>.ov-back')), titulo: m && m.querySelector('.mtitle').textContent, z: +getComputedStyle(o).zIndex, sync: +sy,
        radio: m && getComputedStyle(m).borderTopLeftRadius, radioOtra: getComputedStyle(document.querySelector('#ov-tendencia .modal')).borderTopLeftRadius, inline: !!o.getAttribute('style') }; });
    L.is(r && /overlay/.test(r.cls) && r.modal, `es un .overlay > .modal (clase "${r && r.cls}")`);
    L.is(r && r.handle && r.back, 'con manija arriba y flecha ‹ de volver');
    L.is(r && r.z > r.sync && r.z === 2100, `z-index ${r && r.z} del sistema (arriba de Ajustes, ${r && r.sync})`);
    L.is(r && r.radio === r.radioOtra && !r.inline, `mismo radio de hoja (${r && r.radio}) y sin estilos inline en el contenedor`);
    L.is(await d.ev(() => document.getElementById('ov-gastos-bak').classList.contains('open')), 'queda abierta');
    await shot(d, 'c14-copias');
    await P.click('#ov-gastos-bak .ov-back'); await wait(400);
    L.is(await d.ev(() => !document.getElementById('ov-gastos-bak')?.classList.contains('open')), 'la flecha ‹ la cierra');
    await d.ev(() => openGastosBackupModal()); await wait(400);
    await d.ev(() => document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open'))); await wait(100);
    L.is(await d.ev(() => !document.querySelector('#ov-gastos-bak.open')), 'y se cierra con el cierre general de hojas (.overlay.open)');
    await cerrar();
  }

  // ════ C17 ════════════════════════════════════════════════════════════════
  L.section('C17 · Tendencia sin etiquetas pisadas; Plan sin la flecha sobre los datos');
  {
    await d.ev(() => { goTo('gastos'); openTendencia(); }); await wait(600);
    const r = await d.ev(() => { const box = e => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, txt: e.textContent }; };
      const els = [...document.querySelectorAll('#tnd-body svg text.tnd-val, #tnd-body svg text.tnd-avgl')].filter(e => e.textContent.trim()).map(box); const pis = [];
      for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const a = els[i], b = els[j]; if (Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5) pis.push(a.txt + ' ∩ ' + b.txt); }
      return { n: els.length, pis, prom: els.filter(e => /prom/.test(e.txt)).length }; });
    L.is(r.n >= 6 && r.prom === 1, `se miden ${r.n} etiquetas (los 6 meses y el promedio)`);
    L.eq(r.pis, [], 'ninguna etiqueta de barra se pisa con "prom." (antes "prom. $879k" con "$960k")');
    await shot(d, 'c17-tendencia');
    await cerrar();
    await d.ev(() => { goTo('agenda'); switchAgendaTab('plan'); renderProj(); }); await wait(700);
    const p = await d.ev(() => { const nav = document.querySelector('.proj-nav-r').getBoundingClientRect(), sc = document.querySelector('#ag-view-plan .proj-scroll').getBoundingClientRect();
      const celdas = [...document.querySelectorAll('#ptable th, #ptable td')].filter(c => c.textContent.trim()).map(c => { const b = c.getBoundingClientRect();
        return { l: Math.max(b.left, sc.left), r: Math.min(b.right, sc.right), t: b.top, b: b.bottom, txt: c.textContent.trim().slice(0, 8) }; }).filter(c => c.r - c.l > 1);
      const tapadas = celdas.filter(c => Math.min(c.r, nav.right) - Math.max(c.l, nav.left) > 1 && Math.min(c.b, nav.bottom) - Math.max(c.t, nav.top) > 1).map(c => c.txt);
      return { tapadas, navL: Math.round(nav.left), scR: Math.round(sc.right) }; });
    L.eq(p.tapadas, [], `la flecha › (desde ${p.navL}) no tapa ninguna celda de la tabla (que termina en ${p.scR})`);
    await shot(d, 'c17-plan');
    await cerrar();
  }

  L.eq(d.errors, [], 'sin errores de JS');
  await d.close();
  await browser.close();
  console.log(`\n${'─'.repeat(50)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
