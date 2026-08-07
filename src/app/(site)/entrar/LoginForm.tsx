'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useI18n } from '@/lib/i18n/client';
import type { Dictionary } from '@/lib/i18n/dictionaries';

/*
  Dos formas de entrar y ninguna contraseña.

  No es minimalismo: una contraseña más es una contraseña que se reutiliza, que
  hay que recuperar, y que nos obliga a guardar un hash y a responder por él.
  Aquí no aporta nada — no hay nada que proteger que no proteja ya el correo.
*/

/**
 * Traduce el fallo de auth a algo accionable.
 *
 * Antes TODO decía «revisa la dirección», y eso manda a la gente a buscar donde
 * no es: el caso más frecuente con diferencia no es una dirección mal escrita,
 * es la CUOTA DE CORREO. El servicio integrado de Supabase permite un puñado de
 * envíos por hora —es para probar, no para usar— y se agota enseguida mientras
 * desarrollas.
 *
 * Un mensaje de error que acusa a la entrada equivocada es peor que uno
 * genérico: te hace perder el tiempo comprobando algo que estaba bien.
 */
function explicar(
  error: { message: string; status?: number; code?: string },
  d: Dictionary,
): string {
  const limite =
    error.status === 429 ||
    error.code === 'over_email_send_rate_limit' ||
    /rate limit/i.test(error.message);

  if (limite) return d.auth.errRate;
  if (/invalid|email/i.test(error.message)) return d.auth.errInvalid;
  return d.auth.errGeneric;
}

type Estado =
  | { fase: 'reposo' }
  | { fase: 'enviando' }
  | { fase: 'enviado'; email: string }
  | { fase: 'error'; mensaje: string };

export function LoginForm({ next }: { next: string }) {
  const { d } = useI18n();
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<Estado>({ fase: 'reposo' });

  /* A dónde vuelve el usuario. Se construye con `window.location.origin` y no
     con una constante para que funcione igual en local, en la preview de Vercel
     y en producción, que son tres dominios distintos. */
  const redirectTo = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const conGoogle = async () => {
    setEstado({ fase: 'enviando' });
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo() },
    });
    if (error) setEstado({ fase: 'error', mensaje: d.auth.errGoogle });
  };

  const conCorreo = async (event: React.FormEvent) => {
    event.preventDefault();
    setEstado({ fase: 'enviando' });

    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo() },
    });

    setEstado(
      error ? { fase: 'error', mensaje: explicar(error, d) } : { fase: 'enviado', email },
    );
  };

  /*
    Enviado el correo, la pantalla cambia del todo.

    Dejar el formulario ahí invita a darle otra vez, y cada envío invalida el
    link anterior: quien pulse dos veces y abra el primer correo se encuentra
    con que no funciona. La forma de que no pase es que no haya botón.
  */
  if (estado.fase === 'enviado') {
    return (
      <div className="auth-card">
        <h1 className="display">{d.auth.checkTitle}</h1>
        {/* Se parte la frase POR EL PROPIO MARCADOR y se mete el correo en
            negrita en el hueco. Así cada idioma coloca la dirección donde le
            corresponda —al final en inglés, en medio en español— y sigue
            pudiendo resaltarla. Concatenar trozos sueltos haría la frase
            intraducible: el orden de las palabras no es el mismo en los dos. */}
        <p>
          {d.auth.checkBody
            .split('{email}')
            .flatMap((trozo, i) =>
              i === 0 ? [trozo] : [<b key="email">{estado.email}</b>, trozo],
            )}
        </p>
        <p className="auth-note">{d.auth.checkNote}</p>
      </div>
    );
  }

  const ocupado = estado.fase === 'enviando';

  return (
    <div className="auth-card">
      <h1 className="display">{d.auth.title}</h1>
      <p>{d.auth.subtitle}</p>

      <button type="button" className="auth-google" onClick={conGoogle} disabled={ocupado}>
        {/* El logo va en línea. Cargarlo del CDN de Google sería una petición a
            un tercero en la primera pantalla de la sesión. */}
        <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden focusable="false">
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
          />
          <path
            fill="#FBBC05"
            d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.27-3.15.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.88.93 7.54 2.56 10.78l7.97-6.19z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
          />
        </svg>
        {d.auth.withGoogle}
      </button>

      <div className="auth-sep">
        <span>{d.auth.or}</span>
      </div>

      <form onSubmit={conCorreo}>
        <label className="auth-field">
          <span>{d.auth.emailLabel}</span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder={d.auth.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={ocupado}
          />
        </label>
        <button type="submit" className="cta auth-submit" disabled={ocupado || !email}>
          {ocupado ? d.auth.sending : d.auth.sendLink}
        </button>
      </form>

      {estado.fase === 'error' && (
        <p className="auth-error" role="alert">
          {estado.mensaje}
        </p>
      )}

      <p className="auth-note">{d.auth.note}</p>
    </div>
  );
}
