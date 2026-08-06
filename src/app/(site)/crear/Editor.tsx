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
import { CHART_TYPES } from '@/lib/chart-types';
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
  El ejemplo con el que arranca una gráfica nueva.

  Sigue siendo una constante de módulo aunque el estado inicial venga por props:
  `switchType` la usa para saber si los datos que hay son los de EJEMPLO o los
  del usuario, y solo pisa los primeros. Una gráfica cargada nunca coincide con
  esto, así que sus datos están a salvo por construcción.
*/
export const INITIAL: ChartConfig = {
  v: 1,
  type: 'donut',
  title: 'Reparto de ingresos',
  data: {
    labels: ['Suscripciones', 'Servicios', 'Licencias', 'Formación', 'Otros'],
    series: [{ values: [42, 26, 17, 9, 6] }],
    format: { unit: ' k€', locale: 'es-ES' },
  },
  // El tema se nombra y se resuelve al parsear. Aquí solo va lo propio.
  theme: 'aurora',
  scene: { background: { kind: 'transparent' } },
};

const MATERIALS = [
  { id: 'physical', label: 'Plástico', hint: 'Brillo suave. El de por defecto.' },
  { id: 'matte', label: 'Mate', hint: 'Sin reflejos. Se lee bien impreso.' },
  { id: 'metal', label: 'Metal', hint: 'Caro pero pierde detalle.' },
  { id: 'glass', label: 'Vidrio', hint: 'Translúcido. Pocas categorías.' },
  { id: 'toon', label: 'Plano', hint: 'Sin sombreado. Junto a texto largo.' },
] as const;

