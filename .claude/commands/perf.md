---
description: Audita la ruta /embed y el código 3D contra el presupuesto de rendimiento
allowed-tools: Task, Read, Bash(npm run:*)
---

Lanza el subagente `webgl-perf-reviewer` para auditar el estado actual contra
`docs/PERFORMANCE-BUDGET.md`.

Dale en el prompt: qué se ha tocado desde la última auditoría (mira `git log` si
hace falta), y en qué debe centrarse si hay algo concreto en `$ARGUMENTS`.

Cuando responda, resúmeme solo lo que requiere acción, con los números. Si algo
rompe el presupuesto, no lo arregles todavía: dime qué es y cuánto cuesta antes
de tocar nada.
