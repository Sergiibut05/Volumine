# Volumine

Gráficas 3D interactivas que se incrustan en cualquier sitio con un link.

> El producto es **el link**, no el editor.

## Estado

Fase 0 — fundaciones. Todavía no hay código de producción.
Estado real y siguiente paso: **[`docs/STATE.md`](docs/STATE.md)**.

## Documentación

| Documento | Qué contiene |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Qué es el producto, para quién, y qué **no** es |
| [`docs/chart-config-schema.md`](docs/chart-config-schema.md) | El contrato `ChartConfig`. El documento más importante del repo |
| [`docs/PERFORMANCE-BUDGET.md`](docs/PERFORMANCE-BUDGET.md) | Presupuesto del embed. Se comprueba en CI y falla el build |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Dirección de arte y listón de accesibilidad |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Fases secuenciales, con criterio de salida cada una |
| [`docs/adr/`](docs/adr/) | Decisiones de arquitectura cerradas y por qué |
| [`docs/STATE.md`](docs/STATE.md) | Dónde estamos ahora mismo |

## Stack

Next.js (App Router) · TypeScript · React Three Fiber + three · Supabase ·
Vercel · Tailwind v4 · Vitest + Playwright.

Los porqués están en `docs/adr/`.
