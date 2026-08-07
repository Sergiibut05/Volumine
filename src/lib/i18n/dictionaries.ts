/*
  Los textos de la INTERFAZ, en inglés y español.

  ── QUÉ SE TRADUCE Y QUÉ NO ────────────────────────────────────────────────

  Se traduce la aplicación: landing, editor, entrar, mis gráficas.

  NO se traduce la GRÁFICA. Sus etiquetas, su título y sus datos son de quien la
  hizo, y su formato de número sale de `data.format.locale`. Una gráfica hecha en
  español se ve en español la mire quien la mire — igual que un gráfico en un
  periódico no cambia de idioma según quién lo lea. Eso además mantiene la
  promesa de «mismo config, mismos píxeles» y deja el bundle del embed sin una
  sola línea de i18n, que al 82% del presupuesto importa.

  ── POR QUÉ UN OBJETO Y NO UNA LIBRERÍA ────────────────────────────────────

  `next-intl` son ~15 KB y una API que aprender para lo que aquí es un objeto
  con claves. Encaja mal en un proyecto que se escribió su propia geometría para
  no cargar echarts.

  Y ANIDADO CON ACCESO DIRECTO —`d.editor.save`— en vez de claves de texto
  —`t('editor.save')`—: así TypeScript comprueba que la clave existe y que el
  diccionario español tiene exactamente las mismas. Una traducción que falta es
  un error de compilación, no un hueco en pantalla que nadie ve hasta que un
  usuario lo reporta.
*/

export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];

/** Inglés por defecto: es el idioma de más alcance para un producto así. */
export const DEFAULT_LOCALE: Locale = 'en';

