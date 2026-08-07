import { describe, expect, it } from 'vitest';
import { cssGradientLine } from './gradient';

/*
  Un degradado girado sigue siendo un degradado bonito: no hay nada que reviente
  ni ninguna excepción que ver. Por eso esto se comprueba con números y no a
  ojo — mirando un póster es fácil dar por bueno un ángulo equivocado.

  Las cuatro direcciones cardinales son la prueba de fuego de la convención de
  CSS, que no es la intuitiva: 0° apunta ARRIBA y se crece en sentido horario.
*/

const cerca = (valor: number, esperado: number) => expect(valor).toBeCloseTo(esperado, 6);

describe('cssGradientLine', () => {
  const W = 400;
  const H = 200;

  it('0° pone el primer color ABAJO y el segundo arriba', () => {
    const l = cssGradientLine(0, W, H);
    cerca(l.x0, 200);
    cerca(l.y0, 200); // abajo del todo
    cerca(l.x1, 200);
    cerca(l.y1, 0); // arriba del todo
  });

  it('90° va de izquierda a derecha', () => {
    const l = cssGradientLine(90, W, H);
    cerca(l.x0, 0);
    cerca(l.y0, 100);
    cerca(l.x1, 400);
    cerca(l.y1, 100);
  });

  it('180° va de arriba abajo', () => {
    const l = cssGradientLine(180, W, H);
    cerca(l.y0, 0);
    cerca(l.y1, 200);
  });

  it('270° va de derecha a izquierda', () => {
    const l = cssGradientLine(270, W, H);
    cerca(l.x0, 400);
    cerca(l.x1, 0);
  });

  it('el largo de la línea es |W·sen| + |H·cos|, no la diagonal', () => {
    /* Es lo que hace que las esquinas caigan justo en los extremos del
       degradado. Con la diagonal, el color final nunca llegaría a la esquina. */
    for (const angulo of [0, 17, 45, 90, 135, 200, 315, 359]) {
      const l = cssGradientLine(angulo, W, H);
      const rad = (angulo * Math.PI) / 180;
      const esperado = Math.abs(W * Math.sin(rad)) + Math.abs(H * Math.cos(rad));
      cerca(Math.hypot(l.x1 - l.x0, l.y1 - l.y0), esperado);
    }
  });

  it('la línea siempre pasa por el centro', () => {
    for (const angulo of [0, 33, 135, 271]) {
      const l = cssGradientLine(angulo, W, H);
      cerca((l.x0 + l.x1) / 2, W / 2);
      cerca((l.y0 + l.y1) / 2, H / 2);
    }
  });

  it('135°, que es el de por defecto, va de arriba-izquierda a abajo-derecha', () => {
    const l = cssGradientLine(135, W, H);
    expect(l.x0).toBeLessThan(l.x1);
    expect(l.y0).toBeLessThan(l.y1);
  });

  it('360° da lo mismo que 0°, y los ángulos de fuera de rango se normalizan', () => {
    const cero = cssGradientLine(0, W, H);
    for (const angulo of [360, 720, -360]) {
      const l = cssGradientLine(angulo, W, H);
      cerca(l.x0, cero.x0);
      cerca(l.y0, cero.y0);
      cerca(l.x1, cero.x1);
      cerca(l.y1, cero.y1);
    }
    // -90 es 270
    const menos = cssGradientLine(-90, W, H);
    const doscientos = cssGradientLine(270, W, H);
    cerca(menos.x0, doscientos.x0);
    cerca(menos.x1, doscientos.x1);
  });

  it('aguanta un lienzo cuadrado y uno degenerado sin dar NaN', () => {
    for (const [w, h] of [
      [500, 500],
      [1, 1000],
      [0, 0],
    ]) {
      const l = cssGradientLine(45, w, h);
      for (const v of [l.x0, l.y0, l.x1, l.y1]) expect(Number.isFinite(v)).toBe(true);
    }
  });
});
