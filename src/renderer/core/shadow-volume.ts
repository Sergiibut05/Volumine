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
  /**
   * Componente vertical de la dirección de la luz, ya normalizada y en valor
   * absoluto. Es lo que convierte «cuánto tengo que bajar» en «cuánto rayo hay
   * que recorrer», y sin eso no se sabe hasta dónde llega la sombra.
   */
  lightDropY: number;
  /** Lado del mapa en téxeles. Solo decide cuánto aire se deja al borde. */
  mapSize: number;
};

/** Muestras del contorno del cilindro. */
const VUELTA = 16;

/*
  El polígono de muestreo va CIRCUNSCRITO al círculo, no inscrito.

  Muestrear el círculo en su propio radio da un polígono POR DENTRO, así que la
  cota que sale se queda corta — hasta un 2% con dieciséis lados. Suena a nada y
  no lo es: una cota de contención que se queda corta recorta la sombra, y el
  recorte aparece justo en la dirección donde no hay muestra.

  Se corrige empujando el radio de muestreo a `r / cos(π/n)`, que es el radio al
  que el polígono de n lados ENVUELVE al círculo. Con eso la cota es conservadora
  por construcción y no hace falta ningún margen inventado para taparlo.
*/
const ENVOLVENTE = 1 / Math.cos(Math.PI / VUELTA);

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
  if (!(fit.lightDropY > 0)) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let near = Infinity;
  let far = -Infinity;

  const radioMuestreo = fit.radius * ENVOLVENTE;

  for (let i = 0; i < VUELTA; i += 1) {
    const angulo = (i / VUELTA) * Math.PI * 2;
    const x = Math.cos(angulo) * radioMuestreo;
    const z = Math.sin(angulo) * radioMuestreo;

    for (const y of [fit.casterLow, fit.casterHigh]) {
      punto.set(x, y, z).applyMatrix4(view);

      /* El ancho y el alto salen SOLO de las piezas, y eso sí era correcto: la
         sombra de un punto cae, por definición, en su misma coordenada del
         espacio de la luz — el rayo ES el eje de profundidad—, así que encerrar
         a quien la proyecta encierra también dónde aterriza. */
      minX = Math.min(minX, punto.x);
      maxX = Math.max(maxX, punto.x);
      minY = Math.min(minY, punto.y);
      maxY = Math.max(maxY, punto.y);

      // Mira hacia -Z: lo más cercano es el z mayor.
      const profundidad = -punto.z;
      near = Math.min(near, profundidad);

      /*
        ══════════════════════════════════════════════════════════════════════
        HASTA DÓNDE LLEGA LA PROFUNDIDAD: HASTA EL SUELO, PERO DONDE CAE
        ══════════════════════════════════════════════════════════════════════

        Aquí estuvo el fallo, y salió en una captura: la sombra aparecía
        CORTADA POR UNA RECTA, como si el suelo se acabase.

        Quien recibe la sombra es el plano, y three da por ILUMINADO todo
        fragmento cuya profundidad se pase del plano lejano. La versión anterior
        estiraba la profundidad hasta el suelo, sí, pero solo el suelo que hay
        DEBAJO de la pieza — y la sombra no cae debajo, cae desplazada hacia
        donde apunta la luz. Todo lo que caía más allá de ese trozo de suelo se
        quedaba fuera del volumen y se pintaba sin sombra. De ahí la recta: es
        el plano lejano, visto de canto.

        Lo correcto es seguir el RAYO. Desde cada punto de la pieza, bajar hasta
        el suelo cuesta `(y - suelo) / |dirección.y|` de recorrido, y eso es
        justo profundidad. El punto de suelo que le corresponde comparte x e y
        en el espacio de la luz, así que no ensancha nada: solo estira el fondo.

        Es exacto y no una holgura a ojo, que es lo que hace que no vuelva a
        pasar con una gráfica más alta o una luz más rasante.
      */
      const caida = Math.max(0, y - fit.floorY) / fit.lightDropY;
      far = Math.max(far, profundidad + caida);
    }
  }

  /* Un par de téxeles de aire alrededor: el filtro PCF toma muestras vecinas y
     sin margen las del borde caen fuera del mapa. */
  const aire = (2 * Math.max(maxX - minX, maxY - minY)) / Math.max(1, fit.mapSize);

  /*
    El fondo se estira un pelín más que los lados, y a propósito: el riesgo no es
    simétrico. Quedarse corto recorta la sombra con una recta que se ve a simple
    vista; pasarse solo gasta precisión del buffer de profundidad, sobre un rango
    de unas pocas unidades donde sobran 24 bits.

    Es solo para el ruido de coma flotante: el error de muestreo, que era el
    grande, lo quita `ENVOLVENTE`.
  */
  const holgura = Math.max(aire, (far - near) * 1e-5);

  return {
    left: minX - aire,
    right: maxX + aire,
    bottom: minY - aire,
    top: maxY + aire,
    near: Math.max(0.01, near - aire),
    far: far + holgura,
  };
}