const BACKGROUNDS = [
  { id: 'transparent', label: 'Transparente', hint: 'Se funde con tu página.' },
  { id: 'solid', label: 'Sólido', hint: 'Un color.' },
  { id: 'gradient', label: 'Degradado', hint: 'De un color a otro.' },
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
function switchType(config: ChartConfig, type: ChartConfig['type']): Partial<ChartConfig> {
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
  const pristine = JSON.stringify(config.data) === JSON.stringify(INITIAL.data);
  const sample = CHART_TYPES.find((entry) => entry.id === type)?.sample;

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

  const patch = (next: Partial<ChartConfig>) => setConfig((c) => ({ ...c, ...next }));
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

  const themeChoices: Choice[] = THEMES.map((theme) => ({
    id: theme.id,
    label: theme.name,
    hint: theme.use,
    preview: (
      <span className="swatch" aria-hidden>
        {theme.swatch.map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
      </span>
    ),
  }));

  const typeChoices: Choice[] = CHART_TYPES.map((type) => ({
    id: String(type.id),
    label: type.name,
    hint: type.status === 'listo' ? type.answers : 'Todavía no disponible',
    disabled: type.status !== 'listo',
    preview: <TypePreview id={String(type.id)} ready={type.status === 'listo'} />,
  }));

  return (
    /* Oscuro a la fuerza, no según la preferencia del sistema: el editor es un
       modo de taller y el 3D con luz IBL se lee mejor sobre oscuro. La landing
       es lo contrario, y ese contraste es intencionado. */
    <div className="editor" data-theme="dark">
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
            <code>{url.ok ? url.url : `${url.length} caracteres — demasiado largo`}</code>
            <button type="button" onClick={copy} disabled={!url.ok}>
              {copied ? 'Copiado' : 'Copiar link'}
            </button>
          </div>
        )}
      </div>

      <aside className="panel">
        <header
          style={{
            display: 'flex',
            alignItems: 'baseline',
            marginBottom: 'var(--p-space-6)',
          }}
        >
          <Link
            href="/"
            style={{ color: 'var(--text-primary)', textDecoration: 'none' }}
            aria-label="Voluma — inicio"
          >
            {/* Sube de 1,0625 a 1,25 rem y gana símbolo. A la medida anterior
                el nombre pesaba menos que los títulos de las tarjetas de abajo,
                así que la cabecera no se leía como cabecera. */}
            <Wordmark size={1.25} />
          </Link>
          <span style={{ flex: 1 }} />

          {/* SIN ESTE ENLACE, «Mis gráficas» no existía para el usuario: la
              página estaba hecha y solo se llegaba a ella justo después de
              entrar. Guardabas, se guardaba de verdad, y no había forma de
              volver a encontrarlo. */}
          {signedIn && (
            <Link className="savebar-link" href="/mis-graficas">
              Mis gráficas
            </Link>
          )}

          {/* Deshacer y rehacer. Los atajos (Ctrl/Cmd+Z) los pone el hook; los
              botones están porque un atajo que nadie sabe que existe no
              tranquiliza a nadie a la hora de experimentar. */}
          <div className="undo">
            <button
              type="button"
              onClick={history.undo}
              disabled={!history.canUndo}
              title="Deshacer (Ctrl+Z)"
              aria-label="Deshacer"
            >
              ↶
            </button>
            <button
              type="button"
              onClick={history.redo}
              disabled={!history.canRedo}
              title="Rehacer (Ctrl+Shift+Z)"
              aria-label="Rehacer"
            >
              ↷
            </button>
          </div>

          {url && !url.ok && (
            <span className="warn" style={{ fontSize: '0.75rem' }}>
              Pasa de {MAX_URL_LENGTH} caracteres
            </span>
          )}

          {/* Guardar va aquí y no en la barra del link de abajo: son dos cosas
              distintas y conviene que no se confundan. Abajo está el link que
              YA funciona sin cuenta; esto es para tener uno corto y poder
              volver. Ver SaveBar.tsx. */}
          <SaveBar
            config={config}
            chartId={chartId}
            visibility={visibility}
            signedIn={signedIn}
            userId={userId}
            capture={capture}
          />
        </header>

        {/* Nivel 1 — un control, y con esto ya se puede publicar. */}
        <Group title="Tema" hint="Empieza por aquí">
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
        </Group>

        {/* Los DATOS van antes que el aspecto. Es lo que la gente viene a meter,
            y ordenar el panel al revés convierte la herramienta en un juguete de
            estilo con unos números de ejemplo pegados. */}
        <Group title="Datos" hint="Pega desde tu hoja">
          <DataEditor
            config={config}
            onChange={(data, discrete) =>
              setConfig((c) => ({ ...c, data }), { coalesce: !discrete })
            }
          />
        </Group>

        <Group title="Tipo">
          <Choices
            label="Tipo de gráfica"
            options={typeChoices}
            value={config.type}
            onChange={(id) =>
              setConfig((c) => ({ ...c, ...switchType(c, id as ChartConfig['type']) }), {
                coalesce: false,
              })
            }
          />
        </Group>

        {/* Nivel 2 — los ajustes que de verdad usa la mayoría. */}
        <Group title="Color">
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
                    aria-label={`Color de ${label}`}
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
          <Group title="Planeta">
            <div className="segments">
              <ColorRow
                label="Planeta"
                value={style?.globe.base ?? '#111634'}
                onChange={(base) => patchGlobe({ base })}
              />
              <ColorRow
                label="Tierra"
                value={style?.globe.land ?? '#8b7dff'}
                onChange={(land) => patchGlobe({ land })}
              />
              <ColorRow
                label="Halo"
                value={style?.globe.glow ?? '#5b3ce6'}
                onChange={(glow) => patchGlobe({ glow })}
              />
            </div>
            <Slider
              label="Densidad del mapa"
              value={style?.globe.density ?? 0.72}
              min={0}
              max={1}
              step={0.01}
              format={(v) =>
                `${Math.round(6000 + (40000 - 6000) * v).toLocaleString('es-ES')} puntos`
              }
              onChange={(density) => patchGlobe({ density })}
            />
            <Slider
              label="Tamaño del punto"
              value={style?.globe.dotSize ?? 0.7}
              min={0}
              max={1}
              step={0.01}
              onChange={(dotSize) => patchGlobe({ dotSize })}
            />
            <Choices
              label="Marcador"
              value={config.style?.globe?.marker ?? 'dot'}
              onChange={(marker) =>
                patchGlobe({ marker: marker as 'dot' | 'pin' | 'pulse' })
              }
              options={[
                {
                  id: 'dot',
                  label: 'Punto',
                  hint: 'Lo más sobrio.',
                  preview: <MarkerPreview kind="dot" />,
                },
                {
                  id: 'pin',
                  label: 'Chincheta',
                  hint: 'Se ve dónde toca, incluso de canto.',
                  preview: <MarkerPreview kind="pin" />,
                },
                {
                  id: 'pulse',
                  label: 'Pulso',
                  hint: 'Para «está pasando ahora».',
                  preview: <MarkerPreview kind="pulse" />,
                },
              ]}
            />
            <Slider
              label="Tamaño del marcador"
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
          <Group title="Escala" hint="Sobre qué se mide">
            <label className="control">
              <header>
                <span>Tope de la escala</span>
                {/* Solo se dice algo cuando hay algo que decir. Pasarse del tope
                    llena el arco entero, así que sin este aviso la gráfica se ve
                    igual de llena con 100 que con 240 y no se entiende por qué. */}
                {gaugeReading?.overflow && (
                  <output className="warn">Los datos se pasan del tope</output>
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
              label="Apertura del arco"
              value={config.style?.gauge?.sweep ?? 270}
              min={120}
              max={360}
              step={5}
              format={(v) => (v === 360 ? 'Anillo completo' : `${v}°`)}
              onChange={(sweep) => patchGauge({ sweep })}
            />
            <Choices
              label="Resto de la escala"
              value={config.style?.gauge?.track === false ? 'off' : 'on'}
              onChange={(v) => patchGauge({ track: v === 'on' })}
              options={[
                {
                  id: 'on',
                  label: 'A la vista',
                  hint: 'Se ve cuánto falta.',
                  preview: <TrackPreview track />,
                },
                {
                  id: 'off',
                  label: 'Oculto',
                  hint: 'Solo el trozo lleno.',
                  preview: <TrackPreview track={false} />,
                },
              ]}
            />
          </Group>
        )}

        {/* Cada tipo enseña SOLO sus campos. Un slider que no hace nada es peor
            que uno que falta: te hace dudar de si la gráfica está rota. */}
        {!isGlobe && (
          <Group title="Forma" hint="Rangos seguros">
            <Slider
              label="Canto redondeado"
              value={style?.bevel ?? 0.6}
              min={0}
              max={1}
              step={0.01}
              format={(v) =>
                `${(v * bevelCeiling).toFixed(3)} de ${bevelCeiling.toFixed(3)}`
              }
              onChange={(v) => patchStyle({ bevel: v })}
            />
            <Slider
              label={isBar ? 'Altura' : 'Grosor'}
              value={style?.height ?? 0.34}
              min={0.05}
              max={1}
              step={0.01}
              onChange={(v) => patchStyle({ height: v })}
            />
            {isBar ? (
              <Slider
                label="Punta redondeada"
                value={style?.cornerRadius ?? 0.2}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => patchStyle({ cornerRadius: v })}
              />
            ) : (
              <Slider
                label="Agujero central"
                value={style?.innerRadius ?? 0.55}
                min={0}
                max={0.85}
                step={0.01}
                onChange={(v) => patchStyle({ innerRadius: v })}
              />
            )}
            <Slider
              label="Separación"
              value={style?.gap ?? 0.012}
              min={0}
              max={0.05}
              step={0.001}
              format={(v) => v.toFixed(3)}
              onChange={(v) => patchStyle({ gap: v })}
            />
            {!isBar && (
              <Slider
                label="Sectores separados"
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
          <Group title="Acabado">
            <Choices
              label="Material"
              options={MATERIALS.map((m) => ({
                id: m.id,
                label: m.label,
                hint: m.hint,
                preview: <span className="matball" data-material={m.id} aria-hidden />,
              }))}
              value={style?.material ?? 'physical'}
              onChange={(id) => patchStyle({ material: id as never })}
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
          <Group title="Etiquetas" hint="Ver los datos sin pasar el ratón">
            <Choices
              label="Etiquetas"
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
                  label: 'Al pasar',
                  hint: 'Solo al poner el ratón encima.',
                  preview: <LabelPreview leaders={false} bars={isBar || isRace} />,
                },
                {
                  id: 'outside',
                  label: 'Siempre',
                  hint: 'Junto a cada parte.',
                  preview: <LabelPreview leaders bars={isBar || isRace} />,
                },
                {
                  id: 'legend',
                  /* Con nombres largos o muchas categorías, colocadas alrededor
                     del dibujo no caben y la mitad se descartan; en lista caben
                     todas. */
                  label: 'Leyenda',
                  hint: 'Una lista en una esquina.',
                  preview: <LegendPreview />,
                },
              ]}
            />

            {config.labels?.show && (
              <>
                <Choices
                  label="Qué se enseña"
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
                      label: 'Valor',
                      hint: 'La cifra tal cual.',
                      preview: <ShowPreview texto="42" />,
                    },
                    {
                      id: 'porcentaje',
                      label: 'Porcentaje',
                      hint: 'Su parte del total.',
                      preview: <ShowPreview texto="35%" />,
                    },
                    {
                      id: 'ambos',
                      label: 'Los dos',
                      hint: 'Cifra y porcentaje.',
                      preview: <ShowPreview texto="42 · 35%" />,
                    },
                  ]}
                />
                <Slider
                  label="Tamaño del texto"
                  value={config.labels?.size ?? 1}
                  min={0.7}
                  max={1.6}
                  step={0.05}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onChange={(size) =>
                    setConfig((c) => ({ ...c, labels: { ...c.labels, size } }))
                  }
                />
              </>
            )}
          </Group>
        )}

        <Group title="Fondo">
          <Choices
            label="Fondo"
            options={BACKGROUNDS.map((b) => ({
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
                label={bgKind === 'gradient' ? 'Desde' : 'Color'}
                value={config.scene?.background?.from ?? '#0b0b12'}
                onChange={(from) => patchBackground({ from })}
              />
              {bgKind === 'gradient' && (
                <ColorRow
                  label="Hasta"
                  value={config.scene?.background?.to ?? '#1a1030'}
                  onChange={(to) => patchBackground({ to })}
                />
              )}
            </div>
          )}

          {bgKind === 'gradient' && (
            <Slider
              label="Ángulo"
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
          <Group title="Movimiento">
            {isRace && (
              <Slider
                label="Duración de cada periodo"
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
                label={isRace || isBar ? 'Vaivén' : 'Velocidad de giro'}
                value={config.motion?.speed ?? 0.9}
                min={0}
                max={4}
                step={0.1}
                format={(v) => (v === 0 ? 'Parado' : `${v.toFixed(1)} vueltas/min`)}
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
            Avanzado
          </summary>
          <div
            style={{
              display: 'grid',
              gap: 'var(--p-space-4)',
              marginTop: 'var(--p-space-4)',
            }}
          >
            <Slider
              label="Intensidad de luz"
              value={config.scene?.lightIntensity ?? 0.55}
              min={0}
              max={1.2}
              step={0.01}
              onChange={(v) =>
                setConfig((c) => ({ ...c, scene: { ...c.scene, lightIntensity: v } }))
              }
            />
            <Slider
              label="Rugosidad"
              value={style?.roughness ?? 0.32}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => patchStyle({ roughness: v })}
            />
            <Slider
              label="Ángulo de cámara"
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
  return (
    <label className="segment">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Color: ${label}`}
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
    return (
      <span
        aria-hidden
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          alignItems: 'end',
          gap: '14%',
          aspectRatio: '16/9',
          padding: '14% 16%',
          borderRadius: 5,
          background: 'var(--surface-sunken)',
        }}
      >
        {[70, 100, 45].map((h, i) => (
          <i key={h} style={{ display: 'grid', gap: 3, justifyItems: 'center' }}>
            <i
              style={{
                width: '100%',
                height: `${h * 0.32}px`,
                borderRadius: 2,
                background: ['#7c5cff', '#00d4ff', '#41ffc9'][i],
              }}
            />
            <i
              style={{
                width: leaders ? '100%' : 0,
                height: 2,
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
