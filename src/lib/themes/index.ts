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

/*
  El NOMBRE y el para-qué-sirve NO viven aquí: son texto de interfaz y están en
  `src/lib/i18n/dictionaries.ts`, en `themes`, con el id como clave.

  El `id`, en cambio, se queda: viaja DENTRO de las configs publicadas, así que
  cambiarlo rompería links que ya existen. Por eso `estudio` sigue llamándose
  `estudio` aunque en inglés se lea «Studio».

  De paso, este módulo entra en el bundle del embed —`applyTheme` resuelve la
  config— y ahora entra sin una sola frase de copia.
*/
export type Theme = {
  id: string;
  /** Muestra para la tarjeta, sin tener que renderizar en 3D. */
  swatch: string[];
  config: Partial<ChartConfig>;
};

export const THEMES: Theme[] = [
  {
    id: 'aurora',
    swatch: ['#7c5cff', '#00d4ff', '#41ffc9', '#ffd166', '#ff4d6d'],
    config: {
      style: {
        palette: ['#7c5cff', '#00d4ff', '#41ffc9', '#ffd166', '#ff4d6d'],
        globe: { base: '#111634', land: '#8b7dff', glow: '#5b3ce6' },
        material: 'physical',
      },
      scene: { environment: 'studio', lightIntensity: 0.55 },
    },
  },
  {
    id: 'estudio',
    swatch: ['#2f2f3a', '#6b6b7c', '#a8a8b8', '#d0d0da', '#ec6a5c'],
    config: {
      style: {
        palette: ['#2f2f3a', '#6b6b7c', '#a8a8b8', '#d0d0da', '#ec6a5c'],
        globe: { base: '#e8e8ee', land: '#4a4a58', glow: '#a8a8b8' },
        material: 'matte',
        roughness: 0.85,
      },
      scene: { environment: 'soft', lightIntensity: 0.7 },
    },
  },
  {
    id: 'brasa',
    swatch: ['#ff6b35', '#f9c22e', '#e63946', '#8a2846', '#3d1420'],
    config: {
      style: {
        palette: ['#ff6b35', '#f9c22e', '#e63946', '#8a2846', '#3d1420'],
        globe: { base: '#2a0f14', land: '#ff8f5e', glow: '#e63946' },
        material: 'physical',
        roughness: 0.25,
      },
      scene: { environment: 'sunset', lightIntensity: 0.6 },
    },
  },
  {
    id: 'metal',
    swatch: ['#c9d1d9', '#8b949e', '#f0b429', '#57606a', '#30363d'],
    config: {
      style: {
        palette: ['#c9d1d9', '#8b949e', '#f0b429', '#57606a', '#30363d'],
        globe: { base: '#1a1d22', land: '#c9d1d9', glow: '#8b949e' },
        material: 'metal',
        metalness: 1,
        roughness: 0.22,
      },
      scene: { environment: 'city', lightIntensity: 0.85 },
    },
  },
  {
    id: 'papel',
    swatch: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'],
    config: {
      style: {
        palette: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'],
        globe: { base: '#f2ede3', land: '#264653', glow: '#2a9d8f' },
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
    swatch: ['#5b3ce6', '#0466c8', '#00a6fb', '#48cae4', '#ade8f4'],
    config: {
      style: {
        palette: ['#5b3ce6', '#0466c8', '#00a6fb', '#48cae4', '#ade8f4'],
        globe: { base: '#080d24', land: '#48cae4', glow: '#0466c8' },
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
