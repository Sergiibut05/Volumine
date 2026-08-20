import type { Metadata } from 'next';
import { dato, TITULAR } from '@/lib/legal';

/*
  ── FUERA DEL ÍNDICE, Y CON DESCRIPCIÓN PROPIA ───────────────────────────

  `noindex` porque una página legal no compite por nada: nadie busca esto en
  Google, y estando indexada SÍ compite — con la marca. Buscando «volumine»,
  el aviso legal salía por delante de la portada, porque el aviso legal repite
  «Volumine» en cada párrafo y el titular de la portada no lo dice ni una vez.
  `follow` se queda: los enlaces del pie siguen valiendo.

  Sigue siendo accesible para cualquiera que entre, que es lo que exige la ley.
  Estar en el índice de Google no es un requisito legal en ninguna parte.

  Y descripción PROPIA. Las cuatro heredaban la de la portada —«Make a
  beautiful 3D chart…»—, o sea que le decían a Google que el aviso legal iba
  del producto. Era la mitad del problema.
*/
export const metadata: Metadata = {
  /* Sin «· Volumine»: la plantilla del layout ya lo añade, y escribirlo aquí
     producía «Aviso legal · Volumine · Volumine». */
  title: 'Aviso legal',
  description: 'Datos identificativos del titular de Volumine y condiciones de acceso al sitio, conforme al artículo 10 de la LSSI.',
  robots: { index: false, follow: true },
};

/*
  Aviso legal — artículo 10 de la LSSI-CE.

  Es la obligación más simple de todas y la que más se incumple: cualquiera que
  preste un servicio de la sociedad de la información desde España tiene que
  publicar quién es, de forma «permanente, fácil, directa y gratuita». Eso
  significa un enlace desde todas las páginas, no una página escondida.
*/
export default function AvisoLegal() {
  return (
    <article>
      <h1>Aviso legal</h1>

      <p>
        Este aviso recoge la información que exige el artículo 10 de la Ley 34/2002, de
        servicios de la sociedad de la información y de comercio electrónico (LSSI-CE).
      </p>

      <h2>Titular del sitio</h2>
      <dl>
        <dt>Titular</dt>
        <dd>{dato('nombre')}</dd>
        <dt>NIF</dt>
        <dd>{dato('nif')}</dd>
        <dt>Domicilio</dt>
        <dd>{dato('domicilio')}</dd>
        <dt>Correo de contacto</dt>
        <dd>{dato('email')}</dd>
        <dt>Sitio web</dt>
        <dd>{dato('dominio')}</dd>
        {/* Solo si es una sociedad. En una persona física no existe, y ponerlo
            vacío o inventado es peor que omitirlo. */}
        {TITULAR.registro && (
          <>
            <dt>Datos registrales</dt>
            <dd>{TITULAR.registro}</dd>
          </>
        )}
      </dl>

      <h2>Qué es Volumine</h2>
      <p>
        Volumine es una herramienta para crear gráficas tridimensionales y publicarlas
        mediante un enlace que puede incrustarse en otras páginas. El servicio se presta a
        través de este sitio web.
      </p>

      <h2>Condiciones de uso</h2>
      <p>
        El uso del servicio implica aceptar las{' '}
        <a href="/legal/terminos">condiciones de uso</a> y la{' '}
        <a href="/legal/privacidad">política de privacidad</a>.
      </p>

      <h2>Propiedad intelectual</h2>
      <p>
        El código, el diseño y los contenidos propios de este sitio pertenecen a su titular,
        salvo los componentes de terceros que se usan bajo sus respectivas licencias. Los
        datos y las gráficas que crea cada persona siguen siendo suyos; el reparto exacto
        está en las <a href="/legal/terminos">condiciones de uso</a>.
      </p>
      <p>
        Los nombres y logotipos de otros productos que aparecen en este sitio pertenecen a
        sus titulares y se muestran únicamente para indicar dónde funciona el embed. No
        existe relación, patrocinio ni asociación con ninguno de ellos.
      </p>

      <h2>Responsabilidad</h2>
      <p>
        El titular procura que el servicio funcione de forma continuada, pero no garantiza
        que esté siempre disponible ni libre de errores. No se responsabiliza del contenido
        de las páginas ajenas en las que se incruste una gráfica, ni de los datos que cada
        persona decida publicar.
      </p>

      <h2>Legislación aplicable</h2>
      <p>
        Este aviso se rige por la legislación española. Para cualquier controversia, y salvo
        que una norma imperativa disponga otro fuero —como ocurre con las personas
        consumidoras, que pueden acudir al de su domicilio—, las partes se someten a los
        juzgados y tribunales del domicilio del titular.
      </p>
    </article>
  );
}
