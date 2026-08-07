'use client';

import { useMemo, useRef, useState } from 'react';
import { ChartCanvas } from '@/renderer/ChartCanvas';
import { parseConfig } from '@/lib/config/parse';
import { composePoster } from '@/lib/charts/poster';
import type { ChartConfig } from '@/lib/config/schema';

/*
  Banco de pruebas del renderer. No es producto: es donde se prueba a mano cada
  campo del esquema y donde salen los casos raros antes de que los encuentre un
  usuario. Vive en (site), nunca en (embed).
*/

const BASE: ChartConfig = {
  v: 1,
  type: 'donut',
  title: 'Reparto de ingresos',
  data: {
    labels: ['Suscripciones', 'Servicios', 'Licencias', 'Formación', 'Otros'],
    series: [{ name: '2026', values: [42, 26, 17, 9, 6] }],
  },
};

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May'];

const PRESETS: Record<string, Partial<ChartConfig>> = {
  'por defecto': {},
  'sin canto': { style: { bevel: 0 } },
  'canto al máximo': { style: { bevel: 1 } },
  tarta: { style: { innerRadius: 0 } },
  'anillo fino': { style: { innerRadius: 0.78, height: 0.18 } },
  explotado: { style: { explode: 0.5 } },
  mate: { style: { material: 'matte' } },
  metal: { style: { material: 'metal' } },
  plano: { style: { material: 'toon' } },
  'sector diminuto': {
    data: {
      labels: ['A', 'B', 'C'],
      series: [{ values: [96, 3, 1] }],
    },
  },
  'dos sectores': {
    data: { labels: ['Sí', 'No'], series: [{ values: [70, 30] }] },
  },
  quieto: { motion: { autoRotate: false } },

  // ── barras ────────────────────────────────────────────────────────────────
  barras: {
    type: 'bar',
    data: { labels: MESES, series: [{ name: '2026', values: [42, 26, 34, 19, 48] }] },
  },
  'barras: punta abombada': {
    type: 'bar',
    data: { labels: MESES, series: [{ values: [42, 26, 34, 19, 48] }] },
    style: { cornerRadius: 1 },
  },
  'barras: dos series': {
    type: 'bar',
    data: {
      labels: ['Ene', 'Feb', 'Mar', 'Abr'],
      series: [
        { name: '2025', values: [42, 26, 34, 19] },
        { name: '2026', values: [30, 38, 22, 44] },
      ],
    },
  },
  'barras: negativos': {
    type: 'bar',
    data: { labels: MESES, series: [{ values: [42, -18, 34, -9, 48] }] },
  },
  'barras: muchas': {
    type: 'bar',
    data: {
      labels: Array.from({ length: 16 }, (_, i) => `S${i + 1}`),
      series: [
        {
          values: [12, 19, 26, 22, 31, 28, 35, 30, 42, 38, 45, 40, 48, 44, 52, 47],
        },
      ],
    },
  },
  'barras: una sola': {
    type: 'bar',
    data: { labels: ['Total'], series: [{ values: [42] }] },
  },
  'barras: casi cero': {
    type: 'bar',
    data: { labels: MESES, series: [{ values: [100, 0.4, 50, 0.1, 80] }] },
  },
};

