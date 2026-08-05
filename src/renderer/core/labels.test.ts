import { describe, expect, it } from 'vitest';
import { fitLabels, stackLabels } from './labels';

const opciones = { viewport: 400, gap: 4, padding: 8 };

/** ¿Hay algún par que se pise? Es la única propiedad que importa de verdad. */
function solapan(ys: number[], alto: number, gap: number): boolean {
  const orden = [...ys].sort((a, b) => a - b);
  return orden.some((y, i) => i > 0 && y < orden[i - 1] + alto + gap - 1e-9);
}

const slots = (posiciones: number[], alto = 20) =>
  posiciones.map((y, index) => ({ index, y, height: alto }));

describe('stackLabels', () => {
  it('deja en paz lo que ya cabe', () => {
    const ys = [40, 100, 200];
    expect(stackLabels(slots(ys), opciones)).toEqual(ys);
  });

  it('separa las que se pisan', () => {
    const resultado = stackLabels(slots([100, 104, 108]), opciones);
    expect(solapan(resultado, 20, 4)).toBe(false);
  });

  it('no reordena: la línea guía de cada una sigue apuntando a lo suyo', () => {
    /* Si se reordenaran para que cupieran mejor, las líneas se cruzarían y el
       dibujo sería más difícil de leer que sin etiquetas. */
    const entrada = [100, 104, 108, 112];
    const resultado = stackLabels(slots(entrada), opciones);
    const ordenado = [...resultado].sort((a, b) => a - b);
    expect(resultado).toEqual(ordenado);
  });

  it('respeta el margen de arriba', () => {
    const resultado = stackLabels(slots([0, 2, 4]), opciones);
    expect(Math.min(...resultado)).toBeGreaterThanOrEqual(opciones.padding);
  });

  /* La pasada de vuelta. Sin ella, un grupo apretado abajo empuja a la última
     fuera de la pantalla y nadie la ve. */
  it('recupera lo que se sale por abajo', () => {
    const resultado = stackLabels(slots([370, 374, 378, 382]), opciones);
    const alto = 20;
    expect(Math.max(...resultado) + alto).toBeLessThanOrEqual(
      opciones.viewport - opciones.padding + 1e-9,
    );
    expect(solapan(resultado, alto, 4)).toBe(false);
  });

  it('con todas amontonadas en el centro, se reparten sin solaparse', () => {
    const resultado = stackLabels(slots(Array(8).fill(200)), opciones);
    expect(solapan(resultado, 20, 4)).toBe(false);
    expect(Math.min(...resultado)).toBeGreaterThanOrEqual(opciones.padding);
  });

  it('no revienta con una sola ni con ninguna', () => {
    expect(stackLabels([], opciones)).toEqual([]);
    expect(stackLabels(slots([150]), opciones)).toEqual([150]);
  });

  it('mismo dato, misma colocación: los tests visuales dependen de esto', () => {
    const entrada = slots([100, 104, 260, 262]);
    expect(stackLabels(entrada, opciones)).toEqual(stackLabels(entrada, opciones));
  });
});

describe('fitLabels', () => {
  const caber = { viewport: 400, height: 20, gap: 4, padding: 8 };

  it('con sitio de sobra salen todas', () => {
    expect(fitLabels([5, 3, 1], caber)).toEqual([0, 1, 2]);
  });

  /* Apretar veinte etiquetas en el alto de ocho no las hace legibles, las hace
     ilegibles todas. Se enseñan las que caben. */
  it('sin sitio, sobreviven las de valor más alto', () => {
    const estrecho = { ...caber, viewport: 60 };
    const elegidas = fitLabels([1, 90, 2, 80], estrecho);
    expect(elegidas.length).toBeLessThan(4);
    // 90 y 80 están en los índices 1 y 3.
    expect(elegidas.every((i) => i === 1 || i === 3)).toBe(true);
  });

  it('las que sobreviven salen en orden de dato, no de tamaño', () => {
    const estrecho = { ...caber, viewport: 110 };
    const elegidas = fitLabels([50, 10, 90, 20, 70], estrecho);
    expect(elegidas).toEqual([...elegidas].sort((a, b) => a - b));
  });

  it('siempre cabe al menos una, por estrecho que sea el hueco', () => {
    expect(fitLabels([1, 2, 3], { ...caber, viewport: 1 })).toHaveLength(1);
  });
});
