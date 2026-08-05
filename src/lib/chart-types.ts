import type { ChartConfig, ChartType } from './schema-types';

/*
  Registro de tipos de gráfica. Fuente de verdad para la galería y el selector.

  `status` es honesto a propósito: si algo no está, la tarjeta lo dice. Una
  galería que promete tipos que no existen es la forma más rápida de perder a
  alguien en los primeros treinta segundos.
*/

export type ChartTypeStatus = 'listo' | 'en-camino';

export type ChartTypeEntry = {
  id: ChartType | string;
  name: string;
  /** Qué pregunta responde. En términos del usuario, no del sistema. */
  answers: string;
  /** Cuándo NO usarlo. Genera más confianza que la lista de ventajas. */
  avoid: string;
  status: ChartTypeStatus;
  /** Config de muestra para la miniatura en vivo. */
  sample?: ChartConfig;
};

const sampleData = (labels: string[], values: number[]) => ({
  labels,
  series: [{ values }],
});

export const CHART_TYPES: ChartTypeEntry[] = [
  {
    id: 'donut',
    name: 'Anillo',
    answers: '¿Cómo se reparte un total entre unas pocas categorías?',
    avoid: 'Con más de siete categorías. El ojo deja de comparar sectores.',
    status: 'listo',
    sample: {
      v: 1,
      type: 'donut',
      data: sampleData(['Suscripciones', 'Servicios', 'Licencias'], [52, 31, 17]),
    },
  },
  {
    id: 'pie',
    name: 'Tarta',
    answers: 'Lo mismo que el anillo, cuando quieres el peso visual del disco.',
    avoid: 'Si necesitas poner una cifra en el centro. Para eso, anillo.',
    status: 'listo',
    sample: {
      v: 1,
      type: 'pie',
      data: sampleData(['Móvil', 'Escritorio', 'Tablet'], [61, 30, 9]),
      style: { innerRadius: 0 },
    },
  },
  {
    id: 'gauge',
    name: 'Medidor',
    answers: '¿Cuánto llevo de lo que me había propuesto?',
    avoid: 'Para comparar categorías entre sí. Un medidor enseña una sola cifra.',
    status: 'listo',
    sample: {
      v: 1,
      type: 'gauge',
      data: {
        labels: ['Objetivo del trimestre'],
        series: [{ values: [68] }],
        format: { unit: '%' },
      },
    },
  },
  {
    id: 'bar',
    name: 'Barras',
    answers: '¿Cuánto tiene cada categoría, y cuál gana?',
    avoid: 'Para partes de un total. Ahí la comparación es contra el todo.',
    status: 'listo',
    sample: {
      v: 1,
      type: 'bar',
      data: sampleData(['Ene', 'Feb', 'Mar', 'Abr', 'May'], [42, 26, 34, 19, 48]),
    },
  },
  {
    id: 'bar-race',
    name: 'Barras animadas',
    answers: '¿Cómo cambió el ranking a lo largo del tiempo?',
    avoid: 'Si el orden no cambia. Entonces es una barra normal con ruido.',
    status: 'listo',
    sample: {
      v: 1,
      type: 'bar-race',
      data: {
        labels: ['Chrome', 'Safari', 'Edge', 'Firefox'],
        /* Cada serie es un periodo: su `name` es la etiqueta que se muestra.
           Ver la cabecera de renderer/geometry/bar-race.ts. */
        series: [
          { name: '2021', values: [63, 19, 4, 8] },
          { name: '2022', values: [65, 19, 5, 6] },
          { name: '2023', values: [64, 20, 11, 5] },
          { name: '2024', values: [66, 18, 13, 4] },
        ],
      },
      motion: { frameDuration: 1200 },
    },
  },
  {
    id: 'globe',
    name: 'Globo',
    answers: '¿Dónde está pasando, geográficamente?',
    avoid: 'Para comparar cifras con precisión. Media esfera está de espaldas.',
    status: 'listo',
    sample: {
      v: 1,
      type: 'globe',
      data: {
        labels: ['Madrid', 'Londres', 'Nueva York', 'Tokio', 'São Paulo', 'Sídney'],
        series: [{ values: [38, 52, 71, 44, 29, 22] }],
        coords: [
          [40.4, -3.7],
          [51.5, -0.1],
          [40.7, -74.0],
          [35.7, 139.7],
          [-23.5, -46.6],
          [-33.9, 151.2],
        ],
      },
    },
  },
];

export const AVAILABLE_TYPES = CHART_TYPES.filter((t) => t.status === 'listo');
