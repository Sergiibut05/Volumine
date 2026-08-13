'use client';

import { useState } from 'react';
import { buildEmbedIframe } from '@/lib/config/url';

/*
  El bloque de «pega esto», con su botón de copiar.

  Va aparte y en cliente porque copiar al portapapeles necesita JavaScript. El
  resto de la página es estática y no tiene por qué pagar ese peaje: aquí solo
  se hidrata este trozo.

  El código de ejemplo lleva una URL REAL de una gráfica publicada, no un
  `TU_LINK_AQUI`. Un ejemplo con marcador de posición obliga a leerlo y a
  entenderlo antes de poder probar nada; este se pega tal cual y se ve algo
  funcionando, que es lo que convence.
*/

/* Lo genera la MISMA función que el botón «iframe» del editor, a propósito: si
   la documentación enseña un snippet y el editor copia otro, uno de los dos
   está mintiendo y no hay forma de saber cuál. */
const EJEMPLO = buildEmbedIframe(
  'https://volumine.app/embed/ejemplo',
  'Reparto de ingresos',
);

export function Pegar({
  titulo,
  intro,
  copiar: txtCopiar,
  copiado: txtCopiado,
  nota,
}: {
  titulo: string;
  intro: string;
  copiar: string;
  copiado: string;
  nota: string;
}) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(EJEMPLO);
      setCopiado(true);
      /* Vuelve solo a los dos segundos. Un «copiado» que se queda para siempre
         deja de decir si el ÚLTIMO clic funcionó. */
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* Sin portapapeles —contexto no seguro, permisos— el bloque sigue ahí para
         seleccionar a mano. No hace falta avisar de nada. */
    }
  };

  return (
    <section className="pegar">
      <h2>{titulo}</h2>
      <p>{intro}</p>

      <div className="pegar-caja">
        <pre>
          <code>{EJEMPLO}</code>
        </pre>
        <button type="button" onClick={copiar}>
          {copiado ? txtCopiado : txtCopiar}
        </button>
      </div>

      <p className="pegar-nota">{nota}</p>
    </section>
  );
}
