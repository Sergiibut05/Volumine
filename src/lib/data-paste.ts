/*
  Pegar datos desde una hoja de cálculo.

  Es LA forma en que la gente va a meter sus números. Nadie teclea veinte celdas
  a mano teniendo el Excel abierto al lado, así que esto tiene que tragar lo que
  salga del portapapeles sin pedir que lo limpien antes.

  Lo que llega de verdad del portapapeles, y que hay que aguantar:
  · Excel y Sheets copian TSV; un CSV exportado llega con comas o punto y coma.
  · **Números en formato español**: "1.234,56" es mil doscientos treinta y
    cuatro coma cincuenta y seis, no uno coma dos tres cuatro. Es el caso más
    importante y el que rompe cualquier parseo ingenuo.
  · Símbolos de moneda, porcentajes, espacios finos como separador de miles.
  · Fila de cabecera, o no.
  · Celdas vacías en medio.
*/

/**
 * Qué se ha tenido que arreglar al leer la tabla.
 *
 * Va como CÓDIGO y no como frase hecha: esto se le enseña al usuario y el
 * usuario tiene idioma. Una cadena en español escrita aquí dentro obligaría a
 * traducir en el sitio equivocado — este módulo no sabe quién está mirando, y
 * no tiene por qué saberlo.
 */
export type ParseIssue = { code: 'empty-cells'; count: number } | { code: 'no-header' };

export type ParsedTable = {
  /** Nombres de fila: las categorías. */
  labels: string[];
  /** Nombres de columna: series en barras, periodos en una carrera. */
  columns: string[];
  /** `values[columna][fila]`, que es como lo consume `data.series`. */
  values: number[][];
  /** Qué se ha tenido que arreglar. Se le enseña al usuario. */
  issues: ParseIssue[];
  /** Si se ha tomado la primera fila como cabecera. El usuario puede cambiarlo. */
  usedHeader: boolean;
};

/**
 * ¿La primera fila es cabecera?
 *
 * Lo obvio es "sus celdas no son números", y funciona hasta que alguien pega una
 * tabla por años: `2022` y `2023` SON números, y esa es justo la forma de una
 * carrera de barras. Por eso hay un segundo criterio: enteros en rango de año.
 *
 * Sigue siendo una conjetura, así que se devuelve en `usedHeader` y la interfaz
 * deja cambiarla. Adivinar bien casi siempre y dejar corregir es mejor que
 * preguntar siempre.
 */
function looksLikeHeader(cells: string[], bodyRows: string[][]): boolean {
  if (cells.length === 0 || bodyRows.length === 0) return false;

  const parsed = cells.map(parseNumber);
  if (parsed.every((value) => value === null)) return true;

  const allYears = parsed.every(
    (value) => value !== null && Number.isInteger(value) && value >= 1000 && value <= 3000,
  );
  if (!allYears) return false;

  /* Años en la primera fila pero también en el resto: entonces no es cabecera,
     son datos que casualmente caen en ese rango. */
  const bodyAlsoYears = bodyRows.every((row) =>
    row.slice(1).every((cell) => {
      const value = parseNumber(cell);
      return value !== null && Number.isInteger(value) && value >= 1000 && value <= 3000;
    }),
  );
  return !bodyAlsoYears;
}

/**
 * Convierte un texto en número aguantando los formatos que salen de una hoja.
 *
 * La regla del separador decimal: si aparecen coma y punto, el ÚLTIMO de los dos
 * es el decimal — vale para "1.234,56" y para "1,234.56" sin tener que saber el
 * idioma de quien copió. Si solo aparece uno, se mira cuántos dígitos lleva
 * detrás: tres exactos son miles ("1.234"), cualquier otra cosa es decimal
 * ("1,5"). Es ambiguo por naturaleza —"1.234" puede ser mil o uno coma dos— y
 * esta es la lectura que acierta más veces con datos reales.
 */
