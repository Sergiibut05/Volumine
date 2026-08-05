import { BufferGeometry, BufferAttribute, Vector3 } from 'three';
import { isLand } from './globe-map';

/*
  Globo de puntos. Funciones puras (ADR 0004).

  PLANTEAMIENTO
  -------------
  Tomado de cobe (cobe.vercel.app): la tierra no son contornos vectoriales sino
  una nube de PUNTOS repartidos por la esfera, de la que se quedan los que caen
  sobre tierra firme. Es lo que hace que un globo se reconozca al instante sin
  cargar un mapa.

  Y es lo que hace que quepa. Antes descarté los países por presupuesto y el
  razonamiento era correcto para vectores —el mundo en GeoJSON son 100-200 KB—
  pero equivocado para esto: una máscara de tierra rasterizada a 0,5° son 5 KB
  comprimidos, y se genera en build (ver scripts/build-globe-map.mjs).

  Todos los puntos se dibujan en UNA sola llamada. Los marcadores van aparte,
  porque tienen que responder al ratón.
*/

/** Radio del globo. Mismo hueco que el anillo (2 de diámetro). */
export const GLOBE_RADIUS = 1;

/**
 * Cuántos puntos se reparten por la esfera al máximo de densidad.
 *
 * Solo ~29% caen en tierra, así que de 40.000 muestras salen unos 11.500 puntos
 * dibujados. Por debajo de ~4.000 las penínsulas y las islas desaparecen y el
 * mapa deja de reconocerse; por encima de ~14.000 los puntos se tocan y la
 * silueta se convierte en una mancha.
 */
export const MAX_MAP_SAMPLES = 40000;
const MIN_MAP_SAMPLES = 6000;

/**
 * Reparto uniforme por la esfera con la espiral de Fibonacci.
 *
 * Repartir por latitud y longitud amontonaría los puntos en los polos, y en un
 * globo que gira eso se ve como dos manchas blancas. La espiral da la misma
 * separación en toda la superficie.
 */
export function fibonacciSphere(samples: number): Vector3[] {
  const points: Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const step = 2 / Math.max(1, samples - 1);

  for (let i = 0; i < samples; i += 1) {
    /*
      La espiral reparte igual de bien pero deja una retícula perfecta, y el ojo
      une los vecinos formando brazos en espiral bien visibles: el globo parece
      un disco de vinilo. Se rompe con un desplazamiento pequeño en cada punto.

      El desplazamiento es DETERMINISTA, calculado a partir del índice: con
      `Math.random()` el mismo config daría píxeles distintos en cada carga y se
      caerían el render estático y los tests visuales (CLAUDE.md).
    */
    const y = 1 - i * step + (hash01(i) - 0.5) * step * 0.85;
    const clamped = Math.max(-1, Math.min(1, y));
    const radius = Math.sqrt(Math.max(0, 1 - clamped * clamped));
    const theta = golden * i + (hash01(i + samples) - 0.5) * 0.6;

    points.push(new Vector3(Math.cos(theta) * radius, clamped, Math.sin(theta) * radius));
  }

  return points;
}

