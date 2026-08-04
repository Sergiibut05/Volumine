import { BufferGeometry, ExtrudeGeometry, MathUtils, Shape, Vector3 } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
 *  1-3. La forma se **encoge** por `bevel` antes de extruir (ver
 *       `sectorGeometry`), así que el sector debe seguir existiendo después de
 *       encogerlo: no más de la mitad del grosor radial, del arco interior ni
 *       de la altura. Con un 90% de margen para no llegar a lo degenerado.
 *  4.   La SEPARACIÓN entre vecinos, ya solo como red de seguridad. Al encoger
 *       la forma primero, el bevel la devuelve al contorno nominal y deja de
 *       comerse el hueco. Queda un error residual porque el encogido angular usa
 *       el radio medio: en el radio interior se queda corto en ~0.3·bevel por
 *       lado. De ahí el techo de 1.2·hueco.
 */
export function maxBevelForSector(sector: Sector, limits: BevelLimits): number {
  const radial = limits.outerR - limits.innerR;
  const arcLen = limits.innerR * (sector.a1 - sector.a0);
  const gapArc = limits.innerR * limits.gapAngle;

  return Math.max(
    0,
    Math.min(radial * 0.45, arcLen * 0.45, limits.depth * 0.45, gapArc * 1.2),
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
  /* 160 por vuelta completa = 2,25° por segmento. El sombreado suave disimula
     el facetado del interior, pero la SILUETA sigue siendo un polígono y en un
     sector grande se nota: por debajo de ~120 se ven los planos en el borde. */
  const forFullCircle = 160 * quality;
  return Math.max(8, Math.ceil((sweep / (Math.PI * 2)) * forFullCircle));
}

/**
 * Sombreado suave en las superficies curvas, manteniendo planas las tapas.
 *
 * `ExtrudeGeometry` produce normales planas: cada faceta del arco y del bevel se
 * ve como una banda. `toCreasedNormals` las promedia donde el ángulo entre caras
 * es pequeño, que es justo lo que queremos en el arco y en el canto.
 *
 * El problema —y por qué el primer intento se descartó— es que también promedia
 * en el borde entre la tapa y el bevel. Como la tapa se trianguliza en abanico,
 * ese error se propaga en estrías radiales por toda la cara superior. La
 * solución es suavizar todo y luego devolver a las tapas su normal exacta: son
 * los vértices que están justo en y=0 y en y=depth.
 */
function smoothCurvedSurfaces(geometry: BufferGeometry, depth: number): BufferGeometry {
  const smooth = toCreasedNormals(geometry, MathUtils.degToRad(60));

  const position = smooth.attributes.position;
  const normal = smooth.attributes.normal;
  const epsilon = 1e-4;

  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i);
    if (Math.abs(y - depth) < epsilon) normal.setXYZ(i, 0, 1, 0);
    else if (Math.abs(y) < epsilon) normal.setXYZ(i, 0, -1, 0);
  }
  normal.needsUpdate = true;

  return smooth;
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
 * El radio máximo queda en `outerR`: la forma se encoge por `bevel` antes de
 * extruir precisamente para que la expansión del bevel la devuelva ahí.
 *
 * Las superficies curvas salen con sombreado suave; las tapas y las caras
 * radiales, planas. Ver `smoothCurvedSurfaces()`.
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

  /*
    Se ENCOGE la forma por `b` antes de extruir.

    ExtrudeGeometry no mete el bevel hacia dentro: expande la franja central
    hacia fuera por `bevelSize`. Si se le pasa el contorno nominal, el sector
    acaba ocupando `b` de más en todas direcciones y se come el hueco con sus
    vecinos, que era lo que producía costuras en las juntas y obligaba a limitar
    el canto a la mitad del hueco.

    Encogiendo primero, la expansión devuelve la geometría exactamente al
    contorno pedido y el hueco se respeta entero. El encogido angular usa el
    radio medio: exacto ahí, con un error pequeño en los extremos.
  */
  const inset = hasBevel ? b : 0;
  const midRadius = (innerR + outerR) / 2;
  const dAngle = inset / midRadius;

  const a0 = sector.a0 + dAngle;
  const a1 = sector.a1 - dAngle;
  const rInner = innerR + inset;
  const rOuter = outerR - inset;

  const shape = new Shape();
  if (a1 > a0 && rOuter > rInner) {
    shape.absarc(0, 0, rOuter, a0, a1, false);
    shape.absarc(0, 0, rInner, a1, a0, true);
  } else {
    // Encogerlo lo dejaría degenerado: se dibuja sin encoger y sin bevel.
    shape.absarc(0, 0, outerR, sector.a0, sector.a1, false);
    shape.absarc(0, 0, innerR, sector.a1, sector.a0, true);
  }
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

  const smooth = smoothCurvedSurfaces(geometry, depth);
  geometry.dispose();
  return smooth;
}

/**
 * Dirección radial media de un sector, EN COORDENADAS DE MUNDO.
 * Para explode, hover y colocar etiquetas.
 *
 * Ojo con el signo de Z. La forma se dibuja en el plano XY y luego se gira -90°
 * sobre X, lo que mapea (x, y, z) → (x, z, -y). Un punto del ángulo θ de la
 * forma, que está en (cos θ, sin θ), acaba en el mundo en (cos θ, 0, -sin θ).
 *
 * Con el signo positivo la dirección sale espejada respecto a la geometría: al
 * separar un sector se mete dentro de un vecino y deja hueco con el otro.
 */
export function sectorDirection(sector: Sector): Vector3 {
  const mid = (sector.a0 + sector.a1) / 2;
  return new Vector3(Math.cos(mid), 0, -Math.sin(mid));
}
