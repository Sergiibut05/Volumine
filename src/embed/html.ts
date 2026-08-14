import type { ResolvedChartConfig } from '@/lib/config/defaults';
import type { EmbedFont } from './serve';
import { gaugeReadout } from '@/lib/gauge';

/*
  Generación del HTML de /embed, a mano y sin React.

  Es una plantilla de texto a propósito: la ruta no pasa por el App Router, así
  que el navegador no descarga React ni el runtime de Next. Ese es el motivo
  entero de que este archivo exista (ADR 0006).
*/

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

/** Evita que un `</script>` dentro de los datos cierre la etiqueta. */
function escapeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * Tabla con los datos, siempre presente en el DOM.
 *
 * Una gráfica 3D es inaccesible por naturaleza: no hay forma de que un lector de
 * pantalla interprete geometría con luz. Esta tabla es la versión que sí se
 * puede leer, y además es lo que ve alguien sin WebGL (ADR 0005).
 */
function formatter(config: ResolvedChartConfig) {
  const { locale, decimals, unit } = config.data.format;
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (value: number) => number.format(value) + unit;
}

const seriesName = (config: ResolvedChartConfig, i: number) =>
  config.data.series[i]?.name ?? `Serie ${i + 1}`;

export function dataTableHtml(config: ResolvedChartConfig): string {
  if (config.data.series.length === 0) return '';
  const format = formatter(config);
  const caption = escapeHtml(config.title ?? 'Datos de la gráfica');

  /* Las barras se tabulan con una columna por serie y SIN porcentaje: reparten
     un eje, no un total, y "42 es el 24% de la suma de los meses" no significa
     nada. El anillo sí reparte un total, y ahí el porcentaje es el dato. */
  /* La carrera se tabula igual que las barras agrupadas: sus series SON los
     periodos, así que una columna por periodo da la tabla completa, que es
     justamente lo que un lector de pantalla no puede sacar de la animación. */
  if (config.type === 'bar' || config.type === 'bar-race') {
    const head = config.data.series
      .map((_, s) => `<th scope="col">${escapeHtml(seriesName(config, s))}</th>`)
      .join('');

    const rows = config.data.labels
      .map((label, i) => {
        const cells = config.data.series
          .map((serie) => `<td>${escapeHtml(format(serie.values[i] ?? 0))}</td>`)
          .join('');
        return `<tr><th scope="row">${escapeHtml(label)}</th>${cells}</tr>`;
      })
      .join('');

    return `<table class="sr-only"><caption>${caption}</caption><thead><tr><th scope="col">Categoría</th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  const values = config.data.series[0].values;
  /* En un medidor el porcentaje es contra el TOPE, no contra la suma. Con la
     suma, un medidor de un solo valor diría siempre «100%» — que es justo lo
     contrario de lo que enseña la pantalla cuando va por la mitad. */
  const total =
    config.type === 'gauge'
      ? config.style.gauge.max
      : values.reduce((sum, v) => sum + (v > 0 ? v : 0), 0);

  const rows = config.data.labels
    .map((label, i) => {
      const value = values[i] ?? 0;
      const percent = total > 0 ? `${((value / total) * 100).toFixed(1)}%` : '—';
      return `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(
        format(value),
      )}</td><td>${percent}</td></tr>`;
    })
    .join('');

  return `<table class="sr-only"><caption>${caption}</caption><thead><tr><th scope="col">Categoría</th><th scope="col">Valor</th><th scope="col">Porcentaje</th></tr></thead><tbody>${rows}</tbody></table>`;
}

const KIND: Record<ResolvedChartConfig['type'], string> = {
  pie: 'Gráfica de tarta',
  donut: 'Gráfica de anillo',
  bar: 'Gráfica de barras',
  'bar-race': 'Gráfica de barras animadas',
  globe: 'Globo con datos por país',
  gauge: 'Medidor',
};

/** Resumen para el `aria-label`, generado desde los datos. */
export function describeChart(config: ResolvedChartConfig): string {
  if (config.data.series.length === 0) return 'Gráfica sin datos';
  const kind = KIND[config.type] ?? KIND.donut;
  const title = config.title ? ` — ${config.title}` : '';

  /* Una carrera no se resume leyendo todos los periodos: con 10 categorías y 12
     años son 120 cifras seguidas, que es peor que no decir nada. Se lee la
     clasificación FINAL, que es lo que la animación acaba contando, y la tabla
     de arriba tiene el detalle completo para quien lo quiera. */
  if (config.type === 'bar-race') {
    const format = formatter(config);
    const last = config.data.series[config.data.series.length - 1];
    const period = last?.name ? ` al final de ${last.name}` : ' al final';

    const ranking = config.data.labels
      .map((label, i) => ({ label, value: last?.values[i] ?? 0 }))
      .sort((a, b) => b.value - a.value)
      .map((entry, position) => `${position + 1}. ${entry.label} ${format(entry.value)}`);

    return `${kind}${title}. Clasificación${period}: ${ranking.join(', ')}`;
  }

  /* Un medidor se lee como lo que es: una cifra sobre un tope. Decir «Ventas
     100%» —que es lo que saldría por el camino del anillo con un solo valor—
     sería lo contrario de lo que enseña la pantalla cuando va por la mitad. */
  if (config.type === 'gauge') {
    const format = formatter(config);
    const max = config.style.gauge.max;
    const values = config.data.series[0].values;
    const total = values.reduce((sum, v) => sum + (v > 0 ? v : 0), 0);

    /* «68% de 100% (68%)» no lo diría nadie. Con unidad de porcentaje sobre 100
       la cifra ya es el porcentaje, así que ni se repite ni se dice el tope: es
       la misma regla que sigue la cifra del centro (lib/gauge.ts). */
    const asPercent = config.data.format.unit === '%' && max === 100;
    if (asPercent) {
      const parts =
        values.length > 1
          ? `. Por partes: ${config.data.labels
              .map((label, i) => `${label} ${format(values[i] ?? 0)}`)
              .join(', ')}`
          : '';
      // `format` ya pone la unidad: añadir el % aquí lo escribiría dos veces.
      return `${kind}${title}: ${format(total)}${parts}`;
    }

    const percent = max > 0 ? ` (${((total / max) * 100).toFixed(0)}%)` : '';

    /* Con varios tramos se dice también el desglose: la pantalla los distingue
       por color y quien no la ve se quedaría solo con la suma. */
    const parts =
      values.length > 1
        ? `. Por partes: ${config.data.labels
            .map((label, i) => `${label} ${format(values[i] ?? 0)}`)
            .join(', ')}`
        : '';

    return `${kind}${title}: ${format(total)} de ${format(max)}${percent}${parts}`;
  }

  if (config.type === 'bar') {
    const format = formatter(config);
    const multi = config.data.series.length > 1;

    /* Con varias series el nombre se dice UNA vez por grupo. Repetirlo en cada
       valor ("Web, Ene 42, Web, Feb 26") es lo que un lector de pantalla lee
       en voz alta, y a diez categorías es insoportable. */
    const groups = config.data.series.map((serie, s) => {
      const values = config.data.labels
        .map((label, i) => `${label} ${format(serie.values[i] ?? 0)}`)
        .join(', ');
      return multi ? `${seriesName(config, s)}: ${values}` : values;
    });

    return multi
      ? `${kind}${title}. ${groups.join('. ')}`
      : `${kind}${title}: ${groups[0]}`;
  }

  const values = config.data.series[0].values;
  const total = values.reduce((sum, v) => sum + (v > 0 ? v : 0), 0);
  const parts = config.data.labels.map((label, i) => {
    const value = values[i] ?? 0;
    const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
    return `${label} ${percent}%`;
  });

  return `${kind}${title}: ${parts.join(', ')}`;
}

/**
 * Etiquetas de tarjeta de enlace.
 *
 * Sin esto, pegar el link en Slack, Notion o WhatsApp enseña un rectángulo con
 * el título y nada más. En un producto cuyo producto ES EL LINK, ese es el peor
 * sitio donde fallar.
 *
 * Solo salen si HAY póster: una etiqueta `og:image` apuntando a una imagen que
 * no existe es peor que no ponerla — algunos clientes enseñan un hueco roto.
 */
function socialTags(
  config: ResolvedChartConfig,
  poster: string | null | undefined,
  canonical: string | null | undefined,
): string {
  /*
    LAS DOS FAMILIAS SON INDEPENDIENTES, y tenerlas juntas era un fallo.

    Las de IMAGEN necesitan póster. Las de REPRODUCTOR solo necesitan que la
    gráfica tenga una URL estable. Estaban las dos detrás del mismo `if
    (!poster)`, así que una gráfica sin cuenta —que nunca tiene póster, porque
    nadie la ha capturado— se quedaba sin poder incrustarse en ningún sitio.
  */
  if (!poster && !canonical) return '';

  const titulo = escapeHtml(config.title ?? 'Gráfica');
  const alt = escapeHtml(describeChart(config).slice(0, 200));

  /* Mismas proporciones que devuelve el endpoint oEmbed: si las dos fuentes
     dijeran tamaños distintos, la gráfica saldría estirada en unos sitios y no
     en otros según cuál mirase cada uno. */
  const ratio =
    { '16:9': 9 / 16, '4:3': 3 / 4, '1:1': 1, auto: 9 / 16 }[config.layout.aspect] ??
    9 / 16;
  const player = { width: 640, height: Math.round(640 * ratio) };

  return [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${titulo}">`,
    canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}">` : '',

    /*
      LA DESCRIPCIÓN, QUE ES EL RESUMEN QUE YA ESTÁBAMOS GENERANDO.

      Una tarjeta lleva imagen, título y descripción. Sin descripción, debajo
      del título queda un hueco y la tarjeta se lee a medias: la imagen enseña
      la forma y no dice ni un número.

      El texto es el mismo de `og:image:alt` —el resumen legible que ya se
      construye para los lectores de pantalla—, así que no hay que inventar
      nada: «Gráfica de anillo — Ingresos: Suscripciones 42,0%, …». La imagen
      pone el objeto, esto pone los datos.

      Y `twitter:` además de `og:` porque X prefiere las suyas cuando existen.
    */
    `<meta property="og:description" content="${alt}">`,
    `<meta name="twitter:description" content="${alt}">`,
    `<meta name="twitter:title" content="${titulo}">`,

    // Solo con póster: apuntar a una imagen que no existe enseña un hueco roto.
    ...(poster
      ? [
          `<meta property="og:image" content="${escapeHtml(poster)}">`,
          `<meta property="og:image:alt" content="${alt}">`,
          `<meta name="twitter:image" content="${escapeHtml(poster)}">`,
        ]
      : []),
    /*
      SIEMPRE `summary_large_image`. NUNCA `player`.

      Aquí ponía `player` cuando la gráfica tenía URL estable, con el argumento
      de que si se puede incrustar, que se incruste. El argumento es bueno y la
      etiqueta no sirve: la tarjeta de reproductor de X exige APROBACIÓN PREVIA
      por formulario, y sin ella X no pinta nada. Ni reproductor ni imagen.

      O sea que las gráficas guardadas —las que tienen póster, las que mejor se
      ven— eran justo las que salían como un link pelado al compartirlas en X,
      mientras que las de sin cuenta sí enseñaban su tarjeta. Al revés de lo que
      tenía que pasar, y en el sitio donde más duele: un producto cuyo producto
      es el link no puede fallar al pegar el link.

      `summary_large_image` no pide permiso a nadie y enseña el póster a tamaño
      de leerlo. Las etiquetas de reproductor de aquí abajo se quedan: no las
      lee X con esta tarjeta, pero sí otros consumidores, y cuestan 300 bytes.

      Si algún día se pide y se consigue la aprobación de la player card, esto
      se puede revisar. Mientras tanto, lo que no está aprobado no existe.
    */
    `<meta name="twitter:card" content="summary_large_image">`,

    /*
      ETIQUETAS DE REPRODUCTOR.

      oEmbed es el camino bueno, pero varios consumidores solo devuelven un
      iframe si el dominio está en su lista blanca — Iframely entre ellos, que
      es lo que bloquea Notion y Canva hasta que aprueban tu dominio.

      Estas etiquetas son el otro camino: describen el embed en el propio HTML,
      sin preguntar a nadie. Quien las entienda puede montar el iframe sin
      aprobación previa. No sustituyen a oEmbed; se suman, y cuestan 300 bytes.

      El tamaño sale de la proporción del config, así que una gráfica cuadrada se
      incrusta cuadrada.
    */
    ...(canonical
      ? [
          `<meta name="twitter:player" content="${escapeHtml(canonical)}">`,
          `<meta name="twitter:player:width" content="${player.width}">`,
          `<meta name="twitter:player:height" content="${player.height}">`,
          `<meta property="og:video:iframe" content="${escapeHtml(canonical)}">`,
          `<meta property="og:video:type" content="text/html">`,
          `<meta property="og:video:width" content="${player.width}">`,
          `<meta property="og:video:height" content="${player.height}">`,
        ]
      : []),
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * La directiva para robots.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * EL EMBED GUARDADO NO PUEDE LLEVAR `noindex`. Iframely —y por tanto Notion y
 * Canva— RESPETAN esa directiva y se niegan a leer la página: «the robots
 * directive of this page prevents Iframely from parsing it». O sea que el
 * `noindex` que puse por prudencia estaba impidiendo justo lo que el producto
 * necesita, que es que otros lean este link y lo conviertan en un iframe.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * La config-en-URL sí lo mantiene: son URLs infinitas y generadas, cada ajuste
 * de un slider produce otra. Indexarlas sería llenar un buscador de duplicados
 * de la misma gráfica, y además nadie las comparte — se pegan en un iframe a
 * mano.
 *
 * El embed guardado es lo contrario: una URL estable que alguien ha decidido
 * publicar. Que se pueda leer es el requisito, no el riesgo.
 */
