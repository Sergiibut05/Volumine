# Estado actual

> **Este archivo es el mecanismo de continuidad entre sesiones.** Una sesión
> nueva no recuerda nada: lo primero que hace es leer esto. Manténlo actualizado
> con `/state` al terminar cualquier bloque de trabajo.
>
> Sé concreto. "Avanzando en el renderer" no vale.

**Última actualización:** 2026-11-18
**Fase actual:** 7 — Marketing y lanzamiento, en pausa. En producción en
`volumine.app`; producto **gratis** con «invítame a un café» (ADR 0008).
**Siete tipos** desde el 18: se añadió `area`.

> ⚠️ **Nada de las dos últimas sesiones está desplegado.** Todo está en commits
> locales sobre `main` sin push, y la migración 0007 sin aplicar. Ver abajo.

## Sesión 2026-11-18: el globo, las barras de varias series y el área

Salió de capturar cada tipo en grande con el embed real y compararlos
(`/embed?c=…` en Playwright). Anillo, tarta y barras de una serie estaban bien.

- **Globo rehecho visualmente** (`renderer/core/globe-materials.ts`). Era un
  disco plano casi negro con un aro duro. El planeta era `MeshBasicMaterial`
  (sin luz); el halo estaba AL REVÉS (máximo lejos del planeta) y con mezcla
  aditiva, que se lava sobre fondo claro; y los puntos salían de ~1 px y
  cuadrados porque `PointsMaterial` con atenuación no divide por `tan(fov/2)`.
  Corregido con `projectionMatrix[1][1]` en el shader. Los marcadores abren un
  claro en el mapa (antes Madrid, violeta, desaparecía sobre puntos violetas).
  Un test avisa si una subida de three cambia las líneas de shader que se
  sustituyen.
- **Barras con varias series AGRUPADAS lado a lado** (`geometry/bar.ts`), en vez
  de filas hacia el fondo. Una etiqueta por categoría («Q1 · 42 · 48») y una
  **clave de series** arriba a la izquierda que se ve aunque las etiquetas estén
  apagadas (`labelLayer.setKey`). Se quitó `BAR_CAMERA_MULTI`. La carrera llama
  a `computeBars` con `grouped: false`: sus series son periodos.
- **Carrera**: el año era invisible sobre fondo claro (gris fijo; mismo fallo
  que tuvo la cifra del medidor) y el editor no lo enseñaba en ningún sitio.
- **Tipo nuevo `area`** (`geometry/area.ts`): losa con canto redondeado cuyo
  perfil sigue los datos con interpolación MONÓTONA. Solo `series[0]`. Zócalo
  de 2,4× el canto para que la geometría sea válida con cualquier dato.
  Triangulación propia «en cremallera» en vez del earcut de three (2,8 KB menos
  de bundle). 22 tests de geometría, incluida estanqueidad y solapes.
  `isStanding()` agrupa barras, carrera y área en el renderer.
- Editor: la carrera enseñaba «radio interior» y «separar trozos», que no hacían
  nada. Arreglado al ordenar los controles por tipo.
- Galería: con siete tipos, área y carrera son tarjetas dobles (`wide` en
  `lib/chart-types.ts`) y queda un 3×3.
- Verificado: 286 unitarios, 15 e2e, tsc, 0 errores de lint, embed
  **153,1 / 180 KB** (+4,1 KB en la sesión). README y capturas actualizados.

**Pendiente de esta sesión:**

- La skill `add-chart-type` pide revisión del subagente `design-critic`: no se
  lanzó (solo se lanzan agentes si lo pide Manuel). La revisión fue a ojo sobre
  capturas de los cinco casos de `/dev/renderer` → «área: …».
- Áreas con VARIAS series (apiladas): no existen. `area` está en
  `SINGLE_SERIES` del editor y el embed solo dibuja `series[0]`.
- Sigue sin haber regresión visual con `toHaveScreenshot`: todo lo de esta
  sesión se comprobó con capturas mirando, no con un test que lo fije.

## Sesión 2026-11-17: fuera el plan de pago, dentro el café

El proyecto llevaba parado desde finales de septiembre. En esta sesión:

- **Plan Pro quitado** (era pago único de 19 €, encendido en producción). En su
  sitio, `/cafe`: 1, 3 o 5 cafés de 3 €, sin cuenta, con mensaje opcional, y
  `/precios` redirige con 308 (`next.config.ts`). Cobra con la `STRIPE_SECRET_KEY`
  que ya estaba puesta y el importe en línea (`price_data`): no hubo que crear
  nada en el panel. **Comprobado en local con la clave real: la ruta crea una
  sesión `cs_live_`.** Todo en `docs/PAGOS.md` y la ADR 0008.
- Borrados: `precios/`, `api/stripe/checkout`, `api/stripe/portal`,
  `lib/billing/admin.ts`. El webhook se queda reducido a verificar firma y
  responder 200 — hay un endpoint dado de alta en Stripe que recibe cada café.
  El último commit con el código del Pro es `b0c1e9c`.
- Condiciones, privacidad, `ENCARGADOS`, datos estructurados, sitemap y todos
  los enlaces de «Pricing» actualizados. «Mis gráficas» ya no dice «plan free».
- **Next 16.3.0 → 16.4.6**: la 16.3.0 tenía varios avisos CRÍTICOS de ejecución
  remota de código (`npm audit`). Más `npm audit fix` sin `--force`: las
  dependencias de producción quedan con **0 vulnerabilidades**.
- `src/middleware.ts` → `src/proxy.ts` (Next 16 deprecó el nombre; misma
  función, mismo `matcher`).
- README reescrito en inglés con capturas en `docs/readme/`, que se regeneran
  con `npm run readme:shots` contra `next start -p 3100`.
- Verificado: build, `tsc`, lint (0 errores), 257 tests, 15 e2e de Playwright
  (añadido `/cafe` al barrido de idiomas) y `perf:embed` 149,0 / 180 KB.

**Lo que quedó a medias y es lo primero que hay que hacer:**

1. **Aplicar `supabase/migrations/0007_sin_plan_de_pago.sql` en producción.**
   Sube el límite gratuito de 5 a 100 gráficas. El MCP de Supabase no conectó
   en esta sesión, así que NO está aplicada: hasta entonces, quien llegue a 5
   gráficas se queda sin poder guardar y ya no hay plan al que pasar. Se pega
   en el SQL Editor del proyecto `butxsqcragkopzxsrukz`.
2. **Desplegar** (push a `main` → Vercel). Hasta entonces producción sigue
   enseñando el plan de 19 € y corriendo Next 16.3.0, con los avisos críticos.

## Dos trampas que ya han mordido, y cómo se reconocen

Las dos comparten forma: un fallo callado que aparece semanas después del
cambio que lo causó. Vale la pena reconocer el patrón.

### El bucket de pósters y `POSTER_FORMATS`

`composePoster()` devuelve JPEG cuando el fondo es opaco y PNG solo cuando hace
falta canal alfa. El bucket `posters` nació aceptando únicamente PNG y WebP, así
que durante semanas Storage rechazó **cada** subida con un 400 y las miniaturas
simplemente dejaron de aparecer. Nadie se enteró porque `subirPoster()` se traga
el error para no bloquear el guardado.

Arreglado en `0006_poster_jpeg.sql`, y el `catch` ya deja rastro en consola.
**La lista de formatos vive en dos sitios** —`src/lib/charts/poster.ts` y el
`allowed_mime_types` del bucket—: si cambia una, hay migración.

### El canvas y `forceContextLoss()`

Un `<canvas>` entrega UN contexto en toda su vida. `dispose()` llama a
`forceContextLoss()` —correcto: un navegador aguanta unos dieciséis contextos
vivos—, y eso deja ese canvas muerto para siempre. Mientras el canvas lo puso el
JSX, React reutilizaba el mismo nodo al remontar (Strict Mode lo hace SIEMPRE en
desarrollo) y el segundo montaje reventaba con un
`Cannot read properties of null (reading 'precision')` que no nombra la causa:
es `getShaderPrecisionFormat(...)` devolviendo `null` sobre un contexto perdido.

