import { chromium } from 'playwright';
import { readFile, mkdir, rename, readdir } from 'node:fs/promises';

/*
  ══════════════════════════════════════════════════════════════════════════
  EL MOMENTO DEL LINK — vídeo de ~16 s
  ══════════════════════════════════════════════════════════════════════════

  Copias el link, lo pegas en otra página y ahí está la gráfica girando. Es lo
  único que este producto hace y que ningún generador de gráficas puede enseñar,
  así que el vídeo no cuenta nada más.

  ── SE GRABA LA APP DE VERDAD, DECORADA POR ENCIMA ───────────────────────

  El primer intento metía `volumine.app/crear` en un `<iframe>` dentro de un
  escenario propio. No se puede: `next.config.ts` manda `X-Frame-Options:
  SAMEORIGIN` en todo lo que no es `/embed`, así que el marco salía en blanco.
  Y está bien que lo mande — lo enmarcable a propósito es el embed y nada más.

  Así que el escenario se INYECTA sobre la página real: el fondo con luz, la
  ventana con su sombra y los rótulos son CSS metido encima de `volumine.app`.
  Lo que se ve debajo es la aplicación, no una maqueta. El botón lo pulsa
  Playwright de verdad, y el «Copied» que aparece es el estado real del
  componente. La URL de la barra de compartir es la que genera la app.

  Como todo pasa dentro de `volumine.app`, el `/embed` del segundo acto es del
  mismo origen y se puede incrustar sin pelearse con nada.

  ── POR QUÉ HAY VENTANA Y FONDO ──────────────────────────────────────────

  Una captura a pantalla completa se ve como una captura de pantalla. El marco,
  la luz y la sombra son lo que la separa del ruido y hacen que se lea como un
  objeto — es lo que hacen shots.so y las presentaciones de Apple.

  El cursor es dibujado: el de verdad no sale en las grabaciones de Chromium, y
  sin cursor el clic parece que ocurre solo.

  ── SALE EN WEBM ─────────────────────────────────────────────────────────

  Es lo único que graba Chromium. Para X hay que pasarlo a MP4; cualquier editor
  lo hace, y Descript al publicar también.

      npm run x:video
*/

const ANCHO = 1920;
const ALTO = 1080;
const SITIO = process.env.OG_URL ?? 'https://volumine.app';

/* Márgenes de la ventana dentro del encuadre. Generosos: el aire alrededor es
   la mitad del efecto, y apretarlo lo convierte otra vez en una captura. */
const M = { x: 130, arriba: 104, abajo: 150, barra: 46 };

const lz = (await import('lz-string')).default ?? (await import('lz-string'));
const CONFIG = {
  v: 1,
  type: 'donut',
  theme: 'aurora',
  data: {
    labels: ['Subscriptions', 'Services', 'Licences', 'Training', 'Other'],
    series: [{ values: [42, 26, 17, 9, 6] }],
  },
  scene: { background: { kind: 'transparent' } },
  layout: { watermark: false },
  labels: {
    show: true,
    mode: 'outside',
    showValues: true,
    showPercent: true,
    finish: 'solid',
  },
  /* Lenta: a 4 vueltas por minuto da una vuelta cada quince segundos, y ahí se
     ve caro. El GIF iba a veinticinco y parecía nervioso. */
  motion: { autoRotate: true, speed: 4, entrance: 'grow' },
};
const EMBED = `${SITIO}/embed?c=${lz.compressToEncodedURIComponent(JSON.stringify(CONFIG))}`;

