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

- [x] Sector anular extruido con bevel; el redondeo de canto se ve bien
- [x] N segmentos con separación, colores y grosor parametrizables
- [x] Rotación automática suave
- [x] Hover por segmento con realce
- [x] Iluminación que hace que se vea caro

**Criterio de salida:** una captura que a ti te guste. Si el bevel no queda
bien, el proyecto entero se replantea aquí, que es donde es barato.

Este archivo **se tira** después. Vive en `prototypes/`, nunca en `src/`.

---

## Fase 2 — El renderer ✅

**Objetivo:** una función pura `ChartConfig → escena three`, sin editor ni BBDD.

- [x] Scaffolding Next + TS + Tailwind + estructura de rutas de la ADR 0002
- [x] Esquema Zod de `ChartConfig` + defaults + tests
- [ ] Sistema de tokens y temas
- [x] Renderer de donut/pie completo (todos los campos de `style`, `scene`,
      `camera`, `motion`, `labels`)
- [x] Página `/dev/renderer` con controles para probarlo todo a mano
- [ ] Tests de regresión visual con Playwright

**Criterio de salida:** cualquier `ChartConfig` válido se pinta correctamente.

---

## Fase 3 — El embed ✅

**Objetivo:** lo que da valor al producto. Antes que el editor, a propósito.

- [x] Ruta `/embed?c=...` con config comprimida en URL
- [x] Layout propio y mínimo (ADR 0005)
- [x] `IntersectionObserver` + liberación del contexto WebGL al salir de vista
- [ ] Póster estático (render en servidor) — el hueco más visible que queda
- [x] Detección de WebGL; sin él se ve la tabla de datos
- [ ] `?static=1` para forzar imagen sin WebGL
- [x] Tabla de datos accesible + `aria-label`
- [x] `postMessage`: auto-altura, tema, click
- [x] Cabeceras `frame-ancestors *`, sin `X-Frame-Options`
- [x] `npm run perf:embed` con fallo de build al pasarse del presupuesto
- [x] Probado dentro de un iframe con `sandbox` (`/dev/embed`)
- [ ] Probado dentro de Notion y de Confluence de verdad — hace falta un
      dominio público, así que va después del despliegue

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

- [x] Supabase: esquema, RLS, migraciones (con `plan` y cuotas ya modelados)
- [x] Auth (Google + magic link)
- [x] Guardar / listar / duplicar / borrar gráficas
- [x] `/embed/{slug}` desde BBDD, anónimo y sin cookies
- [x] Tests de las políticas RLS — **escritos pero nunca ejecutados**, ver abajo
- [ ] Generación de póster estático y OG image en servidor

Los permisos los decide Postgres y no el servidor de Next (ADR 0007): el código
de la aplicación no lleva ni una comprobación de propiedad escrita a mano.

**Falta para poder cerrar la fase:**

1. Aplicar `supabase/migrations/0001_charts.sql` al proyecto.
2. Poner `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ver
   `.env.example`), y activar Google y el magic link en Supabase → Auth.
3. **Ejecutar `rls.test.ts` contra una rama de Supabase.** Están escritos con
   cuidado pero no se han corrido nunca: hasta que pasen, las políticas son una
   intención, no un hecho.

**Criterio de salida:** cierras el navegador y tu gráfica sigue ahí.

---

## Fase 6 — El resto de tipos ✅

- [x] Barras 3D
- [x] Barras animadas (bar race). Las series se leen como periodos, así que no
      hizo falta tocar el esquema.
- [x] Globo de puntos, con el planteamiento de cobe: la tierra es una nube de
      puntos y **sí se reconocen los continentes**. La máscara de tierra se
      rasteriza en build y cuesta 6,5 KB comprimidos.

Los cinco tipos de v1 están disponibles en el renderer, en la galería y en el
editor. Añadir uno nuevo es una función en el registro `BUILDERS`.

## Fase 7 — Marketing y lanzamiento

- [ ] Landing nivel Awwwards con hero 3D en vivo (`docs/DESIGN.md`)
- [ ] Galería de ejemplos, cada uno con su link de embed
- [ ] Docs de la API de config-en-URL
- [ ] Guías de Notion / Confluence / Webflow / Framer
- [ ] Alta en Iframely
- [ ] Lanzamiento

---

## Backlog (no comprometido)

arcos entre coordenadas en el globo · datos en vivo (Sheets/CSV/endpoint) ·
dominios propios · exportación a vídeo/GIF · equipos · plantillas de la
comunidad.
