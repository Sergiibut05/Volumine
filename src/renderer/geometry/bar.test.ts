import { describe, it, expect } from 'vitest';
import {
  computeBars,
  barGeometry,
  barRadii,
  cornerSegmentsFor,
  BAR_HEIGHT_SCALE,
  PLOT_WIDTH,
} from './bar';
import { roundedBoxGeometry } from './rounded-box';

/*
  Tests de la geometría de barras.

  Las tres últimas comprobaciones son las que cazaron los dos fallos del anillo
  —normales invertidas y giro de triángulo inconsistente— y aquí están desde el
  principio, más una de estanqueidad que el anillo no puede tener porque sus
  extremos son caras abiertas y la barra es un sólido cerrado.
*/

const style = { bevel: 0.6, cornerRadius: 0.2 };

describe('computeBars', () => {
  it('reparte las categorías en X y centra la parrilla en el origen', () => {
    const { bars, width } = computeBars([[10, 20, 30, 40]], { gap: 0.012, height: 0.34 });

    expect(bars).toHaveLength(4);
    const cell = PLOT_WIDTH / 4;
    expect(bars[0].x).toBeCloseTo(-PLOT_WIDTH / 2 + cell / 2, 6);
    expect(bars[3].x).toBeCloseTo(PLOT_WIDTH / 2 - cell / 2, 6);
    // Simétrica respecto al centro.
    expect(bars[0].x + bars[3].x).toBeCloseTo(0, 6);
    expect(width).toBeLessThan(cell);
  });

  it('la barra más alta mide lo que dice style.height', () => {
    const { bars, totalHeight } = computeBars([[5, 10]], { gap: 0.012, height: 0.5 });

    expect(totalHeight).toBeCloseTo(0.5 * BAR_HEIGHT_SCALE, 6);
    expect(Math.max(...bars.map((b) => b.height))).toBeCloseTo(totalHeight, 6);
    // Y la mitad de valor, la mitad de alto: la escala es lineal desde cero.
    expect(bars[0].height).toBeCloseTo(bars[1].height / 2, 6);
  });

  it('las series se separan en Z y comparten la escala', () => {
    const { bars, depth } = computeBars(
      [
        [10, 20],
        [20, 40],
      ],
      { gap: 0.012, height: 0.34 },
    );

    expect(bars).toHaveLength(4);
    const zs = [...new Set(bars.map((b) => b.z))];
    expect(zs).toHaveLength(2);
    expect(zs[0] + zs[1]).toBeCloseTo(0, 6);
    expect(depth).toBeGreaterThan(0);

    // Misma escala para las dos series: 40 es el máximo y se lleva el alto entero.
    const alto = new Map(bars.map((b) => [`${b.series}:${b.index}`, b.height]));
    expect(alto.get('0:1')).toBeCloseTo(alto.get('1:1')! / 2, 6);
  });

  it('con una serie el color va por categoría; con varias, por serie', () => {
    const una = computeBars([[1, 2, 3]], { gap: 0.012, height: 0.34 });
    expect(una.bars.map((b) => b.colorIndex)).toEqual([0, 1, 2]);

    const varias = computeBars(
      [
        [1, 2],
        [3, 4],
      ],
      { gap: 0.012, height: 0.34 },
    );
    expect(varias.bars.filter((b) => b.series === 0).every((b) => b.colorIndex === 0)).toBe(
      true,
    );
    expect(varias.bars.filter((b) => b.series === 1).every((b) => b.colorIndex === 1)).toBe(
      true,
    );
  });

  it('los negativos cuelgan de la línea de cero, no se descartan', () => {
    const { bars, baseline, totalHeight } = computeBars([[10, -5]], {
      gap: 0.012,
      height: 0.34,
    });

    expect(bars).toHaveLength(2);
    // El hueco va de −5 a 10: la línea de cero está a un tercio de la base.
    expect(baseline).toBeCloseTo(totalHeight / 3, 6);
    expect(bars[0].y).toBeCloseTo(baseline, 6);
    expect(bars[0].height).toBeCloseTo((totalHeight * 2) / 3, 6);
    // La negativa arranca por debajo y llega justo al cero.
    expect(bars[1].y).toBeCloseTo(0, 6);
    expect(bars[1].y + bars[1].height).toBeCloseTo(baseline, 6);
  });

  it('los ceros y los valores no finitos no dibujan barra', () => {
    const { bars } = computeBars([[10, 0, Number.NaN, Number.POSITIVE_INFINITY, 5]], {
      gap: 0.012,
      height: 0.34,
    });

    expect(bars.map((b) => b.index)).toEqual([0, 4]);
  });

  it('las series de distinta longitud se rellenan con ceros sin descuadrar', () => {
    const { bars } = computeBars([[10, 20, 30], [5]], { gap: 0.012, height: 0.34 });

    const segunda = bars.filter((b) => b.series === 1);
    expect(segunda).toHaveLength(1);
    expect(segunda[0].index).toBe(0);
    // La primera categoría de cada serie cae en la misma X.
    expect(segunda[0].x).toBeCloseTo(bars.find((b) => b.series === 0)!.x, 6);
  });

  it('sin datos útiles no hay barras', () => {
    expect(computeBars([], { gap: 0.012, height: 0.34 }).bars).toEqual([]);
    expect(computeBars([[0, 0]], { gap: 0.012, height: 0.34 }).bars).toEqual([]);
    expect(computeBars([[1, 2]], { gap: 0.012, height: 0 }).bars).toEqual([]);
  });

  it('más separación deja la barra más estrecha, nunca negativa', () => {
    const junto = computeBars([[1, 2]], { gap: 0, height: 0.34 });
    const suelto = computeBars([[1, 2]], { gap: 0.05, height: 0.34 });

    expect(junto.width).toBeCloseTo(PLOT_WIDTH / 2, 6);
    expect(suelto.width).toBeLessThan(junto.width);
    expect(suelto.width).toBeGreaterThan(0);
  });
});