export const en = {
  common: {
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    duplicate: 'Duplicate',
    copyLink: 'Copy link',
    copy: 'Copy',
    chartTheme: 'Chart theme',
    copied: 'Copied',
    somethingFailed: 'Something went wrong.',
    back: '← Back',
    language: 'Language',
  },
  nav: {
    openEditor: 'Open the editor',
    myCharts: 'My charts',
    newChart: 'New chart',
    signOut: 'Sign out',
    signingOut: 'Signing out…',
    home: 'Volumine — home',
  },
  auth: {
    title: 'Sign in to Volumine',
    subtitle: 'To save your charts and keep the link working tomorrow.',
    withGoogle: 'Continue with Google',
    or: 'or',
    emailLabel: 'Your email',
    emailPlaceholder: 'you@email.com',
    sendLink: 'Send me a link',
    sending: 'Sending…',
    checkTitle: 'Check your email',
    checkBody: 'We sent a link to {email}. Open it in this same browser and you are in.',
    checkNote:
      'The link expires and works once. If it takes more than a couple of minutes, check spam.',
    note: 'You do not need an account to use the editor or to embed a chart — the config travels inside the link. This is only to save them.',
    noAccounts: 'No accounts for now',
    noAccountsBody:
      'This install has no database configured, so nothing can be saved. The editor works anyway: the config travels inside the link.',
    goToEditor: 'Go to the editor',
    errRate:
      'Too many emails in a short time. Wait a few minutes and try again — it is not your address.',
    errInvalid: 'That address does not look valid. Check it.',
    errGeneric: 'Could not send the email. Try again in a moment.',
    errGoogle: 'Could not open Google.',
    errNoCode: 'That link carried nothing. Ask for a new one.',
    errExpired: 'That link is no longer valid: it expired or was already used.',
  },
  charts: {
    title: 'My charts',
    quota: '{used} of {max} · {plan} plan',
    emptyTitle: 'You have not saved any yet',
    emptyBody:
      'Saving gives you a short link you can paste into Notion, your site or anywhere else, and come back to edit whenever you like.',
    emptyCta: 'Make the first one',
    quotaFull:
      'You have reached the limit of {max} charts on your plan. Delete one to save another.',
    public: 'Public',
    private: 'Private',
    publish: 'Publish',
    unpublish: 'Unpublish',
    untitled: 'Untitled',
    today: 'today',
    yesterday: 'yesterday',
    daysAgo: '{days} days ago',
    confirmDelete: 'You are about to delete «{name}». This cannot be undone.',
    confirmDeletePublic:
      'You are about to delete «{name}». Its link will stop working wherever it is embedded.',
  },
  editor: {
    namePlaceholder: 'Give it a name',
    nameLabel: 'Chart name',
    undo: 'Undo',
    redo: 'Redo',
    published: 'Published',
    tooLong: 'Over {max} characters',
    copyEmbed: 'Copy iframe',
    tooLongChars: '{n} characters — too long',
    groupTheme: 'Theme',
    groupThemeHint: 'Start here',
    groupData: 'Data',
    groupDataHint: 'Paste from your sheet',
    groupType: 'Type',
    groupColor: 'Colour',
    groupPlanet: 'Planet',
    groupScale: 'Scale',
    groupScaleHint: 'What it measures against',
    groupShape: 'Shape',
    groupShapeHint: 'Safe ranges',
    groupFinish: 'Finish',
    groupLabels: 'Labels',
    groupLabelsHint: 'See the data without hovering',
    groupBackground: 'Background',
    groupMotion: 'Motion',
    advanced: 'Advanced',
    chartType: 'Chart type',
    notAvailable: 'Not available yet',
    colorOf: 'Colour of {name}',
    land: 'Land',
    halo: 'Halo',
    mapDensity: 'Map density',
    dots: '{count} dots',
    dotSize: 'Dot size',
    marker: 'Marker',
    markerSize: 'Marker size',
    markerDot: 'Dot',
    markerDotHint: 'The plainest one.',
    markerPin: 'Pin',
    markerPinHint: 'You see where it lands, even edge-on.',
    markerPulse: 'Pulse',
    markerPulseHint: 'For happening right now.',
    scaleMax: 'Top of the scale',
    overflow: 'The data goes over the top',
    arcSpread: 'Arc spread',
    fullRing: 'Full ring',
    restOfScale: 'Rest of the scale',
    trackOn: 'Visible',
    trackOnHint: 'You see how much is left.',
    trackOff: 'Hidden',
    trackOffHint: 'Only the filled part.',
    bevel: 'Rounded edge',
    ofMax: '{value} of {max}',
    barHeight: 'Height',
    thickness: 'Thickness',
    roundedTip: 'Rounded tip',
    innerRadius: 'Centre hole',
    gap: 'Gap',
    explode: 'Slices apart',
    material: 'Material',
    matPhysical: 'Plastic',
    matPhysicalHint: 'Soft shine. The default.',
    matMatte: 'Matte',
    matMatteHint: 'No reflections. Reads well in print.',
    matMetal: 'Metal',
    matMetalHint: 'Expensive-looking but loses detail.',
    matGlass: 'Glass',
    matGlassHint: 'Translucent. Few categories.',
    matToon: 'Flat',
    matToonHint: 'No shading. Next to long text.',
    labelsOnHover: 'On hover',
    labelsOnHoverHint: 'Only when you point at it.',
    labelsAlways: 'Always',
    labelsAlwaysHint: 'Next to each part.',
    labelsLegend: 'Legend',
    labelsLegendHint: 'A list in one corner.',
    whatShows: 'What it shows',
    showValue: 'Value',
    showValueHint: 'The figure as it is.',
    showPercent: 'Percentage',
    showPercentHint: 'Its share of the total.',
    showBoth: 'Both',
    showBothHint: 'Figure and percentage.',
    textSize: 'Text size',
    labelFont: 'Lettering',
    fontSans: 'Sans',
    fontSansHint: 'The neutral one. The default.',
    fontSerif: 'Serif',
    fontSerifHint: 'Editorial voice, next to running text.',
    fontMono: 'Mono',
    fontMonoHint: 'Figures line up in a column.',
    labelInk: 'Text colour',
    labelInkAuto: 'Automatic',
    labelFinish: 'Label wrapper',
    finishGlass: 'Glass',
    finishGlassHint: 'Translucent. Reads on any page.',
    finishSolid: 'Solid',
    finishSolidHint: 'Opaque and crisper. Lighter on weak devices.',
    finishPlain: 'No box',
    finishPlainHint: 'Just the text, with a halo so it stays readable.',
    bgTransparent: 'Transparent',
    bgTransparentHint: 'Blends into your page.',
    bgSolid: 'Solid',
    bgSolidHint: 'One colour.',
    bgGradient: 'Gradient',
    bgGradientHint: 'From one colour to another.',
    bgColor: 'Colour',
    bgFrom: 'From',
    bgTo: 'To',
    bgAngle: 'Angle',
    frameDuration: 'Time per period',
    sway: 'Sway',
    spinSpeed: 'Spin speed',
    stopped: 'Stopped',
    turnsPerMin: '{n} turns/min',
    lightIntensity: 'Light intensity',
    roughness: 'Roughness',
    cameraAngle: 'Camera angle',
  },
  landing: {
    tagline: 'Embeddable 3D charts',
    heroTitle1: 'Your data,',
    heroTitle2: 'with volume.',
    heroBody:
      'Make a 3D chart, copy the link and paste it wherever you want. It lives inside your site, Notion or a deck, and keeps turning.',
    heroCta: 'Make a chart',
    specWeight: 'Weight',
    specWeightNote: 'The whole 3D viewer, gzipped.',
    specRequests: 'Requests',
    specRequestsNote: 'One file. Nothing else.',
    specThirdParty: 'Third parties',
    specThirdPartyNote: 'No cookies, no foreign analytics.',
    specSignup: 'Sign-up',
    specSignupNote: 'The config travels in the link.',
    specSignupValue: 'No',
    typesLabel: 'Chart types',
    typesTitle: 'Every shape answers a different question.',
    /* `{not}` se sustituye por una palabra en cursiva. Va como marcador y no
       partiendo la frase: en inglés cae antes del verbo y en español después. */
    typesBody:
      'That is why every card also says when {not} to use that type. A beautiful chart that answers the wrong question is still wrong.',
    typesBodyNot: 'not',
    avoidPrefix: 'Avoid it',
    ready: 'Ready',
    comingSoon: 'Coming soon',
    closerTitle: 'The link is the product.',
    closerBody:
      'No account to get started. A whole chart configuration fits in a 290-character URL, so there is nothing to save until you want to come back and edit it.',
    closerCta: 'Get started',
    seeRealEmbed: 'See a real embed',
    yourLink: 'Your link',
  },
  types: {
    donut: {
      name: 'Donut',
      answers: 'How does a total split across a handful of categories?',
      avoid: 'With more than seven categories. The eye stops comparing slices.',
    },
    pie: {
      name: 'Pie',
      answers: 'Same as the donut, when you want the visual weight of the disc.',
      avoid: 'If you need a figure in the middle. Use the donut for that.',
    },
    gauge: {
      name: 'Gauge',
      answers: 'How far along am I towards what I set out to do?',
      avoid: 'To compare categories with each other. A gauge shows one figure.',
    },
    bar: {
      name: 'Bars',
      answers: 'How much does each category have, and which one wins?',
      avoid: 'For parts of a total. There the comparison is against the whole.',
    },
    'bar-race': {
      name: 'Bar race',
      answers: 'How did the ranking change over time?',
      avoid: 'If the order never changes. Then it is a plain bar chart with noise.',
    },
    globe: {
      name: 'Globe',
      answers: 'Where is it happening, geographically?',
      avoid: 'To compare figures precisely. Half the sphere faces away.',
    },
  },
  data: {
    category: 'Category',
    value: 'Value',
    series: 'Series',
    period: 'Period',
    newRow: 'Category {n}',
    columnName: '{word} {n} name',
    removeColumn: 'Remove {word} {n}',
    rowName: 'Row {n} name',
    removeRow: 'Remove {name}',
    cellLabel: '{row}, {column}',
    latitude: 'Latitude',
    longitude: 'Longitude',
    latitudeOf: 'Latitude of {name}',
    longitudeOf: 'Longitude of {name}',
    addRow: '+ Row',
    addColumn: '+ {word}',
    fillCoords: 'Fill in {n} coordinate(s)',
    filledCoords: 'Filled in {n} coordinate(s) from the row name.',
    openCsv: 'Open CSV',
    flipHeader: 'Change header',
    hint: 'Copy the cells from your spreadsheet and paste them here.',
    hintRace: 'Each column is a period: countries down the rows, years across the columns.',
    /* Los dos marcadores salen en negrita: son las DOS cosas que hacen falta y
       el resto de la frase existe para explicarlas. */
    globeHint:
      'Every row is a point on the map. It needs {coords} and a {value}: without both, nothing is drawn. Type a well-known city or country and the coordinates fill themselves in; the value sets the size of the dot.',
    globeHintCoords: 'coordinates',
    globeHintValue: 'value greater than zero',
    pasted: '{rows} row(s) and {columns} column(s).',
    usedHeader: 'The first row was used as the header.',
    noHeader: 'No header row: the columns have been numbered.',
    emptyCells: '{n} cell(s) with no number: they count as 0.',
    unreadable: 'I could not read that. At least two columns are needed.',
  },
  /* Solo entradas de tema, todas con la misma forma: así `keyof` da los ids y
     `d.themes[id].name` typa. Una clave suelta aquí (un `label:` de grupo, por
     ejemplo) ensancharía el tipo a `string | ...` y rompería ese acceso. */
  themes: {
    aurora: {
      name: 'Aurora',
      use: 'The default. Saturated and cool, works on a dark background.',
    },
    estudio: {
      name: 'Studio',
      use: 'For embedding in light pages. Matte body, defined shadow.',
    },
    brasa: {
      name: 'Ember',
      use: 'Warm and high contrast. For a single figure that has to hurt.',
    },
    metal: {
      name: 'Metal',
      use: 'Metallic surface. Looks expensive and loses detail: few categories.',
    },
    papel: {
      name: 'Paper',
      use: 'Flat and matte. When the chart sits next to a long piece of text.',
    },
    nocturno: {
      name: 'Nocturne',
      use: 'Low light and deep colours. For almost black backgrounds.',
    },
  },
  meta: {
    siteTitle: 'Volumine — 3D charts you embed with a link',
    siteDescription:
      'Make a beautiful 3D chart and embed it in your site, Notion or Confluence with a link.',
    editor: 'Editor',
    signIn: 'Sign in',
  },
} as const;

