'use client';

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
 * Y la salida es una recarga completa, no una navegación de cliente: ver la
 * nota de dentro sobre el Router Cache.
 */
export function SignOut() {
  const { d } = useI18n();
  const [pendiente, startTransition] = useTransition();

  const salir = () =>
    startTransition(async () => {
      await supabaseBrowser().auth.signOut();
      /*
        NAVEGACIÓN DURA, no `router.replace()`.

        Con navegación de cliente, Next conserva su Router Cache: `/mis-graficas`
        seguía ahí con el HTML de la sesión anterior. Al entrar con OTRA cuenta y
        volver a esa ruta, se servía la copia cacheada y aparecían las gráficas
        de la cuenta de antes. No es una fuga —la ruta es `force-dynamic` y RLS
        aguanta, era el caché del propio navegador—, pero da exactamente la
        impresión contraria, que en algo que lleva cuentas es igual de grave.

        `router.refresh()` tampoco basta: revalida la ruta ACTUAL, no las demás
        que quedaron en el caché. Una recarga completa lo tira todo, y es lo
        mismo que ya hace el inicio de sesión.

        Al editor y no a la landing: el editor FUNCIONA sin cuenta —es la premisa
        del producto— así que cerrar sesión no puede dejarte fuera de lo único
        que se usa aquí.
      */
      /* Con el origen explícito: `assign` con una ruta relativa la resuelve
         contra la URL actual, y el propio lint de Next lo señala. */
      window.location.href = new URL('/crear', window.location.origin).toString();
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
