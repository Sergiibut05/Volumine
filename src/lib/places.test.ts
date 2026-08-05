import { describe, it, expect } from 'vitest';
import { PLACES, findPlace, countKnown } from './places';

describe('findPlace', () => {
  it('encuentra por nombre exacto', () => {
    expect(findPlace('Madrid')).toMatchObject({ lat: 40.42, lon: -3.7 });
  });

  it('no le importan mayúsculas, acentos ni espacios', () => {
    // Nadie escribe "Sídney" con tilde cuando va con prisa.
    expect(findPlace('sidney')).toMatchObject({ name: 'Sídney' });
    expect(findPlace('  TOKIO  ')).toMatchObject({ name: 'Tokio' });
    expect(findPlace('sao paulo')).toMatchObject({ name: 'São Paulo' });
    expect(findPlace('mexico')).toMatchObject({ name: 'México' });
  });

  it('devuelve undefined en lugar de inventarse un sitio', () => {
    expect(findPlace('Sucursal norte')).toBeUndefined();
    expect(findPlace('')).toBeUndefined();
  });
});

describe('el listado', () => {
  it('todas las coordenadas son válidas', () => {
    for (const place of PLACES) {
      expect(place.lat).toBeGreaterThanOrEqual(-90);
      expect(place.lat).toBeLessThanOrEqual(90);
      expect(place.lon).toBeGreaterThanOrEqual(-180);
      expect(place.lon).toBeLessThanOrEqual(180);
    }
  });

  it('no hay nombres repetidos', () => {
    const names = PLACES.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('cuenta cuántas etiquetas se reconocen', () => {
    expect(countKnown(['Madrid', 'Sucursal norte', 'tokio'])).toBe(2);
  });
});
