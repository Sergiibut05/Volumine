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
