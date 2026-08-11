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
| `a4-ui.js` | los modales y la edición por DOM real: que cada menú tenga sus campos, que editar cambie el dato y llegue al bin, y que cada fila tenga sus botones |
| `a5-pagos.js` | corregir una transferencia ya confirmada con el PUT caído: que quede pendiente, que el reintento la lleve sin duplicarla y que los dos dispositivos terminen con la misma deuda |

## Cómo leer una falla

Cada script imprime `✓`/`✗` por comprobación y termina con el total. Los `✗`
traen el valor obtenido y el esperado. Antes de dar por bueno un hallazgo,
conviene revertir el arreglo y comprobar que la comprobación se pone en rojo:
varios "fallos" de la primera corrida eran errores del propio harness (llamar a
`openEditGasto` con un id en vez del objeto, o mirar solo el prefijo del
`onclick` cuando el borrado va envuelto en `appConfirm`).
