'use client';

import { useEffect, useRef, useState } from 'react';
import { ChartStage } from '@/renderer/ChartStage';
import type { ResolvedChartConfig } from '@/lib/config/defaults';
import type { ConfigIssue } from '@/lib/config/parse';
import { describeChart } from './DataTable';

/*
  El canvas del embed y todo lo que lo rodea. Aquí es donde se cumplen —o se
  incumplen— las promesas de docs/PERFORMANCE-BUDGET.md.

  Tres cosas que no son opcionales:

  1. El canvas NO se monta hasta que el embed entra en viewport, y se desmonta
     al salir. Un navegador aguanta ~8-16 contextos WebGL: una página de Notion
     con seis gráficas nuestras tiene que funcionar.
  2. Sin WebGL no se monta nada. La tabla de datos que ya está en el DOM es la
     versión que ve esa gente.
  3. Toda la comunicación con la página anfitriona es por postMessage. Nada de
     cookies, storage ni navegación al top (ADR 0005).
*/

const OUT_OF_VIEW_GRACE_MS = 10_000;

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function EmbedChart({
  config,
  issues,
}: {
  config: ResolvedChartConfig;
  issues: ConfigIssue[];
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setSupported(hasWebGL());
  }, []);

  // Monta solo en viewport; desmonta pasado un margen de gracia al salir, para
  // no destruir y recrear el contexto en cada scroll.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          clearTimeout(timer);
          setVisible(true);
        } else {
          timer = setTimeout(() => setVisible(false), OUT_OF_VIEW_GRACE_MS);
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(host);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  // Avisa a la página anfitriona de la altura que necesita y de los problemas
  // del config. Nunca tocamos su DOM: solo le decimos cosas.
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;

    const post = (payload: Record<string, unknown>) => {
      // targetOrigin '*': no sabemos quién nos incrusta, y no enviamos nada
      // sensible — solo dimensiones y avisos del propio config del usuario.
      window.parent.postMessage({ source: 'voluma', ...payload }, '*');
    };

    post({ type: 'ready', height: document.documentElement.scrollHeight });
    if (issues.length > 0) post({ type: 'issues', issues });

    const observer = new ResizeObserver(() => {
      post({ type: 'resize', height: document.documentElement.scrollHeight });
    });
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, [issues]);

  const label = describeChart(config);

  return (
    <div ref={hostRef} className="stage" role="img" aria-label={label}>
      {supported && visible && <ChartStage config={config} />}
      {supported === false && <NoWebGL />}
    </div>
  );
}

function NoWebGL() {
  return (
    <div
      style={{ display: 'grid', placeContent: 'center', height: '100%', padding: '1rem' }}
    >
      <p style={{ color: '#9a9aab', fontSize: 13, margin: 0, textAlign: 'center' }}>
        Este navegador no puede mostrar gráficas 3D.
      </p>
    </div>
  );
}
