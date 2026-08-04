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
    id: 'bar',
    name: 'Barras',
    answers: '¿Cuánto tiene cada categoría, y cuál gana?',
    avoid: 'Para partes de un total. Ahí la comparación es contra el todo.',
    status: 'en-camino',
  },
  {
    id: 'bar-race',
    name: 'Barras animadas',
    answers: '¿Cómo cambió el ranking a lo largo del tiempo?',
    avoid: 'Si el orden no cambia. Entonces es una barra normal con ruido.',
    status: 'en-camino',
  },
  {
    id: 'globe',
    name: 'Globo',
    answers: '¿Dónde está pasando, geográficamente?',
    avoid: 'Si tus datos no son geográficos. Un mapa no es un adorno.',
    status: 'en-camino',
  },
];

export const AVAILABLE_TYPES = CHART_TYPES.filter((t) => t.status === 'listo');
