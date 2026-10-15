// Retoques de HTML simulados con page.evaluate (propuesta H1–H3): reemplazan
// emojis por SVG de trazo donde conviven con íconos SVG. En index.html serían
// cambios chicos en el markup / en las plantillas de renderAgenda y
// renderCompartidos; acá se aplican sobre el DOM vivo y se reaplican con un
// MutationObserver porque esas vistas se vuelven a dibujar.
(() => {
  const svg = (p, extra = '') => `<svg class="ui-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${p}</svg>`;
  const I = {
    list: svg('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none"/>'),
    card: svg('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18"/>'),
    cal: svg('<rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', ' width="15" height="15"'),
    moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', ' width="15" height="15"'),
    cash: svg('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>'),
    repeat: svg('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>', ' width="20" height="20" stroke-width="1.9"'),
    bell: svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>', ' width="20" height="20" stroke-width="1.9"'),
    cardBig: svg('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18"/><circle cx="8" cy="14.5" r="1" fill="currentColor" stroke="none"/>', ' width="20" height="20" stroke-width="1.9"'),
  };
  // H1 · pestañas de Agenda: 📋 💳 🗓️ → SVG (markup estático en index.html, líneas ~2187-2189)
  const tabs = { 'ag-tab-lista': [I.list, 'Agenda'], 'ag-tab-tarjetas': [I.card, 'Tarjetas'], 'ag-tab-plan': [I.cal, 'Plan'] };
  for (const id in tabs) { const b = document.getElementById(id); if (b) b.innerHTML = tabs[id][0] + tabs[id][1]; }
  // H2 · botón de tema: ☀️/🌙 → SVG (applyTheme escribe el emoji; se envuelve)
  const setThemeIco = () => { const b = document.getElementById('theme-toggle-btn-inline'); if (!b) return;
    b.innerHTML = document.documentElement.getAttribute('data-theme') === 'light' ? I.moon : I.sun; };
  const _apply = window.applyTheme; window.applyTheme = function () { _apply.apply(this, arguments); setThemeIco(); };
  setThemeIco();
  // H3 · "💵 Liquidar" y los tres tiles de Agenda (🔄 🔔 💳) → SVG. Se dibujan
  // por JS en cada render, así que se reaplican con un observer.
  const fix = () => {
    document.querySelectorAll('.sh-btn-liq:not([data-svg])').forEach(b => { b.dataset.svg = 1; b.innerHTML = I.cash + b.textContent.replace(/^[^\p{L}]+/u, ''); b.style.display = 'inline-flex'; b.style.alignItems = 'center'; b.style.gap = '6px'; });
    document.querySelectorAll('.ag-tile-ico:not([data-svg])').forEach(s => { const t = s.textContent.trim(); const m = { '🔄': I.repeat, '🔔': I.bell, '💳': I.cardBig }[t]; if (!m) return; s.dataset.svg = 1; s.innerHTML = m; s.style.display = 'inline-flex'; s.style.color = 'var(--blue)'; s.style.width = '34px'; s.style.height = '34px'; s.style.alignItems = 'center'; s.style.justifyContent = 'center'; s.style.borderRadius = '10px'; s.style.background = 'var(--blue-dim)'; });
    document.querySelectorAll('.sh-btn-liq .ui-ico').forEach(x => x.style.marginRight = '0');
  };
  fix();
  new MutationObserver(fix).observe(document.body, { childList: true, subtree: true });
  window.__tweaksApplied = true;
})();
