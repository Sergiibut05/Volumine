/*
  Re-export de los tipos del contrato, para que módulos de datos como
  `chart-types.ts` no arrastren Zod al importarlos.
*/
export type { ChartConfig, ChartType, ChartStyle, ChartScene } from './config/schema';
