import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string';
import type { ChartConfig } from './schema';

/*
  Config en la URL: el tier gratuito y la API para desarrolladores a la vez.
  Sin BBDD, sin cuenta, stateless. Ver docs/chart-config-schema.md.
*/

/**
 * Límite duro de longitud de URL. 6000 y no 8000 porque hay proxies, CMS y
 * clientes de correo que cortan bastante por debajo del límite del navegador.
 * Por encima de esto, la gráfica tiene que guardarse en BBDD.
 */
export const MAX_URL_LENGTH = 6000;

/** Overrides permitidos por query. Lista blanca: nada fuera de aquí se aplica. */
export const ALLOWED_QUERY_OVERRIDES = [
  'theme',
  'bg',
  'transparent',
  'autorotate',
  'static',
] as const;

export type QueryOverride = (typeof ALLOWED_QUERY_OVERRIDES)[number];

export function encodeConfig(config: ChartConfig): string {
  return compressToEncodedURIComponent(JSON.stringify(config));
}

/** Devuelve `null` si el parámetro no es descomprimible o no es JSON. */
export function decodeConfig(encoded: string): unknown | null {
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export type EmbedUrlResult =
  | { ok: true; url: string; length: number }
  | { ok: false; url: null; length: number; reason: 'too-long' };

export function buildEmbedUrl(config: ChartConfig, origin: string): EmbedUrlResult {
  const url = `${origin}/embed?c=${encodeConfig(config)}`;
  if (url.length > MAX_URL_LENGTH) {
    return { ok: false, url: null, length: url.length, reason: 'too-long' };
  }
  return { ok: true, url, length: url.length };
}

/*
  ── EL IFRAME, PARA CUANDO PEGAR EL LINK NO BASTA ──────────────────────────

  Notion, Confluence y la mayoría despliegan la URL a secas. Pero en una web
  propia, en un WordPress o en cualquier sitio sin oEmbed, hace falta el
  `<iframe>` — y quien está ahí no tiene por qué saber escribirlo de memoria.

  Vive aquí, junto a `buildEmbedUrl`, y NO en el componente que lo enseña,
  porque hay dos sitios que lo emiten: el editor y la página de «cómo
  funciona». Escrito dos veces, un día dirán cosas distintas y la
  documentación pasará a mentir sobre el producto.

  El alto es lo único con un número fijo: el ancho se resuelve solo, pero
  ningún iframe puede crecer con su contenido, así que hay que dar una cifra
  de partida. 420 es un alto cómodo para una gráfica en un artículo.
*/

const IFRAME_HEIGHT = 420;

/** Escapa lo que va DENTRO de un atributo HTML entre comillas dobles. */
const attr = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * El `<iframe>` listo para pegar. `title` es obligatorio de verdad —un iframe
 * sin título es un agujero sin nombre para quien navega con lector de
 * pantalla—, así que si la gráfica no tiene nombre se usa el que se pase de
 * reserva en lugar de omitir el atributo.
 */
export function buildEmbedIframe(
  url: string,
  title: string,
  height: number = IFRAME_HEIGHT,
): string {
  return [
    '<iframe',
    `  src="${attr(url)}"`,
    '  width="100%"',
    `  height="${height}"`,
    '  style="border:0"',
    '  loading="lazy"',
    `  title="${attr(title)}"`,
    '></iframe>',
  ].join('\n');
}

/**
 * Aplica los overrides de query sobre un config ya decodificado.
 *
 * Devuelve un objeto nuevo: el config original no se toca, porque en el editor
 * es la fuente de verdad del store y mutarlo desde aquí sería un desastre.
 */
export function applyQueryOverrides(
  config: ChartConfig,
  params: URLSearchParams,
): ChartConfig {
  const next: ChartConfig = structuredClone(config);

  const theme = params.get('theme');
  if (theme) next.theme = theme;

  const bg = params.get('bg');
  if (bg && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(bg)) {
    next.scene = {
      ...next.scene,
      background: { ...next.scene?.background, kind: 'solid', from: bg },
    };
  }

  if (params.get('transparent') === '1') {
    next.scene = {
      ...next.scene,
      background: { ...next.scene?.background, kind: 'transparent' },
    };
  }

  const autorotate = params.get('autorotate');
  if (autorotate === '0' || autorotate === '1') {
    next.motion = { ...next.motion, autoRotate: autorotate === '1' };
  }

  return next;
}

/** `?static=1` fuerza el render sin WebGL. Se consulta antes de montar nada. */
export function wantsStatic(params: URLSearchParams): boolean {
  return params.get('static') === '1';
}
