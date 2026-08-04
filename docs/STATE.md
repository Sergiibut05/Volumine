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
**Fase actual:** 2 — Renderer (a medias; decisión de arquitectura abierta)

## Lo importante ahora mismo

**El renderer con React Three Fiber funciona pero no cabe en el presupuesto del
embed: 358 KB gz contra 180 KB.** Está medido y las causas están aisladas (ADR
0006). La propuesta es reescribir el núcleo de la escena en three plano, sin
React, y que el editor use ese mismo núcleo. R3F saldría del proyecto.

Eso es lo siguiente a hacer, y es una decisión que conviene que Manuel confirme
porque cambia el stack: el ADR 0006 está en `propuesta`, no en `aceptada`.

## Qué hay hecho

- Documentación fundacional completa: `PRD.md`, `chart-config-schema.md`,
  `PERFORMANCE-BUDGET.md`, `DESIGN.md`, `ROADMAP.md`, ADRs 0001-0005.
- Configuración de Claude Code: permisos, hook de formato, subagentes
  `webgl-perf-reviewer` y `design-critic`, comandos `/state` y `/perf`, skill
  `add-chart-type`.
- Repo git inicializado.
- **`prototypes/donut.html`**: prototipo desechable funcionando y verificado en
  Chrome. Sector anular extruido con bevel, IBL de estudio, sombra de contacto,
  rotación automática, hover con elevación + separación + tooltip, y panel de
  control con todos los parámetros. Sin build ni framework, three desde CDN.

- **Scaffolding Next 16 + TS + Tailwind v4** con la estructura de la ADR 0002:
  `(site)` y `(embed)` como route groups con **root layout propio cada uno** (no
  existe `app/layout.tsx`, es lo que impide que el embed herede nada).
- **`src/lib/config/`**: esquema Zod de `ChartConfig` v1, defaults en un único
  sitio, saneado que nunca revienta, andamiaje de migraciones, config en URL con
  lz-string. 15 tests.
- **`src/renderer/geometry/donut.ts`**: geometría pura y sin framework, con las
  cuatro restricciones del bevel del prototipo. 19 tests.
- **`src/renderer/`**: `ChartStage` + `DonutChart` en R3F. **Funciona y está
  verificado con captura real** (`/dev/renderer`).
- **`src/styles/tokens.css`**: tokens en tres capas, claro y oscuro.
- **`scripts/perf-embed.mjs`**: mide lo que el navegador descarga de verdad y
  falla si se pasa del presupuesto. Ya ha servido para algo (ver arriba).
- Cabeceras de `/embed` (`frame-ancestors *`, sin `X-Frame-Options`), tabla de
  datos accesible, detección de WebGL, `IntersectionObserver`, `postMessage`.

## Qué toca ahora

1. Que Manuel confirme la ADR 0006 (three plano en el embed, fuera R3F).
2. Si sí: `src/renderer/core/` en three plano, migrar el editor a ese núcleo,
   quitar `@react-three/fiber` y `@react-three/drei`, y volver a medir.
3. Sigue pendiente el visto bueno visual del look (`prototypes/donut.html` y
   `/dev/renderer` renderizan lo mismo).

## Decisiones pendientes de Manuel

- [ ] Confirmar el nombre "Voluma" (o proponer otro) y renombrar la carpeta.
- [ ] Dominio, cuando el nombre esté cerrado.
- [ ] **Validar visualmente el prototipo** antes de pasar a Fase 2.

## Lecciones del prototipo — llevar al renderer de verdad

Todo esto salió de mirar píxeles, no de razonar. Es el valor real de la Fase 1.

1. **Doble conversión de color.** `new THREE.Color(hex).convertSRGBToLinear()`
   con la gestión de color de three activada convierte dos veces y deja los
   colores lavados. El hex se pasa tal cual.
2. **El IBL blanco se come la saturación.** `environmentIntensity` por encima de
   ~0.7 con clearcoat alto vuelve todo pastel y de aspecto barato. Valores que
   funcionan: env 0.55, exposure 0.95, clearcoat 0.3, key 1.1. Hay que
   codificarlos en los presets de `scene.environment`.
3. **El bevel tiene que ser UNO SOLO para todo el donut.** Calcularlo por
   segmento (acotado por el arco de cada uno) daba al segmento del 42% un canto
   del doble de grueso que al del 6%: en la junta los perfiles no casan y
   visualmente parece que las piezas se traspasan. Fue el defecto más evidente.
   Se calcula el máximo admisible de cada sector y se usa el mínimo global.
