import { describe, expect, it } from 'vitest';
import { computeGauge } from './gauge';

/*
  Lo que se prueba aquí es el REPARTO, no el sólido: el sólido es el mismo del
  anillo y ya lo cubre rounded-sector. Aquí lo que puede romperse es dónde
  empieza el arco, qué pasa cuando el dato se sale y qué pasa cuando no hay dato.
*/

const params = { max: 100, sweepDegrees: 270, gapTurns: 0 };

/*
  Dónde cae un ángulo EN PANTALLA.

  Este helper es el que pilla los errores de signo, y ya pilló uno: la primera
  versión llevaba `-sin` y dejaba el medidor del revés, con el hueco arriba. La
  geometría pone θ en (cos θ, 0, −sin θ) y el eje Z de mundo apunta hacia la
  cámara —hacia abajo en pantalla—, así que las dos negaciones se cancelan y θ
  acaba siendo el ángulo de siempre: `cos` a la derecha y `sin` ARRIBA.
*/
const screen = (angle: number) => ({
  x: Math.cos(angle),
  y: Math.sin(angle),
});

describe('computeGauge', () => {
  it('centra el arco abajo: empieza abajo a la izquierda y acaba abajo a la derecha', () => {
    const { sectors, track } = computeGauge([50], params);
    // Se recorre hacia ángulos decrecientes: se entra por `a1` y se sale por `a0`.
    const start = screen(sectors[0].a1);
    const end = screen(track!.a0);

    expect(start.x).toBeLessThan(0);
    expect(start.y).toBeLessThan(0);
    expect(end.x).toBeGreaterThan(0);
    expect(end.y).toBeLessThan(0);
    // Simétrico respecto al eje vertical: el hueco queda centrado abajo.
    expect(start.x).toBeCloseTo(-end.x, 6);
    expect(start.y).toBeCloseTo(end.y, 6);
  });

  it('el arco entero mide lo que dice `sweep`, ni más ni menos', () => {
    const { sectors, track } = computeGauge([30], params);
    const total = sectors[0].a1 - track!.a0;
    expect((total * 180) / Math.PI).toBeCloseTo(270, 6);
  });

  it('la mitad del tope llena la mitad del arco', () => {
    const { sectors, progress } = computeGauge([50], params);
    const filled = sectors[0].a1 - sectors[0].a0;
    expect((filled * 180) / Math.PI).toBeCloseTo(135, 6);
    expect(progress).toBeCloseTo(0.5, 6);
  });

  /* La diferencia de fondo con el anillo: aquí el total lo pone `max`, no la
     suma. Si esto se rompiera, un medidor a medias se dibujaría lleno. */
  it('el arco NO se reparte entre los valores como en un anillo', () => {
    const { sectors, track } = computeGauge([20, 30], params);
    const filled = sectors.reduce((sum, s) => sum + (s.a1 - s.a0), 0);
    expect((filled * 180) / Math.PI).toBeCloseTo(135, 6);
    expect(track).not.toBeNull();
  });

  it('varios valores se ponen uno detrás de otro, en orden', () => {
    const { sectors } = computeGauge([20, 30], params);
    expect(sectors).toHaveLength(2);
    expect(sectors[0].a0).toBeCloseTo(sectors[1].a1, 6);
    expect(sectors[1].a1 - sectors[1].a0).toBeGreaterThan(sectors[0].a1 - sectors[0].a0);
  });

  it('a cero no da error: devuelve el arco entero como fondo', () => {
    const { sectors, track, total, progress } = computeGauge([0], params);
    expect(sectors).toHaveLength(0);
    expect(total).toBe(0);
    expect(progress).toBe(0);
    expect((track!.a1 - track!.a0) * (180 / Math.PI)).toBeCloseTo(270, 6);
  });

  it('lleno del todo se queda sin fondo', () => {
    const { track, progress } = computeGauge([100], params);
    expect(track).toBeNull();
    expect(progress).toBe(1);
  });

  /* Pasarse no puede salirse del arco ni tapar al vecino: se reparte el arco
     entero en proporción y se avisa. La cifra del centro sigue siendo la real. */
  it('pasarse del tope llena el arco sin desbordarlo, y lo dice', () => {
    const { sectors, track, total, overflow, progress } = computeGauge([90, 60], params);
    const filled = sectors.reduce((sum, s) => sum + (s.a1 - s.a0), 0);

    expect(overflow).toBe(true);
    expect(total).toBe(150);
    expect(progress).toBe(1);
    expect(track).toBeNull();
    expect((filled * 180) / Math.PI).toBeCloseTo(270, 6);
  });

  it('los negativos cuentan como 0', () => {
    const { total, sectors } = computeGauge([-40, 25], params);
    expect(total).toBe(25);
    expect(sectors).toHaveLength(1);
  });

  it('con 360° el arco da la vuelta entera y empieza abajo', () => {
    const { sectors, track } = computeGauge([25], { ...params, sweepDegrees: 360 });
    expect(sectors[0].a1 - track!.a0).toBeCloseTo(Math.PI * 2, 6);
    const start = screen(sectors[0].a1);
    expect(start.x).toBeCloseTo(0, 6);
    expect(start.y).toBeCloseTo(-1, 6);
  });

  /* El primer trozo tiene que arrancar EN el cero de la escala y el fondo morir
     EN el tope. Meterlos hacia dentro dejaría el medidor corto por los dos lados
     y el arco ya no mediría los grados que dice `sweep`. */
  it('la separación no encoge los extremos del arco', () => {
    const gap = 0.012;
    const { sectors, track } = computeGauge([40, 20], { ...params, gapTurns: gap });
    const bare = computeGauge([60], params);

    expect(sectors[0].a1).toBeCloseTo(bare.sectors[0].a1, 6);
    expect(track!.a0).toBeCloseTo(bare.track!.a0, 6);
    // Pero sí separa los trozos entre ellos.
    expect(sectors[0].a0 - sectors[1].a1).toBeCloseTo(gap * Math.PI * 2, 6);
  });

  it('un trozo más fino que la propia separación no se dibuja', () => {
    const { sectors } = computeGauge([60, 0.01], { ...params, gapTurns: 0.012 });
    expect(sectors).toHaveLength(1);
  });

  it('mismo dato, mismos ángulos: el render estático depende de esto', () => {
    expect(computeGauge([37], params)).toEqual(computeGauge([37], params));
  });
});
