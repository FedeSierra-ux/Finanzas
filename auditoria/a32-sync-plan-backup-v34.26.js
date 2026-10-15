// Ítems 98, 100 y 101 de la auditoría v34.25: merge por ítem del Plan y la
// Agenda entre dos teléfonos del MISMO usuario (mismo bin personal), importar
// un backup con "Fusionar" conservando lo local más nuevo, y la key de
// Anthropic que no queda en localStorage sin "Recordar". Con la v34.25 las
// secciones 1 a 3 terminan en ✗.
const L = require('./lib');

const sinAutoSync = d => d.ev(() => { if (typeof _sharedAutoTimer !== 'undefined' && _sharedAutoTimer) { clearInterval(_sharedAutoTimer); _sharedAutoTimer = null; } });
const nuevo = async (browser, opts) => { const d = await L.device(browser, opts); await sinAutoSync(d); return d; };
const esperarApp = async d => {
  await d.page.waitForFunction(() => typeof S === 'object' && S !== null && typeof save === 'function' && typeof syncCompartidos === 'function');
  await d.page.waitForTimeout(500);
  await sinAutoSync(d);
};
// Sync personal (bin propio) del mismo usuario en un dispositivo.
const conBinPersonal = (d, bin) => d.ev(bin => { localStorage.setItem('fin_sync_bin_id', bin); localStorage.setItem('fin_sync_api_key', 'k'); }, bin);
const subir = async d => { await d.ev(() => syncPush(true)); await d.page.waitForTimeout(300); };
// Bajar y, si hay banner de conflicto (lo local está sucio), elegir "Usar nube":
// es el camino que pasa por applyPayload y su merge.
const bajar = async d => {
  await d.ev(() => syncPull(true)); await d.page.waitForTimeout(400);
  await d.ev(() => { if (_conflictCloudPayload) resolveConflict(true); });
  await d.page.waitForTimeout(600);
};

