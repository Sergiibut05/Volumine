import { decodeConfig, applyQueryOverrides } from '@/lib/config/url';
import { parseConfig } from '@/lib/config/parse';
import type { ChartConfig } from '@/lib/config/schema';
import { EmbedChart } from './EmbedChart';
import { DataTable } from './DataTable';

/*
  /embed?c=<config comprimida>

  Todo lo que se pueda hacer en servidor se hace en servidor: decodificar,
  validar y resolver el config no necesita llegar al cliente. Lo único que se
  hidrata es el canvas.

  Prohibido aquí (ADR 0005): cookies, localStorage, auth, analytics, peticiones
  a terceros, navegación al top.
*/

export const dynamic = 'force-static';
export const revalidate = false;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EmbedPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const encoded = typeof params.c === 'string' ? params.c : null;

  if (!encoded) return <EmbedError message="Falta el parámetro de configuración" />;

  const decoded = decodeConfig(encoded);
  if (decoded === null) return <EmbedError message="La configuración no se pudo leer" />;

  const query = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) =>
      typeof v === 'string' ? [[k, v] as [string, string]] : [],
    ),
  );

  const withOverrides = applyQueryOverrides(decoded as ChartConfig, query);
  const result = parseConfig(withOverrides);

  if (!result.ok) {
    return <EmbedError message={result.issues[0]?.message ?? 'Configuración inválida'} />;
  }

  return (
    <div className="stage">
      {/* Los datos SIEMPRE en el DOM: accesibilidad y lectores de pantalla. */}
      <DataTable config={result.config} />
      <EmbedChart config={result.config} issues={result.issues} />
    </div>
  );
}

function EmbedError({ message }: { message: string }) {
  return (
    <div
      className="stage"
      style={{ display: 'grid', placeContent: 'center', padding: '1rem' }}
    >
      <p style={{ color: '#9a9aab', fontSize: 13, margin: 0, textAlign: 'center' }}>
        {message}
      </p>
    </div>
  );
}
