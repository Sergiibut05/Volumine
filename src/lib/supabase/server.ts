import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseEnv } from './env';

/*
  Clientes de servidor. Dos, y la diferencia entre ellos importa.
*/

/**
 * Cliente CON la sesión del usuario, leída de las cookies.
 *
 * Es el que se usa en todo lo que necesita saber quién eres: el listado, guardar,
 * borrar. Lleva la clave anónima, así que RLS decide qué ve —igual que si la
 * petición viniera del navegador—. Que corra en el servidor no le da permisos
 * extra, y eso es lo que se quiere: una sola regla de permisos, la de Postgres.
 */
export async function supabaseServer() {
  const { url, anonKey } = supabaseEnv();
  const store = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          /* Los Server Components no pueden escribir cookies. Da igual: el
             middleware ya refresca la sesión en cada petición, que es el sitio
             donde sí se puede escribir. */
        }
      },
    },
  });
}

/**
 * Cliente ANÓNIMO, sin cookies. El del embed.
 *
 * No es una optimización, es la ADR 0005: el embed no tiene sesión, ni puede
 * tenerla —se carga dentro de un iframe con `sandbox` en la página de otra
 * persona—. Sin cookies aquí, la única fila que puede salir es una con
 * `visibility = 'public'`, y eso lo garantiza Postgres, no este archivo.
 *
 * Si algún día alguien intenta "arreglar" el embed pasándole la sesión, esto es
 * lo que hay que releer antes.
 */
export function supabaseAnonymous() {
  const { url, anonKey } = supabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });
}
