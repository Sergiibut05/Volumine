'use client';

import { useEffect, useRef, useState } from 'react';
import { useOrigin } from '@/lib/use-origin';
import { buildEmbedUrl } from '@/lib/config/url';
import { useI18n } from '@/lib/i18n/client';
import { samplesFor } from '@/lib/i18n/samples';
import type { ChartConfig } from '@/lib/config/schema';

/*
  ══════════════════════════════════════════════════════════════════════════
  LA GRÁFICA DENTRO DE UNA PÁGINA, Y QUE LA TOQUE QUIEN MIRA
  ══════════════════════════════════════════════════════════════════════════

  ── POR QUÉ ESTO NO ES UN VÍDEO ──────────────────────────────────────────

  Un vídeo de un producto interactivo es la peor versión de ese producto: pesa
  megas, se ve blando al escalar, hay que pelear el autoplay en el móvil y, sobre
  todo, DICE que la gráfica gira en vez de girar. El argumento de esta página es
  que el link es el producto; un vídeo lo convierte en «te enseño un vídeo de un
  link».

  Lo de aquí abajo es un `<iframe>` de `/embed` DE VERDAD, el mismo que se pega
  en cualquier sitio. No cuesta nada que no costara ya —es el propio producto— y
  demuestra en vez de afirmar.

  ── POR QUÉ UN DOCUMENTO Y NO UNA DIAPOSITIVA ────────────────────────────

  Una diapositiva es un rectángulo con una gráfica encima: no hay contexto
  contra el que contrastar, así que no se ve nada que no se viera ya. Un
  documento con texto alrededor enseña el caso difícil y el más común — y al
  cambiar el ancho de la gráfica, EL TEXTO SE RECOLOCA SOLO. Eso es lo que se
  siente de verdad: no está encima de la página, está DENTRO.

  ── POR QUÉ NO HAY UNA VENTANA DE NAVEGADOR DIBUJADA ─────────────────────

  Porque es el cliché número uno de las landings de este sector y
  `docs/DESIGN.md` prohíbe parecer una plantilla. Aquí el documento se apoya
  sobre el mismo papel que el resto de la página, con sombra real, en la
  dirección «estudio». Y no aparece la interfaz de nadie: ni marcas, ni logos,
  ni una copia de la interfaz de otro producto.
*/

/*
  Anchos de la gráfica dentro de la columna, en porcentaje de la página.

  Los dos topes están MEDIDOS, no elegidos a ojo. Las etiquetas del embed tienen
  tamaño fijo en píxeles y el dibujo no: por abajo llega un punto en el que se le
  echan encima y tapan las porciones —al 30% era ilegible—, y por arriba otro en
  el que la etiqueta de la derecha roza el borde del marco. El rango de aquí es
  el tramo donde la gráfica se ve BIEN en los dos extremos, que es lo único que
  una demo tiene que enseñar.
*/
const MIN = 38;
const MAX = 60;
/* Empieza en poco más de un tercio: con el 58 que tenía, la columna de texto se
   quedaba en veinticinco caracteres y el párrafo se leía como un acordeón.
   Aquí lo que hay que ver es la gráfica DENTRO de un texto, no un texto
   estrangulado por una gráfica. */
const INICIAL = 48;

/** Por debajo de esto el documento va a una columna y el tirador estorba. */
const ESTRECHO = 720;

const base = (labels: string[], unit: string, numberLocale: string): ChartConfig => ({
  v: 1,
  type: 'donut',
  theme: 'estudio',
  data: {
    labels: labels.slice(0, 4),
    series: [{ values: [42, 26, 18, 14] }],
    format: { unit, locale: numberLocale },
  },
  /* Transparente A PROPÓSITO: es la prueba de la promesa. La gráfica se apoya
     sobre el papel del documento sin traer un rectángulo de otro color. */
  scene: { background: { kind: 'transparent' } },
  labels: {
    show: true,
    mode: 'outside',
    showValues: true,
    /* Sin caja, para que no traiga píldoras oscuras a un documento claro. Y con
       TINTA OSCURA: el blanco de por defecto sobre papel se lee fatal aunque
       lleve halo — es el caso flojo de `plain`, y aquí el fondo sí lo sabemos. */
    finish: 'plain',
    color: '#3a3a44',
  },
  motion: { autoRotate: true, speed: 0.35 },
  /* Más cerca de lo normal: dentro de un documento la gráfica compite con el
     texto por la atención, y con el encuadre de por defecto quedaba nadando en
     su propio marco con más aire que dibujo. */
  camera: { distance: 0.82 },
  layout: { watermark: false },
});