Ahora el canvas lo crea y lo destruye el efecto de montaje en `ChartCanvas.tsx`.
**Si algún día vuelve a aparecer ese error, es esto.**

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
- **Globo** con el planteamiento de cobe: la tierra es una nube de ~9.000
  puntos en una sola llamada de dibujo, con halo atmosférico por fresnel y
  marcadores cuyo radio va con la RAÍZ del valor (lo que el ojo compara en un
  círculo es el área). Colores, densidad y tamaños personalizables, y cada tema
  trae los suyos.
- Renderer de donut/pie en three plano: bevel uniforme, sombreado suave, sombra
  de contacto, hover con elevación y tooltip, órbita. El canto al máximo se ve
  bien **con la separación a 0**: los extremos son un redondeo convexo de
  verdad, así que dos vecinos pegados dejan un surco limpio.
- Tabla de datos accesible y `aria-label` generado, siempre en el DOM.
- **153 tests** unitarios de geometría, de contrato y de parseo de datos.

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

## Entrada de datos

**Una sola tabla para todos los tipos**: filas = categorías, columnas = series.
Y en una CARRERA las columnas son PERIODOS, porque el contrato guarda cada
instante como una serie. Eso significa que la tabla que la gente ya tiene en su
Excel —países en las filas, años en las columnas— se pega tal cual y sale una
carrera: no hay formato nuevo que aprender, solo cambia lo que dice la cabecera.

Pegar es la vía principal, no un extra. `src/lib/data-paste.ts` traga TSV de
Excel y Sheets, CSV con coma o punto y coma, y sobre todo **números en formato
español**: "1.234,56" son mil doscientos treinta y cuatro, no uno coma dos. La
regla es que si aparecen coma y punto, el último de los dos es el decimal — vale
para el formato español y el inglés sin saber el idioma de quien copió.

La detección de cabecera tiene un segundo criterio además de "no son números":
una tabla por años lleva cabecera numérica (`2021`, `2022`), que es la forma
exacta de una carrera. Sigue siendo una conjetura, así que se puede cambiar a
mano desde el aviso.

### Detalles del editor que salieron de usarlo

- Los periodos de una carrera se quitan con su aspa, **siempre visible** en la
  cabecera: quitar un periodo es algo que se busca, y si hay que descubrirlo
  pasando el ratón, no existe. Las aspas de FILA sí se ocultan, porque con
  veinte filas serían un muro.
- La duración de cada periodo se ajusta en segundos, no en milisegundos: nadie
  piensa una animación en milisegundos.
- Al pasar a un tipo de una sola serie (anillo, tarta, globo) se **recortan** las
  demás. En un anillo no se dibujan y solo engordan la URL.
- En el globo, escribir "Madrid" rellena sus coordenadas (`src/lib/places.ts`,
  ~95 sitios, insensible a acentos). Es editor-only, así que no gasta
  presupuesto. Además hay un botón para rellenar todas las reconocidas de golpe.
- Un marcador del globo **crece** al señalarlo; no se levanta. Levantarlo lo
  despega del planeta y deja de señalar un sitio, que es lo único que hace.

## Qué toca ahora

1. ~~Correr los tests de RLS.~~ **Hechos, y encontraron una escalada de
   privilegios real** (ver migración 0003). Los 18 pasan. Se corren con:

       SUPABASE_TEST_URL=… SUPABASE_TEST_ANON_KEY=…        SUPABASE_TEST_SERVICE_ROLE_KEY=… npm run test

   **Rota la `service_role`**: se usó la del proyecto principal y pasó por un
   chat.

   Lo que decía antes de esto: Las migraciones ya están aplicadas al proyecto
   `butxsqcragkopzxsrukz` y `.env.local` está puesto, así que la app conecta y
   `/entrar` funciona de verdad. Lo que sigue sin comprobarse son LAS POLÍTICAS:
   `rls.test.ts` necesita además la `service_role` —solo para dar de alta los
   usuarios de prueba— y esa clave no se puede sacar por MCP. Hay que copiarla
   de Project Settings → API y correr:

       SUPABASE_TEST_URL=… SUPABASE_TEST_ANON_KEY=…        SUPABASE_TEST_SERVICE_ROLE_KEY=… npm run test

   Son 18 comprobaciones que hoy se saltan solas. Hasta que corran, los permisos
   son una intención escrita, no un hecho. **Contra una rama de Supabase, no
   contra este proyecto: crean y borran usuarios.**
2. **Activar Google en Supabase → Auth → Providers.** Hace falta un OAuth client
   de Google Cloud; la Redirect URI que pide Google es la de SUPABASE
   (`https://butxsqcragkopzxsrukz.supabase.co/auth/v1/callback`), no la nuestra.
   El magic link ya funciona sin configurar nada.
2. ~~Terminar las etiquetas de datos.~~ Hecho: la capa (la monta el renderer, así
   que editor y embed enseñan lo mismo por construcción), las líneas guía del
   anillo y la tarta, los nombres bajo cada barra, y el resalte al señalar en vez
   de repetir el dato en el tooltip. Falta:
   - **Globo**: la etiqueta sobre el punto ya está, con oclusión de la cara de
     atrás. Faltan los MARCADORES propios al estilo de cobe —pulso, emoji,
     foto—, que es campo nuevo en `style.globe` y no solo colocación.
   - ~~Carrera~~: hecho. La etiqueta viaja con su barra y se reescribe mientras
     corre.
   - **Modo `legend`**: declarado en el contrato y sin implementar, como estaban
     los otros. Es el más barato ahora que existe la capa.
   - ~~El editor no tiene tooltip.~~ Hecho.
   - ~~Modo `legend`~~ y ~~marcadores del globo~~: hechos. La representación de
     datos está **completa**: líneas guía en anillo y tarta, nombres bajo las
     barras, etiquetas viajeras en la carrera, etiquetas con oclusión en el
     globo, leyenda, tooltip en las dos superficies, y marcadores `dot`/`pin`/
     `pulse`. Todo opcional y apagado por defecto.
3. **Tests de regresión visual con Playwright.** Playwright ya está montado y
   corriendo (`playwright.config.ts`, `tests/`), así que lo que falta es solo la
   comparación de capturas contra una referencia — `toHaveScreenshot`.
3. ~~Póster estático.~~ Hecho, pero **sin probar de punta a punta**: nadie ha
   guardado una gráfica todavía, así que la subida a Storage no se ha ejecutado
   nunca. Es lo primero que hay que comprobar al recorrer el camino completo.
4. ~~Deshacer/rehacer.~~ Hecho.
5. ~~El editor solo ofrece anillo, tarta y barras.~~ Hecho: los seis tipos.
6. ~~Traducir la aplicación.~~ Hecha y comprobada en el navegador: landing,
   editor, entrar y «Mis gráficas», en los dos idiomas. Ver la sección de i18n.
7. ~~El CSS del embed está fuera de presupuesto.~~ Arreglado: 5,2 KB de 8. La
   causa era que se enviaba con comentarios. Ver la sección de más abajo.
8. ~~Botón «Copiar iframe» en el editor.~~ Hecho (commit `5157c8c`).
9. Aplicar la migración 0007 y desplegar — ver la sesión 2026-11-17 arriba.

## Decisiones pendientes de Manuel

- [x] ~~Confirmar el nombre "Volumine"~~ y ~~dominio~~: está en producción en
      `volumine.app`. La carpeta sigue llamándose `3d-web-chart` y el
      `package.json` dice `voluma`; da igual para todo salvo para la vista.
- [ ] **Rotar la `service_role`** y, ya que el Pro se fue, **quitarla de
      Vercel**: ya no la usa ninguna ruta. Se pegó en un chat en agosto.
- [ ] Limpieza opcional en Stripe: archivar «Volumine Pro» y su precio, y
      decidir si se borra el webhook (`docs/PAGOS.md`).
- [ ] ¿Marca de agua para todos o solo para quien no invita? Hoy la lleva todo
      el mundo (plan `free`). Quitarla es un `UPDATE`; está escrito en la
      cabecera de la migración 0007.

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

