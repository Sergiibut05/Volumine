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
};

export function ChartCanvas({
  config,
  onHover,
  onFrame,
  className,
  style,
}: ChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  // Montaje: una sola vez. El config posterior entra por update().
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handle = createChartRenderer(canvas, config);
    handle.onHover((info) => onHoverRef.current?.(info));
    handle.onFrame((label) => onFrameRef.current?.(label));
    handleRef.current = handle;

    return () => {
      handle.dispose();
      handleRef.current = null;
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
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        ...style,
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
