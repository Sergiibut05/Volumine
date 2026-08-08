import Link from 'next/link';
import { Wordmark } from './Wordmark';
import { currentUser } from '@/lib/charts/queries';
import '@/styles/marketing.css';
import { HeroChart } from './HeroChart';
import { TypeCard } from './TypeCard';
import { EnUso } from './EnUso';
import { chartTypes } from '@/lib/chart-types';
import { getDictionary } from '@/lib/i18n/server';
import type { Dictionary } from '@/lib/i18n/dictionaries';

/*
  Landing.

  Dirección: "estudio". Una gráfica de Volumine es un objeto con volumen, canto y
  luz encima, así que la página se comporta como el set donde se fotografía un
  producto — papel pálido, sombra real— en lugar de como una landing de SaaS.

  El elemento firma es la tira de URL del héroe: el producto es el link.
*/

/* La cifra de peso se mantiene A MANO y `npm run perf:embed` es quien dice la
   verdad. Es el argumento de venta de la página: si sube, esto se actualiza. */
const specs = (d: Dictionary) => [
  { label: d.landing.specWeight, value: '148 KB', note: d.landing.specWeightNote },
  { label: d.landing.specRequests, value: '1', note: d.landing.specRequestsNote },
  { label: d.landing.specThirdParty, value: '0', note: d.landing.specThirdPartyNote },
  {
    label: d.landing.specSignup,
    value: d.landing.specSignupValue,
    note: d.landing.specSignupNote,
  },
];

export default async function HomePage() {
  /* Solo para decidir si se enseña «Mis gráficas». Sin sesión no consulta nada
     y la landing sigue siendo estática para quien llega de fuera. */
  const [user, { locale, d }] = await Promise.all([currentUser(), getDictionary()]);

  return (
    <div className="studio" data-theme="light">
      <header className="shell" style={{ paddingBlock: '1.75rem' }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <Wordmark size={1.25} />
          <span style={{ flex: 1 }} />
          {user && (
            <Link
              href="/mis-graficas"
              style={{
                color: 'var(--ink-soft)',
                textDecoration: 'none',
                fontSize: '0.875rem',
              }}
            >
              {d.nav.myCharts}
            </Link>
          )}
          <Link
            href="/crear"
            style={{
              color: 'var(--ink-soft)',
              textDecoration: 'none',
              fontSize: '0.875rem',
            }}
          >
            {d.nav.openEditor}
          </Link>
        </nav>
      </header>

      <main>
        <section className="shell hero">
          {/* `hero-copy` no es decorativo: declara el contenedor contra el que
              se mide el titular. Ver `.hero h1` en marketing.css. */}
          <div className="hero-copy">
            <p className="spec-label">{d.landing.tagline}</p>
            <h1 className="display" style={{ marginTop: '1rem' }}>
              {d.landing.heroTitle1}
              <br />
              {d.landing.heroTitle2}
            </h1>
            <p>{d.landing.heroBody}</p>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
              <Link className="cta" href="/crear">
                {d.landing.heroCta}
              </Link>
            </div>
          </div>

          <div>
            <HeroChart />
          </div>
        </section>

        {/* Ficha técnica. Las specs SON el diferenciador de este producto, así
            que se presentan como specs y no como "beneficios". */}
        <section className="shell">
          <div className="specsheet">
            {specs(d).map((spec) => (
              <div key={spec.label}>
                <p className="spec-label" style={{ margin: 0 }}>
                  {spec.label}
                </p>
                <strong>{spec.value}</strong>
                <span>{spec.note}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Después de la ficha técnica y antes de la galería: primero QUÉ es,
            luego POR QUÉ pesa poco, luego DÓNDE vive, y al final los tipos. */}
        <EnUso />

        {/*
          La tira de compatibilidad, justo después de enseñar que encaja en
          cualquier sitio: primero se ve, y acto seguido se nombra dónde.

          Van los NOMBRES y no los logotipos. Reproducir una marca de memoria la
          deforma, y no deformar el logo es literalmente lo primero que piden
          todas esas guías de marca; el original hay que sacarlo de su media kit.
          El nombre a secas es uso nominativo puro y no tiene ese problema.

          Y el copy dice «funciona en», nunca «partner de»: lo que hace legítimo
          nombrar a otra marca es identificar compatibilidad, no insinuar una
          relación que no existe.
        */}
        <section className="shell worksin">
          <p className="worksin-title">{d.landing.worksInTitle}</p>
          <ul className="worksin-list">
            {['Notion', 'Canva', 'Framer', 'Webflow', 'WordPress', 'Medium', 'Confluence'].map(
              (sitio) => (
                <li key={sitio}>{sitio}</li>
              ),
            )}
            <li className="worksin-own">&lt;iframe&gt;</li>
          </ul>
        </section>

        <section className="shell" style={{ paddingBottom: '2rem' }}>
          <p className="spec-label">{d.landing.typesLabel}</p>
          <h2
            className="display"
            style={{
              margin: '0.75rem 0 0',
              fontSize: 'clamp(1.75rem, 1.1rem + 2.4vw, 2.75rem)',
            }}
          >
            {d.landing.typesTitle}
          </h2>
          <p
            style={{
              margin: '0.875rem 0 0',
              maxWidth: '52ch',
              color: 'var(--ink-soft)',
              lineHeight: 1.55,
            }}
          >
            {/* La palabra en cursiva va por MARCADOR y no partiendo la frase en
                trozos: en inglés cae antes del verbo y en español después, y
                concatenar cachos haría la frase intraducible. */}
            {d.landing.typesBody
              .split('{not}')
              .flatMap((trozo, i) =>
                i === 0 ? [trozo] : [<em key="not">{d.landing.typesBodyNot}</em>, trozo],
              )}
          </p>

          <div className="gallery">
            {chartTypes(locale).map((type) => (
              <TypeCard key={type.id} type={type} />
            ))}
          </div>
        </section>

        <section className="shell closer">
          <h2 className="display">{d.landing.closerTitle}</h2>
          <p
            style={{
              margin: 0,
              maxWidth: '46ch',
              color: 'var(--ink-soft)',
              lineHeight: 1.55,
            }}
          >
            {d.landing.closerBody}
          </p>
          <Link className="cta" href="/crear">
            {d.landing.closerCta}
          </Link>
        </section>
      </main>

      <footer className="shell studio-foot">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          <span>Volumine</span>
          <span style={{ flex: 1 }} />
          <Link href="/dev/embed" style={{ color: 'inherit' }}>
            {d.landing.seeRealEmbed}
          </Link>
        </div>
      </footer>
    </div>
  );
}