const marca = (await readFile('src/app/icon.svg', 'utf8'))
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/@media \(prefers-color-scheme: dark\) \{[^}]*\}[^}]*\}/g, '')
  .replace('<svg', '<svg width="30" height="30"');

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Instrument+Sans:wght@400;500;600&display=swap');

  html, body {
    /* Luz de arriba a la izquierda, como en la landing: es lo que hace que la
       ventana parezca apoyada en algo y no flotando en un color plano. */
    background: radial-gradient(120% 90% at 12% -10%,
      #ffffff 0%, #f4f3fb 38%, #e7e6f4 70%, #dcdaee 100%) !important;
    overflow: hidden !important;
  }

  /* El marco: radio grande y sombra baja y muy difusa. Es la diferencia entre
     «captura de pantalla» y «producto fotografiado». */
  #vm-marco {
    position: fixed; z-index: 5;
    left: ${M.x}px; top: ${M.arriba}px;
    width: ${ANCHO - M.x * 2}px; height: ${ALTO - M.arriba - M.abajo}px;
    border-radius: 18px; background: #f7f7fa;
    box-shadow:
      0 2px 4px rgba(24,24,48,.06),
      0 18px 40px -12px rgba(24,24,48,.22),
      0 64px 110px -44px rgba(24,24,48,.44),
      inset 0 0 0 1px rgba(18,18,32,.07);
    opacity: 0; transform: translateY(16px) scale(.985);
    transition: opacity .8s cubic-bezier(.22,1,.36,1), transform .8s cubic-bezier(.22,1,.36,1);
  }
  body.vm-on #vm-marco { opacity: 1; transform: none; }

  #vm-barra {
    height: ${M.barra}px; display: flex; align-items: center; gap: 14px; padding: 0 16px;
    border-bottom: 1px solid rgba(18,18,32,.08);
    font-family: 'Instrument Sans', system-ui, sans-serif;
  }
  #vm-barra .luz { width: 12px; height: 12px; border-radius: 50%; display: block; }
  #vm-url {
    flex: 1; height: 28px; border-radius: 8px; background: #ececf1;
    display: flex; align-items: center; padding: 0 12px;
    font-size: 13px; color: #5a5a6b; letter-spacing: -.01em;
  }

  /* La aplicación de verdad, recolocada dentro del marco. No se reparenta —eso
     recrearía el canvas y perdería el contexto WebGL—: se le da el hueco. */
  .editor {
    position: fixed !important; z-index: 6;
    left: ${M.x}px !important; top: ${M.arriba + M.barra}px !important;
    width: ${ANCHO - M.x * 2}px !important;
    height: ${ALTO - M.arriba - M.abajo - M.barra}px !important;
    border-radius: 0 0 18px 18px !important; overflow: hidden !important;
    opacity: 0; transform: translateY(16px) scale(.985);
    transition: opacity .8s cubic-bezier(.22,1,.36,1), transform .8s cubic-bezier(.22,1,.36,1);
  }
  body.vm-on .editor { opacity: 1; transform: none; }

  /* ── el documento del segundo acto ─────────────────────────────────── */
  #vm-doc {
    position: fixed; z-index: 7;
    left: ${M.x}px; top: ${M.arriba + M.barra}px;
    width: ${ANCHO - M.x * 2}px; height: ${ALTO - M.arriba - M.abajo - M.barra}px;
    border-radius: 0 0 18px 18px; overflow: hidden;
    background: #fff; padding: 54px 96px;
    font-family: 'Instrument Sans', system-ui, sans-serif;
    opacity: 0; transition: opacity .6s ease; pointer-events: none;
  }
  #vm-doc.dentro { opacity: 1; }
  #vm-doc h2 {
    font-family: 'Bricolage Grotesque', sans-serif;
    font-size: 36px; letter-spacing: -.03em; font-weight: 800; color: #15151f; margin: 0;
  }
  #vm-doc p { margin: 14px 0 0; font-size: 18px; line-height: 1.6; color: #6a6a7d; max-width: 60ch; }
  #vm-pegado {
    margin-top: 24px; font-family: ui-monospace, Menlo, monospace;
    font-size: 15px; color: #6d5cff; white-space: nowrap; overflow: hidden;
    border-right: 2px solid transparent; padding-right: 2px; width: fit-content;
  }
  #vm-pegado.escribe { border-right-color: #6d5cff; animation: vmLatido .7s step-end infinite; }
  @keyframes vmLatido { 50% { border-right-color: transparent; } }
  #vm-marco-grafica {
    /* Ancho de la columna de texto, no de la ventana: a todo lo ancho la
       gráfica quedaba pequeña en medio de una franja negra enorme y las
       etiquetas se iban a los extremos. */
    margin-top: 20px; max-width: 1000px; height: 500px;
    border-radius: 14px; overflow: hidden; background: #101017;
    opacity: 0; transform: scale(.97);
    transition: opacity .6s cubic-bezier(.22,1,.36,1), transform .6s cubic-bezier(.22,1,.36,1);
  }
  #vm-marco-grafica.dentro { opacity: 1; transform: none; }
  #vm-marco-grafica iframe { width: 100%; height: 100%; border: 0; display: block; }

  /* ── cursor dibujado ───────────────────────────────────────────────── */
  #vm-raton {
    position: fixed; left: 0; top: 0; width: 28px; height: 28px; z-index: 25;
    pointer-events: none; filter: drop-shadow(0 3px 6px rgba(0,0,0,.38));
    transition: transform 1.15s cubic-bezier(.33,.9,.28,1);
  }

  /* ── rótulos ───────────────────────────────────────────────────────── */
  #vm-rotulo {
    position: fixed; left: 0; right: 0; bottom: 52px; text-align: center; z-index: 25;
    /* Sin esto, una capa invisible a pantalla completa se traga el clic del
       botón: Playwright avisaba con «intercepts pointer events». Todo lo que se
       superpone aquí es decorado, y el decorado no se toca. */
    pointer-events: none;
    font-family: 'Bricolage Grotesque', sans-serif;
    font-size: 46px; font-weight: 800; letter-spacing: -.038em; color: #14141f;
    opacity: 0; transform: translateY(12px);
    transition: opacity .5s ease, transform .5s cubic-bezier(.22,1,.36,1);
  }
  #vm-rotulo.visible { opacity: 1; transform: none; }

  #vm-cierre {
    position: fixed; inset: 0; z-index: 30; pointer-events: none;
    display: flex; align-items: center; justify-content: center; gap: 18px;
    background: radial-gradient(120% 90% at 12% -10%,
      #ffffff 0%, #f4f3fb 38%, #e7e6f4 70%, #dcdaee 100%);
    font-family: 'Bricolage Grotesque', sans-serif;
    font-size: 56px; font-weight: 800; letter-spacing: -.04em; color: #14141f;
    opacity: 0; transition: opacity .8s ease;
  }
  #vm-cierre.visible { opacity: 1; }
