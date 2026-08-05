import { readFile } from 'node:fs/promises';
import path from 'node:path';

/*
  Lo que comparten las dos formas de servir un embed:

    /embed?c=…      la config viaja en la URL, sin cuenta ni base de datos
    /embed/{slug}   la config está guardada, el link es corto

  Las dos devuelven EXACTAMENTE el mismo HTML. Eso no es casualidad ni ahorro
  de código: es la garantía de que guardar una gráfica no cambia ni un píxel de
  cómo se ve, y de que las reglas del embed anónimo (ADR 0005) se cumplen en los
  dos caminos porque solo hay un sitio donde cumplirlas.
*/

export type Assets = { css: string; scriptSrc: string };

let cached: Assets | null = null;

/** Lee el CSS y el manifiesto del bundle. En producción se cachea en memoria. */
export async function embedAssets(): Promise<Assets> {
  if (cached && process.env.NODE_ENV === 'production') return cached;

  const root = process.cwd();
  const css = await readFile(path.join(root, 'src/styles/embed.css'), 'utf8');

  let scriptSrc = '/embed-bundle/voluma.js';
  try {
    const manifest = JSON.parse(
      await readFile(path.join(root, 'public/embed-bundle/manifest.json'), 'utf8'),
    ) as { file: string };
    scriptSrc = `/embed-bundle/${manifest.file}`;
  } catch {
    // Sin manifiesto: se ha olvidado `npm run build:embed`. Se sirve el nombre
    // por defecto para que en desarrollo siga funcionando.
  }

  cached = { css, scriptSrc };
  return cached;
}

const BASE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  // El embed tiene que poder cargarse dentro de CUALQUIER página (ADR 0005).
  'Content-Security-Policy': 'frame-ancestors *',
  'X-Content-Type-Options': 'nosniff',
};

/**
 * Cabeceras para la config-en-URL.
 *
 * Cachea un año porque la URL identifica el contenido POR COMPLETO: el mismo
 * `?c=` no puede dar nunca un dibujo distinto.
 */
export const urlEmbedHeaders = {
  ...BASE_HEADERS,
  'Cache-Control': 'public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400',
};

/**
 * Cabeceras para el embed guardado.
 *
 * Aquí NO se puede cachear un año, y esta es la diferencia que importa entre
 * los dos caminos: detrás de `/embed/{slug}` hay una fila que su dueño puede
 * editar o despublicar. Con caché larga, despublicar no despublicaría nada —la
 * gráfica seguiría sirviéndose desde el borde durante meses—, que es un fallo
 * de privacidad, no de frescura.
 *
 * Un minuto en el borde es la cota de cuánto puede sobrevivir algo retirado. Las
 * ediciones se ven antes: las server actions purgan esta ruta al guardar.
 */
export const savedEmbedHeaders = {
  ...BASE_HEADERS,
  'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600',
};
