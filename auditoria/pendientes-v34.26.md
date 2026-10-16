# Pendientes de la auditoría v34.25 (estado al 15/10/2026, app en v34.26)

Memoria para la próxima sesión. La auditoría completa (108 ítems) se hizo sobre
v34.25 con cinco agentes en paralelo; el preview visual antes/después está en
https://claude.ai/artifact/P53LrvCzfJdeaiVsptEcBz (las capturas no están en el
repo; el CSS y los retoques sí, en `auditoria/visual/`).

## Ya resuelto (PR #204, mergeado en main como v34.26)

- Bugs 1–35 completos.
- Arquitectura 97, 98, 99, 100, 101, 102, 105, 108.
- Validación: `node tests.js` 777/777, los 32 scripts de `auditoria/` en verde
  (a29–a32 son nuevos), simulación de 12 meses del Plan 297/297.
- Dos decisiones tomadas sin preguntar, a confirmar con el usuario:
  - Bug 5: se implementó cadencia real `everyN` (cada 2/3 meses) en la Agenda
    (`agRoll`/`nextMonthDate`, `agItemRepN`, `agPeriodLabel`), lo que cubre
    también el 94.
  - Ítem 101: importar backup pregunta dos veces: primer OK = Fusionar,
    Cancelar → "¿Reemplazar todo?".

## Resuelto en v34.27 (el usuario eligió 1, 6, 15 y "Validación" del preview 2)

Preview 2 (antes/después de los 23 ítems que pidió ver, con prototipos de los
funcionales): https://claude.ai/artifact/HqyLHiJ8wfi39fkV4UMrR1. Auditoría:
`a33-v34.27.js`.

- 36 (P1): el contraste de `--muted`/`--dim` ya había entrado en v34.26 (bug
  31); v34.27 suma el borde neutro en oscuro, `--el-1/2/3` y radios 10/14/18/26
  (`--r/--r2/--r3` apuntan a la escala). El borde claro queda el cálido.
- 41 (P6): bloque al final del `<style>`. También pinta las listas de
  Compartidos, que usan `.lgrp`.
- 55: "Editar gasto" con el orden y rótulos del alta y monto con miles
  (`numMilesInput`, `fmtMontoInp`) al abrir y al salir del campo.
- 61: `showFieldErr` es la única forma de avisar. Corrige Pagar con el importe
  borrado (pagaba el anterior), Editar cuenta con nombre vacío (guardaba el
  viejo), Sincronización y "Crear" sin clave.
- Decisiones por defecto que el usuario no respondió todavía (revertir si dice
  que no): formato al salir del campo, no mientras se tipea; "¿Gasto
  compartido?" como rótulo en la edición; los otros 5 editores con monto crudo
  (Editar cuenta, Pagar, Agenda, Editar compartido, Transferencia) siguen
  igual; Editar cuenta con nombre vacío ahora es error; se marca un campo por
  vez; importes vacíos de Nueva cuenta/Plan/Agenda siguen guardando 0; textos
  de error sin unificar; Importar Excel / Revisar MP sin cambios.

Hallazgos del preview 2 que siguen abiertos:
- 63 ya estaba hecho, pero hay un bug: la lista de Agenda y Google Calendar
  dicen "termina julio de 2027" y la hoja de pagar "junio" para la misma cuota
  (lo correcto es junio). Prototipo con `cuotaFinLbl` en el preview.
- 68: Liquidar ya responde en 100×50; el ✓ en 42×42 (falta `inset:-5px`).
- P11: la flecha › sigue tapando la tercera columna del Plan.

## Descartado por el usuario

103 (indicador sin red), 104 (accesibilidad), 106 (partir index.html),
107 (contador de requests de JSONBin).

## Pendiente: el usuario responde uno por uno qué hacer

### B. Visual (36–57) — cada P-bloque es independiente en `auditoria/visual/upgrade.css`; H1–H3 en `tweaks.js`

