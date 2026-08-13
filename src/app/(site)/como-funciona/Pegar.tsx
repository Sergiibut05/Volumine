'use client';

import { useState } from 'react';

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

const EJEMPLO = `<iframe
  src="https://volumine.app/embed/ejemplo"
  width="100%"
  height="420"
  style="border:0"
  loading="lazy"
  title="Reparto de ingresos"
></iframe>`;

export function Pegar() {
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
      <h2>Si el sitio no lo reconoce solo</h2>
      <p>
        Notion, Confluence y la mayoría lo despliegan pegando la URL a secas. En una web
        propia, o donde no haya oEmbed, va así:
      </p>

      <div className="pegar-caja">
        <pre>
          <code>{EJEMPLO}</code>
        </pre>
        <button type="button" onClick={copiar}>
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      <p className="pegar-nota">
        La altura es lo único que conviene tocar: la gráfica se adapta al ancho sola, pero
        no puede adivinar cuánto alto quieres darle.
      </p>
    </section>
  );
}
