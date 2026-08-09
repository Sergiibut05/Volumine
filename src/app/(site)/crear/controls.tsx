'use client';

import * as RadixSlider from '@radix-ui/react-slider';
import type { ReactNode } from 'react';

/*
  Piezas de control del editor.

  Radix aporta accesibilidad y comportamiento (teclado, arrastre, ARIA) sin
  imponer ningún aspecto: el estilo es nuestro, en editor.css. Un kit de UI con
  su propia estética nos dejaría exactamente con la landing de plantilla que
  docs/DESIGN.md prohíbe.
*/

export function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="group">
      <header>
        <h2>{title}</h2>
        {hint && <p>{hint}</p>}
      </header>
      <div>{children}</div>
    </section>
  );
}

export function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  /**
   * Una línea de aclaración bajo la etiqueta. Para cuando el nombre del control
   * no basta porque hay otro que se le parece: «rotación» de la gráfica y
   * «ángulo» de la cámara suenan igual y hacen cosas distintas.
   */
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="control">
      <header>
        <span>{label}</span>
        <output>{format ? format(value) : value.toFixed(2)}</output>
      </header>
      {hint && <p className="control-hint">{hint}</p>}
      <RadixSlider.Root
        className="slider-root"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        aria-label={label}
      >
        <RadixSlider.Track className="slider-track">
          <RadixSlider.Range className="slider-range" />
        </RadixSlider.Track>
        <RadixSlider.Thumb className="slider-thumb" />
      </RadixSlider.Root>
    </div>
  );
}

export type Choice = {
  id: string;
  label: string;
  preview: ReactNode;
  hint?: string;
  disabled?: boolean;
};

export function Choices({
  options,
  value,
  onChange,
  label,
}: {
  options: Choice[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <div className="choices" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className="choice"
          aria-pressed={option.id === value}
          disabled={option.disabled}
          title={option.hint}
          onClick={() => onChange(option.id)}
        >
          {option.preview}
          {option.label}
        </button>
      ))}
    </div>
  );
}
