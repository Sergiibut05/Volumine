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
**Fase actual:** 1 — Prototipo (hecho, pendiente de visto bueno de Manuel)

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

## Qué toca ahora

Esperando visto bueno visual de Manuel sobre `prototypes/donut.html`.
Si lo aprueba → Fase 2 (renderer): scaffolding Next + esquema Zod de
`ChartConfig` + tokens + renderer de donut + `/dev/renderer` + Playwright.

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
   luz encima. Las paletas se validan *renderizadas*, no como muestras planas.
8. El grupo se separa del suelo (`group.position.y = 0.26`) porque apoyado sobre
   el plano la sombra queda oculta bajo el propio objeto. Hay que parametrizar
   esa elevación en función del grosor.

## Problemas abiertos

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
