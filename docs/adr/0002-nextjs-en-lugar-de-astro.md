# ADR 0002 — Next.js (App Router) en lugar de Astro

**Fecha:** 2026-08-04 · **Estado:** aceptada

## Contexto

Tres superficies con necesidades muy distintas: marketing (estático, SEO,
espectacular), editor (SPA pesada con WebGL y estado complejo) y embed
(mínimo absoluto, sin estado, dentro de páginas ajenas).

Astro brilla enviando cero JS en páginas de contenido. El editor es lo contrario
de una página de contenido, y el embed no se beneficia de islas porque _todo_ él
es la isla.

## Decisión

Next.js App Router, un solo repo, desplegado en Vercel. Las tres superficies se
separan con route groups:

```
app/(marketing)/...   estático, prerenderizado
app/(app)/...         editor, cliente, autenticado
app/embed/[id]/...    embed, sin auth, sin providers globales
```

Regla crítica: **`app/embed` no comparte layout raíz con el resto**. Nada de
providers, temas, auth o analytics globales que le caigan encima por herencia.
Su `layout.tsx` es propio y mínimo.

## Alternativas descartadas

- **Astro para marketing + Next para app**: dos builds, dos deploys, tokens y
  componentes duplicados. El coste de mantenimiento supera al ahorro de KB en
  unas pocas páginas.
- **Vite + React Router puro**: pierdes SSR/prerender del marketing y la OG
  image del embed, que es marketing gratis.

## Consecuencias

- Un solo sistema de tokens y componentes para las tres superficies.
- Riesgo real: es fácil que dependencias globales se filtren al embed por
  descuido. Se mitiga con el presupuesto automatizado (`npm run perf:embed`)
  que falla el build.
- Si el marketing acaba siendo mucho más grande de lo previsto, se puede extraer
  a Astro después sin tocar app ni embed.
