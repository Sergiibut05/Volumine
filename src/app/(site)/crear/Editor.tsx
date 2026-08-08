'use client';

import { useMemo, useRef, useState } from 'react';
import { useOrigin } from '@/lib/use-origin';
import { useHistoryState } from '@/lib/use-history-state';
import Link from 'next/link';
import '@/styles/editor.css';
import { ChartCanvas } from '@/renderer/ChartCanvas';
import type { HoverInfo } from '@/renderer/core/chart-renderer';
import { formatter } from '@/lib/format';
import { parseConfig } from '@/lib/config/parse';
import { buildEmbedUrl, MAX_URL_LENGTH } from '@/lib/config/url';
import { THEMES } from '@/lib/themes';
import { chartTypes } from '@/lib/chart-types';
import { computeSectors, globalBevel, OUTER_RADIUS } from '@/renderer/geometry/donut';
import { computeGauge } from '@/renderer/geometry/gauge';
import { gaugeReadout } from '@/lib/gauge';
import { computeBars, barRadii } from '@/renderer/geometry/bar';
import { DEFAULT_FRAME_MS } from '@/renderer/geometry/bar-race';
import type { ChartConfig } from '@/lib/config/schema';
import type { ResolvedChartConfig } from '@/lib/config/defaults';
import { Group, Slider, Choices, type Choice } from './controls';
import { DataEditor } from './DataEditor';
import { Wordmark } from '../Wordmark';
import { LocaleSwitch } from '../LocaleSwitch';
import { fill, useI18n } from '@/lib/i18n/client';
import { LOCALES, type Dictionary, type Locale } from '@/lib/i18n/dictionaries';
import { initialConfig } from '@/lib/config/initial';
import { SaveBar } from './SaveBar';
import type { Visibility } from '@/lib/supabase/types';

/*
  El editor.

  Tres niveles de profundidad (docs/CUSTOMIZATION.md): tema, ajustes, avanzado.
  Cada uno basta por sí solo para publicar; nadie debería tener que bajar de
  nivel para conseguir algo razonable.

  Los presets con nombre van antes que los controles físicos: la gente sabe si
  quiere plástico o metal, no sabe qué es la rugosidad.
*/

/*
  Los materiales y los fondos se construyen CON EL DICCIONARIO, no como
  constantes de módulo: sus nombres dependen del idioma y una constante se
  evalúa una vez, al importar, cuando todavía no se sabe quién va a mirar.
*/
const materiales = (d: Dictionary) =>
  [
    { id: 'physical', label: d.editor.matPhysical, hint: d.editor.matPhysicalHint },
    { id: 'matte', label: d.editor.matMatte, hint: d.editor.matMatteHint },
    { id: 'metal', label: d.editor.matMetal, hint: d.editor.matMetalHint },
    { id: 'glass', label: d.editor.matGlass, hint: d.editor.matGlassHint },
    { id: 'toon', label: d.editor.matToon, hint: d.editor.matToonHint },
  ] as const;

const fondos = (d: Dictionary) =>
  [
    { id: 'transparent', label: d.editor.bgTransparent, hint: d.editor.bgTransparentHint },
    { id: 'solid', label: d.editor.bgSolid, hint: d.editor.bgSolidHint },
    { id: 'gradient', label: d.editor.bgGradient, hint: d.editor.bgGradientHint },
  ] as const;

/** Tipos que solo leen `series[0]`: un total repartido, no varias magnitudes. */
const SINGLE_SERIES: ReadonlySet<ChartConfig['type']> = new Set([
  'donut',
  'pie',
  'globe',
  'gauge',
]);

/**
 * Qué cambia al elegir otro tipo.
 *
 * No todos los tipos leen los mismos datos, así que cambiar de tipo sin más
 * dejaba la gráfica vacía o con columnas que no pintan nada. Tres reglas:
 *
 * - Los datos de EJEMPLO se sustituyen por los del tipo nuevo; los del usuario,
 *   nunca. Perder veinte filas pegadas por tocar un botón es imperdonable, y
 *   aquí no hay deshacer todavía.
 * - Al ir a un tipo de una sola serie se recortan las demás: en un anillo no se
 *   dibujan y solo engordan la URL.
 * - Al ir al globo se crean coordenadas vacías, para que se vea qué falta en
 *   vez de dejar un planeta pelado sin explicación.
 */
function switchType(
  config: ChartConfig,
  type: ChartConfig['type'],
  locale: Locale,
): Partial<ChartConfig> {
  /* El medidor abre más el agujero: la cifra va dentro, y con 0,55 el número
     grande se sale del hueco y se lee encima del propio arco. */
  const hole = type === 'pie' ? 0 : type === 'gauge' ? 0.68 : 0.55;
  const shape = { style: { ...config.style, innerRadius: hole } };

  /* Un anillo, una tarta y un globo solo dibujan la PRIMERA serie. Arrastrar
     los periodos de una carrera hasta ahí deja columnas que no pintan nada en
     la tabla y kilobytes muertos en la URL, así que se recortan al cambiar. */
  const trim = (data: ChartConfig['data']): ChartConfig['data'] =>
    SINGLE_SERIES.has(type) && data.series.length > 1
      ? { ...data, series: data.series.slice(0, 1) }
      : data;

  /* Solo se pisan los datos de EJEMPLO. Si el usuario ya ha escrito los suyos,
     cambiar de tipo no puede borrárselos. Ahora hay deshacer, pero eso no es
     excusa: que una acción sea reversible no la vuelve aceptable. */
  /* Se compara contra el ejemplo de CUALQUIER idioma, no solo el de ahora: si
     alguien empieza en español y cambia el selector a inglés, sus datos siguen
     siendo los de muestra y sustituirlos es exactamente lo que quiere. Son dos
     comparaciones de cadena; el coste no existe. */
  const actual = JSON.stringify(config.data);
  const pristine = LOCALES.some((l) => actual === JSON.stringify(initialConfig(l).data));
  const sample = chartTypes(locale).find((entry) => entry.id === type)?.sample;

  if (pristine && sample) return { type, data: trim(sample.data), ...shape };

  /* Con datos propios, el globo necesita coordenadas que nadie le ha dado. Se
     crean vacías para que aparezcan las columnas en la tabla y se vea qué
     falta, en vez de dejar un planeta pelado sin explicación. */
  if (type === 'globe' && !config.data.coords) {
    return {
      type,
      data: trim({
        ...config.data,
        coords: config.data.labels.map(() => [0, 0] as [number, number]),
      }),
      ...shape,
    };
  }

  return { type, data: trim(config.data), ...shape };
}

export type EditorProps = {
  /** Con qué arranca. La gráfica cargada de `?id=`, o el ejemplo de siempre. */
  initial: ChartConfig;
  /** Id de la gráfica que se está editando. `null` si es nueva. */
  chartId: string | null;
  /** Si es pública, ya hay un link publicado que se actualiza al guardar. */
  visibility: Visibility | null;
  /** Sin sesión no se puede guardar, pero el editor funciona igual. */
  signedIn: boolean;
  /** Id del usuario. Para la ruta del póster; `null` sin sesión. */
  userId: string | null;
};

