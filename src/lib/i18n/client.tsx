'use client';

import { createContext, useContext } from 'react';
import { en, type Dictionary, type Locale } from './dictionaries';

/*
  Los textos, para componentes de cliente.

  El diccionario ENTERO se pasa desde el servidor y viaja una vez en el HTML.
  Son unos 3 KB: menos que cualquier librería de i18n, y sin peticiones ni
  esperas — el texto correcto está en el primer pintado, sin parpadeo de claves
  sin traducir.

  No hay carga perezosa por idioma a propósito. Con dos idiomas, partirlo cuesta
  más complejidad de la que ahorra.
*/

const Contexto = createContext<{ locale: Locale; d: Dictionary }>({
  locale: 'en',
  d: en,
});

export function I18nProvider({
  locale,
  d,
  children,
}: {
  locale: Locale;
  d: Dictionary;
  children: React.ReactNode;
}) {
  /* Sin `useMemo`: el valor viene del servidor y solo cambia cuando cambia la
     página entera, así que memoizarlo no evita ningún render. */
  return <Contexto.Provider value={{ locale, d }}>{children}</Contexto.Provider>;
}

/** Los textos donde hagan falta. */
export function useI18n() {
  return useContext(Contexto);
}

export { fill } from './dictionaries';
