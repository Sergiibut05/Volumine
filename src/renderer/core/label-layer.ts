import type { PerspectiveCamera, Object3D } from 'three';
import { Vector3 } from 'three';
import type { ResolvedChartConfig } from '@/lib/config/defaults';
import { formatter } from '@/lib/format';
import { fitLabels, stackLabels } from './labels';

/*
  La capa de etiquetas: HTML colocado encima del canvas.

  LA PONE EL RENDERER, no la página. Eso es lo que hace que el editor y el embed
  enseñen exactamente lo mismo sin que ninguno de los dos escriba una línea para
  conseguirlo — la regla de "mismo config, mismos píxeles" aplicada también al
  texto. Si cada anfitrión montara su propia capa, la vista previa mentiría
  sobre el link, que es el peor sitio donde puede mentir este producto.

  Texto en HTML y no en 3D porque el bundle no lleva fuentes ni cabe en el
  presupuesto (ADR 0005) — pero aunque cupieran, el texto plano se lee más
  nítido, se puede copiar y lo lee un lector de pantalla.

  Las líneas van en un SVG y el texto en `div`s. Podrían ir los dos en el SVG,
  pero un `<text>` no se ajusta ni se corta solo, y un nombre de categoría largo
  se saldría del cuadro.
*/

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Cómo se coloca una etiqueta respecto a su pieza.
 *
 * `radial` — se va a los lados de la escena y llega una línea guía. Es lo que
 * pide un anillo: sus trozos rodean un centro, así que las etiquetas rodean el
 * dibujo y las líneas dicen cuál es cuál.
 *
 * `point` — se queda pegada a su pieza, centrada DEBAJO, sin línea. Es lo que
 * pide una fila de barras: cada nombre va bajo SU barra, como el eje de
 * cualquier gráfica de barras de toda la vida. Mandarlas a los lados con líneas
 * sería inventarse un problema que las barras no tienen.
 *
 * `over` — igual pero ENCIMA. Es lo que pide el globo: la etiqueta cuelga hacia
 * abajo desde su punto de anclaje, así que dejándola debajo tapa justo el
 * marcador que está señalando.
 */
export type Placement = 'radial' | 'point' | 'over';

/** Lo que el renderer sabe de cada etiqueta. El resto lo decide esta capa. */
export type LabelAnchor = {
  index: number;
  label: string;
  value: number;
  /** Fracción del total, para el porcentaje. `null` si no aplica. */
  fraction: number | null;
  /** De dónde sale la línea, en coordenadas LOCALES del grupo. */
  anchor: Vector3;
  /**
   * Centro alrededor del cual el ancla puede quedar OCULTA, en locales.
   *
   * Solo lo usa el globo. Media esfera está siempre de espaldas, y su
   * etiqueta —que se pinta en HTML, encima de todo— seguiría viéndose flotando
   * sobre el planeta como si señalara un sitio de la cara de delante. Con el
   * centro se puede saber si el punto mira a la cámara o no.
   */
  occludeAround?: Vector3;
};

/**
 * Cuánto se separa la etiqueta del borde del contenedor, en píxeles.
 *
 * Subido de 10 a 16 al ponerles fondo: el texto suelto podía acercarse al borde
 * sin que se notara, pero una píldora pegada al canto se lee como recortada.
 */
const MARGIN = 16;
/** Longitud del tramo horizontal de la línea guía. */
const ELBOW = 18;

type Item = {
  index: number;
  box: HTMLDivElement;
  /** Centro de oclusión en locales, si lo tiene. Ver `occludeAround`. */
  around: Vector3 | null;
  /**
   * DOS trazos para la misma línea: uno grueso y oscuro debajo, otro fino y
   * claro encima.
   *
   * Es la técnica de las carreteras en cartografía, y aquí hace falta por lo
   * mismo: la línea cruza un fondo que NO CONOCEMOS —el embed vive dentro de la
   * página de otra persona, que puede ser blanca, negra o una foto—. Un trazo
   * claro desaparece sobre blanco y uno oscuro sobre negro; los dos juntos se
   * ven siempre, porque cada uno hace de contorno del otro.
   */
  line: SVGPolylineElement;
  casing: SVGPolylineElement;
  world: Vector3;
};

export type LabelLayer = {
  /** Rehace el DOM. Se llama al reconstruir la escena, no en cada frame. */
  rebuild(anchors: LabelAnchor[], config: ResolvedChartConfig, placement: Placement): void;
  /** Recoloca. Se llama en cada frame: solo escribe transforms. */
  update(camera: PerspectiveCamera, group: Object3D, width: number, height: number): void;
  /**
   * ¿Este dato tiene su etiqueta escrita y a la vista AHORA MISMO?
   *
   * No basta con que las etiquetas estén encendidas: con muchas categorías
   * algunas se descartan por falta de sitio, y de esas el tooltip sigue siendo
   * la única forma de leer el dato.
   */
  isLabelled(index: number): boolean;
  /** Destaca la etiqueta de un dato y atenúa las demás. `null` las iguala. */
  highlight(index: number | null): void;
  dispose(): void;
};

