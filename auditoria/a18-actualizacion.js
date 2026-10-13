// Aviso de versión nueva (v34.13). Sirve la app por http en /Finanzas/ (con
// file:// no hay service worker ni version.json) y simula un deploy con la app
// abierta: que aparezca el cartel al volver a la app, que no recargue sola, que
// "Después" no insista con la misma versión y que "Actualizar" cargue la nueva
// con una sola recarga.
const http = require('http'), fs = require('fs'), path = require('path');
const L = require('./lib.js');
const REPO = path.dirname(L.APP_FILE);
let version = null;
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (!p.startsWith('/Finanzas/')) { res.writeHead(404); return res.end(); }
  p = p.slice('/Finanzas/'.length) || 'index.html';
  const f = path.join(REPO, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(f).toString();
  if (version && p === 'index.html') body = body.replace(/const APP_VERSION='[^']+'/, `const APP_VERSION='${version}'`);
  if (version && p === 'version.json') body = JSON.stringify({ version });
  const ct = p.endsWith('.js') ? 'application/javascript' : p.endsWith('.json') ? 'application/json' : 'text/html';
  res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': 'no-cache' }); res.end(body);
});
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
srv.listen(0, async () => {
  const URL = `http://localhost:${srv.address().port}/Finanzas/`;
  const browser = await L.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  let navs = 0; page.on('framenavigated', f => { if (f === page.mainFrame()) navs++; });
  await page.goto(URL); await page.waitForTimeout(3000);
  ok(navs === 1, `primera visita sin recarga extra (navegaciones=${navs})`);
  await page.evaluate(() => checkNuevaVersion()); await page.waitForTimeout(900);
  ok(!(await page.evaluate(() => !!document.querySelector('#update-banner.show'))), 'sin versión nueva no aparece el cartel');
  // Deploy mientras la app está abierta y con un gasto a medio cargar
  await page.evaluate(() => { openGastoModal(); $('gdesc').value = 'a medio cargar'; });
  version = '99.0'; navs = 0;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(1500);
  ok(await page.evaluate(() => !!document.querySelector('#update-banner.show')), 'al volver a la app aparece "Actualización lista"');
  ok((await page.evaluate(() => $('update-banner-ver').textContent)) === '99.0', 'con el número de la versión nueva');
  ok(navs === 0 && (await page.evaluate(() => $('gdesc').value)) === 'a medio cargar', 'y no recarga sola: el gasto a medio cargar sigue ahí');
  // Después: no vuelve a molestar por la misma versión
  await page.evaluate(() => dismissUpdate()); await page.waitForTimeout(300);
  await page.evaluate(() => checkNuevaVersion()); await page.waitForTimeout(900);
  ok(!(await page.evaluate(() => !!document.querySelector('#update-banner.show'))), '"Después" no vuelve a mostrarlo para la misma versión');
  // Actualizar
  navs = 0;
  await page.evaluate(() => applyUpdate()).catch(() => {});
  await page.waitForTimeout(5000);
  ok(await page.evaluate(() => APP_VERSION) === '99.0', 'Actualizar carga la versión nueva');
  ok(navs === 1, `con una sola recarga (navegaciones=${navs})`);
  const sw = await page.evaluate(() => navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL);
  ok(/v=99\.0/.test(sw || ''), 'y queda el worker de la versión nueva');
  ok(!(await page.evaluate(() => !!document.querySelector('#update-banner.show'))), 'sin cartel después de actualizar');
  ok(errs.length === 0, 'sin errores de JS ' + JSON.stringify(errs));
  console.log(`${pass + fail} checks: ${pass} ok, ${fail} fallaron`);
  await browser.close(); srv.close();
  process.exitCode = fail ? 1 : 0;
});