15. **Descarté los países del globo por presupuesto y el razonamiento era
    correcto para lo que estaba mirando, y equivocado para el problema.** Los
    contornos vectoriales sí son 100-200 KB, pero el mapa no tiene por qué ser
    vectorial: una máscara de tierra rasterizada a 0,5° son 6,5 KB comprimidos y
    se genera en build. Antes de dar algo por imposible por su coste, conviene
    comprobar si hay otra representación del mismo dato.

16. **Una lista de campos escrita a mano se queda corta con cada tipo nuevo.**
    La clave que decidía si había que reconstruir la escena enumeraba campos uno
    a uno. El globo llegó con `data.coords` y `style.globe`, nadie los añadió, y
    cambiar una coordenada o mover el slider de densidad no repintaba nada — sin
    dar ningún error, que es el peor fallo posible. Ahora se serializa todo
    `data` y todo `style` salvo lo que se aplica por frame: enumerar lo que NO
    entra es una lista corta y estable.

## Facturación: no hay. Solo cafés

Esta sección decía «preparada y apagada», y llevaba meses siendo falso: el plan
Pro de 19 € estuvo encendido en producción (checkout, webhook y precio en
`plan_limits`). Desde el 2026-11-17 no hay plan de pago: ver la ADR 0008 y
`docs/PAGOS.md`. El esquema (`plan`, `plan_limits`, cuota y marca de agua por
trigger) sigue entero para poder volver a cobrar sin migrar con gente dentro.

## i18n: terminada

Inglés por defecto, español si el navegador lo prefiere, cookie para elegir a
mano. **Toda la aplicación está traducida y comprobada en el navegador**:
landing, editor, entrar y «Mis gráficas».

Cómo está montado (`src/lib/i18n/`):

- **Detección** en `server.ts`: cookie → `Accept-Language` respetando SU orden
  de preferencia (`en-GB,es;q=0.8` da inglés) → inglés.
- **Diccionarios anidados y tipados** en `dictionaries.ts`. Se accede
  `d.editor.save`, no `t('editor.save')`: así una clave que falte en español es
  un ERROR DE COMPILACIÓN. `fill(texto, {marcadores})` para meter datos en medio
  de una frase sin partirla en trozos intraducibles.
- **Se resuelve UNA vez** en el layout y baja por contexto (`client.tsx`).

Tres cosas que hubo que mover de sitio para que esto funcionara, y el porqué:

- **`chart-types.ts` y `themes/index.ts` ya no tienen texto.** Su nombre y su
  descripción están en el diccionario, con el `id` como clave. Los ids se
  quedan porque **viajan dentro de las configs publicadas**: el tema `estudio`
  se sigue llamando `estudio` aunque en inglés se lea «Studio». De paso, el
  módulo de temas entra en el bundle del embed y ahora entra sin copia.
- **`data-paste.ts` devuelve códigos, no frases** (`{code:'empty-cells',count}`).
  Un módulo que lee un portapapeles no sabe quién está mirando; le pone las
  palabras quien las enseña. Los nombres de relleno («Fila 3») llegan por
  `options.names`.
- **`initialConfig()` vive en `lib/config/initial.ts`**, no en `Editor.tsx`.
  Desde un módulo `'use client'` se puede importar una CONSTANTE en el
  servidor, pero no llamar a una FUNCIÓN: da «Attempted to call initialConfig()
  from the server». Pasó de constante a función porque las etiquetas de muestra
  dependen del idioma.

**Los datos de EJEMPLO sí se traducen** (`lib/i18n/samples.ts`). No contradice
la regla de abajo: son copia nuestra disfrazada de datos, y llegar al editor y
ver «Suscripciones / Servicios / Licencias» habiendo pedido inglés se lee como
un producto a medio hacer. En cuanto alguien escribe lo suyo, desaparecen.

**Lo que NO se traduce, y es decisión cerrada:** la gráfica ya publicada. Sus
etiquetas, su título y su formato de número son de quien la hizo. Una gráfica en
español se ve en español la mire quien la mire, igual que un gráfico en un
periódico. Eso además deja el bundle del embed sin una línea de i18n, y hay una
prueba que lo vigila.

### Y ahora sí hay Playwright

`playwright.config.ts` + `tests/i18n.spec.ts`, 8 pruebas en verde. Corre contra
`next start` (no contra `dev`, que en esta máquina no hidrata), así que hace
falta `npm run build` antes de `npm run test:e2e`.

Lo que comprueba: que ninguna de las tres pantallas tenga restos del otro
idioma —con el editor DESPLEGADO y recorriendo los seis tipos, porque media
interfaz está detrás de un `<details>`—, que el selector cambie la pantalla y
deje la cookie, y que `/embed` no lleve i18n encima.

**Existe porque `tsc` no sirve para esto.** Garantiza que los dos diccionarios
tengan las mismas claves y no dice nada de una frase escrita a pelo dentro de un
componente. Tres restos —el botón «Copiar link» de la barra de compartir, los
nombres de los temas y las etiquetas del héroe— pasaron tipos, lint, 198 pruebas
y un build limpio, y solo cayeron al leer la página de verdad.

Trampa que costó un rato: **Playwright manda su propia cabecera
`Accept-Language` a partir de la opción `locale`** (`en-US` por defecto) y esa
gana sobre `extraHTTPHeaders`. La prueba pedía español, recibía inglés y
culpaba al código. Se configura con `test.use({ locale })`.

## El póster lleva el fondo que la persona eligió

Antes no: el póster se captura del CANVAS, y con «degradado» el fondo no está
ahí — se pinta con CSS en el contenedor, por detrás (decisión de
`chart-renderer.ts`: un degradado de CSS se compone a resolución de pantalla y
no tiene banding). Alguien elegía un degradado azul, guardaba, y en Slack salía
su gráfica recortada sobre blanco.

Se compone en 2D al capturar, en `lib/charts/poster.ts`, y **no en el
renderer**: el renderer entra entero en el bundle de `/embed` y el embed no
captura pósters jamás.

**El formato cambia con el fondo, y esa es la mitad del arreglo.** Un degradado
suave es lo peor que se le puede dar a un PNG —no hay dos filas iguales, así que
no comprime— y el mismo póster medía **2602 KB en PNG contra 92 en JPEG**. Eso
acaba en `og:image`: un scraper que tiene que descargar 2,6 MB es un enlace sin
vista previa. Así que PNG solo cuando hace falta alfa (fondo transparente, donde
la transparencia ES lo que se quiere) y JPEG cuando el fondo es opaco.

Medido en `/dev/renderer` con un anillo a 2000×1600:

| fondo        | formato | peso    |
|--------------|---------|---------|
| transparente | JPEG    | 91 KB   |
| sólido       | JPEG    | 92 KB   |
| degradado    | JPEG    | 96 KB   |

WebP pesaría la mitad que el JPEG y **no se usa a propósito**: el soporte entre
scrapers de vista previa es irregular, y esta es justo la superficie donde no se
puede apostar.

Como la extensión cambia, al reguardar se borra la del otro formato: cambiar de
transparente a sólido dejaba `slug.png` sin que lo apuntara nadie, ocupando
sitio en el bucket para siempre.

### Y el transparente también se aplana

Con fondo transparente el póster salía con alfa, y en una tarjeta de enlace eso
lo rellena cada cliente con SU color: Slack en oscuro lo pone negro, Notion
blanco. Una gráfica oscura desaparecía en Notion. Ahora se aplana sobre un
neutro (`#f4f4f7` o `#101018`) y el link se ve igual en todas partes.

**Qué decide cuál: un campo `surface` en el tema**, no un cálculo. El primer
intento fue elegir por contraste —mirar la paleta y quedarse con el fondo que
dejara mejor al color que peor se viera— y los números sobre los temas de verdad
lo tumbaron: a «estudio», descrito literalmente *«para incrustar en páginas
claras»*, le ponía fondo negro. Dos motivos de fondo:

1. El contraste de WCAG mide elementos PLANOS. Una gráfica de Volumine se
   distingue de su fondo por el brillo, el canto y la sombra proyectada, no por
   diferencia de luminancia. Era medir con la regla equivocada.
