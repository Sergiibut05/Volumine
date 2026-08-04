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

## Problemas conocidos

Descubiertos en el prototipo, hay que resolverlos bien en el renderer de verdad:

1. **Doble conversión de color.** `new THREE.Color(hex).convertSRGBToLinear()`
   con la gestión de color de three activada convierte dos veces y deja los
   colores lavados. El hex se pasa tal cual. Ver `prototypes/donut.html` en el
   comentario sobre `MeshPhysicalMaterial`.
2. **El IBL blanco se come la saturación.** `environmentIntensity` por encima de
   ~0.7 con clearcoat alto vuelve todo pastel y de aspecto barato. Defaults
   actuales que funcionan: env 0.55, exposure 0.95, clearcoat 0.3, key 1.1.
   Esto hay que codificarlo en los presets de `scene.environment`.
3. **El bevel se autointersecta** en segmentos estrechos: `bevelSize` no puede
   superar ~45% de la menor de (grosor radial, arco interior, altura). Está
   acotado en `annularSector()`, pero el efecto secundario es que **el bevel se
   ve distinto en segmentos grandes y pequeños**. En el renderer real hay que
   decidir: ¿bevel uniforme acotado por el segmento más pequeño, o bevel
   proporcional como ahora? Afecta al aspecto y no está resuelto.
4. **Contraste de paleta.** En la paleta `aurora`, menta y cian se distinguen
   mal en 3D con luz encima. Las paletas hay que validarlas *renderizadas*, no
   como muestras planas de color.
5. El grupo se separa del suelo (`group.position.y = 0.26`) porque apoyado sobre
   el plano la sombra queda oculta bajo el propio objeto. Hay que parametrizar
   esa elevación en función del grosor.

## Notas para la próxima sesión

- El proyecto es **gratis por ahora**, pero el esquema de datos debe soportar
  planes y cuotas desde el principio (ver PRD).
- Manuel está aprendiendo React por su cuenta; no hace falta frenar el ritmo
  para enseñar, pero el código debe ser legible y idiomático, no ingenioso.
- La carpeta se llama `3d-web-chart` por accidente histórico; el producto es
  Voluma.
