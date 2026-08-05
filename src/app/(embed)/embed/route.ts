import { decodeConfig, applyQueryOverrides } from '@/lib/config/url';
import { parseConfig } from '@/lib/config/parse';
import type { ChartConfig } from '@/lib/config/schema';
import { embedHtml, errorHtml } from '@/embed/html';
import { embedAssets, urlEmbedHeaders } from '@/embed/serve';

/*
  /embed?c=<config comprimida>

  Es un route handler, no una página: devuelve HTML escrito a mano. Así el
  navegador no descarga React ni el runtime del App Router, que son ~110 KB gz
  que no caben en el presupuesto (ADR 0006, docs/PERFORMANCE-BUDGET.md).

  Todo lo que se puede hacer en servidor se hace en servidor: decodificar,
  migrar, validar y resolver el config. El cliente solo recibe JSON ya resuelto
  y pinta — ni siquiera necesita Zod.
*/

/*
  Dinámica a la fuerza. Con `force-static`, Next normaliza la petición y
  **descarta el query string**, así que `?c=` llega vacío y el embed responde
  siempre "falta el parámetro de configuración". La caché la da la cabecera
  `Cache-Control` de abajo, que es lo correcto aquí: la URL identifica el
  contenido por completo.
*/
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const { css, scriptSrc } = await embedAssets();
  const params = new URL(request.url).searchParams;
  const encoded = params.get('c');

  const fail = (message: string, status = 400) =>
    new Response(errorHtml(message, css), { status, headers: urlEmbedHeaders });

  if (!encoded) return fail('Falta el parámetro de configuración');

  const decoded = decodeConfig(encoded);
  if (decoded === null) return fail('La configuración no se pudo leer');

  const result = parseConfig(applyQueryOverrides(decoded as ChartConfig, params));
  if (!result.ok) {
    return fail(result.issues[0]?.message ?? 'Configuración inválida', 422);
  }

  return new Response(embedHtml({ config: result.config, css, scriptSrc }), {
    headers: urlEmbedHeaders,
  });
}
