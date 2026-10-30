// Arreglos de Compartidos (cálculos, fechas y UI) de la auditoría de la v34.27,
// cada uno con la reproducción con la que se encontró (informe A4, A14, A16,
// A18, A19, C11 y la mejora D3). Con la v34.27 cada sección termina en ✗.
//
//  1 · A4  huso al este de UTC+9: el gasto del 31 no cae en el mes siguiente
//  2 · A14 "Editar transferencia" no cuenta dos veces el pago en "Nuevo saldo"
//  3 · A16 el saldo de Compartidos va a centavos y el export de control coincide
//  4 · A18 el popup por categoría dice lo mismo que la lista ($500, no $501)
//  5 · A19 registrar un pago con la deuda < $1 o "Al día" (⋯ de Compartidos)
//  6 · D3  deshacer al borrar un gasto o una transferencia desde Compartidos
//  7 · C11 "Mile pagó todo": total en gris y sin "− $ 0" en el día
const L = require('./lib');

const sinAutoSync = d => d.ev(() => { if (typeof _sharedAutoTimer !== 'undefined' && _sharedAutoTimer) { clearInterval(_sharedAutoTimer); _sharedAutoTimer = null; } });
const nuevo = async (browser, opts) => { const d = await L.device(browser, opts); await sinAutoSync(d); return d; };
const sync = async (...ds) => {
  for (let i = 0; i < 2; i++) for (const d of ds) { await d.ev(() => syncCompartidos(null)); await d.settle(); await d.settle(); }
};
// Red lenta solo para el bin (lo que tarda JSONBin desde un teléfono).
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
const esperar = (d, ms) => d.page.waitForTimeout(ms);
// Alta de un compartido por el modal real (pagado por quien se indique).
const alta = (d, { desc, txt, paidBy, cat = 'comida' }) => d.ev(async o => {
  _gSaving = false;
  openGastoModal();
  $('gdesc').value = o.desc;
  document.querySelector(`#gcats .chip[data-v="${o.cat}"]`).click();
  $('gamt').value = o.txt;
  $('g-shared-toggle').click();
  [$('g-paidby-fede'), $('g-paidby-mile')].find(b => b && b.dataset.who === o.paidBy).click();
  document.querySelector('#g-split-presets [data-split="50"]').click();
  const btn = document.querySelector('#ov-gasto .btnp');
  btn.click();
  if ($('dup-warn').classList.contains('show')) { _gSaving = false; btn.click(); }
  await new Promise(r => setTimeout(r, 300));
  return S.gastos[S.gastos.length - 1].id;
}, { desc, txt, paidBy, cat });
const pago = (d, o) => d.ev(async o => {
  openSharedPaymentModal();
  if (o.payer) $('sp-payer-' + o.payer).click();
  $('sp-amount').value = o.txt;
  $('sp-save-btn').click();
  await new Promise(r => setTimeout(r, 40));
  const ps = getSharedPayments();
  return ps.length ? ps[ps.length - 1].id : null;
}, o);
const verCompartidos = d => d.ev(async () => {
  const hoy = new Date(); setGastosMonth(hoy.getMonth(), hoy.getFullYear());
  goTo('compartidos'); renderCompartidos(); await new Promise(r => setTimeout(r, 80));
});
// Borrar desde la fila de Compartidos por el ⋯ y la confirmación.
const borrarFila = (d, id) => d.ev(async id => {
  const hoy = new Date(); setGastosMonth(hoy.getMonth(), hoy.getFullYear());
  goTo('compartidos'); renderCompartidos(); await new Promise(r => setTimeout(r, 80));
  const row = [...document.querySelectorAll('#compartidos-list .sh-grow')].find(r => r.outerHTML.includes(id));
  if (!row) return { err: 'sin fila' };
  row.querySelector('.rmore').click();
  row.querySelector('.rmenu button.danger').click();
  await new Promise(r => setTimeout(r, 40));
  $('confirm-ok').click();
  await new Promise(r => setTimeout(r, 40));
  return { undo: !!_undoFn, enLista: [...document.querySelectorAll('#compartidos-list .sh-grow')].some(r => r.outerHTML.includes(id)) };
}, id);
const vista = (d, id) => d.ev(id => {
  const g = (_sharedBinGastos || []).find(x => x.id === id && x.shared && x.shared.active) || S.gastos.find(x => x.id === id && x.shared && x.shared.active);
  const p = _allKnownPayments().find(x => x.id === id);
  const t = (S._gTombs || {})[id] || (S._pTombs || {})[id] || 0;
  return { existe: !!(g || p), saldo: calcSharedDebtDetail().saldo, pend: sharedPendientes().total, tombMasNuevo: t && _itemTs(g || p) <= t ? true : false };
}, id);

