'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useI18n } from '@/lib/i18n/client';
import type { Dictionary } from '@/lib/i18n/dictionaries';

/*
  ══════════════════════════════════════════════════════════════════════════
  GOOGLE, O CORREO Y CONTRASEÑA
  ══════════════════════════════════════════════════════════════════════════

  Antes esto era un enlace mágico, y la razón para quitarlo no es de gusto: el
  enlace mágico convierte CADA inicio de sesión en un correo que tiene que
  llegar. Si tarda, se pierde o cae en spam, no hay reintento posible —quien no
  entra, se va— y el remitente pasa a ser el punto más frágil de todo el
  producto.

  Con Google no se manda ningún correo. Con contraseña, solo dos: el de confirmar
  la dirección al registrarse y el de recuperarla si se olvida. Se pasa de un
  correo POR SESIÓN a un par por CUENTA, y eso cambia por completo lo que hay
  que exigirle al servicio de envío.

  La contraseña sigue teniendo el coste que tenía —hay que poder recuperarla y
  hay que responder de un hash—, pero deja de ser la vía principal. Está para
  quien no tenga cuenta de Google, que en empresas con Microsoft es más gente de
  la que parece.
*/

/**
 * Traduce el fallo de auth a algo accionable.
 *
 * Un mensaje que acusa a la entrada equivocada es peor que uno genérico: te hace
 * perder el tiempo comprobando algo que estaba bien. Por eso unas credenciales
 * malas dicen «revisa los dos» y no «la contraseña es incorrecta» — ese segundo
 * mensaje, además, le confirma a quien va probando direcciones cuáles tienen
 * cuenta.
 */
function explicar(
  error: { message: string; status?: number; code?: string },
  d: Dictionary,
): string {
  const m = error.message.toLowerCase();

  if (
    error.status === 429 ||
    error.code === 'over_email_send_rate_limit' ||
    /rate limit/i.test(m)
  ) {
    return d.auth.errRate;
  }
  if (error.code === 'invalid_credentials' || m.includes('invalid login')) {
    return d.auth.errCredentials;
  }
  if (error.code === 'email_not_confirmed' || m.includes('not confirmed')) {
    return d.auth.errUnconfirmed;
  }
  if (m.includes('password') && (m.includes('short') || m.includes('least'))) {
    return d.auth.errWeak;
  }
  if (m.includes('email')) return d.auth.errInvalid;
  return d.auth.errGeneric;
}

/** Mínimo propio, por delante del de Supabase. Ver el comentario en `enviar`. */
const MIN_CLAVE = 8;

type Estado =
  | { fase: 'reposo' }
  | { fase: 'enviando' }
  | { fase: 'confirmar'; email: string }
  | { fase: 'recuperado' }
  | { fase: 'error'; mensaje: string };

/** Qué está haciendo el formulario. La contraseña solo sale en las dos primeras. */
type Modo = 'entrar' | 'registro' | 'recuperar';

