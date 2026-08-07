import { supabaseEnv } from '@/lib/supabase/env';
import { cssGradientLine } from './gradient';
import type { ResolvedChartConfig } from '@/lib/config/defaults';

/*
  El póster: la imagen fija de una gráfica.

  Sirve para dos cosas y las dos son de fuera de la aplicación:

    · `og:image`, para que pegar el link en Slack, Notion o WhatsApp enseñe la
      gráfica y no un rectángulo con el título. En un producto cuyo producto ES
      EL LINK, ese es el peor sitio posible donde fallar.
    · El respaldo cuando no hay WebGL, donde hoy solo queda la tabla de datos.

  LO CAPTURA EL NAVEGADOR, no el servidor. Ver la nota larga en la migración
  0004: rehacer el render en servidor pediría WebGL sin GPU y aun así no daría
  el mismo píxel, que es justo lo que este proyecto promete.
*/

/** Las dos formas que puede tomar un póster. Ver `composePoster`. */
export type PosterFormat = 'png' | 'jpg';

/** Todas las extensiones, para poder limpiar la que ya no toca al reguardar. */
export const POSTER_FORMATS: readonly PosterFormat[] = ['png', 'jpg'];

/** Dónde vive el póster de una gráfica dentro del bucket. */
export function posterPath(
  ownerId: string,
  slug: string,
  format: PosterFormat = 'png',
): string {
  /* El dueño va en la RUTA, no solo en la base de datos: así la política de
     Storage puede comprobar la propiedad mirando la primera carpeta, sin
     consultar `charts` (migración 0004). */
  return `${ownerId}/${slug}.${format}`;
}

/**
 * La URL pública de un póster. `null` si no tiene.
 *
 * Se compone aquí y no se guarda en la fila: la URL lleva dentro el dominio del
 * proyecto de Supabase, y guardarla entera ataría cada gráfica a ese dominio
 * para siempre — mover el proyecto o poner un CDN delante obligaría a reescribir
 * todas las filas.
 */
export function posterUrl(
  path: string | null | undefined,
  version?: string | null,
): string | null {
  if (!path) return null;
  const { url } = supabaseEnv();
  const base = `${url}/storage/v1/object/public/posters/${path}`;

  /*
    `?v=` CON LA FECHA DE LA ÚLTIMA EDICIÓN.

    Al reguardar, el PNG se sube con `upsert` y PISA al anterior — pero la ruta
    es la misma, así que la URL también, y ni el navegador ni el CDN de Storage
    se enteran: seguían enseñando la miniatura vieja durante una hora. La gráfica
    estaba bien guardada y bien subida; lo que mentía era la caché.

    El parámetro no lo mira el servidor, solo cambia la clave de caché. Va con
    `updated_at` y no con `Date.now()` a propósito: dos visitas a la misma
    versión comparten caché, que es lo que se quiere.
  */
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}

/**
 * Convierte lo que devuelve `canvas.toDataURL()` en algo subible.
 *
 * `fetch` sobre un `data:` URL lo hace el navegador solo y sin red — es más
 * corto y más difícil de equivocar que trocear el base64 a mano.
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

export type PosterBackground = ResolvedChartConfig['scene']['background'];

/** El póster ya listo para subir: los bytes, y con qué nombre y tipo van. */
export type ComposedPoster = {
  dataUrl: string;
  format: PosterFormat;
  contentType: string;
};

/** Carga un `data:` URL como imagen. Sin red: lo resuelve el propio navegador. */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('no se ha podido leer la captura'));
    image.src = dataUrl;
  });
}

/**
 * Calidad del JPEG. Medido sobre un anillo con degradado a 2000×1600:
 * 96 KB contra los 2602 KB del mismo PNG, y sin artefactos visibles en los
 * cantos. Bajar a 0,85 ahorra 23 KB y ya se le ven halos a los bordes.
 */
const JPEG_QUALITY = 0.92;

/**
 * Deja el póster listo para subir: con su fondo debajo y en el formato que le
 * toca.
 *
 * ── EL AGUJERO QUE TAPA ──────────────────────────────────────────────────
 *
 * El póster se captura del CANVAS, y el canvas no siempre lleva el fondo
 * dentro. Con «degradado» no lo lleva nunca: se pinta con CSS en el
 * contenedor, por detrás (ver la nota en `chart-renderer.ts` — un degradado de
 * CSS se compone a resolución de pantalla y no tiene banding, y meterlo en
 * WebGL costaría un quad, un shader y más cosas que liberar justo en la ruta
 * con el presupuesto más apretado).
 *
 * Resultado: alguien elegía un fondo azul degradado, guardaba, y en Slack o en
 * Notion salía su gráfica recortada sobre blanco. La configuración estaba bien
 * y la captura también; lo que faltaba era el fondo.
 *
 * ── POR QUÉ EL FORMATO CAMBIA ────────────────────────────────────────────
 *
 * Un degradado suave es lo PEOR que se le puede dar a un PNG: no hay dos filas
 * iguales, así que no comprime. El mismo póster pesa 2602 KB en PNG y 96 en
 * JPEG — 27 veces más, y esto acaba en `og:image`, que es donde el link se
 * vende. Un scraper que tarda en descargar 2,6 MB es un enlace sin vista
 * previa.
 *
 * Así que: PNG solo cuando hace falta ALFA —fondo transparente, donde la
 * transparencia es la gracia—, y JPEG cuando el fondo es opaco y no hay nada
 * que preservar. WebP pesaría la mitad que el JPEG, y no se usa a propósito:
 * el soporte entre scrapers de vista previa es irregular y esta es justo la
 * superficie donde no se puede apostar.
 *
 * ── POR QUÉ SE COMPONE AQUÍ Y NO EN EL RENDERER ──────────────────────────
 *
 * Porque el renderer entra ENTERO en el bundle de `/embed` y el embed no
 * captura pósters jamás. Esto vive en el lado de la aplicación, donde no le
 * cuesta un byte a nadie.
 */
export async function composePoster(
  dataUrl: string,
  background: PosterBackground,
): Promise<ComposedPoster> {
  const png: ComposedPoster = { dataUrl, format: 'png', contentType: 'image/png' };

  /* Transparente se queda como está: quien incrusta la gráfica quiere que se
     funda con su página, y ahí el alfa ES el contenido. */
  if (background.kind === 'transparent') return png;

  const image = await loadImage(dataUrl);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) return png;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  /* Sin contexto 2D se devuelve la captura tal cual en vez de reventar: un
     póster sin fondo es infinitamente mejor que un guardado que falla. */
  if (!ctx) return png;

  if (background.kind === 'gradient') {
    const line = cssGradientLine(background.angle, width, height);
    const fill = ctx.createLinearGradient(line.x0, line.y0, line.x1, line.y1);
    fill.addColorStop(0, background.from);
    fill.addColorStop(1, background.to);
    ctx.fillStyle = fill;
  } else {
    /* `solid` y también `grid`/`dots`, que están en el contrato pero todavía no
       se dibujan: el renderer los trata como un color plano y el póster tiene
       que enseñar lo mismo que la pantalla, no lo que dice el esquema. */
    ctx.fillStyle = background.from;
  }

  ctx.fillRect(0, 0, width, height);
  // La gráfica ENCIMA. El canvas de WebGL trae alfa, así que se compone sola.
  ctx.drawImage(image, 0, 0);

  return {
    dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY),
    format: 'jpg',
    contentType: 'image/jpeg',
  };
}
