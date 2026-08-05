import { describe, it, expect } from 'vitest';
import {
  COALESCE_MS,
  MAX_STEPS,
  canRedo,
  canUndo,
  createHistory,
  record,
  redo,
  undo,
} from './history';

describe('lo básico', () => {
  it('empieza sin nada que deshacer ni rehacer', () => {
    const h = createHistory('a');
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });

  it('deshace y rehace en el orden correcto', () => {
    let h = createHistory('a', 0);
    h = record(h, 'b', 1000);
    h = record(h, 'c', 2000);

    expect(h.present).toBe('c');
    h = undo(h);
    expect(h.present).toBe('b');
    h = undo(h);
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);

    h = redo(h);
    expect(h.present).toBe('b');
    h = redo(h);
    expect(h.present).toBe('c');
    expect(canRedo(h)).toBe(false);
  });

  it('deshacer y rehacer de más no rompe nada', () => {
    let h = createHistory('a');
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);

    h = record(h, 'b', 1000);
    h = undo(undo(undo(h)));
    expect(h.present).toBe('a');
  });

  it('registrar el mismo valor no crea un paso', () => {
    const h = createHistory('a', 0);
    expect(record(h, 'a', 5000)).toBe(h);
  });
});

describe('agrupado de cambios seguidos', () => {
  it('un arrastre entero de slider se deshace de una vez', () => {
    /* Sin esto, deshacer una vez movería el canto 0,01 y harían falta cuarenta
       pulsaciones para volver: lo mismo que no tener deshacer. */
    let h = createHistory(0, 0);
    h = record(h, 1, 1000); // primer cambio: abre paso

    // El arrastre: muchos cambios muy seguidos.
    for (let i = 2; i <= 40; i += 1) h = record(h, i, 1000 + i * 10);

    expect(h.present).toBe(40);
    h = undo(h);
    expect(h.present).toBe(0);
  });

  it('parando entre medias, cada cambio es su propio paso', () => {
    let h = createHistory('a', 0);
    h = record(h, 'b', 1000);
    h = record(h, 'c', 1000 + COALESCE_MS + 1);

    expect(h.present).toBe('c');
    expect(undo(h).present).toBe('b');
  });

  it('coalesce:false fuerza paso propio aunque venga pegado', () => {
    // Cambiar de tipo o pegar una tabla siempre se deshace por separado.
    let h = createHistory('a', 0);
    h = record(h, 'b', 1000);
    h = record(h, 'c', 1010, { coalesce: false });

    expect(undo(h).present).toBe('b');
  });

  it('el primer cambio nunca se fusiona: si no, se perdería el estado inicial', () => {
    let h = createHistory('a', 0);
    h = record(h, 'b', 5);
    expect(canUndo(h)).toBe(true);
    expect(undo(h).present).toBe('a');
  });

  it('escribir justo después de deshacer no machaca el paso recuperado', () => {
    let h = createHistory('a', 0);
    h = record(h, 'b', 1000);
    h = record(h, 'c', 2000);
    h = undo(h); // presente = 'b'

    // Aunque llegue inmediatamente, tiene que abrir paso propio.
    h = record(h, 'z', 2001);
    expect(h.present).toBe('z');
    expect(undo(h).present).toBe('b');
  });
});

describe('rama futura', () => {
  it('hacer algo nuevo después de deshacer descarta el rehacer', () => {
    let h = createHistory('a', 0);
    h = record(h, 'b', 1000);
    h = record(h, 'c', 2000);
    h = undo(h);

    expect(canRedo(h)).toBe(true);
    h = record(h, 'd', 3000);
    expect(canRedo(h)).toBe(false);
  });
});

describe('límite de memoria', () => {
  it('no guarda más pasos de la cuenta', () => {
    // Cada paso es un config entero; con doscientas filas eso pesa.
    let h = createHistory(0, 0);
    for (let i = 1; i <= MAX_STEPS + 30; i += 1) {
      h = record(h, i, i * (COALESCE_MS + 10));
    }
    expect(h.past.length).toBe(MAX_STEPS);
    expect(h.present).toBe(MAX_STEPS + 30);
  });

  it('al recortar se tiran los pasos MÁS VIEJOS', () => {
    let h = createHistory(0, 0);
    for (let i = 1; i <= MAX_STEPS + 5; i += 1) {
      h = record(h, i, i * (COALESCE_MS + 10));
    }
    // El más antiguo que queda no puede ser el 0.
    expect(h.past[0]).toBeGreaterThan(0);
    expect(h.past[h.past.length - 1]).toBe(MAX_STEPS + 4);
  });
});
