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
3. Tests de regresión visual con Playwright. El andamiaje está.
3. ~~Póster estático.~~ Hecho, pero **sin probar de punta a punta**: nadie ha
   guardado una gráfica todavía, así que la subida a Storage no se ha ejecutado
   nunca. Es lo primero que hay que comprobar al recorrer el camino completo.
4. ~~Deshacer/rehacer.~~ Hecho.
5. ~~El editor solo ofrece anillo, tarta y barras.~~ Hecho: los seis tipos.

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

## Problemas abiertos

- **No hay tests de regresión visual, y se nota.** La barra del editor se quedó
  descolocada tres veces seguidas y las tres pasaron build, tipos y los 197
  tests: el CSS no tiene tipos y un selector que desaparece —o una alineación de
  4 px— no da error en ninguna parte. Lo que acabó encontrando el fallo fue
  MEDIR la tinta con `TextMetrics` en la página real, no leer el diff.

  Está en el roadmap como «tests visuales con Playwright, el andamiaje está».
  Subirlo de prioridad: una captura de la barra contra una de referencia habría
  cazado las tres.

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

  **Lo único que sigue sin probarse es la subida del PÓSTER**: necesita un canvas
  de navegador con sesión, y el login es por magic link/Google. Hay que hacerlo a
  mano: guardar una gráfica, publicarla, y comprobar que sale `og:image` en el
  HTML y miniatura en el listado.

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