export function Editor({ initial, chartId, visibility, signedIn, userId }: EditorProps) {
  const { d, locale } = useI18n();
  /* El póster se captura del canvas al guardar. Va por `ref` porque no es un
     evento: es algo que se PIDE cuando hace falta. Ver lib/charts/poster.ts. */
  const capture = useRef<(() => string) | null>(null);
  /* El config es la única fuente de verdad del editor, así que deshacer sale
     casi gratis: basta con guardar el config de antes. Ver lib/history.ts. */
  const history = useHistoryState<ChartConfig>(initial);
  const config = history.value;
  const setConfig = history.set;
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState<HoverInfo>(null);
  /* Se enciende al intentar guardar sin nombre y se apaga en cuanto se escribe
     algo. No se enciende al cargar: avisar de un campo vacío que nadie ha
     intentado usar todavía es regañar por adelantado. */
  const [faltaNombre, setFaltaNombre] = useState(false);
  /* Con quince temas, enseñarlos todos de golpe convierte el primer grupo del
     panel en una pared de fichas. Ver `temasVisibles`. */
  const [todosLosTemas, setTodosLosTemas] = useState(false);
  const tituloRef = useRef<HTMLInputElement>(null);

  const origin = useOrigin();

  const parsed = useMemo(() => parseConfig(config), [config]);
  const url = useMemo(
    () => (origin ? buildEmbedUrl(config, origin) : null),
    [config, origin],
  );

  const style = parsed.ok ? parsed.config.style : null;

  /*
    Rango seguro del canto, calculado con la MISMA función que usa la geometría.
    El slider va de 0 al máximo que el donut admite sin que las piezas se
    toquen, no de 0 a 1 esperando que el usuario no llegue al final
    (docs/CUSTOMIZATION.md). Se muestra en unidades de escena para que el número
    signifique algo.
  */
  const isBar = config.type === 'bar';
  const isGlobe = config.type === 'globe';
  const isRace = config.type === 'bar-race';
  const isGauge = config.type === 'gauge';
  /*
    El anillo y la tarta llevan líneas guía a los lados; las barras, el nombre
    bajo cada barra.

    En el globo van sobre el punto, y las de la cara de atrás se esconden solas.
    En la carrera viajan con su barra y se reescriben mientras corre.

    Fuera queda solo el medidor, que ya escribe su cifra en el centro: ofrecerle
    un control de etiquetas sería ofrecer algo que no haría nada.
  */
  const supportsLabels = config.type !== 'gauge';
  const gaugeReading = parsed.ok && isGauge ? gaugeReadout(parsed.config) : null;

  const bevelCeiling = useMemo(() => {
    if (!parsed.ok) return 0;
    const c = parsed.config;

    if (c.type === 'bar') {
      // En barras el techo lo pone el ancho de la barra, no el arco del sector.
      const layout = computeBars(
        c.data.series.map((serie) => serie.values),
        { gap: c.style.gap, height: c.style.height },
      );
      return barRadii(layout.totalHeight, layout, { bevel: 1, cornerRadius: 0 }).radius;
    }

    /* El medidor reparte el arco de otra manera, así que su techo de canto es
       otro: calcularlo con el del anillo dejaría el slider mintiendo justo en el
       tramo alto, que es donde importa. */
    const values = c.data.series[0]?.values ?? [];
    const sectors =
      c.type === 'gauge'
        ? (() => {
            const layout = computeGauge(values, {
              max: c.style.gauge.max,
              sweepDegrees: c.style.gauge.sweep,
              gapTurns: c.style.gap,
            });
            return layout.track ? [...layout.sectors, layout.track] : layout.sectors;
          })()
        : computeSectors(values, c.style.gap);

    return globalBevel(
      sectors,
      {
        innerR: c.style.innerRadius * OUTER_RADIUS,
        outerR: OUTER_RADIUS,
        depth: c.style.height,
        gapAngle: c.style.gap * Math.PI * 2,
      },
      1,
    );
  }, [parsed]);

  const patchStyle = (next: Partial<NonNullable<ChartConfig['style']>>) =>
    setConfig((c) => ({ ...c, style: { ...c.style, ...next } }));

  /* Los ajustes del globo van anidados, así que hay que fusionar a dos niveles
     o cada cambio borraría los otros dos colores. */
  /* El fondo va anidado dos niveles, así que hay que fusionar a mano o cada
     cambio de color se llevaría por delante el tipo de fondo. */
  const bgKind = config.scene?.background?.kind ?? 'transparent';
  type Background = NonNullable<NonNullable<ChartConfig['scene']>['background']>;
  const patchBackground = (next: Partial<Background>) =>
    setConfig((c) => ({
      ...c,
      scene: { ...c.scene, background: { ...c.scene?.background, ...next } },
    }));

  type GaugeStyle = NonNullable<NonNullable<ChartConfig['style']>['gauge']>;
  const patchGauge = (next: Partial<GaugeStyle>) =>
    setConfig((c) => ({
      ...c,
      style: { ...c.style, gauge: { ...c.style?.gauge, ...next } },
    }));

  type GlobeStyle = NonNullable<NonNullable<ChartConfig['style']>['globe']>;
  const patchGlobe = (next: Partial<GlobeStyle>) =>
    setConfig((c) => ({
      ...c,
      style: { ...c.style, globe: { ...c.style?.globe, ...next } },
    }));

  const setSegmentColor = (index: number, color: string) => {
    setConfig((c) => {
      const series = [...c.data.series];
      const colors = [...(series[0].colors ?? [])];
      while (colors.length < c.data.labels.length) colors.push(null);
      colors[index] = color;
      series[0] = { ...series[0], colors };
      return { ...c, data: { ...c.data, series } };
    });
  };

  const copy = async () => {
    if (!url?.ok) return;
    await navigator.clipboard.writeText(url.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  /*
    CUÁNTOS TEMAS SE VEN DE ENTRADA.

    Seis. Es el primer grupo del panel —«Empieza por aquí»— y quince fichas ahí
    no son quince opciones: son una pared que hay que leer antes de poder hacer
    nada. Con seis se elige en un vistazo, y quien quiera mirar más lo pide.

    El que esté ELEGIDO se cuela siempre en la lista corta aunque esté en la
    parte de abajo. Si no, al recargar una gráfica con un tema de los últimos, el
    control se quedaba sin ninguna ficha marcada y parecía que no había tema.
  */
  const TEMAS_A_LA_VISTA = 6;

  const temasVisibles = todosLosTemas
    ? THEMES
    : THEMES.filter(
        (theme, i) => i < TEMAS_A_LA_VISTA || theme.id === (config.theme ?? 'aurora'),
      );

  const themeChoices: Choice[] = temasVisibles.map((theme) => ({
    id: theme.id,
    label: d.themes[theme.id as keyof Dictionary['themes']].name,
    hint: d.themes[theme.id as keyof Dictionary['themes']].use,
    preview: (
      <span className="swatch" aria-hidden>
        {theme.swatch.map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
      </span>
    ),
  }));

  const typeChoices: Choice[] = chartTypes(locale).map((type) => ({
    id: String(type.id),
    label: d.types[type.id].name,
    hint: type.status === 'listo' ? d.types[type.id].answers : d.editor.notAvailable,
    disabled: type.status !== 'listo',
    preview: <TypePreview id={String(type.id)} ready={type.status === 'listo'} />,
  }));

  return (
    /* Oscuro a la fuerza, no según la preferencia del sistema: el editor es un
       modo de taller y el 3D con luz IBL se lee mejor sobre oscuro. La landing
       es lo contrario, y ese contraste es intencionado. */
    <div className="editor" data-theme="dark">
      {/*
        LA BARRA DE LA APLICACIÓN, A TODO LO ANCHO.

        Vivía DENTRO del panel lateral, y ahí no cabía nada: 380 px repartidos
        entre marca, navegación, deshacer y guardar dejaban el nombre de la
        gráfica fuera —tuvo que bajar al panel como un control más, robándole
        cien píxeles de alto a los ajustes.

        Sacándola fuera hay sitio de sobra para las tres cosas que dicen DÓNDE
        ESTÁS —marca, tus gráficas, y qué gráfica es esta— a la izquierda, y las
        que dicen QUÉ PUEDES HACER a la derecha. El panel empieza directamente
        por «Tema», que es lo que se viene a tocar.

        Es además la disposición que espera cualquiera que haya usado Figma o
        Notion, y eso no es imitar por imitar: la ruta a la izquierda y las
        acciones a la derecha es lo que la gente ya sabe leer sin mirar.
      */}
      <header className="topbar">
        <div className="topbar-left">
          <Link href="/" className="panel-brand" aria-label={d.nav.home}>
            <Wordmark size={1.0625} />
          </Link>

          {signedIn && (
            <>
              <span className="topbar-sep" aria-hidden>
                /
              </span>
              <Link className="panel-nav" href="/mis-graficas">
                {d.nav.myCharts}
              </Link>
            </>
          )}

          {/* El nombre, como parte de la ruta. Se edita en el sitio: al pulsarlo
              se enfoca y ya está — sin diálogo ni botón de lápiz, que son dos
              pasos para cambiar una palabra. */}
          <span className="topbar-sep" aria-hidden>
            /
          </span>
          <input
            ref={tituloRef}
            className="chart-title"
            value={config.title ?? ''}
            placeholder={d.editor.namePlaceholder}
            maxLength={200}
            aria-label={d.editor.nameLabel}
            aria-invalid={faltaNombre || undefined}
            data-missing={faltaNombre || undefined}
            onChange={(e) => {
              if (faltaNombre) setFaltaNombre(false);
              setConfig((c) => ({ ...c, title: e.target.value || undefined }));
            }}
          />
        </div>

        <div className="topbar-right">
          {url && !url.ok && (
            <span className="topbar-warn">
              {fill(d.editor.tooLong, { max: MAX_URL_LENGTH })}
            </span>
          )}

          {/* Deshacer y rehacer. Los atajos los pone el hook; los botones están
              porque un atajo que nadie sabe que existe no tranquiliza a nadie a
              la hora de experimentar. */}
          <div className="undo">
            <button
              type="button"
              onClick={history.undo}
              disabled={!history.canUndo}
              title={`${d.editor.undo} (Ctrl+Z)`}
              aria-label={d.editor.undo}
            >
              ↶
            </button>
            <button
              type="button"
              onClick={history.redo}
              disabled={!history.canRedo}
              title={`${d.editor.redo} (Ctrl+Shift+Z)`}
              aria-label={d.editor.redo}
            >
              ↷
            </button>
          </div>

          {/* El selector de idioma va junto a guardar y no en un menú: cabe en
              cuatro caracteres y quien lo necesita lo necesita ANTES de saber
              buscarlo — justo porque la interfaz está en un idioma que no lee. */}
          <LocaleSwitch />

          <SaveBar
            config={config}
            chartId={chartId}
            visibility={visibility}
            signedIn={signedIn}
            userId={userId}
            capture={capture}
            /* El fondo ya resuelto: el póster lo pinta debajo de la captura,
               porque el canvas no lo lleva dentro cuando es un degradado. */
            background={parsed.ok ? parsed.config.scene.background : null}
            chart={{ theme: config.theme, palette: parsed.ok ? parsed.config.style.palette : [] }}
            onMissingTitle={() => {
              setFaltaNombre(true);
              /* Además de teñir el borde, se lleva el cursor al campo: señalar
                 sin llevar hasta allí obliga a buscar con el ratón lo que la
                 aplicación ya sabe dónde está. */
              tituloRef.current?.focus();
            }}
          />
        </div>
      </header>

      <div className="canvas-pane">
        {parsed.ok && (
          <ChartCanvas config={parsed.config} onHover={setHovered} captureRef={capture} />
        )}

        {/* El tooltip existía en el embed y NO en el editor, así que la vista
            previa enseñaba menos de lo que iba a ver quien abriera el link. Es
            el mismo motivo por el que las etiquetas viven en el renderer: si la
            previa miente, deja de servir para decidir.

            `labelled` lo pone el renderer: cuando el dato ya está escrito al
            lado de su pieza, repetirlo aquí abajo sería decir lo mismo dos
            veces en la misma pantalla. */}
        {hovered && parsed.ok && !hovered.labelled && (
          <div className="preview-tip">
            <b>{hovered.label}</b>
            <span>
              {[
                formatter(parsed.config).value(hovered.value),
                hovered.fraction === null
                  ? null
                  : formatter(parsed.config).percent(hovered.fraction),
                hovered.series,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
        )}

        {/* La MISMA función que escribe la cifra en el HTML del embed
            (lib/gauge.ts). Es lo que garantiza que lo que se ve aquí es lo que
            va a ver quien abra el link, hasta el separador de miles. */}
        {parsed.ok && parsed.config.type === 'gauge' && <Readout config={parsed.config} />}

        {url && (
          <div className="sharebar">
            <code>{url.ok ? url.url : fill(d.editor.tooLongChars, { n: url.length })}</code>
            <button type="button" onClick={copy} disabled={!url.ok}>
              {copied ? d.common.copied : d.common.copyLink}
            </button>
          </div>
        )}
      </div>

      <aside className="panel">
        {/* Nivel 1 — un control, y con esto ya se puede publicar. */}
        <Group title={d.editor.groupTheme} hint={d.editor.groupThemeHint}>
          <Choices
            label="Tema"
            options={themeChoices}
            value={config.theme ?? 'aurora'}
            /* Se guarda el NOMBRE del tema, no sus valores: el config queda
               corto y las gráficas ya publicadas heredan las mejoras del tema.
               Resolverlo es trabajo de `parseConfig`. Cambiar de tema descarta
               los ajustes de forma y escena, que es lo que se espera de "empieza
               por aquí" — el fondo lo elige el usuario después. */
            onChange={(id) =>
              setConfig((c) => ({ ...c, theme: id, style: {}, scene: {} }), {
                coalesce: false,
              })
            }
          />
        
          {THEMES.length > TEMAS_A_LA_VISTA && (
            <button
              type="button"
              className="linky"
              onClick={() => setTodosLosTemas((v) => !v)}
              style={{ justifySelf: 'start' }}
            >
              {todosLosTemas
                ? d.editor.themesLess
                : fill(d.editor.themesMore, { n: THEMES.length - TEMAS_A_LA_VISTA })}
            </button>
          )}
        </Group>

        {/* Los DATOS van antes que el aspecto. Es lo que la gente viene a meter,
            y ordenar el panel al revés convierte la herramienta en un juguete de
            estilo con unos números de ejemplo pegados. */}
        <Group title={d.editor.groupData} hint={d.editor.groupDataHint}>
          <DataEditor
            config={config}
            onChange={(data, discrete) =>
              setConfig((c) => ({ ...c, data }), { coalesce: !discrete })
            }
          />
        </Group>

        <Group title={d.editor.groupType}>
          <Choices
            label={d.editor.chartType}
            options={typeChoices}
            value={config.type}
            onChange={(id) =>
              setConfig(
                (c) => ({ ...c, ...switchType(c, id as ChartConfig['type'], locale) }),
                {
                  coalesce: false,
                },
              )
            }
          />
        </Group>

        {/* Nivel 2 — los ajustes que de verdad usa la mayoría. */}
        <Group title={d.editor.groupColor}>
          <div className="segments">
            {config.data.labels.map((label, i) => {
              const values = config.data.series[0].values;
              const total = values.reduce((sum, v) => sum + Math.max(v, 0), 0);
              const color =
                config.data.series[0].colors?.[i] ??
                style?.palette[i % style.palette.length] ??
                '#7c5cff';
              return (
                <label className="segment" key={label + i}>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setSegmentColor(i, e.target.value)}
                    aria-label={fill(d.editor.colorOf, { name: label })}
                  />
                  <span>{label}</span>
                  {/* En barras el porcentaje del total no dice nada: 42 no es
                      "el 24% de la suma de los meses". Se muestra el valor. */}
                  <output>
                    {isBar
                      ? values[i]
                      : total > 0
                        ? `${((values[i] / total) * 100).toFixed(0)}%`
                        : '—'}
                  </output>
                </label>
              );
            })}
          </div>
        </Group>

        {/* El globo no comparte casi nada con los demás: no tiene canto, ni
            grosor, ni separación. Sus propios controles, y solo los suyos. */}
        {isGlobe && (
          <Group title={d.editor.groupPlanet}>
            <div className="segments">
              <ColorRow
                label={d.editor.groupPlanet}
                value={style?.globe.base ?? '#111634'}
                onChange={(base) => patchGlobe({ base })}
              />
              <ColorRow
                label={d.editor.land}
                value={style?.globe.land ?? '#8b7dff'}
                onChange={(land) => patchGlobe({ land })}
              />
              <ColorRow
                label={d.editor.halo}
                value={style?.globe.glow ?? '#5b3ce6'}
                onChange={(glow) => patchGlobe({ glow })}
              />
            </div>
            <Slider
              label={d.editor.mapDensity}
              value={style?.globe.density ?? 0.72}
              min={0}
              max={1}
              step={0.01}
              format={(v) =>
                fill(d.editor.dots, {
                  count: Math.round(6000 + (40000 - 6000) * v).toLocaleString(locale),
                })
              }
              onChange={(density) => patchGlobe({ density })}
            />
            <Slider
              label={d.editor.dotSize}
              value={style?.globe.dotSize ?? 0.7}
              min={0}
              max={1}
              step={0.01}
              onChange={(dotSize) => patchGlobe({ dotSize })}
            />
            <Choices
              label={d.editor.marker}
              value={config.style?.globe?.marker ?? 'dot'}
              onChange={(marker) =>
                patchGlobe({ marker: marker as 'dot' | 'pin' | 'pulse' })
              }
              options={[
                {
                  id: 'dot',
                  label: d.editor.markerDot,
                  hint: d.editor.markerDotHint,
                  preview: <MarkerPreview kind="dot" />,
                },
                {
                  id: 'pin',
                  label: d.editor.markerPin,
                  hint: d.editor.markerPinHint,
                  preview: <MarkerPreview kind="pin" />,
                },
                {
                  id: 'pulse',
                  label: d.editor.markerPulse,
                  hint: d.editor.markerPulseHint,
                  preview: <MarkerPreview kind="pulse" />,
                },
              ]}
            />
            <Slider
              label={d.editor.markerSize}
              value={style?.globe.markerSize ?? 0.62}
              min={0}
              max={1}
              step={0.01}
              onChange={(markerSize) => patchGlobe({ markerSize })}
            />
          </Group>
        )}

        {/* El tope va lo primero de todo: sin él la cifra no significa nada, y
            es lo único de esta pantalla que cambia lo que el dato QUIERE DECIR
            en vez de cómo se ve. */}
        {isGauge && (
          <Group title={d.editor.groupScale} hint={d.editor.groupScaleHint}>
            <label className="control">
              <header>
                <span>{d.editor.scaleMax}</span>
                {/* Solo se dice algo cuando hay algo que decir. Pasarse del tope
                    llena el arco entero, así que sin este aviso la gráfica se ve
                    igual de llena con 100 que con 240 y no se entiende por qué. */}
                {gaugeReading?.overflow && (
                  <output className="warn">{d.editor.overflow}</output>
                )}
              </header>
              <input
                className="numeric"
                inputMode="decimal"
                value={config.style?.gauge?.max ?? 100}
                onChange={(e) => {
                  const max = Number(e.target.value.replace(',', '.'));
                  if (Number.isFinite(max)) patchGauge({ max });
                }}
              />
            </label>
            <Slider
              label={d.editor.arcSpread}
              value={config.style?.gauge?.sweep ?? 270}
              min={120}
              max={360}
              step={5}
              format={(v) => (v === 360 ? d.editor.fullRing : `${v}°`)}
              onChange={(sweep) => patchGauge({ sweep })}
            />
            <Choices
              label={d.editor.restOfScale}
              value={config.style?.gauge?.track === false ? 'off' : 'on'}
              onChange={(v) => patchGauge({ track: v === 'on' })}
              options={[
                {
                  id: 'on',
                  label: d.editor.trackOn,
                  hint: d.editor.trackOnHint,
                  preview: <TrackPreview track />,
                },
                {
                  id: 'off',
                  label: d.editor.trackOff,
                  hint: d.editor.trackOffHint,
                  preview: <TrackPreview track={false} />,
                },
              ]}
            />
          </Group>
        )}

        {/* Cada tipo enseña SOLO sus campos. Un slider que no hace nada es peor
            que uno que falta: te hace dudar de si la gráfica está rota. */}
        {!isGlobe && (
          <Group title={d.editor.groupShape} hint={d.editor.groupShapeHint}>
            <Slider
              label={d.editor.bevel}
              value={style?.bevel ?? 0.6}
              min={0}
              max={1}
              step={0.01}
              format={(v) =>
                fill(d.editor.ofMax, {
                  value: (v * bevelCeiling).toFixed(3),
                  max: bevelCeiling.toFixed(3),
                })
              }
              onChange={(v) => patchStyle({ bevel: v })}
            />
            <Slider
              label={isBar ? d.editor.barHeight : d.editor.thickness}
              value={style?.height ?? 0.34}
              min={0.05}
              max={1}
              step={0.01}
              onChange={(v) => patchStyle({ height: v })}
            />
            {isBar ? (
              <Slider
                label={d.editor.roundedTip}
                value={style?.cornerRadius ?? 0.2}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => patchStyle({ cornerRadius: v })}
              />
            ) : (
              <Slider
                label={d.editor.innerRadius}
                value={style?.innerRadius ?? 0.55}
                min={0}
                max={0.85}
                step={0.01}
                onChange={(v) => patchStyle({ innerRadius: v })}
              />
            )}
            <Slider
              label={d.editor.gap}
              value={style?.gap ?? 0.012}
              min={0}
              max={0.05}
              step={0.001}
              format={(v) => v.toFixed(3)}
              onChange={(v) => patchStyle({ gap: v })}
            />
            {!isBar && (
              <Slider
                label={d.editor.explode}
                value={style?.explode ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => patchStyle({ explode: v })}
              />
            )}
          </Group>
        )}

        {/* Los marcadores del globo son emisivos a propósito: el material no
            los toca, así que el selector engañaría. */}
        {!isGlobe && (
          <Group title={d.editor.groupFinish}>
            <Choices
              label={d.editor.material}
              options={materiales(d).map((m) => ({
                id: m.id,
                label: m.label,
                hint: m.hint,
                preview: <span className="matball" data-material={m.id} aria-hidden />,
              }))}
              value={style?.material ?? 'physical'}
              onChange={(id) => patchStyle({ material: id as never })}
            />

            {/*
              LA SOMBRA SE PUEDE APAGAR.

              `style.shadow` estaba en el contrato y no se podía tocar. Y hace
              falta: la sombra se proyecta hacia un lado, así que en un hueco
              estrecho se sale por el borde — y hay sitios donde no se puede
              hacer el hueco más ancho. Poder quitarla es la única salida que
              tiene ahí quien la incrusta.
            */}
            <Choices
              label={d.editor.shadow}
              value={style?.shadow === false ? 'no' : 'si'}
              onChange={(id) => patchStyle({ shadow: id === 'si' })}
              options={[
                {
                  id: 'si',
                  label: d.editor.shadowOn,
                  hint: d.editor.shadowOnHint,
                  preview: <ShadowPreview on />,
                },
                {
                  id: 'no',
                  label: d.editor.shadowOff,
                  hint: d.editor.shadowOffHint,
                  preview: <ShadowPreview on={false} />,
                },
              ]}
            />
          </Group>
        )}

        {/*
          Las etiquetas ya estaban en el contrato desde v1 y no había forma de
          encenderlas: un campo declarado y no implementado es un bug, no una
          función pendiente.

          Apagadas por defecto, y eso NO es pereza: cambiar el default cambiaría
          de aspecto todas las gráficas ya publicadas, y la regla 2 del proyecto
          es no romper nunca un link que ya existe.
        */}
        {supportsLabels && (
          <Group title={d.editor.groupLabels} hint={d.editor.groupLabelsHint}>
            <Choices
              label={d.editor.groupLabels}
              value={
                config.labels?.show !== true ? 'none' : (config.labels?.mode ?? 'outside')
              }
              onChange={(id) =>
                setConfig(
                  (c) => ({
                    ...c,
                    labels: {
                      ...c.labels,
                      show: id !== 'none',
                      mode: id === 'none' ? 'outside' : (id as 'outside' | 'legend'),
                    },
                  }),
                  { coalesce: false },
                )
              }
              options={[
                {
                  id: 'none',
                  label: d.editor.labelsOnHover,
                  hint: d.editor.labelsOnHoverHint,
                  preview: <LabelPreview leaders={false} bars={isBar || isRace} />,
                },
                {
                  id: 'outside',
                  label: d.editor.labelsAlways,
                  hint: d.editor.labelsAlwaysHint,
                  preview: <LabelPreview leaders bars={isBar || isRace} />,
                },
                {
                  id: 'legend',
                  /* Con nombres largos o muchas categorías, colocadas alrededor
                     del dibujo no caben y la mitad se descartan; en lista caben
                     todas. */
                  label: d.editor.labelsLegend,
                  hint: d.editor.labelsLegendHint,
                  preview: <LegendPreview />,
                },
              ]}
            />

            {config.labels?.show && (
              <>
                <Choices
                  label={d.editor.whatShows}
                  value={
                    config.labels?.showPercent
                      ? config.labels?.showValues
                        ? 'ambos'
                        : 'porcentaje'
                      : 'valor'
                  }
                  onChange={(id) =>
                    setConfig(
                      (c) => ({
                        ...c,
                        labels: {
                          ...c.labels,
                          showValues: id !== 'porcentaje',
                          showPercent: id !== 'valor',
                        },
                      }),
                      { coalesce: false },
                    )
                  }
                  options={[
                    {
                      id: 'valor',
                      label: d.editor.showValue,
                      hint: d.editor.showValueHint,
                      preview: <ShowPreview texto="42" />,
                    },
                    {
                      id: 'porcentaje',
                      label: d.editor.showPercent,
                      hint: d.editor.showPercentHint,
                      preview: <ShowPreview texto="35%" />,
                    },
                    {
                      id: 'ambos',
                      label: d.editor.showBoth,
                      hint: d.editor.showBothHint,
                      preview: <ShowPreview texto="42 · 35%" />,
                    },
                  ]}
                />
                <Slider
                  label={d.editor.textSize}
                  value={config.labels?.size ?? 1}
                  min={0.7}
                  max={1.6}
                  step={0.05}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onChange={(size) =>
                    setConfig((c) => ({ ...c, labels: { ...c.labels, size } }))
                  }
                />

                {/*
                  Cuatro voces y solo una gratis.

                  «Del sistema» no descarga nada y se ve un poco distinta en cada
                  ordenador; las otras tres viajan con la gráfica y se ven igual
                  en todas partes. El coste va escrito debajo del control, no
                  escondido: es una decisión con precio y quien la toma tiene
                  derecho a saberlo.
                */}
                <Choices
                  label={d.editor.labelFont}
                  value={config.labels?.font ?? 'system'}
                  onChange={(id) =>
                    setConfig(
                      (c) => ({
                        ...c,
                        labels: {
                          ...c.labels,
                          font: id as 'system' | 'inter' | 'display' | 'mono',
                        },
                      }),
                      { coalesce: false },
                    )
                  }
                  options={[
                    {
                      id: 'system',
                      label: d.editor.fontSystem,
                      hint: d.editor.fontSystemHint,
                      preview: <FontPreview familia="ui-sans-serif, system-ui, sans-serif" />,
                    },
                    {
                      id: 'inter',
                      label: d.editor.fontSans,
                      hint: d.editor.fontSansHint,
                      preview: (
                        <FontPreview familia='"Volumine Sans", ui-sans-serif, sans-serif' />
                      ),
                    },
                    {
                      id: 'display',
                      label: d.editor.fontSerif,
                      hint: d.editor.fontSerifHint,
                      preview: (
                        <FontPreview familia='"Volumine Serif", ui-serif, Georgia, serif' />
                      ),
                    },
                    {
                      id: 'mono',
                      label: d.editor.fontMono,
                      hint: d.editor.fontMonoHint,
                      preview: (
                        <FontPreview familia='"Volumine Mono", ui-monospace, monospace' />
                      ),
                    },
                  ]}
                />

                {/* El precio, a la vista. Una gráfica que elige tipografía pasa
                    de una petición a dos, y eso es exactamente lo que la landing
                    promete que no pasa por defecto. */}
                <p className="nota">{d.editor.fontCost}</p>

                {/* Los tres acabados se leen sobre blanco, sobre negro y sobre
                    una foto. NO hay un color libre para la caja a propósito: el
                    embed vive dentro de la página de otra persona. */}
                <Choices
                  label={d.editor.labelFinish}
                  value={config.labels?.finish ?? 'glass'}
                  onChange={(id) =>
                    setConfig(
                      (c) => ({
                        ...c,
                        labels: {
                          ...c.labels,
                          finish: id as 'glass' | 'solid' | 'plain',
                        },
                      }),
                      { coalesce: false },
                    )
                  }
                  options={[
                    {
                      id: 'glass',
                      label: d.editor.finishGlass,
                      hint: d.editor.finishGlassHint,
                      preview: <FinishPreview acabado="glass" />,
                    },
                    {
                      id: 'solid',
                      label: d.editor.finishSolid,
                      hint: d.editor.finishSolidHint,
                      preview: <FinishPreview acabado="solid" />,
                    },
                    {
                      id: 'plain',
                      label: d.editor.finishPlain,
                      hint: d.editor.finishPlainHint,
                      preview: <FinishPreview acabado="plain" />,
                    },
                  ]}
                />

                {/*
                  EL AJUSTE FINO, PLEGADO.

                  No lo va a tocar casi nadie: quien viene a hacer una gráfica
                  quiere elegir un envoltorio con nombre y seguir. Pero quien
                  está encajándola en la identidad de su marca sí lo necesita, y
                  para ese la alternativa es no poder.

                  Plegado es la única forma de servir a los dos: no alarga el
                  panel para quien no lo abre, y existe para quien lo busca. Es
                  el mismo trato que el bloque «Avanzado» de más abajo.

                  Solo aparece con caja. En «sin caja» no hay nada que ajustar, y
                  enseñar dos controles que no hacen nada es peor que no tenerlos.
                */}
                {(config.labels?.finish ?? 'glass') !== 'plain' && (
                  <details className="fold">
                    <summary>{d.editor.moreOptions}</summary>

                    <Slider
                      label={d.editor.boxPadding}
                      value={config.labels?.boxPadding ?? 1}
                      min={0}
                      max={2}
                      step={0.05}
                      format={(v) => `${Math.round(v * 100)}%`}
                      onChange={(boxPadding) =>
                        setConfig((c) => ({
                          ...c,
                          labels: { ...c.labels, boxPadding },
                        }))
                      }
                    />

                    <Slider
                      label={d.editor.boxRadius}
                      value={config.labels?.boxRadius ?? 1}
                      min={0}
                      max={2}
                      step={0.05}
                      /* En los extremos se dice la FORMA, no el número: «0%» no
                         significa nada y «en pico» sí. */
                      format={(v) =>
                        v === 0
                          ? d.editor.boxSquare
                          : v >= 2
                            ? d.editor.boxPill
                            : `${Math.round(v * 100)}%`
                      }
                      onChange={(boxRadius) =>
                        setConfig((c) => ({
                          ...c,
                          labels: { ...c.labels, boxRadius },
                        }))
                      }
                    />
                  </details>
                )}

                <InkControl
                  d={d}
                  value={config.labels?.color ?? 'auto'}
                  onChange={(color) =>
                    setConfig((c) => ({ ...c, labels: { ...c.labels, color } }), {
                      coalesce: color !== 'auto',
                    })
                  }
                />
              </>
            )}
          </Group>
        )}

        <Group title={d.editor.groupBackground}>
          <Choices
            label={d.editor.groupBackground}
            options={fondos(d).map((b) => ({
              id: b.id,
              label: b.label,
              hint: b.hint,
              preview: (
                <span
                  aria-hidden
                  style={{
                    display: 'block',
                    aspectRatio: '16/9',
                    borderRadius: 5,
                    background:
                      b.id === 'transparent'
                        ? 'repeating-conic-gradient(#3a3a48 0% 25%, #23232e 0% 50%) 0 0 / 12px 12px'
                        : b.id === 'solid'
                          ? (config.scene?.background?.from ?? '#0b0b12')
                          : `linear-gradient(135deg, ${config.scene?.background?.from ?? '#0b0b12'}, ${config.scene?.background?.to ?? '#1a1030'})`,
                  }}
                />
              ),
            }))}
            value={config.scene?.background?.kind ?? 'transparent'}
            onChange={(id) =>
              setConfig((c) => ({
                ...c,
                scene: {
                  ...c.scene,
                  background: { ...c.scene?.background, kind: id as never },
                },
              }))
            }
          />

          {/* Elegir "sólido" o "degradado" sin poder decir QUÉ color es medio
              control: se veía el nombre de la opción y había que adivinar el
              resultado. Los selectores aparecen solo cuando hay color que
              elegir — en transparente no hay ninguno. */}
          {bgKind !== 'transparent' && (
            <div className="segments">
              <ColorRow
                label={bgKind === 'gradient' ? d.editor.bgFrom : d.editor.bgColor}
                value={config.scene?.background?.from ?? '#0b0b12'}
                onChange={(from) => patchBackground({ from })}
              />
              {bgKind === 'gradient' && (
                <ColorRow
                  label={d.editor.bgTo}
                  value={config.scene?.background?.to ?? '#1a1030'}
                  onChange={(to) => patchBackground({ to })}
                />
              )}
            </div>
          )}

          {bgKind === 'gradient' && (
            <Slider
              label={d.editor.bgAngle}
              value={config.scene?.background?.angle ?? 135}
              min={0}
              max={360}
              step={5}
              format={(v) => `${v}°`}
              onChange={(angle) => patchBackground({ angle })}
            />
          )}
        </Group>

        {/* Un medidor no gira y no tiene periodos, así que no le queda ningún
            control de movimiento. El grupo entero se va: una tarjeta con título
            y nada dentro se lee como algo que se ha roto al cargar. */}
        {(!isGauge || isRace) && (
          <Group title={d.editor.groupMotion}>
            {isRace && (
              <Slider
                label={d.editor.frameDuration}
                value={config.motion?.frameDuration ?? DEFAULT_FRAME_MS}
                min={300}
                max={4000}
                step={50}
                /* En segundos y no en milisegundos: nadie piensa una animación en
                 milisegundos, y "1,2 s" se compara con la intuición de cuánto
                 tarda en leerse un cambio. */
                format={(v) => `${(v / 1000).toFixed(2).replace('.', ',')} s`}
                onChange={(v) =>
                  setConfig((c) => ({ ...c, motion: { ...c.motion, frameDuration: v } }))
                }
              />
            )}
            {/* Un medidor no gira: el hueco de abajo es el cero de la escala y
              moverlo borra por dónde empieza a contarse (ver el bucle en
              renderer/core/chart-renderer.ts). Un slider que no hace nada es
              peor que uno que falta, así que aquí directamente no está. */}
            {!isGauge && (
              <Slider
                label={isRace || isBar ? d.editor.sway : d.editor.spinSpeed}
                value={config.motion?.speed ?? 0.9}
                min={0}
                max={4}
                step={0.1}
                format={(v) =>
                  v === 0
                    ? d.editor.stopped
                    : fill(d.editor.turnsPerMin, { n: v.toFixed(1) })
                }
                onChange={(v) =>
                  setConfig((c) => ({
                    ...c,
                    motion: { ...c.motion, speed: v, autoRotate: v > 0 },
                  }))
                }
              />
            )}
          </Group>
        )}

        {/*
          LA PROPORCIÓN DEL EMBED, AL FONDO DEL PANEL.

          Estaba en el contrato desde la v1 y no se podía tocar sin escribir la
          config a mano. Y resulta ser justo lo que decide cómo se comporta el
          link donde se pega: `/api/oembed` publica esta proporción, y hay
          editores —Canva -- que bloquean el redimensionado a ella. Sin este
          control, la única forma de tener una gráfica cuadrada en Canva era no
          tenerla.

          Va la última porque se toca UNA VEZ, cuando ya sabes dónde vas a
          pegarla — no mientras eliges los datos. Arriba le robaba sitio a lo
          que sí se toca cada minuto.
        */}
        <Group title={d.editor.groupShape2} hint={d.editor.groupShape2Hint}>
          <Choices
            label={d.editor.groupShape2}
            value={config.layout?.aspect ?? '16:9'}
            onChange={(id) =>
              setConfig(
                (c) => ({
                  ...c,
                  layout: { ...c.layout, aspect: id as '16:9' | '4:3' | '1:1' | 'auto' },
                }),
                { coalesce: false },
              )
            }
            options={[
              {
                id: '16:9',
                label: d.editor.aspectWide,
                hint: d.editor.aspectWideHint,
                preview: <AspectPreview ratio="16 / 9" />,
              },
              {
                id: '4:3',
                label: d.editor.aspectClassic,
                hint: d.editor.aspectClassicHint,
                preview: <AspectPreview ratio="4 / 3" />,
              },
              {
                id: '1:1',
                label: d.editor.aspectSquare,
                hint: d.editor.aspectSquareHint,
                preview: <AspectPreview ratio="1 / 1" />,
              },
              {
                id: 'auto',
                label: d.editor.aspectAuto,
                hint: d.editor.aspectAutoHint,
                preview: <AspectPreview ratio={null} />,
              },
            ]}
          />
          <p className="nota">{d.editor.aspectNote}</p>
        </Group>


        {/* Nivel 3 — avanzado. Cerrado por defecto: quien lo necesita lo abre. */}
        <details className="group" style={{ padding: 'var(--p-space-4)' }}>
          <summary
            style={{
              cursor: 'pointer',
              fontFamily: 'var(--font-display), sans-serif',
              fontSize: '0.9375rem',
              fontWeight: 700,
            }}
          >
            {d.editor.advanced}
          </summary>
          <div
            style={{
              display: 'grid',
              gap: 'var(--p-space-4)',
              marginTop: 'var(--p-space-4)',
            }}
          >
            <Slider
              label={d.editor.lightIntensity}
              value={config.scene?.lightIntensity ?? 0.55}
              min={0}
              max={1.2}
              step={0.01}
              onChange={(v) =>
                setConfig((c) => ({ ...c, scene: { ...c.scene, lightIntensity: v } }))
              }
            />
            <Slider
              label={d.editor.roughness}
              value={style?.roughness ?? 0.32}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => patchStyle({ roughness: v })}
            />
            <Slider
              label={d.editor.cameraAngle}
              value={config.camera?.polar ?? 62}
              min={5}
              max={88}
              step={1}
              format={(v) => `${v.toFixed(0)}°`}
              onChange={(v) =>
                setConfig((c) => ({
                  ...c,
                  camera: { ...c.camera, preset: 'custom', polar: v },
                }))
              }
            />
          </div>
        </details>
      </aside>
    </div>
  );
}

/**
 * Miniatura del selector de tipo.
 *
 * Los tipos que aún no existen van en silueta apagada, no en un bloque gris: un
 * rectángulo vacío parece un fallo de carga. Los que sí existen van a color,
 * porque la miniatura es la promesa de lo que vas a obtener.
 */
/**
 * El color del texto de las etiquetas: automático o el que tú elijas.
 *
 * ── QUÉ TENÍA MAL LO DE ANTES ────────────────────────────────────────────
 *
 * Era un selector de color enseñando `#FFFFFF` con un enlace «Automático» al
 * lado, y no había forma de saber cuál de los dos mandaba: el blanco parecía
 * una elección tuya cuando era el valor por defecto, y el enlace parecía el
 * estado actual cuando era el botón de volver. Encima el rótulo «Color del
 * texto» salía dos veces seguidas.
 *
 * Ahora son dos botones que se excluyen —el activo se ve hundido— y el estado
 * se dice también con palabras arriba a la derecha, donde el resto de controles
 * ponen su valor. Elegir un color enciende «Personalizado» solo; volver a
 * «Automático» es un clic y no pierde el color elegido hasta que se cambia.
 */
function InkControl({
  d,
  value,
  onChange,
}: {
  d: Dictionary;
  value: string;
  onChange: (color: string) => void;
}) {
  const esAuto = value === 'auto';

  /*
    El último color escogido se recuerda mientras el control está montado, para
    que volver de «Automático» no obligue a buscarlo otra vez.

    En ESTADO y no en un `ref`: escribir un ref durante el render está prohibido
    —lo dice el linter y con razón— porque el render tiene que poder repetirse
    sin efectos. Con el compilador de React delante, además, un ref escrito en
    render tira la memoización y vuelve a renderizar el editor entero: se midió,
    y el barrido de idiomas pasó de 8 a más de 30 segundos.

    Se actualiza en el manejador, que es donde ocurre el cambio de verdad.
  */
  const [ultimo, setUltimo] = useState(esAuto ? '#ffffff' : value);
  const elegido = esAuto ? ultimo : value;

  return (
    <div className="control">
      <header>
        <span>{d.editor.labelInk}</span>
        <output>{esAuto ? d.editor.labelInkAuto : elegido.toUpperCase()}</output>
      </header>

      <div className="ink">
        <button type="button" aria-pressed={esAuto} onClick={() => onChange('auto')}>
          {d.editor.labelInkAuto}
        </button>

        {/* Es un `label` y no un botón porque quien abre el selector de color
            es el `input`: envolverlo hace que toda la píldora sea su disparador,
            sin duplicar el control ni inventarse un clic sintético. */}
        <label className="ink-pick" aria-pressed={!esAuto} data-on={!esAuto}>
          <i style={{ background: elegido }} aria-hidden />
          {d.editor.labelInkCustom}
          <input
            type="color"
            value={elegido}
            aria-label={d.editor.labelInkCustom}
            onChange={(e) => {
              setUltimo(e.target.value);
              onChange(e.target.value);
            }}
          />
        </label>
      </div>
    </div>
  );
}

/** Con y sin sombra proyectada. La diferencia se ve de un vistazo. */
function ShadowPreview({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className="thumb"
      style={{ background: 'var(--surface-sunken)' }}
    >
      <i
        style={{
          width: '34%',
          aspectRatio: '1',
          borderRadius: '50%',
          background: 'linear-gradient(150deg, #c4c4d2, #6b6b7c)',
          boxShadow: on ? '9px 10px 9px -5px rgb(0 0 0 / .55)' : 'none',
        }}
      />
    </span>
  );
}

/**
 * Miniatura de proporción: un rectángulo con esa forma dentro de un marco.
 *
 * El marco se dibuja siempre igual para que las cuatro se comparen entre sí; lo
 * que cambia es lo que ocupa dentro. `null` es «libre», y ahí el rectángulo
 * llena el marco entero — que es exactamente lo que significa.
 */
function AspectPreview({ ratio }: { ratio: string | null }) {
  return (
    <span className="thumb" aria-hidden>
      <span
        style={{
          display: 'block',
          width: ratio === null ? '86%' : 'auto',
          height: ratio === null ? '76%' : '76%',
          aspectRatio: ratio ?? undefined,
          borderRadius: '0.2em',
          background: 'currentColor',
          opacity: 0.45,
          border: ratio === null ? '1px dashed currentColor' : undefined,
        }}
      />
    </span>
  );
}

/** Miniatura de tipografía: la misma palabra en la familia que se ofrece. */
function FontPreview({ familia }: { familia: string }) {
  return (
    <span
      aria-hidden
      className="thumb"
      style={{ fontFamily: familia, fontSize: '1.5em', letterSpacing: '-0.02em' }}
    >
      Ag
    </span>
  );
}

/**
 * Miniatura de acabado.
 *
 * Va sobre una franja de dos mitades —clara y oscura— porque es exactamente lo
 * que hay que juzgar: si el acabado aguanta con cualquier cosa detrás. Sobre un
 * fondo plano, «sin caja» parecería igual de seguro que los otros dos.
 */
function FinishPreview({ acabado }: { acabado: 'glass' | 'solid' | 'plain' }) {
  const caja =
    acabado === 'plain'
      ? {
          background: 'none',
          boxShadow: 'none',
          textShadow:
            '0 1px 0 rgb(0 0 0 / .72), 0 -1px 0 rgb(0 0 0 / .72),' +
            '1px 0 0 rgb(0 0 0 / .72), -1px 0 0 rgb(0 0 0 / .72)',
        }
      : {
          background: acabado === 'solid' ? 'rgb(16 16 24 / .92)' : 'rgb(16 16 24 / .58)',
          backdropFilter: acabado === 'glass' ? 'blur(6px)' : 'none',
          boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / .12)',
        };

  return (
    <span
      aria-hidden
      className="thumb"
      style={{ background: 'linear-gradient(90deg, #e9e9ef 50%, #17171f 50%)' }}
    >
      <span
        style={{
          padding: '0.15em 0.4em',
          borderRadius: '0.35em',
          color: '#fff',
          fontSize: '0.7em',
          fontWeight: 600,
          ...caja,
        }}
      >
        42
      </span>
    </span>
  );
}

/** Una fila de color con nombre. Misma pinta que la lista de segmentos. */
function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  const { d } = useI18n();
  return (
    <label className="segment">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={fill(d.editor.colorOf, { name: label })}
      />
      <span>{label}</span>
      <output>{value.toUpperCase()}</output>
    </label>
  );
}

