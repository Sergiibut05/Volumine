import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import '@/styles/auth.css';
import { LoginForm } from './LoginForm';
import { currentUser } from '@/lib/charts/queries';
import { supabaseConfigured } from '@/lib/supabase/env';
import { getDictionary } from '@/lib/i18n/server';
import type { Dictionary } from '@/lib/i18n/dictionaries';

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getDictionary();
  return {
    title: d.meta.signIn,
    // Una pantalla de acceso no pinta nada en un buscador.
    robots: { index: false, follow: false },
  };
}

/* Por qué te han devuelto aquí. Lo escribe el callback de auth en `?error=`,
   así que las CLAVES son parte de una URL y no se traducen; lo que se traduce
   es lo que se lee. */
const motivo = (clave: string, d: Dictionary): string | undefined =>
  ({ 'sin-codigo': d.auth.errNoCode, 'link-caducado': d.auth.errExpired })[clave];

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const { d } = await getDictionary();

  /*
    Si Supabase no está configurado, esta pantalla no puede hacer nada. Se dice,
    en vez de enseñar unos botones que no van a funcionar: el editor y el embed
    por URL siguen andando sin base de datos, y eso hay que dejarlo claro.
  */
  if (!supabaseConfigured()) {
    return (
      <div className="auth-page" data-theme="light">
        <div className="auth-card">
          <h1 className="display">{d.auth.noAccounts}</h1>
          <p>{d.auth.noAccountsBody}</p>
          <Link className="cta" href="/crear">
            {d.auth.goToEditor}
          </Link>
        </div>
      </div>
    );
  }

  // Ya dentro: no tiene sentido enseñar el formulario.
  if (await currentUser()) redirect(next ?? '/mis-graficas');

  return (
    <div className="auth-page" data-theme="light">
      {error && motivo(error, d) && (
        <p className="auth-error" role="alert">
          {motivo(error, d)}
        </p>
      )}
      {/* `next` se sanea otra vez en el callback: aquí solo se transporta, y lo
          que llega en una query lo escribe quien quiera. */}
      <LoginForm next={next ?? '/mis-graficas'} />
      <Link className="auth-back" href="/">
        {d.common.back}
      </Link>
    </div>
  );
}
