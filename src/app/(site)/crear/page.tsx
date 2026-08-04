'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import '@/styles/editor.css';
import { ChartCanvas } from '@/renderer/ChartCanvas';
import { parseConfig } from '@/lib/config/parse';
import { buildEmbedUrl, MAX_URL_LENGTH } from '@/lib/config/url';
import { THEMES } from '@/lib/themes';
import { CHART_TYPES } from '@/lib/chart-types';
import { computeSectors, globalBevel, OUTER_RADIUS } from '@/renderer/geometry/donut';
import { computeBars, barRadii } from '@/renderer/geometry/bar';
import type { ChartConfig } from '@/lib/config/schema';
import { Group, Slider, Choices, type Choice } from './controls';

/*
  El editor.

  Tres niveles de profundidad (docs/CUSTOMIZATION.md): tema, ajustes, avanzado.
  Cada uno basta por sí solo para publicar; nadie debería tener que bajar de
  nivel para conseguir algo razonable.

  Los presets con nombre van antes que los controles físicos: la gente sabe si
  quiere plástico o metal, no sabe qué es la rugosidad.
*/

const INITIAL: ChartConfig = {
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

export default function EditorPage() {
  const [config, setConfig] = useState<ChartConfig>(INITIAL);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

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

    const sectors = computeSectors(c.data.series[0]?.values ?? [], c.style.gap);
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
        {parsed.ok && <ChartCanvas config={parsed.config} />}

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
            marginBottom: 'var(--p-space-5)',
          }}
        >
          <Link
            href="/"
            style={{
              fontFamily: 'var(--font-display), sans-serif',
              fontWeight: 700,
              fontSize: '1.0625rem',
              color: 'var(--text-primary)',
              textDecoration: 'none',
            }}
          >
            Voluma
          </Link>
          <span style={{ flex: 1 }} />
          {url && !url.ok && (
            <span className="warn" style={{ fontSize: '0.75rem' }}>
              Pasa de {MAX_URL_LENGTH} caracteres
            </span>
          )}
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
            onChange={(id) => setConfig((c) => ({ ...c, theme: id, style: {}, scene: {} }))}
          />
        </Group>

        <Group title="Tipo">
          <Choices
            label="Tipo de gráfica"
            options={typeChoices}
            value={config.type}
            onChange={(id) =>
              patch({
                type: id as ChartConfig['type'],
                style: { ...config.style, innerRadius: id === 'pie' ? 0 : 0.55 },
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

        {/* Cada tipo enseña SOLO sus campos. Un slider que no hace nada es peor
            que uno que falta: te hace dudar de si la gráfica está rota. */}
        <Group title="Forma" hint="Rangos seguros">
          <Slider
            label="Canto redondeado"
            value={style?.bevel ?? 0.6}
            min={0}
            max={1}
            step={0.01}
            format={(v) => `${(v * bevelCeiling).toFixed(3)} de ${bevelCeiling.toFixed(3)}`}
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
        </Group>

        <Group title="Movimiento">
          <Slider
            label="Velocidad de giro"
            value={config.motion?.speed ?? 0.9}
            min={0}
            max={4}
            step={0.1}
            format={(v) => (v === 0 ? 'Parada' : `${v.toFixed(1)} vueltas/min`)}
            onChange={(v) =>
              setConfig((c) => ({
                ...c,
                motion: { ...c.motion, speed: v, autoRotate: v > 0 },
              }))
            }
          />
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
            id === 'donut' ? 'radial-gradient(circle, transparent 46%, #000 47%)' : undefined,
        }}
      />
    );
  }

  const palette = ['#7c5cff', '#00d4ff', '#41ffc9', '#ffd166'];

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
      {[46, 74, 34, 60].map((h, i) => (
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