function TypePreview({ id, ready }: { id: string; ready: boolean }) {
  if (id === 'donut' || id === 'pie') {
    return (
      <span
        aria-hidden
        style={{
          display: 'block',
          aspectRatio: '1',
          borderRadius: '50%',
          background:
            id === 'donut'
              ? 'conic-gradient(#7c5cff 0 42%, #00d4ff 0 68%, #41ffc9 0 85%, #ffd166 0 100%)'
              : 'conic-gradient(#7c5cff 0 52%, #00d4ff 0 83%, #41ffc9 0 100%)',
          maskImage:
            id === 'donut'
              ? 'radial-gradient(circle, transparent 46%, #000 47%)'
              : undefined,
        }}
      />
    );
  }

  /* El medidor y el anillo son el mismo sólido, así que la miniatura tiene que
     enseñar lo único que los separa: el hueco abajo y el resto en gris. Sin eso
     las dos tarjetas se ven iguales y el selector deja de decidir nada. */
  if (id === 'gauge') {
    return (
      <span
        aria-hidden
        style={{
          display: 'block',
          aspectRatio: '1',
          borderRadius: '50%',
          background:
            'conic-gradient(from 225deg, #7c5cff 0 50%, rgb(255 255 255 / 0.14) 50% 75%, transparent 75%)',
          maskImage: 'radial-gradient(circle, transparent 52%, #000 53%)',
        }}
      />
    );
  }

  const palette = ['#7c5cff', '#00d4ff', '#41ffc9', '#ffd166'];

  /* Un globo con su retícula, no otra fila de barras: si dos tarjetas comparten
     silueta, el selector deja de decir nada. */
  /*
    El globo es una nube de PUNTOS, no una retícula.

    La miniatura llevaba una malla de meridianos y paralelos, que es el icono
    universal de "global" pero NO es lo que dibuja este tipo. Una miniatura que
    no se parece a su resultado convierte el selector en una lotería: eliges por
    el icono y te encuentras otra cosa. Ahora enseña puntos, como el planteamiento
    tomado de cobe (ver renderer/geometry/globe.ts).

    Los puntos van en un degradado radial repetido y no dibujados uno a uno: a 40
    píxeles no se distingue, y dibujarlos de verdad serían cientos de nodos en
    una tarjeta de un selector.
  */
  if (id === 'globe') {
    return (
      <span
        aria-hidden
        style={{
          display: 'block',
          aspectRatio: '1',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 34% 28%, #2b2470 0%, #1a1550 62%, #111034 100%)',
          /* Halo por fuera, como el atmosférico de la escena real. */
          boxShadow:
            'inset 0 0 0 1px rgb(255 255 255 / 0.1), 0 0 10px -2px rgb(124 92 255 / 0.55)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <i
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            backgroundImage: 'radial-gradient(circle, #8b7dff 0.6px, transparent 0.9px)',
            /* Rejilla suelta y punto pequeño. Apretados y brillantes se leían
               como una malla de tul y no como puntos sobre una superficie: a
               este tamaño lo que hace de "esfera" es el sombreado, no el
               detalle. */
            backgroundSize: '5px 5px',
            opacity: 0.75,
            /* Se apagan hacia el borde: en la esfera de verdad los puntos del
               limbo se ven de canto y casi desaparecen. Sin esto la miniatura se
               lee como un disco perforado, no como una bola. */
            maskImage: 'radial-gradient(circle at 38% 32%, #000 28%, transparent 78%)',
          }}
        />
      </span>
    );
  }

  /* La carrera son barras ORDENADAS de mayor a menor: eso es lo que la
     distingue de las barras normales de un vistazo. */
  const heights = id === 'bar-race' ? [80, 58, 40, 24] : [46, 74, 34, 60];

  return (
    <span
      aria-hidden
      style={{
        display: 'flex',
        aspectRatio: '1',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 3,
        opacity: ready ? 1 : 0.55,
      }}
    >
      {heights.map((h, i) => (
        <i
          key={i}
          style={{
            width: 6,
            height: `${h}%`,
            // El mismo canto que la geometría: la miniatura promete el producto.
            borderRadius: '3px 3px 2px 2px',
            background: ready ? palette[i] : 'currentColor',
          }}
        />
      ))}
    </span>
  );
}

