import { BufferGeometry, BufferAttribute } from 'three';

/*
  Caja con cantos redondeados, construida a mano. La pieza de las barras.

  MISMO PLANTEAMIENTO QUE `rounded-sector.ts`, y por los mismos motivos: nada de
  ExtrudeGeometry y nada de suavizar normales a posteriori. Se construye así:

  1. Un CONTORNO en planta: un rectángulo redondeado en XZ, donde cada punto
     lleva su normal exacta.
  2. Un PERFIL vertical: cuánto se mete la superficie hacia dentro según la
     altura — canto de abajo, pared recta, canto de arriba.
  3. El perfil se BARRE a lo largo del contorno. Eso da toda la banda del
     perímetro, con los cantos horizontales y las cuatro aristas verticales ya
     redondeadas, sin casos especiales.
  4. Las dos caras planas se cierran con el contorno metido hacia dentro por el
     radio que le toca a cada una.

  Las normales son analíticas en todos los puntos: en la banda son
  (componente del perfil · normal del contorno, componente vertical), que es
  exacta también en las esquinas, porque ahí la superficie es un trozo de toro.

  DOS RADIOS VERTICALES, NO UNO
  -----------------------------
  `radius` redondea el canto de abajo y `topRadius` el de arriba. Separarlos es
  lo que permite ir de "caja blanda" a "cápsula" con un único control
  (`style.cornerRadius`), que es lo que el contrato reserva para las barras.

  El radio EN PLANTA es una tercera cosa —las cuatro aristas verticales— y tiene
  que ser al menos el mayor de los dos verticales: las tapas se cierran metiendo
  el contorno hacia dentro por el radio del canto, y si ese radio supera el de
  planta, el arco de la esquina se pasa de largo y la tapa se da la vuelta.
*/

export type RoundedBoxParams = {
  /** Ancho en X. */
  width: number;
  /** Fondo en Z. */
  depth: number;
  /** Alto en Y. La base queda en y=0. */
  height: number;
  /** Radio del canto inferior, en unidades de escena. */
  radius: number;
  /** Radio del canto superior. Mayor que `radius` abomba la punta. */
  topRadius: number;
  /** Radio de las esquinas en planta. Se sube solo si hace falta. */
  planRadius: number;
  /** Divisiones de cada cuarto de círculo. */
  cornerSegments: number;
};

type ProfilePoint = {
  /** Desplazamiento hacia dentro del contorno. Nunca positivo. */
  n: number;
  y: number;
  /** Normal: componente sobre la normal del contorno y componente vertical. */
  nn: number;
  ny: number;
};

type OutlinePoint = { x: number; z: number; nx: number; nz: number };

const HALF_PI = Math.PI / 2;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Perfil vertical, del borde de la cara de abajo al de la cara de arriba.
 *
 * Con radio 0 el arco no desaparece: colapsa en un punto con la normal girando,
 * que es exactamente lo que necesita una arista viva para sombrear bien.
 */
function buildProfile(
  height: number,
  rb: number,
  rt: number,
  steps: number,
): ProfilePoint[] {
  const points: ProfilePoint[] = [];

  for (let j = 0; j <= steps; j += 1) {
    const a = -HALF_PI + HALF_PI * (j / steps);
    const nn = Math.cos(a);
    const ny = Math.sin(a);
    points.push({ n: -rb + rb * nn, y: rb + rb * ny, nn, ny });
  }

  /* La pared recta se omite cuando los dos cantos se tocan: el tramo mide cero
     y solo añadiría un anillo de triángulos degenerados. */
  const wallTop = height - rt;
  if (wallTop - rb > 1e-9) points.push({ n: 0, y: wallTop, nn: 1, ny: 0 });

  for (let j = 1; j <= steps; j += 1) {
    const a = HALF_PI * (j / steps);
    const nn = Math.cos(a);
    const ny = Math.sin(a);
    points.push({ n: -rt + rt * nn, y: wallTop + rt * ny, nn, ny });
  }

  return points;
}

