// Los arreglos de sync y datos de la v34.26 (auditoría de la v34.25), cada uno
// con la reproducción con la que se encontró. Con la v34.25 las secciones
// terminan en ✗.
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

(async () => {
  const browser = await L.launch();

  // ── BUG01 · Conflicto a la vista: el push automático no pisa la nube ─────
  {
    L.resetBins();
    L.section('BUG01 · Con el banner de conflicto a la vista, abrir la app no sube nada solo');
    // A (teléfono 1 de Fede) sube su estado.
    const A = await nuevo(browser, { myName: 'fede', compBin: 'cb1' });
    await conBinPersonal(A, 'sb1');
    await A.ev(() => {
      S.gastos = [{ id: 'gA', desc: 'Gasto de A', cat: 'comida', amount: 500, month: 9, year: 2026, day: 1, addedAt: Date.now() }];
      S.accounts[0].amount = 999999; stampAcc(S.accounts[0]); save();
    });
    await A.ev(() => syncPush(true));
    await A.page.waitForTimeout(300);
    await A.close(); // el push automático de A no tiene que confundir la medición
    const tsA = L.bins.sb1 && L.bins.sb1._syncTs, devA = L.bins.sb1 && L.bins.sb1._deviceId;
    L.is(!!tsA, 'A subió su estado a la nube');
    // B (teléfono 2 de Fede): datos más viejos, nada sin subir, mismo bin.
    const B = await nuevo(browser, { myName: 'fede', compBin: 'cb1' });
    await conBinPersonal(B, 'sb1');
    await B.ev(tsA => {
      localStorage.setItem('fin_sync_ts', String(tsA - 60000));
      S.gastos = [{ id: 'gB', desc: 'Gasto viejo de B', cat: 'comida', amount: 100, month: 9, year: 2026, day: 1, addedAt: Date.now() - 86400000 }];
      S.accounts[0].amount = 1; stampAcc(S.accounts[0]); S.accounts[0].updatedAt = tsA - 200000;
      persistJsonStorage('fin_v6', S);
      localStorage.setItem('fin_sync_dirty_ts', String(tsA - 120000));
    }, tsA);
    await B.page.reload();
    await esperarApp(B);
    await B.page.waitForTimeout(1000);
    const r1 = await B.ev(() => ({ dirty: Number(localStorage.getItem('fin_sync_dirty_ts')), syncTs: Number(localStorage.getItem('fin_sync_ts')),
      banner: !document.getElementById('sync-conflict-banner')?.classList.contains('hidden') }));
    L.is(r1.banner, 'B muestra el banner de conflicto (la nube es de otro dispositivo)');
    L.is(r1.dirty < r1.syncTs, 'abrir la app no marca el estado local como sucio (dirty ' + r1.dirty + ' < sync ' + r1.syncTs + ')');
    await B.page.waitForTimeout(4800);
    L.is(await B.ev(() => !document.getElementById('sync-conflict-banner')?.classList.contains('hidden')), 'el banner sigue en pantalla sin que el usuario haya elegido');
    L.eq(L.bins.sb1._deviceId, devA, 'la nube sigue siendo la versión de A');
    L.eq(L.bins.sb1._syncTs, tsA, 'B no subió nada al bin personal con el conflicto sin resolver');
    // Y aunque el usuario guarde algo mientras el banner está, tampoco sube.
    await B.ev(() => { S.gastos[0].desc = 'Gasto editado con el banner'; save(); });
    await B.page.waitForTimeout(4800);
    L.eq(L.bins.sb1._syncTs, tsA, 'un guardado con el banner a la vista tampoco dispara el push');
    // Elegir en el banner sí sube.
    await B.ev(() => resolveConflict(false));
    await B.page.waitForTimeout(800);
    L.is(L.bins.sb1._syncTs > tsA, 'resolver el conflicto ("conservar lo mío") sí sube');
    L.is(L.bins.sb1._deviceId !== devA, 'y la nube pasa a ser la de B');
    L.eq(B.errors, [], 'sin errores de JS');
    await B.close();
  }

  // ── BUG02 · Editar gasto (Gastos) con la pareja corrigiendo mientras tanto ─
  {
    L.resetBins();
    L.section('BUG02 · Editar gasto desde Gastos no pisa la corrección que la pareja hizo con el editor abierto');
    const fede = await nuevo(browser, { myName: 'fede', compBin: 'cb2' });
    const mile = await nuevo(browser, { myName: 'mile', compBin: 'cb2' });
    await fede.ev(() => { openGastoModal(); $('gdesc').value = 'Internet'; $('gamt').value = '30000'; $('g-shared-toggle').click(); doSaveGasto(); });
    await fede.settle(); await mile.settle();
    await mile.ev(() => fetchSharedBin()); await mile.settle();
    const idG = await fede.ev(() => S.gastos[0].id);
    L.eq(await mile.ev(id => (_sharedBinGastos.find(g => g.id === id) || {}).amount, idG), 30000, 'Mile ve $30.000');
    await fede.ev(id => openEditGasto(S.gastos.find(g => g.id === id)), idG);
    await mile.ev(id => { openEditSharedGasto({ id }); $('esg-amt').value = '40000'; doSaveEditShared(); }, idG);
    await mile.settle();
    await fede.ev(() => fetchSharedBin()); await fede.settle();
    L.eq(await fede.ev(id => S.gastos.find(g => g.id === id).amount, idG), 40000, 'a Fede le llegó el sync con el editor abierto');
    await fede.ev(() => { $('eg-desc').value = 'Internet fibra'; doSaveEditGasto(); });
    await fede.settle(); await mile.ev(() => fetchSharedBin()); await mile.settle();
    const f = await fede.ev(id => S.gastos.find(g => g.id === id), idG);
    const m = await mile.ev(id => _sharedBinGastos.find(g => g.id === id), idG);
    L.eq(f.desc, 'Internet fibra', 'Fede: descripción nueva');
    L.eq(f.amount, 40000, 'Fede: conserva el importe corregido por Mile');
    L.eq(m.amount, 40000, 'Mile: conserva su corrección');
    L.eq(m.desc, 'Internet fibra', 'Mile: recibe la descripción nueva');
    L.eq([f.shared.paidBy, f.shared.splitPct], ['fede', 50], 'el reparto no cambió');
    // Y lo que sí se toca, se guarda (también el reparto y pasar a no compartido).
    await fede.ev(id => { openEditGasto(S.gastos.find(g => g.id === id)); $('eg-amt').value = '45000'; pickEGSplitSolo('mile'); doSaveEditGasto(); }, idG);
    await fede.settle();
    const f2 = await fede.ev(id => S.gastos.find(g => g.id === id), idG);
    L.eq([f2.amount, f2.shared.splitPct, f2.shared.paidBy], [45000, 0, 'fede'], 'cambiar importe y reparto sí se guarda');
    L.eq(fede.errors, [], 'sin errores de JS');
    await fede.close(); await mile.close();
  }

  // ── BUG03 · Plan a la vista + bajada de la nube ───────────────────────────
  {
    L.resetBins();
    L.section('BUG03 · Una bajada de la nube con el Plan a la vista no pierde lo tipeado en una celda');
    const d = await nuevo(browser, { myName: 'fede', compBin: 'cb3' });
    const r = await d.ev(() => {
      S.plan = [{ id: 'p1', name: 'Alquiler', cat: 'gasto', months: {}, order: 1 }];
      const k = pkAdd(pkNow(), 2);
      S.plan[0].months[k] = 100000;
      save();
      goTo('agenda'); switchAgendaTab('plan');
      applyPayload({ _syncTs: Date.now(), fin_v6: JSON.parse(JSON.stringify(S)) });
      const tr = document.querySelector('#ptable tr.data-r[data-id="p1"]');
      const inp = tr.querySelectorAll('input.tainp')[2];
      inp.dispatchEvent(new Event('focus'));
      inp.value = '120000';
      inp.dispatchEvent(new Event('change'));
      _flushPendingSave();
      return { guardado: S.plan[0].months[k], enStorage: JSON.parse(localStorage.getItem('fin_v6')).plan[0].months[k],
        enPantalla: document.querySelector('#ptable tr.data-r[data-id="p1"]').querySelectorAll('input.tainp')[2].value };
    });
    L.eq(r.guardado, 120000, 'S.plan tiene el valor tipeado');
    L.eq(r.enStorage, 120000, 'localStorage tiene el valor tipeado');
    L.is(/120/.test(r.enPantalla), 'la tabla muestra el valor tipeado: ' + r.enPantalla);
    L.eq(d.errors, [], 'sin errores de JS');
    await d.close();
  }

  // ── BUG10 · Faltantes del snapshot con gastos archivados ─────────────────
  {
    L.resetBins();
    L.section('BUG10 · "Faltantes" del snapshot no cuenta los gastos archivados en IndexedDB');
    const d = await nuevo(browser, { myName: 'fede', compBin: 'cb10' });
    const r = await d.ev(async () => {
      const g = { id: 'viejo1', desc: 'Cena vieja', cat: 'comida', amount: 1000, month: 0, year: 2024, day: 5, addedAt: new Date(2024, 0, 5, 12).getTime() };
      S.gastos = [g]; save();
      _runAutoBackupGastos();
      _archivoMem = [JSON.parse(JSON.stringify(g))];
      S.gastos = []; save();
      window.appConfirm = async o => { window.__conf = o; return false; };
      window.__toasts.length = 0;
      await restoreGastosBakMerge(0);
      return { body: window.__conf && window.__conf.body, toasts: window.__toasts.slice(), visible: _getMergedGastos(0, 2024).length };
    });
    L.eq(r.visible, 1, 'el gasto archivado se sigue viendo en Gastos');
    L.is(!r.body, 'no ofrece recuperar nada' + (r.body ? ' — ofreció: ' + r.body : ''));
    L.is(r.toasts.some(t => /No falta nada/.test(t)), 'avisa "No falta nada de ese snapshot"');
    L.eq(d.errors, [], 'sin errores de JS');
    await d.close();
  }

  // ── BUG11 · Última categoría elegida ──────────────────────────────────────
  {
    L.section('BUG11 · El alta de gasto arranca en la última categoría elegida');
    const d = await nuevo(browser, { myName: 'fede', compBin: 'cb11' });
    const r = await d.ev(() => {
      openGastoModal();
      pickGCat(document.querySelector('#gcats .chip[data-v="super"]'));
      closeOv('ov-gasto');
      openGastoModal();
      const reabierta = gCat;
      closeOv('ov-gasto');
      localStorage.setItem('fin_last_gcat', 'categoria_que_no_existe');
      openGastoModal();
      const inexistente = gCat;
      closeOv('ov-gasto');
      return { reabierta, inexistente };
    });
    L.eq(r.reabierta, 'super', 'al reabrir el alta arranca en la última categoría (super)');
    L.eq(r.inexistente, 'comida', 'una categoría guardada que ya no existe cae en comida');
    L.eq(d.errors, [], 'sin errores de JS');
    await d.close();
  }

  // ── BUG12 · Export de control con la misma cuenta que el saldo ───────────
  {
    L.resetBins();
    L.section('BUG12 · "Exportar datos de control" recalcula el saldo con la misma cuenta que la app');
    const d = await nuevo(browser, { myName: 'fede', compBin: 'cb12' });
    const r = await d.ev(() => {
      const f = new Date();
      const g = (id, amount, paidBy, splitPct) => ({ id, desc: id, cat: 'comida', amount, month: f.getMonth(), year: f.getFullYear(), day: 1,
        addedAt: new Date(f.getFullYear(), f.getMonth(), 1, 12).getTime(), shared: { active: true, paidBy, splitPct } });
      S.gastos = [g('a', 10001, 'fede', 50), g('b', 100.5, 'mile', 50), g('c', 333, 'fede', 50), g('d', 999, 'mile', 30)];
      save();
      exportCompartidosData();
      const data = JSON.parse($('comp-export-json').value);
      return { saldo: data.saldo.valor, re: data.saldo.recalculadoDesdeElDesglose, coincide: data.saldo.coincide };
    });
    L.is(r.coincide, 'el saldo recalculado coincide con el que muestra la app (' + r.saldo + ' vs ' + r.re + ')');
    // Parte del que pagó redondeada al peso: 10001→5001, 100,5→50, 333→167, 999·30%→300.
    L.eq(r.saldo, (10001 - 5001) - (100.5 - 50) + (333 - 167) - (999 - 300), 'y es el saldo esperado a mano');
    L.eq(d.errors, [], 'sin errores de JS');
    await d.close();
  }

  // ── BUG14 · showToast con duración ────────────────────────────────────────
  {
    L.section('BUG14 · showToast(msg, tipo, ms) respeta la duración');
    const d = await nuevo(browser, { myName: 'fede', compBin: 'cb14' });
    await d.ev(() => showToast('Corto', 'warning', 800));
    await d.page.waitForTimeout(1300);
    L.is(!(await d.ev(() => $('toast-bar').classList.contains('show'))), 'un toast de 800 ms ya no está a los 1,3 s');
    await d.ev(() => showToast('Largo', 'error', 7000));
    await d.page.waitForTimeout(5200);
    L.is(await d.ev(() => $('toast-bar').classList.contains('show') && $('toast-bar').classList.contains('toast-error')), 'uno de 7 s sigue a la vista a los 5,2 s, con su tipo');
    await d.ev(() => showToast('Normal', 'success'));
    await d.page.waitForTimeout(300);
    L.is(await d.ev(() => $('toast-bar').classList.contains('show') && $('toast-bar').classList.contains('toast-success')), 'sin duración sigue andando igual');
    L.eq(d.errors, [], 'sin errores de JS');
    await d.close();
  }

  // ── BUG15 · Apagar los avisos vacía la cola del service worker ───────────
  {
    L.section('BUG15 · Apagar los avisos de vencimiento manda al SW la cola vacía');
    const d = await nuevo(browser, { myName: 'fede', compBin: 'cb15' });
    const r = await d.ev(async () => {
      window.__swMsgs = [];
      Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ active: { postMessage: m => window.__swMsgs.push(m) } }) } });
      window.Notification = { permission: 'granted' };
      window.syncAgendaToWorker = () => {};
      const f = new Date(); f.setDate(f.getDate() + 3);
      S.agenda.vencimientos = [{ id: 'v1', name: 'Luz', amount: 5000, date: `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}` }];
      save();
      persistJsonStorage('fin_notif_settings', { vencOn: true, vencTime: '23:59', vencDays: 1 });
      scheduleNotifications();
      await new Promise(r => setTimeout(r, 100));
      const conAvisos = window.__swMsgs.map(m => (m.items || []).length);
      window.__swMsgs.length = 0;
      $('notif-venc-on').checked = false;
      saveNotifSettings();
      await new Promise(r => setTimeout(r, 100));
      return { conAvisos, apagado: window.__swMsgs.map(m => ({ type: m.type, n: (m.items || []).length })) };
    });
    L.eq(r.conAvisos, [1], 'con los avisos prendidos el SW recibe la cola con el vencimiento');
    L.eq(r.apagado, [{ type: 'SYNC_NOTIF_QUEUE', n: 0 }], 'al apagarlos recibe la lista vacía (el SW hace store.clear())');
    L.eq(d.errors, [], 'sin errores de JS');
    await d.close();
  }

  // ── BUG18 · Marca vieja de cuota borrada contra la compra rehecha ─────────
  {
    L.resetBins();
    L.section('BUG18 · Una compra en cuotas rehecha desde el Plan en A sobrevive a la marca de "borrada" que guarda B');
    const A = await nuevo(browser, { myName: 'fede', compBin: 'cb18' });
    await conBinPersonal(A, 'sb18');
    // A tiene el gasto de la cuota 1/6 de "Tele" (fecha de ayer) y la compra en Agenda.
    await A.ev(() => {
      const f = new Date(); f.setDate(f.getDate() - 1);
      S.gastos = [{ id: 'gt1', desc: 'Tele (1/6)', cat: 'tarjeta', amount: 50000, cuotaTotal: 6, cuotaActual: 1, month: f.getMonth(), year: f.getFullYear(), day: f.getDate(),
        addedAt: new Date(f.getFullYear(), f.getMonth(), f.getDate(), 12).getTime() }];
      persistJsonStorage('fin_v6', S); load(); save();
    });
    L.is(await A.ev(() => !!cuotaDeGasto({ desc: 'Tele' })), 'A: la compra está en la Agenda');
    // A la borra desde la Agenda (queda la marca) y sube.
    await A.ev(() => { const cq = cuotaDeGasto({ desc: 'Tele' }); delAgenda('cuota', cq.id); });
    await A.ev(() => syncPush(true)); await A.page.waitForTimeout(300);
    L.is(await A.ev(() => !cuotaDeGasto({ desc: 'Tele' }) && cuotaBorradaAt('Tele') > 0), 'A: la compra se borró y quedó la marca');
    // B (mismo usuario, mismo bin, sin datos) baja ese estado: tiene el gasto y la marca.
    const B = await nuevo(browser, { myName: 'fede', compBin: 'cb18' });
    await conBinPersonal(B, 'sb18');
    await B.ev(() => { S.gastos = []; S.accounts = []; persistJsonStorage('fin_v6', S); localStorage.removeItem('fin_sync_dirty_ts'); });
    await B.ev(() => syncPull(true)); await B.page.waitForTimeout(400);
    await B.ev(() => { if (_conflictCloudPayload) resolveConflict(true); });
    await B.page.waitForTimeout(400);
    L.is(await B.ev(() => S.gastos.some(g => g.id === 'gt1') && cuotaBorradaAt('Tele') > 0 && !cuotaDeGasto({ desc: 'Tele' })), 'B: tiene el gasto y la marca, sin la compra');
    // A la vuelve a cargar desde el Plan (misma compra, 6 cuotas, va por la 2) y sube.
    await A.page.waitForTimeout(50);
    await A.ev(() => {
      openProjModal('gasto'); prSubCat = 'tarjeta'; updPrCuotaFields();
      $('prn').value = 'Tele'; $('pra').value = '50000'; $('pr-ct').value = '6'; $('pr-ca').value = '2';
      doSavePlan();
    });
    L.is(await A.ev(() => !!cuotaDeGasto({ desc: 'Tele' }) && cuotaBorradaAt('Tele') === 0), 'A: la compra volvió a la Agenda y la marca se levantó');
    await A.ev(() => syncPush(true)); await A.page.waitForTimeout(300);
    // B baja: la compra tiene que sobrevivir a la marca vieja que B todavía guarda.
    await B.ev(() => syncPull(true)); await B.page.waitForTimeout(400);
    await B.ev(() => { if (_conflictCloudPayload) resolveConflict(true); });
    await B.page.waitForTimeout(600);
    const b = await B.ev(() => ({ cuota: !!cuotaDeGasto({ desc: 'Tele' }), marca: cuotaBorradaAt('Tele'), plan: S.plan.some(p => /tele/i.test(p.name)) }));
    L.is(b.cuota, 'B: la compra rehecha está en la Agenda');
    L.eq(b.marca, 0, 'B: la marca vieja se levantó');
    L.is(b.plan, 'B: y la fila del Plan también está');
    // Y después de que B suba, A no la pierde.
    await B.ev(() => syncPush(true)); await B.page.waitForTimeout(300);
    await A.ev(() => syncPull(true)); await A.page.waitForTimeout(400);
    await A.ev(() => { if (_conflictCloudPayload) resolveConflict(true); });
    await A.page.waitForTimeout(600);
    L.is(await A.ev(() => !!cuotaDeGasto({ desc: 'Tele' })), 'A: la compra sigue después de bajar lo que subió B');
    L.eq(A.errors, [], 'A sin errores de JS');
    L.eq(B.errors, [], 'B sin errores de JS');
    await A.close(); await B.close();
  }

  await browser.close();
  console.log(`\n${'─'.repeat(50)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
