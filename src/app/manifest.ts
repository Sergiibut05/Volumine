import type { MetadataRoute } from 'next';
import { MARCA } from '@/lib/marca';

/*
  El manifiesto web.

  No es que esto vaya a ser una PWA —no hay service worker ni intención de
  tenerlo—, pero sin manifiesto Android no sabe qué nombre ni qué icono poner al
  añadir la web a la pantalla de inicio, y se inventa los dos a partir del
  título de la pestaña y de una captura.

  `display: browser` a propósito, y no `standalone`: en Volumine el link ES el
  producto, y una ventana sin barra de direcciones es justo la que impide
  copiarlo. Prometer una app que se abre a pantalla completa cuando lo que hay
  es una web sería además prometer algo que no se cumple.
*/

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Volumine — gráficas 3D que se incrustan con un link',
    short_name: MARCA.nombre,
    description:
      'Haz una gráfica 3D y llévatela a tu web, a Notion o a Confluence con un link.',
    start_url: '/',
    display: 'browser',
    background_color: MARCA.colorTemaClaro,
    theme_color: MARCA.colorTemaClaro,
    icons: [
      /* El SVG primero: es el único que se ve nítido a cualquier tamaño y el
         único que se adapta al tema. Android tira del PNG cuando no puede. */
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      {
        src: '/icon-512.png',
        type: 'image/png',
        sizes: '512x512',
        /* `maskable` es lo que autoriza a Android a recortarlo con SU forma. Lo
           genera `scripts/icons.mjs` con el disco al 76 %, así que hay margen
           por los cuatro lados y ningún recorte se come la marca. */
        purpose: 'maskable',
      },
    ],
  };
}
