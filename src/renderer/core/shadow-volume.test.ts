import { describe, expect, it } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { fitShadowVolume, type ShadowFit } from './shadow-volume';

/*
  Los dos fallos que esto vigila NO DAN ERROR EN NINGUNA PARTE:

  · Si el volumen se queda corto, la sombra sale recortada. Pasó de verdad —con
    `style.height` al máximo las barras se salían del volumen fijo— y nadie lo
    vio hasta mirar una captura.
  · Si `far` no llega al suelo, el fragmento del suelo cae fuera del mapa, se da
    por iluminado, y la gráfica se queda SIN SOMBRA. Ni error ni aviso.

  Los dos son aritmética, así que se comprueban aquí y no a ojo.
*/

/** La luz de la escena: la misma posición que usa el renderer, mirando al centro. */
const LUZ = new Vector3(2.6, 4.2, 2.2);

function vistaDeLaLuz(desde = LUZ): Matrix4 {
  return new Matrix4()
    .lookAt(desde, new Vector3(0, 0, 0), new Vector3(0, 1, 0))
    .setPosition(desde)
    .invert();
}

/** Un anillo con el grosor de por defecto: el caso más común con diferencia. */
const ANILLO: ShadowFit = {
  radius: Math.hypot(2, 2) / 2,
  casterLow: 0.0875,
  casterHigh: 0.4375,
  floorY: 0,
  mapSize: 1024,
};

/** Barras al máximo que deja el esquema: `height` 1 × `BAR_HEIGHT_SCALE` 3,2. */
const BARRAS_ALTAS: ShadowFit = {
  radius: Math.hypot(2, 1.2) / 2,
  casterLow: 0,
  casterHigh: 3.2,
  floorY: 0,
  mapSize: 1024,
};

/** Mete un punto del mundo en el espacio de la luz. */
function enLaLuz(view: Matrix4, x: number, y: number, z: number) {
  const p = new Vector3(x, y, z).applyMatrix4(view);
  return { x: p.x, y: p.y, profundidad: -p.z };
}

describe('fitShadowVolume', () => {
  const view = vistaDeLaLuz();

  it('mete dentro todas las piezas, gire como gire el grupo', () => {
    const v = fitShadowVolume(view, ANILLO)!;

    /* Se comprueba con el contorno entero y no con cuatro esquinas: el grupo
       gira, y basta con que UNA posición del giro se salga para que la sombra
       parpadee al pasar por ahí. */
    for (let i = 0; i < 64; i += 1) {
      const a = (i / 64) * Math.PI * 2;
      for (const y of [ANILLO.casterLow, ANILLO.casterHigh]) {
        const p = enLaLuz(
          view,
          Math.cos(a) * ANILLO.radius,
          y,
          Math.sin(a) * ANILLO.radius,
        );
        expect(p.x).toBeGreaterThanOrEqual(v.left);
        expect(p.x).toBeLessThanOrEqual(v.right);
        expect(p.y).toBeGreaterThanOrEqual(v.bottom);
        expect(p.y).toBeLessThanOrEqual(v.top);
        expect(p.profundidad).toBeGreaterThanOrEqual(v.near);
        expect(p.profundidad).toBeLessThanOrEqual(v.far);
      }
    }
  });

  it('el plano lejano llega al SUELO, o no habría sombra que ver', () => {
    const v = fitShadowVolume(view, ANILLO)!;

    /* El suelo es quien recibe. Si su profundidad se pasa de `far`, three lo da
       por iluminado y la sombra desaparece entera. */
    for (let i = 0; i < 32; i += 1) {
      const a = (i / 32) * Math.PI * 2;
      const p = enLaLuz(
        view,
        Math.cos(a) * ANILLO.radius,
        ANILLO.floorY,
        Math.sin(a) * ANILLO.radius,
      );
      expect(p.profundidad).toBeLessThanOrEqual(v.far);
    }
  });

  it('las barras más altas que permite el esquema caben (antes se cortaban)', () => {
    const v = fitShadowVolume(view, BARRAS_ALTAS)!;

    for (let i = 0; i < 64; i += 1) {
      const a = (i / 64) * Math.PI * 2;
      const p = enLaLuz(
        view,
        Math.cos(a) * BARRAS_ALTAS.radius,
        BARRAS_ALTAS.casterHigh,
        Math.sin(a) * BARRAS_ALTAS.radius,
      );
      expect(p.x).toBeGreaterThanOrEqual(v.left);
      expect(p.x).toBeLessThanOrEqual(v.right);
      expect(p.y).toBeGreaterThanOrEqual(v.bottom);
      expect(p.y).toBeLessThanOrEqual(v.top);
    }

    /* Y la comprobación que de verdad importa: el volumen fijo de antes NO
       llegaba. 2,6 era el borde, y la punta de la sombra cae más allá. */
    const anchoAntes = 5.2;
    expect(Math.max(v.right - v.left, v.top - v.bottom)).toBeGreaterThan(anchoAntes * 0.7);
  });

  it('ciñe de verdad: un anillo gasta bastante menos que el volumen fijo', () => {
    const v = fitShadowVolume(view, ANILLO)!;
    const lado = Math.max(v.right - v.left, v.top - v.bottom);

    // El volumen fijo de antes era 5,2 de lado para TODO.
    expect(lado).toBeLessThan(5.2 * 0.75);
    // Y no tanto como para dejarse fuera al propio anillo.
    expect(lado).toBeGreaterThan(2 * ANILLO.radius * 0.9);
  });

  it('el aire del borde existe, para que el filtro PCF tenga vecinos', () => {
    const v = fitShadowVolume(view, ANILLO)!;
    const p = enLaLuz(view, ANILLO.radius, ANILLO.casterHigh, 0);

    expect(p.x).toBeGreaterThan(v.left);
    expect(p.x).toBeLessThan(v.right);
  });

  it('sin nada que encerrar devuelve null y el volumen se queda como estaba', () => {
    expect(fitShadowVolume(view, { ...ANILLO, radius: 0 })).toBeNull();
    expect(fitShadowVolume(view, { ...ANILLO, radius: -1 })).toBeNull();
  });

  it('el plano cercano nunca es cero ni negativo', () => {
    // Una luz casi encima del suelo: el caso que dejaría `near` en negativo.
    const v = fitShadowVolume(vistaDeLaLuz(new Vector3(0.2, 0.3, 0.2)), ANILLO)!;
    expect(v.near).toBeGreaterThan(0);
    expect(v.far).toBeGreaterThan(v.near);
  });

  it('no depende de dónde esté la luz: gira con ella', () => {
    const otra = vistaDeLaLuz(new Vector3(-3.1, 5, -1.4));
    const v = fitShadowVolume(otra, ANILLO)!;

    for (let i = 0; i < 32; i += 1) {
      const a = (i / 32) * Math.PI * 2;
      const p = enLaLuz(
        otra,
        Math.cos(a) * ANILLO.radius,
        ANILLO.casterHigh,
        Math.sin(a) * ANILLO.radius,
      );
      expect(p.x).toBeGreaterThanOrEqual(v.left);
      expect(p.x).toBeLessThanOrEqual(v.right);
      expect(p.profundidad).toBeLessThanOrEqual(v.far);
    }
  });
});
