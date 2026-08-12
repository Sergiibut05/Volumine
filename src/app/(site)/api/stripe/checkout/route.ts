import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { billingEnabled, billingEnv } from '@/lib/billing/config';
import { supabaseServer } from '@/lib/supabase/server';

/*
  Abre la pasarela de pago. La otra mitad del webhook que ya vive al lado.

  ── EL PRECIO NO LO ELIGE EL NAVEGADOR ───────────────────────────────────

  Lo que llega del cliente es un NOMBRE DE PLAN («pro»), no un `price_id` ni un
  importe. El precio se busca en `plan_limits`, que es la misma tabla de la que
  el webhook deduce qué plan conceder — así la página, el cobro y la concesión
  leen todos del mismo sitio.

  Si el navegador mandara el `price_id`, cualquiera podría abrir la pasarela con
  el de otro producto, o con uno de un céntimo creado en su propia cuenta de
  prueba. Con el nombre, lo peor que puede pedir alguien es un plan que existe,
  a su precio de verdad.

  ── Y LA CUENTA TIENE QUE EXISTIR ANTES ──────────────────────────────────

  Sin sesión no hay a quién darle el plan cuando vuelva el webhook: el pago
  quedaría cobrado y huérfano.
*/

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  /* Igual que el webhook: sin configurar, esta ruta no existe. Mientras el
     producto sea gratis no hay nada que cobrar. */
  if (!billingEnabled()) {
    return new NextResponse('Not found', { status: 404 });
  }

  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'sin sesión' }, { status: 401 });
  }

  const { plan } = (await request.json().catch(() => ({}))) as { plan?: string };
  if (!plan) {
    return NextResponse.json({ error: 'falta el plan' }, { status: 400 });
  }

  const { data: fila } = await db
    .from('plan_limits')
    .select('plan, stripe_price_id')
    .eq('plan', plan)
    .maybeSingle();

  if (!fila?.stripe_price_id) {
    return NextResponse.json({ error: 'ese plan no está a la venta' }, { status: 400 });
  }

  /* Si ya compró alguna vez se reutiliza su cliente de Stripe. Crear uno nuevo
     en cada compra parte el historial de facturas en dos personas distintas. */
  const { data: perfil } = await db
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();

  const stripe = new Stripe(billingEnv().secretKey);
  const origen = new URL(request.url).origin;

  const sesion = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: fila.stripe_price_id, quantity: 1 }],
    /* Con esto vuelve el usuario en el webhook, que empareja por cliente de
       Stripe y no por correo: el de la pasarela puede no ser el de la cuenta. */
    client_reference_id: user.id,
    customer: perfil?.stripe_customer_id ?? undefined,
    customer_email: perfil?.stripe_customer_id ? undefined : (user.email ?? undefined),
    /*
      Vendiendo desde España a la UE, el IVA depende de dónde esté quien compra.
      `automatic_tax` es lo que evita calcularlo a mano — hay que activarlo
      también en el panel de Stripe, y por eso se pide la dirección.
    */
    automatic_tax: { enabled: true },
    billing_address_collection: 'required',
    /*
      `?pago=hecho` NO concede nada: solo sirve para enseñar un mensaje. Quien
      escriba esa URL a mano no se lleva el plan, porque el plan lo escribe el
      webhook y nadie más.
    */
    success_url: `${origen}/mis-graficas?pago=hecho`,
    cancel_url: `${origen}/precios?pago=cancelado`,
  });

  return NextResponse.json({ url: sesion.url });
}
