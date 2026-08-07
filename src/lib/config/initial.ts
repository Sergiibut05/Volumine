import type { ChartConfig } from './schema';
import type { Locale } from '../i18n/dictionaries';
import { samplesFor } from '../i18n/samples';

/*
  El ejemplo con el que arranca una gráfica nueva.

  ── POR QUÉ VIVE AQUÍ Y NO EN EL EDITOR ────────────────────────────────────

  Lo usan los dos lados: `crear/page.tsx` —de SERVIDOR— para decidir con qué
  arranca la pantalla, y el editor —de CLIENTE— para saber si los datos que hay
  son los de muestra o los del usuario. Estaba en `Editor.tsx`, que lleva
  `'use client'`, y ahí una CONSTANTE se puede importar desde el servidor pero
  una FUNCIÓN no: Next la sustituye por un tirador al cliente y llamarla en el
  servidor revienta con «Attempted to call initialConfig() from the server».

  Es función y no constante porque las etiquetas de muestra dependen del idioma
  (ver lib/i18n/samples.ts), así que el sitio correcto es un módulo neutro.
*/
export function initialConfig(locale: Locale): ChartConfig {
  const { labels, unit, numberLocale } = samplesFor(locale).initial;

  return {
    v: 1,
    type: 'donut',
    /* SIN título. Lo tenía, y al guardar se quedaba en el listado un nombre que
       el usuario no había escrito nunca — parecía que la aplicación se lo
       inventaba. El campo arranca vacío con su marcador de posición y no se
       puede guardar hasta ponerle uno: es lo que vas a ver en tu listado y en la
       tarjeta de enlace, así que merece un segundo de tu atención. */
    data: {
      labels,
      series: [{ values: [42, 26, 17, 9, 6] }],
      /* El formato de número va DENTRO de la config: viaja en el link y se
         queda como estaba aunque la gráfica la abra alguien de otro país. Se
         siembra con el idioma de quien la crea, que es lo más probable, y se
         puede cambiar. */
      format: { unit, locale: numberLocale },
    },
    // El tema se nombra y se resuelve al parsear. Aquí solo va lo propio.
    theme: 'aurora',
    scene: { background: { kind: 'transparent' } },
  };
}
