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

  /* El origen sale de la cabecera `Host` y no de `request.url`, que Next
     normaliza: detrás de un proxy son dominios distintos. Mismo motivo que en
     el endpoint oEmbed. */
  const h = request.headers;
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto =
    h.get('x-forwarded-proto') ??
    (host?.startsWith('localhost') || host?.startsWith('127.') ? 'http' : 'https');

  return new Response(
    embedHtml({
      config: result.config,
      css,
      scriptSrc,
      origin: host ? `${proto}://${host}` : null,
      /*
        LA CONFIG-EN-URL TAMBIÉN SE PUEDE INCRUSTAR.

        Antes solo se anunciaban las gráficas guardadas, con el argumento de que
        estas son URLs infinitas —cada movimiento de un slider produce otra— e
        indexarlas llenaría un buscador de duplicados.

        El argumento confundía dos cosas separables: que un BUSCADOR lo indexe y
        que NOTION pueda incrustarlo. Y la promesa del producto es «no hace falta
        cuenta»; con esto apagado, el link sin cuenta no se podía pegar donde la
        gente lo quiere pegar. La promesa se cumplía a medias.

        El riesgo de indexación es además menor de lo que parecía: un buscador
        solo indexa lo que descubre, y estas URLs viven dentro de iframes, que no
        se siguen como enlaces.

        Su canónica es la petición entera, `?c=` incluido: eso ES la gráfica.
      */
      canonical: host ? `${proto}://${host}${new URL(request.url).pathname}${new URL(request.url).search}` : null,
    }),
    { headers: urlEmbedHeaders },
  );
}
