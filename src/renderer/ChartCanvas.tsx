'use client';

import { useEffect, useRef } from 'react';
import type { ResolvedChartConfig } from '@/lib/config/defaults';
import {
  createChartRenderer,
  type ChartRendererHandle,
  type HoverInfo,
} from './core/chart-renderer';

/*
  Envoltorio de React sobre el renderer. Lo único que hace es montarlo,
  pasarle los cambios de config y desmontarlo.

  Deliberadamente tonto: toda la lógica de escena vive en core/chart-renderer.ts
  y no depende de React (ADR 0006). El editor usa este componente; el embed monta
  el renderer directamente, sin pasar por aquí.
*/

export type ChartCanvasProps = {
  config: ResolvedChartConfig;
  onHover?: (info: HoverInfo) => void;
  /** Periodo que se está mostrando en una carrera de barras. `null` si no aplica. */
  onFrame?: (label: string | null) => void;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Se rellena con una función que devuelve la escena actual en PNG.
   *
   * Por `ref` y no por callback porque no es un evento: es algo que el
   * anfitrión PIDE cuando le hace falta —al guardar— y no algo que ocurra.
   */
  captureRef?: React.MutableRefObject<(() => string) | null>;
};

export function ChartCanvas({
  config,
  onHover,
  onFrame,
  className,
  style,
  captureRef,
}: ChartCanvasProps) {
  /* El contenedor, no el canvas: el canvas lo crea y lo destruye el efecto de
     montaje. Ver la nota larga que hay ahí abajo. */
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<ChartRendererHandle | null>(null);
  /* Los callbacks viven en refs para que cambiar de manejador no desmonte el
     renderer, que costaría recrear el contexto WebGL entero.

     Se asignan en un efecto y no durante el render: escribir en un ref mientras
     se renderiza rompe con Strict Mode y con render concurrente, donde React
     puede descartar un render a medias. */
  const onHoverRef = useRef(onHover);
  const onFrameRef = useRef(onFrame);

  useEffect(() => {
    onHoverRef.current = onHover;
    onFrameRef.current = onFrame;
  }, [onHover, onFrame]);

  /*
    ══════════════════════════════════════════════════════════════════════════
    EL CANVAS LO CREA EL EFECTO, NO EL JSX. Y ES OBLIGATORIO.
    ══════════════════════════════════════════════════════════════════════════

    Un `<canvas>` solo entrega UN contexto en toda su vida: `getContext()`
    devuelve siempre el mismo objeto, y si ese contexto se pierde, lo sigue
    devolviendo —perdido— para siempre. No hay forma de resucitarlo.

    `dispose()` termina en `forceContextLoss()`, que es justo lo que hay que
    hacer para soltar la GPU en el acto en vez de esperar al recolector: un
    navegador aguanta del orden de dieciséis contextos vivos y al diecisiete
    empieza a matar los viejos.

    Juntando las dos cosas: si el canvas lo pone el JSX, React REUTILIZA el
    mismo nodo entre desmontaje y montaje —que es exactamente lo que hace Strict
    Mode en desarrollo, y lo que puede hacer en producción al remontar— y el
    segundo montaje recibe un contexto ya muerto. three.js pregunta entonces por
    `getShaderPrecisionFormat(...)`, que en un contexto perdido devuelve `null`,
    y revienta con un «Cannot read properties of null (reading 'precision')»
    que no dice absolutamente nada sobre la causa.

    Creándolo aquí, cada montaje estrena canvas y el de antes se va con su
    contexto muerto a cuestas. No es un rodeo: es la única forma de conservar
    `forceContextLoss()` —que hace falta— sin envenenar el siguiente montaje.
  */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    /* Antes de crear el renderer: mide y observa a `parentElement`, así que
       tiene que estar ya colgado del contenedor. */
    host.appendChild(canvas);

    const handle = createChartRenderer(canvas, config);
    handle.onHover((info) => onHoverRef.current?.(info));
    handle.onFrame((label) => onFrameRef.current?.(label));
    handleRef.current = handle;
    if (captureRef) captureRef.current = () => handle.capture();

    return () => {
      handle.dispose();
      canvas.remove();
      handleRef.current = null;
      if (captureRef) captureRef.current = null;
    };
    // Solo al montar: el config se propaga en el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    handleRef.current?.update(config);
  }, [config]);

  return (
    /* El contenedor es quien tiene el tamaño y a quien observa el renderer.
       `minHeight: 0` no es decorativo: dentro de un grid, los items llevan
       min-height:auto, la celda mide 0 en el primer paint y el canvas se queda
       en 300×150 sin dar ningún error. */
    <div
      ref={hostRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        ...style,
      }}
    ></div>
  );
}
