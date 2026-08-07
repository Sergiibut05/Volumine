import { describe, expect, it } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { fitShadowVolume, type ShadowFit } from './shadow-volume';

/*
  Los fallos que esto vigila NO DAN ERROR EN NINGUNA PARTE. Salen en una captura
  o no salen:

  · Si el volumen se queda corto de ancho, la sombra sale recortada.
  · Si el plano lejano no llega adonde CAE la sombra, el suelo de más allá se
    pinta iluminado y la sombra aparece cortada por una recta. Pasó de verdad:
    la primera versión estiraba la profundidad hasta el suelo que hay DEBAJO de
    la pieza, y la sombra no cae debajo — cae desplazada hacia donde apunta la
    luz. La prueba de entonces medía justo el trozo equivocado y pasaba.

  Por eso ahora se proyecta la sombra DE VERDAD, siguiendo el rayo hasta el
  plano, y se comprueba dónde aterriza. Es la única forma de que la prueba mire
  lo mismo que mira el ojo.
*/

/** La luz de la escena: la misma posición que usa el renderer, mirando al centro. */
const LUZ = new Vector3(2.6, 4.2, 2.2);

function vistaDeLaLuz(desde = LUZ): Matrix4 {
  return new Matrix4()
    .lookAt(desde, new Vector3(0, 0, 0), new Vector3(0, 1, 0))
    .setPosition(desde)
    .invert();
}

/** Hacia dónde viaja la luz: del foco al centro, normalizado. */
function direccion(desde = LUZ): Vector3 {
  return desde.clone().negate().normalize();
}

function fit(desde = LUZ, extra: Partial<ShadowFit> = {}): ShadowFit {
  return {
    radius: Math.hypot(2, 2) / 2,
    casterLow: 0.0875,
    casterHigh: 0.4375,
    floorY: 0,
    lightDropY: Math.abs(direccion(desde).y),
    mapSize: 1024,
    ...extra,
  };
}

/** Un anillo con el grosor de por defecto: el caso más común con diferencia. */
const ANILLO = fit();

/** Barras al máximo que deja el esquema: `height` 1 × `BAR_HEIGHT_SCALE` 3,2. */
const BARRAS_ALTAS = fit(LUZ, {
  radius: Math.hypot(2, 1.2) / 2,
  casterLow: 0,
  casterHigh: 3.2,
});

/** Mete un punto del mundo en el espacio de la luz. */
function enLaLuz(view: Matrix4, p: Vector3) {
  const v = p.clone().applyMatrix4(view);
  return { x: v.x, y: v.y, profundidad: -v.z };
}

/**
 * Dónde cae la sombra de un punto, siguiendo el rayo hasta el suelo.
 *
 * Esto es lo que el volumen tiene que contener, y lo que la prueba anterior no
 * miraba: comprobaba el suelo de debajo de la pieza, que es otro sitio.
 */
function sombraDe(p: Vector3, dir: Vector3, floorY: number): Vector3 {
  const t = (p.y - floorY) / Math.abs(dir.y);
  return p.clone().addScaledVector(dir, t);
}

/** El contorno del cilindro que barre el grupo al girar, a las dos alturas. */
function* piezas(f: ShadowFit, pasos = 64) {
  for (let i = 0; i < pasos; i += 1) {
    const a = (i / pasos) * Math.PI * 2;
    for (const y of [f.casterLow, f.casterHigh]) {
      yield new Vector3(Math.cos(a) * f.radius, y, Math.sin(a) * f.radius);
    }
  }
}

