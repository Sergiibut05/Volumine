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

const BUDGET = { js: 180 * 1024, css: 8 * 1024 };
const root = process.cwd();
const bundleDir = path.join(root, 'public/embed-bundle');

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

const css = await readFile(path.join(root, 'src/styles/embed.css'), 'utf8');
const source = bundle.toString('utf8');

/*
  Terceros: el embed no hace NI UNA petición fuera de nuestro origen (ADR 0005).
  Buscar URLs absolutas en el bundle es una red tosca pero efectiva: si alguien
  añade una fuente de Google o un HDRI de un CDN, aparece aquí.
*/
const externalUrls = [...new Set(source.match(/https?:\/\/[a-z0-9.-]+/gi) ?? [])].filter(
  (url) => !url.includes('voluma.app') && !url.includes('www.w3.org'),
);

const checks = [
  ['JS del bundle (gzip)', gzipSync(bundle).length, BUDGET.js, kb],
  ['CSS, va inline en el HTML', Buffer.byteLength(css), BUDGET.css, kb],
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