4. **El bevel también está limitado por la separación entre segmentos**, no solo
   por las dimensiones del sector. Si se acerca al hueco entre vecinos, la junta
   se lee como una costura sucia. Restricción: `bevel ≤ 0.85 × innerR × gap`.
   Con esta cuarta restricción, todo el rango del slider es usable.
5. **`toCreasedNormals` es peor que las normales planas aquí.** Mezcla las
   normales del bevel con las de la tapa y, como la tapa se trianguliza en
   abanico, propaga estrías radiales por toda la cara superior. La solución
   buena es subir `bevelSegments` (12 va bien) y dejar las normales planas.
6. **Coste de geometría, medido.** `curveSegments` 64 → 24 no cambia nada
   visualmente y baja de 67k a ~21k triángulos con 5 segmentos. Por debajo de
   ~14 se ve el polígono en la silueta. **Pendiente para el renderer real:
   `curveSegments` adaptativo al ángulo del sector** — un sector del 6% no
   necesita los mismos que uno del 42%. Con 5 segmentos vamos a 6 draw calls,
   dentro de presupuesto.
7. **Contraste de paleta.** En `aurora`, menta y cian se distinguen mal en 3D con
   luz encima. Las paletas se validan _renderizadas_, no como muestras planas.
8. El grupo se separa del suelo (`group.position.y = 0.26`) porque apoyado sobre
   el plano la sombra queda oculta bajo el propio objeto. Hay que parametrizar
   esa elevación en función del grosor.

## Mejora identificada y no hecha: encoger la forma antes de extruir

El bevel de `ExtrudeGeometry` **expande** el contorno hacia fuera (medido: con
`outerR=1` y `bevel=0.03` el radio real llega a 1.031). Por eso el canto se come
el hueco entre sectores y hay que limitarlo a `hueco/2`, que con separaciones
pequeñas deja el canto bastante fino.

Arreglo: **encoger la forma por `bevel` antes de extruir** (radio exterior
`−b`, interior `+b`, ángulos metidos hacia dentro). Al expandirse, la geometría
vuelve exactamente al contorno nominal, el hueco se respeta entero y la cuarta
restricción casi desaparece — se podrían permitir cantos bastante más gruesos
con el mismo hueco. Cuidado: el encogido tangencial exacto no es un simple
delta de ángulo (depende del radio); con `b / radioMedio` la aproximación es
buena y el error queda en los extremos.

Merece la pena porque el canto es el rasgo de marca. Hacerlo al escribir el
núcleo en three plano (ADR 0006), no antes.

## Problemas abiertos

- **El presupuesto del embed no se cumple:** 358 KB gz contra 180. ADR 0006.
- **`min-height: auto` de los items de grid.** Un `<Canvas>` dentro de una celda
  de grid mide 0 en el primer paint y R3F se queda con 300×150 para siempre,
  sin ningún error. Arreglado con `minHeight: 0` en `/dev/renderer`, pero es una
  trampa que va a repetirse: cualquier contenedor del canvas la lleva.
- **El dev server de Next devolvió 403 en todos los chunks** y su WebSocket de
  HMR falla con `ERR_INVALID_HTTP_RESPONSE`, así que la página no hidrata en
  `npm run dev`. En producción (`build` + `start`) funciona bien. Sin
  diagnosticar; probablemente algo local de la máquina interceptando el puerto.
  **Mientras dure, verificar siempre contra un build de producción.**
- **El lector de consola de la extensión de Chrome se traga los logs** tras
  navegar. Playwright sí los captura, junto con `pageerror` y los fallos de red.
  Para depurar, Playwright.

- **Sectores diminutos.** El bevel global lo marca el sector más restrictivo, así
  que una porción del 1% deja a todo el donut casi sin canto. Sin resolver.
  Opciones a evaluar: suelo mínimo de bevel, o agrupar automáticamente los
  sectores por debajo de un umbral en "Otros".

## Notas para la próxima sesión

- El proyecto es **gratis por ahora**, pero el esquema de datos debe soportar
  planes y cuotas desde el principio (ver PRD).
- Manuel está aprendiendo React por su cuenta; no hace falta frenar el ritmo
  para enseñar, pero el código debe ser legible y idiomático, no ingenioso.
- La carpeta se llama `3d-web-chart` por accidente histórico; el producto es
  Voluma.
