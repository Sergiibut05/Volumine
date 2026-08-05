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

describe('contrato de barras', () => {
  const bars: ChartConfig = {
    v: 1,
    type: 'bar',
    data: { labels: ['Ene', 'Feb'], series: [{ values: [10, 20] }] },
  };

  it('el config mínimo de barras vale y hereda los mismos defaults', () => {
    const r = parseConfig(bars);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.config.type).toBe('bar');
    // Reutiliza los campos que ya existían: no hay defaults propios del tipo.
    expect(r.config.style.bevel).toBe(defaults.style.bevel);
    expect(r.config.style.cornerRadius).toBe(defaults.style.cornerRadius);
  });

  it('los negativos SÍ se conservan en barras', () => {
    const r = parseConfig({
      ...bars,
      data: { labels: ['Ene', 'Feb'], series: [{ values: [10, -20] }] },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.config.data.series[0].values).toEqual([10, -20]);
    expect(r.issues).toEqual([]);
  });

  it('admite varias series y las conserva enteras', () => {
    const r = parseConfig({
      ...bars,
      data: {
        labels: ['Ene', 'Feb'],
        series: [
          { name: '2025', values: [10, 20] },
          { name: '2026', values: [15, 25] },
        ],
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.config.data.series).toHaveLength(2);
    expect(r.config.data.series[1].name).toBe('2026');
  });

  it('una serie corta se rellena con ceros sin recortar las demás', () => {
    const r = parseConfig({
      ...bars,
      data: {
        labels: ['Ene', 'Feb', 'Mar'],
        series: [{ values: [10, 20, 30] }, { values: [5] }],
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.config.data.labels).toHaveLength(3);
    expect(r.config.data.series[0].values).toEqual([10, 20, 30]);
    expect(r.config.data.series[1].values).toEqual([5, 0, 0]);
    expect(r.issues[0].message).toContain('cuentan como 0');
  });

  it('falla explícitamente si todas las barras son cero', () => {
    const r = parseConfig({
      ...bars,
      data: { labels: ['Ene', 'Feb'], series: [{ values: [0, 0] }] },
    });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.level === 'error')).toBe(true);
  });

  it('un config de anillo publicado sigue validando igual', () => {
    // El tipo nuevo no ha tocado el esquema: no hay versión nueva ni migración.
    const r = parseConfig(minimal);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.v).toBe(1);
    expect(r.issues).toEqual([]);
  });
});

describe('tema: preset que rellena, no que bloquea', () => {
  it('un config con solo el nombre del tema se renderiza con el tema', () => {
    // Es el caso de un link corto escrito a mano y el de una gráfica publicada
    // antes de mejorar el tema: si esto no pasa, `theme` no significa nada.
    const r = parseConfig({ ...minimal, theme: 'papel' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.config.style.material).toBe('toon');
    expect(r.config.style.palette[0]).toBe('#264653');
    expect(r.config.scene.environment).toBe('soft');
  });

  it('lo que el usuario toca gana al tema, campo a campo', () => {
    const r = parseConfig({
      ...minimal,
      theme: 'papel',
      style: { material: 'metal' },
      scene: { background: { kind: 'solid', from: '#000000' } },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.config.style.material).toBe('metal');
    // El resto del tema sigue en pie.
    expect(r.config.style.palette[0]).toBe('#264653');
    expect(r.config.scene.environment).toBe('soft');
    expect(r.config.scene.background.from).toBe('#000000');
  });

  it('un tema que no existe no rompe nada', () => {
    const r = parseConfig({ ...minimal, theme: 'no-existe' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.style.material).toBe(defaults.style.material);
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

/*
  El medidor se parece al anillo en casi todo, y por eso lo que hay que probar
  es justo donde NO se parece. Si alguna de estas se rompe, un medidor se
  comporta como un anillo y deja de medir nada.
*/
describe('medidor', () => {
  const gauge = (
    values: number[],
    style?: NonNullable<ChartConfig['style']>['gauge'],
  ): ChartConfig => ({
    v: 1,
    type: 'gauge',
    data: { labels: values.map((_, i) => `Fila ${i + 1}`), series: [{ values }] },
    ...(style ? { style: { gauge: style } } : {}),
  });

  it('un config mínimo vale, y el tope por defecto es 100', () => {
    const result = parseConfig(gauge([62]));
    expect(result.ok).toBe(true);
    expect(result.config!.style.gauge.max).toBe(100);
    expect(result.config!.style.gauge.sweep).toBe(defaults.style.gauge.sweep);
  });

  /* LA diferencia con el anillo. Un anillo a cero no tiene nada que repartir y
     es un error; un medidor a cero vale «0 de 100», que es una lectura buena y
     frecuente —el primer día de una campaña—. Tratarlo como error dejaría el
     hueco en blanco justo cuando el dato es correcto. */
  it('todo a cero es válido, al revés que en un anillo', () => {
    expect(parseConfig(gauge([0])).ok).toBe(true);
    expect(parseConfig({ ...gauge([0]), type: 'donut' }).ok).toBe(false);
  });

  it('un tope que no sube se avisa y se cae al de por defecto', () => {
    const result = parseConfig(gauge([50], { max: 0 }));
    expect(result.ok).toBe(true);
    expect(result.config!.style.gauge.max).toBe(100);
    expect(result.issues.some((i) => i.path === 'style.gauge.max')).toBe(true);
  });

  it('un negativo se ignora y se dice', () => {
    const result = parseConfig(gauge([-10, 40]));
    expect(result.ok).toBe(true);
    expect(result.config!.data.series[0].values).toEqual([0, 40]);
    expect(result.issues.some((i) => i.level === 'warning')).toBe(true);
  });

  it('solo lee la primera serie: las demás sobran y se recortan', () => {
    const result = parseConfig({
      v: 1,
      type: 'gauge',
      data: {
        labels: ['A'],
        series: [{ values: [30] }, { values: [90] }],
      },
    });
    expect(result.ok).toBe(true);
    expect(result.config!.data.series[0].values).toEqual([30]);
  });

  it('los ajustes del medidor no se pisan entre ellos al resolverse', () => {
    const result = parseConfig(gauge([50], { sweep: 180 }));
    expect(result.config!.style.gauge.sweep).toBe(180);
    expect(result.config!.style.gauge.max).toBe(100);
    expect(result.config!.style.gauge.track).toBe(true);
  });

  /* El contrato es aditivo dentro de v1: un link publicado antes de que el
     medidor existiera no lleva `style.gauge` y tiene que seguir funcionando. */
  it('un config sin `style.gauge` sigue valiendo', () => {
    const result = parseConfig({
      v: 1,
      type: 'donut',
      data: { labels: ['A', 'B'], series: [{ values: [1, 2] }] },
    });
    expect(result.ok).toBe(true);
    expect(result.config!.style.gauge.max).toBe(100);
  });
});