export function LoginForm({ next }: { next: string }) {
  const { d } = useI18n();
  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
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

  const cambiarModo = (siguiente: Modo) => {
    setModo(siguiente);
    setEstado({ fase: 'reposo' });
  };

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault();

    /*
      El mínimo se comprueba AQUÍ ADEMÁS de en el servidor, y no por desconfiar
      del servidor: enterarte de que la contraseña es corta después de un viaje
      de ida y vuelta —y con la que escribiste ya guardada por el gestor de
      contraseñas— es la peor forma de enterarse. El de Supabase sigue mandando;
      este solo evita el viaje.
    */
    if (modo !== 'recuperar' && clave.length < MIN_CLAVE) {
      setEstado({ fase: 'error', mensaje: d.auth.errWeak });
      return;
    }

    setEstado({ fase: 'enviando' });
    const auth = supabaseBrowser().auth;

    if (modo === 'recuperar') {
      const { error } = await auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/entrar/nueva-clave`,
      });
      /* Se responde lo mismo haya cuenta o no: decir «esa dirección no existe»
         convertiría el formulario en un comprobador de quién está registrado. */
      setEstado(
        error && error.status === 429
          ? { fase: 'error', mensaje: d.auth.errRate }
          : { fase: 'recuperado' },
      );
      return;
    }

    if (modo === 'registro') {
      const { data, error } = await auth.signUp({
        email,
        password: clave,
        options: { emailRedirectTo: redirectTo() },
      });
      if (error) {
        setEstado({ fase: 'error', mensaje: explicar(error, d) });
        return;
      }
      /* Con la confirmación de correo activada, Supabase devuelve el usuario sin
         sesión y hay que pasar por el buzón. Si estuviera desactivada vendría
         sesión y se entra directo, así que se mira el dato en vez de suponerlo. */
      if (data.session) {
        window.location.assign(next);
        return;
      }
      setEstado({ fase: 'confirmar', email });
      return;
    }

    const { error } = await auth.signInWithPassword({ email, password: clave });
    if (error) {
      setEstado({ fase: 'error', mensaje: explicar(error, d) });
      return;
    }
    window.location.assign(next);
  };

  /*
    Mandado el correo, la pantalla cambia del todo.

    Dejar el formulario ahí invita a darle otra vez, y cada envío invalida el
    enlace anterior: quien pulse dos veces y abra el primer correo se encuentra
    con que no funciona. La forma de que no pase es que no haya botón.
  */
  if (estado.fase === 'confirmar') {
    return (
      <div className="auth-card">
        <h1 className="display">{d.auth.confirmTitle}</h1>
        {/* Se parte la frase POR EL PROPIO MARCADOR y se mete el correo en
            negrita en el hueco. Así cada idioma coloca la dirección donde le
            corresponda —al final en inglés, en medio en español— y sigue
            pudiendo resaltarla. Concatenar trozos sueltos haría la frase
            intraducible: el orden de las palabras no es el mismo en los dos. */}
        <p>
          {d.auth.confirmBody
            .split('{email}')
            .flatMap((trozo, i) =>
              i === 0 ? [trozo] : [<b key="email">{estado.email}</b>, trozo],
            )}
        </p>
        <p className="auth-note">{d.auth.checkNote}</p>
      </div>
    );
  }

  if (estado.fase === 'recuperado') {
    return (
      <div className="auth-card">
        <h1 className="display">{d.auth.forgotTitle}</h1>
        <p>{d.auth.forgotSent}</p>
      </div>
    );
  }

  const ocupado = estado.fase === 'enviando';
  const recuperando = modo === 'recuperar';

  return (
    <div className="auth-card">
      <h1 className="display">{recuperando ? d.auth.forgotTitle : d.auth.title}</h1>
      <p>{recuperando ? d.auth.forgotBody : d.auth.subtitle}</p>

      {/* Google primero y sin separarlo en una pestaña: es la vía por la que va
          a entrar la mayoría y no debería costar un clic de más encontrarla.
          Al recuperar la contraseña no pinta nada — quien llega ahí ya eligió
          entrar con correo. */}
      {!recuperando && (
        <>
          <button
            type="button"
            className="auth-google"
            onClick={conGoogle}
            disabled={ocupado}
          >
            {/* El logo va en línea. Pedírselo al CDN de Google sería una petición
                a un tercero en la primera pantalla de la sesión. */}
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
        </>
      )}

      <form onSubmit={enviar}>
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

        {!recuperando && (
          <label className="auth-field">
            <span>{d.auth.passwordLabel}</span>
            <input
              type="password"
              required
              minLength={MIN_CLAVE}
              /*
                `current-password` al entrar y `new-password` al registrarse. No
                es cosmético: es lo que hace que el gestor de contraseñas ofrezca
                rellenar en un caso y generar una nueva en el otro. Con el valor
                equivocado, en el registro propone la contraseña vieja.
              */
              autoComplete={modo === 'registro' ? 'new-password' : 'current-password'}
              placeholder={d.auth.passwordPlaceholder}
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              disabled={ocupado}
            />
          </label>
        )}

        <button
          type="submit"
          className="cta auth-submit"
          disabled={ocupado || !email || (!recuperando && !clave)}
        >
          {ocupado
            ? d.auth.sending
            : recuperando
              ? d.auth.forgotSend
              : modo === 'registro'
                ? d.auth.signUp
                : d.auth.signIn}
        </button>
      </form>

      {estado.fase === 'error' && (
        <p className="auth-error" role="alert">
          {estado.mensaje}
        </p>
      )}

      <div className="auth-alt">
        {recuperando ? (
          <button type="button" onClick={() => cambiarModo('entrar')}>
            {d.auth.backToSignIn}
          </button>
        ) : (
          <>
            <span>
              {modo === 'registro' ? d.auth.haveAccount : d.auth.noAccountYet}{' '}
              <button
                type="button"
                onClick={() => cambiarModo(modo === 'registro' ? 'entrar' : 'registro')}
              >
                {modo === 'registro' ? d.auth.signIn : d.auth.signUp}
              </button>
            </span>
            {modo === 'entrar' && (
              <button type="button" onClick={() => cambiarModo('recuperar')}>
                {d.auth.forgot}
              </button>
            )}
          </>
        )}
      </div>

      <p className="auth-note">{d.auth.note}</p>
    </div>
  );
}
