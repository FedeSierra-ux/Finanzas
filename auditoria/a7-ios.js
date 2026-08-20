// AUDITORÍA 7 — iPHONE / iOS.
//
// La app se usa todos los días en Android; esta auditoría mira lo que solo se
// rompe del otro lado. Corre la app real con el contexto de un iPhone 14
// (390x844, userAgent de iOS, touch) y además le saca al navegador lo que iOS
// no tiene: Notification (Safari no la expone en una pestaña común, recién
// aparece con la app agregada a la pantalla de inicio) y navigator.vibrate.
//
// Chromium no es WebKit: lo que se comprueba acá es DOM, CSS aplicado y JS, no
// diferencias de motor. Los hallazgos de motor se revisaron aparte contra
// WebKit (ver README).
const L = require('./lib');
const { eq, is, section } = L;

// iPhone 14 / 15: 390x844 CSS px, 3x, touch.
const IPHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
};

// Safari en pestaña: sin API de notificaciones ni vibración.
const SIN_APIS_DE_IOS = () => {
  try { delete window.Notification; } catch (e) { window.Notification = undefined; }
  try { delete navigator.vibrate; } catch (e) { /* no-op */ }
};

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const now = new Date(), M = now.getMonth(), Y = now.getFullYear();
  const d = await L.device(browser, {
    myName: 'fede', compBin: 'bin7', contexto: IPHONE, initScript: SIN_APIS_DE_IOS,
    seed: {
      gastos: Array.from({ length: 14 }, (_, i) => ({
        id: 'g' + i, desc: 'Gasto de prueba ' + i, cat: ['comida', 'transporte', 'salidas', 'hogar', 'compras', 'varios'][i % 6],
        amount: 1000 * (i + 3), month: M, year: Y, day: 1 + (i % 27), addedAt: Date.now() - i * 3600e3,
      })),
      plan: [{ id: 'p1', name: 'Sueldo', cat: 'ingreso', months: { [M]: 2000000 }, order: 1 },
             { id: 'p2', name: 'Alquiler', cat: 'hogar', months: { [M]: 500000 }, order: 2 }],
      agenda: {
        subs: [{ id: 's1', name: 'Netflix', amount: 12000, date: new Date(Y, M, 25).toISOString().slice(0, 10), period: 'mensual' }],
        vencimientos: [{ id: 'v1', name: 'Patente', amount: 45000, date: new Date(Y, M, 20).toISOString().slice(0, 10), period: 'unica' }],
        cuotas: [{ id: 'c1', name: 'Notebook', fee: 120000, total: 6, paid: 1 }],
        inversiones: [],
      },
    },
  });
  await d.ev(() => { render(); renderGastos(); renderProj(); renderAgenda(); });

  // ════ ARRANQUE ═══════════════════════════════════════════════════════
  section('iOS · la app arranca sin las APIs que Safari no tiene');
  eq(await d.ev(() => document.documentElement.classList.contains('ios')), true,
    'con userAgent de iPhone se enciende el modo iOS');
  eq(await d.ev(() => typeof Notification), 'undefined', 'y el navegador no expone Notification (como Safari en una pestaña)');
  eq(await d.ev(() => { try { scheduleNotifications(); initNotifications(); updateAppBadge(); return 'ok'; } catch (e) { return String(e.message); } }), 'ok',
    'programar avisos y el badge no rompen sin esas APIs');
  eq(await d.ev(() => { try { openNotifSettings(); const v = getComputedStyle(document.getElementById('notif-ios-row')).display; closeOv('ov-notif'); return v; } catch (e) { return String(e.message); } }), 'block',
    'y el menú de notificaciones explica que en iPhone hay que instalarla');

  // ════ PANTALLAS ══════════════════════════════════════════════════════
  section('iOS · las pantallas entran en 390px');
  // 'plan' ya no es una página: goTo lo redirige a la pestaña Plan de Agenda.
  for (const pg of ['saldos', 'gastos', 'compartidos', 'agenda', 'plan']) {
    await d.ev((p) => goTo(p), pg);
    await d.page.waitForTimeout(250);
    const r = await d.ev(() => {
      const vw = innerWidth;
      const fuera = [];
      document.querySelectorAll('.page:not(.hidden) *').forEach(el => {
        const b = el.getBoundingClientRect();
        if (!b.width || !b.height) return;
        if (b.right <= vw + 1.5 && b.left >= -1.5) return;
        const s = getComputedStyle(el);
        if (s.position === 'fixed' || s.overflowX === 'auto' || s.overflowX === 'scroll') return;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ps = getComputedStyle(p);
          if (ps.overflowX === 'auto' || ps.overflowX === 'scroll') return;
        }
        fuera.push(el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0]);
      });
      return { ancho: document.documentElement.scrollWidth, vw, fuera: [...new Set(fuera)] };
    });
    eq(r.fuera, [], `${pg}: ningún elemento se sale de la pantalla`);
    eq(r.ancho, r.vw, `${pg}: la página no scrollea de costado`);
  }

  // ════ MENÚS ══════════════════════════════════════════════════════════
  section('iOS · los menús entran enteros, con sus botones a la vista');
  const ids = await d.ev(() => [...document.querySelectorAll('.overlay')].map(o => o.id).filter(Boolean));
  is(ids.length >= 20, `hay ${ids.length} menús para revisar`);
  const rotos = [];
  for (const id of ids) {
    await d.ev((i) => {
      document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open'));
      document.getElementById(i).classList.add('open');
    }, id);
    await d.page.waitForTimeout(340); // la hoja sube con una transición de .28s
    const r = await d.ev((i) => {
      const ov = document.getElementById(i);
      const m = ov.querySelector('.modal,.modal-panel');
      if (!m) return null;
      const b = m.getBoundingClientRect();
      let ocultos = 0;
      m.querySelectorAll('button,input,select,textarea').forEach(el => {
        const r2 = el.getBoundingClientRect();
        if (r2.height && (r2.bottom > innerHeight + 1 || r2.top < -1)) ocultos++;
      });
      return { abajo: Math.round(b.bottom - innerHeight), arriba: Math.round(b.top), ancho: Math.round(b.width), ocultos };
    }, id);
    if (!r) continue;
    if (r.abajo > 1 || r.arriba < 0 || r.ancho > 390 || r.ocultos > 0) rotos.push({ id, ...r });
  }
  eq(rotos, [], 'ninguno se pasa de la pantalla ni deja controles afuera');
  await d.ev(() => document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open')));

  // ════ ZOOM AL ESCRIBIR ═══════════════════════════════════════════════
  // iOS agranda TODA la página al enfocar un campo con font-size < 16px, y no
  // la vuelve a achicar sola: el menú queda corrido hasta que uno hace pinza.
  section('iOS · ningún campo dispara el zoom automático de Safari');
  await d.ev(() => { goTo('agenda'); switchAgendaTab('plan'); });
  await d.page.waitForTimeout(300);
  const chicos = await d.ev(() => {
    const out = [];
    document.querySelectorAll('input,select,textarea').forEach(el => {
      if (el.type === 'hidden' || el.type === 'checkbox' || el.type === 'radio' || el.type === 'file' || el.type === 'range') return;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 16) out.push((el.id || el.className || el.type) + ' ' + fs + 'px');
    });
    return [...new Set(out)];
  });
  eq(chicos, [], 'todos los campos escribibles miden 16px o más');

  // La celda del proyectado llega a los 16px por transform y no agrandando la
  // letra: la comprobación es que se vea y se toque igual que antes del cambio
  // (mismo recuadro en pantalla), con la tabla midiendo lo mismo.
  const celda = await d.ev(() => {
    const inp = document.querySelector('.tainp');
    if (!inp) return null;
    const caja = el => { const b = el.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; };
    const tabla = () => Math.round(document.querySelector('.proj-table').getBoundingClientRect().width);
    const fila = () => Math.round(inp.closest('tr').getBoundingClientRect().height);
    const cs = getComputedStyle(inp);
    const escala = (cs.transform.match(/matrix\(([\d.]+)/) || [])[1];
    const ahora = { campo: caja(inp), celda: caja(inp.closest('td')), tabla: tabla(), fila: fila(),
                    fs: parseFloat(cs.fontSize), escala: escala ? +(+escala).toFixed(2) : null };
    // Cómo se veía antes: la letra chica, sin transform ni compensaciones.
    inp.style.cssText = 'font-size:11.52px;transform:none;width:100%;margin:0;height:auto';
    const antes = { campo: caja(inp), celda: caja(inp.closest('td')), tabla: tabla(), fila: fila() };
    inp.style.cssText = '';
    return { ahora, antes };
  });
  is(celda && celda.ahora.fs >= 16, `la celda del proyectado declara ${celda && celda.ahora.fs}px (lo único que mira iOS para el zoom)`);
  eq(celda && celda.ahora.escala, 0.72, 'y se dibuja al 72%, así el número sigue midiendo 11.5px');
  eq(celda && celda.ahora.campo.w, celda && celda.antes.campo.w, 'el recuadro que se ve y se toca mide lo mismo de ancho');
  is(celda && celda.ahora.campo.h >= celda.antes.campo.h,
    `y no se achica de alto (${celda && celda.ahora.campo.h}px contra los ${celda && celda.antes.campo.h}px de antes)`);
  eq(celda && celda.ahora.celda, celda && celda.antes.celda, 'la celda del mes no cambia de tamaño');
  eq(celda && celda.ahora.fila, celda && celda.antes.fila, 'ni la fila');
  eq(celda && celda.ahora.tabla, celda && celda.antes.tabla, 'ni el ancho de toda la tabla');

  // ════ ÍCONO DE LA PANTALLA DE INICIO ═════════════════════════════════
  // iOS solo entiende PNG en apple-touch-icon: con el SVG del manifest ignora
  // el ícono y deja una captura de la pantalla.
  section('iOS · el ícono de "Agregar a inicio" es PNG');
  await d.page.waitForFunction(() => (document.getElementById('pwa-icon').href || '').startsWith('data:image/png'), null, { timeout: 5000 })
    .then(() => is(true, 'apple-touch-icon termina siendo un PNG'))
    .catch(async () => is(false, 'apple-touch-icon termina siendo un PNG (quedó: ' + (await d.ev(() => document.getElementById('pwa-icon').href.slice(0, 30))) + ')'));
  eq(await d.ev(() => document.getElementById('pwa-icon').getAttribute('sizes')), '180x180', 'con el tamaño que pide Apple');

  // ════ TECLADO ════════════════════════════════════════════════════════
  // En Safari, innerHeight se queda con el alto máximo (barras plegadas) y
  // visualViewport.height con lo que se ve: la resta da 60-100px sin ningún
  // teclado abierto. Si eso contara como teclado, el botón flotante y las
  // hojas quedarían levantadas del piso todo el tiempo.
  section('iOS · las barras de Safari no se confunden con el teclado');
  const km = await d.ev(() => {
    const inp = document.createElement('input');
    document.body.appendChild(inp);
    const conCampo = kbMetrics(844, 508, 0, inp);
    const sinCampo = kbMetrics(844, 754, 0, document.body);
    const chico = kbMetrics(844, 842, 0, inp);
    const desplazado = kbMetrics(844, 508, 90, inp);
    inp.remove();
    return { conCampo, sinCampo, chico, desplazado };
  });
  eq(km.sinCampo, { kb: 0, open: false }, 'sin ningún campo enfocado, 90px de barras no son teclado');
  eq(km.conCampo, { kb: 336, open: true }, 'con un campo enfocado, sí: 336px de teclado');
  eq(km.chico, { kb: 2, open: false }, 'y 2px de redondeo tampoco abren el modo teclado');
  eq(km.desplazado.kb, 246, 'si iOS además desplaza el viewport, se descuenta ese corrimiento');
  eq(await d.ev(() => { let n = 0; const vv = window.visualViewport; const add = vv.addEventListener; return typeof vv.addEventListener === 'function'; }), true, 'visualViewport disponible');

  // ════ DESCARGAS ══════════════════════════════════════════════════════
  // Safari arranca la descarga en diferido: si el blob se revoca en la línea
  // siguiente al click, el archivo no baja nunca.
  section('iOS · el backup se baja de verdad');
  const dl = await d.ev(() => {
    const revocados = [];
    const realRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = (u) => { revocados.push(u); };
    let enDoc = false, conNombre = '';
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      enDoc = document.body.contains(this);
      conNombre = this.download;
    };
    descargarBlob(new Blob(['{}'], { type: 'application/json' }), 'prueba.json');
    HTMLAnchorElement.prototype.click = realClick;
    URL.revokeObjectURL = realRevoke;
    return { enDoc, conNombre, revocadosEnElActo: revocados.length };
  });
  eq(dl.enDoc, true, 'el enlace está en el documento cuando se lo toca (Safari ignora los sueltos)');
  eq(dl.conNombre, 'prueba.json', 'con el nombre del archivo');
  eq(dl.revocadosEnElActo, 0, 'y el blob no se revoca en el acto, que es lo que cancelaba la descarga');

  // ════ PORTAPAPELES ═══════════════════════════════════════════════════
  section('iOS · copiar no explota sin navigator.clipboard');
  const cp = await d.ev(() => {
    const real = navigator.clipboard;
    try { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); } catch (e) { /* no-op */ }
    const ta = document.createElement('textarea');
    ta.value = 'hola'; document.body.appendChild(ta);
    let error = '';
    try { copiarTexto('hola', ta); } catch (e) { error = String(e.message); }
    ta.remove();
    try { Object.defineProperty(navigator, 'clipboard', { value: real, configurable: true }); } catch (e) { /* no-op */ }
    return { error, ultimoToast: (window.__toasts || []).slice(-1)[0] || '' };
  });
  eq(cp.error, '', 'no tira excepción');
  is(/Copiado|Copiar/.test(cp.ultimoToast), `y avisa qué hacer (${cp.ultimoToast})`);

  // ════ TOQUE ══════════════════════════════════════════════════════════
  section('iOS · nada depende de un hover que en el teléfono no existe');
  const hov = await d.ev(() => {
    const el = document.createElement('button');
    el.className = 'task-del';
    document.body.appendChild(el);
    const op = parseFloat(getComputedStyle(el).opacity);
    el.remove();
    return { op, coarse: matchMedia('(pointer:coarse)').matches };
  });
  eq(hov.coarse, true, 'el teléfono se detecta como pantalla táctil');
  is(hov.op > 0, `la ✕ de las listas se ve sin pasar el mouse (opacity ${hov.op})`);

  // ════ NOTCH ══════════════════════════════════════════════════════════
  section('iOS · lo que se ancla arriba respeta el notch');
  const notch = await d.ev(() => {
    let regla = '';
    for (const hoja of document.styleSheets) {
      let reglas; try { reglas = hoja.cssRules; } catch (e) { continue; }
      for (const r of reglas) {
        if (r.selectorText === '.update-banner') regla = r.style.top;
      }
    }
    return regla;
  });
  is(/safe-area-inset-top/.test(notch), `el aviso de actualización descuenta el notch (${notch})`);

  section('ERRORES · JS durante toda la corrida');
  eq(d.errors, [], 'ningún error de página');

  console.log(`\n${'─'.repeat(52)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  await browser.close();
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error('ERROR:', e); process.exit(2); });