/** Ruido determinista en 0..1 a partir de un entero. */
function hash01(i: number): number {
  let x = Math.imul(i + 1, 747796405) + 2891336453;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

/** Punto de la esfera a latitud y longitud, en grados. */
export function vectorToLatLon(point: Vector3): { lat: number; lon: number } {
  const lat = Math.asin(point.y) * (180 / Math.PI);
  /* Ojo con el signo de Z: la escena usa Z negada respecto al ángulo, igual que
     el anillo. `latLonToVector` y esto tienen que ser inversas exactas. */
  const lon = Math.atan2(point.x, point.z) * (180 / Math.PI);
  return { lat, lon };
}

/**
 * Latitud y longitud a un punto de la esfera.
 *
 * El meridiano 0 mira hacia +Z, así que el Atlántico queda de frente en el
 * encuadre por defecto.
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

/**
 * La nube de puntos de tierra, lista para dibujar de una sola vez.
 *
 * `density` va de 0 a 1 y se acota por abajo: con muy pocos puntos el mapa no se
 * reconoce, y un globo que no se reconoce no sirve para nada.
 */
export function landPointsGeometry(density: number): BufferGeometry {
  const clamped = Math.max(0, Math.min(1, density));
  const samples = Math.round(
    MIN_MAP_SAMPLES + (MAX_MAP_SAMPLES - MIN_MAP_SAMPLES) * clamped,
  );

  const positions: number[] = [];
  for (const point of fibonacciSphere(samples)) {
    const { lat, lon } = vectorToLatLon(point);
    if (!isLand(lat, lon)) continue;
    positions.push(point.x, point.y, point.z);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  return geometry;
}

export type Marker = {
  /** Índice en `data.labels`. */
  index: number;
  value: number;
  /** Fracción del total, 0..1. Para el tooltip. */
  fraction: number;
  /** Centro del marcador, ya despegado de la superficie. */
  position: Vector3;
  /** Normal de la superficie ahí. */
  normal: Vector3;
  /** Radio del punto. Proporcional a la RAÍZ del valor: ver abajo. */
  radius: number;
};

export type MarkerLayout = {
  markers: Marker[];
  /** Radio del marcador más grande. Para encuadrar. */
  largest: number;
};

/**
 * Radio del marcador mayor, en radios de globo.
 *
 * El lenguaje de cobe es el PUNTO, no la burbuja: un marcador que ocupa el 10%
 * del globo tapa el país entero y deja de señalar un sitio. Por debajo de 0,02
 * no se distinguen entre sí; por encima de 0,06 dos ciudades del mismo país se
 * solapan y ya no se sabe cuántas hay.
 */
export const MARKER_RADIUS_AT_MAX = 0.042;
const MARKER_RADIUS_MIN_SHARE = 0.3;

const EMPTY: MarkerLayout = { markers: [], largest: 0 };

/**
 * Reparte los valores en marcadores sobre la esfera.
 *
 * El radio va con la RAÍZ del valor, no con el valor: lo que el ojo compara en
 * un círculo es el área, así que un dato del doble tiene que ocupar el doble de
 * superficie, no medir el doble de ancho. Con el radio lineal, un dato 4× parece
 * 16× y la gráfica miente.
 *
 * Casos límite, decididos:
 * - Sin coordenada, esa etiqueta no se dibuja. No se inventa un sitio: poner un
 *   dato en el lugar equivocado de un mapa es peor que no ponerlo.
 * - **(0, 0) cuenta como "sin poner"**. Es una coordenada válida —el golfo de
 *   Guinea— pero es también lo que deja el editor en una fila nueva, y ver
 *   aparecer un punto en mitad del Atlántico al añadir una fila desconcierta
 *   mucho más de lo que ayuda. Un dato real justo ahí es prácticamente
 *   imposible; una fila a medio rellenar, lo normal.
 * - Los negativos se ignoran: un área negativa no existe.
 * - Todo a cero no devuelve marcadores.
 */
export function computeMarkers(
  values: number[],
  coords: [number, number][] | undefined,
  options: { size: number },
): MarkerLayout {
  if (!coords || coords.length === 0) return EMPTY;

  const usable = values
    .map((value, index) => ({
      value: Number.isFinite(value) && value > 0 ? value : 0,
      index,
    }))
    .filter((entry) => {
      const place = coords[entry.index];
      if (entry.value <= 0 || place === undefined) return false;
      // Ver la nota sobre (0, 0) arriba.
      return place[0] !== 0 || place[1] !== 0;
    });

  if (usable.length === 0) return EMPTY;

  const max = usable.reduce((most, entry) => Math.max(most, entry.value), 0);
  const total = usable.reduce((sum, entry) => sum + entry.value, 0);
  if (max <= 0) return EMPTY;

  const largest = Math.max(0, Math.min(1, options.size)) * MARKER_RADIUS_AT_MAX;

  const markers = usable.map(({ value, index }) => {
    const [lat, lon] = coords[index];
    const normal = latLonToVector(lat, lon, 1).normalize();

    /* Suelo del 30%: sin él, el dato más pequeño de un conjunto desigual queda
       en un punto invisible y parece que falta. */
    const share = Math.sqrt(value / max);
    const radius =
      largest * (MARKER_RADIUS_MIN_SHARE + (1 - MARKER_RADIUS_MIN_SHARE) * share);

    return {
      index,
      value,
      fraction: total > 0 ? value / total : 0,
      // Apoyado en la superficie, no hundido ni flotando.
      position: normal.clone().multiplyScalar(GLOBE_RADIUS + radius * 0.35),
      normal,
      radius,
    };
  });

  return { markers, largest };
}
