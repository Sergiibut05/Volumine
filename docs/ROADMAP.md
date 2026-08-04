# Roadmap

Fases secuenciales. **No se empieza una fase sin cerrar la anterior.** Cada fase
termina en algo que se puede enseñar y que funciona de verdad.

---

## Fase 0 — Fundaciones ✅

Documentación, ADRs, configuración de Claude Code, git.

---

## Fase 1 — Prototipo desechable

**Objetivo:** demostrar que el aspecto de la referencia es alcanzable, antes de
invertir en arquitectura.

Un solo archivo HTML, sin build, sin framework:

- [ ] Sector anular extruido con bevel; el redondeo de canto se ve bien
- [ ] N segmentos con separación, colores y grosor parametrizables
- [ ] Rotación automática suave
- [ ] Hover por segmento con realce
- [ ] Iluminación que hace que se vea caro

**Criterio de salida:** una captura que a ti te guste. Si el bevel no queda
bien, el proyecto entero se replantea aquí, que es donde es barato.

Este archivo **se tira** después. Vive en `prototypes/`, nunca en `src/`.

---

## Fase 2 — El renderer

**Objetivo:** una función pura `ChartConfig → escena three`, sin editor ni BBDD.

- [ ] Scaffolding Next + TS + Tailwind + estructura de rutas de la ADR 0002
- [ ] Esquema Zod de `ChartConfig` + defaults + tests
- [ ] Sistema de tokens y temas
- [ ] Renderer de donut/pie completo (todos los campos de `style`, `scene`,
      `camera`, `motion`, `labels`)
- [ ] Página `/dev/renderer` con controles para probarlo todo a mano
- [ ] Tests de regresión visual con Playwright

**Criterio de salida:** cualquier `ChartConfig` válido se pinta correctamente.

---

## Fase 3 — El embed

**Objetivo:** lo que da valor al producto. Antes que el editor, a propósito.

- [ ] Ruta `/embed?c=...` con config comprimida en URL
- [ ] Layout propio y mínimo (ADR 0005)
- [ ] Póster estático + `IntersectionObserver` + liberación de contexto WebGL
- [ ] Fallback sin WebGL y `?static=1`
- [ ] Tabla de datos accesible + `aria-label`
- [ ] `postMessage`: auto-altura, tema, click
- [ ] Cabeceras `frame-ancestors *`, sin `X-Frame-Options`
- [ ] `npm run perf:embed` con fallo de build al pasarse del presupuesto
- [ ] Probado de verdad dentro de Notion y de un HTML con `sandbox`

**Criterio de salida:** una URL que pegas en Notion y funciona, dentro de
presupuesto.

---

## Fase 4 — El editor

- [ ] Store con `ChartConfig` como fuente de verdad
- [ ] Entrada de datos: tabla editable + pegar desde Excel/Sheets + CSV
- [ ] Paneles de personalización (todos los campos del esquema)
- [ ] Selector de temas con transición animada
- [ ] Vista previa en vivo
- [ ] Deshacer/rehacer
- [ ] Diálogo de compartir: link, snippet iframe, PNG

**Criterio de salida:** se hace una gráfica bonita sin tocar JSON.

---

## Fase 5 — Cuentas y persistencia

- [ ] Supabase: esquema, RLS, migraciones (con `plan` y cuotas ya modelados)
- [ ] Auth (Google + magic link)
- [ ] Guardar / listar / duplicar / borrar gráficas
- [ ] `/embed/{id}` desde BBDD
- [ ] Tests de las políticas RLS
- [ ] Generación de póster estático y OG image en servidor

**Criterio de salida:** cierras el navegador y tu gráfica sigue ahí.

---

## Fase 6 — Barras 3D

El tipo que sostiene los casos de uso reales. Se hace **siguiendo la skill
`add-chart-type`**, que se escribió para esto.

---

## Fase 7 — Marketing y lanzamiento

- [ ] Landing nivel Awwwards con hero 3D en vivo (`docs/DESIGN.md`)
- [ ] Galería de ejemplos, cada uno con su link de embed
- [ ] Docs de la API de config-en-URL
- [ ] Guías de Notion / Confluence / Webflow / Framer
- [ ] Alta en Iframely
- [ ] Lanzamiento

---

## Backlog (no comprometido)

Bar race animado · globo/mapa 3D · datos en vivo (Sheets/CSV/endpoint) ·
dominios propios · exportación a vídeo/GIF · equipos · plantillas de la
comunidad.
