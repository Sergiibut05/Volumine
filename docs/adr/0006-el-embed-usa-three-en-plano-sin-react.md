# ADR 0006 — El renderer de `/embed` es three en plano, sin React

**Fecha:** 2026-08-04 · **Estado:** propuesta (pendiente de implementar en Fase 3)

## Contexto

Se implementó el renderer con React Three Fiber y se midió `/embed` contra
`docs/PERFORMANCE-BUDGET.md` con `npm run perf:embed`. Resultado:

| Trozo                          | gzip       |
| ------------------------------ | ---------- |
| three (la librería **entera**) | 227 KB     |
| React + ReactDOM               | 70 KB      |
| R3F + runtime de Next          | 47 KB      |
| resto                          | 14 KB      |
| **Total**                      | **358 KB** |

El presupuesto son 180 KB. Nos pasamos por 2×.

Se probaron dos cosas antes de concluir nada:

1. **Quitar drei** y usar los `OrbitControls` de three directamente: ahorro
   **0,2 KB**. drei no era el problema.
2. **Cambiar `import * as THREE` por imports nombrados** en todo el renderer:
   ahorro **0 KB**. Tampoco era nuestro código.

La causa es R3F: su reconciliador necesita el catálogo completo de THREE y hace
`import * as THREE` internamente, así que **three viaja entero pase lo que pase
en nuestro código**. No es un defecto de R3F, es cómo tiene que funcionar.

Medición de control con esbuild, empaquetando solo lo que la gráfica necesita:

|                                                                    | gzip       |
| ------------------------------------------------------------------ | ---------- |
| three completo (namespace)                                         | 176 KB     |
| three podado (imports nombrados + OrbitControls + RoomEnvironment) | **137 KB** |

## Decisión

El renderer de `/embed` se escribe con **three en plano: sin React, sin R3F**.

Estimación: 137 KB (three podado) + ~12 KB (nuestro renderer) ≈ **150 KB gz**,
dentro del presupuesto y menos de la mitad que ahora.

Para no acabar con dos renderers que divergen:

- `src/renderer/geometry/**` ya es puro y sin framework. No cambia.
- Se añade `src/renderer/core/` con el montaje de escena en three plano:
  cámara, luces, materiales, controles, bucle de render. **Una sola
  implementación de la escena.**
- El editor **también** usa ese núcleo, envuelto en un componente React fino que
  se limita a montarlo y desmontarlo. R3F desaparece del proyecto.

Que el editor use el mismo núcleo no es una concesión: es lo que garantiza por
construcción que "mismo config, mismos píxeles" siga siendo cierto, que es de lo
que dependen el render estático y los tests visuales.

## Alternativas descartadas

- **Subir el presupuesto a 360 KB.** Es la salida fácil y renuncia al
  diferenciador: el producto es el embed, y "el embed es rápido" es media
  propuesta de valor. Un widget de 360 KB no entra en la landing de nadie.
- **Mantener R3F y cargar three de forma diferida.** No arregla nada: el peso
  llega igual, solo que más tarde y con la gráfica en blanco mientras tanto.
- **Dos renderers, R3F en el editor y three plano en el embed.** El doble de
  superficie para el mismo dibujo y garantía de que divergen. Si hay que elegir
  uno, que sea el que cumple el presupuesto.

## Consecuencias

- Se pierde la comodidad declarativa de R3F. La escena es pequeña y está
  totalmente dirigida por el config, así que el coste es asumible.
- Hay que escribir a mano lo que R3F daba gratis: bucle de render, raycasting
  para el hover, redimensionado, y sobre todo el **ciclo de vida de los recursos**
  (`dispose()` de geometrías, materiales, render targets y del propio contexto).
  Es la parte con más riesgo de fugas y necesita tests.
- `@react-three/fiber` y `@react-three/drei` salen del `package.json`.
- El presupuesto de 180 KB se mantiene, ahora con la evidencia de que es
  alcanzable. Si tras implementarlo no se llega, se revisa **con números**.

## Cómo se verifica

`npm run perf:embed` tiene que pasar. Ese script ya existe, mide lo que el
navegador descarga de verdad y falla el build si se pasa.
