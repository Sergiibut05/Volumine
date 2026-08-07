'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LOCALES, type Locale } from '@/lib/i18n/dictionaries';
import { useI18n } from '@/lib/i18n/client';

/*
  Cambiar de idioma.

  Escribe la cookie desde el navegador y refresca. No hace falta una server
  action para poner una preferencia que no es secreta ni valida nada — sería
  una ida y vuelta al servidor para escribir cuatro caracteres.

  `router.refresh()` después, porque el idioma lo resuelven los componentes de
  SERVIDOR: sin ese refresco la cookie estaría puesta y la pantalla seguiría en
  el idioma anterior hasta la siguiente navegación.
*/

const NOMBRE: Record<Locale, string> = { en: 'EN', es: 'ES' };
const COMPLETO: Record<Locale, string> = { en: 'English', es: 'Español' };

/**
 * Deja la preferencia escrita.
 *
 * Fuera del componente a propósito: escribir en `document` desde dentro es
 * exactamente lo que el compilador de React no deja hacer —y con razón, porque
 * un render tiene que poder repetirse sin efectos—, y aquí lo que hay es un
 * manejador de evento que toca el mundo. Sacarlo lo dice en el código.
 *
 * Un año y para todo el sitio. `SameSite=Lax` basta: no es una credencial, y
 * `Strict` haría que al volver desde un enlace externo se viera el idioma
 * equivocado durante una navegación.
 */
function recordarIdioma(locale: Locale) {
  document.cookie = `volumine-locale=${locale}; path=/; max-age=31536000; SameSite=Lax`;
}

export function LocaleSwitch() {
  const { locale, d } = useI18n();
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const cambiar = (siguiente: Locale) => {
    if (siguiente === locale) return;
    recordarIdioma(siguiente);
    startTransition(() => router.refresh());
  };

  return (
    <div className="locale-switch" role="group" aria-label={d.common.language}>
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => cambiar(code)}
          disabled={pendiente}
          aria-pressed={code === locale}
          /* El nombre completo en el título: «EN» y «ES» se leen de un vistazo
             pero no se entienden solos en un lector de pantalla. */
          title={COMPLETO[code]}
          lang={code}
        >
          {NOMBRE[code]}
        </button>
      ))}
    </div>
  );
}
