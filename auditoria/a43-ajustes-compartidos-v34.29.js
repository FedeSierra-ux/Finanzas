// v34.29: ítems 64 y 69 de la auditoría v34.25, en contexto iPhone, tema claro y oscuro:
//   · 64 Ajustes en lenguaje de usuario: tres bloques ("Mi sincronización",
//     "Gastos compartidos con <pareja>", "Avisos") y lo técnico (ID y clave,
//     servidor de avisos, VAPID, clave de Anthropic) dentro de un "Avanzado"
//     plegable; la clave de Anthropic ya no abre Ajustes. Los id de los campos
//     y las funciones que los usan no cambian, y un campo requerido vacío abre
//     el Avanzado para mostrar el aviso.
//   · 69 estado vacío de Compartidos con acción: explica qué es y cómo empezar
//     ("Tocá ＋ y marcá «Compartido»", con un botón que abre el alta con
//     Compartido marcado) y, sin bin ni pareja vinculada, "Vinculá a tu pareja"
//     que lleva a Ajustes › Gastos compartidos.
// Con la v34.28 casi todo termina en ✗. A43_SHOTS=/ruta guarda capturas.
const L = require('./lib');

const iphone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' };
const SHOTS = process.env.A43_SHOTS || '';

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const f = new Date(), M = f.getMonth(), Y = f.getFullYear();
  const d = await L.device(browser, { myName: 'fede', compBin: 'bin43', contexto: iphone, seed: {
    accounts: [{ id: 'a1', name: 'Galicia', type: 'bancaria', amount: 150000, currency: 'ARS' }],
    gastos: [{ id: 'g1', desc: 'Verdulería', cat: 'super', amount: 6712, month: M, year: Y, day: 1, addedAt: Date.now() }],
  } });
  const P = d.page;
  const wait = ms => P.waitForTimeout(ms);
  const shot = async n => { if (SHOTS) await P.screenshot({ path: `${SHOTS}/a43-${n}.png` }); };
  const cerrar = () => d.ev(() => { document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open')); $('sync-modal-ov').classList.add('hidden'); document.querySelectorAll('.ferr').forEach(e => e.remove()); document.querySelectorAll('.field-error').forEach(e => e.classList.remove('field-error')); const a = document.getElementById('sync-avanzado'); if (a) a.open = false; });
  const tema = t => d.ev(t => { localStorage.setItem('fin_theme', t); applyTheme(); }, t);
  // Visible = ocupa lugar y no está dentro de un <details> cerrado (Chromium lo
  // oculta con content-visibility, que igual deja rects con medida).
  const VIS = `(el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.closest('details:not([open])'); }`;
  const IDS_TECNICOS = ['sync-bin-id', 'sync-api-key', 'comp-bin-id', 'comp-api-key', 'push-worker-url', 'push-vapid-key', 'claude-api-key'];
  // Mide todo lo tocable de Ajustes: sin desbordes a los costados y ≥ 44 px de alto.
  const medir = () => d.ev(([VIS]) => { const vis = eval(VIS); const ov = document.querySelector('#sync-modal-ov');
    const body = $('sync-modal-body'); const bt = body.getBoundingClientRect();
    const tocables = [...ov.querySelectorAll('button, summary, label.sync-action-btn')].filter(vis).map(b => { const r = b.getBoundingClientRect();
      return { t: (b.textContent || '').trim().slice(0, 28), h: Math.round(r.height), w: Math.round(r.width) }; });
    const fuera = [...ov.querySelectorAll('.sync-modal-body *')].filter(vis).filter(e => { const r = e.getBoundingClientRect(); return r.right > bt.right + 0.5 || r.left < bt.left - 0.5; }).map(e => e.tagName + '.' + (e.className || e.id)).slice(0, 5);
    return { bajos: tocables.filter(x => x.h < 44), n: tocables.length, scrollX: body.scrollWidth > body.clientWidth + 1, fuera }; }, [VIS]);

  for (const th of ['dark', 'light']) {
    await tema(th);
    L.section(`64 · Ajustes en lenguaje de usuario (tema ${th === 'dark' ? 'oscuro' : 'claro'})`);
    await d.ev(() => { goTo('saldos'); openSyncModal(); }); await wait(400);
    const a = await d.ev(([VIS, IDS]) => { const vis = eval(VIS); const ov = $('sync-modal-ov'); const txt = ov.innerText;
      const lbls = [...ov.querySelectorAll('.sync-section-lbl')].filter(vis).map(e => e.textContent.trim());
      const adv = document.getElementById('sync-avanzado');
      return { txt, lbls, adv: !!adv, advTag: adv && adv.tagName, advAbierto: adv && adv.open, ocultos: IDS.map(i => [i, !!$(i) && !vis($(i)), !!(adv && adv.contains($(i)))]),
        sum: adv && adv.querySelector('summary') && adv.querySelector('summary').textContent.trim() }; }, [VIS, IDS_TECNICOS]);
    L.is(/Mi sincronización/i.test(a.txt) && /Gastos compartidos con Mile/i.test(a.txt) && /Avisos/i.test(a.txt), 'tres bloques: "Mi sincronización", "Gastos compartidos con Mile" y "Avisos"');
    const pos = x => a.lbls.findIndex(l => new RegExp(x, 'i').test(l));
    L.is(pos('Mi sincronización') >= 0 && pos('Mi sincronización') < pos('Gastos compartidos con Mile') && pos('Gastos compartidos con Mile') < pos('Avisos'), `en ese orden (${a.lbls.join(' | ')})`);
    L.is(pos('Mi sincronización') === 0, 'y "Mi sincronización" es lo primero (no la clave de Anthropic)');
    L.is(a.adv && a.advTag === 'DETAILS' && !a.advAbierto && /Avanzado/.test(a.sum), `hay un "Avanzado" plegable y arranca cerrado ("${a.sum}")`);
    L.is(a.ocultos.every(([, oculto, dentro]) => oculto && dentro), 'ID y clave, servidor de avisos, VAPID y clave de Anthropic están dentro del Avanzado, sin verse');
    L.is(!/Clave de Anthropic|VAPID|Cloudflare|JSONBin|Bin ID|API Key/.test(a.txt), 'con el Avanzado cerrado no se leen los campos técnicos (clave de Anthropic, VAPID, Cloudflare, JSONBin)');
    L.is(/Mercado Pago/.test(a.txt) && /Excel/.test(a.txt), 'los botones de importar Mercado Pago y Excel siguen a la vista');
    const m1 = await medir();
    L.is(!m1.scrollX && !m1.fuera.length, `sin desbordes con el Avanzado cerrado (${m1.fuera.join(',')})`);
    L.is(m1.bajos.length === 0, `todo lo tocable mide ≥ 44 px con el Avanzado cerrado (${m1.n}; bajos: ${m1.bajos.map(b => b.t + ' ' + b.h).join(', ')})`);
    await shot(`ajustes-${th}-1`);
    await d.ev(() => $('sync-modal-body').scrollTo(0, 99999)); await wait(100); await shot(`ajustes-${th}-fin`);

    // Abrir el Avanzado
    await d.ev(() => { document.getElementById('sync-avanzado').open = true; }); await wait(200);
    const b = await d.ev(([VIS, IDS]) => { const vis = eval(VIS); return { vistos: IDS.map(i => [i, vis($(i))]), txt: $('sync-modal-ov').innerText }; }, [VIS, IDS_TECNICOS]);
    L.is(b.vistos.every(([, v]) => v), `abierto, se ven los siete campos (${b.vistos.filter(([, v]) => !v).map(([i]) => i).join(',')})`);
    L.is(/Mi ID de sincronización/.test(b.txt) && /ID de sincronización compartidos/.test(b.txt) && /Clave compartidos/.test(b.txt) && /VAPID Public Key/.test(b.txt) && /Clave de Anthropic/.test(b.txt), 'con sus rótulos de siempre');
    const m2 = await medir();
    L.is(!m2.scrollX && !m2.fuera.length, `sin desbordes con el Avanzado abierto (${m2.fuera.join(',')})`);
    L.is(m2.bajos.length === 0, `y todo lo tocable ≥ 44 px (${m2.n}; bajos: ${m2.bajos.map(x => x.t + ' ' + x.h).join(', ')})`);
    await d.ev(() => $('comp-bin-id').scrollIntoView({ block: 'center' })); await wait(150); await shot(`avanzado-${th}`);
    await cerrar();
  }

  L.section('64 · Los campos y las funciones siguen andando desde el Avanzado');
  {
    await d.ev(() => { localStorage.removeItem('fin_sync_bin_id'); openSyncModal(); }); await wait(300);
    // Campo requerido vacío: el aviso tiene que verse (abre el Avanzado)
    const r = await d.ev(([VIS]) => { const vis = eval(VIS); $('sync-bin-id').value = ''; saveSyncConfig(); const e = $('sync-bin-id').closest('.sync-field').querySelector('.ferr');
      return { msg: e && e.textContent, abierto: $('sync-avanzado').open, visible: vis($('sync-bin-id')) && !!e && vis(e) }; }, [VIS]);
    L.is(r.msg === 'Ingresá el ID de sincronización' && r.abierto && r.visible, `guardar sin ID abre el Avanzado y el aviso se ve ("${r.msg}")`);
    await cerrar(); await d.ev(() => openSyncModal()); await wait(200);
    const s = await d.ev(() => { $('sync-bin-id').value = 'binX43'; $('sync-api-key').value = 'claveX43'; saveSyncConfig();
      $('comp-bin-id').value = 'comp43'; $('comp-api-key').value = 'k43';
      $('push-worker-url').value = 'w43.workers.dev'; $('push-vapid-key').value = 'BNk43'; savePushConfig();
      $('claude-api-key').value = 'sk-ant-43'; $('claude-key-remember').checked = true; saveClaudeApiKey();
      return { bin: localStorage.getItem('fin_sync_bin_id') || getSyncCfg().binId, key: getSyncCfg().apiKey, worker: getPushWorkerUrl(), vapid: localStorage.getItem(PUSH_VAPID_KEY), anth: getClaudeApiKey(), status: $('sync-status-box').textContent }; });
    L.is(s.bin === 'binX43' && s.key === 'claveX43', 'Guardar de "Mi sincronización" guarda el ID y la clave');
    L.is(s.worker === 'https://w43.workers.dev' && s.vapid === 'BNk43', 'Guardar del servidor de avisos guarda la URL (con https) y la VAPID');
    L.eq(s.anth, 'sk-ant-43', 'la clave de Anthropic se guarda');
    L.is(/Guardado/.test(s.status), `y el estado de la sincronización lo dice ("${s.status.slice(0, 40)}")`);
    await d.ev(() => saveCompBinConfig()); await wait(200);
    L.is(await d.ev(() => compBinConfigured() && localStorage.getItem(COMP_BIN_KEY) === 'comp43'), 'Guardar de compartidos guarda el ID y la clave');
    await d.ev(() => { localStorage.setItem(COMP_BIN_KEY, 'bin43'); localStorage.setItem(COMP_AKEY_KEY, 'k'); }); await cerrar();
  }

  L.section('64 · El nombre de la pareja sale del que ya usa la app');
  {
    await d.ev(() => { localStorage.setItem('fin_my_name', 'mile'); openSyncModal(); }); await wait(300);
    const t1 = await d.ev(() => $('sync-modal-ov').innerText);
    L.is(/Gastos compartidos con Fede/i.test(t1) && !/Gastos compartidos con Mile/i.test(t1), 'si sos Mile, el bloque dice "Gastos compartidos con Fede"');
    await d.ev(() => $('sync-myname-fede').click()); await wait(100);
    L.is(/Gastos compartidos con Mile/i.test(await d.ev(() => $('sync-modal-ov').innerText)), 'y al cambiar "Mi nombre" a Fede se actualiza a "con Mile"');
    await cerrar();
  }

  for (const th of ['dark', 'light']) {
    await tema(th);
    L.section(`69 · Estado vacío de Compartidos (tema ${th === 'dark' ? 'oscuro' : 'claro'})`);
    // Sin bin ni pareja vinculada y sin gastos compartidos
    await d.ev(() => { localStorage.removeItem(COMP_BIN_KEY); localStorage.removeItem(COMP_AKEY_KEY); localStorage.removeItem(PARTNER_BIN_KEY); S.gastos = S.gastos.filter(g => !g.shared); save(); goTo('compartidos'); renderCompartidos(); });
    await wait(500);
    const e = await d.ev(([VIS]) => { const vis = eval(VIS); const el = document.querySelector('#compartidos-list .sh-vacio'); if (!el) return null;
      const bs = [...el.querySelectorAll('button')].map(b => ({ t: b.textContent.trim(), h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width), vis: vis(b) }));
      const r = el.getBoundingClientRect();
      return { txt: el.innerText, bs, dentro: r.left >= 0 && r.right <= innerWidth, scrollX: document.documentElement.scrollWidth > innerWidth, vinculado: false }; }, [VIS]);
    L.is(!!e, 'Compartidos sin gastos muestra el estado vacío con explicación');
    if (e) {
      L.is(/Tocá ＋ y marcá «Compartido»|Tocá \+ y marcá «Compartido»/.test(e.txt), `dice cómo empezar ("${e.txt.replace(/\s+/g, ' ').slice(0, 90)}")`);
      L.is(/Mile/.test(e.txt) && /debés|te debe/.test(e.txt), 'y qué se va a ver (cuánto le debés a Mile y cuánto te debe)');
      L.is(e.bs.some(b => /Cargar.*compartido/i.test(b.t)) && e.bs.some(b => /Vinculá a tu pareja/.test(b.t)), `hay un botón para cargar y, sin vincular, "Vinculá a tu pareja" (${e.bs.map(b => b.t).join(' | ')})`);
      L.is(e.bs.every(b => b.vis && b.h >= 44), `los botones miden ≥ 44 px (${e.bs.map(b => b.h).join(',')})`);
      L.is(e.dentro && !e.scrollX, 'sin desbordes');
    }
    await shot(`vacio-sin-vincular-${th}`);
    // "Vinculá a tu pareja" lleva a Ajustes › Gastos compartidos
    await d.ev(() => { [...document.querySelectorAll('#compartidos-list .sh-vacio button')].find(b => /Vinculá/.test(b.textContent)).click(); }); await wait(500);
    const v = await d.ev(([VIS]) => { const vis = eval(VIS); const ov = $('sync-modal-ov'), c = $('comp-bin-id').getBoundingClientRect(), bt = $('sync-modal-body').getBoundingClientRect();
      return { abierto: !ov.classList.contains('hidden'), adv: $('sync-avanzado').open, campo: vis($('comp-bin-id')), enPantalla: c.top >= bt.top - 1 && c.bottom <= bt.bottom + 1 }; }, [VIS]);
    L.is(v.abierto && v.adv && v.campo && v.enPantalla, `abre Ajustes con el ID de compartidos a la vista (abierto ${v.abierto}, Avanzado ${v.adv}, campo ${v.campo}, en pantalla ${v.enPantalla})`);
    await shot(`vinculá-${th}`);
    await cerrar();
    // Con bin vinculado: sin "Vinculá", y "Cargar" abre el alta con Compartido marcado
    await d.ev(() => { localStorage.setItem(COMP_BIN_KEY, 'bin43'); localStorage.setItem(COMP_AKEY_KEY, 'k'); goTo('compartidos'); renderCompartidos(); }); await wait(600);
    const e2 = await d.ev(() => { const el = document.querySelector('#compartidos-list .sh-vacio'); return el && { bs: [...el.querySelectorAll('button')].map(b => b.textContent.trim()), txt: el.innerText }; });
    L.is(e2 && e2.bs.length === 1 && !/Vinculá/.test(e2.bs.join()), `con la pareja vinculada queda solo "${e2 && e2.bs.join(' | ')}"`);
    await shot(`vacio-vinculado-${th}`);
    await d.ev(() => { [...document.querySelectorAll('#compartidos-list .sh-vacio button')].find(b => /Cargar/.test(b.textContent)).click(); }); await wait(400);
    const g = await d.ev(() => { const o = document.querySelector('#ov-gasto') || document.querySelector('.overlay.open'); return { abierto: !!document.querySelector('.overlay.open') && $('gdesc') && $('gdesc').offsetParent !== null, compartido: _gShared === true, campos: !$('g-shared-fields').classList.contains('hidden') }; });
    L.is(g.abierto && g.compartido && g.campos, `"Cargar un gasto compartido" abre el alta con Compartido marcado (abierto ${g.abierto}, compartido ${g.compartido}, campos ${g.campos})`);
    await shot(`alta-compartido-${th}`);
    await cerrar();
  }

  L.section('69 · Con gastos compartidos del mes no aparece el estado vacío; en otro mes sí, sin "primero"');
  {
    await tema('dark');
    await d.ev(([M, Y]) => { S.gastos.push({ id: 'gs43', desc: 'Cena', cat: 'salidas', amount: 18000, month: M, year: Y, day: 1, addedAt: Date.now(), shared: { active: true, paidBy: 'mile', splitPct: 50 } }); save(); goTo('compartidos'); renderCompartidos(); }, [M, Y]);
    await wait(500);
    L.eq(await d.ev(() => !!document.querySelector('#compartidos-list .sh-vacio')), false, 'con un gasto compartido en el mes no hay estado vacío');
    await d.ev(() => { setGastosMonth ? setGastosMonth(new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1, new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear()) : 0; renderCompartidos(); }); await wait(500);
    const o = await d.ev(() => { const el = document.querySelector('#compartidos-list .sh-vacio'); return el && el.innerText; });
    L.is(o && !/Todavía no compartieron/.test(o) && /Sin gastos compartidos en/.test(o), `en un mes sin gastos (pero con otros) dice cuál mes ("${(o || '').split('\n')[0]}")`);
  }

  L.eq(d.errors, [], 'sin errores de JS');
  await d.close();
  await browser.close();
  console.log(`\n${'─'.repeat(50)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
