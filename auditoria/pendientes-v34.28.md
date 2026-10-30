# Estado tras la v34.28 (30/10/2026)

Auditoría exhaustiva de la v34.27: `INFORME-v34.27.md` (IDs A, B, C y D). El
usuario eligió ID por ID con una página de Sí/No; lo que sigue es el resultado.

## Entró en la v34.28

- **A** (todos): A1–A25 (A10b = aviso visible de copias; A10 = copias en gzip).
- **B** (todos menos B7): B1–B6, B8–B15. B7 queda pendiente (ver abajo).
- **C**: C2, C4 (solo el toast con la categoría, la lógica con Enter no cambia),
  C6, C7, C8, C10, C11, C12, C13, C14, C16, C17.
- **D**: D3 (deshacer en Compartidos), D4 (aviso de pago duplicado), D5 (¿Quién sos?).
- Decisiones: B1–B3 "validar y avisar qué se descartó"; A10 "copias comprimidas".
- Nuevos scripts: `a34`–`a40` (README).

## Dijo que NO (no volver a proponer sin que lo pida)

C1 (piso de 11 px, pidió preview), C5 (onboarding), C9 (Escape en escritorio),
D1, D2, D6, D7, D8, D9, D10, D11, D12, D13, D14.

## Pendiente

- **B7 (Worker de push)**: requiere cambiar el Worker, que no está en el repo.
  Plan en dos pasos: el Worker acepta `X-App-Token` y una access key de JSONBin
  además de lo actual; después la app genera el token, lo manda y deja de
  mandar la master key a `/register`.
- **C3, C15 y los ítems 43, 68, 63, 46, 38, 42, 50, 51, 69, 64, 80, 59, 83,
  67, 73, 77, 90, 86, 72**: sin responder. Hay un preview antes/después:
  https://claude.ai/artifact/6aNgeYmSiHZNPLYrLk6M6Q (C1 también está ahí).
  Salvedades del preview: C3 y 43 se superponen; a 11 px la grilla de
  categorías del alta pasa a 3 columnas; 38 hay que excluir `#dtag` y ajustar
  a12; 72 ya existe desde la v34.26 (confirmación y deshacer).
- Decisiones de los agentes que conviene revisar con el usuario:
  - TC ±30 %: solo en el refresco automático, no en ↻ manual.
  - Aviso de pago duplicado: solo lo ve quien cargó el pago más nuevo; los
    pagos anteriores a esta versión no tienen `by` y no se detectan.
  - A15: el `paidBy` faltante se completa con 'fede' (determinístico).
  - A8: tolera 1 día de retroceso; quien abre la app tras > 60 días ve el
    aviso una vez aunque la fecha sea correcta.
  - A21: se quitó la coincidencia inversa de las reglas aprendidas.
  - Casilla `#ag-addplan` de Agenda: 24 px (se tilda tocando toda la etiqueta).
  - `ov-shared-restore` ("Copias de compartidos") sigue con el estilo viejo.
- Menores que quedaron: modal `ov-fund-adjust` y sus funciones sin uso,
  `window.AppRender` sin definir, `numParaInput` sin usos, fuentes de Google
  sin autoalojar, `fin_cat_ico_*` solo la clave de comida.
