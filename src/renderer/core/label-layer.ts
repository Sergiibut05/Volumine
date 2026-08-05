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

/** Lo que el renderer sabe de cada etiqueta. El resto lo decide esta capa. */
export type LabelAnchor = {
  index: number;
  label: string;
  value: number;
  /** Fracción del total, para el porcentaje. `null` si no aplica. */
  fraction: number | null;
  /** De dónde sale la línea, en coordenadas LOCALES del grupo. */
  anchor: Vector3;
};

/** Cuánto se separa la etiqueta del borde del contenedor, en píxeles. */
const MARGIN = 10;
/** Longitud del tramo horizontal de la línea guía. */
const ELBOW = 18;

type Item = {
  index: number;
  box: HTMLDivElement;
  line: SVGPolylineElement;
  world: Vector3;
};

export type LabelLayer = {
  /** Rehace el DOM. Se llama al reconstruir la escena, no en cada frame. */
  rebuild(anchors: LabelAnchor[], config: ResolvedChartConfig): void;
  /** Recoloca. Se llama en cada frame: solo escribe transforms. */
  update(camera: PerspectiveCamera, group: Object3D, width: number, height: number): void;
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

  function clear() {
    for (const item of items) {
      item.box.remove();
      item.line.remove();
    }
    items = [];
  }

  return {
    rebuild(anchors, config) {
      clear();
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

        const line = document.createElementNS(SVG_NS, 'polyline');
        line.setAttribute('class', 'voluma-leader');
        line.setAttribute('fill', 'none');

        svg.appendChild(line);
        root.appendChild(box);
        items.push({ index: anchor.index, box, line, world: anchor.anchor.clone() });
      }
    },

    update(camera, group, width, height) {
      if (items.length === 0) return;

      // Alto real de la primera etiqueta: depende de la tipografía del anfitrión
      // y del tamaño que haya pedido el config, así que se mide, no se supone.
      const alto = items[0].box.offsetHeight || 20;

      type Puesto = { item: Item; x: number; y: number; lado: -1 | 1 };
      const puestos: Puesto[] = [];

      for (const item of items) {
        tmp.copy(item.world).applyMatrix4(group.matrixWorld).project(camera);

        /* Detrás de la cámara: `project` devuelve coordenadas espejadas y la
           etiqueta aparecería en el lado contrario, apuntando a nada. */
        if (tmp.z > 1) {
          item.box.style.display = 'none';
          item.line.style.display = 'none';
          continue;
        }
        item.box.style.display = '';
        item.line.style.display = '';

        puestos.push({
          item,
          x: ((tmp.x + 1) / 2) * width,
          y: ((1 - tmp.y) / 2) * height,
          lado: tmp.x < 0 ? -1 : 1,
        });
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
            return;
          }

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
          puesto.item.line.setAttribute(
            'points',
            `${puesto.x.toFixed(1)},${puesto.y.toFixed(1)} ${codoX.toFixed(1)},${finY.toFixed(1)} ${finX.toFixed(1)},${finY.toFixed(1)}`,
          );
        });
      }
    },

    dispose() {
      clear();
      root.remove();
    },
  };
}
