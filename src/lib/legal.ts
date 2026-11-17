/*
  ══════════════════════════════════════════════════════════════════════════
  LOS DATOS DEL TITULAR, EN UN SOLO SITIO
  ══════════════════════════════════════════════════════════════════════════

  Las cuatro páginas legales leen de aquí. Se rellena UNA vez y cuadra en todas:
  el error clásico de las páginas legales es que el domicilio de una no coincide
  con el de otra porque se escribieron a mano en sitios distintos.

  ── ESTO ESTÁ SIN RELLENAR A PROPÓSITO ───────────────────────────────────

  No son datos que pueda inventar nadie: identifican legalmente a quien presta
  el servicio, y publicarlos mal es peor que no publicarlos. Mientras haya
  cualquier campo en `null`, las páginas legales muestran un aviso bien visible
  y `docs/LEGAL.md` explica de dónde sale cada uno.

  ── Y ESTO NO ES ASESORAMIENTO JURÍDICO ──────────────────────────────────

  El texto de las páginas es un ANDAMIAJE correcto en estructura y ajustado a lo
  que este producto hace de verdad —qué datos toca, con qué encargados, qué
  cookies pone—, no un documento validado. Antes de publicar tiene que revisarlo
  alguien que sepa, sobre todo si cambia el país de establecimiento o se empieza
  a cobrar.
*/

export type DatosTitular = {
  /** Nombre y apellidos, o razón social si es una sociedad. */
  nombre: string | null;
  /** NIF / CIF. */
  nif: string | null;
  /** Domicilio a efectos de notificaciones. */
  domicilio: string | null;
  /** Correo de contacto. El mismo sirve para ejercer derechos de protección de datos. */
  email: string | null;
  /** Dominio definitivo, sin protocolo. */
  dominio: string | null;
  /**
   * Datos registrales, solo si es una sociedad. En una persona física va `null`
   * y no se muestra: poner un registro que no existe es un dato falso.
   */
  registro: string | null;
};

export const TITULAR: DatosTitular = {
  nombre: 'Sergii Butrii',
  nif: 'Y4429658X',
  domicilio: 'Fuente del Nogal, 2, 29130 Alhaurín de la Torre, Málaga',
  email: 'voluma.app@gmail.com',
  dominio: 'volumine.app',
  /* Persona física: no hay inscripción registral que declarar. Poner un
     registro inventado sería un dato falso en un documento cuya única función
     es identificar de verdad a quien presta el servicio. */
  registro: null,
};

/** Los campos obligatorios que sigan sin rellenar. Vacío = listo para publicar. */
export function faltanDatos(): Array<keyof DatosTitular> {
  const obligatorios: Array<keyof DatosTitular> = [
    'nombre',
    'nif',
    'domicilio',
    'email',
    'dominio',
  ];
  return obligatorios.filter((campo) => !TITULAR[campo]);
}

/** Lo que se pinta donde va un dato que todavía no está. */
export const PENDIENTE = '[pendiente]';

export function dato(campo: keyof DatosTitular): string {
  return TITULAR[campo] ?? PENDIENTE;
}

/**
 * Fecha de la última revisión de los textos legales.
 *
 * A mano y no `new Date()`: tiene que decir cuándo se revisó el TEXTO, no
 * cuándo se cargó la página. Una fecha que se actualiza sola cada día es una
 * mentira sobre la vigencia del documento.
 */
export const ULTIMA_REVISION = '2026-08-09';

/*
  ── LOS ENCARGADOS DEL TRATAMIENTO ───────────────────────────────────────

  Quién más toca los datos, y para qué. El RGPD (art. 13.1.e) obliga a decir los
  destinatarios, y esta lista es la que hay que mantener al día: cada servicio
  nuevo que vea datos de usuarios entra aquí ANTES de entrar en producción.

  Todos tienen contrato de encargado estándar, pero hay que ACEPTARLO en cada
  panel; ver `docs/LEGAL.md`.
*/
export type Encargado = {
  nombre: string;
  para: string;
  donde: string;
  /** Enlace a su acuerdo de tratamiento de datos. */
  dpa: string;
};

export const ENCARGADOS: Encargado[] = [
  {
    nombre: 'Supabase',
    para: 'Base de datos, cuentas y almacenamiento de imágenes',
    donde: 'Unión Europea',
    dpa: 'https://supabase.com/legal/dpa',
  },
  {
    nombre: 'Vercel',
    para: 'Alojamiento de la web y entrega de contenidos',
    donde: 'Estados Unidos, con cláusulas contractuales tipo',
    dpa: 'https://vercel.com/legal/dpa',
  },
  {
    nombre: 'Vercel Web Analytics',
    para: 'Contar visitas de forma agregada, sin cookies ni identificadores',
    donde: 'Estados Unidos, con cláusulas contractuales tipo',
    dpa: 'https://vercel.com/legal/dpa',
  },
  {
    nombre: 'Stripe',
    para: 'Procesar las invitaciones voluntarias («invítame a un café»)',
    donde: 'Estados Unidos e Irlanda, con cláusulas contractuales tipo',
    dpa: 'https://stripe.com/legal/dpa',
  },
];

/*
  ── LAS COOKIES QUE SE PONEN DE VERDAD ───────────────────────────────────

  Auditadas en el código, no copiadas de una plantilla. Son DOS y las dos son
  técnicas, así que no hace falta banner de consentimiento: el art. 22.2 de la
  LSSI exime a las estrictamente necesarias para prestar un servicio que el
  usuario ha pedido expresamente.

  ── SÍ HAY ANALÍTICA, Y AUN ASÍ NO HACE FALTA BANNER ─────────────────────

  El sitio carga **Vercel Web Analytics** (`src/app/(site)/layout.tsx`). No
  aparece en esta lista porque no pone ninguna cookie: cuenta visitas con un
  identificador derivado y efímero, sin escribir nada en el dispositivo.

  Y ahí está la clave de por qué la exención aguanta: el art. 22.2 regula
  «almacenar información o acceder a la ya almacenada en el equipo terminal».
  Si no se almacena ni se lee nada del terminal, ese artículo no entra — con
  banner o sin él.

  Lo que sí obliga es el RGPD: Vercel recibe la IP y datos de navegación, así
  que es un DESTINATARIO y tiene que estar declarado. Por eso está arriba, en
  `ENCARGADOS`, y sale solo en la tabla de la política de privacidad.

  ⚠️ Esto NO se extiende a cualquier analítica. Google Analytics, Meta Pixel y
  compañía sí escriben en el terminal: el día que entre una de esas, aparecen a
  la vez la obligación del banner y la de reescribir `/legal/cookies`.
*/
export type Cookie = {
  nombre: string;
  quien: string;
  para: string;
  duracion: string;
};

export const COOKIES: Cookie[] = [
  {
    nombre: 'sb-…-auth-token',
    quien: 'Volumine (mediante Supabase)',
    para: 'Mantener la sesión iniciada. Sin ella habría que entrar en cada página.',
    duracion: 'Hasta cerrar sesión, o un año',
  },
  {
    nombre: 'volumine-locale',
    quien: 'Volumine',
    para: 'Recordar el idioma elegido a mano, para no volver a preguntarlo.',
    duracion: 'Un año',
  },
];
