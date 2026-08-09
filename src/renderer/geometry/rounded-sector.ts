import { BufferGeometry, BufferAttribute } from 'three';

/*
  Sector anular con canto redondeado, construido a mano.

  POR QUÉ NO ExtrudeGeometry
  --------------------------
  Su bevel desplaza el contorno 2D por la bisectriz de cada vértice. Eso funciona
  en polígonos convexos y falla en el nuestro:

  · El arco INTERIOR es cóncavo. Al desplazar hacia fuera, los puntos convergen
    y acaban cruzándose: el canto sale arrugado como papel de aluminio. Es el
    defecto que se ve en cuanto amplías el borde interior.
  · El desplazamiento crece hacia fuera, así que el sector se come el hueco con
    sus vecinos y hay que limitar el canto a la mitad de la separación.
  · Compensarlo encogiendo la forma antes no funciona: un encogido uniforme no
    es el inverso de un desplazamiento por bisectriz, y la diferencia se ve como
    cortes en las caras laterales.
  · Las normales salen planas y suavizarlas después produce estrías.

  CÓMO SE CONSTRUYE
  -----------------
  Un sector es una "caja con esquinas redondeadas" en coordenadas polares, así
  que se construye como tal:

  1. Un PERFIL: la sección del anillo en el plano (radio, altura), que es un
     rectángulo redondeado. Cada punto lleva su normal exacta.
  2. El perfil se BARRE por el arco del sector.
  3. Cada extremo se cierra con un CASQUETE de cuarto de vuelta que redondea
     también la arista entre la cara de corte y el resto, más la cara de corte
     plana.

  Las normales son analíticas en todos los puntos: no hay nada que promediar, así
  que no hay estrías ni facetas. Y como el redondeo mete la superficie HACIA
  DENTRO, el hueco entre vecinos crece en vez de encogerse: desaparece la
  restricción que obligaba a cantos finos.
*/

export type RoundedSectorParams = {
  /** Ángulo inicial en radianes. */
  a0: number;
  /** Ángulo final en radianes. */
  a1: number;
  innerR: number;
  outerR: number;
  /** Altura total. La base queda en y=0. */
  depth: number;
  /** Radio del canto, en unidades de escena. */
  radius: number;
  /** Divisiones a lo largo del arco. */
  arcSegments: number;
  /** Divisiones de cada cuarto de círculo del canto. */
  cornerSegments: number;
};

type ProfilePoint = {
  /** Radio, en el plano de la sección. */
  r: number;
  /** Altura. */
  y: number;
  /** Normal en el plano de la sección (unitaria). */
  nr: number;
  ny: number;
};

/**
 * Sección del anillo: un rectángulo redondeado en el plano (radio, altura),
 * recorrido en sentido antihorario desde la base interior.
 *
 * Cada punto lleva su normal exacta, que es lo que elimina de raíz el facetado.
 */
