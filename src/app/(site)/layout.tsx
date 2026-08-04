import type { Metadata } from 'next';
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import '@/styles/site.css';

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
    default: 'Voluma — gráficas 3D que se incrustan con un link',
    template: '%s · Voluma',
  },
  description:
    'Crea una gráfica 3D preciosa e incrústala en tu web, Notion o Confluence con un link.',
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
