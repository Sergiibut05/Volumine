/*
  La forma de las tablas, escrita a mano.

  Se podría generar con `supabase gen types`, y en cuanto el esquema crezca hará
  falta. Hoy son tres tablas y tenerlas aquí escritas obliga a leer la migración
  al tocarlas, que es exactamente lo que conviene con RLS de por medio.

  Fuente de verdad: supabase/migrations/0001_charts.sql
*/

export type Plan = 'free' | 'pro' | 'team';
export type Visibility = 'private' | 'public';

export type ChartRow = {
  id: string;
  owner_id: string;
  /** Lo que va en la URL del embed. Corto y no adivinable. */
  slug: string;
  title: string | null;
  type: string;
  /** `ChartConfig` sin validar. Pasa por `parseConfig` antes de dibujarse. */
  config: unknown;
  visibility: Visibility;
  /** Lo decide el servidor desde el plan del dueño. Nunca el cliente (ADR 0005). */
  watermark: boolean;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  plan: Plan;
  created_at: string;
};

export type PlanLimitRow = {
  plan: Plan;
  max_charts: number;
  watermark: boolean;
};

/** Lo que se enseña en el listado. Sin `config`, que pesa y no se usa ahí. */
export type ChartSummary = Pick<
  ChartRow,
  'id' | 'slug' | 'title' | 'type' | 'visibility' | 'updated_at'
>;

export const CHART_SUMMARY_COLUMNS = 'id, slug, title, type, visibility, updated_at';
