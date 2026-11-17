import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import '@/styles/auth.css';
import { allowance, currentUser, myCharts } from '@/lib/charts/queries';
import { ChartCard } from './ChartCard';
import { Wordmark } from '../Wordmark';
import { SignOut } from './SignOut';
import { getDictionary } from '@/lib/i18n/server';
import { fill } from '@/lib/i18n/dictionaries';

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getDictionary();
  return { title: d.charts.title, robots: { index: false, follow: false } };
}

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

  const [charts, cupo, base, { d }] = await Promise.all([
    myCharts(),
    allowance(),
    origin(),
    getDictionary(),
  ]);

  return (
    <div className="charts-page" data-theme="light">
      <div className="charts-shell">
        <header className="charts-head">
          <Link href="/" className="charts-brand" aria-label={d.nav.home}>
            <Wordmark size={1.0625} />
          </Link>

          <div className="charts-title">
            <h1 className="display">{d.charts.title}</h1>
            {cupo && (
              <p className="charts-quota">
                {fill(d.charts.quota, { used: cupo.used, max: cupo.max })}
              </p>
            )}
          </div>

          <div className="charts-head-actions">
            {/* El café también aquí: quien ya tiene gráficas guardadas es
                quien más motivos tiene para invitar a uno. */}
            <Link className="nav-link" href="/cafe">
              {d.nav.coffee}
            </Link>
            <Link className="cta" href="/crear">
              {d.nav.newChart}
            </Link>
            <SignOut />
          </div>
        </header>

        {/* El cupo se avisa ANTES de que falle. Quien decide es el trigger de la
            base de datos, pero enterarse al pulsar guardar es peor que verlo. */}
        {cupo?.full && (
          <p className="auth-error">{fill(d.charts.quotaFull, { max: cupo.max })}</p>
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
            <h2>{d.charts.emptyTitle}</h2>
            <p>{d.charts.emptyBody}</p>
            <Link className="cta" href="/crear">
              {d.charts.emptyCta}
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
