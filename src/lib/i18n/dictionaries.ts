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
    copied: 'Copied',
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
    copied: 'Copiado',
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
