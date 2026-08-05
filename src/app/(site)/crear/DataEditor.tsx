'use client';

import { useRef, useState } from 'react';
import { parsePastedTable, looksLikeTable, type ParsedTable } from '@/lib/data-paste';
import type { ChartConfig } from '@/lib/config/schema';

/*
  La tabla de datos del editor.

  UNA SOLA TABLA PARA TODOS LOS TIPOS
  -----------------------------------
  Filas = categorías, columnas = series. Y aquí está lo bueno: en una CARRERA DE
  BARRAS las columnas son PERIODOS, porque el contrato guarda cada instante como
  una serie (ver renderer/geometry/bar-race.ts).

  Eso significa que la tabla que la gente ya tiene en su Excel —países en las
  filas, años en las columnas— se pega tal cual y sale una carrera. No hay nada
  que explicar ni un formato nuevo que aprender: solo cambia lo que dice la
  cabecera, "Periodo" en vez de "Serie".

  El globo añade dos columnas de coordenadas, porque un dato geográfico sin sitio
  no se puede dibujar.

  PEGAR ES LA VÍA PRINCIPAL, no un extra. Nadie teclea veinte celdas teniendo la
  hoja abierta al lado.
*/

type Props = {
  config: ChartConfig;
  onChange: (data: ChartConfig['data']) => void;
};

const MAX_ROWS = 200;

