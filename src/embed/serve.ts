import { readFile } from 'node:fs/promises';
import path from 'node:path';
/* Compartido con `scripts/perf-embed.mjs`: el medidor tiene que medir lo
   MISMO que se envía, y con dos copias se separan al primer cambio. */
import { minifyCss } from '../../scripts/minify-css.mjs';

/*
  Lo que comparten las dos formas de servir un embed:

    /embed?c=…      la config viaja en la URL, sin cuenta ni base de datos
    /embed/{slug}   la config está guardada, el link es corto

  Las dos devuelven EXACTAMENTE el mismo HTML. Eso no es casualidad ni ahorro
  de código: es la garantía de que guardar una gráfica no cambia ni un píxel de
  cómo se ve, y de que las reglas del embed anónimo (ADR 0005) se cumplen en los
  dos caminos porque solo hay un sitio donde cumplirlas.
*/

/**
 * Una tipografía servida por nosotros.
 *
 * Va en CORTES con su `unicode-range`: el navegador solo descarga el que hace
 * falta para el texto que hay. Una etiqueta en español no pide un byte del
 * corte con las letras polacas aunque el fichero exista.
 */
export type EmbedFont = {
  family: string;
  slices: { file: string; unicodeRange: string }[];
};

export type Assets = {
  css: string;
  scriptSrc: string;
  /** Por id del contrato (`inter`, `display`, `mono`). Vacío si no hay build. */
  fonts: Record<string, EmbedFont>;
};

let cached: Assets | null = null;

/** Lee el CSS y el manifiesto del bundle. En producción se cachea en memoria. */
export async function embedAssets(): Promise<Assets> {
  if (cached && process.env.NODE_ENV === 'production') return cached;

  const root = process.cwd();
  /*
    El CSS se envía SIN COMENTARIOS.

    Se insertaba entero en el HTML de cada embed, comentarios incluidos: 16,6 KB
    de los que 10,5 eran prosa, dentro de la página de otra persona. El
    presupuesto son 8 KB y llevaba tiempo roto por el doble sin que la causa
    saltara a la vista — `npm run perf:embed` decía «fuera de presupuesto» y
    nadie miraba de dónde salían los kilobytes.

    Los comentarios se quedan en el fuente: explican decisiones que no se ven en
    el código y son justo lo que hace falta dentro de seis meses.
  */
  const css = minifyCss(await readFile(path.join(root, 'src/styles/embed.css'), 'utf8'));

  let scriptSrc = '/embed-bundle/volumine.js';
  try {
    const manifest = JSON.parse(
      await readFile(path.join(root, 'public/embed-bundle/manifest.json'), 'utf8'),
    ) as { file: string };
    scriptSrc = `/embed-bundle/${manifest.file}`;
  } catch {
    // Sin manifiesto: se ha olvidado `npm run build:embed`. Se sirve el nombre
    // por defecto para que en desarrollo siga funcionando.
  }

  /*
    Las tipografías que PUEDE pedir una gráfica. Que estén aquí no significa que
    se descarguen: el `@font-face` solo se emite para la que se use, y por
    defecto no se usa ninguna. Ver scripts/build-embed-fonts.mjs.
  */
  let fonts: Record<string, EmbedFont> = {};
  try {
    fonts = JSON.parse(
      await readFile(path.join(root, 'public/embed-fonts/manifest.json'), 'utf8'),
    ) as Record<string, EmbedFont>;
  } catch {
    /* Sin manifiesto —falta `npm run build:fonts`— se cae a las familias del
       sistema. Se pierde la identidad de píxel, no la gráfica. */
  }

  cached = { css, scriptSrc, fonts };
  return cached;
}

const BASE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  // El embed tiene que poder cargarse dentro de CUALQUIER página (ADR 0005).
  'Content-Security-Policy': 'frame-ancestors *',
  'X-Content-Type-Options': 'nosniff',
  /*
    ══════════════════════════════════════════════════════════════════════════
    FUERA DEL ÍNDICE, PERO LEGIBLE. NO ES LO MISMO.
    ══════════════════════════════════════════════════════════════════════════

    Un embed indexado es un mal resultado de búsqueda —una gráfica suelta, sin
    cabecera y sin vuelta atrás—, y como la config viaja en la URL, la misma
    gráfica genera direcciones infinitas: contenido duplicado que se come el
    presupuesto de rastreo. Eso sigue siendo verdad y por eso está el `noindex`.

    Lo que estaba mal era el MECANISMO. Se hacía con `Disallow: /embed` en
    robots.txt, y robots.txt no prohíbe indexar: prohíbe DESCARGAR. Al prohibir
    la descarga se llevaba por delante a los rastreadores sociales —Twitterbot,
    facebookexternalhit, Slackbot—, que ni indexan ni quieren: sólo leen cuatro
    etiquetas para pintar una tarjeta. Pedían permiso, se les decía que no, y
    todo link de gráfica salía como texto pelado en X, en WhatsApp y en Slack.

    En un producto cuyo producto ES EL LINK, ese era el peor sitio donde fallar.
    Se descubrió el día del lanzamiento, pegando el primer link en X.

    La cabecera consigue las dos cosas: quien indexa la lee y se abstiene, quien
    sólo quiere la tarjeta la ignora y sigue. Y sólo funciona si robots.txt
    DEJA descargar la página — si no, nadie llega a leer esto. Las dos mitades
    de la misma decisión: ver `src/app/robots.ts`.
  */
  'X-Robots-Tag': 'noindex',
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
