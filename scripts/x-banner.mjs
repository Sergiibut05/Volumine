import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';

/*
  ══════════════════════════════════════════════════════════════════════════
  LA CABECERA DE X — 1500×500
  ══════════════════════════════════════════════════════════════════════════

  Se genera en vez de dibujarse a mano por el mismo motivo que los iconos: la
  gráfica que sale aquí es el RENDERER DE VERDAD dentro de un `/embed`, no una
  captura vieja pegada en un lienzo. El día que cambie el material o la luz,
  esta imagen cambia con volver a lanzar el script.

  ── LAS DOS ZONAS QUE SE PIERDEN ─────────────────────────────────────────

  Una cabecera de X no se ve entera casi nunca:

  · El AVATAR se superpone abajo a la izquierda, un círculo de unos 200 px que
    tapa esa esquina por completo.
  · En móvil se recorta por los lados. Lo que esté pegado al borde izquierdo o
    derecho desaparece.

  Por eso el texto vive en la franja central-izquierda pero por ENCIMA de la
  altura del avatar, y la gráfica ocupa la mitad derecha sin llegar al borde.
  Lo importante cabe en el 60 % central: si se recorta, se recorta aire.

      npm run x:banner        (con el servidor de producción en :3100)
*/

const URL_BASE = process.env.OG_URL ?? 'http://localhost:3100';
const ANCHO = 1500;
const ALTO = 500;

/*
  ── DOS CABECERAS, NO UNA ────────────────────────────────────────────────

  La de MARCA presenta el producto: dice lo que hace y enseña el objeto.

  La PERSONAL presenta a quien lo hizo, y no es la misma con otro texto. En X se
  sigue a personas: una cuenta personal con la cabecera de la empresa se lee
  como una cuenta corporativa disfrazada, que es lo peor de los dos mundos. Ahí
  el nombre manda y el producto es la prueba, no el titular.

  Y llevan gráficas DISTINTAS a propósito. Con la misma, quien mire los dos
  perfiles seguidos ve la misma imagen dos veces y entiende que una de las dos
  cuentas sobra. Además, dos tipos de gráfica enseñan más producto que uno.

      npm run x:banner              -> la de marca
      npm run x:banner -- personal  -> la personal
*/

const VARIANTES = {
  marca: {
    salida: 'x-banner.jpg',
    ojal: 'Volumine',
    conLogo: true,
    titulo: 'Your data,<br>with volume.',
    pie: '3D charts you embed with a link. No plugin, no account.',
    config: {
      v: 1,
      type: 'donut',
      theme: 'aurora',
      data: {
        labels: ['Subscriptions', 'Services', 'Licences', 'Training'],
        series: [{ values: [46, 27, 18, 9] }],
      },
    },
  },

  personal: {
    salida: 'x-banner-personal.jpg',
    ojal: 'Sergii Butrii',
    /* Sin el disco de la marca: es una cuenta de una persona, y el logotipo
       junto al nombre la convertiría otra vez en una cuenta de empresa. */
    conLogo: false,
    titulo: 'I build<br>Volumine.',
    pie: '3D charts you embed with a link. Made solo, in public.',
    /* Barras y no anillo: la otra cabecera ya lleva el anillo. */
    config: {
      v: 1,
      type: 'bar',
      theme: 'aurora',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        series: [{ values: [18, 27, 22, 38, 46] }],
      },
    },
  },
};

const cual = process.argv[2] ?? 'marca';
const V = VARIANTES[cual];
if (!V) {
  console.error(`No existe la variante «${cual}». Hay: ${Object.keys(VARIANTES).join(', ')}`);
  process.exit(1);
}

/* Fondo transparente y sin marca de agua para las dos: la gráfica se apoya en
   el papel de la cabecera en vez de traer su propia caja. Y quieta — una
   captura de algo girando coge la pose que le toque, y aquí la pose importa. */
const CONFIG = {
  ...V.config,
  scene: { background: { kind: 'transparent' } },
  layout: { watermark: false },
  motion: { autoRotate: false },
};

/* `lz-string` ya está en las dependencias: es el mismo códec que usa la app
   para meter la config en la URL, así que el link que sale de aquí es un link
   de Volumine legítimo y no un formato paralelo. */
/* CommonJS con `export =`: en ESM llega envuelto en `.default`. */
const lz = (await import('lz-string')).default ?? (await import('lz-string'));
const { compressToEncodedURIComponent } = lz;
const src = `${URL_BASE}/embed?c=${compressToEncodedURIComponent(JSON.stringify(CONFIG))}`;