function buildProfile(
  innerR: number,
  outerR: number,
  depth: number,
  radius: number,
  cornerSegments: number,
): ProfilePoint[] {
  const points: ProfilePoint[] = [];
  const b = radius;

  /*
    EL CANTO INTERIOR SE ACOTA POR EL RADIO QUE HAY, y esto es lo que separa una
    tarta de una pelota.

    Con el mismo canto dentro y fuera, en una TARTA —donde `innerR` es 0— la
    pared interior se redondeaba contra un radio que no existe: cada porción
    acababa en un morro de radio `b` en el eje, y como todas convergen ahí, los
    morros se sumaban en una BOLA bien visible en el centro. Con dos porciones,
    una grande y una pequeña, era imposible no verla.

    Una porción de tarta acaba en ARISTA, no en morro. Acotando el canto interior
    a `innerR`, en la tarta vale 0 —la punta se cierra sola en el eje— y en un
    anillo normal (`innerR > b`) no cambia absolutamente nada. De paso arregla el
    caso intermedio, un anillo de hueco más pequeño que el canto, donde el perfil
    interior se cruzaba consigo mismo.
  */
  const bIn = Math.min(b, innerR);

  const arco = (
    centerR: number,
    centerY: number,
    from: number,
    to: number,
    skipFirst: boolean,
    r: number,
  ) => {
    /* Sin radio no hay esquina que recorrer: cero pasos deja el perfil pasando
       de largo, que es justo la arista viva que queremos en la punta. */
    const steps = r > 1e-6 ? cornerSegments : 0;
    for (let i = skipFirst ? 1 : 0; i <= steps; i += 1) {
      const angle = from + ((to - from) * i) / steps;
      const nr = Math.cos(angle);
      const ny = Math.sin(angle);
      points.push({ r: centerR + r * nr, y: centerY + r * ny, nr, ny });
    }
  };

  // Base, de dentro hacia fuera.
  points.push({ r: innerR + bIn, y: 0, nr: 0, ny: -1 });
  points.push({ r: outerR - b, y: 0, nr: 0, ny: -1 });

  arco(outerR - b, b, -Math.PI / 2, 0, true, b); // canto inferior exterior
  points.push({ r: outerR, y: depth - b, nr: 1, ny: 0 }); // pared exterior
  arco(outerR - b, depth - b, 0, Math.PI / 2, true, b); // canto superior exterior

  points.push({ r: innerR + bIn, y: depth, nr: 0, ny: 1 }); // cara superior
  arco(innerR + bIn, depth - bIn, Math.PI / 2, Math.PI, true, bIn); // canto sup. interior
  points.push({ r: innerR, y: bIn, nr: -1, ny: 0 }); // pared interior
  arco(innerR + bIn, bIn, Math.PI, Math.PI * 1.5, true, bIn); // canto inf. interior

  return points;
}

/** Desplaza un punto del perfil hacia dentro por su propia normal. */
function shrink(point: ProfilePoint, amount: number): { r: number; y: number } {
  return { r: point.r - point.nr * amount, y: point.y - point.ny * amount };
}

/**
 * Acota el radio del canto.
 *
 * El techo respecto al GROSOR es 0.42, no 0.5, y el motivo es visual, no
 * matemático: la cara de corte plana es el perfil encogido por el radio del
 * canto, así que al acercarse a la mitad del grosor esa cara degenera a una
 * línea, el casquete se convierte en medio cilindro y se pliega sobre sí mismo.
 * En pantalla se ve como un mordisco cóncavo en el centro de cada cara lateral.
 *
 * Con 0.42 siempre queda una banda plana de al menos el 16% del grosor, que es
 * lo que mantiene la cara reconocible como una cara.
 */
function clampRounding(
  requested: number,
  width: number,
  depth: number,
  arcLength: number,
): number {
  return Math.max(0, Math.min(requested, width * 0.45, depth * 0.42, arcLength * 0.42));
}