(async () => {
  const browser = await L.launch();

  // ── 1 · A4: el gasto del 31 con el huso de la otra persona ────────────────
  // El gasto se cargó en Buenos Aires: 31/10 al mediodía = 15:00 UTC. En Tokio
  // (UTC+9) eso ya es el 1/11 a las 00:00 y en Sídney (UTC+11) las 02:00.
  for (const tz of ['Asia/Tokyo', 'Australia/Sydney', 'America/Argentina/Buenos_Aires', 'UTC']) {
    L.resetBins();
    L.section(`1 · A4 · el gasto del 31/10 con el huso ${tz}`);
    const d = await nuevo(browser, { myName: 'fede', compBin: 'a4-' + tz.replace(/\W/g, ''), contexto: { timezoneId: tz } });
    const r = await d.ev(async () => {
      const g = { id: 'g31', desc: 'Cena 31', cat: 'comida', amount: 1000, month: 9, year: 2027, day: 31, addedAt: Date.UTC(2027, 9, 31, 15), updatedAt: Date.UTC(2027, 9, 31, 15), shared: { active: true, paidBy: 'fede', splitPct: 50 } };
      S.gastos = [g]; _sharedBinGastos = [{ ...g }]; _sharedBinLoaded = true; save();
      const esp = () => new Promise(r => setTimeout(r, 120));
      const res = {};
      for (const m of [9, 10]) {
        setGastosMonth(m, 2027);
        goTo('compartidos'); renderCompartidos(); await esp();
        res['comp' + m] = document.querySelectorAll('#compartidos-list .sh-grow').length;
        res['compDia' + m] = [...document.querySelectorAll('#compartidos-list .day-label')].map(e => e.textContent.replace(/\s+/g, ' ').trim());
        goTo('gastos'); renderGastos(); await new Promise(r => setTimeout(r, 400));
        res['gas' + m] = document.querySelectorAll('#gastos-list .gasto-row').length;
        res['gasDia' + m] = [...document.querySelectorAll('#gastos-list .day-label')].map(e => e.textContent.replace(/\s+/g, ' ').trim());
      }
      setGastosMonth(9, 2027); goTo('compartidos'); renderCompartidos(); await esp();
      openSharedCatDetail('comida');
      res.popup = [...document.querySelectorAll('#shared-cat-popup [style*="min-width:34px"]')].map(e => e.innerText.replace(/\s+/g, ' ').trim());
      document.getElementById('shared-cat-popup')?.remove();
      openEditSharedGasto({ id: 'g31' }); res.editComp = $('esg-date').value; $('ov-edit-shared').classList.remove('open');
      openEditGasto(S.gastos[0]); res.editGasto = $('eg-date').value; $('ov-edit-gasto')?.classList.remove('open');
      res.busca = _sqFecha(S.gastos[0]) + ' | ' + _sqMes(S.gastos[0]);
      return res;
    });
    L.eq([r.comp9, r.comp10], [1, 0], 'Compartidos: el gasto está en octubre y no en noviembre');
    L.is(r.compDia9.length === 1 && /31/.test(r.compDia9[0]), `Compartidos: el día se lee 31 (${JSON.stringify(r.compDia9)})`);
    L.eq([r.gas9, r.gas10], [1, 0], 'Gastos: el gasto está en octubre y no en noviembre');
    L.is(r.gasDia9.length === 1 && /31/.test(r.gasDia9[0]), `Gastos: el día se lee 31 (${JSON.stringify(r.gasDia9)})`);
    L.is(r.popup.length === 1 && /31/.test(r.popup[0]), `popup por categoría: día 31 (${JSON.stringify(r.popup)})`);
    L.eq([r.editComp, r.editGasto], ['2027-10-31', '2027-10-31'], 'los dos editores muestran 2027-10-31');
    L.eq(r.busca, '31 oct 27 | 9-2027', 'el buscador lo muestra como 31 oct 27 (mes de octubre)');
    L.eq(d.errors, [], 'sin errores de JS');
    await d.close();
  }

  // ── 2 · A14: "Editar transferencia" ───────────────────────────────────────
  {
    L.resetBins();
    L.section('2 · A14 · el "Nuevo saldo" de Editar transferencia no cuenta dos veces el pago');
    const fede = await nuevo(browser, { myName: 'fede', compBin: 'a14' });
    const mile = await nuevo(browser, { myName: 'mile', compBin: 'a14' });
    await alta(fede, { desc: 'G', txt: '2000', paidBy: 'fede' });
    await sync(fede, mile);
    const id = await pago(mile, { payer: 'mile', txt: '400' });
    await sync(mile, fede);
    L.eq((await vista(fede, id)).saldo, 600, 'Fede: la deuda es 600 (1000 menos la transferencia de 400)');
    const p = await fede.ev(id => { openEditSharedPayment(id); return document.getElementById('sp-preview').textContent; }, id);
    L.is(/Mile te debe\s*\$\s*600/.test(p), `al abrir Editar transferencia dice que Mile te debe $ 600 (dice: ${p})`);
    const p2 = await fede.ev(() => { $('sp-amount').value = '1000'; updateSharedPaymentPreview(); return document.getElementById('sp-preview').textContent; });
    L.is(/Sin deuda/.test(p2), `con 1.000 queda sin deuda (dice: ${p2})`);
    const p3 = await fede.ev(() => { $('sp-amount').value = '300'; updateSharedPaymentPreview(); return document.getElementById('sp-preview').textContent; });
    L.is(/Mile te debe\s*\$\s*700/.test(p3), `con 300 Mile te debe $ 700 (dice: ${p3})`);
    // Cambiar quién transfirió: Fede paga 400 a Mile → base 1000, menos 0, más 400.
    const p4 = await fede.ev(() => { $('sp-amount').value = '400'; pickPaymentPayer('fede'); return document.getElementById('sp-preview').textContent; });
    L.is(/Mile te debe\s*\$\s*1\.400/.test(p4), `si en cambio transfirió Fede, Mile te debe $ 1.400 (dice: ${p4})`);
    await fede.ev(() => closeOv('ov-shared-payment'));
    // El alta nueva no cambia: con deuda 600, pagar 600 deja sin deuda.
    const p5 = await fede.ev(() => { openSharedPaymentModal(); $('sp-amount').value = '600'; updateSharedPaymentPreview(); return document.getElementById('sp-preview').textContent; });
    L.is(/Sin deuda/.test(p5), `el alta sigue igual: pagar 600 de 600 deja sin deuda (dice: ${p5})`);
    L.eq(fede.errors, [], 'sin errores de JS');
    await fede.close(); await mile.close();
  }

  // ── 3 · A16: el saldo a centavos ──────────────────────────────────────────
  {
    L.resetBins();
    L.section('3 · A16 · el saldo se redondea a centavos y el export de control coincide');
    const d = await nuevo(browser, { myName: 'fede', compBin: 'a16' });
    const res = await d.ev(() => {
      const rnd = (() => { let a = 99; return () => (a = (a * 1664525 + 1013904223) >>> 0) / 4294967296; })();
      const r = [];
      for (const n of [10, 40, 100, 300]) {
        _sharedBinLoaded = true;
        _sharedBinGastos = Array.from({ length: n }, (_, i) => ({ id: 'g' + n + '_' + i, desc: 'x', amount: Math.round(rnd() * 9e6) / 100, cat: 'super', addedAt: Date.now(), updatedAt: Date.now(), shared: { active: true, paidBy: rnd() < .5 ? 'fede' : 'mile', splitPct: 50 } }));
        _sharedBinPayments = Array.from({ length: Math.floor(n / 10) }, (_, i) => ({ id: 'p' + n + '_' + i, paidBy: rnd() < .5 ? 'fede' : 'mile', amount: Math.round(rnd() * 5e5) / 100, date: '2027-01-01', updatedAt: Date.now() }));
        exportCompartidosData();
        const j = JSON.parse(document.getElementById('comp-export-json').value);
        const s = calcSharedDebtDetail().saldo;
        r.push({ n, coincide: j.saldo.coincide, aCentavos: Math.abs(s * 100 - Math.round(s * 100)) < 1e-9 });
      }
      return r;
    });
    L.eq(res.map(x => x.coincide), [true, true, true, true], `export de control: coincide en 10, 40, 100 y 300 gastos (${JSON.stringify(res)})`);
    L.eq(res.map(x => x.aCentavos), [true, true, true, true], 'el saldo es un número de centavos exactos');
    L.eq(d.errors, [], 'sin errores de JS');
    await d.close();
  }

  // ── 4 · A18: popup por categoría vs lista ─────────────────────────────────
  {
    L.resetBins();
    L.section('4 · A18 · el popup por categoría usa la misma cuenta que la lista (gasto impar)');
    const fede = await nuevo(browser, { myName: 'fede', compBin: 'a18' });
    const mile = await nuevo(browser, { myName: 'mile', compBin: 'a18' });
    await alta(fede, { desc: 'Impar', txt: '1001', paidBy: 'fede' });
    await sync(fede, mile);
    for (const [d, esperado] of [[fede, /(prestaste|te deben)\s*\$\s*500\b/], [mile, /(pediste|debés)\s*\$\s*500\b/]]) {
      const r = await d.ev(async () => {
        const hoy = new Date(); setGastosMonth(hoy.getMonth(), hoy.getFullYear());
        goTo('compartidos'); renderCompartidos(); await new Promise(r => setTimeout(r, 80));
        const lista = document.querySelector('#compartidos-list .sh-grow .sh-amt-wrap').innerText.replace(/\s+/g, ' ');
        openSharedCatDetail('comida');
        const popup = document.querySelector('#shared-cat-popup [style*="text-align:right"]').innerText.replace(/\s+/g, ' ');
        return { lista, popup };
      });
      L.is(esperado.test(r.lista), `${d === fede ? 'Fede' : 'Mile'}: la lista dice ${r.lista}`);
      L.is(esperado.test(r.popup), `${d === fede ? 'Fede' : 'Mile'}: el popup dice lo mismo (${r.popup})`);
      await d.ev(() => document.getElementById('shared-cat-popup')?.remove());
    }
    L.eq([fede.errors, mile.errors], [[], []], 'sin errores de JS');
    await fede.close(); await mile.close();
  }

  // ── 5 · A19: registrar un pago con la deuda < $1 o "Al día" ───────────────
  {
    L.resetBins();
    L.section('5 · A19 · "Registrar pago" desde el ⋯ de Compartidos cuando no hay deuda');
    const fede = await nuevo(browser, { myName: 'fede', compBin: 'a19' });
    const mile = await nuevo(browser, { myName: 'mile', compBin: 'a19' });
    const menu = d => d.ev(async () => {
      const hoy = new Date(); setGastosMonth(hoy.getMonth(), hoy.getFullYear());
      goTo('compartidos'); renderCompartidos(); await new Promise(r => setTimeout(r, 80));
      const card = document.querySelector('.sh-card');
      return { liquidar: !!card.querySelector('.sh-btn-liq'), items: [...card.querySelectorAll('.rmenu button')].map(b => b.textContent.trim()), alDia: /Al día/.test(card.textContent) };
    });
    let m = await menu(fede);
    L.is(m.alDia && !m.liquidar, 'sin gastos: "Al día" y sin botón Liquidar');
    L.is(m.items.includes('Registrar pago'), `el ⋯ ofrece "Registrar pago" (${JSON.stringify(m.items)})`);
    // Adelanto: Fede le adelanta $500 a Mile sin deuda previa.
    const r = await fede.ev(async () => {
      document.querySelector('.sh-card .rmore').click();
      [...document.querySelectorAll('.sh-card .rmenu button')].find(b => /Registrar pago/.test(b.textContent))?.click();
      await new Promise(r => setTimeout(r, 400));
      const abierto = $('ov-shared-payment').classList.contains('open');
      $('sp-payer-fede').click(); $('sp-amount').value = '500';
      updateSharedPaymentPreview();
      const prev = $('sp-preview').textContent;
      $('sp-save-btn').click();
      await new Promise(r => setTimeout(r, 60));
      return { abierto, prev, pagos: getSharedPayments().map(p => [p.paidBy, p.amount]), saldo: calcSharedDebt() };
    });
    L.is(r.abierto, 'tocar la opción abre el modal de pago');
    L.eq(r.pagos, [['fede', 500]], `el adelanto queda registrado (${r.prev})`);
    L.eq(r.saldo, 500, 'y Fede ve que Mile le debe $ 500 (saldo +500)');
    await sync(fede, mile);
    L.eq((await mile.ev(() => calcSharedDebt())), -500, 'Mile ve el adelanto en su saldo (le debe $ 500 a Fede)');
    // Deuda de centavos: gasto de $1,01 → la parte del otro es $0,01 (< $1).
    L.resetBins();
    const f2 = await nuevo(browser, { myName: 'fede', compBin: 'a19b' });
    await alta(f2, { desc: 'Chicle', txt: '1.01', paidBy: 'fede' });
    m = await menu(f2);
    const deuda = await f2.ev(() => calcSharedDebt());
    L.is(deuda > 0 && deuda < 1 && !m.liquidar && m.items.includes('Registrar pago'), `con $${deuda} de deuda no hay Liquidar pero sí "Registrar pago" en el ⋯`);
    const r2 = await f2.ev(async () => {
      document.querySelector('.sh-card .rmore').click();
      [...document.querySelectorAll('.sh-card .rmenu button')].find(b => /Registrar pago/.test(b.textContent))?.click();
      await new Promise(r => setTimeout(r, 400));
      $('sp-payer-mile').click(); $('sp-amount').value = '0,01';
      $('sp-save-btn').click();
      await new Promise(r => setTimeout(r, 60));
      return { saldo: calcSharedDebt(), pagos: getSharedPayments().map(p => [p.paidBy, p.amount]) };
    });
    L.eq(r2, { saldo: 0, pagos: [['mile', 0.01]] }, 'se registra el pago de $0,01 y la deuda queda en 0');
    // Con deuda de verdad, el ⋯ no repite lo que ya hace Liquidar.
    L.resetBins();
    const f3 = await nuevo(browser, { myName: 'fede', compBin: 'a19c' });
    await alta(f3, { desc: 'Cena', txt: '2000', paidBy: 'fede' });
    m = await menu(f3);
    L.is(m.liquidar && !m.items.includes('Registrar pago'), `con deuda: Liquidar a la vista y el ⋯ sin "Registrar pago" (${JSON.stringify(m.items)})`);
    L.eq([fede.errors, mile.errors, f2.errors, f3.errors], [[], [], [], []], 'sin errores de JS');
    await fede.close(); await mile.close(); await f2.close(); await f3.close();
  }

  // ── 6 · D3: deshacer al borrar desde Compartidos ──────────────────────────
  const escenarios = [
    { nombre: 'un gasto propio', prep: async (f, m) => alta(f, { desc: 'Cena', txt: '10000', paidBy: 'fede' }), saldoSin: 0, saldoCon: 5000, quien: 'fede' },
    { nombre: 'un gasto de la pareja', prep: async (f, m) => alta(m, { desc: 'Taxi', txt: '4000', paidBy: 'mile' }), saldoSin: 0, saldoCon: -2000, quien: 'fede' },
    { nombre: 'una transferencia', prep: async (f, m) => { await alta(f, { desc: 'Cena', txt: '10000', paidBy: 'fede' }); await sync(f, m); return pago(m, { payer: 'mile', txt: '1000' }); }, saldoSin: 5000, saldoCon: 4000, quien: 'fede' },
  ];
  for (const esc of escenarios) {
    for (const [ms, espera] of [[0, 600], [800, 300], [800, 1200]]) {
      L.resetBins();
      const BIN = `d3-${esc.nombre.replace(/\W/g, '')}-${ms}-${espera}`;
      L.section(`6 · D3 · borrar ${esc.nombre} desde Compartidos y deshacer · ${ms} ms por pedido, Deshacer a los ${espera} ms`);
      const fede = await nuevo(browser, { myName: 'fede', compBin: BIN });
      const mile = await nuevo(browser, { myName: 'mile', compBin: BIN });
      const id = await esc.prep(fede, mile);
      await sync(fede, mile);
      const antes = await vista(fede, id);
      L.is(antes.existe && antes.saldo === esc.saldoCon, `antes de borrar: existe y el saldo de Fede es ${esc.saldoCon} (${antes.saldo})`);
      await demora(fede, ms);
      const b = await borrarFila(fede, id);
      L.is(b.undo, 'al confirmar aparece "Deshacer"');
      L.is(!b.enLista, 'la fila sale de la lista');
      await esperar(fede, espera);
      const sigue = await fede.ev(() => !!_undoFn);
      L.is(sigue, 'el "Deshacer" sigue a la vista (el aviso de fondo no lo pisa)');
      await fede.ev(() => undoLast());
      await esperar(fede, ms * 8 + 600);
      await demora(fede, 0);
      await sync(fede, mile, fede);
      const [vf, vm] = [await vista(fede, id), await vista(mile, id)];
      L.is(vf.existe && vm.existe, 'después de deshacer los dos teléfonos lo tienen');
      L.eq([vf.saldo, vm.saldo], [esc.saldoCon, -esc.saldoCon], `con el mismo saldo en los dos (${vf.saldo} / ${vm.saldo})`);
      L.eq([vf.pend, vm.pend], [0, 0], 'sin pendientes de subir');
      L.eq([vf.tombMasNuevo, vm.tombMasNuevo], [false, false], 'ninguna marca de borrado más nueva que el ítem (sin fantasmas)');
      // Pasa un buen rato y los dos siguen igual (no se vuelve a borrar solo).
      await esperar(fede, 500);
      await sync(mile, fede);
      const [wf, wm] = [await vista(fede, id), await vista(mile, id)];
      L.eq([wf.existe, wm.existe, wf.saldo, wm.saldo], [true, true, esc.saldoCon, -esc.saldoCon], 'tras otra ronda de sync sigue en los dos');
      L.eq([fede.errors, mile.errors], [[], []], 'sin errores de JS');
      await fede.close(); await mile.close();
    }
    // Sin tocar "Deshacer" el borrado se aplica igual en los dos teléfonos.
    L.resetBins();
    L.section(`6 · D3 · borrar ${esc.nombre} desde Compartidos sin deshacer`);
    const fede = await nuevo(browser, { myName: 'fede', compBin: 'd3sin-' + esc.nombre.replace(/\W/g, '') });
    const mile = await nuevo(browser, { myName: 'mile', compBin: 'd3sin-' + esc.nombre.replace(/\W/g, '') });
    const id = await esc.prep(fede, mile);
    await sync(fede, mile);
    await borrarFila(fede, id);
    await esperar(fede, 700);
    await fede.ev(() => { _undoFn = null; });
    await sync(fede, mile, fede);
    const [vf, vm] = [await vista(fede, id), await vista(mile, id)];
    L.eq([vf.existe, vm.existe], [false, false], 'borrado en los dos teléfonos');
    L.eq([vf.saldo, vm.saldo], [esc.saldoSin, -esc.saldoSin], `con el mismo saldo (${vf.saldo} / ${vm.saldo})`);
    L.eq([fede.errors, mile.errors], [[], []], 'sin errores de JS');
    await fede.close(); await mile.close();
  }

  // ── 7 · C11: "Mile pagó todo" ─────────────────────────────────────────────
  {
    L.resetBins();
    L.section('7 · C11 · fila de Gastos con "Mile pagó todo": total en gris y sin "− $ 0" en el día');
    const fede = await nuevo(browser, { myName: 'fede', compBin: 'c11' });
    const r = await fede.ev(async () => {
      const hoy = new Date(); const t = Date.now();
      const base = { cat: 'comida', month: hoy.getMonth(), year: hoy.getFullYear(), day: hoy.getDate(), addedAt: t, updatedAt: t };
      const todoDeMile = { ...base, id: 'c0', desc: 'Taxi de Mile', amount: 7000, shared: { active: true, paidBy: 'mile', splitPct: 100 } };
      S.gastos = []; _sharedBinGastos = [todoDeMile]; _sharedBinLoaded = true; save();
      setGastosMonth(hoy.getMonth(), hoy.getFullYear());
      goTo('gastos'); renderGastos(); await new Promise(r => setTimeout(r, 500));
      const fila = () => document.querySelector('#gastos-list .gasto-row[data-id="c0"]');
      const sol = { fila: fila().innerText.replace(/\s+/g, ' '), amtColor: getComputedStyle(fila().querySelector('.gamt')).color, totales: [...document.querySelectorAll('#gastos-list .day-total')].map(e => e.textContent.trim()) };
      S.gastos = [{ ...base, id: 'c1', desc: 'Super', amount: 3000 }]; save();
      renderGastos(); await new Promise(r => setTimeout(r, 500));
      const con = { totales: [...document.querySelectorAll('#gastos-list .day-total')].map(e => e.textContent.replace(/\s+/g, ' ').trim()) };
      return { sol, con, muted: getComputedStyle(document.documentElement).getPropertyValue('--muted') };
    });
    L.is(/Mile pagó todo/.test(r.sol.fila), `la fila dice "Mile pagó todo" (${r.sol.fila})`);
    L.is(/7\.000/.test(r.sol.fila) && !/\$\s*0\b/.test(r.sol.fila), 'y muestra el total de $ 7.000, no "$ 0"');
    L.is(r.sol.totales.length === 0, `un día solo con eso no lleva "− $ 0" (${JSON.stringify(r.sol.totales)})`);
    L.is(r.con.totales.length === 1 && /3\.000/.test(r.con.totales[0]), `con otro gasto de $ 3.000 el día suma 3.000 (${JSON.stringify(r.con.totales)})`);
    L.eq(fede.errors, [], 'sin errores de JS');
    await fede.close();
  }

  await browser.close();
  console.log(`\n${'─'.repeat(50)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
