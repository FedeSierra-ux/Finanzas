# Informe de la simulación de meses de uso (a13)

Auditoría de la v34.1 (`index.html`, sin modificar) usándola como lo haría una pareja durante 13 meses. Script: `node auditoria/a13-simulacion-meses.js` (~3 min 30 s; 380 comprobaciones, termina en código 1 mientras los defectos sigan ahí). Fecha de la corrida: 2026-09-30.

## 1. Resumen ejecutivo

- **Línea base antes de empezar**: `a1`–`a12` = 519 comprobaciones, todas verdes; `node tests.js` = 607/607. Nada de lo de abajo lo detectaban.
- **a13**: 380 comprobaciones, **347 ✓ y 33 ✗**. Las 33 ✗ son **25 hallazgos distintos** (3 altos, 10 medios, 12 bajos). Cada uno se reprodujo en aislado o se confirmó leyendo el código; los falsos positivos del arnés (p. ej. el "deshacer" que no llegaba, el modelo que no contaba gastos nacidos de un pago, dos reinicios que pisaban el estado) se corrigieron antes de contarlos.
- **Lo que está sólido** (comprobado contra una cuenta hecha aparte en JS, sin usar ninguna función de la app):
  - La deuda de Compartidos coincide **al peso en los dos teléfonos y con la cuenta independiente** en 48+ gastos alternados, cambios de porcentaje (25/75, solo uno, cambio de pagador), liquidación parcial, total y pasándose (la deuda cambia de signo), editar y borrar transferencias, altas simultáneas, gastos cargados sin conexión (reintento automático al volver la señal), GET caído, PUT caído, bin vacío y bin con basura (4 variantes, sin errores de JS), tombstones (lo borrado no resucita ni tras vaciar el bin) y tercera/cuarta vuelta (cero PUT cuando no hay cambios).
  - Total del mes, Σ categorías y cantidad de filas en los 13 meses; Plan (filas y meses de 10 suscripciones/vencimientos, 3 ingresos y 9 compras en cuotas), Saldo bancos, Resultado y Cierre del mes en las 6 columnas (±1 $ con centavos, exacto con enteros), Patrimonio con cuentas en USD, cuotas de 1/2/3/6/12/24 pagos cruzando diciembre, 29/30/31, febrero y bisiesto (mes a mes contra el calendario), recarga de página sin cambiar un dato, backup exportar→borrar→importar idéntico, cambio de año con reloj del navegador, temas claro/oscuro y vista compacta sin NaN ni errores de consola, 2.600 gastos con pantallas en ≤7 ms, desbordes en iPhone con textos de 315 caracteres, descripciones con HTML/comillas/emojis en **todos** los campos de texto libre (salvo el nombre de categoría, B05).
- **Lo más importante**: (B01) editar un gasto que cargó la pareja mientras falla la subida deja a los dos teléfonos con **deudas distintas para siempre**, sin cartel ni contador de pendientes; (B02) pagar con más plata de la que tiene la cuenta **hace desaparecer la diferencia** del Patrimonio; (B03) una compra compartida en cuotas solo comparte **la primera cuota**; (B05) el nombre de una categoría propia se pinta sin escapar y **viaja por el bin** a la otra persona (inyección de HTML/JS).

## 2. Tabla de hallazgos (por severidad)

Severidad: **crítico** = pierde o corrompe plata/datos de forma irrecuperable · **alto** = cifras de plata mal de forma silenciosa · **medio** · **bajo**. No hay ninguno "crítico" en sentido estricto: nada destruye datos sin remedio (el backup, los snapshots y los archivos locales quedan), pero B01–B03 dejan cifras de plata equivocadas sin avisar.

