# Volumine

Gráficas 3D interactivas que se incrustan en cualquier sitio con un link.

**[volumine.app](https://volumine.app)**

> El producto es **el link**, no el editor.

Haces la gráfica, copias la URL y la pegas donde sea — Notion, Confluence, tu
propia web. Lo que aparece ahí no es una imagen: es la gráfica, girando, viva, y
si cambias los datos cambia en todos los sitios donde la habías puesto.

---

## Qué hace, exactamente

Seis tipos de gráfica —tarta, anillo, barras, barras animadas, globo por países
y medidor— con geometría propia en three.js: canto biselado, sombra real y luz
de estudio. Se editan sin cuenta, se comparten con una URL y se incrustan con un
`<iframe>` o pegando el link a secas donde haya oEmbed.

**La configuración entera viaja dentro de la URL** comprimida con `lz-string`.
Una gráfica compartida así no tiene base de datos detrás. Eso resultó ser el
plan gratuito y la API para desarrolladores a la vez: una decisión, dos
productos. Con cuenta, la gráfica se guarda y el link deja de cambiar al
editarla.

## Las tres reglas duras

Están en [`CLAUDE.md`](CLAUDE.md) y no son estilo, son el producto:

1. **La ruta `/embed` es sagrada.** Sin cookies, sin `localStorage`, sin auth,
   sin analítica de terceros, sin fuentes remotas. Corre dentro de la página de
   otra persona y no se le cobra nada a quien no ha pedido nada. El presupuesto
   está en [`docs/PERFORMANCE-BUDGET.md`](docs/PERFORMANCE-BUDGET.md) y lo
   comprueba `npm run perf:embed`.

2. **La config de gráfica sigue [`docs/chart-config-schema.md`](docs/chart-config-schema.md).**
   Está versionada. Cambiar el esquema es subir versión y escribir migración.
   Nunca se rompe un link publicado.

3. **Nada de librerías de gráficas 3D.** Ni echarts-gl, ni plotly, ni
   highcharts-3d. La geometría es propia y es el diferenciador visual del
   producto ([ADR 0004](docs/adr/0004-geometria-propia-sin-libreria-de-graficas.md)).

## El presupuesto del embed

Lo que carga en la página de quien ve la gráfica. Se mide en cada build y si se
pasa, **el build falla**:

|                              | Actual   | Tope   |
| ---------------------------- | -------- | ------ |
| JS (gzip)                    | 149,0 KB | 180 KB |
| CSS (en línea en el HTML)    | 5,5 KB   | 8 KB   |
| Tipografía (solo si se pide) | 26,8 KB  | 32 KB  |
| Peticiones a terceros        | 0        | 0      |

Una petición desde el HTML. Cero cookies. Por eso una gráfica incrustada no
añade obligaciones a la política de privacidad de la web donde se ponga.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** estricto
- **three.js en plano, sin React Three Fiber** — el renderer del embed no puede
  pagar el peaje de React ([ADR 0006](docs/adr/0006-el-embed-usa-three-en-plano-sin-react.md))
- **Supabase** — Postgres, Auth y Storage. Los permisos los decide Postgres con
  RLS, no el servidor ([ADR 0007](docs/adr/0007-los-permisos-los-decide-postgres.md))
- **Stripe** para el pago único
- **Tailwind v4** con tokens propios · **zustand** en el editor
- **Vitest** (unitarios) + **Playwright** (e2e y capturas del embed)
- **Vercel**

## Cómo está montado

```
src/
  app/
    (site)/      la aplicación: landing, editor, precios, legal, integraciones
    (embed)/     /embed y /api/oembed — route handlers, sin React
  embed/         el HTML del embed, generado a mano como texto
  renderer/      escena, materiales, luces y capa de etiquetas
    geometry/    la geometría propia: sectores biselados, barras, globo
  lib/           esquema, config-en-URL, temas, i18n, facturación
supabase/
  migrations/    seis, en orden. RLS desde la primera
scripts/         build del embed, subsetting de fuentes, imagen OG, iconos
docs/            PRD, esquema, presupuesto, diseño, ADR y estado
```

**`/embed` no comparte layout con el resto.** No existe `app/layout.tsx` a
propósito: un layout raíz compartido filtraría providers, fuentes y analítica al
embed por herencia.

## Empezar

```bash
npm install
cp .env.example .env.local     # y rellenar
npm run dev                    # :3000
```

Sin Supabase configurado el editor funciona igual: no hace falta cuenta para
crear una gráfica ni para incrustarla. Lo que no habrá es guardado ni pagos.

### Variables

| Variable                        | Para qué                                      |
| ------------------------------- | --------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Proyecto de Supabase                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública. La protección real es RLS      |
| `SUPABASE_SERVICE_ROLE_KEY`     | Solo servidor, solo para el webhook de Stripe |
| `STRIPE_SECRET_KEY`             | Cobros                                        |
| `STRIPE_WEBHOOK_SECRET`         | Verificar la firma del webhook                |

## Comandos

```bash
npm run dev            # app en :3000
npm run build          # embed + fuentes + build de Next
npm run lint           # eslint + tsc --noEmit
npm run test           # vitest
npm run test:e2e       # playwright
npm run perf:embed     # mide /embed contra el presupuesto
```

Y los de material de marca, que se lanzan a mano y no en cada despliegue:

```bash
npm run og             # imagen de las tarjetas de enlace
npm run icons          # favicon.ico y apple-icon desde icon.svg
npm run x:gif          # la gráfica girando, en GIF
npm run x:video        # vídeo de «el momento del link»
```

## Documentación

| Documento                                                                                                | Qué contiene                                                    |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [`docs/STATE.md`](docs/STATE.md)                                                                         | **Dónde estamos ahora mismo.** Lo primero que hay que leer      |
| [`docs/PRD.md`](docs/PRD.md)                                                                             | Qué es el producto, para quién, y qué **no** es                 |
| [`docs/chart-config-schema.md`](docs/chart-config-schema.md)                                             | El contrato `ChartConfig`. El documento más importante del repo |
| [`docs/PERFORMANCE-BUDGET.md`](docs/PERFORMANCE-BUDGET.md)                                               | El presupuesto del embed y por qué cada cifra                   |
| [`docs/CUSTOMIZATION.md`](docs/CUSTOMIZATION.md)                                                         | Cómo se ordenan los controles del editor                        |
| [`docs/DESIGN.md`](docs/DESIGN.md)                                                                       | Dirección de arte y listón de accesibilidad                     |
| [`docs/ROADMAP.md`](docs/ROADMAP.md)                                                                     | Qué toca y en qué orden                                         |
| [`docs/LEGAL.md`](docs/LEGAL.md) · [`docs/PAGOS.md`](docs/PAGOS.md) · [`docs/CORREO.md`](docs/CORREO.md) | Operativa: legal, cobros y correo                               |
| [`docs/adr/`](docs/adr/)                                                                                 | Las siete decisiones cerradas, con su porqué                    |

El código lleva los comentarios largos donde hicieron falta: no explican qué
hace la línea, explican **por qué no es la otra cosa**. Casi todos salen de un
fallo que llegó a producción.

## Licencia

Sin licencia abierta. Todos los derechos reservados.
