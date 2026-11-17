/*
  «Invítame a un café».

  Volumine es gratis y no tiene plan de pago (ADR 0008). Lo único que se cobra
  es lo que alguien quiera dar, en cafés de importe fijo, al estilo de Buy Me a
  Coffee — pero sobre la cuenta de Stripe que ya existía, sin plataforma
  intermedia ni comisión extra y sin nada que dar de alta a mano: el importe va
  EN LÍNEA en la sesión de checkout (`price_data`), así que no hace falta crear
  ningún producto ni precio en el panel.

  Este archivo NO lleva secretos y lo importa el cliente: son las cifras que se
  enseñan en la página. La clave de Stripe vive en `billing/config.ts`, que es
  `server-only`.
*/

/** Lo que cuesta un café, en céntimos. Entero: en coma flotante acaba en 2,99. */
export const PRECIO_CAFE_CENTIMOS = 300;

export const MONEDA_CAFE = 'eur';

/** Las tres opciones rápidas. El checkout deja cambiar la cantidad después. */
export const OPCIONES_CAFE = [1, 3, 5] as const;

/** Tope por invitación. Lo comprueba el servidor, no el formulario. */
export const MAX_CAFES = 20;

/** Del formulario a un número de cafés válido. Lo que no cuadre, un café. */
export function cafesValidos(valor: unknown): number {
  const n = Math.trunc(Number(valor));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_CAFES);
}

/** «9 €» / «€9», sin decimales cuando son redondos. */
export function importe(cafes: number, locale: string): string {
  const centimos = cafes * PRECIO_CAFE_CENTIMOS;
  return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-IE', {
    style: 'currency',
    currency: MONEDA_CAFE.toUpperCase(),
    minimumFractionDigits: centimos % 100 === 0 ? 0 : 2,
  }).format(centimos / 100);
}