export default function RendererDevPage() {
  const [preset, setPreset] = useState('por defecto');
  const [type, setType] = useState<ChartConfig['type']>('donut');
  const [bevel, setBevel] = useState(0.6);
  const [height, setHeight] = useState(0.34);
  const [innerRadius, setInnerRadius] = useState(0.55);
  const [gap, setGap] = useState(0.012);
  const [cornerRadius, setCornerRadius] = useState(0.2);
  /* El fondo, porque es lo que decide qué se ve en el PÓSTER y era justo lo
     que no se podía probar sin guardar una gráfica de verdad. */
  const [bgKind, setBgKind] = useState<'transparent' | 'solid' | 'gradient'>('solid');
  /* Las etiquetas: es donde más fácil se cuela un acabado que no se lee sobre
     algún fondo, y es justo lo que este banco existe para pillar. */
  const [finish, setFinish] = useState<'glass' | 'solid' | 'plain'>('glass');
  const [labelFont, setLabelFont] = useState<'inter' | 'display' | 'mono'>('inter');
  const capture = useRef<(() => string) | null>(null);
  const [poster, setPoster] = useState<{ url: string; peso: string; fmt: string } | null>(
    null,
  );

  const result = useMemo(() => {
    const override = PRESETS[preset] ?? {};
    return parseConfig({
      ...BASE,
      ...override,
      // El preset manda sobre el selector: hay presets que son de un tipo.
      type: override.type ?? type,
      data: override.data ?? BASE.data,
      style: { bevel, height, innerRadius, gap, cornerRadius, ...override.style },
      scene: { background: { kind: bgKind, from: '#0b0b12', to: '#3d1f7a', angle: 135 } },
      labels: { show: true, mode: 'outside', finish, font: labelFont },
    });
  }, [preset, type, bevel, height, innerRadius, gap, cornerRadius, bgKind, finish, labelFont]);

  /*
    El PÓSTER tal y como se va a guardar.

    Existe aquí porque el camino de verdad —guardar una gráfica— pide sesión, y
    la sesión es por link mágico: no hay forma de recorrerlo en una prueba
    automática. Sin esto, la única manera de ver si el fondo sale en la imagen
    era guardar, publicar y mirar la tarjeta en Slack.
  */
  const verPoster = async () => {
    const png = capture.current?.();
    if (!png || !result.ok) return;

    const compuesto = await composePoster(png, result.config.scene.background, {
      /* `ResolvedChartConfig` no lleva `theme`: el tema se resuelve al parsear
         y lo que queda son sus efectos. El banco no usa ninguno, así que el
         respaldo por paleta es justo lo que aquí interesa probar. */
      palette: result.config.style.palette,
    });
    /* El PESO se enseña porque es la mitad del asunto: un degradado en PNG se
       va a 2,6 MB y eso se paga en la tarjeta de enlace, no aquí. */
    const bytes = (await (await fetch(compuesto.dataUrl)).blob()).size;
    setPoster({
      url: compuesto.dataUrl,
      peso: `${Math.round(bytes / 1024)} KB`,
      fmt: compuesto.format,
    });
  };

  const isBar = (PRESETS[preset]?.type ?? type) === 'bar';

  return (
    <main
      style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr',
        height: '100dvh',
        background: 'var(--surface-base)',
      }}
    >
      <aside
        style={{
          padding: 'var(--p-space-6)',
          borderRight: '1px solid var(--edge-subtle)',
          overflowY: 'auto',
          display: 'grid',
          gap: 'var(--p-space-4)',
          alignContent: 'start',
        }}
      >
        <h1 style={{ font: '600 var(--p-text-lg)/1.2 var(--font-display)', margin: 0 }}>
          Banco del renderer
        </h1>

        <label style={{ display: 'grid', gap: 'var(--p-space-1)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Preset</span>
          <select value={preset} onChange={(e) => setPreset(e.target.value)}>
            {Object.keys(PRESETS).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 'var(--p-space-1)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Tipo</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ChartConfig['type'])}
          >
            <option value="donut">anillo</option>
            <option value="pie">tarta</option>
            <option value="bar">barras</option>
          </select>
        </label>

        <Slider
          label="bevel"
          value={bevel}
          min={0}
          max={1}
          step={0.01}
          onChange={setBevel}
        />
        <Slider
          label={isBar ? 'altura' : 'grosor'}
          value={height}
          min={0.05}
          max={1}
          step={0.01}
          onChange={setHeight}
        />
        {/* Los dos campos que solo significan algo en un tipo se marcan, en vez
            de esconderlos: en el banco interesa ver que el otro tipo los ignora. */}
        <Slider
          label={isBar ? 'radio interior (no aplica)' : 'radio interior'}
          value={innerRadius}
          min={0}
          max={0.85}
          step={0.01}
          onChange={setInnerRadius}
        />
        <Slider
          label={isBar ? 'punta redondeada' : 'punta redondeada (no aplica)'}
          value={cornerRadius}
          min={0}
          max={1}
          step={0.01}
          onChange={setCornerRadius}
        />
        <Slider
          label={isBar ? 'separación' : 'hueco'}
          value={gap}
          min={0}
          max={0.05}
          step={0.001}
          onChange={setGap}
        />

        <label style={{ display: 'grid', gap: 'var(--p-space-1)' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--p-text-xs)' }}>
            fondo
          </span>
          <select
            value={bgKind}
            onChange={(e) => setBgKind(e.target.value as typeof bgKind)}
          >
            <option value="transparent">transparente</option>
            <option value="solid">sólido</option>
            <option value="gradient">degradado</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: 'var(--p-space-1)' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--p-text-xs)' }}>
            envoltorio de la etiqueta
          </span>
          <select
            value={finish}
            onChange={(e) => setFinish(e.target.value as typeof finish)}
          >
            <option value="glass">vidrio</option>
            <option value="solid">sólido</option>
            <option value="plain">sin caja</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: 'var(--p-space-1)' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--p-text-xs)' }}>
            letra de la etiqueta
          </span>
          <select
            value={labelFont}
            onChange={(e) => setLabelFont(e.target.value as typeof labelFont)}
          >
            <option value="inter">palo seco</option>
            <option value="display">serifa</option>
            <option value="mono">monoespaciada</option>
          </select>
        </label>

        <button type="button" onClick={verPoster} disabled={!result.ok}>
          ver el póster
        </button>

        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--p-text-xs)' }}>
          {result.ok ? (
            <>
              Config válido.
              {result.issues.length > 0 && ` ${result.issues.length} aviso(s).`}
            </>
          ) : (
            <span style={{ color: 'var(--p-danger-500)' }}>
              {result.issues.map((i) => `${i.path}: ${i.message}`).join(' · ')}
            </span>
          )}
        </div>
      </aside>

      <div style={{ position: 'relative', minHeight: 0, height: '100%' }}>
        {result.ok && <ChartCanvas config={result.config} captureRef={capture} />}

        {/* El póster se enseña ENCIMA y a tamaño reducido, sobre un tablero de
            cuadros: es la única forma de ver de un vistazo si lo que hay detrás
            del dibujo es el fondo elegido o transparencia. */}
        {poster && (
          <div
            onClick={() => setPoster(null)}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              background: 'rgb(0 0 0 / .6)',
              cursor: 'zoom-out',
            }}
          >
            <div style={{ display: 'grid', gap: 'var(--p-space-2)', justifyItems: 'center' }}>
              <img
                src={poster.url}
                alt="Póster"
                style={{
                  maxWidth: '70%',
                  maxHeight: '70dvh',
                  /* Cuadros: donde se vean, el PNG es transparente ahí. */
                  backgroundImage:
                    'linear-gradient(45deg,#888 25%,transparent 25%,transparent 75%,#888 75%),' +
                    'linear-gradient(45deg,#888 25%,transparent 25%,transparent 75%,#888 75%)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 8px 8px',
                  backgroundColor: '#ccc',
                }}
              />
              <span style={{ color: '#fff', fontSize: 'var(--p-text-xs)' }}>
                {poster.fmt.toUpperCase()} · {poster.peso} · tal cual se sube · pulsa
                para cerrar
              </span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: 'grid', gap: 'var(--p-space-1)' }}>
      <span
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          color: 'var(--text-secondary)',
        }}
      >
        {label}
        <span data-numeric style={{ color: 'var(--text-primary)' }}>
          {value.toFixed(3)}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
