import { BufferGeometry, Float32BufferAttribute, Vector2 } from 'three';
import { BAR_HEIGHT_SCALE, PLOT_WIDTH } from './bar';

/*
  Geometría del ÁREA. Funciones puras (ADR 0004): entran números, sale un
  BufferGeometry.

  Una losa: el perfil sigue los datos de izquierda a derecha y se extruye hacia
  el fondo con los cantos redondeados, como las barras. Ocupa el mismo hueco que
  ellas —2 de ancho, base en y=0— para que encuadre, suelo y sombras sirvan
  igual sin tocar nada.

  ── LA CURVA NO PUEDE INVENTARSE NADA ──────────────────────────────────────

  Se suaviza con interpolación cúbica MONÓTONA (Fritsch–Carlson), no con un
  spline cualquiera. Un Catmull-Rom pasa por los puntos, pero entre dos puntos
  iguales hace una barriga y antes de un salto se pasa de largo: dibuja picos y
  valles que no están en los datos. La monótona no sale nunca del rango de sus
  dos vecinos, así que lo que se ve entre dos meses está siempre entre esos dos
  valores.

  ── EL ZÓCALO ─────────────────────────────────────────────────────────────

  La losa arranca sobre un zócalo fino, y el cero de los datos está en lo alto
  del zócalo. No es adorno: los cantos redondeados se comen `r` por arriba y `r`
  por abajo, y donde el dato es casi cero no queda losa entre los dos — la cara
  frontal se daría la vuelta y se cortaría consigo misma. Con un zócalo de al
  menos 2r, la geometría es válida para CUALQUIER dato, y como desplaza todos los
  valores lo mismo, no cambia ninguna comparación.

  ── EL SÓLIDO ─────────────────────────────────────────────────────────────

  Es una extrusión con canto redondeado de un contorno 2D cerrado: el propio
  perfil, las dos paredes laterales y la base, con las esquinas redondeadas.
  Se escribe a mano y no con `ExtrudeGeometry` porque aquella no sabe dar
  normales suaves a lo largo de la curva: o deja la cresta facetada, o al
  fundir vértices difumina también las esquinas de la base.
*/

/** Fondo de la losa. Como una barra de las de por defecto: mismo peso. */
export const AREA_DEPTH = 0.36;

/** Radio de canto máximo, en fracción del medio fondo. Ver `areaEdgeRadius`. */
const EDGE_AT_MAX = 0.32;

/** Holgura del zócalo por encima de los dos cantos. */
const PLINTH_EXTRA = 0.015;

/** Muestras de la curva entre dos datos. Ver `samplesPerSegment`. */
const MAX_SAMPLES = 16;
const MIN_SAMPLES = 3;

/** Divisiones de cada cuarto de canto. Las mismas que una barra. */
const ARC_SEGMENTS = 6;

/** El radio del canto de la losa para un `style.bevel` dado. */
export function areaEdgeRadius(bevel: number): number {
  return Math.max(0, Math.min(1, bevel)) * EDGE_AT_MAX * (AREA_DEPTH / 2);
}

export type AreaPoint = {
  /** Índice en `data.labels`. */
  index: number;
  value: number;
  /** Posición del dato en el perfil: X y altura de la cresta. */
  x: number;
  y: number;
};

export type AreaLayout = {
  points: AreaPoint[];
  /** Alto del zócalo: donde está el MÍNIMO de los datos. */
  plinth: number;
  /** Altura de la línea de cero. Igual a `plinth` si no hay negativos. */
  baseline: number;
  /** Alto total ocupado, del suelo a la cresta más alta. Para encuadrar. */
  totalHeight: number;
  /** Radio del canto que se usará. Ya acotado. */
  radius: number;
};

const EMPTY: AreaLayout = { points: [], plinth: 0, baseline: 0, totalHeight: 0, radius: 0 };

