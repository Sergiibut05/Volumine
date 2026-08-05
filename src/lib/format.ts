import type { ResolvedChartConfig } from './config/defaults';

/*
  EL formateador de cifras. Uno solo, para todos.

  Antes había tres: el del tooltip del embed, el de la cifra del medidor y el
  de la tabla accesible. Con las etiquetas de datos iban a ser cuatro, y cuatro
  sitios que formatean el mismo número son cuatro sitios que pueden discrepar —
  el tooltip diciendo «1.234 €» y la etiqueta «1234» sobre la misma pieza.

  `Intl` viene en el navegador: esto no añade nada al bundle.
*/

export type Formatter = {
  /** El número con su unidad. Lo que se enseña. */
  value: (n: number) => string;
  /** Un porcentaje ya redondeado, con el signo. */
  percent: (fraction: number) => string;
};

const cache = new WeakMap<ResolvedChartConfig, Formatter>();

/**
 * El formateador de un config.
 *
 * Memoizado por config: construir un `Intl.NumberFormat` no es gratis y las
 * etiquetas lo piden en cada frame.
 */
export function formatter(config: ResolvedChartConfig): Formatter {
  const hit = cache.get(config);
  if (hit) return hit;

  const { unit, decimals, locale } = config.data.format;
  const numero = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const made: Formatter = {
    value: (n) => `${numero.format(n)}${unit}`,
    /* Un decimal y no cero: con enteros, tres porciones de 33,3% salen «33%,
       33%, 33%» y no suman 100, que es lo primero que mira quien desconfía de
       una gráfica. Sin el «,0» cuando es redondo. */
    percent: (fraction) => {
      const pct = fraction * 100;
      const texto = Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
      return `${texto.replace('.', ',')}%`;
    },
  };

  cache.set(config, made);
  return made;
}
