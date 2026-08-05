import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import '@/styles/auth.css';
import { allowance, currentUser, myCharts } from '@/lib/charts/queries';
import { ChartCard } from './ChartCard';
import { SignOut } from './SignOut';

export const metadata: Metadata = {
  title: 'Mis gráficas · Voluma',
  robots: { index: false, follow: false },
};

/* Datos de una sesión concreta: no se cachea nada entre peticiones. */
export const dynamic = 'force-dynamic';

/** El origen real de la petición. En local, en preview y en producción cambia. */
async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto =
    h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export default async function MisGraficasPage() {
  const user = await currentUser();
  if (!user) redirect('/entrar?next=/mis-graficas');

  const [charts, cupo, base] = await Promise.all([myCharts(), allowance(), origin()]);

  return (
    <div className="charts-page" data-theme="light">
      <div className="charts-shell">
        <header className="charts-head">
          <h1 className="display">Mis gráficas</h1>
          {cupo && (
            <span className="charts-quota">
              {cupo.used} de {cupo.max}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <Link className="cta" href="/crear">
            Nueva gráfica
          </Link>
          <SignOut />
        </header>

        {/* El cupo se avisa ANTES de que falle. Quien decide es el trigger de la
            base de datos, pero enterarse al pulsar guardar es peor que verlo. */}
        {cupo?.full && (
          <p className="auth-error">
            Has llegado al límite de {cupo.max} gráficas de tu plan. Borra alguna para poder
            guardar otra.
          </p>
        )}

        {charts.length === 0 ? (
          <div className="charts-empty">
            <p>Todavía no has guardado ninguna.</p>
            <Link className="cta" href="/crear">
              Hacer la primera
            </Link>
          </div>
        ) : (
          <ul className="charts-grid">
            {charts.map((chart) => (
              <ChartCard key={chart.id} chart={chart} origin={base} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
