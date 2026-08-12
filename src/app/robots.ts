import type { MetadataRoute } from 'next';
import { TITULAR } from '@/lib/legal';

/*
  ── QUÉ PUEDE RASTREARSE ─────────────────────────────────────────────────

  `/embed` está bloqueado, y esa es la única decisión no obvia de este fichero.

  Podría parecer que interesa lo contrario —son miles de URLs con contenido—,
  pero un embed indexado es un mal resultado de búsqueda: una gráfica suelta,
  sin cabecera, sin texto alrededor y sin manera de volver a ningún sitio. Quien
  aterrizara ahí se iría, y Google aprende de eso. Además la config viaja en la
  URL, así que la misma gráfica genera direcciones infinitas y distintas: es
  exactamente el patrón de contenido duplicado que agota el presupuesto de
  rastreo sin devolver nada.

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
        disallow: ['/embed', '/dev/', '/mis-graficas', '/entrar', '/auth/'],
      },
    ],
    sitemap: `https://${TITULAR.dominio}/sitemap.xml`,
    host: `https://${TITULAR.dominio}`,
  };
}