| ID | Sev. | Hallazgo | Dónde (index.html) | Etiqueta en el script |
|---|---|---|---|---|
| B01 | **Alto** | Editar un gasto de la pareja con el PUT caído: la edición no queda "pendiente", nunca sube y las deudas divergen | `sharedPendientes` 10248, `doSaveEditShared` 10631, aviso de `pushSharedBin` ~10190 | `[edit-ajeno-sin-red]` |
| B02 | **Alto** | Pagar más que el saldo de la cuenta deja la cuenta en $0 (no en negativo): la diferencia desaparece de Saldos, Patrimonio y Plan | `confirmPayDeduct` 7025-7026, `confirmCuotaPay` 7269-7270, `buildExpenseImpact` 3347 | `[pago-piso-cero]` |
| B03 | **Alto** | Compra compartida en cuotas: solo la cuota 1 es compartida; las siguientes (pagadas desde Agenda/Tarjetas) entran como gasto propio y la deuda de la pareja queda corta | `doSaveGasto` 5049-5055, `confirmCuotaPay` 7264+, `applyPayContext` 7060+ | `[cuota-compartida]` |
| B04 | Medio | Pagar un vencimiento compartido: el cartel "Deshacer" se pisa a los ~100 ms con "👫 1 gasto compartido nuevo" (del propio gasto); y si se deshace, el gasto **sigue en el bin** (la pareja lo ve y lo debe) | `fetchSharedBin` 10088 + `showToast` 8015 (un solo `_undoFn`), undo de `applyPayContext` ~7100 | `[undo-toast-pisado]`, `[undo-compartido-fantasma]` |
| B05 | Medio | Nombre de categoría propia sin escapar → HTML/JS inyectado; llega por el diccionario `cats` del bin a la otra persona | 4131, 4005, 3892; `_absorberCatsDelBin` 9503 | `[xss-cat]`, `[xss-cat-bin]`, `[cat-label-html]` |
| B06 | Medio | Celda del Plan: tipear `7500.5` guarda `75005` (×10) | `renderProj` 5483 | `[plan-celda-decimal]` |
| B07 | Medio | "Neto proyectado" de Saldos ≠ "Cierre del mes" del Plan (al widget le falta el resultado que queda por cobrar/pagar este mes) | `renderWidget` 7921-7924 | `[neto-widget]` |
| B08 | Medio | Editor de gasto compartido abierto mientras la pareja corrige el importe: guardar solo la descripción revierte el importe | `doSaveEditShared` 10631 | `[modal-pisa-importe]` |
| B09 | Medio | Conflictos por documento entero con reloj del cliente: dos correcciones a campos distintos → una se pierde; teléfono con el reloj 3 min atrasado pierde ediciones más nuevas | `stampShared` 9518, `mergeSharedLists` 9554 | `[lww-campos]`, `[reloj-desfasado]` |
| B10 | Medio | Un sueldo/gasto fijo "Mensual" con el rango por defecto dura 6 meses y no se renueva: a los 7 meses el Plan queda sin ingresos | `doSavePlan` 5727-5790 (sin `rep`), `planMonthsDesdeHasta` 5713 | `[ingreso-no-renueva]` |
| B11 | Medio | El aviso "parece repetido" casi nunca sale: compara contra `addedAt`, que es el mediodía del día elegido, no la hora de carga | `_isDupGasto` 5009, `doSaveGasto` 5044 | `[dup-noon]` |
| B12 | Medio | Los gastos de más de 18 meses se archivan al abrir la app y dejan de verse/buscarse (archivo en localStorage sin pantalla) | `archiveOldGastos` 9081, 11853 | `[archivo-invisible]` |
| B13 | Medio | Corregir solo el nombre de una suscripción/vencimiento en la Agenda pisa los ajustes hechos a mano en el Plan | `syncAgendaEditToPlan` 5385 → `setPlanFromRule` | `[agenda-pisa-plan]` |
| B14 | Bajo | Importes impares al 50%: las dos partes suman $1 de más; la fila dice "prestaste $5.000" y la deuda cuenta $5.001 | `eAmt` 4038, `_renderSharedContent` 11195-11196 vs `calcSharedDebtDetail` 9829 | `[split-redondeo]`, `[split-redondeo-filas]` |
| B15 | Bajo | Donut: los % por categoría suman 98–102%; con centavos Σ filas ≠ total | 4131, `renderDonutLegend` 4853, `renderGastos` | `[donut-100]`, "Σ filas = total" |
| B16 | Bajo | Desde el buscador de Gastos, tocar un gasto de la pareja abre un editor que guarda en el vacío (la lista sí dice "solo lectura") | `buscarGastos` 4370, `doSaveEditGasto` 4751 | `[buscar-gasto-ajeno]` |
| B17 | Bajo | Una categoría propia borrada resucita: el diccionario del bin nunca se limpia | `pushSharedBin` 10178, `_absorberCatsDelBin` 9503, `deleteCustomCat` 4684 | `[cat-zombi]` |
| B18 | Bajo | Cuota de una compra del 31: el vencimiento pasa al 30 y se queda ahí (31/10 → 30/10, 30/11, 30/12…) | `nextMonthDate` 6164 | `[cuota-day-drift]` |
| B19 | Bajo | "Cuota 5 de 3" se guarda sin validar | `doSaveGasto` 5051 | `[cuota-ca-mayor-ct]` |
| B20 | Bajo | Con el aviso de repetido a la vista, "Guardar" en los siguientes 1,5 s se ignora en silencio | `doSaveGasto` 5028 (no libera `_gSaving` en la rama del aviso) | `[dup-warn-lost-tap]` |
| B21 | Bajo | Una deuda real < $500 se muestra como "Al día" y el modal de pago no propone importe | 11061-11062, 10720 | `[deuda-menor-500]` |
| B22 | Bajo | El backup no incluye `fin_my_name` ni el bin compartido: al restaurar, Mile queda como "Fede" y Compartidos deja de sincronizar | `exportBackup` 11659 | `[backup-sin-config]` |
| B23 | Bajo | Todas las categorías propias nacen con el mismo color (el de "Varios") | `saveNewCat` 4605 | `[cat-color]` |
| B24 | Bajo | Editar la fecha de un gasto no actualiza `g.day` | `doSaveEditGasto` 4764 | `[edit-day-stale]` |
| B25 | Bajo | El gasto que crea pagar una suscripción/vencimiento no lleva `day` | `applyPayContext` 7068 | `[pago-sin-dia]` |

