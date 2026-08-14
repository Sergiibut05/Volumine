import { describe, expect, it } from 'vitest';
import { embedHtml } from './html';
import { parseConfig } from '@/lib/config/parse';
import type { ChartConfig } from '@/lib/config/schema';

/*
  La tarjeta que sale al pegar el link de una gráfica.

  Esto existe por un fallo que se descubrió el día del lanzamiento, preparando
  las publicaciones de X: las gráficas GUARDADAS —las que tienen póster, las que
  mejor se ven— declaraban `twitter:card = player`, y la tarjeta de reproductor
  de X exige aprobación previa por formulario. Sin ella X no pinta nada: ni
  reproductor ni imagen.

  Resultado: las gráficas de sin cuenta enseñaban su tarjeta y las guardadas
  salían como un link pelado. Exactamente al revés de lo que tenía que pasar, y
  en un producto cuyo producto ES EL LINK.

  La regla que fija este fichero: da igual lo que tenga la gráfica, la tarjeta
  es siempre `summary_large_image`. Lo que no está aprobado no existe.
*/

const config = (title?: string): ChartConfig => ({
  v: 1,
  type: 'donut',
  title,
  data: { labels: ['A', 'B'], series: [{ values: [1, 2] }] },
});

function html(opciones: { poster?: string | null; canonical?: string | null }) {
  const parsed = parseConfig(config('Ventas'));
  if (!parsed.ok) throw new Error('config de prueba inválida');
  return embedHtml({
    config: parsed.config,
    css: '',
    scriptSrc: '/e.js',
    poster: opciones.poster ?? null,
    canonical: opciones.canonical ?? null,
  });
}

const tarjeta = (s: string) => s.match(/<meta name="twitter:card" content="([^"]*)">/)?.[1];

describe('la tarjeta social del embed', () => {
  it('una gráfica guardada NO pide una player card, que X no pinta sin aprobar', () => {
    const s = html({
      poster: 'https://cdn.test/p.jpg',
      canonical: 'https://volumine.app/embed/abc',
    });
    expect(tarjeta(s)).toBe('summary_large_image');
    expect(s).not.toContain('content="player"');
  });

  it('una gráfica sin cuenta se comporta igual', () => {
    expect(tarjeta(html({ poster: 'https://cdn.test/p.jpg' }))).toBe('summary_large_image');
  });

  it('con póster lo anuncia como imagen de la tarjeta', () => {
    const s = html({
      poster: 'https://cdn.test/p.jpg',
      canonical: 'https://volumine.app/embed/abc',
    });
    expect(s).toContain('<meta property="og:image" content="https://cdn.test/p.jpg">');
    expect(s).toContain('<meta name="twitter:image" content="https://cdn.test/p.jpg">');
  });

  it('sin póster no inventa una imagen: un og:image roto es peor que ninguno', () => {
    const s = html({ canonical: 'https://volumine.app/embed/abc' });
    expect(s).not.toContain('og:image');
    expect(s).not.toContain('twitter:image');
  });

  /*
    La descripción es la mitad de la tarjeta. Sin ella, X pinta el título y un
    hueco: la imagen enseña la forma y no dice ni un número. El texto ya se
    generaba para `og:image:alt` y se estaba tirando.
  */
  it('describe la gráfica con datos, no solo con el título', () => {
    const s = html({ canonical: 'https://volumine.app/embed/abc' });
    const desc = s.match(/<meta property="og:description" content="([^"]*)">/)?.[1];
    expect(desc).toContain('Gráfica de anillo');
    expect(desc).toContain('A');
    expect(s).toContain(`<meta name="twitter:description" content="${desc}">`);
  });

  it('lleva twitter:title, que X prefiere sobre el de Open Graph', () => {
    const s = html({ canonical: 'https://volumine.app/embed/abc' });
    expect(s).toContain('<meta name="twitter:title" content="Ventas">');
  });

  /* Las de reproductor se quedan aunque X ya no las mire con esta tarjeta:
     las leen otros consumidores para montar el iframe sin pedir permiso. */
  it('mantiene las etiquetas de reproductor para quien sí las usa', () => {
    const s = html({ canonical: 'https://volumine.app/embed/abc' });
    expect(s).toContain(
      '<meta name="twitter:player" content="https://volumine.app/embed/abc">',
    );
    expect(s).toContain('<meta property="og:video:type" content="text/html">');
  });
});
