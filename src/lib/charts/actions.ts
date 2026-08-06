'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { chartConfigSchema } from '@/lib/config/schema';
import type { ChartRow, Visibility } from '@/lib/supabase/types';

/*
  Escrituras. Todas server actions, ninguna desde el navegador.

  El motivo no es el rendimiento: es que así el `owner_id` sale de la SESIÓN y
  no de un formulario. RLS lo rechazaría igual —`with check (auth.uid() =
  owner_id)`—, pero el mejor sitio para no cometer un error es aquel donde no se
  puede cometer.

  El config se REVALIDA aquí con Zod antes de guardar. Ya se validó en el editor,
  sí, pero el editor es código de cliente y una server action es un endpoint
  público: cualquiera puede llamarla con lo que quiera.
*/

export type ActionResult =
  { ok: true; id: string; slug: string } | { ok: false; error: string };

/** Traduce un error de Postgres a algo que se pueda leer sin ser de aquí. */
function explain(message: string): string {
  if (message.includes('cuota agotada')) {
    return 'Has llegado al límite de gráficas de tu plan. Borra alguna para guardar esta.';
  }
  if (message.includes('charts_config_acotada')) {
    return 'La gráfica es demasiado grande para guardarla. Prueba con menos filas.';
  }
  if (message.includes('duplicate key') && message.includes('slug')) {
    return 'Ha habido una colisión al generar el link. Vuelve a intentarlo.';
  }
  return 'No se ha podido guardar. Inténtalo de nuevo.';
}

async function sessionOrRedirect() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/entrar');
  return { supabase, user };
}

/**
 * Guarda una gráfica nueva.
 *
 * `watermark` y `slug` NO se aceptan del cliente: los pone la base de datos.
 * La marca de agua sale del plan por trigger (ADR 0005) y el slug se genera con
 * `gen_random_bytes`. Mandarlos aquí no serviría de nada, pero es que además ni
 * se leen.
 */
export async function createChart(
  rawConfig: unknown,
  visibility: Visibility = 'private',
): Promise<ActionResult> {
  const parsed = chartConfigSchema.safeParse(rawConfig);
  if (!parsed.success) return { ok: false, error: 'La configuración no es válida.' };

  const { supabase, user } = await sessionOrRedirect();
  const config = parsed.data;

  const { data, error } = await supabase
    .from('charts')
    .insert({
      owner_id: user.id,
      title: config.title ?? null,
      type: config.type,
      config,
      visibility,
    })
    .select('id, slug')
    .single<Pick<ChartRow, 'id' | 'slug'>>();

  if (error) return { ok: false, error: explain(error.message) };

  revalidatePath('/mis-graficas');
  return { ok: true, id: data.id, slug: data.slug };
}

/** Actualiza una existente. RLS decide si es tuya; aquí no se comprueba. */
export async function updateChart(
  id: string,
  rawConfig: unknown,
  visibility?: Visibility,
): Promise<ActionResult> {
  const parsed = chartConfigSchema.safeParse(rawConfig);
  if (!parsed.success) return { ok: false, error: 'La configuración no es válida.' };

  const { supabase } = await sessionOrRedirect();
  const config = parsed.data;

  const { data, error } = await supabase
    .from('charts')
    .update({
      title: config.title ?? null,
      type: config.type,
      config,
      ...(visibility ? { visibility } : {}),
    })
    .eq('id', id)
    .select('id, slug')
    .maybeSingle<Pick<ChartRow, 'id' | 'slug'>>();

  if (error) return { ok: false, error: explain(error.message) };
  /* Sin error y sin fila = RLS la ha filtrado: o no existe o no es tuya. Los dos
     casos se contestan igual a propósito. Distinguirlos convertiría esto en un
     detector de qué ids existen. */
  if (!data) return { ok: false, error: 'Esa gráfica no existe o no es tuya.' };

  revalidatePath('/mis-graficas');
  revalidatePath(`/embed/${data.slug}`);
  return { ok: true, id: data.id, slug: data.slug };
}

