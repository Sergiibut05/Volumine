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

  · el precio sale del plan de verdad y se pasa desde fuera, no escrito a mano;
  · no hay `aggregateRating` ni `review`. Es lo más goloso —las estrellitas en
    el resultado de búsqueda— y sería inventado: no hay ni una sola valoración
    real todavía. Inventarlas es motivo de sanción manual, además de mentira;
  · `SoftwareApplication` y no `Product`, que es lo que esto es.

  Va como `<script type="application/ld+json">` dentro del cuerpo porque es lo
  que recomienda Google y porque así viaja con la página que describe.
*/

export function DatosEstructurados({
  descripcion,
  precioCentimos,
  moneda,
}: {
  descripcion: string;
  /** Del plan de pago, tal cual está en `plan_limits`. `null` si no hay. */
  precioCentimos: number | null;
  moneda: string | null;
}) {
  const sitio = `https://${TITULAR.dominio}`;

  const datos = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: MARCA.nombre,
    url: sitio,
    description: descripcion,
    applicationCategory: 'BusinessApplication',
    /* Corre en el navegador y en ningún sitio más. Declarar «Windows, macOS,
       Linux» sería declarar tres instaladores que no existen. */
    operatingSystem: 'Web',
    image: `${sitio}${OG.ruta}`,
    author: TITULAR.nombre ? { '@type': 'Person', name: TITULAR.nombre } : undefined,
    /*
      Dos ofertas de verdad, que es lo que hay: el plan gratuito y el pago
      único. Se declara `price: 0` explícito para el gratuito —omitirlo dejaría
      entender que hay que pagar para empezar, que es justo lo contrario de lo
      que pasa aquí.
    */
    offers: [
      {
        '@type': 'Offer',
        name: 'Free',
        price: 0,
        priceCurrency: (moneda ?? 'eur').toUpperCase(),
      },
      ...(precioCentimos
        ? [
            {
              '@type': 'Offer',
              name: 'Pro',
              price: precioCentimos / 100,
              priceCurrency: (moneda ?? 'eur').toUpperCase(),
              url: `${sitio}/precios`,
            },
          ]
        : []),
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
