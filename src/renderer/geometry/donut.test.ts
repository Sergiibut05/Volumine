import { describe, it, expect } from 'vitest';
import {
  computeSectors,
  maxBevelForSector,
  globalBevel,
  curveSegmentsFor,
  sectorGeometry,
  OUTER_RADIUS,
} from './donut';

const limits = { innerR: 0.55, outerR: OUTER_RADIUS, depth: 0.34, gapAngle: 0.0754 };

describe('computeSectors', () => {
  it('reparte proporcionalmente y cubre la circunferencia', () => {
    const sectors = computeSectors([50, 30, 20], 0);
    expect(sectors).toHaveLength(3);
    expect(sectors[0].fraction).toBeCloseTo(0.5);
    expect(sectors[2].fraction).toBeCloseTo(0.2);

    const total = sectors.reduce((sum, s) => sum + (s.a1 - s.a0), 0);
    expect(total).toBeCloseTo(Math.PI * 2);
  });

  it('arranca arriba', () => {
    expect(computeSectors([1], 0)[0].a0).toBeCloseTo(-Math.PI / 2);
  });

  it('la separación recorta cada sector por los dos lados', () => {
    const gap = 0.01;
    const [s] = computeSectors([1], gap);
    const sweep = s.a1 - s.a0;
    expect(sweep).toBeCloseTo(Math.PI * 2 - gap * Math.PI * 2);
  });

  it('descarta sectores más finos que la propia separación', () => {
    // 0.05% del total contra una separación enorme: no cabe.
    const sectors = computeSectors([1000, 0.5], 0.04);
    expect(sectors.map((s) => s.index)).toEqual([0]);
  });

  it('devuelve vacío si no hay nada positivo que dibujar', () => {
    expect(computeSectors([0, 0], 0.01)).toEqual([]);
    expect(computeSectors([], 0.01)).toEqual([]);
    expect(computeSectors([-5, -2], 0.01)).toEqual([]);
  });
});

describe('límites del bevel', () => {
  it('con la separación por defecto, el hueco domina y todos los sectores empatan', () => {
    // No es un accidente: con gap 0.012 e innerR 0.55 la restricción del hueco
    // (0.0353) es más dura que la del arco incluso para un sector del 10%. Por
    // eso el donut queda con el canto uniforme sin necesidad de nada más.
    const [grande, pequeno] = computeSectors([90, 10], 0.012);
    expect(maxBevelForSector(pequeno, limits)).toBeCloseTo(
      maxBevelForSector(grande, limits),
    );
  });

  it('a partir de un sector suficientemente pequeño, manda su propio arco', () => {
    // Con un 3% el arco interior ya es más restrictivo que el hueco, y ese
    // sector pasa a marcar el bevel de todo el donut. Es el "problema abierto"
    // de docs/STATE.md hecho test: aquí se ve cuándo empieza a doler.
    const [grande, pequeno] = computeSectors([97, 3], 0.012);
    expect(maxBevelForSector(pequeno, limits)).toBeLessThan(
      maxBevelForSector(grande, limits),
    );
  });

  it('la separación acota el bevel aunque el sector dé de sobra', () => {
    const [s] = computeSectors([1], 0.012);
    const holgado = maxBevelForSector(s, limits);
    const apretado = maxBevelForSector(s, { ...limits, gapAngle: 0.004 });
    expect(apretado).toBeLessThan(holgado);
  });

  it('nunca es negativo, ni con dimensiones degeneradas', () => {
    const [s] = computeSectors([1], 0);
    expect(maxBevelForSector(s, { ...limits, innerR: 1, outerR: 1 })).toBe(0);
    expect(maxBevelForSector(s, { ...limits, depth: 0 })).toBe(0);
  });
});