function robotsTag(canonical: string | null | undefined): string {
  return canonical ? '' : '<meta name="robots" content="noindex,nofollow">';
}

/**
 * El enlace de descubrimiento de oEmbed.
 *
 * ES LA PIEZA que convierte una URL pegada en Notion, Canva o WordPress en la
 * gráfica VIVA. Esos sitios no adivinan: buscan esta etiqueta, llaman al
 * endpoint que apunta y le preguntan cómo se incrusta. Sin ella, lo máximo que
 * sacan es la tarjeta con la imagen de `og:image`.
 *
 * Solo en el embed GUARDADO: la config-en-URL no tiene una URL estable que
 * describir —cada cambio produce otra— y no se comparte como link, se pega en
 * un iframe a mano.
 */
function oembedLink(canonical: string | null | undefined): string {
  if (!canonical) return '';
  const endpoint = `${new URL(canonical).origin}/api/oembed?url=${encodeURIComponent(canonical)}`;
  return `<link rel="alternate" type="application/json+oembed" href="${escapeHtml(endpoint)}" title="Volumine">`;
}

/**
 * El póster dentro del escenario, DEBAJO del canvas.
 *
 * No es un respaldo que se activa: está siempre, y el canvas lo tapa al montar.
 * Así se ve la gráfica desde el primer byte —antes de que arranque WebGL— y
 * sigue viéndose si WebGL no arranca nunca. Un `<img>` con `alt` vacío porque
 * el escenario ya lleva su `aria-label` y la tabla de datos completa.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * CON FONDO TRANSPARENTE NO SE PONE, Y ESO ARREGLA UN FALLO REAL
 * ══════════════════════════════════════════════════════════════════════════
 *
 * El póster tiene DOS usos con necesidades opuestas:
 *
 *   · aquí dentro, de relleno, quiere ALFA — la gráfica se funde con la página
 *     de quien la incrusta, que es la promesa del fondo transparente;
 *   · como `og:image`, quiere ser OPACO — en una tarjeta de enlace nadie
 *     respeta la transparencia y cada cliente la rellena con su color.
 *
 * Se eligió opaco (ver `lib/charts/poster.ts`) razonando que el relleno de
 * dentro «no existe todavía». Existe: es esta etiqueta. Resultado en Notion en
 * modo oscuro: un rectángulo blanco nítido donde tenía que verse la página de
 * detrás, hasta que arrancara WebGL — y para siempre si no arrancaba.
 *
 * Con fondo transparente se prefiere NO PONER NADA a poner un rectángulo del
 * color equivocado: no ver la gráfica un instante es mucho menos malo que ver
 * un recuadro que no es de nadie. El resto de fondos sí lo llevan, porque ahí
 * el póster y el embed son del mismo color por construcción.
 *
 * El arreglo completo son DOS imágenes —una con alfa para aquí y otra opaca
 * para la tarjeta— y va con el póster estático (`?static=1`), que es donde
 * toca decidir cuántas imágenes se guardan por gráfica.
 */
