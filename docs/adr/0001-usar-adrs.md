# ADR 0001 — Registrar las decisiones de arquitectura

**Fecha:** 2026-08-04 · **Estado:** aceptada

## Contexto

El proyecto lo desarrollan sesiones de trabajo que no comparten memoria entre
sí. Sin un registro escrito, cada sesión reabre decisiones ya cerradas o las
contradice sin darse cuenta.

## Decisión

Toda decisión que sea cara de revertir se escribe como ADR en `docs/adr/`,
numerada, corta (media página), con contexto, decisión y consecuencias. Las ADR
no se editan una vez aceptadas: se **superan** con una nueva que referencia a la
anterior y cambia su estado a `superada por NNNN`.

Estados: `propuesta` · `aceptada` · `superada por NNNN` · `descartada`.

## Consecuencias

- Cualquier sesión puede leer `docs/adr/` y saber por qué el proyecto es como es.
- Cambiar de opinión cuesta escribir un documento. Es el objetivo.
