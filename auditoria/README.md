# Auditoría de extremo a extremo

Corre la app real en Chromium contra un JSONBin **falso en memoria** compartido
entre dos "dispositivos" (dos contextos aislados, cada uno con su
`localStorage`). Sirve para lo que `tests.js` no alcanza: el ciclo completo de
sincronización entre dos personas, con la red cortándose en el medio.

No pega contra la red. `lib.js` intercepta `fetch` antes de que carguen los
scripts de la app, así que `jsonbinRequest`, `fetchSharedBin`, `pushSharedBin`,
los tombstones y el merge se ejercitan de verdad.

## Correr

```sh
npm i playwright-core          # una sola vez
node auditoria/a1-compartidos.js
```

`a7-ios.js` corre en el mismo Chromium que las demás, con el contexto de un
iPhone: eso cubre DOM, CSS aplicado y JS, no diferencias de motor. Lo que
depende de WebKit —que la app cargue sin errores, el tamaño real de los campos,
el PNG del ícono generado por canvas y la geometría de la tabla del proyectado—
se revisó aparte contra WebKit de verdad (`WebKitWebDriver` de `webkit2gtk`,
misma familia que Safari), sirviendo la app por http y dentro de un iframe de
390x844 para tener el viewport de un iPhone.

La app se toma del `index.html` que está al lado de esta carpeta, así que
funciona en cualquier clon. Dos variables por si hace falta:

- `AUDIT_APP=/ruta/al/index.html` — auditar otra copia
- `CHROME_PATH=/ruta/al/chrome` — forzar un Chromium concreto (por defecto lo
  resuelve playwright, y si no lo encuentra busca en `PLAYWRIGHT_BROWSERS_PATH`)

## Qué cubre cada uno

| archivo | qué simula |
|---|---|
| `a1-compartidos.js` | seis meses de gastos alternados entre dos dispositivos: contabilidad de la deuda contra una cuenta hecha aparte, cada porcentaje de división, liquidar, editar cruzado, borrar con tombstone, corte de red y reintento, y que con el bin ilegible no se pise nada |
| `a2-repro.js` | reproducción aislada de dos defectos encontrados: la edición de un gasto compartido que se revertía sola, y el push fallido que no dejaba rastro de "falta subir" |
| `a3-agenda.js` | Agenda ↔ Gastos ↔ Proyección ↔ Saldos: pagar suscripción, vencimiento único y cuotas; deshacer; vencimiento compartido que viaja al bin; ciclo completo de una compra en cuotas; y que borrar una cuota aguante una recarga real de la app |
| `a4-ui.js` | los modales y la edición por DOM real: que cada menú tenga sus campos, que editar cambie el dato y llegue al bin, que cada fila tenga sus botones, que en la Agenda la fila tenga solo el ✓, que mantenerla apretada abra la edición y que el tacho de arriba a la derecha borre con confirmación, que el buscador encuentre un gasto de otro mes y deje abrirlo, y que tocar la deuda abra el historial de liquidaciones |
| `a5-pagos.js` | corregir una transferencia ya confirmada con el PUT caído: que quede pendiente, que el reintento la lleve sin duplicarla y que los dos dispositivos terminen con la misma deuda |
| `a6-consistencia.js` | las costuras entre menús: que el mes sea uno solo en las tres pestañas de Gastos, que el mismo juego de categorías esté en los tres modales, que una categoría propia se pueda editar y borrar, que viaje en el sync, en el backup y al teléfono de la pareja, que un menú abierto desde otro no quede por debajo, que los logos sigan llegando a la pantalla desde `logos.js`, y que un gasto compartido se distinga de uno propio en la lista |
| `a7-ios.js` | el iPhone: la app con userAgent y pantalla de iOS (390x844, touch) y sin las APIs que Safari no expone en una pestaña (Notification, vibrate) — que arranque igual, que las pantallas y los 26 menús entren sin desbordes, que ningún campo dispare el zoom automático de Safari, que el ícono de "Agregar a inicio" sea PNG, que las barras del navegador no se confundan con el teclado, que el backup se baje de verdad y que copiar no explote sin `navigator.clipboard` |
| `a8-navegacion.js` | la estructura de secciones de la v31, en contexto iPhone: que la barra de abajo sea Saldos · Gastos · Compartidos · Agenda, que cada sección muestre una sola vista, que Agenda lleve Agenda · Tarjetas · Plan y el calendario ya no exista, que el mes siga siendo uno solo entre Gastos y Compartidos, que el "+" flotante abra lo que corresponde en cada lado, que los nombres viejos (`goTo('plan')`, `switchGastosTab('compartidos')`, un tab `'cal'` guardado) sigan llevando a algún lado, que en los menús el título no quede debajo de la flecha de volver ni haya degradado tapando el pie, que con el toast, el aviso de instalar y el botón flotante visibles a la vez ninguno se pise, y que los botones de Compartidos lleguen al área táctil mínima sin invadir la del de al lado |
| `a9-auditoria-completa.js` | lo que salió de auditar la v32.3 entera: que cerrar una edición de Agenda sin guardar no deje el modal en modo edición (el alta siguiente pisaba el ítem o no guardaba nada), que cambiar el tipo al editar mueva el ítem, que una compra en cuotas del 31 no saltee el mes siguiente, que con el aviso de instalar visible la última fila de cada sección quede arriba del ＋, que en los 22 menús la flecha y el título compartan renglón fuera del scroll, que en tema claro los toasts y el panel de Mercado Pago tengan contraste, y que las copias diarias no se reescriban en cada guardado ni le quiten lugar a los datos |
| `a10-compresion.js` | la compresión del bin personal (v33): que un payload que entra en los 100kb se suba igual que siempre, que uno que no entra viaje con `fin_v6` comprimido (`gz1:…`) y quede por debajo del tope, que otro dispositivo lo baje entero y que la pareja siga leyendo sus gastos compartidos |
| `a11-plan-cabecera-donut.js` | lo que cambió en la v33.1, en contexto iPhone: el Plan con Saldo bancos arriba, sin totales y con Resultado y Cierre del mes (con las cuentas hechas aparte), sin tacho en las filas y con el del menú de edición; el tipo de cambio como etiqueta al lado de 🌙 y ⚙ que abre el mismo campo y ↻ de antes; y el donut con las cuatro categorías principales, "+ N más" y el detalle al tocar una |
| `a12-v34-visual.js` | el rediseño "menos ruido" de la v34, en contexto iPhone: la versión, los colores de categoría (comida naranja, super verde, transporte azul, ninguno repetido), la cabecera de Saldos en una fila con la versión a la vista y el ícono de vista compacta, los avisos de vencimiento con "vence / cuándo" a la derecha, Gastos agrupado por día sin franja y con un solo ⋯ (Editar/Eliminar, con confirmación, que entra en pantalla y se cierra al tocar afuera), la lupa adentro de la franja del mes, el ícono en la leyenda del donut, Compartidos con saldo verde/rojo, Liquidar y el ⋯ a la altura del saldo (Historial de transferencias, Sincronizar y Exportar adentro del ⋯), "Por categoría" con el total del mes y los chips que bajan de renglón, filas con el ícono de la categoría y "Pagaste / Mile pagó" debajo del nombre, y total del día en gris, Agenda con tarjetas neutras y el alta al pie de cada hoja, y el + adentro de la barra |

