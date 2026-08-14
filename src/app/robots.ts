import type { MetadataRoute } from 'next';
import { TITULAR } from '@/lib/legal';

/*
  ── QUÉ PUEDE RASTREARSE ─────────────────────────────────────────────────

  `/embed` NO se bloquea aquí, y esa es la única decisión no obvia de este
  fichero. Estuvo bloqueado y fue un error caro.

  Sigue siendo cierto que no queremos el embed en el índice: una gráfica suelta,
  sin cabecera, sin texto alrededor y sin manera de volver a ningún sitio es un
  mal resultado de búsqueda, y quien aterrizara ahí se iría. Además la config
  viaja en la URL, así que la misma gráfica genera direcciones infinitas: el
  patrón de contenido duplicado que agota el presupuesto de rastreo.

  Pero eso se dice con `X-Robots-Tag: noindex`, que es lo que hay ahora en las
  cabeceras del embed (`src/embed/serve.ts`). NO con un `Disallow`.

  La diferencia no es de estilo. **robots.txt no prohíbe indexar: prohíbe
  DESCARGAR.** Y al prohibir la descarga se llevaba por delante a los
  rastreadores sociales —Twitterbot, facebookexternalhit, Slackbot—, que ni
  indexan ni quieren indexar: sólo leen cuatro etiquetas para pintar una
  tarjeta. Pedían permiso, se les decía que no, y TODO link de gráfica salía
  como texto pelado en X, en WhatsApp, en Slack y en LinkedIn. En un producto
  cuyo producto es el link, el peor sitio donde fallar.

  Es además la trampa clásica: con `Disallow` puesto, el `noindex` no lo lee
  nadie, porque para leerlo hay que descargar la página. Las dos mitades tienen
  que ir juntas y en este sentido — descarga permitida, indexación prohibida.

  Lo que sí queremos es que las páginas donde alguien INCRUSTA una gráfica
  posicionen bien, y para eso el embed no necesita estar indexado: basta con que
  cargue rápido y no bloquee nada, que es lo que ya hace.

  ── LOS RASTREADORES DE IA VAN APARTE ────────────────────────────────────

  No se bloquean. Este producto se explica en una frase —«gráficas 3D que se
  pegan con un link»— y que un asistente pueda leerla y recomendarla es
  distribución gratuita, no una fuga. Bloquearlos aquí sería cerrar la puerta al
  canal que más va a crecer.
*/
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        /* Sin `/embed`: ver la nota de arriba. Lo de aquí son rutas que no
           tienen nada que ofrecer a un buscador ni a una tarjeta de enlace. */
        disallow: ['/dev/', '/mis-graficas', '/entrar', '/auth/'],
      },
    ],
    sitemap: `https://${TITULAR.dominio}/sitemap.xml`,
    host: `https://${TITULAR.dominio}`,
  };
}
