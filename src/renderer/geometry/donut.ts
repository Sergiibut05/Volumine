import { BufferGeometry, ExtrudeGeometry, Shape, Vector3 } from 'three';

/*
  Geometría del donut/pie. Funciones puras: entran números, sale un
  BufferGeometry. Sin React, sin escena, sin estado — así se puede testear y
  memoizar (ADR 0004).

  Casi todos los números de este archivo salieron de mirar píxeles en
  prototypes/donut.html, no de razonar. Ver docs/STATE.md.
*/

/** Radio exterior en unidades de escena. Todo lo demás es relativo a esto. */
export const OUTER_RADIUS = 1;

export type Sector = {
  index: number;
  /** Ángulo inicial en radianes, ya con la separación descontada. */
  a0: number;
  /** Ángulo final en radianes, ya con la separación descontada. */
  a1: number;
  /** Fracción del total, 0..1. Para etiquetas y porcentajes. */
  fraction: number;
};

/**
 * Reparte los valores en sectores angulares.
 *
 * Arranca arriba (-90°) y va en sentido horario, que es lo que espera cualquiera
 * que haya visto una gráfica de tarta. Los sectores más finos que la propia
 * separación se descartan: dibujarlos daría geometría degenerada.
 */
export function computeSectors(values: number[], gapTurns: number): Sector[] {
  const positive = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = positive.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return [];

  const gapAngle = gapTurns * Math.PI * 2;
  const sectors: Sector[] = [];
  let angle = -Math.PI / 2;

  positive.forEach((value, index) => {
    const sweep = (value / total) * Math.PI * 2;
    const a0 = angle + gapAngle / 2;
    const a1 = angle + sweep - gapAngle / 2;
    angle += sweep;
    if (a1 > a0) sectors.push({ index, a0, a1, fraction: value / total });
  });

  return sectors;
}

export type BevelLimits = {
  innerR: number;
  outerR: number;
  depth: number;
  gapAngle: number;
};

/**
 * Máximo bevel absoluto admisible para un sector. Cuatro restricciones, las
 * cuatro descubiertas viendo artefactos en pantalla:
 *
 *  1-3. Por encima de ~45% de la menor de sus tres dimensiones (grosor radial,
 *       arco interior, altura) el contorno se autointersecta.
 *  4.   Aunque el sector aguante por sí solo, si el bevel se acerca al tamaño de
 *       la SEPARACIÓN entre vecinos, los cantos redondeados quedan tan juntos
 *       que la junta se lee como una costura sucia.
 */
export function maxBevelForSector(sector: Sector, limits: BevelLimits): number {
  const radial = limits.outerR - limits.innerR;
  const arcLen = limits.innerR * (sector.a1 - sector.a0);
  const gapArc = limits.innerR * limits.gapAngle;

  return Math.max(
    0,
    Math.min(radial * 0.45, arcLen * 0.45, limits.depth * 0.45, gapArc * 0.85),
  );
}

/**
 * UN SOLO bevel para todo el donut, el mínimo admisible entre todos los sectores.
 *
 * Calcularlo por sector daba al segmento del 42% un canto del doble de grueso
 * que al del 6%: en la junta los perfiles no casan y visualmente parece que las
 * piezas se traspasan. Fue el defecto más evidente del primer prototipo.
 *
 * Contrapartida conocida y sin resolver: un sector diminuto deja a todo el donut
 * casi sin canto. Ver "Problemas abiertos" en docs/STATE.md.
 */
export function globalBevel(
  sectors: Sector[],
  limits: BevelLimits,
  bevelRatio: number,
): number {
  if (sectors.length === 0) return 0;
  const limit = Math.min(...sectors.map((s) => maxBevelForSector(s, limits)));
  return Math.max(0, Math.min(1, bevelRatio)) * limit;
}

/**
 * Cuántos segmentos necesita el arco de un sector.
 *
 * Medido en el prototipo: con 64 y con 24 el resultado es idéntico a simple
 * vista, y 24 gasta 3× menos geometría; por debajo de ~14 se ve el polígono en
 * la silueta exterior. Aquí se escala con el ángulo, porque un sector del 6% no
 * necesita los mismos segmentos que uno del 42%.
 */
export function curveSegmentsFor(sector: Sector, quality = 1): number {
  const sweep = sector.a1 - sector.a0;
  const forFullCircle = 96 * quality;
  return Math.max(6, Math.ceil((sweep / (Math.PI * 2)) * forFullCircle));
}

export type SectorGeometryParams = {
  sector: Sector;
  innerR: number;
  outerR: number;
  depth: number;
  /** Bevel absoluto, ya calculado con globalBevel(). */
  bevel: number;
  curveSegments: number;
};

/**
 * Sector anular extruido con el canto redondeado. El rasgo de marca.
 *
 * Devuelve la geometría con la base en y=0 y creciendo hacia +Y, centrada en el
 * origen del plano XZ.
 *
 * Nota sobre normales: se dejan planas a propósito. Se probó `toCreasedNormals`
 * y fue peor — mezcla las normales del bevel con las de la tapa y, como la tapa
 * se trianguliza en abanico, propaga estrías radiales por toda la cara superior.
 * Lo que sí funciona es subir `bevelSegments` hasta que las facetas no se vean.
 */
export function sectorGeometry({
  sector,
  innerR,
  outerR,
  depth,
  bevel,
  curveSegments,
}: SectorGeometryParams): BufferGeometry {
  const b = Math.max(0, Math.min(bevel, depth / 2 - 0.001));
  const hasBevel = b > 0.0005;

  const shape = new Shape();
  shape.absarc(0, 0, outerR, sector.a0, sector.a1, false);
  shape.absarc(0, 0, innerR, sector.a1, sector.a0, true);
  shape.closePath();

  const geometry = new ExtrudeGeometry(shape, {
    curveSegments,
    steps: 1,
    depth: Math.max(0.001, depth - b * 2),
    bevelEnabled: hasBevel,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: 0,
    bevelSegments: 12,
  });

  // Extruido en +Z desde z=0. Con bevel el sólido ocupa z ∈ [-b, depth-b], así
  // que su centro está en depth/2 - b, no en depth/2.
  geometry.translate(0, 0, b - depth / 2);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, depth / 2, 0);

  return geometry;
}

/** Dirección radial media de un sector. Para explode, hover y colocar etiquetas. */
export function sectorDirection(sector: Sector): Vector3 {
  const mid = (sector.a0 + sector.a1) / 2;
  return new Vector3(Math.cos(mid), 0, Math.sin(mid));
}
