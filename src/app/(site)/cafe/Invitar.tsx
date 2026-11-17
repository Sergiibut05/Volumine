'use client';

import { useEffect, useState } from 'react';
import { OPCIONES_CAFE, importe } from '@/lib/cafe';

/*
  Elegir cuántos cafés y mandar.

  Es un `<form>` de verdad con radios de verdad: sin JavaScript sigue enviando
  la cantidad elegida, y el servidor la vuelve a acotar de todas formas. Lo
  único que pone el estado de React es la cifra del botón, que cambia en vivo
  — es lo que hace que se lea como «invitar con 9 €» y no como un formulario.

  Tres por defecto, que es la del medio: ni la mínima, que se lee como lo que
  «toca», ni la máxima, que se lee como un empujón.
*/

type Textos = {
  pick: string;
  unitOne: string;
  unitMany: string;
  each: string;
  button: string;
};

export function Invitar({ locale, textos }: { locale: string; textos: Textos }) {
  const [cafes, setCafes] = useState<number>(OPCIONES_CAFE[1]);
  const [enviando, setEnviando] = useState(false);

  /* Volver desde la pasarela con «atrás» restaura la página de la caché del
     navegador TAL CUAL, con el botón deshabilitado. Sin esto se queda muerto. */
  useEffect(() => {
    const alVolver = (e: PageTransitionEvent) => {
      if (e.persisted) setEnviando(false);
    };
    window.addEventListener('pageshow', alVolver);
    return () => window.removeEventListener('pageshow', alVolver);
  }, []);

  return (
    <form
      className="cafe-form"
      method="post"
      action="/api/stripe/cafe"
      onSubmit={() => setEnviando(true)}
    >
      <fieldset>
        <legend id="cafe-pedir">{textos.pick}</legend>
        <div className="cafe-opciones">
          {OPCIONES_CAFE.map((n) => (
            <label key={n} className="cafe-opcion">
              <input
                type="radio"
                name="cafes"
                value={n}
                checked={cafes === n}
                onChange={() => setCafes(n)}
              />
              <span className="cafe-opcion-tazas" aria-hidden>
                {Array.from({ length: n }, (_, i) => (
                  <TazaMini key={i} />
                ))}
              </span>
              <span className="cafe-opcion-texto">
                <strong>{n}</strong> {n === 1 ? textos.unitOne : textos.unitMany}
              </span>
            </label>
          ))}
        </div>
        <p className="cafe-precio-unidad">{textos.each}</p>
      </fieldset>

      <button type="submit" className="cta cafe-boton" disabled={enviando}>
        {textos.button.replace('{amount}', importe(cafes, locale))}
      </button>
    </form>
  );
}

/* La taza de las opciones. Trazo y no relleno: a 14 px un relleno se convierte
   en una mancha, y el trazo hereda `currentColor` del estado de la opción. */
function TazaMini() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" focusable="false">
      <path
        d="M2.5 6h8.5v3.5a3.5 3.5 0 0 1-3.5 3.5h-1.5a3.5 3.5 0 0 1-3.5-3.5V6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M11 7.25h1a1.75 1.75 0 0 1 0 3.5h-1.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M5.5 2.5v1.5M8 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
