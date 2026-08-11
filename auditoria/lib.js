// Infraestructura de auditoría: corre la app real en Chromium con un JSONBin
// falso en memoria compartido entre varios "dispositivos" (contextos aislados,
// cada uno con su localStorage). Así se ejercita el camino de sync de verdad
// —jsonbinRequest, fetchSharedBin, pushSharedBin, tombstones, merge— sin red.
const PW = 'playwright-core';
const { chromium } = require(PW);
const APP = 'file:///home/user/Finanzas/index.html';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// ── Bin falso ───────────────────────────────────────────────────────────────
const bins = {};
const net = { getFail: false, putFail: false };
const stats = { get: 0, put: 0, http: 0 };

function resetBins() {
  for (const k of Object.keys(bins)) delete bins[k];
  net.getFail = net.putFail = false;
  stats.get = stats.put = stats.http = 0;
}

// ── Resultados ──────────────────────────────────────────────────────────────
const results = { pass: 0, fail: 0, findings: [] };
function ok(label) { results.pass++; console.log(`  ✓ ${label}`); }
function bad(label, got, exp) {
  results.fail++;
  const d = exp === undefined ? '' : `  → got ${JSON.stringify(got)}, expected ${JSON.stringify(exp)}`;
  console.log(`  ✗ ${label}${d}`);
  results.findings.push({ label, got, exp });
}
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) ok(label); else bad(label, actual, expected);
}
function is(cond, label) { if (cond) ok(label); else bad(label); }
function section(name) { console.log(`\n── ${name}`); }

// ── Dispositivo ─────────────────────────────────────────────────────────────
async function device(browser, { myName, compBin, compKey = 'k', partnerBin = null, seed = {} }) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (!/Failed to load resource|net::|navigator\.vibrate/.test(t)) errors.push(t); } });

  await page.exposeFunction('__binGet', id => {
    stats.get++; stats.http++;
    if (net.getFail) return { __fail: true };
    return bins[id] === undefined ? null : JSON.parse(JSON.stringify(bins[id]));
  });
  await page.exposeFunction('__binPut', (id, rec) => {
    stats.put++; stats.http++;
    if (net.putFail) return { __fail: true };
    bins[id] = JSON.parse(JSON.stringify(rec));
    return { ok: true };
  });

  // El override de fetch va antes que los scripts de la app.
  await page.addInitScript(() => {
    const real = window.fetch;
    window.fetch = async (url, opts = {}) => {
      const u = String(url && url.url ? url.url : url);
      const m = u.match(/api\.jsonbin\.io\/v3\/b\/([^/?]+)/);
      if (!m) {
        // Todo lo demás (cotización, push worker) no existe en la auditoría.
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      const id = m[1];
      const method = (opts.method || 'GET').toUpperCase();
      if (method === 'GET') {
        const rec = await window.__binGet(id);
        if (rec && rec.__fail) throw new TypeError('Failed to fetch');
        return new Response(JSON.stringify({ record: rec === null ? {} : rec }),
          { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'PUT') {
        const r = await window.__binPut(id, JSON.parse(opts.body));
        if (r && r.__fail) throw new TypeError('Failed to fetch');
        return new Response(JSON.stringify({ record: JSON.parse(opts.body) }),
          { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    window.__realFetch = real;
  });

  await page.goto(APP);
  await page.waitForFunction(() => typeof S === 'object' && S !== null && typeof save === 'function' && typeof syncCompartidos === 'function');

  await page.evaluate(({ myName, compBin, compKey, partnerBin, seed }) => {
    localStorage.setItem('fin_my_name', myName);
    localStorage.setItem('fin_comp_bin_id', compBin);
    localStorage.setItem('fin_comp_api_key', compKey);
    if (partnerBin) localStorage.setItem('fin_partner_bin_id', partnerBin);
    S.accounts = seed.accounts || [{ id: 'acc1', name: 'Galicia', type: 'bancaria', amount: 1000000, currency: 'ARS' }];
    S.gastos = seed.gastos || [];
    S.plan = seed.plan || [];
    S.agenda = seed.agenda || { subs: [], vencimientos: [], cuotas: [], inversiones: [] };
    S.tc = 1300;
    save();
    // Silenciar los toasts para que no tapen el DOM en las pruebas de UI.
    window.__toasts = [];
    const st = window.showToast;
    window.showToast = (msg, a, b, c) => { window.__toasts.push(String(msg)); return st(msg, a, b, c); };
  }, { myName, compBin, compKey, partnerBin, seed });

  const dev = {
    page, ctx, errors,
    ev: (fn, arg) => page.evaluate(fn, arg),
    // Espera a que la cola de escrituras del bin se vacíe.
    settle: async () => {
      await page.evaluate(() => queueSharedBinWrite(async () => {}));
      await page.waitForTimeout(60);
    },
    toasts: () => page.evaluate(() => window.__toasts.slice()),
    clearToasts: () => page.evaluate(() => { window.__toasts.length = 0; }),
    close: () => ctx.close(),
  };
  return dev;
}

async function launch() {
  return chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
}

module.exports = { launch, device, bins, net, stats, resetBins, results, ok, bad, eq, is, section };