describe('barRadii', () => {
  const layout = { width: 0.4, depth: 0.4 };

  it('el canto al máximo llega a la mitad del límite geométrico, no al límite', () => {
    /* El límite del sólido es 0,2 (media anchura), y ahí la barra es un
       cilindro. `bevel` se queda a medio camino a propósito: al tope tiene que
       seguir leyéndose como barra. Al cilindro se llega con `cornerRadius`. */
    const { radius, planRadius } = barRadii(1, layout, { bevel: 1, cornerRadius: 0 });
    expect(radius).toBeCloseTo(0.1, 6);
    expect(planRadius).toBeCloseTo(0.1, 6);

    const capsula = barRadii(1, layout, { bevel: 1, cornerRadius: 1 });
    expect(capsula.planRadius).toBeCloseTo(0.2, 6);
  });

  it('una barra baja recorta su canto vertical pero no el de planta', () => {
    const alta = barRadii(1, layout, style);
    const baja = barRadii(0.05, layout, style);

    expect(baja.radius).toBeCloseTo(0.025, 6);
    expect(baja.radius).toBeLessThan(alta.radius);
    // La silueta en planta es lo que compara el ojo: idéntica en las dos.
    expect(baja.planRadius).toBeCloseTo(alta.planRadius, 6);
  });

  it('cornerRadius al máximo abomba la punta hasta la media caña', () => {
    const plano = barRadii(1, layout, { bevel: 0.4, cornerRadius: 0 });
    const domo = barRadii(1, layout, { bevel: 0.4, cornerRadius: 1 });

    expect(domo.topRadius).toBeCloseTo(0.2, 6);
    expect(domo.topRadius).toBeGreaterThan(plano.topRadius);
    // Abombar la punta arrastra la planta: si no, la tapa se daría la vuelta.
    expect(domo.planRadius).toBeCloseTo(domo.topRadius, 6);
  });
});

describe('cornerSegmentsFor', () => {
  it('baja las divisiones cuando hay muchas barras', () => {
    expect(cornerSegmentsFor(5)).toBe(8);
    expect(cornerSegmentsFor(30)).toBe(5);
    expect(cornerSegmentsFor(120)).toBe(3);
  });
});

