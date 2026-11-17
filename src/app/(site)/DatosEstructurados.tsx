import { TITULAR } from '@/lib/legal';
import { MARCA, OG } from '@/lib/marca';

/*
  ══════════════════════════════════════════════════════════════════════════
  JSON-LD — LO QUE LEE UNA MÁQUINA, NO UNA PERSONA
  ══════════════════════════════════════════════════════════════════════════

  Las etiquetas `<meta>` dicen cómo se ve la página cuando alguien la comparte.
  Esto dice QUÉ ES: que Volumine es una aplicación web, de qué categoría, en qué
  navegadores corre y a qué precio. Es lo que permite que un resultado de
  búsqueda salga con algo más que un título azul, y —cada vez más— lo que leen
  los asistentes cuando alguien les pregunta por herramientas de este tipo.

  ── ESTO NO ES UN SITIO DONDE ADORNAR ────────────────────────────────────

  Todo lo que se declara aquí tiene que ser CIERTO y estar visible en la página.
  Google penaliza los datos estructurados que prometen cosas que la página no
  enseña, y con razón. Por eso:

  · la oferta es la que hay: gratis. Los cafés NO son una oferta —no se compra
    nada con ellos—, así que declararlos como `Offer` sería mentir al buscador;
  · no hay `aggregateRating` ni `review`. Es lo más goloso —las estrellitas en
    el resultado de búsqueda— y sería inventado: no hay ni una sola valoración
    real todavía. Inventarlas es motivo de sanción manual, además de mentira;
  · `SoftwareApplication` y no `Product`, que es lo que esto es.

  Va como `<script type="application/ld+json">` dentro del cuerpo porque es lo
  que recomienda Google y porque así viaja con la página que describe.
*/

export function DatosEstructurados({ descripcion }: { descripcion: string }) {
  const sitio = `https://${TITULAR.dominio}`;

  /*
    ── `WebSite` ADEMÁS DE `SoftwareApplication` ─────────────────────────

    Son dos cosas distintas y hacían falta las dos. `SoftwareApplication`
    describe el PRODUCTO; `WebSite` con `url` en la raíz es la señal con la que
    Google decide qué página representa a un sitio cuando alguien busca su
    nombre.

    Sin ella, buscando «volumine» salía primero el AVISO LEGAL: ese documento
    repite «Volumine» en cada párrafo —es literalmente sobre la titularidad de
    Volumine— mientras que el titular de la portada, «Your data, with volume»,
    no la nombra ni una vez. Con pocas señales externas todavía, el algoritmo
    hacía lo razonable con lo que tenía.

    Se arregló por los tres lados: la marca en el antetítulo del héroe, las
    páginas legales fuera del índice, y esto.
  */
  const datos = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${sitio}#website`,
        name: MARCA.nombre,
        url: sitio,
        description: descripcion,
        publisher: TITULAR.nombre ? { '@type': 'Person', name: TITULAR.nombre } : undefined,
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${sitio}#app`,
        name: MARCA.nombre,
        url: sitio,
        description: descripcion,
        applicationCategory: 'BusinessApplication',
        /* Corre en el navegador y en ningún sitio más. Declarar «Windows,
           macOS, Linux» sería declarar tres instaladores que no existen. */
        operatingSystem: 'Web',
        image: `${sitio}${OG.ruta}`,
        author: TITULAR.nombre ? { '@type': 'Person', name: TITULAR.nombre } : undefined,
        /*
          Una sola oferta, que es lo que hay: gratis. Se declara `price: 0`
          explícito —omitirlo dejaría entender que hay que pagar para empezar,
          que es justo lo contrario de lo que pasa aquí.
        */
        offers: {
          '@type': 'Offer',
          name: 'Free',
          price: 0,
          priceCurrency: 'EUR',
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      /* `dangerouslySetInnerHTML` es la única vía: React escaparía las comillas
         del JSON y el resultado dejaría de ser JSON válido. El contenido no
         viene de fuera —sale de nuestras constantes y de la base—, y aun así se
         neutraliza el `<` por si algún día una descripción lo lleva y cierra el
         `<script>` antes de tiempo. */
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(datos).replace(/</g, '\\u003c'),
      }}
    />
  );
}
