/*
  Colocación de las etiquetas de datos. Puro: entran posiciones, salen
  posiciones. Sin DOM, sin three, sin estado — así se puede testear, que es lo
  único que impide que esto se degrade con el tiempo.

  POR QUÉ HTML Y NO TEXTO EN 3D
  -----------------------------
  El bundle del embed no lleva ninguna fuente ni cabe en el presupuesto (ADR
  0005). Pero aunque cupiera, tampoco: el texto plano se lee más nítido a
  cualquier tamaño, se puede seleccionar y copiar, y lo lee un lector de
  pantalla. Lo único que hace falta de la escena 3D es DÓNDE va cada etiqueta,
  y eso es una proyección de un punto.

  EL PROBLEMA DE VERDAD NO ES PROYECTAR, ES QUE NO SE PISEN
  --------------------------------------------------------
  Proyectar un punto son tres líneas. Lo que separa una gráfica que parece de
  producto de una que parece un accidente es qué pasa cuando dos etiquetas caen
  en el mismo sitio, que con seis categorías pasa siempre.
*/

export type LabelSlot = {
  /** Índice del dato al que pertenece. */
  index: number;
  /** Dónde quiere estar, en píxeles desde arriba. */
  y: number;
  /** Alto de la etiqueta en píxeles. */
  height: number;
};

export type StackOptions = {
  /** Alto del hueco disponible, en píxeles. */
  viewport: number;
  /** Aire mínimo entre dos etiquetas. */
  gap: number;
  /** Margen arriba y abajo. */
  padding: number;
};

/**
 * Separa verticalmente las etiquetas de UNA columna para que no se solapen.
 *
 * Es el algoritmo clásico de los gráficos de tarta con líneas guía, y funciona
 * en dos pasadas: se baja lo que haga falta recorriendo de arriba abajo, y
 * luego se sube lo que se haya salido por el borde recorriendo de abajo arriba.
 * La segunda pasada es la que suele faltar en las implementaciones caseras, y
 * sin ella la última etiqueta acaba fuera de la pantalla.
 *
 * NO SE REORDENAN. Una etiqueta tiene que quedar del lado de su sector y en el
 * mismo orden: si se reordenan para que quepan mejor, las líneas guía se cruzan
 * y el dibujo pasa a ser más difícil de leer que sin etiquetas.
 *
 * Devuelve las `y` corregidas, en el mismo orden que entraron.
 */
export function stackLabels(slots: LabelSlot[], options: StackOptions): number[] {
  const { viewport, gap, padding } = options;
  if (slots.length === 0) return [];

  // Se trabaja sobre una copia ordenada por posición deseada, no por índice: el
  // orden vertical es el que manda para no cruzar líneas.
  const order = slots.map((slot, i) => ({ ...slot, i })).sort((a, b) => a.y - b.y);

  // Pasada 1: hacia abajo. Nadie puede empezar antes de donde acaba el anterior.
  let cursor = padding;
  for (const slot of order) {
    slot.y = Math.max(slot.y, cursor);
    cursor = slot.y + slot.height + gap;
  }

  /* Pasada 2: hacia arriba. La primera pasada puede haber empujado la última
     etiqueta fuera por abajo; aquí se recupera el desbordamiento repartiéndolo
     hacia arriba mientras haya sitio. */
  cursor = viewport - padding;
  for (let i = order.length - 1; i >= 0; i--) {
    const slot = order[i];
    if (slot.y + slot.height > cursor) slot.y = cursor - slot.height;
    cursor = slot.y - gap;
  }

  /* Si ni aun así caben —más etiquetas que píxeles— se apilan desde arriba y se
     dejan salir por abajo. Es preferible a amontonarlas todas en el mismo sitio:
     al menos las de arriba se leen, y quien vea eso entiende que sobran datos. */
  if (order[0].y < padding) {
    cursor = padding;
    for (const slot of order) {
      slot.y = cursor;
      cursor = slot.y + slot.height + gap;
    }
  }

  const result = new Array<number>(slots.length);
  for (const slot of order) result[slot.i] = slot.y;
  return result;
}

/**
 * ¿Cabe alguna etiqueta más de las que hay hueco?
 *
 * Con más etiquetas que sitio, lo correcto no es apretarlas hasta que sean
 * ilegibles: es enseñar las que caben. Se descartan las de valor MÁS PEQUEÑO,
 * porque son las que menos aportan y las que peor se leen en el dibujo.
 *
 * Devuelve los índices que SÍ se dibujan.
 */
export function fitLabels(
  values: number[],
  options: { viewport: number; height: number; gap: number; padding: number },
): number[] {
  const { viewport, height, gap, padding } = options;
  const disponible = viewport - padding * 2;
  const caben = Math.max(1, Math.floor((disponible + gap) / (height + gap)));

  if (values.length <= caben) return values.map((_, i) => i);

  return values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value)
    .slice(0, caben)
    .map((entry) => entry.index)
    .sort((a, b) => a - b);
}