/**
 * Coloca los datos en el perfil.
 *
 * Casos límite, decididos:
 * - No finito cuenta como 0, igual que en las barras.
 * - Los negativos SÍ se dibujan: el suelo de la escala baja hasta el mínimo y
 *   la línea de cero queda por encima del zócalo.
 * - Un solo dato es una losa plana a esa altura de lado a lado: no hay
 *   evolución que dibujar, pero tampoco hay que dejar el hueco vacío.
 * - Sin datos, o todo a cero, no hay losa: no hay escala que valga.
 */
export function computeArea(
  values: number[],
  options: { height: number; bevel: number },
): AreaLayout {
  const clean = values.map((v) => (Number.isFinite(v) ? v : 0));
  if (clean.length === 0) return EMPTY;

  const min = Math.min(0, ...clean);
  const max = Math.max(0, ...clean);
  const span = max - min;
  const totalData = Math.max(0, options.height) * BAR_HEIGHT_SCALE;
  if (span <= 0 || totalData <= 0) return EMPTY;

  const radius = areaEdgeRadius(options.bevel);
  /* 2,4 y no 2: las esquinas de abajo se redondean con, como mucho, el 45% del
     alto de su pared, y ese radio tiene que llegar al del canto o el contorno
     metido hacia dentro haría un nudo en la esquina. */
  const plinth = 2.4 * radius + PLINTH_EXTRA;
  const scale = totalData / span;

  const n = clean.length;
  const points = clean.map((value, index) => ({
    index,
    value,
    x: n === 1 ? 0 : -PLOT_WIDTH / 2 + (PLOT_WIDTH * index) / (n - 1),
    y: plinth + (value - min) * scale,
  }));

  return {
    points,
    plinth,
    baseline: plinth - min * scale,
    totalHeight: plinth + totalData,
    radius,
  };
}

/**
 * Pendientes de la interpolación monótona (Fritsch–Carlson).
 *
 * Donde la curva cambia de sentido, o es plana, la pendiente es cero: ahí está
 * el pico o el valle, y la curva no puede pasar de largo.
 */
export function monotoneSlopes(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  if (n < 2) return ys.map(() => 0);

  const d: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  }

  const m: number[] = [d[0]];
  for (let i = 1; i < n - 1; i += 1) {
    m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  }
  m.push(d[n - 2]);

  for (let i = 0; i < n - 1; i += 1) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return m;
}

/** Muestras por tramo: menos cuantos más datos, con el total acotado. */
export function samplesPerSegment(points: number): number {
  if (points < 2) return 1;
  return Math.max(MIN_SAMPLES, Math.min(MAX_SAMPLES, Math.ceil(160 / (points - 1))));
}

/** La cresta muestreada, de izquierda a derecha. */
export function ridge(points: { x: number; y: number }[]): Vector2[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return [
      new Vector2(-PLOT_WIDTH / 2, points[0].y),
      new Vector2(PLOT_WIDTH / 2, points[0].y),
    ];
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const m = monotoneSlopes(xs, ys);
  const k = samplesPerSegment(points.length);
  const out: Vector2[] = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const h = xs[i + 1] - xs[i];
    for (let s = 0; s < k; s += 1) {
      const t = s / k;
      const t2 = t * t;
      const t3 = t2 * t;
      const y =
        (2 * t3 - 3 * t2 + 1) * ys[i] +
        (t3 - 2 * t2 + t) * h * m[i] +
        (-2 * t3 + 3 * t2) * ys[i + 1] +
        (t3 - t2) * h * m[i + 1];
      out.push(new Vector2(xs[i] + t * h, y));
    }
  }
  out.push(new Vector2(xs[xs.length - 1], ys[ys.length - 1]));
  return out;
}

type Fillet = { points: Vector2[]; radius: number };

