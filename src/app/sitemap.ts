import type { MetadataRoute } from 'next';
import { TITULAR } from '@/lib/legal';
import { integracionesPublicadas } from '@/lib/integraciones';

/*
  El mapa del sitio.

  Solo las páginas que tiene sentido que aparezcan en un buscador. Quedan fuera a
  propósito:

  · `/entrar` y `/entrar/nueva-clave` — pantallas de acceso. No aportan nada en
    un resultado de búsqueda y ya llevan `robots: noindex` en su metadata.
  · `/mis-graficas` — es privada; sin sesión no hay nada que ver.
  · `/embed` — no es una página, es un widget para meter en un iframe. Indexarla
    llenaría el buscador de resultados sin cabecera, sin contexto y sin forma de
    volver a ninguna parte.
  · `/dev/*` — herramientas de desarrollo.
  · `/legal/*` — accesibles siempre, como exige la ley, pero con `noindex`.
    Nadie las busca en Google, y estando indexadas SÍ competían: buscando
    «volumine» el aviso legal salía por delante de la portada, porque repite la
    marca en cada párrafo y el titular del héroe no la nombraba ni una vez.
    Listar aquí una página que se marca `noindex` es contradecirse en dos
    ficheros, así que se van las dos cosas juntas o ninguna.

  Un sitemap que lista todo lo que existe no ayuda: reparte la atención del
  rastreador entre páginas que no quieres posicionar.
*/
export default function sitemap(): MetadataRoute.Sitemap {
  const base = `https://${TITULAR.dominio}`;
  const hoy = new Date();

  return [
    { url: base, lastModified: hoy, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/crear`, lastModified: hoy, changeFrequency: 'monthly', priority: 0.8 },
    {
      url: `${base}/precios`,
      lastModified: hoy,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${base}/como-funciona`,
      lastModified: hoy,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${base}/integrations`,
      lastModified: hoy,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    /*
      Las de integración salen de `lib/integraciones.ts` y sólo las publicadas.
      Una página a medio escribir en el sitemap es peor que no tenerla: se
      rastrea, se juzga y se recuerda flaca.
    */
    ...integracionesPublicadas().map((i) => ({
      url: `${base}/integrations/${i.slug}`,
      lastModified: hoy,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
