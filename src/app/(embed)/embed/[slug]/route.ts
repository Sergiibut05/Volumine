import { applyQueryOverrides } from '@/lib/config/url';
import { parseConfig } from '@/lib/config/parse';
import type { ChartConfig } from '@/lib/config/schema';
import { embedHtml, errorHtml } from '@/embed/html';
import { embedAssets, savedEmbedHeaders } from '@/embed/serve';
import { chartForEmbed } from '@/lib/charts/queries';

/*
  /embed/{slug} — la misma gráfica, con link corto y guardada.

  ══════════════════════════════════════════════════════════════════════════
  ESTA RUTA NO TIENE SESIÓN Y NO PUEDE TENERLA (ADR 0005). No lee cookies, no
  las escribe, y el middleware la excluye a propósito. Se carga dentro de un
  iframe con `sandbox` en la página de otra persona: una cookie aquí no es que
  esté mal, es que no llegaría.

  De ahí sale lo demás: quién puede ver esto lo decide POSTGRES con la clave
  anónima (`visibility = 'public'` en RLS), no este archivo.
  ══════════════════════════════════════════════════════════════════════════
*/

export const dynamic = 'force-dynamic';

/** Lo que genera `generar_slug()` en la migración: 12 caracteres del alfabeto. */
const SLUG = /^[2-9a-km-np-zA-HJ-NP-Z]{12}$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { css, scriptSrc } = await embedAssets();
  const { slug } = await params;

  const fail = (message: string, status: number) =>
    new Response(errorHtml(message, css), { status, headers: savedEmbedHeaders });

  /* Se comprueba la FORMA antes de ir a la base de datos. No es validación de
     seguridad —la consulta va parametrizada— sino no darle una consulta por
     cada URL inventada a quien se dedique a probar. */
  if (!SLUG.test(slug)) return fail('Esta gráfica no existe', 404);

  const row = await chartForEmbed(slug);

  /* No existe, es privada o se ha borrado: TODO responde 404, y con el mismo
     texto. Distinguir «privada» de «no existe» convertiría esto en un detector
     de qué slugs están ocupados. */
  if (!row) return fail('Esta gráfica no existe', 404);

  const params_ = new URL(request.url).searchParams;
  const result = parseConfig(applyQueryOverrides(row.config as ChartConfig, params_));

  if (!result.ok) {
    /* Se guardó con un contrato que ya no valida. Que se avise, pero sin
       detalles: quien mira esto está en la página de un tercero y no puede
       hacer nada con el mensaje de error. */
    return fail('Esta gráfica no se ha podido dibujar', 422);
  }

  /*
    LA MARCA DE AGUA SE PISA AQUÍ, con lo que diga la FILA.

    `row.watermark` lo mantiene un trigger desde el plan del dueño y el cliente
    no puede tocarlo. Guardar un `layout.watermark: false` en la config no sirve
    de nada porque esta línea llega después (ADR 0005).
  */
  const config = {
    ...result.config,
    layout: { ...result.config.layout, watermark: row.watermark },
    // El título de la fila manda: es el que se ve en el listado del dueño.
    title: row.title ?? result.config.title,
  };

  return new Response(embedHtml({ config, css, scriptSrc }), {
    headers: savedEmbedHeaders,
  });
}
