import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

/*
  Genera la imagen de las tarjetas de enlace — `public/og.png`, 1200×630.

  ── POR QUÉ UNA CAPTURA Y NO UNA IMAGEN COMPUESTA ────────────────────────

  Lo habitual es armarla con `next/og`: un fondo, el nombre y una frase. Aquí eso
  sería enseñar la descripción de un producto cuyo argumento entero es VISUAL.
  Esta captura lleva la gráfica 3D de verdad, con su canto y su sombra, que es lo
  único que distingue a esto de cualquier librería de gráficas.

  Y sale gratis en ejecución: es un PNG estático. `next/og` renderiza en cada
  petición del rastreador.

  ── CUÁNDO HAY QUE VOLVER A LANZARLO ─────────────────────────────────────

  Cuando cambie el héroe. No está en el `build` a propósito: levantar un
  navegador en cada despliegue para producir una imagen que cambia dos veces al
  año es pagar un peaje todos los días por un problema de dos días.

      npm run build && npx next start -p 3100
      node scripts/og-image.mjs

  1200×630 es la proporción que piden Open Graph y Twitter. Con otra, LinkedIn y
  Slack recortan por su cuenta y casi siempre por donde no toca.
*/

const URL_BASE = process.env.OG_URL ?? 'http://localhost:3100';
const ANCHO = 1200;
const ALTO = 630;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({
  viewport: { width: ANCHO, height: ALTO },
  /* El doble de densidad: la imagen se ve en pantallas retina y a 1x se notaría
     blanda justo en el canto de la gráfica, que es lo que hay que lucir. */
  deviceScaleFactor: 2,
  locale: 'es-ES',
});

await pagina.goto(URL_BASE, { waitUntil: 'networkidle' });

/* El canvas necesita unos fotogramas para tener algo dentro. Sin esta espera la
   captura sale con el hueco vacío: es el mismo motivo por el que las capturas de
   `fullPage` salían sin gráficas. */
await pagina.waitForTimeout(3500);

/* Sin la tira de URL ni el botón: en una tarjeta de enlace de 1200px acaban
   ilegibles y roban sitio al objeto, que es lo único que hay que ver. */
await pagina.addStyleTag({
  content: '.urlstrip, .cta { visibility: hidden !important; }',
});
await pagina.waitForTimeout(200);

await mkdir('public', { recursive: true });
await pagina.screenshot({ path: 'public/og.png' });
await navegador.close();

console.log(`public/og.png · ${ANCHO}×${ALTO} @2x`);