/**
 * Contorno en planta: rectángulo redondeado, recorrido como cuatro arcos.
 *
 * No hacen falta puntos para los lados rectos: el final del arco de una esquina
 * y el principio del de la siguiente **son** los dos extremos del lado, así que
 * el barrido los une solo.
 */
function buildOutline(
  hx: number,
  hz: number,
  r: number,
  steps: number,
): OutlinePoint[] {
  const points: OutlinePoint[] = [];
  const cx = hx - r;
  const cz = hz - r;
  // Un centro por cuadrante, en el orden en que gira la normal.
  const centers = [
    { x: cx, z: cz },
    { x: -cx, z: cz },
    { x: -cx, z: -cz },
    { x: cx, z: -cz },
  ];

  for (let k = 0; k < 4; k += 1) {
    for (let j = 0; j <= steps; j += 1) {
      const a = HALF_PI * (k + j / steps);
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      points.push({
        x: centers[k].x + r * nx,
        z: centers[k].z + r * nz,
        nx,
        nz,
      });
    }
  }

  return points;
}

/**
 * Máximo radio de canto admisible para una caja.
 *
 * Es "que el sólido siga existiendo": ni más de la mitad de la dimensión
 * horizontal menor, ni más de la mitad de la altura.
 */
export function maxBoxRadius(width: number, depth: number, height: number): number {
  return Math.max(0, Math.min(Math.min(width, depth) / 2, height / 2));
}

export function roundedBoxGeometry({
  width,
  depth,
  height,
  radius,
  topRadius,
  planRadius,
  cornerSegments,
}: RoundedBoxParams): BufferGeometry {
  const hx = Math.max(width, 1e-4) / 2;
  const hz = Math.max(depth, 1e-4) / 2;
  const h = Math.max(height, 1e-4);
  const steps = Math.max(1, cornerSegments);

  const minHalf = Math.min(hx, hz);
  const rb = clamp(radius, 0, Math.min(minHalf, h / 2));
  const rt = clamp(topRadius, 0, Math.min(minHalf, h - rb));
  const rp = clamp(Math.max(planRadius, rb, rt), 0, minHalf);

  const outline = buildOutline(hx, hz, rp, steps);
  const profile = buildProfile(h, rb, rt, steps);
  const O = outline.length;
  const M = profile.length;

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const push = (
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
  ): number => {
    const len = Math.hypot(nx, ny, nz) || 1;
    positions.push(x, y, z);
    normals.push(nx / len, ny / len, nz / len);
    return positions.length / 3 - 1;
  };

  // ── banda del perímetro ───────────────────────────────────────────────────
  for (const o of outline) {
    for (const p of profile) {
      push(
        o.x + o.nx * p.n,
        p.y,
        o.z + o.nz * p.n,
        o.nx * p.nn,
        p.ny,
        o.nz * p.nn,
      );
    }
  }

  /* El contorno gira de +X a +Z, que visto desde arriba es sentido horario
     (X × Z = −Y). Con las filas en ese sentido y las columnas subiendo, el giro
     que pediría la intuición deja la banda mirando hacia dentro. */
  for (let i = 0; i < O; i += 1) {
    const next = (i + 1) % O;
    for (let j = 0; j < M - 1; j += 1) {
      const a = i * M + j;
      const b = i * M + j + 1;
      const c = next * M + j + 1;
      const d = next * M + j;
      indices.push(a, b, c, a, c, d);
    }
  }

  // ── tapas ─────────────────────────────────────────────────────────────────
  const cap = (y: number, inset: number, up: boolean) => {
    const sign = up ? 1 : -1;
    // El centro del rectángulo redondeado es su centroide: no hace falta media.
    const center = push(0, y, 0, 0, sign, 0);
    const ring = outline.map((o) =>
      push(o.x - o.nx * inset, y, o.z - o.nz * inset, 0, sign, 0),
    );

    for (let i = 0; i < O; i += 1) {
      const next = (i + 1) % O;
      if (up) indices.push(center, ring[next], ring[i]);
      else indices.push(center, ring[i], ring[next]);
    }
  };

  cap(0, rb, false);
  cap(h, rt, true);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setIndex(indices);
  return geometry;
}
