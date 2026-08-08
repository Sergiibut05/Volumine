'use client';

import { useEffect, useRef, useState } from 'react';
import { useOrigin } from '@/lib/use-origin';
import { buildEmbedUrl } from '@/lib/config/url';
import { useI18n } from '@/lib/i18n/client';
import { samplesFor } from '@/lib/i18n/samples';
import type { ChartConfig } from '@/lib/config/schema';

/*
  ══════════════════════════════════════════════════════════════════════════
  UN SOLO EMBED, Y ALREDEDOR CAMBIA EL MUNDO
  ══════════════════════════════════════════════════════════════════════════

  ── EL ARGUMENTO ─────────────────────────────────────────────────────────

  Hay un `<iframe>` de `/embed` DE VERDAD, y NO SE DESMONTA NUNCA. Lo que se
  mueve es el decorado: un documento de papel, una diapositiva oscura, un panel
  de tarjetas. La gráfica ni parpadea ni se recarga —sigue girando sin cortar—
  mientras cambia de sitio y de tamaño en cada uno.

  Eso es lo que hace que se entienda en dos segundos y sin leer una palabra:
  ES LA MISMA COSA, y encaja en todo. Enseñar tres capturas distintas no dice
  eso; dice «aquí hay tres imágenes». La continuidad del giro es la prueba.

  Y de paso se demuestra sola la promesa más difícil de contar: al pasar de
  papel claro a diapositiva oscura, la gráfica se apoya en las dos SIN traer un
  rectángulo de fondo. Eso es lo que significa el fondo transparente, y contarlo
  con palabras nunca funcionó.

  ── POR QUÉ NO ES UN VÍDEO ───────────────────────────────────────────────

  Un vídeo de un producto interactivo es su peor versión: pesa megas, se ve
  blando al escalar, hay que pelear el autoplay en el móvil y, sobre todo, DICE
  que la gráfica gira en vez de girarla. El argumento de esta página es que el
  link es el producto; un vídeo lo convierte en «te enseño un vídeo de un link».

  ── POR QUÉ NO IMITA LA INTERFAZ DE NADIE ────────────────────────────────

  Los tres decorados son GENÉRICOS —un documento, una diapositiva, un panel—, no
  copias de Notion, Canva ni Framer. Ni marcas, ni logos, ni barras de
  herramientas ajenas. Nombrar productos compatibles es legítimo y se hace en la
  tira de logos, que identifica; reproducir su interfaz ya no identifica, imita,
  y además obliga a mantener tres imitaciones de UIs que cambian solas.

  Tampoco hay una ventana de navegador con tres puntitos de colores: es el
  cliché número uno del sector y `docs/DESIGN.md` prohíbe parecer una plantilla.
*/

/** Cada cuánto pasa al siguiente decorado. */
const CADA = 4200;

/*
  Dónde vive la gráfica en cada decorado, en porcentaje de la escena.

  Va en PORCENTAJES y no en píxeles porque el hueco es el mismo nodo del DOM en
  los tres —esa es toda la idea— y lo único que cambia son estas cuatro cifras.
  Un contenedor por decorado obligaría a montar tres iframes, que es justo lo
  que destruiría el efecto: tres gráficas distintas en vez de una que viaja.
*/
type Hueco = { left: number; top: number; width: number; height: number };

const HUECOS: Record<string, Hueco> = {
  /* En el documento la gráfica es una ilustración dentro del texto: pequeña,
     a la derecha, alineada con la mancha. */
  doc: { left: 52, top: 18, width: 42, height: 64 },
  /* En la diapositiva es la protagonista y ocupa media hoja. */
  slide: { left: 44, top: 10, width: 52, height: 80 },
  /* En el panel vive dentro de una celda, con las cifras al lado. */
  panel: { left: 6, top: 14, width: 56, height: 78 },
};

const base = (
  labels: string[],
  unit: string,
  numberLocale: string,
  estrecho: boolean,
): ChartConfig => ({
  v: 1,
  type: 'donut',
  theme: 'estudio',
  data: {
    labels: labels.slice(0, 4),
    series: [{ values: [42, 26, 18, 14] }],
    format: { unit, locale: numberLocale },
  },
  /* Transparente A PROPÓSITO: es la prueba de la promesa, y aquí se ve sola
     porque el mismo embed pasa por un fondo claro y por uno oscuro. */
  scene: { background: { kind: 'transparent' } },
  labels: {
    show: true,
    mode: 'outside',
    showValues: true,
    /*
      `solid` y no `plain`. Con `plain` hay que elegir un color de tinta, y aquí
      la gráfica pasa por papel blanco Y por una diapositiva oscura sin
      recargarse: cualquier tinta fija se vuelve ilegible en uno de los dos. La
      píldora opaca se lee en ambos, que es lo único que se le pide.
    */
    finish: 'solid',
    /*
      Más pequeñas en un móvil. Las etiquetas del embed van en píxeles fijos y
      el dibujo no, así que a 330px de ancho ocupaban casi la mitad de la
      gráfica y le tapaban las porciones. Es el mismo problema que hay anotado
      como abierto en STATE.md; aquí se compensa a mano porque esta sección sí
      sabe en qué hueco vive.
    */
    size: estrecho ? 0.78 : 1,
  },
  motion: { autoRotate: true, speed: 0.35 },
  camera: { distance: 0.9 },
  layout: { watermark: false },
});

