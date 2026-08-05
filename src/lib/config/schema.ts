import { z } from 'zod';

/*
  Contrato ChartConfig v1. La especificación escrita está en
  docs/chart-config-schema.md — si cambias algo aquí, cámbialo allí primero.

  Reglas que este archivo hace cumplir (docs/chart-config-schema.md):
  · Todo salvo `v`, `type` y `data` es opcional. Los defaults viven en
    defaults.ts, en un único sitio.
  · Dentro de una versión solo se AÑADEN campos opcionales. Renombrar, borrar o
    cambiar el significado de uno = subir `v` + escribir migración.
  · Un config inválido nunca revienta el embed: se sanea. Ver parseConfig().
*/

export const CURRENT_VERSION = 1;

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'color hex inválido');

/** 0..1, el rango normalizado que usa casi todo el esquema. */
const unit = z.number().min(0).max(1);

// ── data ────────────────────────────────────────────────────────────────────

export const seriesSchema = z.object({
  name: z.string().max(120).optional(),
  values: z.array(z.number().finite()).min(1).max(200),
  /** Override por segmento. `null` = usar la paleta. */
  colors: z.array(hexColor.nullable()).optional(),
});

export const dataSchema = z.object({
  labels: z.array(z.string().max(120)).min(1).max(200),
  series: z.array(seriesSchema).min(1).max(20),
  /**
   * Coordenadas `[latitud, longitud]` por etiqueta, en grados. Solo las usa
   * `globe`; el resto de tipos las ignoran.
   *
   * Van aquí y no dentro de la serie porque describen DÓNDE está una categoría,
   * no cuánto vale: si mañana un globo admite varias series, todas comparten
   * sitio y cambian de valor.
   */
  coords: z
    .array(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]))
    .max(200)
    .optional(),
  format: z
    .object({
      unit: z.string().max(8).optional(),
      decimals: z.number().int().min(0).max(6).optional(),
      locale: z.string().max(16).optional(),
      as: z.enum(['value', 'percent']).optional(),
    })
    .optional(),
});

// ── style ───────────────────────────────────────────────────────────────────

export const styleSchema = z.object({
  palette: z.array(hexColor).min(1).max(24).optional(),
  paletteMode: z.enum(['cycle', 'gradient']).optional(),
  material: z.enum(['physical', 'matte', 'glass', 'metal', 'toon']).optional(),
  roughness: unit.optional(),
  metalness: unit.optional(),
  /** El rasgo de marca. Relativo al máximo seguro, no absoluto — ver geometría. */
  bevel: unit.optional(),
  /** Separación entre segmentos, en vueltas completas (0.012 ≈ 4.3°). */
  gap: z.number().min(0).max(0.05).optional(),
  innerRadius: z.number().min(0).max(0.85).optional(),
  height: z.number().min(0.05).max(1).optional(),
  explode: unit.optional(),
  cornerRadius: unit.optional(),
  shadow: z.boolean().optional(),
  /**
   * Ajustes propios del globo. Nadie más los mira.
   *
   * Van agrupados y no sueltos en `style` porque no significan nada en los otros
   * tipos: un `landColor` en una gráfica de barras es ruido en el esquema, en el
   * editor y en la URL.
   */
  globe: z
    .object({
      /** Color del planeta, bajo los puntos. */
      base: hexColor.optional(),
      /** Color de los puntos de tierra. */
      land: hexColor.optional(),
      /** Halo atmosférico. */
      glow: hexColor.optional(),
      /** Cuántos puntos. 0 = mínimo legible, 1 = máximo. */
      density: unit.optional(),
      /** Tamaño de los puntos de tierra. */
      dotSize: unit.optional(),
      /** Tamaño del marcador mayor. */
      markerSize: unit.optional(),
    })
    .optional(),
  /**
   * Ajustes propios del medidor. Nadie más los mira.
   *
   * `max` es el único campo del esquema que cambia lo que un número SIGNIFICA,
   * no cómo se ve: «48» no dice nada hasta saber si es sobre 60 o sobre 1000.
   * Aun así vive en `style` y no en `data` para que la tabla de datos siga
   * siendo la misma para todos los tipos — es una escala, como un eje, no un
   * dato más.
   */
  gauge: z
    .object({
      /** Tope de la escala. El arco se llena al llegar aquí. */
      max: z.number().finite().optional(),
      /** Cuántos grados abarca el arco, centrado abajo. 360 = anillo entero. */
      sweep: z.number().min(30).max(360).optional(),
      /** Pintar el resto de la escala sin llenar. */
      track: z.boolean().optional(),
      /** Color de ese resto. `auto` = el de fondo, apagado. */
      trackColor: z.union([hexColor, z.literal('auto')]).optional(),
    })
    .optional(),
});

// ── scene ───────────────────────────────────────────────────────────────────

export const backgroundSchema = z.object({
  kind: z.enum(['transparent', 'solid', 'gradient', 'grid', 'dots']).optional(),
  from: hexColor.optional(),
  to: hexColor.optional(),
  angle: z.number().min(0).max(360).optional(),
});