export function roundedSectorGeometry({
  a0,
  a1,
  innerR,
  outerR,
  depth,
  radius,
  arcSegments,
  cornerSegments,
}: RoundedSectorParams): BufferGeometry {
  /*
    Acotado. Con el redondeo hacia dentro, el único límite real es que el sólido
    siga existiendo: no más de la mitad del grosor radial ni de la altura, y que
    el arco no se cierre sobre sí mismo.
  */
  const width = outerR - innerR;
  /* Radio de referencia para medir el arco. En una tarta `innerR` es 0 y la
     punta converge en el eje: medir ahí daría 0 y anularía el canto. */
  const arcRef = Math.max(innerR, outerR * 0.12);
  const b = clampRounding(radius, width, depth, arcRef * (a1 - a0));

  const profile = buildProfile(innerR, outerR, depth, b, Math.max(1, cornerSegments));
  const m = profile.length;
  const nArc = Math.max(2, arcSegments);
  const nCap = b > 1e-5 ? Math.max(1, cornerSegments) : 0;

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  /**
   * Rejilla de un tramo. `angleAt` y `shrinkAt` describen cómo varía el barrido:
   * en el cuerpo son constantes, y en los casquetes giran un cuarto de vuelta.
   */
  const buildGrid = (
    steps: number,
    angleAt: (t: number) => number,
    shrinkAt: (t: number) => number,
    /** Mezcla la normal del perfil con la tangencial. 0 = perfil, 1 = tangencial. */
    tangentialAt: (t: number) => number,
    tangentSign: number,
  ): number[][] => {
    const grid: number[][] = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const amount = shrinkAt(t);
      const mix = tangentialAt(t);
      const row: number[] = [];

      for (let j = 0; j < m; j += 1) {
        const point = profile[j];
        const moved = shrink(point, amount);
        const theta = angleAt(t);

        /*
          Normal exacta del barrido esférico: en el cuerpo es la del perfil, y en
          el casquete gira hasta ser la de la cara de corte. Sin promediar nada.
        */
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        const radial = Math.cos((mix * Math.PI) / 2);
        const tangential = Math.sin((mix * Math.PI) / 2) * tangentSign;

        /* Ojo con el signo de la X: la componente tangencial va sobre θ̂, que
           con la Z negada es (−sin θ, 0, −cos θ). Con la X al revés la normal
           queda reflejada en el plano X=0 — correcta en θ≈0 e invertida en
           θ≈±90°, así que las caras de corte se renderizan negras. */
        const nx = point.nr * radial * cos - tangential * sin;
        const ny = point.ny * radial;
        const nz = -(point.nr * radial * sin) - tangential * cos;
        const len = Math.hypot(nx, ny, nz) || 1;

        positions.push(moved.r * cos, moved.y, -moved.r * sin);
        normals.push(nx / len, ny / len, nz / len);
        row.push(positions.length / 3 - 1);
      }
      grid.push(row);
    }
    return grid;
  };

  /*
    OJO CON EL SENTIDO DE LOS TRIÁNGULOS.

    Las posiciones se construyen con Z negada respecto al ángulo
    (`-r·sin θ`), para que el sector caiga donde lo espera el resto del
    renderer. Esa negación **invierte la orientación**: el sentido de giro que
    sería correcto en un sistema normal deja aquí todas las caras del revés, y
    el sólido se ve hueco, como una bandeja.

    Por eso cada tramo se cose con el sentido contrario al que pediría la
    intuición. Las normales, que se calculan aparte y de forma analítica, sí son
    correctas: por eso el defecto se ve iluminado y no negro.
  */
  const stitch = (grid: number[][], flip: boolean) => {
    for (let i = 0; i < grid.length - 1; i += 1) {
      for (let j = 0; j < m; j += 1) {
        const k = (j + 1) % m;
        const a = grid[i][j];
        const bb = grid[i][k];
        const c = grid[i + 1][k];
        const d = grid[i + 1][j];
        if (flip) indices.push(a, c, bb, a, d, c);
        else indices.push(a, bb, c, a, c, d);
      }
    }
  };

  /*
    Rebaje angular del cuerpo: CONSTANTE, calculado en el radio medio.

    Lo obvio sería `b / radio_local`, que da un rebaje tangencial exactamente
    igual en toda la pieza. Pero entonces el rebaje es mucho mayor en el radio
    interior que en el exterior y **la cara de corte deja de ser plana**: se
    curva, y en la esquina interior superior aparece una muesca.

    Una porción de tarta tiene las caras de corte planas y pasando por el eje.
    Eso pesa más que tener el radio del canto matemáticamente constante, así que
    se mide en el radio medio y se acepta que el canto sea un pelo más grueso
    por dentro y más fino por fuera. La diferencia no se ve; la muesca sí.
  */
  const midRadius = (innerR + outerR) / 2;
  const bodyInset = () => b / Math.max(midRadius, 1e-4);

  const body = buildGrid(
    nArc,
    (t) => {
      const inset = bodyInset();
      const start = a0 + inset;
      const end = a1 - inset;
      return start + (end - start) * t;
    },
    () => 0,
    () => 0,
    1,
  );
  stitch(body, true);

  if (nCap > 0) {
    /*
      Casquete: del borde del cuerpo a la cara de corte plana.

      OJO CON CUÁL DE LOS DOS CUARTOS DE CIRCUNFERENCIA ES.

      Llama `g` al avance angular desde la cara de corte (medido en arco) y `w`
      a lo que se hunde el perfil. El casquete va de (g=b, w=0) —donde empieza
      el cuerpo, con el perfil entero— a (g=0, w=b) —la cara de corte, con el
      perfil encogido. Por esos dos puntos pasan DOS arcos de radio b, y solo
      uno redondea:

      · Centro en (b, b), dentro del material: `g = b(1−sin τ)`, `w = b(1−cos τ)`.
        Pasa por (0,29b, 0,29b), abraza la esquina y quita 0,21·b² de material.
        Es el redondeo de toda la vida, convexo.
      · Centro en (0, 0), que es la esquina viva: `g = b·cos τ`, `w = b·sin τ`.
        Pasa por (0,71b, 0,71b) y quita 0,79·b² — casi cuatro veces más — con la
        superficie CÓNCAVA.

      El segundo es el que estaba escrito: cada extremo salía con un mordisco
      redondo de radio b, que con el canto grueso se veía como un agujero
      circular en cada junta y obligaba a abrir mucha separación. Las normales,
      en cambio, ya estaban calculadas para el arco bueno (`mix` gira un cuarto
      de vuelta de la normal del perfil a la de la cara de corte), y por eso el
      sombreado no delataba del todo la forma.
    */
    /** Fracción de `bodyInset` que queda por recorrer. */
    const capSweep = (t: number) => 1 - Math.sin((t * Math.PI) / 2);
    const capSink = (t: number) => b * (1 - Math.cos((t * Math.PI) / 2));

    const capStart = buildGrid(
      nCap,
      (t) => a0 + bodyInset() * capSweep(t),
      capSink,
      (t) => t,
      -1,
    );
    stitch(capStart, false);

    const capEnd = buildGrid(
      nCap,
      (t) => a1 - bodyInset() * capSweep(t),
      capSink,
      (t) => t,
      1,
    );
    stitch(capEnd, true);

    // Las caras de corte planas, en abanico desde su centroide.
    fillCutFace(capStart[nCap], a0, -1);
    fillCutFace(capEnd[nCap], a1, 1);
  } else {
    fillCutFace(body[0], a0, -1);
    fillCutFace(body[nArc], a1, 1);
  }

  function fillCutFace(ring: number[], theta: number, sign: number) {
    let sumR = 0;
    let sumY = 0;
    for (let j = 0; j < m; j += 1) {
      const moved = shrink(profile[j], nCap > 0 ? b : 0);
      sumR += moved.r;
      sumY += moved.y;
    }
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    // Normal de la cara: sign·θ̂ = sign·(−sin θ, 0, −cos θ). Misma X invertida
    // que en buildGrid, y por el mismo motivo.
    const nx = -sign * sin;
    const nz = -sign * cos;

    positions.push((sumR / m) * cos, sumY / m, -(sumR / m) * sin);
    normals.push(nx, 0, nz);
    const center = positions.length / 3 - 1;

    for (let j = 0; j < m; j += 1) {
      const k = (j + 1) % m;
      if (sign < 0) indices.push(center, ring[j], ring[k]);
      else indices.push(center, ring[k], ring[j]);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setIndex(indices);
  return geometry;
}

/**
 * Máximo canto admisible para un sector.
 *
 * Con la geometría propia solo quedan tres límites, y los tres son "que el
 * sólido siga existiendo". La restricción del hueco entre vecinos **desapareció**:
 * el redondeo mete la superficie hacia dentro, así que separa a los vecinos en
 * vez de acercarlos. Por eso ahora se pueden pedir cantos mucho más gruesos con
 * la misma separación.
 */
export function maxRoundingFor({
  innerR,
  outerR,
  depth,
  sweep,
}: {
  innerR: number;
  outerR: number;
  depth: number;
  sweep: number;
}): number {
  const width = outerR - innerR;
  const arcRef = Math.max(innerR, outerR * 0.12);
  return clampRounding(Infinity, width, depth, arcRef * sweep);
}