describe('fitShadowVolume', () => {
  const view = vistaDeLaLuz();
  const dir = direccion();

  it('mete dentro todas las piezas, gire como gire el grupo', () => {
    const v = fitShadowVolume(view, ANILLO)!;

    /* Se recorre el contorno entero y no cuatro esquinas: el grupo gira, y basta
       con que UNA posición del giro se salga para que la sombra parpadee al
       pasar por ahí. */
    for (const p of piezas(ANILLO)) {
      const q = enLaLuz(view, p);
      expect(q.x).toBeGreaterThanOrEqual(v.left);
      expect(q.x).toBeLessThanOrEqual(v.right);
      expect(q.y).toBeGreaterThanOrEqual(v.bottom);
      expect(q.y).toBeLessThanOrEqual(v.top);
      expect(q.profundidad).toBeGreaterThanOrEqual(v.near);
      expect(q.profundidad).toBeLessThanOrEqual(v.far);
    }
  });

  it('DONDE CAE LA SOMBRA está dentro del volumen, que es el fallo del corte', () => {
    /*
      La prueba que faltaba. Se sigue el rayo desde cada punto de la pieza hasta
      el plano y se mira dónde aterriza: si ese punto se pasa del plano lejano,
      three lo pinta ILUMINADO y aparece la recta que se veía en la captura.
    */
    for (const caso of [ANILLO, BARRAS_ALTAS]) {
      const v = fitShadowVolume(view, caso)!;

      for (const p of piezas(caso)) {
        const s = sombraDe(p, dir, caso.floorY);
        const q = enLaLuz(view, s);

        expect(q.profundidad).toBeLessThanOrEqual(v.far);
        expect(q.profundidad).toBeGreaterThanOrEqual(v.near);
        /* Y de paso: la sombra comparte x e y con quien la proyecta, así que
           tiene que caber en el mismo ancho. Si esto fallara, la premisa de
           ceñir el ancho solo a las piezas sería falsa. */
        expect(q.x).toBeGreaterThanOrEqual(v.left);
        expect(q.x).toBeLessThanOrEqual(v.right);
      }
    }
  });

  it('con una luz más rasante la sombra se alarga, y el volumen la sigue', () => {
    /* El caso que rompe cualquier holgura fija: cuanto más baja la luz, más
       lejos cae la sombra. Aquí el fondo se calcula, así que aguanta. */
    const bajita = new Vector3(6, 1.4, 5);
    const v = fitShadowVolume(vistaDeLaLuz(bajita), fit(bajita))!;
    const vista = vistaDeLaLuz(bajita);

    for (const p of piezas(fit(bajita))) {
      const s = sombraDe(p, direccion(bajita), 0);
      expect(enLaLuz(vista, s).profundidad).toBeLessThanOrEqual(v.far);
    }
  });

  it('las barras más altas que permite el esquema caben (antes se cortaban)', () => {
    const v = fitShadowVolume(view, BARRAS_ALTAS)!;

    for (const p of piezas(BARRAS_ALTAS)) {
      const q = enLaLuz(view, p);
      expect(q.x).toBeGreaterThanOrEqual(v.left);
      expect(q.x).toBeLessThanOrEqual(v.right);
      expect(q.y).toBeGreaterThanOrEqual(v.bottom);
      expect(q.y).toBeLessThanOrEqual(v.top);
    }
  });

  it('ciñe de verdad: un anillo gasta bastante menos que el volumen fijo', () => {
    const v = fitShadowVolume(view, ANILLO)!;
    const lado = Math.max(v.right - v.left, v.top - v.bottom);

    // El volumen fijo de antes era 5,2 de lado para TODO.
    expect(lado).toBeLessThan(5.2 * 0.75);
    // Y no tanto como para dejarse fuera al propio anillo.
    expect(lado).toBeGreaterThan(2 * ANILLO.radius * 0.9);
  });

  it('sin nada que encerrar devuelve null y el volumen se queda como estaba', () => {
    expect(fitShadowVolume(view, { ...ANILLO, radius: 0 })).toBeNull();
    expect(fitShadowVolume(view, { ...ANILLO, radius: -1 })).toBeNull();
    /* Una luz horizontal no proyecta sobre un suelo horizontal: la caída sería
       infinita. Mejor no tocar el volumen que escribir un infinito en él. */
    expect(fitShadowVolume(view, { ...ANILLO, lightDropY: 0 })).toBeNull();
  });

  it('el plano cercano nunca es cero ni negativo', () => {
    const desde = new Vector3(0.2, 0.3, 0.2);
    const v = fitShadowVolume(vistaDeLaLuz(desde), fit(desde))!;
    expect(v.near).toBeGreaterThan(0);
    expect(v.far).toBeGreaterThan(v.near);
  });

  it('no depende de dónde esté la luz: gira con ella', () => {
    const desde = new Vector3(-3.1, 5, -1.4);
    const vista = vistaDeLaLuz(desde);
    const caso = fit(desde);
    const v = fitShadowVolume(vista, caso)!;

    for (const p of piezas(caso, 32)) {
      const q = enLaLuz(vista, p);
      expect(q.x).toBeGreaterThanOrEqual(v.left);
      expect(q.x).toBeLessThanOrEqual(v.right);

      const s = enLaLuz(vista, sombraDe(p, direccion(desde), 0));
      expect(s.profundidad).toBeLessThanOrEqual(v.far);
    }
  });
});
