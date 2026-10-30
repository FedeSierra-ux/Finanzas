// PWA, service worker y repo (auditoría v34.27, B5 B6 B7 B9 B11 B12 B13 B15).
// La app se sirve por http en /Finanzas/ (con file:// no hay service worker),
// con Cache-Control: max-age=600 como GitHub Pages, y un servidor que se puede
// "caer" (corta las conexiones) o "colgar" (acepta y no contesta, el lie-fi).
//   B5  "Buscar actualización" sin red no borra caches ni desregistra el SW
//   B6  con el servidor colgado la app instalada abre igual (timeout + cache)
//   B13 el shell no sale del cache HTTP; las fuentes de Google (respuestas
//       opacas) quedan en el cache del SW para abrir sin red
//   B9  SheetJS 0.20.3 autoalojado y precacheado: importar Excel sin red
//   B15 push con cuerpo que no es JSON y notificationclick con data.url
//   B12 código muerto fuera;  B11 tests.js sin helpers copiados
// AUDIT_APP=/ruta/al/index.html audita otra copia (con la v34.27 casi todo ✗).
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm');
const L = require('./lib.js');
const REPO = path.dirname(L.APP_FILE);
const { ok: _ok, bad: _bad, section } = L;
let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (!c && extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); };

// ── Servidor ────────────────────────────────────────────────────────────────
const state = { down: false, hang: false, hangVersion: false, version: null, hits: [] };
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  state.hits.push(u.pathname);
  if (state.down) return req.socket.destroy();
  if (state.hang || (state.hangVersion && u.pathname.endsWith('version.json'))) return; // nunca contesta
  let p = decodeURIComponent(u.pathname);
  if (!p.startsWith('/Finanzas/')) { res.writeHead(404); return res.end(); }
  p = p.slice('/Finanzas/'.length) || 'index.html';
  const f = path.join(REPO, p);
  if (!fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(f);
  if (state.version && p === 'index.html') body = Buffer.from(body.toString().replace(/const APP_VERSION='[^']+'/, `const APP_VERSION='${state.version}'`));
  if (state.version && p === 'version.json') body = Buffer.from(JSON.stringify({ version: state.version }));
  const ct = p.endsWith('.js') ? 'application/javascript' : p.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8';
  res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': 'max-age=600' }); res.end(body);
});

