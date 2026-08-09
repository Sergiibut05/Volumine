import { describe, expect, it } from 'vitest';
import { roundedSectorGeometry } from './rounded-sector';

/*
  La punta de la tarta.

  Estos tests existen por un fallo concreto: con el mismo canto dentro y fuera,
  una porción de tarta —`innerR = 0`— acababa en un morro redondeado sobre el
  eje en vez de en arista. Como todas las porciones convergen ahí, los morros se
  sumaban en una BOLA visible en el centro de la tarta.

  Se mide en la BASE a propósito. Ahí está la diferencia: con el morro, el perfil
  arrancaba en `r = canto` y solo llegaba al eje a media altura, así que la tarta
  tenía un agujerito por arriba y por abajo y una bola en medio. Mirar solo «¿hay
  algún vértice en el eje?» habría pasado con el fallo dentro.
*/

const params = {
  a0: 0,
  a1: Math.PI / 2,
  outerR: 1,
  depth: 0.3,
  radius: 0.08,
  arcSegments: 24,
  cornerSegments: 6,
};

/** Radio mínimo de los vértices que están a una altura dada. */
function radioMinimoEn(geo: ReturnType<typeof roundedSectorGeometry>, y: number) {
  const pos = geo.getAttribute('position');
  let min = Infinity;
  for (let i = 0; i < pos.count; i += 1) {
    if (Math.abs(pos.getY(i) - y) > 1e-4) continue;
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    if (r < min) min = r;
  }
  return min;
}

describe('roundedSectorGeometry', () => {
  it('la punta de una tarta llega al eje ya en la base, sin morro', () => {
    const geo = roundedSectorGeometry({ ...params, innerR: 0 });

    // Con el fallo esto valía el canto (0.08), no 0: de ahí la bola del centro.
    expect(radioMinimoEn(geo, 0)).toBeLessThan(1e-6);
    expect(radioMinimoEn(geo, params.depth)).toBeLessThan(1e-6);
  });

  it('un anillo con hueco de sobra conserva su canto interior', () => {
    const innerR = 0.4;
    const geo = roundedSectorGeometry({ ...params, innerR });

    /* Aquí sí debe haber morro: el borde interior de un anillo es una superficie
       de verdad y su canto es lo que le da el aspecto de pieza. En la base el
       perfil arranca desplazado hacia fuera por el radio del canto. */
    expect(radioMinimoEn(geo, 0)).toBeGreaterThan(innerR + 1e-3);
  });

  it('un anillo de hueco más estrecho que el canto no se cruza consigo mismo', () => {
    /* Caso intermedio: el canto pedido (0.08) no cabe en el hueco (0.03). Antes
       el perfil interior se desplazaba a un radio NEGATIVO y se cruzaba. */
    const innerR = 0.03;
    const geo = roundedSectorGeometry({ ...params, innerR });
    const pos = geo.getAttribute('position');

    for (let i = 0; i < pos.count; i += 1) {
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      expect(r).toBeGreaterThanOrEqual(-1e-9);
    }
    expect(radioMinimoEn(geo, 0)).toBeGreaterThanOrEqual(innerR - 1e-6);
  });

  it('todas las normales son unitarias', () => {
    for (const innerR of [0, 0.03, 0.4]) {
      const geo = roundedSectorGeometry({ ...params, innerR });
      const nor = geo.getAttribute('normal');
      for (let i = 0; i < nor.count; i += 1) {
        const len = Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i));
        expect(len).toBeCloseTo(1, 4);
      }
    }
  });
});
