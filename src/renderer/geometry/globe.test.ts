import { describe, it, expect } from 'vitest';
import {
  GLOBE_RADIUS,
  MARKER_RADIUS_AT_MAX,
  computeMarkers,
  fibonacciSphere,
  landPointsGeometry,
  latLonToVector,
  vectorToLatLon,
} from './globe';
import { isLand, MAP_HEIGHT, MAP_WIDTH } from './globe-map';

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
  });

  it('todo punto queda sobre la esfera', () => {
    for (const [lat, lon] of [
      [40.4, -3.7],
      [-33.9, 151.2],
      [35.7, 139.7],
      [-23.5, -46.6],
      [0, 180],
      [0, -180],
    ]) {
      expect(latLonToVector(lat, lon).length()).toBeCloseTo(GLOBE_RADIUS, 6);
    }
  });
});

describe('vectorToLatLon', () => {
  /* Tiene que ser la inversa EXACTA de latLonToVector: la máscara de tierra se
     consulta con lo que devuelve, así que un signo cambiado dibuja el mundo
     espejado y no da ningún error. */
  it('deshace latLonToVector', () => {
    for (const [lat, lon] of [
      [40.4, -3.7],
      [51.5, -0.1],
      [-33.9, 151.2],
      [35.7, 139.7],
      [-23.5, -46.6],
      [0, 0],
      [60, 90],
      [-60, -90],
    ]) {
      const back = vectorToLatLon(latLonToVector(lat, lon, 1));
      expect(back.lat).toBeCloseTo(lat, 4);
      expect(back.lon).toBeCloseTo(lon, 4);
    }
  });
});

describe('fibonacciSphere', () => {
  it('todos los puntos quedan en la esfera unidad', () => {
    for (const point of fibonacciSphere(500)) {
      expect(point.length()).toBeCloseTo(1, 5);
    }
  });

  it('reparte por igual entre hemisferios, sin amontonar en los polos', () => {
    /* Repartir por latitud/longitud amontonaría los puntos en los polos y en un
       globo que gira eso se ve como dos manchas blancas. */
    const points = fibonacciSphere(2000);
    const north = points.filter((p) => p.y > 0).length;
    expect(north).toBeGreaterThan(900);
    expect(north).toBeLessThan(1100);

    // Ninguna banda de latitud concentra mucho más que su cuota de superficie.
    const nearPole = points.filter((p) => Math.abs(p.y) > 0.9).length;
    expect(nearPole / points.length).toBeLessThan(0.15);
  });
});

describe('máscara de tierra', () => {
  it('acierta en tierra conocida', () => {
    expect(isLand(40.4, -3.7)).toBe(true); // Madrid
    expect(isLand(-14.2, -51.9)).toBe(true); // centro de Brasil
    expect(isLand(23.4, 25.0)).toBe(true); // Sáhara
    expect(isLand(-25.0, 133.0)).toBe(true); // centro de Australia
  });

  it('acierta en mar abierto', () => {
    expect(isLand(0, -140)).toBe(false); // Pacífico
    expect(isLand(-35, -20)).toBe(false); // Atlántico sur
    expect(isLand(-60, 80)).toBe(false); // océano Índico austral
  });

  it('la longitud da la vuelta en vez de salirse', () => {
    expect(isLand(0, 181)).toBe(isLand(0, -179));
    expect(isLand(0, -181)).toBe(isLand(0, 179));
  });

  it('fuera del rango de latitud no revienta', () => {
    expect(isLand(120, 0)).toBe(false);
    expect(isLand(-120, 0)).toBe(false);
  });

  it('la rejilla tiene la resolución que dice', () => {
    expect(MAP_WIDTH).toBe(720);
    expect(MAP_HEIGHT).toBe(360);
  });
});

