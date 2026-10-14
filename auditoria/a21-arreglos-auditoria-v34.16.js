// Los seis arreglos de la auditoría de la v34.16 (v34.17), cada uno con la
// reproducción con la que se encontró: dos que perdían datos en Compartidos
// (deshacer un borrado con la subida en vuelo; corregir un gasto de la pareja
// y cerrar la app enseguida) y cuatro que dejaban la plata mal sin avisar
// (compra en cuotas con el nombre de una terminada, corregir la fecha de una
// cuota vieja, deshacer "marcar como compartido" y el Resultado del Plan al
// pagar). Con la v34.16 cada sección termina en ✗.
const L = require('./lib');

// Red lenta solo para el bin: lo que tarda JSONBin desde un teléfono.
const demora = (d, ms) => d.ev(ms => {
  if (!window.__fetchSinDemora) {
    window.__fetchSinDemora = window.fetch;
    window.fetch = async (u, o) => {
      if (window.__demora && /jsonbin/.test(String(u && u.url ? u.url : u))) await new Promise(r => setTimeout(r, window.__demora));
      return window.__fetchSinDemora(u, o);
    };
  }
  window.__demora = ms;
}, ms);
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
const hoyKey = () => { const f = new Date(); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`; };
// Alta de un compartido 50/50 por el modal, pagado por quien lo carga.
const altaCompartido = (d, desc, txt) => d.ev(async ({ desc, txt }) => {
  _gSaving = false;
  openGastoModal();
  $('gdesc').value = desc;
  document.querySelector('#gcats .chip[data-v="comida"]').click();
  $('gamt').value = txt;
  $('g-shared-toggle').click();
  const yo = getMyName();
  [$('g-paidby-fede'), $('g-paidby-mile')].find(b => b && b.dataset.who === yo).click();
  document.querySelector('#g-split-presets [data-split="50"]').click();
  const btn = document.querySelector('#ov-gasto .btnp');
  btn.click();
  if ($('dup-warn').classList.contains('show')) { _gSaving = false; btn.click(); }
  await new Promise(r => setTimeout(r, 300));
  return S.gastos[S.gastos.length - 1].id;
}, { desc, txt });
// Lo que cada teléfono ve en Compartidos para un id.
const verComp = (d, id) => d.ev(id => {
  const g = (_sharedBinGastos || []).find(x => x.id === id && x.shared && x.shared.active) || S.gastos.find(x => x.id === id && x.shared && x.shared.active);
  return { amount: g ? g.amount : null, saldo: calcSharedDebtDetail().saldo, pend: sharedPendientes().total };
}, id);

(async () => {
  const browser = await L.launch();

  // ── 1. Deshacer un borrado compartido con la subida en vuelo ──────────────
  for (const [ms, espera] of [[0, 1500], [800, 300], [800, 1200], [1500, 3500]]) {
    L.resetBins();
    const BIN = `deshacer-${ms}-${espera}`;
    L.section(`Borrar un compartido desde Gastos y deshacer · ${ms} ms por pedido, Deshacer a los ${espera} ms`);
    const fede = await L.device(browser, { myName: 'fede', compBin: BIN });
    const mile = await L.device(browser, { myName: 'mile', compBin: BIN });
    await sinAutoSync(fede); await sinAutoSync(mile);
    const id = await altaCompartido(fede, 'Cena', '10000');
    await sync(fede, mile);
    await demora(fede, ms);
    const r = await fede.ev(async id => {
      goTo('gastos'); renderGastos();
      const row = document.querySelector(`#gastos-list [data-id="${id}"]`);
      row.querySelector('.rmore').click();
      [...row.querySelectorAll('.rmenu button')].find(x => /Eliminar/.test(x.textContent)).click();
      await new Promise(r => setTimeout(r, 30));
      $('confirm-ok').click();
      await new Promise(r => setTimeout(r, 30));
      return !!_undoFn;
    }, id);
    L.is(r, 'Fede borra "Cena" y aparece "Deshacer"');
    await fede.page.waitForTimeout(espera);
    await fede.ev(() => undoLast());
    await fede.page.waitForTimeout(ms * 8 + 500);
    await demora(fede, 0);
    await sync(fede, mile);
    L.is(await fede.ev(id => S.gastos.some(g => g.id === id), id), 'después de deshacer, "Cena" sigue en Gastos de Fede');
    const [vf, vm] = [await verComp(fede, id), await verComp(mile, id)];
    L.eq([vf.amount, vm.amount], [10000, 10000], 'y los dos teléfonos lo ven en Compartidos');
    L.eq([vf.saldo, vm.saldo], [5000, -5000], 'con la deuda de $5.000 en los dos');
    const enBin = ((L.bins[BIN] || {}).gastos || []);
    L.is(typeof enBin === 'string' || enBin.some(g => g.id === id && g.shared && g.shared.active), 'y sigue activo en el bin');
    L.eq(fede.errors, [], 'sin errores de JS');
    await fede.close(); await mile.close();
  }

  // ── 2. Corregir un gasto de la pareja y cerrar la app enseguida ───────────
  {
    L.resetBins();
    const BIN = 'cerrar-al-toque';
    L.section('Corregir un gasto de Mile con la red lenta y cerrar la app al segundo');
    const fede = await L.device(browser, { myName: 'fede', compBin: BIN });
    const mile = await L.device(browser, { myName: 'mile', compBin: BIN });
    await sinAutoSync(fede); await sinAutoSync(mile);
    const id = await altaCompartido(mile, 'Luz', '20000');
    await sync(fede, mile);
    await demora(fede, 3000);
    const abierto = await fede.ev(id => {
      openEditSharedGasto({ id });
      $('esg-amt').value = '24000';
      document.querySelector('#ov-edit-shared .btnp').click();
      return $('ov-edit-shared').classList.contains('open');
    }, id);
    L.is(!abierto, 'Fede corrige "Luz" a $24.000 y el editor se cierra');
    await fede.page.waitForTimeout(1000);
    await recargar(fede);
    L.eq((await verComp(fede, id)).amount, 24000, 'al reabrir la app la corrección sigue ahí');
    await sync(fede, mile);
    const [vf, vm] = [await verComp(fede, id), await verComp(mile, id)];
    L.eq([vf.amount, vm.amount], [24000, 24000], 'y después de sincronizar los dos ven $24.000');
    L.eq([vf.saldo, vm.saldo], [-12000, 12000], 'con la misma deuda');
    L.eq([vf.pend, vm.pend], [0, 0], 'sin nada pendiente de subir');
    await fede.close(); await mile.close();
  }

  // ── 3. Deshacer "marcar como compartido" ──────────────────────────────────
  {
    L.resetBins();
    const BIN = 'deshacer-marca';
    L.section('Marcar como compartido un gasto propio (sin campo shared) y deshacer');
    const fede = await L.device(browser, { myName: 'fede', compBin: BIN });
    await sinAutoSync(fede);
    const u = await fede.ev(async () => {
      const d = new Date();
      S.gastos.push({ id: 'pg1', desc: 'Netflix', cat: 'suscripciones', amount: 5000, month: d.getMonth(), year: d.getFullYear(), day: d.getDate(), addedAt: d.getTime() });
      save();
      openEditGasto(S.gastos.find(g => g.id === 'pg1')); await new Promise(r => setTimeout(r, 400));
      toggleEditShared();
      doSaveEditGasto();
      await new Promise(r => setTimeout(r, 300));
      const marcado = !!S.gastos.find(g => g.id === 'pg1').shared?.active;
      undoLast();
      await new Promise(r => setTimeout(r, 300));
      return { marcado, despues: !!S.gastos.find(g => g.id === 'pg1').shared?.active };
    });
    await fede.settle(); await fede.settle();
    L.is(u.marcado, 'al guardar queda compartido');
    L.is(!u.despues, 'después de Deshacer vuelve a ser solo de Fede');
    const enBin = ((L.bins[BIN] || {}).gastos || []).find(g => g.id === 'pg1');
    L.is(!(enBin && enBin.shared && enBin.shared.active), 'y en el bin no queda activo (Mile no lo debe)');
    await fede.close();
  }

  // ── 4. Compra en cuotas con el nombre de una ya terminada ────────────────
  {
    L.resetBins();
    L.section('Compra nueva "Heladera" en 6 cuotas de $20.000 (la vieja de 3 × $10.000 ya está terminada)');
    const y = new Date().getFullYear() - 1;
    const viejos = [0, 1, 2].map(i => ({ id: 'hv' + i, desc: 'Heladera', cat: 'tarjeta', amount: 10000, month: i, year: y, day: 10,
      addedAt: new Date(y, i, 10, 12).getTime(), cuotaActual: i + 1, cuotaTotal: 3 }));
    const fede = await L.device(browser, { myName: 'fede', compBin: 'cuotas-nombre', seed: {
      gastos: viejos,
      agenda: { subs: [], vencimientos: [], inversiones: [], cuotas: [{ id: 'cqv', name: 'Heladera', fee: 10000, total: 3, paid: 3, startDate: `${y}-01-01`, nextDueDate: `${y}-04-10`, dueDay: 10, completedAt: Date.now() - 86400000 }] },
    } });
    await recargar(fede);
    await fede.ev(async () => {
      goTo('gastos'); _gSaving = false; openGastoModal(); await new Promise(r => setTimeout(r, 300));
      $('gdesc').value = 'Heladera'; $('gamt').value = '20000';
      document.querySelector('#gcats .chip[data-v="tarjeta"]').click(); updCuotaFields();
      $('gct').value = '6'; $('gca').value = '1';
      doSaveGasto(); await new Promise(r => setTimeout(r, 600));
    });
    await recargar(fede);
    const b = await fede.ev(() => {
      const c = S.agenda.cuotas.find(c => /heladera/i.test(c.name));
      const p = S.plan.find(p => /heladera/i.test(p.name));
      return { cuota: { fee: c.fee, total: c.total, paid: c.paid }, meses: p ? Object.keys(p.months).length : 0 };
    });
    L.eq(b.cuota, { fee: 20000, total: 6, paid: 1 }, 'tras recargar la app sigue siendo 6 cuotas de $20.000 con 1 paga');
    L.eq(b.meses, 5, 'y el Plan proyecta las 5 que faltan');
    const c = await fede.ev(async () => {
      const c = S.agenda.cuotas.find(c => /heladera/i.test(c.name));
      const n0 = S.gastos.length;
      markCuotaPaid(c.id); await new Promise(r => setTimeout(r, 200));
      confirmCuotaPay(S.accounts[0].id); await new Promise(r => setTimeout(r, 300));
      const g = S.gastos[S.gastos.length - 1];
      return { nuevos: S.gastos.length - n0, g: g && { amount: g.amount, n: g.cuotaActual, t: g.cuotaTotal } };
    });
    L.eq(c.nuevos, 1, 'pagar la cuota 2 registra su gasto (no la confunde con la 2 de la compra vieja)');
    L.eq(c.g, { amount: 20000, n: 2, t: 6 }, 'que es la cuota 2 de 6 por $20.000');
    await fede.close();
  }

  // ── 5. Corregir la fecha de una cuota vieja ──────────────────────────────
  {
    L.resetBins();
    L.section('"TV" en 6 cuotas con 4 pagas: corregir solo la fecha de la cuota 1');
    const hoy = new Date(), y = hoy.getFullYear(), m = hoy.getMonth();
    const g = n => { const d = new Date(y, m - 4 + n, 5, 12); return { id: 'tv' + n, desc: 'TV', cat: 'tarjeta', amount: 50000, month: d.getMonth(), year: d.getFullYear(), day: 5, addedAt: d.getTime(), cuotaActual: n, cuotaTotal: 6 }; };
    const ini = new Date(y, m - 3, 1), next = new Date(y, m + 1, 5);
    const k = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const fede = await L.device(browser, { myName: 'fede', compBin: 'cuota-fecha', seed: {
      gastos: [1, 2, 3, 4].map(g),
      agenda: { subs: [], vencimientos: [], inversiones: [], cuotas: [{ id: 'cqtv', name: 'TV', fee: 50000, total: 6, paid: 4, startDate: `${k(ini)}-01`, nextDueDate: `${k(next)}-05`, dueDay: 5 }] },
    } });
    const r = await fede.ev(async () => {
      const g1 = S.gastos.find(x => x.id === 'tv1');
      openEditGasto(g1); await new Promise(r => setTimeout(r, 400));
      const d = new Date(g1.addedAt); d.setDate(3);
      $('eg-date').value = localKey(d);
      doSaveEditGasto(); await new Promise(r => setTimeout(r, 300));
      const c = S.agenda.cuotas.find(c => c.id === 'cqtv');
      return { paid: c.paid, next: c.nextDueDate, dueDay: c.dueDay, atrasadas: cuotaAtrasadas(c).length };
    });
    L.eq(r.paid, 4, 'la compra sigue con 4 cuotas pagas');
    L.eq(r.next, `${k(next)}-05`, 'y la próxima sigue venciendo el 5 del mes que viene');
    L.eq(r.atrasadas, 0, 'sin cuotas "adeudadas" que ya tienen su gasto');
    await fede.close();
  }

  // ── 6. Plan: el Resultado del mes al pagar ────────────────────────────────
  {
    L.resetBins();
    L.section('Plan: cobrar y pagar no cambian el Resultado del mes; deshacer tampoco');
    const now = new Date(), M = now.getMonth(), Y = now.getFullYear();
    const pk = i => { const d = new Date(Y, M + i, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
    const vence = `${pk(0)}-25`;
    const fede = await L.device(browser, { myName: 'fede', compBin: 'plan-resultado', seed: {
      accounts: [{ id: 'acc1', name: 'Galicia', type: 'bancaria', amount: 2000000, currency: 'ARS' }],
      plan: [{ id: 'p1', name: 'Sueldo', cat: 'ingreso', months: { [pk(0)]: 2500000, [pk(1)]: 2500000 }, order: 1 }],
      agenda: {
        subs: [{ id: 's1', name: 'Netflix', amount: 13000, date: vence, period: 'mensual' }],
        vencimientos: [{ id: 'v1', name: 'Alquiler', amount: 600000, date: vence, period: 'mensual' },
                       { id: 'v2', name: 'Patente', amount: 90000, date: vence, period: 'unica' }],
        cuotas: [{ id: 'c2', name: 'Celular', fee: 80000, total: 3, paid: 2, startDate: `${pk(-2)}-01`, nextDueDate: `${pk(0)}-20`, dueDay: 20 }],
        inversiones: [],
      },
    } });
    await recargar(fede);
    // La cuenta: sueldo 2.500.000 − (600.000 + 13.000 + 90.000 + 80.000) = 1.717.000
    const ESPERADO = 2500000 - 600000 - 13000 - 90000 - 80000;
    const leer = () => fede.ev(() => {
      renderProj();
      const vis = getProjMonths(), mi = vis[0];
      const ings = S.plan.filter(p => p.cat === 'ingreso'), gas = S.plan.filter(p => p.cat !== 'ingreso');
      const enCol = mi => ings.reduce((a, p) => a + ((p.months || {})[mi] || 0) + ((p.cobrado || {})[mi] || 0), 0) - gas.reduce((a, p) => a + ((p.months || {})[mi] || 0), 0) - ((S.planPagado || {})[mi] || 0);
      const fila = [...document.querySelectorAll('#ptable tr')].find(r => r.cells[0] && r.cells[0].textContent.includes('Resultado del mes'));
      return { calc: enCol(mi), celda: fila ? fila.cells[1].textContent : null, saldo: S.accounts[0].amount };
    });
    const r0 = await leer();
    L.eq(r0.calc, ESPERADO, `antes de pagar, el Resultado es ${ESPERADO}`);
    await fede.ev(() => { openCollectModal('p1', pkNow()); confirmCollect('acc1'); });
    const r1 = await leer();
    L.eq(r1.calc, ESPERADO, 'cobrar el sueldo no lo cambia');
    await fede.ev(() => { markVencPaid('v1'); confirmPayDeduct('acc1'); });
    const r2 = await leer();
    L.eq(r2.calc, ESPERADO, 'pagar el Alquiler (mensual) no lo cambia');
    L.eq(r2.celda, r1.celda, 'y la celda muestra lo mismo que antes de pagar');
    await fede.ev(() => { markSubPaid('s1'); confirmPayDeduct('acc1'); });
    L.eq((await leer()).calc, ESPERADO, 'pagar Netflix (suscripción) no lo cambia');
    await fede.ev(() => { markVencPaid('v2'); confirmPayDeduct('acc1'); });
    L.eq((await leer()).calc, ESPERADO, 'pagar la Patente (vencimiento único, sale del Plan) no lo cambia');
    await fede.ev(async () => { markCuotaPaid('c2'); await new Promise(r => setTimeout(r, 200)); confirmCuotaPay('acc1'); });
    const r5 = await leer();
    L.eq(r5.calc, ESPERADO, 'pagar la última cuota del Celular no lo cambia');
    L.eq(r5.saldo, 2000000 + 2500000 - 600000 - 13000 - 90000 - 80000, 'y el saldo de Galicia bajó exactamente lo pagado');
    await fede.ev(() => undoLast());
    L.eq((await leer()).calc, ESPERADO, 'deshacer el pago de la cuota tampoco (la cuota vuelve a la columna)');
    L.eq(fede.errors, [], 'sin errores de JS');
    await fede.close();
  }

  await browser.close();
  console.log(`\n${'─'.repeat(50)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