export const sceneSchema = z.object({
  background: backgroundSchema.optional(),
  environment: z.enum(['studio', 'sunset', 'city', 'night', 'soft']).optional(),
  /* Por encima de ~0.7 el IBL blanco lava el color y todo parece plastilina.
     Lección del prototipo, ver docs/STATE.md. */
  lightIntensity: z.number().min(0).max(3).optional(),
  ambient: unit.optional(),
  fog: unit.optional(),
  bloom: unit.optional(),
  vignette: unit.optional(),
});

// ── camera ──────────────────────────────────────────────────────────────────

export const cameraSchema = z.object({
  preset: z.enum(['hero', 'top', 'front', 'isometric', 'custom']).optional(),
  polar: z.number().min(1).max(89).optional(),
  azimuth: z.number().min(-180).max(180).optional(),
  distance: z.number().min(0.3).max(4).optional(),
  fov: z.number().min(10).max(90).optional(),
  orthographic: z.boolean().optional(),
});

// ── motion ──────────────────────────────────────────────────────────────────

export const motionSchema = z.object({
  autoRotate: z.boolean().optional(),
  /** Vueltas por minuto. */
  speed: z.number().min(0).max(10).optional(),
  entrance: z.enum(['none', 'grow', 'sweep', 'stagger']).optional(),
  entranceDuration: z.number().int().min(0).max(5000).optional(),
  /**
   * Milisegundos por periodo en `bar-race`. Ignorado por el resto de tipos.
   *
   * Campo opcional nuevo dentro de v1, que es lo único que el contrato permite
   * añadir sin subir versión (docs/chart-config-schema.md).
   */
  frameDuration: z.number().int().min(120).max(10000).optional(),
  hover: z.enum(['none', 'lift', 'glow', 'explode']).optional(),
  reducedMotion: z.enum(['respect', 'force-off', 'ignore']).optional(),
});

// ── labels ──────────────────────────────────────────────────────────────────

export const labelsSchema = z.object({
  show: z.boolean().optional(),
  mode: z.enum(['none', 'outside', 'inside', 'legend']).optional(),
  showValues: z.boolean().optional(),
  showPercent: z.boolean().optional(),
  /** Del set local. NUNCA una URL remota (ADR 0005). */
  font: z.enum(['inter', 'display', 'mono']).optional(),
  size: z.number().min(0.5).max(2).optional(),
  color: z.union([hexColor, z.literal('auto')]).optional(),
  title: z
    .object({
      show: z.boolean().optional(),
      position: z.enum(['top', 'bottom']).optional(),
    })
    .optional(),
});

// ── interaction ─────────────────────────────────────────────────────────────

export const interactionSchema = z.object({
  orbit: z.boolean().optional(),
  /* false por defecto: un embed que secuestra la rueda del ratón dentro de una
     página ajena es un embed que la gente quita. */
  zoom: z.boolean().optional(),
  tooltip: z.boolean().optional(),
  clickAction: z.enum(['none', 'isolate', 'link']).optional(),
  links: z.array(z.string().url().nullable()).max(200).optional(),
});

// ── layout ──────────────────────────────────────────────────────────────────

export const layoutSchema = z.object({
  aspect: z.enum(['16:9', '4:3', '1:1', 'auto']).optional(),
  padding: unit.optional(),
  fit: z.enum(['contain', 'cover']).optional(),
  /* Lo decide el SERVIDOR al servir la config, no el cliente: si lo decidiera
     el cliente sería trivial quitarlo (ADR 0005). */
  watermark: z.boolean().optional(),
});

// ── ChartConfig ─────────────────────────────────────────────────────────────

export const chartConfigSchema = z.object({
  v: z.literal(CURRENT_VERSION),
  type: z.enum(['donut', 'pie', 'bar', 'bar-race', 'globe', 'gauge']),
  title: z.string().max(200).optional(),
  data: dataSchema,
  theme: z.string().max(48).optional(),
  style: styleSchema.optional(),
  scene: sceneSchema.optional(),
  camera: cameraSchema.optional(),
  motion: motionSchema.optional(),
  labels: labelsSchema.optional(),
  interaction: interactionSchema.optional(),
  layout: layoutSchema.optional(),
});

export type ChartConfig = z.infer<typeof chartConfigSchema>;
export type ChartType = ChartConfig['type'];
export type ChartData = z.infer<typeof dataSchema>;
export type ChartStyle = z.infer<typeof styleSchema>;
export type ChartScene = z.infer<typeof sceneSchema>;
export type ChartCamera = z.infer<typeof cameraSchema>;
export type ChartMotion = z.infer<typeof motionSchema>;
export type ChartLabels = z.infer<typeof labelsSchema>;
export type ChartInteraction = z.infer<typeof interactionSchema>;
export type ChartLayout = z.infer<typeof layoutSchema>;
