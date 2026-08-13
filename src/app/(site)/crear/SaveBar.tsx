'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { createChart, setPoster, updateChart } from '@/lib/charts/actions';
import { supabaseBrowser } from '@/lib/supabase/browser';
import {
  composePoster,
  dataUrlToBlob,
  posterPath,
  POSTER_FORMATS,
  type PosterBackground,
} from '@/lib/charts/poster';
import type { ChartConfig } from '@/lib/config/schema';
import type { Visibility } from '@/lib/supabase/types';
import { useI18n } from '@/lib/i18n/client';

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
  /**
   * El fondo YA RESUELTO, para pintarlo debajo del póster.
   *
   * Va como prop y no se saca de `config` aquí porque `config` es la versión
   * cruda —sin defaults aplicados— y el póster tiene que enseñar exactamente lo
   * mismo que la pantalla. Quien ya ha resuelto la config es el editor.
   */
  background: PosterBackground | null;
  /** Tema y paleta, para elegir sobre qué se aplana un póster transparente. */
  chart: { theme?: string; palette?: readonly string[] };
  /**
   * Se llama al intentar guardar sin nombre.
   *
   * El botón NO se apaga: uno apagado no dice qué falta, solo que no puedes, y
   * te deja buscando. Se deja pulsable y al pulsarlo se señala el campo que
   * falta — que es donde hay que mirar.
   */
  onMissingTitle: () => void;
};

export function SaveBar({
  config,
  chartId,
  visibility,
  signedIn,
  userId,
  capture,
  background,
  chart,
  onMissingTitle,
}: Props) {
  const { d } = useI18n();
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  if (!signedIn) {
    return (
      <Link className="savebar-link" href="/entrar?next=/crear">
        {d.common.save}
      </Link>
    );
  }

  /** Captura el canvas y lo deja en Storage. Silencioso: ver la nota de arriba. */
  async function subirPoster(id: string, slug: string) {
    const png = capture.current?.();
    if (!png || !userId) return;

    try {
      /* Con el fondo debajo, y en PNG o JPEG segun haga falta alfa. Ver la
         nota larga en `composePoster`. */
      const poster = background
        ? await composePoster(png, background, chart)
        : { dataUrl: png, format: 'png' as const, contentType: 'image/png' };

      const ruta = posterPath(userId, slug, poster.format);
      const { error } = await supabaseBrowser()
        .storage.from('posters')
        .upload(ruta, await dataUrlToBlob(poster.dataUrl), {
          contentType: poster.contentType,
          /* Al reguardar hay que PISAR el póster viejo: si no, el link seguiría
             enseñando en Slack una versión de la gráfica que ya no existe. */
          upsert: true,
        });

      /* El id sale del RESULTADO y no de `chartId`: en una gráfica nueva
         `chartId` todavía es null cuando esto corre. */
      if (!error) await setPoster(id, ruta);

      /*
        Y fuera el póster de la OTRA extensión, si lo hubiera.

        Cambiar el fondo de transparente a sólido cambia el formato, y con él el
        nombre del fichero: `slug.png` deja de estar apuntado por nadie pero
        sigue ocupando sitio en el bucket para siempre. Se borra a la vuelta y
        sin mirar el resultado — si falla, lo peor que pasa es que sobre un
        fichero, y eso no puede tumbar un guardado.
      */
      const sobra = POSTER_FORMATS.filter((f) => f !== poster.format).map((f) =>
        posterPath(userId, slug, f),
      );
      if (sobra.length > 0) {
        await supabaseBrowser().storage.from('posters').remove(sobra);
      }
    } catch (fallo) {
      /*
        El póster nunca puede tumbar un guardado —ver la nota de arriba—, pero
        SILENCIARLO DEL TODO fue un error que costó semanas: el bucket dejó de
        aceptar el formato del póster y aquí no pasaba nada, así que las
        miniaturas desaparecieron sin que ni un mensaje lo dijera. Un fallo que
        no deja rastro se descubre cuando alguien se fija, no cuando ocurre.

        Tragado para quien usa la aplicación, visible para quien la mantiene.
      */
      console.error('[poster] no se pudo subir', fallo);
    }
  }

  /* Sin nombre no se guarda. No es una validación por validar: en el listado y
     en la tarjeta de enlace lo único que distingue una gráfica de otra es su
     nombre, y «Sin título» repetido cinco veces no distingue nada. */
  const sinNombre = !config.title?.trim();

  const guardar = () => {
    if (sinNombre) {
      onMissingTitle();
      return;
    }

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
  };

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
          {d.editor.published}
        </span>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={pendiente}
      >
        {pendiente ? d.common.saving : guardado ? d.common.saved : d.common.save}
      </button>
    </div>
  );
}