(async () => {
  const browser = await L.launch();

  // ── 1 · Plan editado en A y Agenda editada en B ───────────────────────────
  L.resetBins();
  L.section('1 · Plan editado en A y Agenda editada en B en la misma ventana: los dos terminan con los dos cambios');
  const A = await nuevo(browser, { myName: 'fede', compBin: 'cb32' });
  await conBinPersonal(A, 'sb32');
  await A.ev(() => {
    S.plan = [{ id: 'p1', name: 'Luz', cat: 'gasto', months: { [pkNow()]: 1000 }, order: 1 }, { id: 'p2', name: 'Gas', cat: 'gasto', months: { [pkNow()]: 500 }, order: 2 }];
    S.agenda = { subs: [{ id: 's1', name: 'Netflix', amount: 5000, date: '2026-11-01', period: 'mensual' }], vencimientos: [], cuotas: [], inversiones: [] };
    save();
  });
  await subir(A);
  const B = await nuevo(browser, { myName: 'fede', compBin: 'cb32' });
  await conBinPersonal(B, 'sb32');
  await B.ev(() => { S.gastos = []; S.plan = []; S.agenda = { subs: [], vencimientos: [], cuotas: [], inversiones: [] }; persistJsonStorage('fin_v6', S); localStorage.removeItem('fin_sync_dirty_ts'); });
  await bajar(B);
  L.is(await B.ev(() => ['p1', 'p2'].every(id => S.plan.some(p => p.id === id)) && S.agenda.subs.length === 1), 'B bajó el Plan y la Agenda que subió A');
  // A renombra un concepto del Plan por la UI; B renombra la suscripción por la UI.
  await A.ev(() => { openEditProj(S.plan.find(p => p.id === 'p1')); $('ep-name').value = 'Luz editada en A'; doSaveEditProj(); });
  L.is(await A.ev(() => { const p = S.plan.find(x => x.id === 'p1'); return p.name === 'Luz editada en A' && p.updatedAt > 0; }), 'A: el concepto quedó renombrado y con sello (updatedAt)');
  await B.ev(() => { editAgenda('sub', 's1'); $('ag-name').value = 'Netflix editada en B'; doSaveAgenda(); });
  L.is(await B.ev(() => { const s = S.agenda.subs.find(x => x.id === 's1'); return s.name === 'Netflix editada en B' && s.updatedAt > 0; }), 'B: la suscripción quedó renombrada y con sello');
  await subir(A);
  await bajar(B);
  // `dup`: la fila del Plan que ensureAgendaInPlan crea sola para la suscripción
  // nace con otro id en cada teléfono; después del merge tiene que quedar una.
  const estado = d => d.ev(() => { const n = S.plan.map(p => p.name.toLowerCase().trim()); return { plan: S.plan.find(p => p.id === 'p1')?.name, sub: S.agenda.subs.find(s => s.id === 's1')?.name, dup: new Set(n).size !== n.length }; });
  L.eq(await estado(B), { plan: 'Luz editada en A', sub: 'Netflix editada en B', dup: false }, 'B: tiene el Plan que editó A y la Agenda que editó él, sin filas repetidas');
  await subir(B);
  await bajar(A);
  L.eq(await estado(A), { plan: 'Luz editada en A', sub: 'Netflix editada en B', dup: false }, 'A: tiene su Plan y la Agenda que editó B, sin filas repetidas');
  L.eq(A.errors, [], 'A sin errores de JS');
  L.eq(B.errors, [], 'B sin errores de JS');

  // ── 2 · Borrar en un teléfono no resucita desde el otro ──────────────────
  L.section('2 · Un concepto borrado en A (y una suscripción borrada en B) no vuelven desde el otro teléfono');
  await A.ev(() => deletePlanItemWithSync('p2', 'Gas'));
  L.is(await A.ev(() => !S.plan.some(p => p.id === 'p2') && (S.planBorrados || []).some(t => t.id === 'p2')), 'A: borró Gas y dejó la marca en planBorrados');
  await subir(A);
  // B todavía lo tiene y además guardó algo (está sucio: baja por el banner).
  await B.ev(() => { S.gastos.push({ id: 'gB', desc: 'Gasto de B', cat: 'comida', amount: 1, month: 9, year: 2026, day: 1, addedAt: Date.now() }); save(); });
  await bajar(B);
  L.is(await B.ev(() => !S.plan.some(p => p.id === 'p2') && S.plan.some(p => p.id === 'p1')), 'B: Gas no reapareció al bajar (y Luz sigue)');
  await subir(B);
  await bajar(A);
  L.is(await A.ev(() => !S.plan.some(p => p.id === 'p2')), 'A: Gas tampoco vuelve desde lo que subió B');
  L.is(await A.ev(() => S.gastos.some(g => g.id === 'gB')), 'A: y sí le llegó el gasto de B');
  await B.ev(() => delAgenda('sub', 's1'));
  L.is(await B.ev(() => !S.agenda.subs.length && (S.agendaBorrados || []).some(t => t.id === 's1')), 'B: borró la suscripción y dejó la marca en agendaBorrados');
  await subir(B);
  await A.ev(() => { S.gastos.push({ id: 'gA2', desc: 'Gasto de A', cat: 'comida', amount: 2, month: 9, year: 2026, day: 2, addedAt: Date.now() }); save(); });
  await bajar(A);
  L.is(await A.ev(() => !S.agenda.subs.some(s => s.id === 's1')), 'A: la suscripción borrada en B no vuelve');
  // Deshacer el borrado en B la sella después de la marca: vuelve en los dos.
  await B.ev(() => { S.agenda.subs.push(stampAgenda({ id: 's1', name: 'Netflix deshecha', amount: 5000, date: '2026-11-01', period: 'mensual' })); unmarkBorrado('agendaBorrados', 's1'); save(); });
  await subir(B);
  await bajar(A);
  L.is(await A.ev(() => S.agenda.subs.some(s => s.id === 's1' && s.name === 'Netflix deshecha')), 'A: una suscripción rehecha después de la marca sí llega');
  L.eq(A.errors, [], 'A sin errores de JS');
  L.eq(B.errors, [], 'B sin errores de JS');
  await A.close(); await B.close();

  // ── 3 · Importar backup con "Fusionar" ────────────────────────────────────
  L.section('3 · Importar un backup con "Fusionar": vista previa, lo local más nuevo se queda y no recarga');
  const C = await nuevo(browser, { myName: 'fede', compBin: 'cbC' });
  const ahora = Date.now();
  await C.ev(ahora => {
    S.gastos = [{ id: 'g1', desc: 'Gasto local', cat: 'comida', amount: 100, month: 9, year: 2026, day: 2, addedAt: ahora }];
    S.accounts = [{ id: 'acc1', name: 'Galicia', type: 'bancaria', amount: 111, currency: 'ARS', updatedAt: ahora }];
    S.plan = [{ id: 'p1', name: 'Luz local más nueva', cat: 'gasto', months: {}, order: 1, updatedAt: ahora }, { id: 'p3', name: 'Solo local', cat: 'gasto', months: {}, order: 2 }];
    S.agenda = { subs: [{ id: 's1', name: 'Netflix local vieja', amount: 1, date: '2026-11-01', period: 'mensual', updatedAt: ahora - 7200000 }], vencimientos: [], cuotas: [], inversiones: [] };
    save();
    window.__vivo = 'sí';
    window.__confirms = [];
    window.appConfirm = o => { window.__confirms.push(o); return Promise.resolve(true); };
  }, ahora);
  const backup = { _exportTs: ahora - 3600000, _version: '34.25', data: { fin_v6: JSON.stringify({
    tc: 1300,
    accounts: [{ id: 'acc1', name: 'Galicia', type: 'bancaria', amount: 999, currency: 'ARS', updatedAt: ahora - 3600000 }, { id: 'acc2', name: 'Solo backup', type: 'bancaria', amount: 5, currency: 'ARS' }],
    gastos: [{ id: 'g1', desc: 'Gasto local', cat: 'comida', amount: 100, month: 9, year: 2026, day: 2, addedAt: ahora }, { id: 'g2', desc: 'Gasto del backup', cat: 'comida', amount: 50, month: 8, year: 2026, day: 10, addedAt: ahora - 86400000 }],
    plan: [{ id: 'p1', name: 'Luz del backup', cat: 'gasto', months: {}, order: 1, updatedAt: ahora - 3600000 }, { id: 'p4', name: 'Solo backup', cat: 'gasto', months: {}, order: 3 }],
    agenda: { subs: [{ id: 's1', name: 'Netflix backup más nueva', amount: 2, date: '2026-11-01', period: 'mensual', updatedAt: ahora - 60000 }], vencimientos: [], cuotas: [], inversiones: [] },
    paymentMemory: {},
  }) } };
  const archivo = { name: 'finanzas-backup-2026-10-15.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) };
  await C.page.setInputFiles('input[onchange="importBackup(this)"]', archivo);
  await C.page.waitForTimeout(1200);
  const c1 = await C.ev(() => ({ vivo: window.__vivo, confirms: window.__confirms.map(o => ({ title: o.title, ok: o.okLabel, body: o.body })),
    plan: S.plan.map(p => p.id + ':' + p.name).sort(), sub: S.agenda.subs.map(s => s.name), accs: S.accounts.map(a => a.id + ':' + a.amount).sort(), gastos: S.gastos.map(g => g.id).sort(),
    guardado: JSON.parse(localStorage.getItem('fin_v6')).plan.map(p => p.name).sort(), toasts: window.__toasts.slice() }));
  L.eq(c1.confirms.length, 1, 'se pidió una sola confirmación');
  L.eq(c1.confirms[0]?.ok, 'Fusionar', 'el primer botón es "Fusionar"');
  L.is(/Backup del .* \(v34\.25\)/.test(c1.confirms[0]?.body || ''), 'la vista previa dice la versión y la fecha del backup');
  L.is(/Trae 2 gastos \(10\/09\/2026 → 02\/10\/2026\), 2 cuentas, 2 conceptos del Plan y 1 ítem de Agenda/.test(c1.confirms[0]?.body || ''), 'y cuenta lo que trae: gastos con su rango de fechas, cuentas, Plan y Agenda (' + (c1.confirms[0]?.body || '').slice(0, 160) + '…)');
  L.is(/Hoy tenés 1 gasto \(02\/10\/2026 → 02\/10\/2026\), 1 cuenta, 2 conceptos del Plan y 1 ítem de Agenda/.test(c1.confirms[0]?.body || ''), 'y lo compara con lo de hoy');
  L.eq(c1.vivo, 'sí', 'fusionar no recargó la app');
  L.eq(c1.plan, ['p1:Luz local más nueva', 'p3:Solo local', 'p4:Solo backup'], 'Plan: lo local más nuevo gana, y lo que solo está de un lado se suma');
  L.eq(c1.sub, ['Netflix backup más nueva'], 'Agenda: el ítem más nuevo del backup pisa al local viejo');
  L.eq(c1.accs, ['acc1:111', 'acc2:5'], 'Cuentas: el saldo local más nuevo se queda y la cuenta que solo trae el backup entra');
  L.eq(c1.gastos, ['g1', 'g2'], 'Gastos: por id, el que faltaba entra y el que ya estaba no se duplica');
  L.eq(c1.guardado, ['Luz local más nueva', 'Solo backup', 'Solo local'], 'y quedó guardado en localStorage sin recargar');
  L.is(c1.toasts.some(t => /Backup fusionado/.test(t)), 'el toast dice que se fusionó');
  // Cancelar el primer modal ofrece "Reemplazar todo"; aceptarlo pisa y recarga.
  await C.ev(() => { window.__confirms = []; let n = 0; window.appConfirm = o => { window.__confirms.push(o); return Promise.resolve(n++ > 0); }; });
  await C.page.setInputFiles('input[onchange="importBackup(this)"]', archivo);
  await C.page.waitForTimeout(900);
  const c2 = await C.ev(() => ({ confirms: window.__confirms.map(o => o.okLabel), vivo: window.__vivo }));
  L.eq(c2.confirms, ['Fusionar', 'Reemplazar todo'], 'cancelar "Fusionar" ofrece "Reemplazar todo"');
  await C.page.waitForTimeout(2200);
  await esperarApp(C);
  // (la fila "Netflix…" que aparece en el Plan la crea ensureAgendaInPlan al abrir: se mira por id)
  const c3 = await C.ev(() => ({ vivo: window.__vivo, plan: S.plan.filter(p => /^p\d$/.test(p.id)).map(p => p.id + ':' + p.name).sort(), gastos: S.gastos.map(g => g.id).sort() }));
  L.is(c3.vivo === undefined, 'reemplazar todo recargó la app');
  L.eq(c3.plan, ['p1:Luz del backup', 'p4:Solo backup'], 'y quedó exactamente lo del backup (sin "Solo local")');
  L.eq(c3.gastos, ['g1', 'g2'], 'con los gastos del backup');
  L.eq(C.errors, [], 'C sin errores de JS');
  // Tras la recarga hay que volver a capturar los toasts.
  await C.ev(() => { window.__toasts = []; const st = window.showToast; window.showToast = (m, a, b, c) => { window.__toasts.push(String(m)); return st(m, a, b, c); }; });

  // ── 4 · Key de Anthropic ──────────────────────────────────────────────────
  L.section('4 · La key de Anthropic no queda en localStorage sin "Recordar", se borra tras el import y va al Worker si lo hay');
  await C.ev(() => { openSyncModal(); $('claude-api-key').value = 'sk-ant-prueba'; $('claude-key-remember').checked = false; saveClaudeApiKey(); closeSyncModal(); });
  const k1 = await C.ev(() => ({ ls: localStorage.getItem('fin_apikey'), ss: sessionStorage.getItem('fin_apikey'), get: getClaudeApiKey() }));
  L.eq(k1, { ls: null, ss: 'sk-ant-prueba', get: 'sk-ant-prueba' }, 'sin "Recordar" la key queda solo en sessionStorage y la app la lee de ahí');
  await C.ev(() => { openSyncModal(); });
  L.eq(await C.ev(() => ({ v: $('claude-api-key').value, r: $('claude-key-remember').checked })), { v: 'sk-ant-prueba', r: false }, 'Ajustes la muestra con la casilla apagada');
  await C.ev(() => { $('claude-key-remember').checked = true; saveClaudeApiKey(); closeSyncModal(); });
  L.eq(await C.ev(() => ({ ls: localStorage.getItem('fin_apikey'), ss: sessionStorage.getItem('fin_apikey') })), { ls: 'sk-ant-prueba', ss: null }, 'con "Recordar" pasa a localStorage (y sale de la sesión)');
  await C.ev(() => { openSyncModal(); });
  L.eq(await C.ev(() => $('claude-key-remember').checked), true, 'y Ajustes muestra la casilla prendida');
  await C.ev(() => { $('claude-key-remember').checked = false; saveClaudeApiKey(); closeSyncModal(); });
  L.eq(await C.ev(() => localStorage.getItem('fin_apikey')), null, 'apagar "Recordar" la saca de localStorage');
  // Un import de Mercado Pago sin "Recordar" borra la key y lo avisa.
  await C.ev(() => { window.__toasts.length = 0; mpReviewItems = [{ selected: true, amount: 100, desc: 'Café', date: '2026-10-10', category: 'comida' }]; confirmMPImport(); });
  const k2 = await C.ev(() => ({ ss: sessionStorage.getItem('fin_apikey'), ls: localStorage.getItem('fin_apikey'), toast: window.__toasts.find(t => /importado/.test(t)) || '' }));
  L.eq(k2.ss, null, 'después del import la key ya no está en la sesión');
  L.eq(k2.ls, null, 'ni en localStorage');
  L.is(/se borró/.test(k2.toast), 'y el toast lo dice (' + k2.toast + ')');
  // Con "Recordar", el import no la borra.
  await C.ev(() => { localStorage.setItem('fin_apikey', 'sk-ant-prueba'); mpReviewItems = [{ selected: true, amount: 100, desc: 'Té', date: '2026-10-10', category: 'comida' }]; confirmMPImport(); });
  L.eq(await C.ev(() => localStorage.getItem('fin_apikey')), 'sk-ant-prueba', 'con "Recordar" el import no la toca');
  // Sin Worker: va directo a Anthropic con la key. Con Worker: a `${worker}/claude` sin key.
  await C.ev(() => {
    window.__calls = [];
    window.fetch = async (u, o) => { window.__calls.push({ u: String(u), h: (o && o.headers) || {}, body: o && o.body }); return new Response(JSON.stringify({ content: [{ type: 'text', text: '{"gastos":[{"desc":"Café","amount":100,"date":"2026-10-10","category":"comida"}]}' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
    localStorage.removeItem('fin_push_worker_url');
    mpFileData = 'AAAA'; mpFileType = 'image'; mpFileMimeType = 'image/png';
  });
  await C.ev(() => processMPWithClaude());
  const d1 = await C.ev(() => window.__calls.map(c => ({ u: c.u, key: c.h['x-api-key'] || null })));
  L.eq(d1, [{ u: 'https://api.anthropic.com/v1/messages', key: 'sk-ant-prueba' }], 'sin Worker la petición va directo a Anthropic con la key');
  await C.ev(() => { window.__calls = []; localStorage.setItem('fin_push_worker_url', 'https://worker.prueba.workers.dev/'); localStorage.removeItem('fin_apikey'); sessionStorage.removeItem('fin_apikey'); $('mp-error-msg').style.display = 'none'; });
  await C.ev(() => processMPWithClaude());
  const d2 = await C.ev(() => ({ calls: window.__calls.map(c => ({ u: c.u, key: c.h['x-api-key'] || null, model: JSON.parse(c.body).model })), error: $('mp-error-msg').style.display !== 'none' }));
  L.eq(d2.calls, [{ u: 'https://worker.prueba.workers.dev/claude', key: null, model: 'claude-opus-4-6' }], 'con Worker va a `${worker}/claude` sin key y con el mismo cuerpo');
  L.is(!d2.error, 'y no pide la key aunque no haya ninguna');
  L.eq(C.errors, [], 'C sin errores de JS');
  await C.close();

  await browser.close();
  console.log(`\n${'─'.repeat(50)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
