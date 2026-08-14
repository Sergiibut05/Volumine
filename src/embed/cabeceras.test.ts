import { describe, expect, it } from 'vitest';
import { savedEmbedHeaders, urlEmbedHeaders } from './serve';
import robots from '@/app/robots';

/*
  «Fuera del índice» y «que no lo descarguen» NO son lo mismo, y confundir las
  dos cosas costó que ningún link de gráfica enseñara vista previa en ningún
  sitio.

  El embed estaba bloqueado con `Disallow: /embed` en robots.txt. Eso no prohíbe
  indexar: prohíbe DESCARGAR. Y al prohibir la descarga se llevaba por delante a
  los rastreadores sociales —Twitterbot, facebookexternalhit, Slackbot—, que ni
  indexan ni quieren: sólo leen cuatro etiquetas para pintar una tarjeta. Se
  descubrió el día del lanzamiento, pegando el primer link en X y viendo texto
  azul donde tenía que haber una gráfica.

  Es además la trampa clásica: con el `Disallow` puesto, el `noindex` no lo lee
  nadie, porque para leerlo hay que descargar la página.

  Las dos mitades tienen que ir juntas y en este sentido: descarga permitida,
  indexación prohibida. Este fichero es lo único que impide que se separen otra
  vez, y separarlas no da ningún error — sólo deja de verse la tarjeta.
*/

const bloqueadasPor = (regla: { disallow?: string | string[] }) =>
  [regla.disallow ?? []].flat();

describe('el embed: legible para las tarjetas, fuera del índice', () => {
  it('manda noindex por cabecera, que es donde se dice de verdad', () => {
    expect(savedEmbedHeaders['X-Robots-Tag']).toBe('noindex');
    expect(urlEmbedHeaders['X-Robots-Tag']).toBe('noindex');
  });

  it('robots.txt NO bloquea /embed: bloqueado, nadie llega a leer el noindex', () => {
    for (const regla of [robots().rules].flat()) {
      expect(bloqueadasPor(regla).some((r) => r.startsWith('/embed'))).toBe(false);
    }
  });

  it('sigue fuera lo que no tiene nada que ofrecer a nadie de fuera', () => {
    const fuera = bloqueadasPor([robots().rules].flat()[0]);
    expect(fuera).toContain('/mis-graficas');
    expect(fuera).toContain('/auth/');
    expect(fuera).toContain('/entrar');
  });

  it('el embed se sigue pudiendo meter en cualquier página', () => {
    /* Que no se cuele un `frame-ancestors` restrictivo al tocar cabeceras: es
       lo único que hace que el producto funcione (ADR 0005). */
    expect(savedEmbedHeaders['Content-Security-Policy']).toBe('frame-ancestors *');
  });
});
