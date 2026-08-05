import { describe, it, expect } from 'vitest';
import { parseNumber, parsePastedTable, looksLikeTable } from './data-paste';

describe('parseNumber', () => {
  it('lee números normales', () => {
    expect(parseNumber('42')).toBe(42);
    expect(parseNumber('  7  ')).toBe(7);
    expect(parseNumber('-13')).toBe(-13);
    expect(parseNumber('0')).toBe(0);
  });

  it('lee el formato ESPAÑOL, que es el que más va a llegar', () => {
    // "1.234,56" es mil doscientos treinta y cuatro coma cincuenta y seis.
    expect(parseNumber('1.234,56')).toBeCloseTo(1234.56, 6);
    expect(parseNumber('12.345.678,9')).toBeCloseTo(12345678.9, 4);
    expect(parseNumber('0,5')).toBeCloseTo(0.5, 6);
    expect(parseNumber('1,5')).toBeCloseTo(1.5, 6);
  });

  it('lee el formato inglés', () => {
    expect(parseNumber('1,234.56')).toBeCloseTo(1234.56, 6);
    expect(parseNumber('12,345,678.9')).toBeCloseTo(12345678.9, 4);
    expect(parseNumber('0.5')).toBeCloseTo(0.5, 6);
  });

  it('quita moneda, porcentaje y espacios de miles', () => {
    expect(parseNumber('1.234 €')).toBe(1234);
    expect(parseNumber('$1,999')).toBe(1999);
    expect(parseNumber('42 %')).toBe(42);
    expect(parseNumber('12 345')).toBe(12345);
  });

  it('resuelve el separador ambiguo por el número de dígitos', () => {
    // Tres dígitos detrás: miles.
    expect(parseNumber('1.234')).toBe(1234);
    expect(parseNumber('1,234')).toBe(1234);
    // Uno o dos: decimal.
    expect(parseNumber('1,2')).toBeCloseTo(1.2, 6);
    expect(parseNumber('1.25')).toBeCloseTo(1.25, 6);
  });

  it('devuelve null cuando no hay número, en vez de NaN', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('   ')).toBeNull();
    expect(parseNumber('n/d')).toBeNull();
    expect(parseNumber('—')).toBeNull();
    expect(parseNumber('-')).toBeNull();
  });
});

describe('parsePastedTable', () => {
  it('lee lo que copia Excel: TSV con cabecera', () => {
    const table = parsePastedTable('País\t2022\t2023\nEspaña\t10\t14\nFrancia\t8\t9');

    expect(table).not.toBeNull();
    expect(table!.labels).toEqual(['España', 'Francia']);
    expect(table!.columns).toEqual(['2022', '2023']);
    expect(table!.values).toEqual([
      [10, 8],
      [14, 9],
    ]);
  });

  it('sin cabecera, numera las columnas y lo dice', () => {
    const table = parsePastedTable('España\t10\nFrancia\t8');

    expect(table!.labels).toEqual(['España', 'Francia']);
    expect(table!.columns).toEqual(['Serie 1']);
    expect(table!.issues.join(' ')).toContain('cabecera');
  });

  it('lee CSV con punto y coma, que es lo que exporta el Excel español', () => {
    const table = parsePastedTable('Ciudad;Ventas\nMadrid;1.234\nBarcelona;987');

    expect(table!.labels).toEqual(['Madrid', 'Barcelona']);
    expect(table!.values[0]).toEqual([1234, 987]);
  });

  it('lee CSV con comas cuando no hay tabuladores ni punto y coma', () => {
    const table = parsePastedTable('Ciudad,Ventas\nMadrid,120\nBarcelona,98');
    expect(table!.values[0]).toEqual([120, 98]);
  });

  it('una celda vacía cuenta como 0 y se avisa', () => {
    const table = parsePastedTable('X\tA\nuno\t5\ndos\t');

    expect(table!.values[0]).toEqual([5, 0]);
    expect(table!.issues.join(' ')).toContain('0');
  });

  it('rellena las filas cortas en vez de descuadrar las columnas', () => {
    const table = parsePastedTable('X\tA\tB\nuno\t5\t6\ndos\t7');
    expect(table!.values[1]).toEqual([6, 0]);
  });

  it('las filas sin nombre reciben uno, para que no queden en blanco', () => {
    const table = parsePastedTable('X\tA\n\t5\n\t6');
    expect(table!.labels).toEqual(['Fila 1', 'Fila 2']);
  });

  it('se salta las líneas en blanco del final, que siempre las hay', () => {
    const table = parsePastedTable('X\tA\nuno\t5\n\n\n');
    expect(table!.labels).toEqual(['uno']);
  });

  it('devuelve null si no hay nada aprovechable', () => {
    expect(parsePastedTable('')).toBeNull();
    expect(parsePastedTable('   \n  ')).toBeNull();
    // Una sola columna no es una tabla de datos.
    expect(parsePastedTable('hola\nadiós')).toBeNull();
  });

  it('aguanta una tabla grande sin romperse', () => {
    const rows = Array.from({ length: 200 }, (_, i) => `Fila ${i}\t${i}\t${i * 2}`);
    const table = parsePastedTable(`X\tA\tB\n${rows.join('\n')}`);

    expect(table!.labels).toHaveLength(200);
    expect(table!.values).toHaveLength(2);
    expect(table!.values[1][199]).toBe(398);
  });
});

describe('looksLikeTable', () => {
  it('distingue una tabla de un texto suelto', () => {
    expect(looksLikeTable('a\tb')).toBe(true);
    expect(looksLikeTable('uno\ndos')).toBe(true);
    expect(looksLikeTable('Madrid')).toBe(false);
    expect(looksLikeTable('42')).toBe(false);
  });
});

describe('detección de cabecera', () => {
  it('una tabla por AÑOS lleva cabecera aunque los años sean números', () => {
    /* Es la forma exacta de una carrera de barras, y el criterio ingenuo
       ("la cabecera no son números") fallaba justo aquí. */
    const table = parsePastedTable('Navegador\t2021\t2022\nChrome\t63\t65\nSafari\t19\t19');

    expect(table!.usedHeader).toBe(true);
    expect(table!.columns).toEqual(['2021', '2022']);
    expect(table!.labels).toEqual(['Chrome', 'Safari']);
    expect(table!.values).toEqual([
      [63, 19],
      [65, 19],
    ]);
  });

  it('si TODO son años, son datos y no cabecera', () => {
    const table = parsePastedTable('a\t2020\t2021\nb\t2022\t2023');
    expect(table!.usedHeader).toBe(false);
  });

  it('se puede forzar a mano en los dos sentidos', () => {
    const sin = parsePastedTable('País\tA\nEspaña\t10', { header: false });
    expect(sin!.labels).toEqual(['País', 'España']);

    const con = parsePastedTable('uno\t1\ndos\t2', { header: true });
    expect(con!.columns).toEqual(['1']);
    expect(con!.labels).toEqual(['dos']);
  });
});