## 3. Detalle y cómo reproducir

### B01 · Alto · Editar un gasto de la pareja sin subida: divergencia permanente
- **Pasos**: Fede carga "Internet $30.000" compartido y sincronizan. Se cae el PUT (o Mile queda sin señal). Mile abre el gasto en Compartidos, cambia el monto a $40.000 y Guarda. Vuelve la red, Mile toca Sincronizar (o espera el reintento) dos veces cada uno.
- **Esperado**: los dos ven $40.000 y la misma deuda; el contador "sin subir" de Mile muestra 1 mientras tanto.
- **Obtenido**: Mile ve $40.000, Fede $30.000 (deuda de Fede $15.000 vs Mile −$20.000), **para siempre**. El contador de pendientes de Mile dice 0 y el cartel dice "queda guardado acá y se reintenta solo", que no es cierto.
- **Causa**: `sharedPendientes()` solo recorre `S.gastos` propios y las transferencias. Un gasto que cargó la pareja no está en `S.gastos`: `doSaveEditShared` lo edita solo en `_sharedBinGastos` (memoria/caché). Después `fetchSharedBin` funde por `updatedAt`, conserva la versión de Mile y, como el id existe en el bin, no marca `_needsRepush`. Lo mismo vale al revés (Fede editando un gasto de Mile). Los borrados y las transferencias no sufren esto (tienen tombstone/copia local).
- **Arreglo sugerido**: contar como pendiente todo ítem de `_sharedBinGastos` cuyo `updatedAt` sea mayor al confirmado (`_sharedConfirmado`), o guardar una copia local de lo editado.