const FONT_CSS = '@font-face{font-family:"X";src:url(https://fonts.gstatic.com/s/x.woff2)}';
async function newPage(browser, { fonts = false, route = true } = {}) {
  const ctx = await browser.newContext();
  // Con ctx.route Playwright apaga el cache HTTP: el test del shell contra
  // max-age=600 (B13) corre sin interceptar nada y con las APIs externas en {}.
  if (!route) await ctx.addInitScript(() => { const f = window.fetch; window.fetch = (u, o) => /jsonbin|dolarapi|bluelytics/.test(String(u && u.url ? u.url : u)) ? Promise.resolve(new Response('{}')) : f(u, o); });
  // Nada sale de la máquina: las APIs externas contestan vacío y las fuentes
  // se fingen (ctx.route también intercepta lo que pide el service worker).
  if (route) await ctx.route(u => !/^(http:\/\/localhost|data:|blob:)/.test(u.href), r => {
    const u = r.request().url();
    if (/fonts\.googleapis\.com/.test(u)) return fonts ? r.fulfill({ status: 200, contentType: 'text/css', body: FONT_CSS }) : r.abort();
    if (/fonts\.gstatic\.com/.test(u)) return r.fulfill({ status: 200, contentType: 'font/woff2', body: '', headers: { 'access-control-allow-origin': '*' } });
    if (/jsonbin|dolarapi|bluelytics/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    return r.abort();
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  return { ctx, page, errs };
}
const cacheDump = page => page.evaluate(async () => {
  const o = {};
  for (const k of await caches.keys()) { const c = await caches.open(k); o[k] = (await c.keys()).map(r => { const u = new URL(r.url); return u.host.startsWith('localhost') ? u.pathname + u.search : u.href; }); }
  return o;
}).catch(() => null);
const swRegs = page => page.evaluate(() => navigator.serviceWorker.getRegistrations().then(r => r.length)).catch(() => -1);
async function instalada(page, URL) {
  await page.goto(URL);
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
  await page.waitForTimeout(1500);
}

// ── Service worker en un sandbox (push y notificationclick) ─────────────────
function cargarSW() {
  const ls = {}, shown = [], opened = [], waits = [];
  const sb = {
    URL, console, Promise, Date, setTimeout, clearTimeout, indexedDB: {}, caches: { open: () => Promise.reject(new Error('x')), match: () => Promise.resolve(undefined), keys: () => Promise.resolve([]) },
    fetch: () => Promise.reject(new Error('x')), AbortController,
    clients: { list: [], matchAll() { return Promise.resolve(this.list); }, openWindow(u) { opened.push(u); return Promise.resolve(); }, claim() { return Promise.resolve(); } },
  };
  sb.self = sb;
  sb.location = { href: 'http://localhost/Finanzas/sw.js?v=1', origin: 'http://localhost' };
  sb.registration = { scope: 'http://localhost/Finanzas/', showNotification: (t, o) => { shown.push({ t, o }); return Promise.resolve(); } };
  sb.addEventListener = (n, f) => { ls[n] = f; };
  sb.skipWaiting = () => {};
  vm.runInNewContext(fs.readFileSync(path.join(REPO, 'sw.js'), 'utf8'), sb);
  const ev = extra => Object.assign({ waitUntil: p => waits.push(p), respondWith: p => waits.push(p) }, extra);
  return { sb, ls, shown, opened, waits, ev, settle: () => Promise.allSettled(waits.splice(0)) };
}
function cliente(url) {
  const c = { url, focused: 0, navigated: [], focus() { this.focused++; return Promise.resolve(this); }, navigate(u) { this.navigated.push(u); this.url = u; return Promise.resolve(this); } };
  return c;
}

srv.listen(0, async () => {
  const URL = `http://localhost:${srv.address().port}/Finanzas/`;
  const browser = await L.launch();

  // ── B5 ────────────────────────────────────────────────────────────────────
  section('B5 — "Buscar actualización" sin red no rompe la app instalada');
  {
    const { ctx, page, errs } = await newPage(browser);
    await instalada(page, URL);
    const antes = await cacheDump(page);
    ok(Object.keys(antes || {}).length > 0 && (await swRegs(page)) === 1, 'punto de partida: SW registrado y con cache');
    state.down = true;
    await page.evaluate(() => checkForUpdate()).catch(() => {});
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => (document.getElementById('update-check-status') || {}).textContent || '').catch(() => '(página sin app)');
    ok((await swRegs(page)) === 1, 'sin red: el SW sigue registrado');
    const desp = await cacheDump(page);
    ok(!!desp && JSON.stringify(Object.keys(desp).sort()) === JSON.stringify(Object.keys(antes).sort()) && desp[Object.keys(antes).find(k => /^finanzas-v/.test(k))].length > 0, 'sin red: los caches siguen ahí', desp);
    ok(/sin conexi|red|internet/i.test(st) && !/Actualizando/.test(st), 'y el estado avisa que no hay conexión', st);
    await page.waitForTimeout(1200);
    await page.goto(URL).catch(() => {});
    ok(await page.evaluate(() => typeof S !== 'undefined' && Array.isArray(S.gastos)).catch(() => false), 'después, abrir la app sin red anda (antes quedaba sin SW ni cache)');
    state.down = false;
    ok(errs.length === 0, 'sin errores de JS', errs);
    await ctx.close();
  }
  {
    // con version.json colgado (lie-fi) también se aborta, por timeout
    const { ctx, page } = await newPage(browser);
    await instalada(page, URL);
    state.hangVersion = true;
    const t0 = Date.now();
    await page.evaluate(() => { window.checkForUpdate(); }).catch(() => {});
    await page.waitForFunction(() => !/Buscando/.test((document.getElementById('update-check-status') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
    ok(Date.now() - t0 < 12000 && (await swRegs(page)) === 1 && Object.keys((await cacheDump(page)) || {}).length > 0, `con version.json colgado corta por timeout (${Date.now() - t0} ms) y no borra nada`);
    state.hangVersion = false;
    await ctx.close();
  }
  {
    // con red anda como siempre: limpia, recarga una vez y queda con SW
    const { ctx, page, errs } = await newPage(browser);
    await instalada(page, URL);
    let navs = 0; page.on('framenavigated', f => { if (f === page.mainFrame()) navs++; });
    await page.evaluate(() => checkForUpdate()).catch(() => {});
    await page.waitForTimeout(5000);
    ok(navs === 1 && (await page.evaluate(() => !!navigator.serviceWorker.controller).catch(() => false)) && (await swRegs(page)) === 1, `con red: recarga una vez y queda el SW (navegaciones=${navs})`);
    ok(errs.length === 0, 'sin errores de JS', errs);
    await ctx.close();
  }

  // ── B6 ────────────────────────────────────────────────────────────────────
  section('B6 — servidor colgado y sin red: la app instalada abre');
  {
    const { ctx, page, errs } = await newPage(browser);
    await instalada(page, URL);
    state.down = true;
    for (const [u, nombre] of [[URL, 'raíz'], [URL + 'index.html', 'index.html'], [URL + '?action=new-gasto', '?action=new-gasto']]) {
      await page.goto(u).catch(() => {});
      ok(await page.evaluate(() => typeof S !== 'undefined' && Array.isArray(S.gastos)).catch(() => false), `sin red total abre ${nombre}`);
    }
    state.down = false; state.hang = true;
    for (const u of [URL, URL + '?action=new-gasto']) {
      const t0 = Date.now();
      const r = await page.goto(u, { timeout: 20000, waitUntil: 'domcontentloaded' }).then(() => 'ok', e => 'TIMEOUT');
      const ms = Date.now() - t0;
      ok(r === 'ok' && ms < 8000 && await page.evaluate(() => typeof S !== 'undefined' && Array.isArray(S.gastos)).catch(() => false), `con el servidor colgado abre del cache en ${ms} ms (${u.replace(URL, './')})`, r);
    }
    state.hang = false;
    ok(errs.length === 0, 'sin errores de JS', errs);
    await ctx.close();
    // sin cache (primera visita) con el servidor lento no se aborta: espera la respuesta
    // (se prueba el camino con cache vacío en el sandbox más abajo)
  }

  // ── B13 ───────────────────────────────────────────────────────────────────
  section('B13 — el shell no sale del cache HTTP; fuentes de Google sin red');
  {
    const { ctx, page, errs } = await newPage(browser, { route: false });
    state.version = null;
    await instalada(page, URL);
    const v0 = await page.evaluate(() => APP_VERSION);
    state.version = '99.1'; state.hits.length = 0;
    await page.goto(URL); await page.waitForTimeout(800);
    ok((await page.evaluate(() => APP_VERSION)) === '99.1', `un deploy nuevo se ve al abrir aunque el servidor diga max-age=600 (${v0} → ${await page.evaluate(() => APP_VERSION)})`);
    ok(state.hits.some(h => h === '/Finanzas/' || h === '/Finanzas/index.html'), 'el pedido del shell llegó al servidor (no salió del cache HTTP)');
    state.version = null;
    ok(errs.length === 0, 'sin errores de JS', errs);
    await ctx.close();
  }
  {
    const { ctx, page, errs } = await newPage(browser, { fonts: true });
    await instalada(page, URL);
    // fuentes: la hoja de estilos de Google es una respuesta opaca
    await page.goto(URL); await page.waitForTimeout(1200);
    const c = await cacheDump(page);
    const f = (c && c['finanzas-fonts-v1']) || [];
    ok(f.some(u => /fonts\.googleapis\.com/.test(u)), 'la hoja de fuentes de Google queda en el cache del SW', c);
    await ctx.close();
  }

  // ── B9 ────────────────────────────────────────────────────────────────────
  section('B9 — SheetJS autoalojado (parchado) y precacheado');
  {
    const idx = fs.readFileSync(L.APP_FILE, 'utf8');
    ok(!/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/.test(idx), 'index.html ya no carga SheetJS 0.18.5 de cdnjs sin SRI');
    const f = path.join(REPO, 'xlsx.full.min.js');
    const lib = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    const ver = (lib.match(/version\s*[:=]\s*"(\d+\.\d+\.\d+)"/g) || []).map(s => s.match(/(\d+\.\d+\.\d+)/)[1]);
    ok(ver.includes('0.20.3') || ver.some(v => v.split('.')[1] * 1 >= 20 && (v.split('.')[1] * 1 > 20 || v.split('.')[2] * 1 >= 2)), 'el repo trae xlsx.full.min.js >= 0.20.2 (sin CVE-2023-30533 ni CVE-2024-22363)', ver.slice(0, 3));
    const { ctx, page, errs } = await newPage(browser);
    await instalada(page, URL);
    const c = await cacheDump(page);
    ok(Object.values(c || {}).flat().some(u => /xlsx\.full\.min\.js/.test(u)), 'el SW lo precachea al instalar', c);
    state.down = true;
    await page.goto(URL).catch(() => {});
    // un .xlsx de verdad armado con la propia librería
    const buf = await page.evaluate(() => { const b = (typeof XLSX !== 'undefined') ? 1 : 0; return b; });
    const X = (() => { try { return require(path.join(REPO, 'xlsx.full.min.js')); } catch { return null; } })();
    let xl = null;
    if (X) { const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['Nombre', 'Cat', 'Fecha', 'Monto'], ['Coto', 'super', '2026-10-10', 12500]]), 'H'); xl = Array.from(new Uint8Array(X.write(wb, { type: 'array', bookType: 'xlsx' }))); }
    ok(buf === 0, 'la página abre sin SheetJS cargado (se baja al importar)');
    if (xl) {
      await page.evaluate(arr => {
        const file = new File([new Uint8Array(arr)], 'g.xlsx');
        const dt = new DataTransfer(); dt.items.add(file);
        openExcelImportModal();
        handleExcelFile({ files: dt.files });
      }, xl);
      await page.waitForTimeout(2500);
      const r = await page.evaluate(() => ({ lbl: $('excel-file-label').textContent, area: $('excel-review-area').textContent, x: typeof XLSX !== 'undefined' && XLSX.version }));
      ok(/Coto/.test(r.area) && /^0\.2/.test(r.x || ''), 'sin red, importar un .xlsx lo lee con la copia local', r);
    } else ok(false, 'no se pudo armar un .xlsx de prueba (falta xlsx.full.min.js)');
    state.down = false;
    ok(errs.length === 0, 'sin errores de JS', errs);
    await ctx.close();
  }
  await browser.close(); srv.close();

  // ── B15 ───────────────────────────────────────────────────────────────────
  section('B15 — push sin JSON y notificationclick con data.url');
  {
    let t = cargarSW();
    try { t.ls.push(t.ev({ data: { json() { throw new SyntaxError('Unexpected token'); }, text() { return 'Pagá la luz'; } } })); } catch (e) { console.log('    (el handler de push tiró: ' + e.message + ')'); }
    await t.settle();
    ok(t.shown.length === 1 && t.shown[0].o.body === 'Pagá la luz' && t.shown[0].t === 'Mis Finanzas', 'push con texto plano muestra el aviso con ese texto', t.shown);
    t = cargarSW();
    try { t.ls.push(t.ev({ data: { json() { return 'solo un string'; }, text() { return 'x'; } } })); } catch (e) { console.log('    (el handler de push tiró: ' + e.message + ')'); }
    await t.settle();
    ok(t.shown.length === 1 && t.shown[0].o.body === 'solo un string', 'push cuyo JSON no es un objeto tampoco rompe', t.shown);
    t = cargarSW();
    t.ls.push(t.ev({ data: { json() { return { title: 'Vence', body: 'Netflix', url: '/Finanzas/?action=new-gasto', tag: 't1' }; }, text() { return ''; } } }));
    await t.settle();
    ok(t.shown.length === 1 && t.shown[0].t === 'Vence' && t.shown[0].o.data.url === '/Finanzas/?action=new-gasto', 'push con JSON normal sigue andando y guarda data.url');

    const click = async (clientes, data) => {
      const t = cargarSW(); t.sb.clients.list = clientes;
      let closed = 0;
      t.ls.notificationclick(t.ev({ notification: { close() { closed++; }, data } }));
      await t.settle();
      return { t, closed };
    };
    let c1 = cliente('http://localhost/Finanzas/');
    let r = await click([c1], { url: '/Finanzas/?action=new-gasto' });
    ok(c1.focused === 1 && c1.navigated.length === 1 && /action=new-gasto/.test(c1.navigated[0]) && r.t.opened.length === 0, 'con la app abierta: la enfoca y la lleva a data.url', { n: c1.navigated, f: c1.focused });
    c1 = cliente('http://localhost/Finanzas/?action=new-gasto');
    r = await click([c1], { url: '/Finanzas/?action=new-gasto' });
    ok(c1.focused === 1 && c1.navigated.length === 0, 'si ya está en esa URL: solo enfoca, no recarga');
    c1 = cliente('http://localhost/Finanzas/');
    r = await click([c1], { url: '/Finanzas/' });
    ok(c1.focused === 1 && c1.navigated.length === 0, 'aviso a la raíz (los de la cola local): enfoca sin recargar lo que haya a medio cargar');
    r = await click([], { url: '/Finanzas/?action=new-gasto' });
    ok(r.t.opened.length === 1 && /action=new-gasto/.test(r.t.opened[0]), 'sin ventanas: abre data.url');
    r = await click([], undefined);
    ok(r.t.opened.length === 1 && r.t.opened[0] === '/Finanzas/', 'sin data: abre la app', r.t.opened);
    c1 = cliente('http://localhost/Finanzas/');
    r = await click([c1], { url: 'https://evil.example/x' });
    ok(c1.navigated.length === 0 && c1.focused === 1, 'una URL de otro origen no se sigue');
    const ajena = cliente('http://localhost/otra-app/'), mia = cliente('http://localhost/Finanzas/');
    r = await click([ajena, mia], { url: '/Finanzas/?action=new-gasto' });
    ok(mia.focused === 1 && ajena.focused === 0, 'elige la ventana de la app aunque haya otras del mismo origen');
    ok(r.closed === 1, 'cierra la notificación');

    // Sin cache y con el servidor lento, el shell espera la respuesta en vez de cortar
    const t2 = cargarSW();
    let resuelve; t2.sb.fetch = () => new Promise(res => { resuelve = res; });
    t2.sb.caches = { open: () => Promise.resolve({ put() {} }), match: () => Promise.resolve(undefined) };
    let pr = null;
    t2.ls.fetch(t2.ev({ request: { url: 'http://localhost/Finanzas/', mode: 'navigate' }, respondWith: x => { pr = x; } }));
    let listo = false; pr.then(() => { listo = true; });
    await new Promise(r => setTimeout(r, 4600));
    ok(!listo, 'primera visita sin cache y servidor lento: el shell no se corta a los 4 s, espera la respuesta');
    resuelve({ ok: true, clone() { return this; }, status: 200 });
    ok((await pr).status === 200, '…y la entrega cuando llega');
  }

  // ── B12 / B11 ─────────────────────────────────────────────────────────────
  section('B12 — código muerto fuera');
  {
    const idx = fs.readFileSync(L.APP_FILE, 'utf8');
    for (const n of ['AppStorage', 'MIRRORED_STORAGE_KEYS', 'getCurrentWeekBudgetSnapshot', 'getRememberedExpenseAccount', 'limpiarBusqueda', 'openFundAdjust', 'AppUI', 'AppModules'])
      ok(!new RegExp('\\b' + n + '\\b').test(idx), `index.html ya no tiene ${n}`);
    const tests = fs.readFileSync(path.join(__dirname, '..', 'tests.js'), 'utf8');
    for (const n of ['AppStorage', 'getCurrentWeekBudgetSnapshot', 'getRememberedExpenseAccount', 'limpiarBusqueda', 'openFundAdjust'])
      ok(!new RegExp('\\b' + n + '\\b').test(tests), `tests.js no referencia ${n}`);
  }
  section('B11 — tests.js carga los helpers de la app (no copias)');
  {
    const tests = fs.readFileSync(path.join(__dirname, '..', 'tests.js'), 'utf8');
    for (const n of ['localDateKey', 'parseLooseAmount', 'isDupRelativeTol', 'dayKeyOf', 'classifyBucket', 'agIsCalMonth', 'makeSplitState', 'filterByTombstone', 'makePayShareState', 'buildGastoFromPayContext', 'shouldWarnOnFetchFailure', 'getMergedGastos', 'gcalEventUrl', 'gcalRRule', 'gcalMonthlyRule'])
    {
      // Puede quedar un envoltorio con ese nombre, pero tiene que cargar la función real (fuenteApp).
      const m = new RegExp('(function\\s+' + n + '\\s*\\(|(const|let)\\s+' + n + '\\s*=)').exec(tests);
      ok(!m || /fuenteApp\b/.test(tests.slice(m.index, m.index + 700)), `tests.js no tiene una copia de ${n}`);
    }
  }

  console.log(`\n${pass + fail} checks: ${pass} ok, ${fail} fallaron`);
  process.exitCode = fail ? 1 : 0;
});