| `a13-simulacion-meses.js` | una pareja usando la app 13 meses con la UI real (gastos de todas las categorías y montos límite, cuotas de 1 a 24 pagos cruzando fin de año, suscripciones y vencimientos —también vencidos—, ingresos, Plan y Cierre del mes contra una cuenta independiente, compartidos en dos teléfonos con cortes de red, conflictos, bin corrupto, backup, temas, XSS, 2.600 gastos, cambio de año). Informe: `INFORME-simulacion.md`. Los hallazgos que aún no se corrigen salen como `⚠ pendiente` y no cuentan como falla |
| `a14-tendencia.js` | el gráfico de tendencia (v34.4): se abre tocando el total, 6/12 meses con datos reales (compartidos = tu parte, meses archivados), promedio y variaciones contra una cuenta independiente, tocar una barra cambia el mes de las tres pestañas, teclado, tema claro/oscuro con contraste, iPhone 390 px y montos de 12 cifras |
| `a15-compartido-comprimido.js` | el bin compartido comprimido (v34.3): crudo mientras entra en 100 kB, `gz1` cuando no, lectura de los dos formatos entre dos teléfonos, el aviso de que la pareja actualice y que un bin ilegible no se pise |
| `a16-almacenamiento.js` | el archivo de más de 18 meses en IndexedDB (comprimido, visible en Gastos/buscador/comparar/tendencia), la migración con la app "matada" en cada paso, sin IndexedDB, el backup y el aviso al 80% del tope de localStorage |

## Cómo leer una falla

Cada script imprime `✓`/`✗` por comprobación y termina con el total. Los `✗`
traen el valor obtenido y el esperado. Antes de dar por bueno un hallazgo,
conviene revertir el arreglo y comprobar que la comprobación se pone en rojo:
varios "fallos" de la primera corrida eran errores del propio harness (llamar a
`openEditGasto` con un id en vez del objeto, o mirar solo el prefijo del
`onclick` cuando el borrado va envuelto en `appConfirm`).
