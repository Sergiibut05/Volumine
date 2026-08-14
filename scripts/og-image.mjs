import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

/*
  Genera la imagen de las tarjetas de enlace — `public/og.jpg`, 1200×630.

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

  ── POR QUÉ 1200×630 DE VERDAD, Y EN JPEG ────────────────────────────────

  Esto capturaba a doble densidad y guardaba el PNG tal cual: 2400×1260 y 678 KB.
  Se veía muy bien y rompía WhatsApp, que por encima de 500 KB no enseña vista
  previa y deja el enlace pelado — justo donde más se comparte un link a mano.

  Y sobraba de largo: una tarjeta se pinta a unos 500-600 px en casi todos los
  clientes, así que 2400 era cuatro veces el tamaño útil.

  Se sigue capturando al doble y se REDUCE después a 1200. No es lo mismo que
  capturar a 1x: al promediar cuatro píxeles en uno, el canto de la gráfica sale
  mejor resuelto que rasterizándolo directamente pequeño. Supermuestreo de toda
  la vida.

  El JPEG es porque esto es un render con degradados, que es exactamente donde
  un PNG pesa varias veces más sin verse mejor.

  Las medidas y la ruta tienen que cuadrar con `OG` en `src/lib/marca.ts`: son
  las que se anuncian en `og:image:width` y `og:image:height`.
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

/*
  Reducir a 1200×630 y comprimir, dentro del propio navegador.

  Podría hacerlo `sharp`, pero eso es una dependencia nativa entera —con su
  binario por plataforma— para dos llamadas de canvas que el navegador que ya
  está abierto sabe hacer. `imageSmoothingQuality: 'high'` es lo que activa el
  filtrado bueno al reducir; sin eso el canto sale con dientes.

  El 0.9 no es un número redondo elegido a ojo: por debajo se empieza a notar
  banding en el degradado del fondo, que ocupa media imagen.
*/
const grande = await pagina.screenshot();

const dataUrl = await pagina.evaluate(
  async ([base64, ancho, alto]) => {
    const img = new Image();
    img.src = `data:image/png;base64,${base64}`;
    await img.decode();

    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, ancho, alto);
    return lienzo.toDataURL('image/jpeg', 0.9);
  },
  [grande.toString('base64'), ANCHO, ALTO],
);

await mkdir('public', { recursive: true });
const jpeg = Buffer.from(dataUrl.split(',')[1], 'base64');
await writeFile('public/og.jpg', jpeg);
await navegador.close();

const kb = (jpeg.length / 1024).toFixed(0);
console.log(`public/og.jpg  ${ANCHO}×${ALTO}  ${kb} KB`);
if (jpeg.length > 500 * 1024) {
  console.error('  ⚠ pasa de 500 KB: WhatsApp no enseñará la vista previa.');
  process.exitCode = 1;
}
