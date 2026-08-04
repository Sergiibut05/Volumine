'use client';

import { useEffect, useRef, useState } from 'react';
import { ChartCanvas } from '@/renderer/ChartCanvas';
import { parseConfig } from '@/lib/config/parse';
import type { ChartTypeEntry } from '@/lib/chart-types';

/*
  Tarjeta de tipo de gráfica.

  El 3D solo se monta cuando la tarjeta entra en viewport, y solo en los tipos
  que existen. Un navegador aguanta ~8-16 contextos WebGL: cinco tarjetas
  montando canvas a la vez en la landing es exactamente cómo se rompe una página
  en un portátil de gama media.
*/

export function TypeCard({ type }: { type: ChartTypeEntry }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || !type.sample || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { rootMargin: '120px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [type.sample]);

  const parsed = type.sample ? parseConfig(type.sample) : null;

  return (
    <article className="card" ref={ref}>
      <div className="card-stage">
        {parsed?.ok && visible ? (
          <ChartCanvas
            config={{
              ...parsed.config,
              motion: { ...parsed.config.motion, speed: 0.5 },
              layout: { ...parsed.config.layout, watermark: false },
            }}
          />
        ) : (
          /* Los tipos que aún no existen se dibujan con CSS. Ni un contexto
             WebGL gastado en algo que no se puede usar todavía. */
          <div className="ghost" aria-hidden>
            <i style={{ height: 34 }} />
            <i style={{ height: 54 }} />
            <i style={{ height: 22 }} />
            <i style={{ height: 44 }} />
          </div>
        )}
      </div>

      <div className="card-body">
        {/* `baseline` y no `center`: con un título de dos líneas, centrar deja
            la etiqueta flotando en medio. Y `flex-wrap` para que no parta la
            etiqueta por dentro. */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            gap: '0.5rem 0.625rem',
          }}
        >
          <h3>{type.name}</h3>
          <span className="tag" data-status={type.status}>
            {type.status === 'listo' ? 'Listo' : 'En camino'}
          </span>
        </div>
        <p>{type.answers}</p>
        <p className="avoid">
          <strong style={{ fontWeight: 600 }}>Evítalo:</strong> {type.avoid}
        </p>
      </div>
    </article>
  );
}
