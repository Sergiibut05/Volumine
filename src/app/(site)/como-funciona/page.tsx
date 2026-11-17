import type { Metadata } from 'next';
import Link from 'next/link';
import '@/styles/marketing.css';
import { Pegar } from './Pegar';
import { LOGOS } from '@/lib/logos';
import { getDictionary } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getDictionary();
  return { title: d.nav.howItWorks, description: d.howto.lead };
}

/*
  ══════════════════════════════════════════════════════════════════════════
  CÓMO FUNCIONA
  ══════════════════════════════════════════════════════════════════════════

  Esta página existe porque `/dev/embed` se estaba usando como si fuera
  documentación —estaba enlazada desde el pie de la home— y no lo es: es una
  herramienta de prueba con un `sandbox` y un registro de `postMessage`, útil
  para desarrollar y desconcertante para quien llega. Además vive bajo `/dev/`,
  que está bloqueado en `robots.txt`, así que ni siquiera podía posicionar.

  Aquí el orden es el del uso real y no el de la arquitectura: primero QUÉ HACES
  —tres pasos—, después dónde funciona, y al final por qué pesa lo que pesa. Las
  specs van al final a propósito: son el argumento que convence a quien ya está
  interesado, no el que despierta el interés.
*/

export default async function ComoFunciona() {
  const { d } = await getDictionary();

  const pasos = [
    { n: '1', titulo: d.howto.s1t, texto: d.howto.s1b },
    { n: '2', titulo: d.howto.s2t, texto: d.howto.s2b },
    { n: '3', titulo: d.howto.s3t, texto: d.howto.s3b },
  ];

  return (
    <div className="studio" data-theme="light">
      <header className="shell" style={{ paddingBlock: '1.75rem' }}>
        <Link href="/" className="nav-link">
          ← Volumine
        </Link>
      </header>

      <main className="shell comofunciona">
        <h1 className="display">{d.howto.title}</h1>
        <p className="precios-lead">{d.howto.lead}</p>

        <ol className="pasos">
          {pasos.map((p) => (
            <li key={p.n}>
              <span className="paso-n">{p.n}</span>
              <div>
                <h2>{p.titulo}</h2>
                <p>{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* El bloque de código va en su propio componente porque copia al
            portapapeles, y eso necesita cliente. El resto de la página es
            estática y no tiene por qué pagar ese peaje. */}
        <Pegar
          titulo={d.howto.iframeTitle}
          intro={d.howto.iframeBody}
          copiar={d.howto.copy}
          copiado={d.howto.copied}
          nota={d.howto.iframeNote}
        />

        <section className="donde">
          <h2>{d.howto.whereTitle}</h2>
          <p>{d.howto.whereBody}</p>
          <ul className="worksin-list">
            {LOGOS.map((l) => (
              <li key={l.nombre}>
                {l.path ? (
                  <svg viewBox="0 0 24 24" aria-hidden focusable="false">
                    <path d={l.path} fill="currentColor" />
                  </svg>
                ) : null}
                {l.nombre}
              </li>
            ))}
          </ul>
        </section>

        <section className="donde">
          <h2>{d.howto.loadTitle}</h2>
          <p>{d.howto.loadBody}</p>
          <div className="specsheet" style={{ marginBlock: '1.5rem' }}>
            <div>
              <p className="spec-label" style={{ margin: 0 }}>
                {d.howto.specWeight}
              </p>
              <strong>148 KB</strong>
              <span>{d.howto.specWeightNote}</span>
            </div>
            <div>
              <p className="spec-label" style={{ margin: 0 }}>
                {d.howto.specReq}
              </p>
              <strong>1</strong>
              <span>{d.howto.specReqNote}</span>
            </div>
            <div>
              <p className="spec-label" style={{ margin: 0 }}>
                {d.howto.specCookies}
              </p>
              <strong>0</strong>
              <span>{d.howto.specCookiesNote}</span>
            </div>
            <div>
              <p className="spec-label" style={{ margin: 0 }}>
                {d.howto.specThird}
              </p>
              <strong>0</strong>
              <span>{d.howto.specThirdNote}</span>
            </div>
          </div>
          <p>
            {d.howto.loadFoot1} <strong>{d.howto.loadFoot2}</strong> {d.howto.loadFoot3}
          </p>
        </section>

        <section className="donde">
          <h2>{d.howto.faqTitle}</h2>

          <h3>{d.howto.q1}</h3>
          <p>
            {d.howto.a1}</p>

          <h3>{d.howto.q2}</h3>
          <p>
            {d.howto.a2}</p>

          <h3>{d.howto.q3}</h3>
          <p>
            {d.howto.a3}</p>

          <h3>{d.howto.q4}</h3>
          <p>
            {d.howto.a4}</p>
        </section>

        <p className="precios-nota">
          <Link href="/crear">{d.nav.openEditor}</Link> ·{' '}
          <Link href="/cafe">{d.nav.coffee}</Link>
        </p>
      </main>
    </div>
  );
}
