#!/usr/bin/env node
/**
 * Comprueba /embed contra docs/PERFORMANCE-BUDGET.md.
 *
 * Mide lo que el navegador descarga de verdad, no lo que dice un manifest: monta
 * el servidor de producción, carga la ruta con Chromium y suma el tamaño
 * transferido por tipo de recurso. Es la única medida que no miente cuando
 * cambia la versión de Next o la estrategia de chunking.
 *
 * Sale con código 1 si se pasa del presupuesto. No es un aviso, es un error:
 * si esto se convierte en algo que se ignora, el presupuesto no existe.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const BUDGET = {
  js: 180 * 1024,
  css: 8 * 1024,
  requests: 3,
  thirdParty: 0,
  fonts: 0,
};

const PORT = 4599;
const ORIGIN = `http://127.0.0.1:${PORT}`;

// Un config representativo: 5 sectores, nada exótico.
const CONFIG = {
  v: 1,
  type: 'donut',
  data: {
    labels: ['Suscripciones', 'Servicios', 'Licencias', 'Formación', 'Otros'],
    series: [{ values: [42, 26, 17, 9, 6] }],
  },
};

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(ORIGIN, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return true;
    } catch {
      /* todavía arrancando */
    }
    await sleep(400);
  }
  return false;
}

const server = spawn('npx', ['next', 'start', '--port', String(PORT)], {
  stdio: 'ignore',
  shell: process.platform === 'win32',
});

let exitCode = 0;

try {
  if (!(await waitForServer())) {
    console.error(
      '✗ el servidor de producción no arrancó. ¿Has ejecutado `npm run build`?',
    );
    process.exit(1);
  }

  // lz-string es CommonJS: en Node puro hay que pasar por el default export.
  const lz = (await import('lz-string')).default;
  const url = `${ORIGIN}/embed?c=${lz.compressToEncodedURIComponent(JSON.stringify(CONFIG))}`;

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const resources = [];
  page.on('response', async (response) => {
    const req = response.request();
    let size = 0;
    try {
      size = Number((await response.headerValue('content-length')) ?? 0);
      if (!size) size = (await response.body()).length;
    } catch {
      /* recurso sin cuerpo accesible */
    }
    resources.push({
      url: response.url(),
      type: req.resourceType(),
      size,
      thirdParty: !response.url().startsWith(ORIGIN) && !response.url().startsWith('data:'),
    });
  });

  /* `networkidle` no sirve aquí: el canvas anima en bucle y nunca hay un
     momento de calma que Playwright reconozca. Cargamos y damos margen a que
     bajen los chunks diferidos. */
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForTimeout(2500);
  await browser.close();

  const sum = (predicate) =>
    resources.filter(predicate).reduce((total, r) => total + r.size, 0);

  const js = sum((r) => r.type === 'script');
  const css = sum((r) => r.type === 'stylesheet');
  const fonts = resources.filter((r) => r.type === 'font').length;
  const thirdParty = resources.filter((r) => r.thirdParty);
  const requests = resources.filter((r) => r.type !== 'document').length;

  const checks = [
    ['JS', js, BUDGET.js, kb],
    ['CSS', css, BUDGET.css, kb],
    ['Peticiones (sin el documento)', requests, BUDGET.requests, String],
    ['Fuentes remotas', fonts, BUDGET.fonts, String],
    ['Peticiones a terceros', thirdParty.length, BUDGET.thirdParty, String],
  ];

  console.log('\n  /embed contra el presupuesto\n');
  for (const [name, actual, limit, format] of checks) {
    const ok = actual <= limit;
    if (!ok) exitCode = 1;
    console.log(
      `  ${ok ? '✓' : '✗'} ${name.padEnd(32)} ${format(actual).padStart(10)} / ${format(limit)}`,
    );
  }

  if (thirdParty.length > 0) {
    console.log('\n  Terceros detectados (prohibido, ADR 0005):');
    for (const r of thirdParty) console.log(`    · ${r.url}`);
  }

  console.log(
    exitCode === 0
      ? '\n  Dentro de presupuesto.\n'
      : '\n  FUERA DE PRESUPUESTO. Ver docs/PERFORMANCE-BUDGET.md.\n',
  );
} finally {
  server.kill();
}

process.exit(exitCode);
