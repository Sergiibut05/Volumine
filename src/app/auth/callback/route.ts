import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/*
  Donde aterrizan Google y el link del correo.

  Los dos caminos traen un `code` de un solo uso que hay que cambiar por una
  sesión. Ese cambio tiene que pasar en el SERVIDOR: es lo que deja el token en
  una cookie `httpOnly`, fuera del alcance de cualquier script de la página.
*/

/** A dónde mandar después. */
const DEFAULT_NEXT = '/mis-graficas';

/**
 * Solo rutas internas.
 *
 * `next` viene de la URL, o sea de quien haya escrito el link. Sin esto, un
 * `?next=https://sitio-malo.example` convierte nuestro dominio en un redirector
 * abierto: el usuario ve nuestro dominio en el correo, pincha, y acaba en otro
 * sitio ya autenticado. Se exige que empiece por una sola barra —`//otro.com`
 * es una URL con protocolo relativo y también saldría fuera—.
 */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return DEFAULT_NEXT;
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(`${origin}/entrar?error=sin-codigo`);
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    /* El caso normal aquí no es un ataque: es un link de correo caducado o ya
       usado. Se vuelve a la pantalla de entrar con el motivo, no a un error. */
    return NextResponse.redirect(`${origin}/entrar?error=link-caducado`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