function posterImgHtml(
  config: ResolvedChartConfig,
  poster: string | null | undefined,
): string {
  if (!poster || config.scene.background.kind === 'transparent') return '';
  return `<img class="poster" src="${escapeHtml(poster)}" alt="" aria-hidden="true" decoding="async">`;
}

/**
 * ¿El fondo del embed es claro u oscuro? `null` si es transparente.
 *
 * Transparente significa que detrás está la página de otra persona y que aquí no
 * se puede saber de qué color es. Devolver `null` y no adivinar es lo correcto:
 * quien reciba esto decide con la información que tenga.
 */
function backgroundTone(config: ResolvedChartConfig): 'light' | 'dark' | null {
  if (config.scene.background.kind === 'transparent') return null;

  const hex = config.scene.background.from.replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  // Luminancia relativa, con los pesos de siempre. Sin corrección de gamma:
  // solo hay que decidir claro/oscuro, no medir contraste.
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? 'light' : 'dark';
}

/**
 * La cifra del centro de un medidor, escrita ya en el HTML del servidor.
 *
 * No espera a WebGL: está en el primer byte, no parpadea al montar el canvas y
 * sigue ahí si el canvas nunca llega a montarse. `aria-hidden` porque el
 * `aria-label` de la escena ya dice la misma cifra, y repetirla haría que un
 * lector de pantalla la leyera dos veces seguidas.
 */
