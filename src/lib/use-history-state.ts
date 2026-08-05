'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  canRedo,
  canUndo,
  createHistory,
  record,
  redo,
  undo,
  type History,
} from './history';

/*
  `useState` con deshacer y rehacer.

  Sustituye a un `useState` normal sin cambiar cómo se usa: acepta un valor o un
  actualizador, igual que el de siempre. Toda la lógica de pila y de agrupado
  vive en `history.ts`, que es puro y está testeado; aquí solo está el pegamento
  con React y los atajos de teclado.
*/

export type HistoryState<T> = {
  value: T;
  /** Igual que un `setState`: valor o actualizador. */
  set: (next: T | ((current: T) => T), options?: { coalesce?: boolean }) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

export function useHistoryState<T>(initial: T): HistoryState<T> {
  const [history, setHistory] = useState<History<T>>(() =>
    createHistory(initial, performance.now()),
  );

  const set = useCallback(
    (next: T | ((current: T) => T), options: { coalesce?: boolean } = {}) => {
      setHistory((current) => {
        const value =
          typeof next === 'function' ? (next as (c: T) => T)(current.present) : next;
        return record(current, value, performance.now(), options);
      });
    },
    [],
  );

  const doUndo = useCallback(() => setHistory(undo), []);
  const doRedo = useCallback(() => setHistory(redo), []);

  /*
    Atajos. `Ctrl+Z` y `Ctrl+Shift+Z` en todas partes, `Cmd` en Mac, y también
    `Ctrl+Y`, que es lo que tiene en los dedos mucha gente que viene de Windows.

    No se disparan si estás escribiendo en un campo: ahí `Ctrl+Z` tiene que
    deshacer lo que has tecleado, que es lo que espera cualquiera. El navegador
    ya lo hace por su cuenta.
  */
  const undoRef = useRef(doUndo);
  const redoRef = useRef(doRedo);

  useEffect(() => {
    undoRef.current = doUndo;
    redoRef.current = doRedo;
  }, [doUndo, doRedo]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (typing) return;

      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        (event.shiftKey ? redoRef : undoRef).current();
      } else if (key === 'y') {
        event.preventDefault();
        redoRef.current();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return useMemo(
    () => ({
      value: history.present,
      set,
      undo: doUndo,
      redo: doRedo,
      canUndo: canUndo(history),
      canRedo: canRedo(history),
    }),
    [history, set, doUndo, doRedo],
  );
}
