import type { ChartConfig, ChartType } from './schema-types';
import type { Locale } from './i18n/dictionaries';
import { samplesFor } from './i18n/samples';

/*
  Registro de tipos de gráfica. Fuente de verdad para la galería y el selector.

  `status` es honesto a propósito: si algo no está, la tarjeta lo dice. Una
  galería que promete tipos que no existen es la forma más rápida de perder a
  alguien en los primeros treinta segundos.
*/

export type ChartTypeStatus = 'listo' | 'en-camino';

/*
  El NOMBRE, la pregunta que responde y el cuándo-no-usarlo NO viven aquí: son
  texto de interfaz y están en `src/lib/i18n/dictionaries.ts`, en `types`, con
  el id como clave. Aquí solo queda lo que no depende del idioma — qué existe,
  qué está listo y con qué cifras se enseña.
*/
export type ChartTypeEntry = {
  id: ChartType;
  status: ChartTypeStatus;
  /** Config de muestra para la miniatura en vivo. */
  sample?: ChartConfig;
  /**
   * Ocupa dos columnas en la galería. Los tipos que cuentan una evolución son
   * anchos por naturaleza —el tiempo va de izquierda a derecha—, y con siete
   * tipos dos tarjetas dobles llenan la rejilla de tres sin dejar una huérfana.
   */
  wide?: boolean;
};

const sampleData = (labels: string[], values: number[]) => ({
  labels,
  series: [{ values }],
});

/**
 * Los tipos, con sus ejemplos en el idioma de quien mira.
 *
 * Es una FUNCIÓN y no una constante porque las etiquetas de muestra cambian con
 * el idioma, y una constante de módulo se evalúa una sola vez —al importar—
 * cuando todavía no se sabe quién va a mirar. Las cifras, las coordenadas y los
 * periodos de la carrera no dependen del idioma y se quedan escritos aquí.
 */
export function chartTypes(locale: Locale): ChartTypeEntry[] {
  const m = samplesFor(locale);

  return [
    {
      id: 'donut',
      status: 'listo',
      sample: { v: 1, type: 'donut', data: sampleData(m.donut, [52, 31, 17]) },
    },
    {
      id: 'pie',
      status: 'listo',
      sample: {
        v: 1,
        type: 'pie',
        data: sampleData(m.pie, [61, 30, 9]),
        style: { innerRadius: 0 },
      },
    },
    {
      id: 'gauge',
      status: 'listo',
      sample: {
        v: 1,
        type: 'gauge',
        data: { labels: m.gauge, series: [{ values: [68] }], format: { unit: '%' } },
      },
    },
    {
      id: 'bar',
      status: 'listo',
      sample: { v: 1, type: 'bar', data: sampleData(m.bar, [42, 26, 34, 19, 48]) },
    },
    {
      id: 'area',
      status: 'listo',
      wide: true,
      /* Ocho meses con una caída y una recuperación: una línea recta no
         enseñaría para qué sirve la forma. */
      sample: {
        v: 1,
        type: 'area',
        data: sampleData(m.area, [32, 41, 38, 52, 47, 61, 58, 72]),
      },
    },
    {
      id: 'bar-race',
      status: 'listo',
      wide: true,
      sample: {
        v: 1,
        type: 'bar-race',
        data: {
          /* Nombres de navegador y años: iguales en los dos idiomas, así que no
             pasan por el diccionario. */
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
      status: 'listo',
      sample: {
        v: 1,
        type: 'globe',
        data: {
          labels: m.globe,
          series: [{ values: [38, 52, 71, 44, 29, 22] }],
          /* En el mismo orden que `m.globe`. Si se toca una lista, la otra
             también: una ciudad con las coordenadas de otra no da error, da un
             punto en mitad del mar. */
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
}
