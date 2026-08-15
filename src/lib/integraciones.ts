import type { ChartConfig } from './config/schema';

/*
  ══════════════════════════════════════════════════════════════════════════
  PÁGINAS DE INTEGRACIÓN
  ══════════════════════════════════════════════════════════════════════════

  Una página por sitio donde se puede incrustar una gráfica. Buscan tráfico de
  intención alta: quien escribe «3d pie chart in Notion» tiene un problema
  concreto y prisa, y no hay forma de llegarle desde la portada.

  ── LAS CUATRO REGLAS QUE LAS SEPARAN DEL SPAM ───────────────────────────

  Google persigue desde 2024 el «scaled content abuse»: muchas páginas salidas
  de una plantilla que sólo cambian una palabra. No es una zona gris, es una
  política con desindexación detrás. Así que:

  1. UNA PÁGINA POR PLATAFORMA, no una por combinación. La tentación es cruzar
     siete plataformas por cuatro tipos de gráfica y publicar veintiocho
     páginas. Eso es exactamente el patrón que se penaliza. Siete páginas buenas
     valen más, y cada una cubre los tipos por dentro.

  2. CADA UNA LLEVA UNA GRÁFICA DE VERDAD FUNCIONANDO. Es la ventaja injusta de
     este producto: casi todas las páginas de este tipo son texto alrededor de
     una palabra clave; éstas llevan un `/embed` en vivo, interactivo, con datos
     pensados para quien usa esa herramienta. Deja de ser una plantilla
     rellenada y pasa a ser una demostración.

  3. EL CONTENIDO ES DISTINTO DE VERDAD, no el mismo con el nombre cambiado.
     Los pasos de WordPress no son los de Framer. Los límites tampoco. Y los
     datos del ejemplo cambian porque quien monta una web en Webflow y quien
     escribe una wiki en Confluence no miran las mismas cifras.

  4. SE ESCRIBEN A MANO. Este fichero no se genera desde una lista de palabras
     clave: añadir una plataforma es sentarse a escribirla. Si algún día esto se
     convierte en un bucle sobre un array de nombres, la estrategia se ha roto.

  ── Y LO MÁS IMPORTANTE: SÓLO SE PROMETE LO QUE PASA ─────────────────────

  `desplegado` dice si esa plataforma convierte la URL a secas en una gráfica.
  Está en `false` mientras nadie lo haya PROBADO ahí, y con `false` la página
  explica el bloque de incrustar —que funciona en todas partes, siempre— sin
  prometer el despliegue automático.

  No es prudencia excesiva: una página de integración recibe a alguien decidido
  que lo prueba en el momento. Si no le sale, no vuelve, y encima se lo cuenta a
  alguien. Vale mil veces más una página que dice «mete un bloque Embed» y
  funciona, que una que dice «pega la URL» y falla.
*/

export type Paso = { titulo: string; texto: string };

export type Integracion = {
  /** Trozo final de la URL. En inglés: estas páginas buscan consultas en inglés. */
  slug: string;
  plataforma: string;
  /** Lo que va en el `<title>` y en el `<h1>`. Lleva la consulta, sin forzarla. */
  titulo: string;
  descripcion: string;
  entradilla: string;
  /** La gráfica que se ve viva en la página. Datos pensados para quien usa esto. */
  ejemplo: { titulo: string; config: ChartConfig };
  pasos: Paso[];
  /**
   * ¿Convierte esta plataforma una URL pegada a secas en la gráfica?
   *
   * `false` hasta que alguien lo pruebe AHÍ. Ver la nota de arriba: con `false`
   * la página no lo promete y explica el camino que siempre funciona.
   */
  desplegado: boolean;
  limites: string[];
  /** Fuera del sitemap y sin enlazar mientras esté en `false`. */
  publicada: boolean;
};

