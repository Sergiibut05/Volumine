import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import {
  computeSectors,
  maxBevelForSector,
  globalBevel,
  curveSegmentsFor,
  sectorGeometry,
  sectorDirection,
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
  it('la separación ya NO acota el canto', () => {
    /* Regresión de la refactorización. Con ExtrudeGeometry el canto crecía hacia
       fuera y se comía el hueco con los vecinos, así que había que limitarlo a
       la mitad de la separación. La geometría propia redondea hacia DENTRO: los
       vecinos se separan en vez de acercarse, y la restricción sobra.

       Consecuencia práctica: el canto máximo pasó de ~0.019 a ~0.167 con la
       separación por defecto. Nueve veces más. */
    const [sector] = computeSectors([1], 0.012);
    const conHueco = maxBevelForSector(sector, limits);
    const sinHueco = maxBevelForSector(sector, { ...limits, gapAngle: 0.0001 });
    const conHuecoEnorme = maxBevelForSector(sector, { ...limits, gapAngle: 0.4 });

    expect(sinHueco).toBeCloseTo(conHueco, 6);
    expect(conHuecoEnorme).toBeCloseTo(conHueco, 6);
    expect(conHueco).toBeGreaterThan(0.14);
  });

  it('manda la menor de las tres dimensiones del sólido', () => {
    const [sector] = computeSectors([1], 0.012);
    /* El techo respecto al grosor es 0.42 y no 0.5: por encima, la cara de
       corte plana degenera y el casquete se pliega. Ver clampRounding(). */
    expect(maxBevelForSector(sector, limits)).toBeCloseTo(0.34 * 0.42, 4);
    // Adelgaza el anillo y pasa a mandar el grosor radial.
    expect(maxBevelForSector(sector, { ...limits, innerR: 0.9 })).toBeCloseTo(
      0.1 * 0.45,
      4,
    );
  });

  it('a partir de un sector suficientemente pequeño, manda su propio arco', () => {
    // Por debajo del ~2% el arco interior ya es más restrictivo que el hueco, y
    // ese sector pasa a marcar el bevel de todo el donut. Es el "problema
    // abierto" de docs/STATE.md hecho test: aquí se ve cuándo empieza a doler.
    const [grande, pequeno] = computeSectors([982, 18], 0.012);
    expect(maxBevelForSector(pequeno, limits)).toBeLessThan(
      maxBevelForSector(grande, limits),
    );
  });

  it('un sector estrecho admite menos canto que uno ancho', () => {
    const [grande, pequeno] = computeSectors([90, 10], 0.012);
    expect(maxBevelForSector(pequeno, limits)).toBeLessThan(
      maxBevelForSector(grande, limits),
    );
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

describe('sectorDirection', () => {
  /* La forma se dibuja en XY y se gira -90° sobre X: (x,y,z) → (x, z, -y).
     Si la dirección no lleva ese signo, al separar un sector se mete dentro de
     un vecino y deja hueco con el otro. Pasó, y se veía. */
  it('apunta al centro real del sector en coordenadas de mundo', () => {
    const sectors = computeSectors([25, 25, 25, 25], 0);

    for (const sector of sectors) {
      const mid = (sector.a0 + sector.a1) / 2;
      // Punto del centroide del arco, transformado igual que la geometría.
      const worldX = Math.cos(mid);
      const worldZ = -Math.sin(mid);

      const dir = sectorDirection(sector);
      expect(dir.x).toBeCloseTo(worldX, 6);
      expect(dir.z).toBeCloseTo(worldZ, 6);
      expect(dir.y).toBe(0);
    }
  });

  it('la dirección coincide con dónde está de verdad la geometría', () => {
    // Prueba independiente del cálculo: se compara contra el centro del
    // bounding box real de la malla, que no puede mentir.
    const sectors = computeSectors([50, 30, 20], 0.012);

    for (const sector of sectors) {
      const geo = sectorGeometry({
        sector,
        innerR: 0.55,
        outerR: 1,
        depth: 0.34,
        bevel: 0.02,
        curveSegments: 24,
      });
      geo.computeBoundingBox();
      const center = geo.boundingBox!.getCenter(new Vector3());
      geo.dispose();

      const dir = sectorDirection(sector);
      // Mismo cuadrante: el producto escalar en XZ tiene que ser positivo.
      const dot = dir.x * center.x + dir.z * center.z;
      expect(dot).toBeGreaterThan(0);
    }
  });
});

describe('sectorGeometry', () => {
  const [sector] = computeSectors([1], 0.012);

  it('las tapas conservan la normal plana tras el suavizado', () => {
    const geo = sectorGeometry({
      sector,
      innerR: 0.55,
      outerR: 1,
      depth: 0.34,
      bevel: 0.03,
      curveSegments: 24,
    });
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    let arriba = 0;
    let abajo = 0;

    for (let i = 0; i < pos.count; i += 1) {
      const y = pos.getY(i);
      if (Math.abs(y - 0.34) < 1e-4) {
        expect(nrm.getY(i)).toBeCloseTo(1, 5);
        arriba += 1;
      } else if (Math.abs(y) < 1e-4) {
        expect(nrm.getY(i)).toBeCloseTo(-1, 5);
        abajo += 1;
      }
    }
    expect(arriba).toBeGreaterThan(0);
    expect(abajo).toBeGreaterThan(0);
    geo.dispose();
  });

  it('las superficies curvas sí quedan suavizadas', () => {
    const geo = sectorGeometry({
      sector,
      innerR: 0.55,
      outerR: 1,
      depth: 0.34,
      bevel: 0.03,
      curveSegments: 32,
    });
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;

    // En la pared exterior (a media altura, radio ≈ 1) la normal tiene que ser
    // radial: si fuera plana por faceta, no coincidiría con la posición.
    let comprobados = 0;
    for (let i = 0; i < pos.count && comprobados < 40; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z);
      // La pared recta va de y=bevel a y=depth-bevel y está EXPANDIDA hacia
      // fuera por el bevel, así que su radio es ~1.03, no 1. Y con steps:1 solo
      // hay vértices en sus dos extremos: tampoco vale filtrar por altura media.
      if (r > 1.0 && y > 0.02 && y < 0.32) {
        const dot = (nrm.getX(i) * x + nrm.getZ(i) * z) / r;
        expect(dot).toBeGreaterThan(0.9);
        comprobados += 1;
      }
    }
    expect(comprobados).toBeGreaterThan(0);
    geo.dispose();
  });

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

  it('el encogido previo mantiene el radio dentro de outerR', () => {
    /* ExtrudeGeometry expande la franja central hacia fuera por bevelSize. La
       forma se encoge antes justamente para compensarlo. Este test fija el
       resultado: si una versión de three cambia el comportamiento del bevel,
       nos enteramos aquí y no en producción. */
    const bevel = 0.03;
    const geo = sectorGeometry({
      sector,
      innerR: 0.55,
      outerR: 1,
      depth: 0.34,
      bevel,
      curveSegments: 24,
    });

    const pos = geo.attributes.position;
    let maxR = 0;
    let radioEnTapa = 0;
    for (let i = 0; i < pos.count; i += 1) {
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      maxR = Math.max(maxR, r);
      if (Math.abs(pos.getY(i) - 0.34) < 1e-4) radioEnTapa = Math.max(radioEnTapa, r);
    }

    // La tapa queda encogida por el bevel; la franja central vuelve a outerR.
    expect(radioEnTapa).toBeCloseTo(1 - bevel, 2);
    expect(maxR).toBeGreaterThan(1 - bevel);
    expect(maxR).toBeLessThanOrEqual(1.005);
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

describe('tarta (innerRadius = 0)', () => {
  const pieLimits = { innerR: 0, outerR: OUTER_RADIUS, depth: 0.34, gapAngle: 0.0754 };

  it('admite bevel: medir el arco en innerR lo anulaba por completo', () => {
    // Regresión. innerR=0 hacía que arcLen y gapArc valieran 0, así que el
    // máximo salía 0 y la tarta se renderizaba con aristas vivas.
    const sectors = computeSectors([42, 26, 17, 9, 6], 0.012);
    const bevel = globalBevel(sectors, pieLimits, 1);
    expect(bevel).toBeGreaterThan(0.01);
  });

  it('produce geometría válida y con la altura pedida', () => {
    const sectors = computeSectors([50, 30, 20], 0.012);
    const bevel = globalBevel(sectors, pieLimits, 0.6);

    for (const sector of sectors) {
      const geo = sectorGeometry({
        sector,
        innerR: 0,
        outerR: 1,
        depth: 0.34,
        bevel,
        curveSegments: 24,
      });
      geo.computeBoundingBox();
      expect(geo.boundingBox!.min.y).toBeCloseTo(0, 4);
      expect(geo.boundingBox!.max.y).toBeCloseTo(0.34, 4);
      expect(geo.attributes.position.count).toBeGreaterThan(0);
      geo.dispose();
    }
  });
});

describe('sólido sin defectos (regresión de la refactorización)', () => {
  const cases = [
    { name: 'anillo', innerR: 0.55, depth: 0.34 },
    { name: 'tarta', innerR: 0, depth: 0.34 },
    { name: 'anillo fino', innerR: 0.78, depth: 0.18 },
    { name: 'disco grueso', innerR: 0.2, depth: 0.9 },
  ];

  for (const c of cases) {
    it(`${c.name}: la superficie no se sale del sólido pedido`, () => {
      /* El defecto del bevel anterior era que el contorno desplazado se
         autointersectaba y sobresalía: se veía como un canto arrugado y como
         cortes en las caras laterales. Si vuelve, estos límites saltan. */
      const sectors = computeSectors([42, 26, 17, 9, 6], 0.012);
      const lim = { innerR: c.innerR, outerR: 1, depth: c.depth, gapAngle: 0.0754 };
      const bevel = globalBevel(sectors, lim, 1); // al máximo, que es lo peor

      for (const sector of sectors) {
        const geo = sectorGeometry({
          sector,
          innerR: c.innerR,
          outerR: 1,
          depth: c.depth,
          bevel,
          curveSegments: curveSegmentsFor(sector),
        });
        const pos = geo.attributes.position;

        for (let i = 0; i < pos.count; i += 1) {
          const x = pos.getX(i);
          const y = pos.getY(i);
          const z = pos.getZ(i);
          const r = Math.hypot(x, z);

          expect(r).toBeLessThanOrEqual(1 + 1e-6);
          expect(y).toBeGreaterThanOrEqual(-1e-6);
          expect(y).toBeLessThanOrEqual(c.depth + 1e-6);
          expect(Number.isFinite(r)).toBe(true);
        }
        geo.dispose();
      }
    });

    it(`${c.name}: las normales son unitarias y no hay NaN`, () => {
      const [sector] = computeSectors([1], 0.012);
      const lim = { innerR: c.innerR, outerR: 1, depth: c.depth, gapAngle: 0.0754 };
      const geo = sectorGeometry({
        sector,
        innerR: c.innerR,
        outerR: 1,
        depth: c.depth,
        bevel: globalBevel([sector], lim, 0.8),
        curveSegments: 40,
      });
      const n = geo.attributes.normal;

      for (let i = 0; i < n.count; i += 1) {
        const len = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
        expect(len).toBeCloseTo(1, 4);
      }
      geo.dispose();
    });
  }

  /** Desfase angular de un punto respecto a `a0`, normalizado a (−π, π]. */
  function offsetFrom(a0: number, x: number, z: number): number {
    // La geometría usa Z invertida respecto al ángulo.
    let d = Math.atan2(-z, x) - a0;
    while (d <= -Math.PI) d += Math.PI * 2;
    while (d > Math.PI) d -= Math.PI * 2;
    return d;
  }

  it('el canto redondea la esquina del extremo en vez de morderla', () => {
    /* El casquete va del cuerpo (perfil entero) a la cara de corte (perfil
       encogido por el canto) girando un cuarto de vuelta. Por esos dos puntos
       pasan DOS arcos de radio `bevel`, y el que estaba escrito era el cóncavo:
       cada extremo salía con un mordisco redondo de radio `bevel`, que con el
       canto grueso se veía como un agujero circular en cada junta. Obligaba a
       abrir mucha separación para que no pareciera un error.

       Se mide donde se notaba: a mitad del alcance del casquete, la pared
       exterior tiene que haber recuperado casi todo su radio.
         · redondeo  → hundida 0,13·canto
         · mordisco  → hundida 0,87·canto */
    const innerR = 0.55;
    const bevel = 0.14;
    const [sector] = computeSectors([1], 0.012);
    const geo = sectorGeometry({
      sector,
      innerR,
      outerR: 1,
      depth: 0.34,
      bevel,
      curveSegments: 64,
    });
    const pos = geo.attributes.position;

    // Alcance angular del casquete, medido igual que en la geometría.
    const reach = bevel / ((innerR + 1) / 2);
    let maxR = 0;
    for (let i = 0; i < pos.count; i += 1) {
      const d = offsetFrom(sector.a0, pos.getX(i), pos.getZ(i));
      if (d < reach * 0.4 || d > reach * 0.75) continue;
      maxR = Math.max(maxR, Math.hypot(pos.getX(i), pos.getZ(i)));
    }
    geo.dispose();

    expect(maxR).toBeGreaterThan(0); // que la franja medida no esté vacía
    expect(1 - maxR).toBeLessThan(bevel * 0.25);
  });

  it('ninguna normal mira hacia dentro del sólido', () => {
    /* La componente tangencial de la normal iba con la X al revés: quedaba
       reflejada en el plano X=0, así que era correcta en θ≈0 y estaba del todo
       invertida en θ≈±90°. Las caras de corte miraban hacia dentro del sólido y
       se renderizaban negras — de ahí que los extremos con canto grueso se
       vieran como agujeros. Por eso aquí hay sectores en los cuatro cuadrantes:
       con uno solo, según dónde caiga, el defecto se escapa.

       Comprobación: dar un paso corto EN CONTRA de la normal desde cualquier
       vértice tiene que dejarte dentro del sólido nominal. */
    const step = 1e-3;
    // Las posiciones son Float32Array: por debajo de ~1e-6 es ruido, no defecto.
    const tol = 1e-5;
    const violations: string[] = [];

    for (const c of cases) {
      const lim = { innerR: c.innerR, outerR: 1, depth: c.depth, gapAngle: 0.0754 };
      const sectors = computeSectors([42, 26, 17, 9, 6], 0.012);
      const bevel = globalBevel(sectors, lim, 1);

      for (const sector of sectors) {
        const geo = sectorGeometry({
          sector,
          innerR: c.innerR,
          outerR: 1,
          depth: c.depth,
          bevel,
          curveSegments: curveSegmentsFor(sector),
        });
        const pos = geo.attributes.position;
        const nrm = geo.attributes.normal;
        const sweep = sector.a1 - sector.a0;

        for (let i = 0; i < pos.count; i += 1) {
          const x = pos.getX(i) - nrm.getX(i) * step;
          const y = pos.getY(i) - nrm.getY(i) * step;
          const z = pos.getZ(i) - nrm.getZ(i) * step;
          const r = Math.hypot(x, z);
          const where = `${c.name} sector ${sector.index} vértice ${i}`;

          if (r < c.innerR - tol) violations.push(`${where}: radio ${r}`);
          if (r > 1 + tol) violations.push(`${where}: radio ${r}`);
          if (y < -tol || y > c.depth + tol) violations.push(`${where}: altura ${y}`);
          /* El ángulo solo significa algo lejos del eje: en la punta de una
             tarta, un paso de 1e-3 gira lo que le da la gana. */
          if (r > 0.1) {
            const d = offsetFrom(sector.a0, x, z);
            if (d < -tol || d > sweep + tol) violations.push(`${where}: ángulo ${d}`);
          }
        }
        geo.dispose();
      }
    }

    expect(violations.slice(0, 6)).toEqual([]);
  });

  it('los triángulos giran en el mismo sentido que sus normales', () => {
    /* Con las normales invertidas y el sentido de giro correcto, el defecto no
       se ve negro del todo ni desaparece: se ve mal iluminado, que es más
       difícil de diagnosticar. Este test ata las dos cosas entre sí. */
    const sectors = computeSectors([42, 26, 17, 9, 6], 0.012);
    const lim = { innerR: 0.55, outerR: 1, depth: 0.34, gapAngle: 0.0754 };
    const bevel = globalBevel(sectors, lim, 1);
    let contra = 0;
    let total = 0;

    for (const sector of sectors) {
      const geo = sectorGeometry({
        sector,
        innerR: 0.55,
        outerR: 1,
        depth: 0.34,
        bevel,
        curveSegments: curveSegmentsFor(sector),
      });
      const pos = geo.attributes.position;
      const nrm = geo.attributes.normal;
      const idx = geo.getIndex()!;

      for (let t = 0; t < idx.count; t += 3) {
        const ia = idx.getX(t);
        const ib = idx.getX(t + 1);
        const ic = idx.getX(t + 2);
        const ax = pos.getX(ia);
        const ay = pos.getY(ia);
        const az = pos.getZ(ia);
        const e1 = [pos.getX(ib) - ax, pos.getY(ib) - ay, pos.getZ(ib) - az];
        const e2 = [pos.getX(ic) - ax, pos.getY(ic) - ay, pos.getZ(ic) - az];
        const g = [
          e1[1] * e2[2] - e1[2] * e2[1],
          e1[2] * e2[0] - e1[0] * e2[2],
          e1[0] * e2[1] - e1[1] * e2[0],
        ];
        const len = Math.hypot(g[0], g[1], g[2]);
        // Los triángulos degenerados son los del casquete al colapsar en la
        // esquina: no tienen sentido de giro que comprobar.
        if (len < 1e-10) continue;

        const n = [
          nrm.getX(ia) + nrm.getX(ib) + nrm.getX(ic),
          nrm.getY(ia) + nrm.getY(ib) + nrm.getY(ic),
          nrm.getZ(ia) + nrm.getZ(ib) + nrm.getZ(ic),
        ];
        total += 1;
        if ((g[0] * n[0] + g[1] * n[1] + g[2] * n[2]) / len < 0) contra += 1;
      }
      geo.dispose();
    }

    expect(total).toBeGreaterThan(1000);
    expect(contra).toBe(0);
  });

  it('los sectores no invaden la separación con el canto al máximo', () => {
    /* Antes el canto crecía hacia fuera y dos vecinos se tocaban. Ahora crece
       hacia dentro, así que el hueco angular se respeta siempre. */
    const sectors = computeSectors([50, 50], 0.02);
    const lim = { innerR: 0.55, outerR: 1, depth: 0.34, gapAngle: 0.02 * Math.PI * 2 };
    const bevel = globalBevel(sectors, lim, 1);

    const anglesOf = (i: number) => {
      const geo = sectorGeometry({
        sector: sectors[i],
        innerR: 0.55,
        outerR: 1,
        depth: 0.34,
        bevel,
        curveSegments: 40,
      });
      const pos = geo.attributes.position;
      let min = Infinity;
      let max = -Infinity;
      for (let k = 0; k < pos.count; k += 1) {
        // La geometría usa Z invertida respecto al ángulo.
        const a = Math.atan2(-pos.getZ(k), pos.getX(k));
        min = Math.min(min, a);
        max = Math.max(max, a);
      }
      geo.dispose();
      return { min, max };
    };

    const a = anglesOf(0);
    // Ningún vértice del sector se sale de su rango angular nominal.
    expect(a.min).toBeGreaterThanOrEqual(sectors[0].a0 - 1e-6);
    expect(a.max).toBeLessThanOrEqual(sectors[0].a1 + 1e-6);
  });
});
