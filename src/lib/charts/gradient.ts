/*
  La línea de un `linear-gradient` de CSS, en coordenadas de canvas.

  ── POR QUÉ EXISTE ESTO ────────────────────────────────────────────────────

  El degradado del fondo se pinta con CSS en el contenedor, no dentro de WebGL
  (ver la nota en `chart-renderer.ts`: un degradado de CSS se compone a
  resolución de pantalla y no tiene banding). Eso está bien para la pantalla y
  deja un agujero en el PÓSTER: lo que se captura es el canvas, y en el canvas
  el degradado no está.

  Para pintarlo debajo al capturar hay que reproducir la línea que usaría CSS.
  Y esa línea es justo la clase de cálculo que sale al revés sin que falle nada:
  un degradado girado 90° sigue siendo un degradado bonito, así que no hay error
  que ver — solo un póster que no se parece a lo que la persona configuró.

  ── LAS CONVENCIONES DE CSS, QUE NO SON LAS INTUITIVAS ─────────────────────

  · `0deg` apunta ARRIBA, y crece EN SENTIDO HORARIO. O sea que `90deg` es
    hacia la derecha, no hacia abajo.
  · El primer color va donde EMPIEZA la línea, que con `0deg` es abajo. Es
    decir: `linear-gradient(0deg, negro, blanco)` es negro abajo y blanco
    arriba. Leerlo al revés es el error clásico.
  · La línea pasa por el centro y su largo NO es el de la diagonal: es
    `|W·sen(a)| + |H·cos(a)|`, que es lo que hace que las esquinas caigan justo
    en los extremos del degradado.
*/

export type GradientLine = { x0: number; y0: number; x1: number; y1: number };

/**
 * Los dos extremos de la línea, para `createLinearGradient`.
 *
 * En coordenadas de canvas: x hacia la derecha, **y hacia abajo**. `(x0, y0)`
 * es donde va el primer color.
 */
export function cssGradientLine(
  angleDegrees: number,
  width: number,
  height: number,
): GradientLine {
  /* Se normaliza el ángulo antes de nada: el esquema admite 0..360, pero un
     config viejo o escrito a mano puede traer cualquier cosa y `360` tiene que
     dar lo mismo que `0`. */
  const a = (((angleDegrees % 360) + 360) % 360) * (Math.PI / 180);

  /* Hacia dónde crece el degradado. `-cos` en la Y porque en un canvas la Y
     crece hacia abajo y en CSS el ángulo se mide con el arriba en 0. */
  const dx = Math.sin(a);
  const dy = -Math.cos(a);

  const length = Math.abs(width * Math.sin(a)) + Math.abs(height * Math.cos(a));

  const cx = width / 2;
  const cy = height / 2;
  const half = length / 2;

  return {
    x0: cx - dx * half,
    y0: cy - dy * half,
    x1: cx + dx * half,
    y1: cy + dy * half,
  };
}