export function parseNumber(input: string): number | null {
  const raw = input.trim();
  if (raw === '') return null;

  // Fuera moneda, porcentaje, espacios de todo tipo y el signo de más.
  const cleaned = raw.replace(/[^\d.,\-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized: string;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalAt = Math.max(lastComma, lastDot);
    const thousands = decimalAt === lastComma ? '.' : ',';
    normalized =
      cleaned.slice(0, decimalAt).split(thousands).join('') +
      '.' +
      cleaned.slice(decimalAt + 1).replace(/[.,]/g, '');
  } else if (lastComma >= 0 || lastDot >= 0) {
    const at = Math.max(lastComma, lastDot);
    const separator = cleaned[at];
    const after = cleaned.length - at - 1;
    const occurrences = cleaned.split(separator).length - 1;

    // Tres dígitos detrás y un solo separador: miles. Si hay varios, seguro.
    const isThousands = after === 3 && (occurrences > 1 || cleaned.length > 4);
    normalized = isThousands
      ? cleaned.split(separator).join('')
      : cleaned.slice(0, at) + '.' + cleaned.slice(at + 1);
  } else {
    normalized = cleaned;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Parte una línea por el separador que de verdad esté usando. */
function splitCells(line: string, separator: string): string[] {
  return line.split(separator).map((cell) => cell.replace(/^"|"$/g, '').trim());
}

/** Tabulador si lo hay; si no, punto y coma o coma, lo que más se repita. */
function detectSeparator(lines: string[]): string {
  const sample = lines.slice(0, 5).join('\n');
  if (sample.includes('\t')) return '\t';
  const semicolons = (sample.match(/;/g) ?? []).length;
  const commas = (sample.match(/,/g) ?? []).length;
  return semicolons >= commas && semicolons > 0 ? ';' : ',';
}

/**
 * Lee una tabla pegada. Devuelve `null` si no hay nada aprovechable.
 *
 * Da por hecho que la primera columna son las etiquetas y el resto valores, que
 * es como está montada cualquier hoja de la que se copian datos para una
 * gráfica.
 */
export function parsePastedTable(
  text: string,
  options: {
    header?: boolean;
    /*
      Cómo llamar a lo que llega SIN NOMBRE: «Serie 2», «Fila 7».

      Las pone quien llama porque son palabras, y este módulo no sabe en qué
      idioma está mirando nadie. Los valores por defecto están en inglés para
      que llamarlo desde un test o un script siga dando algo legible.
    */
    names?: { column: string; row: string };
  } = {},
): ParsedTable | null {
  const names = options.names ?? { column: 'Series', row: 'Row' };

  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => line.trim() !== '');

  if (lines.length === 0) return null;

  const separator = detectSeparator(lines);
  const rows = lines.map((line) => splitCells(line, separator));
  const width = rows.reduce((most, row) => Math.max(most, row.length), 0);
  if (width < 2) return null;

  const issues: ParseIssue[] = [];

  const hasHeader =
    options.header ?? (rows.length > 1 && looksLikeHeader(rows[0].slice(1), rows.slice(1)));

  const header = hasHeader ? rows[0] : null;
  const body = hasHeader ? rows.slice(1) : rows;
  if (body.length === 0) return null;

  const columnCount = width - 1;
  const columns = Array.from({ length: columnCount }, (_, i) => {
    const name = header?.[i + 1]?.trim();
    /* Sin cabecera, la columna se numera con el nombre que venga en `names`.
       Esto ACABA EN LA GRÁFICA como nombre de serie, así que a partir de aquí
       es un dato del usuario: no vuelve a cambiar si toca el selector de
       idioma. Puede reescribirlo en la tabla. */
    return name && name !== '' ? name : `${names.column} ${i + 1}`;
  });

  const labels: string[] = [];
  const values: number[][] = Array.from({ length: columnCount }, () => []);
  let emptyCells = 0;

  body.forEach((row, rowIndex) => {
    const label = row[0]?.trim();
    labels.push(label && label !== '' ? label : `${names.row} ${rowIndex + 1}`);

    for (let c = 0; c < columnCount; c += 1) {
      const parsed = parseNumber(row[c + 1] ?? '');
      if (parsed === null) emptyCells += 1;
      values[c].push(parsed ?? 0);
    }
  });

  if (emptyCells > 0) issues.push({ code: 'empty-cells', count: emptyCells });
  if (!hasHeader) issues.push({ code: 'no-header' });

  return { labels, columns, values, issues, usedHeader: hasHeader };
}

/** ¿Esto que se ha pegado es una tabla, o es texto para una sola celda? */
export function looksLikeTable(text: string): boolean {
  return text.includes('\t') || /\n/.test(text.trim());
}
