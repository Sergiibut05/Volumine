import { chromium } from 'playwright';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
/* CommonJS: en ESM llega entero por el `default`. */
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;
import { pngARgba } from './_png.mjs';

/*
  ══════════════════════════════════════════════════════════════════════════
  LA GRÁFICA GIRANDO, EN GIF
  ══════════════════════════════════════════════════════════════════════════

  X no incrusta la gráfica de verdad —eso es la player card, y va por
  aprobación— pero sí autorreproduce un GIF. Y hay algo que importa más: al
  adjuntar un medio, X deja de pintar la tarjeta del enlace y enseña ESTO. Así
  que no es un sustituto de la tarjeta, es lo que la reemplaza a propósito.

  ── EL GIRO SE COMPONE, NO SE GRABA ──────────────────────────────────────

  Lo obvio sería poner `autoRotate` y capturar cada X milisegundos. Sale mal por
  dos motivos: una captura tarda lo que tarda, así que los fotogramas no quedan
  equiespaciados —el giro se ve a tirones—, y el último no encaja con el primero,
  así que el bucle da un salto en cada vuelta.

  Aquí cada fotograma se pide con su ÁNGULO exacto (`motion.angle`) y el giro
  apagado. Reparto perfecto y bucle sin costura. Cuesta una carga de página por
  fotograma y da igual: esto se lanza a mano.

  ── LAS TRES COSAS QUE LE DAN CALIDAD ────────────────────────────────────

  1. SUPERMUESTREO. Se captura al doble y se reduce después. No es lo mismo que
     capturar pequeño: al promediar cuatro píxeles en uno, el canto de la
     gráfica y el texto de las etiquetas salen resueltos en vez de dentados.

  2. UNA SOLA PALETA. Un GIF admite 256 colores. Cuantizando cada fotograma por
     su cuenta, cada uno elegiría 256 ligeramente distintos y la imagen hierve.
     Se calcula UNA vez sobre una muestra repartida por toda la vuelta —no sólo
     del primero, o los colores que sólo asoman por detrás a mitad de giro no
     tendrían sitio— y se aplica a todos.

  3. TRAMADO ORDENADO. 256 colores no bastan para un degradado sobre una
     superficie curva: aparecen bandas. El tramado las rompe metiendo un error
     controlado antes de elegir color. Y ORDENADO, no de difusión: el patrón de
     Bayer está fijo en la pantalla, así que no se mueve entre fotogramas. Con
     difusión de error el ruido bailaría en cada vuelta, que en una animación se
     ve muchísimo peor que la banda que venía a arreglar.

      npm run x:gif              -> el anillo
      npm run x:gif -- globo     -> el globo
*/

const URL_BASE = process.env.OG_URL ?? 'http://localhost:3100';

/* 720×405 es 16:9 y entra de sobra en el límite de X (15 MB, 1280 de ancho).
   Más grande engorda el fichero sin que se note: en la línea de tiempo se ve a
   unos 500 px de ancho. */
const ANCHO = 720;
const ALTO = 405;

/* 60 fotogramas a 40 ms = 2,4 s por vuelta, 25 por segundo. A 20 se notaba el
   escalón en los bordes rectos de las barras al pasar por el frente. El retardo
   del GIF va en centésimas, así que 40 ms es exacto y 41 no existiría. */
const FOTOGRAMAS = 60;
const MS_POR_FOTOGRAMA = 40;

/* Sólido y no degradado: un degradado a pantalla completa es la peor entrada
   posible para 256 colores, y aquí lo que tiene que lucir es la gráfica.

   El color lo pone cada variante, y no es un capricho: la esfera del globo ya
   es oscura de por sí, así que sobre negro desaparecía —se veía un círculo
   apenas más claro que el fondo—. El anillo es al revés: sobre oscuro es donde
   mejor se le ve el canto. */

const VARIANTES = {
  anillo: {
    salida: 'x-gif.gif',
    fondo: '#101017',
    firma: 'rgba(255,255,255,0.42)',
    config: {
      type: 'donut',
      theme: 'aurora',
      data: {
        labels: ['Subscriptions', 'Services', 'Licences', 'Training', 'Other'],
        series: [{ values: [42, 26, 17, 9, 6] }],
      },
    },
  },
  globo: {
    salida: 'x-gif-globo.gif',
    fondo: '#ececf2',
    firma: 'rgba(0,0,0,0.38)',
    config: {
      type: 'globe',
      theme: 'aurora',
      data: {
        labels: ['Madrid', 'London', 'New York', 'Tokyo', 'São Paulo', 'Sydney'],
        series: [{ values: [14.8, 20.3, 27.7, 17.2, 11.3, 8.6] }],
        /* [LATITUD, LONGITUD], en ese orden — es lo que valida el esquema.
           Al revés, la longitud de Tokio (139,7) se lee como latitud y el
           config no pasa: «Too big: expected number to be <=90». */
        coords: [
          [40.4, -3.7],
          [51.5, -0.1],
          [40.7, -74.0],
          [35.7, 139.7],
          [-23.5, -46.6],
          [-33.9, 151.2],
        ],
      },
    },
  },
};

