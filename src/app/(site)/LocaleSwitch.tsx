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

export function LocaleSwitch() {
  const { locale, d } = useI18n();
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const cambiar = (siguiente: Locale) => {
    if (siguiente === locale) return;
    /* Un año y para todo el sitio. `SameSite=Lax` es suficiente: no es una
       credencial, y `Strict` haría que al volver desde un enlace externo se
       viera el idioma equivocado durante una navegación. */
    document.cookie = `volumine-locale=${siguiente}; path=/; max-age=31536000; SameSite=Lax`;
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
