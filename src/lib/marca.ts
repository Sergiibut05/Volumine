/*
  ══════════════════════════════════════════════════════════════════════════
  LA MARCA FUERA DE LO LEGAL
  ══════════════════════════════════════════════════════════════════════════

  `legal.ts` identifica a quien PRESTA el servicio y lo obliga la ley. Esto es
  otra cosa: son los datos con los que la app se presenta en sitios de terceros
  —la barra del navegador en el móvil, la tarjeta de un enlace compartido, la
  pantalla de inicio de un teléfono—. Van juntos aquí porque se escriben una vez
  y los leen media docena de sitios.
*/

export const MARCA = {
  nombre: 'Volumine',

  /**
   * La cuenta de X, SIN la arroba. `null` mientras no exista.
   *
   * Sirve para `twitter:site`, que es lo que hace que una tarjeta compartida
   * quede atribuida a la cuenta en vez de aparecer huérfana. Con `null` la
   * etiqueta no se emite: una etiqueta apuntando a una cuenta que no existe es
   * peor que no ponerla — X la resuelve y se queda sin atribución igual.
   */
  x: null as string | null,

  /*
    El color de la barra del navegador en el móvil.

    Dos, y no uno: la landing es clara y el editor es oscuro a la fuerza, así
    que un solo color acertaría en una pantalla y desentonaría en la otra. Son
    los mismos `--surface-base` de `tokens.css` —claro y oscuro— escritos aquí
    literales porque una etiqueta `<meta>` no entiende variables de CSS.

    Si cambian ahí, cambian aquí.
  */
  colorTemaClaro: '#fbfbfd',
  colorTemaOscuro: '#0b0b12',
} as const;

/*
  La imagen de las tarjetas de enlace. La produce `scripts/og-image.mjs`.

  ── POR QUÉ 1200×630 Y JPEG ──────────────────────────────────────────────

  Era un PNG de 2400×1260 y 678 KB, y ese peso rompía WhatsApp: por encima de
  500 KB no enseña la vista previa, se queda con el enlace pelado. Justo en el
  sitio donde más se comparte un link a mano.

  1200×630 es la proporción que piden Open Graph y Twitter, y ya va sobrado: la
  tarjeta se pinta a unos 500-600 px en casi todos los clientes. Los 2400 eran
  cuatro veces el tamaño útil. Se siguen capturando —el doble de densidad y
  después reducida—, así que el canto de la gráfica sale mejor antialiasado que
  rasterizando a 1x directamente.

  JPEG y no PNG porque esto es un render con degradados, que es exactamente
  donde el PNG pesa varias veces más sin verse mejor. Es la misma decisión que
  la de los pósters — y aquella se olvidó de avisar al bucket, ver
  `0006_poster_jpeg.sql`.

  Las medidas de aquí tienen que cuadrar con las del script: son las que se
  anuncian en `og:image:width` y `og:image:height`, y un rastreador que reserva
  un hueco de un tamaño y recibe otro deja la tarjeta descuadrada.
*/
export const OG = {
  ruta: '/og.jpg',
  ancho: 1200,
  alto: 630,
} as const;