/**
 * La cifra del centro del medidor, en la vista previa del editor.
 *
 * Sale de `gaugeReadout`, que es exactamente la misma función que escribe esa
 * cifra en el HTML del embed. No hay dos formateos que puedan discrepar: lo que
 * se ve aquí es carácter por carácter lo que verá quien abra el link.
 *
 * En 3D no se puede pintar —el bundle no lleva fuentes ni cabe en el
 * presupuesto (ADR 0005)— así que va en HTML encima del canvas, y encima se lee
 * más nítido y se puede seleccionar.
 */
function Readout({ config }: { config: ResolvedChartConfig }) {
  const { value, scale } = gaugeReadout(config);
  return (
    /* `--chars`: CSS no sabe contar, y el cuerpo de la cifra depende de lo larga
       que sea. Ver .readout en styles/embed.css. */
    <div
      className="readout"
      aria-hidden
      style={{ '--chars': value.length } as React.CSSProperties}
    >
      <b>{value}</b>
      {scale && <small>{scale}</small>}
    </div>
  );
}

/** Con y sin fondo de escala. La diferencia se ve, no se explica. */
function TrackPreview({ track }: { track: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'block',
        aspectRatio: '1',
        borderRadius: '50%',
        background: `conic-gradient(from 225deg, #7c5cff 0 34%, ${
          track ? 'rgb(255 255 255 / 0.16)' : 'transparent'
        } 34% 75%, transparent 75%)`,
        maskImage: 'radial-gradient(circle, transparent 52%, #000 53%)',
      }}
    />
  );
}