2. Las paletas están hechas para que los sectores se distingan ENTRE SÍ, no de
   un fondo, así que casi todas cubren mucho rango. Con rango completo **no
   existe ningún color plano** que las deje todas legibles — demostrado en
   `backdrop.test.ts` con la paleta de «estudio», y queda como prueba para que
   nadie endurezca la promesa sin ver por qué no puede.

El tema, en cambio, ya sabía sobre qué superficie va: lo decía su descripción.
Ahora lo dice también su código.

**Lo que se pierde**, y está escrito en el código: el alfa. Servía para un solo
uso —el respaldo sin WebGL dentro de la página anfitriona— y ese respaldo hoy no
existe (es la tabla de datos). El día que se construya harán falta dos imágenes,
no una.

## Las etiquetas ya se pueden vestir

`labels.font` y `labels.color` **estaban en el contrato desde la v1 y no hacían
nada**. Solo `size` funcionaba. Por las reglas del propio proyecto eso es un bug
de contrato —un campo declarado que no se implementa—, y ahora los tres
funcionan, más un `finish` nuevo.

### `font`: tres voces, ninguna descargada

Las tres opciones son familias DEL SISTEMA. En `/embed` no se puede descargar
ninguna (regla 1, ADR 0005) y una fuente propia son 15-40 KB por peso, en la
página de otra persona, para escribir cuatro etiquetas. `inter` → palo seco,
`display` → serifa, `mono` → monoespaciada. El id `inter` viene de la v1 y no se
puede renombrar: viaja dentro de links publicados.

**Y se aplican las mismas en el editor y en el embed**, que antes no era el
caso: el editor heredaba la tipografía de la aplicación y el embed la del
sistema, así que la misma config daba píxeles distintos en cada sitio. Era una
grieta en lo único que este proyecto promete.

### `finish`: tres envoltorios, y por qué solo tres

Campo NUEVO, opcional y con default `glass`: una config publicada sin él se ve
exactamente igual que antes.

| valor | qué es |
|---------|------------------------------------------------|
| `glass` | la píldora translúcida de siempre |
| `solid` | opaca y sin desenfoque; más ligera en móvil |
| `plain` | sin caja, texto con halo del color contrario |

Los tres se leen sobre blanco, sobre negro y sobre una foto — comprobado en el
embed con los dos fondos. **No hay un color libre para la caja y no lo va a
haber**: el embed corre dentro de la página de otra persona y no sabemos qué hay
detrás. Un color libre sería la forma más rápida de que alguien publique una
gráfica ilegible en la web de un cliente. Por eso `plain` tampoco es «texto
suelto» sino texto con halo, y el halo se CALCULA —claro si la tinta es oscura y
al revés—: con un halo negro fijo, quien ponga texto negro se queda sin nada.

## Y el CSS del embed ya entra en presupuesto

Llevaba tiempo al doble (13,8 KB contra 8) y la causa no era el CSS: era que
`embed.css` se leía del disco y se insertaba **entero, comentarios incluidos**,
en el HTML de cada embed. De 16,6 KB, **10,5 eran prosa**.

`scripts/minify-css.mjs` los quita al servir. Los comentarios se quedan en el
fuente —explican decisiones que no se ven en el código— y salen del cable:
**16,6 KB → 5,2 KB**, con 3 KB de margen para lo que venga.

Es `.mjs` y no TypeScript para que lo usen los dos: el servidor y
`perf-embed.mjs`, que ahora mide lo que de verdad se envía en vez del fuente.
Con dos copias, la medida y la realidad se separan al primer cambio.

No es un minificador de verdad a propósito: son dos transformaciones legibles
sobre un fichero que escribimos nosotros, sin `url()`, sin `@import` y sin
cadenas. Lo que NO hace está en los tests — no toca los espacios de
`rgb(a b c / d)` ni los operadores de `calc()`, que son los que al quitarlos
rompen la regla entera y en silencio.

## Tipografías propias en el embed

**Yo defendía que tres familias del sistema eran lo correcto, y estaba
equivocado.** El argumento era que solo `sans`, `serif` y `mono` están
garantizadas en todas partes. Es cierto y es irrelevante: garantizan que la
fuente EXISTA, no que se vea igual. Medido en Chromium:

| familia | ancho de «Suscripciones 42 k€» |
|--------------------------|-------------------|
| `ui-serif` → Georgia (Windows) | 134,2 px |
| sin Georgia → Times New Roman | 109,1 px |

**Un 23% con la misma config**, y en macOS `ui-serif` es New York, ni una ni
otra. Eso decide si una etiqueta cabe, dónde acaba su línea guía y si
`fitLabels()` la descarta. Las fuentes del sistema son lo que ROMPE «mismo
config, mismos píxeles»; una fuente nuestra es la única forma de cumplirlo.

### Cómo está montado

`scripts/build-embed-fonts.mjs` recorta tres fuentes con licencia abierta y las
deja en `public/embed-fonts/` (generado, fuera del repo, como el bundle). Se
sirven desde nuestro dominio: sin Google, sin cookies, sin que nadie vea la IP
de los visitantes de un cliente.

**El coste solo lo paga quien elige.** El valor por defecto es `system`, que no
descarga nada — un embed que no toca la tipografía sigue siendo un archivo y una
petición, como anuncia la landing. Comprobado en el navegador mirando lo que se
PIDE, no lo que dice el HTML.

Dos decisiones que salieron de medir:

- **El eje de grosor se recorta a 400-600**, los dos que usan las etiquetas. El
  eje entero de Inter son 30,1 KB; de 400 a 600, 20,6. Fijar uno solo bajaría a
  12,3 pero obligaría a falsear la negrita.
- **Podar los glifos alcanzables solo por sustitución** ahorra de 6 a 10 KB...
  **y `tabular-nums` ES una sustitución.** Podado en Inter, «111» medía 48,8 px
  y «999» 74,4: los números de una carrera de barras bailando en cada
  fotograma, sin que nada fallara. Por eso es una decisión POR FUENTE, y por eso
  `tests/fonts.spec.ts` carga las tres en un navegador de verdad y comprueba que
  las cifras cuadran, que los dos grosores difieren y que los acentos están.

**Cobertura:** latín completo con acentos. Polaco, checo y turco van en un corte
aparte con `unicode-range`, así que una gráfica en español no descarga un byte
de él. Griego, cirílico y CJK caen a la fuente del sistema, como hasta ahora.

**Lo que sigue fuera, y no por peso:** Google Fonts (un tercero mirando a los
visitantes de nuestros clientes) y subir tipografías propias (redistribuiríamos
ficheros cuya licencia no controlamos).

## Quince temas

De seis a quince. Cada uno con **superficie declarada, material y entorno
propios** — no son nueve paletas sobre la misma receta. Los nuevos:

| tema | superficie | material | para qué |
|---------|---------|----------|-------------------------------------------|
| menta | claro | mate | informe largo donde el color no debe gritar |
| coral | claro | plástico | marketing y redes |
| indigo | claro | plástico | presentación de empresa |
| escala | claro | mate | **un solo tono**, para datos de menos a más |
| tierra | claro | mate | junto a fotografía o texto impreso |
| prensa | claro | plano | estilo periódico, contraste puro |
| hielo | claro | **vidrio** | el único con ese material; pocas categorías |
| bosque | oscuro | plástico | verdes profundos |
| neon | oscuro | plástico | panel en pantalla grande |

`escala` no tiene color de acento **a propósito**: es para datos ordinales,
donde un color distinto por categoría sugiere que son cosas distintas y no lo
son.

**Validados renderizados**, que es lo que pide la regla de `themes/index.ts`:
los nueve contra anillo, barras, globo y medidor sobre su propia superficie, y
además cada uno sobre el fondo contrario. No es burocracia — de mirarlos salió
un fallo que no se ve en el código: **las bases de globo casi blancas las
aplasta a gris el mapeado de tono (ACES)**, así que el planeta perdía el color
del tema y los siete claros salían idénticos. Se subió la saturación de las
bases; `prensa` se queda en blanco puro porque su gracia es el contraste.