/**
 * Esquina redondeada con un arco de CIRCUNFERENCIA de radio conocido.
 *
 * Aquí hubo una cuadrática con el control en la esquina, que parece un arco y
 * no lo es: en el centro su radio de curvatura es solo el 70% de lo que mide
 * de lado, y mucho menos si la esquina es aguda — como cuando la cresta cae
 * hacia la pared—. Al meter el contorno hacia dentro por el radio del canto,
 * esa esquina se daba la vuelta y la cara frontal salía con un nudo. Con un
 * arco de verdad, el radio es el que se pide o, si no cabe, el que se devuelve.
 *
 * `toA` y `toB` son las direcciones unitarias de los dos lados que salen de la
 * esquina, en el orden en que se recorre: se llega por A y se sale por B.
 * `maxA`/`maxB` acotan cuánto puede comerse el arco de cada lado.
 */
function fillet(
  corner: Vector2,
  toA: Vector2,
  toB: Vector2,
  radius: number,
  maxA: number,
  maxB: number,
): Fillet {
  const theta = Math.acos(Math.max(-1, Math.min(1, toA.dot(toB))));
  // Casi recto o casi vuelta atrás: no hay esquina que redondear.
  if (theta < 1e-3 || theta > Math.PI - 1e-3)
    return { points: [corner.clone()], radius: Infinity };

  const tan = Math.tan(theta / 2);
  const d = Math.min(radius / tan, maxA, maxB);
  const r = d * tan;
  if (r < 1e-6) return { points: [corner.clone()], radius: 0 };

  const t1 = corner.clone().addScaledVector(toA, d);
  const t2 = corner.clone().addScaledVector(toB, d);
  const bisector = toA.clone().add(toB).normalize();
  const center = corner.clone().addScaledVector(bisector, r / Math.sin(theta / 2));

  const a1 = Math.atan2(t1.y - center.y, t1.x - center.x);
  let delta = Math.atan2(t2.y - center.y, t2.x - center.x) - a1;
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;

  const points: Vector2[] = [];
  for (let s = 0; s <= ARC_SEGMENTS; s += 1) {
    const a = a1 + (delta * s) / ARC_SEGMENTS;
    points.push(new Vector2(center.x + Math.cos(a) * r, center.y + Math.sin(a) * r));
  }
  return { points, radius: r };
}

/**
 * Hasta qué muestra de la cresta se come la esquina de arriba.
 *
 * El arco necesita un tramo RECTO de largo `d` hacia la cresta, y las muestras
 * de la cresta están a un par de centésimas. Se calcula `d` con la dirección
 * de la cresta en la punta, se saltan las muestras que caen dentro, y el arco
 * va hasta la primera que queda fuera.
 */
function crestCut(
  crest: Vector2[],
  end: number,
  step: 1 | -1,
  wall: Vector2,
  radius: number,
  maxWall: number,
): number {
  const corner = crest[end];
  const tangent = crest[end + step].clone().sub(corner).normalize();
  const theta = Math.acos(Math.max(-1, Math.min(1, tangent.dot(wall))));
  const d = Math.min(
    radius / Math.tan(Math.max(theta, 1e-3) / 2),
    maxWall,
    PLOT_WIDTH * 0.2,
  );

  let i = end + step;
  while (
    i + step >= 0 &&
    i + step < crest.length &&
    crest[i].distanceTo(corner) < d * 1.1
  ) {
    i += step;
  }
  return i;
}

export type AreaOutline = {
  /** Antihorario, sin repetir el primer punto. */
  points: Vector2[];
  /** El menor radio de esquina que se ha podido poner. Acota el canto. */
  minCornerRadius: number;
};

/**
 * El contorno cerrado de la losa: base → pared derecha → cresta de derecha a
 * izquierda → pared izquierda, con las cuatro esquinas redondeadas.
 */
