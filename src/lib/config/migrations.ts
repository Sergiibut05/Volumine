import { CURRENT_VERSION } from './schema';
import type { ConfigIssue } from './parse';

/*
  Migraciones de ChartConfig.

  Existe una regla y solo una: **un link publicado tiene que seguir funcionando
  para siempre**. Cuando se sube `v`, se añade aquí una función que lleva de la
  versión anterior a la nueva, y se añade su test en config.test.ts con un
  config real de la versión antigua.

  No hay migraciones todavía porque solo existe la v1. El andamiaje está puesto
  para que añadir la primera sea trivial y nadie tenga la tentación de
  "arreglarlo luego".
*/

type Migration = (config: Record<string, unknown>) => Record<string, unknown>;

/** Clave = versión de origen. `migrations[1]` lleva de v1 a v2. */
const migrations: Record<number, Migration> = {
  // 1: (c) => ({ ...c, v: 2, style: { ...renombrado } }),
};

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

export function migrate(input: unknown, issues: ConfigIssue[]): unknown {
  if (!isObject(input)) return input;

  const version = input.v;

  if (typeof version !== 'number' || !Number.isInteger(version)) {
    issues.push({
      level: 'error',
      path: 'v',
      message: 'falta la versión del esquema o no es un entero',
    });
    return input;
  }

  if (version > CURRENT_VERSION) {
    // Config de una versión futura: la sirvió un deploy más nuevo del que
    // estamos ejecutando. No podemos adivinar; lo intentamos igual y avisamos.
    issues.push({
      level: 'warning',
      path: 'v',
      message: `config de la versión ${version}, esta build entiende hasta la ${CURRENT_VERSION}`,
    });
    return input;
  }

  let current = input;
  let v = version;

  while (v < CURRENT_VERSION) {
    const step = migrations[v];
    if (!step) {
      issues.push({
        level: 'error',
        path: 'v',
        message: `no hay migración de la versión ${v} a la ${v + 1}`,
      });
      return current;
    }
    current = step(current);
    v += 1;
  }

  return current;
}
