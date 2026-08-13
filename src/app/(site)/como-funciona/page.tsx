import type { Metadata } from 'next';
import Link from 'next/link';
import '@/styles/marketing.css';
import { Pegar } from './Pegar';
import { LOGOS } from '@/lib/logos';

export const metadata: Metadata = {
  title: 'Cómo funciona',
  description:
    'Haces la gráfica, copias el link y lo pegas. Sin plugin, sin cuenta y sin paso de compilación.',
};

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

const PASOS = [
  {
    n: '1',
    titulo: 'Haz la gráfica',
    texto:
      'En el editor, sin cuenta. Pegas tus datos desde una hoja de cálculo y eliges tipo, tema y acabado.',
  },
  {
    n: '2',
    titulo: 'Copia el link',
    texto:
      'La configuración entera viaja dentro de la URL: los datos, los colores, la cámara. No hay nada más que guardar.',
  },
  {
    n: '3',
    titulo: 'Pégalo donde sea',
    texto:
      'En Notion, en Confluence o en tu web. La mayoría de sitios lo reconocen solos; si no, va el iframe de abajo.',
  },
];

export default function ComoFunciona() {
  return (
    <div className="studio" data-theme="light">
      <header className="shell" style={{ paddingBlock: '1.75rem' }}>
        <Link href="/" className="nav-link">
          ← Volumine
        </Link>
      </header>

      <main className="shell comofunciona">
        <h1 className="display">Haces la gráfica. Copias el link. Ya está.</h1>
        <p className="precios-lead">
          Sin plugin, sin cuenta y sin paso de compilación. El link ES el producto: lleva
          dentro todo lo que la gráfica necesita para dibujarse.
        </p>

        <ol className="pasos">
          {PASOS.map((p) => (
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
        <Pegar />

        <section className="donde">
          <h2>Dónde funciona</h2>
          <p>
            Cualquier sitio que acepte un enlace o un <code>&lt;iframe&gt;</code>. En los
            que entienden oEmbed basta con pegar la URL y se despliega solo.
          </p>
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
          <h2>Qué carga en la página de quien lo ve</h2>
          <p>
            Esto es lo que suele decidir si te dejan incrustar algo en un sitio corporativo,
            así que va con cifras y no con adjetivos:
          </p>
          <div className="specsheet" style={{ marginBlock: '1.5rem' }}>
            <div>
              <p className="spec-label" style={{ margin: 0 }}>
                Peso
              </p>
              <strong>148 KB</strong>
              <span>Todo el visor 3D, comprimido.</span>
            </div>
            <div>
              <p className="spec-label" style={{ margin: 0 }}>
                Peticiones
              </p>
              <strong>1</strong>
              <span>Un archivo. Nada más.</span>
            </div>
            <div>
              <p className="spec-label" style={{ margin: 0 }}>
                Cookies
              </p>
              <strong>0</strong>
              <span>No rastrea a quien la ve.</span>
            </div>
            <div>
              <p className="spec-label" style={{ margin: 0 }}>
                Terceros
              </p>
              <strong>0</strong>
              <span>No llama a ningún servidor ajeno.</span>
            </div>
          </div>
          <p>
            Por eso una gráfica incrustada <strong>no añade obligaciones</strong> a la
            política de privacidad de la web donde la pongas. Es una restricción del propio
            diseño, no una promesa comercial: está medida en cada compilación.
          </p>
        </section>

        <section className="donde">
          <h2>Preguntas que salen siempre</h2>

          <h3>¿Se ve bien en el móvil?</h3>
          <p>
            Se adapta al hueco que le dé la página. Si el sitio es estrecho, la gráfica
            encoge y las etiquetas con ella.
          </p>

          <h3>¿Qué pasa si borro la gráfica?</h3>
          <p>
            El enlace deja de funcionar. Quien la tuviera incrustada verá el hueco vacío,
            así que despublicar una gráfica que está en la web de otra persona es algo que
            conviene avisar.
          </p>

          <h3>¿Puedo cambiar los datos después?</h3>
          <p>
            Sí, editando la gráfica guardada: el enlace es el mismo y se actualiza donde
            esté puesta. Si la compartiste con un link de configuración —sin cuenta—
            entonces el link es la gráfica, y cambiarla genera otro.
          </p>

          <h3>¿Hace falta cuenta?</h3>
          <p>
            No para crear ni para incrustar. Solo para guardar tus gráficas y volver a
            editarlas más tarde.
          </p>
        </section>

        <p className="precios-nota">
          <Link href="/crear">Abrir el editor</Link> · <Link href="/precios">Precios</Link>
        </p>
      </main>
    </div>
  );
}