describe('landPointsGeometry', () => {
  it('solo deja puntos sobre tierra, y son bastantes menos que las muestras', () => {
    const geo = landPointsGeometry(0.5);
    const pos = geo.attributes.position;

    // La tierra es ~29% de la superficie: si saliera el 100%, la máscara no se
    // estaría aplicando.
    expect(pos.count).toBeGreaterThan(1000);

    for (let i = 0; i < pos.count; i += 1) {
      const { lat, lon } = vectorToLatLon(
        latLonToVector(0, 0).set(pos.getX(i), pos.getY(i), pos.getZ(i)),
      );
      expect(isLand(lat, lon)).toBe(true);
    }
    geo.dispose();
  });

  it('más densidad, más puntos', () => {
    const poca = landPointsGeometry(0);
    const mucha = landPointsGeometry(1);
    expect(mucha.attributes.position.count).toBeGreaterThan(
      poca.attributes.position.count * 2,
    );
    poca.dispose();
    mucha.dispose();
  });

  it('con densidad 0 el mapa sigue siendo reconocible', () => {
    // Un globo que no se reconoce no sirve de nada, así que hay suelo.
    expect(landPointsGeometry(0).attributes.position.count).toBeGreaterThan(1200);
  });

  it('acota la densidad fuera de rango en vez de reventar', () => {
    expect(() => landPointsGeometry(-3)).not.toThrow();
    expect(() => landPointsGeometry(9)).not.toThrow();
  });
});

describe('computeMarkers', () => {
  const coords: [number, number][] = [
    [40.4, -3.7],
    [51.5, -0.1],
    [35.7, 139.7],
  ];

  it('el radio va con la RAÍZ del valor, no con el valor', () => {
    /* Lo que el ojo compara en un círculo es el área. Con el radio lineal, un
       dato 4× parecería 16× y la gráfica mentiría. */
    const { markers } = computeMarkers([1, 4, 16], coords, { size: 1 });
    const [a, b, c] = markers.map((m) => m.radius);

    // Quitando el suelo mínimo, las áreas guardan la proporción de los datos.
    const area = (r: number) => Math.pow(r, 2);
    expect(area(c) / area(b)).toBeGreaterThan(area(b) / area(a));
  });

  it('el mayor no pasa del tope y el menor no desaparece', () => {
    const { markers, largest } = computeMarkers([1, 1000], coords, { size: 1 });
    const radios = markers.map((m) => m.radius);

    expect(Math.max(...radios)).toBeCloseTo(MARKER_RADIUS_AT_MAX, 5);
    expect(largest).toBeCloseTo(MARKER_RADIUS_AT_MAX, 5);
    // Suelo: sin él, el dato pequeño queda invisible y parece que falta.
    expect(Math.min(...radios)).toBeGreaterThan(MARKER_RADIUS_AT_MAX * 0.25);
  });

  it('apoyan en la superficie y la normal apunta hacia fuera', () => {
    const { markers } = computeMarkers([10, 40, 25], coords, { size: 0.7 });

    for (const marker of markers) {
      expect(marker.position.length()).toBeGreaterThan(GLOBE_RADIUS);
      expect(marker.normal.length()).toBeCloseTo(1, 6);
      expect(marker.normal.dot(marker.position.clone().normalize())).toBeCloseTo(1, 5);
    }
  });

  it('sin coordenadas no dibuja nada, en vez de inventarse un sitio', () => {
    expect(computeMarkers([10, 20], undefined, { size: 1 }).markers).toEqual([]);
    expect(computeMarkers([10, 20], [], { size: 1 }).markers).toEqual([]);
  });

  it('una etiqueta sin coordenada se salta y las demás siguen bien', () => {
    const { markers } = computeMarkers([10, 20, 30], [[40.4, -3.7]], { size: 1 });
    expect(markers).toHaveLength(1);
    expect(markers[0].index).toBe(0);
  });

  it('ignora negativos y ceros', () => {
    const { markers } = computeMarkers([-5, 40, 0], coords, { size: 1 });
    expect(markers.map((m) => m.index)).toEqual([1]);
  });

  it('las fracciones suman 1', () => {
    const { markers } = computeMarkers([10, 40, 50], coords, { size: 1 });
    expect(markers.reduce((total, m) => total + m.fraction, 0)).toBeCloseTo(1, 6);
  });
});
