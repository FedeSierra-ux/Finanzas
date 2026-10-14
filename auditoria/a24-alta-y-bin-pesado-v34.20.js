// Los cambios de la v34.20: el alta de gasto en orden Descripción → Monto →
// Categoría (con el teclado del iPhone abierto se ven el monto y las
// categorías, Enter avanza y guarda) y el aviso de que el bin compartido pasa
// los 70kb. Con la v34.19 cada sección termina en ✗.
const L = require('./lib');

const iphone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' };
// Un visualViewport falso que se achica como con el teclado de iOS, para que la
// app pase por el mismo camino (--kb-height, kb-open) que en el teléfono.
const tecladoFalso = () => {
  const ls = {}; const vv = { height: window.innerHeight || 844, width: 390, offsetTop: 0, offsetLeft: 0, scale: 1,
    addEventListener: (t, f) => { (ls[t] = ls[t] || []).push(f); }, removeEventListener() {} };
  Object.defineProperty(window, 'visualViewport', { get: () => vv, configurable: true });
  window.__teclado = h => { vv.height = window.innerHeight - h; (ls.resize || []).forEach(f => f()); };
};

(async () => {
  const browser = await L.launch();

  L.section('UX03 · Alta de gasto: Descripción → Monto → Categoría');
  {
    L.resetBins();
    const d = await L.device(browser, { myName: 'fede', compBin: null, contexto: iphone, initScript: tecladoFalso, seed: {} });
    const P = d.page;
    const orden = await d.ev(() => {
      const antes = (a, b) => !!(document.querySelector(a).compareDocumentPosition(document.querySelector(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
      return { descMonto: antes('#gdesc', '#gamt'), montoCats: antes('#gamt', '#gcats'),
        hintDesc: $('gdesc').getAttribute('enterkeyhint'), hintMonto: $('gamt').getAttribute('enterkeyhint') };
    });
    L.is(orden.descMonto && orden.montoCats, 'el monto va entre la descripción y las categorías');
    L.eq([orden.hintDesc, orden.hintMonto], ['next', 'done'], 'el teclado muestra "siguiente" en la descripción y "listo" en el monto');

    await d.ev(() => { goTo('gastos'); openGastoModal(); });
    await P.waitForTimeout(400);
    await P.focus('#gdesc'); await P.keyboard.type('Café');
    await d.ev(() => window.__teclado(336));
    await P.waitForTimeout(400);
    const vista = await d.ev(() => {
      const b = s => document.querySelector(s).getBoundingClientRect();
      const tope = window.innerHeight - 336;
      return { monto: b('#gamt').bottom <= tope, cats: b('#gcats').bottom <= tope, kb: document.documentElement.classList.contains('kb-open') };
    });
    L.is(vista.kb, 'la app detecta el teclado abierto');
    L.is(vista.monto, 'con el teclado abierto el monto queda a la vista');
    L.is(vista.cats, 'y las categorías también');

    await P.keyboard.press('Enter');
    L.eq(await d.ev(() => document.activeElement && document.activeElement.id), 'gamt', 'Enter en la descripción pasa al monto');
    await P.keyboard.type('3300');
    await P.keyboard.press('Enter');
    await P.waitForTimeout(500);
    const g = await d.ev(() => S.gastos.filter(x => x.desc === 'Café').map(x => x.amount));
    L.eq(g, [3300], 'Enter en el monto guarda el gasto, una sola vez');
    L.eq(d.errors, [], 'sin errores de JS');
    await d.close();
  }

  L.section('Aviso de bin compartido pesado (más de 70kb comprimido)');
  {
    L.resetBins();
    const d = await L.device(browser, { myName: 'fede', compBin: 'binP' });
    // Descripciones al azar: gzip no las achica y el bin pasa los 70kb de verdad.
    const r = await d.ev(async () => {
      const vistos = []; const real = showToast;
      showToast = (m, ...x) => { vistos.push(String(m)); return real(m, ...x); };
      const azar = n => { let t = ''; while (t.length < n) t += Math.random().toString(36).slice(2); return t.slice(0, n); };
      const f = new Date();
      const chico = await (async () => { await pushSharedBin(); return vistos.filter(m => /bin compartido ya pesa/.test(m)).length; })();
      for (let i = 0; i < 900; i++) S.gastos.push({ id: 'p' + i, desc: azar(90), cat: 'comida', amount: 1000 + i, month: f.getMonth(), year: f.getFullYear(), day: 1,
        addedAt: Date.now() - i, shared: { active: true, paidBy: 'fede', splitPct: 50 } });
      _sharedBinGastos = S.gastos.filter(g => g.shared);
      const ok1 = await pushSharedBin(); await new Promise(r => setTimeout(r, 300));
      const primero = vistos.filter(m => /bin compartido ya pesa/.test(m));
      const ok2 = await pushSharedBin(); await new Promise(r => setTimeout(r, 300));
      const segundo = vistos.filter(m => /bin compartido ya pesa/.test(m)).length;
      showToast = real;
      return { chico, ok1, ok2, primero, segundo };
    });
    L.eq(r.chico, 0, 'con el bin chico no avisa');
    L.is(r.ok1 && r.ok2, 'el bin pesado sigue subiendo');
    L.eq(r.primero.length, 1, 'pasados los 70kb avisa (' + (r.primero[0] || '') + ')');
    L.eq(r.segundo, 1, 'y no repite el aviso en la misma semana');
    L.eq(d.errors, [], 'sin errores de JS');
    await d.close();
  }

  await browser.close();
  console.log(`\n${'─'.repeat(50)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
