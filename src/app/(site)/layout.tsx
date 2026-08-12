import type { Metadata } from 'next';
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import '@/styles/site.css';
import { Analytics } from '@vercel/analytics/next';
import { getDictionary } from '@/lib/i18n/server';
import { I18nProvider } from '@/lib/i18n/client';
import { TITULAR } from '@/lib/legal';

/*
  Root layout de la app y el marketing.
  /embed NO pasa por aquí: tiene el suyo en app/(embed)/layout.tsx. Por eso no
  existe app/layout.tsx — un root layout compartido acabaría filtrando
  providers, fuentes y analytics al embed por herencia (ADR 0002 y 0005).
*/

// Display con personalidad + grotesca neutra para UI y datos (docs/DESIGN.md).
// next/font las descarga en build y las sirve desde nuestro origen: cero
// peticiones a terceros.
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const body = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

// Rol de utilidad: la URL del héroe y las cifras de la ficha técnica. Una URL
// en proporcional se lee mal y deja de parecer una URL.
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

/* El título y la descripción también van en el idioma de quien mira: son lo que
   sale en la pestaña, en el buscador y en la tarjeta cuando alguien comparte la
   página. Por eso es `generateMetadata` y no una constante. */
export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getDictionary();

  return {
    /*
      `metadataBase` es lo que convierte las rutas relativas de abajo en URLs
      absolutas. Sin él, Next avisa por consola y las tarjetas de enlace salen
      SIN IMAGEN: los rastreadores de Twitter, LinkedIn o Slack no resuelven
      rutas relativas, necesitan la URL entera.

      Sale del mismo sitio que el aviso legal para que no haya dos dominios
      escritos a mano que puedan discrepar.
    */
    metadataBase: new URL(`https://${TITULAR.dominio}`),
    title: { default: d.meta.siteTitle, template: '%s · Volumine' },
    description: d.meta.siteDescription,
    applicationName: 'Volumine',
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      siteName: 'Volumine',
      title: d.meta.siteTitle,
      description: d.meta.siteDescription,
      url: '/',
      /* La imagen la genera `scripts/og-image.mjs` capturando el héroe de
         verdad, así que lleva la gráfica 3D con su canto y su sombra en vez de
         una composición de texto. Hay que relanzarlo cuando cambie el héroe. */
      images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Volumine' }],
    },
    /*
      `summary_large_image` y no `summary`. La tarjeta pequeña recorta la imagen
      a un cuadrado diminuto al lado del texto, y aquí lo que hay que enseñar es
      un objeto tridimensional: en 120 píxeles cuadrados no se distingue de
      cualquier otro icono.
    */
    twitter: {
      card: 'summary_large_image',
      title: d.meta.siteTitle,
      description: d.meta.siteDescription,
      images: ['/og.png'],
    },
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  /* El idioma se resuelve UNA vez, aquí arriba, y baja por contexto. Resolverlo
     en cada pantalla sería leer la cookie y la cabecera media docena de veces
     por navegación para obtener siempre lo mismo. */
  const { locale, d } = await getDictionary();

  return (
    /* `lang` de verdad y no fijo en «es»: es lo que usan los lectores de
       pantalla para elegir voz y los navegadores para ofrecer traducción. Estaba
       mintiendo cuando la interfaz salía en inglés. */
    <html lang={locale} className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <I18nProvider locale={locale} d={d}>
          {children}
        </I18nProvider>
        {/*
          ══════════════════════════════════════════════════════════════════
          ESTA ANALÍTICA VIVE SOLO AQUÍ. NUNCA EN /embed.
          ══════════════════════════════════════════════════════════════════

          Es un script de un TERCERO, y la regla 1 de CLAUDE.md prohíbe
          cualquier petición a terceros en el embed — sin excepciones. No es
          purismo: el embed corre dentro de la página de otra persona, y
          cargarle ahí un rastreador nuestro es cobrarle a alguien que no nos
          ha pedido nada, además de romper el presupuesto de 0 peticiones
          externas que la landing anuncia como argumento de venta.

          Que esto sea seguro depende de que `/embed` NO herede este layout, y
          no lo hereda: tiene el suyo en app/(embed)/layout.tsx y por eso no
          existe un app/layout.tsx compartido (ADR 0002 y 0005). Si alguien
          crea uno, esta analítica se cuela en todos los embeds sin que nadie
          lo note.

          La analítica del embed se hace del lado SERVIDOR —log de petición—,
          que además encaja con el presupuesto de rendimiento.
        */}
        <Analytics />
      </body>
    </html>
  );
}