describe('globalBevel', () => {
  it('es UNO SOLO: lo marca el sector más restrictivo', () => {
    const sectors = computeSectors([60, 30, 10], 0.012);
    const global = globalBevel(sectors, limits, 1);
    const minimo = Math.min(...sectors.map((s) => maxBevelForSector(s, limits)));

    expect(global).toBeCloseTo(minimo);
    // Y por debajo del máximo de cualquier sector: nadie se pasa de su límite.
    for (const s of sectors) {
      expect(global).toBeLessThanOrEqual(maxBevelForSector(s, limits) + 1e-9);
    }
  });

  it('escala linealmente con el ratio y respeta el rango 0..1', () => {
    const sectors = computeSectors([50, 50], 0.012);
    const max = globalBevel(sectors, limits, 1);

    expect(globalBevel(sectors, limits, 0)).toBe(0);
    expect(globalBevel(sectors, limits, 0.5)).toBeCloseTo(max / 2);
    // Fuera de rango se acota en vez de reventar.
    expect(globalBevel(sectors, limits, 5)).toBeCloseTo(max);
    expect(globalBevel(sectors, limits, -3)).toBe(0);
  });

  it('sin sectores devuelve 0 en lugar de Infinity', () => {
    expect(globalBevel([], limits, 1)).toBe(0);
  });
});

describe('curveSegmentsFor', () => {
  it('escala con el ángulo del sector', () => {
    const [grande, pequeno] = computeSectors([90, 10], 0.012);
    expect(curveSegmentsFor(pequeno)).toBeLessThan(curveSegmentsFor(grande));
  });

  it('nunca baja del mínimo que hace que se vea el polígono', () => {
    const sectors = computeSectors([9999, 1], 0);
    expect(sectors).toHaveLength(2);
    expect(curveSegmentsFor(sectors[1])).toBeGreaterThanOrEqual(6);
  });
});

describe('sectorGeometry', () => {
  const [sector] = computeSectors([1], 0.012);

  it('deja la base en y=0 y respeta la altura pedida', () => {
    const geo = sectorGeometry({
      sector,
      innerR: 0.55,
      outerR: 1,
      depth: 0.34,
      bevel: 0.02,
      curveSegments: 24,
    });
    geo.computeBoundingBox();
    const box = geo.boundingBox!;

    expect(box.min.y).toBeCloseTo(0, 5);
    expect(box.max.y).toBeCloseTo(0.34, 5);
    geo.dispose();
  });

  it('no se sale del radio exterior', () => {
    const geo = sectorGeometry({
      sector,
      innerR: 0.55,
      outerR: 1,
      depth: 0.34,
      bevel: 0.02,
      curveSegments: 24,
    });
    geo.computeBoundingSphere();
    // El sector completo: su radio en XZ no puede superar el exterior.
    expect(Math.max(Math.abs(geo.boundingBox?.max.x ?? 0), 0)).toBeLessThanOrEqual(1.001);
    geo.dispose();
  });

  it('con bevel 0 sigue produciendo geometría válida', () => {
    const geo = sectorGeometry({
      sector,
      innerR: 0.55,
      outerR: 1,
      depth: 0.34,
      bevel: 0,
      curveSegments: 24,
    });
    expect(geo.attributes.position.count).toBeGreaterThan(0);
    geo.computeBoundingBox();
    expect(geo.boundingBox!.max.y).toBeCloseTo(0.34, 5);
    geo.dispose();
  });

  it('acota un bevel absurdo en vez de producir geometría rota', () => {
    const geo = sectorGeometry({
      sector,
      innerR: 0.55,
      outerR: 1,
      depth: 0.34,
      bevel: 99,
      curveSegments: 24,
    });
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    expect(Number.isFinite(box.max.y)).toBe(true);
    expect(box.max.y).toBeLessThanOrEqual(0.35);
    geo.dispose();
  });

  it('menos curveSegments = menos geometría', () => {
    const pocos = sectorGeometry({
      sector,
      innerR: 0.55,
      outerR: 1,
      depth: 0.34,
      bevel: 0.02,
      curveSegments: 12,
    });
    const muchos = sectorGeometry({
      sector,
      innerR: 0.55,
      outerR: 1,
      depth: 0.34,
      bevel: 0.02,
      curveSegments: 64,
    });
    expect(pocos.attributes.position.count).toBeLessThan(muchos.attributes.position.count);
    pocos.dispose();
    muchos.dispose();
  });
});
