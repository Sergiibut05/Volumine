import 'server-only';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, LOCALES, dictionaryFor, type Locale } from './dictionaries';

/*
  Qué idioma le toca a esta petición.

  ── POR QUÉ COOKIE Y NO `/es/...` EN LA URL ────────────────────────────────

  El prefijo de idioma en la ruta es lo habitual en Next, y aquí NO SIRVE: las
  URLs de embed son links PUBLICADOS. `/embed/AbCd` tiene que ser eso y nada
  más — ni `/es/embed/AbCd` ni `/en/embed/AbCd`, porque el mismo dibujo tendría
  dos direcciones, los buscadores verían duplicados, y sobre todo un link que
  alguien pegó en su web no puede depender del idioma de quien lo pegó.

  Con cookie, la URL no cambia nunca y el idioma es una preferencia de la
  persona. Se pierde poder enlazar «esta página en inglés», que en una
  aplicación —no en un blog— casi nadie necesita.
*/

const COOKIE = 'volumine-locale';

function esLocale(valor: string | undefined): valor is Locale {
  return LOCALES.includes(valor as Locale);
}

/**
 * El primer idioma que hablamos, EN EL ORDEN QUE PIDE EL NAVEGADOR.
 *
 * `Accept-Language` es una lista con prioridades: `en-GB,es;q=0.8` dice «inglés
 * y si no, español». Respetar ese orden es lo correcto — mi primera versión
 * daba español en cuanto aparecía en la lista, y eso pasa por encima de alguien
 * que ha pedido inglés primero. Que entendamos su segundo idioma no es motivo
 * para ignorar el primero.
 *
 * `es-419` o `es-ES` cuentan como español: se compara solo la parte de idioma,
 * porque no tenemos variantes por región ni falta que hacen.
 */
function deLaCabecera(aceptado: string): Locale | null {
  const preferencias = aceptado
    .split(',')
    .map((parte) => {
      const [etiqueta, ...params] = parte.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      return {
        idioma: etiqueta.trim().toLowerCase().split('-')[0],
        /* Sin `q` explícito la prioridad es 1, que es lo que dice la
           especificación — no 0, que dejaría fuera al primero de la lista. */
        q: q ? Number(q.split('=')[1]) || 0 : 1,
      };
    })
    .filter((p) => p.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { idioma } of preferencias) {
    if (esLocale(idioma)) return idioma;
  }
  return null;
}

/**
 * El idioma de esta petición.
 *
 * En este orden, y el orden es la decisión:
 *
 *   1. La COOKIE, si la hay. Alguien que ha elegido idioma ha elegido, y no se
 *      le vuelve a preguntar ni se le corrige por dónde esté.
 *   2. `Accept-Language`, respetando SU orden de preferencia.
 *   3. Inglés.
 */
export async function getLocale(): Promise<Locale> {
  const elegido = (await cookies()).get(COOKIE)?.value;
  if (esLocale(elegido)) return elegido;

  const aceptado = (await headers()).get('accept-language');
  return (aceptado && deLaCabecera(aceptado)) || DEFAULT_LOCALE;
}

/** El idioma y sus textos, que es lo que casi siempre se quiere. */
export async function getDictionary() {
  const locale = await getLocale();
  return { locale, d: dictionaryFor(locale) };
}

export { COOKIE as LOCALE_COOKIE };
