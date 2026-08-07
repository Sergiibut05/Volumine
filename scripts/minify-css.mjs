/**
 * Quita del CSS del embed lo que no hace falta en el cable.
 *
 * ── POR QUÉ ESTO EXISTE ────────────────────────────────────────────────────
 *
 * `embed.css` se inserta ENTERO dentro del HTML de cada embed, y ese HTML corre
 * dentro de la página de otra persona. Como se leía tal cual del disco, se
 * enviaban también los comentarios: 16,6 KB de los que **10,5 eran prosa**. El
 * presupuesto son 8 KB (docs/PERFORMANCE-BUDGET.md) y llevaba tiempo roto por
 * el doble sin que la causa fuera evidente.
 *
 * La alternativa —escribir menos comentarios— es la equivocada: en este
 * proyecto explican decisiones que no se ven en el código, y se pierden justo
 * cuando alguien vuelve a tocarlo dentro de seis meses. Se quedan en el fuente
 * y salen del cable.
 *
 * ── POR QUÉ ES ESTO Y NO UN MINIFICADOR DE VERDAD ─────────────────────────
 *
 * Porque un minificador es una dependencia más para un fichero que escribimos
 * nosotros, sin `url()`, sin `@import`, sin cadenas y sin `content:`. Lo que
 * hace falta son dos transformaciones que se pueden leer de un vistazo y están
 * cubiertas por tests. Si algún día el CSS del embed necesita cosas raras, ese
 * es el momento de traer una herramienta, no antes.
 *
 * Vive en `.mjs` y no en `src/` para que lo puedan usar los dos: el servidor,
 * que lo importa desde TypeScript, y `perf-embed.mjs`, que mide lo que de
 * verdad se envía. Con dos copias, la medida y la realidad se separarían al
 * primer cambio.
 */

/** @param {string} source @returns {string} */
export function minifyCss(source) {
  return (
    source
      // Fuera comentarios. No hay cadenas ni `url()` en este CSS, así que no
      // hay ningún `/*` que pueda ser contenido en vez de comentario.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      /* Los saltos y sangrías, a un solo espacio. NO se tocan los espacios
         sueltos: en CSS moderno separan valores —`rgb(255 255 255 / 0.1)`— y
         operandos de `calc()`, donde quitarlos rompe la regla entera y encima
         en silencio. */
      .replace(/\s+/g, ' ')
      // Alrededor de la puntuación de bloque sí sobran siempre.
      .replace(/\s*([{};,])\s*/g, '$1')
      // Y el último `;` de cada bloque no separa nada.
      .replace(/;}/g, '}')
      .trim()
  );
}