### El «ver más»

Seis a la vista y el resto a un clic. Es el primer grupo del panel —«empieza por
aquí»— y quince fichas ahí no son quince opciones: son una pared que hay que
leer antes de poder hacer nada.

El tema ELEGIDO se cuela siempre en la lista corta aunque esté en la parte de
abajo. Sin eso, al recargar una gráfica con un tema de los últimos el control se
quedaba sin ninguna ficha marcada y parecía que no había tema.

## La landing por pantallas

**Las dos primeras secciones ocupan la pantalla entera** (`min-height: 100svh`,
no `100vh` — en un móvil `vh` cuenta con la barra del navegador retraída y
siempre asoma un trozo de la siguiente).

La ficha técnica dejó de ser una sección aparte: **es el pie del héroe**. Suelta
medía 142px y quedaba como una tira flotando entre dos pantallas, sin ser ni el
final de una ni el principio de la otra. Ahora la primera pantalla es una sola
idea: titular, objeto y sus medidas.

### La costura entre la primera y la segunda

El fondo oscuro vive en un `::before` con las cuatro esquinas redondeadas: eso
convierte el corte en una LÁMINA apoyada sobre el papel en vez de en una
frontera a media página, y no cuesta nada porque es estático. El gesto lo pone
la entrada, con `animation-timeline: view()` — scroll nativo del CSS, fuera del
hilo principal y **sin instalar nada**. Aquí importa más de lo normal: la página
existe para decir que esto no arrastra setenta kilobytes de librería para mover
una caja, así que resolverlo con GSAP habría sido contradecirse en la propia
demostración.

Tres cosas que la guía de web moderna corrige y que hay que respetar:

- El `@supports` comprueba **también** `animation-range`. Hay navegadores con
  `animation-timeline` a medias, y sin esa segunda condición se quedarían con
  los elementos invisibles para siempre.
- Se animan **solo `opacity` y `transform`**. La primera versión animaba el
  `border-radius` de la banda —bonito y equivocado—: el radio no se compone, se
  repinta, y repintar una caja de pantalla completa en cada fotograma de scroll
  es justo lo que esta página no puede permitirse.
- Como el gesto es decorativo, donde no exista (Firefox) **no hay respaldo**: se
  ve igual, sin el gesto. Y bajo `prefers-reduced-motion`, tampoco.

Tres fallos propios en el camino, los tres invisibles en el código:

- `.enuso > .shell > *` tiene dos clases y **le gana en especificidad** a
  `.escena`, así que la escena se quedaba con el desplazamiento genérico y nunca
  hacía lo suyo. De ahí el `:not(.escena)`.
- `position: relative` a secas **no crea contexto de apilamiento**, así que el
  `z-index: -1` de la lámina se escapaba hasta la raíz y se pintaba detrás del
  papel: la banda oscura desaparecía entera y el texto blanco se quedaba sobre
  fondo claro. De ahí el `isolation: isolate`.
- Y antes de eso, con la sección en `static`, el `::before` se colgaba del
  viewport y sus esquinas redondeadas acababan fuera de pantalla.

### La sección «en su sitio» ya no repite forma

Pasó de anillo a **barras**. El héroe ya enseña un anillo y con los dos iguales
la página parecía tener un solo truco en sus dos primeras pantallas; barras
además es lo que de verdad lleva un informe trimestral, así que el decorado y la
gráfica dicen lo mismo.

El tema se quedó en **`estudio`**, que era lo que pedía Manuel, pero costó una
corrección: con la escala de grises la barra MAYOR es la más oscura y sobre la
diapositiva se perdía entera — justo la que lleva el argumento. En el anillo no
pasaba porque la porción oscura iba rodeada de claras y el conjunto se leía como
una forma; con barras cada una está sola contra el fondo.

**Se arregló aclarando el DECORADO, no la gráfica**, y es la decisión correcta:
el mismo embed pasa por papel blanco y por el grafito sin recargarse, así que no
puede vestirse distinto según dónde esté. La diapositiva subió a un grafito medio
(`#55556b → #3c3c4c`), que además la separa mejor de la banda.

Y lleva `style.shadowAngle: 150` con `bevel: 0.38`. Por defecto la sombra cae
hacia la izquierda, que en el documento es donde está la mancha de texto: se
metía debajo de las líneas y en la diapositiva se salía por el borde. Girada cae
en el hueco que la propia composición deja libre — que es exactamente para lo
que se añadió el control.

## Un solo embed, y alrededor cambia el mundo

`src/app/(site)/EnUso.tsx`. Hay un `<iframe>` de `/embed` DE VERDAD y **no se
desmonta nunca**: lo que se mueve es el decorado —un documento de papel, una
diapositiva oscura, un panel de tarjetas—, que va rotando solo cada 4,2 s. La
gráfica ni parpadea ni se recarga: sigue girando sin cortar mientras cambia de
sitio y de tamaño en cada uno.

Esa continuidad ES el argumento. Tres capturas distintas dicen «aquí hay tres
imágenes»; una sola que no corta el giro dice «es la misma cosa, y encaja en
todo», y eso se entiende en dos segundos sin leer una palabra. De paso demuestra
sola la promesa más difícil de contar: al pasar de papel claro a diapositiva
oscura, la gráfica se apoya en las dos SIN traer un rectángulo de fondo — que es
lo que significa el fondo transparente, y contarlo con palabras nunca funcionó.

Técnicamente todo depende de dos decisiones:

1. **El hueco es un único nodo del DOM.** Un contenedor por decorado obligaría a
   montar tres iframes y destruiría el efecto.
2. **Lo único que se anima es `transform`.** La primera versión animaba
   `left/top/width/height` y la gráfica PARPADEABA al cambiar de decorado.
   Cambiar el tamaño de un `<iframe>` sesenta veces por segundo obliga al embed
   de dentro a reasignar su framebuffer, recalcular la densidad y reencuadrar la
   cámara en cada fotograma, y al navegador a re-rasterizar el documento
   incrustado entero. **En capturas fijas se veía perfecto; solo se nota en
   movimiento** —lo cazó Manuel mirando la página, no ninguna medición mía—.
   Con `transform` nada de eso llega al iframe: se compone en la GPU y el canvas
   ni se entera. Medido: el canvas se queda en 1322×944 antes, durante y después
   de la transición; antes se reasignaba en cada fotograma.

   Las escalas son todas ≤ 1 a propósito: el tamaño base es el del decorado más
   grande, así que aquí solo se reduce. Ampliar un iframe compuesto lo dejaría
   borroso, que es el mismo mecanismo que emborronaba la etiqueta dentro de
   Canva.

- Las etiquetas van en `finish: 'solid'`. Con `plain` hay que elegir un color de
  tinta, y el mismo embed pasa por papel blanco y por fondo oscuro sin
  recargarse: cualquier tinta fija se vuelve ilegible en uno de los dos.
- El ciclo se para en cuanto alguien pulsa una pestaña, no cicla si la sección
  no se está viendo, y no cicla con `prefers-reduced-motion`.
- La diapositiva es grafito AZULADO y no negro: la píldora de las etiquetas es
  casi negra y sobre negro se fundiría. Y bastante más clara que la banda: con
  el primer gris, decorado y fondo eran casi el mismo color y la frontera
  desaparecía otra vez.
- **El panel es el que más costó.** Con la gráfica flotando sobre el fondo y
  tres tarjetas sueltas no parecía un panel: parecía cuatro cajas con medio
  fondo vacío. Lo que le faltaba era densidad y jerarquía de widgets. Ahora
  lleva barra con rango, la gráfica dentro de una **celda blanca con su propio
  titulillo** —en un panel de verdad la gráfica no flota, vive en una tarjeta— y
  una columna con tres indicadores CON variación más un **desglose con los
  mismos datos que la gráfica**. Eso último es lo que lo vuelve creíble: en un
  panel real el mismo dato aparece dos veces, dibujado y en cifras. Las
  variaciones van en gris y no en verde/rojo — un semáforo pide que se lea el
  dato, y aquí el dato da igual: lo que importa es que se lea como un panel.
  La celda la pinta el decorado y no el hueco, así que sus cifras y las de
  `PUESTOS.panel` hay que moverlas juntas.
