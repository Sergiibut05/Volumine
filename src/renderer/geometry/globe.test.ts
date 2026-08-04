import { describe, it, expect } from 'vitest';
import { GLOBE_RADIUS, computeMarkers, graticuleGeometry, latLonToVector } from './globe';

describe('latLonToVector', () => {
  it('los polos caen en el eje Y', () => {
    const north = latLonToVector(90, 0);
    const south = latLonToVector(-90, 0);

    expect(north.y).toBeCloseTo(GLOBE_RADIUS, 6);
    expect(Math.hypot(north.x, north.z)).toBeCloseTo(0, 6);
    expect(south.y).toBeCloseTo(-GLOBE_RADIUS, 6);
  });

  it('el meridiano 0 en el ecuador mira hacia +Z', () => {
    const point = latLonToVector(0, 0);
    expect(point.z).toBeCloseTo(GLOBE_RADIUS, 6);
    expect(point.x).toBeCloseTo(0, 6);
    expect(point.y).toBeCloseTo(0, 6);
  });

  it('todo punto queda sobre la esfera', () => {
    for (const [lat, lon] of [
      [40.4, -3.7], // Madrid
      [-33.9, 151.2], // Sídney
      [35.7, 139.7], // Tokio
      [-23.5, -46.6], // São Paulo
      [0, 180],
      [0, -180],
    ]) {
      expect(latLonToVector(lat, lon).length()).toBeCloseTo(GLOBE_RADIUS, 6);
    }
  });

  it('longitudes opuestas caen en lados opuestos', () => {
    const a = latLonToVector(20, 30);
    const b = latLonToVector(20, 30 - 180);
    expect(a.x).toBeCloseTo(-b.x, 6);
    expect(a.z).toBeCloseTo(-b.z, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
  });
});

describe('computeMarkers', () => {
  const coords: [number, number][] = [
    [40.4, -3.7],
    [51.5, -0.1],
    [35.7, 139.7],
  ];

  it('la barra más alta corresponde al valor máximo', () => {
    const { markers, tallest } = computeMarkers([10, 40, 25], coords, { height: 0.5 });
    const top = markers.reduce((a, b) => (a.value > b.value ? a : b));

    expect(markers).toHaveLength(3);
    expect(top.height).toBeCloseTo(tallest, 6);
  });

  it('las barras apoyan en la superficie y crecen hacia fuera', () => {
    const { markers } = computeMarkers([10, 40, 25], coords, { height: 0.5 });

    for (const marker of markers) {
      // Un pelo por dentro para que no se vea el fondo bajo la base.
      expect(marker.position.length()).toBeLessThan(GLOBE_RADIUS);
      expect(marker.position.length()).toBeGreaterThan(GLOBE_RADIUS - 0.05);
      expect(marker.normal.length()).toBeCloseTo(1, 6);
      // La normal apunta hacia fuera desde donde apoya.
      expect(marker.normal.dot(marker.position.clone().normalize())).toBeCloseTo(1, 5);
    }
  });

  it('sin coordenadas no dibuja nada, en vez de inventarse un sitio', () => {
    expect(computeMarkers([10, 20], undefined, { height: 0.5 }).markers).toEqual([]);
    expect(computeMarkers([10, 20], [], { height: 0.5 }).markers).toEqual([]);
  });

  it('una etiqueta sin coordenada se salta, y las demás siguen bien colocadas', () => {
    // Poner un dato en el sitio equivocado de un mapa es peor que no ponerlo.
    const parcial: [number, number][] = [[40.4, -3.7]];
    const { markers } = computeMarkers([10, 20, 30], parcial, { height: 0.5 });

    expect(markers).toHaveLength(1);
    expect(markers[0].index).toBe(0);
  });

  it('ignora los negativos: una barra hacia el centro de la Tierra no se ve', () => {
    const { markers } = computeMarkers([-5, 40, 25], coords, { height: 0.5 });
    expect(markers.map((m) => m.index)).toEqual([1, 2]);
  });

  it('todo a cero no devuelve barras', () => {
    expect(computeMarkers([0, 0, 0], coords, { height: 0.5 }).markers).toEqual([]);
  });

  it('las fracciones suman 1', () => {
    const { markers } = computeMarkers([10, 40, 50], coords, { height: 0.5 });
    const sum = markers.reduce((total, m) => total + m.fraction, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it('todas las barras tienen la misma base: son comparables', () => {
    const { markers, footprint } = computeMarkers([1, 99, 40], coords, { height: 0.5 });
    expect(markers.length).toBe(3);
    expect(footprint).toBeGreaterThan(0);
  });
});

describe('graticuleGeometry', () => {
  it('todos sus puntos están sobre la esfera', () => {
    const geo = graticuleGeometry({ stepDegrees: 30, arcSegments: 12 });
    const pos = geo.attributes.position;

    expect(pos.count).toBeGreaterThan(0);
    for (let i = 0; i < pos.count; i += 1) {
      const r = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i));
      expect(r).toBeCloseTo(GLOBE_RADIUS * 1.001, 3);
    }
    geo.dispose();
  });

  it('los segmentos van de dos en dos', () => {
    const geo = graticuleGeometry({ stepDegrees: 45, arcSegments: 8 });
    expect(geo.attributes.position.count % 2).toBe(0);
    geo.dispose();
  });

  it('un paso más fino da más líneas', () => {
    const grueso = graticuleGeometry({ stepDegrees: 45, arcSegments: 8 });
    const fino = graticuleGeometry({ stepDegrees: 15, arcSegments: 8 });

    expect(fino.attributes.position.count).toBeGreaterThan(
      grueso.attributes.position.count,
    );
    grueso.dispose();
    fino.dispose();
  });
});
