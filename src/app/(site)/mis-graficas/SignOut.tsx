'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useI18n } from '@/lib/i18n/client';

/**
 * Cerrar sesión.
 *
 * En el navegador y no en una server action: `signOut()` tiene que limpiar
 * también lo que el cliente guarda en memoria y cortar el refresco automático
 * del token. Borrar solo la cookie desde el servidor dejaría al cliente de esta
 * pestaña intentando refrescar una sesión que ya no existe.
 *
 * `router.refresh()` después, para que los Server Components vuelvan a
 * renderizar ya sin usuario en vez de quedarse con lo de antes.
 */
export function SignOut() {
  const { d } = useI18n();
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const salir = () =>
    startTransition(async () => {
      await supabaseBrowser().auth.signOut();
      /* Al editor y no a la landing: el editor FUNCIONA sin cuenta —es la
         premisa del producto— así que cerrar sesión no puede dejarte fuera de
         lo único que se usa aquí. Mandar a la landing daba la sensación de
         haber sido expulsado, sin puerta de vuelta a la vista. */
      router.replace('/crear');
      router.refresh();
    });

  return (
    <button
      type="button"
      onClick={salir}
      disabled={pendiente}
      style={{
        border: 0,
        background: 'none',
        color: 'var(--ink-faint)',
        font: 'inherit',
        fontSize: '0.875rem',
        cursor: 'pointer',
      }}
    >
      {/* «Salir» no decía qué se salía de dónde: leído en una barra, suena a
          «volver». Cerrar sesión es una acción con consecuencias —pierdes
          acceso a tus gráficas hasta volver a entrar— y tiene que nombrarse. */}
      {pendiente ? d.nav.signingOut : d.nav.signOut}
    </button>
  );
}