export function DataEditor({ config, onChange }: Props) {
  const [notice, setNotice] = useState<string | null>(null);
  const [lastPaste, setLastPaste] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { labels, series } = config.data;
  const coords = config.data.coords;
  const isRace = config.type === 'bar-race';
  const isGlobe = config.type === 'globe';
  /* El anillo y la tarta reparten UN total: una segunda serie no se dibujaría,
     así que ofrecerla sería mentir. */
  const multiColumn = config.type === 'bar' || isRace;
  const columnWord = isRace ? 'Periodo' : 'Serie';

  const apply = (next: Partial<ChartConfig['data']>) =>
    onChange({ ...config.data, ...next });

  // ── edición celda a celda ────────────────────────────────────────────────

  const setLabel = (row: number, value: string) => {
    const next = [...labels];
    next[row] = value;
    apply({ labels: next });
  };

  const setValue = (row: number, column: number, raw: string) => {
    const parsed = raw.trim() === '' ? 0 : Number(raw.replace(',', '.'));
    const next = series.map((serie, s) =>
      s === column
        ? { ...serie, values: serie.values.map((v, i) => (i === row ? parsed : v)) }
        : serie,
    );
    apply({ series: next });
  };

  const setColumnName = (column: number, name: string) => {
    apply({ series: series.map((s, i) => (i === column ? { ...s, name } : s)) });
  };

  const setCoord = (row: number, which: 0 | 1, raw: string) => {
    const value = Number(raw.replace(',', '.'));
    const next: [number, number][] = labels.map(
      (_, i) => (coords?.[i] ?? [0, 0]) as [number, number],
    );
    next[row] = which === 0 ? [value, next[row][1]] : [next[row][0], value];
    apply({ coords: next });
  };

  const addRow = () => {
    if (labels.length >= MAX_ROWS) return;
    apply({
      labels: [...labels, `Categoría ${labels.length + 1}`],
      series: series.map((s) => ({ ...s, values: [...s.values, 0] })),
      coords: coords ? [...coords, [0, 0]] : undefined,
    });
  };

  const removeRow = (row: number) => {
    if (labels.length <= 1) return;
    apply({
      labels: labels.filter((_, i) => i !== row),
      series: series.map((s) => ({ ...s, values: s.values.filter((_, i) => i !== row) })),
      coords: coords?.filter((_, i) => i !== row),
    });
  };

  const addColumn = () => {
    if (series.length >= 20) return;
    apply({
      series: [
        ...series,
        { name: `${columnWord} ${series.length + 1}`, values: labels.map(() => 0) },
      ],
    });
  };

  const removeColumn = (column: number) => {
    if (series.length <= 1) return;
    apply({ series: series.filter((_, i) => i !== column) });
  };

  // ── pegar ────────────────────────────────────────────────────────────────

  const useTable = (table: ParsedTable) => {
    const rows = Math.min(table.labels.length, MAX_ROWS);
    apply({
      labels: table.labels.slice(0, rows),
      series: table.values.map((values, i) => ({
        name: table.columns[i],
        values: values.slice(0, rows),
      })),
      // Las coordenadas viejas ya no valen: son de otras filas.
      coords: undefined,
    });

    const parts = [`${rows} fila(s) y ${table.values.length} columna(s).`, ...table.issues];
    if (table.usedHeader) parts.push('Se ha usado la primera fila como cabecera.');
    setNotice(parts.join(' '));
  };

  const ingest = (text: string, header?: boolean) => {
    const table = parsePastedTable(text, header === undefined ? {} : { header });
    if (!table) {
      setNotice('No he sabido leer eso. Hacen falta al menos dos columnas.');
      return;
    }
    setLastPaste(text);
    useTable(table);
  };

  const onPaste = (event: React.ClipboardEvent) => {
    const text = event.clipboardData.getData('text/plain');
    // Un valor suelto se pega en su celda, como espera cualquiera.
    if (!looksLikeTable(text)) return;
    event.preventDefault();
    ingest(text);
  };

  const flipHeader = () => {
    if (!lastPaste) return;
    const current = parsePastedTable(lastPaste);
    ingest(lastPaste, !(current?.usedHeader ?? false));
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    ingest(await file.text());
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="data" onPaste={onPaste}>
      <div className="data-scroll">
        <table>
          <thead>
            <tr>
              <th className="corner">Categoría</th>
              {series.map((serie, c) => (
                <th key={c}>
                  {multiColumn ? (
                    <input
                      value={serie.name ?? ''}
                      placeholder={`${columnWord} ${c + 1}`}
                      onChange={(e) => setColumnName(c, e.target.value)}
                      aria-label={`Nombre de ${columnWord.toLowerCase()} ${c + 1}`}
                    />
                  ) : (
                    <span>Valor</span>
                  )}
                  {multiColumn && series.length > 1 && (
                    <button
                      type="button"
                      className="kill"
                      onClick={() => removeColumn(c)}
                      aria-label={`Quitar ${columnWord.toLowerCase()} ${c + 1}`}
                    >
                      ×
                    </button>
                  )}
                </th>
              ))}
              {isGlobe && (
                <>
                  <th>Latitud</th>
                  <th>Longitud</th>
                </>
              )}
              <th className="gutter" />
            </tr>
          </thead>

          <tbody>
            {labels.map((label, row) => (
              <tr key={row}>
                <th scope="row">
                  <input
                    value={label}
                    onChange={(e) => setLabel(row, e.target.value)}
                    aria-label={`Nombre de la fila ${row + 1}`}
                  />
                </th>

                {series.map((serie, c) => (
                  <td key={c}>
                    <input
                      inputMode="decimal"
                      value={serie.values[row] ?? 0}
                      onChange={(e) => setValue(row, c, e.target.value)}
                      aria-label={`${label}, ${serie.name ?? `${columnWord} ${c + 1}`}`}
                    />
                  </td>
                ))}

                {isGlobe && (
                  <>
                    <td>
                      <input
                        inputMode="decimal"
                        placeholder="—"
                        value={coords?.[row]?.[0] ?? ''}
                        onChange={(e) => setCoord(row, 0, e.target.value)}
                        aria-label={`Latitud de ${label}`}
                      />
                    </td>
                    <td>
                      <input
                        inputMode="decimal"
                        placeholder="—"
                        value={coords?.[row]?.[1] ?? ''}
                        onChange={(e) => setCoord(row, 1, e.target.value)}
                        aria-label={`Longitud de ${label}`}
                      />
                    </td>
                  </>
                )}

                <td className="gutter">
                  {labels.length > 1 && (
                    <button
                      type="button"
                      className="kill"
                      onClick={() => removeRow(row)}
                      aria-label={`Quitar ${label}`}
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="data-actions">
        <button type="button" onClick={addRow}>
          + Fila
        </button>
        {multiColumn && (
          <button type="button" onClick={addColumn}>
            + {columnWord}
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => fileRef.current?.click()}>
          Abrir CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>

      <p className="data-hint">
        Copia las celdas de tu hoja de cálculo y pégalas aquí.
        {isRace &&
          ' Cada columna es un periodo: países en las filas, años en las columnas.'}
      </p>

      {notice && (
        <p className="data-notice">
          {notice}{' '}
          {lastPaste && (
            <button type="button" className="linky" onClick={flipHeader}>
              Cambiar cabecera
            </button>
          )}
        </p>
      )}
    </div>
  );
}
