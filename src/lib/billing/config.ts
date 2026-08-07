import 'server-only';

/*
  Facturación: PREPARADA Y APAGADA.

  Todo el camino de cobro está escrito, pero no se enciende hasta que existan
  las variables de entorno. Sin ellas la aplicación se comporta exactamente como
  hoy — gratis, sin botones de pago y sin rutas que respondan.

  POR QUÉ ESCRIBIRLO AHORA SI NO SE VA A USAR: porque lo caro no es el código,
  es el esquema. Añadir `plan` y cuotas con mil usuarios dentro obliga a una
  migración con datos en producción; añadirlo hoy es una línea. El resto es
  fontanería que se prueba mejor con calma que con prisa.

  ── LA REGLA QUE NO SE PUEDE ROMPER ────────────────────────────────────────
  La `service_role` NO aparece nunca en código que llegue al navegador. Solo la
  usa el webhook, que corre en servidor. Este archivo lleva `server-only` para
  que importarlo desde un componente de cliente rompa el build en vez de filtrar
  la clave (ADR 0007).
*/

/** ¿Hay facturación configurada? Si no, el producto es gratis y punto. */
export function billingEnabled(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export type BillingEnv = {
  secretKey: string;
  webhookSecret: string;
  serviceRoleKey: string;
};

/**
 * Las claves, o un error claro.
 *
 * Se leen aquí y no se esparcen por el código: si mañana hay que rotarlas o
 * renombrarlas, hay un solo sitio donde mirar.
 */
export function billingEnv(): BillingEnv {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey || !webhookSecret || !serviceRoleKey) {
    throw new Error(
      'Facturación sin configurar. Hacen falta STRIPE_SECRET_KEY, ' +
        'STRIPE_WEBHOOK_SECRET y SUPABASE_SERVICE_ROLE_KEY. Ver .env.example.',
    );
  }

  return { secretKey, webhookSecret, serviceRoleKey };
}

/**
 * De un precio de Stripe al plan que da.
 *
 * El mapa vive en `plan_limits.stripe_price_id`, en la base de datos: cambiar
 * un precio tiene que ser un UPDATE y no un despliegue. Esta función solo lo
 * consulta.
 */
export type Plan = 'free' | 'pro' | 'team';

/** Lo que se degrada cuando una suscripción muere. */
export const PLAN_POR_DEFECTO: Plan = 'free';
