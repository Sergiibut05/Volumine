/*
  Lo mínimo de color que hace falta para decidir cosas, no para pintarlas.

  Vive suelto y sin importar nada porque lo usan los dos lados: la aplicación
  —para elegir sobre qué se aplana un póster— y el RENDERER, que entra entero en
  el bundle de `/embed`. Son doce líneas; meterlas en un módulo que arrastre
  temas o configuración costaría kilobytes en la ruta con el presupuesto más
  apretado.
*/

/**
 * Luminancia relativa de WCAG, de 0 (negro) a 1 (blanco).
 *
 * No es el promedio de los canales: cada uno se linealiza y se pesa según lo
 * que aporta a la sensación de brillo — el verde manda, el azul casi no cuenta.
 * Es lo que hace que funcione con colores saturados, donde el promedio ingenuo
 * dice que un amarillo y un azul brillan igual.
 *
 * Con algo que no sea un hex devuelve 0. Es un valor por defecto y no una
 * excepción a propósito: quien llama está eligiendo entre claro y oscuro, y
 * quedarse sin decisión por un color mal escrito sería peor que suponer negro.
 */
export function luminance(hex: string): number {
  const raw = hex.trim().replace(/^#/, '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return 0;

  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Si un color es claro. El corte está donde el ojo deja de ver «oscuro». */
export function isLight(hex: string): boolean {
  return luminance(hex) > 0.45;
}
