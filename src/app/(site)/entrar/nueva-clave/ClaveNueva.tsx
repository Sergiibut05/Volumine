'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useI18n } from '@/lib/i18n/client';

/*
  La otra mitad de recuperar la contraseña.

  El enlace del correo trae un token que el cliente de Supabase canjea SOLO al
  cargarse esta página: a partir de ahí hay una sesión de recuperación viva y
  `updateUser` puede cambiar la contraseña. Sin ese paso previo no hay a quién
  cambiársela, y por eso la página comprueba que existe sesión antes de enseñar
  el formulario: sin la comprobación, quien entre escribiendo la URL a mano ve un
  formulario que va a fallar al enviarlo, que es la peor forma de decir que no.

  El canje NO es instantáneo —el cliente procesa el fragmento de la URL al
  arrancar—, así que se espera al evento en vez de preguntar una sola vez.
*/

const MIN_CLAVE = 8;

type Estado = 'mirando' | 'listo' | 'sin-sesion' | 'guardando' | 'guardado' | 'error';

export function ClaveNueva() {
  const { d } = useI18n();
  const [clave, setClave] = useState('');
  const [estado, setEstado] = useState<Estado>('mirando');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    const auth = supabaseBrowser().auth;

    /* Puede que la sesión ya esté cuando esto corre, o puede que llegue un
       instante después con el token de la URL. Se miran las dos cosas. */
    auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (data.session) setEstado((e) => (e === 'mirando' ? 'listo' : e));
    });

    const { data: sub } = auth.onAuthStateChange((_evento: string, sesion: Session | null) => {
      if (sesion) setEstado((e) => (e === 'mirando' ? 'listo' : e));
    });

    /* Si en un par de segundos no ha aparecido ninguna sesión, es que se ha
       llegado aquí sin pasar por el correo. Mejor decirlo que dejar el formulario
       esperando indefinidamente. */
    const t = setTimeout(() => {
      setEstado((e) => (e === 'mirando' ? 'sin-sesion' : e));
    }, 2500);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (clave.length < MIN_CLAVE) {
      setEstado('error');
      setMensaje(d.auth.errWeak);
      return;
    }
    setEstado('guardando');
    const { error } = await supabaseBrowser().auth.updateUser({ password: clave });
    if (error) {
      setEstado('error');
      setMensaje(
        error.message.toLowerCase().includes('password')
          ? d.auth.errWeak
          : d.auth.errGeneric,
      );
      return;
    }
    setEstado('guardado');
  };

  if (estado === 'guardado') {
    return (
      <div className="auth-card">
        <h1 className="display">{d.auth.newPasswordTitle}</h1>
        <p>{d.auth.newPasswordSaved}</p>
        <a className="cta auth-submit" href="/crear">
          {d.auth.goToEditor}
        </a>
      </div>
    );
  }

  if (estado === 'sin-sesion') {
    return (
      <div className="auth-card">
        <h1 className="display">{d.auth.newPasswordTitle}</h1>
        <p>{d.auth.errLinkNeeded}</p>
        <a className="cta auth-submit" href="/entrar">
          {d.auth.backToSignIn}
        </a>
      </div>
    );
  }

  const ocupado = estado === 'guardando' || estado === 'mirando';

  return (
    <div className="auth-card">
      <h1 className="display">{d.auth.newPasswordTitle}</h1>
      <p>{d.auth.newPasswordBody}</p>

      <form onSubmit={guardar}>
        <label className="auth-field">
          <span>{d.auth.passwordLabel}</span>
          <input
            type="password"
            required
            minLength={MIN_CLAVE}
            autoComplete="new-password"
            placeholder={d.auth.passwordPlaceholder}
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            disabled={ocupado}
          />
        </label>
        <button type="submit" className="cta auth-submit" disabled={ocupado || !clave}>
          {estado === 'guardando' ? d.auth.sending : d.auth.newPasswordSave}
        </button>
      </form>

      {estado === 'error' && (
        <p className="auth-error" role="alert">
          {mensaje}
        </p>
      )}
    </div>
  );
}