/* El logotipo, leído del mismo SVG que sirve de favicon. */
const marca = (await readFile('src/app/icon.svg', 'utf8'))
  .replace(/<!--[\s\S]*?-->/g, '')
  /* El SVG de la pestaña se invierte con el tema del sistema; aquí el fondo lo
     ponemos nosotros y es claro siempre, así que esa regla sobra y encima
     dejaría el disco blanco sobre blanco en un móvil en modo oscuro. */
  .replace(/@media \(prefers-color-scheme: dark\) \{[^}]*\}[^}]*\}/g, '')
  .replace('<svg', '<svg width="44" height="44"');

const pagina = `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  @font-face { font-family: B; src: local('Bricolage Grotesque'); }
  * { margin: 0; box-sizing: border-box }
  body {
    width: ${ANCHO}px; height: ${ALTO}px; overflow: hidden;
    /* El mismo papel de la landing, con la luz cayendo desde arriba a la
       izquierda: es lo que hace que la escena parezca un set y no un fondo. */
    background: radial-gradient(120% 140% at 18% 0%, #ffffff 0%, #f2f2f7 55%, #e8e8f0 100%);
    font-family: 'Bricolage Grotesque', 'Segoe UI', system-ui, sans-serif;
    color: #12121b;
    display: grid; grid-template-columns: 1fr 1fr; align-items: center;
  }
  /* Arriba del avatar: éste ocupa desde y≈330 hacia abajo en la esquina. */
  .texto { padding: 0 0 96px 96px }
  .ojal { display: flex; align-items: center; gap: 14px; margin-bottom: 26px }
  .ojal span { font-size: 30px; font-weight: 800; letter-spacing: -0.02em }
  h1 { font-size: 54px; line-height: 1.02; letter-spacing: -0.035em; font-weight: 800 }
  p { margin-top: 18px; font-size: 21px; line-height: 1.35; color: #4d4d5a; max-width: 30ch }
  iframe { width: 100%; height: ${ALTO}px; border: 0; display: block }
</style></head>
<body>
  <div class="texto">
    <div class="ojal">${V.conLogo ? marca : ''}<span>${V.ojal}</span></div>
    <h1>${V.titulo}</h1>
    <p>${V.pie}</p>
  </div>
  <iframe src="${src}"></iframe>
</body></html>`;

const navegador = await chromium.launch();
const p = await navegador.newPage({
  viewport: { width: ANCHO, height: ALTO },
  deviceScaleFactor: 2,
  colorScheme: 'light',
});
/*
  La página se sirve por HTTP desde aquí mismo, en vez de inyectarla con
  `setContent`.

  Con `setContent` el documento vive en `about:blank`, que es un origen opaco, y
  el `<iframe>` del embed se quedaba en blanco: la gráfica no se dibujaba nunca.
  Escribirla en `public/` tampoco valía —`next start` sirve lo que había al
  arrancar, así que un fichero nuevo da 404—, y dejar un andamio en el
  repositorio para esto habría sido peor.

  Doce líneas de servidor y la página es una página normal, con su origen, y el
  iframe se comporta igual que en la web de cualquiera. Que además es
  exactamente el caso de uso del producto.
*/
const anfitrion = createServer((_, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(pagina);
});
await new Promise((listo) => anfitrion.listen(0, '127.0.0.1', listo));
const puerto = anfitrion.address().port;

await p.goto(`http://127.0.0.1:${puerto}/`, { waitUntil: 'networkidle' });
/* El canvas necesita unos fotogramas para tener algo dentro; sin esto sale el
   hueco vacío. Es el mismo motivo que en `og-image.mjs`. */
await p.waitForTimeout(4000);

const grande = await p.screenshot();

/* Reducido a 1500 dentro del navegador, igual que la imagen OG: supermuestreo
   en vez de rasterizar pequeño, que es lo que salva el canto de la gráfica. */
const dataUrl = await p.evaluate(
  async ([b64, w, h]) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.92);
  },
  [grande.toString('base64'), ANCHO, ALTO],
);

await mkdir('public/_shots', { recursive: true });
const jpeg = Buffer.from(dataUrl.split(',')[1], 'base64');
await writeFile(`public/_shots/${V.salida}`, jpeg);
await navegador.close();
anfitrion.close();

console.log(
  `public/_shots/${V.salida}  ${ANCHO}×${ALTO}  ${(jpeg.length / 1024).toFixed(0)} KB`,
);
