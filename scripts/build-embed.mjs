#!/usr/bin/env node
/**
 * Empaqueta el cliente de /embed como bundle independiente.
 *
 * No pasa por Next a propósito: así no arrastra React ni el runtime del App
 * Router, que son ~110 KB gz que no caben en el presupuesto (ADR 0006).
 *
 * Salida: public/embed-bundle/voluma.<hash>.js + manifest.json
 */
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'public/embed-bundle');

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const tmp = path.join(outDir, 'voluma.tmp.js');

await build({
  entryPoints: [path.join(root, 'src/embed/main.ts')],
  outfile: tmp,
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  platform: 'browser',
  legalComments: 'none',
  // Imports nombrados + sideEffects:false de three = tree-shaking de verdad.
  // Con `import * as THREE` no se poda nada: ese fue el hallazgo de la ADR 0006.
  treeShaking: true,
  alias: { '@': path.join(root, 'src') },
  define: { 'process.env.NODE_ENV': '"production"' },
});

const code = await readFile(tmp);
const hash = createHash('sha256').update(code).digest('hex').slice(0, 10);
const file = `voluma.${hash}.js`;

await writeFile(path.join(outDir, file), code);
await rm(tmp);
await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify({ file }, null, 2));

const gz = gzipSync(code).length;
const budget = 180 * 1024;
const pct = ((gz / budget) * 100).toFixed(0);

console.log(
  `  embed bundle  ${(gz / 1024).toFixed(1)} KB gz  (${(code.length / 1024).toFixed(0)} KB min)  ` +
    `— ${pct}% del presupuesto de 180 KB`,
);

if (gz > budget) {
  console.error(
    '\n  ✗ El bundle de /embed se pasa del presupuesto. Ver docs/PERFORMANCE-BUDGET.md\n',
  );
  process.exit(1);
}
