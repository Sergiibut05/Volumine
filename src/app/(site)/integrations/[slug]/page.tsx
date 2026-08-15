import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import '@/styles/marketing.css';
import { TITULAR } from '@/lib/legal';
import {
  INTEGRACIONES,
  integracionPorSlug,
  integracionesPublicadas,
  type Integracion,
} from '@/lib/integraciones';
import { buildEmbedUrl, encodeConfig } from '@/lib/config/url';
import { Pegar } from './Pegar';

/*
  ══════════════════════════════════════════════════════════════════════════
  UNA PÁGINA DE INTEGRACIÓN
  ══════════════════════════════════════════════════════════════════════════

  El contenido entero sale de `src/lib/integraciones.ts`, que está escrito a
  mano plataforma por plataforma. Aquí sólo está la forma. Léase la nota larga
  de ese fichero antes de añadir nada: explica por qué hay una página por
  plataforma y no una por combinación, y qué separa esto de una granja de
  páginas generadas.

  ── ESTÁN EN INGLÉS A PROPÓSITO ──────────────────────────────────────────

  El resto del sitio se traduce con el diccionario; esto no. Estas páginas
  existen para una consulta concreta —«3d charts in Notion»— y esa consulta se
  escribe en inglés. Traducirlas partiría la señal en dos idiomas sin sumar
  búsquedas, y dejaría media docena de páginas en español compitiendo entre
  ellas por nada.

  ── SE PRERRENDERIZAN TODAS ──────────────────────────────────────────────

  `generateStaticParams` más `dynamicParams = false`: existen exactamente las
  que hay en el fichero y cualquier otra da 404. Sin eso, `/integrations/lo-que
  -sea` devolvería una página vacía por cada URL inventada, que es la forma más
  rápida de que un rastreador decida que el sitio genera páginas al peso.
*/

export const dynamicParams = false;

export function generateStaticParams() {
  return integracionesPublicadas().map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = integracionPorSlug(slug);
  if (!item) return {};

  return {
    title: item.titulo,
    description: item.descripcion,
    alternates: { canonical: `/integrations/${item.slug}` },
    openGraph: {
      type: 'article',
      title: item.titulo,
      description: item.descripcion,
      url: `/integrations/${item.slug}`,
    },
  };
}

/* Migas de pan: es lo único de datos estructurados que aporta algo real aquí.
   Nada de `HowTo` —Google retiró ese resultado enriquecido— ni de `FAQPage`
   inventada para arañar espacio en la página de resultados. */
function migas(item: Integracion, sitio: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Volumine', item: sitio },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Integrations',
        item: `${sitio}/integrations`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: item.plataforma,
        item: `${sitio}/integrations/${item.slug}`,
      },
    ],
  };
}

