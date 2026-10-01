# Finanzas — notas para Claude

## Git y PRs

- **Antes de cada push y antes de sumar commits a un PR, verificar si el PR de
  la rama ya se mergeó** (`git fetch origin main` y mirar el estado del PR en
  GitHub). Los PRs se mergean con squash, así que un PR mergeado no puede
  recibir más cambios: lo que se suba después queda afuera de main.
- Si ya se mergeó: traer `origin/main` a la rama (merge, sin force-push) y
  abrir un PR nuevo para lo que falte. Nunca reutilizar el PR mergeado.