`;

const MONTAJE = (svgMarca) => `
  const d = document;
  const div = (id, html) => {
    const e = d.createElement('div');
    e.id = id; e.innerHTML = html || '';
    d.body.appendChild(e); return e;
  };

  div('vm-marco',
    '<div id="vm-barra">' +
      '<div style="display:flex;gap:8px">' +
        '<i class="luz" style="background:#ff5f57"></i>' +
        '<i class="luz" style="background:#febc2e"></i>' +
        '<i class="luz" style="background:#28c840"></i>' +
      '</div><div id="vm-url">volumine.app/crear</div></div>');

  div('vm-doc',
    '<h2>Q3 revenue review</h2>' +
    '<p>Subscriptions carried the quarter again. The breakdown below updates on its own whenever the numbers change \\u2014 nothing to re-export.</p>' +
    '<div id="vm-pegado"></div>' +
    '<div id="vm-marco-grafica"></div>');

  div('vm-rotulo');
  div('vm-cierre', ${JSON.stringify(svgMarca)} + '<span>volumine.app</span>');

  const raton = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
  raton.id = 'vm-raton';
  raton.setAttribute('viewBox', '0 0 24 24');
  raton.innerHTML = '<path d="M5 2.5 L5 18.5 L9.2 14.6 L11.9 20.8 L14.6 19.6 L11.9 13.6 L17.6 13.3 Z" fill="#fff" stroke="#16161f" stroke-width="1.4" stroke-linejoin="round"/>';
  d.body.appendChild(raton);

  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const punto = (x, y) => { raton.style.transform = 'translate(' + x + 'px,' + y + 'px)'; };
  /* Empieza lejos del botón para que el primer movimiento se vea. */
  punto(${Math.round(ANCHO * 0.4)}, ${Math.round(ALTO * 0.6)});

  window.vm = {
    entrar() { d.body.classList.add('vm-on'); },
    apuntar(x, y) { punto(x - 5, y - 4); },
    rotulo(t) { const r = d.getElementById('vm-rotulo'); r.textContent = t; r.classList.add('visible'); },
    sinRotulo() { d.getElementById('vm-rotulo').classList.remove('visible'); },

    aDocumento() {
      d.getElementById('vm-url').textContent = 'your-doc.com/q3-review';
      d.getElementById('vm-doc').classList.add('dentro');
      raton.style.opacity = '0';
    },

    async teclear(link) {
      const caja = d.getElementById('vm-pegado');
      caja.classList.add('escribe');
      /* Letra a letra y rápido: pegado de golpe no se lee como una acción, y a
         velocidad de mecanografía real se comería el vídeo entero. */
      for (let i = 1; i <= link.length; i++) {
        caja.textContent = link.slice(0, i);
        await espera(11);
      }
      caja.classList.remove('escribe');
    },

    grafica(src) {
      const m = d.getElementById('vm-marco-grafica');
      m.innerHTML = '<iframe src="' + src + '"></iframe>';
      requestAnimationFrame(() => m.classList.add('dentro'));
    },

    cerrar() { d.getElementById('vm-cierre').classList.add('visible'); },
  };
