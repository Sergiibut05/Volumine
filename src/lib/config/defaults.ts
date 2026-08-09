import type { ChartConfig } from './schema';

/*
  EL único sitio donde vive un valor por defecto.

  Ningún componente puede inventarse el suyo. Si el renderer necesita un valor
  que no está en el config, sale de aquí y de ningún otro lado — es lo que hace
  que "mismo config → mismos píxeles" sea cierto y que los tests visuales y el
  render estático tengan sentido (CLAUDE.md).

  Varios de estos números están medidos, no elegidos. Ver docs/STATE.md.
*/

/** Config con todos los campos resueltos. Es lo que consume el renderer. */
export type ResolvedChartConfig = {
  v: number;
  type: ChartConfig['type'];
  title: string | null;
  data: {
    labels: string[];
    series: {
      name: string | null;
      values: number[];
      colors: (string | null)[];
    }[];
    /** Solo las usa `globe`. `undefined` cuando el config no las trae. */
    coords: [number, number][] | undefined;
    format: {
      unit: string;
      decimals: number;
      locale: string;
      as: 'value' | 'percent';
    };
  };
  style: Omit<Required<NonNullable<ChartConfig['style']>>, 'globe' | 'gauge'> & {
    globe: {
      base: string;
      land: string;
      glow: string;
      density: number;
      dotSize: number;
      markerSize: number;
      marker: 'dot' | 'pin' | 'pulse';
    };
    gauge: {
      max: number;
      sweep: number;
      track: boolean;
      trackColor: string;
    };
  };
  scene: {
    background: Required<NonNullable<NonNullable<ChartConfig['scene']>['background']>>;
    environment: NonNullable<NonNullable<ChartConfig['scene']>['environment']>;
    lightIntensity: number;
    ambient: number;
    fog: number;
    bloom: number;
    vignette: number;
  };
  camera: Required<NonNullable<ChartConfig['camera']>>;
  motion: Required<NonNullable<ChartConfig['motion']>>;
  labels: Omit<Required<NonNullable<ChartConfig['labels']>>, 'title'> & {
    title: { show: boolean; position: 'top' | 'bottom' };
  };
  interaction: Required<NonNullable<ChartConfig['interaction']>>;
  layout: Required<NonNullable<ChartConfig['layout']>>;
};

export const DEFAULT_PALETTE = ['#7c5cff', '#00d4ff', '#41ffc9', '#ffd166', '#ff4d6d'];

