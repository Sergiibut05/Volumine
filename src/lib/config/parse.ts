import { chartConfigSchema, CURRENT_VERSION, type ChartConfig } from './schema';
import { resolveConfig, type ResolvedChartConfig } from './defaults';
import { migrate } from './migrations';

/*
  Un config inválido NUNCA revienta el embed.

  El embed corre dentro de la página de otra persona: si un enlace publicado
  hace tres meses trae un valor raro, lo correcto es renderizar lo que se pueda
  y reportar el problema, no dejar un hueco en blanco en su web.

  Estrategia, en este orden:
    1. migrar         config antiguo → versión actual
    2. sanear         arreglar lo arreglable, anotando cada arreglo
    3. validar        Zod; si falla ahora, el config es irrecuperable
    4. resolver       rellenar con defaults
*/

export type IssueLevel = 'warning' | 'error';

export type ConfigIssue = {
  level: IssueLevel;
  path: string;
  message: string;
};

export type ParseResult =
  | { ok: true; config: ResolvedChartConfig; issues: ConfigIssue[] }
  | { ok: false; config: null; issues: ConfigIssue[] };

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * Arregla los problemas que se pueden arreglar sin inventarse datos.
 *
 * Cada caso de aquí salió de preguntarse "¿y si un usuario pega esto?", que es
 * exactamente lo que rompe un embed un martes por la tarde.
 */
function sanitize(input: unknown, issues: ConfigIssue[]): unknown {
  if (!isObject(input)) return input;

  const raw = { ...input };
  const type = raw.type;
  const isRadial = type === 'donut' || type === 'pie';

  if (!isObject(raw.data)) return raw;
  const data = { ...raw.data };

  // Series y valores
  if (Array.isArray(data.series)) {
    data.series = data.series.map((s, si) => {
      if (!isObject(s) || !Array.isArray(s.values)) return s;
      let values = s.values as unknown[];

      // No finitos (NaN, Infinity, null, strings) → 0. Renderizar un hueco es
      // mejor que romper toda la gráfica.
      values = values.map((v, vi) => {
        const n = typeof v === 'number' ? v : Number(v);
        if (!Number.isFinite(n)) {
          issues.push({
            level: 'warning',
            path: `data.series[${si}].values[${vi}]`,
            message: `valor no numérico (${JSON.stringify(v)}), tratado como 0`,
          });
          return 0;
        }
        return n;
      });

      // Negativos: en donut/pie no tienen representación posible. Se ignoran,
      // pero se dice — nunca en silencio (docs/chart-config-schema.md).
      if (isRadial) {
        values = values.map((v, vi) => {
          if ((v as number) < 0) {
            issues.push({
              level: 'warning',
              path: `data.series[${si}].values[${vi}]`,
              message: `valor negativo (${v}) ignorado: no tiene sentido en ${type}`,
            });
            return 0;
          }
          return v;
        });
      }

      return { ...s, values };
    });
  }

  // labels y values descuadrados: se recorta al mínimo común y se avisa.
  if (Array.isArray(data.labels) && Array.isArray(data.series)) {
    const seriesLengths = (data.series as { values?: unknown[] }[])
      .map((s) => (Array.isArray(s?.values) ? s.values.length : 0))
      .filter((n) => n > 0);

    if (seriesLengths.length > 0) {
      const n = Math.min(data.labels.length, ...seriesLengths);
      const mismatched = data.labels.length !== n || seriesLengths.some((len) => len !== n);

      if (mismatched && n > 0) {
        issues.push({
          level: 'warning',
          path: 'data',
          message: `labels y values tienen longitudes distintas; se usan los primeros ${n}`,
        });
        data.labels = (data.labels as unknown[]).slice(0, n);
        data.series = (data.series as Record<string, unknown>[]).map((s) => ({
          ...s,
          values: Array.isArray(s.values) ? s.values.slice(0, n) : s.values,
          colors: Array.isArray(s.colors) ? s.colors.slice(0, n) : s.colors,
        }));
      }
    }
  }

  // donut/pie con todo a cero: no hay gráfica posible.
  if (isRadial && Array.isArray(data.series)) {
    const first = (data.series as { values?: number[] }[])[0];
    if (Array.isArray(first?.values) && first.values.every((v) => v === 0)) {
      issues.push({
        level: 'error',
        path: 'data.series[0].values',
        message: 'todos los valores son 0: no se puede dibujar un donut',
      });
    }
  }

  raw.data = data;
  return raw;
}

/** Punto de entrada. Nunca lanza. */
export function parseConfig(input: unknown): ParseResult {
  const issues: ConfigIssue[] = [];

  const migrated = migrate(input, issues);
  const cleaned = sanitize(migrated, issues);

  const result = chartConfigSchema.safeParse(cleaned);
  if (!result.success) {
    for (const issue of result.error.issues) {
      issues.push({
        level: 'error',
        path: issue.path.join('.') || '(raíz)',
        message: issue.message,
      });
    }
    return { ok: false, config: null, issues };
  }

  if (issues.some((i) => i.level === 'error')) {
    return { ok: false, config: null, issues };
  }

  return {
    ok: true,
    config: resolveConfig(result.data as ChartConfig),
    issues,
  };
}

export { CURRENT_VERSION };
