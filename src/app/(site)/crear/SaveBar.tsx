'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { createChart, updateChart } from '@/lib/charts/actions';
import type { ChartConfig } from '@/lib/config/schema';
import type { Visibility } from '@/lib/supabase/types';

/*
  Guardar, y decir en qué estado está lo que estás mirando.

  GUARDAR ES OPCIONAL, y esa es la idea del producto: la config viaja dentro del
  link, así que se puede hacer una gráfica, copiar el link y pegarlo sin haber
  visto nunca una pantalla de registro. Guardar sirve para dos cosas concretas
  —un link corto y poder volver a editarla— y hasta que alguien quiera una de
  las dos, aquí solo hay una invitación, no un muro.
*/

type Props = {
  config: ChartConfig;
  chartId: string | null;
  visibility: Visibility | null;
  signedIn: boolean;
};

export function SaveBar({ config, chartId, visibility, signedIn }: Props) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  if (!signedIn) {
    return (
      <Link className="savebar-link" href="/entrar?next=/crear">
        Guardar
      </Link>
    );
  }

  const guardar = () =>
    startTransition(async () => {
      setError(null);
      const resultado = chartId
        ? await updateChart(chartId, config)
        : await createChart(config);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setGuardado(true);
      setTimeout(() => setGuardado(false), 1800);

      /* Una gráfica NUEVA pasa a ser una gráfica EDITADA: la URL tiene que
         reflejarlo o el siguiente «guardar» crearía un duplicado. `replace` y
         no `push` para no dejar el estado «sin guardar» en el historial. */
      if (!chartId) router.replace(`/crear?id=${resultado.id}`);
    });

  return (
    <div className="savebar">
      {error && (
        <span className="savebar-error" role="alert">
          {error}
        </span>
      )}

      {/* Que sea pública se dice AQUÍ, junto al botón, y no en otra pantalla:
          es lo que decide si al guardar cambias algo que ya está incrustado en
          la página de alguien. */}
      {chartId && visibility === 'public' && !error && (
        <span className="savebar-live">Publicada</span>
      )}

      <button type="button" onClick={guardar} disabled={pendiente}>
        {pendiente ? 'Guardando…' : guardado ? 'Guardado' : chartId ? 'Guardar' : 'Guardar'}
      </button>
    </div>
  );
}
