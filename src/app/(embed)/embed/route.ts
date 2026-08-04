import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { decodeConfig, applyQueryOverrides } from '@/lib/config/url';
import { parseConfig } from '@/lib/config/parse';
import type { ChartConfig } from '@/lib/config/schema';
import { embedHtml, errorHtml } from '@/embed/html';

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

type Assets = { css: string; scriptSrc: string };
let cached: Assets | null = null;

/** Lee el CSS y el manifiesto del bundle. En producción se cachea en memoria. */
async function assets(): Promise<Assets> {
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

const headers = {
  'Content-Type': 'text/html; charset=utf-8',
  // El embed tiene que poder cargarse dentro de CUALQUIER página (ADR 0005).
  'Content-Security-Policy': 'frame-ancestors *',
  'X-Content-Type-Options': 'nosniff',
  // La config va entera en la URL, así que la URL identifica el contenido.
  'Cache-Control': 'public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400',
};

export async function GET(request: Request): Promise<Response> {
  const { css, scriptSrc } = await assets();
  const params = new URL(request.url).searchParams;
  const encoded = params.get('c');

  const fail = (message: string, status = 400) =>
    new Response(errorHtml(message, css), { status, headers });

  if (!encoded) return fail('Falta el parámetro de configuración');

  const decoded = decodeConfig(encoded);
  if (decoded === null) return fail('La configuración no se pudo leer');

  const result = parseConfig(applyQueryOverrides(decoded as ChartConfig, params));
  if (!result.ok) {
    return fail(result.issues[0]?.message ?? 'Configuración inválida', 422);
  }

  return new Response(embedHtml({ config: result.config, css, scriptSrc }), { headers });
}