`;

const SALIDA = 'public/_shots/video';
await mkdir(SALIDA, { recursive: true });

const navegador = await chromium.launch();
const ctx = await navegador.newContext({
  viewport: { width: ANCHO, height: ALTO },
  recordVideo: { dir: SALIDA, size: { width: ANCHO, height: ALTO } },
  colorScheme: 'light',
});
/*
  Sin esto el botón NUNCA llega a decir «Copied».

  `copy()` escribe en el portapapeles y sólo pinta el acuse si la escritura sale
  bien; en un navegador automatizado el permiso no está concedido y falla en
  silencio —el `catch` está ahí a propósito, para que un portapapeles caído no
  rompa nada—. O sea que sin conceder el permiso, el momento entero del vídeo
  ocurre y no se ve. Comprobado: con el permiso, «Copied»; sin él, «Copy link».
*/
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: SITIO });

const p = await ctx.newPage();

await p.goto(`${SITIO}/crear`, { waitUntil: 'networkidle' });

const boton = p.locator('.sharebar button').last();
await boton.waitFor({ state: 'visible', timeout: 60000 });

await p.addStyleTag({ content: CSS });
await p.evaluate(MONTAJE(marca));
/* El canvas tiene que rehacerse al hueco nuevo y la escena necesita unos
   fotogramas. Sin esta espera el primer segundo —el único que se ve seguro— es
   un rectángulo vacío. */
await p.waitForTimeout(4000);

console.log('  grabando…');

/*
  `VM_CAPTURAS=<carpeta>` hace una foto en cada compás en vez de fiarse del
  vídeo. Revisar un `.webm` cuadro a cuadro resultó ser más trabajo que la
  propia grabación —el Chromium de Playwright no trae decodificadores—, y lo que
  hace falta comprobar es la puesta en escena, que es exactamente esto.
*/
const CAPTURAS = process.env.VM_CAPTURAS;
let compas = 0;
const espera = async (ms, que) => {
  await p.waitForTimeout(ms);
  if (que) await que();
  if (CAPTURAS) {
    await p.waitForTimeout(150);
    await p.screenshot({ path: `${CAPTURAS}/paso-${String(++compas).padStart(2, '0')}.png` });
  }
};

await p.evaluate(() => window.vm.entrar());
await espera(1000);

/* Dónde está el botón DE VERDAD. Medido, no adivinado: si la barra cambia de
   sitio, el cursor va detrás. */
const caja = await boton.boundingBox();
await p.evaluate(
  ([x, y]) => window.vm.apuntar(x, y),
  [caja.x + caja.width / 2, caja.y + caja.height / 2],
);
await espera(1450);

await boton.click();
await espera(450, () => p.evaluate(() => window.vm.rotulo('Copy the link.')));
await espera(1950, () => p.evaluate(() => window.vm.sinRotulo()));

await espera(550);
await p.evaluate(() => window.vm.aDocumento());
await espera(700);
/* Se teclea un link ABREVIADO: el de verdad son cientos de caracteres de config
   comprimida y llenaría la pantalla de ruido. La forma es la real. */
await p.evaluate(() => window.vm.teclear('https://volumine.app/embed/q3-revenue'));
await espera(500);
await p.evaluate((src) => window.vm.grafica(src), EMBED);
await espera(900, () => p.evaluate(() => window.vm.rotulo('Paste it anywhere.')));
await espera(2700, () => p.evaluate(() => window.vm.sinRotulo()));

/* Un respiro girando antes del cierre: es el plano que se recuerda. */
await espera(3000);
await p.evaluate(() => window.vm.cerrar());
await espera(2300);

await ctx.close();
await navegador.close();

const previos = await readdir(SALIDA);
const nuevo = previos.filter((f) => f.endsWith('.webm')).pop();
await rename(`${SALIDA}/${nuevo}`, `${SALIDA}/volumine-el-link.webm`);
console.log(`${SALIDA}/volumine-el-link.webm  ${ANCHO}×${ALTO}`);
