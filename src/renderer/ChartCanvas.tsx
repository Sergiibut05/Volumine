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
  className?: string;
  style?: React.CSSProperties;
};

export function ChartCanvas({ config, onHover, className, style }: ChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<ChartRendererHandle | null>(null);
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;

  // Montaje: una sola vez. El config posterior entra por update().
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handle = createChartRenderer(canvas, config);
    handle.onHover((info) => onHoverRef.current?.(info));
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
