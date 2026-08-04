# Estado actual

> **Este archivo es el mecanismo de continuidad entre sesiones.** Una sesión
> nueva no recuerda nada: lo primero que hace es leer esto. Manténlo actualizado
> con `/state` al terminar cualquier bloque de trabajo.
>
> Sé concreto. "Avanzando en el renderer" no vale.

**Última actualización:** 2026-08-04
**Fase actual:** 3 — El embed, funcionando de punta a punta

## Qué funciona hoy

**Pegas una URL en un iframe y sale una gráfica 3D.** Eso ya es cierto y está
verificado con `sandbox` puesto, que es lo que hace Confluence Cloud.

- `/embed?c=<config>` — route handler que devuelve HTML escrito a mano. Sin
  React, sin runtime de Next. **140,6 KB gz, el 78% del presupuesto.** Una sola
  petición de JS, cero peticiones a terceros.
- `/dev/embed` — la demo: el embed dentro de un iframe con `sandbox`, el
  snippet para copiar y los `postMessage` que llegan.
- `/dev/renderer` — banco de pruebas con presets y sliders.
- Contrato `ChartConfig` v1 en Zod, defaults en un único sitio, saneado que
  nunca revienta el embed, migraciones, config en URL (289 caracteres para una
  gráfica de 5 sectores).
- Renderer de donut/pie en three plano: bevel uniforme, sombreado suave, sombra
  de contacto, hover con elevación y tooltip, órbita.
- Tabla de datos accesible y `aria-label` generado, siempre en el DOM.
- **38 tests** unitarios de geometría y de contrato.

## Qué toca ahora

Fase 4, el editor. El renderer y el contrato están listos; falta la interfaz
que produce el config. Plantear los paneles siguiendo `docs/CUSTOMIZATION.md`
(tres niveles de profundidad, rangos seguros calculados).

Antes de eso, dos cosas cortas que quedaron a medias:

- Los temas de `src/lib/themes/` no existen todavía. El esquema los admite
  (`theme`) pero no hay ninguno.
- No hay tests de regresión visual con Playwright. El andamiaje está.

## Decisiones pendientes de Manuel

- [ ] Confirmar el nombre "Voluma" y renombrar la carpeta
      (`Rename-Item C:\Users\mnsa1\Desktop\3d-web-chart voluma`).
- [ ] Dominio, cuando el nombre esté cerrado.

## Lecciones caras, para no repetirlas

Todo esto salió de mirar píxeles o de medir, no de razonar.

1. **R3F obliga a empaquetar three entero.** Su reconciliador necesita el
   catálogo completo, así que ni quitar drei (0,2 KB) ni usar imports nombrados
   (0 KB) sirven de nada. Ver ADR 0006.
2. **El App Router carga React aunque no haya componentes cliente.** Sacar
   `/embed` a un route handler con bundle propio quitó ~110 KB.
3. **El bevel de `ExtrudeGeometry` expande el contorno hacia fuera**, no hacia
   dentro. Por eso se comía el hueco entre sectores. Se arregla encogiendo la
   forma por `bevel` antes de extruir.
4. **El bevel tiene que ser uno solo para todo el donut.** Por sector, un
   segmento del 42% tiene el canto del doble que uno del 6% y las juntas no
   casan: parece que las piezas se traspasan.
5. **La geometría se gira −90° sobre X**, lo que mapea `(x,y,z) → (x, z, −y)`.
   La dirección radial de un sector es `(cos θ, 0, −sin θ)`. Con el signo
   positivo sale espejada y los sectores se desplazan de lado.
6. **`toCreasedNormals` contamina las normales de la tapa** y su triangulación
   en abanico lo propaga en estrías. Hay que devolverle a las tapas su normal
   exacta después de suavizar.
7. **Doble conversión sRGB**: `new Color(hex).convertSRGBToLinear()` con la
   gestión de color activada convierte dos veces y lava los colores.
8. **El IBL blanco por encima de ~0.7 vuelve todo pastel.** Valores buenos:
   env 0.55, exposure 0.95, clearcoat 0.3, key 1.1.
9. **`min-height: auto` en items de grid** deja el canvas en 300×150 sin dar
   ningún error. `minHeight: 0` en el contenedor.
10. **`display: flex` gana a `[hidden]`**: hay que escribir `.x[hidden] {
display: none }` o el elemento oculto se ve.
11. **`export const dynamic = 'force-static'` en un route handler descarta el
    query string.** El embed respondía siempre "falta el parámetro".

## Problemas abiertos

- **El dev server de Next devuelve 403 en todos los chunks** en esta máquina y
  su WebSocket de HMR falla; la página no hidrata con `npm run dev`. En
  producción funciona. Sin diagnosticar. **Verificar siempre contra `npm run
build` + `npm start`.**
- **Sectores diminutos.** El bevel global lo marca el sector más restrictivo,
  así que una porción por debajo del ~2% deja a todo el donut casi sin canto.
  Opciones: suelo mínimo de bevel, o agrupar automáticamente en "Otros".
- **No hay póster estático ni `?static=1`.** El fallback sin WebGL hoy es la
  tabla de datos, que funciona pero no es bonito. Falta el render en servidor.
- El lector de consola de la extensión de Chrome se traga los logs tras navegar.
  Para depurar, Playwright: captura `console`, `pageerror` y fallos de red.