describe('barGeometry', () => {
  const layout = { width: 0.33, depth: 0.33 };
  const cases = [
    { name: 'normal', height: 1.09, style },
    { name: 'punta abombada', height: 1.09, style: { bevel: 0.6, cornerRadius: 1 } },
    { name: 'canto al máximo', height: 1.09, style: { bevel: 1, cornerRadius: 1 } },
    { name: 'sin canto', height: 1.09, style: { bevel: 0, cornerRadius: 0 } },
    { name: 'barra baja', height: 0.02, style },
    { name: 'barra altísima', height: 4, style },
  ];

  for (const c of cases) {
    it(`no produce nada degenerado (${c.name})`, () => {
      const geo = barGeometry({
        height: c.height,
        layout,
        style: c.style,
        cornerSegments: 8,
      });
      const pos = geo.attributes.position;
      const nrm = geo.attributes.normal;

      expect(pos.count).toBeGreaterThan(0);
      expect(geo.getIndex()!.count % 3).toBe(0);

      for (let i = 0; i < pos.count; i += 1) {
        expect(Number.isFinite(pos.getX(i))).toBe(true);
        expect(Number.isFinite(pos.getY(i))).toBe(true);
        expect(Number.isFinite(pos.getZ(i))).toBe(true);
        expect(Math.hypot(nrm.getX(i), nrm.getY(i), nrm.getZ(i))).toBeCloseTo(1, 4);
      }
      geo.dispose();
    });
  }

  it('cabe en su celda y en su altura', () => {
    for (const c of cases) {
      const geo = barGeometry({
        height: c.height,
        layout,
        style: c.style,
        cornerSegments: 8,
      });
      const pos = geo.attributes.position;
      const tol = 1e-5;

      for (let i = 0; i < pos.count; i += 1) {
        expect(Math.abs(pos.getX(i))).toBeLessThanOrEqual(layout.width / 2 + tol);
        expect(Math.abs(pos.getZ(i))).toBeLessThanOrEqual(layout.depth / 2 + tol);
        expect(pos.getY(i)).toBeGreaterThanOrEqual(-tol);
        expect(pos.getY(i)).toBeLessThanOrEqual(c.height + tol);
      }
      geo.dispose();
    }
  });

  it('ninguna normal mira hacia dentro del sólido', () => {
    /* Misma comprobación que en el anillo, y por el mismo motivo: una normal
       invertida no se ve en la silueta, se ve en el sombreado, y solo desde
       algunos ángulos. Dar un paso corto EN CONTRA de la normal tiene que
       dejarte dentro del sólido nominal. */
    const step = 1e-3;
    const tol = 1e-5;
    const violations: string[] = [];

    for (const c of cases) {
      const radii = barRadii(c.height, layout, c.style);
      const geo = barGeometry({
        height: c.height,
        layout,
        style: c.style,
        cornerSegments: 8,
      });
      const pos = geo.attributes.position;
      const nrm = geo.attributes.normal;
      const hx = layout.width / 2;
      const hz = layout.depth / 2;

      for (let i = 0; i < pos.count; i += 1) {
        const x = pos.getX(i) - nrm.getX(i) * step;
        const y = pos.getY(i) - nrm.getY(i) * step;
        const z = pos.getZ(i) - nrm.getZ(i) * step;
        const where = `${c.name} vértice ${i}`;

        if (y < -tol || y > c.height + tol) violations.push(`${where}: altura ${y}`);
        // Dentro del rectángulo redondeado en planta.
        const dx = Math.max(Math.abs(x) - (hx - radii.planRadius), 0);
        const dz = Math.max(Math.abs(z) - (hz - radii.planRadius), 0);
        if (Math.hypot(dx, dz) > radii.planRadius + tol) {
          violations.push(`${where}: fuera de la planta`);
        }
      }
      geo.dispose();
    }

    expect(violations.slice(0, 6)).toEqual([]);
  });

  it('los triángulos giran en el mismo sentido que sus normales', () => {
    /* Si el giro y la normal no coinciden, el material a una cara descarta justo
       los triángulos que se ven. Se compara la normal geométrica del triángulo
       con la media de las de sus vértices. */
    for (const c of cases) {
      const geo = barGeometry({
        height: c.height,
        layout,
        style: c.style,
        cornerSegments: 8,
      });
      const pos = geo.attributes.position;
      const nrm = geo.attributes.normal;
      const idx = geo.getIndex()!;
      let contrarios = 0;

      for (let t = 0; t < idx.count; t += 3) {
        const a = idx.getX(t);
        const b = idx.getX(t + 1);
        const cc = idx.getX(t + 2);

        const ux = pos.getX(b) - pos.getX(a);
        const uy = pos.getY(b) - pos.getY(a);
        const uz = pos.getZ(b) - pos.getZ(a);
        const vx = pos.getX(cc) - pos.getX(a);
        const vy = pos.getY(cc) - pos.getY(a);
        const vz = pos.getZ(cc) - pos.getZ(a);

        const gx = uy * vz - uz * vy;
        const gy = uz * vx - ux * vz;
        const gz = ux * vy - uy * vx;
        const area = Math.hypot(gx, gy, gz);
        // Los triángulos de área nula (canto 0) no tienen sentido de giro.
        if (area < 1e-9) continue;

        const mx = (nrm.getX(a) + nrm.getX(b) + nrm.getX(cc)) / 3;
        const my = (nrm.getY(a) + nrm.getY(b) + nrm.getY(cc)) / 3;
        const mz = (nrm.getZ(a) + nrm.getZ(b) + nrm.getZ(cc)) / 3;

        if ((gx * mx + gy * my + gz * mz) / area < 0) contrarios += 1;
      }
      geo.dispose();

      expect(contrarios, `${c.name}: ${contrarios} triángulos al revés`).toBe(0);
    }
  });

  it('la superficie está cerrada: cada arista se comparte dos veces', () => {
    /* Una barra es un sólido cerrado, así que se puede exigir estanqueidad: en
       una malla cerrada y bien orientada cada arista dirigida aparece UNA vez.
       Caza a la vez agujeros entre la banda y las tapas y triángulos girados.

       Los vértices se sueldan por posición porque la banda y las tapas repiten
       los del borde, que es lo correcto: comparten sitio pero no normal.

       Se descartan los triángulos degenerados, y no son un defecto: cuando el
       radio de la punta iguala al de planta —que es el caso normal— la esquina
       es un octante de esfera, y un octante tiene POLO. Ahí la fila de la malla
       colapsa en un punto, igual que en el polo de una esfera UV. Los triángulos
       que sobreviven forman un abanico correcto alrededor del polo.

       Sin canto (`bevel: 0`) colapsa además la arista vertical entera, y eso sí
       deja la comprobación sin sentido: ese caso se excluye. */
    for (const c of cases.filter((x) => x.style.bevel > 0)) {
      const geo = barGeometry({
        height: c.height,
        layout,
        style: c.style,
        cornerSegments: 6,
      });
      const pos = geo.attributes.position;
      const idx = geo.getIndex()!;

      const clave = (i: number) =>
        `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},${Math.round(
          pos.getZ(i) * 1e5,
        )}`;
      const soldado = new Map<string, number>();
      const id: number[] = [];
      for (let i = 0; i < pos.count; i += 1) {
        const k = clave(i);
        if (!soldado.has(k)) soldado.set(k, soldado.size);
        id.push(soldado.get(k)!);
      }

      const aristas = new Map<string, number>();
      let reales = 0;
      for (let t = 0; t < idx.count; t += 3) {
        const v = [id[idx.getX(t)], id[idx.getX(t + 1)], id[idx.getX(t + 2)]];
        if (v[0] === v[1] || v[1] === v[2] || v[2] === v[0]) continue;
        reales += 1;
        for (let e = 0; e < 3; e += 1) {
          aristas.set(
            `${v[e]}>${v[(e + 1) % 3]}`,
            (aristas.get(`${v[e]}>${v[(e + 1) % 3]}`) ?? 0) + 1,
          );
        }
      }
      expect(reales, `${c.name}: sin triángulos que medir`).toBeGreaterThan(100);

      const repetidas: string[] = [];
      const huerfanas: string[] = [];
      for (const [k, veces] of aristas) {
        if (veces > 1) repetidas.push(k);
        const [from, to] = k.split('>');
        if (!aristas.has(`${to}>${from}`)) huerfanas.push(k);
      }

      expect(repetidas.slice(0, 4), `${c.name}: aristas repetidas`).toEqual([]);
      expect(huerfanas.slice(0, 4), `${c.name}: aristas sin pareja`).toEqual([]);
      geo.dispose();
    }
  });
});

describe('roundedBoxGeometry', () => {
  it('acota los radios que no caben en lugar de reventar', () => {
    const geo = roundedBoxGeometry({
      width: 0.3,
      depth: 0.3,
      height: 0.1,
      radius: 5,
      topRadius: 5,
      planRadius: 5,
      cornerSegments: 4,
    });
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i += 1) {
      expect(Number.isFinite(pos.getX(i))).toBe(true);
      expect(pos.getY(i)).toBeGreaterThanOrEqual(-1e-5);
      expect(pos.getY(i)).toBeLessThanOrEqual(0.1 + 1e-5);
      expect(Math.abs(pos.getX(i))).toBeLessThanOrEqual(0.15 + 1e-5);
    }
    geo.dispose();
  });
});
