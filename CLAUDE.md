# Finanzas — notas para Claude

## Git y PRs

- **Antes de cada push y antes de sumar commits a un PR, verificar si el PR de
  la rama ya se mergeó** (`git fetch origin main` y mirar el estado del PR en
  GitHub). Los PRs se mergean con squash, así que un PR mergeado no puede
  recibir más cambios: lo que se suba después queda afuera de main.
- Si ya se mergeó: traer `origin/main` a la rama (merge, sin force-push) y
  abrir un PR nuevo para lo que falte. Nunca reutilizar el PR mergeado.

## Forma de trabajar

- **Código**: editar solo lo necesario; nada de reescribir archivos enteros
  salvo que cambie más del 80%; no sumar abstracciones ni funciones que no se
  pidieron.
- **Archivos**: no releer lo que ya se leyó; leer solo la sección que hace
  falta; no mostrar el código de un archivo que ya se editó o creó.
- **Ejecución**: validar antes de dar algo por terminado (`node tests.js` y los
  scripts de `auditoria/` que toquen lo cambiado); correr en paralelo las
  llamadas independientes; no usar un agente cuando alcanza con Grep/Read; si
  algo parece raro, decirlo en una oración y seguir.
- **Confirmar antes de suponer** o de hacer cambios que no se pidieron.
- **Revisar la memoria del proyecto** (este archivo y `auditoria/`) antes de
  empezar a trabajar.
- **Al hacer cambios en la app**: subir la versión (`APP_VERSION` en
  `index.html`; el service worker la toma de ahí) y abrir un PR nuevo con los
  cambios.
