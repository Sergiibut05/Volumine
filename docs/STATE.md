# Estado actual

> **Este archivo es el mecanismo de continuidad entre sesiones.** Una sesión
> nueva no recuerda nada: lo primero que hace es leer esto. Manténlo actualizado
> con `/state` al terminar cualquier bloque de trabajo. Si está desfasado, la
> siguiente sesión trabaja a ciegas.
>
> Sé concreto. "Avanzando en el renderer" no vale. "El bevel se autointersecta
> cuando el ángulo del segmento baja de 12°, ver prototypes/donut.html:140" sí.

---

**Última actualización:** 2026-08-04
**Fase actual:** 0 — Fundaciones → arrancando Fase 1

## Qué hay hecho

- Documentación fundacional completa: `PRD.md`, `chart-config-schema.md`,
  `PERFORMANCE-BUDGET.md`, `DESIGN.md`, `ROADMAP.md`, ADRs 0001-0005.
- Configuración de Claude Code: permisos, hook de formato, subagentes
  `webgl-perf-reviewer` y `design-critic`, comandos `/state` y `/perf`, skill
  `add-chart-type`.
- Repo git inicializado. Sin código de producción todavía.

## Qué toca ahora

Fase 1 del roadmap: prototipo desechable del donut 3D en `prototypes/`.
Objetivo único: validar que el canto redondeado y el material quedan como la
referencia. Nada de Next, nada de React, nada de build.

## Decisiones pendientes de Manuel

- [ ] Confirmar el nombre "Voluma" (o proponer otro) y renombrar la carpeta.
- [ ] Dominio, cuando el nombre esté cerrado.
- [ ] Validar visualmente el prototipo de Fase 1 antes de pasar a Fase 2.

## Problemas conocidos

Ninguno todavía.

## Notas para la próxima sesión

- El proyecto es **gratis por ahora**, pero el esquema de datos debe soportar
  planes y cuotas desde el principio (ver PRD).
- Manuel está aprendiendo React por su cuenta; no hace falta frenar el ritmo
  para enseñar, pero el código debe ser legible y idiomático, no ingenioso.
- La carpeta se llama `3d-web-chart` por accidente histórico; el producto es
  Voluma.