export function areaOutline(crest: Vector2[], cornerRadius: number): AreaOutline {
  if (crest.length < 2) return { points: [], minCornerRadius: 0 };
  const left = -PLOT_WIDTH / 2;
  const right = PLOT_WIDTH / 2;
  const first = crest[0];
  const last = crest[crest.length - 1];
  const n = crest.length;

  const bl = new Vector2(left, 0);
  const br = new Vector2(right, 0);
  const up = new Vector2(0, 1);
  const down = new Vector2(0, -1);
  const toRight = new Vector2(1, 0);
  const toLeft = new Vector2(-1, 0);
  /* Una esquina no puede comerse más del 45% de su pared: en la de enfrente
     hay otra esquina. */
  const wallL = first.y * 0.45;
  const wallR = last.y * 0.45;
  const bottom = PLOT_WIDTH * 0.45;

  const iEnd = n > 2 ? crestCut(crest, n - 1, -1, down, cornerRadius, wallR) : n - 1;
  const iStart = n > 2 ? crestCut(crest, 0, 1, down, cornerRadius, wallL) : 0;

  const corners: Fillet[] = [];
  const toward = (from: Vector2, to: Vector2) => to.clone().sub(from).normalize();
  const span = (a: Vector2, b: Vector2) => a.distanceTo(b) * 0.98;

  corners.push(fillet(bl, up, toRight, cornerRadius, wallL, bottom));
  corners.push(fillet(br, toLeft, up, cornerRadius, bottom, wallR));
  const haciaCrestaR = iEnd < n - 1 ? crest[iEnd] : crest[0];
  corners.push(
    fillet(
      last,
      down,
      toward(last, haciaCrestaR),
      cornerRadius,
      wallR,
      span(last, haciaCrestaR),
    ),
  );
  const haciaCrestaL = iStart > 0 ? crest[iStart] : crest[n - 1];
  corners.push(
    fillet(
      first,
      toward(first, haciaCrestaL),
      down,
      cornerRadius,
      span(first, haciaCrestaL),
      wallL,
    ),
  );

  const outline: Vector2[] = [];
  outline.push(...corners[0].points);
  /*
    La base, con un punto en la MISMA x que cada muestra de la cresta.

    Una recta no necesita puntos intermedios para dibujarse, pero la cara de la
    losa se triangula cosiendo base y cresta (ver `zipper`), y con la base hecha
    de un solo tramo la costura salía en abanico desde la esquina: triángulos
    larguísimos que cruzaban la cresta por encima de cada valle. Con la base
    muestreada igual que la cresta, cada triángulo ocupa una franja estrecha
    donde las dos cadenas son rectas.
  */
  const desde = corners[0].points[corners[0].points.length - 1].x;
  const hasta = corners[1].points[0].x;
  for (const p of crest) {
    if (p.x > desde + 1e-6 && p.x < hasta - 1e-6) outline.push(new Vector2(p.x, 0));
  }
  outline.push(...corners[1].points, ...corners[2].points);
  for (let i = iEnd; i >= iStart && iStart <= iEnd; i -= 1) {
    if (i > 0 && i < n - 1) outline.push(crest[i].clone());
  }
  outline.push(...corners[3].points);

  return {
    points: dedupe(outline),
    minCornerRadius: Math.min(...corners.map((c) => c.radius)),
  };
}

/** Quita puntos consecutivos repetidos: dan normales nulas y triángulos vacíos. */
function dedupe(points: Vector2[]): Vector2[] {
  const out: Vector2[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (!prev || prev.distanceToSquared(p) > 1e-12) out.push(p);
  }
  if (out.length > 1 && out[0].distanceToSquared(out[out.length - 1]) <= 1e-12) out.pop();
  return out;
}

/** Normales hacia fuera de un contorno antihorario, suavizadas en cada punto. */
export function outlineNormals(outline: Vector2[]): Vector2[] {
  const n = outline.length;
  return outline.map((p, i) => {
    const prev = outline[(i - 1 + n) % n];
    const next = outline[(i + 1) % n];
    const dir = next.clone().sub(prev);
    // Antihorario: lo de fuera queda a la derecha de la marcha.
    return new Vector2(dir.y, -dir.x).normalize();
  });
}

