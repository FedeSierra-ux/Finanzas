# Mis Finanzas

App personal de finanzas para dos personas, en pesos argentinos. PWA de un solo
archivo, sin build, sin dependencias que instalar: se edita `index.html` y se
pushea.

Gastos por categoría, saldos de cuentas en ARS y USD, agenda de vencimientos y
suscripciones, presupuesto semanal, proyección mensual, gastos compartidos con
liquidación de deuda, y un asistente en lenguaje natural.

## Cómo correrlo

No hay `npm install` ni bundler. Alcanza con servir la carpeta por HTTP:

```bash
python3 -m http.server 8000
# http://localhost:8000/index.html
```

Tiene que ser por HTTP, no abriendo el archivo con doble clic: el service worker
y varias APIs del navegador no funcionan sobre `file://`.

Los tests son de funciones puras y corren en Node sin dependencias:

```bash
node tests.js
```

## Despliegue

GitHub Pages sirve la rama `main` en `https://<usuario>.github.io/Finanzas/`.
Pushear a `main` publica. No hay pipeline de build.

**La ruta base `/Finanzas/` está hardcodeada en `sw.js`** (en `SHELL`, `ASSETS` y
los handlers de `fetch`). Si el repo se renombra o se sirve desde otro path, hay
que actualizar esas rutas o el service worker deja de cachear.

## Versionado y actualizaciones

`APP_VERSION` en `index.html` es la única fuente de verdad. Hay que subirla en
cada cambio que se quiera publicar.

El service worker se registra con la versión en el query string:

```js
navigator.serviceWorker.register('./sw.js?v=' + APP_VERSION, {scope:'./', updateViaCache:'none'})
```

y `sw.js` la lee de ahí para armar el nombre del cache:

```js
const _swVersion = new URL(self.location.href).searchParams.get('v') || '0';
const CACHE = 'finanzas-v' + _swVersion;
```

Esto es a propósito: el navegador trata `sw.js?v=30.14` y `sw.js?v=30.15` como
workers distintos, así que subir `APP_VERSION` fuerza la instalación de uno nuevo,
que crea un cache nuevo y borra los viejos en su `activate`. Sin el query string
habría que acordarse de cambiar el nombre del cache a mano en `sw.js` cada vez —
y olvidarse significa servir la versión vieja indefinidamente.

En iOS la actualización no siempre aparece sola. Por eso Ajustes tiene un botón
**Buscar actualización** que fuerza el chequeo.

### Estrategias de cache

| Recurso | Estrategia | Por qué |
|---|---|---|
| `index.html` | network-first, cache de respaldo | Que una versión nueva llegue apenas está |
| `assets/*.jpg` | cache-first, cache propio | Inmutables; si cambian, cambia el nombre del archivo |
| Google Fonts | cache-first, cache propio | Inmutables |

El cache de assets (`finanzas-assets-v1`) sobrevive a los cambios de versión: los
logos no se vuelven a bajar en cada actualización.

## Estructura

```
index.html      La app entera: markup, CSS y JS
sw.js           Service worker: cache offline, notificaciones, cola en IndexedDB
tests.js        165 tests de funciones puras (node tests.js)
assets/         Logos de bancos y servicios
*-preview.html  Maquetas viejas de UI, no forman parte de la app
```

`index.html` es intencionalmente un solo archivo — evita el build y hace que la
app sea un artefacto que se puede guardar y abrir. La contra es el tamaño: hay un
trabajo en curso de extraer componentes a clases para achicarlo.

Los logos viven en `assets/` y no embebidos en base64: antes eran 360 kb dentro
del HTML que se volvían a descargar enteros en cada actualización.

## Datos y persistencia

Todo vive en `localStorage`, con `fin_v6` como clave principal (gastos, cuentas,
agenda, plan).

`localStorage` es frágil: se llena y los navegadores lo descartan antes que a
IndexedDB. Por eso las claves de `MIRRORED_STORAGE_KEYS` se espejan en IndexedDB
vía `window.AppStorage`, y al arrancar `hydrateLocalStorage()` restaura las que
falten. **localStorage siempre manda**: solo se restaura lo que no está, así que
el espejo nunca puede pisar datos más nuevos con una copia vieja.

Toda escritura de una clave espejada tiene que pasar por `persistJsonStorage()`,
que escribe en los dos lados. Escribir con `localStorage.setItem()` directo deja
el espejo desactualizado.

Alcance del espejo, sin vender humo: en iOS, si la PWA **no** está instalada en la
pantalla de inicio, Safari borra a los 7 días de inactividad todo el
almacenamiento del sitio, IndexedDB incluido. Contra eso el espejo no alcanza —
por eso se pide `navigator.storage.persist()` al arrancar. El espejo sí cubre lo
que pasa más seguido: cuota llena, limpiezas parciales, y datos corruptos de un
solo lado.

## Sincronización

Dos dispositivos se sincronizan contra [JSONBin](https://jsonbin.io). Cada uno
configura su Bin ID y su API Key en Ajustes → Sincronización.

- **Bin propio**: el payload completo. Auto-push con debounce, pull al abrir.
- **Bin compartido**: solo gastos compartidos, bidireccional entre las dos personas.

El plan gratuito de JSONBin corta en **100 kb por bin**. `syncPush()` mide el body
serializado y corta antes de salir a la red si se pasa, mostrando qué claves
ocupan lugar; al superar el 90% del cupo avisa aunque el push haya salido bien.
`fin_action_history` no se sincroniza a propósito: es un log local que solo se
escribe y llegó a ocupar 40 de los 98 kb del payload.

Los conflictos no se resuelven solos. Si la nube viene de otro dispositivo o de la
otra persona y hay datos locales, se muestra un banner de conflicto en vez de
aplicar el payload. Esta parte tuvo bugs que borraron datos en silencio; los
chequeos redundantes de `syncPull()` están puestos a propósito.

## Notificaciones

Los vencimientos se encolan en IndexedDB (`fin_notifs_v1`) y el service worker los
dispara desde `fireDueNotifs()`, que corre en su `activate` y en `periodicsync`.

Esa función va en tres etapas separadas —leer, notificar, borrar— y no en una sola
transacción. Las transacciones de IndexedDB se auto-cierran apenas el control
vuelve al event loop, así que un `await showNotification()` adentro de la
transacción la mata y el `delete` posterior falla en silencio: el aviso nunca sale
de la cola y se repite en cada arranque. Si se toca esa función, mantener las
etapas separadas.

## Convenciones

- Sin framework, sin build, sin dependencias en runtime salvo SheetJS por CDN
  para importar Excel.
- Los ids se generan con `crypto.randomUUID()`. Importa: el merge del sync es por
  id, y con ids cortos una colisión hace desaparecer un registro sin ruido.
- Los montos se guardan como números enteros en pesos. `eAmt(g)` devuelve lo que
  te tocó a vos de un gasto compartido; `toARS(a)` convierte una cuenta a pesos.
- Comentar el *por qué*, no el *qué* — sobre todo en el sync y en el service
  worker, donde varias decisiones raras son cicatrices de bugs concretos.
