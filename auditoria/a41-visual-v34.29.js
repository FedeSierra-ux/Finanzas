// v34.29 (preview de la auditoría v34.27, ítems 38, 43, 46, 51 y 68; C3), con iPhone 390x844,
// SE 375x667, Android 412x915 y escritorio 1280x800, en tema oscuro y claro:
//   · C3/43  los botones primarios (azul, púrpura, verde de Liquidar, rojo de Eliminar) llevan
//            texto oscuro en el oscuro (≥ 7:1, el mismo color que el "+" de la barra) y blanco en
//            el claro (≥ 4,5:1); "Cancelar" con texto fuerte y el borde visible;
//   · 68     el ✓ de Agenda y "Liquidar" responden al dedo en ≥ 44×44, sin pisar a un vecino;
//   · 38     un solo "eyebrow" para las etiquetas de sección, cifras tabulares en los montos,
//            cabeceras de día "HOY · JUEVES, 15 DE OCTUBRE", total del día en gris y la fecha de
//            Saldos (#dtag) fuera del eyebrow;
//   · 51     foco visible con teclado y popovers/banners con la elevación --el-3;
//   · 46     tabla del Plan: cabeceras en eyebrow, gastos en rojo apagado, columna fija con
//            hairline y la flecha › sin tapar datos.
// Con la v34.28 casi todo termina en ✗. A41_SHOTS=/ruta guarda capturas.
const L = require('./lib');
const fs = require('fs');

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const mov = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce', userAgent: UA });
const DEVS = [['iPhone 390', mov(390, 844)], ['SE 375', mov(375, 667)], ['Android 412', mov(412, 915)],
  ['escritorio 1280', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce' }]];
const SHOTS = process.env.A41_SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

// Área que responde al dedo: el botón más lo que crece su ::after (igual que a40).
const TOCABLE = `(el) => { const r = el.getBoundingClientRect(); let t = r.top, b = r.bottom, l = r.left, rr = r.right;
  for (const ps of ['::after', '::before']) { const cs = getComputedStyle(el, ps); if (cs.content === 'none' || cs.position !== 'absolute') continue;
    const n = v => parseFloat(v) || 0; t = Math.min(t, r.top + n(cs.top)); l = Math.min(l, r.left + n(cs.left)); b = Math.max(b, r.bottom - n(cs.bottom)); rr = Math.max(rr, r.right - n(cs.right)); }
  return { w: Math.round(r.width), h: Math.round(r.height), tw: Math.round(rr - l), th: Math.round(b - t), box: { l, t, r: rr, b } }; }`;
// Contraste WCAG entre dos colores computados (rgb(), rgba() o color(srgb …)).
const CONTRASTE = `(() => { const parse = c => { const n = (c.match(/-?[\\d.]+(?:e-?\\d+)?/g) || []).map(Number); return /^color\\(/.test(c) ? n.slice(0, 3).map(v => Math.round(v * 255)) : n.slice(0, 3); };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  return (a, b) => { const x = lum(parse(a)), y = lum(parse(b)); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); }; })()`;

(async () => {
  const browser = await L.launch();
  const f = new Date(), M = f.getMonth(), Y = f.getFullYear(), D = f.getDate();
  const dk = (y, m, dd) => { const x = new Date(y, m, dd); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const pk = (y, m) => { const x = new Date(y, m, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
  const ayer = new Date(Y, M, D - 1), hace3 = new Date(Y, M, D - 3);
  const g = (id, desc, cat, amount, fecha, extra) => ({ id, desc, cat, amount, month: fecha.getMonth(), year: fecha.getFullYear(), day: fecha.getDate(), addedAt: Date.now(), ...extra });
  const months = {}; for (let k = 0; k < 8; k++) months[pk(Y, M + k)] = 325000 + k * 5000;
  const seed = {
    accounts: [{ id: 'a1', name: 'Galicia', type: 'bancaria', amount: 1250000, currency: 'ARS' }],
    gastos: [g('g1', 'Coto', 'super', 48900, f), g('g2', 'Nafta', 'transporte', 30000, f), g('g3', 'Cine', 'salidas', 12500, ayer),
      g('g4', 'Farmacia', 'hogar', 8700, hace3), g('sh1', 'Cena', 'salidas', 200000, f, { shared: { active: true, paidBy: 'mile', splitPct: 50 } })],
    plan: [{ id: 'p1', name: 'Alquiler', cat: 'gasto', months, order: 1 }, { id: 'p2', name: 'Expensas', cat: 'gasto', months: { [pk(Y, M)]: 85000 }, order: 2 },
           { id: 'p3', name: 'Sueldo', cat: 'ingreso', months: Object.fromEntries(Object.keys(months).map(k => [k, 1900000])), order: 3 }],
    agenda: { subs: [{ id: 's1', name: 'Netflix', amount: 9000, date: dk(Y, M, D + 2), period: 'mensual' }, { id: 's2', name: 'Spotify', amount: 4500, date: dk(Y, M, D + 3), period: 'mensual' }],
      vencimientos: [{ id: 'v1', name: 'Expensas', amount: 80000, date: dk(Y, M, D), period: 'mensual' }], cuotas: [], inversiones: [] },
  };

  for (const [nombre, ctxo] of DEVS.filter(([n]) => !process.env.A41_SOLO || n.includes(process.env.A41_SOLO))) {
    L.resetBins();
    const d = await L.device(browser, { myName: 'fede', compBin: 'bin41', contexto: ctxo, seed });
    const P = d.page, wait = ms => P.waitForTimeout(ms);
    // Sin transiciones: así getComputedStyle da el color final apenas se cambia de tema (en las hojas cerradas la transición no avanza).
    await P.addStyleTag({ content: '*,*::before,*::after{transition:none!important}' });
    const desk = ctxo.viewport.width >= 1000;
    const cerrar = () => d.ev(() => { document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open')); closeRowMenus(); document.querySelector('.toast-bar')?.classList.remove('show'); if (document.activeElement) document.activeElement.blur(); });
    const shot = async name => { if (SHOTS) await P.screenshot({ path: `${SHOTS}/${nombre.split(' ')[0]}-${name}.png` }); };
    const ir = async (fn, ms = 450) => { await d.ev(fn); await wait(ms); };
    const medAll = sel => d.ev(([T, sel]) => { const m = eval(T); return [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().width).map(m); }, [TOCABLE, sel]);
    const sinPisarse = (rs, lbl) => { let n = 0; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i].box, b = rs[j].box;
      if (Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5) n++; } L.eq(n, 0, `${lbl}: las áreas táctiles de vecinos no se superponen`); };

    for (const tema of ['dark', 'light']) {
      const T = `${nombre} · ${tema === 'dark' ? 'oscuro' : 'claro'}`;
      await d.ev(t => { localStorage.setItem('fin_theme', t); applyTheme(); }, tema); await wait(300);

      // ════ C3 / 43 · botones ════════════════════════════════════════════════
      L.section(`C3/43 · Botones primarios y Cancelar · ${T}`);
      {
        const r = await d.ev(C => { const cr = eval(C); const cs0 = getComputedStyle(document.documentElement);
          const out = { prim: [], canc: [], nav: null, bgcard: cs0.getPropertyValue('--card2').trim() };
          document.querySelectorAll('.btnp,.btn-primary').forEach(b => { const cs = getComputedStyle(b);
            out.prim.push({ id: b.id || b.textContent.trim().slice(0, 18), bg: cs.backgroundColor, color: cs.color, cr: cr(cs.color, cs.backgroundColor) }); });
          document.querySelectorAll('.btnc,.btn-cancel').forEach(b => { if (b.classList.contains('btn-del-pie')) return; const cs = getComputedStyle(b);
            const probe = document.createElement('i'); probe.style.borderColor = 'var(--border2)'; document.body.appendChild(probe); const b2 = getComputedStyle(probe).borderTopColor; probe.remove();
            out.canc.push({ txt: b.textContent.trim().slice(0, 14), cr: cr(cs.color, cs.backgroundColor), borde: cs.borderTopColor === b2, sinBorde: cs.borderTopWidth === '0px' }); });
          const na = document.querySelector('.nav-add-in'); if (na) out.nav = getComputedStyle(na).color;
          return out; }, CONTRASTE);
        const min = tema === 'dark' ? 7 : 4.5;
        const flojos = r.prim.filter(p => p.cr < min).map(p => `${p.id} ${p.cr} (${p.color} sobre ${p.bg})`);
        L.is(r.prim.length >= 10 && flojos.length === 0, `${r.prim.length} botones primarios con contraste ≥ ${min}:1${flojos.length ? ' — flojos: ' + [...new Set(flojos)].join(', ') : ' (mín ' + Math.min(...r.prim.map(p => p.cr)) + ')'}`);
        const fondos = new Set(r.prim.map(p => p.bg));
        L.is(fondos.size >= 3, `se miden los acentos azul, púrpura, verde y rojo (${fondos.size} fondos distintos)`);
        if (tema === 'dark') L.is(r.prim.every(p => p.color === r.nav), `el texto del botón es el mismo color que el "+" de la barra (${r.nav})`);
        L.is(r.canc.length >= 8 && r.canc.every(c => c.cr >= 7), `${r.canc.length} "Cancelar/Cerrar" con texto ≥ 7:1 (mín ${Math.min(...r.canc.map(c => c.cr))})`);
        L.is(r.canc.every(c => c.borde), 'y con el borde de --border2 (el más visible), no el tenue de antes');
      }
      // Los botones de las hojas, tal como se ven.
      await ir(() => { goTo('gastos'); openGastoModal(); }, 600); await shot(`c3-alta-${tema}`);
      await cerrar();
      await ir(() => { openSharedPaymentModal(); }, 600); await shot(`c3-liquidar-${tema}`);
      await cerrar();

      // ════ 68 · áreas táctiles ══════════════════════════════════════════════
      L.section(`68 · ✓ de Agenda y Liquidar a 44 px · ${T}`);
      {
        await ir(() => { goTo('agenda'); switchAgendaTab('lista'); }, 700); await shot(`i68-agenda-${tema}`);
        const pay = await medAll('.tl-btn-pay');
        L.is(pay.length >= 3 && pay.every(r => r.tw >= 44 && r.th >= 44), `${pay.length} ✓ con área táctil ≥ 44×44 (${[...new Set(pay.map(r => r.w + '×' + r.h + ' → ' + r.tw + '×' + r.th))].join(', ')})`);
        sinPisarse(pay, '✓ de Agenda');
        await ir(() => { goTo('compartidos'); }, 700); await shot(`i68-compartidos-${tema}`);
        const liq = await medAll('.sh-btn-liq');
        L.is(liq.length >= 1 && liq.every(r => r.tw >= 44 && r.th >= 44), `Liquidar ≥ 44×44 (${liq.map(r => r.w + '×' + r.h + ' → ' + r.tw + '×' + r.th).join(', ')})`);
      }

      // ════ 38 · tipografía ══════════════════════════════════════════════════
      L.section(`38 · Eyebrow único, cifras tabulares, cabeceras de día, total gris · ${T}`);
      {
        for (const fn of [() => { goTo('saldos'); }, () => { goTo('gastos'); }, () => { goTo('compartidos'); }, () => { goTo('agenda'); switchAgendaTab('lista'); },
          () => { switchAgendaTab('tarjetas'); }, () => { switchAgendaTab('plan'); }]) await ir(fn, 500);
        const r = await d.ev(() => {
          const sel = '.sec-title,.gsec-lbl,.tl-group-lbl,.ag-sec-lbl,.tj-sec-label,.tj-det-label,.sec-lbl-m,.funds-title,.cat-toggle-lbl,.wr-venc-lbl';
          const els = [...document.querySelectorAll(sel)];
          const estilos = {}; els.forEach(e => { const cs = getComputedStyle(e); const k = [cs.fontSize, cs.fontWeight, cs.letterSpacing, cs.textTransform].join(' | '); (estilos[k] = estilos[k] || new Set()).add(e.className.split(' ')[0]); });
          const dtag = document.getElementById('dtag'); const dcs = getComputedStyle(dtag);
          return { n: els.length, clases: [...new Set(els.map(e => e.className.split(' ')[0]))], estilos: Object.fromEntries(Object.entries(estilos).map(([k, v]) => [k, [...v]])),
            dtag: { tt: dcs.textTransform, corta: dtag.scrollWidth > dtag.clientWidth + 1, txt: dtag.textContent }, };
        });
        L.is(r.n >= 8 && r.clases.length >= 5, `se miden ${r.n} etiquetas de sección de ${r.clases.length} tipos (${r.clases.join(', ')})`);
        L.eq(Object.keys(r.estilos).length, 1, `todas con el mismo tamaño, peso, tracking y mayúsculas${Object.keys(r.estilos).length > 1 ? ' — hay ' + Object.keys(r.estilos).length + ': ' + JSON.stringify(r.estilos) : ' (' + Object.keys(r.estilos)[0] + ')'}`);
        L.is(r.dtag.tt === 'none' && !r.dtag.corta, `la fecha de Saldos (#dtag "${r.dtag.txt}") sigue sin mayúsculas y entera`);

        // Cifras tabulares en todos los montos que se ven.
        const nt = [];
        for (const [vista, fn] of [['Saldos', () => { goTo('saldos'); }], ['Gastos', () => { goTo('gastos'); }], ['Compartidos', () => { goTo('compartidos'); }],
          ['Agenda', () => { goTo('agenda'); switchAgendaTab('lista'); }], ['Tarjetas', () => { switchAgendaTab('tarjetas'); }], ['Plan', () => { switchAgendaTab('plan'); }]]) {
          await ir(fn, 500);
          const mal = await d.ev(() => [...document.querySelectorAll('body *')].filter(e => {
            if (!e.getBoundingClientRect().width || e.closest('.overlay:not(.open)') || e.closest('[hidden]')) return false;
            const txt = e.tagName === 'INPUT' ? e.value : (e.children.length ? '' : e.textContent);
            return /\d{1,3}(\.\d{3})+|\$\s?\d/.test(txt) && !/tabular-nums/.test(getComputedStyle(e).fontVariantNumeric); })
            .map(e => e.tagName.toLowerCase() + '.' + (e.className || '').toString().split(' ')[0] + '="' + (e.value || e.textContent).trim().slice(0, 14) + '"'));
          mal.forEach(m => nt.push(vista + ' ' + m));
        }
        L.is(nt.length === 0, `todos los montos con cifras tabulares${nt.length ? ' — sin tabular: ' + [...new Set(nt)].slice(0, 12).join(' · ') + (nt.length > 12 ? ' … (' + nt.length + ')' : '') : ''}`);

        // Cabeceras de día y total del día.
        await ir(() => { goTo('gastos'); }, 600); await shot(`i38-gastos-${tema}`);
        const dias = await d.ev(() => { const cr = (el, p) => getComputedStyle(el)[p];
          const hs = [...document.querySelectorAll('#gastos-list .day-header')].map(h => ({ txt: h.querySelector('.day-label').innerText.replace(/\s+/g, ' ').trim(), tot: cr(h.querySelector('.day-total'), 'color') }));
          const probe = document.createElement('i'); probe.style.color = 'var(--muted)'; document.body.appendChild(probe); const muted = getComputedStyle(probe).color; probe.remove();
          return { hs, muted }; });
        const hoy = dias.hs[0] && dias.hs[0].txt;
        L.is(/^HOY · [A-ZÁÉÍÓÚÑ]+,? \d{1,2} DE [A-ZÁÉÍÓÚÑ]+$/.test(hoy || ''), `la cabecera de hoy dice "${hoy}" (HOY · DÍA, N DE MES)`);
        L.is(dias.hs.length >= 3 && dias.hs.every(h => h.txt === h.txt.toUpperCase()), `las ${dias.hs.length} cabeceras de día van en mayúsculas (${dias.hs.map(h => h.txt).join(' / ')})`);
        L.is(dias.hs.every(h => h.tot === dias.muted), 'el total del día va en gris (--muted), no en rojo');
      }

      // ════ 51 · foco y elevación ════════════════════════════════════════════
      L.section(`51 · Foco visible y elevación de popovers/banners · ${T}`);
      {
        await ir(() => { goTo('gastos'); }, 400); await cerrar();
        let foco = null;
        for (let i = 0; i < 40 && !(foco && foco.tag === 'BUTTON'); i++) {
          await P.keyboard.press('Tab');
          foco = await d.ev(() => { const a = document.activeElement; if (!a || a === document.body) return null; const cs = getComputedStyle(a); const probe = document.createElement('i'); probe.style.color = 'var(--blue)'; document.body.appendChild(probe); const azul = getComputedStyle(probe).color; probe.remove();
            return { tag: a.tagName, vis: a.matches(':focus-visible'), estilo: cs.outlineStyle, ancho: cs.outlineWidth, color: cs.outlineColor, azul }; });
        }
        L.is(foco && foco.tag === 'BUTTON' && foco.vis && foco.estilo === 'solid' && foco.ancho === '2px' && foco.color === foco.azul, `un botón con foco de teclado dibuja el anillo azul de 2px (${foco && foco.estilo + ' ' + foco.ancho + ' ' + foco.color})`);
        const el = await d.ev(() => {
          const sombra = cls => { const p = document.createElement('div'); p.className = cls; p.style.cssText = 'position:absolute;left:-999px;top:0'; document.body.appendChild(p); const s = getComputedStyle(p).boxShadow; p.remove(); return s; };
          const ref = document.createElement('i'); ref.style.boxShadow = 'var(--el-3)'; document.body.appendChild(ref); const el3 = getComputedStyle(ref).boxShadow; ref.remove();
          const out = { el3 }; for (const c of ['rmenu', 'tc-pop', 'install-banner', 'update-banner']) out[c] = sombra(c); return out; });
        const faltan = ['rmenu', 'tc-pop', 'install-banner', 'update-banner'].filter(c => !el[c].includes(el.el3));
        L.is(faltan.length === 0, `menú ⋯, popover del dólar y los dos banners usan --el-3${faltan.length ? ' — no: ' + faltan.join(', ') : ''}`);
      }

      // ════ 46 · tabla del Plan ══════════════════════════════════════════════
      L.section(`46 · Tabla del Plan más calma · ${T}`);
      {
        await ir(() => { goTo('agenda'); switchAgendaTab('plan'); renderProj(); }, 800); await shot(`i46-plan-${tema}`);
        const r = await d.ev(C => { const cr = eval(C); const rojo = (() => { const p = document.createElement('i'); p.style.color = 'var(--red)'; document.body.appendChild(p); const c = getComputedStyle(p).color; p.remove(); return c; })();
          const card = getComputedStyle(document.querySelector('.proj-wrap')).backgroundColor;
          const ths = [...document.querySelectorAll('#ptable thead th')].filter(t => t.textContent.trim());
          const rojos = [...document.querySelectorAll('#ptable td.amc input')].filter(i => i.style.color.includes('--red') && i.value).map(i => ({ c: getComputedStyle(i).color }));
          const cel = document.querySelector('#ptable tr.data-r td:first-child'); const sh = getComputedStyle(cel).boxShadow;
          const nav = document.querySelector('.proj-nav-r').getBoundingClientRect(), sc = document.querySelector('#ag-view-plan .proj-scroll').getBoundingClientRect();
          const tapadas = [...document.querySelectorAll('#ptable th, #ptable td')].filter(c => c.textContent.trim()).map(c => { const b = c.getBoundingClientRect(); return { l: Math.max(b.left, sc.left), r: Math.min(b.right, sc.right), t: b.top, b: b.bottom }; })
            .filter(c => c.r - c.l > 1 && Math.min(c.r, nav.right) - Math.max(c.l, nav.left) > 1 && Math.min(c.b, nav.bottom) - Math.max(c.t, nav.top) > 1).length;
          return { ths: ths.map(t => ({ txt: t.innerText.trim(), tt: getComputedStyle(t).textTransform, fs: getComputedStyle(t).fontSize })), n: rojos.length,
            saturados: rojos.filter(x => x.c === rojo).length, minCr: Math.min(...rojos.map(x => cr(x.c, card))), sh, tapadas }; }, CONTRASTE);
        L.is(r.ths.length >= 4 && r.ths.every(t => t.tt === 'uppercase'), `las cabeceras de mes en eyebrow (${r.ths.map(t => t.txt).join(' ')})`);
        L.is(r.n >= 5 && r.saturados === 0, `${r.n} cifras de gasto en rojo apagado, ${r.saturados} en el rojo saturado`);
        L.is(r.minCr >= 4.5, `y el rojo apagado se lee (contraste mín ${r.minCr}:1)`);
        L.is(!/rgba?\(0, 0, 0/.test(r.sh) && /\b1px 0px 0px 0px\b/.test(r.sh), `la columna fija lleva un hairline y no la sombra negra (${r.sh})`);
        L.eq(r.tapadas, 0, 'la flecha › sigue en su franja y no tapa ninguna celda');
      }
      await cerrar();
    }
    L.eq(d.errors, [], `${nombre}: sin errores de JS`);
    await d.close();
  }
  await browser.close();
  console.log(`\n${'─'.repeat(50)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