/**
 * El menor radio de curvatura de la cresta, para que el canto no sea mayor.
 *
 * Desplazar la curva hacia dentro una distancia mayor que su radio de
 * curvatura la hace cruzarse consigo misma en el pico: la cara frontal saldría
 * con un nudo. Se mide con el círculo que pasa por cada tres puntos.
 */
export function minCurvatureRadius(crest: Vector2[]): number {
  let min = Infinity;
  for (let i = 1; i < crest.length - 1; i += 1) {
    const a = crest[i - 1];
    const b = crest[i];
    const c = crest[i + 1];
    const ab = a.distanceTo(b);
    const bc = b.distanceTo(c);
    const ca = c.distanceTo(a);
    const area2 = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    if (area2 < 1e-12) continue;
    min = Math.min(min, (ab * bc * ca) / (2 * area2));
  }
  return min;
}

/**
 * Dónde acaba la cadena de abajo: el punto más bajo de la pared derecha.
 *
 * Se mide sobre el contorno SIN meter, donde los puntos de la pared están
 * exactamente en x = 1. Metido hacia dentro, cada uno se desplaza según su
 * normal —que en los extremos de la pared ya no es horizontal pura—, y buscar
 * «los de x máxima» ahí dejaba fuera el de abajo: la cremallera cosía la pared
 * al revés y doblaba dos triángulos uno encima de otro.
 */
export function lowerChainEnd(outline: Vector2[]): number {
  const maxX = Math.max(...outline.map((p) => p.x));
  let split = 0;
  let lowest = Infinity;
  outline.forEach((p, i) => {
    if (p.x >= maxX - 1e-9 && p.y < lowest) {
      lowest = p.y;
      split = i;
    }
  });
  return split;
}

/**
 * Triangula la cara de la losa cosiendo la cadena de ABAJO con la de ARRIBA.
 *
 * Aquí estuvo `ShapeUtils.triangulateShape` de three (earcut), y costaba unos
 * KB del bundle del embed para resolver un caso general que este no es: el
 * contorno es MONÓTONO en X —cualquier vertical lo corta dos veces, una abajo
 * y otra arriba—, y un polígono así se triangula en una pasada avanzando por
 * las dos cadenas a la vez, como una cremallera. Cada triángulo queda entre un
 * tramo de abajo y otro de arriba de la misma franja vertical, así que no
 * puede salirse.
 *
 * El contorno llega antihorario empezando en la pared izquierda, abajo: la
 * cadena de abajo va del índice 0 hasta la pared derecha, y la de arriba es el
 * resto recorrido al revés.
 */
export function zipper(polygon: Vector2[], split: number): [number, number, number][] {
  const n = polygon.length;
  if (n < 3) return [];

  const lower = Array.from({ length: split + 1 }, (_, i) => i);
  const upper = Array.from({ length: n - split - 1 }, (_, k) => n - 1 - k);
  if (upper.length === 0) return [];

  const triangles: [number, number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < lower.length - 1 || j < upper.length - 1) {
    const avanzaAbajo =
      j >= upper.length - 1 ||
      (i < lower.length - 1 && polygon[lower[i + 1]].x <= polygon[upper[j + 1]].x);
    if (avanzaAbajo) {
      triangles.push([lower[i], lower[i + 1], upper[j]]);
      i += 1;
    } else {
      triangles.push([lower[i], upper[j + 1], upper[j]]);
      j += 1;
    }
  }
  return triangles;
}

/**
 * La losa entera.
 *
 * Cada punto del contorno lleva un perfil transversal: un cuarto de círculo
 * hacia la cara de atrás, la pared recta, y otro cuarto hacia la de delante.
 * Las dos caras se triangulan con el contorno metido `r` hacia dentro, que es
 * donde acaba el canto.
 */
