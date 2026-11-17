import { BufferGeometry } from 'three';
import { roundedBoxGeometry } from './rounded-box';

/*
  Geometría de las barras. Funciones puras (ADR 0004): entran números, sale un
  BufferGeometry. El sólido lo construye `rounded-box.ts`; aquí está el reparto
  en la parrilla y el cálculo de los radios.

  OCUPA EL MISMO HUECO QUE EL ANILLO
  ----------------------------------
  2 unidades de ancho, centrado en el origen, base en y=0. Así los presets de
  cámara, el suelo y las sombras sirven igual para los dos tipos sin tocar nada.

  Categorías en X y valor en Y. Con varias series, las barras de una categoría
  van AGRUPADAS, una al lado de otra dentro de su celda.

  Antes iban en filas hacia el fondo (eje Z), que es la gráfica 3D de columnas
  de toda la vida y se lee fatal: la fila de delante tapa la de detrás, las
  etiquetas de las dos filas caen unas encima de otras, y comparar la serie A
  con la B obliga a mirar una barra a medias. Agrupadas, las dos barras de una
  categoría están a la misma distancia, a la misma altura de base y de frente.
*/

/**
 * Aire entre barras HERMANAS de un grupo, en fracción del ancho de una barra.
 *
 * Mucho menos que entre categorías a propósito: es lo que hace que el ojo lea
 * «estas dos van juntas» antes que «aquí hay ocho barras».
 */
export const SIBLING_GAP = 0.14;

/**
 * Fondo de una barra agrupada, en anchos de barra.
 *
 * Cuadradas, como las de una sola serie, quedaban como lápices en cuanto había
 * tres series. Un poco más de fondo les devuelve cuerpo sin que el grupo se
 * coma el aire de la celda.
 */
const GROUPED_DEPTH = 1.4;

/** Ancho total de la parrilla. El anillo mide 2 de diámetro: mismo hueco. */
export const PLOT_WIDTH = 2;

/**
 * `style.height` es el mismo campo que el grosor del anillo, así que hay que
 * llevarlo al rango de una barra. Con el default (0,34) la barra más alta mide
 * 1,09, que es lo que encuadra bien con los presets de cámara compartidos.
 */
export const BAR_HEIGHT_SCALE = 3.2;

/**
 * `style.gap` viaja en el rango del anillo (0..0,05 de vuelta). En barras
 * significa "qué fracción de la celda es aire": 0,05 → 0,7 deja el default
 * (0,012) en un 17% de separación, que es donde las barras se leen sueltas sin
 * parecer desperdigadas.
 */
export const BAR_GAP_AT_MAX = 0.7;
const GAP_FIELD_MAX = 0.05;

/**
 * Qué fracción del máximo geométrico alcanza `style.bevel` al tope.
 *
 * El máximo que admite el sólido es la mitad de la dimensión horizontal menor:
 * ahí la barra es un cilindro. Pero una barra es estrecha, así que llevar el
 * campo directo a ese máximo deja el default (0,6) hecho una cápsula, y una
 * cápsula deja de leerse como barra —no se ve dónde acaba—. Con el factor a la
 * mitad, el default es una caja blanda y la cápsula sigue estando disponible
 * subiendo `style.cornerRadius`, que es el campo que existe para eso.
 */
export const BEVEL_AT_MAX = 0.5;

export type Bar = {
  /** Índice en `data.labels`. */
  index: number;
  /** Índice de la serie a la que pertenece. */
  series: number;
  /** Índice con el que elegir color en la paleta. */
  colorIndex: number;
  value: number;
  /** Fracción del total de su serie, 0..1. Para el tooltip. */
  fraction: number;
  /** Centro de la barra en planta. */
  x: number;
  z: number;
  /** Base de la barra. Un valor negativo cuelga por debajo de la línea de cero. */
  y: number;
  height: number;
};

