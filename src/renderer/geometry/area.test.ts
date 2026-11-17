import { describe, it, expect } from 'vitest';
import type { BufferGeometry } from 'three';
import {
  AREA_DEPTH,
  areaEdgeRadius,
  areaGeometry,
  areaOutline,
  computeArea,
  lowerChainEnd,
  monotoneSlopes,
  ridge,
  zipper,
} from './area';
import { BAR_HEIGHT_SCALE, PLOT_WIDTH } from './bar';

/*
  Tests del área.

  Los de geometría son los mismos que cazaron los fallos del anillo y que ya
  llevan las barras: nada degenerado, normales que no miran hacia dentro, giro
  de triángulo coherente con la normal, y estanqueidad.
*/

const opts = { height: 0.34, bevel: 0.6 };

describe('computeArea', () => {
  it('reparte los datos de lado a lado y escala como las barras', () => {
    const layout = computeArea([10, 20, 40], opts);

    expect(layout.points).toHaveLength(3);
    expect(layout.points[0].x).toBeCloseTo(-PLOT_WIDTH / 2, 6);
    expect(layout.points[2].x).toBeCloseTo(PLOT_WIDTH / 2, 6);
    // El dato mayor lleva el alto entero que pide style.height, sobre el zócalo.
    expect(layout.points[2].y - layout.plinth).toBeCloseTo(0.34 * BAR_HEIGHT_SCALE, 6);
    // Lineal desde el cero, que está en lo alto del zócalo.
    expect(layout.points[1].y - layout.plinth).toBeCloseTo(
      (layout.points[2].y - layout.plinth) / 2,
      6,
    );
    expect(layout.baseline).toBeCloseTo(layout.plinth, 6);
  });

  it('el zócalo deja sitio a los dos cantos', () => {
    const layout = computeArea([0, 5], { height: 0.34, bevel: 1 });
    expect(layout.plinth).toBeGreaterThan(2 * areaEdgeRadius(1));
  });

  it('los negativos bajan el suelo y la línea de cero queda por encima', () => {
    const layout = computeArea([10, -5], opts);
    expect(layout.baseline).toBeGreaterThan(layout.plinth);
    // El mínimo, en lo alto del zócalo.
    expect(layout.points[1].y).toBeCloseTo(layout.plinth, 6);
  });

  it('los no finitos cuentan como cero y sin datos útiles no hay losa', () => {
    const layout = computeArea([10, Number.NaN, 5], opts);
    expect(layout.points[1].value).toBe(0);
    expect(computeArea([], opts).points).toEqual([]);
    expect(computeArea([0, 0, 0], opts).points).toEqual([]);
    expect(computeArea([1, 2], { height: 0, bevel: 0.6 }).points).toEqual([]);
  });

  it('un solo dato es una losa plana de lado a lado', () => {
    const layout = computeArea([7], opts);
    const crest = ridge(layout.points);
    expect(crest).toHaveLength(2);
    expect(crest[0].x).toBeCloseTo(-PLOT_WIDTH / 2, 6);
    expect(crest[1].x).toBeCloseTo(PLOT_WIDTH / 2, 6);
    expect(crest[0].y).toBeCloseTo(crest[1].y, 6);
  });
});

describe('la curva no se inventa nada', () => {
  it('entre dos datos no sale nunca del rango de esos dos', () => {
    /* Un salto brusco y una meseta: es justo donde un spline cualquiera hace
       barriga o se pasa de largo. */
    const values = [10, 10, 80, 80, 20, 25, 90, 0];
    const layout = computeArea(values, opts);
    const crest = ridge(layout.points);
    const pts = layout.points;

    for (const p of crest) {
      const siguiente = pts.findIndex((q) => q.x > p.x + 1e-9);
      // El último punto no tiene siguiente: es el final del último tramo.
      const i = siguiente === -1 ? pts.length - 2 : Math.max(0, siguiente - 1);
      const lo = Math.min(pts[i].y, pts[i + 1].y);
      const hi = Math.max(pts[i].y, pts[i + 1].y);
      expect(p.y).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(p.y).toBeLessThanOrEqual(hi + 1e-9);
    }
  });

  it('pasa exactamente por cada dato', () => {
    const layout = computeArea([3, 9, 4, 7], opts);
    const crest = ridge(layout.points);
    for (const p of layout.points) {
      const hit = crest.find((c) => Math.abs(c.x - p.x) < 1e-9);
      expect(hit, `sin muestra en x=${p.x}`).toBeDefined();
      expect(hit!.y).toBeCloseTo(p.y, 9);
    }
  });

  it('en un pico o una meseta la pendiente es cero', () => {
    const m = monotoneSlopes([0, 1, 2, 3], [0, 5, 2, 2]);
    expect(m[1]).toBe(0);
    expect(m[2]).toBe(0);
    expect(m[3]).toBe(0);
  });
});

