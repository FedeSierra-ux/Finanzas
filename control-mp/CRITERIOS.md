# Control de gastos contra Mercado Pago

Fede pasa un backup de la app (`finanzas-backup-AAAA-MM-DD.json`) y el detalle de
Mercado Pago de un mes (`.xlsx`). Hay que ver qué gastos de MP faltan cargar en la
app. Es solo un cruce: no se abre PR ni se toca la app.

```
python3 -I control-mp/cruce.py <backup.json> <detalle_mp.xlsx> <mes> [<mes> ...]
```

`<mes>` va de 1 a 12. Pasar el mes del detalle y el anterior, porque a veces un
gasto quedó cargado en el mes de al lado. El script hace el cruce automático y aplica
las reglas de descarte. Lo que queda en **FALTA** se revisa a mano con los puntos de
abajo antes de mostrárselo a Fede.

## Cómo leer los datos

- **Backup:** los gastos están en `data.fin_v6` (es un JSON dentro de un string), en
  `.gastos`. `month` va de 0 a 11. Si no tiene `day`, la fecha sale de `addedAt`.
  Se descarta lo que esté en `_deletedGastoIds` o `_gTombs`.
- **Detalle de MP:** las columnas son `RELEASE_DATE`, `TRANSACTION_TYPE`, `REFERENCE_ID`
  y `TRANSACTION_NET_AMOUNT`, y a veces viene `PARTIAL_BALANCE`. Los montos pueden ser
  texto ("-12.000,00") o número.
- Solo se cruza contra gastos sin compartir o compartidos que pagó **Fede**. Lo que
  pagó Mile no sale de su MP.
- Los pagos compartidos (alquiler, expensas) están en `fin_shared_payments`.

## Cobros con devolución

- Si el cobro y su devolución tienen el mismo `REFERENCE_ID` y se anulan del todo,
  se descartan. Pasa seguido en Uber, DiDi (Dlocal), EBANX, Rappi, Cabify y Mercado
  Libre (Compra protegida).
- Si la devolución es parcial, cuenta lo que quedó cobrado.
- Si alguno de los dos queda en otro mes, se ignora.

## Reglas de descarte (si no está cargado, no se avisa)

- **Uber, DiDi (Dlocal) y EBANX:** se descartan todos los que no están cargados.
  EBANX es Uber.
- **Transferencias a Milena Aluhe Caro (Mile):** son saldos de gastos compartidos,
  no gastos. Alquiler y expensas van en pagos compartidos.
- **Transferencias grandes a terceros** (desde unos $80.000) que no están en la app:
  se descartan. Son ahorro, inversión o pagos que no van como gasto.
- **Pedro Marengo, MIS2ROSAS y El Establo:** se descartan si no están cargados.
- **Cabify:** si lo cargado no coincide con MP, se deja como está.

## A qué concepto corresponde cada destinatario

| En MP | En la app |
|---|---|
| Agustín Stella, Lucas (Javier) Burruni, Tiago Girgenti, Tomás Pérez Juárez, "Torneo Doble Mérito" | Fútbol (varios) |
| Leonel Pablo Marchioni, El Establo | Almacén (super) |
| Hacheef | Almuerzo (oficina) |
| QR Supermercados DIA | Galletitas (oficina) |
| REVÉ SALÓN | Peluquería (varios) |
| Jorge Rengifo | Verdulería |
| Tatiana Menoyo Laizerowitch | Almuerzo Kiddo (oficina) o merienda (salidas), según el caso |

## Revisión a mano de lo que queda en FALTA

1. **Mismo día con otro concepto o monto agrupado.** Puede estar cargado con otro
   nombre o como la suma de varios pagos del mismo día. Por ejemplo, QR Dante en Verona
   (49.000) más una transferencia a Pablo (5.000) quedaron como "Merienda cerámica"
   (54.000), y dos DiDi del mismo día quedaron como un solo Uber. Mirar el día antes
   y el día después.
2. **Cargado por menos a propósito.** A veces Fede carga menos de lo que pagó: un
   Rappi del que sacó algo ("Rappi (19641.5 - Bebidas Energ)"), unos pochoclos que
   cuestan unos 10.000 menos que la transferencia, o unas galletitas de cuando le
   devolvieron otras cosas. Si la diferencia es razonable y es del mismo día, se
   pregunta y no se marca como error.
3. **Gastos divididos con otras personas** (por ejemplo, un Rappi grande): no van.
4. **Errores de tipeo.** Mismo día, mismo comercio y dígitos cambiados, como
   26.694,15 en lugar de 26.964,15. Se marcan para corregir.
5. **Uber o DiDi que se devolvió pero quedó cargado.** El cobro real suele ser otro
   viaje del mismo día. Se marca para corregir el monto.
6. **Duplicados en la app.** Mismo monto cargado dos veces cuando en MP hay un solo
   pago. Se avisan.
7. **Lo que no está en el backup puede haberse cargado después.** Fede puede haberlo
   cargado después de bajar el backup. Preguntar antes de darlo por faltante.

## Excel para importar lo que falta

Se usa la plantilla de la app (`GASTOS_TEMPLATE_B64` en `index.html`, hoja `Gastos`).
Las columnas son:

| Columna | Valor |
|---|---|
| Nombre | El nombre del gasto |
| Categoría | La clave de la categoría: `varios`, `oficina`, `salidas`, `super`, `compras`, etc. |
| Fecha | `AAAA-MM-DD` |
| Monto | Número |
| Descuenta del semanal | `Sí` |
| Compartido | `Sí` o `No` |
| Quién pagó | `Fede` |
| División % Fede | 50 |

Nombres que ya usa Fede: "Futbol", "Almuerzo", "Galletitas", "Cafe", "Merienda" y
"Rappi - …". Si un Rappi es compartido, va 50/50 con Fede como pagador.