36. ~~**P1 · Tokens: contraste y 3 niveles de elevación.** `--muted` 4,0→6,1 y `--dim` 2,3→3,6 en oscuro; 5,5→7,4 y 2,9→4,0 en claro; sombras `--el-1/2/3`; radios `--r-sm/md/lg/xl` = 10/14/18/26. Es la base de todo lo demás.~~ ✔ v34.27
37. **P2 · Escala de radios unificada** (hoy conviven 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 16, 18, 20, 22 y 28 px).
38. **P3 · Tipografía:** un "eyebrow" común en mayúsculas para todas las etiquetas de sección (hoy 7 estilos), cifras tabulares en todos los montos, cabeceras de día uniformes ("HOY · JUEVES, 15 DE OCTUBRE"), total del día en gris en vez de rojo. *Nota: a12 comprueba hoy el rojo del total del día; habría que ajustar esa comprobación.*
39. **P4 · Barra de navegación:** un solo acento azul para las 4 pestañas (hoy azul, azul claro y púrpura), etiquetas legibles, "+" con relieve, barra opaca con blur.
40. **P5 · Saldos:** cabecera con los tres botones del mismo peso y sol/luna en SVG, hero elevado con "PATRIMONIO" como eyebrow, mini-tarjetas tonales sin borde, vencido con anillo rojo, sumas de sección en blanco (no azul), "Agregar cuenta" legible; en claro se quita el halo azul frío.
41. ~~**P6 · Gastos:** franja del mes más baja (44 px) con borde neutro, lista con una sola superficie elevada por día, ícono de categoría 34 px, separador alineado al texto, chip 50/50 en pastilla.~~ ✔ v34.27
42. **P7 · Chips de categoría en las hojas:** rectángulos tonales de 36 px sin halo; la elegida con anillo del color de la categoría; el "+" integrado.
43. **P8 · Botones:** "Guardar" con texto oscuro sobre azul (2,5:1 → 7,3:1 en oscuro, misma convención que el "+"), "Cancelar" con texto y borde.
44. **P9 · Hojas/modales:** superficie plana sin degradado, radio 26, sombra nivel 3, manija neutra, flecha de volver visible en claro, campos más livianos (blancos en claro), hoja de pagar con el importe en texto fuerte y "No descontar" a todo el ancho.
45. **P10 · Pestañas y filtros:** el mismo control segmentado en los dos temas (hoy degradado con glow en oscuro y sólido en claro).
46. **P11 · Tabla del Plan:** cabeceras en eyebrow, rojo apagado en vez de ~20 cifras en rojo saturado, columna fija con hairline en vez de sombra negra, ‹ › que no pisan "Dic".
47. **P12 · Tarjetas:** KPI neutro, "Este mes" con acento por borde en vez de púrpura.
48. **P13 · Agenda:** tiles elevados, contadores legibles, franja de urgencia por dentro (sin desalinear el ícono).
49. **P14 · Compartidos:** cabecera con eyebrow, chips y filas coherentes con Gastos.
50. **P15 · Toast centrado**, color solo en el ícono (hoy fondo entero verde/ámbar/rojo).
51. **P16 · Micro-detalles:** `:focus-visible` global, popovers y banners con la misma elevación.
52. **H1 · Pestañas de Agenda con SVG** en vez de 📋💳🗓️ (las únicas pestañas con emoji).
53. **H2 · Toggle de tema con SVG** (sol/luna) en vez de ☀️/🌙.
54. **H3 · "Liquidar" y los tres tiles de Agenda con SVG** en vez de 💸🔄🔔💳.
55. ~~**Unificar alta y edición de gasto:** mismo orden de campos y etiquetas (hoy Descripción→Monto→Categoría vs Descripción→Categoría→Monto) y monto formateado en edición (hoy `67400`).~~ ✔ v34.27
56. **Hoja de pagar con la misma tarjeta de marca que Saldos** (hoy 🏦 genérico para Galicia/Brubank).
57. **Avatares de letra con colores de la paleta** (hoy marrón/pizarra generados por JS para "S" Seguro, "P" Patente).


### C. UX y funciones (58–96)