export type BarLayout = {
  bars: Bar[];
  /** Iguales para todas las barras: es lo que hace comparables las alturas. */
  width: number;
  depth: number;
  /** Alto del hueco ocupado, del valor mínimo al máximo. Para encuadrar. */
  totalHeight: number;
  /** Fondo ocupado por todas las series juntas. Para encuadrar. */
  totalDepth: number;
  /** Altura de la línea de cero. 0 cuando no hay valores negativos. */
  baseline: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

const EMPTY: BarLayout = {
  bars: [],
  width: 0,
  depth: 0,
  totalHeight: 0,
  totalDepth: 0,
  baseline: 0,
};

/**
 * Reparte los valores en una parrilla de barras.
 *
 * Casos límite, decididos y no accidentales:
 * - No finito (`NaN`, `null` colado, infinito) cuenta como 0 y no dibuja barra.
 * - Series de distinta longitud: se rellenan con 0 hasta la más larga, así que
 *   un hueco es un hueco y no descuadra las categorías siguientes.
 * - Los negativos SÍ se dibujan, colgando de la línea de cero. Es la diferencia
 *   con el anillo, donde un negativo no significa nada y se descarta.
 * - Todo a cero (o sin datos) no devuelve barras: no hay escala que valga.
 */
export function computeBars(
  series: number[][],
  options: {
    gap: number;
    height: number;
    /**
     * `false` superpone las series en la misma celda en vez de agruparlas. Lo
     * usa la carrera: sus series son PERIODOS que se ven de uno en uno, así
     * que cada uno ocupa la celda entera. Agrupados, el ancho de la barra se
     * dividía entre el número de años y la carrera salía en palillos.
     */
    grouped?: boolean;
  },
): BarLayout {
  const categories = series.reduce((most, values) => Math.max(most, values.length), 0);
  if (categories === 0) return EMPTY;

  const clean = series.map((values) =>
    Array.from({ length: categories }, (_, i) => {
      const value = values[i];
      return Number.isFinite(value) ? value : 0;
    }),
  );

  let min = 0;
  let max = 0;
  for (const values of clean) {
    for (const value of values) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }

  const span = max - min;
  const totalHeight = Math.max(0, options.height) * BAR_HEIGHT_SCALE;
  if (span <= 0 || totalHeight <= 0) return EMPTY;

  const scale = totalHeight / span;
  const baseline = -min * scale;

  const cell = PLOT_WIDTH / categories;
  const air = clamp01(options.gap / GAP_FIELD_MAX) * BAR_GAP_AT_MAX;
  /* Lo que ocupa el grupo de una categoría. Con una serie, el grupo ES la barra. */
  const group = cell * (1 - air);
  const n = clean.length;
  /* «Una barra por celda»: con una serie, o cuando las series no se agrupan. */
  const single = n === 1 || options.grouped === false;

  /* n barras y n−1 huecos de hermanas caben justo en el grupo. */
  const width = single ? group : group / (n + (n - 1) * SIBLING_GAP);
  /* Con una serie, celdas cuadradas. Con varias, algo de fondo extra, sin pasar
     nunca del ancho del grupo. */
  const depth = single ? width : Math.min(group, width * GROUPED_DEPTH);

  const bars: Bar[] = [];

  clean.forEach((values, s) => {
    /* Desplazamiento de la serie dentro de su grupo, desde el centro. */
    const offset = single ? 0 : -group / 2 + width / 2 + s * width * (1 + SIBLING_GAP);

    const total = values.reduce((sum, v) => sum + Math.abs(v), 0);

    values.forEach((value, index) => {
      const height = Math.abs(value) * scale;
      if (height < 1e-4) return;

      bars.push({
        index,
        series: s,
        /* Con una sola serie el color distingue categorías, como en el anillo.
           Con varias, lo que hay que distinguir es la serie. */
        colorIndex: n === 1 ? index : s,
        value,
        fraction: total > 0 ? Math.abs(value) / total : 0,
        x: -PLOT_WIDTH / 2 + cell * (index + 0.5) + offset,
        z: 0,
        y: value >= 0 ? baseline : baseline - height,
        height,
      });
    });
  });

  return { bars, width, depth, totalHeight, totalDepth: depth, baseline };
}

/** Centro en X de la celda de una categoría. Para anclar su etiqueta. */
export function categoryX(index: number, categories: number): number {
  const cell = PLOT_WIDTH / Math.max(1, categories);
  return -PLOT_WIDTH / 2 + cell * (index + 0.5);
}

export type BarRadii = {
  radius: number;
  topRadius: number;
  planRadius: number;
};

/**
 * Radios de canto de una barra.
 *
 * UN SOLO radio en planta para todas, y el vertical acotado por la altura de
 * cada una.
 *
 * En el anillo el canto es único para toda la gráfica: los sectores se tocan y
 * si los perfiles no casan en la junta parece que las piezas se traspasan. Las
 * barras no se tocan, y lo que el ojo compara es la silueta en planta, que aquí
 * es idéntica en todas. Acotar el canto vertical barra a barra evita que una
 * barra diminuta deje sin canto a las demás — que es justo el problema abierto
 * que arrastra el anillo (docs/STATE.md).
 */
export function barRadii(
  height: number,
  layout: Pick<BarLayout, 'width' | 'depth'>,
  style: { bevel: number; cornerRadius: number },
): BarRadii {
  const horizontalLimit = Math.min(layout.width, layout.depth) / 2;
  const base = clamp01(style.bevel) * BEVEL_AT_MAX * horizontalLimit;
  const domed = base + clamp01(style.cornerRadius) * (horizontalLimit - base);

  return {
    radius: Math.min(base, height / 2),
    topRadius: domed,
    /* No depende de la altura a propósito: es lo que mantiene igual la silueta
       en planta de todas las barras. */
    planRadius: Math.max(base, domed),
  };
}

/**
 * Divisiones por cuarto de círculo según cuántas barras haya.
 *
 * Ocho es donde deja de verse la faceta en el canto, igual que en el anillo,
 * pero una barra gasta muchos más triángulos que un sector: con sesenta barras
 * el ahorro se nota y a ese tamaño en pantalla la faceta ya no se ve.
 */
export function cornerSegmentsFor(barCount: number): number {
  if (barCount <= 12) return 8;
  if (barCount <= 40) return 5;
  return 3;
}

export type BarGeometryParams = {
  height: number;
  layout: Pick<BarLayout, 'width' | 'depth'>;
  style: { bevel: number; cornerRadius: number };
  cornerSegments: number;
};

/**
 * Una barra con los cantos redondeados. Base en y=0, centrada en el origen del
 * plano XZ: la coloca quien la usa.
 */
export function barGeometry({
  height,
  layout,
  style,
  cornerSegments,
}: BarGeometryParams): BufferGeometry {
  const radii = barRadii(height, layout, style);

  return roundedBoxGeometry({
    width: layout.width,
    depth: layout.depth,
    height,
    cornerSegments,
    ...radii,
  });
}
