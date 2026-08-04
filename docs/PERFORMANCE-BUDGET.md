# Presupuesto de rendimiento

Dos productos distintos con dos listones distintos. No los mezcles.

## `/embed` — el listón duro

Es código que corre dentro de la página de otra persona. Si es lento, la culpa
se la lleva su página y nos quitan.

| Métrica                              | Presupuesto                   | Cómo se mide                                     |
| ------------------------------------ | ----------------------------- | ------------------------------------------------ |
| JS transferido (gzip), ruta `/embed` | **≤ 180 KB**                  | `npm run perf:embed`                             |
| CSS transferido                      | ≤ 8 KB                        | idem                                             |
| Peticiones antes del primer frame    | ≤ 3                           | Playwright, HAR                                  |
| Fuentes remotas                      | **0**                         | subset local, `.woff2`, inline si <8 KB          |
| Peticiones a terceros                | **0**                         | ninguna. Ni analytics, ni CDN, ni fuentes        |
| LCP (móvil simulado, 4G)             | ≤ 1.8 s                       | Lighthouse en CI                                 |
| CLS                                  | **0**                         | el contenedor reserva ratio desde el primer byte |
| Frame time con 8 segmentos           | ≤ 8 ms                        | perfilado manual                                 |
| Draw calls                           | ≤ 12                          | `renderer.info.render.calls`                     |
| Contextos WebGL por embed            | 1, liberado fuera de viewport | `IntersectionObserver`                           |

### De dónde salen los ~180 KB (medido, 2026-08-04)

`three` podado —solo lo que la gráfica usa, más `OrbitControls` y
`RoomEnvironment`— son **137 KB gz**. Ese es el suelo real y no hay forma de
bajarlo sin renunciar a WebGL. El presupuesto deja ~43 KB para nuestro renderer.

**Estado actual: 140,6 KB gz — el 78% del presupuesto.** Se llegó ahí sacando
`/embed` del App Router (ADR 0006): es un route handler que devuelve HTML
escrito a mano, con el CSS inline y el cliente como bundle propio de esbuild.
Una sola petición de JS, cero peticiones a terceros.

Lo que **no** cabe, comprobado con `npm run perf:embed`:

|                                                       | gzip       |
| ----------------------------------------------------- | ---------- |
| three completo, sin poder podarse (lo que impone R3F) | 227 KB     |
| React + ReactDOM                                      | 70 KB      |
| React Three Fiber + runtime de Next                   | 47 KB      |
| **Total con R3F**                                     | **358 KB** |

Por eso `/embed` no usa React (ADR 0006). Y por eso tampoco lleva editor, auth,
store ni router de cliente.

Dos cosas que se probaron y **no** sirvieron de nada, para que nadie las repita:
quitar drei ahorró 0,2 KB, y cambiar `import * as THREE` por imports nombrados
ahorró 0. Mientras R3F estuviera dentro, three viajaba entero igual.

### Reglas que se derivan del presupuesto

- Imports de three siempre nombrados desde `three` (nunca `three/examples` sin
  medir). Nada de `three-stdlib` entero.
- Post-proceso (bloom) es **opt-in** y se carga con `import()` dinámico. Sin
  bloom no se descarga el `EffectComposer`.
- Nada de `drei` en el embed salvo lo que se pueda tree-shakear a coste medido.
  Si `drei` no cabe, el embed usa R3F pelado o three directo. Se mide, no se
  opina.
- Sin WebGL disponible o `?static=1` → se sirve la imagen y **no se descarga
  three** (split por ruta, decidido en servidor cuando sea posible).
- El póster estático se pinta primero, siempre. El canvas lo sustituye cuando
  está listo. Nunca hay hueco en blanco.

### Multi-embed en una página

Los navegadores limitan los contextos WebGL simultáneos (~8-16). Una página de
Notion con 6 gráficas nuestras debe funcionar:

- Póster estático hasta que el embed entra en viewport.
- Al salir del viewport más de N segundos, `renderer.dispose()` y volver al
  póster.
- `powerPreference: "low-power"`, `antialias` solo si `devicePixelRatio < 2`.
- `dpr` limitado a `Math.min(devicePixelRatio, 2)`.

## App y marketing — el listón normal

Aquí sí se puede ser generoso: es nuestra página, la gente ha decidido venir y
el listón es visual (ver `docs/DESIGN.md`).

| Métrica                          | Presupuesto                                       |
| -------------------------------- | ------------------------------------------------- |
| LCP landing (móvil, 4G)          | ≤ 2.5 s                                           |
| INP                              | ≤ 200 ms                                          |
| CLS                              | ≤ 0.05                                            |
| JS inicial landing (gzip)        | ≤ 250 KB (excluyendo el 3D del hero, que es lazy) |
| Editor: primer frame interactivo | ≤ 3 s                                             |

El 3D de la landing se monta tras el primer render y solo si hay WebGL y no hay
`prefers-reduced-motion`. La landing tiene que ser legible y bonita sin él.

## Cuándo se comprueba

- `npm run perf:embed` en cada PR que toque `app/embed/**` o `src/renderer/**`.
- Falla el build si se pasa el presupuesto. No es un aviso, es un error.
