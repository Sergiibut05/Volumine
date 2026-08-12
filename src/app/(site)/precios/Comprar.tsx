'use client';

import { useState } from 'react';

/*
  El botón de pagar.

  ── EL TEXTO ES UNA OBLIGACIÓN, NO UNA ELECCIÓN ──────────────────────────

  Dice «Comprar y pagar» y no «Continuar» ni «Empezar». La normativa de
  contratación a distancia exige que el botón que cierra el contrato indique de
  forma inequívoca que la acción OBLIGA A PAGAR. Un «Continuar» delante de una
  pasarela no cumple, y la consecuencia de no cumplir es que el contrato no
  vincula a quien compró.

  ── Y LA CASILLA TAMBIÉN ─────────────────────────────────────────────────

  Sigue haciendo falta con un pago único: el desistimiento de catorce días es de
  la compra, no de la suscripción. El plan empieza a valer en el momento del
  pago, o sea antes de que pase ese plazo. Para que eso sea legítimo hay que recabar el
  consentimiento EXPRESO a empezar ya, y que la persona reconozca que al hacerlo
  pierde ese derecho. Por eso es una casilla que hay que marcar a mano y el botón
  está apagado hasta entonces: preseleccionarla la invalidaría.
*/

export function Comprar({
  plan,
  textoBoton,
  textoCasilla,
  entrar,
  haySesion,
}: {
  plan: string;
  textoBoton: string;
  textoCasilla: string;
  entrar: string;
  haySesion: boolean;
}) {
  const [acepta, setAcepta] = useState(false);
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState('');

  if (!haySesion) {
    return (
      <a className="cta precio-cta" href="/entrar?next=/precios">
        {entrar}
      </a>
    );
  }

  const ir = async () => {
    setYendo(true);
    setError('');
    try {
      const r = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const datos = (await r.json()) as { url?: string; error?: string };
      if (datos.url) {
        window.location.assign(datos.url);
        return;
      }
      setError(datos.error ?? 'No se pudo abrir el pago.');
    } catch {
      setError('No se pudo abrir el pago.');
    }
    setYendo(false);
  };

  return (
    <div className="precio-compra">
      <label className="precio-casilla">
        <input
          type="checkbox"
          checked={acepta}
          onChange={(e) => setAcepta(e.target.checked)}
        />
        <span>{textoCasilla}</span>
      </label>

      <button
        type="button"
        className="cta precio-cta"
        onClick={ir}
        disabled={!acepta || yendo}
      >
        {textoBoton}
      </button>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
