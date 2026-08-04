import type { Metadata } from 'next';
import '@/styles/embed.css';

/*
  Root layout de /embed. Es su propio root layout, no hereda del sitio.

  Lo que NO puede aparecer aquí, nunca (ADR 0005 y docs/PERFORMANCE-BUDGET.md):
  providers, contextos, store, cliente de auth, analytics, i18n, fuentes
  remotas, o cualquier import que arrastre peso al bundle.

  Si añades algo a este archivo, ejecuta `npm run perf:embed` antes de commitear.
*/

export const metadata: Metadata = {
  // El embed vive dentro de otra página: no debe aparecer en resultados de
  // búsqueda compitiendo con la página que lo contiene.
  robots: { index: false, follow: false },
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
