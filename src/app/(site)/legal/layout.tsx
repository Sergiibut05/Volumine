import Link from 'next/link';
import { faltanDatos, ULTIMA_REVISION } from '@/lib/legal';
/* La hoja de marketing se importa aquí y no se hereda: la home la trae desde su
   propia `page.tsx`, así que sin esta línea las páginas legales salían con el
   texto en crudo —sin jerarquía de títulos, sin ancho de lectura y con el aviso
   rojo invisible—. */
import '@/styles/marketing.css';

/*
  Armazón de las páginas legales.

  Van en castellano y sin traducir, y es una decisión, no un descuido: el
  establecimiento está en España y estos textos se interpretan bajo derecho
  español. Traducirlos sin que lo revise quien los redactó produce dos
  documentos que no dicen lo mismo, y el que vale es siempre el original — así
  que una traducción de cortesía mal hecha solo sirve para confundir a quien la
  lee. Si algún día hace falta la versión inglesa, se traduce con revisión y se
  dice cuál prevalece.
*/

const PAGINAS = [
  { href: '/legal/aviso-legal', texto: 'Aviso legal' },
  { href: '/legal/privacidad', texto: 'Privacidad' },
  { href: '/legal/cookies', texto: 'Cookies' },
  { href: '/legal/terminos', texto: 'Condiciones de uso' },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const faltan = faltanDatos();

  return (
    <div className="studio" data-theme="light">
      <header className="shell" style={{ paddingBlock: '1.75rem' }}>
        <Link href="/" className="nav-link">
          ← Volumine
        </Link>
      </header>

      <main className="shell legal">
        {/*
          EL AVISO DE QUE FALTAN DATOS, bien visible y en la propia página.

          Sin él, publicar con los campos a medias no da ningún error: la página
          se ve entera y correcta salvo por unos «[pendiente]» que se pierden
          entre el texto. Y un aviso legal sin el NIF del titular no es un aviso
          legal incompleto, es un incumplimiento del artículo 10 de la LSSI.
        */}
        {faltan.length > 0 && (
          <p className="legal-alerta">
            <strong>Sin publicar.</strong> Faltan datos del titular en{' '}
            <code>src/lib/legal.ts</code>: {faltan.join(', ')}. Ver{' '}
            <code>docs/LEGAL.md</code>.
          </p>
        )}

        {children}

        <nav className="legal-nav">
          {PAGINAS.map((p) => (
            <Link key={p.href} href={p.href}>
              {p.texto}
            </Link>
          ))}
        </nav>

        <p className="legal-fecha">Última revisión: {ULTIMA_REVISION}</p>
      </main>
    </div>
  );
}
