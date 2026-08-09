import { BufferGeometry, Vector3 } from 'three';
import { roundedSectorGeometry, maxRoundingFor } from './rounded-sector';

/*
  Geometría del donut/pie. Funciones puras: entran números, sale un
  BufferGeometry. Sin React, sin escena, sin estado — así se puede testear y
  memoizar (ADR 0004).

  La construcción del sólido vive en `rounded-sector.ts`. Aquí solo está el
  reparto de sectores y el cálculo del canto.
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
  /** Se conserva por compatibilidad; ya no restringe. Ver abajo. */
  gapAngle: number;
};

/**
 * Máximo canto admisible para un sector.
 *
 * Tres límites, y los tres son "que el sólido siga existiendo": no más de la
 * mitad del grosor radial, de la altura, ni del arco interior.
 *
 * La restricción del hueco entre vecinos **ya no existe**. Con la geometría
 * propia el redondeo mete la superficie HACIA DENTRO, así que separa a los
 * vecinos en lugar de acercarlos. Antes hacía falta porque el bevel de
 * ExtrudeGeometry expandía el contorno hacia fuera y se comía la separación.
 */
export function maxBevelForSector(sector: Sector, limits: BevelLimits): number {
  return maxRoundingFor({
    innerR: limits.innerR,
    outerR: limits.outerR,
    depth: limits.depth,
    sweep: sector.a1 - sector.a0,
  });
}

/**
 * UN SOLO canto para todo el donut, el mínimo admisible entre todos los sectores.
 *
 * Calcularlo por sector daba al segmento del 42% un canto del doble de grueso
 * que al del 6%: en la junta los perfiles no casan y visualmente parece que las
 * piezas se traspasan.
 *
 * Contrapartida conocida: un sector diminuto reduce el canto de todos los demás.
 * Ver "Problemas abiertos" en docs/STATE.md.
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
 * Medido: 160 por vuelta completa (2,25° por segmento) es donde deja de verse
 * el polígono en la silueta. Escala con el ángulo porque un sector del 6% no
 * necesita los mismos que uno del 42%.
 */
export function curveSegmentsFor(sector: Sector, quality = 1): number {
  const sweep = sector.a1 - sector.a0;
  const forFullCircle = 160 * quality;
  return Math.max(8, Math.ceil((sweep / (Math.PI * 2)) * forFullCircle));
}

export type SectorGeometryParams = {
  sector: Sector;
  innerR: number;
  outerR: number;
  depth: number;
  /** Canto absoluto, ya calculado con globalBevel(). */
  bevel: number;
  curveSegments: number;
};

/**
 * Sector anular con el canto redondeado. El rasgo de marca.
 *
 * Base en y=0, creciendo hacia +Y, centrado en el origen del plano XZ. Normales
 * analíticas: no hay nada que suavizar después.
 */
export function sectorGeometry({
  sector,
  innerR,
  outerR,
  depth,
  bevel,
  curveSegments,
}: SectorGeometryParams): BufferGeometry {
  /*
    `innerR` se pasa tal cual, también cuando es 0.

    En una tarta la punta converge en el eje: el perfil llega a radio 0 y el
    sector acaba EN ARISTA. Antes se forzaba aquí un radio interior mínimo
    proporcional al canto para evitar geometría degenerada, y con el canto grueso
    eso dejaba un agujero bien visible en el centro — la tarta parecía un anillo
    de agujero pequeño.

    Que la punta se cierre en condiciones es cosa de `rounded-sector.ts`, que
    acota el canto INTERIOR por el radio interior disponible. Sin eso, cada
    porción acababa en un morro de radio `b` sobre el eje y todos los morros
    juntos formaban una bola en el centro de la tarta.
  */
  return roundedSectorGeometry({
    a0: sector.a0,
    a1: sector.a1,
    innerR,
    outerR,
    depth,
    radius: bevel,
    arcSegments: curveSegments,
    // Ocho tramos por cuarto de círculo: por debajo se ve la faceta en el canto
    // cuando el redondeo es grueso.
    cornerSegments: 8,
  });
}

/**
 * Dirección radial media de un sector, EN COORDENADAS DE MUNDO.
 * Para explode, hover y colocar etiquetas.
 *
 * Ojo con el signo de Z: la geometría se construye con Z invertida respecto al
 * ángulo, así que el ángulo θ cae en (cos θ, 0, −sin θ). Con el signo positivo
 * la dirección sale espejada y al separar un sector se mete dentro de un vecino.
 */
export function sectorDirection(sector: Sector): Vector3 {
  const mid = (sector.a0 + sector.a1) / 2;
  return new Vector3(Math.cos(mid), 0, -Math.sin(mid));
}
