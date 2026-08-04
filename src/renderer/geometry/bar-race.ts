/*
  Barras animadas (bar race). Funciones puras: entran números, salen números.
  Aquí no hay three (ADR 0004) — la geometría del sólido la pone `bar.ts`.

  CÓMO SE MODELA EL TIEMPO, Y POR QUÉ NO HIZO FALTA TOCAR EL ESQUEMA
  -----------------------------------------------------------------
  Cada SERIE es un instante, y su `name` es la etiqueta del periodo ("2019",
  "Ene"). Las categorías siguen siendo `data.labels`.

  Es exactamente la misma forma que ya usaban las barras agrupadas, leída en otro
  eje: allí varias series son filas que se ven a la vez, aquí son fotogramas que
  se ven uno detrás de otro. Añadir un eje de tiempo al contrato habría obligado
  a subir la versión y a migrar todos los links publicados, y no aportaba nada.

  Lo que hace que esto sea una CARRERA y no barras que cambian de tamaño es que
  las barras se reordenan: cada categoría ocupa el hueco que le toca por su
  puesto en el ranking, y adelantar a otra se ve.
*/

/** Cuánto dura un periodo si el config no dice otra cosa. */
export const DEFAULT_FRAME_MS = 1400;

/**
 * Qué fracción del periodo se pasa moviéndose.
 *
 * El resto es reposo. Una carrera en la que todo se mueve continuamente no se
 * puede leer: hace falta un momento quieto en cada periodo para que el ojo
 * registre quién va ganando antes de que vuelva a cambiar.
 */
export const TRANSITION_SHARE = 0.62;

export type RaceFrame = {
  /** Índice del periodo de partida. */
  from: number;
  /** Índice del periodo de destino. Igual que `from` en el último. */
  to: number;
  /** 0..1 dentro de la transición, ya suavizado. */
  t: number;
  /** Etiqueta que toca mostrar. */
  label: string;
};

/**
 * En qué punto de la carrera estamos, dado el tiempo transcurrido.
 *
 * `loop` reinicia al llegar al final. Sin loop se queda congelada en el último
 * periodo, que es lo correcto para una captura o un póster estático.
 */
export function frameAt(
  elapsedMs: number,
  frameCount: number,
  names: (string | null)[],
  options: { frameMs: number; loop: boolean },
): RaceFrame {
  const nameOf = (i: number) => names[i] ?? `${i + 1}`;
  if (frameCount <= 1) return { from: 0, to: 0, t: 1, label: nameOf(0) };

  const frameMs = Math.max(1, options.frameMs);
  const totalMs = frameMs * (frameCount - 1);
  const clamped = options.loop
    ? ((elapsedMs % totalMs) + totalMs) % totalMs
    : Math.min(Math.max(elapsedMs, 0), totalMs);

  const from = Math.min(Math.floor(clamped / frameMs), frameCount - 2);
  const within = (clamped - from * frameMs) / frameMs;

  /* Solo la primera parte del periodo se mueve. Ver TRANSITION_SHARE. */
  const raw = Math.min(1, within / TRANSITION_SHARE);
  const t = easeInOut(raw);

  return { from, to: from + 1, t, label: nameOf(t < 0.5 ? from : from + 1) };
}

/** Suavizado propio, no `ease` del navegador (docs/DESIGN.md). */
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Valor de cada categoría en el instante actual, interpolando entre periodos.
 *
 * Los valores no finitos cuentan como 0, igual que en las barras estáticas: una
 * carrera con un hueco en medio tiene que seguir corriendo.
 */
export function valuesAt(
  series: number[][],
  frame: RaceFrame,
  categories: number,
): number[] {
  const from = series[frame.from] ?? [];
  const to = series[frame.to] ?? from;

  return Array.from({ length: categories }, (_, i) => {
    const a = Number.isFinite(from[i]) ? from[i] : 0;
    const b = Number.isFinite(to[i]) ? to[i] : 0;
    return a + (b - a) * frame.t;
  });
}

/**
 * Puesto de cada categoría, de mayor a menor valor.
 *
 * Devuelve `slot[categoria] = puesto`. Los empates se rompen por el índice de
 * la categoría, no por el orden en que llegaron: si no, dos categorías empatadas
 * se intercambian el sitio en cada frame y la gráfica tiembla.
 */
export function rankSlots(values: number[]): number[] {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value || a.index - b.index);

  const slots = new Array<number>(values.length);
  order.forEach((entry, position) => {
    slots[entry.index] = position;
  });
  return slots;
}

/**
 * Cuántas categorías caben en pantalla.
 *
 * Una carrera con cincuenta categorías es ilegible: las de abajo son rayas. Se
 * muestran las primeras y el resto simplemente no entra en la parrilla, que es
 * lo que hace cualquier bar race que se haya visto funcionar.
 */
export const MAX_VISIBLE = 12;

export type RacePlacement = {
  /** Puesto redondeado al hueco que ocupa, 0 = el primero. */
  slot: number;
  /** Si está fuera de los MAX_VISIBLE, no se dibuja. */
  visible: boolean;
};

export function placementsFor(values: number[]): RacePlacement[] {
  const slots = rankSlots(values);
  return slots.map((slot) => ({ slot, visible: slot < MAX_VISIBLE }));
}
