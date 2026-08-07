import { describe, expect, it } from 'vitest';
import { BACKDROPS, posterBackdrop } from './backdrop';
import { luminance } from '@/lib/color';
import { THEMES } from '@/lib/themes';

describe('posterBackdrop', () => {
  it('manda la superficie que declara el tema', () => {
    expect(posterBackdrop('estudio')).toBe(BACKDROPS.light);
    expect(posterBackdrop('papel')).toBe(BACKDROPS.light);
    expect(posterBackdrop('aurora')).toBe(BACKDROPS.dark);
    expect(posterBackdrop('nocturno')).toBe(BACKDROPS.dark);
  });

  it('todos los temas declaran superficie, incluidos los que se añadan', () => {
    /* Sin este campo el póster de ese tema se decidiría por conjetura, y la
       conjetura ya se probó y fallaba justo con «estudio». */
    for (const theme of THEMES) {
      expect(['light', 'dark'], theme.id).toContain(theme.surface);
    }
  });

  it('la paleta NO manda cuando hay tema', () => {
    /*
      Es la lección entera de este módulo. La paleta de «estudio» es en promedio
      oscura, así que mirar la paleta daría fondo claro... y da la casualidad de
      que ahí acierta. Con «papel» no: su paleta tira a oscura y el tema es de
      documento claro. Manda lo declarado.
    */
    const papel = THEMES.find((t) => t.id === 'papel')!;
    const media =
      papel.config.style!.palette!.map(luminance).reduce((a, b) => a + b, 0) /
      papel.config.style!.palette!.length;

    expect(media).toBeLessThan(0.35); // la conjetura diría «fondo claro»…
    expect(posterBackdrop('papel')).toBe(BACKDROPS.light); // …y aquí coincide
    expect(posterBackdrop('papel', ['#ffffff', '#fafafa'])).toBe(BACKDROPS.light);
  });

  it('sin tema se cae a la paleta: oscura pide fondo claro y al revés', () => {
    expect(posterBackdrop(undefined, ['#0b0b12', '#1a1030'])).toBe(BACKDROPS.light);
    expect(posterBackdrop(undefined, ['#f2ede3', '#ffffff'])).toBe(BACKDROPS.dark);
    expect(posterBackdrop('no-existe', ['#0b0b12'])).toBe(BACKDROPS.light);
  });

  it('sin tema y sin paleta usable, claro', () => {
    expect(posterBackdrop(undefined)).toBe(BACKDROPS.light);
    expect(posterBackdrop(undefined, [])).toBe(BACKDROPS.light);
    expect(posterBackdrop(undefined, ['no', 'es', 'color'])).toBe(BACKDROPS.light);
  });
});
