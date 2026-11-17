import type { Locale } from './dictionaries';

/*
  Los DATOS DE EJEMPLO, por idioma.

  ── POR QUÉ ESTO NO CONTRADICE «LAS GRÁFICAS NO SE TRADUCEN» ───────────────

  Una gráfica publicada se ve como la escribió quien la hizo, siempre, la mire
  quien la mire — esa regla no se toca (ver la cabecera de dictionaries.ts).
  Esto es otra cosa: son las etiquetas de MUESTRA que ponemos NOSOTROS antes de
  que exista ningún dato del usuario. Es copia de la interfaz disfrazada de
  datos, y llegar al editor y encontrarse «Suscripciones / Servicios /
  Licencias» habiendo pedido inglés se lee como un producto a medio hacer.

  En cuanto alguien escribe o pega lo suyo, esto desaparece y no vuelve.

  ── POR QUÉ NO ESTÁ EN `dictionaries.ts` ──────────────────────────────────

  Porque son LISTAS, y el tipo `Textos<T>` que allí garantiza que los dos
  idiomas tengan las mismas claves está pensado para textos sueltos: al pasarle
  un array lo recorrería como si `length` fuera una traducción. Aquí la
  garantía la da `Record<Locale, Muestras>`, que es la misma promesa —falta un
  idioma, no compila— con el tipo correcto.
*/

export type Muestras = {
  /** Con lo que arranca una gráfica NUEVA en el editor. */
  initial: {
    labels: string[];
    /** Sufijo de las cifras. Sin moneda en inglés: no sabemos cuál es la suya. */
    unit: string;
    /** Para `Intl`: separador de miles y decimal. No es lo mismo que el idioma. */
    numberLocale: string;
  };
  donut: string[];
  pie: string[];
  gauge: string[];
  bar: string[];
  /** Una evolución: meses de un año, que es lo que la gente tiene en su Excel. */
  area: string[];
  globe: string[];
};

/** Si falta un idioma, es un error de compilación. */
export const SAMPLES: Record<Locale, Muestras> = {
  en: {
    initial: {
      labels: ['Subscriptions', 'Services', 'Licences', 'Training', 'Other'],
      unit: ' k',
      numberLocale: 'en-US',
    },
    donut: ['Subscriptions', 'Services', 'Licences'],
    pie: ['Mobile', 'Desktop', 'Tablet'],
    gauge: ['Quarter target'],
    bar: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    area: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
    globe: ['Madrid', 'London', 'New York', 'Tokyo', 'São Paulo', 'Sydney'],
  },
  es: {
    initial: {
      labels: ['Suscripciones', 'Servicios', 'Licencias', 'Formación', 'Otros'],
      unit: ' k€',
      numberLocale: 'es-ES',
    },
    donut: ['Suscripciones', 'Servicios', 'Licencias'],
    pie: ['Móvil', 'Escritorio', 'Tablet'],
    gauge: ['Objetivo del trimestre'],
    bar: ['Ene', 'Feb', 'Mar', 'Abr', 'May'],
    area: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago'],
    globe: ['Madrid', 'Londres', 'Nueva York', 'Tokio', 'São Paulo', 'Sídney'],
  },
};

export function samplesFor(locale: Locale): Muestras {
  return SAMPLES[locale] ?? SAMPLES.en;
}