/** Con y sin líneas guía. La diferencia se ve, no se explica. */
function LabelPreview({ leaders, bars }: { leaders: boolean; bars?: boolean }) {
  if (bars) {
    /*
      LAS ALTURAS VAN EN PORCENTAJE, NO EN PÍXELES.

      Estaban en píxeles calculados a ojo (`h * 0.32`) dentro de una caja que se
      dimensiona con `aspect-ratio` sobre el ancho del panel. O sea que la caja
      encogía con el panel y las barras no: en cuanto la tarjeta bajaba de unos
      110 px, la barra más alta más su línea no cabían y se salían por arriba.
      Solo se veía con barras y carrera, que son los únicos tipos que enseñan
      esta miniatura.

      Con porcentajes, la miniatura es la misma figura a cualquier tamaño, que
      es lo que se le pide a una miniatura.
    */
    return (
      <span
        aria-hidden
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          alignItems: 'end',
          gap: '10%',
          aspectRatio: '16/9',
          padding: '12% 14%',
          borderRadius: 5,
          background: 'var(--surface-sunken)',
          /* Red de seguridad: si algún día vuelve a desbordar, que se recorte
             dentro de su caja en vez de pisar la tarjeta de al lado. */
          overflow: 'hidden',
        }}
      >
        {[70, 100, 45].map((h, i) => (
          <i
            key={h}
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '8%',
              height: '100%',
            }}
          >
            <i
              style={{
                width: '100%',
                /* Deja sitio a la línea de debajo, que también es parte del
                   dibujo: las dos suman el alto del hueco, nunca más. */
                height: `${h * 0.82}%`,
                borderRadius: 2,
                background: ['#7c5cff', '#00d4ff', '#41ffc9'][i],
              }}
            />
            <i
              style={{
                width: leaders ? '100%' : 0,
                height: '8%',
                minHeight: 2,
                borderRadius: 2,
                background: 'currentColor',
                opacity: 0.5,
              }}
            />
          </i>
        ))}
      </span>
    );
  }

  return (
    <span
      aria-hidden
      style={{
        display: 'block',
        aspectRatio: '16/9',
        borderRadius: 5,
        background: 'var(--surface-sunken)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <i
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '38%',
          aspectRatio: '1',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: 'conic-gradient(#7c5cff 0 45%, #00d4ff 0 75%, #41ffc9 0 100%)',
          maskImage: 'radial-gradient(circle, transparent 46%, #000 47%)',
        }}
      />
      {leaders &&
        [30, 62].map((top, i) => (
          <i
            key={top}
            style={{
              position: 'absolute',
              top: `${top}%`,
              [i === 0 ? 'right' : 'left']: '6%',
              width: '26%',
              height: 2,
              borderRadius: 2,
              background: 'currentColor',
              opacity: 0.5,
            }}
          />
        ))}
    </span>
  );
}

