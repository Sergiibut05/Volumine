'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { createChart, setPoster, updateChart } from '@/lib/charts/actions';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { dataUrlToBlob, posterPath } from '@/lib/charts/poster';
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
  /** Id del usuario, para componer la ruta del póster. */
  userId: string | null;
  /** Devuelve la escena actual en PNG. Lo rellena `ChartCanvas`. */
  capture: React.MutableRefObject<(() => string) | null>;
};

export function SaveBar({
  config,
  chartId,
  visibility,
  signedIn,
  userId,
  capture,
}: Props) {
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

  /** Captura el canvas y lo deja en Storage. Silencioso: ver la nota de arriba. */
  async function subirPoster(id: string, slug: string) {
    const png = capture.current?.();
    if (!png || !userId) return;

    try {
      const ruta = posterPath(userId, slug);
      const { error } = await supabaseBrowser()
        .storage.from('posters')
        .upload(ruta, await dataUrlToBlob(png), {
          contentType: 'image/png',
          /* Al reguardar hay que PISAR el póster viejo: si no, el link seguiría
             enseñando en Slack una versión de la gráfica que ya no existe. */
          upsert: true,
        });

      /* El id sale del RESULTADO y no de `chartId`: en una gráfica nueva
         `chartId` todavía es null cuando esto corre. */
      if (!error) await setPoster(id, ruta);
    } catch {
      // Ver la nota de arriba: el póster nunca puede tumbar un guardado.
    }
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

      /*
        El póster va DESPUÉS y aparte, sin bloquear el «Guardado».

        Guardar la gráfica y tener vista previa en Slack son dos cosas de
        importancia muy distinta: si la subida falla —sin conexión, cuota de
        almacenamiento, un navegador raro— el trabajo ya está a salvo y no se
        dice nada. Una gráfica sin póster funciona igual.
      */
      void subirPoster(resultado.id, resultado.slug);

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
      {/*
        ESTADO PASIVO, y por eso NO puede ser lo más brillante de la barra.

        Iba en violeta lleno y «Guardar» en un borde discreto: el ojo leía
        «Publicada» como el botón y el botón como decoración. En una interfaz, el
        color de acento se reserva para lo que se PULSA. Aquí lo único que se
        pulsa es guardar.

        Ahora es una píldora neutra con un punto de color: el punto basta para
        decir «esto está vivo» sin competir con nada.
      */}
      {chartId && visibility === 'public' && !error && (
        <span className="savebar-live">
          <i aria-hidden />
          Publicada
        </span>
      )}

      <button type="button" onClick={guardar} disabled={pendiente}>
        {pendiente ? 'Guardando…' : guardado ? 'Guardado' : chartId ? 'Guardar' : 'Guardar'}
      </button>
    </div>
  );
}
