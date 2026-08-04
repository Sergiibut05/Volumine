import type { ChartConfig } from '../schema-types';

/*
  Temas de gráfica.

  Un tema es paleta + fondo + material + entorno, coherentes entre sí. Rellena
  campos, no los bloquea: cualquier ajuste posterior del usuario gana
  (docs/CUSTOMIZATION.md).

  Regla al añadir uno: **se valida renderizado**, en claro y oscuro, con los
  tipos disponibles. Dos colores que se distinguen bien en un cuadradito pueden
  fundirse bajo luz IBL sobre una superficie curva. Ya pasó.
*/

export type Theme = {
  id: string;
  name: string;
  /** Para qué sirve, en términos de uso, no de estética abstracta. */
  use: string;
  /** Muestra para la tarjeta, sin tener que renderizar en 3D. */
  swatch: string[];
  config: Partial<ChartConfig>;
};

export const THEMES: Theme[] = [
  {
    id: 'aurora',
    name: 'Aurora',
    use: 'El de por defecto. Saturado y frío, funciona sobre fondo oscuro.',
    swatch: ['#7c5cff', '#00d4ff', '#41ffc9', '#ffd166', '#ff4d6d'],
    config: {
      style: {
        palette: ['#7c5cff', '#00d4ff', '#41ffc9', '#ffd166', '#ff4d6d'],
        material: 'physical',
      },
      scene: { environment: 'studio', lightIntensity: 0.55 },
    },
  },
  {
    id: 'estudio',
    name: 'Estudio',
    use: 'Para incrustar en páginas claras. Cuerpo mate, sombra marcada.',
    swatch: ['#2f2f3a', '#6b6b7c', '#a8a8b8', '#d0d0da', '#ec6a5c'],
    config: {
      style: {
        palette: ['#2f2f3a', '#6b6b7c', '#a8a8b8', '#d0d0da', '#ec6a5c'],
        material: 'matte',
        roughness: 0.85,
      },
      scene: { environment: 'soft', lightIntensity: 0.7 },
    },
  },
  {
    id: 'brasa',
    name: 'Brasa',
    use: 'Cálido y con contraste alto. Para una sola cifra que tiene que doler.',
    swatch: ['#ff6b35', '#f9c22e', '#e63946', '#8a2846', '#3d1420'],
    config: {
      style: {
        palette: ['#ff6b35', '#f9c22e', '#e63946', '#8a2846', '#3d1420'],
        material: 'physical',
        roughness: 0.25,
      },
      scene: { environment: 'sunset', lightIntensity: 0.6 },
    },
  },
  {
    id: 'metal',
    name: 'Metal',
    use: 'Superficie metálica. Se ve caro y pierde detalle: pocas categorías.',
    swatch: ['#c9d1d9', '#8b949e', '#f0b429', '#57606a', '#30363d'],
    config: {
      style: {
        palette: ['#c9d1d9', '#8b949e', '#f0b429', '#57606a', '#30363d'],
        material: 'metal',
        metalness: 1,
        roughness: 0.22,
      },
      scene: { environment: 'city', lightIntensity: 0.85 },
    },
  },
  {
    id: 'papel',
    name: 'Papel',
    use: 'Plano y sin brillos. Cuando la gráfica acompaña a un texto largo.',
    swatch: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'],
    config: {
      style: {
        palette: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'],
        material: 'toon',
        shadow: false,
      },
      /* Más luz que el resto de temas a propósito: un difuso puro no tiene
         especular que rellene, así que con la intensidad de los temas brillantes
         las paredes en sombra se van a negro. */
      scene: { environment: 'soft', lightIntensity: 1.05 },
    },
  },
  {
    id: 'nocturno',
    name: 'Nocturno',
    use: 'Luz baja y colores profundos. Para fondos casi negros.',
    swatch: ['#5b3ce6', '#0466c8', '#00a6fb', '#48cae4', '#ade8f4'],
    config: {
      style: {
        palette: ['#5b3ce6', '#0466c8', '#00a6fb', '#48cae4', '#ade8f4'],
        material: 'physical',
        roughness: 0.2,
      },
      scene: { environment: 'night', lightIntensity: 0.45 },
    },
  },
];

export function themeById(id: string | undefined): Theme | undefined {
  return THEMES.find((t) => t.id === id);
}

/**
 * Aplica un tema sobre un config. El tema **rellena**: lo que el usuario haya
 * tocado explícitamente gana. Por eso el config guarda `theme` más los
 * overrides, y no el resultado aplanado — así, si mejoramos un tema, las
 * gráficas publicadas mejoran solas.
 */
export function applyTheme(config: ChartConfig, themeId: string): ChartConfig {
  const theme = themeById(themeId);
  if (!theme) return config;

  return {
    ...config,
    theme: themeId,
    style: { ...theme.config.style, ...config.style },
    scene: { ...theme.config.scene, ...config.scene },
  };
}
