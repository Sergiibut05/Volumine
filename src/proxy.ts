import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/*
  Refresco de sesión.

  Los tokens de Supabase caducan en una hora. Sin esto, un Server Component se
  encuentra un token muerto y te echa a la pantalla de entrar mientras estabas
  editando. El middleware lo renueva y reescribe la cookie en cada petición,
  que es el único sitio de Next donde se puede escribir una cookie con
  seguridad.

  ══════════════════════════════════════════════════════════════════════════
  EL `matcher` DE ABAJO ES PARTE DE LA REGLA 1 DE CLAUDE.md, NO UNA
  OPTIMIZACIÓN. Si `/embed` entra aquí, empieza a llevar cookies y deja de
  cumplir la ADR 0005 — y encima deja de funcionar dentro de un iframe con
  `sandbox`, que es donde vive.
  ══════════════════════════════════════════════════════════════════════════
*/

/* `proxy` y no `middleware`: Next 16 renombró la convención y la antigua está
   obsoleta. Hace exactamente lo mismo; solo cambian el archivo y el nombre. */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sin Supabase configurado no hay sesión que refrescar. El editor y el embed
  // por URL funcionan igual: un clon recién bajado sin `.env` tiene que arrancar.
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  /* `getUser()` y NO `getSession()`. `getSession()` se cree lo que ponga la
     cookie sin comprobarlo contra el servidor de auth, así que una cookie
     manipulada colaría. `getUser()` valida el token. Es una petición de red por
     navegación, y es el precio correcto por no fiarse del cliente. */
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
      Todo MENOS: `/embed` (ver el aviso de arriba), los estáticos y los
      favicon/imágenes. Escrito como exclusión y no como lista de rutas
      protegidas porque una ruta nueva tiene que entrar sola: olvidarse de
      añadirla aquí se nota como sesiones que caducan a la hora, que es un fallo
      difícil de atribuir.
    */
    '/((?!embed|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
