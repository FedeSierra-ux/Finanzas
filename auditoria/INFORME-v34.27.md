# Auditoría exhaustiva de la v34.27 (30/10/2026)

Cuatro revisiones en paralelo sobre `index.html` v34.27, cada una con reproducción
en Chromium (iPhone/Android/escritorio, claro/oscuro) contra el JSONBin falso de
`auditoria/lib.js`:

1. **Compartidos**: 24 meses (nov-2026 → oct-2028) con dos teléfonos, cada uno con su reloj, 29-feb-2028, gastos del 31, centavos, ediciones cruzadas, 8 liquidaciones parciales, teléfono offline 5 semanas, archivo a 12 meses.
2. **Finanzas personales**: 24 meses de Plan/Saldos/Agenda/Cuotas contra cuentas hechas aparte, 20.000 gastos, backup exportar→importar, USD con TC variable.
3. **UI/UX y visual**: ~30 menús × 4 viewports × 2 temas, app vacía y datos extremos.
4. **Robustez, seguridad y performance**: XSS, service worker, localStorage lleno, dos pestañas, perfil con 20k gastos, análisis estático.

**Línea base**: los 33 scripts de `auditoria/` dan verde (a19 = 437/437, a13 = 400/400) y `node tests.js` 776/776. Nada de lo de abajo lo detectaba.

**Sólido** (verificado): la deuda de Compartidos cierra al centavo todos los meses durante 24 meses y archivar no la pierde; ediciones simultáneas de distinto campo se funden; offline 5 semanas converge; bisiesto, días 29/30/31 y cuotas de 1 a 36 que cruzan 2 años dan fechas y sumas exactas; Plan/Saldos coinciden al peso con la cuenta independiente; backup→restaurar deja `S` idéntico; ningún dato del bin de la pareja inyecta HTML; 20k gastos: render < 80 ms, búsqueda ~10 ms.

Los hallazgos de abajo vienen de lectura + reproducción de cada agente; los marcados ✔ los revisé yo contra el código.

## A. Bugs de datos y Compartidos

