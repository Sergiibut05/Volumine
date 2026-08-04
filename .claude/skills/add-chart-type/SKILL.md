---
name: add-chart-type
description: Procedimiento completo para añadir un tipo de gráfica nuevo a Voluma (barras, bar race, globo...). Úsalo siempre que haya que crear un tipo nuevo; añadir uno toca esquema, renderer, editor, embed, tests y docs, y saltarse un paso deja el producto incoherente.
---

# Añadir un tipo de gráfica

Añadir un tipo no es "escribir una geometría nueva": atraviesa el esquema, el
renderer, el editor, el embed, los tests y la documentación pública. Este es el
orden y no debe alterarse — cada paso depende del anterior.

**Antes de empezar**, lee `docs/chart-config-schema.md` y `docs/adr/0004-*`.

## 1. Diseñar el contrato, antes que el código

Decide qué campos de `ChartConfig` necesita el tipo nuevo y **qué campos
existentes reutiliza**. Reutilizar es lo correcto por defecto: si el tipo nuevo
necesita `style.cornerRadius` y ya existe, se usa ese, no se inventa
`style.barCornerRadius`.

Si hace falta un campo nuevo:

- Debe ser **opcional** con default en `src/lib/config/defaults.ts`.
- Solo se puede añadir, nunca renombrar ni cambiar el significado de uno
  existente. Eso obliga a subir `v` y escribir migración.
- Documéntalo en `docs/chart-config-schema.md` **antes** de implementarlo.

Decide también qué forma de `data` acepta: ¿una serie o varias? ¿Qué hace con
valores negativos, ceros, nulos y series de distinta longitud? Escríbelo. Estos
casos son los que rompen el embed de un cliente un martes por la tarde.

## 2. Esquema y validación

Extiende el discriminador `type` en `src/lib/config/schema.ts` (Zod). Añade la
validación específica del tipo. Tests unitarios de:

- config mínimo válido → pasa y produce defaults sensatos
- casos límite decididos en el paso 1 → se sanean, no revientan
- config del tipo antiguo → sigue validando (no rompes nada)

## 3. Geometría, aislada y sin React

En `src/renderer/geometry/<tipo>.ts`, funciones puras: entran parámetros, sale
`BufferGeometry`. **Sin React, sin three.js de escena, sin estado.** Así se
pueden testear y memoizar.

Reglas de la ADR 0004:
- Memoiza por los parámetros que afectan a la forma, no por el objeto config.
- Cuida normales y UVs; un bevel con normales mal calculadas se ve barato.
- Cuidado con ángulos/tamaños degenerados: el bevel se autointersecta y aparecen
  artefactos. Define y testea el mínimo.
- Si va a haber muchos elementos, `InstancedMesh` desde el principio.

## 4. Componente de renderer

`src/renderer/charts/<Tipo>Chart.tsx`, consumiendo la config ya validada.
Regla no negociable: **misma config → mismos píxeles**. Sin aleatoriedad sin
sembrar, sin leer el reloj fuera de la animación.

Implementa todo lo que declaraste soportar en `style`, `scene`, `camera`,
`motion`, `labels`, `interaction`. Un campo declarado y no implementado es un
bug de contrato.

Registra el tipo en el mapa de `src/renderer/index.ts`.

## 5. Página de desarrollo

Añádelo a `/dev/renderer` con controles para **todos** sus campos. Es donde se
prueba a mano y donde se ven los casos raros. No lo dejes para el final.

## 6. Embed

Comprueba que el tipo nuevo no arrastra peso al bundle del embed. Ejecuta
`npm run perf:embed`. Si lo rompe, la solución es cargar el tipo con `import()`
dinámico por `type`, no subir el presupuesto.

Genera y comprueba: póster estático, fallback sin WebGL, `aria-label` y tabla de
datos accesible del tipo nuevo.

## 7. Editor

Panel de datos adecuado a la forma de `data` del tipo (una serie o varias).
Controles de personalización para sus campos específicos. Miniatura en el
selector de tipo. Un preset bonito por defecto: **el estado inicial ya tiene que
ser presentable**.

## 8. Temas

Comprueba el tipo nuevo con **todos** los temas existentes y en claro y oscuro.
Un tema pensado para donuts puede quedar horrible en barras. Si alguno queda
mal, se ajusta el tema, no se excluye el tipo.

## 9. Tests

- Unitarios de geometría y de esquema.
- Regresión visual con Playwright: al menos 3 configs (mínima, completa, límite).
- Test del embed con el tipo nuevo dentro de un iframe con `sandbox`.

## 10. Documentación

- `docs/chart-config-schema.md`: los campos nuevos (si no lo hiciste en el paso 1).
- Docs públicas de la API de config-en-URL.
- Un ejemplo en la galería con su link de embed.
- `docs/STATE.md` y `docs/ROADMAP.md` (`/state`).

## Antes de darlo por hecho

- [ ] `npm run lint` y `npm run test` en verde
- [ ] `npm run perf:embed` dentro de presupuesto
- [ ] Revisado por el subagente `design-critic`
- [ ] Los links de embed publicados con configs antiguas siguen funcionando
