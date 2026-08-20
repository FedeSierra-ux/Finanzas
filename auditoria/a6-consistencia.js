// AUDITORÍA 6 — CONSISTENCIA ENTRE MENÚS: que lo que se elige en un menú se
// pueda volver a elegir en los otros, que lo que se crea viaje al otro
// dispositivo y que sobreviva a un backup.
//
// Las auditorías 1-5 miran cada pantalla por dentro (que la cuenta cierre, que
// el sync no pierda nada, que cada fila tenga sus botones). Ésta mira las
// costuras: el mismo dato visto desde dos menús distintos, y el mismo dato
// visto desde dos dispositivos.
const L = require('./lib');
const { eq, is, section } = L;
const BIN = 'bin6';

(async () => {
  const browser = await L.launch();
  L.resetBins();
  const d = await L.device(browser, { myName: 'fede', compBin: BIN });
  const P = d.page;
  const existe = sel => P.evaluate(s => !!document.querySelector(s), sel);

  // ════ EL MES DE CADA PESTAÑA ═════════════════════════════════════════
  // Gastos, Presupuesto y Compartidos viven en la misma página y muestran la
  // misma franja de mes (.month-strip, unificada visualmente en #148). Mover
  // una tiene que mover las tres: si no, el usuario ve el mismo control en el
  // mismo lugar diciendo dos meses distintos según la pestaña.
  section('MENÚS · el mes es el mismo en las tres pestañas de Gastos');
  await d.ev(() => { goTo('gastos'); });
  await P.waitForTimeout(120);
  const mesInicial = await d.ev(() => ({ g: curMonth, p: _presupMonth, c: _sharedMonth }));
  is(mesInicial.g === mesInicial.p && mesInicial.p === mesInicial.c,
    `los tres arrancan en el mismo mes (${JSON.stringify(mesInicial)})`);

  // Retroceder dos meses desde Gastos y mirar las otras dos pestañas.
  await d.ev(() => { chMonth(-1); chMonth(-1); });
  await P.waitForTimeout(120);
  const trasGastos = await d.ev(() => ({ g: curMonth, gy: curYear, p: _presupMonth, py: _presupYear, c: _sharedMonth, cy: _sharedYear }));
  eq(trasGastos.p, trasGastos.g, 'mover el mes en Gastos también mueve el de Presupuesto');
  eq(trasGastos.c, trasGastos.g, 'y el de Compartidos');
  eq(trasGastos.py, trasGastos.gy, 'con el mismo año en Presupuesto');
  eq(trasGastos.cy, trasGastos.gy, 'y en Compartidos');

  // Y al revés: mover desde Compartidos tiene que arrastrar a las otras dos.
  await d.ev(() => { switchGastosTab('compartidos'); moveSharedMonth(1); });
  await P.waitForTimeout(120);
  const trasComp = await d.ev(() => ({ g: curMonth, p: _presupMonth, c: _sharedMonth }));
  eq(trasComp.g, trasComp.c, 'mover el mes en Compartidos también mueve el de Gastos');
  eq(trasComp.p, trasComp.c, 'y el de Presupuesto');

  // Y desde Presupuesto.
  await d.ev(() => { switchGastosTab('presup'); movePresupMonth(-1); });
  await P.waitForTimeout(120);
  const trasPres = await d.ev(() => ({ g: curMonth, p: _presupMonth, c: _sharedMonth }));
  eq(trasPres.g, trasPres.p, 'mover el mes en Presupuesto también mueve el de Gastos');
  eq(trasPres.c, trasPres.p, 'y el de Compartidos');

  // Y hay una sola franja: si vuelven a ser tres, vuelven a poder discrepar.
  await d.ev(() => { renderGastos(); renderPresupuesto(); renderCompartidos(); });
  await P.waitForTimeout(300);
  const franjas = await d.ev(() => {
    const all = [...document.querySelectorAll('#pg-gastos .month-strip')];
    const tabs = document.querySelector('#pg-gastos .pg-tab-row');
    return {
      cuantas: all.length,
      // compareDocumentPosition: 4 = el otro nodo va DESPUÉS en el documento.
      arribaDeLasPestanas: !!(all[0] && tabs && (all[0].compareDocumentPosition(tabs) & 4)),
      texto: all[0] ? all[0].querySelector('.mlbl').textContent.trim() : '',
    };
  });
  eq(franjas.cuantas, 1, 'hay una sola franja de mes en toda la página');
  is(franjas.arribaDeLasPestanas, 'y está arriba de las pestañas, no adentro de una');
  is(/^[A-Z]\w+ \d{4}$/.test(franjas.texto), `con el mes escrito (${franjas.texto})`);

  // Y sigue diciendo lo mismo después de cambiar de pestaña: la pinta
  // setGastosMonth, no el render de cada vista.
  const trasCambiar = await d.ev(() => {
    const l = () => document.getElementById('mlbl').textContent.trim();
    switchGastosTab('presup'); const p = l();
    switchGastosTab('compartidos'); const c = l();
    switchGastosTab('gastos'); return { p, c, g: l() };
  });
  is(trasCambiar.g === trasCambiar.p && trasCambiar.p === trasCambiar.c,
    `y no cambia al saltar de pestaña (${trasCambiar.g} / ${trasCambiar.p} / ${trasCambiar.c})`);

  // Volver al mes actual para el resto de la auditoría.
  await d.ev(() => { const n = new Date(); curMonth = n.getMonth(); curYear = n.getFullYear(); _presupMonth = curMonth; _presupYear = curYear; _sharedMonth = curMonth; _sharedYear = curYear; });

  // ════ CATEGORÍAS PROPIAS ═════════════════════════════════════════════
  section('CATEGORÍAS PROPIAS · se pueden crear, editar y borrar');
  await d.ev(() => {
    openAddCatModal('gcats');
    document.getElementById('newcat-name').value = 'Mascota';
    _newCatIcon = '🐶';
    saveNewCat();
  });
  await P.waitForTimeout(120);
  const catId = await d.ev(() => Object.keys(loadCustomCats())[0]);
  is(!!catId, `la categoría propia se crea (${catId})`);

  is(await d.ev(() => typeof window.deleteCustomCat === 'function'),
    'hay forma de borrar una categoría propia');

  // Renombrar de verdad, por el modal: el id no cambia (los gastos lo guardan),
  // el rótulo y el ícono sí.
  await d.ev(id => { openAddCatModal('gcats'); startEditCustomCat(id); }, catId);
  await P.waitForTimeout(120);
  await P.fill('#newcat-name', 'Mascotas');
  await d.ev(() => { _newCatIcon = '🐱'; saveEditCustomCat(); });
  await P.waitForTimeout(120);
  const renombrada = await d.ev(id => loadCustomCats()[id], catId);
  eq(renombrada && renombrada.label, 'Mascotas', 'renombrar una categoría propia cambia el rótulo');
  eq(renombrada && renombrada.icon, '🐱', 'y el ícono');
  eq(await d.ev(() => Object.keys(loadCustomCats()).length), 1, 'sin duplicarla');

  section('CATEGORÍAS PROPIAS · aparecen en todos los menús que piden categoría');
  await d.ev(() => { openGastoModal(); });
  await P.waitForTimeout(120);
  is(await d.ev(id => !!document.querySelector(`#gcats .chip[data-v="${id}"]`), catId),
    'está en el alta de gasto');
  await d.ev(() => closeOv('ov-gasto'));

  const gid = await d.ev(cid => {
    const g = { id: 'gcust', desc: 'Veterinaria', amount: 40000, cat: cid, addedAt: Date.now(),
      month: new Date().getMonth(), year: new Date().getFullYear(),
      shared: { active: true, paidBy: 'fede', splitPct: 50 } };
    S.gastos.push(g); save(); return g.id;
  }, catId);

  await d.ev(id => openEditGasto(S.gastos.find(g => g.id === id)), gid);
  await P.waitForTimeout(120);
  is(await d.ev(id => !!document.querySelector(`#eg-cats .chip[data-v="${id}"]`), catId),
    'está en la edición de gasto');
  await d.ev(() => closeOv('ov-edit-gasto'));

  await d.ev(id => openEditSharedGasto({ id }), gid);
  await P.waitForTimeout(120);
  is(await d.ev(id => !!document.querySelector(`#esg-cats .chip[data-v="${id}"]`), catId),
    'y en la edición desde Compartidos');
  is(await d.ev(() => !!document.querySelector('#esg-cats .chip.on')),
    'al abrir la edición desde Compartidos queda marcada la categoría que tiene el gasto');
  await d.ev(() => closeOv('ov-edit-shared'));

  // ════ EL MISMO JUEGO DE CATEGORÍAS EN TODOS LOS MENÚS ════════════════
  section('CATEGORÍAS · el mismo juego en el alta, la edición y Compartidos');
  const juegos = await d.ev(() => {
    const cats = id => [...document.querySelectorAll('#' + id + ' .chip[data-v]')].map(c => c.dataset.v);
    return { alta: cats('gcats'), edicion: cats('eg-cats'), compartidos: cats('esg-cats') };
  });
  const faltanEnComp = juegos.edicion.filter(c => !juegos.compartidos.includes(c));
  eq(faltanEnComp, [], `Compartidos ofrece las mismas categorías que la edición de gasto (faltan: ${faltanEnComp.join(', ') || 'ninguna'})`);
  is(await existe('#esg-cats .cat-add-chip'), 'y también el botón de crear una categoría nueva');

  // ════ REPARTO ════════════════════════════════════════════════════════
  // Decisión de producto: tres opciones y nada más, en todos lados — 50/50,
  // todo de uno, todo del otro. Es el vocabulario real de la pareja, y un
  // campo de porcentaje libre agrega una decisión que nunca se toma. Los dos
  // editores lo tenían "por si acaso" (el modelo guarda splitPct 0-100 y el
  // bot puede escribir cualquier número): se sacó, y un reparto a medida se
  // corrige eligiendo una de las tres, que es lo único que se necesita.
  section('COMPARTIDOS · los tres repartos, en los tres menús');
  await d.ev(() => { openGastoModal(); toggleSharedGasto(); });
  await P.waitForTimeout(120);
  eq(await P.evaluate(() => [...document.querySelectorAll('#g-split-presets [data-split]')].map(b => b.dataset.split)),
    ['50', 'solo-fede', 'solo-mile'], 'los tres presets, en ese orden');
  is(!await existe('#g-split-pct'), 'y ningún campo de porcentaje libre que los contradiga');
  is(await d.ev(() => !!document.querySelector('#g-split-presets [data-split="50"]').classList.contains('on')),
    'con 50/50 marcado por defecto');
  await d.ev(() => closeOv('ov-gasto'));
  is(!await existe('#eg-split-pct'), 'ni en la edición de gasto');
  is(!await existe('#esg-split-pct'), 'ni en la edición en Compartidos');
  eq(await P.evaluate(() => [...document.querySelectorAll('#eg-split-presets [data-eg-split]')].map(b => b.id)),
    ['eg-split-50', 'eg-split-solo-a', 'eg-split-solo-b'], 'la edición de gasto ofrece los mismos tres');
  eq(await P.evaluate(() => [...document.querySelectorAll('#ov-edit-shared [data-esg-split]')].map(b => b.dataset.esgSplit)),
    ['50', 'solo-fede', 'solo-mile'], 'y la edición en Compartidos también');

  // ════ LO QUE VIAJA AL OTRO DISPOSITIVO ═══════════════════════════════
  section('SYNC · lo que se configura de un lado llega al otro');
  const payload = await d.ev(() => Object.keys(buildSyncPayload()));
  is(payload.includes('fin_custom_cats'), 'las categorías propias viajan en el sync');
  is(payload.includes('fin_quick_chips_v2'), 'y los atajos de gastos frecuentes también');

  section('BACKUP · exportar e importar no pierde nada');
  const claves = await d.ev(() => {
    const src = String(exportBackup);
    const m = src.match(/allKeys\s*=\s*\[([\s\S]*?)\]/);
    return m ? m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean) : [];
  });
  is(claves.includes('fin_custom_cats'), 'el backup incluye las categorías propias');
  is(claves.includes('fin_quick_chips_v2'), 'y los atajos de gastos frecuentes');

  // ════ LA PAREJA VE LA CATEGORÍA, NO EL ID INTERNO ════════════════════
  section('COMPARTIDOS · la pareja ve el nombre de la categoría, no el id interno');
  await d.ev(() => queueSharedBinWrite(async () => { await fetchSharedBin(); await pushSharedBin(); }));
  await d.settle();
  await P.waitForTimeout(200);

  const mile = await L.device(browser, { myName: 'mile', compBin: BIN });
  await mile.ev(() => { goTo('compartidos'); });
  await mile.page.waitForTimeout(600);
  await mile.ev(() => fetchSharedBin());
  await mile.page.waitForTimeout(400);
  await mile.ev(() => renderCompartidos());
  await mile.page.waitForTimeout(300);

  const loQueVeMile = await mile.ev(() => {
    const el = document.getElementById('compartidos-list');
    return el ? el.textContent : '';
  });
  is(loQueVeMile.includes('Veterinaria'), 'a la pareja le llega el gasto compartido');
  is(!/custom_/.test(loQueVeMile),
    'y no ve el id interno de la categoría en pantalla');
  is(await mile.ev(cid => !!CATS[cid], catId),
    'la categoría propia también existe del otro lado');

  // ════ MENÚS QUE SE ABREN DESDE OTRO MENÚ ═════════════════════════════
  // El ➕ de las categorías sale desde tres modales distintos. Si el modal de
  // categoría queda en la misma banda de z-index que el que lo abrió, decide el
  // orden del DOM y se abre por debajo: el usuario ve el modal de siempre y el
  // foco puesto en un campo que no está en pantalla.
  section('MENÚS · un menú abierto desde otro queda por encima, no por debajo');
  const zDe = sel => P.evaluate(s => {
    const el = document.querySelector(s);
    return el ? parseInt(getComputedStyle(el).zIndex) || 0 : null;
  }, sel);
  const zAddCat = await zDe('#ov-add-cat');
  for (const [sel, nombre] of [['#ov-gasto', 'el alta de gasto'], ['#ov-edit-gasto', 'la edición de gasto'], ['#ov-edit-shared', 'la edición desde Compartidos']]) {
    is(zAddCat > await zDe(sel), `el modal de categoría queda por encima de ${nombre}`);
  }
  await d.ev(() => { openEditSharedGasto({ id: 'gcust' }); });
  await P.waitForTimeout(400);
  await d.ev(() => openAddCatModal('esg-cats'));
  await P.waitForTimeout(400);
  is(await d.ev(() => {
    const cat = document.getElementById('ov-add-cat').getBoundingClientRect();
    const el = document.elementFromPoint(cat.left + cat.width / 2, cat.top + cat.height - 40);
    return !!(el && el.closest('#ov-add-cat'));
  }), 'y abriéndolo de verdad, es el que recibe los toques');
  await d.ev(() => { closeOv('ov-add-cat'); closeOv('ov-edit-shared'); });

  // ════ BORRAR UNA CATEGORÍA NO BORRA GASTOS ═══════════════════════════
  section('CATEGORÍAS PROPIAS · borrarla no se lleva puestos los gastos');
  const antes = await d.ev(() => S.gastos.length);
  await d.ev(id => { window.appConfirm = async () => true; return deleteCustomCat(id); }, catId);
  await P.waitForTimeout(200);
  eq(await d.ev(() => S.gastos.length), antes, 'los gastos siguen estando');
  eq(await d.ev(g => (S.gastos.find(x => x.id === g) || {}).cat, gid), 'varios',
    'y el que la usaba queda en Varios, no sin categoría');
  eq(await d.ev(() => Object.keys(loadCustomCats()).length), 0, 'la categoría ya no está en la lista');

  // ════ LOGOS EN ARCHIVO APARTE ════════════════════════════════════════
  // Salieron del index.html (eran 361kb de base64, un tercio del archivo) a
  // logos.js, cacheado por el service worker en su propia caché. Si ese
  // archivo no carga, la app tiene que arrancar igual con íconos genéricos —
  // por eso van en window.LOGOS y no como const sueltas.
  section('LOGOS · viven aparte y siguen llegando a la pantalla');
  const logos = await d.ev(() => {
    const ks = Object.keys(window.LOGOS || {});
    return {
      cuantos: ks.length,
      todosWebp: ks.every(k => window.LOGOS[k].startsWith('data:image/webp;base64,')),
      pesoKb: +(ks.reduce((s, k) => s + window.LOGOS[k].length, 0) / 1024).toFixed(0),
    };
  });
  // El peso que importa es el del archivo que se descarga, no el del DOM: la app
  // genera en caliente el ícono PNG de "Agregar a inicio" (iOS no acepta el SVG
  // del manifest) y ese data: URL vive en el DOM sin costar un byte de descarga.
  const enElHtml = /data:image\/[a-z]+;base64,[A-Za-z0-9+/]{5000}/.test(require('fs').readFileSync(L.APP_FILE, 'utf8'));
  eq(logos.cuantos, 10, 'los diez logos están en window.LOGOS');
  is(logos.todosWebp, 'todos en WebP');
  is(logos.pesoKb < 40, `y pesan poco (${logos.pesoKb}kb, antes 361kb)`);
  is(!enElHtml, 'ya no queda ningún base64 grande incrustado en el HTML que se descarga');
  is(await d.ev(() => mkBankIcoHtml('Santander', 'Santander', 'bancaria', 34).includes('<img')),
    'el ícono de un banco sigue siendo su logo');
  is(await d.ev(() => serviceIcoHtml('Netflix', 'sub', 38).includes('<img')),
    'y el de un servicio también');
  // Las diez imágenes tienen que decodificar de verdad, no solo estar.
  const decodifican = await d.ev(() => Promise.all(
    Object.values(window.LOGOS).map(src => new Promise(res => {
      const i = new Image(); i.onload = () => res(i.naturalWidth > 0); i.onerror = () => res(false); i.src = src;
    }))
  ));
  is(decodifican.every(Boolean), 'y las diez decodifican en el navegador');

  // ════ COMPARTIDOS EN LA LISTA DE GASTOS ══════════════════════════════
  section('GASTOS · un compartido se distingue de uno propio en la lista');
  await d.ev(() => {
    const n = new Date();
    S.gastos = [
      { id: 'lc1', desc: 'Coto', amount: 40000, cat: 'super', addedAt: n.getTime(), month: n.getMonth(), year: n.getFullYear(), shared: { active: true, paidBy: 'mile', splitPct: 50 } },
      { id: 'lc2', desc: 'Farmacia', amount: 20000, cat: 'compras', addedAt: n.getTime(), month: n.getMonth(), year: n.getFullYear() },
      { id: 'lc3', desc: 'Regalo', amount: 60000, cat: 'regalos', addedAt: n.getTime(), month: n.getMonth(), year: n.getFullYear(), shared: { active: true, paidBy: 'fede', splitPct: 100 } },
    ];
    save(); goTo('gastos'); switchGastosTab('gastos'); renderGastos();
  });
  await P.waitForTimeout(400);
  const filas = await d.ev(() => {
    const out = {};
    document.querySelectorAll('#gastos-list .gasto-row').forEach(r => {
      out[r.querySelector('.gdesc').textContent] = {
        chip: (r.querySelector('.gshared-chip') || {}).textContent || null,
        quien: (r.querySelector('.gshare') || {}).textContent || null,
        importe: r.querySelector('.gamt').textContent,
      };
    });
    return out;
  });
  is(!!filas.Coto && !!filas.Coto.chip, `el compartido lleva chip (${filas.Coto && filas.Coto.chip})`);
  is(!!filas.Coto && /Mile pagó/.test(filas.Coto.quien || ''), `y dice quién puso la plata (${filas.Coto && filas.Coto.quien})`);
  is(!!filas.Coto && /20\.000/.test(filas.Coto.importe), `con el importe grande = tu parte (${filas.Coto && filas.Coto.importe})`);
  is(!!filas.Farmacia && !filas.Farmacia.chip && !filas.Farmacia.quien, 'el propio no lleva ni chip ni renglón');
  // 100% tuyo y pagado por vos: el renglón repetiría el mismo número.
  is(!!filas.Regalo && !!filas.Regalo.chip && !filas.Regalo.quien,
    'y el que es 100% tuyo y pagaste vos no repite el importe abajo');

  // ════ ERRORES ════════════════════════════════════════════════════════
  section('ERRORES · JS durante toda la corrida');
  eq(d.errors, [], 'ningún error de página en el dispositivo de Fede');
  eq(mile.errors, [], 'ninguno en el de Mile');

  await d.close(); await mile.close(); await browser.close();
  console.log(`\n${'─'.repeat(52)}\n${L.results.pass + L.results.fail} checks: ${L.results.pass} ok, ${L.results.fail} fallaron`);
  process.exit(L.results.fail ? 1 : 0);
})();