export function createLabelLayer(container: HTMLElement): LabelLayer {
  const root = document.createElement('div');
  root.className = 'voluma-labels';
  root.setAttribute('aria-hidden', 'true');

  /* Inline y no en la hoja de estilos: son las reglas sin las cuales la capa no
     FUNCIONA —tapar el canvas, no comerse el ratón— y no pueden depender de que
     el anfitrión haya cargado el CSS correcto. Lo que sí es del anfitrión es el
     aspecto: tipografía, color y tamaño. */
  Object.assign(root.style, {
    position: 'absolute',
    inset: '0',
    overflow: 'hidden',
    pointerEvents: 'none',
  });

  const svg = document.createElementNS(SVG_NS, 'svg');
  Object.assign(svg.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
  });
  root.appendChild(svg);

  container.appendChild(root);

  let items: Item[] = [];
  const tmp = new Vector3();
  // Reutilizados: se tocan en cada frame y crear vectores ahí es presión de GC.
  const centro = new Vector3();
  const hacia = new Vector3();
  const aCamara = new Vector3();
  /** Los índices que de verdad se están dibujando en este momento. */
  let shown = new Set<number>();
  let placement: Placement = 'radial';

  function clear() {
    for (const item of items) {
      item.box.remove();
      item.line.remove();
      item.casing.remove();
    }
    items = [];
  }

  return {
    rebuild(anchors, config, next) {
      clear();
      placement = next;
      shown = new Set();
      root.style.display =
        config.labels.show && config.labels.mode !== 'none' ? '' : 'none';
      if (!config.labels.show || config.labels.mode === 'none') return;

      const fmt = formatter(config);

      for (const anchor of anchors) {
        const box = document.createElement('div');
        box.className = 'voluma-label';
        Object.assign(box.style, {
          position: 'absolute',
          top: '0',
          left: '0',
          whiteSpace: 'nowrap',
          willChange: 'transform',
        });

        const name = document.createElement('b');
        name.textContent = anchor.label;
        box.appendChild(name);

        /* El valor y el porcentaje son cosas distintas y se piden por separado:
           en un reparto muchas veces interesa el porcentaje y el valor absoluto
           estorba, y en una serie temporal justo al revés. */
        const partes: string[] = [];
        if (config.labels.showValues) partes.push(fmt.value(anchor.value));
        if (config.labels.showPercent && anchor.fraction !== null) {
          partes.push(fmt.percent(anchor.fraction));
        }
        if (partes.length > 0) {
          const detalle = document.createElement('span');
          detalle.textContent = partes.join(' · ');
          box.appendChild(detalle);
        }

        const casing = document.createElementNS(SVG_NS, 'polyline');
        casing.setAttribute('class', 'voluma-leader-casing');
        casing.setAttribute('fill', 'none');

        const line = document.createElementNS(SVG_NS, 'polyline');
        line.setAttribute('class', 'voluma-leader');
        line.setAttribute('fill', 'none');

        /* El contorno va ANTES en el DOM: en SVG pinta primero lo que está
           antes, así que el trazo fino queda encima. Al revés se tapa solo. */
        svg.appendChild(casing);
        svg.appendChild(line);
        root.appendChild(box);
        items.push({
          index: anchor.index,
          box,
          line,
          casing,
          world: anchor.anchor.clone(),
          around: anchor.occludeAround?.clone() ?? null,
        });
      }
    },

    update(camera, group, width, height) {
      if (items.length === 0) return;
      shown = new Set();

      // Alto real de la primera etiqueta: depende de la tipografía del anfitrión
      // y del tamaño que haya pedido el config, así que se mide, no se supone.
      const alto = items[0].box.offsetHeight || 20;

      type Puesto = { item: Item; x: number; y: number; lado: -1 | 1 };
      const puestos: Puesto[] = [];

      for (const item of items) {
        /* Cara de atrás del globo: se compara la dirección del punto desde el
           centro con la dirección hacia la cámara. Si no apuntan al mismo lado,
           el punto está literalmente al otro lado del planeta. */
        if (item.around) {
          centro.copy(item.around).applyMatrix4(group.matrixWorld);
          hacia.copy(item.world).applyMatrix4(group.matrixWorld).sub(centro);
          if (hacia.dot(aCamara.copy(camera.position).sub(centro)) <= 0) {
            item.box.style.display = 'none';
            item.line.style.display = 'none';
            item.casing.style.display = 'none';
            continue;
          }
        }

        tmp.copy(item.world).applyMatrix4(group.matrixWorld).project(camera);

        /* Detrás de la cámara: `project` devuelve coordenadas espejadas y la
           etiqueta aparecería en el lado contrario, apuntando a nada. */
        if (tmp.z > 1) {
          item.box.style.display = 'none';
          item.line.style.display = 'none';
          item.casing.style.display = 'none';
          continue;
        }
        item.box.style.display = '';
        item.line.style.display = '';
        item.casing.style.display = '';

        puestos.push({
          item,
          x: ((tmp.x + 1) / 2) * width,
          y: ((1 - tmp.y) / 2) * height,
          lado: tmp.x < 0 ? -1 : 1,
        });
      }

      /*
        Colocación pegada a la pieza. Sin apilado vertical y sin línea: la
        etiqueta ESTÁ donde está su barra, así que no hace falta nada que las
        una. Lo único que hay que resolver es que dos nombres seguidos no se
        pisen de lado, que con muchas categorías pasa.
      */
      if (placement === 'point' || placement === 'over') {
        // De izquierda a derecha en pantalla, para descartar en ese orden.
        puestos.sort((a, b) => a.x - b.x);
        let ocupadoHasta = -Infinity;

        for (const puesto of puestos) {
          const ancho = puesto.item.box.offsetWidth;
          const x = puesto.x - ancho / 2;

          /* Si se solaparía con la anterior se esconde, en vez de moverla. Una
             etiqueta desplazada bajo una barra que no es la suya miente sobre
             qué barra es cuál, y eso es peor que no ponerla. */
          if (x < ocupadoHasta + 4) {
            puesto.item.box.style.display = 'none';
            puesto.item.line.style.display = 'none';
            puesto.item.casing.style.display = 'none';
            continue;
          }
          ocupadoHasta = x + ancho;
          shown.add(puesto.item.index);

          /* `over` sube la etiqueta su propio alto más un respiro, para que el
             marcador quede a la vista justo debajo. */
          const y = placement === 'over' ? puesto.y - alto - 6 : puesto.y;

          puesto.item.line.style.display = 'none';
          puesto.item.casing.style.display = 'none';
          puesto.item.box.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
          puesto.item.box.dataset.side = 'center';
        }
        return;
      }

      /* Se apilan las dos columnas por separado. Mezclarlas haría que una
         etiqueta de la izquierda empujase a una de la derecha, que no se pisan
         entre ellas porque están en lados opuestos de la pantalla. */
      for (const lado of [-1, 1] as const) {
        const columna = puestos.filter((p) => p.lado === lado);
        if (columna.length === 0) continue;

        const visibles = new Set(
          fitLabels(
            columna.map((p) => Math.abs(p.item.world.lengthSq())),
            { viewport: height, height: alto, gap: 6, padding: MARGIN },
          ),
        );

        const ys = stackLabels(
          columna.map((p, i) => ({ index: i, y: p.y - alto / 2, height: alto })),
          { viewport: height, gap: 6, padding: MARGIN },
        );

        columna.forEach((puesto, i) => {
          if (!visibles.has(i)) {
            puesto.item.box.style.display = 'none';
            puesto.item.line.style.display = 'none';
            puesto.item.casing.style.display = 'none';
            return;
          }
          shown.add(puesto.item.index);

          const y = ys[i];
          const ancho = puesto.item.box.offsetWidth;
          // A la izquierda la etiqueta crece hacia la izquierda, así que hay que
          // restarle su propio ancho o se metería encima del dibujo.
          const x = lado < 0 ? MARGIN : width - MARGIN - ancho;

          puesto.item.box.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
          puesto.item.box.dataset.side = lado < 0 ? 'left' : 'right';

          /* La línea guía: del borde de la pieza, un tramo en diagonal, y un
             codo horizontal que muere pegado al texto. El codo es lo que hace
             que la línea "entre" en la etiqueta en vez de apuntar a su esquina. */
          const finX = lado < 0 ? MARGIN + ancho : width - MARGIN - ancho;
          const codoX = finX + lado * ELBOW;
          const finY = y + alto / 2;
          const puntos = `${puesto.x.toFixed(1)},${puesto.y.toFixed(1)} ${codoX.toFixed(1)},${finY.toFixed(1)} ${finX.toFixed(1)},${finY.toFixed(1)}`;
          puesto.item.line.setAttribute('points', puntos);
          puesto.item.casing.setAttribute('points', puntos);
        });
      }
    },

    isLabelled(index) {
      return shown.has(index);
    },

    /*
      Al señalar una pieza se destaca SU etiqueta y se atenúan las otras, en vez
      de sacar un tooltip que repita lo que ya pone ahí. Es la respuesta al
      gesto: te digo cuál de todas es la que estás tocando.
    */
    highlight(index) {
      for (const item of items) {
        if (index === null) {
          delete item.box.dataset.state;
          delete (item.line as unknown as HTMLElement).dataset.state;
          delete (item.casing as unknown as HTMLElement).dataset.state;
          continue;
        }
        const estado = item.index === index ? 'on' : 'dim';
        item.box.dataset.state = estado;
        (item.line as unknown as HTMLElement).dataset.state = estado;
        (item.casing as unknown as HTMLElement).dataset.state = estado;
      }
    },

    dispose() {
      clear();
      root.remove();
    },
  };
}
