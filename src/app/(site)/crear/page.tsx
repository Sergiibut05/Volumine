import type { Metadata } from 'next';
import { Editor } from './Editor';
import { initialConfig } from '@/lib/config/initial';
import { chartById, currentUser } from '@/lib/charts/queries';
import { chartConfigSchema, type ChartConfig } from '@/lib/config/schema';
import { getDictionary } from '@/lib/i18n/server';
import type { Visibility } from '@/lib/supabase/types';

/*
  La ruta del editor.

  Es un componente de SERVIDOR y el editor de verdad es `Editor.tsx`, de
  cliente. La razón de partirlo así es `?id=`: cargar una gráfica guardada
  requiere sesión y base de datos, y hacerlo desde el cliente significaría
  pintar el ejemplo primero y sustituirlo un segundo después. Resuelto aquí, lo
  primero que se ve ya es lo tuyo.

  Sin `?id=` esto no toca la base de datos para nada: el editor sigue siendo
  usable sin cuenta, que es la premisa del producto.
*/

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getDictionary();
  return { title: d.meta.editor };
}

export default async function CrearPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const [user, { locale }] = await Promise.all([currentUser(), getDictionary()]);

  let initial: ChartConfig = initialConfig(locale);
  let chartId: string | null = null;
  let visibility: Visibility | null = null;

  if (id) {
    const row = await chartById(id);

    /* Se revalida con Zod lo que sale de la base de datos. Está guardado por
       nosotros, sí, pero puede llevar meses ahí y el contrato tiene versiones:
       una config vieja tiene que migrarse o descartarse, no reventar el editor.

       Si no valida se cae al ejemplo en vez de dar error: quedarse sin editor
       por una fila mala es peor que empezar de cero. */
    const parsed = row ? chartConfigSchema.safeParse(row.config) : null;

    if (row && parsed?.success) {
      initial = parsed.data;
      chartId = row.id;
      visibility = row.visibility;
    }
  }

  return (
    <Editor
      initial={initial}
      chartId={chartId}
      visibility={visibility}
      signedIn={Boolean(user)}
      userId={user?.id ?? null}
    />
  );
}
