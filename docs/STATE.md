# Estado actual

> **Este archivo es el mecanismo de continuidad entre sesiones.** Una sesión
> nueva no recuerda nada: lo primero que hace es leer esto. Manténlo actualizado
> con `/state` al terminar cualquier bloque de trabajo.
>
> Sé concreto. "Avanzando en el renderer" no vale.

**Última actualización:** 2026-08-04
**Fase actual:** 6 — Todos los tipos de v1 disponibles

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
- **Cinco tipos disponibles**: anillo, tarta, barras, barras animadas y globo.
  Un tipo = una función en el registro `BUILDERS` de `chart-renderer.ts`.
- **Barras animadas**: cada serie es un periodo y su `name` la etiqueta. No hizo
  falta tocar el esquema. Se reordenan por ranking en cada instante, la etiqueta
  del periodo se pinta en HTML (el bundle no lleva fuentes) y la geometría solo
  se rehace cuando la altura se aleja más de un 4% de la construida — escalar
  sin más deforma el canto, y rehacerla cada frame asigna dentro del bucle.
- **Globo**: esfera + retícula calculada + una barra por coordenada. **Sin
  contornos de países**, y es una decisión de presupuesto, no un olvido: el
  mundo en GeoJSON son 100-200 KB y /embed tiene 180 en total. Responde a "dónde
  y cuánto", no a "qué país es este".
- Renderer de donut/pie en three plano: bevel uniforme, sombreado suave, sombra
  de contacto, hover con elevación y tooltip, órbita. El canto al máximo se ve
  bien **con la separación a 0**: los extremos son un redondeo convexo de
  verdad, así que dos vecinos pegados dejan un surco limpio.
- Tabla de datos accesible y `aria-label` generado, siempre en el DOM.
- **118 tests** unitarios de geometría y de contrato.

## Interfaz

- **`/`** — landing. Dirección "estudio": superficie clara de papel de
  fotografía de producto, con las gráficas como objetos que proyectan sombra
  real. Elemento firma: la tira de URL del héroe, que cambia en vivo al tocar el
  tema, porque el producto es el link. Dispositivo estructural: ficha técnica
  (PESO / PETICIONES / TERCEROS / REGISTRO), no 01/02/03.
- **Galería de tipos** — cada tarjeta dice a qué pregunta responde el tipo y
  **cuándo no usarlo**. Los dos que existen montan 3D al entrar en viewport; los
  que no, silueta en CSS. Cinco canvas a la vez rompen una página de gama media.
- **`/crear`** — editor. Personalización por tarjetas en tres niveles: tema,
  ajustes, avanzado (plegado). Temas con muestra de paleta, tipos, color por
  segmento, material con bola de muestra, fondo, forma y movimiento. El rango
  del slider de canto se calcula con `globalBevel()`, la misma función que usa
  la geometría: el control no puede llegar a un estado roto.
- **6 temas** en `src/lib/themes/`, que rellenan sin bloquear.
- Radix para los sliders: accesibilidad y comportamiento, cero estética
  impuesta. El estilo es nuestro, en `src/styles/editor.css`.
- Superficie clara en marketing y oscura en el editor, a propósito: el editor es
  un modo de taller y el 3D con IBL se lee mejor sobre oscuro.

## Qué toca ahora

0. **El editor solo ofrece anillo, tarta y barras.** Los cinco tipos existen en
   el renderer y en la galería de la landing, pero `/crear` todavía no deja
   elegir carrera ni globo, y el globo además necesita una forma de introducir
   coordenadas. Es lo siguiente y es corto.
1. **Entrada de datos en el editor.** Hoy los datos están fijos en el código:
   se puede cambiar todo el aspecto pero no los números. Es el hueco más grande.
   Tabla editable + pegar desde Excel/Sheets.
2. **Deshacer/rehacer**, barato porque el config es la única fuente de verdad.
3. Tests de regresión visual con Playwright. El andamiaje está.
4. Póster estático en servidor, para el fallback sin WebGL y las OG images.

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
3. **`ExtrudeGeometry` no sirve para redondear este sólido, y era la raíz de
   casi todo.** Desplaza el contorno 2D por bisectrices de vértice: en el arco
   interior, que es cóncavo, los puntos convergen y se cruzan — de ahí el canto
   arrugado. Además expande hacia fuera y se come el hueco entre vecinos.
   Compensarlo encogiendo antes no funciona porque un encogido uniforme no es el
   inverso de un desplazamiento por bisectriz, y la diferencia se ve como cortes
   en las caras laterales. Sustituido por geometría propia en
   `geometry/rounded-sector.ts`.