describe('areaGeometry', () => {
  const cases = [
    { name: 'normal', values: [42, 26, 34, 19, 48, 51, 38], bevel: 0.6 },
    { name: 'canto al máximo', values: [42, 26, 34, 19, 48], bevel: 1 },
    { name: 'sin canto', values: [42, 26, 34, 19, 48], bevel: 0 },
    { name: 'empieza y acaba en cero', values: [0, 30, 0], bevel: 0.6 },
    { name: 'con negativos', values: [12, -8, 20, -3], bevel: 0.6 },
    { name: 'dientes de sierra', values: [0, 100, 0, 100, 0, 100, 0, 100, 0], bevel: 1 },
    {
      name: 'muchos datos',
      values: Array.from({ length: 120 }, (_, i) => 50 + 40 * Math.sin(i / 3)),
      bevel: 0.6,
    },
    { name: 'un solo dato', values: [7], bevel: 0.6 },
  ];

  const build = (c: (typeof cases)[number]) => {
    const layout = computeArea(c.values, { height: 0.34, bevel: c.bevel });
    return { layout, geo: areaGeometry(layout) };
  };

  for (const c of cases) {
    it(`no produce nada degenerado (${c.name})`, () => {
      const { geo, layout } = build(c);
      const pos = geo.attributes.position;
      const nrm = geo.attributes.normal;
      const tol = 1e-5;

      expect(pos.count).toBeGreaterThan(0);
      expect(geo.getIndex()!.count % 3).toBe(0);

      for (let i = 0; i < pos.count; i += 1) {
        expect(Number.isFinite(pos.getX(i))).toBe(true);
        expect(Number.isFinite(pos.getY(i))).toBe(true);
        expect(Math.hypot(nrm.getX(i), nrm.getY(i), nrm.getZ(i))).toBeCloseTo(1, 4);
        // Dentro de su hueco: el ancho de la parrilla, el suelo y la cresta.
        expect(Math.abs(pos.getX(i))).toBeLessThanOrEqual(PLOT_WIDTH / 2 + tol);
        expect(pos.getY(i)).toBeGreaterThanOrEqual(-tol);
        expect(pos.getY(i)).toBeLessThanOrEqual(layout.totalHeight + tol);
        expect(Math.abs(pos.getZ(i))).toBeLessThanOrEqual(AREA_DEPTH / 2 + tol);
      }
      geo.dispose();
    });
  }

  it('los triángulos giran en el mismo sentido que sus normales', () => {
    for (const c of cases) {
      const { geo } = build(c);
      expect(trianglesAgainstNormals(geo), `${c.name}: triángulos al revés`).toBe(0);
      geo.dispose();
    }
  });

  it('la superficie está cerrada: cada arista se comparte dos veces', () => {
    for (const c of cases.filter((x) => x.bevel > 0)) {
      const { geo } = build(c);
      const { repetidas, huerfanas } = edgeCheck(geo);
      expect(repetidas.slice(0, 4), `${c.name}: aristas repetidas`).toEqual([]);
      expect(huerfanas.slice(0, 4), `${c.name}: aristas sin pareja`).toEqual([]);
      geo.dispose();
    }
  });
});

