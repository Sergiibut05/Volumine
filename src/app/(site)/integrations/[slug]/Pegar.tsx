'use client';

import { useState } from 'react';
import { buildEmbedIframe } from '@/lib/config/url';

/*
  El bloque de «pega esto», con su botón de copiar.

  Va aparte y en cliente porque copiar al portapapeles necesita JavaScript. El
  resto de la página es estática y no tiene por qué pagar ese peaje.

  El snippet lo genera `buildEmbedIframe()`, la MISMA función que usa el botón
  del editor y la página de «cómo funciona». Aquí importa el doble: esta página
  la lee alguien que va a copiar y pegar de verdad, así que si enseñara un
  iframe distinto del que copia el editor, uno de los dos estaría mintiendo
  justo delante de quien lo va a comprobar.
*/

export function Pegar({ url, titulo }: { url: string | null; titulo: string }) {
  const [copiado, setCopiado] = useState(false);

  if (!url) return null;
  const snippet = buildEmbedIframe(url, titulo);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopiado(true);
      /* Vuelve solo a los dos segundos: un «copiado» permanente deja de decir
         si el ÚLTIMO clic funcionó. */
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* Sin portapapeles el bloque sigue ahí para seleccionar a mano. */
    }
  };

  return (
    <section className="pegar">
      <h2>The chart above, ready to paste</h2>
      <p>
        This is the exact tag for the chart you just dragged. It works anywhere that accepts
        HTML; the steps above are for editors that want a URL instead.
      </p>

      <div className="pegar-caja">
        <pre>
          <code>{snippet}</code>
        </pre>
        <button type="button" onClick={copiar}>
          {copiado ? 'Copied' : 'Copy'}
        </button>
      </div>

      <p className="pegar-nota">
        Height is the only thing worth changing: the chart fits the width on its own, but it
        cannot guess how tall you want it.
      </p>
    </section>
  );
}
