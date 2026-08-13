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
    /*
      PAGO ÚNICO, no suscripción. El valor de este producto es un evento —haces
      una gráfica, la publicas y ya está—, no un servicio que se consume cada
      mes. Cobrar una renta por algo que se usó una tarde obliga a contestar qué
      pasa con lo ya publicado cuando alguien cancela, y las dos respuestas
      posibles son malas: o le rompes la web retroactivamente, o pagar un mes
      equivale a pagar para siempre y nadie renueva.

      Con `payment` esa pregunta desaparece.
    */
    mode: 'payment',
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
      EL CONSENTIMIENTO, RECOGIDO POR STRIPE Y NO POR NOSOTROS.

      En contenido digital el desistimiento de catorce días solo decae si quien
      compra consiente expresamente empezar ya Y reconoce que con eso lo pierde.
      Eso estaba resuelto con una casilla en nuestra página que además BLOQUEABA
      el botón: un requisito legal convertido en obstáculo, en el peor sitio
      posible —el momento de decidir la compra— y con una pinta que no tiene
      ninguna otra tienda.

      `consent_collection` lo pide dentro del propio checkout, que es donde ese
      tipo de letra pequeña se espera y donde nadie se extraña de verla. Y de
      paso queda mejor documentado que antes: Stripe guarda la aceptación con su
      marca de tiempo en la sesión, así que hay constancia de verdad y no un
      estado de React que se pierde al recargar.
    */
    consent_collection: { terms_of_service: 'required' },
    /*
      `?pago=hecho` NO concede nada: solo sirve para enseñar un mensaje. Quien
      escriba esa URL a mano no se lleva el plan, porque el plan lo escribe el
      webhook y nadie más.
    */
    /* Crea el cliente aunque no haya suscripción: el webhook empareja por
       cliente de Stripe, y sin esto un pago único llegaría sin `customer`. */
    customer_creation: perfil?.stripe_customer_id ? undefined : 'always',
    success_url: `${origen}/mis-graficas?pago=hecho`,
    cancel_url: `${origen}/precios?pago=cancelado`,
  });

  return NextResponse.json({ url: sesion.url });
}
