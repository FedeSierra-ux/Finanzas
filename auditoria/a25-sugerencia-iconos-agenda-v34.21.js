// Los cambios de la v34.21: la sugerencia de categoría se toca entera (también
// con el teclado abierto), Carnicería y Verdulería con su ícono, y en la
// Agenda lo que vence dentro de varios meses va a "Más adelante" (antes caía en
// "Próximo mes" aunque fuera dentro de un año). Con la v34.20 cada sección
// termina en ✗.
const L = require('./lib');

const iphone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' };
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

(async () => {
  const browser = await L.launch();
  const hoy = new Date();

  L.section('Sugerencia de categoría: se toca en cualquier parte de la barra');
  {
    L.resetBins();
    const d = await L.device(browser, { myName: 'fede', compBin: null, contexto: iphone, seed: {} });
    const P = d.page;
    await d.ev(() => { saveCategoryRules([{ pattern: 'rappi', cat: 'super', updatedAt: 1 }]); goTo('gastos'); openGastoModal(); });
    await P.waitForTimeout(400);
    await P.focus('#gdesc'); await P.keyboard.type('Rappi');
    await P.waitForTimeout(200);
    const barra = await d.ev(() => { const b = document.querySelector('#cat-auto-hint .cat-auto'); if (!b) return null;
      const r = b.getBoundingClientRect(); return { tag: b.tagName, alto: Math.round(r.height), x: r.left + 24, y: r.top + r.height / 2 }; });
    L.is(barra && barra.tag === 'BUTTON', 'la sugerencia es un botón entero (' + (barra && barra.tag) + ')');
    L.is(barra && barra.alto >= 44, `y mide al menos 44px de alto (${barra && barra.alto}px)`);
    // Se toca del lado del 💡, lejos del "Aplicar →".
    if (barra) await P.touchscreen.tap(barra.x, barra.y);
    await P.waitForTimeout(250);
    const r = await d.ev(() => ({ cat: gCat, on: (document.querySelector('#gcats .chip.on') || {}).dataset?.v, foco: document.activeElement && document.activeElement.id, hint: $('cat-auto-hint').innerHTML }));
    L.eq([r.cat, r.on], ['super', 'super'], 'tocar del lado del 💡 elige la categoría sugerida');
    L.eq(r.foco, 'gdesc', 'y el campo no pierde el foco (el teclado no se cierra en pleno toque)');
    L.eq(r.hint, '', 'y la sugerencia se va');
    L.eq(d.errors, [], 'sin errores de JS');
    await d.close();
  }

  L.section('Carnicería y Verdulería con su ícono');
  {
    L.resetBins();
    const d = await L.device(browser, { myName: 'fede', compBin: null, initScript: () => {
      if (localStorage.getItem('__sembrado')) return;
      localStorage.setItem('__sembrado', '1');
      localStorage.removeItem('fin_cat_ico_comida');
      localStorage.setItem('fin_custom_cats', JSON.stringify({ custom_carniceria: { label: 'Carnicería', icon: '🛒', color: '#f87171' },
        custom_verduleria: { label: 'verduleria', icon: '🗂️', color: '#4ade80' }, custom_mascotas: { label: 'Mascotas', icon: '🐶', color: '#a3e635' } }));
    } });
    await d.page.reload(); await d.page.waitForFunction(() => typeof CATS === 'object');
    const r = await d.ev(() => ({ cats: [CATS.custom_carniceria.icon, CATS.custom_verduleria.icon, CATS.custom_mascotas.icon],
      guardado: JSON.parse(localStorage.getItem('fin_custom_cats')).custom_carniceria.icon, elegibles: CAT_ICON_CHOICES.includes('🥩') && CAT_ICON_CHOICES.includes('🥬') }));
    L.eq(r.cats, ['🥩', '🥬', '🐶'], 'Carnicería pasa a 🥩, Verdulería a 🥬 y las demás quedan como estaban');
    L.eq(r.guardado, '🥩', 'el cambio queda guardado (viaja en el sync)');
    L.is(r.elegibles, '🥩 y 🥬 se pueden elegir al crear o editar una categoría');
    // Si después se cambia a mano, no se vuelve a pisar.
    const r2 = await d.ev(() => { const c = loadCustomCats(); c.custom_carniceria.icon = '🍖'; saveCustomCats(c); return true; });
    await d.page.reload(); await d.page.waitForFunction(() => typeof CATS === 'object');
    L.eq(await d.ev(() => CATS.custom_carniceria.icon), '🍖', 'si después lo cambiás a mano, no se vuelve a pisar');
    L.eq(d.errors, [], 'sin errores de JS');
    await d.close();
  }

  L.section('Agenda: lo que vence dentro de varios meses va a "Más adelante"');
  {
    L.resetBins();
    const y = hoy.getFullYear(), m = hoy.getMonth();
    const prox = new Date(y, m + 1, 10), lejos = new Date(y + 1, 8, 30);
    const d = await L.device(browser, { myName: 'fede', compBin: null, seed: { agenda: { subs: [], cuotas: [], inversiones: [], vencimientos: [
      { id: 'v1', name: 'Gym', amount: 30100, date: iso(prox.getFullYear(), prox.getMonth(), 10), period: 'mensual' },
      { id: 'v2', name: 'Claude Teams', amount: 33000, date: iso(lejos.getFullYear(), lejos.getMonth(), 30), period: 'unica' }] } } });
    const r = await d.ev(() => { goTo('agenda'); switchAgendaTab('lista'); renderAgenda();
      const grupos = {}; let actual = null;
      document.querySelectorAll('#agenda-content > *').forEach(el => {
        if (el.classList.contains('tl-group-hdr')) actual = el.querySelector('.tl-group-lbl').textContent;
        else if (el.classList.contains('tl-wrap')) el.querySelectorAll('.tl-row').forEach(rw => (grupos[actual] = grupos[actual] || []).push(rw.querySelector('.tl-row-nm').textContent + ' | ' + rw.querySelector('.tl-row-sb').textContent));
      });
      return grupos; });
    const prx = (r['Próximo mes'] || []).map(x => x.split(' | ')[0]);
    const mas = r['Más adelante'] || [];
    L.eq(prx, ['Gym'], 'el mes que viene sigue en "Próximo mes"');
    L.is(mas.length === 1 && mas[0].startsWith('Claude Teams'), 'lo de dentro de un año va a "Más adelante" (' + JSON.stringify(r) + ')');
    L.is(mas[0] && mas[0].includes(String(lejos.getFullYear())), 'y su fecha lleva el año (' + (mas[0] || '') + ')');
    L.eq(d.errors, [], 'sin errores de JS');
    await d.close();
  }

  await browser.close();
  console.log(`\n${'─'.repeat(50)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
