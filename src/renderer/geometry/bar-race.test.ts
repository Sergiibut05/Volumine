import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FRAME_MS,
  MAX_VISIBLE,
  TRANSITION_SHARE,
  frameAt,
  placementsFor,
  rankSlots,
  valuesAt,
} from './bar-race';

const names = ['2021', '2022', '2023'];
const opts = { frameMs: 1000, loop: true };

describe('frameAt', () => {
  it('empieza en el primer periodo', () => {
    const frame = frameAt(0, 3, names, opts);
    expect(frame.from).toBe(0);
    expect(frame.to).toBe(1);
    expect(frame.t).toBe(0);
    expect(frame.label).toBe('2021');
  });

  it('llega al destino ANTES de acabar el periodo', () => {
    /* El resto del periodo es reposo. Sin ese descanso el ojo no llega a
       registrar quién va ganando antes de que todo vuelva a moverse. */
    const moving = frameAt(1000 * TRANSITION_SHARE * 0.5, 3, names, opts);
    const resting = frameAt(1000 * TRANSITION_SHARE + 1, 3, names, opts);

    expect(moving.t).toBeGreaterThan(0);
    expect(moving.t).toBeLessThan(1);
    expect(resting.t).toBe(1);
  });

  it('la etiqueta cambia a mitad de transición, no al principio', () => {
    // Si cambiara al empezar, el número diría 2022 mientras las barras aún
    // están donde las dejó 2021.
    expect(frameAt(100, 3, names, opts).label).toBe('2021');
    expect(frameAt(560, 3, names, opts).label).toBe('2022');
  });

  it('con loop vuelve a empezar y sin loop se queda en el último', () => {
    const total = 1000 * (names.length - 1);
    const looped = frameAt(total + 100, 3, names, opts);
    const held = frameAt(total * 5, 3, names, { frameMs: 1000, loop: false });

    expect(looped.from).toBe(0);
    expect(held.to).toBe(2);
    expect(held.t).toBe(1);
    expect(held.label).toBe('2023');
  });

  it('con un solo periodo no hay animación que hacer', () => {
    const frame = frameAt(9999, 1, ['único'], opts);
    expect(frame).toEqual({ from: 0, to: 0, t: 1, label: 'único' });
  });

  it('inventa nombre si la serie no lo trae, en vez de dejarlo vacío', () => {
    expect(frameAt(0, 2, [null, null], opts).label).toBe('1');
  });

  it('nunca sale del rango de series, ni con tiempo negativo', () => {
    for (const ms of [-5000, -1, 0, 1, 999999]) {
      const frame = frameAt(ms, 3, names, opts);
      expect(frame.from).toBeGreaterThanOrEqual(0);
      expect(frame.to).toBeLessThanOrEqual(2);
      expect(frame.t).toBeGreaterThanOrEqual(0);
      expect(frame.t).toBeLessThanOrEqual(1);
    }
  });
});

describe('valuesAt', () => {
  const series = [
    [10, 50],
    [30, 20],
  ];

  it('interpola entre los dos periodos', () => {
    const mid = valuesAt(series, { from: 0, to: 1, t: 0.5, label: '' }, 2);
    expect(mid).toEqual([20, 35]);
  });

  it('los extremos son exactamente los datos, sin deriva', () => {
    expect(valuesAt(series, { from: 0, to: 1, t: 0, label: '' }, 2)).toEqual([10, 50]);
    expect(valuesAt(series, { from: 0, to: 1, t: 1, label: '' }, 2)).toEqual([30, 20]);
  });

  it('un hueco en los datos cuenta como 0 y la carrera sigue', () => {
    const conHueco = [[10, NaN] as number[], [30, 20]];
    const mid = valuesAt(conHueco, { from: 0, to: 1, t: 0.5, label: '' }, 2);
    expect(mid).toEqual([20, 10]);
  });

  it('rellena las categorías que una serie no trae', () => {
    const corto = [[10], [30, 20]];
    expect(valuesAt(corto, { from: 0, to: 1, t: 1, label: '' }, 2)).toEqual([30, 20]);
  });
});

describe('rankSlots', () => {
  it('el mayor va al puesto 0', () => {
    expect(rankSlots([10, 50, 30])).toEqual([2, 0, 1]);
  });

  it('los empates se rompen por índice y son estables', () => {
    /* Si se rompieran por orden de llegada, dos categorías empatadas se
       intercambiarían el sitio en cada frame y la gráfica temblaría. */
    const a = rankSlots([20, 20, 20]);
    const b = rankSlots([20, 20, 20]);
    expect(a).toEqual([0, 1, 2]);
    expect(a).toEqual(b);
  });

  it('cada puesto se asigna una sola vez', () => {
    const slots = rankSlots([5, 9, 1, 9, 3]);
    expect([...slots].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('placementsFor', () => {
  it('solo entran en pantalla las primeras', () => {
    const values = Array.from({ length: MAX_VISIBLE + 5 }, (_, i) => 100 - i);
    const places = placementsFor(values);

    expect(places.filter((p) => p.visible)).toHaveLength(MAX_VISIBLE);
    expect(places[0].visible).toBe(true);
    expect(places[MAX_VISIBLE].visible).toBe(false);
  });
});

describe('constantes', () => {
  it('el periodo por defecto deja ver el cambio sin aburrir', () => {
    expect(DEFAULT_FRAME_MS).toBeGreaterThanOrEqual(800);
    expect(DEFAULT_FRAME_MS).toBeLessThanOrEqual(2500);
  });

  it('siempre queda reposo dentro del periodo', () => {
    expect(TRANSITION_SHARE).toBeGreaterThan(0);
    expect(TRANSITION_SHARE).toBeLessThan(1);
  });
});