/**
 * La FORMA del diccionario, con los textos como `string` cualquiera.
 *
 * Hace falta porque `en` va con `as const` —para que las claves queden fijas— y
 * eso convierte cada texto en su propio tipo literal: `typeof en` exigiría que
 * el español dijera literalmente «Save». Este mapeo conserva la estructura y
 * ensancha solo los valores.
 *
 * Lo que se gana: si al español le falta una clave, o le sobra, o la anida mal,
 * es un ERROR DE COMPILACIÓN. Una traducción olvidada no llega a producción
 * como un hueco que nadie ve hasta que alguien lo reporta.
 */
type Textos<T> = { [K in keyof T]: T[K] extends string ? string : Textos<T[K]> };

export type Dictionary = Textos<typeof en>;

/** El mismo objeto, palabra por palabra. Si falta una clave, no compila. */
export const es: Dictionary = {
  common: {
    save: 'Guardar',
    saving: 'Guardando…',
    saved: 'Guardado',
    cancel: 'Cancelar',
    delete: 'Borrar',
    edit: 'Editar',
    duplicate: 'Duplicar',
    copyLink: 'Copiar link',
    copy: 'Copiar',
    chartTheme: 'Tema de la gráfica',
    copied: 'Copiado',
    somethingFailed: 'Algo ha fallado.',
    back: '← Volver',
    language: 'Idioma',
  },
  nav: {
    openEditor: 'Abrir el editor',
    myCharts: 'Mis gráficas',
    newChart: 'Nueva gráfica',
    signOut: 'Cerrar sesión',
    signingOut: 'Cerrando…',
    home: 'Volumine — inicio',
  },
  auth: {
    title: 'Entra en Volumine',
    subtitle: 'Para guardar tus gráficas y que el link siga funcionando mañana.',
    withGoogle: 'Continuar con Google',
    or: 'o',
    emailLabel: 'Tu correo',
    emailPlaceholder: 'tu@correo.com',
    sendLink: 'Mandarme un link',
    sending: 'Enviando…',
    checkTitle: 'Mira tu correo',
    checkBody:
      'Te hemos mandado un link a {email}. Ábrelo en este mismo navegador y entrarás directamente.',
    checkNote:
      'El link caduca y solo sirve una vez. Si no llega en un par de minutos, mira en spam.',
    note: 'No hace falta cuenta para usar el editor ni para incrustar una gráfica: la config viaja dentro del link. Esto es solo para guardarlas.',
    noAccounts: 'Sin cuentas por ahora',
    noAccountsBody:
      'Esta instalación no tiene base de datos configurada, así que no se puede guardar nada. El editor funciona igual: la config viaja dentro del link.',
    goToEditor: 'Ir al editor',
    errRate:
      'Se han enviado demasiados correos en poco rato. Espera unos minutos y vuelve a intentarlo — no es culpa de tu dirección.',
    errInvalid: 'Esa dirección no parece válida. Revísala.',
    errGeneric: 'No se ha podido enviar el correo. Inténtalo de nuevo en un momento.',
    errGoogle: 'No se ha podido abrir Google.',
    errNoCode: 'Ese link no traía nada. Pide uno nuevo.',
    errExpired: 'Ese link ya no vale: o ha caducado o ya se había usado.',
  },
  charts: {
    title: 'Mis gráficas',
    quota: '{used} de {max} · plan {plan}',
    emptyTitle: 'Aún no has guardado ninguna',
    emptyBody:
      'Guardar te da un link corto que puedes pegar en Notion, en tu web o donde quieras, y volver a editar cuando te apetezca.',
    emptyCta: 'Hacer la primera',
    quotaFull:
      'Has llegado al límite de {max} gráficas de tu plan. Borra alguna para poder guardar otra.',
    public: 'Pública',
    private: 'Privada',
    publish: 'Publicar',
    unpublish: 'Despublicar',
    untitled: 'Sin título',
    today: 'hoy',
    yesterday: 'ayer',
    daysAgo: 'hace {days} días',
    confirmDelete: 'Vas a borrar «{name}». No se puede deshacer.',
    confirmDeletePublic:
      'Vas a borrar «{name}». Su link dejará de funcionar donde esté incrustado.',
  },
  editor: {
    namePlaceholder: 'Ponle un nombre',
    nameLabel: 'Nombre de la gráfica',
    undo: 'Deshacer',
    redo: 'Rehacer',
    published: 'Publicada',
    tooLong: 'Pasa de {max} caracteres',
    copyEmbed: 'Copiar iframe',
    tooLongChars: '{n} caracteres — demasiado largo',
    groupTheme: 'Tema',
    groupThemeHint: 'Empieza por aquí',
    groupData: 'Datos',
    groupDataHint: 'Pega desde tu hoja',
    groupType: 'Tipo',
    groupColor: 'Color',
    groupPlanet: 'Planeta',
    groupScale: 'Escala',
    groupScaleHint: 'Sobre qué se mide',
    groupShape: 'Forma',
    groupShapeHint: 'Rangos seguros',
    groupFinish: 'Acabado',
    groupLabels: 'Etiquetas',
    groupLabelsHint: 'Ver los datos sin pasar el ratón',
    groupBackground: 'Fondo',
    groupMotion: 'Movimiento',
    advanced: 'Avanzado',
    chartType: 'Tipo de gráfica',
    notAvailable: 'Todavía no disponible',
    colorOf: 'Color de {name}',
    land: 'Tierra',
    halo: 'Halo',
    mapDensity: 'Densidad del mapa',
    dots: '{count} puntos',
    dotSize: 'Tamaño del punto',
    marker: 'Marcador',
    markerSize: 'Tamaño del marcador',
    markerDot: 'Punto',
    markerDotHint: 'Lo más sobrio.',
    markerPin: 'Chincheta',
    markerPinHint: 'Se ve dónde toca, incluso de canto.',
    markerPulse: 'Pulso',
    markerPulseHint: 'Para cuando está pasando ahora.',
    scaleMax: 'Tope de la escala',
    overflow: 'Los datos se pasan del tope',
    arcSpread: 'Apertura del arco',
    fullRing: 'Anillo completo',
    restOfScale: 'Resto de la escala',
    trackOn: 'A la vista',
    trackOnHint: 'Se ve cuánto falta.',
    trackOff: 'Oculto',
    trackOffHint: 'Solo el trozo lleno.',
    bevel: 'Canto redondeado',
    ofMax: '{value} de {max}',
    barHeight: 'Altura',
    thickness: 'Grosor',
    roundedTip: 'Punta redondeada',
    innerRadius: 'Agujero central',
    gap: 'Separación',
    explode: 'Sectores separados',
    material: 'Material',
    matPhysical: 'Plástico',
    matPhysicalHint: 'Brillo suave. El de por defecto.',
    matMatte: 'Mate',
    matMatteHint: 'Sin reflejos. Se lee bien impreso.',
    matMetal: 'Metal',
    matMetalHint: 'Caro pero pierde detalle.',
    matGlass: 'Vidrio',
    matGlassHint: 'Translúcido. Pocas categorías.',
    matToon: 'Plano',
    matToonHint: 'Sin sombreado. Junto a texto largo.',
    labelsOnHover: 'Al pasar',
    labelsOnHoverHint: 'Solo al poner el ratón encima.',
    labelsAlways: 'Siempre',
    labelsAlwaysHint: 'Junto a cada parte.',
    labelsLegend: 'Leyenda',
    labelsLegendHint: 'Una lista en una esquina.',
    whatShows: 'Qué se enseña',
    showValue: 'Valor',
    showValueHint: 'La cifra tal cual.',
    showPercent: 'Porcentaje',
    showPercentHint: 'Su parte del total.',
    showBoth: 'Los dos',
    showBothHint: 'Cifra y porcentaje.',
    textSize: 'Tamaño del texto',
    labelFont: 'Letra',
    fontSans: 'Palo seco',
    fontSansHint: 'La neutra. La de por defecto.',
    fontSerif: 'Serifa',
    fontSerifHint: 'Voz editorial, junto a un texto largo.',
    fontMono: 'Monoespaciada',
    fontMonoHint: 'Las cifras cuadran en columna.',
    labelInk: 'Color del texto',
    labelInkAuto: 'Automático',
    labelFinish: 'Envoltorio',
    finishGlass: 'Vidrio',
    finishGlassHint: 'Translúcido. Se lee sobre cualquier página.',
    finishSolid: 'Sólido',
    finishSolidHint: 'Opaco y más nítido. Más ligero en equipos flojos.',
    finishPlain: 'Sin caja',
    finishPlainHint: 'Solo el texto, con un halo para que siga leyéndose.',
    bgTransparent: 'Transparente',
    bgTransparentHint: 'Se funde con tu página.',
    bgSolid: 'Sólido',
    bgSolidHint: 'Un color.',
    bgGradient: 'Degradado',
    bgGradientHint: 'De un color a otro.',
    bgColor: 'Color',
    bgFrom: 'Desde',
    bgTo: 'Hasta',
    bgAngle: 'Ángulo',
    frameDuration: 'Duración de cada periodo',
    sway: 'Vaivén',
    spinSpeed: 'Velocidad de giro',
    stopped: 'Parado',
    turnsPerMin: '{n} vueltas/min',
    lightIntensity: 'Intensidad de luz',
    roughness: 'Rugosidad',
    cameraAngle: 'Ángulo de cámara',
  },
  landing: {
    tagline: 'Gráficas 3D incrustables',
    heroTitle1: 'Tus datos,',
    heroTitle2: 'con volumen.',
    heroBody:
      'Haz una gráfica 3D, copia el link y pégalo donde quieras. Va dentro de tu web, de Notion o de una presentación, y sigue girando.',
    heroCta: 'Hacer una gráfica',
    specWeight: 'Peso',
    specWeightNote: 'Todo el visor 3D, comprimido.',
    specRequests: 'Peticiones',
    specRequestsNote: 'Un archivo. Nada más.',
    specThirdParty: 'Terceros',
    specThirdPartyNote: 'Sin cookies ni analítica ajena.',
    specSignup: 'Registro',
    specSignupNote: 'La config viaja en el link.',
    specSignupValue: 'No',
    typesLabel: 'Tipos de gráfica',
    typesTitle: 'Cada forma responde a una pregunta distinta.',
    typesBody:
      'Por eso cada tarjeta dice también cuándo {not} usar ese tipo. Una gráfica bonita que responde a la pregunta equivocada sigue estando mal.',
    typesBodyNot: 'no',
    avoidPrefix: 'Evítalo',
    ready: 'Listo',
    comingSoon: 'En camino',
    closerTitle: 'El link es el producto.',
    closerBody:
      'Sin cuenta para empezar. La configuración entera de una gráfica cabe en una URL de 290 caracteres, así que no hay nada que guardar hasta que quieras volver a editarla.',
    closerCta: 'Empezar',
    seeRealEmbed: 'Ver un embed real',
    yourLink: 'Tu link',
  },
  types: {
    donut: {
      name: 'Anillo',
      answers: '¿Cómo se reparte un total entre unas pocas categorías?',
      avoid: 'Con más de siete categorías. El ojo deja de comparar sectores.',
    },
    pie: {
      name: 'Tarta',
      answers: 'Lo mismo que el anillo, cuando quieres el peso visual del disco.',
      avoid: 'Si necesitas poner una cifra en el centro. Para eso, anillo.',
    },
    gauge: {
      name: 'Medidor',
      answers: '¿Cuánto llevo de lo que me había propuesto?',
      avoid: 'Para comparar categorías entre sí. Un medidor enseña una sola cifra.',
    },
    bar: {
      name: 'Barras',
      answers: '¿Cuánto tiene cada categoría, y cuál gana?',
      avoid: 'Para partes de un total. Ahí la comparación es contra el todo.',
    },
    'bar-race': {
      name: 'Barras animadas',
      answers: '¿Cómo cambió el ranking a lo largo del tiempo?',
      avoid: 'Si el orden no cambia. Entonces es una barra normal con ruido.',
    },
    globe: {
      name: 'Globo',
      answers: '¿Dónde está pasando, geográficamente?',
      avoid: 'Para comparar cifras con precisión. Media esfera está de espaldas.',
    },
  },
  data: {
    category: 'Categoría',
    value: 'Valor',
    series: 'Serie',
    period: 'Periodo',
    newRow: 'Categoría {n}',
    columnName: 'Nombre de {word} {n}',
    removeColumn: 'Quitar {word} {n}',
    rowName: 'Nombre de la fila {n}',
    removeRow: 'Quitar {name}',
    cellLabel: '{row}, {column}',
    latitude: 'Latitud',
    longitude: 'Longitud',
    latitudeOf: 'Latitud de {name}',
    longitudeOf: 'Longitud de {name}',
    addRow: '+ Fila',
    addColumn: '+ {word}',
    fillCoords: 'Rellenar {n} coordenada(s)',
    filledCoords: 'Rellenadas {n} coordenada(s) por el nombre de la fila.',
    openCsv: 'Abrir CSV',
    flipHeader: 'Cambiar cabecera',
    hint: 'Copia las celdas de tu hoja de cálculo y pégalas aquí.',
    hintRace: 'Cada columna es un periodo: países en las filas, años en las columnas.',
    globeHint:
      'Cada fila es un punto en el mapa. Necesita {coords} y un {value}: sin las dos cosas no se dibuja. Escribe una ciudad o un país conocido y las coordenadas se rellenan solas; el valor decide el tamaño del punto.',
    globeHintCoords: 'coordenadas',
    globeHintValue: 'valor mayor que cero',
    pasted: '{rows} fila(s) y {columns} columna(s).',
    usedHeader: 'Se ha usado la primera fila como cabecera.',
    noHeader: 'Sin fila de cabecera: las columnas se han numerado.',
    emptyCells: '{n} celda(s) sin número: cuentan como 0.',
    unreadable: 'No he sabido leer eso. Hacen falta al menos dos columnas.',
  },
  themes: {
    aurora: {
      name: 'Aurora',
      use: 'El de por defecto. Saturado y frío, funciona sobre fondo oscuro.',
    },
    estudio: {
      name: 'Estudio',
      use: 'Para incrustar en páginas claras. Cuerpo mate, sombra marcada.',
    },
    brasa: {
      name: 'Brasa',
      use: 'Cálido y con contraste alto. Para una sola cifra que tiene que doler.',
    },
    metal: {
      name: 'Metal',
      use: 'Superficie metálica. Se ve caro y pierde detalle: pocas categorías.',
    },
    papel: {
      name: 'Papel',
      use: 'Plano y sin brillos. Cuando la gráfica acompaña a un texto largo.',
    },
    nocturno: {
      name: 'Nocturno',
      use: 'Luz baja y colores profundos. Para fondos casi negros.',
    },
  },
  meta: {
    siteTitle: 'Volumine — gráficas 3D que se incrustan con un link',
    siteDescription:
      'Crea una gráfica 3D preciosa e incrústala en tu web, Notion o Confluence con un link.',
    editor: 'Editor',
    signIn: 'Entrar',
  },
};

const DICTIONARIES: Record<Locale, Dictionary> = { en, es };

export function dictionaryFor(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? en;
}

/**
 * Sustituye `{marcadores}` por valores.
 *
 * Existe porque partir una frase en trozos para meter un dato en medio la hace
 * intraducible: el orden de las palabras cambia entre idiomas y lo que en uno va
 * al final en otro va al principio. Con marcadores, cada idioma coloca el dato
 * donde le corresponde.
 */
export function fill(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (_, clave) => String(valores[clave] ?? `{${clave}}`));
}