describe('la cara de la losa se triangula sin solapes', () => {
  /*
    La geometría orienta cada triángulo de la cara según su giro, así que un
    triángulo plegado NO saldría en el test de normales: se daría la vuelta y
    pasaría. Esto mira la costura directamente: todos los triángulos giran
    igual y sus áreas suman exactamente la del polígono. Si dos se solapan, o
    uno se sale por encima de un valle, la suma se pasa.
  */
  const casos = [
    [42, 26, 34, 19, 48, 51, 38],
    [0, 100, 0, 100, 0, 100, 0],
    [12, -8, 20, -3],
    Array.from({ length: 60 }, (_, i) => 50 + 40 * Math.sin(i / 2)),
  ];

  for (const values of casos) {
    it(`con ${values.length} datos`, () => {
      const layout = computeArea(values, { height: 0.34, bevel: 0.6 });
      const { points } = areaOutline(ridge(layout.points), 0.04);
      const triangles = zipper(points, lowerChainEnd(points));

      let suma = 0;
      let giros = 0;
      for (const [a, b, c] of triangles) {
        const pa = points[a];
        const pb = points[b];
        const pc = points[c];
        const doble = (pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x);
        if (Math.abs(doble) < 1e-12) continue;
        giros += Math.sign(doble);
        suma += Math.abs(doble) / 2;
      }

      let poligono = 0;
      for (let i = 0; i < points.length; i += 1) {
        const p = points[i];
        const q = points[(i + 1) % points.length];
        poligono += p.x * q.y - q.x * p.y;
      }
      poligono = Math.abs(poligono) / 2;

      expect(Math.abs(giros)).toBe(
        triangles.filter(([a, b, c]) => {
          const pa = points[a];
          const pb = points[b];
          const pc = points[c];
          return (
            Math.abs((pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x)) >= 1e-12
          );
        }).length,
      );
      expect(suma).toBeCloseTo(poligono, 6);
    });
  }
});

/** Triángulos cuya normal geométrica contradice la media de sus vértices. */
function trianglesAgainstNormals(geo: BufferGeometry): number {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const idx = geo.getIndex()!;
  let contrarios = 0;

  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t);
    const b = idx.getX(t + 1);
    const c = idx.getX(t + 2);
    const ux = pos.getX(b) - pos.getX(a);
    const uy = pos.getY(b) - pos.getY(a);
    const uz = pos.getZ(b) - pos.getZ(a);
    const vx = pos.getX(c) - pos.getX(a);
    const vy = pos.getY(c) - pos.getY(a);
    const vz = pos.getZ(c) - pos.getZ(a);
    const gx = uy * vz - uz * vy;
    const gy = uz * vx - ux * vz;
    const gz = ux * vy - uy * vx;
    const area = Math.hypot(gx, gy, gz);
    if (area < 1e-10) continue;
    const mx = nrm.getX(a) + nrm.getX(b) + nrm.getX(c);
    const my = nrm.getY(a) + nrm.getY(b) + nrm.getY(c);
    const mz = nrm.getZ(a) + nrm.getZ(b) + nrm.getZ(c);
    if (gx * mx + gy * my + gz * mz < 0) contrarios += 1;
  }
  return contrarios;
}

/** En una malla cerrada y bien orientada, cada arista dirigida sale UNA vez. */
function edgeCheck(geo: BufferGeometry) {
  const pos = geo.attributes.position;
  const idx = geo.getIndex()!;
  const clave = (i: number) =>
    `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},${Math.round(pos.getZ(i) * 1e5)}`;
  const soldado = new Map<string, number>();
  const id: number[] = [];
  for (let i = 0; i < pos.count; i += 1) {
    const k = clave(i);
    if (!soldado.has(k)) soldado.set(k, soldado.size);
    id.push(soldado.get(k)!);
  }

  const aristas = new Map<string, number>();
  for (let t = 0; t < idx.count; t += 3) {
    const v = [id[idx.getX(t)], id[idx.getX(t + 1)], id[idx.getX(t + 2)]];
    if (v[0] === v[1] || v[1] === v[2] || v[2] === v[0]) continue;
    for (let e = 0; e < 3; e += 1) {
      const k = `${v[e]}>${v[(e + 1) % 3]}`;
      aristas.set(k, (aristas.get(k) ?? 0) + 1);
    }
  }

  const repetidas: string[] = [];
  const huerfanas: string[] = [];
  for (const [k, veces] of aristas) {
    if (veces > 1) repetidas.push(k);
    const [from, to] = k.split('>');
    if (!aristas.has(`${to}>${from}`)) huerfanas.push(k);
  }
  return { repetidas, huerfanas };
}
