import { themeById } from '@/lib/themes';

/*
  Sobre qué color se aplana un póster de fondo transparente.

  ── EL PROBLEMA, QUE NO ES UN FALLO SINO UN CHOQUE DE USOS ─────────────────

  Con fondo transparente el póster sale con alfa, y eso es lo correcto DENTRO
  de una página: la gráfica se funde con lo que haya detrás, que es la promesa
  del producto.

  Pero el póster tiene un segundo uso, y es el que de verdad vende: es el
  `og:image`, la imagen de la tarjeta cuando alguien pega el link en Slack, en
  WhatsApp o en Notion. Ninguno respeta la transparencia — cada uno compone el
  PNG sobre SU color, y ese color ni lo elegimos nosotros ni lo sabe quien hizo
  la gráfica. Slack en oscuro la pone negra; Notion, blanca. Una gráfica de
  colores oscuros hecha para una web oscura desaparece en la tarjeta de Notion.

  ── POR QUÉ ESTO ES UN CAMPO Y NO UN CÁLCULO ───────────────────────────────

  El primer intento fue elegir por CONTRASTE: mirar la paleta y quedarse con el
  fondo que dejara mejor al color que peor se viera. Suena bien y está mal, y lo
  demostraron los números sobre los temas de verdad:

      tema      elegía    peor contraste
      estudio   oscuro    1,43
      papel     oscuro    1,88

  «Estudio» está descrito como «para incrustar en páginas claras» y la regla le
  ponía fondo negro. Dos motivos, los dos de fondo:

  1. El contraste de WCAG mide elementos PLANOS. Una gráfica de Volumine es un
     objeto con brillo, canto y sombra proyectada: se distingue de su fondo por
     el relieve, no por la diferencia de luminancia. Optimizar 3:1 aquí es medir
     con la regla equivocada.
  2. Las paletas están hechas para que los sectores se distingan ENTRE SÍ, no de
     un fondo. Por eso casi todas cubren mucho rango, y con rango completo no
     existe ningún color plano que las deje todas legibles — está demostrado en
     `backdrop.test.ts` con la paleta de «estudio».

  El tema, en cambio, YA SABE sobre qué superficie está pensado: lo dice su
  propia descripción. Escribirlo como un campo es más corto, no se puede
  equivocar por un motivo que nadie ve, y lo elige quien diseña el tema —que es
  quien lo sabe— en vez de una heurística.
*/

/** Los dos únicos fondos. Neutros a propósito: el color lo pone la gráfica. */
export const BACKDROPS = {
  light: '#f4f4f7',
  dark: '#101018',
} as const;

export type Backdrop = (typeof BACKDROPS)[keyof typeof BACKDROPS];

/** Luminancia relativa de WCAG. Solo para el respaldo sin tema. */
export function luminance(hex: string): number {
  const raw = hex.trim().replace(/^#/, '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return 0;

  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Sobre qué aplanar el póster de una gráfica de fondo transparente.
 *
 * Manda la superficie que declara el tema. Sin tema —config a mano con paleta
 * propia— se cae a mirar la paleta: si es oscura, fondo claro. Es una conjetura
 * y por eso es el último recurso, no la regla.
 */
export function posterBackdrop(
  themeId: string | undefined,
  palette: readonly string[] = [],
): Backdrop {
  const surface = themeById(themeId)?.surface;
  if (surface) return BACKDROPS[surface];

  const validos = palette.map(luminance).filter((l) => l > 0);
  if (validos.length === 0) return BACKDROPS.light;

  const media = validos.reduce((a, b) => a + b, 0) / validos.length;
  return media < 0.35 ? BACKDROPS.light : BACKDROPS.dark;
}
