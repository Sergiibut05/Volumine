import { describe, it, expect } from 'vitest';
import { parseConfig } from './parse';
import { defaults } from './defaults';
import {
  encodeConfig,
  decodeConfig,
  buildEmbedUrl,
  applyQueryOverrides,
  MAX_URL_LENGTH,
} from './url';
import type { ChartConfig } from './schema';

const minimal: ChartConfig = {
  v: 1,
  type: 'donut',
  data: { labels: ['A', 'B'], series: [{ values: [60, 40] }] },
};

describe('config mínimo', () => {
  it('valida y produce defaults sensatos', () => {
    const r = parseConfig(minimal);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.issues).toEqual([]);
    expect(r.config.style.bevel).toBe(defaults.style.bevel);
    expect(r.config.motion.reducedMotion).toBe('respect');
    // El default que protege la página anfitriona: no le robamos el scroll.
    expect(r.config.interaction.zoom).toBe(false);
  });

  it('los overrides del usuario ganan a los defaults, campo a campo', () => {
    const r = parseConfig({ ...minimal, style: { bevel: 0.1 } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.config.style.bevel).toBe(0.1);
    // Los demás campos de la sección siguen viniendo de defaults.
    expect(r.config.style.innerRadius).toBe(defaults.style.innerRadius);
  });
});

describe('saneado: un config raro no revienta el embed', () => {
  it('ignora negativos en donut y lo dice', () => {
    const r = parseConfig({
      ...minimal,
      data: { labels: ['A', 'B'], series: [{ values: [60, -40] }] },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.config.data.series[0].values).toEqual([60, 0]);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0].level).toBe('warning');
    expect(r.issues[0].message).toContain('negativo');
  });

  it('convierte valores no numéricos en 0 y lo dice', () => {
    const r = parseConfig({
      ...minimal,
      data: {
        labels: ['A', 'B'],
        series: [{ values: [60, 'ocho' as unknown as number] }],
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.config.data.series[0].values).toEqual([60, 0]);
    expect(r.issues[0].message).toContain('no numérico');
  });

  it('recorta cuando labels y values no cuadran', () => {
    const r = parseConfig({
      ...minimal,
      data: { labels: ['A', 'B', 'C'], series: [{ values: [1, 2] }] },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.config.data.labels).toEqual(['A', 'B']);
    expect(r.issues[0].message).toContain('longitudes distintas');
  });

  it('falla explícitamente si todo son ceros en un donut', () => {
    const r = parseConfig({
      ...minimal,
      data: { labels: ['A', 'B'], series: [{ values: [0, 0] }] },
    });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.level === 'error')).toBe(true);
  });

  it('rechaza un config sin versión en lugar de adivinar', () => {
    const { v: _v, ...sinVersion } = minimal;
    const r = parseConfig(sinVersion);
    expect(r.ok).toBe(false);
    expect(r.issues[0].path).toBe('v');
  });

  it('no lanza nunca, ni con basura', () => {
    for (const bad of [null, undefined, 42, 'texto', [], {}, { v: 1 }]) {
      expect(() => parseConfig(bad)).not.toThrow();
      expect(parseConfig(bad).ok).toBe(false);
    }
  });
});

describe('config en URL', () => {
  it('ida y vuelta sin pérdida', () => {
    const full: ChartConfig = {
      ...minimal,
      title: 'Reparto de ingresos',
      style: { bevel: 0.42, palette: ['#7c5cff', '#00d4ff'] },
      motion: { autoRotate: false, speed: 2 },
    };
    expect(decodeConfig(encodeConfig(full))).toEqual(full);
  });

  it('devuelve null con un parámetro corrupto en vez de lanzar', () => {
    expect(decodeConfig('no-es-lz-string-válido###')).toBeNull();
    expect(decodeConfig('')).toBeNull();
  });

  it('rechaza URLs por encima del límite', () => {
    /* Etiquetas de alta entropía a propósito. Con texto repetitivo lz-string
       comprime tanto que 200 etiquetas largas caben de sobra — buena noticia
       para el producto, pero entonces el test no probaría el límite. Generador
       determinista para que el test sea reproducible. */
    let seed = 7;
    const ruido = (n: number) =>
      Array.from({ length: n }, () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return String.fromCharCode(33 + (seed % 90));
      }).join('');

    const enorme: ChartConfig = {
      v: 1,
      type: 'donut',
      data: {
        labels: Array.from({ length: 200 }, () => ruido(60)),
        series: [{ values: Array.from({ length: 200 }, (_, i) => i + 1) }],
      },
    };
    const r = buildEmbedUrl(enorme, 'https://voluma.app');
    expect(r.ok).toBe(false);
    expect(r.length).toBeGreaterThan(MAX_URL_LENGTH);
  });

  it('un config normal cabe de sobra', () => {
    const r = buildEmbedUrl(minimal, 'https://voluma.app');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.length).toBeLessThan(300);
  });
});

describe('overrides por query', () => {
  it('aplica solo los de la lista blanca', () => {
    const params = new URLSearchParams(
      'transparent=1&autorotate=0&style.bevel=1&theme=nocturno',
    );
    const next = applyQueryOverrides(minimal, params);

    expect(next.scene?.background?.kind).toBe('transparent');
    expect(next.motion?.autoRotate).toBe(false);
    expect(next.theme).toBe('nocturno');
    // `style.bevel` no está en la lista blanca: se ignora en silencio.
    expect(next.style?.bevel).toBeUndefined();
  });

  it('no muta el config original', () => {
    const original = structuredClone(minimal);
    applyQueryOverrides(minimal, new URLSearchParams('transparent=1'));
    expect(minimal).toEqual(original);
  });

  it('ignora un color de fondo que no sea hex', () => {
    const next = applyQueryOverrides(
      minimal,
      new URLSearchParams('bg=javascript:alert(1)'),
    );
    expect(next.scene?.background?.kind).toBeUndefined();
  });
});
