import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import '@/styles/auth.css';
import { LoginForm } from './LoginForm';
import { currentUser } from '@/lib/charts/queries';
import { supabaseConfigured } from '@/lib/supabase/env';

export const metadata: Metadata = {
  title: 'Entrar · Voluma',
  // Una pantalla de acceso no pinta nada en un buscador.
  robots: { index: false, follow: false },
};

const MOTIVOS: Record<string, string> = {
  'sin-codigo': 'Ese link no traía nada. Pide uno nuevo.',
  'link-caducado': 'Ese link ya no vale: o ha caducado o ya se había usado.',
};

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  /*
    Si Supabase no está configurado, esta pantalla no puede hacer nada. Se dice,
    en vez de enseñar unos botones que no van a funcionar: el editor y el embed
    por URL siguen andando sin base de datos, y eso hay que dejarlo claro.
  */
  if (!supabaseConfigured()) {
    return (
      <div className="auth-page" data-theme="light">
        <div className="auth-card">
          <h1 className="display">Sin cuentas por ahora</h1>
          <p>
            Esta instalación no tiene base de datos configurada, así que no se puede guardar
            nada. El editor funciona igual: la config viaja dentro del link.
          </p>
          <Link className="cta" href="/crear">
            Ir al editor
          </Link>
        </div>
      </div>
    );
  }

  // Ya dentro: no tiene sentido enseñar el formulario.
  if (await currentUser()) redirect(next ?? '/mis-graficas');

  return (
    <div className="auth-page" data-theme="light">
      {error && MOTIVOS[error] && (
        <p className="auth-error" role="alert">
          {MOTIVOS[error]}
        </p>
      )}
      {/* `next` se sanea otra vez en el callback: aquí solo se transporta, y lo
          que llega en una query lo escribe quien quiera. */}
      <LoginForm next={next ?? '/mis-graficas'} />
      <Link className="auth-back" href="/">
        ← Volver
      </Link>
    </div>
  );
}