| ID | Sev. | Qué pasa | Dónde |
|---|---|---|---|
| A1 | Alto | Restaurar una copia de Compartidos (o "Fusionar backup") revive un gasto borrado, pero el tombstone del otro teléfono es más nuevo y a los segundos vuelve a borrarse en los dos; entre medio los saldos divergen (6000 vs −1000). Fix: re-sellar con `stampShared` al revivir | `restoreSharedSnapshot` 12036, `fusionarBackup` 13501 |
| A2 | Alto ✔ | Editar importe/total de una cuota en la Agenda se revierte al recargar (toma siempre la cuota 1) | `syncCuotasToAgenda` 6889/6942 |
| A3 | Medio | Dos altas simultáneas en los dos teléfonos: aviso falso "el otro teléfono usa una versión vieja" y se apaga la compresión 14 días. No se pierde dato | `_fetchSharedBin` 11460 |
| A4 | Medio | Con huso al este de UTC+9 (Tokio, Seúl, Australia) el gasto del día 31 cae en el mes siguiente en Compartidos y en el listado de Gastos; usan `new Date(addedAt)` en vez de `g.year/month/day` | `inSelectedMonth` 12713, `_dayKeyOfSh` 12823, `_dayKeyOf` 4681 |
| A5 | Medio | Gasto compartido archivado (>12 meses): editarlo o borrarlo en Compartidos no se refleja en Gastos | `_getMergedGastos` 4577 |
| A6 | Medio ✔ | Editar cualquier campo de una cuota recortada a fin de mes (compra 31/01) corre `dueDay` a 28 para siempre | `doSaveEditCuota` 8346 |
| A7 | Medio | Plan "+ Gasto › Suscripción › Una vez": anual en el Plan, mensual en la Agenda → 24 meses de deuda falsa (−168.000 de más) | `doSavePlan` 6623 |
| A8 | Medio | Un reloj mal puesto (aunque sea una sola apertura) rueda la Agenda y poda el Plan sin vuelta atrás (Resultado −2,3M vs +1,49M real) | `agRoll` 7137, `planNorm` 6050 |
| A9 | Medio | Restaurar un backup con archivo grande pierde el archivo (>12 meses) sin avisar y dice "✅ Datos restaurados" | `importBackup` 13578 |
| A10 | Medio | Las copias diarias de gastos se congelan en silencio con ≥3.700 gastos (solo queda la del día 1); además llenan el cupo de localStorage y disparan el aviso del 80 %. 24 meses a 250 gastos/mes = 94 % del cupo | `_runAutoBackupGastos` 3533, `persistJsonStorage` 3365 |
| A11 | Medio | "Reemplazar todo" no vacía el archivo de IndexedDB; el import de Excel/MP no detecta repetidos contra el archivo (historial duplicado) | `importBackup`, `parseExcelFileWithSheetJS` 14188, `processMPWithClaude` 13961 |
| A12 | Medio | El TC manual se pisa a los 30 min con la `venta` de dolarapi (las tenencias deberían valuarse a `compra`); el input aplica desde 2 dígitos ("1450" pasa por 14 y 145, con sync en cada tecla) | `fetchTC` 4162, input 4084 |
| A13 | Medio | Las cuotas de tarjeta no generan ningún aviso de vencimiento (sí cuentan en el badge) | `avisosVencimiento` 9882, `syncAgendaToWorker` 10638, `checkAgendaAlerts` 7240, Saldos 9116 |
| A14 | Bajo | "Editar transferencia" muestra un "Nuevo saldo" que cuenta dos veces el pago (deuda 600 → dice "te debe $200") | `updateSharedPaymentPreview` 12357 |
| A15 | Bajo | Gasto de la pareja sin `shared.paidBy`: los dos teléfonos creen haberlo pagado | `_sanearShared` 10969 |
| A16 | Bajo | `exportCompartidosData` marca `coincide:false` por flotantes (1e-11); el saldo no se redondea a centavos | 13706, 11299 |
| A17 | Bajo | `openLiquidaciones` revienta si `p.date` no es string; un `null` dentro de `gastos`/`payments` del bin rompe `fetchSharedBin` | 4986, 11483 |
| A18 | Bajo | El popup por categoría muestra "prestaste $501" donde la lista dice $500 (gasto impar) | `openSharedCatDetail` 12569 |
| A19 | Bajo | Sin "Registrar pago" si la deuda es < $1 o "Al día" (no se puede registrar un adelanto) | `openSharedPaymentModal` 12797 |
| A20 | Bajo | Dos teléfonos que liquidan lo mismo a la vez generan pago duplicado y deuda invertida, sin aviso | diseño |
| A21 | Bajo | Reglas aprendidas con match por substring sin límite de palabra ("dia" → "Media luna"); la regla exacta no gana | `findCategoryRule` 3689 |
| A22 | Bajo | Plan "+ Gasto › Tarjeta" no valida `CUOTAS_MAX` (acepta 20.000 cuotas) | `doSavePlan` 6581 |
| A23 | Bajo | Export a Google Calendar usa el día recortado (28 en vez de fin de mes) | `buildAgendaItems` 7429, `gcalRRule` 7721 |
| A24 | Bajo | El backup no incluye `fin_push_worker_url`, `fin_push_vapid_public`, `fin_theme`, `fin_compact`, `fin_cat_ico_*` | `BACKUP_KEYS` 13442 |
| A25 | Bajo | `parseNumAR('1,234.56')` da 1,23456 y `'0.500'` da 500 | `parseNumAR` |

## B. Seguridad y robustez