### B02 · Alto · Piso en cero al pagar
- **Pasos**: cuenta "Santander" con $400.000,50. Agenda → "Seguro auto" $480.000 → Pagué → elegir Santander.
- **Esperado**: saldo −$79.999,50 (o un aviso de saldo insuficiente con opción).
- **Obtenido**: saldo $0. Se "pierden" $79.999,50: el Patrimonio y Saldo bancos quedan inflados y el Cierre de los meses siguientes del Plan baja $400.001 en lugar de $480.000 (el script lo mide). Mismo código en pagar cuotas, y en `buildExpenseImpact` (el resumen "quedará en" también recorta).
- **Nota**: deshacer devuelve el saldo exacto (snapshot), así que no es irrecuperable.

### B03 · Alto · Compra compartida en cuotas
- **Pasos**: Gasto → Tarjeta, "Sillón", $15.000, cuota 1 de 3 → compartido, paga Fede, 50/50. Sincronizar. En Tarjetas tocar "Pagué" la cuota 2.
- **Esperado**: la cuota 2 también es compartida (Mile debe $7.500 más).
- **Obtenido**: el gasto de la cuota 2 no tiene `shared`; la deuda de Mile queda en $7.500 (1 cuota) en vez de $22.500 (3 cuotas). La cuota de la Agenda no recuerda que era compartida.

### B04 · Medio · Deshacer del pago compartido
- **Pasos**: Vencimiento "Alquiler" compartido → Pagué → cuenta. Mirar el cartel 150 ms después, o tocar Deshacer a mano.
- **Obtenido**: el cartel ya dice "👫 1 gasto compartido nuevo" (sin botón): `upsertSharedBinGasto` llama a `fetchSharedBin`, que suma el propio gasto (`_missing`) y dispara el aviso de "nuevos"; `showToast` tiene un solo `_undoFn`. Si se llama al deshacer capturado antes, el gasto desaparece de Fede pero **queda en el bin**: Mile lo sigue viendo y debiendo $250.000 (`removeSharedBinGasto` no se llama en el undo).
- **Además**: el aviso "gasto compartido nuevo" aparece por gastos propios.

### B05 · Medio · Categoría propia con HTML
- **Pasos**: Gasto → ➕ categoría → nombre `x <img src=x onerror=alert(1)>` → cargar un gasto con esa categoría → ver Gastos (lista de categorías) o tocar la categoría.
- **Obtenido**: se inyecta el `<img>` y se ejecuta `onerror`. Por el bin: `pushSharedBin` sube el diccionario `cats`; `_absorberCatsDelBin` de la otra persona lo guarda sin sanear y la pantalla de Gastos lo ejecuta (el script lo reproduce escribiendo una categoría hostil en el bin). Con el JS ejecutándose en el origen de la app se leen las claves de JSONBin/Claude guardadas en localStorage.
- **Bien**: la descripción de gasto, nombre de cuenta, suscripción, vencimiento, cuota, concepto del Plan, transferencia y gasto compartido **sí** se escapan (recorridas 14 pantallas/modales en los dos teléfonos).
- **Arreglo**: `esc(cfg.label)` en los 3 sitios y validar/limitar `label`/`icon`/`color` al absorber desde el bin (y el `id` que va dentro de `onclick` en el gestor de categorías).

### B06 · Medio · Decimales en las celdas del Plan
- **Pasos**: Agenda → Plan → tocar una celda de un mes futuro → tipear `7500.5` → Tab.
- **Esperado**: 7.500,5. **Obtenido**: 75.005. El handler hace `value.replace(/\./g,'')` pensando en miles, pero al enfocar la celda pasa a `type=number`, donde el punto es el decimal. Con `7500.50` da 750.050.

### B07 · Medio · Neto proyectado del widget
- **Repro**: con un sueldo por cobrar este mes y gastos pendientes, Saldos muestra "Neto proyectado octubre: + $52.654.501" y el Plan "Cierre del mes" de octubre dice $55.356.501 (diferencia = exactamente el Resultado de septiembre, $2.702.001). El widget calcula `saldoBancos + ingreso(mes sig.) − gasto(mes sig.)` sin acumular el resultado del mes en curso que el Plan sí arrastra. El comentario dice "igual fórmula que la solapa Plan".

