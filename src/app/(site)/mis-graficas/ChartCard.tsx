'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { deleteChart, duplicateChart, setVisibility } from '@/lib/charts/actions';
import type { ChartSummary } from '@/lib/supabase/types';

const NOMBRE_TIPO: Record<string, string> = {
  donut: 'Anillo',
  pie: 'Tarta',
  bar: 'Barras',
  'bar-race': 'Barras animadas',
  globe: 'Globo',
  gauge: 'Medidor',
};

/** «hace 3 días». Relativo porque en un listado propio importa más que la fecha. */
function cuando(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export function ChartCard({ chart, origin }: { chart: ChartSummary; origin: string }) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const publica = chart.visibility === 'public';
  const embedUrl = `${origin}/embed/${chart.slug}`;

  const correr = (accion: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const resultado = await accion();
      if (!resultado.ok) setError(resultado.error ?? 'Algo ha fallado.');
    });

  const copiar = async () => {
    await navigator.clipboard.writeText(embedUrl);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  };

  /*
    Borrar pide confirmación y no tiene deshacer.

    No hay papelera a propósito: el link publicado deja de funcionar en el acto,
    y quien borra una gráfica publicada muchas veces lo hace justo porque no
    quería que se siguiera viendo. Una papelera de 30 días sería lo contrario de
    lo que ha pedido.
  */
  const borrar = () => {
    const nombre = chart.title || 'esta gráfica';
    const aviso = publica
      ? `Vas a borrar «${nombre}». Su link dejará de funcionar donde esté incrustado.`
      : `Vas a borrar «${nombre}». No se puede deshacer.`;
    if (confirm(aviso)) correr(() => deleteChart(chart.id));
  };

  return (
    <li className="chart-card">
      <h2 title={chart.title ?? 'Sin título'}>{chart.title || 'Sin título'}</h2>

      <div className="chart-meta">
        <span className="chart-badge" data-visibility={chart.visibility}>
          {publica ? 'Pública' : 'Privada'}
        </span>
        <span>{NOMBRE_TIPO[chart.type] ?? chart.type}</span>
        <span>·</span>
        <span>{cuando(chart.updated_at)}</span>
      </div>

      <div className="chart-actions">
        <Link href={`/crear?id=${chart.id}`}>Editar</Link>

        {/* Copiar el link solo si el link SIRVE. Ofrecerlo en una privada sería
            regalar una URL que da 404 a quien la reciba. */}
        {publica && (
          <button type="button" onClick={copiar}>
            {copiado ? 'Copiado' : 'Copiar link'}
          </button>
        )}

        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            correr(() => setVisibility(chart.id, publica ? 'private' : 'public'))
          }
        >
          {publica ? 'Despublicar' : 'Publicar'}
        </button>

        <button
          type="button"
          disabled={pendiente}
          onClick={() => correr(() => duplicateChart(chart.id))}
        >
          Duplicar
        </button>

        <button type="button" className="danger" disabled={pendiente} onClick={borrar}>
          Borrar
        </button>
      </div>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