/**
 * Copia una gráfica.
 *
 * La copia SIEMPRE nace privada y con slug nuevo, aunque el original fuera
 * público. Duplicar es un borrador; publicar es una decisión aparte, y heredar
 * el «público» del original publicaría un experimento sin que nadie lo pidiera.
 */
export async function duplicateChart(id: string): Promise<ActionResult> {
  const { supabase, user } = await sessionOrRedirect();

  const { data: source } = await supabase
    .from('charts')
    .select('title, type, config, poster_path')
    .eq('id', id)
    .maybeSingle<Pick<ChartRow, 'title' | 'type' | 'config' | 'poster_path'>>();

  if (!source) return { ok: false, error: 'Esa gráfica no existe o no es tuya.' };

  const { data, error } = await supabase
    .from('charts')
    .insert({
      owner_id: user.id,
      title: source.title ? `${source.title} (copia)` : null,
      type: source.type,
      config: source.config,
      visibility: 'private',
      /* La copia HEREDA el póster del original. Son la misma gráfica hasta que
         alguien la toque, así que la miniatura del listado es correcta desde el
         primer momento; sin esto la copia salía como un hueco gris y parecía
         que se había duplicado mal. Se reemplaza sola al guardar la copia. */
      poster_path: source.poster_path,
    })
    .select('id, slug')
    .single<Pick<ChartRow, 'id' | 'slug'>>();

  if (error) return { ok: false, error: explain(error.message) };

  revalidatePath('/mis-graficas');
  return { ok: true, id: data.id, slug: data.slug };
}

/**
 * Borra una gráfica.
 *
 * Sin papelera y sin vuelta atrás, y el link publicado deja de funcionar al
 * instante. Es lo correcto: quien borra una gráfica publicada muchas veces lo
 * hace justo porque no quería que se viera. La confirmación va en la interfaz.
 */
export async function deleteChart(id: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await sessionOrRedirect();

  const { data, error } = await supabase
    .from('charts')
    .delete()
    .eq('id', id)
    .select('slug')
    .maybeSingle<Pick<ChartRow, 'slug'>>();

  if (error) return { ok: false, error: 'No se ha podido borrar.' };
  if (!data) return { ok: false, error: 'Esa gráfica no existe o no es tuya.' };

  revalidatePath('/mis-graficas');
  revalidatePath(`/embed/${data.slug}`);
  return { ok: true };
}

/**
 * Apunta en la fila dónde ha quedado el póster.
 *
 * La imagen la sube el navegador directamente a Storage —RLS le deja escribir
 * solo en su propia carpeta— y aquí solo llega la RUTA. Mandar el PNG entero
 * por una server action serían 200 KB de base64 dando un rodeo por nuestro
 * servidor para acabar en el mismo sitio.
 *
 * Si falla, no se dice: una gráfica sin póster funciona igual. Perder la vista
 * previa de Slack no puede impedirle a nadie guardar su trabajo.
 */
export async function setPoster(id: string, path: string): Promise<void> {
  const { supabase } = await sessionOrRedirect();
  const { data } = await supabase
    .from('charts')
    .update({ poster_path: path })
    .eq('id', id)
    .select('slug')
    .maybeSingle<Pick<ChartRow, 'slug'>>();

  if (data) revalidatePath(`/embed/${data.slug}`);
}

/** Publica o despublica. Es lo único que decide si el link funciona para nadie más. */
export async function setVisibility(
  id: string,
  visibility: Visibility,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await sessionOrRedirect();

  const { data, error } = await supabase
    .from('charts')
    .update({ visibility })
    .eq('id', id)
    .select('slug')
    .maybeSingle<Pick<ChartRow, 'slug'>>();

  if (error) return { ok: false, error: 'No se ha podido cambiar la visibilidad.' };
  if (!data) return { ok: false, error: 'Esa gráfica no existe o no es tuya.' };

  revalidatePath('/mis-graficas');
  revalidatePath(`/embed/${data.slug}`);
  return { ok: true };
}
