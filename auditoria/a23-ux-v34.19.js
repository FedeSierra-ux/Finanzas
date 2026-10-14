// Los arreglos de la v34.19 (auditoría de UX y visual de la v34.16): fuente de
// botones y campos, aviso de subida fallida, monto por cuota, tocar la fila en
// Agenda y Tarjetas, dólares con formato argentino, buscador por monto e
// import de Mercado Pago con las categorías propias y las reglas aprendidas.
// Con la v34.18 cada sección termina en ✗.
const L = require('./lib');

const iphone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' };

(async () => {
  const browser = await L.launch();
  const hoy = new Date();
  const iso = off => { const d = new Date(hoy); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };
  L.resetBins();
  const d = await L.device(browser, { myName: 'fede', compBin: 'binU', contexto: iphone, seed: {
    accounts: [{ id: 'a1', name: 'Galicia', type: 'bancaria', amount: 1000000, currency: 'ARS' },
      { id: 'a2', name: 'Dólares', type: 'efectivo', amount: 2246, currency: 'USD' }],
    gastos: [{ id: 'f1', desc: 'Ferretería', cat: 'hogar', amount: 9000, month: hoy.getMonth(), year: hoy.getFullYear(), day: 1, addedAt: new Date(hoy.getFullYear(), hoy.getMonth(), 1, 12).getTime() },
      { id: 'f2', desc: 'Cena', cat: 'salidas', amount: 18000, month: hoy.getMonth(), year: hoy.getFullYear(), day: 1, addedAt: new Date(hoy.getFullYear(), hoy.getMonth(), 1, 13).getTime(),
        shared: { active: true, paidBy: 'fede', splitPct: 50 } }],
    agenda: { subs: [{ id: 's1', name: 'Netflix', amount: 9000, date: iso(3), period: 'mensual' }], vencimientos: [],
      cuotas: [{ id: 'c1', name: 'Notebook', fee: 120000, total: 6, paid: 2, nextDueDate: iso(5), startDate: iso(-60) }], inversiones: [] },
  } });

  L.section('VIS01 · Botones y campos con la fuente de la app, no Arial');
  {
    const r = await d.ev(() => {
      const ff = el => getComputedStyle(el).fontFamily;
      const body = ff(document.body);
      return { body, boton: ff(document.querySelector('#ov-gasto .btnp')), campo: ff($('gdesc')) };
    });
    L.is(!/^Arial/i.test(r.body), 'el cuerpo no es Arial (' + r.body + ')');
    L.eq(r.boton, r.body, 'los botones (Guardar) heredan la fuente del cuerpo');
    L.eq(r.campo, r.body, 'los campos heredan la fuente del cuerpo');
  }

  L.section('UX06 · El aviso de subida fallida no manda a un botón que no existe');
  {
    L.net.putFail = true;
    const avisos = await d.ev(async () => {
      const vistos = []; const real = showToast;
      showToast = (m, ...r) => { vistos.push(String(m)); return real(m, ...r); };
      openSharedPaymentModal();
      $('sp-amount').value = '1000';
      await doSaveSharedPayment();
      for (let i = 0; i < 40 && !vistos.some(m => /no se pudo subir/.test(m)); i++) await new Promise(r => setTimeout(r, 100));
      showToast = real;
      return vistos;
    });
    L.net.putFail = false;
    const fallo = avisos.find(m => /no se pudo subir/.test(m)) || '';
    L.is(!!fallo, 'avisa que no se pudo subir');
    L.is(!/Reparar/.test(fallo), 'no menciona "🔧 Reparar"');
    L.is(/Sincronizar/.test(fallo) && /reintenta solo/.test(fallo), 'dice que se reintenta solo y que está ⋯ › Sincronizar');
  }

  L.section('UX08 · Con Tarjeta el monto dice que es el de cada cuota');
  {
    const r = await d.ev(async () => {
      openGastoModal();
      const lbl = () => ($('gamt-lbl') || {}).textContent;
      const antes = lbl();
      document.querySelector('#gcats .chip[data-v="tarjeta"]').click();
      $('gamt').value = '85000'; $('gct').value = '12'; $('gca').value = '1'; updCuotaPrev();
      const con = lbl(), prev = $('cuota-prev').textContent;
      document.querySelector('#gcats .chip[data-v="comida"]').click();
      const despues = lbl();
      closeOv('ov-gasto');
      return { antes, con, prev, despues };
    });
    L.eq([r.antes, r.con, r.despues], ['Monto', 'Monto de cada cuota', 'Monto'], 'la etiqueta cambia con la categoría');
    L.is(r.prev.includes('12 × $ 85.000 = $ 1.020.000'), 'la vista previa muestra la cuenta del total (' + r.prev + ')');
  }

  L.section('UX09 · Tocar la fila en Agenda y en Tarjetas abre la edición');
  {
    await d.ev(() => { goTo('agenda'); switchAgendaTab('lista'); });
    await d.page.waitForTimeout(400);
    await d.page.locator('.tl-row[data-id="s1"] .tl-row-nm').tap();
    await d.page.waitForTimeout(500);
    const ag = await d.ev(() => ({ abierto: [...document.querySelectorAll('.overlay.open')].map(o => o.id), hint: (document.querySelector('.ag-hint') || {}).textContent }));
    L.is(ag.abierto.length > 0, 'tocar Netflix abre un editor (' + ag.abierto.join(',') + ')');
    L.is(/Tocá/.test(ag.hint || ''), 'la pista dice "Tocá…" en lugar de "Mantené apretado…"');
    await d.ev(() => document.querySelectorAll('.overlay.open').forEach(o => closeOv(o.id)));
    await d.page.waitForTimeout(400);
    // El ✓ de la fila sigue siendo pagar, no editar.
    const pagar = await d.ev(() => { let llamado = false; const real = window.markSubPaid; window.markSubPaid = () => { llamado = true; }; renderAgenda();
      const b = document.querySelector('.tl-row[data-id="s1"] .tl-btn-pay'); b.click(); window.markSubPaid = real;
      return { llamado, editor: document.querySelectorAll('.overlay.open').length }; });
    L.is(pagar.llamado && pagar.editor === 0, 'tocar el ✓ paga y no abre el editor');
    await d.ev(() => { switchAgendaTab('tarjetas'); });
    await d.page.waitForTimeout(400);
    await d.page.locator('.tj-det-row .tj-name').first().tap();
    await d.page.waitForTimeout(500);
    const tj = await d.ev(() => [...document.querySelectorAll('.overlay.open')].map(o => o.id));
    L.is(tj.length > 0, 'tocar la cuota en Tarjetas abre un editor (' + tj.join(',') + ')');
    await d.ev(() => document.querySelectorAll('.overlay.open').forEach(o => closeOv(o.id)));
  }

  L.section('UX13 · Dólares con formato argentino');
  {
    const r = await d.ev(() => { goTo('saldos'); return { usd: fUSD(653.85), mil: fUSD(2246), pat: (document.querySelector('.wr-pat-usd') || {}).textContent || '' }; });
    L.eq([r.usd, r.mil], ['USD 653,85', 'USD 2.246,00'], 'fUSD usa coma decimal y punto de miles');
    L.is(!/\d,\d{3}\b/.test(r.pat), 'el patrimonio en USD no usa coma de miles (' + r.pat + ')');
  }

  L.section('UX15 · El buscador encuentra por monto');
  {
    const r = await d.ev(() => {
      goTo('gastos');
      const filas = q => { buscarGastos('gastos', q); return [...document.querySelectorAll('#sq-res-gastos .sq-desc')].map(x => x.textContent); };
      const out = { exacto: filas('9000'), puntos: filas('$ 9.000'), parte: filas('9000'), total: filas('18000'), nada: filas('9001') };
      buscarGastos('gastos', '');
      return out;
    });
    L.is(r.exacto.includes('Ferretería'), '"9000" encuentra Ferretería');
    L.is(r.puntos.includes('Ferretería'), '"$ 9.000" también');
    L.is(r.parte.includes('Cena'), 'un compartido aparece por la parte propia (9.000 de 18.000)');
    L.is(r.total.includes('Cena'), 'y por el total');
    L.eq(r.nada, [], 'un monto que no coincide no trae nada');
  }

  L.section('FUN05 · Mercado Pago usa las categorías propias y lo aprendido');
  {
    const r = await d.ev(async () => {
      const reales = window.fetch; let prompt = '';
      saveCustomCats({ ...loadCustomCats(), custom_mascotas: { label: 'Mascotas', icon: '🐶', color: '#a3e635' } });
      Object.assign(CATS, loadCustomCats());
      saveCategoryRules([{ pattern: 'veterinaria', cat: 'custom_mascotas', updatedAt: 1 }]);
      localStorage.setItem(CLAUDE_KEY, 'sk-test');
      mpFileData = 'x'; mpFileType = 'image'; mpFileMimeType = 'image/png';
      window.fetch = async (u, o) => {
        if (/anthropic/.test(String(u))) {
          prompt = JSON.parse(o.body).messages[0].content[1].text;
          return new Response(JSON.stringify({ content: [{ text: JSON.stringify({ gastos: [
            { desc: 'Veterinaria San Roque', amount: 15000, date: new Date().toISOString().slice(0, 10), category: 'varios' },
            { desc: 'Kiosco', amount: 1200, date: new Date().toISOString().slice(0, 10), category: 'inventada' },
            { desc: 'Librería Nueva', amount: 5000, date: new Date().toISOString().slice(0, 10), category: 'compras' }] }) }] }), { status: 200 });
        }
        return reales(u, o);
      };
      await processMPWithClaude();
      window.fetch = reales;
      const cats = mpReviewItems.map(g => g.category);
      // En la revisión se corrige Librería a Oficina: tiene que quedar aprendido.
      mpReviewItems[2].category = 'oficina';
      confirmMPImport();
      return { prompt, cats, regla: (findCategoryRule('Librería Nueva') || {}).cat, guardados: S.gastos.filter(g => g.mp).map(g => [g.desc, g.cat]) };
    });
    L.is(/custom_mascotas \(Mascotas\)/.test(r.prompt) && /\boficina\b/.test(r.prompt), 'el pedido a Claude lista Oficina y las categorías propias');
    L.eq(r.cats, ['custom_mascotas', 'varios', 'compras'], 'la regla aprendida gana y una categoría inexistente va a Varios');
    L.eq(r.regla, 'oficina', 'lo corregido en la revisión queda aprendido');
    L.eq(r.guardados, [['Veterinaria San Roque', 'custom_mascotas'], ['Kiosco', 'varios'], ['Librería Nueva', 'oficina']], 'se guardan con esas categorías');
  }

  L.eq(d.errors, [], 'sin errores de JS');
  await d.close();
  await browser.close();
  console.log(`\n${'─'.repeat(50)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
