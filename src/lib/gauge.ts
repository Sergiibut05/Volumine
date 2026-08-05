import type { ResolvedChartConfig } from './config/defaults';

/*
  La cifra que va en el centro del medidor.

  Vive aquí, fuera del renderer, y no la saca ningún callback: se deduce del
  config y punto. Eso permite que el embed la escriba en el HTML del servidor
  —está antes de que arranque WebGL, y sigue estando si WebGL no arranca— y que
  el editor la calcule con la misma función. Un solo sitio, mismo texto en los
  dos, sin manera de que se desincronicen.

  En 3D no se puede pintar: el bundle no lleva ninguna fuente ni cabe en el
  presupuesto (ADR 0005). En HTML además se lee más nítido y se puede copiar.
*/

export type GaugeReadout = {
  /** La cifra grande. Ya formateada y con unidad. */
  value: string;
  /** El «de 100» de debajo. `null` cuando sobra. */
  scale: string | null;
  /** Lo que se ha llenado del arco, 0..1. */
  progress: number;
  /** La suma se pasa del tope: el arco está lleno y sobra dato. */
  overflow: boolean;
};

export function gaugeReadout(config: ResolvedChartConfig): GaugeReadout {
  const { unit, decimals, locale } = config.data.format;
  const max = config.style.gauge.max;
  const values = config.data.series[0]?.values ?? [];
  const total = values.reduce((sum, v) => (Number.isFinite(v) && v > 0 ? sum + v : sum), 0);

  const format = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  /*
    «94% de 100%» no lo escribiría nadie. Un porcentaje ya dice contra qué va,
    así que con unidad `%` y tope 100 la segunda línea se calla. En cuanto el
    tope es otro —un 60% de ocupación máxima, por ejemplo— vuelve, porque ahí
    el tope sí es información.
  */
  const redundant = unit === '%' && max === 100;

  return {
    value: `${format.format(total)}${unit}`,
    scale: redundant ? null : `de ${format.format(max)}${unit}`,
    progress: max > 0 ? Math.min(1, Math.max(0, total / max)) : 0,
    /* Llenarse del todo y pasarse se ven IGUAL en el dibujo —el arco no puede
       dar más de sí—, así que hay que distinguirlos por fuera o nadie entiende
       por qué 100 y 240 pintan lo mismo. */
    overflow: max > 0 && total > max,
  };
}
