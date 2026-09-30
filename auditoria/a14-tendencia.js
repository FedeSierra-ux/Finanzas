// AUDITORÍA 14 — GRÁFICO DE TENDENCIA (v34.4): se abre al tocar el total de Gastos; barras de 6/12 meses con datos reales
// (propios + la parte de lo compartido + meses archivados), mes elegido resaltado, línea de promedio, variación contra el mes
// anterior y contra el promedio, tocar una barra cambia el mes de las tres pestañas, tema claro/oscuro y iPhone 390 px.
const L = require('./lib');
const { eq, is, section } = L;
const NOW = new Date();
const rel = (off, day = 10) => { const f = new Date(NOW.getFullYear(), NOW.getMonth() + off, 1); return { y: f.getFullYear(), m: f.getMonth(), d: day }; };
const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const g = (id, off, amount, extra = {}) => { const r = rel(off); return { id, desc: 'G ' + id, cat: 'comida', amount, month: r.m, year: r.y, day: r.d, addedAt: new Date(r.y, r.m, r.d, 12).getTime(), ...extra }; };
// Totales por mes (lo que te toca): independientes de la app
const parte = (x, yo) => !x.shared ? Math.round(x.amount) : (x.shared.paidBy === yo ? Math.round(x.amount * x.shared.splitPct / 100) : Math.round(x.amount - Math.round(x.amount * x.shared.splitPct / 100)));
const totMes = (gs, off, yo = 'fede') => { const r = rel(off); return gs.filter(x => x.year === r.y && x.month === r.m).reduce((s, x) => s + parte(x, yo), 0); };
const fComp = n => n >= 1e6 ? '$' + (n / 1e6).toFixed(1).replace('.', ',') + 'M' : n >= 1e4 ? '$' + Math.round(n / 1e3) + 'k' : '$ ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const fARS = n => '$ ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// 13 meses de datos: hoy y 12 hacia atrás, con un compartido (la pareja pagó) y un mes vacío
const datos = () => {
  const out = []; let i = 0;
  for (let off = 0; off >= -12; off--) {
    if (off === -4) continue;                       // un mes sin gastos
    out.push(g('a' + off, off, 100000 + (-off) * 23000 + (off === -2 ? 400000 : 0)));
    out.push(g('b' + off, off, 15001, { shared: { active: true, paidBy: off % 2 ? 'mile' : 'fede', splitPct: 50 } }));
  }
  return out;
};

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const gs = datos();
  const d = await L.device(browser, { myName: 'fede', compBin: 'a14', seed: { gastos: gs } });
  await d.ev(() => clearInterval(_sharedAutoTimer));
  await d.page.waitForTimeout(400);
  const leer = () => d.ev(() => {
    const num = s => Number(String(s).replace(/[^\d]/g, ''));
    const cols = [...document.querySelectorAll('#tnd-body .tnd-col')].map(c => ({ y: Number(c.dataset.y), m: Number(c.dataset.m), on: c.classList.contains('on'), cur: c.classList.contains('cur'), h: Number(c.querySelector('.tnd-bar').getAttribute('height')), label: c.getAttribute('aria-label') }));
    return {
      abierto: document.getElementById('ov-tendencia').classList.contains('open'),
      titulo: (document.querySelector('.tnd-hero small') || {}).textContent, tot: num((document.querySelector('.tnd-tot') || {}).textContent), tex: (document.querySelector('.tnd-tot') || {}).textContent,
      varTxt: (document.querySelector('.tnd-var') || {}).textContent, cols, prom: (document.querySelector('.tnd-avgl') || {}).textContent, detalle: (document.querySelector('.tnd-detail') || {}).textContent,
      vals: [...document.querySelectorAll('#tnd-body .tnd-val')].map(x => x.textContent), seg: [...document.querySelectorAll('.tnd-seg button')].map(b => b.classList.contains('on')),
      mlbl: document.getElementById('mlbl').textContent, mlblC: document.getElementById('mlbl-comp').textContent, vacio: !!document.querySelector('.tnd-empty'),
    };
  });
  await d.ev(() => { goTo('gastos'); });
  await d.page.waitForTimeout(800);

  section('TENDENCIA · se abre al tocar el total');
  is(!(await leer()).abierto, 'cerrada de entrada');
  await d.page.locator('.donut-ctr').click();
  await d.page.waitForTimeout(300);
  let v = await leer();
  is(v.abierto, 'tocar el total del donut abre la tendencia');
  eq(v.cols.length, 6, 'por defecto muestra 6 barras');
  eq(v.seg, [true, false], 'con "6 m" marcado');
  eq(v.cols.filter(c => c.on).length, 1, 'una sola barra resaltada…');
  is(v.cols[5].on && v.cols[5].cur, '…y es el mes en curso (la última)');
  eq(v.titulo, `Gastos de ${MES[NOW.getMonth()]} ${NOW.getFullYear()}`, 'el encabezado dice qué mes es');

  section('TENDENCIA · con los datos reales');
  const esp6 = [-5, -4, -3, -2, -1, 0].map(o => totMes(gs, o));
  eq(v.tot, esp6[5], `total del mes = cuenta independiente (${fARS(esp6[5])}, incluye solo tu parte de los compartidos)`);
  const alturas = v.cols.map(c => c.h);
  const maxTot = Math.max(...esp6);
  is(alturas.every((h, i) => Math.abs(h / alturas[esp6.indexOf(maxTot)] - esp6[i] / maxTot) < 0.02 || (esp6[i] === 0 && h <= 1)), 'la altura de cada barra es proporcional al total de su mes (el mes sin gastos casi no tiene barra)');
  eq(v.vals.filter(Boolean).length, 5, 'en 6 meses se rotula cada barra con datos (el mes vacío no)');
  const conDatos = esp6.filter(x => x > 0), avg = conDatos.reduce((s, x) => s + x, 0) / conDatos.length;
  is(v.prom === `prom. ${fComp(avg)}`, `la línea dorada dice el promedio de los meses con gastos (${v.prom})`);
  is(v.detalle.includes(fARS(avg)) && /5 meses con gastos/.test(v.detalle), 'y el detalle lo repite con el importe y cuántos meses tienen datos');
  const dPrev = Math.round((esp6[5] - esp6[4]) / esp6[4] * 100), dAvg = Math.round((esp6[5] - avg) / avg * 100);
  is(v.varTxt.includes(Math.abs(dPrev) + '%') && v.varTxt.includes(dPrev > 0 ? '▲' : '▼') && v.varTxt.toLowerCase().includes(MES[(NOW.getMonth() + 11) % 12].toLowerCase()), `variación contra el mes anterior: ${v.varTxt}`);
  is(v.detalle.includes(Math.abs(dAvg) + '%'), `y contra el promedio: ${Math.abs(dAvg)}%`);

  section('TENDENCIA · 12 meses y cruce de año');
  await d.ev(() => tendenciaN(12));
  v = await leer();
  eq(v.cols.length, 12, '12 meses = 12 barras');
  eq(v.seg, [false, true], 'con "12 m" marcado');
  const esp12 = Array.from({ length: 12 }, (_, i) => totMes(gs, i - 11));
  const con12 = esp12.filter(x => x > 0), avg12 = con12.reduce((s, x) => s + x, 0) / con12.length;
  is(v.prom === `prom. ${fComp(avg12)}`, `el promedio cambia a los 12 meses (${v.prom})`);
  eq(v.cols.map(c => c.h > 1), esp12.map(x => x > 0), 'cada barra con datos tiene altura; el mes vacío no');
  is(v.vals.length === 1, 'en 12 meses solo se rotula la barra elegida (no se amontona)');
  is(await d.ev(() => { try { return localStorage.getItem('fin_tend_n') === '12'; } catch (e) { return false; } }), 'y se recuerda la elección');

  section('TENDENCIA · tocar una barra cambia el mes de las tres pestañas');
  const objetivo = rel(-7);
  await d.page.locator(`#tnd-body .tnd-col[data-y="${objetivo.y}"][data-m="${objetivo.m}"]`).click();
  await d.page.waitForTimeout(400);
  v = await leer();
  eq(v.mlbl, `${MES[objetivo.m]} ${objetivo.y}`, 'la franja del mes de Gastos pasa al mes tocado');
  eq(v.mlblC, v.mlbl, 'y la de Compartidos es la misma (un solo mes)');
  const selCol = v.cols.find(c => c.on);
  eq([selCol.y, selCol.m], [objetivo.y, objetivo.m], 'la barra tocada queda resaltada');
  eq(v.tot, totMes(gs, -7), 'el total del encabezado pasa a ser el de ese mes');
  is(v.cols.filter(c => c.cur).length === 1, 'y el mes en curso sigue marcado con el contorno');
  const dPrev7 = Math.round((totMes(gs, -7) - totMes(gs, -8)) / totMes(gs, -8) * 100);
  is(v.varTxt.includes(Math.abs(dPrev7) + '%'), 'la variación se recalcula contra el mes anterior al elegido: ' + v.varTxt);
  const real = await d.ev(() => ({ m: curMonth, y: curYear, c: _sharedMonth, cy: _sharedYear, p: _presupMonth }));
  eq([real.m, real.y, real.c, real.cy, real.p], [objetivo.m, objetivo.y, objetivo.m, objetivo.y, objetivo.m], 'curMonth, Compartidos y Presupuesto apuntan al mismo mes');
  // teclado
  const k6 = rel(-6);
  await d.page.locator(`#tnd-body .tnd-col[data-y="${k6.y}"][data-m="${k6.m}"]`).focus();
  await d.page.keyboard.press('Enter');
  await d.page.waitForTimeout(250);
  eq((await leer()).mlbl, `${MES[k6.m]} ${k6.y}`, 'con el teclado: Enter sobre una barra también cambia el mes');
  await d.ev(() => { closeOv('ov-tendencia'); setGastosMonth(new Date().getMonth(), new Date().getFullYear()); });

  section('TENDENCIA · categoría activa en el donut y mes sin datos');
  await d.ev(async () => { renderGastos(); await new Promise(r => setTimeout(r, 900)); document.querySelector('#donut-legend .dl-row[data-cat]').click(); });
  await d.page.locator('.donut-ctr').click();
  await d.page.waitForTimeout(200);
  is(!(await leer()).abierto, 'con una categoría elegida, tocar el centro la des-elige (como antes) y no abre la tendencia');
  await d.ev(() => { closeCatDetail(); });
  // futuro: mes sin datos
  const fut = rel(2);
  await d.ev((f) => { setGastosMonth(f.m, f.y); }, fut);
  await d.page.locator('.donut-ctr').click(); await d.page.waitForTimeout(300);
  v = await leer();
  eq(v.cols.length, 12, 'mirando un mes futuro, la ventana termina en ese mes');
  is(v.cols[11].on && v.tot === 0, 'el mes futuro está resaltado y vale $0');
  is(/Sin gastos del mes anterior|vs\./.test(v.varTxt) || v.varTxt === '', 'sin romper nada si no hay mes anterior con gastos');
  await d.ev(() => { closeOv('ov-tendencia'); setGastosMonth(new Date().getMonth(), new Date().getFullYear()); });

  section('TENDENCIA · meses archivados (más de 18 meses)');
  {
    const a = await L.device(browser, { myName: 'fede', compBin: 'a14b', seed: { gastos: [g('n1', 0, 50000), g('n2', -1, 40000), g('v1', -20, 77777), g('v2', -21, 33333)] } });
    await a.ev(() => clearInterval(_sharedAutoTimer)); await a.page.waitForTimeout(400);
    await a.page.reload(); await a.page.waitForFunction(() => typeof S === 'object' && typeof archiveOldGastos === 'function'); await a.page.waitForTimeout(4200);
    is(await a.ev(() => !S.gastos.some(x => x.id === 'v1') && getArchivedGastos().some(x => x.id === 'v1')), 'los gastos de hace 20 meses están archivados');
    const f = rel(-20);
    await a.ev((f) => { goTo('gastos'); setGastosMonth(f.m, f.y); }, f);
    await a.page.locator('.donut-ctr').click(); await a.page.waitForTimeout(300);
    const r = await a.ev(() => ({ tot: document.querySelector('.tnd-tot').textContent.replace(/[^\d]/g, ''), cols: [...document.querySelectorAll('#tnd-body .tnd-col')].map(c => c.classList.contains('on')), n: document.querySelectorAll('#tnd-body .tnd-col').length }));
    eq(r.tot, '77777', 'la tendencia lee los meses archivados: el mes de hace 20 meses vale lo que tiene');
    await a.close();
  }

  section('TENDENCIA · tema claro y oscuro, iPhone 390 px, montos enormes');
  for (const tema of ['dark', 'light']) {
    await d.ev((t) => { localStorage.setItem('fin_theme', t); applyTheme(); }, tema);
    await d.page.locator('.donut-ctr').click(); await d.page.waitForTimeout(300);
    const c = await d.ev(() => {
      const barra = document.querySelector('#tnd-body .tnd-col.on .tnd-bar'), otra = document.querySelector('#tnd-body .tnd-col:not(.on) .tnd-bar');
      const modal = document.querySelector('#ov-tendencia .modal');
      const rgb = s => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
      const lum = c => { const [r, g, b] = c.map(x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
      const cr = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + .05) / (Math.min(A, B) + .05); };
      const fondo = rgb(getComputedStyle(modal).backgroundColor), txt = rgb(getComputedStyle(document.querySelector('.tnd-tot')).color), lbl = rgb(getComputedStyle(document.querySelector('.tnd-lbl')).fill);
      return { sel: getComputedStyle(barra).fill, otra: getComputedStyle(otra).fill, contrasteTotal: cr(fondo, txt), contrasteEtiqueta: cr(fondo, lbl), contrasteBarra: cr(fondo, rgb(getComputedStyle(barra).fill)) };
    });
    is(c.sel !== c.otra, `tema ${tema}: la barra elegida se distingue de las otras`);
    is(c.contrasteTotal > 7 && c.contrasteEtiqueta > 3, `tema ${tema}: el total (${c.contrasteTotal.toFixed(1)}:1) y las etiquetas (${c.contrasteEtiqueta.toFixed(1)}:1) se leen`);
    is(c.contrasteBarra > 1.8, `tema ${tema}: la barra elegida contrasta con el fondo (${c.contrasteBarra.toFixed(1)}:1)`);
    await d.ev(() => closeOv('ov-tendencia'));
  }
  await d.ev(() => { localStorage.setItem('fin_theme', 'dark'); applyTheme(); });
  {
    const mv = await L.device(browser, { myName: 'fede', compBin: 'a14m', contexto: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
      seed: { gastos: datos().map((x, i) => i === 0 ? { ...x, amount: 987654321012 } : x) } });
    await mv.ev(() => clearInterval(_sharedAutoTimer)); await mv.page.waitForTimeout(400);
    await mv.ev(() => goTo('gastos')); await mv.page.waitForTimeout(800);
    for (const n of [6, 12]) {
      await mv.page.locator('.donut-ctr').tap(); await mv.page.waitForTimeout(300);
      await mv.ev((n) => tendenciaN(n), n);
      const o = await mv.ev(() => { const m = document.querySelector('#ov-tendencia .modal'); const w = innerWidth; const fuera = [...document.querySelectorAll('#ov-tendencia .modal *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > w + 1 || r.left < -1); }).length; return { pag: document.documentElement.scrollWidth - w, modal: m.scrollWidth - m.clientWidth, fuera, tocable: Math.min(...[...document.querySelectorAll('#tnd-body .tnd-hit')].map(h => h.getBoundingClientRect().width)), seg: Math.min(...[...document.querySelectorAll('.tnd-seg button')].map(b => b.getBoundingClientRect().height)) }; });
      eq([o.pag, o.modal, o.fuera], [0, 0, 0], `iPhone 390 px, ${n} meses, con un monto de 12 cifras: sin desbordes`);
      is(o.tocable >= 27 && o.seg >= 30, `y zonas de toque razonables (barra ≥ ${o.tocable.toFixed(0)} px de ancho, selector ${o.seg.toFixed(0)} px de alto)`);
      await mv.ev(() => closeOv('ov-tendencia'));
    }
    await mv.page.locator('.donut-ctr').tap(); await mv.page.waitForTimeout(300);
    const y = rel(-3); await mv.page.locator(`#tnd-body .tnd-col[data-y="${y.y}"][data-m="${y.m}"]`).tap();
    eq(await mv.ev(() => document.getElementById('mlbl').textContent), `${MES[y.m]} ${y.y}`, 'con el dedo: tocar una barra cambia el mes');
    eq(mv.errors, [], 'sin errores de JS en el teléfono');
    await mv.close();
  }

  section('TENDENCIA · sin datos');
  {
    const e = await L.device(browser, { myName: 'fede', compBin: 'a14e', seed: { gastos: [] } });
    await e.ev(() => clearInterval(_sharedAutoTimer)); await e.ev(() => goTo('gastos')); await e.page.waitForTimeout(700);
    await e.page.locator('.donut-ctr').click(); await e.page.waitForTimeout(300);
    const r = await e.ev(() => ({ vacio: !!document.querySelector('.tnd-empty'), barras: document.querySelectorAll('#tnd-body .tnd-col').length, tot: document.querySelector('.tnd-tot').textContent }));
    is(r.vacio && r.barras === 0, 'sin gastos: mensaje en vez de un gráfico vacío');
    eq(e.errors, [], 'y sin errores');
    await e.close();
  }

  section('ERRORES');
  eq(d.errors, [], 'ningún error de JS durante toda la auditoría');
  console.log(`\n${'─'.repeat(52)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  await browser.close();
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error('ERROR:', e); process.exit(2); });
