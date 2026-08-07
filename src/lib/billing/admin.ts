import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabaseEnv } from '@/lib/supabase/env';
import { billingEnv, PLAN_POR_DEFECTO, type Plan } from './config';

/*
  EL ÚNICO SITIO DE TODO EL PROYECTO QUE USA `service_role`.

  Esa clave se salta RLS entera. Está aquí porque cambiar el plan de alguien es
  precisamente lo que NADIE puede hacer desde el navegador: la migración 0003
  deja a `authenticated` con permiso de escritura solo sobre `display_name`,
  justo para que descubrir un endpoint no sirva para subirse de plan.

  El cambio de plan tiene que venir de Stripe, y Stripe habla con el webhook.

  `server-only`: importar esto desde un componente de cliente rompe el build en
  vez de mandar la clave al navegador (ADR 0007).
*/

function admin() {
  const { url } = supabaseEnv();
  const { serviceRoleKey } = billingEnv();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Ata un usuario a su cliente de Stripe. Idempotente. */
export async function linkCustomer(userId: string, customerId: string): Promise<void> {
  await admin()
    .from('profiles')
    .update({ stripe_customer_id: customerId })
    .eq('id', userId);
}

/**
 * Cambia el plan de quien corresponda a un cliente de Stripe.
 *
 * Busca por `stripe_customer_id` porque es lo ÚNICO que Stripe conoce de
 * nosotros: sus eventos traen `customer`, no nuestro `id`. Si no hay perfil con
 * ese cliente, no se hace nada y no se da error — un evento de un cliente que no
 * es nuestro no es un fallo, y reventar haría que Stripe lo reintentara para
 * siempre.
 *
 * El cambio de plan dispara el trigger `perfil_repasar_marcas` de la migración
 * 0001, que repasa la marca de agua de TODAS las gráficas del usuario. O sea que
 * pagar quita la marca de lo ya publicado sin tocar nada más, que es lo que
 * cualquiera espera al pagar.
 */
export async function setPlanForCustomer(
  customerId: string,
  plan: Plan,
  options: { subscriptionId?: string | null; expiresAt?: string | null } = {},
): Promise<{ changed: boolean }> {
  const { data } = await admin()
    .from('profiles')
    .update({
      plan,
      stripe_subscription_id: options.subscriptionId ?? null,
      plan_expires_at: options.expiresAt ?? null,
    })
    .eq('stripe_customer_id', customerId)
    .select('id')
    .maybeSingle<{ id: string }>();

  return { changed: Boolean(data) };
}

/** A qué plan corresponde un precio de Stripe. `null` si no es ninguno nuestro. */
export async function planForPrice(priceId: string): Promise<Plan | null> {
  const { data } = await admin()
    .from('plan_limits')
    .select('plan')
    .eq('stripe_price_id', priceId)
    .maybeSingle<{ plan: Plan }>();

  return data?.plan ?? null;
}

/** Degrada a gratis. Lo que pasa cuando una suscripción se acaba o no se paga. */
export async function downgrade(customerId: string) {
  return setPlanForCustomer(customerId, PLAN_POR_DEFECTO, {
    subscriptionId: null,
    expiresAt: null,
  });
}
