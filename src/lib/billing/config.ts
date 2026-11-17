import 'server-only';

/*
  Stripe: SOLO para los cafés.

  Hubo un plan Pro de pago único (ver `docs/PAGOS.md` y la ADR 0008, que cuenta
  por qué se quitó). Lo que queda es la invitación voluntaria, y para eso basta
  con la clave secreta: el importe va en línea en la sesión y no hace falta ni
  webhook, ni `service_role`, ni ningún precio dado de alta en el panel.

  Sin la clave, la página del café sigue existiendo pero no enseña el botón de
  pagar: el producto funciona entero sin Stripe.

  ── LA REGLA QUE NO SE PUEDE ROMPER ────────────────────────────────────────
  La `sk_` no aparece nunca en código que llegue al navegador. Este archivo
  lleva `server-only` para que importarlo desde un componente de cliente rompa
  el build en vez de filtrar la clave.
*/

/** La clave secreta de Stripe, o `null` si este despliegue no cobra cafés. */
export function stripeSecretKey(): string | null {
  return process.env.STRIPE_SECRET_KEY || null;
}

/** ¿Se puede invitar a un café desde este despliegue? */
export function cafeEnabled(): boolean {
  return stripeSecretKey() !== null;
}

/**
 * El secreto del webhook, si existe. Solo lo usa la ruta que acusa recibo de
 * los eventos — ver `api/stripe/webhook/route.ts`.
 */
export function stripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null;
}
