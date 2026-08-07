# Estado actual

> **Este archivo es el mecanismo de continuidad entre sesiones.** Una sesión
> nueva no recuerda nada: lo primero que hace es leer esto. Manténlo actualizado
> con `/state` al terminar cualquier bloque de trabajo.
>
> Sé concreto. "Avanzando en el renderer" no vale.

**Última actualización:** 2026-08-07
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
8. Botón «Copiar iframe» en el editor. El texto ya está en el diccionario
   (`editor.copyEmbed`); falta el botón.

## Decisiones pendientes de Manuel

- [ ] Confirmar el nombre "Volumine" y renombrar la carpeta
      (`Rename-Item C:\Users\mnsa1\Desktop\3d-web-chart volumine`).
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

## Facturación: preparada y apagada

Todo el camino de cobro está escrito y **no se enciende hasta que existan tres
variables de entorno** (`.env.example`). Sin ellas el webhook devuelve 404 y el
producto es gratis, exactamente como hoy.

Para activarlo, el día que se quiera:

1. Aplicar `supabase/migrations/0005_facturacion.sql`.
2. Crear los productos en Stripe y meter sus `price_...` en `plan_limits`.
3. Poner las tres variables.
4. Dar de alta el webhook en Stripe apuntando a `/api/stripe/webhook`.

**Lo que NO hay que escribir ese día**: el checkout de cara al usuario y la
sección de plan en la interfaz. Se dejó fuera a propósito — es lo que depende de
cómo se decida cobrar (pago único, anual, por equipo) y escribirlo ahora sería
adivinar.

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
- **SMTP PROPIO — esto ya no es cosmético, BLOQUEA.** El servicio de correo
  integrado de Supabase permite del orden de **2 envíos por hora** y está
  pensado solo para probar. Se agota en una tarde de desarrollo y a partir de
  ahí `signInWithOtp` devuelve `429 over_email_send_rate_limit`: nadie puede
  entrar. Comprobado en los logs de auth el 2026-08-06.

  Hace falta un proveedor propio (Resend, Postmark, SES) en Auth → SMTP
  Settings. De paso resuelve las otras dos: la plantilla genérica y el remitente
  —que es lo que de verdad decide si el magic link acaba en spam—.

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
- **No hay póster estático ni `?static=1`.** El fallback sin WebGL hoy es la
  tabla de datos, que funciona pero no es bonito. Falta el render en servidor.
- El lector de consola de la extensión de Chrome se traga los logs tras navegar.
  Para depurar, Playwright: captura `console`, `pageerror` y fallos de red.