### B08 · Medio · Editor abierto con cambios ajenos
- **Pasos**: Fede abre "Editar" de un gasto compartido y lo deja abierto. Mile cambia el importe. Llega el sync a Fede (el modal sigue mostrando el viejo). Fede corrige solo la descripción → Guardar.
- **Obtenido**: el importe vuelve al viejo en los dos teléfonos (`doSaveEditShared` escribe todos los campos del modal con `updatedAt=ahora`). Esperado: guardar solo lo que se tocó (o avisar "cambió mientras editabas").

### B09 · Medio · Último que guarda gana el documento entero
- **Pasos** (los dos online, sin sincronizar entre medio): Fede cambia el nombre, Mile el importe del mismo gasto. **Obtenido**: queda solo una de las dos correcciones ("Internet" con $31.000: se pierde el nombre de Fede). Convergen bien (los dos terminan igual); lo que falta es fusionar por campo.
- **Reloj**: si el teléfono de Mile tiene el reloj 3 min atrasado, su edición posterior pierde contra la de Fede (`updatedAt` = `Date.now()` del cliente). Borrar vs editar: el posterior gana en los dos órdenes y los dos teléfonos coinciden (correcto).

### B10 · Medio · Ingresos que no se renuevan
- **Pasos**: Plan → + Ingreso → "Sueldo", $1.000.000, Mensual, sin tocar el rango. **Obtenido**: 6 meses (hasta el último mes visible) y sin `rep`. Con el reloj 7 meses adelante el Plan queda con 0 meses de ese sueldo (el script lo mide). Las suscripciones y vencimientos sí se renuevan (`rep`). Solo editando y marcando los 12 meses se vuelve recurrente.

### B11 · Medio · "Parece repetido" no funciona
- **Pasos**: cargar "Café $3.300" hoy y volver a cargarlo 2 s después. **Esperado**: aviso. **Obtenido**: lo guarda de nuevo sin avisar (solo avisa entre las 12:00:00 y las 12:02:00). Causa: el gasto guarda `addedAt` = mediodía del día elegido y `_isDupGasto` mide `now − addedAt < 2 min`. Consecuencia colateral: dentro de un día todos los gastos empatan en `addedAt`, así que el recién cargado queda **al final** del grupo "Hoy".
- **B20** (bajo): cuando el aviso sí sale, el toque de confirmación dentro de 1,5 s no hace nada (`_gSaving` queda en true).

### B12 · Medio · Archivo invisible
- **Pasos**: tener un gasto de hace 20 meses, abrir la app y esperar 3 s. **Obtenido**: toast "📦 1 gastos viejos archivados (>18 meses)"; el gasto sale de `S.gastos` y de todas las pantallas (buscador, comparar meses, totales de ese mes), y solo `getArchivedGastos()` (para "el bot") lo lee. No se puede ver, buscar ni restaurar desde la UI. (Sí entra en el backup.)

### B13 · Medio · Editar el nombre en la Agenda pisa el Plan
- **Pasos**: en el Plan poner $99.000 en la celda de diciembre de "Expensas"; en la Agenda cambiar solo el nombre a "Expensas edificio" → Guardar. **Obtenido**: la celda vuelve a $90.000 (`syncAgendaEditToPlan` rehace todos los meses con `setPlanFromRule` aunque el monto y la fecha no cambiaron).

