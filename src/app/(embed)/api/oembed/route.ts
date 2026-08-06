import { chartForEmbed } from '@/lib/charts/queries';
import { posterUrl } from '@/lib/charts/poster';
import { parseConfig } from '@/lib/config/parse';
import { decodeConfig } from '@/lib/config/url';
import type { ChartConfig } from '@/lib/config/schema';

/*
  oEmbed: cómo se convierte una URL en una gráfica incrustada.

  ES LA PIEZA QUE FALTABA para que pegar un link en Notion, Canva, WordPress o
  Ghost enseñe la gráfica VIVA y no una tarjeta con una imagen. Esos sitios no
  adivinan: le preguntan al dominio «¿cómo se incrusta esto?» por este protocolo,
  y si nadie contesta se quedan con las etiquetas `og:` — que dan una foto, no un
  embed.

  Iframely, que es por quien pasan Notion y Canva, lo primero que busca es esto.

  El descubrimiento va en el `<head>` del propio embed:
    <link rel="alternate" type="application/json+oembed" href="…">

  Especificación: https://oembed.com
*/

export const dynamic = 'force-dynamic';

/** Proporciones que admite el contrato, en alto/ancho. */
const ASPECTS: Record<string, number> = {
  '16:9': 9 / 16,
  '4:3': 3 / 4,
  '1:1': 1,
  auto: 9 / 16,
};

const DEFAULT_WIDTH = 640;
/** Tope de la especificación para no devolver un iframe gigante. */
const MAX_WIDTH = 1600;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      /* Lo consumen servidores de otros dominios —los de Notion, Canva o
         Iframely—, así que tiene que ser abierto o no lo leen. No hay nada
         sensible: es la misma información que ya sirve el embed público. */
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600',
    },
  });
}

/**
 * El origen que el CLIENTE pidió, no el que Next reconstruye.
 *
 * `request.url` viene normalizado —`localhost` donde el cliente escribió
 * `127.0.0.1`— y detrás de un proxy como Vercel es directamente otro: la
 * petición llega por HTTP a un host interno. Comparar contra eso rechazaba
 * URLs propias por «de otro dominio», que es como se descubrió esto.
 *
 * Se usa `x-forwarded-*` cuando lo hay, que es lo que pone el proxy con lo que
 * de verdad se pidió.
 */
function origenReal(request: Request): string {
  const h = request.headers;
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? new URL(request.url).host;
  const proto =
    h.get('x-forwarded-proto') ??
    (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const origen = origenReal(request);
  const target = params.get('url');

  /* `format` solo admite `json`. La especificación permite además `xml`, y
     devolver 501 es lo que manda para lo que no se implementa — mejor que
     mandar JSON con la etiqueta equivocada. */
  const format = params.get('format');
  if (format && format !== 'json') return json({ error: 'Solo se admite JSON' }, 501);
  if (!target) return json({ error: 'Falta el parámetro url' }, 400);

  /*
    El slug se saca de la URL que nos pasan, y se comprueba que sea DE ESTE
    dominio. Sin esa comprobación, cualquiera podría pedirnos que describiéramos
    la URL de otro y usar nuestro endpoint de intermediario.
  */
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return json({ error: 'URL inválida' }, 400);
  }
  if (url.host !== new URL(origen).host) {
    return json({ error: 'URL de otro dominio' }, 404);
  }

  /*
    DOS FORMAS DE GRÁFICA, y las dos se describen aquí:

      /embed/{slug}   guardada — hay que ir a la base de datos
      /embed?c=…      la config viaja en el propio link, sin cuenta

    La segunda es la promesa del producto —no hace falta registrarse— así que
    tiene que poder incrustarse igual. Lo único que no tiene es póster: nadie
    ha capturado nunca esa gráfica porque no está guardada.
  */
  const slug = url.pathname.match(/^\/embed\/([2-9a-km-np-zA-HJ-NP-Z]{12})$/)?.[1];
  const encoded = url.pathname === '/embed' ? url.searchParams.get('c') : null;

  let config: ChartConfig | null = null;
  let title: string | null = null;
  let poster: string | null = null;

  if (slug) {
    const row = await chartForEmbed(slug);
    // Privada, borrada o inexistente: la misma respuesta para las tres.
    if (!row) return json({ error: 'Esa gráfica no existe' }, 404);
    config = row.config as ChartConfig;
    title = row.title;
    poster = posterUrl(row.poster_path, row.updated_at);
  } else if (encoded) {
    const decoded = decodeConfig(encoded);
    if (decoded === null) return json({ error: 'La configuración no se pudo leer' }, 404);
    config = decoded as ChartConfig;
    title = (decoded as ChartConfig).title ?? null;
  } else {
    return json({ error: 'Esa URL no es una gráfica' }, 404);
  }

  const parsed = parseConfig(config);
  const aspect = parsed.ok ? ASPECTS[parsed.config.layout.aspect] : ASPECTS['16:9'];

  const pedido = Number(params.get('maxwidth'));
  const width = Math.min(
    Number.isFinite(pedido) && pedido > 0 ? pedido : DEFAULT_WIDTH,
    MAX_WIDTH,
  );
  const height = Math.round(width * (aspect ?? 9 / 16));

  /* Se devuelve la MISMA URL que nos han dado, no una reconstruida: en la
     config-en-URL el `?c=` entero es la gráfica y perderlo daría un iframe
     vacío. */
  const src = `${origen}${url.pathname}${url.search}`;

  /*
    `loading="lazy"` y `allowfullscreen` no: una gráfica no va a pantalla
    completa. Sí `title`, que es lo que lee un lector de pantalla al llegar al
    iframe — sin él dice «marco», que no ayuda a nadie.
  */
  const nombre = title ?? 'Gráfica';
  const html =
    `<iframe src="${src}" width="${width}" height="${height}" ` +
    `title="${nombre.replace(/"/g, '&quot;')}" ` +
    `frameborder="0" loading="lazy" style="border:0;max-width:100%"></iframe>`;

  return json({
    version: '1.0',
    type: 'rich',
    provider_name: 'Volumine',
    provider_url: origen,
    title: nombre,
    html,
    width,
    height,
    /* La miniatura es el póster. Quien no sepa incrustar un iframe —o el usuario
       que prefiera una imagen— se queda al menos con la gráfica. */
    ...(poster
      ? {
          thumbnail_url: poster,
          thumbnail_width: 1200,
          thumbnail_height: Math.round(1200 * (aspect ?? 9 / 16)),
        }
      : {}),
  });
}