export const defaults = {
  style: {
    palette: DEFAULT_PALETTE,
    paletteMode: 'cycle',
    material: 'physical',
    roughness: 0.32,
    metalness: 0.06,
    bevel: 0.6,
    gap: 0.012,
    innerRadius: 0.55,
    height: 0.34,
    explode: 0,
    cornerRadius: 0.2,
    shadow: true,
    shadowAngle: 0,
    globe: {
      /* Azul de noche, no negro: sobre negro puro el planeta desaparece contra
         un fondo oscuro y solo se ven los puntos flotando. */
      base: '#111634',
      land: '#8b7dff',
      glow: '#5b3ce6',
      /* Medido en pantalla: por debajo de ~0,65 de densidad las penínsulas se
         deshacen, y el punto necesita ~0,7 para que los continentes se lean de
         un vistazo en un embed de 400 px de alto, que es el tamaño típico. */
      density: 0.72,
      dotSize: 0.7,
      markerSize: 0.62,
      /* `dot` de default: es el que no cuenta ninguna historia además del dato,
         y el default no debe elegir historia por nadie. */
      marker: 'dot',
    },
    gauge: {
      /* 100 porque el caso abrumadoramente mayoritario es un porcentaje, y así
         quien escriba «94» y no toque nada ve lo que esperaba ver. */
      max: 100,
      /* 270°: deja el hueco abajo, que es donde el ojo espera la base de un
         indicador. Un anillo completo no tiene principio ni fin visibles y se
         lee como un donut de un solo trozo, no como «cuánto llevo». */
      sweep: 270,
      track: true,
      trackColor: 'auto',
    },
  },
  scene: {
    background: {
      kind: 'transparent',
      from: '#0b0b12',
      to: '#1a1030',
      angle: 135,
    },
    environment: 'studio',
    /* Medido: por encima de ~0.7 el IBL blanco lava el color y todo parece
       plastilina pastel. No subas esto sin mirar el resultado. */
    lightIntensity: 0.55,
    ambient: 0.4,
    fog: 0,
    bloom: 0,
    vignette: 0,
  },
  camera: {
    preset: 'hero',
    polar: 62,
    azimuth: -35,
    distance: 1,
    fov: 34,
    orthographic: false,
  },
  motion: {
    angle: 0,
    autoRotate: true,
    speed: 0.9,
    entrance: 'grow',
    entranceDuration: 900,
    hover: 'lift',
    /* No negociable como default (docs/chart-config-schema.md). */
    reducedMotion: 'respect',
  },
  labels: {
    /*
      APAGADAS por defecto, y esto tuvo que cambiar de `true`.

      El contrato declaraba `show: true` desde v1, pero las etiquetas no estaban
      implementadas: el campo no hacía nada y nadie lo notó. Al implementarlas,
      ese `true` habría encendido etiquetas en TODA gráfica que no dijera lo
      contrario — incluidas las de cualquier link ya publicado, que es justo lo
      que la regla 2 del proyecto prohíbe. Y en el editor dejaba el control
      diciendo «Al pasar» mientras la vista previa las enseñaba.

      Un default que nunca se ejecutó no es un compromiso adquirido: es una
      línea que nadie llegó a comprobar. Se corrige antes de que exista el primer
      link publicado, que es ahora.
    */
    show: false,
    mode: 'outside',
    showValues: true,
    showPercent: false,
    /* `system` no descarga nada, y hasta hoy `inter` tampoco: resolvía a la
       pila del sistema. O sea que el cambio de default no mueve un píxel de
       nada de lo ya publicado — solo le pone su nombre verdadero. */
    font: 'system',
    size: 1,
    color: 'auto',
    /* El de siempre. Cambiarlo cambiaría el aspecto de todo link publicado. */
    finish: 'glass',
    /* 1 = exactamente lo que había antes de que estos campos existieran. */
    boxPadding: 1,
    boxRadius: 1,
    title: { show: true, position: 'top' },
  },
  interaction: {
    orbit: true,
    /* false a propósito: no le robamos el scroll a la página anfitriona. */
    zoom: false,
    tooltip: true,
    clickAction: 'none',
    links: [],
  },
  layout: {
    aspect: '16:9',
    padding: 0.1,
    fit: 'contain',
    watermark: true,
  },
  format: {
    unit: '',
    decimals: 0,
    locale: 'es-ES',
    as: 'value',
  },
} as const;

/**
 * Rellena un `ChartConfig` validado con los defaults hasta dejarlo completo.
 *
 * Mezcla superficial por sección a propósito: las secciones son pequeñas y
 * planas, y un deep-merge genérico haría difícil razonar sobre qué gana.
 * La única sección anidada (`scene.background`, `labels.title`) se trata a mano.
 */
export function resolveConfig(config: ChartConfig): ResolvedChartConfig {
  const d = defaults;

  return {
    v: config.v,
    type: config.type,
    title: config.title ?? null,
    data: {
      labels: config.data.labels,
      /* Sin default: "no hay coordenadas" y "coordenadas en (0,0)" son cosas
         distintas, y el golfo de Guinea no es un valor por defecto razonable. */
      coords: config.data.coords,
      series: config.data.series.map((s) => ({
        name: s.name ?? null,
        values: s.values,
        colors: s.colors ?? [],
      })),
      format: { ...d.format, ...config.data.format },
    },
    style: {
      ...d.style,
      ...config.style,
      globe: { ...d.style.globe, ...config.style?.globe },
      gauge: { ...d.style.gauge, ...config.style?.gauge },
    },
    scene: {
      ...d.scene,
      ...config.scene,
      background: { ...d.scene.background, ...config.scene?.background },
    },
    camera: { ...d.camera, ...config.camera },
    motion: { ...d.motion, ...config.motion },
    labels: {
      ...d.labels,
      ...config.labels,
      title: { ...d.labels.title, ...config.labels?.title },
    },
    interaction: { ...d.interaction, ...config.interaction },
    layout: { ...d.layout, ...config.layout },
  } as ResolvedChartConfig;
}
