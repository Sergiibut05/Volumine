'use client';

import { useMemo, useState } from 'react';
import { ChartStage } from '@/renderer/ChartStage';
import { parseConfig } from '@/lib/config/parse';
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

const PRESETS: Record<string, Partial<ChartConfig>> = {
  'por defecto': {},
  'sin canto': { style: { bevel: 0 } },
  'canto al máximo': { style: { bevel: 1 } },
  tarta: { style: { innerRadius: 0 } },
  'anillo fino': { style: { innerRadius: 0.78, height: 0.18 } },
  explotado: { style: { explode: 0.5 } },
  mate: { style: { material: 'matte' } },
  metal: { style: { material: 'metal' } },
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
};

export default function RendererDevPage() {
  const [preset, setPreset] = useState('por defecto');
  const [bevel, setBevel] = useState(0.6);
  const [height, setHeight] = useState(0.34);
  const [innerRadius, setInnerRadius] = useState(0.55);
  const [gap, setGap] = useState(0.012);

  const result = useMemo(() => {
    const override = PRESETS[preset] ?? {};
    return parseConfig({
      ...BASE,
      ...override,
      data: override.data ?? BASE.data,
      style: { bevel, height, innerRadius, gap, ...override.style },
      scene: { background: { kind: 'solid', from: '#0b0b12' } },
    });
  }, [preset, bevel, height, innerRadius, gap]);

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

        <Slider
          label="bevel"
          value={bevel}
          min={0}
          max={1}
          step={0.01}
          onChange={setBevel}
        />
        <Slider
          label="grosor"
          value={height}
          min={0.05}
          max={1}
          step={0.01}
          onChange={setHeight}
        />
        <Slider
          label="radio interior"
          value={innerRadius}
          min={0}
          max={0.85}
          step={0.01}
          onChange={setInnerRadius}
        />
        <Slider
          label="hueco"
          value={gap}
          min={0}
          max={0.05}
          step={0.001}
          onChange={setGap}
        />

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

      {/* `minHeight: 0` no es decorativo: los items de un grid llevan
          min-height:auto, la celda mide 0 en el primer paint y R3F se queda con
          un canvas de 300×150 que ya no vuelve a medir. */}
      <div style={{ position: 'relative', minHeight: 0, height: '100%' }}>
        {result.ok && <ChartStage config={result.config} />}
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
