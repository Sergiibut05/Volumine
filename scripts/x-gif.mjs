import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
/* CommonJS: en ESM llega entero por el `default`. */
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;
import { pngARgba } from './_png.mjs';

/*
  ══════════════════════════════════════════════════════════════════════════
  LA GRÁFICA GIRANDO, EN GIF
  ══════════════════════════════════════════════════════════════════════════

  X no incrusta la gráfica de verdad —eso es la player card, y va por
  aprobación— pero sí autorreproduce un GIF. Y un GIF adjunto rinde MÁS que una
  tarjeta de enlace: se ve sin salir de X, y X reparte menos alcance a lo que
  saca a la gente fuera.

  ── EL GIRO SE COMPONE, NO SE GRABA ──────────────────────────────────────

  Lo obvio sería poner `autoRotate` y capturar cada X milisegundos. Sale mal por
  dos motivos: una captura tarda lo que tarda, así que los fotogramas no quedan
  equiespaciados —el giro se ve a tirones—, y el último no encaja con el primero,
  así que el bucle da un salto en cada vuelta.

  Aquí cada fotograma se pide con su ÁNGULO exacto (`motion.angle`) y el giro
  apagado. Los fotogramas salen perfectamente repartidos y el bucle cierra sin
  costura, porque el último ángulo es justo el anterior a volver al primero.
  Cuesta una carga de página por fotograma y da igual: esto se lanza a mano.

  ── UNA SOLA PALETA PARA TODOS ───────────────────────────────────────────

  Un GIF sólo admite 256 colores. Cuantizando cada fotograma por su cuenta, cada
  uno elegiría 256 ligeramente distintos y el resultado hierve: los degradados
  y la sombra vibran de un fotograma al siguiente. Aquí la paleta se calcula UNA
  vez sobre una muestra de fotogramas repartidos por la vuelta y se aplica a
  todos. Como lo único que cambia es la orientación, los colores son los mismos.

      npm run x:gif                (con el servidor de producción en :3100)
*/

const URL_BASE = process.env.OG_URL ?? 'http://localhost:3100';

/* 720×405 es 16:9 y entra de sobra en el límite de X (15 MB, 1280 de ancho).
   Más grande engorda el GIF sin que se note: en la línea de tiempo se ve a unos
   500 px de ancho. */
const ANCHO = 720;
const ALTO = 405;

/* 40 fotogramas a 50 ms = 2 s por vuelta. Con menos se ve a saltos; con muchos
   más el fichero crece y la vuelta se hace lenta y aburrida. */
const FOTOGRAMAS = 40;
const MS_POR_FOTOGRAMA = 50;

const CONFIG = (angulo) => ({
  v: 1,
  type: 'donut',
  theme: 'aurora',
  title: 'Revenue by source',
  data: {
    labels: ['Subscriptions', 'Services', 'Licences', 'Training', 'Other'],
    series: [{ values: [42, 26, 17, 9, 6] }],
  },
  /* Opaco y oscuro: un GIF sólo tiene transparencia de un bit, así que un fondo
     transparente saldría con el borde dentado. Y sobre oscuro el canto de la
     gráfica es lo que más luce, que es de lo que va esto. */
  scene: { background: { kind: 'solid', from: '#12121b' } },
  layout: { watermark: false },
  /* Encendidas a mano: van apagadas por defecto. Sin ellas el GIF enseña una
     forma bonita y ni un dato, que es exactamente la crítica que se le hace a
     una gráfica 3D. Con el nombre y el porcentaje al lado de cada trozo, lo que
     se ve es una gráfica de verdad girando. */
  labels: { show: true, mode: 'outside', showValues: true, showPercent: true, finish: 'solid' },
  motion: { angle: angulo, autoRotate: false, entrance: 'none' },
});

const lz = (await import('lz-string')).default ?? (await import('lz-string'));
const url = (angulo) =>
  `${URL_BASE}/embed?c=${lz.compressToEncodedURIComponent(JSON.stringify(CONFIG(angulo)))}`;

/* De -180 a 180 sin repetir los extremos: el ángulo 180 ES el -180, y meter los
   dos dejaría un fotograma congelado justo en la costura del bucle. */
const angulos = Array.from({ length: FOTOGRAMAS }, (_, i) => -180 + (360 * i) / FOTOGRAMAS);

const navegador = await chromium.launch();
const pagina = await navegador.newPage({
  viewport: { width: ANCHO, height: ALTO },
  deviceScaleFactor: 1,
});

const cuadros = [];
for (const [i, angulo] of angulos.entries()) {
  await pagina.goto(url(angulo), { waitUntil: 'networkidle' });
  /* WebGL necesita unos fotogramas para tener algo dentro. Sin esta espera los
     primeros salen en negro — el mismo motivo que en `og-image.mjs`. */
  await pagina.waitForTimeout(700);
  cuadros.push(pngARgba(await pagina.screenshot()).rgba);
  process.stdout.write(`\r  fotograma ${i + 1}/${FOTOGRAMAS}`);
}
await navegador.close();
process.stdout.write('\n');

/* La paleta, de una muestra repartida por toda la vuelta: si se sacara sólo del
   primer fotograma, los colores que únicamente asoman por detrás a mitad de
   giro no tendrían sitio en ella. */
const muestra = cuadros.filter((_, i) => i % 5 === 0);
const juntos = new Uint8ClampedArray(muestra.length * ANCHO * ALTO * 4);
muestra.forEach((c, i) => juntos.set(c, i * ANCHO * ALTO * 4));
const paleta = quantize(juntos, 256, { format: 'rgba4444' });

const gif = GIFEncoder();
for (const rgba of cuadros) {
  gif.writeFrame(applyPalette(rgba, paleta, 'rgba4444'), ANCHO, ALTO, {
    palette: paleta,
    delay: MS_POR_FOTOGRAMA,
  });
}
gif.finish();

await mkdir('public/_shots', { recursive: true });
const bytes = Buffer.from(gif.bytes());
await writeFile('public/_shots/x-gif.gif', bytes);

const mb = (bytes.length / 1024 / 1024).toFixed(2);
console.log(
  `public/_shots/x-gif.gif  ${ANCHO}×${ALTO}  ${FOTOGRAMAS} fotogramas  ${mb} MB`,
);
if (bytes.length > 15 * 1024 * 1024) {
  console.error('  ⚠ pasa de 15 MB: X no lo acepta como GIF animado.');
  process.exitCode = 1;
}
