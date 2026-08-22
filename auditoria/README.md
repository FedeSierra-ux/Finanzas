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
| `a4-ui.js` | los modales y la edición por DOM real: que cada menú tenga sus campos, que editar cambie el dato y llegue al bin, que cada fila tenga sus botones, que el buscador encuentre un gasto de otro mes y deje abrirlo, y que tocar la deuda abra el historial de liquidaciones |
| `a5-pagos.js` | corregir una transferencia ya confirmada con el PUT caído: que quede pendiente, que el reintento la lleve sin duplicarla y que los dos dispositivos terminen con la misma deuda |
| `a6-consistencia.js` | las costuras entre menús: que el mes sea uno solo en las tres pestañas de Gastos, que el mismo juego de categorías esté en los tres modales, que una categoría propia se pueda editar y borrar, que viaje en el sync, en el backup y al teléfono de la pareja, que un menú abierto desde otro no quede por debajo, que los logos sigan llegando a la pantalla desde `logos.js`, y que un gasto compartido se distinga de uno propio en la lista |
| `a7-ios.js` | el iPhone: la app con userAgent y pantalla de iOS (390x844, touch) y sin las APIs que Safari no expone en una pestaña (Notification, vibrate) — que arranque igual, que las pantallas y los 26 menús entren sin desbordes, que ningún campo dispare el zoom automático de Safari, que el ícono de "Agregar a inicio" sea PNG, que las barras del navegador no se confundan con el teclado, que el backup se baje de verdad y que copiar no explote sin `navigator.clipboard` |
| `a8-navegacion.js` | la estructura de secciones de la v31, en contexto iPhone: que la barra de abajo sea Saldos · Gastos · Compartidos · Agenda, que cada sección muestre una sola vista, que Agenda lleve Agenda · Tarjetas · Plan y el calendario ya no exista, que el mes siga siendo uno solo entre Gastos y Compartidos, que el "+" flotante abra lo que corresponde en cada lado, que los nombres viejos (`goTo('plan')`, `switchGastosTab('compartidos')`, un tab `'cal'` guardado) sigan llevando a algún lado, que en los menús el título no quede debajo de la flecha de volver ni haya degradado tapando el pie, que con el toast, el aviso de instalar y el botón flotante visibles a la vez ninguno se pise, y que los botones de Compartidos lleguen al área táctil mínima sin invadir la del de al lado |

## Cómo leer una falla

Cada script imprime `✓`/`✗` por comprobación y termina con el total. Los `✗`
traen el valor obtenido y el esperado. Antes de dar por bueno un hallazgo,
conviene revertir el arreglo y comprobar que la comprobación se pone en rojo:
varios "fallos" de la primera corrida eran errores del propio harness (llamar a
`openEditGasto` con un id en vez del objeto, o mirar solo el prefijo del
`onclick` cuando el borrado va envuelto en `appConfirm`).
