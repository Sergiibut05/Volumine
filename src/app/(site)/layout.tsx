import type { Metadata } from 'next';
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import '@/styles/site.css';
import { Analytics } from '@vercel/analytics/next';

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

export const metadata: Metadata = {
  title: {
    default: 'Volumine — gráficas 3D que se incrustan con un link',
    template: '%s · Volumine',
  },
  description:
    'Crea una gráfica 3D preciosa e incrústala en tu web, Notion o Confluence con un link.',
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        {children}
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
