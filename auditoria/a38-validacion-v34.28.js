// Validación de lo que entra de afuera (auditoría de la v34.27, B1, B2 y B3),
// cada punto con la reproducción con la que se encontró. Con la v34.27 las
// secciones terminan en ✗:
//   · B1  la respuesta de Claude/Worker en el import de Mercado Pago (XSS en la
//         revisión, ítems null o con fecha numérica que cortaban el import);
//   · B2  id / cat / paidBy sin validar que entran por el fin_v6 guardado, el
//         bin personal o un backup y terminan en un onclick inline;
//   · B3  un solo registro inválido (null en accounts, gastos:{}, fin_v6 = null)
//         dejaba el arranque a medias o la app muerta.
// "Validar y avisar qué se descartó": un solo aviso con el conteo y el detalle
// en el registro de errores (finLogs).
//   A38_BACKUP=/ruta/backup.json   backup real (p. ej. el que deja a13) para
//                                  comprobar que sanear no cambia nada.
//   A38_ESTADO=/ruta/fin_v6.json   un fin_v6 crudo (p. ej. el de a19), idem.
const L = require('./lib');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const APP = pathToFileURL(L.APP_FILE).href;
const PAGINAS = ['saldos', 'gastos', 'compartidos', 'agenda'];

// Pestaña con la app real y un localStorage sembrado ANTES de que carguen los
// scripts de la app (así se prueba el arranque con datos rotos). `respuesta`
// contesta a las llamadas a Anthropic; lo demás de la red devuelve {}.
async function abrir(browser, { ls = {}, respuesta = null, esperar = true } = {}) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR: ' + String(e.message).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (!/Failed to load resource|net::|navigator\.vibrate/.test(t)) errors.push('CONSOLE: ' + t.slice(0, 200)); } });
  page.on('dialog', d => { errors.push('DIALOG: ' + d.message()); d.dismiss().catch(() => {}); });
  await page.addInitScript(({ ls, respuesta }) => {
    window.__xss = []; window.__toasts = [];
    document.addEventListener('DOMContentLoaded', () => {
      const m = document.getElementById('toast-msg');
      if (m) new MutationObserver(() => window.__toasts.push(m.textContent)).observe(m, { childList: true, characterData: true, subtree: true });
    });
    window.fetch = async (u) => {
      const s = String(u && u.url ? u.url : u);
      if (respuesta !== null && /anthropic/.test(s)) return new Response(JSON.stringify({ content: [{ text: typeof respuesta === 'string' ? respuesta : JSON.stringify(respuesta) }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    try {
      if (!sessionStorage.getItem('__a38')) { sessionStorage.setItem('__a38', '1'); for (const k in ls) localStorage.setItem(k, ls[k]); }
    } catch (e) {}
  }, { ls, respuesta });
  await page.goto(APP);
  if (esperar) await page.waitForFunction(() => typeof S === 'object' && S !== null && typeof save === 'function' && typeof processMPWithClaude === 'function', null, { timeout: 8000 }).catch(() => errors.push('BOOT TIMEOUT'));
  return { page, ctx, errors, ev: (fn, arg) => page.evaluate(fn, arg), close: () => ctx.close() };
}

// El aviso sale 700 ms después de abrir: se espera a que aparezca (o 4 s).
const esperarAviso = (d, patron = 'Revisé los datos|No pude leer tus datos') => d.page.waitForFunction(re => window.__toasts.some(t => new RegExp(re).test(t)), patron, { timeout: 4000 }).catch(() => {});

// Todo lo que tiene onclick/onchange/… tiene que ser JS que compile y no
// puede traer el marcador del XSS; ninguna <img src=x> inyectada.
const escanear = () => {
  const roto = [], inj = [];
  document.querySelectorAll('*').forEach(el => {
    for (const a of el.attributes) {
      if (!/^on/i.test(a.name)) continue;
      try { new Function('event', a.value); } catch (e) { roto.push(a.value.slice(0, 120)); }
      if (/window\.__xss|__xss\.push/.test(a.value)) inj.push(a.value.slice(0, 120));
    }
    if (el.tagName === 'IMG' && el.getAttribute('src') === 'x') inj.push('IMG src=x');
  });
  return { roto, inj };
};

// Un error adentro de una sección (p. ej. una función que la v34.27 no tiene) se
// anota como ✗ y sigue con la próxima, en vez de abortar el script.
const prot = async fn => { try { await fn(); } catch (e) { L.bad('la sección se cortó: ' + String(e.message).split('\n')[0].slice(0, 140)); } };
const IDS_OK = /^[\w-]{1,64}$/;
const CATS_OK = ['comida', 'transporte', 'salidas', 'hogar', 'depto', 'super', 'regalos', 'oficina', 'suscripciones', 'compras', 'tarjeta', 'varios'];
const mk = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;
const ds = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Estado con TODOS los id (y cat/paidBy) hechos de un payload.
function estadoEvil(P) {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const prox = new Date(y, m + 1, 5), id = n => n + P, base = Date.now();
  return {
    accounts: [{ id: id('a1'), name: 'Galicia', type: 'bancaria', amount: 100000, currency: 'ARS' },
      { id: id('a2'), name: 'Inv', type: 'inversión', amount: 500, currency: 'USD' },
      { id: id('a3'), name: 'Efvo', type: 'varios', amount: 5000, currency: 'ARS' }],
    gastos: [
      { id: id('g1'), desc: 'Coto', cat: 'super', amount: 1000, month: m, year: y, day: 3, addedAt: base, account: id('a1') },
      { id: id('g2'), desc: 'Cena', cat: P, amount: 5000, month: m, year: y, day: 4, addedAt: base, shared: { active: true, paidBy: P, splitPct: 50 } },
      { id: id('g3'), desc: 'Cuota', cat: 'tarjeta', amount: 2000, month: m, year: y, day: 5, addedAt: base, cuotaActual: 1, cuotaTotal: 6 },
      { id: id('g4'), desc: 'Compartido', cat: 'salidas', amount: 800, month: m, year: y, day: 6, addedAt: base, paidBy: P, shared: { active: true, paidBy: 'mile', splitPct: 50 } },
      { id: id('g5'), desc: 'Mes ant', cat: 'comida', amount: 300, month: (m + 11) % 12, year: m === 0 ? y - 1 : y, day: 6, addedAt: base }],
    plan: [{ id: id('p1'), name: 'Sueldo', cat: 'ingreso', months: { [mk(y, m)]: 100000, [mk(prox.getFullYear(), prox.getMonth())]: 100000 }, order: 1 },
      { id: id('p2'), name: 'Alquiler', cat: 'gasto', months: { [mk(y, m)]: 50000, [mk(prox.getFullYear(), prox.getMonth())]: 50000 }, order: 1 },
      { id: id('p3'), name: 'Netflix', cat: P, months: { [mk(y, m)]: 5000 }, order: 2 }],
    agenda: {
      subs: [{ id: id('s1'), name: 'Spotify', amount: 3000, date: ds(prox), dueDay: 5, period: 'mensual' }],
      vencimientos: [{ id: id('v1'), name: 'Patente', amount: 9000, date: ds(new Date(y, m, 28)), dueDay: 28, period: 'unico', shared: { active: true, paidBy: P, splitPct: 50 } }],
      cuotas: [{ id: id('c1'), createdAt: base, name: 'Heladera', fee: 20000, total: 12, paid: 3, startDate: ds(new Date(y, m - 3, 5)), nextDueDate: ds(prox), dueDay: 5 }],
      inversiones: [{ id: id('i1'), name: 'Plazo fijo', amount: 100000, date: ds(prox) }],
    },
    tc: 1300,
  };
}

// Recorre todo lo clickeable de las cuatro pantallas y las pestañas de Agenda
// escaneando después de cada clic. Devuelve handlers rotos e inyecciones.
async function recorrer(page, maxPorPagina = 60) {
  const rotos = new Set(), inyectados = new Set();
  const sumar = r => { r.roto.forEach(x => rotos.add(x)); r.inj.forEach(x => inyectados.add(x)); };
  let clics = 0;
  const SEL = '[onclick],button,.chip,[role=button],.gcal-row,[tabindex]';
  for (const pg of PAGINAS) {
    await page.evaluate(pg => goTo(pg), pg); await page.waitForTimeout(250);
    sumar(await page.evaluate(escanear));
    if (pg === 'agenda') for (const t of ['tarjetas', 'plan', 'lista']) { await page.evaluate(t => { try { switchAgendaTab(t); } catch (e) {} }, t); await page.waitForTimeout(150); sumar(await page.evaluate(escanear)); }
    await page.evaluate(pg => goTo(pg), pg); await page.waitForTimeout(150);
    const n = await page.evaluate(sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null).length, SEL);
    for (let i = 0; i < Math.min(n, maxPorPagina); i++) {
      await page.evaluate(({ i, sel }) => {
        const e = [...document.querySelectorAll(sel)].filter(x => x.offsetParent !== null)[i];
        if (e && !/Eliminar|Borrar|Reset|Limpiar|Salir|Reemplaz/i.test(e.textContent || '')) e.click();
      }, { i, sel: SEL }).catch(() => {});
      clics++;
      await page.waitForTimeout(40);
      sumar(await page.evaluate(escanear).catch(() => ({ roto: [], inj: [] })));
      await page.evaluate(() => {
        document.querySelectorAll('.overlay.open').forEach(o => { try { closeOv(o.id); } catch (e) { o.classList.remove('open'); } });
        if (typeof closeRowMenus === 'function') closeRowMenus();
      }).catch(() => {});
    }
  }
  return { clics, rotos: [...rotos], inyectados: [...inyectados] };
}

(async () => {
  const browser = await L.launch();

  // ═══ B1 · Mercado Pago: la respuesta de Claude se valida ═══════════════
  L.section('B1 · Import de Mercado Pago: respuesta de Claude/Worker con HTML, ítems null y fechas numéricas');
  await prot(async () => {
    const hoy = ds(new Date());
    const bueno = { desc: 'Coto', amount: 1500, date: '2026-10-05', category: 'super' };
    const casos = [
      ['fecha con HTML', { gastos: [{ ...bueno, date: '2026-10-0<img src=x onerror="window.__xss.push(\'MPDATE\')">' }, bueno] }, 1, 1],
      ['fecha numérica', { gastos: [{ ...bueno, date: 20261001 }, bueno] }, 1, 1],
      ['ítem null', { gastos: [null, bueno, 'texto', 5, [1]] }, 1, 4],
      ['desc con HTML (se escapa, no se ejecuta)', { gastos: [{ ...bueno, desc: '"><img src=x onerror="window.__xss.push(\'MPDESC\')">' }] }, 1, 0],
      ['categoría con HTML (va a Varios)', { gastos: [{ ...bueno, category: '<img src=x onerror=window.__xss.push(1)>' }] }, 1, 0],
      ['importe 1e999', { gastos: [{ ...bueno, amount: '1e999' }, { ...bueno, amount: 'abc' }, bueno] }, 1, 2],
      ['desc objeto / vacía', { gastos: [{ ...bueno, desc: { a: 1 } }, { ...bueno, desc: '   ' }, bueno] }, 1, 2],
      ['fecha imposible', { gastos: [{ ...bueno, date: '2026-13-45' }, { ...bueno, date: '2026-02-30' }, bueno] }, 1, 2],
      ['todo válido (no avisa nada)', { gastos: [bueno, { ...bueno, desc: 'Kiosco', amount: '$ 1.200,50', date: hoy }] }, 2, 0],
    ];
    for (const [nombre, resp, quedan, descartados] of casos) {
      const d = await abrir(browser, { respuesta: resp, ls: { fin_apikey: 'sk-test' } });
      await d.ev(async () => { mpFileType = 'image'; mpFileMimeType = 'image/png'; mpFileData = 'AAAA'; await processMPWithClaude(); });
      await d.page.waitForTimeout(900);
      const r = await d.ev(() => ({
        xss: window.__xss.slice(), inj: !!document.querySelector('#mp-review-list img[src=x]'),
        items: (typeof mpReviewItems !== 'undefined' ? mpReviewItems : []).length,
        err: document.getElementById('mp-error-msg').style.display !== 'none' ? document.getElementById('mp-error-msg').textContent : '',
        toasts: window.__toasts.slice(),
      })).catch(() => null);
      const esc = await d.page.evaluate(escanear);
      L.eq(r && r.xss, [], `${nombre}: no se ejecuta nada`);
      L.is(r && !r.inj && esc.inj.length === 0 && esc.roto.length === 0, `${nombre}: no queda HTML inyectado ni handlers rotos`);
      L.eq(r && r.items, quedan, `${nombre}: la revisión muestra ${quedan} ítem(s) y el resto se descarta sin cortar el import`);
      if (descartados) L.is(r && r.toasts.some(t => new RegExp(`Descarté ${descartados} `).test(t)), `${nombre}: avisa que descartó ${descartados} (${r && r.toasts.join(' | ')})`);
      else L.is(r && !r.toasts.some(t => /Descarté/.test(t)), `${nombre}: sin descartes no hay aviso`);
      L.eq(d.errors, [], `${nombre}: sin errores de JS`);
      await d.close();
    }
    // Respuestas que no son una lista de gastos.
    for (const [nombre, resp] of [['respuesta null', 'null'], ['gastos no es lista', { gastos: { a: 1 } }], ['todo inválido', { gastos: [null, { desc: 'x', amount: 1, date: 5 }] }]]) {
      const d = await abrir(browser, { respuesta: resp, ls: { fin_apikey: 'sk-test' } });
      await d.ev(async () => { mpFileType = 'image'; mpFileMimeType = 'image/png'; mpFileData = 'AAAA'; await processMPWithClaude(); });
      await d.page.waitForTimeout(500);
      const r = await d.ev(() => ({ err: document.getElementById('mp-error-msg').textContent, visible: document.getElementById('mp-error-msg').style.display !== 'none', analizar: document.getElementById('mp-analyze-btn').style.display !== 'none' }));
      L.is(r.visible && r.analizar && r.err.length > 10, `${nombre}: error legible (“${r.err.slice(0, 90)}”) y el botón Analizar vuelve`);
      L.eq(d.errors, [], `${nombre}: sin errores de JS`);
      await d.close();
    }
    // renderMPReview escapa aunque el ítem venga armado de otra forma.
    const d = await abrir(browser);
    const r = await d.ev(() => {
      mpReviewItems = [{ desc: 'x', amount: 5, date: '2026-10-0<img src=x onerror="window.__xss.push(\'RD\')">', category: 'super', selected: true }];
      renderMPReview();
      return { img: !!document.querySelector('#mp-review-list img[src=x]'), xss: window.__xss.slice() };
    });
    L.is(!r.img && r.xss.length === 0, 'renderMPReview escapa la fecha (g.date.slice(...) iba sin esc)');
    // Lo válido se importa de punta a punta.
    const imp = await d.ev(() => { S.gastos = []; mpReviewItems = [{ desc: 'Café', amount: 100, date: '2026-10-10', category: 'comida', selected: true }]; confirmMPImport(); return S.gastos.map(g => [g.desc, g.cat, g.amount]); });
    L.eq(imp, [['Café', 'comida', 100]], 'lo válido se importa igual que antes');
    await d.close();
  });

  // ═══ B3 · Arranque con datos rotos ═════════════════════════════════════
  L.section('B3 · Arranque con fin_v6 roto: estado vacío (o saneado), el crudo se conserva y se avisa');
  await prot(async () => {
    const good = { accounts: [{ id: 'a1', name: 'Galicia', type: 'bancaria', amount: 100, currency: 'ARS' }], gastos: [{ id: 'g1', desc: 'Coto', amount: 100, cat: 'super', month: 9, year: 2026, day: 1, addedAt: 1 }], plan: [], agenda: { subs: [], vencimientos: [], cuotas: [], inversiones: [] } };
    const completo = [
      ['JSON inválido', '{"accounts":[{"id":"a1"'],
      ['null', 'null'], ['un texto', '"hola"'], ['un número', '42'], ['una lista', '[]'],
    ];
    for (const [nombre, raw] of completo) {
      const d = await abrir(browser, { ls: { fin_v6: raw } });
      await esperarAviso(d); await d.page.waitForTimeout(300);
      const r = await d.ev(() => ({
        S: typeof S === 'object' && S !== null ? { g: Array.isArray(S.gastos), a: Array.isArray(S.accounts), p: Array.isArray(S.plan), ag: !!S.agenda && Array.isArray(S.agenda.cuotas) } : String(S),
        ilegible: localStorage.getItem('fin_v6_ilegible'), toasts: window.__toasts.slice(),
        logs: (window.finLogs ? finLogs() : []).map(x => x.msg).join(' | '), rendered: document.querySelectorAll('#pg-saldos *').length,
      }));
      for (const pg of ['gastos', 'compartidos', 'agenda']) await d.ev(pg => goTo(pg), pg).catch(e => d.errors.push('goTo ' + pg + ': ' + e.message.slice(0, 80)));
      L.eq(r.S, { g: true, a: true, p: true, ag: true }, `${nombre}: la app arranca con un estado vacío válido`);
      L.eq(r.ilegible, raw, `${nombre}: el crudo queda en fin_v6_ilegible`);
      L.is(r.toasts.some(t => /No pude leer tus datos/.test(t) && /original/.test(t)), `${nombre}: avisa con claridad (${(r.toasts[0] || '').slice(0, 110)})`);
      L.is(/fin_v6/.test(r.logs), `${nombre}: queda en el registro de errores`);
      L.is(r.rendered > 20, `${nombre}: Saldos se dibuja`);
      L.eq(d.errors, [], `${nombre}: sin errores de JS al recorrer las pantallas`);
      await d.close();
    }
    // Registros inválidos adentro: se descartan SOLO esos y se dice cuántos.
    const parciales = [
      ['gastos es un objeto', { ...good, gastos: {} }, /descarté 1 registro dañado \(1 lista\)/],
      ['null dentro de gastos', { ...good, gastos: [null, good.gastos[0]] }, /descarté 1 registro dañado \(1 gasto\)/],
      ['accounts es un texto', { ...good, accounts: 'x' }, /descarté 1 registro dañado \(1 lista\)/],
      ['null dentro de accounts', { ...good, accounts: [null, good.accounts[0]] }, /descarté 1 registro dañado \(1 cuenta\)/],
      ['cuenta sin nombre', { ...good, accounts: [{ id: 'a', amount: 3 }] }, /corregí 1 \(1 texto\)/],
      ['plan es un objeto', { ...good, plan: {} }, /1 lista/],
      ['null dentro del plan', { ...good, plan: [null] }, /descarté 1 registro dañado \(1 concepto del Plan\)/],
      ['agenda con textos y null', { ...good, agenda: { subs: 'x', vencimientos: [null], cuotas: [null], inversiones: [null] } }, /descarté 4 registros dañados \(1 lista, 3 ítems de la Agenda\)/],
      ['agenda es una lista', { ...good, agenda: [] }, /corregí 1 \(1 campo\)/],
      ['paymentMemory es un texto', { ...good, paymentMemory: 'x' }, null],
      ['gasto sin fecha ni addedAt', { ...good, gastos: [{ id: 'g2', desc: 'x', amount: 5, cat: 'super' }] }, /descarté 1 registro dañado \(1 gasto\)/],
      ['importe, categoría y pagador inválidos', { ...good, gastos: [{ id: 'g2', desc: 'x', amount: 'abc', cat: 'zzz', month: 9, year: 2026, day: 1, shared: { active: true, paidBy: 'otro', splitPct: 50 } }] }, /corregí 2 \(1 categoría, 1 campo\)/],
    ];
    for (const [nombre, obj, aviso] of parciales) {
      const d = await abrir(browser, { ls: { fin_v6: JSON.stringify(obj) } });
      await (aviso ? esperarAviso(d) : d.page.waitForTimeout(1500)); await d.page.waitForTimeout(300);
      const r = await d.ev(() => ({
        ok: Array.isArray(S.accounts) && Array.isArray(S.gastos) && Array.isArray(S.plan) && !!S.agenda && ['subs', 'vencimientos', 'cuotas', 'inversiones'].every(k => Array.isArray(S.agenda[k])) && typeof S.paymentMemory === 'object' && !Array.isArray(S.paymentMemory),
        sinNulos: [S.accounts, S.gastos, S.plan, ...Object.values(S.agenda).filter(Array.isArray)].every(a => a.every(x => x && typeof x === 'object')),
        toasts: window.__toasts.slice(), logs: (window.finLogs ? finLogs() : []).filter(x => x.cat === 'datos').length,
        guardado: JSON.parse(localStorage.getItem('fin_v6') || 'null'),
      }));
      for (const pg of ['gastos', 'compartidos', 'agenda', 'saldos']) await d.ev(pg => goTo(pg), pg).catch(e => d.errors.push('goTo ' + pg + ': ' + e.message.slice(0, 80)));
      L.is(r.ok && r.sinNulos, `${nombre}: la app arranca con listas y objetos válidos`);
      if (aviso) {
        L.is(r.toasts.filter(t => /Revisé los datos/.test(t)).length === 1 && aviso.test(r.toasts.join(' | ')), `${nombre}: UN aviso con el conteo (${(r.toasts.find(t => /Revisé/.test(t)) || 'ninguno').slice(0, 130)})`);
        L.is(r.logs >= 2, `${nombre}: el detalle queda en el log de errores`);
      }
      L.is(r.guardado && Array.isArray(r.guardado.gastos), `${nombre}: lo guardado ya es válido`);
      L.eq(d.errors, [], `${nombre}: sin errores de JS`);
      await d.close();
    }
    // Lo descartado no se pierde del todo: el crudo queda aparte.
    {
      const raw = JSON.stringify({ ...good, accounts: [null, good.accounts[0]] });
      const d = await abrir(browser, { ls: { fin_v6: raw } });
      await d.page.waitForTimeout(800);
      L.eq(await d.ev(() => localStorage.getItem('fin_v6_ilegible')), raw, 'cuando se descarta algo, el crudo original queda en fin_v6_ilegible');
      await d.close();
    }
    // Un estado válido no se toca: sin aviso, sin crudo aparte, sin entradas en el log.
    {
      const d = await abrir(browser, { ls: { fin_v6: JSON.stringify(good) } });
      await d.page.waitForTimeout(1500);
      const r = await d.ev(() => ({ toasts: window.__toasts.slice(), ilegible: localStorage.getItem('fin_v6_ilegible'), logs: finLogs().filter(x => x.cat === 'datos').length, g: S.gastos.map(x => x.id), a: S.accounts.map(x => x.id) }));
      L.eq(r, { toasts: [], ilegible: null, logs: 0, g: ['g1'], a: ['a1'] }, 'un estado válido arranca igual que siempre, sin ningún aviso');
      await d.close();
    }
  });

  // ═══ B2 · id / cat / paidBy con payloads de XSS ════════════════════════
  L.section('B2 · ids con comillas (fin_v6 guardado): 0 XSS, 0 botones rotos recorriendo todo lo clickeable');
  const PAYLOADS = [
    ['comilla simple', `x');window.__xss.push('SQ');//`],
    ['comilla doble + img', `x"><img src=x onerror=window.__xss.push('IMG')>`],
    ['barra invertida', `x\\');window.__xss.push('BS');//`],
  ];
  await prot(async () => { for (const [nombre, P] of PAYLOADS) {
    const d = await abrir(browser, { ls: { fin_v6: JSON.stringify(estadoEvil(P)), fin_my_name: 'fede', fin_comp_bin_id: 'binX', fin_comp_api_key: 'k',
      fin_funds: JSON.stringify([{ id: 'f1' + P, name: 'Fondo', budget: 1000, currency: 'ARS' }]),
      fin_shared_payments: JSON.stringify([{ id: 'sp1' + P, amount: 100, from: 'fede', to: 'mile', date: Date.now(), note: 'x', ts: Date.now() }]) } });
    await esperarAviso(d); await d.page.waitForTimeout(300);
    const est = await d.ev(() => ({
      ids: [...S.accounts, ...S.gastos, ...S.plan, ...S.agenda.subs, ...S.agenda.vencimientos, ...S.agenda.cuotas, ...S.agenda.inversiones].map(x => x.id),
      cats: S.gastos.map(g => g.cat), pagan: S.gastos.filter(g => g.shared).map(g => g.shared.paidBy), tops: S.gastos.map(g => g.paidBy).filter(x => x !== undefined),
      planCat: S.plan.map(p => p.cat), acc: S.gastos[0].account, accId: S.accounts[0].id, toasts: window.__toasts.slice(),
      ventana: [...document.querySelectorAll('[onclick]')].length,
    }));
    L.is(est.ids.length >= 15 && est.ids.every(i => IDS_OK.test(i)), `${nombre}: todos los id (${est.ids.length}) quedan en /^[\\w-]{1,64}$/ (${est.ids.filter(i => !IDS_OK.test(i)).length} inválidos)`);
    L.is(new Set(est.ids).size === est.ids.length, `${nombre}: sin id repetidos`);
    L.eq(est.acc, est.accId, `${nombre}: la referencia gasto → cuenta sigue apuntando a la cuenta (id regenerado)`);
    L.is(est.cats.every(c => c === 'varios' || (CATS_OK.includes(c))), `${nombre}: las categorías quedan conocidas (${est.cats.join(',')})`);
    L.is(est.pagan.every(p => p === 'fede' || p === 'mile') && est.tops.every(p => p === 'fede' || p === 'mile'), `${nombre}: paidBy solo fede/mile`);
    L.is(est.planCat.every(c => /^\w{1,64}$/.test(c)), `${nombre}: la categoría del Plan es segura`);
    L.is(est.toasts.filter(t => /Revisé los datos/.test(t)).length === 1, `${nombre}: UN aviso (${(est.toasts.find(t => /Revisé/.test(t)) || 'ninguno').slice(0, 120)})`);
    const rec = await recorrer(d.page);
    const xss = await d.ev(() => [...new Set(window.__xss)]);
    L.eq(xss, [], `${nombre}: no se ejecutó nada (${rec.clics} clics)`);
    L.eq(rec.inyectados, [], `${nombre}: ningún atributo ni <img> inyectado`);
    L.eq(rec.rotos, [], `${nombre}: 0 botones con handler roto`);
    L.eq(d.errors, [], `${nombre}: sin errores de JS`);
    await d.close();
  } });

  // Otros campos de texto de un fin_v6 ajeno (barrido de xss4).
  L.section('B2 · cat, paidBy, tipo, período, fechas y claves con payloads (barrido de campos)');
  await prot(async () => {
    const P = `x');window.__xss.push('F');//`, H = `"><img src=x onerror=window.__xss.push('H')>`;
    const campos = {
      'gasto.cat': (s, p) => { s.gastos[0].cat = p; }, 'gasto.shared.paidBy': (s, p) => { s.gastos[1].shared.paidBy = p; },
      'gasto.paidBy': (s, p) => { s.gastos[1].paidBy = p; }, 'gasto.amount': (s, p) => { s.gastos[0].amount = p; },
      'gasto.month/day': (s, p) => { s.gastos[0].day = p; s.gastos[0].month = p; }, 'cuenta.type': (s, p) => { s.accounts[0].type = p; },
      'cuenta.currency': (s, p) => { s.accounts[0].currency = p; }, 'cuenta.bankKey': (s, p) => { s.accounts[0].bankKey = p; },
      'cuenta.amount': (s, p) => { s.accounts[0].amount = p; }, 'plan.cat': (s, p) => { s.plan[1].cat = p; },
      'plan.months clave': (s, p) => { s.plan[1].months = { [p]: 1000 }; }, 'agenda.sub.period': (s, p) => { s.agenda.subs[0].period = p; },
      'agenda.sub.date': (s, p) => { s.agenda.subs[0].date = p; }, 'agenda.venc.shared.paidBy': (s, p) => { s.agenda.vencimientos[0].shared.paidBy = p; },
      'agenda.cuota.startDate': (s, p) => { s.agenda.cuotas[0].startDate = p; }, 'agenda.inv.date': (s, p) => { s.agenda.inversiones[0].date = p; },
      'tc': (s, p) => { s.tc = p; },
    };
    const malos = [];
    for (const [campo, fn] of Object.entries(campos)) for (const [pn, pay] of [['sq', P], ['html', H]]) {
      const s = estadoEvil(''); try { fn(s, pay); } catch (e) { continue; }
      const d = await abrir(browser, { ls: { fin_v6: JSON.stringify(s), fin_my_name: 'fede' } });
      await d.page.waitForTimeout(500);
      for (const pg of PAGINAS) await d.ev(pg => { try { goTo(pg); } catch (e) { window.__ge = (window.__ge || '') + pg + ':' + e.message; } }, pg);
      for (const t of ['tarjetas', 'plan', 'agenda']) await d.ev(t => { try { switchAgendaTab(t); } catch (e) {} }, t);
      const r = await d.ev(() => ({ xss: window.__xss.slice(), ge: window.__ge || '' })).catch(() => null);
      const esc = await d.page.evaluate(escanear);
      const e = d.errors.filter(x => !/vibrate/.test(x));
      if (esc.roto.length || esc.inj.length || (r && (r.xss.length || r.ge)) || e.length) malos.push(`${campo}/${pn}: ${JSON.stringify({ roto: esc.roto.length, inj: esc.inj.length, ge: r && r.ge })} ${e[0] || ''}`);
      await d.close();
    }
    L.eq(malos, [], `los ${Object.keys(campos).length * 2} casos de campos con payload no rompen nada ni ejecutan nada`);
  });

  // ═══ B2 · Bin personal (applyPayload) ══════════════════════════════════
  L.section('B2 · Bin personal: applyPayload sanea lo que baja de la nube');
  await prot(async () => {
    const d = await abrir(browser, { ls: { fin_my_name: 'fede' } });
    const P = `x');window.__xss.push('SQ');//`;
    const r = await d.ev(({ nube }) => {
      applyPayload({ _syncTs: Date.now(), fin_v6: JSON.stringify(nube), fin_funds: JSON.stringify([{ id: 'f' + nube.accounts[0].id, name: 'F', budget: 1 }, null]) });
      return {
        ids: [...S.accounts, ...S.gastos, ...S.plan, ...S.agenda.subs, ...S.agenda.vencimientos, ...S.agenda.cuotas, ...S.agenda.inversiones].map(x => x.id),
        guardado: JSON.parse(localStorage.getItem('fin_v6')).gastos.map(g => g.id), fondos: JSON.parse(localStorage.getItem('fin_funds')).map(f => f.id),
        toasts: window.__toasts.slice(),
      };
    }, { nube: estadoEvil(P) });
    await esperarAviso(d, 'Revisé los datos que bajaron'); await d.page.waitForTimeout(200);
    const toasts = await d.ev(() => window.__toasts.slice());
    L.is(r.ids.length >= 15 && r.ids.every(i => IDS_OK.test(i)), 'applyPayload: ids de la nube saneados en S');
    L.is(r.guardado.every(i => IDS_OK.test(i)) && r.fondos.every(i => IDS_OK.test(i)), 'y en lo guardado (gastos y fondos)');
    L.is(toasts.filter(t => /Revisé los datos que bajaron de la nube/.test(t)).length === 1, `un solo aviso (${(toasts.find(t => /nube/.test(t)) || 'ninguno').slice(0, 130)})`);
    const rec = await recorrer(d.page, 30);
    L.eq([await d.ev(() => window.__xss.slice()), rec.rotos, rec.inyectados], [[], [], []], `recorriendo todo (${rec.clics} clics): 0 XSS y 0 botones rotos`);
    // Una nube que no es un objeto no toca lo que hay.
    const antes = await d.ev(() => localStorage.getItem('fin_v6'));
    await d.ev(() => { window.__toasts.length = 0; try { applyPayload({ _syncTs: Date.now(), fin_v6: 'null' }); } catch (e) {} try { applyPayload({ _syncTs: Date.now(), fin_v6: '42' }); } catch (e) {} });
    await esperarAviso(d, 'nube no tiene el formato'); await d.page.waitForTimeout(200);
    L.eq(await d.ev(() => localStorage.getItem('fin_v6')), antes, 'fin_v6 = null/número en la nube no pisa lo local');
    L.is((await d.ev(() => window.__toasts.slice())).some(t => /nube no tiene el formato/.test(t)), 'y avisa');
    L.eq(d.errors, [], 'sin errores de JS');
    await d.close();
  });

  // ═══ B2 · Backup ═══════════════════════════════════════════════════════
  L.section('B2 · Backup: validarBackup / fusionarBackup / importBackup sanean y avisan');
  await prot(async () => {
    const d = await abrir(browser, { ls: { fin_my_name: 'fede' } });
    const P = `x"><img src=x onerror=window.__xss.push('IMG')>`;
    const ev = estadoEvil(P);
    ev.accounts.push(null); ev.gastos.push(42);
    const data = {
      fin_v6: JSON.stringify(ev), fin_my_name: 'fede',
      fin_funds: JSON.stringify([{ id: 'f' + P, name: 'F', budget: 1 }]),
      fin_shared_payments: JSON.stringify([{ id: 'p' + P, amount: 'abc', paidBy: P, from: 'fede', to: 'mile', date: 1 }]),
      fin_gastos_archive: JSON.stringify([{ id: 'ar' + P, desc: 'viejo', cat: P, amount: 5, month: 1, year: 2024, day: 1, addedAt: 1 }]),
    };
    const r = await d.ev(data => {
      const datos = validarBackup(data);
      const bak = JSON.parse(datos.fin_v6);
      const v = { keys: Object.keys(datos), saneo: datos._saneo && { nD: datos._saneo.nD, nC: datos._saneo.nC }, texto: textoSaneo(datos._saneo),
        ids: [...bak.accounts, ...bak.gastos, ...bak.plan, ...bak.agenda.subs].map(x => x.id),
        fondos: JSON.parse(datos.fin_funds).map(x => x.id), pagos: JSON.parse(datos.fin_shared_payments).map(x => [x.id, x.amount, x.paidBy]),
        arch: JSON.parse(datos.fin_gastos_archive).map(x => [x.id, x.cat]) };
      S.gastos = []; S.accounts = [];
      fusionarBackup(datos, bak);
      v.trasFusion = [...S.accounts, ...S.gastos, ...S.plan, ...S.agenda.subs, ...S.agenda.vencimientos, ...S.agenda.cuotas, ...S.agenda.inversiones].map(x => x.id);
      return v;
    }, data);
    L.is(r.saneo && r.saneo.nD === 2 && r.saneo.nC >= 10, `validarBackup cuenta lo descartado (2) y lo corregido (${r.saneo && r.saneo.nC}): ${r.texto}`);
    L.is(!r.keys.includes('_saneo'), 'el conteo no es una clave más del backup (importBackup escribe todas las de datos)');
    L.is(r.ids.every(i => IDS_OK.test(i)) && r.fondos.every(i => IDS_OK.test(i)) && r.pagos.every(p => IDS_OK.test(p[0])) && r.arch.every(a => IDS_OK.test(a[0])), 'ids de gastos, cuentas, Plan, Agenda, fondos, transferencias y archivo saneados');
    L.is(r.pagos.every(p => Number.isFinite(p[1]) && (p[2] === 'fede' || p[2] === 'mile')) && r.arch.every(a => a[1] === 'varios'), 'importe, pagador y categoría del archivo, forzados a valores válidos');
    L.is(r.trasFusion.length >= 15 && r.trasFusion.every(i => IDS_OK.test(i)), 'y "Fusionar" deja el estado vivo con ids válidos');
    const rec = await recorrer(d.page, 30);
    L.eq([await d.ev(() => window.__xss.slice()), rec.rotos, rec.inyectados], [[], [], []], `tras fusionar, recorriendo todo (${rec.clics} clics): 0 XSS y 0 botones rotos`);
    // Por el flujo real: el cuadro de confirmación dice qué se descarta.
    await d.ev(({ backup }) => {
      const f = new File([JSON.stringify(backup)], 'b.json', { type: 'application/json' });
      importBackup({ files: [f], value: '' });
    }, { backup: { _exportTs: Date.now(), _version: 'x', data } });
    await d.page.waitForFunction(() => document.getElementById('ov-confirm').classList.contains('open'), null, { timeout: 5000 }).catch(() => {});
    const cuerpo = await d.ev(() => document.getElementById('confirm-msg').textContent);
    L.is(/descarté 2 registros dañados/.test(cuerpo) && /corregí/.test(cuerpo), `importBackup lo dice antes de elegir (“${cuerpo.slice(100, 260)}…”)`);
    await d.ev(() => confirmResolve(false)); await d.page.waitForTimeout(500); await d.ev(() => confirmResolve(false)); await d.page.waitForTimeout(300);
    // Un backup sano pasa byte a byte igual y sin aviso.
    const sano = { fin_v6: JSON.stringify({ accounts: [{ id: 'a1', name: 'G', type: 'bancaria', amount: 5, currency: 'ARS' }], gastos: [{ id: 'g1', desc: 'x', cat: 'super', amount: 5, month: 1, year: 2026, day: 2 }], plan: [], agenda: { subs: [], vencimientos: [], cuotas: [], inversiones: [] } }), fin_funds: '[{"id":"f1","name":"F","budget":1}]' };
    const r2 = await d.ev(sano => { const x = validarBackup(sano); return { igual: x.fin_v6 === sano.fin_v6 && x.fin_funds === sano.fin_funds, n: x._saneo.nD + x._saneo.nC }; }, sano);
    L.eq(r2, { igual: true, n: 0 }, 'un backup sano sale idéntico y sin conteo');
    L.eq(d.errors, [], 'sin errores de JS');
    await d.close();
  });

  // ═══ Sanear no toca datos válidos ══════════════════════════════════════
  L.section('Sanear es idempotente y no cambia datos válidos (estados grandes)');
  await prot(async () => {
    // Un estado grande y variado hecho a mano (todas las formas que tiene la app).
    const cats = ['comida', 'transporte', 'salidas', 'hogar', 'depto', 'super', 'regalos', 'oficina', 'suscripciones', 'compras', 'tarjeta', 'varios', 'custom_mascotas_ab12'];
    const gastos = [];
    for (let i = 0; i < 6000; i++) {
      const m = i % 36, y = 2024 + Math.floor(m / 12), mes = m % 12;
      const g = { id: 'g' + i.toString(36), desc: 'Gasto ' + i, cat: cats[i % cats.length], amount: (i * 37) % 90000 + (i % 7 ? 0 : 0.5), month: mes, year: y, day: 1 + (i % 28), addedAt: Date.UTC(y, mes, 1 + (i % 28), 15) };
      if (i % 5 === 0) g.shared = { active: true, paidBy: i % 2 ? 'fede' : 'mile', splitPct: [50, 70, 0, 100][i % 4] };
      if (i % 11 === 0) { g.cat = 'tarjeta'; g.cuotaActual = 1 + (i % 6); g.cuotaTotal = 6; }
      if (i % 13 === 0) g.weeklyBudget = true;
      if (i % 17 === 0) g.updatedAt = g.addedAt + 5;
      if (i % 19 === 0) g.account = 'acc1';
      gastos.push(g);
    }
    const grande = {
      tc: 1450.5, accounts: [{ id: 'acc1', name: 'Galicia', type: 'bancaria', amount: 1234567.89, currency: 'ARS', bankKey: 'Galicia', updatedAt: 5 }, { id: 'acc2', name: 'Cocos', type: 'inversión', amount: 1200.5, currency: 'USD' }],
      gastos, paymentMemory: { Luz: 5000 }, _deletedGastoIds: ['gx1', 'gx2'], _gTombs: { gx1: 5 }, _pTombs: {},
      plan: Array.from({ length: 40 }, (_, i) => ({ id: 'p' + i, name: 'Concepto ' + i, cat: i % 4 === 0 ? 'ingreso' : i % 4 === 1 ? 'suscripciones' : i % 4 === 2 ? 'tarjeta' : 'gasto', months: { '2026-10': i * 100, '2026-11': i * 100, '3': 5 }, order: i, updatedAt: 9, rep: { n: 1, amt: 5, until: '2027-06' } })),
      planBorrados: [{ id: 'pb1', at: 1 }], agendaBorrados: [{ id: 'ab1', at: 1 }],
      agenda: {
        subs: Array.from({ length: 12 }, (_, i) => ({ id: 's' + i, name: 'Sub ' + i, amount: 1000 + i, date: '2026-11-05', dueDay: 5, period: 'mensual', everyN: 1 })),
        vencimientos: Array.from({ length: 8 }, (_, i) => ({ id: 'v' + i, name: 'Venc ' + i, amount: 900 + i, date: '2026-12-10', dueDay: 10, period: 'unico', shared: { active: true, paidBy: 'mile', splitPct: 50 } })),
        cuotas: Array.from({ length: 10 }, (_, i) => ({ id: 'c' + i, createdAt: 5, name: 'Compra ' + i, fee: 5000, total: 12, paid: i, startDate: '2026-01-05', nextDueDate: '2026-11-05', dueDay: 5 })),
        inversiones: [{ id: 'i1', name: 'Plazo fijo', amount: 100000, date: '2026-12-01' }], cuotasBorradas: [{ name: 'x', at: 1 }],
      },
    };
    const d = await abrir(browser);
    const r = await d.ev(grande => {
      const a = JSON.parse(JSON.stringify(grande)), rep = sanearEstado(a);
      const mala = JSON.parse(JSON.stringify(grande));
      mala.gastos[3].id = "x');alert(1);//"; mala.gastos[7] = null; mala.accounts[0].id = '<b>'; mala.plan[2].cat = 'a"b'; mala.agenda.subs[1] = 5;
      mala.gastos[9].cat = 'zzz'; mala.gastos[10].shared = { active: true, paidBy: 'otro', splitPct: 50 }; mala.gastos[11].amount = 'abc';
      const r1 = sanearEstado(mala), copia = JSON.stringify(mala), r2 = sanearEstado(mala);
      return { sinCambios: JSON.stringify(a) === JSON.stringify(grande), n: rep.nD + rep.nC, r1: [r1.nD, r1.nC], r2: [r2.nD, r2.nC], estable: JSON.stringify(mala) === copia,
        };
    }, grande);
    L.eq(r.sinCambios && r.n === 0, true, `un estado válido de ${grande.gastos.length} gastos no cambia ni un byte ni cuenta nada`);
    L.is(r.r1[0] === 2 && r.r1[1] === 6, `el estado con 8 defectos cuenta ${r.r1[0]} descartados y ${r.r1[1]} corregidos`);
    L.eq([r.r2, r.estable], [[0, 0], true], 'sanear dos veces es lo mismo que una (idempotente)');
    // Arrancar con ese estado grande: sin aviso y sin tocarlo.
    const d2 = await abrir(browser, { ls: { fin_v6: JSON.stringify(grande) } });
    await d2.page.waitForTimeout(1500);
    const g2 = await d2.ev(() => ({ toasts: window.__toasts.filter(t => /Revisé|No pude/.test(t)), ilegible: localStorage.getItem('fin_v6_ilegible'), logs: finLogs().filter(x => x.cat === 'datos').length, n: S.gastos.length, ids: S.gastos.slice(0, 50).map(g => g.id) }));
    L.eq([g2.toasts, g2.ilegible, g2.logs, g2.n, g2.ids.join()], [[], null, 0, grande.gastos.length, grande.gastos.slice(0, 50).map(g => g.id).join()], 'al abrir la app con él: ningún aviso, ids iguales y ni un gasto menos');
    L.eq(d2.errors, [], 'sin errores de JS');
    await d2.close();
    await d.close();

    // Estados reales de las simulaciones (a13 deja un backup; a19 se puede volcar con A38_ESTADO).
    const bkPath = process.env.A38_BACKUP || path.join(os.tmpdir(), 'a13-backup.json');
    const reales = [];
    if (fs.existsSync(bkPath)) { try { const bk = JSON.parse(fs.readFileSync(bkPath, 'utf8')); reales.push(['backup de a13 (' + path.basename(bkPath) + ')', bk.data.fin_v6, bk.data]); } catch (e) { console.log('   · no pude leer', bkPath, e.message); } }
    if (process.env.A38_ESTADO && fs.existsSync(process.env.A38_ESTADO)) reales.push(['estado real (' + path.basename(process.env.A38_ESTADO) + ')', fs.readFileSync(process.env.A38_ESTADO, 'utf8'), null]);
    if (!reales.length) console.log('   · sin backup real a mano (corré a13 o pasá A38_BACKUP/A38_ESTADO): se comprobó solo el estado hecho a mano');
    for (const [nombre, raw, data] of reales) {
      const dd = await abrir(browser);
      const rr = await dd.ev(({ raw, data }) => {
        const o = JSON.parse(raw), rep = sanearEstado(o);
        const out = { gastos: (o.gastos || []).length, cambios: rep.nD + rep.nC, igual: JSON.stringify(o) === JSON.stringify(JSON.parse(raw)), det: rep.det.slice(0, 4) };
        if (data) { const v = validarBackup(data); out.backupIgual = Object.keys(data).every(k => !(k in v) || v[k] === data[k]); out.conteo = v._saneo.nD + v._saneo.nC; }
        return out;
      }, { raw, data });
      L.is(rr.cambios === 0 && rr.igual, `${nombre}: sanear no cambia nada en ${rr.gastos} gastos (${rr.cambios} cambios ${JSON.stringify(rr.det)})`);
      if (data) L.is(rr.backupIgual && rr.conteo === 0, `${nombre}: validarBackup devuelve cada clave idéntica y sin conteo`);
      await dd.close();
    }
  });

  await browser.close();
  console.log(`\n${'─'.repeat(52)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error('ERROR:', e); process.exit(2); });