const cual = process.argv[2] ?? 'anillo';
const V = VARIANTES[cual];
if (!V) {
  console.error(`No existe «${cual}». Hay: ${Object.keys(VARIANTES).join(', ')}`);
  process.exit(1);
}

const CONFIG = (angulo) => ({
  v: 1,
  ...V.config,
  scene: { background: { kind: 'transparent' } },
  layout: { watermark: false },
  /* Encendidas a mano: van apagadas por defecto. Sin ellas el GIF enseña una
     forma bonita y ni un dato, que es exactamente la crítica que se le hace a
     una gráfica 3D. Con el nombre y el porcentaje al lado de cada trozo, lo que
     se ve es una gráfica de verdad girando. */
  labels: {
    show: true,
    mode: 'outside',
    showValues: true,
    showPercent: true,
    finish: 'solid',
  },
  motion: { angle: angulo, autoRotate: false, entrance: 'none' },
});

const lz = (await import('lz-string')).default ?? (await import('lz-string'));
const embed = (angulo) =>
  `${URL_BASE}/embed?c=${lz.compressToEncodedURIComponent(JSON.stringify(CONFIG(angulo)))}`;

/* El logotipo, del mismo SVG que sirve de favicon. Sin la regla de tema oscuro:
   aquí el fondo lo ponemos nosotros y es oscuro siempre, así que el disco tiene
   que ser el claro. */
const claro = V.fondo > '#8';
const marca = (await readFile('src/app/icon.svg', 'utf8'))
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\.disco \{ fill: #14141a \}/, `.disco { fill: ${claro ? '#14141a' : '#f2f2f5'} }`)
  .replace(/\.hueco \{ fill: #ffffff \}/, `.hueco { fill: ${claro ? '#ffffff' : '#0d0d11'} }`)
  .replace(/@media \(prefers-color-scheme: dark\) \{[^}]*\}[^}]*\}/g, '')
  .replace('<svg', '<svg width="18" height="18"');

/*
  Se compone en una página nuestra en vez de capturar el embed pelado.

  Dos motivos. Uno, la firma: un GIF que se reenvía sin el post pierde de dónde
  salió, y «volumine.app» en una esquina lo arregla por 20 píxeles de alto. Y
  dos, el control del encuadre — el embed rellena lo que le den, y aquí interesa
  dejarle aire a las etiquetas para que no lleguen al borde.
*/
const pagina = (angulo) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box }
  body {
    width: ${ANCHO}px; height: ${ALTO}px; overflow: hidden; position: relative;
    background: ${V.fondo};
    font-family: 'Bricolage Grotesque', 'Segoe UI', system-ui, sans-serif;
  }
  iframe { width: 100%; height: 100%; border: 0; display: block }
  .firma {
    position: absolute; right: 18px; bottom: 14px;
    display: flex; align-items: center; gap: 7px;
    font-size: 13px; font-weight: 600; letter-spacing: -0.01em;
    /* Apagada a propósito: tiene que poder leerse y no competir nunca con la
       gráfica. Si se lee antes que el dato, sobra. */
    color: ${V.firma};
  }
</style></head>
<body>
  <iframe src="${embed(angulo)}"></iframe>
  <div class="firma">${marca}<span>volumine.app</span></div>