- En móvil la gráfica NO viaja: se queda abajo, centrada y a todo lo ancho. El
  `transform` por decorado se anula ahí con un `!important`, que es lo correcto
  porque el desplazamiento lo pone el componente como estilo en línea.

### Por qué la banda es oscura

La versión anterior era un documento de papel blanco sobre el papel pálido de la
página, y se leía como **otra tarjeta más de la propia landing**: no había
frontera que cruzar, así que prometía «vive dentro de otra página» y no enseñaba
ninguna otra página. Con el suelo oscuro el papel pasa a ser un objeto ajeno
flotando delante, y la sombra —que ya existía, de tres capas— por fin se ve
contra algo. No contradice `docs/DESIGN.md`: pide un set de fotografía de
producto, y cambiar el ciclorama detrás del mismo objeto es exactamente lo que
hace un fotógrafo de producto.

### Y por qué NO lleva ventana de navegador ni interfaces ajenas

Los tres decorados son genéricos. Ni los tres puntitos de macOS —el cliché
número uno del sector, prohibido por `docs/DESIGN.md`— ni copias de la interfaz
de Notion, Canva o Framer. Nombrar productos compatibles es legítimo y se hace
en la tira; reproducir su interfaz ya no identifica, imita, y además obliga a
mantener tres imitaciones de UIs que cambian solas.

Tampoco se convirtió el texto de los decorados en bloques grises de wireframe,
que es el consejo habitual: bloques grises = maqueta de Figma, y el argumento
entero de la sección es que esto es real. El problema de jerarquía —el titular
falso competía con el de verdad— se arregló bajando tamaño y contraste del texto
REAL.

## La tira de compatibilidad

Debajo, en la página clara: «Si acepta un link, acepta Volumine» y los sitios,
con **logotipo y nombre**. Los paths están congelados en `src/lib/logos.ts`.

Salieron UNA SOLA VEZ de `simple-icons` (CC0), que publica las versiones
monocromas oficiales; el paquete no se quedó como dependencia, así que la página
no le pide nada a nadie y los paths viajan en el propio bundle. **No están
dibujados a mano**: reproducir un logotipo de memoria lo deforma, y no
deformarlo es lo primero que piden todas las guías de marca.

Van en **gris plano**, nunca en el color de la marca — usar el color de marca
acerca el logo a un uso promocional, y en gris se queda donde tiene que estar,
diciendo «esto funciona ahí». Y el copy dice «funciona en», jamás «partner de»:
lo que hace legítimo nombrar a otro es identificar compatibilidad, no insinuar
una relación que no existe.

**CANVA va sin logotipo, y no es un descuido.** De los 3453 iconos del paquete
ese es justo el que falta, y simple-icons retira una marca cuando su titular se
lo pide. Ante esa señal, su nombre va en texto —uso nominativo puro, que no
reproduce nada—. Si algún día hace falta el logo, sale de su media kit y de
ningún otro sitio.

## Dos fallos que solo salieron mirando la pantalla

- **El tirador de la versión anterior parecía un botón de PAUSA.** Dos barras
  verticales dentro de un círculo blanco, encima de una gráfica que gira: el
  único significado que se le encuentra es «parar la rotación». Un control que
  promete lo contrario de lo que hace es peor que no tenerlo.
- **La landing entera tenía scroll horizontal en el móvil**, desde el principio.
  `.stagebox` tenía `min-height: 340px` con `aspect-ratio: 4/3`: el navegador
  despeja el ancho —453px— y en una pantalla de 400 no cabe. Como el héroe es
  una rejilla, arrastraba a toda la fila, titular incluido.
- **El titular del héroe partía «Tus datos, / con / volumen.»** No era el tope
  cuatro píxeles alto —a 1440 la frase medía 510 y la columna medía 510 exactos—
  era la REFERENCIA: el `clamp` iba en `vw` mientras el hueco donde vive es la
  mitad de ancho que la ventana. Ahora va en `cqw` contra su propia columna.
- **La línea guía de la etiqueta tachaba el valor.** `label-layer.ts` la hacía
  morir en `y + alto/2`, el centro vertical de la caja — que con nombre Y valor
  son dos líneas, así que caía en la franja del número. En la columna derecha el
  codo llega justo hasta donde empieza el texto y el «42 k€» salía TACHADO. Ahora
  muere a la altura del nombre. Con `showValues` apagado no se ve nunca, porque
  entonces las dos medidas coinciden — por eso llevaba tanto ahí.

## Las etiquetas se movían a tirones

`label-layer.ts` colocaba la caja con `Math.round()` a píxel entero mientras su
línea guía se dibujaba con decimales. Con la gráfica girando a velocidad normal
la etiqueta avanza del orden de un píxel cada seis fotogramas, así que se
quedaba clavada y luego pegaba un brinco — y peor: el texto y la línea que lo
señala iban desincronizados en cada paso.

**Medido antes y después**, que es lo único que distingue arreglarlo de creer
haberlo arreglado:

| | fotogramas quieta | paso máximo |
|---|---|---|
| antes (`Math.round`) | 66 de 79 | 1,000 px |
| cuantizado al píxel del dispositivo | 54 de 79 | 0,500 px |
| **sin cuantizar, `translate3d`** | **0 de 79** | **0,190 px** |

Cuantizar al píxel del dispositivo en lugar del de CSS solo parte el salto por
la mitad: sigue habiendo salto. Lo que lo quita es no cuantizar.

El motivo por el que se redondeaba —que un texto en posición fraccionaria se
rasteriza distinto en cada fotograma y parece hervir— aquí no aplica: la caja
lleva `will-change: transform`, así que tiene su propia capa de composición. El
texto se rasteriza UNA vez y lo que se mueve es la capa ya pintada. Comprobado
con captura ampliada a 2x: sigue nítido.

## El vaivén de las barras no se veía

En barras y en bar-race, `autoRotate` no da vueltas: es un vaivén de ±13°. Pero
`motion.speed` está en VUELTAS POR MINUTO, y se aplicaba tal cual. Resultado
medido: a 0,35 la gráfica recorría **1,5 px en tres segundos** y el valor de
fábrica —0,9— tardaba más de un minuto en completar una ida y vuelta. En la
práctica, el control de vaivén del editor no hacía nada en toda su mitad baja,
que es donde está casi todo el mundo.

`BAR_SWAY_RATE = 6` deja el valor de fábrica en unos once segundos por ciclo.
No toca la AMPLITUD —el vaivén sigue midiendo lo mismo— solo cada cuánto va y
viene. Medido después: 0,35 pasa de 1,5 px a 10,9 px en cuatro segundos.

Es un cambio cosmético, no de contrato: un link publicado sigue funcionando y
mostrando lo mismo, solo que ahora se mueve a un ritmo que se percibe.

## La etiqueta que aparecía y desaparecía

En una gráfica de barras, la etiqueta de más a la derecha se apagaba y se
encendía sola durante el vaivén. **Costó tres intentos y los dos primeros están
aquí porque explican por qué el tercero es el bueno.**

El fallo no era el umbral: era que la decisión se tomaba con las POSICIONES
PROYECTADAS, y esas se mueven con la animación. Medido: ocho apagados y
encendidos en veintiún segundos, siempre en la misma etiqueta —la última en el
orden de descarte—.

1. **Histéresis** (dos umbrales). Bajó de 8 cambios a 8… y luego, subiéndola
   hasta que dejaba de parpadear, la etiqueta se apagaba en el momento más
   apretado del ciclo y **ya no volvía nunca**. Peor que el parpadeo.
2. **Tolerar un tercio de solape.** Cero parpadeo, pero en un lienzo estrecho
   los nombres quedaban montados unos sobre otros e ilegibles.
3. **Decidir con el ANCHO DEL LIENZO**, que es lo que hace un eje de gráfica de
   toda la vida: no «¿choco ahora mismo?» sino «¿cuántas caben aquí?», y se
   enseña una de cada N. La respuesta no depende del fotograma, así que no puede
   parpadear; y como las barras no se reordenan, la que se enseña es siempre la
   misma.

