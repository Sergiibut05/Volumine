---
description: Actualiza docs/STATE.md con el estado real del proyecto ahora mismo
allowed-tools: Read, Edit, Write, Bash(git status:*), Bash(git log:*), Bash(git diff:*), Glob, Grep
---

Actualiza `docs/STATE.md` para que refleje el estado real del proyecto en este
momento. Es el único mecanismo de continuidad entre sesiones: si queda
desfasado, la siguiente sesión trabaja a ciegas.

Antes de escribir, comprueba la realidad — no te fíes de lo que creas recordar:

1. `git log --oneline -15` y `git status` para ver qué se ha movido de verdad.
2. Lee el `docs/STATE.md` actual.
3. Contrasta con `docs/ROADMAP.md`: ¿qué casillas se pueden marcar ya?

Luego reescribe `docs/STATE.md` con:

- **Fecha y fase actual.**
- **Qué hay hecho**: solo lo que existe y funciona. Nada aspiracional.
- **Qué toca ahora**: la siguiente acción concreta, con archivo si aplica.
- **Decisiones pendientes de Manuel**: lo que está bloqueado esperándole.
- **Problemas conocidos**: bugs, callejones sin salida, cosas que no cuadran.
  Con archivo y línea. Esto es lo más valioso del documento — un problema que
  se descubre dos veces es tiempo tirado.
- **Notas para la próxima sesión**: contexto que no se deduce del código.

Marca también en `docs/ROADMAP.md` las casillas realmente completadas.

Sé específico y honesto. "Avanzando en el renderer" no vale. Si algo está a
medias, di qué mitad y qué falta. Si algo no funciona, dilo — un STATE.md
optimista es peor que no tener ninguno.

$ARGUMENTS