/** Muestra literal de lo que va a poner la etiqueta. */
function ShowPreview({ texto }: { texto: string }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'grid',
        placeContent: 'center',
        aspectRatio: '16/9',
        borderRadius: 5,
        background: 'var(--surface-sunken)',
        fontSize: '0.6875rem',
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--text-secondary)',
      }}
    >
      {texto}
    </span>
  );
}

/** Una lista con muestras de color, que es lo que dibuja el modo leyenda. */
function LegendPreview() {
  return (
    <span
      aria-hidden
      style={{
        display: 'grid',
        gap: 3,
        alignContent: 'center',
        aspectRatio: '16/9',
        padding: '12% 14%',
        borderRadius: 5,
        background: 'var(--surface-sunken)',
      }}
    >
      {['#7c5cff', '#00d4ff', '#41ffc9'].map((c) => (
        <i key={c} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <i
            style={{
              width: 5,
              height: 5,
              flex: 'none',
              borderRadius: '50%',
              background: c,
            }}
          />
          <i
            style={{
              flex: 1,
              height: 2,
              borderRadius: 2,
              background: 'currentColor',
              opacity: 0.4,
            }}
          />
        </i>
      ))}
    </span>
  );
}

/** Las tres formas de marcador, en pequeño. */
function MarkerPreview({ kind }: { kind: 'dot' | 'pin' | 'pulse' }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'grid',
        placeItems: 'center',
        aspectRatio: '16/9',
        borderRadius: 5,
        background: 'var(--surface-sunken)',
        position: 'relative',
      }}
    >
      {kind === 'pulse' && (
        <i
          style={{
            position: 'absolute',
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: '1.5px solid #7c5cff',
            opacity: 0.45,
          }}
        />
      )}
      <i
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#7c5cff',
          /* La chincheta se levanta y deja el palo debajo. */
          transform: kind === 'pin' ? 'translateY(-6px)' : undefined,
          boxShadow: kind === 'pin' ? '0 8px 0 -2.5px #7c5cff' : undefined,
        }}
      />
    </span>
  );
}
