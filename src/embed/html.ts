import type { ResolvedChartConfig } from '@/lib/config/defaults';
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

    // Solo con póster: apuntar a una imagen que no existe enseña un hueco roto.
    ...(poster
      ? [
          `<meta property="og:image" content="${escapeHtml(poster)}">`,
          `<meta property="og:image:alt" content="${alt}">`,
          `<meta name="twitter:image" content="${escapeHtml(poster)}">`,
        ]
      : []),
    /* `summary_large_image`: una gráfica en miniatura no se lee. Si va a salir
       una imagen, que salga a tamaño de leerla. */
    /* `player` cuando se puede incrustar, `summary_large_image` si solo hay
       foto. Con `summary_large_image` Twitter enseña la imagen aunque haya
       reproductor, así que el orden importa. */
    `<meta name="twitter:card" content="${canonical ? 'player' : 'summary_large_image'}">`,

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
 */
function posterImgHtml(
  config: ResolvedChartConfig,
  poster: string | null | undefined,
): string {
  if (!poster) return '';
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

export function embedHtml({
  config,
  css,
  scriptSrc,
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
  /** URL pública del póster. `null` en los embeds de config-en-URL. */
  poster?: string | null;
  /** URL canónica de esta gráfica, para las tarjetas de enlace. */
  canonical?: string | null;
  /**
   * Origen desde el que se sirve. A dónde lleva la marca de agua.
   *
   * Estaba escrito a mano como `https://volumine.app` — un dominio que no existe.
   * O sea que TODOS los embeds publicados llevaban un enlace muerto, y la marca
   * de agua es la única publicidad gratis que tiene este producto: alguien la
   * pulsaba y no llegaba a ninguna parte.
   *
   * Se pasa desde la ruta y no se constantiza porque el dominio cambia —local,
   * preview de Vercel, producción, y el propio cuando lo haya—. Escribirlo a
   * mano es garantizar que vuelva a quedarse viejo.
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
<style>${css}</style>
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