export default async function IntegracionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = integracionPorSlug(slug);
  if (!item) notFound();

  const sitio = `https://${TITULAR.dominio}`;
  const url = buildEmbedUrl(item.ejemplo.config, sitio);

  /*
    EL EJEMPLO SE ABRE EN EL EDITOR, y esto es lo que separa esta página de un
    tutorial.

    La primera versión explicaba muy bien cómo se hace y no llevaba a ninguna
    parte: quien llegaba convencido tenía que irse a buscar el editor por su
    cuenta. Con esto, el botón de debajo de la gráfica abre `/crear` con ESA
    gráfica dentro — se cambian los datos y ya se tiene el link.

    No es un «Empezar gratis» genérico: es continuar con lo que se está mirando.
  */
  const editar = `/crear?c=${encodeConfig(item.ejemplo.config)}`;

  /* Las demás plataformas, al pie. No es relleno: son las páginas hermanas y
     sin este enlace cada una quedaría huérfana, que es la forma más segura de
     que no las rastree nadie. */
  const otras = INTEGRACIONES.filter((i) => i.publicada && i.slug !== item.slug);

  return (
    <div className="studio" data-theme="light">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(migas(item, sitio)).replace(/</g, '\\u003c'),
        }}
      />

      <header className="shell" style={{ paddingBlock: '1.75rem' }}>
        <Link href="/" className="nav-link">
          ← Volumine
        </Link>
      </header>

      <main className="shell comofunciona">
        <p className="spec-label">{item.plataforma}</p>
        <h1 className="display">{item.titulo}</h1>
        <p className="precios-lead">{item.entradilla}</p>

        {/*
          LA GRÁFICA VA ARRIBA, ANTES DE LAS INSTRUCCIONES.

          Es lo que hace que esta página no sea una plantilla rellenada: quien
          llega buscando «gráfica 3D para X» quiere ver una, no leer sobre una.
          Y es la misma que va a conseguir — no una captura de promoción.
        */}
        {url.ok && (
          <section className="integracion-demo">
            <iframe
              src={url.url}
              title={`${item.ejemplo.titulo} — live 3D chart`}
              loading="lazy"
            />
            <p className="nota">
              Live, running in {item.plataforma} the same way it runs here. Drag it.
            </p>

            {/* La acción va PEGADA al ejemplo, no al final de la página: es
                donde está la intención, mirando la gráfica que quiere. */}
            <div className="demo-cta">
              <Link className="precio-cta" href={editar}>
                Open this chart in the editor
              </Link>
              <span>Change the numbers, copy your link. No account needed.</span>
            </div>
          </section>
        )}

        <section className="donde">
          <h2>How to put it in {item.plataforma}</h2>
          <ol className="pasos">
            {item.pasos.map((paso, i) => (
              <li key={paso.titulo}>
                <span className="paso-n">{i + 1}</span>
                <div>
                  <h3>{paso.titulo}</h3>
                  <p>{paso.texto}</p>
                </div>
              </li>
            ))}
          </ol>

          {/*
            Sólo si esa plataforma lo hace DE VERDAD. Ver `desplegado` en
            `lib/integraciones.ts`: mientras nadie lo haya probado ahí, la
            página explica el bloque de incrustar y no promete el atajo.
          */}
          {item.desplegado && (
            <p>
              <strong>Shortcut:</strong> {item.plataforma} also expands a bare Volumine URL
              on its own. Paste the link on an empty line and it turns into the chart — the
              steps above are the fallback if it does not.
            </p>
          )}
        </section>

        <Pegar url={url.ok ? url.url : null} titulo={item.ejemplo.titulo} />

        <section className="donde">
          <h2>What it costs the page</h2>
          <p>
            This is usually what decides whether you are allowed to embed something, so here
            are the numbers rather than adjectives:
          </p>
          <div className="specsheet" style={{ marginBlock: '1.5rem' }}>
            <div>
              <p className="spec-label" style={{ margin: 0 }}>
                Weight
              </p>
              <strong>148 KB</strong>
              <span>The whole 3D viewer, compressed.</span>
            </div>
            <div>
              <p className="spec-label" style={{ margin: 0 }}>
                Requests
              </p>
              <strong>1</strong>
              <span>One file. Nothing else.</span>
            </div>
            <div>
              <p className="spec-label" style={{ margin: 0 }}>
                Cookies
              </p>
              <strong>0</strong>
              <span>It does not track whoever sees it.</span>
            </div>
            <div>
              <p className="spec-label" style={{ margin: 0 }}>
                Third parties
              </p>
              <strong>0</strong>
              <span>It calls no external server.</span>
            </div>
          </div>
          <p>
            That is why an embedded chart <strong>adds no obligations</strong> to the
            privacy policy of the page you put it on. It is a constraint of the design,
            measured on every build — not a marketing promise.
          </p>
        </section>

        {/*
          LOS LÍMITES, ESCRITOS Y VISIBLES.

          Es la sección que nadie pone en una página hecha para posicionar, y por
          eso mismo es la que más vale: quien llega aquí va a probarlo en cinco
          minutos y va a encontrar estos límites solo. Mejor contados que
          descubiertos.
        */}
        <section className="donde">
          <h2>What it will not do</h2>
          <ul className="limites">
            {item.limites.map((limite) => (
              <li key={limite}>{limite}</li>
            ))}
          </ul>
        </section>

        <section className="donde">
          <h2>Somewhere else?</h2>
          <p>
            If it accepts a link or an <code>&lt;iframe&gt;</code>, it accepts this.
          </p>
          <nav className="foot-legal" style={{ marginTop: '1rem' }}>
            {otras.map((o) => (
              <Link key={o.slug} href={`/integrations/${o.slug}`}>
                {o.plataforma}
              </Link>
            ))}
          </nav>
        </section>

        {/* Y otra vez al final, para quien ha leído hasta abajo: esa persona
            ya está decidida y no debería tener que subir a buscarlo. */}
        <section className="cierre-integracion">
          <h2>Make yours</h2>
          <p>
            Paste your own numbers, pick a theme, copy the link. It takes about a
            minute and you do not need an account for any of it.
          </p>
          <Link className="precio-cta" href={editar}>
            Open the editor
          </Link>
          <p className="precios-nota">
            <Link href="/como-funciona">How it works</Link> ·{' '}
            <Link href="/integrations">All integrations</Link> ·{' '}
            <Link href="/precios">Pricing</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
