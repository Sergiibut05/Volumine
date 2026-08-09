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
  Dónde vive la gráfica en cada decorado.

  ── POR QUÉ ESTO ES UN `transform` Y NO UN TAMAÑO ────────────────────────

  La primera versión animaba `left/top/width/height` del hueco, y PARPADEABA al
  cambiar de decorado. La causa no era el fundido: era que cambiar el tamaño de
  un `<iframe>` sesenta veces por segundo obliga al embed de dentro a
  redimensionar su canvas otras tantas —reasignar el framebuffer, recalcular la
  densidad, reencuadrar la cámara— y el navegador a re-rasterizar todo el
  documento incrustado en cada fotograma. En una captura suelta se veía perfecto;
  en movimiento, no.

  Ahora el hueco tiene un tamaño FIJO y lo único que se anima es `transform`.
  Eso no toca el layout, no llega al iframe y se compone en la GPU: el canvas de
  dentro no se entera de que la gráfica está viajando. Que es literalmente lo que
  esta sección quiere decir.

  Todas las escalas son ≤ 1 a propósito: el tamaño base es el del decorado más
  grande, así que aquí solo se REDUCE. Ampliar un iframe compuesto lo dejaría
  borroso —el mismo mecanismo que emborronaba la etiqueta dentro de Canva—.
*/
type Puesto = {
  /** Desplazamiento en % del propio hueco, no de la escena. */
  dx: number;
  dy: number;
  escala: number;
};

const PUESTOS: Record<string, Puesto> = {
  /* En el documento es una ilustración dentro del texto: pequeña y a la
     derecha, en el hueco que deja la mancha. */
  doc: { dx: 42.9, dy: 2.5, escala: 0.72 },
  /* En la diapositiva es la protagonista y ocupa media hoja. */
  slide: { dx: 35.7, dy: 2.5, escala: 0.95 },
  /* En el panel vive dentro de una celda blanca, con las cifras al lado. */
  panel: { dx: -30.4, dy: 11.9, escala: 0.84 },
};

/* Los mismos números en la gráfica y en el desglose del panel. Dos listas
   distintas acabarían contando cosas distintas en la misma pantalla. */
const VALORES = [42, 26, 18, 14];

const base = (
  labels: string[],
  unit: string,
  numberLocale: string,
  estrecho: boolean,
): ChartConfig => ({
  v: 1,
  /*
    BARRAS y no anillo. El héroe ya enseña un anillo, y con los dos iguales la
    página parecía tener un solo truco —la misma forma dos veces en las dos
    primeras pantallas—. Barras además es lo que de verdad lleva un informe
    trimestral, así que el decorado y la gráfica dicen lo mismo.
  */
  type: 'bar',
  theme: 'estudio',
  style: {
    /*
      La sombra, girada. Por defecto cae hacia la izquierda, que en el documento
      es justo donde está la mancha de texto: se metía debajo de las líneas y en
      la diapositiva se salía por el borde. Llevándola hacia el otro lado cae en
      el hueco que la propia composición deja libre.
    */
    shadowAngle: 150,
    /* Menos canto que el de fábrica. En una barra el redondeo se come el
       vértice superior, que es justo el que dice cuánto mide. */
    bevel: 0.38,
    /* Más altas que el 0.34 de fábrica: en un hueco apaisado como este, las
       barras por defecto quedaban como fichas tumbadas y la diferencia entre la
       primera y la última se leía peor de lo que es. */
    height: 0.46,
  },
  data: {
    labels: labels.slice(0, 4),
    series: [{ values: VALORES }],
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
  /* Un poco más lejos que el anillo: de cerca, la barra alta se veía volcada
     por la perspectiva y parecía que se caía. */
  camera: { distance: 1.05 },
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

  const puesto = PUESTOS[activo];

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
            {/* La conclusión, que es lo que de verdad lleva una diapositiva de
                consejo: el titular dice de qué va y esta línea dice qué pasó. */}
            <p className="slide-lead">{d.landing.slideLead}</p>
            <p className="slide-foot">{d.landing.slideFoot}</p>
          </div>

          {/* ── decorado 3: un panel ──────────────────────────────────── */}
          <div className="deco deco-panel" aria-hidden={activo !== 'panel'}>
            <div className="panel-bar">
              <p className="deco-kicker">{d.landing.panelTitle}</p>
              <span className="panel-range">{d.landing.panelRange}</span>
            </div>

            {/* La celda. En un panel de verdad la gráfica no flota sobre el
                fondo: vive dentro de una tarjeta y con su propio titulillo,
                como el resto de widgets. Va aquí y no en el hueco porque el
                hueco es el mismo nodo en los tres decorados y en los otros dos
                no debe haber ninguna tarjeta. Sus cifras y las de
                `PUESTOS.panel` se mueven juntas. */}
            <div className="panel-celda">
              <p className="panel-celda-tit">{d.landing.panelChartTitle}</p>
            </div>

            <div className="panel-lado">
              <div className="panel-stats">
                {[
                  [d.landing.panelStat1, d.landing.panelStat1Value, d.landing.panelStat1Delta],
                  [d.landing.panelStat2, d.landing.panelStat2Value, d.landing.panelStat2Delta],
                  [d.landing.panelStat3, d.landing.panelStat3Value, d.landing.panelStat3Delta],
                ].map(([etiqueta, valor, delta]) => (
                  <div key={etiqueta}>
                    <span>{etiqueta}</span>
                    <b>{valor}</b>
                    <i>{delta}</i>
                  </div>
                ))}
              </div>

              {/*
                El desglose, con los MISMOS datos que la gráfica. Es lo que hace
                que esto parezca un panel y no cuatro cajas: en un panel de
                verdad el mismo dato aparece dos veces, dibujado y en cifras.
              */}
              <div className="panel-lista">
                <p className="panel-lista-tit">{d.landing.panelBreakdown}</p>
                {muestra.labels.slice(0, 4).map((etiqueta, i) => (
                  <div key={etiqueta}>
                    {/* Nombre y cifra en la MISMA fila, y la barra debajo. Con
                        la barra en medio, la rejilla empujaba la cifra a una
                        tercera línea y cada categoría ocupaba el triple. */}
                    <span>{etiqueta}</span>
                    <b>
                      {VALORES[i]} {muestra.unit}
                    </b>
                    <em style={{ width: `${(VALORES[i] / VALORES[0]) * 100}%` }} />
                  </div>
                ))}
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
              transform: `translate(-50%, -50%) translate(${puesto.dx}%, ${puesto.dy}%) scale(${puesto.escala})`,
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
