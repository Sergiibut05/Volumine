#!/usr/bin/env node
/**
 * Comprueba /embed contra docs/PERFORMANCE-BUDGET.md.
 *
 * Mide el artefacto que se sirve, no una página cargada en un navegador. La
 * versión anterior levantaba `next start` y lo medía con Playwright; era más
 * fiel pero se colgaba orquestando el servidor y un chequeo de presupuesto que
 * se cuelga es un chequeo que la gente acaba saltándose.
 *
 * Sale con código 1 si se pasa. No es un aviso, es un error.
 */
import { readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { minifyCss } from './minify-css.mjs';

/*
  `font` es el tope de UNA tipografía, no de las tres: una gráfica descarga como
  mucho la que ha elegido, y por defecto ninguna. Medir la suma diría que
  gastamos 70 KB, y nadie gasta 70 KB.
*/
const BUDGET = { js: 180 * 1024, css: 8 * 1024, font: 32 * 1024 };
const root = process.cwd();
const bundleDir = path.join(root, 'public/embed-bundle');
const fontDir = path.join(root, 'public/embed-fonts');

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

let bundle;
try {
  const manifest = JSON.parse(
    await readFile(path.join(bundleDir, 'manifest.json'), 'utf8'),
  );
  bundle = await readFile(path.join(bundleDir, manifest.file));
} catch {
  console.error('✗ No hay bundle. Ejecuta `npm run build:embed` primero.');
  process.exit(1);
}

/* Lo MISMO que envía el servidor, no el fuente: medir el fichero con sus
   comentarios era medir algo que nadie descarga. Se importa la función en vez
   de copiarla — con dos copias, la medida y la realidad se separan al primer
   cambio. */
const css = minifyCss(
  await readFile(path.join(root, 'src/styles/embed.css'), 'utf8'),
);
const source = bundle.toString('utf8');

/*
  Terceros: el embed no hace NI UNA petición fuera de nuestro origen (ADR 0005).
  Buscar URLs absolutas en el bundle es una red tosca pero efectiva: si alguien
  añade una fuente de Google o un HDRI de un CDN, aparece aquí.
*/
const externalUrls = [...new Set(source.match(/https?:\/\/[a-z0-9.-]+/gi) ?? [])].filter(
  (url) => !url.includes('voluma.app') && !url.includes('www.w3.org'),
);

/*
  Las tipografías OPCIONALES. Se mide la más gorda contra el tope de una sola,
  porque eso es lo que llega a descargar una gráfica: la que haya elegido.

  Ya vienen en woff2, que es Brotli por dentro: comprimirlas otra vez no diría
  nada, así que se mide el fichero tal cual.
*/
let fontPeor = 0;
let fontNombre = '—';
try {
  const manifest = JSON.parse(
    await readFile(path.join(fontDir, 'manifest.json'), 'utf8'),
  );
  for (const voz of Object.values(manifest)) {
    /* El corte `base` es el que descarga cualquiera que elija esa voz. El `ext`
       solo cae con texto polaco, checo o turco, así que no es el caso a medir:
       lo que se vigila es lo que paga la gráfica típica. */
    const base = voz.slices[0];
    const size = (await readFile(path.join(fontDir, base.file))).length;
    if (size > fontPeor) {
      fontPeor = size;
      fontNombre = voz.family;
    }
  }
} catch {
  /* Sin build de fuentes no hay nada que medir: el embed cae a las del sistema
     y sigue siendo una petición. */
}

const checks = [
  ['JS del bundle (gzip)', gzipSync(bundle).length, BUDGET.js, kb],
  ['CSS, va inline en el HTML', Buffer.byteLength(css), BUDGET.css, kb],
  [`Tipografía, solo si se pide (${fontNombre})`, fontPeor, BUDGET.font, kb],
  ['URLs a terceros en el bundle', externalUrls.length, 0, String],
];

console.log('\n  /embed contra el presupuesto\n');
let failed = false;

for (const [name, actual, limit, format] of checks) {
  const ok = actual <= limit;
  if (!ok) failed = true;
  console.log(
    `  ${ok ? '✓' : '✗'} ${name.padEnd(30)} ${format(actual).padStart(10)} / ${format(limit)}`,
  );
}

if (externalUrls.length > 0) {
  console.log('\n  URLs externas encontradas (prohibidas, ADR 0005):');
  for (const url of externalUrls) console.log(`    · ${url}`);
}

// Aviso, no fallo: no hay presupuesto formal de peticiones al bundle todavía.
const files = (await readdir(bundleDir)).filter((f) => f.endsWith('.js'));
console.log(`\n  ${files.length} archivo(s) JS · 1 petición desde el HTML\n`);

console.log(
  failed
    ? '  FUERA DE PRESUPUESTO. Ver docs/PERFORMANCE-BUDGET.md\n'
    : '  Dentro de presupuesto.\n',
);

process.exit(failed ? 1 : 0);
