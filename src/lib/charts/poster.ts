import { supabaseEnv } from '@/lib/supabase/env';

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

/** Dónde vive el póster de una gráfica dentro del bucket. */
export function posterPath(ownerId: string, slug: string): string {
  /* El dueño va en la RUTA, no solo en la base de datos: así la política de
     Storage puede comprobar la propiedad mirando la primera carpeta, sin
     consultar `charts` (migración 0004). */
  return `${ownerId}/${slug}.png`;
}

/**
 * La URL pública de un póster. `null` si no tiene.
 *
 * Se compone aquí y no se guarda en la fila: la URL lleva dentro el dominio del
 * proyecto de Supabase, y guardarla entera ataría cada gráfica a ese dominio
 * para siempre — mover el proyecto o poner un CDN delante obligaría a reescribir
 * todas las filas.
 */
export function posterUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { url } = supabaseEnv();
  return `${url}/storage/v1/object/public/posters/${path}`;
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