const grafica = (
  type: ChartConfig['type'],
  labels: string[],
  values: number[],
  extra: Partial<ChartConfig> = {},
): ChartConfig => ({
  v: 1,
  type,
  theme: 'aurora',
  data: { labels, series: [{ values }] },
  scene: { background: { kind: 'transparent' } },
  labels: { show: true, mode: 'outside', showValues: true, showPercent: true },
  motion: { autoRotate: true, speed: 3 },
  ...extra,
});

export const INTEGRACIONES: Integracion[] = [
  {
    slug: '3d-charts-in-notion',
    plataforma: 'Notion',
    titulo: '3D charts in Notion',
    descripcion:
      'Put an interactive 3D pie, donut or bar chart inside a Notion page with a link. No plugin, no account, and it keeps working when you share the page.',
    entradilla:
      'Notion renders images beautifully and charts not at all. The usual answer is to screenshot a spreadsheet and paste the picture — which is fine until the numbers change, and the numbers always change. A Volumine chart lives at a URL, so the page holds the chart itself instead of a photograph of it.',
    ejemplo: {
      titulo: 'Roadmap effort by area',
      config: grafica(
        'donut',
        ['Product', 'Infra', 'Design', 'Support', 'Ops'],
        [38, 24, 18, 12, 8],
      ),
    },
    pasos: [
      {
        titulo: 'Copy the link from the editor',
        texto:
          'Build your chart at volumine.app/crear and press Copy link. The whole chart travels inside that URL — the data, the colours, the camera angle — so there is nothing else to save or upload.',
      },
      {
        titulo: 'Type /embed on a Notion page',
        texto:
          'Notion opens a small box asking for a link. Paste the URL there and press Embed link. The chart appears in the page as a block you can drag and resize like any other.',
      },
      {
        titulo: 'Give it some height',
        texto:
          'Drag the bottom edge of the block until the chart has room. Width takes care of itself — the chart fits whatever column Notion gives it — but no embed can guess how tall you want it.',
      },
    ],
    desplegado: false,
    limites: [
      'Notion embeds do not print. Exporting the page to PDF leaves a blank space where the chart is — that is a limitation of Notion embeds in general, not of this chart.',
      'A chart made without an account lives entirely in its link. If you edit the data you get a different link, and you have to paste the new one. With a free account the link stays the same and updates in place.',
      'Anyone who can open the Notion page can open the chart. Volumine has no access control of its own: if a page is public, the chart in it is public.',
    ],
    publicada: true,
  },

  {
    slug: '3d-charts-in-confluence',
    plataforma: 'Confluence',
    titulo: '3D charts in Confluence',
    descripcion:
      'Embed an interactive 3D chart in a Confluence page. 148 KB, one request, zero cookies — it adds nothing to your privacy policy.',
    entradilla:
      'Confluence pages are where numbers go to be argued about, and a flat screenshot from last quarter is a bad way to argue. This puts a live chart in the page. It matters here more than anywhere else that the thing loads fast and calls nobody: an internal wiki page that pulls a heavy third-party widget is a page that IT eventually asks you to remove.',
    ejemplo: {
      titulo: 'Incidents by cause, last quarter',
      config: grafica(
        'bar',
        ['Deploy', 'Config', 'Upstream', 'Capacity', 'Human'],
        [17, 12, 9, 6, 4],
        { style: { height: 0.5 } },
      ),
    },
    pasos: [
      {
        titulo: 'Copy the link from the editor',
        texto:
          'Make the chart at volumine.app/crear and press Copy link. Nothing gets installed on your instance and no app needs approving — the chart is just a URL.',
      },
      {
        titulo: 'Insert an embed on the page',
        texto:
          'While editing a Confluence page, paste the URL on its own line. Confluence offers to display it; choose the embed option rather than plain link. If your instance does not offer it, use Insert → Other macros → Iframe and paste the same URL.',
      },
      {
        titulo: 'Check it inside the sandbox',
        texto:
          'Confluence Cloud loads embeds in a sandboxed frame, which breaks a lot of widgets. This one is built for it and is tested that way on every release — but load the published page once to be sure, because instance policies differ.',
      },
    ],
    desplegado: false,
    limites: [
      'Some Confluence instances block third-party iframes entirely by policy. If yours does, no embed of any kind will work and there is nothing to configure on our side.',
      'The chart is served from volumine.app. If your wiki is behind a network that cannot reach the public internet, it will not load.',
      'Confluence page exports to PDF do not include embeds.',
    ],
    publicada: true,
  },

  {
    slug: '3d-charts-in-webflow',
    plataforma: 'Webflow',
    titulo: '3D charts in Webflow',
    descripcion:
      'Add an interactive 3D chart to a Webflow site with an Embed element. One request, 148 KB, and it does not touch your page speed score the way a chart library would.',
    entradilla:
      'On a marketing site the chart is decoration with a job: it has to look expensive and it must not cost you the page speed you spent a week earning. A charting library pulls hundreds of kilobytes of JavaScript into your bundle. This is one iframe that loads one file and nothing else, and it is not in your bundle at all.',
    ejemplo: {
      titulo: 'Where the traffic came from',
      config: grafica(
        'pie',
        ['Organic', 'Direct', 'Referral', 'Social', 'Email'],
        [44, 23, 15, 11, 7],
      ),
    },
    pasos: [
      {
        titulo: 'Copy the link from the editor',
        texto:
          'Build the chart at volumine.app/crear and press Copy link — or press the small iframe button next to it, which copies the whole tag ready to paste.',
      },
      {
        titulo: 'Drop in an Embed element',
        texto:
          'In the Webflow designer, Add panel → Components → Embed. Paste the iframe tag into the code box and save. The chart renders straight away in the designer, not only on the published site.',
      },
      {
        titulo: 'Let it size itself',
        texto:
          'Set the Embed element to 100% width and give it a fixed height, or wrap it in a div with an aspect ratio. The chart fills whatever box it is given and re-renders when the box changes, so it handles breakpoints without extra work.',
      },
    ],
    desplegado: false,
    limites: [
      'Webflow Embed elements do not render in the designer preview on the free plan in some cases. Publish to a staging domain to see it.',
      'The chart is an iframe, so it will not inherit your site fonts. Pick the chart typeface in the editor instead.',
      'It needs WebGL. On a device without it the embed falls back to a static image of the same chart rather than an empty box.',
    ],
    publicada: true,
  },

  {
    slug: '3d-charts-in-wordpress',
    plataforma: 'WordPress',
    titulo: '3D charts in WordPress',
    descripcion:
      'Embed an interactive 3D chart in a WordPress post without installing a plugin. One Custom HTML block and you are done.',
    entradilla:
      'Every WordPress charting solution starts by asking you to install a plugin, and every plugin you install is one more thing that updates itself badly on a Tuesday. This needs none: it is an iframe in a Custom HTML block. Nothing runs on your server, nothing lands in your database, and there is nothing to keep updated.',
    ejemplo: {
      titulo: 'Reader devices this year',
      config: grafica('donut', ['Mobile', 'Desktop', 'Tablet', 'Other'], [61, 29, 8, 2]),
    },
    pasos: [
      {
        titulo: 'Copy the iframe from the editor',
        texto:
          'At volumine.app/crear, next to Copy link there is a small iframe button. It copies the complete tag, already sized and with a title attribute for screen readers.',
      },
      {
        titulo: 'Add a Custom HTML block',
        texto:
          'In the block editor press / and choose Custom HTML. Paste the tag. Use the Preview tab to check it before publishing — the editor itself shows the raw code, which is expected.',
      },
      {
        titulo: 'Classic editor: use the Text tab',
        texto:
          'If you are on the classic editor, switch from Visual to Text and paste the tag there. Pasting it in Visual will escape the angle brackets and print the code as words.',
      },
    ],
    desplegado: false,
    limites: [
      'Some managed WordPress hosts strip iframes from post content for security. If the tag disappears on save, that is your host, and the fix is on their side.',
      'A Custom HTML block will not render inside AMP pages.',
      'Caching plugins sometimes serve an old version of the post. Purge the cache if you swap a chart and the previous one keeps appearing.',
    ],
    publicada: true,
  },

  {
    slug: '3d-charts-in-framer',
    plataforma: 'Framer',
    titulo: '3D charts in Framer',
    descripcion:
      'Put a live 3D chart in a Framer site with the Embed component. It weighs 148 KB and makes exactly one request.',
    entradilla:
      'Framer sites are usually built by people who care what things look like, and most chart embeds look like a spreadsheet took a holiday. This one is a lit, bevelled object with a real shadow — and it is still a chart, with the numbers next to each piece. It sits in an Embed component and behaves like any other layer.',
    ejemplo: {
      titulo: 'Design time by phase',
      config: grafica(
        'bar',
        ['Research', 'Concept', 'Craft', 'Handoff'],
        [22, 31, 34, 13],
        { style: { height: 0.5 } },
      ),
    },
    pasos: [
      {
        titulo: 'Copy the link from the editor',
        texto:
          'Make the chart at volumine.app/crear and press Copy link. Pick a transparent background in the editor if you want it to sit directly on your page colour.',
      },
      {
        titulo: 'Insert an Embed component',
        texto:
          'In Framer, Insert → Utility → Embed. Choose URL and paste the link, or choose HTML and paste the iframe tag if you want to control the attributes yourself.',
      },
      {
        titulo: 'Set the frame, not the chart',
        texto:
          'Resize the Embed layer like any other layer. The chart measures its container and redraws, so it follows your breakpoints without a second version.',
      },
    ],
    desplegado: false,
    limites: [
      'Framer previews embeds only on the published site in some plans; in the canvas you may see a placeholder.',
      'A transparent chart takes the colour of whatever is behind it. On a busy background the labels get harder to read — the editor has a solid label style for exactly that.',
      'Framer page transitions can remount the embed, which restarts the entrance animation. Turn the entrance off in the editor if that bothers you.',
    ],
    publicada: true,
  },

  {
    slug: '3d-charts-in-canva',
    plataforma: 'Canva',
    titulo: '3D charts in Canva',
    descripcion:
      'Drop a live 3D chart into a Canva presentation with the Embed app. It keeps spinning while you present.',
    entradilla:
      'Canva has charts, and they are flat pictures. In a presentation that is usually fine — until the slide is the whole argument, and a flat pie of five numbers is not going to carry it. A Volumine chart goes in as an embed and stays live: it turns while you talk, which is the difference between a slide people look at and a slide people watch.',
    ejemplo: {
      titulo: 'Budget split',
      config: grafica(
        'pie',
        ['Salaries', 'Tooling', 'Marketing', 'Travel', 'Other'],
        [52, 18, 17, 8, 5],
      ),
    },
    pasos: [
      {
        titulo: 'Copy the link from the editor',
        texto:
          'Build the chart at volumine.app/crear and press Copy link. A dark background usually reads better on a slide than a transparent one — pick it in the editor before copying.',
      },
      {
        titulo: 'Use the Embed app',
        texto:
          'In Canva, Apps → Embed. Paste the URL and press Add to design. The chart appears as an element you can move and resize on the slide.',
      },
      {
        titulo: 'Present, do not export',
        texto:
          'The chart is live in Present mode. If you export the design to PDF or PNG, Canva flattens it into a still image of whatever angle it was at — which is fine, but it stops turning.',
      },
    ],
    desplegado: false,
    limites: [
      'Exported PDFs and images are flat. The chart only moves in Present mode or in a shared link that opens in the browser.',
      'Canva embeds need a network connection while presenting. Offline, the slide shows an empty frame.',
      'Embedded elements cannot be animated with Canva transitions the way native elements can.',
    ],
    publicada: true,
  },
];

export const integracionPorSlug = (slug: string) =>
  INTEGRACIONES.find((i) => i.slug === slug && i.publicada) ?? null;

export const integracionesPublicadas = () => INTEGRACIONES.filter((i) => i.publicada);