export function EnUso() {
  const { d, locale } = useI18n();
  const origin = useOrigin();

  const [activo, setActivo] = useState<'doc' | 'slide' | 'panel'>('doc');
  /* El ciclo se para en cuanto alguien elige a mano: a partir de ahí manda la
     persona, no el reloj. Volver a arrancarlo solo sería quitarle el control. */
  const [auto, setAuto] = useState(true);
  /* El iframe no se monta hasta que la sección se ve. La página ya tiene un
     canvas en el héroe y hasta seis en la galería; un navegador aguanta del
     orden de 8-16 contextos WebGL y aquí no hace falta gastar uno de más. */
  const [visible, setVisible] = useState(false);
  const [estrecho, setEstrecho] = useState(false);

  const escena = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const mirar = () => setEstrecho(mq.matches);
    mirar();
    mq.addEventListener('change', mirar);
    return () => mq.removeEventListener('change', mirar);
  }, []);

  useEffect(() => {
    const nodo = escena.current;
    if (!nodo) return;

    const observer = new IntersectionObserver(
      ([entrada]) => setVisible(entrada.isIntersecting),
      { rootMargin: '200px' },
    );
    observer.observe(nodo);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    /* Ni ciclo ni transiciones si el sistema pide menos movimiento. Esta
       sección ES movimiento, así que quien lo tenga desactivado se queda con el
       primer decorado y los botones para ver los otros. */
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    /* Y no cicla si no se está viendo: cambiar de decorado a espaldas de nadie
       solo gasta batería. */
    if (!auto || quieto || !visible) return;

    const orden: Array<'doc' | 'slide' | 'panel'> = ['doc', 'slide', 'panel'];
    const t = setInterval(() => {
      setActivo((actual) => orden[(orden.indexOf(actual) + 1) % orden.length]);
    }, CADA);
    return () => clearInterval(t);
  }, [auto, visible]);

  const muestra = samplesFor(locale).initial;
  const config = base(muestra.labels, muestra.unit, muestra.numberLocale, estrecho);
  const url = origin ? buildEmbedUrl(config, origin) : null;

  const hueco = HUECOS[activo];

  const elegir = (cual: 'doc' | 'slide' | 'panel') => {
    setActivo(cual);
    setAuto(false);
  };

  const pestañas = [
    { id: 'doc', texto: d.landing.ctxDoc },
    { id: 'slide', texto: d.landing.ctxSlide },
    { id: 'panel', texto: d.landing.ctxPanel },
  ] as const;

  return (
    <section className="enuso">
      <div className="shell">
        <p className="spec-label">{d.landing.inUseLabel}</p>
        <h2 className="display enuso-title">{d.landing.inUseTitle}</h2>
        <p className="enuso-lead">{d.landing.inUseBody}</p>

        <div className="escena" ref={escena} data-ctx={activo}>
          {/* ── decorado 1: un documento ──────────────────────────────── */}
          <div className="deco deco-doc" aria-hidden={activo !== 'doc'}>
            <div className="deco-col">
              <p className="deco-kicker">{d.landing.docKicker}</p>
              <h3 className="deco-title">{d.landing.docTitle}</h3>
              <p>{d.landing.docP1}</p>
              <p>{d.landing.docP2}</p>
              <p>{d.landing.docP3}</p>
            </div>
          </div>

          {/* ── decorado 2: una diapositiva ───────────────────────────── */}
          <div className="deco deco-slide" aria-hidden={activo !== 'slide'}>
            <p className="deco-kicker">{d.landing.slideKicker}</p>
            <h3 className="deco-title">{d.landing.slideTitle}</h3>
            <p className="slide-foot">{d.landing.slideFoot}</p>
          </div>

          {/* ── decorado 3: un panel ──────────────────────────────────── */}
          <div className="deco deco-panel" aria-hidden={activo !== 'panel'}>
            <p className="deco-kicker">{d.landing.panelTitle}</p>
            <div className="panel-stats">
              <div>
                <span>{d.landing.panelStat1}</span>
                <b>{d.landing.panelStat1Value}</b>
              </div>
              <div>
                <span>{d.landing.panelStat2}</span>
                <b>{d.landing.panelStat2Value}</b>
              </div>
              <div>
                <span>{d.landing.panelStat3}</span>
                <b>{d.landing.panelStat3Value}</b>
              </div>
            </div>
          </div>

          {/*
            EL HUECO. Un solo nodo, en los tres decorados. Lo único que cambia
            son sus cuatro coordenadas, así que el iframe de dentro no se
            desmonta ni se recarga: la gráfica no corta el giro al cambiar de
            mundo, y eso es exactamente lo que hay que ver.
          */}
          <div
            className="hueco"
            style={{
              left: `${hueco.left}%`,
              top: `${hueco.top}%`,
              width: `${hueco.width}%`,
              height: `${hueco.height}%`,
            }}
          >
            {visible && url?.ok ? (
              <iframe
                src={url.url}
                title={d.landing.inUseTitle}
                loading="lazy"
                style={{ border: 0, display: 'block', width: '100%', height: '100%' }}
              />
            ) : null}
          </div>
        </div>

        <div className="enuso-tabs" role="tablist">
          {pestañas.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={activo === p.id}
              className="enuso-tab"
              onClick={() => elegir(p.id)}
            >
              {p.texto}
            </button>
          ))}
        </div>

        <p className="enuso-foot">{d.landing.inUseFoot}</p>
      </div>
    </section>
  );
}
