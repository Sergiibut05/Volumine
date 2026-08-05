/*
  Deshacer y rehacer sobre el config entero.

  Es barato porque el `ChartConfig` es la única fuente de verdad del editor: no
  hay que registrar "qué" cambió, basta con guardar el config de antes.

  LO DIFÍCIL NO ES LA PILA, ES AGRUPAR
  ------------------------------------
  Arrastrar un slider produce decenas de cambios por segundo. Si cada uno fuera
  un paso, deshacer una vez movería el canto 0,01 y harían falta cuarenta
  pulsaciones para volver a donde estabas — que es lo mismo que no tener
  deshacer.

  Así que los cambios seguidos se FUSIONAN: mientras sigas moviendo, se
  reemplaza el presente en vez de apilarlo. En cuanto paras, el siguiente cambio
  abre un paso nuevo. El resultado es que un arrastre entero se deshace de una.
*/

export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  /** Cuándo se registró el presente. Con esto se decide si fusionar. */
  at: number;
};

/**
 * Cuánto tiene que pasar sin tocar nada para que el siguiente cambio abra un
 * paso nuevo.
 *
 * 450 ms: por encima, dos ajustes distintos hechos seguidos se fusionan en uno
 * y deshacer se lleva los dos por delante; por debajo, un arrastre lento de
 * slider se parte en varios pasos.
 */
export const COALESCE_MS = 450;

/**
 * Cuántos pasos se recuerdan.
 *
 * Cada paso es un config entero, y un config con doscientas filas pesa. Con 60
 * pasos se cubre de sobra una sesión de trabajo sin que la memoria crezca sin
 * control.
 */
export const MAX_STEPS = 60;

export function createHistory<T>(present: T, now = 0): History<T> {
  return { past: [], present, future: [], at: now };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

/**
 * Registra un estado nuevo.
 *
 * `coalesce` en false fuerza un paso propio aunque venga seguido: sirve para
 * acciones discretas —cambiar de tipo, pegar una tabla, quitar una fila— que
 * siempre se tienen que poder deshacer por separado aunque caigan justo detrás
 * de otra.
 */
export function record<T>(
  history: History<T>,
  next: T,
  now: number,
  options: { coalesce?: boolean } = {},
): History<T> {
  if (Object.is(next, history.present)) return history;

  const coalesce = options.coalesce ?? true;
  const merge = coalesce && now - history.at < COALESCE_MS && history.past.length > 0;

  if (merge) {
    // Sigue siendo el mismo paso: se reemplaza el presente y no se apila nada.
    return { ...history, present: next, future: [], at: now };
  }

  const past = [...history.past, history.present];
  return {
    past: past.length > MAX_STEPS ? past.slice(past.length - MAX_STEPS) : past,
    present: next,
    // Rehacer se pierde al hacer algo nuevo: la rama vieja ya no lleva a ningún
    // sitio. Es lo que hace cualquier editor y lo que la gente espera.
    future: [],
    at: now,
  };
}

export function undo<T>(history: History<T>): History<T> {
  if (!canUndo(history)) return history;

  const past = history.past.slice(0, -1);
  const present = history.past[history.past.length - 1];

  return {
    past,
    present,
    future: [history.present, ...history.future],
    /* Se marca como "hace mucho" para que el siguiente cambio NO se fusione con
       lo que acabas de deshacer: si se fusionara, escribir justo después de
       deshacer machacaría el paso al que acabas de volver. */
    at: -Infinity,
  };
}

export function redo<T>(history: History<T>): History<T> {
  if (!canRedo(history)) return history;

  const [present, ...future] = history.future;
  return {
    past: [...history.past, history.present],
    present,
    future,
    at: -Infinity,
  };
}
