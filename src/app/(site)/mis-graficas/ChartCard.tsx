'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { deleteChart, duplicateChart, setVisibility } from '@/lib/charts/actions';
import type { ChartSummary } from '@/lib/supabase/types';
import { posterUrl } from '@/lib/charts/poster';
import { useI18n } from '@/lib/i18n/client';
import { fill, type Dictionary, type Locale } from '@/lib/i18n/dictionaries';

/**
 * «hace 3 días». Relativo porque en un listado propio importa más que la fecha.
 *
 * Pasado el mes se cae a la fecha corta con `Intl`, que ya sabe que en inglés
 * va «Mar 4» y en español «4 mar». Ese orden no es algo que traducir a mano.
 */
function cuando(iso: string, d: Dictionary, locale: Locale): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return d.charts.today;
  if (dias === 1) return d.charts.yesterday;
  if (dias < 30) return fill(d.charts.daysAgo, { days: dias });
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export function ChartCard({ chart, origin }: { chart: ChartSummary; origin: string }) {
  const { d, locale } = useI18n();
  const nombreTipo = (tipo: string) =>
    d.types[tipo as keyof Dictionary['types']]?.name ?? tipo;
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const publica = chart.visibility === 'public';
  const embedUrl = `${origin}/embed/${chart.slug}`;

  const correr = (accion: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const resultado = await accion();
      if (!resultado.ok) setError(resultado.error ?? d.common.somethingFailed);
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
    const nombre = chart.title || d.charts.untitled;
    const aviso = fill(
      publica ? d.charts.confirmDeletePublic : d.charts.confirmDelete,
      { name: nombre },
    );
    if (confirm(aviso)) correr(() => deleteChart(chart.id));
  };

  const poster = posterUrl(chart.poster_path, chart.updated_at);

  return (
    <li className="chart-card">
      {/*
        LA MINIATURA ES LA TARJETA.

        Un listado de gráficas sin gráficas es una lista de títulos: para saber
        cuál es cuál hay que leer, y los títulos que pone la gente se parecen
        entre sí («Ventas», «Ventas 2», «Ventas final»). La imagen la reconoces
        de un vistazo, que es como se busca de verdad entre cosas propias.

        Se aprovecha el póster que ya se sube al guardar — no cuesta nada nuevo.
        Las de antes del póster caen al hueco con el nombre del tipo, que al
        menos distingue un globo de un anillo.
      */}
      <Link className="chart-thumb" href={`/crear?id=${chart.id}`} tabIndex={-1} aria-hidden>
        {poster ? (
          <img src={poster} alt="" loading="lazy" decoding="async" />
        ) : (
          <span>{nombreTipo(chart.type)}</span>
        )}
      </Link>

      <h2 title={chart.title ?? d.charts.untitled}>{chart.title || d.charts.untitled}</h2>

      <div className="chart-meta">
        <span className="chart-badge" data-visibility={chart.visibility}>
          {publica ? d.charts.public : d.charts.private}
        </span>
        <span>{nombreTipo(chart.type)}</span>
        <span>·</span>
        <span>{cuando(chart.updated_at, d, locale)}</span>
      </div>

      <div className="chart-actions">
        <Link href={`/crear?id=${chart.id}`}>{d.common.edit}</Link>

        {/* Copiar el link solo si el link SIRVE. Ofrecerlo en una privada sería
            regalar una URL que da 404 a quien la reciba. */}
        {publica && (
          <button type="button" onClick={copiar}>
            {copiado ? d.common.copied : d.common.copyLink}
          </button>
        )}

        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            correr(() => setVisibility(chart.id, publica ? 'private' : 'public'))
          }
        >
          {publica ? d.charts.unpublish : d.charts.publish}
        </button>

        <button
          type="button"
          disabled={pendiente}
          onClick={() => correr(() => duplicateChart(chart.id))}
        >
          {d.common.duplicate}
        </button>

        <button type="button" className="danger" disabled={pendiente} onClick={borrar}>
          {d.common.delete}
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
