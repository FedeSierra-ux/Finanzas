// Los arreglos de la v34.18: lo que quedaba de la auditoría de la v34.16
// (seguridad, Compartidos, medios y bajos), cada uno con la reproducción con
// la que se encontró. Con la v34.17 la mayoría de las secciones termina en ✗.
const L = require('./lib');

const sinAutoSync = d => d.ev(() => { if (typeof _sharedAutoTimer !== 'undefined' && _sharedAutoTimer) { clearInterval(_sharedAutoTimer); _sharedAutoTimer = null; } });
const sync = async (...ds) => {
  for (let i = 0; i < 2; i++) for (const d of ds) { await d.ev(() => syncCompartidos(null)); await d.settle(); await d.settle(); }
};
const recargar = async d => {
  await d.page.reload();
  await d.page.waitForFunction(() => typeof S === 'object' && S !== null && typeof syncCompartidos === 'function');
  await d.page.waitForTimeout(500);
  await sinAutoSync(d);
};
const nuevo = async (browser, opts) => { const d = await L.device(browser, opts); await sinAutoSync(d); return d; };
// Un compartido 50/50 cargado a mano en el estado, pagado por `quien`.
const compartido = (id, desc, amount, quien) => {
  const f = new Date();
  return { id, desc, cat: 'comida', amount, month: f.getMonth(), year: f.getFullYear(), day: 1,
    addedAt: new Date(f.getFullYear(), f.getMonth(), 1, 12).getTime(), shared: { active: true, paidBy: quien, splitPct: 50 } };
};

