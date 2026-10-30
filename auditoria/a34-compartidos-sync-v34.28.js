// Los arreglos de Compartidos (sync y consistencia) de la auditoría de la v34.27,
// cada uno con la reproducción con la que se encontró: A1 (restaurar una copia o
// fusionar un backup revive lo borrado y vuelve a borrarse), A3 (dos altas a la
// vez daban el aviso falso de "versión vieja"), A5 (compartido archivado editado o
// borrado en Compartidos), A15 (gasto de la pareja sin pagador), A17 (bin con datos
// raros), A20 + D4 (el mismo pago registrado en los dos teléfonos) y D5 ("¿Quién
// sos?" y el mismo nombre en los dos teléfonos). Con la v34.27 las secciones
// terminan en ✗.
const L = require('./lib');

const pad = n => String(n).padStart(2, '0');
const ds = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const hoy = () => { const t = new Date(); return ds(t.getFullYear(), t.getMonth(), t.getDate()); };
const sinAutoSync = d => d.ev(() => { if (typeof _sharedAutoTimer !== 'undefined' && _sharedAutoTimer) { clearInterval(_sharedAutoTimer); _sharedAutoTimer = null; } });
const esperarApp = async d => {
  await d.page.waitForFunction(() => typeof S === 'object' && S !== null && typeof save === 'function' && typeof syncCompartidos === 'function');
  await d.page.waitForTimeout(300);
  await sinAutoSync(d);
  // Los toasts quedan registrados en window.__toasts (el wrapper de lib se pierde al recargar).
  await d.ev(() => {
    window.__toasts = window.__toasts || [];
    if (!window.__toastWrapped) { const st = window.showToast; window.showToast = (m, a, b, c) => { window.__toasts.push(String(m)); return st(m, a, b, c); }; window.__toastWrapped = true; }
  });
};
const nuevo = async (browser, opts, time) => {
  const d = await L.device(browser, opts);
  if (time) {
    await d.page.waitForTimeout(400);
    await d.page.clock.install({ time: new Date(time) });
    await d.page.reload();
    await esperarApp(d);
    await d.page.clock.setSystemTime(new Date(time));
  } else await sinAutoSync(d);
  d.name = opts.myName;
  return d;
};
const reabrir = async (d, time) => { await d.page.reload(); await esperarApp(d); await d.page.clock.setSystemTime(new Date(time)); };
const settle = async d => { await d.settle(); await d.settle(); };
const sync = async d => { await d.ev(() => syncCompartidos(null)); await settle(d); };
const syncAll = async ds_ => { for (const d of ds_) await sync(d); for (const d of ds_) await sync(d); };

// Alta de gasto compartido por el modal real.
const uiGasto = (d, o) => d.ev(async o => {
  _gSaving = false;
  const antes = S.gastos.length;
  openGastoModal();
  $('gdesc').value = o.desc; onGastoDescInput(o.desc);
  const chip = document.querySelector('#gcats .chip[data-v="comida"]'); if (chip) chip.click();
  $('gamt').value = o.txt;
  $('g-date-inp').value = o.date;
  $('g-shared-toggle').click();
  [$('g-paidby-fede'), $('g-paidby-mile')].find(b => b && b.dataset.who === o.paidBy).click();
  document.querySelector('#g-split-presets [data-split="50"]').click();
  const btn = document.querySelector('#ov-gasto .btnp');
  btn.click();
  if ($('dup-warn').classList.contains('show')) { _gSaving = false; btn.click(); }
  const g = S.gastos.length > antes ? S.gastos[S.gastos.length - 1] : null;
  return { id: g && g.id };
}, o);
// Registrar pago por el modal real.
const uiPago = (d, o) => d.ev(async o => {
  openSharedPaymentModal();
  $('sp-payer-' + o.payer).click();
  $('sp-amount').value = o.txt;
  $('sp-date').value = o.date;
  const n0 = getSharedPayments().length;
  $('sp-save-btn').click();
  await new Promise(r => setTimeout(r, 30));
  const ps = getSharedPayments();
  return { id: ps.length > n0 ? ps[ps.length - 1].id : null };
}, o);
const saldo = d => d.ev(() => Math.round(calcSharedDebtDetail().saldo));
const nPagos = d => d.ev(() => _allKnownPayments().length);
// El gasto borrado "como la UI": sale de Gastos, queda con tombstone y viaja al bin.
const borrarCompartido = (d, id) => d.ev(async id => {
  S.gastos = S.gastos.filter(g => g.id !== id); S._deletedGastoIds = [...(S._deletedGastoIds || []), id];
  await removeSharedBinGasto(id); save();
}, id);
const confirmar = async (d, quien) => { await d.page.waitForTimeout(250); await d.ev(q => { (q === 'ok' ? document.getElementById('confirm-ok') : document.querySelector('#ov-confirm .btnc')).click(); }, quien); };
const confirmAbierto = d => d.ev(() => document.getElementById('ov-confirm').classList.contains('open'));

