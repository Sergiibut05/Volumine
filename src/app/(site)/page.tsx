import Link from 'next/link';
import '@/styles/marketing.css';
import { HeroChart } from './HeroChart';
import { TypeCard } from './TypeCard';
import { CHART_TYPES } from '@/lib/chart-types';

/*
  Landing.

  Dirección: "estudio". Una gráfica de Voluma es un objeto con volumen, canto y
  luz encima, así que la página se comporta como el set donde se fotografía un
  producto — papel pálido, sombra real— en lugar de como una landing de SaaS.

  El elemento firma es la tira de URL del héroe: el producto es el link.
*/

const SPECS = [
  { label: 'Peso', value: '140 KB', note: 'Todo el visor 3D, comprimido.' },
  { label: 'Peticiones', value: '1', note: 'Un archivo. Nada más.' },
  { label: 'Terceros', value: '0', note: 'Sin cookies ni analítica ajena.' },
  { label: 'Registro', value: 'No', note: 'La config viaja en el link.' },
];

export default function HomePage() {
  return (
    <div className="studio" data-theme="light">
      <header className="shell" style={{ paddingBlock: '1.75rem' }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <span className="display" style={{ fontSize: '1.25rem' }}>
            Voluma
          </span>
          <span style={{ flex: 1 }} />
          <Link
            href="/crear"
            style={{
              color: 'var(--ink-soft)',
              textDecoration: 'none',
              fontSize: '0.875rem',
            }}
          >
            Abrir el editor
          </Link>
        </nav>
      </header>

      <main>
        <section className="shell hero">
          <div>
            <p className="spec-label">Gráficas 3D incrustables</p>
            <h1 className="display" style={{ marginTop: '1rem' }}>
              Tus datos,
              <br />
              con volumen.
            </h1>
            <p>
              Haz una gráfica 3D, copia el link y pégalo donde quieras. Va dentro de tu web,
              de Notion o de una presentación, y sigue girando.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
              <Link className="cta" href="/crear">
                Hacer una gráfica
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
            {SPECS.map((spec) => (
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

        <section className="shell" style={{ paddingBottom: '2rem' }}>
          <p className="spec-label">Tipos de gráfica</p>
          <h2
            className="display"
            style={{
              margin: '0.75rem 0 0',
              fontSize: 'clamp(1.75rem, 1.1rem + 2.4vw, 2.75rem)',
            }}
          >
            Cada forma responde a una pregunta distinta.
          </h2>
          <p
            style={{
              margin: '0.875rem 0 0',
              maxWidth: '52ch',
              color: 'var(--ink-soft)',
              lineHeight: 1.55,
            }}
          >
            Por eso cada tarjeta dice también cuándo <em>no</em> usar ese tipo. Una gráfica
            bonita que responde a la pregunta equivocada sigue estando mal.
          </p>

          <div className="gallery">
            {CHART_TYPES.map((type) => (
              <TypeCard key={type.id} type={type} />
            ))}
          </div>
        </section>

        <section className="shell closer">
          <h2 className="display">El link es el producto.</h2>
          <p
            style={{
              margin: 0,
              maxWidth: '46ch',
              color: 'var(--ink-soft)',
              lineHeight: 1.55,
            }}
          >
            Sin cuenta para empezar. La configuración entera de una gráfica cabe en una URL
            de 290 caracteres, así que no hay nada que guardar hasta que quieras volver a
            editarla.
          </p>
          <Link className="cta" href="/crear">
            Empezar
          </Link>
        </section>
      </main>

      <footer className="shell studio-foot">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          <span>Voluma</span>
          <span style={{ flex: 1 }} />
          <Link href="/dev/embed" style={{ color: 'inherit' }}>
            Ver un embed real
          </Link>
        </div>
      </footer>
    </div>
  );
}
