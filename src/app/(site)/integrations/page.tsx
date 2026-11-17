import type { Metadata } from 'next';
import Link from 'next/link';
import '@/styles/marketing.css';
import { integracionesPublicadas } from '@/lib/integraciones';
import { LOGOS } from '@/lib/logos';

/*
  El índice de integraciones.

  Existe por dos motivos, y ninguno es «hacer bulto». Uno: un rastreador llega a
  las páginas hijas desde aquí, y sin una página que las reúna cada una
  dependería de que alguien la enlace desde fuera. Y dos: es la respuesta a
  «¿dónde funciona esto?» para quien todavía no ha elegido dónde ponerlo.

  Lo que NO hace es prometer una lista infinita. Aquí sólo salen las que están
  escritas y publicadas; el resto de la tira de compatibilidad se nombra abajo
  en texto, que es lo honesto: funciona en cualquier sitio que acepte un link,
  pero sólo unas cuantas tienen su página con instrucciones probadas.
*/

export const metadata: Metadata = {
  title: 'Integrations',
  description:
    'Where you can embed an interactive 3D chart with a link: Notion, Confluence, Webflow, WordPress, Framer and Canva. No plugin, no account.',
  alternates: { canonical: '/integrations' },
};

export default function IntegracionesPage() {
  const items = integracionesPublicadas();
  const conPagina = new Set(items.map((i) => i.plataforma));
  const resto = LOGOS.filter((l) => !conPagina.has(l.nombre)).map((l) => l.nombre);

  return (
    <div className="studio" data-theme="light">
      <header className="shell" style={{ paddingBlock: '1.75rem' }}>
        <Link href="/" className="nav-link">
          ← Volumine
        </Link>
      </header>

      <main className="shell comofunciona">
        <h1 className="display">Where you can put a 3D chart</h1>
        <p className="precios-lead">
          The chart is a link, so it goes anywhere a link goes. These are the places with
          step-by-step instructions and a live chart you can try on the page.
        </p>

        <section className="donde">
          <ul className="lista-integraciones">
            {items.map((i) => (
              <li key={i.slug}>
                <Link href={`/integrations/${i.slug}`}>
                  <strong>{i.titulo}</strong>
                </Link>
                <p className="nota">{i.descripcion}</p>
              </li>
            ))}
          </ul>
        </section>

        {resto.length > 0 && (
          <section className="donde">
            <h2>And anywhere else</h2>
            <p>
              {resto.join(', ')} and any site that accepts an <code>&lt;iframe&gt;</code>{' '}
              work the same way — they just do not have a page here yet. The general
              instructions are in <Link href="/como-funciona">how it works</Link>.
            </p>
          </section>
        )}

        <p className="precios-nota">
          <Link href="/crear">Open the editor</Link> · <Link href="/cafe">Buy me a coffee</Link>
        </p>
      </main>
    </div>
  );
}
