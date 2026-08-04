#!/usr/bin/env node
/**
 * Hook PostToolUse: formatea con Prettier el archivo que se acaba de escribir.
 *
 * Lo ejecuta Claude Code, no el modelo, así que es determinista: no depende de
 * que nadie "se acuerde" de formatear. Si Prettier no está instalado todavía
 * (fases tempranas del proyecto) sale en silencio sin molestar.
 *
 * Contrato: recibe por stdin un JSON con { tool_input: { file_path } }.
 * Salir con código 0 siempre — un fallo de formato no debe abortar el trabajo.
 */
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import path from 'node:path';

const EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.css', '.scss', '.md', '.mdx', '.html', '.yml', '.yaml',
]);

const read = (stream) =>
  new Promise((resolve) => {
    let data = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => (data += chunk));
    stream.on('end', () => resolve(data));
    stream.on('error', () => resolve(''));
  });

const raw = await read(process.stdin);
if (!raw.trim()) process.exit(0);

let filePath;
try {
  filePath = JSON.parse(raw)?.tool_input?.file_path;
} catch {
  process.exit(0);
}
if (!filePath || !EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
  process.exit(0);
}

// Prettier aún no instalado: no es un error, es una fase del proyecto.
const prettierBin = path.join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prettier.cmd' : 'prettier',
);
if (!existsSync(prettierBin)) process.exit(0);

execFile(prettierBin, ['--write', '--log-level', 'warn', filePath], { shell: process.platform === 'win32' }, (err, _stdout, stderr) => {
  if (err && stderr) process.stderr.write(`[format hook] ${stderr}`);
  process.exit(0);
});
