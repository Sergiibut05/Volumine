# Volumine

Embeds de gráficas 3D interactivas. El producto es **el link**, no el editor.

Antes de trabajar lee `docs/STATE.md` (dónde estamos) y `docs/ROADMAP.md` (qué toca).
Las decisiones cerradas están en `docs/adr/` — no las revisites sin motivo nuevo.

## Las 3 reglas duras

1. **La ruta `/embed` es sagrada.** Sin cookies, sin localStorage, sin auth, sin
   analytics de terceros, sin fuentes remotas. Presupuesto en
   `docs/PERFORMANCE-BUDGET.md`. Si un cambio lo rompe, el cambio no entra.
2. **La config de gráfica sigue `docs/chart-config-schema.md`.** Está versionada
   (`v`). Cambiar el esquema = subir versión + escribir migración. Nunca romper
   links publicados.
3. **Nada de librerías de gráficas 3D** (echarts-gl, highcharts-3d, plotly).
   La geometría es propia: es el diferenciador visual del producto.

## Stack

- Next.js (App Router) + TypeScript estricto · React Three Fiber + drei + three
- Supabase (Postgres + RLS + Auth) · Vercel
- Tailwind v4 + tokens propios · zustand para estado del editor
- Vitest (unit) + Playwright (e2e y capturas del embed)

## Comandos

```bash
npm run dev          # app en :3000
npm run build        # build de producción
npm run test         # vitest
npm run test:e2e     # playwright
npm run lint         # eslint + tsc --noEmit
npm run perf:embed   # mide el bundle de /embed contra el presupuesto
```

## Convenciones

- **Colores**: siempre desde tokens (`src/styles/tokens.css`). Ningún hex suelto
  en componentes. Los temas de gráfica viven en `src/lib/themes/`.
- **Three.js**: geometrías y materiales se crean **fuera** del render loop y se
  `dispose()` al desmontar. Nada de `new THREE.*` dentro de `useFrame`.
  Ver skill `three-best-practices`.
- **Estado**: el editor usa un único store con la `ChartConfig` como fuente de
  verdad. El renderer es una función pura de `ChartConfig` — mismo config, mismo
  píxel. Esto es lo que hace posible el render estático y los tests visuales.
- **Imports**: alias `@/` → `src/`.
- **Nombres**: componentes en `PascalCase.tsx`, resto en `kebab-case.ts`.

## Cómo trabajamos

- Un cambio = un incremento verificable. Si toca 3D, la verificación incluye
  captura de pantalla real, no solo "compila".
- Al terminar un bloque de trabajo, **actualiza `docs/STATE.md`** (`/state`).
  Es lo único que permite continuar en la siguiente sesión.
- Decisión de arquitectura nueva → ADR en `docs/adr/`, corto.
- Producto gratuito hoy, pero **nada debe impedir cobrar mañana**: modela plan y
  cuotas en el esquema desde el principio, aunque todo sea `free`.

## Listón de calidad

La app y el marketing van a nivel Awwwards (ver `docs/DESIGN.md`). El embed va a
nivel "no se nota que existe": rápido, silencioso, sin saltos de layout.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
