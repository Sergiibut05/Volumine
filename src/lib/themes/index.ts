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
  /**
   * Sobre qué superficie está pensado el tema.
   *
   * Lo dice ya su descripción en el diccionario —«para incrustar en páginas
   * claras», «funciona sobre fondo oscuro»—, y aquí se escribe para que se
   * pueda usar: decide sobre qué se aplana el póster de una gráfica de fondo
   * transparente, que es lo que acaba en la tarjeta de enlace.
   *
   * Es un campo y no un cálculo a propósito. Ver `lib/charts/backdrop.ts`: el
   * intento de deducirlo del contraste de la paleta le ponía fondo negro justo
   * al tema descrito «para páginas claras».
   */
  surface: 'light' | 'dark';
  /** Muestra para la tarjeta, sin tener que renderizar en 3D. */
  swatch: string[];
  config: Partial<ChartConfig>;
};

export const THEMES: Theme[] = [
  {
    id: 'aurora',
    surface: 'dark',
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
    surface: 'light',
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
    surface: 'dark',
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
    surface: 'dark',
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
    surface: 'light',
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
    surface: 'dark',
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
{
    id: 'menta',
    surface: 'light',
    swatch: ['#2f6f5e', '#4fa88c', '#86c9ae', '#bfe3d2', '#e8a33d'],
    config: {
      style: {
        palette: ['#2f6f5e', '#4fa88c', '#86c9ae', '#bfe3d2', '#e8a33d'],
        globe: { base: '#cfe6dc', land: '#20574a', glow: '#4fa88c' },
        material: 'matte',
        roughness: 0.82,
      },
      scene: { environment: 'soft', lightIntensity: 0.72 },
    },
  },
  {
    id: 'coral',
    surface: 'light',
    swatch: ['#f2705a', '#f79f7e', '#f9c9a8', '#7d5a8c', '#3d3550'],
    config: {
      style: {
        palette: ['#f2705a', '#f79f7e', '#f9c9a8', '#7d5a8c', '#3d3550'],
        globe: { base: '#f7dbcd', land: '#c4472f', glow: '#f2705a' },
        material: 'physical',
        roughness: 0.34,
      },
      scene: { environment: 'studio', lightIntensity: 0.62 },
    },
  },
  {
    id: 'indigo',
    surface: 'light',
    swatch: ['#2b3a8f', '#4c62c9', '#7f92e0', '#b3bff0', '#f0a202'],
    config: {
      style: {
        palette: ['#2b3a8f', '#4c62c9', '#7f92e0', '#b3bff0', '#f0a202'],
        globe: { base: '#d7ddf6', land: '#22307a', glow: '#4c62c9' },
        material: 'physical',
        roughness: 0.3,
      },
      scene: { environment: 'studio', lightIntensity: 0.6 },
    },
  },
  {
    id: 'escala',
    surface: 'light',
    /* UN SOLO TONO, de oscuro a claro. No hay color de acento a propósito: es
       para datos que van de menos a más, donde un color distinto por categoría
       sugiere que son cosas distintas y no lo son. */
    swatch: ['#0d3b66', '#1b5e8f', '#3f88b5', '#79b0d1', '#b8d5e8'],
    config: {
      style: {
        palette: ['#0d3b66', '#1b5e8f', '#3f88b5', '#79b0d1', '#b8d5e8'],
        globe: { base: '#d2e2ef', land: '#0d3b66', glow: '#3f88b5' },
        material: 'matte',
        roughness: 0.86,
      },
      scene: { environment: 'soft', lightIntensity: 0.74 },
    },
  },
  {
    id: 'tierra',
    surface: 'light',
    swatch: ['#8c4a2f', '#c2703d', '#d9a566', '#7d8471', '#3f3a33'],
    config: {
      style: {
        palette: ['#8c4a2f', '#c2703d', '#d9a566', '#7d8471', '#3f3a33'],
        globe: { base: '#ead8c2', land: '#73391f', glow: '#c2703d' },
        material: 'matte',
        roughness: 0.9,
      },
      scene: { environment: 'sunset', lightIntensity: 0.72 },
    },
  },
  {
    id: 'prensa',
    surface: 'light',
    swatch: ['#141414', '#454545', '#767676', '#a8a8a8', '#d7263d'],
    config: {
      style: {
        palette: ['#141414', '#454545', '#767676', '#a8a8a8', '#d7263d'],
        globe: { base: '#ffffff', land: '#141414', glow: '#767676' },
        material: 'toon',
      },
      /* Igual que «papel»: un difuso puro no tiene especular que rellene, así
         que con la luz de los temas brillantes las caras en sombra se van a
         negro. */
      scene: { environment: 'soft', lightIntensity: 1.02 },
    },
  },
  {
    id: 'hielo',
    surface: 'light',
    /* El único tema de VIDRIO. Con muchas categorías se emborrona —lo dice el
       propio material—, así que su paleta va de pocos tonos bien separados. */
    swatch: ['#4bb8dd', '#7fd8f7', '#b9e9f7', '#5a7d9a', '#24405c'],
    config: {
      style: {
        palette: ['#4bb8dd', '#7fd8f7', '#b9e9f7', '#5a7d9a', '#24405c'],
        globe: { base: '#cbe6f2', land: '#1b3149', glow: '#4bb8dd' },
        material: 'glass',
        roughness: 0.12,
      },
      scene: { environment: 'city', lightIntensity: 0.82 },
    },
  },
  {
    id: 'bosque',
    surface: 'dark',
    swatch: ['#40916c', '#74c69d', '#a7dfc2', '#d8f3dc', '#e9c46a'],
    config: {
      style: {
        palette: ['#40916c', '#74c69d', '#a7dfc2', '#d8f3dc', '#e9c46a'],
        globe: { base: '#08160f', land: '#74c69d', glow: '#2d6a4f' },
        material: 'physical',
        roughness: 0.42,
      },
      scene: { environment: 'soft', lightIntensity: 0.58 },
    },
  },
  {
    id: 'neon',
    surface: 'dark',
    swatch: ['#00f5d4', '#00bbf9', '#9b5de5', '#f15bb5', '#fee440'],
    config: {
      style: {
        palette: ['#00f5d4', '#00bbf9', '#9b5de5', '#f15bb5', '#fee440'],
        globe: { base: '#05050f', land: '#00f5d4', glow: '#9b5de5' },
        material: 'physical',
        roughness: 0.16,
      },
      scene: { environment: 'night', lightIntensity: 0.5 },
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