</body></html>`;

/* Servido por HTTP desde aquí: con `setContent` el documento vive en
   `about:blank` —origen opaco— y el iframe del embed se queda en blanco. */
let anguloActual = 0;
const anfitrion = createServer((_, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(pagina(anguloActual));
});
await new Promise((listo) => anfitrion.listen(0, '127.0.0.1', listo));
const puerto = anfitrion.address().port;

const navegador = await chromium.launch();
const p = await navegador.newPage({
  viewport: { width: ANCHO, height: ALTO },
  /* El doble, para reducir después. Ver «supermuestreo» arriba. */
  deviceScaleFactor: 2,
  colorScheme: 'dark',
});

/* De -180 a 180 sin repetir los extremos: el ángulo 180 ES el -180, y meter los
   dos dejaría un fotograma congelado justo en la costura del bucle. */
const angulos = Array.from({ length: FOTOGRAMAS }, (_, i) => -180 + (360 * i) / FOTOGRAMAS);

const cuadros = [];
for (const [i, angulo] of angulos.entries()) {
  anguloActual = angulo;
  await p.goto(`http://127.0.0.1:${puerto}/`, { waitUntil: 'networkidle' });
  /* WebGL necesita unos fotogramas para tener algo dentro. Sin esta espera los
     primeros salen en negro — el mismo motivo que en `og-image.mjs`. */
  await p.waitForTimeout(750);

  const grande = await p.screenshot();

  /* Reducción a 1× dentro del navegador: `imageSmoothingQuality: 'high'` es lo
     que activa el filtrado bueno. Sin eso el canto sale con dientes y todo el
     supermuestreo no habría servido de nada. */
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
      return c.toDataURL('image/png');
    },
    [grande.toString('base64'), ANCHO, ALTO],
  );

  cuadros.push(pngARgba(Buffer.from(dataUrl.split(',')[1], 'base64')).rgba);
  process.stdout.write(`\r  fotograma ${i + 1}/${FOTOGRAMAS}`);
}
await navegador.close();
anfitrion.close();
process.stdout.write('\n');

/*
  Tramado ordenado de Bayer 4×4.

  El patrón va atado a la POSICIÓN EN PANTALLA, no al contenido, así que es
  idéntico en los sesenta fotogramas y no se mueve. Esa es toda la razón de
  elegirlo frente a la difusión de error de Floyd-Steinberg, que da mejor
  resultado en una imagen quieta y en una animación produce un hormigueo
  insoportable.

  La amplitud es la mitad de un escalón de cuantización aproximado: lo justo
  para que dos bandas contiguas se entrelacen en su frontera. Más alto se vería
  el propio patrón; más bajo no rompería nada.
*/
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const AMPLITUD = 4;

function tramar(rgba, ancho) {
  const salida = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    /* `>>` tiene MENOS precedencia que `/`. Escrito del tirón, esto calculaba
       `i >> (2/ancho)` y el patrón salía en diagonal por toda la imagen en vez
       de repetirse cada cuatro píxeles. Con el índice sacado a su variable el
       error no se puede volver a colar. */
    const pixel = i >> 2;
    const px = pixel % ancho;
    const py = Math.floor(pixel / ancho);
    const umbral = (BAYER[py % 4][px % 4] / 16 - 0.5) * AMPLITUD;
    salida[i] = rgba[i] + umbral;
    salida[i + 1] = rgba[i + 1] + umbral;
    salida[i + 2] = rgba[i + 2] + umbral;
    salida[i + 3] = rgba[i + 3];
  }
  return salida;
}

/* La paleta, de una muestra repartida por toda la vuelta. `rgb565` en vez de
   `rgba4444`: aquí no hay transparencia que preservar y 5-6-5 distingue muchos
   más tonos de un mismo color, que es justo lo que pide un degradado. */
const muestra = cuadros.filter((_, i) => i % 6 === 0);
const juntos = new Uint8ClampedArray(muestra.length * ANCHO * ALTO * 4);
muestra.forEach((c, i) => juntos.set(c, i * ANCHO * ALTO * 4));
const paleta = quantize(juntos, 256, { format: 'rgb565' });

const gif = GIFEncoder();
for (const rgba of cuadros) {
  gif.writeFrame(applyPalette(tramar(rgba, ANCHO), paleta, 'rgb565'), ANCHO, ALTO, {
    palette: paleta,
    delay: MS_POR_FOTOGRAMA,
  });
}
gif.finish();

await mkdir('public/_shots', { recursive: true });
const bytes = Buffer.from(gif.bytes());
await writeFile(`public/_shots/${V.salida}`, bytes);

const mb = (bytes.length / 1024 / 1024).toFixed(2);
const seg = ((FOTOGRAMAS * MS_POR_FOTOGRAMA) / 1000).toFixed(1);
console.log(
  `public/_shots/${V.salida}  ${ANCHO}×${ALTO}  ${FOTOGRAMAS} fotogramas  ${seg}s  ${mb} MB`,
);
if (bytes.length > 15 * 1024 * 1024) {
  console.error('  ⚠ pasa de 15 MB: X no lo acepta como GIF animado.');
  process.exitCode = 1;
}