Medido después, con vaivén activo durante 21 s: **cero cambios de visibilidad**
a 420, 560, 700 y 1000 px, y en el globo. A 420 se ven 2 de 4 —sin solaparse—,
de 560 en adelante las 4.

De camino se arregló un fallo de fondo que nadie había mirado: el test de solape
**solo comparaba la X**. En barras cada etiqueta va a la altura de su barra, así
que dos vecinas de alturas distintas comparten columna sin tocarse; se estaban
apagando etiquetas que no se pisaban. El criterio nuevo no lo necesita, pero el
diagnóstico vale para cualquier capa que vuelva a mirar esto.

`OCUPACION = 0.8` porque la fila de barras no llena el lienzo —hay margen a los
lados y la perspectiva junta las del fondo—, y el diezmado se aplica **solo a
`point`**: en un globo los marcadores no van en fila y «una de cada N» dejaría
fuera media esfera.

## Páginas legales

Cuatro rutas bajo `/legal`: aviso legal, privacidad, cookies y condiciones de
uso, enlazadas desde el pie de todas las páginas —el art. 10 de la LSSI pide que
estén disponibles de forma «permanente, fácil y directa», y una página a la que
solo se llega escribiendo la URL no cumple—. Todo el detalle y el checklist de
lo que queda fuera del repositorio, en **`docs/LEGAL.md`**.

**No es asesoramiento jurídico**: es el andamiaje, ajustado a lo que el producto
hace de verdad, y tiene que revisarlo alguien que sepa antes de abrir.

Lo que sí está hecho con rigor es que el texto **describe el código y no una
plantilla**:

- Las categorías de datos salen del esquema real (`supabase/migrations`).
- Los encargados viven en `src/lib/legal.ts` y la política los pinta desde ahí:
  cada servicio nuevo que vea datos de usuarios entra en esa lista antes de
  entrar en producción, y aparece solo en la tabla.
- **Las cookies están auditadas, no supuestas.** Son dos y las dos técnicas:
  `sb-…-auth-token` y `volumine-locale`. Por eso **no hace falta banner** —
  exención del art. 22.2 LSSI—. En cuanto entre una sola herramienta de
  analítica, esa exención desaparece y hay que reescribir la página; las dos
  cosas van juntas y está dicho en el propio fichero.
- Lo que la política afirma del embed está **medido**: 0 cookies y 0 peticiones
  a terceros. Es la regla dura nº 1 del proyecto, así que es verificable en cada
  build, no una promesa comercial.

### Los datos del titular bloquean la publicación

`TITULAR` en `src/lib/legal.ts` está en `null` a propósito: nombre, NIF,
domicilio, correo y dominio no los puede inventar nadie. Mientras falte
cualquiera, las páginas legales muestran un aviso rojo bien visible. Sin él, la
página se ve entera y correcta salvo por unos «[pendiente]» que se pierden entre
el texto — y un aviso legal sin NIF no es un documento incompleto, es un
incumplimiento.

`ULTIMA_REVISION` se actualiza **a mano**: una fecha que cambia sola cada día es
una mentira sobre la vigencia del documento.

### Están en castellano y sin traducir

Es una decisión. El establecimiento es español y estos textos se interpretan bajo
derecho español; una traducción sin revisión produce dos documentos que no dicen
lo mismo, y el que vale es el original. Si hace falta la versión inglesa, se
traduce con revisión y se dice cuál prevalece.

## Fuera el enlace mágico: Google, o correo y contraseña

El motivo no es de gusto. El enlace mágico convierte **cada** inicio de sesión en
un correo que tiene que llegar: si tarda, se pierde o cae en spam, no hay
reintento posible —quien no entra, se va— y el remitente pasa a ser el punto más
frágil de todo el producto. Con Google no se manda ninguno; con contraseña, dos
por cuenta en toda su vida.

- `signInWithPassword` y `signUp`, con el mismo formulario en tres modos: entrar,
  registrarse y recuperar.
- Recuperación completa: `resetPasswordForEmail` y una página nueva,
  `/entrar/nueva-clave`, para poner la contraseña. **Es de cliente
  obligatoriamente**: el token viaja en el FRAGMENTO de la URL y el fragmento no
  se manda nunca al servidor, así que un componente de servidor ahí no vería nada.
- El `autocomplete` cambia solo: `current-password` al entrar y `new-password` al
  registrarse. Es lo que hace que el gestor de contraseñas ofrezca rellenar en un
  caso y generar en el otro; con el valor equivocado propone la contraseña vieja.
- Los errores no acusan a la entrada equivocada. Unas credenciales malas dicen
  «revisa los dos», no «la contraseña es incorrecta»: ese segundo mensaje le
  confirma a quien va probando direcciones cuáles tienen cuenta. Igual al
  recuperar — se responde lo mismo haya cuenta o no.

### Lo que hay que tocar en el panel de Supabase

- [ ] **Auth → URL Configuration → Redirect URLs**: añadir
      `https://volumine.app/entrar/nueva-clave`. Sin eso el enlace de
      recuperación no vuelve a ninguna parte.
- [ ] **Auth → Providers → Email**: dejar *Confirm email* ACTIVADO. Sin él,
      cualquiera puede registrarse con una dirección que no es suya.
- [ ] **Auth → Policies**: subir el mínimo de contraseña a 8. El formulario ya lo
      exige en el cliente, pero el que manda es el del servidor.
- [ ] **Auth → Providers → Google**: sigue pendiente de dar de alta, y ahora es la
      vía principal de entrada.
- [ ] **Auth → Rate Limits**: revisar el tope de correos, que es de Supabase y no
      de Gmail.

## Problemas abiertos

- ~~Las sombras tienen dientes de sierra.~~ **Arreglado**, y era la sospecha
  barata: el volumen de la cámara de sombra estaba FIJO en 5,2 × 5,2 unidades,
  puestas a ojo para el peor caso. Un anillo normal ocupa unas 2,8, así que de
  los 1024 téxeles del mapa la sombra usaba poco más de la mitad por eje. El
  escalón eran téxeles grandes.

  Ahora se ciñe a la escena en `renderer/core/shadow-volume.ts`. **No se ha
  tocado `mapSize` ni el tipo de filtro**: subir la resolución es cuadruplicar
  memoria y relleno en cada fotograma, y no ha hecho falta. El bundle sube 0,4
  KB gz (147,7 → 148,1).

  Tres cosas que están en los comentarios porque no se ven en el código, y las
  dos últimas costaron una segunda pasada:

  · La huella horizontal tiene que salir del **radio barrido por el giro**, no
    de la caja envolvente del instante. Una caja que cambia al girar recoloca
    los téxeles cada fotograma y la sombra «nada» por el suelo — más feo que el
    escalón.
  · El plano lejano tiene que llegar hasta el suelo **DONDE CAE LA SOMBRA**, no
    hasta el suelo que hay debajo de la pieza. La primera versión hacía lo
    segundo, y la sombra no cae debajo: cae desplazada hacia donde apunta la
    luz. Todo lo que quedaba más allá se pintaba iluminado, así que la sombra
    salía **cortada por una recta** — el plano lejano visto de canto. Ahora se
    sigue el rayo: bajar de `y` al suelo cuesta `(y − suelo) / |dirección.y|` de
    profundidad, exacto y sin holguras a ojo.
  · El polígono de muestreo va **circunscrito** al círculo, no inscrito.
    Muestrear el círculo en su propio radio da un polígono por dentro y una cota
    que se queda corta —hasta un 2% con dieciséis lados—, y una cota de
    contención corta recorta la sombra justo donde no hay muestra. Se empuja el
    radio a `r / cos(π/n)` y la cota es conservadora por construcción.

  De paso arregló un recorte que llevaba ahí sin que nadie lo hubiera visto: con
  `style.height` al máximo la sombra de las barras llega a x ≈ 2,98 y el volumen
  fijo la cortaba en 2,6.

  Hay 8 tests unitarios sobre la función pura. **El del corte no existía**: la
  prueba de entonces medía el suelo de debajo de la pieza, que es justo el sitio
  equivocado, y pasaba con el fallo dentro. Ahora se proyecta la sombra de
  verdad —siguiendo el rayo hasta el plano— y se comprueba dónde aterriza, que
  es lo mismo que mira el ojo. Con una luz rasante incluida, que es donde
  cualquier holgura fija se queda corta.

