import { chartConfigSchema, CURRENT_VERSION, type ChartConfig } from './schema';
import { resolveConfig, type ResolvedChartConfig } from './defaults';
import { migrate } from './migrations';
import { applyTheme } from '../themes';

/*
  Un config inválido NUNCA revienta el embed.

  El embed corre dentro de la página de otra persona: si un enlace publicado
  hace tres meses trae un valor raro, lo correcto es renderizar lo que se pueda
  y reportar el problema, no dejar un hueco en blanco en su web.

  Estrategia, en este orden:
    1. migrar         config antiguo → versión actual
    2. sanear         arreglar lo arreglable, anotando cada arreglo
    3. validar        Zod; si falla ahora, el config es irrecuperable
    4. tema           el preset rellena style y scene
    5. resolver       rellenar el resto con defaults
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
  const isGauge = type === 'gauge';
  /* El medidor se parece al anillo en casi todo —reparte un arco, mira solo la
     primera serie, no sabe qué hacer con un negativo— salvo en una cosa, y es
     importante: para él el cero SÍ es un valor. Ver más abajo. */
  const radialish = isRadial || isGauge;

  if (!isObject(raw.data)) return raw;
  const data = { ...raw.data };

  /* Una escala que no sube no es una escala. Se avisa y se cae al default en
     vez de dar error: es mejor enseñar el medidor sobre 100 que dejar un hueco
     en blanco en la página de alguien. */
  if (isGauge && isObject(raw.style) && isObject(raw.style.gauge)) {
    const gauge = { ...raw.style.gauge };
    const max = gauge.max;
    if (typeof max === 'number' && (!Number.isFinite(max) || max <= 0)) {
      issues.push({
        level: 'warning',
        path: 'style.gauge.max',
        message: `el tope de la escala (${max}) tiene que ser mayor que 0; se usa 100`,
      });
      delete gauge.max;
      raw.style = { ...raw.style, gauge };
    }
  }

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

      // Negativos: en donut/pie/medidor no tienen representación posible. Se
      // ignoran, pero se dice — nunca en silencio (docs/chart-config-schema.md).
      if (radialish) {
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

  // labels y values descuadrados
  if (Array.isArray(data.labels) && Array.isArray(data.series)) {
    const seriesLengths = (data.series as { values?: unknown[] }[])
      .map((s) => (Array.isArray(s?.values) ? s.values.length : 0))
      .filter((n) => n > 0);

    if (seriesLengths.length > 0 && radialish) {
      // Al mínimo común: el anillo solo usa una serie y no hay hueco que dibujar.
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
    } else if (seriesLengths.length > 0) {
      /* En barras manda `labels`, que es lo que fija cuántas categorías hay. Una
         serie corta se rellena con ceros —un hueco, que se ve— en vez de recortar
         a la más corta: eso borraría categorías buenas de las demás series por
         culpa de una incompleta. */
      const n = (data.labels as unknown[]).length;
      if (seriesLengths.some((len) => len !== n)) {
        issues.push({
          level: 'warning',
          path: 'data',
          message: `hay series con menos de ${n} valores; los que falten cuentan como 0`,
        });
        data.series = (data.series as Record<string, unknown>[]).map((s) => {
          const values = s.values;
          if (!Array.isArray(values)) return s;
          return { ...s, values: Array.from({ length: n }, (_, i) => values[i] ?? 0) };
        });
      }
    }
  }

  /* Todo a cero: no hay reparto ni escala que dibujar.

     El medidor queda fuera, y esta es la diferencia que lo separa del anillo.
     Un anillo con todo a cero no tiene NADA que repartir, así que es un error.
     Un medidor con todo a cero vale «0 de 100», que es una lectura perfectamente
     buena y encima frecuente: el primer día de una campaña, un contador recién
     puesto a cero. Tratarlo como error dejaría el hueco en blanco justo cuando
     el dato es correcto. */
  if (Array.isArray(data.series) && !isGauge) {
    const series = data.series as { values?: number[] }[];
    // El anillo solo mira la primera serie; las barras, todas.
    const relevant = isRadial ? series.slice(0, 1) : series;
    const allZero =
      relevant.length > 0 &&
      relevant.every((s) => Array.isArray(s?.values) && s.values.every((v) => v === 0));

    if (allZero) {
      issues.push({
        level: 'error',
        path: isRadial ? 'data.series[0].values' : 'data.series',
        message: isRadial
          ? 'todos los valores son 0: no se puede dibujar un donut'
          : 'todos los valores son 0: no hay escala con la que dibujar barras',
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

  /* El tema se resuelve AQUÍ, no en el editor.
     `theme` es un preset y lo de abajo lo sobreescribe punto a punto
     (docs/chart-config-schema.md). Resolverlo al renderizar es lo que hace que
     un link con `{"theme":"papel"}` y nada más se vea como papel, y que mejorar
     un tema mejore las gráficas ya publicadas. */
  const validated = result.data as ChartConfig;
  const themed = validated.theme ? applyTheme(validated, validated.theme) : validated;

  return {
    ok: true,
    config: resolveConfig(themed),
    issues,
  };
}

export { CURRENT_VERSION };