function readoutHtml(config: ResolvedChartConfig): string {
  if (config.type !== 'gauge') return '';
  const { value, scale } = gaugeReadout(config);
  const sub = scale ? `<small>${escapeHtml(scale)}</small>` : '';

  /*
    El color de la cifra sale del FONDO, no de una constante.

    Con fondo propio se sabe exactamente qué hay detrás y se decide aquí. Con
    fondo transparente no se sabe —detrás está la página de otra persona— y
    entonces decide el CSS con `prefers-color-scheme`, que es la única pista
    disponible. Un blanco fijo dejaba la cifra invisible sobre una página clara,
    que es justo el caso más común de un embed transparente.
  */
  const tone = backgroundTone(config);
  const fg =
    tone === null ? '' : tone === 'light' ? '--readout: 0 0 0' : '--readout: 255 255 255';
  /* CSS no sabe contar caracteres, y el cuerpo de la cifra depende de lo larga
     que sea: «68%» cabe holgada en el agujero y «1.284.500 €» no. Ver .readout
     en styles/embed.css. */
  return `<div class="readout" aria-hidden="true" style="--chars:${value.length};${fg}"><b>${escapeHtml(
    value,
  )}</b>${sub}</div>`;
}

/**
 * La declaración de la tipografía, si la gráfica pide una nuestra.
 *
 * Devuelve cadena vacía con `system`, que es el valor por defecto: un embed que
 * no toca la tipografía sigue siendo un archivo y una petición, como anuncia la
 * landing. El coste solo lo paga quien elige.
 *
 * `font-display: swap` y no `block`: con `block` el navegador esconde el texto
 * hasta que llega el fichero, y una etiqueta que aparece tarde sobre una gráfica
 * ya dibujada se lee como un fallo. Con `swap` se ve desde el primer momento con
 * la familia del sistema y cambia cuando llega — que es el mismo salto que da
 * hoy cualquier página con tipografía propia.
 *
 * El rango de grosor SE DECLARA (`400 600`). Sin él, el navegador trata una
 * fuente variable como estática y clava todo en 400: el nombre de la etiqueta
 * dejaría de verse más fuerte que su cifra, sin que nada fallara. Se midió.
 *
 * Aquí solo se DECLARA la familia. Quién la usa es la capa de etiquetas, que
 * pone la pila en línea — y un estilo en línea gana a cualquier hoja, así que
 * intentar fijarla desde aquí no serviría de nada. Cada pila nombra primero la
 * nuestra y detrás la del sistema: si el fichero no llega, o no se ha generado,
 * la etiqueta se ve igual de bien con lo que haya.
 */
