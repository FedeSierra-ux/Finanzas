// v34.29, C15: un solo acento por persona. En el teléfono de Fede la barra, los botones
// primarios y el "+" son azules; en el de Mile, violetas, en las cuatro secciones y en los
// dos temas; y cambiar "Soy" en Ajustes lo cambia al toque. El violeta de lo compartido
// (deudas, "Mile pagó") no se toca. Con la v34.28 la barra y los botones cambian por sección.
const L = require('./lib');

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const iphone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce', userAgent: UA };

// Color de un token ya resuelto (blue/purple) según el tema vigente.
const MEDIR = async () => {
  const st = document.createElement('style'); st.textContent = '*,*::before,*::after{transition:none!important}'; document.head.appendChild(st);
  await new Promise(r => setTimeout(r, 120));
  const tok = n => { const e = document.createElement('i'); e.style.color = `var(--${n})`; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; };
  const bg = sel => { const e = document.querySelector(sel); return e ? getComputedStyle(e).backgroundColor : null; };
  const col = id => getComputedStyle(document.getElementById(id)).color;
  const out = { blue: tok('blue'), purple: tok('purple'), persona: document.documentElement.getAttribute('data-persona'), nav: {} };
  for (const s of ['saldos', 'gastos', 'agenda', 'compartidos']) {
    goTo(s); await new Promise(r => setTimeout(r, 150)); out.nav[s] = col('nav-' + s);
  }
  out.plus = bg('.nav-add-in');
  out.btnp = bg('#ag-save-btn');          // el que antes era .btnp-purple
  out.btnpAzul = bg('.btnp:not(.btnp-purple)');
  st.remove();
  return out;
};

(async () => {
  const browser = await L.launch();
  L.resetBins();
  for (const quien of ['fede', 'mile']) {
    const esperado = quien === 'fede' ? 'blue' : 'purple';
    for (const tema of ['dark', 'light']) {
      L.section(`${quien} · tema ${tema}`);
      const d = await L.device(browser, { myName: quien, compBin: 'b' + quien + tema, contexto: iphone });
      await d.ev(t => { localStorage.setItem('fin_theme', t); applyTheme(t); }, tema);
      const m = await d.ev(MEDIR);
      L.eq(m.persona, quien, 'el acento sigue a "Soy"');
      for (const s of ['saldos', 'gastos', 'agenda', 'compartidos']) L.eq(m.nav[s], m[esperado], `la barra activa de ${s} usa el acento (${esperado})`);
      L.eq(m.plus, m[esperado], 'el "+" usa el acento');
      L.eq(m.btnp, m[esperado], 'el Guardar que era violeta usa el acento');
      L.eq(m.btnpAzul, m[esperado], 'el Guardar que era azul usa el acento');
      await d.close();
    }
  }
  L.section('cambiar "Soy" en Ajustes cambia el acento al toque');
  const d = await L.device(browser, { myName: 'fede', compBin: 'bcambio', contexto: iphone });
  const antes = await d.ev(() => getComputedStyle(document.querySelector('.nav-add-in')).backgroundColor);
  await d.ev(() => document.getElementById('sync-myname-mile').click());
  const des = await d.ev(() => ({ p: document.documentElement.getAttribute('data-persona'), plus: getComputedStyle(document.querySelector('.nav-add-in')).backgroundColor, my: localStorage.getItem('fin_my_name') }));
  L.eq([des.p, des.my], ['mile', 'mile'], 'quedan guardados "mile" y el atributo');
  L.is(des.plus !== antes, 'el "+" cambió de color');
  await d.ev(() => document.getElementById('sync-myname-fede').click());
  L.eq(await d.ev(() => document.documentElement.getAttribute('data-persona')), 'fede', 'y vuelve a azul con Fede');
  L.is(!(await d.ev(() => document.getElementById('sync-myname-mile') === null)), 'los botones de nombre existen');
  L.eq(d.errors, [], 'sin errores de JS');
  await d.close();
  await browser.close();
  console.log(`\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})();
