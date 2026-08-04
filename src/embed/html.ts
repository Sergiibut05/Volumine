import type { ResolvedChartConfig } from '@/lib/config/defaults';

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
  if (config.type === 'bar') {
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
  const total = values.reduce((sum, v) => sum + (v > 0 ? v : 0), 0);

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

const KIND = {
  pie: 'Gráfica de tarta',
  donut: 'Gráfica de anillo',
  bar: 'Gráfica de barras',
} as const;

/** Resumen para el `aria-label`, generado desde los datos. */
export function describeChart(config: ResolvedChartConfig): string {
  if (config.data.series.length === 0) return 'Gráfica sin datos';
  const kind = KIND[config.type] ?? KIND.donut;
  const title = config.title ? ` — ${config.title}` : '';

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

    return multi ? `${kind}${title}. ${groups.join('. ')}` : `${kind}${title}: ${groups[0]}`;
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

export function embedHtml({
  config,
  css,
  scriptSrc,
}: {
  config: ResolvedChartConfig;
  css: string;
  scriptSrc: string;
}): string {
  const watermark = config.layout.watermark
    ? `<a class="watermark" href="https://voluma.app" target="_blank" rel="noopener">Voluma</a>`
    : '';

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(config.title ?? 'Gráfica')}</title>
<style>${css}</style>
</head>
<body>
<div class="stage" role="img" aria-label="${escapeHtml(describeChart(config))}">
${dataTableHtml(config)}
<canvas id="voluma-canvas"></canvas>
<div id="voluma-tooltip" class="tooltip" hidden></div>
${watermark}
</div>
<script type="application/json" id="voluma-config">${escapeJson(config)}</script>
<script src="${scriptSrc}" defer></script>
</body>
</html>`;
}

export function errorHtml(message: string, css: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Voluma</title><style>${css}</style></head>
<body><div class="stage" style="display:grid;place-content:center;padding:1rem">
<p style="color:#9a9aab;font-size:13px;margin:0;text-align:center">${escapeHtml(message)}</p>
</div></body></html>`;
}