58. **Hacer visible "Comparar meses"** (hoy solo manteniendo apretado el mes; nadie lo descubre): ítem en el ⋯ de Gastos o botón en Tendencia.
59. **Avisar cuando un gasto cae en otro mes:** "Guardado en noviembre · Ver".
60. **Hacer tocables "Gasté", "Inversiones" y "Neto proyectado" en Saldos** (hoy no hacen nada).
61. ~~**Validación uniforme** en los 27 menús con una sola función de "campo requerido" (resuelve 23 y 24).~~ ✔ v34.27
62. **Un solo formato de fecha y un verbo por tipo** ("mar, 13 oct"; Próximo cobro / Vence / Próxima cuota) en lista, hojas, Tarjetas y Saldos (resuelve 22, 27).
63. **Tarjetas: "9 rest" → "faltan 9 cuotas · termina jul 2027".**
64. **Ajustes en lenguaje de usuario:** "Mi sincronización / Compartidos con Mile / Avisos" con lo técnico (Bin ID, API Key, VAPID, Worker) en un "Avanzado".
65. **Toast de alta con el nombre del gasto** ("Coto · $ 48.500 guardado") (resuelve 29).
66. **Tocar el chip "US$ 1.300" debería enfocar el campo** (hoy hay que tocar dos veces).
67. **Transferencia entre cuentas propias** ("Mover" en el menú de la cuenta: origen/destino/monto). Hoy hay que editar dos saldos a mano.
68. **✓ de Agenda y "Liquidar" a 44 px**: los dos toques más frecuentes (resuelve parte del 31).
69. **Estado vacío de Compartidos con acción** ("Tocá + y marcá «Compartido»").
70. **El "+" en Agenda ofrece los tres tipos** (Suscripción / Vencimiento / Compra en cuotas) en vez de abrir siempre "Nuevo vencimiento" (resuelve 35).
71. **Comparar "al día 15"** como hace Tendencia (hoy "+265 % vs. septiembre" compara medio mes contra uno entero).
72. **Confirmación + deshacer al borrar cuentas** (hoy solo deshacer; es el borrado con más consecuencias).
73. **Pagar varios meses adeudados de una vez** ("Pagué 3 meses" con un solo deshacer; hoy 3 toques × 2 modales).
74. **Exportar CSV de gastos sin red** (mes/año/todo, con tu parte de los compartidos) reemplazando `exportExcel` muerto.
75. **Presupuesto por categoría con alerta** (tope mensual en el detalle de categoría, "73 % del tope" en la leyenda, toast al 80/100 %), en reemplazo del presupuesto semanal apagado.
76. **Al descompartir un gasto, mandar tombstone** en vez de dejarlo `active:false` para siempre en el bin (ocupa cuota).
77. **"Se repite todos los meses" en el alta de gasto** (crea la suscripción silenciosa; hoy se carga dos veces el primer mes).
78. **Gastos en USD con el TC del día** (chip ARS/USD en el monto; se guarda `amountUsd` + `tcAtDate`, todo lo demás sigue en pesos).
79. **"Octubre en números" / cierre del mes:** hoja con total, top 3 categorías, variación, deuda compartida y botón Copiar para WhatsApp; todo ya está calculado en tres modales distintos.
80. **Cola de toasts y Deshacer múltiple** (hoy un aviso de sync pisa el "Gasto eliminado · Deshacer").
81. **Búsqueda por rango de monto y fecha, filtro `cat:` y "Ver en su mes"** (hoy el monto solo pega exacto y no se puede saltar al contexto).
82. **Adjuntar comprobante (foto comprimida en IndexedDB, local)** a gastos y transferencias.
83. **Nombres de la pareja configurables** (hoy "Fede"/"Mile" hardcodeados en ~60 sitios).
84. **Etiquetas libres (#viaje, #mudanza)** con total por etiqueta, cruzando categorías.
85. **Liquidación guiada** (Todo / Mitad / Redondear) y recordatorio de deuda vieja en Saldos.
86. **Plan: cobrar/pagar desde meses pasados y cobro parcial** (sueldo en dos partes, aguinaldo).
87. **Pantalla "Archivo"** en Ajustes (N gastos archivados desde MM/AAAA, exportar, traer un mes de vuelta) y aviso de almacenamiento con nombres humanos.
88. **Plan: ver el año entero** (toggle 6/12 columnas y fila "Acumulado").
89. **Plan: escenarios "¿y si…?"** (duplicar el Plan y comparar el Neto a 12 meses).
90. **Plan: regla de aumento "sube X % cada N meses"** por concepto (alquiler, expensas, prepaga).
91. **Plan: meta de ahorro mensual** con alerta cuando el Resultado proyectado cae por debajo.
92. **Plan: exportar CSV / compartir como imagen.**
93. **Plan: historial proyectado vs. real** (foto del Resultado al cerrar cada mes).
94. **Agenda: períodos bimestral / trimestral / semanal reales** (resuelve 5 de raíz).
95. **Plan: importe del mes en curso editable** (hoy `readOnly`).
96. **Plan: "?" junto a "Resultado del mes"** que explique la fórmula.


Notas sobre el estado real tras v34.26:
- 94 quedó cubierto por el arreglo del bug 5 (cadencia `everyN`); falta solo
  el período semanal si se quiere.
- 61 y 23/24: los menús ya validan vacío tras los bugs 23/24; 61 sería solo
  unificar en una función.
- 31/68: los tocables chicos del bug 31 ya se agrandaron; 68 (44 px exactos
  para ✓ y Liquidar) sigue abierto.

## Cómo aplicar lo visual

Orden sugerido: P1 → P2 → P3 → P8+P9 → P4 → P5/P6/P7 → P10 → P13/P14 →
P11/P12 → P15/P16 → H1–H3. Pegar cada bloque al final del `<style>` de
`index.html` (o integrarlo en los tokens existentes), subir `APP_VERSION` y
`version.json`, y validar con `node tests.js` y a12, a20, a23, a25, a31
(a12 comprueba el rojo del total del día: P3 lo pasa a gris, ajustar el test).
