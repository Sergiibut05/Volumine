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

  ── AQUÍ HUBO UNA CASILLA, Y ERA UN ERROR ────────────────────────────────

  El consentimiento a renunciar al desistimiento de catorce días se pedía con
  una casilla que además DESHABILITABA el botón hasta marcarla. Convertía un
  requisito legal en un obstáculo, en el peor momento posible —justo al decidir
  la compra— y con un aspecto que no tiene ninguna otra tienda.

  Ahora lo recoge Stripe dentro de su propio checkout (`consent_collection`),
  que es donde ese tipo de letra pequeña se espera. Aquí abajo solo queda el
  aviso de que el acceso es inmediato, que es información útil y no un peaje:
  quien lee entiende qué compra sin tener que hacer nada para poder pagar.
*/

export function Comprar({
  plan,
  textoBoton,
  textoAviso,
  entrar,
  haySesion,
}: {
  plan: string;
  textoBoton: string;
  textoAviso: string;
  entrar: string;
  haySesion: boolean;
}) {
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
      <button type="button" className="cta precio-cta" onClick={ir} disabled={yendo}>
        {textoBoton}
      </button>

      <p className="precio-aviso">{textoAviso}</p>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
