import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { billingEnabled, billingEnv } from '@/lib/billing/config';
import { supabaseServer } from '@/lib/supabase/server';

/*
  El portal de cliente de Stripe: cambiar la tarjeta, ver las facturas y darse de
  baja.

  Se usa el suyo en vez de construir esas pantallas, y no por ahorrar trabajo:
  cancelar y descargar facturas son obligaciones que hay que cumplir bien y para
  siempre, y el portal de Stripe ya está traducido, es accesible y se mantiene
  solo. Reimplementarlo sería asumir esa deuda a cambio de nada.

  Además cumple lo que exige la normativa de consumo: **darse de baja tiene que
  ser tan fácil como suscribirse**. Aquí es un botón que lleva a un botón.
*/

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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

  const { data: perfil } = await db
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();

  /* Sin cliente de Stripe no ha pagado nunca, así que no hay portal que abrir.
     Es un 400 y no un 500: la petición es válida, simplemente no aplica. */
  if (!perfil?.stripe_customer_id) {
    return NextResponse.json({ error: 'sin suscripción' }, { status: 400 });
  }

  const stripe = new Stripe(billingEnv().secretKey);

  const sesion = await stripe.billingPortal.sessions.create({
    customer: perfil.stripe_customer_id,
    return_url: `${new URL(request.url).origin}/mis-graficas`,
  });

  return NextResponse.json({ url: sesion.url });
}