### Y el difuminado del borde

Ceñir el volumen tuvo un efecto secundario que también se vio a ojo: la sombra
quedó **demasiado definida**. `PCFSoftShadowMap` difumina con un núcleo fijo de
UN TÉXEL e ignora `shadow.radius`; mientras el volumen era fijo el téxel medía
siempre lo mismo y daba igual, pero al ceñirlo el téxel encogió y el desenfoque
con él.

Ahora se usa `PCFShadowMap`, que sí respeta `radius`, y el desenfoque **se pide
en unidades del mundo** y se convierte a téxeles al vuelo. Así se ve igual en un
anillo y en unas barras altas, cuyos volúmenes no tienen nada que ver. Un
`radius` fijo habría dado un tipo con el borde blando y otro con el borde duro
sin que nadie pidiera la diferencia.

- **No hay tests de regresión visual, y se nota.** La barra del editor se quedó
  descolocada tres veces seguidas y las tres pasaron build, tipos y los 197
  tests: el CSS no tiene tipos y un selector que desaparece —o una alineación de
  4 px— no da error en ninguna parte. Lo que acabó encontrando el fallo fue
  MEDIR la tinta con `TextMetrics` en la página real, no leer el diff.

  Ya hay Playwright montado y corriendo (ver la sección de i18n), así que el
  andamiaje deja de ser excusa: falta la comparación de capturas contra una
  referencia. Una de la barra habría cazado las tres.

- **La cifra de peso de la landing hay que mantenerla a mano** y ya se quedó
  obsoleta una vez (decía 140 KB con el bundle en 147,7). En una página cuyo
  argumento ES ese número, mentir en él es peor que no ponerlo. Lo correcto sería
  que `npm run perf:embed` la escribiera, o que el test del presupuesto fallara
  al desviarse de lo que dice la landing.
- **La landing no usa `tokens.css`.** `marketing.css` redefine su propia paleta,
  radios y sombras a mano, y `page.tsx` lleva decenas de estilos en línea. Es lo
  que la regla de colores de CLAUDE.md prohíbe: si cambian los tokens, la landing
  no se entera. Es un refactor de tamaño medio, no urgente pero real.
- **La sección de cierre es un bloque centrado de plantilla** —título, párrafo y
  CTA en columna—, el mismo patrón que el hero evita a propósito. Romper la
  simetría como en el hero.

- **`/mis-graficas` con estilo, pero SIN VERIFICAR con sesión.** Tiene tarjetas
  con miniatura del póster, insignia de pública/privada y acciones, y el CSS
  está escrito, pero no se ha visto nunca con un usuario dentro: el login es por
  magic link, así que una prueba automática no puede entrar. Hay que mirarlo a
  ojo.
- ~~**SMTP PROPIO — BLOQUEA.**~~ Dejó de bloquear, y no por poner mejor correo
  sino por **mandar mucho menos**. El enlace mágico convertía CADA inicio de
  sesión en un correo que tenía que llegar; con Google no se manda ninguno, y
  con contraseña solo dos por CUENTA: confirmar la dirección y recuperarla.

  Puesto el SMTP de Gmail, que aguanta ese volumen de sobra. Sigue sin ser la
  solución definitiva —sin DKIM propio, Google firma con su dominio y no con
  `volumine.app`, así que los transaccionales tienen papeletas de acabar en
  spam—, pero ya no impide trabajar. Ver `docs/CORREO.md`, apartado 4.

  **Ojo con el otro tope:** Supabase tiene su propio límite de correos en
  Auth → Rate Limits, independiente del de Gmail y bastante bajo por defecto.
  Aunque Gmail dé para 500 al día, ese se agota antes.

- **Google como proveedor**, pendiente de dar de alta. Necesita un OAuth client
  de Google Cloud; la Redirect URI que pide Google es la de SUPABASE
  (`https://butxsqcragkopzxsrukz.supabase.co/auth/v1/callback`), no la nuestra.

- ~~Las políticas RLS siguen sin probarse.~~ Probadas: 18 en verde.
- ~~Nadie ha guardado una gráfica todavía.~~ Recorrido de punta a punta el
  2026-08-06 con una sesión real por API: 16 comprobaciones en verde —perfil
  automático en plan free, guardado, nace privada, marca de agua forzada por el
  trigger, slug con formato, privada da 404, publicada da 200 con su título,
  tabla accesible, cabecera de iframe, caché corta, un anónimo ve la pública y
  deja de verla al despublicar, y borrar el usuario se lleva sus gráficas—.
  Encontró un fallo de caché grave (ver el commit de next.config).

  **Lo único que sigue sin probarse de punta a punta es la SUBIDA del póster a
  Storage**: necesita sesión, y el login es por magic link. Lo que SÍ está
  probado ahora es todo lo anterior —capturar el canvas y componer la imagen—
  desde `/dev/renderer`, que tiene un botón «ver el póster» y enseña el PNG o
  JPEG exacto que se va a subir, con su peso. Queda a mano: guardar, publicar, y
  comprobar que sale `og:image` en el HTML y miniatura en el listado.

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
- **Las etiquetas no encogen con el dibujo.** Su tamaño es fijo en píxeles, así
  que en un hueco pequeño se le echan encima a las porciones y lo tapan. En la
  sección «en su sitio» se compensa a mano —`labels.size: 0.78` por debajo de
  720px— porque esa sección sí sabe en qué hueco vive, pero le pasa a cualquiera
  que ponga el embed en un contenedor estrecho. Falta atar el tamaño de etiqueta
  al del canvas, con suelo y techo.
- **No hay póster estático ni `?static=1`.** El fallback sin WebGL hoy es la
  tabla de datos, que funciona pero no es bonito. Falta el render en servidor.
- El lector de consola de la extensión de Chrome se traga los logs tras navegar.
  Para depurar, Playwright: captura `console`, `pageerror` y fallos de red.

### Encontrados el 2026-11-17

- **Quedan vulnerabilidades en dependencias de DESARROLLO** (`vitest` 3 →
  `tinypool`, `picomatch`, `@vitest/mocker`; una crítica). No llegan a
  producción. El arreglo es saltar a `vitest` 5, que es un cambio mayor: no se
  hizo a ciegas. `npm audit --omit=dev` da 0.
- **`.env.example` sigue describiendo las variables del plan Pro**
  (`STRIPE_WEBHOOK_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` como obligatorias, y
  la sección de Stripe duplicada). Hay una regla de permisos que impide a
  Claude editar `.env*`; hay que corregirlo a mano: solo hace falta
  `STRIPE_SECRET_KEY` (y `STRIPE_WEBHOOK_SECRET` si se mantiene el webhook).
- **Node 20 en local.** `@supabase/supabase-js` avisa en cada build de que deja
  de soportarlo. Vercel usa la versión de su proyecto, no esta.
- **Aviso de Turbopack en cada build**: hay un `package-lock.json` suelto en
  `C:\Users\mnsa1` y Next lo detecta como posible raíz del monorepo. Borrarlo
  (si no es de nada) o poner `turbopack.root` en `next.config.ts`.
- **No hay `zustand`** aunque CLAUDE.md lo da por stack: el editor lleva su
  estado y su historial a mano (`src/lib/history.ts`). No es un fallo, pero
  CLAUDE.md miente en eso.
- En esta máquina **`rtk grep` cuelga** porque `rg` no está en el PATH (el hook
  reescribe `grep` → `rtk grep`). Usar la herramienta Grep, no `grep` por Bash.
- `/cafe` en producción NO se ha probado con un pago de verdad (sí se ha
  comprobado que la pasarela abre en modo real). El primer café real es la
  prueba: debería aparecer en Stripe → Pagos con el mensaje en «Campos
  personalizados».