export function EnUso() {
  const { d, locale } = useI18n();
  const origin = useOrigin();

  const [ancho, setAncho] = useState(INICIAL);
  const [arrastrando, setArrastrando] = useState(false);
  /* El iframe no se monta hasta que la sección se ve. La página ya tiene un
     canvas en el héroe y hasta seis en la galería; un navegador aguanta del
     orden de 8-16 contextos WebGL y aquí no hace falta gastar uno de más. */
  const [visible, setVisible] = useState(false);
  const [estrecho, setEstrecho] = useState(false);

  const pagina = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodo = pagina.current;
    if (!nodo) return;

    const observer = new IntersectionObserver(
      ([entrada]) => entrada.isIntersecting && setVisible(true),
      { rootMargin: '200px' },
    );
    observer.observe(nodo);

    /* En una columna estrecha el tirador es un estorbo —compite con el gesto de
       hacer scroll— y el texto no tiene sitio para recolocarse, que es lo único
       que esto quería enseñar. Se mide el ELEMENTO, no la ventana: aquí lo que
       manda es cuánto sitio hay, no qué aparato es. */
    const medidor = new ResizeObserver(([entrada]) => {
      setEstrecho(entrada.contentRect.width < ESTRECHO);
    });
    medidor.observe(nodo);

    return () => {
      observer.disconnect();
      medidor.disconnect();
    };
  }, []);

  const muestra = samplesFor(locale).initial;
  const config = base(muestra.labels, muestra.unit, muestra.numberLocale);
  const url = origin ? buildEmbedUrl(config, origin) : null;

  /*
    El arrastre, con captura de puntero.

    `setPointerCapture` es lo que hace que el gesto siga funcionando cuando el
    cursor se sale del tirador —que pasa siempre, porque se arrastra rápido— y
    de paso cubre el dedo y el ratón con el mismo código. Con eventos de ratón
    haría falta escuchar en `window` y limpiar a mano.
  */
  const empezar = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (estrecho) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastrando(true);
  };

  const mover = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!arrastrando || !pagina.current) return;
    const caja = pagina.current.getBoundingClientRect();
    const pct = ((e.clientX - caja.left) / caja.width) * 100;
    setAncho(Math.min(MAX, Math.max(MIN, pct)));
  };

  const soltar = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setArrastrando(false);
  };

  return (
    <section className="shell enuso">
      <p className="spec-label">{d.landing.inUseLabel}</p>
      <h2 className="display enuso-title">{d.landing.inUseTitle}</h2>
      <p className="enuso-lead">{d.landing.inUseBody}</p>

      {/* La «página»: papel, sombra real y tipografía de documento. Ni marco de
          navegador ni interfaz de nadie. */}
      <div className="doc" ref={pagina} data-arrastrando={arrastrando || undefined}>
        <article className="doc-body">
          <p className="doc-kicker">{d.landing.docKicker}</p>
          <h3 className="doc-title">{d.landing.docTitle}</h3>

          {/*
            La gráfica FLOTA a la derecha y el texto la rodea. Es lo que hace que
            al cambiar su ancho el párrafo se recomponga solo: sin flotado el
            texto se quedaría quieto y no se vería nada.
          */}
          <div className="doc-chart" style={{ width: `${ancho}%` }}>
            <div className="doc-frame">
              {visible && url?.ok ? (
                <iframe
                  src={url.url}
                  title={d.landing.inUseTitle}
                  loading="lazy"
                  /* Sin borde y sin fondo: el embed es transparente y tiene que
                     apoyarse sobre el papel del documento. */
                  style={{ border: 0, display: 'block', width: '100%', height: '100%' }}
                />
              ) : null}
            </div>

            {!estrecho && (
              <button
                type="button"
                className="doc-grip"
                onPointerDown={empezar}
                onPointerMove={mover}
                onPointerUp={soltar}
                onPointerCancel={soltar}
                aria-label={d.landing.dragHint}
              >
                <span aria-hidden />
              </button>
            )}
          </div>

          <p>{d.landing.docP1}</p>
          <p>{d.landing.docP2}</p>
          <p>{d.landing.docP3}</p>
        </article>

        {/* La medida, como en una ficha técnica. Es el guiño al specsheet de
            arriba y da la sensación de estar tocando algo de verdad. */}
        <span className="doc-size" aria-hidden>
          {Math.round(ancho)}%
        </span>
      </div>

      <p className="enuso-foot">
        {estrecho ? d.landing.inUseFootNarrow : d.landing.dragHint}
      </p>
    </section>
  );
}