export function areaGeometry(layout: AreaLayout): BufferGeometry {
  const geometry = new BufferGeometry();
  const crest = ridge(layout.points);
  if (crest.length < 2) return geometry;

  /* Las esquinas, un pelo más que el canto: así el contorno metido hacia dentro
     siempre conserva algo de curva en la esquina. Con canto cero, un mínimo,
     para que la losa no tenga aristas vivas en planta. */
  const wanted = Math.max(0, Math.min(layout.radius, minCurvatureRadius(crest) * 0.8));
  const { points: outline, minCornerRadius } = areaOutline(
    crest,
    Math.max(wanted * 1.1, 0.02),
  );
  /* Y si alguna esquina no ha podido ser tan redonda —una pared bajísima, una
     cresta que cae casi en vertical—, el canto se acota a ella. Mejor un canto
     algo menor en toda la losa que un nudo en una esquina. */
  const radius = Math.min(wanted, minCornerRadius * 0.9);
  const normals = outlineNormals(outline);
  const half = AREA_DEPTH / 2;

  const positions: number[] = [];
  const normalsOut: number[] = [];
  const indices: number[] = [];

  /* Perfil transversal: (hacia dentro, z, componente de la normal en el plano,
     componente en z). Del canto de atrás al de delante. */
  const profile: [number, number, number, number][] = [];
  for (let s = ARC_SEGMENTS; s >= 0; s -= 1) {
    const phi = (s / ARC_SEGMENTS) * (Math.PI / 2);
    profile.push([
      radius * (1 - Math.cos(phi)),
      -(half - radius) - radius * Math.sin(phi),
      Math.cos(phi),
      -Math.sin(phi),
    ]);
  }
  for (let s = 0; s <= ARC_SEGMENTS; s += 1) {
    const phi = (s / ARC_SEGMENTS) * (Math.PI / 2);
    profile.push([
      radius * (1 - Math.cos(phi)),
      half - radius + radius * Math.sin(phi),
      Math.cos(phi),
      Math.sin(phi),
    ]);
  }

  const rings = outline.length;
  const perRing = profile.length;

  for (let j = 0; j < rings; j += 1) {
    const p = outline[j];
    const nrm = normals[j];
    for (const [inward, z, nu, nz] of profile) {
      positions.push(p.x - nrm.x * inward, p.y - nrm.y * inward, z);
      normalsOut.push(nrm.x * nu, nrm.y * nu, nz);
    }
  }

  /* El costado. Cada cuadrilátero, con el giro que deja la normal geométrica
     hacia fuera: el contorno avanza antihorario y el perfil va de atrás
     (z negativa) a delante. */
  for (let j = 0; j < rings; j += 1) {
    const jn = (j + 1) % rings;
    for (let m = 0; m < perRing - 1; m += 1) {
      const a = j * perRing + m;
      const b = jn * perRing + m;
      const c = jn * perRing + m + 1;
      const d = j * perRing + m + 1;
      indices.push(a, b, c, a, c, d);
    }
  }

  /* Las dos caras planas, con el contorno metido `r`. Vértices propios: la
     normal de una cara es plana y no se comparte con el canto. */
  const inset = outline.map(
    (p, j) => new Vector2(p.x - normals[j].x * radius, p.y - normals[j].y * radius),
  );
  const triangles = zipper(inset, lowerChainEnd(outline));

  for (const [z, nz] of [
    [half, 1],
    [-half, -1],
  ] as const) {
    const base = positions.length / 3;
    for (const p of inset) {
      positions.push(p.x, p.y, z);
      normalsOut.push(0, 0, nz);
    }
    /* Delante se ve desde +z: el triángulo tiene que ir antihorario visto desde
       ahí, y detrás al revés. Se mira el giro de CADA triángulo en vez de
       fiarse del orden en que los devuelve el triangulador. */
    for (const [a, b, c] of triangles) {
      const pa = inset[a];
      const pb = inset[b];
      const pc = inset[c];
      const giro = (pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x);
      if (giro > 0 === nz > 0) indices.push(base + a, base + b, base + c);
      else indices.push(base + a, base + c, base + b);
    }
  }

  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normalsOut, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