(async () => {
  const browser = await L.launch();

  // ── BUG11 · Bins públicos ─────────────────────────────────────────────────
  {
    L.resetBins();
    L.section('BUG11 · "🆕 Crear" hace bins privados y los públicos de antes pasan a privados');
    const d = await nuevo(browser, { myName: 'fede', compBin: 'priv' });
    const h = await d.ev(async () => {
      const reales = window.fetch, vistos = [];
      window.fetch = async (u, o = {}) => {
        const url = String(u);
        vistos.push({ url, method: (o.method || 'GET').toUpperCase(), headers: { ...(o.headers || {}) } });
        if (/\/v3\/b$/.test(url)) return new Response(JSON.stringify({ metadata: { id: 'nuevo123' } }), { status: 200 });
        return reales(u, o);
      };
      $('sync-api-key').value = 'k';
      await autoCrearBin('sync-api-key', 'sync-bin-id', null);
      const crear = vistos.find(v => /\/v3\/b$/.test(v.url));
      // Un bin viejo que se lee sin clave (público): se pasa a privado.
      vistos.length = 0;
      window.fetch = async (u, o = {}) => {
        const url = String(u), hd = o.headers || {};
        vistos.push({ url, method: (o.method || 'GET').toUpperCase(), headers: { ...hd } });
        if (!hd['X-Master-Key'] && !hd['X-Access-Key'] && /viejo1/.test(url)) return new Response('{}', { status: 200 });
        return reales(u, o);
      };
      if (typeof asegurarBinPrivado === 'function') await asegurarBinPrivado('viejo1', 'k');
      const priv = vistos.find(v => /meta\/privacy/.test(v.url));
      // Uno que ya es privado: no se toca.
      vistos.length = 0;
      if (typeof asegurarBinPrivado === 'function') await asegurarBinPrivado('priv', 'k');
      const tocado = vistos.some(v => /meta\/privacy/.test(v.url));
      window.fetch = reales;
      return { crear: crear && crear.headers['X-Bin-Private'], priv: priv && priv.headers['X-Bin-Private'], flagViejo: localStorage.getItem('fin_bin_priv_viejo1'),
        flagPriv: localStorage.getItem('fin_bin_priv_priv'), tocado };
    });
    L.eq(h.crear, 'true', 'el bin nuevo se crea con X-Bin-Private: true');
    L.eq(h.priv, 'true', 'un bin que se lee sin clave se pasa a privado');
    L.eq(h.flagViejo, '1', 'y queda anotado para no volver a probar');
    L.is(!h.tocado && h.flagPriv === '1', 'uno que ya era privado no se toca');
    L.eq(d.errors, [], 'sin errores de JS');
    await d.close();
  }

  // ── BUG06 · XSS por categorías del sync personal ─────────────────────────
  {
    L.resetBins();
    L.section('BUG06 · Categorías propias que llegan por el sync personal se limpian');
    const d = await nuevo(browser, { myName: 'fede', compBin: 'xss' });
    const r = await d.ev(async () => {
      const f = new Date();
      applyPayload({ _syncTs: Date.now(), fin_custom_cats: JSON.stringify({
        custom_x_1: { label: 'Rara', icon: '<img src=x onerror="window.__xss=(window.__xss||0)+1">', color: '#ff0000' },
        comida: { label: 'pwn', icon: '<b>x</b>', color: '#000000' } }) });
      S.gastos.push({ id: 'gx', desc: 'Algo', cat: 'custom_x_1', amount: 100, month: f.getMonth(), year: f.getFullYear(), day: 1, addedAt: Date.now() });
      save(); goTo('gastos'); renderGastos();
      await new Promise(r => setTimeout(r, 400));
      return { xss: window.__xss || 0, icon: CATS.custom_x_1 && CATS.custom_x_1.icon, comida: CATS.comida.label };
    });
    L.eq(r.xss, 0, 'el ícono con HTML no ejecuta nada');
    L.is(r.icon && !/[<>]/.test(r.icon), `el ícono queda sin HTML (${r.icon})`);
    L.eq(r.comida, 'Comida', 'una clave "comida" de la nube no pisa la categoría base');
    await d.close();
  }

  // ── CMP04 · El viejo bin de la pareja ────────────────────────────────────
  {
    L.resetBins();
    L.section('CMP04 · El viejo "bin de la pareja" no suma gastos ya borrados');
    L.bins['pb'] = { fin_v6: JSON.stringify({ gastos: [compartido('verdu', 'Verdulería', 6000, 'mile'), compartido('luz', 'Luz', 20000, 'mile')] }) };
    const d = await nuevo(browser, { myName: 'fede', compBin: 'cmp04', partnerBin: 'pb' });
    // Sin la clave del sync personal el viejo bin no se lee, y Compartidos
    // quedaba en un bucle que trababa la app (v34.17).
    await d.ev(() => { _partnerLoaded = false; goTo('compartidos'); renderCompartidos(); });
    await new Promise(r => setTimeout(r, 500));
    const sinClave = await Promise.race([d.ev(() => 'ok'), new Promise(r => setTimeout(() => r('trabada'), 8000))]);
    L.eq(sinClave, 'ok', 'con el bin de la pareja configurado y sin clave del sync personal, Compartidos no traba la app');
    if (sinClave === 'ok') {
      await d.ev(() => { localStorage.setItem('fin_sync_api_key', 'k'); _partnerLoaded = false; return fetchPartnerGastos(); }); await sync(d);
      const antes = await d.ev(() => calcSharedDebtDetail().saldo);
      const r = await d.ev(() => {
        S._gTombs = { ...(S._gTombs || {}), verdu: Date.now() }; save();
        return calcSharedDebtDetail().saldo;
      });
      L.eq(antes, -13000, 'con los dos gastos de Mile, Fede debe $13.000');
      L.eq(r, -10000, 'borrada la Verdulería (tombstone), debe $10.000 aunque Mile no haya abierto la app');
    }
    await d.close();
  }

  // ── CMP06 · Borrado sin señal, reabrir sin señal ─────────────────────────
  {
    L.resetBins();
    L.section('CMP06 · Lo borrado sin señal no reaparece al reabrir sin señal');
    const BIN = 'cmp06';
    L.bins[BIN] = { gastos: [compartido('super', 'Super', 12000, 'fede'), compartido('luz', 'Luz', 20000, 'fede')], payments: [] };
    const mile = await nuevo(browser, { myName: 'mile', compBin: BIN });
    await sync(mile);
    const antes = await mile.ev(() => calcSharedDebtDetail().saldo);
    L.net.getFail = true; L.net.putFail = true;
    await mile.ev(async () => { await removeSharedBinGasto('super'); });
    await recargar(mile);
    const r = await mile.ev(() => ({ saldo: calcSharedDebtDetail().saldo }));
    L.net.getFail = false; L.net.putFail = false;
    L.eq(antes, -16000, 'Mile debe $16.000 antes de borrar');
    L.eq(r.saldo, -10000, 'después de borrar "Super" sin señal y reabrir sin señal, debe $10.000');
    await mile.close();
  }

  // ── CMP07 · Compartido propio que solo quedó en el bin ───────────────────
  {
    L.resetBins();
    L.section('CMP07 · Un compartido propio que solo está en el bin se puede corregir desde Gastos');
    const BIN = 'cmp07';
    L.bins[BIN] = { gastos: [compartido('desp', 'Después', 3000, 'mile')], payments: [] };
    const mile = await nuevo(browser, { myName: 'mile', compBin: BIN });
    await sync(mile);
    const r = await mile.ev(async () => {
      goTo('gastos'); renderGastos();
      await new Promise(r => setTimeout(r, 200));
      window.__toasts.length = 0;
      document.querySelector('#gastos-list [data-id="desp"]').click();
      await new Promise(r => setTimeout(r, 300));
      return { abierto: $('ov-edit-shared').classList.contains('open'), toasts: window.__toasts.slice() };
    });
    L.is(r.abierto, 'tocarlo abre el editor de Compartidos');
    L.is(!r.toasts.some(t => /solo lectura/.test(t)), 'y no dice "Gasto del partner — solo lectura"');
    await mile.close();
  }

  // ── CMP08 · Pendientes duplicados en memoria ─────────────────────────────
  {
    L.resetBins();
    L.section('CMP08 · Reintentar con el bin incompleto no duplica los pendientes');
    const d = await nuevo(browser, { myName: 'fede', compBin: 'cmp08' });
    const r = await d.ev(() => {
      _sharedBinGastos = [{ ...{ id: 'm1', desc: 'De Mile', cat: 'comida', amount: 1000, month: 0, year: 2026, addedAt: 1 }, shared: { active: true, paidBy: 'mile', splitPct: 50 } }];
      _sharedConfirmado = { gastos: {}, pays: {} };
      aplicarPendientes(sharedPendientes()); aplicarPendientes(sharedPendientes()); aplicarPendientes(sharedPendientes());
      return { n: _sharedBinGastos.filter(g => g.id === 'm1').length, pend: sharedPendientes().total };
    });
    L.eq(r.n, 1, 'tres "Sincronizar" con el PUT caído dejan una sola copia del gasto');
    L.eq(r.pend, 1, 'y el contador de pendientes dice 1');
    await d.close();
  }

  // ── CMP05 · App vieja que escribe el bin ─────────────────────────────────
  {
    L.resetBins();
    L.section('CMP05 · Si otro teléfono deja el bin con menos gastos, se avisa y se vuelven a subir');
    const BIN = 'cmp05';
    const fede = await nuevo(browser, { myName: 'fede', compBin: BIN });
    const mile = await nuevo(browser, { myName: 'mile', compBin: BIN });
    await fede.ev(() => { S.gastos.push(...['a', 'b', 'c'].map((x, i) => ({ id: 'g' + x, desc: 'G' + x, cat: 'comida', amount: 1000 * (i + 1), month: new Date().getMonth(), year: new Date().getFullYear(), day: 1, addedAt: Date.now() - 1000, shared: { active: true, paidBy: 'fede', splitPct: 50 } }))); save(); });
    await sync(fede, mile);
    // Una app vieja escribe el bin sin dos de los gastos y sin tombstones.
    const b = L.bins[BIN];
    L.bins[BIN] = { ...b, gastos: b.gastos.filter(g => g.id === 'ga'), tombstones: {}, _dev: 'app-vieja', _ts: Date.now() };
    await mile.clearToasts();
    await mile.ev(() => syncCompartidos(null)); await mile.settle(); await mile.settle();
    await mile.page.waitForTimeout(1200);
    const t = await mile.toasts();
    L.is(t.some(x => /versión vieja/.test(x)), 'Mile ve el aviso de que el otro teléfono tiene una versión vieja');
    L.eq(L.bins[BIN].gastos.map(g => g.id).sort(), ['ga', 'gb', 'gc'], 'y el bin vuelve a tener los tres gastos');
    L.is(await mile.ev(() => !!localStorage.getItem('fin_shared_sin_gz')), 'por un tiempo se sube sin comprimir para que esa app lo lea');
    await fede.close(); await mile.close();
  }

  // ── B09 · Reloj atrasado ─────────────────────────────────────────────────
  {
    L.resetBins();
    L.section('B09 · Con el reloj de Mile 3 h atrasado gana la corrección hecha después');
    const BIN = 'reloj';
    const fede = await nuevo(browser, { myName: 'fede', compBin: BIN });
    const mile = await nuevo(browser, { myName: 'mile', compBin: BIN,
      initScript: () => { const real = Date.now.bind(Date); Date.now = () => real() - 3 * 3600e3; } });
    await fede.ev(() => { S.gastos.push({ id: 'inet', desc: 'Internet', cat: 'hogar', amount: 30000, month: new Date().getMonth(), year: new Date().getFullYear(), day: 1, addedAt: Date.now() - 5000, shared: { active: true, paidBy: 'fede', splitPct: 50 } }); save(); });
    await sync(fede, mile);
    const editar = (d, monto) => d.ev(async monto => { openEditSharedGasto('inet'); $('esg-amt').value = String(monto); await doSaveEditShared(); }, monto);
    await editar(fede, 40000); await fede.settle(); await fede.settle();
    await fede.page.waitForTimeout(300);
    await editar(mile, 50000); await mile.settle(); await mile.settle();
    await sync(fede, mile);
    const ver = d => d.ev(() => { const g = _sharedBinGastos.find(x => x.id === 'inet') || S.gastos.find(x => x.id === 'inet'); return g.amount; });
    L.eq(await ver(fede), 50000, 'Fede ve los $50.000 que Mile puso después');
    L.eq(await ver(mile), 50000, 'y Mile también');
    await fede.close(); await mile.close();
  }

  // ── Un solo teléfono para los arreglos que no dependen de la pareja ──────
  L.resetBins();
  const d = await nuevo(browser, { myName: 'fede', compBin: 'solo' });

  L.section('BUG03 · Editar una cuenta con 3 decimales no la multiplica por 1000');
  {
    const r = await d.ev(() => {
      S.accounts.push({ id: 'usd', name: 'Dólares', type: 'bancaria', amount: 2.125, currency: 'USD' }); save();
      openEditAcc('usd'); const vis = $('edit-acc-amount').value; saveEditAcc();
      return { vis, amount: S.accounts.find(a => a.id === 'usd').amount };
    });
    L.eq(r.vis, '2,125', 'el campo muestra 2,125');
    L.eq(r.amount, 2.125, 'y al guardar sin tocar nada queda en USD 2,125');
  }

  L.section('BUG04 · Renombrar un concepto del Plan conserva el importe de cada mes');
  {
    const r = await d.ev(() => {
      const months = {}; for (let i = 0; i < 12; i++) months[pkAdd(pkNow(), i)] = 1000000;
      const agu = pkAdd(pkNow(), 2); months[agu] = 1500000;
      S.plan.push({ id: 'sue', name: 'Sueldo', cat: 'ingreso', months, rep: { n: 1, amt: 1000000, until: pkAdd(pkNow(), 11) } }); save();
      openEditProj(S.plan.find(p => p.id === 'sue'));
      const vis = $('ep-amt').value;
      $('ep-name').value = 'Sueldo neto'; doSaveEditProj();
      const p = S.plan.find(p => p.id === 'sue');
      return { vis, name: p.name, mes0: p.months[pkNow()], agu: p.months[agu], rep: p.rep && p.rep.amt };
    });
    L.eq(r.vis, '1000000', 'el editor propone el importe que se repite, no el aguinaldo');
    L.eq(r.name, 'Sueldo neto', 'se renombra');
    L.eq([r.mes0, r.agu, r.rep], [1000000, 1500000, 1000000], 'y cada mes conserva su importe (el del aguinaldo también)');
  }

  L.section('BUG08 · Un ingreso y un vencimiento con el mismo nombre no se pisan');
  {
    const r = await d.ev(() => {
      const f = new Date(), fecha = localKey(new Date(f.getFullYear(), f.getMonth(), 28));
      S.plan.push({ id: 'alq-ing', name: 'Alquiler', cat: 'ingreso', months: { [pkNow()]: 400000 } });
      S.agenda.vencimientos.push({ id: 'alq-v', name: 'Alquiler', amount: 600000, date: fecha, period: 'mensual' });
      save();
      delAgenda('venc', 'alq-v');
      const ingresoTrasBorrarVenc = S.plan.some(p => p.id === 'alq-ing');
      S.agenda.vencimientos.push({ id: 'alq-v2', name: 'Alquiler', amount: 600000, date: fecha, period: 'mensual' }); save();
      deletePlanItemWithSync('alq-ing', 'Alquiler');
      return { ingresoTrasBorrarVenc, vencTrasBorrarIngreso: S.agenda.vencimientos.some(v => v.id === 'alq-v2') };
    });
    L.is(r.ingresoTrasBorrarVenc, 'borrar el vencimiento "Alquiler" deja el ingreso "Alquiler" del Plan');
    L.is(r.vencTrasBorrarIngreso, 'y borrar el ingreso deja el vencimiento');
  }

  L.section('BUG05 · Bajar de la nube sin lugar en el teléfono no se da por sincronizado');
  {
    const r = await d.ev(() => {
      localStorage.setItem('fin_sync_ts', '111');
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === 'fin_v6') { const e = new Error('lleno'); e.name = 'QuotaExceededError'; throw e; }
        return orig.call(this, k, v);
      };
      let error = null;
      try { applyPayload({ _syncTs: 999, fin_v6: JSON.stringify({ gastos: [{ id: 'nube1', desc: 'De la nube', amount: 1, month: 0, year: 2026 }], accounts: [], plan: [], agenda: { subs: [], vencimientos: [], cuotas: [], inversiones: [] } }) }); }
      catch (e) { error = e.message; }
      Storage.prototype.setItem = orig;
      return { error, ts: localStorage.getItem('fin_sync_ts') };
    });
    L.is(!!r.error, `avisa que no hay lugar (${r.error})`);
    L.eq(r.ts, '111', 'y no marca la bajada como sincronizada');
  }

  L.section('P02 · Tarjetas usa las mismas fechas que el Plan y no pierde la última cuota');
  {
    const r = await d.ev(() => {
      const f = new Date();
      const val = () => { renderTarjetasResumen(); const v = document.querySelector('#tarjetas-resumen-content .tj-mini-val'); return v ? v.textContent : null; };
      // La 1ª cuota viene en el resumen del mes que viene (corregida a mano).
      S.agenda.cuotas = [{ id: 'hel', name: 'Heladera', fee: 150000, total: 6, paid: 0, startDate: localKey(new Date(f.getFullYear(), f.getMonth(), 1)),
        nextDueDate: localKey(new Date(f.getFullYear(), f.getMonth() + 1, 10)), dueDay: 10 }];
      const heladera = val();
      // Celular: la última cuota vence este mes; se paga.
      S.agenda.cuotas = [{ id: 'cel', name: 'Celular', fee: 80000, total: 3, paid: 2, startDate: localKey(new Date(f.getFullYear(), f.getMonth() - 2, 1)),
        nextDueDate: localKey(new Date(f.getFullYear(), f.getMonth(), 20)), dueDay: 20 }];
      const antes = val();
      const cq = S.agenda.cuotas[0]; cq.paid = 3; cq.nextDueDate = addMonthsClamp(cq.nextDueDate, 1, cq.dueDay); markCuotaDoneState(cq);
      const despues = val();
      S.agenda.cuotas = [];
      return { heladera, antes, despues };
    });
    L.eq(r.heladera, fARSnode(0), 'una compra cuya 1ª cuota vence el mes que viene no suma en "Este mes"');
    L.eq(r.antes, fARSnode(80000), 'la última cuota del Celular suma en "Este mes"');
    L.eq(r.despues, fARSnode(80000), 'y sigue sumando después de pagarla');
  }

  L.section('P03 · Un gasto con una categoría que ya no existe se dibuja en Varios');
  {
    const r = await d.ev(async () => {
      const f = new Date();
      S.gastos = [{ id: 'c1', desc: 'Super', cat: 'comida', amount: 60000, month: f.getMonth(), year: f.getFullYear(), day: 1, addedAt: Date.now() },
        { id: 'c2', desc: 'Veterinaria', cat: 'custom_mascotas_borrada', amount: 40000, month: f.getMonth(), year: f.getFullYear(), day: 1, addedAt: Date.now() }];
      save(); goTo('gastos'); curMonth = f.getMonth(); curYear = f.getFullYear(); renderGastos();
      return [...document.querySelectorAll('#dsvg circle[data-cat]')].map(c => c.dataset.cat).sort();
    });
    L.eq(r, ['comida', 'varios'], 'el donut tiene Comida y Varios (sin hueco)');
  }

  L.section('P04 · El promedio de Tendencia no mete el mes en curso');
  {
    const r = await d.ev(() => {
      const f = new Date(); S.gastos = [];
      for (let i = 1; i <= 5; i++) { const m = new Date(f.getFullYear(), f.getMonth() - i, 1); S.gastos.push({ id: 't' + i, desc: 'Mes', cat: 'comida', amount: 100000, month: m.getMonth(), year: m.getFullYear(), day: 1, addedAt: m.getTime() }); }
      S.gastos.push({ id: 't0', desc: 'Mes', cat: 'comida', amount: 10000, month: f.getMonth(), year: f.getFullYear(), day: 1, addedAt: Date.now() });
      save(); curMonth = f.getMonth(); curYear = f.getFullYear(); _tndN = 6; _tndAncla(); renderTendencia();
      return { prom: document.querySelector('.tnd-avgl').textContent, fc: fCompact(100000) };
    });
    L.eq(r.prom, 'prom. ' + r.fc, 'el promedio es el de los 5 meses cerrados');
  }

  L.section('BUG09 · Mercado Pago no importa montos en 0, negativos ni fechas inválidas');
  {
    const r = await d.ev(() => {
      S.gastos = [];
      mpReviewItems = [
        { desc: 'Reintegro', amount: -1500, date: '2026-10-10', category: 'comida', selected: true },
        { desc: 'Cero', amount: 0, date: '2026-10-10', category: 'comida', selected: true },
        { desc: 'Fecha rara', amount: 500, date: '10/10', category: 'comida', selected: true }];
      confirmMPImport();
      return S.gastos.map(g => ({ desc: g.desc, okFecha: Number.isFinite(g.month) && Number.isFinite(g.year), day: g.day }));
    });
    L.eq(r.map(x => x.desc), ['Fecha rara'], 'solo entra el de monto positivo');
    L.is(r[0] && r[0].okFecha && r[0].day > 0, 'con mes, año y día válidos aunque la fecha no se entendiera');
  }

  L.section('BUG10 · "Parece repetido" avisa también después de reabrir la app');
  {
    await d.ev(async () => {
      _gSaving = false; openGastoModal();
      $('gdesc').value = 'Café';
      document.querySelector('#gcats .chip[data-v="comida"]').click();
      $('gamt').value = '3300';
      document.querySelector('#ov-gasto .btnp').click();
      await new Promise(r => setTimeout(r, 300));
    });
    await recargar(d);
    L.is(await d.ev(() => _isDupGasto('Café', 3300)), 'cargar el mismo café al reabrir avisa que parece repetido');
  }

  L.section('BUG12 · Cada pedido a JSONBin sale una sola vez');
  {
    const n = await d.ev(async () => {
      const reales = window.fetch; let n = 0;
      window.fetch = (u, o) => { if (/jsonbin/.test(String(u))) n++; return reales(u, o); };
      await fetchSharedBin();
      window.fetch = reales;
      return n;
    });
    L.eq(n, 1, 'leer el bin compartido es un solo pedido (antes dos: Master-Key y Access-Key)');
  }

  L.section('BUG13 · Las copias del bin compartido son 5 como mucho');
  {
    const n = await d.ev(() => {
      for (let i = 0; i < 9; i++) saveSharedSnapshot([{ id: 's' + i, amount: i + 1, updatedAt: i + 1 }], [], 'prueba');
      return loadSharedSnapshots().length;
    });
    L.eq(n, 5, 'quedan las 5 más nuevas');
  }

  L.section('BUG14 · Las marcas de avisos de días anteriores se borran');
  {
    const r = await d.ev(async () => {
      localStorage.setItem('fin_notif_sent_2020-01-01', '["x"]');
      window.Notification = { permission: 'granted' };
      window.getNotifSettings = () => ({ vencOn: true, vencTime: '00:00', vencDays: 1 });
      window.sendNotif = async () => {};
      await checkTodayTaskNotifs();
      return localStorage.getItem('fin_notif_sent_2020-01-01');
    });
    L.eq(r, null, 'la del 1/1/2020 ya no está');
  }

  L.section('BUG17 · Reimportar el mismo Excel no duplica');
  {
    const r = await d.ev(() => {
      const f = new Date(), dmy = `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`;
      S.gastos = [{ id: 'x1', desc: 'Super', cat: 'super', amount: 12500, month: f.getMonth(), year: f.getFullYear(), day: f.getDate(), addedAt: new Date(f.getFullYear(), f.getMonth(), f.getDate(), 12).getTime() }];
      window.XLSX = { read: () => ({ SheetNames: ['h'], Sheets: { h: {} } }), utils: { sheet_to_json: () => [
        ['Nombre', 'Cat', 'Fecha', 'Monto', 'Semanal', 'Compartido', 'Quién pagó', 'División % Fede'],
        ['Super', 'super', dmy, 12500, 'Si', 'No', 'fede', 50],
        ['Farmacia', 'varios', dmy, 8000, 'Si', 'No', 'fede', 50]] } };
      parseExcelFileWithSheetJS(null);
      return excelReviewItems.map(g => [g.nombre, g.selected]);
    });
    L.eq(r, [['Super', false], ['Farmacia', true]], 'el que ya está cargado viene desmarcado y el nuevo marcado');
  }

  L.eq(d.errors, [], 'sin errores de JS');
  await d.close();

  await browser.close();
  console.log(`\n${'─'.repeat(50)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

// Mismo formato que fARS de la app, para comparar el texto de la pantalla.
function fARSnode(n) { return '$\u00a0' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
