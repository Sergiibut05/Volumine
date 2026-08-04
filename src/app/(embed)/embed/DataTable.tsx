import type { ResolvedChartConfig } from '@/lib/config/defaults';

/*
  Los datos en texto, siempre presentes en el DOM del embed.

  Una gráfica 3D es inaccesible por naturaleza: no hay forma de que un lector de
  pantalla interprete geometría con luz. Esta tabla es la versión que sí se puede
  leer, y además es lo que ve alguien sin WebGL. Oculta visualmente, nunca
  display:none (ADR 0005 y docs/DESIGN.md).

  Se renderiza en servidor: cero coste de JS.
*/

export function DataTable({ config }: { config: ResolvedChartConfig }) {
  const series = config.data.series[0];
  if (!series) return null;

  const total = series.values.reduce((sum, v) => sum + (v > 0 ? v : 0), 0);
  const { locale, decimals, unit } = config.data.format;

  const format = (value: number) =>
    `${new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value)}${unit}`;

  return (
    <table className="sr-only">
      <caption>{config.title ?? 'Datos de la gráfica'}</caption>
      <thead>
        <tr>
          <th scope="col">Categoría</th>
          <th scope="col">Valor</th>
          <th scope="col">Porcentaje</th>
        </tr>
      </thead>
      <tbody>
        {config.data.labels.map((label, i) => {
          const value = series.values[i] ?? 0;
          return (
            <tr key={label + i}>
              <th scope="row">{label}</th>
              <td>{format(value)}</td>
              <td>{total > 0 ? `${((value / total) * 100).toFixed(1)}%` : '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Resumen para el `aria-label` del canvas, generado desde los datos. */
export function describeChart(config: ResolvedChartConfig): string {
  const series = config.data.series[0];
  if (!series) return 'Gráfica sin datos';

  const total = series.values.reduce((sum, v) => sum + (v > 0 ? v : 0), 0);
  const parts = config.data.labels.map((label, i) => {
    const value = series.values[i] ?? 0;
    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
    return `${label} ${pct}%`;
  });

  const kind = config.type === 'pie' ? 'Gráfica de tarta' : 'Gráfica de anillo';
  return `${kind}${config.title ? ` — ${config.title}` : ''}: ${parts.join(', ')}`;
}
