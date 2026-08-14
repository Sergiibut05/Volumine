import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

/*
  ══════════════════════════════════════════════════════════════════════════
  LOS ICONOS QUE NO PUEDEN SER SVG
  ══════════════════════════════════════════════════════════════════════════

  La marca vive en `src/app/icon.svg`: un disco macizo con el anillo recortado,
  que se invierte solo con el tema del navegador. Es el icono bueno y sigue
  siendo el que ven los navegadores modernos.

  Pero hay dos sitios donde un SVG no vale:

  · GOOGLE. No lee favicons en SVG. Sin un `.ico` o un `.png`, los resultados de
    búsqueda salen con el globo terráqueo genérico en vez de con la marca.

  · iOS. Al añadir la web a la pantalla de inicio, si no encuentra un
    `apple-touch-icon` hace una CAPTURA DE LA PÁGINA y la mete en el cuadrado.
    Queda como lo que es: una web que no esperaba estar ahí.

  Y los dos quieren cosas distintas. El favicon se ve casi siempre sobre blanco
  —la lista de resultados de Google—, así que se rasteriza la variante clara.
  El de iOS va al revés: el sistema le pone SU máscara redondeada encima y no
  respeta la transparencia, así que un disco a sangre se recortaría contra un
  fondo negro imprevisible. Por eso ahí el fondo es un cuadrado opaco y la marca
  va METIDA dentro, con aire.

  ── POR QUÉ SE GENERAN Y NO SE DIBUJAN A MANO ────────────────────────────

  Porque si no, se separan. Un icono dibujado aparte es un icono que un día deja
  de parecerse a la marca sin que nadie se entere. Aquí sale todo de las mismas
  cuatro medidas de abajo, así que cambiar el símbolo es cambiarlas y volver a
  lanzar esto.

      npm run icons

  No está en el `build`: levantar un navegador en cada despliegue para producir
  unos iconos que cambian una vez al año es pagar un peaje todos los días.
*/

/* La elipse del anillo, en un lienzo de 32. Las mismas proporciones que
   `icon.svg` — están medidas a 16 píxeles, no elegidas a ojo. */
const ANILLO =
  'M26 16A10 6.2 0 1 1 6 16A10 6.2 0 1 1 26 16ZM20.2 16A4.2 2.6 0 1 0 11.8 16A4.2 2.6 0 1 0 20.2 16Z';

const TINTA = '#14141a';
const PAPEL = '#ffffff';

/** El disco a sangre: para el favicon, que se ve sobre el blanco de Google. */
const disco = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">
    <circle cx="16" cy="16" r="16" fill="${TINTA}" />
    <path d="${ANILLO}" fill="${PAPEL}" fill-rule="evenodd" />
  </svg>`;

/*
  El de iOS: cuadrado opaco y el disco dentro al 76 %.

  El sistema recorta un squircle sobre el borde, así que lo que toque la esquina
  se pierde. Con el disco al 76 % queda margen de sobra por los cuatro lados y
  la silueta redonda sigue leyéndose dentro de la máscara redondeada, que es
  justo lo que hace que un icono se vea «hecho para el móvil» y no pegado.
*/
const cuadrado = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">
    <rect width="32" height="32" fill="${TINTA}" />
    <g transform="translate(16 16) scale(0.76) translate(-16 -16)">
      <circle cx="16" cy="16" r="16" fill="${PAPEL}" />
      <path d="${ANILLO}" fill="${TINTA}" fill-rule="evenodd" />
    </g>
  </svg>`;

/**
 * Empaqueta un PNG dentro de un `.ico`.
 *
 * Un ICO no obliga a llevar el mapa de bits sin comprimir: desde Windows Vista
 * puede llevar un PNG tal cual dentro, y es lo que entienden todos los
 * navegadores y el rastreador de Google. Son veintidós bytes de cabecera, así
 * que no compensa arrastrar una dependencia por esto.
 */
function empaquetarIco(png, lado) {
  const cabecera = Buffer.alloc(6);
  cabecera.writeUInt16LE(0, 0); // reservado
  cabecera.writeUInt16LE(1, 2); // 1 = icono
  cabecera.writeUInt16LE(1, 4); // una sola imagen

  const entrada = Buffer.alloc(16);
  entrada.writeUInt8(lado === 256 ? 0 : lado, 0); // 0 significa 256
  entrada.writeUInt8(lado === 256 ? 0 : lado, 1);
  entrada.writeUInt8(0, 2); // sin paleta
  entrada.writeUInt8(0, 3); // reservado
  entrada.writeUInt16LE(1, 4); // planos
  entrada.writeUInt16LE(32, 6); // bits por píxel
  entrada.writeUInt32LE(png.length, 8);
  entrada.writeUInt32LE(cabecera.length + entrada.length, 12); // dónde empieza

  return Buffer.concat([cabecera, entrada, png]);
}

const navegador = await chromium.launch();

async function rasterizar(svg, lado) {
  const pagina = await navegador.newPage({
    viewport: { width: lado, height: lado },
    /* Fijo y claro: estos dos iconos NO se adaptan al tema. El que se adapta es
       el SVG, y para eso tiene sus `prefers-color-scheme`. */
    colorScheme: 'light',
  });
  await pagina.setContent(
    `<body style="margin:0;width:${lado}px;height:${lado}px">${svg}</body>`,
  );
  const png = await pagina.screenshot({ omitBackground: true });
  await pagina.close();
  return png;
}

/* 32 y no 16: Google escala hacia abajo sin problema y hay navegadores que
   piden 32 para las pestañas en pantallas densas. */
const favicon = await rasterizar(disco, 32);
await writeFile('src/app/favicon.ico', empaquetarIco(favicon, 32));

/* 180 es la medida que pide iOS desde hace años; las demás las deriva él. */
const apple = await rasterizar(cuadrado, 180);
await writeFile('src/app/apple-icon.png', apple);

/* 512 para la pantalla de inicio de Android, que lo saca del manifiesto. */
const android = await rasterizar(cuadrado, 512);
await writeFile('public/icon-512.png', android);

await navegador.close();

console.log('src/app/favicon.ico      32×32   ', favicon.length, 'B');
console.log('src/app/apple-icon.png   180×180 ', apple.length, 'B');
console.log('public/icon-512.png      512×512 ', android.length, 'B');
