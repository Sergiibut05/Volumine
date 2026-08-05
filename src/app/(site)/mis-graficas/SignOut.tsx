'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

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
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const salir = () =>
    startTransition(async () => {
      await supabaseBrowser().auth.signOut();
      router.replace('/');
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
      Salir
    </button>
  );
}
