'use client';

import { createBrowserClient } from '@supabase/ssr';
import { supabaseEnv } from './env';

/*
  Cliente de navegador. Solo para lo que TIENE que pasar en el navegador:
  arrancar el login y cerrar sesión.

  Todo lo demás —guardar, listar, borrar— va por server actions. No es
  ceremonia: así el `owner_id` lo pone el servidor a partir de la sesión y no
  llega nunca desde un formulario. RLS lo rechazaría igualmente, pero el mejor
  sitio para no cometer un error es aquel donde no se puede cometer.
*/

let cliente: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Uno solo para toda la pestaña.
 *
 * Cada cliente abre su propio canal de refresco de token y su propio listener de
 * `onAuthStateChange`. Crear uno por componente acaba en varias pestañas del
 * mismo navegador peleándose por refrescar el mismo token.
 */
export function supabaseBrowser() {
  if (!cliente) {
    const { url, anonKey } = supabaseEnv();
    cliente = createBrowserClient(url, anonKey);
  }
  return cliente;
}
