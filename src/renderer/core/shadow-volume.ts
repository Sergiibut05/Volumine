import { Matrix4, Vector3 } from 'three';

/*
  El volumen de la cámara de sombra, ceñido a lo que hay.

  ── DE DÓNDE SALÍAN LOS DIENTES DE SIERRA ──────────────────────────────────

  El volumen era FIJO: 5,2 × 5,2 unidades, puestas a ojo para que cupiera el
  peor caso. Un anillo con el grosor de por defecto ocupa una huella de unas
  2,8 — o sea que de los 1024 téxeles del mapa la sombra usaba poco más de la
  mitad por eje, y un tercio del total. El escalón que se veía en el borde era
  eso: téxeles grandes.

  Ceñir el volumen a la escena no cuesta nada —se calcula al cambiar el config,
  no por fotograma— y casi duplica la densidad por eje sin tocar la memoria del
  mapa ni el relleno. Es la primera palanca que hay que mover porque es la única
  gratis: subir `mapSize` es cuadruplicar memoria y relleno EN CADA FOTOGRAMA, y
  esto es un embed que corre dentro de la página de otra persona.

  De paso arregla un recorte que llevaba ahí sin que nadie lo hubiera visto: con
  `style.height` al máximo las barras miden 3,2 de alto, su sombra se estira
  hasta x ≈ 2,98, y el volumen fijo se cortaba en 2,6.

  ── POR QUÉ ESTO ES UNA FUNCIÓN PURA Y APARTE ──────────────────────────────

  Porque tiene un invariante que se rompe EN SILENCIO. Si `far` no llega hasta
  el suelo, el fragmento del suelo cae fuera del mapa, se da por iluminado, y la
  gráfica se queda SIN SOMBRA — no hay error, no hay aviso, solo una escena que
  de repente flota. Aquí se puede comprobar con aritmética en vez de a ojo.
*/

export type ShadowVolume = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  near: number;
  far: number;
};

export type ShadowFit = {
  /**
   * Radio de la huella horizontal, YA BARRIDA POR EL GIRO.
   *
   * El grupo gira sobre Y, así que lo que hay que encerrar no es la caja de
   * este instante sino el cilindro que barre: `hypot(ancho, fondo) / 2`. Una
   * caja que cambiara al girar recolocaría los téxeles cada fotograma y la
   * sombra "nadaría" por el suelo — más feo que el escalón que venimos a quitar.
   */
  radius: number;
  /** Punto más bajo de las piezas que proyectan. */
  casterLow: number;
  /** Punto más alto de las piezas que proyectan. */
  casterHigh: number;
  /** Altura del plano que recibe la sombra. */
  floorY: number;
  /** Lado del mapa en téxeles. Solo decide cuánto aire se deja al borde. */
  mapSize: number;
};

/** Muestras del contorno del cilindro. Con 16, el error queda por debajo del 2%. */
const VUELTA = 16;

const punto = new Vector3();

/**
 * Ajusta el volumen ortográfico de la luz a las piezas.
 *
 * `view` es la matriz de vista de la luz (la inversa de su `matrixWorld`), que
 * es quien lleva la dirección: aquí no se asume nada sobre dónde está puesta.
 *
 * Devuelve `null` cuando no hay nada que encerrar, y entonces quien llama debe
 * dejar el volumen como estuviera.
 */
export function fitShadowVolume(view: Matrix4, fit: ShadowFit): ShadowVolume | null {
  if (!(fit.radius > 0) || !Number.isFinite(fit.casterHigh - fit.casterLow)) return null;

  const bajo = Math.min(fit.casterLow, fit.floorY);
  const alto = Math.max(fit.casterHigh, fit.floorY);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let near = Infinity;
  let far = -Infinity;

  for (let i = 0; i < VUELTA; i += 1) {
    const angulo = (i / VUELTA) * Math.PI * 2;
    const x = Math.cos(angulo) * fit.radius;
    const z = Math.sin(angulo) * fit.radius;

    for (const [y, esPieza] of [
      [fit.casterLow, true],
      [fit.casterHigh, true],
      /*
        El suelo solo estira la PROFUNDIDAD, nunca el ancho.

        Quien recibe la sombra es el plano, y un fragmento cuya profundidad cae
        más allá del plano lejano se da por iluminado: ceñir la profundidad solo
        a las piezas dejaría la gráfica sin sombra ninguna.

        El ancho y el alto, en cambio, salen SOLO de las piezas: la sombra de un
        punto cae, por definición, en su misma coordenada del espacio de la luz,
        así que encerrar a quien la proyecta encierra también dónde aterriza.
        Meter aquí las esquinas del suelo solo regalaría téxeles.
      */
      [bajo, false],
      [alto, false],
    ] as const) {
      punto.set(x, y, z).applyMatrix4(view);
      if (esPieza) {
        minX = Math.min(minX, punto.x);
        maxX = Math.max(maxX, punto.x);
        minY = Math.min(minY, punto.y);
        maxY = Math.max(maxY, punto.y);
      }
      // La cámara mira hacia -Z: lo más cercano es el z mayor.
      near = Math.min(near, -punto.z);
      far = Math.max(far, -punto.z);
    }
  }

  /* Un par de téxeles de aire alrededor: el filtro PCF toma muestras vecinas y
     sin margen las del borde caen fuera del mapa. */
  const aire = (2 * Math.max(maxX - minX, maxY - minY)) / Math.max(1, fit.mapSize);

  return {
    left: minX - aire,
    right: maxX + aire,
    bottom: minY - aire,
    top: maxY + aire,
    near: Math.max(0.01, near - aire),
    far: far + aire,
  };
}
