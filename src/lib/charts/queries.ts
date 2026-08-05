import 'server-only';
import { supabaseAnonymous, supabaseServer } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/supabase/env';
import {
  CHART_SUMMARY_COLUMNS,
  type ChartRow,
  type ChartSummary,
  type PlanLimitRow,
  type ProfileRow,
} from '@/lib/supabase/types';

/*
  Lecturas. Todas pasan por RLS: aquí no hay ninguna comprobación de permisos
  escrita a mano, y eso es a propósito.

  Si el permiso se comprobara aquí, habría DOS reglas —la de Postgres y la de
  este archivo— y tarde o temprano dirían cosas distintas. Postgres es la que
  no se puede saltar, así que es la única que hay.

  `server-only`: importar esto desde un componente de cliente rompe el build en
  vez de filtrar consultas al navegador.
*/

/** La gráfica de un slug, para el EMBED. Anónima, sin cookies (ADR 0005). */
export async function chartForEmbed(slug: string): Promise<ChartRow | null> {
  if (!supabaseConfigured()) return null;

  const supabase = supabaseAnonymous();
  const { data } = await supabase
    .from('charts')
    .select('*')
    .eq('slug', slug)
    /* `visibility` se filtra aquí ADEMÁS de en RLS. No es redundancia inútil:
       sin esto, el dueño con sesión iniciada vería su gráfica privada en el
       embed y creería que funciona para todo el mundo. El filtro explícito hace
       que el embed se vea igual para todos, que es lo que se está probando
       cuando alguien abre el link de su propia gráfica. */
    .eq('visibility', 'public')
    .maybeSingle<ChartRow>();

  return data ?? null;
}

/** Las gráficas del usuario que hay en sesión. Lista vacía si no hay sesión. */
export async function myCharts(): Promise<ChartSummary[]> {
  if (!supabaseConfigured()) return [];

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('charts')
    .select(CHART_SUMMARY_COLUMNS)
    .order('updated_at', { ascending: false })
    .returns<ChartSummary[]>();

  return data ?? [];
}

/** Una gráfica para EDITARLA. Solo sale si es tuya o es pública. */
export async function chartById(id: string): Promise<ChartRow | null> {
  if (!supabaseConfigured()) return null;

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('charts')
    .select('*')
    .eq('id', id)
    .maybeSingle<ChartRow>();

  return data ?? null;
}

/** Quién eres. `null` si no hay sesión. */
export async function currentUser() {
  if (!supabaseConfigured()) return null;

  const supabase = await supabaseServer();
  /* `getUser()` valida el token contra el servidor de auth. `getSession()` se
     cree la cookie sin comprobarla, y de una cookie no nos fiamos. */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export type Allowance = {
  used: number;
  max: number;
  plan: ProfileRow['plan'];
  /** Ya no caben más. El trigger de cuota lo rechazaría igualmente. */
  full: boolean;
};

/**
 * Cuántas gráficas llevas y cuántas te deja tu plan.
 *
 * Es para PODER DECIRLO antes de que falle, no para decidir. Quien decide es el
 * trigger `comprobar_cuota` de la migración: enterarse al pulsar guardar es
 * peor que verlo venir, pero enterarse solo aquí sería una cuota de mentira.
 */
export async function allowance(): Promise<Allowance | null> {
  if (!supabaseConfigured()) return null;

  const supabase = await supabaseServer();

  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from('profiles').select('plan').maybeSingle<Pick<ProfileRow, 'plan'>>(),
    supabase.from('charts').select('id', { count: 'exact', head: true }),
  ]);

  if (!profile) return null;

  const { data: limit } = await supabase
    .from('plan_limits')
    .select('max_charts')
    .eq('plan', profile.plan)
    .maybeSingle<Pick<PlanLimitRow, 'max_charts'>>();

  const max = limit?.max_charts ?? 0;
  const used = count ?? 0;

  return { used, max, plan: profile.plan, full: used >= max };
}