4. **El bevel tiene que ser uno solo para todo el donut.** Por sector, un
   segmento del 42% tiene el canto del doble que uno del 6% y las juntas no
   casan: parece que las piezas se traspasan.
5. **La geometría se gira −90° sobre X**, lo que mapea `(x,y,z) → (x, z, −y)`.
   La dirección radial de un sector es `(cos θ, 0, −sin θ)`. Con el signo
   positivo sale espejada y los sectores se desplazan de lado.
6. **Suavizar normales a posteriori siempre deja artefactos.** `toCreasedNormals`
   contamina las tapas y su triangulación en abanico lo propaga en estrías; y
   promediar en una pared cilíndrica poligonal deja bandas. La solución no es
   suavizar mejor: es calcular las normales analíticamente al construir, que es
   lo que hace la geometría propia.
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
12. **Por dos puntos pasan DOS cuartos de circunferencia, y solo uno redondea.**
    El casquete del extremo iba del cuerpo a la cara de corte por el arco
    centrado en la esquina viva en vez de por el centrado dentro del material:
    los extremos coincidían, así que parecía correcto, pero la superficie salía
    CÓNCAVA y cada extremo tenía un mordisco redondo de radio igual al canto
    (0,79·b² de material en vez de 0,21·b²). Con el canto grueso se veía como un
    agujero circular en cada junta, y obligaba a abrir mucha separación para
    disimularlo. Un arco mal elegido no da NaN ni revienta ningún test: se ve.
13. **`scene.environment` solo llega a los materiales PBR.** En three es
    literalmente `material.isMeshStandardMaterial ? scene.environment : null`
    (WebGLPrograms). Nuestra escena se ilumina casi entera por IBL y no tiene luz
    ambiente, así que cualquier material que no sea Standard/Physical se queda
    con una sola direccional y sale casi negro. Le pasó a `MeshToonMaterial` y
    después a `MeshLambertMaterial`, que se eligió como recambio creyendo que sí
    respondía al entorno. El acabado "Plano" es hoy Standard con rugosidad 1,
    metalness 0 y un emisivo bajo del propio color, que es lo que lo deja plano
    sin apagarlo.
14. **Una normal reflejada solo se nota en algunos ángulos.** La componente
    tangencial iba con la X al revés, o sea reflejada en el plano X=0: correcta
    en θ≈0, invertida del todo en θ≈±90°. Las caras de corte miraban hacia
    dentro del sólido y se renderizaban negras. Cualquier test con un solo
    sector, según dónde cayera, lo daba por bueno. Los sectores de prueba tienen
    que cubrir los cuatro cuadrantes.

## Problemas abiertos

- **El dev server de Next devuelve 403 en todos los chunks** en esta máquina y
  su WebSocket de HMR falla; la página no hidrata con `npm run dev`. En
  producción funciona. Sin diagnosticar. **Verificar siempre contra `npm run
build` + `npm start`.**
- **La muesca de las esquinas interiores de las caras de corte ya no se ve** en
  capturas ampliadas con el canto al máximo, y lo más probable es que fuera un
  síntoma del arco equivocado del casquete (lección 12). Sigue siendo cierto que
  el rebaje angular es constante (medido en el radio medio) mientras que el
  encogido del perfil es absoluto, así que el canto es un pelo más grueso por
  dentro que por fuera; eso es a propósito, porque mantiene la cara de corte
  plana.
- **En tarta, el canto lo marca el sector más pequeño y queda sutil.** El arco
  se mide en un radio de referencia con suelo (12% del exterior), así que una
  porción pequeña limita el canto de todas. Es el mismo problema de los sectores
  diminutos, agravado porque en tarta el radio de referencia es bajo.
- **Sectores diminutos.** El bevel global lo marca el sector más restrictivo,
  así que una porción por debajo del ~2% deja a todo el donut casi sin canto.
  Opciones: suelo mínimo de bevel, o agrupar automáticamente en "Otros".
- **No hay póster estático ni `?static=1`.** El fallback sin WebGL hoy es la
  tabla de datos, que funciona pero no es bonito. Falta el render en servidor.
- El lector de consola de la extensión de Chrome se traga los logs tras navegar.
  Para depurar, Playwright: captura `console`, `pageerror` y fallos de red.
