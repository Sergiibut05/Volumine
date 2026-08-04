# ADR 0004 — Geometría propia, sin librería de gráficas 3D

**Fecha:** 2026-08-04 · **Estado:** aceptada

## Contexto

Existen librerías que ya pintan gráficas 3D: ECharts-GL, Highcharts 3D,
Plotly 3D, amCharts. Usarlas ahorraría semanas.

## Decisión

Construimos la geometría nosotros sobre `three` + React Three Fiber.

El motivo no es técnico, es de producto: **lo que la gente compra es el aspecto**
—el canto redondeado, el material, la luz— y eso es exactamente lo que ninguna
de esas librerías te deja controlar. Usar ECharts-GL nos dejaría con un producto
que se ve como todos los demás y pesa el triple. El diferenciador no se
subcontrata.

Además, el peso: esas librerías rondan o superan el presupuesto entero de
`/embed` ellas solas.

## Cómo

- **Donut/pie**: `THREE.Shape` de sector anular → `ExtrudeGeometry` con
  `bevelEnabled`, `bevelSegments` y `curveSegments` parametrizados por
  `style.bevel`. Una geometría por segmento, generada una vez y memoizada por
  `(valor, bevel, height, innerRadius, gap)`.
- **Barras**: caja con esquinas superiores redondeadas, misma técnica de extrude
  o `RoundedBoxGeometry` propia. Instanciado (`InstancedMesh`) cuando hay muchas.
- **Materiales**: `MeshPhysicalMaterial` con entorno IBL precomputado y
  empaquetado local (nada de HDRIs remotos).

## Consecuencias

- Más trabajo por delante y matemáticas de geometría que hay que hacer bien
  (normales, UVs, bevel que no se autointersecta con ángulos pequeños).
- Control total del presupuesto de rendimiento y del aspecto.
- Cada tipo de gráfica nuevo es trabajo real. Por eso v1 son solo dos, y por eso
  existe la skill `add-chart-type` que fija el procedimiento.