### B14–B25 (bajos), repro breve
- **B14**: Fede carga "Cena $10.001" al 50%. Fede ve "prestaste $5.000", Mile ve "pediste $5.001", la deuda es $5.001; en Gastos cada uno ve $5.001 (suman $10.002).
- **B15**: donut con 3 categorías iguales → 33+33+33; en los 13 meses simulados dieron 98–102% en 11 meses. Con importes de $x,50 la suma de filas difiere del total en $1–2.
- **B16**: Mile busca "Cena" en Gastos → toca el resultado → se abre "Editar gasto" del gasto de Fede → Guardar → se cierra sin cambios ni aviso.
- **B17**: Fede crea "Mascotas", la usa en un compartido, la borra (pasa a Varios) y sincroniza: reaparece sola en su lista (viene del diccionario del bin, que solo crece).
- **B18**: compra del 31/08 en 6 cuotas: próxima 30/09; al pagar, 30/10 (no 31/10), 30/11, 30/12, 30/01.
- **B19**: cuota 5 de 3 → gasto "cuota 5/3" (la vista previa se oculta pero guarda); 1000 cuotas → fila de Plan con 999 meses.
- **B21**: deuda de $300 → "Sin deuda pendiente ✓ / Al día" y "Liquidar" no propone importe.
- **B22**: Exportar → borrar datos → Importar: gastos, cuentas, Agenda, Plan, transferencias y categorías vuelven idénticos, pero `fin_my_name`, `fin_comp_bin_id`, `fin_comp_api_key` (y `fin_sync_api_key`) no están en el archivo → "Soy" vuelve a Fede por defecto.
- **B23/B24/B25**: ver tabla.

## 4. Observaciones sin ✗ (comportamientos a conocer)

- Los vencidos no entran en el Plan: una cuota o suscripción vencida hace meses queda en la Agenda (en rojo) pero sus meses pasados se podan y el Plan del mes en curso no la cuenta (el script: "Vencida 4c" y "Patente" quedan con 0 meses). Pagar una suscripción vencida hace 5 meses registra **un** solo gasto y salta al próximo vencimiento: los atrasados no quedan en ningún lado.
- Borrar el gasto de la cuota 1 no borra la compra de la Agenda/Plan; pasar un gasto de Tarjeta a otra categoría deja la cuota pendiente en Agenda y Plan.
- Pagar una cuota ya terminada, el doble clic real en "Registrar pago" y el triple toque en "Guardar" gasto **no** duplican (comprobado).
- Bin compartido: sin compresión ni archivo; ≈224 B por gasto ⇒ los 100 kB de JSONBin llegan a ~450 gastos compartidos. Al tope la app avisa con el peso ("pesa 102 kb y JSONBin corta en 100…") y deja el gasto pendiente (bien), pero no ofrece archivar.
- Bin personal: 2.600 gastos = 318 kB crudos / 54 kB comprimidos. localStorage: 1,27 MB con 2.600 gastos (copias diarias incluidas) sobre un tope de ~4,9 M de caracteres: alcanza para unos 5.000 gastos.
- Gastos en USD no existen (solo cuentas en USD, con un tipo de cambio global); la periodicidad de la Agenda es mensual/anual/una vez (no hay semanal); no hay "pausar" (solo borrar); los nombres de la pareja son exactamente "Fede" y "Mile". La pestaña Presupuesto está apagada por `FEAT_PRESUPUESTO=false`.
- El dup-noon depende de la hora: entre las 12:00:00 y las 12:02:00 el aviso sí sale.

## 5. Mejoras sugeridas (priorizadas)

1. **Cifras de plata** (B01, B02, B03): pendientes que incluyan ediciones de gastos ajenos; permitir saldo negativo con aviso "la cuenta no alcanza"; que una compra compartida en cuotas marque toda la serie como compartida (`shared` en la cuota de la Agenda).
2. **Presupuesto por categoría + alertas**: hoy el presupuesto semanal está apagado y el donut solo muestra "lo gastado". Con los datos que ya hay (Comparar meses, promedio de 3 meses) se puede sugerir un tope por categoría y avisar al 80/100% y cuando el Cierre del mes proyectado sea negativo (el Plan ya lo pinta en rojo pero nadie lo mira).
3. **Gráfico de tendencia** (6–12 meses por categoría y total): el usuario de la simulación tuvo 13 meses de historia y solo puede comparar de a dos meses.
4. **Exportar CSV/Excel de gastos** (filtrado por mes/categoría): hoy `exportExcel` depende de un CDN (falla sin red) y el backup es JSON.
5. **Vencidos**: mostrar en el Plan del mes en curso lo vencido sin pagar, y ofrecer "pagué N meses" para suscripciones atrasadas.
6. **Gastos y vencimientos en USD** (con el tipo de cambio del día del gasto) y periodicidad semanal/bimestral/trimestral.
7. **Compartidos más robustos**: merge por campo o al menos aviso "cambió mientras editabas" (B08/B09); reloj lógico o del servidor; archivar/comprimir el bin compartido (hoy ~450 gastos) con aviso al 80%; ordenar dentro del día por hora de carga.
8. **Nombres de la pareja configurables** y backup que incluya la configuración no secreta (quién soy, bin) con vista previa antes de importar.
9. **Histórico**: pantalla "Archivo" para ver/restaurar lo de más de 18 meses, o subir el plazo.
10. **Deshacer**: cola de avisos en lugar de un único cartel, para que un aviso de sync no pise un "Deshacer".

