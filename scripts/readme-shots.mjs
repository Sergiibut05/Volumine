import { chromium } from 'playwright';
import { copyFile, mkdir, stat } from 'node:fs/promises';

/*
  Las capturas del README.

  Se sacan de la app DE VERDAD, no de un mockup: contra `next start` en local
  (el servidor de desarrollo de esta máquina no hidrata, ver docs/STATE.md) o
  contra producción con `README_URL=https://volumine.app`.

      npm run build && npx next start -p 3100
      npm run readme:shots

  Salen a `docs/readme/`, que SÍ se versiona: el README las enlaza en relativo
  y GitHub las sirve desde el propio repo.
*/

const BASE = process.env.README_URL ?? 'http://localhost:3100';
const SALIDA = 'docs/readme';
await mkdir(SALIDA, { recursive: true });

const navegador = await chromium.launch();

/* El 3D necesita un momento después de `networkidle`: el embed monta su
   canvas al entrar en viewport y la entrada anima. */
const RESPIRO = 2500;

async function pagina({ ancho = 1440, alto = 900, idioma = 'en-GB', escala = 1 } = {}) {
  const contexto = await navegador.newContext({
    viewport: { width: ancho, height: alto },
    deviceScaleFactor: escala,
    locale: idioma,
    extraHTTPHeaders: { 'accept-language': idioma },
    reducedMotion: 'no-preference',
  });
  return contexto.newPage();
}

async function guardar(nombre, captura) {
  const ruta = `${SALIDA}/${nombre}`;
  await captura(ruta);
  const { size } = await stat(ruta);
  console.log(`${ruta}  ${(size / 1024).toFixed(0)} KB`);
}

/* 1 — La portada, primera pantalla. */
{
  const p = await pagina();
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(RESPIRO);
  await guardar('landing.png', (path) => p.screenshot({ path }));
  await p.close();
}

/* 2 — La galería de tipos. Cada tarjeta monta su 3D al entrar en viewport, así
   que se baja hasta ella y se espera. */
{
  const p = await pagina({ alto: 1400 });
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const galeria = p.locator('.gallery');
  await galeria.scrollIntoViewIfNeeded();
  await p.waitForTimeout(RESPIRO * 1.6);
  await guardar('chart-types.png', (path) => galeria.screenshot({ path }));
  await p.close();
}

/* 3 — Dónde vive: la sección de la portada con la gráfica dentro de otras
   herramientas. */
{
  const p = await pagina({ alto: 1200 });
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const objetivo = p.locator('.enuso').first();
  await objetivo.scrollIntoViewIfNeeded();
  await p.waitForTimeout(RESPIRO * 1.6);
  await guardar('in-context.png', (path) => objetivo.screenshot({ path }));
  await p.close();
}

/* 4 — El editor. */
{
  const p = await pagina();
  await p.goto(`${BASE}/crear`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(RESPIRO * 1.4);
  await guardar('editor.png', (path) => p.screenshot({ path }));
  await p.close();
}

/* 5 — El café. */
{
  const p = await pagina({ alto: 1000 });
  await p.goto(`${BASE}/cafe`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  await guardar('coffee.png', (path) => p.screenshot({ path }));
  await p.close();
}

/* 6 — Móvil: la portada en un teléfono. */
{
  const p = await pagina({ ancho: 390, alto: 844, escala: 2 });
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(RESPIRO);
  await guardar('mobile.png', (path) => p.screenshot({ path }));
  await p.close();
}

await navegador.close();

/* El GIF del anillo girando lo genera `npm run x:gif`; si está, se copia. */
try {
  await copyFile('public/_shots/x-gif.gif', `${SALIDA}/donut-spin.gif`);
  console.log(`${SALIDA}/donut-spin.gif  (copiado de public/_shots)`);
} catch {
  console.log('Sin public/_shots/x-gif.gif: corre `npm run x:gif` para el GIF.');
}
