// v34.27 (auditoría de la v34.25, ítems 36, 41, 55 y 61), en contexto iPhone:
//   · tokens: bordes, 3 niveles de elevación y la escala de radios 10/14/18/26;
//   · Gastos: franja del mes baja, una superficie por día e ícono de 34px;
//   · "Editar gasto" con el orden y los rótulos de "Registrar gasto" y el monto
//     con punto de miles (al abrir y al salir del campo, en los dos menús);
//   · validación: Pagar con el importe borrado no paga, Editar cuenta con el
//     nombre vacío no guarda, y Sincronización marca el campo que falta.
// Con la v34.26 casi todo termina en ✗.
const L = require('./lib');

const iphone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' };

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const f = new Date(), M = f.getMonth(), Y = f.getFullYear(), D = f.getDate();
  const dk = (y, m, dd) => { const x = new Date(y, m, dd); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const pk = (y, m) => { const x = new Date(y, m, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
  const d = await L.device(browser, { myName: 'fede', compBin: 'bin33', contexto: iphone, seed: {
    accounts: [{ id: 'a1', name: 'Galicia', type: 'bancaria', amount: 1250000, currency: 'ARS' }],
    gastos: [{ id: 'g1', desc: 'Coto', cat: 'super', amount: 67400, month: M, year: Y, day: D, addedAt: Date.now() },
             { id: 'g2', desc: 'Nafta', cat: 'transporte', amount: 30000, month: M, year: Y, day: D, addedAt: Date.now() }],
    // Plan con un importe distinto al de la Agenda: así la hoja de pagar muestra el campo del importe.
    plan: [{ id: 'p1', name: 'Expensas', cat: 'gasto', months: { [pk(Y, M)]: 85000 }, order: 1 }],
    agenda: { subs: [], vencimientos: [{ id: 'v1', name: 'Expensas', amount: 80000, date: dk(Y, M, D), period: 'mensual' }], cuotas: [], inversiones: [] },
  } });
  const P = d.page;
  const wait = ms => P.waitForTimeout(ms);
  const cerrar = () => d.ev(() => { document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open')); $('sync-modal-ov').classList.add('hidden'); document.querySelectorAll('.ferr').forEach(e => e.remove()); document.querySelectorAll('.field-error').forEach(e => e.classList.remove('field-error')); if (document.activeElement) document.activeElement.blur(); });
  const ferr = sel => d.ev(sel => { const el = document.querySelector(sel); const n = el && (el.parentNode.nextElementSibling?.classList.contains('ferr') ? el.parentNode.nextElementSibling : el.nextElementSibling);
    return { msg: n && n.classList.contains('ferr') ? n.textContent : null, rojo: !!el && el.classList.contains('field-error'), foco: document.activeElement === el }; }, sel);

  L.section('36 · Tokens: bordes, elevación y radios');
  for (const tema of ['dark', 'light']) {
    const t = await d.ev(tema => { localStorage.setItem('fin_theme', tema); applyTheme(); const cs = getComputedStyle(document.documentElement); const v = k => cs.getPropertyValue(k).trim();
      return { el: ['--el-1', '--el-2', '--el-3'].map(v), r: ['--r-sm', '--r-md', '--r-lg', '--r-xl'].map(v), border: v('--border') }; }, tema);
    L.is(t.el.every(x => /px/.test(x)), `${tema}: las tres sombras --el-1/2/3 están definidas`);
    L.eq(t.r, ['10px', '14px', '18px', '26px'], `${tema}: radios 10/14/18/26`);
    L.is(tema === 'dark' ? /148,\s*180,\s*230/.test(t.border) : /100,\s*75,\s*50/.test(t.border), `${tema}: borde ${tema === 'dark' ? 'neutro (no azul)' : 'cálido de siempre'} (${t.border})`);
  }
  await d.ev(() => { localStorage.setItem('fin_theme', 'dark'); applyTheme(); });

  L.section('41 · Gastos: franja del mes, una superficie por día, ícono de 34px');
  {
    await d.ev(() => goTo('gastos')); await wait(900);
    const r = await d.ev(() => { const ms = document.querySelector('.month-strip-page,.month-strip'); const g = document.querySelector('.lgrp'); const ico = document.querySelector('.lgrp .gcat-ico');
      const ri = ico.getBoundingClientRect(); return { franja: Math.round(ms.getBoundingClientRect().height), sombra: getComputedStyle(g).boxShadow, ico: [Math.round(ri.width), Math.round(ri.height)] }; });
    L.is(r.franja <= 48, `la franja del mes mide ${r.franja}px (≤ 48)`);
    L.is(/rgba\(0, 0, 0, 0\.28\)/.test(r.sombra), 'el grupo del día tiene la sombra de nivel 1');
    L.eq(r.ico, [34, 34], 'el ícono de categoría mide 34×34');
  }

  L.section('55 · Alta y edición de gasto con el mismo orden y el monto con miles');
  {
    const orden = await d.ev(() => { const pos = id => [...document.querySelectorAll('#ov-edit-gasto input, #ov-edit-gasto .chips, #ov-edit-gasto #eg-shared-toggle')].findIndex(e => e.id === id);
      const posA = id => [...document.querySelectorAll('#ov-gasto input, #ov-gasto .chips')].findIndex(e => e.id === id);
      return { edit: ['eg-desc', 'eg-amt', 'eg-date', 'eg-cats'].map(pos), alta: ['gdesc', 'gamt', 'g-date-inp', 'gcats'].map(posA) }; });
    L.is(orden.edit.every((p, i, a) => p >= 0 && (i === 0 || p > a[i - 1])), `Editar gasto: Descripción → Monto → Fecha → Categoría (${orden.edit})`);
    L.is(orden.alta.every((p, i, a) => p >= 0 && (i === 0 || p > a[i - 1])), `Registrar gasto en el mismo orden (${orden.alta})`);
    const lbl = await d.ev(() => [...document.querySelectorAll('#ov-edit-gasto .flbl')].map(l => l.textContent.trim()));
    L.is(lbl.includes('¿En qué gastaste?') && lbl.includes('Fecha') && lbl.includes('¿Gasto compartido?'), `mismos rótulos que el alta (${lbl.slice(0, 5).join(' · ')})`);
    const ab = await d.ev(() => { openEditGasto(S.gastos.find(g => g.id === 'g1')); return $('eg-amt').value; }); await wait(400);
    L.eq(ab, '67.400', 'al abrir la edición el monto dice 67.400 (no 67400)');
    await P.focus('#eg-desc'); await P.keyboard.press('Enter');
    L.eq(await d.ev(() => document.activeElement.id), 'eg-amt', 'Enter en la descripción pasa al monto');
    await d.ev(() => { $('eg-amt').value = '1.234,5'; $('eg-amt').dispatchEvent(new Event('input')); doSaveEditGasto(); }); await wait(400);
    L.eq(await d.ev(() => S.gastos.find(g => g.id === 'g1').amount), 1234.5, 'guardar "1.234,5" guarda 1234,5');
    await cerrar();
    const alta = await d.ev(() => { openGastoModal(); const i = $('gamt'); i.value = '67400'; i.dispatchEvent(new Event('blur')); const a = i.value; i.value = '7500.5'; i.dispatchEvent(new Event('blur')); return [a, i.value, parseNumAR(i.value)]; });
    L.eq(alta, ['67.400', '7.500,5', 7500.5], 'en el alta, al salir del campo, 67400 → 67.400 y 7500.5 → 7.500,5 (se relee igual)');
    await cerrar();
  }

  L.section('61 · Validación: Pagar, Editar cuenta y Sincronización');
  {
    await d.ev(() => goTo('agenda')); await wait(400);
    const antes = await d.ev(() => S.accounts[0].amount);
    await d.ev(() => markVencPaid('v1')); await wait(400);
    const visible = await d.ev(() => !$('pay-amt-field').classList.contains('hidden'));
    L.is(visible, 'la hoja de pagar muestra el importe (el Plan dice otro que la Agenda)');
    await d.ev(() => { $('pay-amt').value = ''; }); await P.click('#pay-acct-list button'); await wait(300);
    const r = await ferr('#pay-amt');
    L.eq(r.msg, 'Ingresá el importe a pagar', 'con el importe borrado, el campo avisa');
    L.is(r.rojo && r.foco, 'en rojo y con el foco');
    L.is(await d.ev(() => $('ov-pay').classList.contains('open')), 'la hoja sigue abierta');
    L.eq(await d.ev(() => S.accounts[0].amount), antes, 'y no se descontó nada de Galicia (antes pagaba el importe anterior)');
    await d.ev(() => skipPayDeduct()); await wait(200);
    L.is(await d.ev(() => $('ov-pay').classList.contains('open')), '"No descontar" con el importe borrado tampoco paga');
    await cerrar();

    await d.ev(() => { goTo('saldos'); openEditAcc('a1'); }); await wait(400);
    await d.ev(() => { $('edit-acc-name').value = ''; saveEditAcc(); }); await wait(200);
    const c = await ferr('#edit-acc-name');
    L.eq(c.msg, 'Ingresá un nombre', 'Editar cuenta con el nombre vacío avisa en el campo');
    L.is(await d.ev(() => $('ov-edit-acc').classList.contains('open') && S.accounts[0].name === 'Galicia'), 'y no guarda (antes cerraba sin avisar)');
    await cerrar();

    await d.ev(() => { openSyncModal(); $('sync-bin-id').value = ''; $('sync-api-key').value = ''; saveSyncConfig(); }); await wait(200);
    const s1 = await ferr('#sync-bin-id');
    L.eq(s1.msg, 'Ingresá el ID de sincronización', 'Sincronización: el ID vacío se marca en su campo');
    await d.ev(() => { $('sync-bin-id').value = 'abc'; saveSyncConfig(); }); await wait(200);
    L.eq((await ferr('#sync-api-key')).msg, 'Ingresá la clave', 'y después la clave vacía en la suya');
    await d.ev(() => { $('sync-bin-id').value = ''; $('sync-api-key').value = ''; document.querySelectorAll('.ferr').forEach(e => e.remove()); });
    await d.ev(() => autoCrearBin('sync-api-key', 'sync-bin-id')); await wait(200);
    L.eq((await ferr('#sync-api-key')).msg, 'Primero ingresá la clave', '"Crear" sin clave marca el campo de la clave (antes un cartel naranja)');
    await d.ev(() => { $('sync-bin-id').value = ''; saveSyncConfig(); }); await wait(200);
    const p2 = await d.ev(() => { const e = $('sync-bin-id'), m = e.parentNode.nextElementSibling; return !!m && m.classList.contains('ferr') && m.getBoundingClientRect().top >= e.getBoundingClientRect().bottom - 1; });
    L.is(p2, 'el aviso del ID va debajo del renglón con "Crear", no al costado');
    await cerrar();
  }

  L.eq(d.errors, [], 'sin errores de JS');
  await d.close();
  await browser.close();
  console.log(`\n${'─'.repeat(50)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
