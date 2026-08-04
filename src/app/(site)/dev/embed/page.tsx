'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOrigin } from '@/lib/use-origin';
import { buildEmbedUrl } from '@/lib/config/url';
import type { ChartConfig } from '@/lib/config/schema';

/*
  Prueba del embed tal y como lo va a usar un cliente: dentro de un <iframe> de
  verdad, y con el atributo `sandbox` puesto, que es lo que hace Confluence Cloud
  por defecto (ADR 0005). Si funciona aquí, funciona ahí.
*/

const CONFIG: ChartConfig = {
  v: 1,
  type: 'donut',
  title: 'Reparto de ingresos',
  data: {
    labels: ['Suscripciones', 'Servicios', 'Licencias', 'Formación', 'Otros'],
    series: [{ name: '2026', values: [42, 26, 17, 9, 6] }],
    format: { unit: ' k€', locale: 'es-ES' },
  },
};

type Message = { type: string; height?: number };

export default function EmbedDevPage() {
  const [messages, setMessages] = useState<Message[]>([]);

  const origin = useOrigin();

  // Escucha lo que el embed le cuenta a la página anfitriona.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.source !== 'voluma') return;
      setMessages((prev) => [...prev.slice(-4), event.data as Message]);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const url = useMemo(() => (origin ? buildEmbedUrl(CONFIG, origin) : null), [origin]);

  if (!url?.ok) return <main style={{ padding: 32 }}>Preparando…</main>;

  return (
    <main
      style={{
        minHeight: '100dvh',
        padding: 'var(--p-space-8)',
        display: 'grid',
        gap: 'var(--p-space-6)',
        maxWidth: 1100,
        margin: '0 auto',
      }}
    >
      <header style={{ display: 'grid', gap: 'var(--p-space-2)' }}>
        <h1
          style={{
            font: '600 var(--p-text-2xl)/1.1 var(--font-display)',
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          El embed, dentro de un iframe
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Con <code>sandbox</code>, sin cookies y sin nada de terceros. La configuración
          entera viaja en la URL: {url.length} caracteres.
        </p>
      </header>

      <section
        style={{
          borderRadius: 'var(--p-radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
          background: 'var(--surface-raised)',
        }}
      >
        <iframe
          src={url.url}
          title="Gráfica de ejemplo de Voluma"
          width="100%"
          height="440"
          style={{ display: 'block', border: 0 }}
          sandbox="allow-scripts"
          loading="lazy"
        />
      </section>

      <section style={{ display: 'grid', gap: 'var(--p-space-2)' }}>
        <h2 style={{ font: '600 var(--p-text-lg)/1.2 var(--font-display)', margin: 0 }}>
          Para pegar en tu web
        </h2>
        <textarea
          readOnly
          rows={3}
          value={`<iframe src="${url.url}" width="100%" height="440" style="border:0" loading="lazy"></iframe>`}
          style={{
            width: '100%',
            padding: 'var(--p-space-3)',
            borderRadius: 'var(--p-radius-md)',
            border: '1px solid var(--edge-subtle)',
            background: 'var(--surface-sunken)',
            color: 'var(--text-secondary)',
            font: '12px/1.5 ui-monospace, monospace',
            resize: 'vertical',
          }}
        />
      </section>

      <section style={{ display: 'grid', gap: 'var(--p-space-2)' }}>
        <h2 style={{ font: '600 var(--p-text-lg)/1.2 var(--font-display)', margin: 0 }}>
          postMessage recibidos
        </h2>
        <ul
          style={{
            margin: 0,
            padding: 'var(--p-space-3)',
            listStyle: 'none',
            borderRadius: 'var(--p-radius-md)',
            background: 'var(--surface-sunken)',
            color: 'var(--text-muted)',
            font: '12px/1.7 ui-monospace, monospace',
            minHeight: 64,
          }}
        >
          {messages.length === 0 ? (
            <li>Esperando…</li>
          ) : (
            messages.map((m, i) => (
              <li key={i} data-numeric>
                {m.type}
                {m.height ? ` · altura ${m.height}px` : ''}
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
