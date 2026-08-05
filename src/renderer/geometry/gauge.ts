import type { Sector } from './donut';

/*
  Reparto angular del medidor. Puro: entran números, salen ángulos. La
  construcción del sólido es la MISMA que la del anillo (`sectorGeometry`), y
  esa es toda la gracia de este tipo: no hay geometría nueva que mantener, solo
  otra forma de repartir el arco.

  DÓNDE ESTÁ EL HUECO
  -------------------
  El arco se centra abajo, así que con el default de 270° empieza abajo a la
  izquierda y acaba abajo a la derecha. No es decoración: es lo que convierte el
  dibujo en un medidor. Un anillo entero no tiene principio ni final visibles y
  el ojo lo lee como un donut de un solo trozo — «cuánto hay», no «cuánto llevo
  de lo que puede haber». El hueco es el que dice dónde está el cero.

  LA DIFERENCIA DE FONDO CON EL ANILLO
  ------------------------------------
  En un anillo el total lo pone la suma: cada trozo es una parte del todo y
  mover un valor cambia el tamaño de TODOS los demás. Aquí el total lo pone
  `max`, que es fijo. Subir un valor solo engorda su trozo y encoge el hueco
  vacío. Por eso el medidor puede quedarse a medias y el anillo no.
*/

export type GaugeParams = {
  /** Tope de la escala. Se da por bueno: parse.ts ya garantiza que es > 0. */
  max: number;
  /** Cuántos grados abarca el arco. */
  sweepDegrees: number;
  /** Separación entre trozos, en vueltas completas. Igual que en el anillo. */
  gapTurns: number;
};

export type GaugeLayout = {
  /** Un sector por valor, en orden. Los que no caben no salen. */
  sectors: Sector[];
  /** Lo que falta para llegar a `max`. `null` si está lleno. */
  track: Sector | null;
  /** Suma de los valores positivos. Es la cifra grande del centro. */
  total: number;
  /** Cuánto del arco está lleno, 0..1. Para la animación de entrada. */
  progress: number;
  /** La suma se pasa de `max`: el arco se llenó y sobró dato. */
  overflow: boolean;
};

/**
 * Dónde arranca el arco para que el hueco quede centrado abajo.
 *
 * EL SIGNO IMPORTA Y NO ES EL QUE PARECE. La geometría construye el ángulo θ en
 * (cos θ, 0, −sin θ), y el eje Z de mundo apunta HACIA la cámara, o sea hacia
 * abajo en pantalla. Al componer las dos cosas, θ acaba siendo el ángulo de toda
 * la vida sobre la pantalla: `cos` a la derecha y `sin` ARRIBA. Así que −π/2 es
 * abajo, y crecer el ángulo gira en sentido ANTIHORARIO.
 *
 * Un medidor se llena en sentido horario, que es hacia donde crecen las cosas
 * para cualquiera que haya visto un reloj. O sea, hacia ángulos que DECRECEN: el
 * arco se recorre desde aquí hacia atrás.
 */
function startAngle(sweep: number): number {
  return -Math.PI / 2 - (Math.PI * 2 - sweep) / 2;
}

/**
 * Reparte los valores a lo largo del arco.
 *
 * Los negativos cuentan como 0 (parse.ts ya avisa). Todo a cero es válido y
 * devuelve solo el fondo: «0 de 100» es una lectura buena, no un error.
 */
export function computeGauge(values: number[], params: GaugeParams): GaugeLayout {
  const { max, sweepDegrees, gapTurns } = params;
  const sweep = (Math.min(360, Math.max(30, sweepDegrees)) * Math.PI) / 180;
  const from = startAngle(sweep);
  const to = from - sweep;

  const positive = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = positive.reduce((sum, v) => sum + v, 0);
  const overflow = total > max;

  /*
    Al pasarse no se recorta el último trozo ni se sale del arco: se reparte el
    arco entero en proporción, que es lo que mantiene legible la comparación
    entre trozos. Que se ha pasado lo dice la cifra del centro, que sigue siendo
    la de verdad, y el aviso del parseo.
  */
  const scale = overflow ? total : max;
  const progress = scale > 0 ? Math.min(1, total / scale) : 0;

  const gapAngle = gapTurns * Math.PI * 2;
  const sectors: Sector[] = [];
  let angle = from;

  /*
    El arco se recorre hacia ángulos DECRECIENTES (ver `startAngle`), pero cada
    sector se entrega con `a0 < a1` porque es lo que espera la geometría. Por eso
    aquí `a1` es el borde por el que se entra al trozo y `a0` por el que se sale,
    al revés de lo que dicen los nombres en el anillo.
  */
  positive.forEach((value, index) => {
    const share = scale > 0 ? (value / scale) * sweep : 0;
    /* Media separación por lado, como en el anillo, salvo en los extremos del
       arco: el primer trozo tiene que empezar justo en el cero de la escala y
       el fondo tiene que morir justo en el tope. Meterlos hacia dentro dejaría
       el medidor visualmente corto por los dos lados. */
    const a1 = index === 0 ? angle : angle - gapAngle / 2;
    const a0 = angle - share + gapAngle / 2;
    angle -= share;
    if (a1 > a0) sectors.push({ index, a0, a1, fraction: value / scale });
  });

  const rest = angle - to;
  const track =
    rest > gapAngle
      ? {
          index: -1,
          a0: to,
          a1: angle - gapAngle / 2,
          fraction: rest / sweep,
        }
      : null;

  return { sectors, track, total, progress, overflow };
}
