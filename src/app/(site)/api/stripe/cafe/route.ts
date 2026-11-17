import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { cafeEnabled, stripeSecretKey } from '@/lib/billing/config';
import { MONEDA_CAFE, MAX_CAFES, PRECIO_CAFE_CENTIMOS, cafesValidos } from '@/lib/cafe';
import { getLocale } from '@/lib/i18n/server';

/*
  Invitar a un café: abre la pasarela de Stripe y nada más.

  ── UN FORMULARIO, NO UN `fetch` ─────────────────────────────────────────

  Llega por POST de un `<form>` normal y responde con un 303 a la pasarela. Así
  funciona aunque no cargue el JavaScript de la página, y no hay JSON de ida y
  vuelta que pueda fallar callado.

  ── NADA QUE DAR DE ALTA EN STRIPE ───────────────────────────────────────

  El importe va EN LÍNEA (`price_data`) y no como un `price_…` del panel. Es lo
  que permite que esto funcione con la clave que ya estaba puesta, sin crear
  productos a mano. El riesgo que tenía dejar el importe al navegador no existe
  aquí: lo que llega del formulario es un NÚMERO DE CAFÉS, acotado en el
  servidor, y el precio de cada uno es una constante nuestra.

  ── SIN CUENTA ───────────────────────────────────────────────────────────

  Invitar no da nada a cambio —todo es gratis ya—, así que no hay a quién
  conceder nada y no hace falta saber quién es. Pedir que se registre para
  dejar tres euros sería espantar justo a quien quería ayudar.

  ── SIN WEBHOOK ──────────────────────────────────────────────────────────

  Por lo mismo: no hay nada que activar cuando el pago se completa. El
  `?gracias=1` de vuelta solo enseña un mensaje.
*/

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const origen = new URL(request.url).origin;

  if (!cafeEnabled()) {
    return NextResponse.redirect(`${origen}/cafe`, 303);
  }

  const form = await request.formData().catch(() => null);
  const cafes = cafesValidos(form?.get('cafes'));
  const locale = await getLocale();
  const es = locale === 'es';

  const stripe = new Stripe(stripeSecretKey()!);

  try {
    const sesion = await stripe.checkout.sessions.create({
      mode: 'payment',
      /* El botón de Stripe dice «Donar» en vez de «Pagar»: es una invitación,
         no una compra, y así se lee también en la pasarela. */
      submit_type: 'donate',
      locale: es ? 'es' : 'en',
      line_items: [
        {
          price_data: {
            currency: MONEDA_CAFE,
            unit_amount: PRECIO_CAFE_CENTIMOS,
            product_data: {
              name: es ? 'Un café para Volumine' : 'A coffee for Volumine',
              description: es
                ? 'Gracias por ayudar a que Volumine siga siendo gratis.'
                : 'Thank you for helping keep Volumine free.',
            },
          },
          quantity: cafes,
          /* Que pueda cambiar de idea en la propia pasarela sin volver atrás. */
          adjustable_quantity: { enabled: true, minimum: 1, maximum: MAX_CAFES },
        },
      ],
      /* El «deja un mensaje» de Buy Me a Coffee. Opcional, y se lee en el panel
         de Stripe, en el detalle del pago. */
      custom_fields: [
        {
          key: 'mensaje',
          label: {
            type: 'custom',
            custom: es ? 'Un mensaje (opcional)' : 'A message (optional)',
          },
          type: 'text',
          optional: true,
          text: { maximum_length: 255 },
        },
      ],
      custom_text: {
        submit: {
          message: es
            ? 'Es una invitación voluntaria: no desbloquea nada, porque todo es gratis ya.'
            : 'This is a voluntary tip: it does not unlock anything, because everything is already free.',
        },
      },
      success_url: `${origen}/cafe?gracias=1`,
      cancel_url: `${origen}/cafe`,
    });

    if (!sesion.url) throw new Error('Stripe no devolvió URL');
    return NextResponse.redirect(sesion.url, 303);
  } catch (error) {
    /* Se deja rastro y se vuelve a la página con un aviso. Tragarse el error
       sin más es la trampa del bucket de pósters (docs/STATE.md). */
    console.error('[cafe] no se pudo abrir la pasarela', error);
    return NextResponse.redirect(`${origen}/cafe?error=1`, 303);
  }
}