| ID | Sev. | Qué pasa | Dónde |
|---|---|---|---|
| B1 | Alto ✔ | XSS en la revisión del import de MP: `g.date.slice(...)` va sin `esc()` y la respuesta de Claude se copia sin validar (prompt injection desde un PDF → lee la master key de JSONBin y los gastos). Una fecha numérica o un ítem `null` cortan el import | `renderMPReview` 14024, `processMPWithClaude` ~13960 |
| B2 | Medio | `id`/`cat`/`paidBy` sin validar que entran por backup o bin personal se ejecutan en los `onclick` inline (el bin compartido sí está saneado) | `load` 3316, `applyPayload` 10407, `fusionarBackup` 13490 |
| B3 | Medio | Un solo registro inválido (`null` en `accounts`, `gastos:{}`, `fin_v6` = `null`) deja el arranque a medias o la app muerta sin recuperación | `load` 3316 |
| B4 | Medio | Dos pestañas/instancias abiertas: la última que guarda pisa a la otra sin aviso (no hay listener `storage`) | `persistJsonStorage` 3359 |
| B5 | Medio | "Buscar actualización" sin red borra caches y desregistra el SW: la app no abre hasta que vuelva internet | `checkForUpdate` 13345 |
| B6 | Medio | SW network-first sin timeout: con señal "colgada" la app instalada queda en blanco | `sw.js` 95 |
| B7 | Medio | Push: los endpoints del Worker se autentican solo con el Bin ID (no secreto); la master key viaja a `/register` | `subscribeToPush` 10583 |
| B8 | Medio | El sync personal deja de subir en silencio al pasar los 100 KB de JSONBin (~3.000 gastos); sin aviso visible salvo en el push manual | `syncPush` 13070 |
| B9 | Bajo | SheetJS 0.18.5 por CDN sin SRI (CVE-2023-30533, CVE-2024-22363) y sin cache en el SW | 14134 |
| B10 | Bajo | `applyPayload` hace `setItem` sin try tras persistir `fin_v6` | 10466 |
| B11 | Bajo | `tests.js`: ~12 helpers copiados adentro del test (~70 aserciones que no prueban la app); no hay CI | `tests.js` |
| B12 | Bajo | Código muerto: `AppStorage` (el "espejo IndexedDB" no existe), `getCurrentWeekBudgetSnapshot`, `getRememberedExpenseAccount`, `limpiarBusqueda`, `openFundAdjust` | varios |
| B13 | Bajo | El SW sirve el shell desde el cache HTTP de GitHub Pages (hasta 10 min); fuentes de Google no cacheadas offline | `sw.js` |
| B14 | Bajo | TC sin cotas (acepta cualquier `venta>0`); escrituras de localStorage sin try en `dismissInstall`, `toggleTheme`, `DEVICE_ID`, `setFotoRec` (la foto "se guarda" y desaparece) | varios |
| B15 | Bajo | Push: `e.data.json()` sin try; `notificationclick` ignora `data.url` | `sw.js` 139 |

## C. UI/UX y visual