function fontFaceCss(
  config: ResolvedChartConfig,
  fonts: Record<string, EmbedFont>,
): string {
  const voz = fonts[config.labels.font];
  if (!voz) return '';

  /* Un `@font-face` por corte, cada uno con su `unicode-range`. El navegador
     elige y descarga solo el que necesite el texto de esta gráfica. */
  return voz.slices
    .map(
      (corte) =>
        `@font-face{font-family:"${voz.family}";` +
        `src:url("/embed-fonts/${corte.file}") format("woff2");` +
        `unicode-range:${corte.unicodeRange};` +
        `font-weight:400 600;font-style:normal;font-display:swap}`,
    )
    .join('');
}

export function embedHtml({
  config,
  css,
  scriptSrc,
  fonts,
  poster,
  canonical,
  /* OJO: si `origin` no se desestructura aquí, dentro de la función NO da error
     de tipos — apunta al `origin` GLOBAL del runtime. El embed devolvía 500 y
     `tsc` pasaba limpio. Es el riesgo de nombrar un parámetro como un global. */
  origin,
}: {
  config: ResolvedChartConfig;
  css: string;
  scriptSrc: string;
  /** Las tipografías disponibles. Solo se emite la que use esta gráfica. */
  fonts?: Record<string, EmbedFont>;
  /** URL pública del póster. `null` en los embeds de config-en-URL. */
  poster?: string | null;
  /** URL canónica de esta gráfica, para las tarjetas de enlace. */
  canonical?: string | null;
  /**
   * Origen desde el que se sirve. A dónde lleva la marca de agua.
   *
   * Estuvo escrito a mano como `https://volumine.app` cuando ese dominio todavía
   * no estaba registrado, así que TODOS los embeds publicados llevaban un enlace
   * muerto — y la marca de agua es la única publicidad gratis que tiene este
   * producto: alguien la pulsaba y no llegaba a ninguna parte.
   *
   * El dominio ya existe, pero se sigue pasando desde la ruta y no se
   * constantiza: cambia entre local, los previews de Vercel y producción, y
   * escribirlo a mano es garantizar que vuelva a quedarse viejo.
   */
  origin?: string | null;
}): string {
  /*
    La marca de agua lleva SÍMBOLO además del nombre.

    A 10 px, «Volumine» en texto es una palabra gris que el ojo descarta como
    parte del fondo — que es justo lo contrario de para lo que está. El símbolo
    da una silueta reconocible aunque no se llegue a leer el nombre, y de paso
    dice qué hace el producto: es el mismo anillo con canto que dibuja.

    El SVG va en línea porque el embed no puede pedirle una imagen a nadie
    (ADR 0005), y son 180 bytes.
  */
  const inicio = origin ?? (canonical ? new URL(canonical).origin : 'https://volumine.app');
  const watermark = config.layout.watermark
    ? `<a class="watermark" href="${escapeHtml(inicio)}" target="_blank" rel="noopener" aria-label="Hecho con Volumine">` +
      `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">` +
      `<ellipse cx="12" cy="14.2" rx="9" ry="5.6" stroke="currentColor" stroke-width="3.6" opacity=".42"/>` +
      `<ellipse cx="12" cy="11" rx="9" ry="5.6" stroke="currentColor" stroke-width="3.6"/>` +
      `</svg>Volumine</a>`
    : '';

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${robotsTag(canonical)}
<title>${escapeHtml(config.title ?? 'Gráfica')}</title>
${socialTags(config, poster, canonical)}
${oembedLink(canonical)}
<style>${css}${fontFaceCss(config, fonts ?? {})}</style>
</head>
<body>
<div class="stage" role="img" aria-label="${escapeHtml(describeChart(config))}">
${dataTableHtml(config)}
${posterImgHtml(config, poster)}
<canvas id="volumine-canvas"></canvas>
<div id="volumine-tooltip" class="tooltip" hidden></div>
<div id="volumine-period" class="period" aria-hidden="true" hidden></div>
${readoutHtml(config)}
${watermark}
</div>
<script type="application/json" id="volumine-config">${escapeJson(config)}</script>
<script src="${scriptSrc}" defer></script>
</body>
</html>`;
}

export function errorHtml(message: string, css: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${
  /* Una página de error SÍ lleva `noindex` siempre: no hay nada que indexar
     ni nada que incrustar. */ ''
}<meta name="robots" content="noindex,nofollow"><title>Volumine</title><style>${css}</style></head>
<body><div class="stage" style="display:grid;place-content:center;padding:1rem">
<p style="color:#9a9aab;font-size:13px;margin:0;text-align:center">${escapeHtml(message)}</p>
</div></body></html>`;
}
