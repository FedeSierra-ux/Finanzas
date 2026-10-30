// Los arreglos del Plan y la Agenda de la v34.26 (auditoría de la v34.25,
// ítems 4-9, 17, 22, 27, 28, 34 y 35), cada uno con la reproducción que lo
// encontró. El reloj arranca el 15/10/2026 y después salta a diciembre y a
// 14 meses más adelante. Con la v34.25 casi todas las secciones terminan en ✗.
const L = require('./lib');
const { ok, eq, is, section } = L;

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const d = await L.device(browser, { myName: 'fede', compBin: null, seed: {
    accounts: [{ id: 'galicia', name: 'Galicia', type: 'bancaria', amount: 1000000, currency: 'ARS' },
               { id: 'efectivo', name: 'Efectivo', type: 'varios', amount: 200000, currency: 'ARS' },
               { id: 'fci', name: 'FCI', type: 'inversión', amount: 500000, currency: 'ARS' }],
  } });
  await d.page.waitForTimeout(400);
  const waitApp = async () => {
    await d.page.waitForFunction(() => typeof S === 'object' && S !== null && typeof save === 'function');
    await d.page.waitForTimeout(300);
    await d.ev(() => { clearInterval(_sharedAutoTimer); clearInterval(_tcAutoTimer); window.__toasts = []; const st = window.showToast; window.showToast = (m, a, b, c) => { window.__toasts.push(String(m)); return st(m, a, b, c); }; });
  };
  // v34.28: un salto de reloj de más de 60 días (o hacia atrás) pregunta antes de
  // rodar la Agenda y podar el Plan (a36 lo prueba). Acá lo que se prueba es el
  // rodado, así que cada salto cuenta como primera apertura.
  const sinUltimaApertura = () => d.ev(() => localStorage.removeItem('fin_last_open'));
  await sinUltimaApertura();
  await d.page.clock.install({ time: new Date(2026, 9, 15, 12) });
  await d.page.reload(); await waitApp();
  const setClock = async t => { await d.page.clock.setSystemTime(t); await sinUltimaApertura(); await d.page.reload(); await waitApp(); };
  const ev = (fn, a) => d.ev(fn, a);

  // ── Acciones por la UI ──────────────────────────────────────────────────
  const uiPlan = o => ev(o => { openProjModal(o.cat); $('prn').value = o.name; $('pra').value = o.amount;
    if (o.cadence) document.querySelector(`#pr-cadence .chip[data-v="${o.cadence}"]`).click();
    if (o.subcat) document.querySelector(`#pr-cats .chip[data-v="${o.subcat}"]`).click();
    const n0 = S.plan.length; document.querySelector('#ov-proj .btnp').click(); return S.plan.length - n0; }, o);
  const uiAgenda = o => ev(o => { openAgendaModal(o.type); $('ag-name').value = o.name; $('ag-amount').value = o.amount; $('ag-date').value = o.date;
    document.querySelector(`#ag-period .chip[data-v="${o.period || 'mensual'}"]`).click();
    const n0 = S.agenda.subs.length + S.agenda.vencimientos.length; document.querySelector('#ov-agenda .btnp').click();
    return S.agenda.subs.length + S.agenda.vencimientos.length - n0; }, o);
  const celda = (base, k, val) => ev(({ base, k, val }) => {
    goTo('agenda'); switchAgendaTab('plan'); renderProj();
    const tr = [...document.querySelectorAll('#ptable tbody tr')].find(r => r.cells[0] && r.cells[0].textContent.trim().replace(/^[^\p{L}]+/u, '').toLowerCase().startsWith(base.toLowerCase()));
    const idx = getProjMonths().indexOf(k); const inp = tr.cells[idx + 1].querySelector('input');
    inp.focus(); inp.value = val; inp.dispatchEvent(new Event('change')); inp.blur();
    return S.plan.find(x => x.id === tr.dataset.id).months[k]; }, { base, k, val });
  const filaPlan = base => ev(base => { goTo('agenda'); switchAgendaTab('plan'); renderProj();
    const tr = [...document.querySelectorAll('#ptable tbody tr')].find(r => r.cells[0] && r.cells[0].textContent.trim().replace(/^[^\p{L}]+/u, '').toLowerCase().startsWith(base.toLowerCase()));
    return tr ? [...tr.cells].slice(1).map(td => { const i = td.querySelector('input'); return (i ? i.value : td.textContent.trim()) || '—'; }) : null; }, base);
  const pagar = (kind, name, acc) => ev(async ({ kind, name, acc }) => {
    const it = (kind === 'sub' ? S.agenda.subs : S.agenda.vencimientos).find(x => x.name === name);
    if (kind === 'sub') markSubPaid(it.id); else markVencPaid(it.id);
    await new Promise(r => setTimeout(r, 60));
    const campo = { oculto: $('pay-amt-field').classList.contains('hidden'), valor: $('pay-amt').value, sub: $('pay-modal-sub').textContent };
    [...document.querySelectorAll('#pay-acct-list button')].find(b => b.textContent.includes(acc)).click();
    await new Promise(r => setTimeout(r, 60));
    const it2 = (kind === 'sub' ? S.agenda.subs : S.agenda.vencimientos).find(x => x.name === name);
    const g = S.gastos.slice(-1)[0];
    return { date: it2 && it2.date, debe: (it2 && it2.debe) || null, campo, gasto: g && g.amount, saldo: S.accounts.find(a => a.id === 'galicia').amount }; }, { kind, name, acc });
  const widget = () => ev(async () => { goTo('saldos'); await new Promise(r => setTimeout(r, 700)); const el = document.querySelector('.wr-neto-val'); return { hay: !!el, v: el ? Number(el.textContent.replace(/[^\d-]/g, '')) * (el.textContent.includes('-') ? -1 : 1) : null, esp: planCierreAt(pkAdd(pkNow(), 1)) + 500000 }; });

  // ═══ 15/10/2026 ═══════════════════════════════════════════════════════════
  section('34 · Nuevo vencimiento / suscripción proponen la misma fecha: hoy');
  const fechas = await ev(() => { openAgendaModal('sub'); const s = $('ag-date').value; closeOv('ov-agenda'); openAgendaModal('venc'); const v = $('ag-date').value; closeOv('ov-agenda'); return [s, v]; });
  eq(fechas, ['2026-10-15', '2026-10-15'], 'suscripción y vencimiento proponen hoy (antes: +30 días y fin de mes)');

  section('9 · "Neto proyectado" en Saldos aunque el mes que viene no tenga ingresos');
  eq(await uiAgenda({ type: 'venc', name: 'Alquiler', amount: 400000, date: '2026-10-28' }), 1, 'Agenda: vencimiento Alquiler 400k mensual (28)');
  let w = await widget();
  is(w.hay, 'con solo un gasto en el Plan del mes que viene, el widget "Neto proyectado" se muestra');
  is(w.hay && Math.abs(w.v - w.esp) <= 1, `y vale Resultado del mes que viene + inversiones (${w.v} vs ${w.esp})`);

  section('4 · Apagar un mes en el editor de un ingreso no corta la recurrencia');
  eq(await uiPlan({ cat: 'ingreso', name: 'Sueldo Mile', amount: 900000 }), 1, 'Plan: + Ingreso "Sueldo Mile" 900k Mensual');
  const sm = await ev(() => { const p = S.plan.find(x => x.name === 'Sueldo Mile'); openEditProj(p); document.querySelector('#ep-month-chips .chip[data-mi="2027-01"]').classList.remove('on'); doSaveEditProj();
    return { ene: p.months['2027-01'] || null, dic: p.months['2026-12'] || null, rep: p.rep || null, n: Object.keys(p.months).length, toast: window.__toasts.slice(-1)[0] }; });
  eq([sm.ene, sm.dic], [null, 900000], 'enero 2027 apagado; diciembre sigue');
  is(!!sm.rep, 'la recurrencia (rep) se conserva');
  eq(sm.rep && sm.rep.skip, ['2027-01'], 'el mes apagado queda anotado en rep.skip');
  is(/sigue repitiéndose/.test(sm.toast || ''), `el toast avisa que sigue repitiéndose (${sm.toast})`);
  // Apagar el último mes prendido sí la termina
  eq(await uiPlan({ cat: 'ingreso', name: 'Bono', amount: 100000 }), 1, 'Plan: + Ingreso "Bono" 100k Mensual');
  const bono = await ev(() => { const p = S.plan.find(x => x.name === 'Bono'); openEditProj(p); const chips = [...document.querySelectorAll('#ep-month-chips .chip')]; chips.slice(6).forEach(c => c.classList.remove('on')); doSaveEditProj(); return { rep: p.rep || null, n: Object.keys(p.months).length, toast: window.__toasts.slice(-1)[0] }; });
  eq([bono.rep, bono.n], [null, 6], 'apagar los últimos meses (del 7° en adelante) sí corta la recurrencia: 6 meses y sin rep');
  is(!/sigue repitiéndose/.test(bono.toast || ''), 'y el toast no dice que sigue repitiéndose');

  section('6 · Las cuentas "varios" (Efectivo) entran en Saldo bancos; cobrar ahí no baja el Resultado');
  let saldo = await filaPlan('Saldo bancos');
  eq(saldo && saldo[0], '1,2M', 'Saldo bancos = Galicia 1M + Efectivo 200k (antes: 1M)');
  const resAntes = await ev(() => planCierreAt(pkNow()));
  await ev(() => { const p = S.plan.find(x => x.name === 'Sueldo Mile'); openCollectModal(p.id, pkNow()); [...document.querySelectorAll('#collect-acct-list button')].find(b => b.textContent.includes('Efectivo')).click(); });
  const resDesp = await ev(() => ({ res: planCierreAt(pkNow()), ef: S.accounts.find(a => a.id === 'efectivo').amount }));
  eq(resDesp.ef, 1100000, 'el sueldo entró en Efectivo');
  eq(resDesp.res, resAntes, 'y el Resultado del mes no cambió (antes bajaba 900k)');
  w = await widget();
  is(w.hay && Math.abs(w.v - w.esp) <= 1, `"Neto proyectado" de Saldos usa la misma base (${w.v} vs ${w.esp})`);

  section('5 · Suscripción "cada 2 meses" cargada desde el Plan');
  eq(await uiPlan({ cat: 'gasto', name: 'Revista', amount: 5000, cadence: '2', subcat: 'suscripciones' }), 1, 'Plan: + Gasto "Revista" 5k suscripción cada 2 meses');
  const rev = await ev(() => { const p = S.plan.find(x => x.name === 'Revista'); const s = S.agenda.subs.find(x => x.name === 'Revista'); goTo('agenda'); switchAgendaTab('agenda'); renderAgenda();
    const row = [...document.querySelectorAll('#agenda-content .tl-row')].find(r => r.dataset.id === s.id);
    return { months: Object.keys(p.months).sort(), sub: { date: s.date, period: s.period, everyN: s.everyN }, detalle: row && row.querySelector('.tl-row-sb').textContent }; });
  eq(rev.months, ['2026-10', '2026-12', '2027-02', '2027-04', '2027-06', '2027-08'], 'Plan: oct, dic, feb… cada 2 meses');
  eq(rev.sub, { date: '2026-10-15', period: 'mensual', everyN: 2 }, 'Agenda: primer cobro hoy (15/10) y cadencia everyN=2 (antes: +30 días y mensual)');
  is(/Cada 2 meses/.test(rev.detalle || ''), `la lista de Agenda dice "Cada 2 meses" (${rev.detalle})`);
  let r = await pagar('sub', 'Revista', 'Galicia');
  eq(r.date, '2026-12-15', 'pagarla en octubre la manda al 15/12 (dos meses), no al 15/11');

  section('28 · La tarjeta "Vencimientos · N este mes" cuenta solo lo que vence este mes');
  eq(await uiAgenda({ type: 'venc', name: 'Internet', amount: 20000, date: '2026-11-05' }), 1, 'Agenda: vencimiento Internet mensual el 5/11 (mes que viene)');
  eq(await uiAgenda({ type: 'venc', name: 'Expensas', amount: 90000, date: '2026-10-20' }), 1, 'Agenda: vencimiento Expensas 90k mensual (20/10)');
  const tile = () => ev(() => { goTo('agenda'); switchAgendaTab('agenda'); renderAgenda(); const t = [...document.querySelectorAll('.ag-tile')][1];
    const lista = [...document.querySelectorAll('#agenda-content .tl-row[data-type="venc"]')].map(r => r.closest('.tl-wrap').previousElementSibling.querySelector('.tl-group-lbl').textContent);
    return { cnt: t.querySelector('.ag-tile-count').textContent.trim(), val: t.querySelector('.ag-tile-val').textContent.trim(), lista }; });
  let t = await tile();
  eq(t.cnt, '2 este mes', `Vencimientos: Alquiler y Expensas vencen en octubre; Internet (5/11) no cuenta aunque sea mensual (lista: ${t.lista.join(', ')})`);
  eq(t.val.replace(/\D/g, ''), '490000', 'y suma 400k + 90k');
  r = await pagar('venc', 'Alquiler', 'Galicia'); r = await pagar('venc', 'Expensas', 'Galicia');
  t = await tile();
  eq(t.cnt, '3 próximo mes', 'pagados los dos de octubre, la tarjeta muestra los tres del mes que viene con la etiqueta "próximo mes"');

  section('7 · Pagar desde la Agenda propone el importe de la celda ajustada en el Plan');
  eq(await uiAgenda({ type: 'sub', name: 'Netflix', amount: 12000, date: '2026-10-25' }), 1, 'Agenda: suscripción Netflix 12k mensual (25/10)');
  // La celda del mes en curso es de solo lectura: el ajuste a mano se hace en un mes futuro, así que el vencimiento es del mes que viene.
  eq(await uiAgenda({ type: 'venc', name: 'Seguro', amount: 30000, date: '2026-11-30' }), 1, 'Agenda: vencimiento Seguro 30k mensual (30/11)');
  eq(await celda('Seguro', '2026-11', '33000'), 33000, 'Celda Seguro noviembre = 33.000 a mano');
  r = await pagar('venc', 'Seguro', 'Galicia');
  eq([r.campo.oculto, r.campo.valor], [false, '33000'], 'el modal de pago muestra el campo con 33.000 (editable)');
  is(/33\.000/.test(r.campo.sub), `y el subtítulo dice 33.000 (${r.campo.sub})`);
  eq(r.gasto, 33000, 'el gasto registrado es de 33.000, no de 30.000');
  r = await pagar('sub', 'Netflix', 'Galicia');
  eq([r.campo.oculto, r.gasto], [true, 12000], 'sin celda ajustada, el campo no aparece y se paga lo de la Agenda');
  // Importe corregido a mano en el modal
  const edit = await ev(async () => { const it = S.agenda.vencimientos.find(x => x.name === 'Internet'); const p = S.plan.find(x => x.name.toLowerCase() === 'internet'); p.months['2026-11'] = 21000; save(); markVencPaid(it.id); await new Promise(r => setTimeout(r, 60)); $('pay-amt').value = '22000'; payAmtChanged(); const s = $('pay-modal-sub').textContent; [...document.querySelectorAll('#pay-acct-list button')].find(b => b.textContent.includes('Galicia')).click(); await new Promise(r => setTimeout(r, 60)); return { s, g: S.gastos.slice(-1)[0].amount }; });
  eq(edit.g, 22000, `tipear otro importe en el modal paga eso (${edit.s})`);

  section('8 · Cambiar solo el importe en la Agenda no pisa las celdas ajustadas a mano');
  eq(await celda('Netflix', '2026-12', '7500'), 7500, 'Celda Netflix diciembre = 7.500 a mano');
  await ev(() => { const it = S.agenda.subs.find(x => x.name === 'Netflix'); editAgenda('sub', it.id); $('ag-amount').value = '15000'; document.querySelector('#ov-agenda .btnp').click(); });
  const nf = await ev(() => { const p = S.plan.find(x => x.name === 'Netflix'); return { nov: p.months['2026-11'], dic: p.months['2026-12'], ene: p.months['2027-01'], rep: p.rep && p.rep.amt }; });
  eq([nf.nov, nf.dic, nf.ene, nf.rep], [15000, 7500, 15000, 15000], 'noviembre y enero pasan a 15.000, diciembre (ajustado a mano) sigue en 7.500 y la regla pasa a 15.000');
  await ev(() => { const it = S.agenda.subs.find(x => x.name === 'Netflix'); editAgenda('sub', it.id); $('ag-date').value = '2026-11-10'; document.querySelector('#ov-agenda .btnp').click(); });
  const nf2 = await ev(() => { const p = S.plan.find(x => x.name === 'Netflix'); return [p.months['2026-11'], p.months['2026-12']]; });
  eq(nf2, [15000, 15000], 'cambiar la fecha sí reescribe los meses desde la fecha nueva');

  section('22 · Las hojas de Agenda muestran la fecha como la lista y "por año" en una anual');
  eq(await uiAgenda({ type: 'sub', name: 'Seguro auto', amount: 480000, date: '2026-12-05', period: 'anual' }), 1, 'Agenda: suscripción Seguro auto 480k anual (5/12)');
  const hojas = await ev(() => { const txt = n => [...document.querySelectorAll('#ag-sheet-content .ag-card')].find(c => c.querySelector('.ag-name').textContent.startsWith(n));
    openAgendaSheet('sub'); const net = txt('Netflix'), seg = txt('Seguro auto');
    const out = { net: net.querySelector('.ag-detail').textContent, segDet: seg.querySelector('.ag-detail').textContent, segPer: seg.querySelector('.ag-period').textContent, netPer: net.querySelector('.ag-period').textContent };
    openAgendaSheet('venc'); out.venc = txt('Internet').querySelector('.ag-detail').textContent; closeAgendaSheet(); return out; });
  is(!/\d{4}-\d{2}-\d{2}/.test(hojas.net) && /Próximo cobro: \p{L}+\.?, \d+ \p{L}+/u.test(hojas.net), `suscripción: fecha con formato de la lista (${hojas.net})`);
  is(!/\d{4}-\d{2}-\d{2}/.test(hojas.venc) && /Vence: \p{L}+\.?, \d+ \p{L}+/u.test(hojas.venc), `vencimiento: ídem (${hojas.venc})`);
  eq([hojas.segPer, hojas.netPer], ['por año', 'por mes'], 'el pie de la anual dice "por año" y el de la mensual "por mes"');

  section('17 · Editar una compra en cuotas con campos vacíos no guarda ni festeja');
  const alta = await ev(() => { _gSaving = false; openGastoModal(); $('gdesc').value = 'Notebook'; $('gamt').value = '100000'; $('g-date-inp').value = '2026-10-10';
    document.querySelector('#ov-gasto .chip[data-v="tarjeta"]').click(); $('gct').value = '12'; $('gca').value = '1'; const n0 = S.gastos.length; document.querySelector('#ov-gasto .btnp').click(); return S.gastos.length - n0; });
  eq(alta, 1, 'Gasto tarjeta Notebook 100k cuota 1/12 el 10/10');
  const ec = await ev(() => { const cq = S.agenda.cuotas.find(c => c.name === 'Notebook'); const t0 = window.__toasts.length; editAgenda('cuota', cq.id); $('ecq-fee').value = ''; doSaveEditCuota();
    const err = $('ecq-fee').parentNode.querySelector('.ferr'); return { fee: cq.fee, err: err && err.textContent, abierto: $('ov-edit-cuota').classList.contains('open'), toasts: window.__toasts.slice(t0) }; });
  eq([ec.fee, ec.err, ec.abierto], [100000, 'Ingresá el importe', true], 'importe vacío: avisa en el campo, no guarda y el modal sigue abierto');
  eq(ec.toasts.filter(t => /Cuota actualizada/.test(t)), [], 'y no dice "Cuota actualizada"');
  const ec2 = await ev(() => { const cq = S.agenda.cuotas.find(c => c.name === 'Notebook'); editAgenda('cuota', cq.id); $('ecq-total').value = ''; doSaveEditCuota(); const err = $('ecq-total').parentNode.querySelector('.ferr'); closeOv('ov-edit-cuota'); return [cq.total, err && err.textContent]; });
  eq(ec2, [12, 'Entre 1 y 120 cuotas'], 'total vacío: ídem');

  section('27 · "Cuotas" iguales en la lista, la hoja y Tarjetas');
  const cu = await ev(() => { goTo('agenda'); switchAgendaTab('agenda'); renderAgenda(); const cq = S.agenda.cuotas.find(c => c.name === 'Notebook');
    const row = [...document.querySelectorAll('#agenda-content .tl-row[data-type="cuota"]')][0];
    openAgendaSheet('cuota'); const card = [...document.querySelectorAll('#ag-sheet-content .ag-card')][0];
    const out = { lista: row.querySelector('.tl-row-sb').textContent, hoja: card.querySelector('.ag-detail').textContent, hojaPie: card.querySelector('.ag-period').textContent, esp: agDateLbl(cuotaVence(cq, 2)) };
    closeAgendaSheet(); switchAgendaTab('tarjetas'); renderTarjetasResumen();
    const det = document.querySelector('.tj-det-row'); out.tj = det.textContent.replace(/\s+/g, ' ').trim(); out.tjRest = det.querySelector('.tj-rest').textContent; return out; });
  is(/cuota 2 de 12/.test(cu.lista), `lista: "cuota 2 de 12" (${cu.lista})`);
  is(cu.hoja.includes(`Próximo pago: ${cu.esp} · cuota 2 de 12`), `hoja: fecha real de la próxima cuota y "cuota 2 de 12" (${cu.hoja})`);
  is(/faltan 11 cuotas/.test(cu.hojaPie), `hoja: "faltan 11 cuotas" (${cu.hojaPie})`);
  is(cu.tjRest === 'faltan' && /faltan 11/.test(cu.tj) && !/\brest\b/.test(cu.tj) && /cuota 2 de 12/.test(cu.tj), `Tarjetas: "faltan 11" y "cuota 2 de 12", sin "rest" (${cu.tj})`);

  section('35 · "+ Agregar compra en cuotas" pide las cuotas y no guarda un gasto simple');
  const ac = await ev(() => { _gSaving = false; openAgendaSheet('cuota'); agendaSheetAdd(); const abierto = $('ov-gasto').classList.contains('open');
    const r0 = { abierto, cat: gCat, ct: $('gct').value }; $('gdesc').value = 'Heladera'; $('gamt').value = '50000'; const n0 = S.gastos.length; document.querySelector('#ov-gasto .btnp').click();
    const err = $('gct').parentNode.querySelector('.ferr'); return { ...r0, agregados: S.gastos.length - n0, err: err && err.textContent }; });
  eq([ac.abierto, ac.cat, ac.ct], [true, 'tarjeta', ''], 'abre Registrar gasto con Tarjeta y "Total cuotas" vacío');
  eq([ac.agregados, ac.err], [0, '¿En cuántas cuotas?'], 'guardar sin cuotas no agrega nada y pregunta "¿En cuántas cuotas?"');
  const ac2 = await ev(() => { _gSaving = false; $('gct').value = '3'; const n0 = S.gastos.length; document.querySelector('#ov-gasto .btnp').click(); const g = S.gastos.slice(-1)[0]; return { n: S.gastos.length - n0, ct: g.cuotaTotal, cq: S.agenda.cuotas.some(c => c.name === 'Heladera') }; });
  eq([ac2.n, ac2.ct, ac2.cq], [1, 3, true], 'con 3 cuotas se guarda como compra en cuotas y entra a la Agenda');
  const simple = await ev(() => { _gSaving = false; openGastoModal(); return $('gct').value; });
  eq(simple, '1', 'el alta normal (＋) sigue proponiendo 1 cuota');

  // ═══ 15/12/2026 ═══════════════════════════════════════════════════════════
  section('5 · En diciembre la Revista vale 5.000, sin "atraso" de un mes que no tocaba');
  await setClock(new Date(2026, 11, 15, 12));
  const revDic = await filaPlan('Revista');
  eq(revDic && revDic[0], '−5k', 'Revista en diciembre = −5k (antes −10k: noviembre contaba como adeudado)');
  eq(await ev(() => { const s = S.agenda.subs.find(x => x.name === 'Revista'); return [s.date, s.debe || null]; }), ['2026-12-15', null], 'en la Agenda vence el 15/12 y no debe nada');

  // ═══ 15/12/2027 ═══════════════════════════════════════════════════════════
  section('4 · 14 meses después, "Sueldo Mile" sigue proyectado 12 meses');
  await setClock(new Date(2027, 11, 15, 12));
  const lejos = await ev(() => { goTo('agenda'); switchAgendaTab('plan'); renderProj(); const f = n => { const p = S.plan.find(x => x.name === n); return p ? { n: Object.keys(p.months).filter(k => k >= pkNow()).length, skip: (p.rep && p.rep.skip) || null } : null; }; return { mile: f('Sueldo Mile'), bono: f('Bono') }; });
  eq(lejos.mile && lejos.mile.n, 12, '"Sueldo Mile" (con enero 2027 apagado) sigue con 12 meses (antes: 0)');
  eq(lejos.mile && lejos.mile.skip, null, 'y el mes apagado, ya pasado, salió de rep.skip');
  eq(lejos.bono && lejos.bono.n, 0, '"Bono" (terminado en el editor) no se renovó');

  eq(d.errors, [], 'sin errores de JS');
  await d.close();
  await browser.close();
  console.log(`\n${'─'.repeat(50)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