## 6. Qué se probó y cobertura

| Fase | Qué | ✓ | ✗ |
|---|---|---|---|
| 0 | 4 cuentas (ARS, USD, inversión, saldos con decimales) y categorías propias por el modal | 4 | 0 |
| 1 | 176 altas por el modal en 13 meses (-8…+4), 12 categorías + propias; descripciones con emojis/acentos/HTML/comillas/600 caracteres; montos 0, negativo, vacío, texto, 1e999, 0,4, decimales, 1e11, 1e15; total/categorías/filas/% de cada mes | 19 | 2 (B15) |
| 2 | Buscador en 13 meses (acentos/mayúsculas), editar (cambio de mes), borrar con confirmación y deshacer, doble/triple toque, aviso de repetido | 18 | 4 |
| 3 | 10 compras en cuotas (1, 2, 3, 6, 12, 24; 29/30/31, febrero, bisiesto, fin de año); pagar, deshacer, última cuota, vencida, cambio de vencimiento, borrar compra y recarga, cuota imposible, 1000 cuotas, editar la compra; KPI y 6 barras de Tarjetas contra el calendario | 34 | 2 |
| 4 | 10 suscripciones/vencimientos (mensual, anual, única, vencida), 3 ingresos, Plan/Saldo bancos/Resultado/Cierre/Patrimonio, pagos con saldo insuficiente, cobro en cuenta USD, tipo de cambio raro, edición de celdas, borrar/deshacer | 61 | 6 |
| 5 | 2 teléfonos: 48+ gastos alternados con 50/50 y "solo uno", 25/75, cambio de pagador, liquidar parcial/total/signo, editar/borrar transferencias, conflictos (pares aislados), altas simultáneas, sin red, GET/PUT caídos, bin vacío/corrupto, tombstones, modal abierto, reloj desfasado, vueltas sin cambios, deshacer compartido, redondeo, buscador, cuotas compartidas, categoría borrada, nombres | 154 | 14 |
| 6 | Recarga, backup export/import, tema claro/oscuro, vista compacta, texto hostil en 8 campos + categoría + bin | 39 | 3 |
| 7 | 2.600 gastos (tiempos, localStorage, bin), bin compartido al tope, archivo de 18 meses | 5 | 1 |
| 8–10 | Reloj 31/12 → 1/1 y +7 meses; sync personal entre dos teléfonos; iPhone 390 px con textos/montos enormes; errores de JS de toda la corrida | 13 | 1 |
| | **Total** | **347** | **33** |

No cubierto: import de Mercado Pago/Excel (usa la API de Claude y SheetJS por red), notificaciones push y service worker, exportación a Google Calendar, Fondos/Presupuesto (apagados), WebKit real (lo cubre `a7`), la pantalla "Exportar datos de control".

Notas de método: el arnés desactiva el intervalo de sync automático (3 min) para que las comprobaciones sean deterministas; los conflictos se prueban en pares de teléfonos aislados con su propio bin; las cuentas independientes están en el propio script (`share`, `saldoIndep`, `rule`, `cuotaMonths`, `planMatrix`) y no llaman a nada de la app.