(async () => {
  const browser = await L.launch();

  // ── A1 · Restaurar una copia de Compartidos no revive un gasto que vuelve a borrarse ──
  {
    L.resetBins();
    L.section('A1 · Restaurar una copia con un gasto borrado: vuelve en los dos teléfonos y se queda');
    const BIN = 'cb34a1';
    const F = await nuevo(browser, { myName: 'fede', compBin: BIN });
    const M = await nuevo(browser, { myName: 'mile', compBin: BIN });
    const x = await uiGasto(F, { desc: 'X pagada por Fede', txt: '10000', date: hoy(), paidBy: 'fede' });
    await uiGasto(F, { desc: 'Y', txt: '2000', date: hoy(), paidBy: 'fede' });
    await settle(F); await syncAll([F, M]);
    const antes = await saldo(F);
    L.eq([antes, await saldo(M)], [6000, -6000], 'con X e Y: Fede +6000, Mile −6000');
    await F.page.waitForTimeout(150);
    await borrarCompartido(F, x.id); await settle(F); await syncAll([F, M]);
    L.eq([await saldo(F), await saldo(M)], [1000, -1000], 'Fede borró X: 1000 / −1000');
    const idx = await F.ev(id => loadSharedSnapshots().findIndex(s => (s.gastos || []).some(g => g.id === id)), x.id);
    L.is(idx >= 0, 'hay una copia local con X');
    const p = F.ev(i => restoreSharedSnapshot(i), idx);
    await confirmar(F, 'ok'); await p; await settle(F);
    L.eq(await saldo(F), 6000, 'Fede restauró la copia: X vuelve');
    await syncAll([F, M]);
    L.eq([await saldo(F), await saldo(M)], [6000, -6000], 'después de sincronizar los dos: X sigue (antes Mile la volvía a borrar: 6000 / −1000)');
    await syncAll([F, M]);
    L.eq([await saldo(F), await saldo(M)], [6000, -6000], 'otra vuelta: estable, sin que X se borre');
    L.is(await F.ev(id => S.gastos.some(g => g.id === id), x.id) && await M.ev(id => _sharedBinGastos.some(g => g.id === id), x.id), 'X está en Gastos de Fede y en el bin de Mile');
    L.eq(F.errors, [], 'Fede sin errores de JS'); L.eq(M.errors, [], 'Mile sin errores de JS');
    await F.close(); await M.close();
  }

  // ── A1 · Fusionar backup (gasto y transferencia) ─────────────────────────
  {
    L.resetBins();
    L.section('A1 · "Fusionar backup" con un gasto y una transferencia borrados: vuelven y no se vuelven a borrar');
    const BIN = 'cb34a1b';
    const F = await nuevo(browser, { myName: 'fede', compBin: BIN });
    const M = await nuevo(browser, { myName: 'mile', compBin: BIN });
    const x = await uiGasto(F, { desc: 'X pagada por Fede', txt: '10000', date: hoy(), paidBy: 'fede' });
    await uiGasto(F, { desc: 'Y', txt: '2000', date: hoy(), paidBy: 'fede' });
    const pg = await uiPago(M, { payer: 'mile', txt: '500', date: hoy() });
    await settle(F); await settle(M); await syncAll([F, M]);
    const antes = await saldo(F);
    L.eq(await saldo(M), -antes, 'los dos ven la misma deuda con la transferencia');
    await F.page.waitForTimeout(900); // que el guardado en localStorage del Compartido ya esté
    const datos = await F.ev(() => ({ fin_v6: localStorage.getItem(KEY), fin_shared_payments: localStorage.getItem('fin_shared_payments') || '[]' }));
    L.is(JSON.parse(datos.fin_shared_payments).some(q => q.id === pg.id), 'el backup trae la transferencia');
    await F.page.waitForTimeout(150);
    await borrarCompartido(F, x.id); await settle(F);
    await F.ev(id => deleteSharedPayment(id), pg.id); await settle(F);
    await syncAll([F, M]);
    const borrado = await saldo(F);
    L.is(borrado !== antes && borrado === -(await saldo(M)), 'tras borrar el gasto y la transferencia la deuda cambió (' + antes + ' → ' + borrado + ')');
    await F.page.waitForTimeout(150);
    await F.ev(d => fusionarBackup({ fin_v6: d.fin_v6, fin_shared_payments: d.fin_shared_payments }, JSON.parse(d.fin_v6)), datos);
    await F.page.waitForTimeout(150);
    await syncAll([F, M]);
    L.eq([await saldo(F), await saldo(M)], [antes, -antes], 'después de fusionar y sincronizar los dos terminan como antes de borrar (' + antes + ')');
    await syncAll([F, M]);
    L.eq([await saldo(F), await saldo(M), await nPagos(F), await nPagos(M)], [antes, -antes, 1, 1], 'otra vuelta: nada vuelve a borrarse (gasto y transferencia en los dos)');
    L.eq(F.errors, [], 'Fede sin errores de JS'); L.eq(M.errors, [], 'Mile sin errores de JS');
    await F.close(); await M.close();
  }

  // ── A3 · Dos altas a la vez: carrera, no "app vieja" ─────────────────────
  {
    L.resetBins();
    L.section('A3 · Dos altas simultáneas: sin aviso falso de "versión vieja" y sin apagar la compresión');
    const BIN = 'cb34a3';
    const F = await nuevo(browser, { myName: 'fede', compBin: BIN });
    const M = await nuevo(browser, { myName: 'mile', compBin: BIN });
    await syncAll([F, M]);
    // El PUT de Mile tarda: sale con lo que leyó antes del alta de Fede y la pisa.
    await M.ev(() => { const f = window.fetch; window.fetch = async (u, o) => { if (o && String(o.method).toUpperCase() === 'PUT') await new Promise(r => setTimeout(r, 1500)); return f(u, o); }; });
    await uiGasto(M, { desc: 'Alta M', txt: '3000', date: hoy(), paidBy: 'mile' });
    await M.page.waitForTimeout(500);
    await uiGasto(F, { desc: 'Alta F', txt: '1000', date: hoy(), paidBy: 'fede' });
    await settle(F);
    await M.page.waitForTimeout(2500); await settle(M);
    const enBin = () => (L.bins[BIN].gastos || []).map(g => g.desc).sort();
    L.eq(enBin(), ['Alta M'], 'la carrera ocurrió: el PUT de Mile pisó el alta de Fede en el bin');
    await F.clearToasts();
    await sync(F);
    const t = await F.toasts();
    L.is(!t.some(x => /vieja/i.test(x)), 'Fede no ve el aviso de "versión vieja"' + (t.length ? '  (toasts: ' + JSON.stringify(t) + ')' : ''));
    L.is(await F.ev(() => !localStorage.getItem('fin_shared_sin_gz')), 'no se apaga la compresión por 14 días');
    await sync(M); await sync(F);
    L.eq(enBin(), ['Alta F', 'Alta M'], 'el alta de Fede volvió a subir sola (reintento silencioso)');
    L.eq([await saldo(F), await saldo(M)], [-1000, 1000], 'los dos teléfonos terminan con la misma deuda');
    L.is(!(await M.toasts()).some(x => /vieja/i.test(x)), 'Mile tampoco ve el aviso');
    // Y una app vieja de verdad (el bin sin los campos de la versión nueva) sigue avisando.
    const b = L.bins[BIN];
    L.bins[BIN] = { ...b, gastos: b.gastos.filter(g => g.desc !== 'Alta F'), tombstones: {}, _dev: 'app-vieja', _ts: Date.now() };
    delete L.bins[BIN]._prevTs; delete L.bins[BIN].fotos;
    await F.clearToasts();
    await sync(F);
    L.is((await F.toasts()).some(x => /versión vieja/.test(x)), 'con el bin sin _prevTs ni fotos (app vieja) sí avisa');
    L.is(await F.ev(() => !!localStorage.getItem('fin_shared_sin_gz')), 'y ahí sí se sube sin comprimir un tiempo');
    L.eq(F.errors, [], 'Fede sin errores de JS'); L.eq(M.errors, [], 'Mile sin errores de JS');
    await F.close(); await M.close();
  }

  // ── A5 · Compartido archivado: editar/borrar en Compartidos se ve en Gastos ──
  {
    L.resetBins();
    L.section('A5 · Un compartido de hace más de 12 meses editado o borrado por la pareja se refleja en Gastos');
    const BIN = 'cb34a5';
    const t0 = new Date(2026, 9, 10, 10, 0).getTime();
    const F = await nuevo(browser, { myName: 'fede', compBin: BIN }, t0);
    const M = await nuevo(browser, { myName: 'mile', compBin: BIN }, t0);
    const a = await uiGasto(F, { desc: 'Vieja A', txt: '1000', date: ds(2026, 9, 10), paidBy: 'fede' });
    const b = await uiGasto(F, { desc: 'Vieja B', txt: '2000', date: ds(2026, 9, 11), paidBy: 'fede' });
    await uiGasto(M, { desc: 'Vieja C (Mile)', txt: '4000', date: ds(2026, 9, 12), paidBy: 'mile' });
    await settle(F); await settle(M); await syncAll([F, M]);
    const t1 = new Date(2028, 0, 15, 10).getTime();
    for (const d of [F, M]) await d.page.clock.setSystemTime(new Date(t1));
    await reabrir(F, t1); await reabrir(M, t1);
    await F.page.waitForTimeout(2500);
    const gastosOct = d => d.ev(() => _getMergedGastos(9, 2026).reduce((s, g) => s + eAmt(g), 0));
    L.is(await F.ev(() => getArchivedGastos().length >= 2), 'los compartidos de oct-2026 ya están archivados en el teléfono de Fede');
    L.eq(await gastosOct(F), 3500, 'Gastos oct-26 de Fede: 500 + 1000 + 2000 = 3500');
    // Mile edita B (2000 → 5000) y borra A, desde Compartidos.
    await M.ev(async id => {
      openEditSharedGasto({ id }); $('esg-amt').value = '5000';
      document.querySelector('#ov-edit-shared .btnp').click();
    }, b.id);
    await settle(M);
    await M.ev(id => removeSharedBinGasto(id), a.id); await settle(M);
    await syncAll([F, M]);
    L.eq(await gastosOct(F), 4500, 'Gastos oct-26 de Fede tras la edición y el borrado: 2500 + 2000 = 4500 (antes quedaba en 3500)');
    L.eq(await gastosOct(M), 4500, 'y el de Mile coincide');
    const arch = await F.ev(() => _getMergedGastos(9, 2026).map(g => g.desc + ':' + g.amount + (g._arch ? ':arch' : '')).sort());
    L.eq(arch, ['Vieja B:5000:arch', 'Vieja C (Mile):4000'], 'Fede ve B con el importe nuevo, sin A, y C de Mile');
    L.eq(F.errors, [], 'Fede sin errores de JS'); L.eq(M.errors, [], 'Mile sin errores de JS');
    await F.close(); await M.close();
  }

  // ── A15 · Gasto de la pareja sin pagador ─────────────────────────────────
  {
    L.resetBins();
    L.section('A15 · Un gasto sin shared.paidBy no figura pagado por los dos');
    const BIN = 'cb34a15';
    const ahora = Date.now(), t = new Date();
    L.bins[BIN] = { gastos: [{ id: 'sp', desc: 'Sin pagador', amount: 1000, cat: 'super', month: t.getMonth(), year: t.getFullYear(), day: 5, addedAt: ahora - 1000, updatedAt: ahora, shared: { active: true } }], payments: [], tombstones: {}, payTombstones: {}, _ts: ahora, _dev: 'otro' };
    const F = await nuevo(browser, { myName: 'fede', compBin: BIN });
    const M = await nuevo(browser, { myName: 'mile', compBin: BIN });
    await F.ev(() => fetchSharedBin()); await M.ev(() => fetchSharedBin());
    const [sf, sm] = [await saldo(F), await saldo(M)];
    L.is(sf !== 0 && sf === -sm, `los saldos son opuestos y no cero (Fede ${sf}, Mile ${sm}; antes los dos creían haberlo pagado)`);
    L.eq(await F.ev(() => _sharedBinGastos[0].shared.paidBy), await M.ev(() => _sharedBinGastos[0].shared.paidBy), 'los dos teléfonos le asignan el mismo pagador');
    L.eq(F.errors, [], 'Fede sin errores de JS'); L.eq(M.errors, [], 'Mile sin errores de JS');
    await F.close(); await M.close();
  }

  // ── A17 · Bin con datos raros ────────────────────────────────────────────
  {
    L.section('A17 · null, números o listas rotas dentro del bin no rompen fetchSharedBin ni openLiquidaciones');
    const ahora = Date.now(), t = new Date();
    const g = id => ({ id, desc: 'ok ' + id, amount: 1000, cat: 'super', month: t.getMonth(), year: t.getFullYear(), day: 5, addedAt: ahora - 1000, updatedAt: ahora, shared: { active: true, paidBy: 'mile', splitPct: 50 } });
    const base = () => ({ gastos: [g('a1')], payments: [], tombstones: {}, payTombstones: {}, _ts: ahora, _dev: 'otro' });
    const variantes = {
      'gastos con null': r => { r.gastos.push(null); },
      'gastos con un número': r => { r.gastos.push(7); },
      'payments con null': r => { r.payments.push(null); },
      'payments con un número': r => { r.payments.push(5); },
      'payments es un texto': r => { r.payments = 'hola'; },
      'gastos es un objeto': r => { r.gastos = { a: 1 }; },
      'gastos es un texto': r => { r.gastos = 'hola'; },
    };
    for (const [nombre, fn] of Object.entries(variantes)) {
      L.resetBins();
      const rec = base(); fn(rec); L.bins.cb34a17 = rec;
      const d = await nuevo(browser, { myName: 'fede', compBin: 'cb34a17' });
      const r = await d.ev(async () => { try { return await fetchSharedBin(); } catch (e) { return 'THROW ' + e.message; } });
      const st = await d.ev(() => ({ failed: _sharedBinFetchFailed, n: _sharedBinGastos.length }));
      const esperado = /^gastos es/.test(nombre) ? 0 : 1;
      L.eq([r, st.failed, st.n], [true, false, esperado], nombre + ': fetchSharedBin anda y queda ' + esperado + ' gasto');
      L.eq(d.errors, [], '  sin errores de JS');
      await d.close();
    }
    L.resetBins();
    L.bins.cb34a17 = { gastos: [g('a1')], payments: [
      { id: 'p1', paidBy: 'mile', amount: 100, desc: 'fecha numérica', date: 20261112, addedAt: ahora, updatedAt: ahora },
      { id: 'p2', paidBy: 'mile', amount: 100, desc: 'fecha rara', date: 'zzz', addedAt: ahora, updatedAt: ahora },
      { id: 'p3', paidBy: 'mile', amount: 100, desc: 'sin fecha', addedAt: ahora, updatedAt: ahora },
      null, 3], tombstones: {}, payTombstones: {}, _ts: ahora, _dev: 'otro' };
    const d = await nuevo(browser, { myName: 'fede', compBin: 'cb34a17' });
    await d.ev(() => fetchSharedBin());
    const r = await d.ev(() => { try { openLiquidaciones(); return { err: null, txt: document.getElementById('liq-body').textContent }; } catch (e) { return { err: String(e) }; } });
    L.eq(r.err, null, 'openLiquidaciones no revienta con p.date numérico, inválido o ausente');
    L.is(/3 liquidaciones/.test(r.txt || ''), 'y lista las tres transferencias');
    L.is(!/Invalid Date/.test(r.txt || ''), 'sin "Invalid Date" en la lista');
    L.eq(d.errors, [], 'sin errores de JS');
    await d.close();
  }

  // ── A20 + D4 · El mismo pago registrado a la vez en los dos teléfonos ───
  {
    L.resetBins();
    L.section('A20 + D4 · Dos teléfonos registran el mismo pago: se avisa de un posible duplicado');
    const BIN = 'cb34a20';
    const F = await nuevo(browser, { myName: 'fede', compBin: BIN });
    const M = await nuevo(browser, { myName: 'mile', compBin: BIN });
    await uiGasto(F, { desc: 'Cena', txt: '10000', date: hoy(), paidBy: 'fede' });
    await settle(F); await syncAll([F, M]);
    // Los dos sin señal registran la misma transferencia (Mile le pasó $ 5.000 a Fede).
    L.net.getFail = L.net.putFail = true;
    await uiPago(F, { payer: 'mile', txt: '5000', date: hoy() });
    await F.page.waitForTimeout(300);
    const pm = await uiPago(M, { payer: 'mile', txt: '5000', date: hoy() });
    await settle(F); await settle(M);
    L.net.getFail = L.net.putFail = false;
    await sync(F);
    L.is(!(await confirmAbierto(F)), 'Fede (cargó primero) no ve ninguna pregunta');
    await sync(M);
    await M.page.waitForTimeout(300);
    L.is(await M.ev(() => document.getElementById('ov-confirm').classList.contains('open') && /duplicado/i.test(document.getElementById('confirm-title').textContent)), 'Mile (cargó después) ve "¿Pago duplicado?"');
    L.is(await M.ev(() => /5\.000/.test(document.getElementById('confirm-msg').textContent) && document.getElementById('confirm-ok').textContent === 'Eliminar la mía'), 'con el monto y el botón "Eliminar la mía"');
    await confirmar(M, 'ok'); await M.page.waitForTimeout(400); await settle(M);
    await syncAll([F, M]);
    L.eq([await nPagos(F), await nPagos(M)], [1, 1], 'tras "Eliminar la mía" queda una sola transferencia en los dos');
    L.is(await M.ev(id => !_allKnownPayments().some(p => p.id === id), pm.id), 'y es la de Fede');
    L.eq([await saldo(F), await saldo(M)], [0, 0], 'la deuda queda saldada una vez (5000 de 10000/2), no invertida');
    // Ignorar: no vuelve a preguntar.
    L.net.getFail = L.net.putFail = true;
    await uiPago(F, { payer: 'fede', txt: '700', date: hoy() });
    await F.page.waitForTimeout(300);
    await uiPago(M, { payer: 'fede', txt: '700', date: hoy() });
    await settle(F); await settle(M);
    L.net.getFail = L.net.putFail = false;
    await sync(F); await sync(M); await M.page.waitForTimeout(300);
    L.is(await confirmAbierto(M), 'segundo caso: Mile vuelve a ver la pregunta');
    await confirmar(M, 'cancel'); await M.page.waitForTimeout(300);
    await syncAll([F, M]);
    L.eq([await nPagos(F), await nPagos(M)], [3, 3], '"Ignorar" deja las dos');
    L.is(!(await confirmAbierto(M)), 'y no vuelve a preguntar en el sync siguiente');
    // Pagos distintos no avisan.
    await uiPago(F, { payer: 'mile', txt: '100', date: hoy() });
    await uiPago(M, { payer: 'mile', txt: '200', date: hoy() });
    await settle(F); await settle(M); await syncAll([F, M]); await M.page.waitForTimeout(300);
    L.is(!(await confirmAbierto(M)) && !(await confirmAbierto(F)), 'dos pagos de distinto monto no disparan el aviso');
    L.eq(F.errors, [], 'Fede sin errores de JS'); L.eq(M.errors, [], 'Mile sin errores de JS');
    await F.close(); await M.close();
  }

  // ── D5 · ¿Quién sos? y el mismo nombre en los dos teléfonos ──────────────
  {
    L.resetBins();
    L.section('D5 · "¿Quién sos?" al conectar el bin y aviso si los dos teléfonos eligen el mismo nombre');
    const BIN = 'cb34d5';
    // Un teléfono que nunca eligió nombre pregunta al conectar.
    const N = await nuevo(browser, { myName: 'fede', compBin: '' });
    await N.ev(() => { localStorage.removeItem('fin_my_name'); localStorage.removeItem('fin_comp_bin_id'); localStorage.removeItem('fin_comp_api_key'); });
    L.is(await N.ev(() => localStorage.getItem('fin_my_name') === null), 'teléfono nuevo: todavía no eligió nombre');
    await N.ev(bin => { $('comp-bin-id').value = bin; $('comp-api-key').value = 'k'; saveCompBinConfig(); }, BIN);
    await N.page.waitForTimeout(300);
    L.is(await N.ev(() => document.getElementById('ov-confirm').classList.contains('open') && document.getElementById('confirm-title').textContent === '¿Quién sos?'), 'al conectar el bin pregunta "¿Quién sos?"');
    L.eq(await N.ev(() => [document.getElementById('confirm-ok').textContent, document.querySelector('#ov-confirm .btnc').textContent]), ['Soy Fede', 'Soy Mile'], 'con los botones "Soy Fede" y "Soy Mile"');
    await confirmar(N, 'cancel'); await N.page.waitForTimeout(300);
    L.eq(await N.ev(() => localStorage.getItem('fin_my_name')), 'mile', 'elegir "Soy Mile" lo guarda');
    // Quien ya eligió nombre no ve la pregunta (los bins y teléfonos existentes siguen igual).
    const E = await nuevo(browser, { myName: 'fede', compBin: '' });
    await E.ev(bin => { $('comp-bin-id').value = bin; $('comp-api-key').value = 'k'; saveCompBinConfig(); }, BIN);
    await E.page.waitForTimeout(300);
    L.is(!(await confirmAbierto(E)), 'con el nombre ya elegido no pregunta');
    L.eq(await E.ev(() => localStorage.getItem('fin_my_name')), 'fede', 'y no lo cambia');
    await N.close(); await E.close();

    // Los dos eligieron Fede.
    L.resetBins();
    const A = await nuevo(browser, { myName: 'fede', compBin: BIN });
    const B = await nuevo(browser, { myName: 'fede', compBin: BIN }); // Mile no cambió el nombre
    await uiGasto(A, { desc: 'De A', txt: '1000', date: hoy(), paidBy: 'fede' });
    await settle(A); await sync(A);
    const idA = await A.ev(() => _devId()), idB = await B.ev(() => _devId());
    L.eq(L.bins[BIN].quien, { fede: idA }, 'el bin anota qué teléfono es Fede');
    await sync(B);
    L.is((await B.toasts()).some(x => /Los dos teléfonos figuran como Fede/.test(x)), 'B (también "Fede") ve el aviso');
    // B sube algo (el bin se escribe con su anotación) y A, al bajarlo, también se entera.
    await uiGasto(B, { desc: 'De B', txt: '2000', date: hoy(), paidBy: 'fede' });
    await settle(B);
    L.eq(L.bins[BIN].quien, { fede: idB }, 'B pasa a ser el que figura como Fede en el bin');
    await sync(A);
    L.is((await A.toasts()).some(x => /Los dos teléfonos figuran como Fede/.test(x)), 'A ve el aviso en su siguiente sync');
    const nA = (await A.toasts()).filter(x => /figuran como/.test(x)).length;
    await sync(A);
    L.eq((await A.toasts()).filter(x => /figuran como/.test(x)).length, nA, 'el aviso no se repite en cada sync');
    // B se cambia a Mile y los dos quedan bien.
    await B.ev(() => { localStorage.setItem('fin_my_name', 'mile'); });
    await B.clearToasts(); await A.clearToasts();
    await uiGasto(B, { desc: 'De B 2', txt: '2000', date: hoy(), paidBy: 'mile' });
    await settle(B); await syncAll([A, B]);
    await uiGasto(A, { desc: 'De A 2', txt: '500', date: hoy(), paidBy: 'fede' });
    await settle(A); await syncAll([A, B]);
    L.eq([(L.bins[BIN].quien || {}).fede, (L.bins[BIN].quien || {}).mile], [idA, idB], 'cada nombre queda con su teléfono');
    L.is(!(await A.toasts()).some(x => /figuran como/.test(x)) && !(await B.toasts()).some(x => /figuran como/.test(x)), 'y no hay más avisos');
    L.eq(A.errors, [], 'A sin errores de JS'); L.eq(B.errors, [], 'B sin errores de JS');
    await A.close(); await B.close();

    // Un bin de antes (sin quien) se lee igual y no avisa.
    L.resetBins();
    const ahora = Date.now(), t = new Date();
    L.bins[BIN] = { gastos: [{ id: 'v1', desc: 'Viejo', amount: 500, cat: 'super', month: t.getMonth(), year: t.getFullYear(), day: 5, addedAt: ahora - 1000, updatedAt: ahora, shared: { active: true, paidBy: 'mile', splitPct: 50 } }], payments: [], tombstones: {}, payTombstones: {}, _ts: ahora, _dev: 'otro' };
    const V = await nuevo(browser, { myName: 'fede', compBin: BIN });
    L.is(await V.ev(() => fetchSharedBin()), 'un bin sin "quien" se lee bien');
    L.is(!(await V.toasts()).some(x => /figuran como/.test(x)), 'y no avisa nada');
    L.eq(V.errors, [], 'sin errores de JS');
    await V.close();
  }

  await browser.close();
  console.log(`\n${'─'.repeat(50)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
