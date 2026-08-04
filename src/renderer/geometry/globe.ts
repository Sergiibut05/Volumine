import { BufferGeometry, BufferAttribute, Vector3 } from 'three';

/*
  Globo. Funciones puras (ADR 0004).

  QUÉ TIENE Y QUÉ NO, Y POR QUÉ
  -----------------------------
  Esfera + retícula de meridianos y paralelos + una barra por dato, levantada
  sobre su coordenada. **No hay contornos de países.**

  No es un olvido, es el presupuesto. `/embed` tiene 180 KB y ya gasta 134: el
  mundo en GeoJSON, aun simplificado a lo bruto, son 100-200 KB, y una textura de
  mapa decente otro tanto. Cualquiera de las dos cosas sola revienta el
  presupuesto, que es la regla 1 de CLAUDE.md.

  La retícula sí sale gratis porque se calcula: son senos y cosenos.

  Consecuencia honesta: este globo sirve para "dónde pasa algo y cuánto", que es
  la pregunta de la tarjeta. No sirve para "qué país es este". Si algún día hace
  falta lo segundo, el sitio es una capa aparte que se carga con `import()` y
  solo cuando el config la pide, nunca en el bundle base.
*/

/** Radio del globo. Mismo hueco que el anillo (2 de diámetro). */
export const GLOBE_RADIUS = 1;

/**
 * Latitud y longitud a un punto de la esfera.
 *
 * Convención de la escena: Y es arriba, y la Z va negada respecto al ángulo,
 * igual que en el anillo (ver `sectorDirection`). El meridiano 0 mira hacia +Z,
 * así que el Atlántico queda de frente en el encuadre por defecto.
 */
export function latLonToVector(lat: number, lon: number, radius = GLOBE_RADIUS): Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = lon * (Math.PI / 180);

  return new Vector3(
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.cos(theta),
  );
}

export type Marker = {
  /** Índice en `data.labels`. */
  index: number;
  value: number;
  /** Fracción del total, 0..1. Para el tooltip. */
  fraction: number;
  /** Dónde apoya la barra, ya sobre la superficie. */
  position: Vector3;
  /** Normal de la superficie ahí: hacia dónde crece la barra. */
  normal: Vector3;
  height: number;
};

export type MarkerLayout = {
  markers: Marker[];
  /** Lado de la base de todas las barras. Igual en todas: son comparables. */
  footprint: number;
  /** Alto de la barra más alta. Para encuadrar. */
  tallest: number;
};

/**
 * Cuánto sobresale del globo la barra del valor máximo, en radios.
 *
 * Medido a ojo pero con criterio: por debajo de 0,35 las diferencias no se
 * aprecian sobre la curvatura, y por encima de 0,8 las barras del hemisferio
 * visible tapan las del fondo y la silueta deja de leerse como un globo.
 */
export const MARKER_HEIGHT_AT_MAX = 0.55;

/** Lado de la base, en radios. Suficiente para verse, sin fundirse con la vecina. */
const MARKER_FOOTPRINT = 0.055;

const EMPTY: MarkerLayout = { markers: [], footprint: MARKER_FOOTPRINT, tallest: 0 };

/**
 * Reparte los valores en barras sobre la esfera.
 *
 * Casos límite, decididos:
 * - Sin coordenadas para una etiqueta, esa etiqueta no se dibuja. No se inventa
 *   un sitio: poner un dato en el lugar equivocado de un mapa es peor que no
 *   ponerlo.
 * - Los negativos se ignoran. Una barra que se hunde hacia el centro de la
 *   Tierra no significa nada y además queda oculta por la propia esfera.
 * - Todo a cero no devuelve barras: no hay escala.
 */
export function computeMarkers(
  values: number[],
  coords: [number, number][] | undefined,
  options: { height: number },
): MarkerLayout {
  if (!coords || coords.length === 0) return EMPTY;

  const usable = values
    .map((value, index) => ({
      value: Number.isFinite(value) && value > 0 ? value : 0,
      index,
    }))
    .filter((entry) => entry.value > 0 && coords[entry.index] !== undefined);

  if (usable.length === 0) return EMPTY;

  const max = usable.reduce((most, entry) => Math.max(most, entry.value), 0);
  const total = usable.reduce((sum, entry) => sum + entry.value, 0);
  if (max <= 0) return EMPTY;

  /* `style.height` es el mismo campo que el grosor del anillo (0,05..1), así que
     se lleva al rango de una barra sobre el globo. */
  const tallest = Math.max(0, options.height) * MARKER_HEIGHT_AT_MAX * 2;

  const markers = usable.map(({ value, index }) => {
    const [lat, lon] = coords[index];
    const normal = latLonToVector(lat, lon, 1).normalize();
    const height = (value / max) * tallest;

    return {
      index,
      value,
      fraction: total > 0 ? value / total : 0,
      /* Un pelo dentro de la superficie: si la base apoya exactamente en el
         radio, la curvatura deja ver un hilo de fondo bajo cada esquina. */
      position: normal.clone().multiplyScalar(GLOBE_RADIUS - 0.01),
      normal,
      height,
    };
  });

  return { markers, footprint: MARKER_FOOTPRINT, tallest };
}

/**
 * Retícula de meridianos y paralelos, como segmentos de línea.
 *
 * Se calcula, no se descarga: son senos y cosenos, y es lo que permite tener un
 * globo reconocible sin gastar un solo KB del presupuesto en datos de mapa.
 *
 * Los polos no llevan paralelo (sería un punto) y el paso divide 180 y 360 para
 * que la retícula cierre.
 */
export function graticuleGeometry({
  radius = GLOBE_RADIUS * 1.001,
  stepDegrees = 20,
  arcSegments = 72,
}: {
  radius?: number;
  stepDegrees?: number;
  arcSegments?: number;
} = {}): BufferGeometry {
  const points: number[] = [];
  const step = Math.max(5, stepDegrees);

  const pushSegment = (a: Vector3, b: Vector3) => {
    points.push(a.x, a.y, a.z, b.x, b.y, b.z);
  };

  // Meridianos: de polo a polo.
  for (let lon = -180; lon < 180; lon += step) {
    for (let i = 0; i < arcSegments; i += 1) {
      const lat0 = -90 + (180 * i) / arcSegments;
      const lat1 = -90 + (180 * (i + 1)) / arcSegments;
      pushSegment(latLonToVector(lat0, lon, radius), latLonToVector(lat1, lon, radius));
    }
  }

  // Paralelos, sin los polos.
  for (let lat = -90 + step; lat < 90; lat += step) {
    for (let i = 0; i < arcSegments; i += 1) {
      const lon0 = -180 + (360 * i) / arcSegments;
      const lon1 = -180 + (360 * (i + 1)) / arcSegments;
      pushSegment(latLonToVector(lat, lon0, radius), latLonToVector(lat, lon1, radius));
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(points), 3));
  return geometry;
}
