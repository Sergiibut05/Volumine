import { describe, expect, it } from 'vitest';
import { embedHtml } from './html';
import { parseConfig } from '@/lib/config/parse';
import type { ChartConfig } from '@/lib/config/schema';

/*
  El póster de relleno: el `<img>` que se ve mientras arranca WebGL, y para
  siempre si no arranca.

  Esto existe por un fallo que llegó a producción y lo encontró Manuel mirando
  una gráfica en Notion: el póster se había vuelto OPACO —para que la tarjeta de
  enlace no dependiera de con qué color rellena cada cliente la transparencia— y
  eso convirtió el relleno de una gráfica de fondo transparente en un rectángulo
  blanco nítido tapando la página de detrás.

  La misma imagen sirve para dos cosas que quieren lo contrario: dentro del
  embed quiere alfa, en una tarjeta de enlace quiere ser opaca. Mientras haya
  una sola imagen, con fondo transparente gana no poner nada.
*/

const base = (background: ChartConfig['scene']): ChartConfig => ({
  v: 1,
  type: 'donut',
  data: { labels: ['A', 'B'], series: [{ values: [1, 2] }] },
  scene: background,
});

function html(background: ChartConfig['scene']) {
  const parsed = parseConfig(base(background));
  if (!parsed.ok) throw new Error('config de prueba inválida');

  return embedHtml({
    config: parsed.config,
    css: '',
    scriptSrc: '/x.js',
    poster: 'https://ejemplo/poster.jpg',
    canonical: 'https://volumine.app/embed/abc',
    origin: 'https://volumine.app',
  });
}

describe('el póster de relleno dentro del embed', () => {
  it('NO se pone con fondo transparente', () => {
    /* Es lo que se veía mal en Notion: un rectángulo del color equivocado donde
       tenía que verse la página de quien incrusta. */
    expect(html({ background: { kind: 'transparent' } })).not.toContain('class="poster"');
  });

  it('sí se pone con fondo sólido y con degradado', () => {
    /* Ahí el póster y el embed son del mismo color por construcción, así que el
       relleno hace justo lo que promete: enseñar la gráfica desde el primer
       byte. */
    for (const background of [
      { kind: 'solid', from: '#0b0b12' },
      { kind: 'gradient', from: '#0b0b12', to: '#3d1f7a', angle: 135 },
    ] as const) {
      expect(html({ background }), background.kind).toContain('class="poster"');
    }
  });

  it('la tarjeta de enlace SIGUE llevando la imagen aunque sea transparente', () => {
    /* El relleno y el `og:image` son decisiones distintas: quitar uno no puede
       llevarse el otro por delante, que es justo el error que habría sido
       arreglar esto en el sitio equivocado. */
    const salida = html({ background: { kind: 'transparent' } });
    expect(salida).toContain('og:image');
    expect(salida).toContain('https://ejemplo/poster.jpg');
  });

  it('sin póster no se inventa ninguno', () => {
    const parsed = parseConfig(base({ background: { kind: 'solid', from: '#fff' } }));
    if (!parsed.ok) throw new Error('config de prueba inválida');

    const salida = embedHtml({
      config: parsed.config,
      css: '',
      scriptSrc: '/x.js',
      poster: null,
    });
    expect(salida).not.toContain('class="poster"');
  });
});
