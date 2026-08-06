import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import '@/styles/auth.css';
import { allowance, currentUser, myCharts } from '@/lib/charts/queries';
import { ChartCard } from './ChartCard';
import { Wordmark } from '../Wordmark';
import { SignOut } from './SignOut';

export const metadata: Metadata = {
  title: 'Mis gráficas · Volumine',
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
          <Link href="/" className="charts-brand" aria-label="Volumine — inicio">
            <Wordmark size={1.0625} />
          </Link>

          <div className="charts-title">
            <h1 className="display">Mis gráficas</h1>
            {cupo && (
              <p className="charts-quota">
                {cupo.used} de {cupo.max} · plan {cupo.plan}
              </p>
            )}
          </div>

          <div className="charts-head-actions">
            <Link className="cta" href="/crear">
              Nueva gráfica
            </Link>
            <SignOut />
          </div>
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
          /*
            El vacío es una PANTALLA, no un hueco.

            Un recuadro de puntos ocupando el ancho de la ventana con una frase
            dentro se lee como algo que ha fallado al cargar. Es además el primer
            momento de alguien que acaba de registrarse, así que es donde hay que
            explicar para qué sirve esto — no dejarle mirando un rectángulo.
          */
          <div className="charts-empty">
            <span className="charts-empty-mark" aria-hidden>
              <Wordmark size={1.5} />
            </span>
            <h2>Aún no has guardado ninguna</h2>
            <p>
              Guardar te da un link corto que puedes pegar en Notion, en tu web o
              donde quieras, y volver a editar cuando te apetezca.
            </p>
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