| ID | Sev. | Qué pasa | Dónde |
|---|---|---|---|
| C1 | Alto | Texto de 9,3 px es contenido central (`--fs-xs:.58rem`, 189 usos): 112 de 216 textos en Gastos, 69/140 en Compartidos, 13/23 en el alta. Piso propuesto 11 px | línea 34 |
| C2 | Alto | Tema claro: la categoría elegida es la que peor se lee (contraste 1,5–2,0:1) | `.chips-cat .chip.on` |
| C3 | Alto | "Guardar" con texto blanco sobre azul claro en oscuro: 2,5:1 | `.btnp` 1156 |
| C4 | Alto | En el alta, Enter guarda con la categoría anterior aunque el hint sugiera otra (Coto → "Super" sugerido, guardó "Comida") | `onGastoDescInput` 4390, `doSaveGasto` 5767 |
| C5 | Alto | Primer uso sin onboarding ni CTA: dos secciones vacías con el mismo botón, "Al día ✓" en Compartidos sin explicar cómo vincular a la pareja, Ajustes arranca con "Clave de Anthropic" | Saldos / Compartidos |
| C6 | Medio | Aviso de instalar (114 px) + barra dejan ~490 px en un SE; el toast tapa el menú ⋯ de la fila; el aviso técnico de archivado aparece en la primera pantalla | varios |
| C7 | Medio | Con 9 dígitos se rompen: tarjeta de banco (USD 987.654.321), tile de Agenda, donut de Gastos, y el nombre del vencimiento en Saldos ocupa 6 renglones | `.bank-card-amount` 1454, `.ag-tile-val` 912 |
| C8 | Medio | Targets < 44 px: ‹ › y lupa 40, ⋯ 40, chips de categoría 34 de alto, pestañas de Agenda 38, 6m/12m 32, "Liquidar" 36 en SE, casilla del Plan 20×20 | varios |
| C9 | Medio | Escritorio: Escape no cierra los menús, el foco se escapa al fondo, los menús apilados no se cierran | línea 12532 |
| C10 | Medio | Escritorio: la barra de abajo ocupa 1280 px y el toast sale a la izquierda, fuera de la columna de 640 | `.nav`, `#toast-bar` |
| C11 | Medio | "Mile pagó todo" muestra "$ 0" como monto principal y "− $ 0" en el total del día | fila de Gastos |
| C12 | Bajo | Editores con monto crudo (`29070`, `1250000`) | editar compartido, cuenta, pagar |
| C13 | Bajo | Jerga técnica: "bin compartido", "MI SYNC (JSONBIN)", "Worker de Cloudflare", "pediste/prestaste" | Ajustes, Compartidos |
| C14 | Bajo | "Copias de gastos" abre distinto al resto (estilos inline, radio 18, ✕, sin manija, z-index fijo) | `ov-gastos-bak` |
| C15 | Bajo | El acento primario cambia por sección (azul / púrpura) | ítem 39 |
| C16 | Bajo | "termina julio" donde la cuota termina en junio (ya conocido, ítem 63) | Agenda |
| C17 | Bajo | Tendencia: las etiquetas de las barras se pisan; Plan: la flecha › tapa la tercera columna | |

## D. Mejoras funcionales sugeridas (nuevas, fuera de la lista 36–96)

1. **Cierre de período en Compartidos**: liquidar y compactar los meses de más de 12 meses en una fila de saldo inicial. Hoy el único consejo ante el tope de 100 KB es borrar gastos, que cambia la deuda; con 25 gastos/mes el tope llega a los 4–5 años.
2. **Aviso de lo que cambia la pareja** ("Mile cambió Coto de $48.000 a $52.000") y marca "editado por Mile" en la fila.
3. **Deshacer** al borrar un gasto o transferencia desde Compartidos (hoy solo hay confirmación).
4. **Aviso de posible pago duplicado** cuando aparece una transferencia igual cargada por la pareja hace minutos.
5. **Identidad verificable**: "¿Quién sos?" al conectar el bin y aviso si los dos teléfonos eligen el mismo nombre (hoy el default es "fede").
6. **Saldo por mes** en el historial de Compartidos, filtro por categoría y buscador, saltar al último mes con movimientos.
7. **Fecha como texto AAAA-MM-DD** en cada gasto (resuelve A4 de raíz y simplifica archivo y búsqueda).
8. **Protección de "fecha rara"**: confirmar si el reloj salta > 60 días o retrocede, con "Rehacer meses" (resuelve A8).
9. **Pausar/terminar** una suscripción o vencimiento sin borrar su historial; períodos semestral/bimestral/trimestral desde la Agenda (extiende el 94).
10. **Cuotas con importe variable** (UVA/CER): "esta cuota fue de X" que actualice el importe hacia adelante (ligado a A2).
11. **Reintegros** como monto negativo o categoría "Reintegro" (MP los trae y hoy se descartan).
12. **Copias diarias comprimidas o en IndexedDB** + `navigator.storage.persist()`, con aviso de espacio que nombre qué ocupa lugar (resuelve A10, B12).
13. **Cifrado en el cliente** del contenido de los bins y Access Keys acotadas en vez de la master key.
14. **CI mínimo** (`node tests.js`, ESLint `no-undef`, `version.json` = `APP_VERSION`).
15. De la lista 36–96 conviene priorizar: 43, 68, 63, 46, 38, 42, 50, 51, 69, 64, 80, 59, 83, 67, 73, 77, 90, 86, 72.

## Sin resolver

Nada de esto está arreglado todavía: este informe es solo la auditoría.
