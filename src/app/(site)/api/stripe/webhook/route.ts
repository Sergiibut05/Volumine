import Stripe from 'stripe';
import { stripeSecretKey, stripeWebhookSecret } from '@/lib/billing/config';

/*
  El webhook de Stripe: ACUSA RECIBO Y NADA MÁS.

  Aquí vivía la concesión del plan Pro. Con el plan fuera (ADR 0008) no queda
  nada que hacer cuando alguien paga: un café no activa nada.

  ── ENTONCES, ¿POR QUÉ SIGUE EXISTIENDO? ──────────────────────────────────

  Porque en el panel de Stripe hay un endpoint dado de alta apuntando aquí y
  suscrito a `checkout.session.completed`, que es justo lo que dispara cada
  café. Si esta ruta desapareciera, cada invitación acabaría en un 404: Stripe
  reintenta durante días, manda correos de aviso y termina DESACTIVANDO el
  endpoint. Mantenerla responde 200 y no obliga a nadie a ir al panel a
  borrarlo. Quien quiera, puede borrar el endpoint allí y luego este archivo.

  Se sigue verificando la firma: es un endpoint público, y si algún día vuelve
  a hacer algo, la puerta tiene que estar ya cerrada.
*/

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secretKey = stripeSecretKey();
  const webhookSecret = stripeWebhookSecret();
  if (!secretKey || !webhookSecret) {
    return new Response('No disponible', { status: 404 });
  }

  const firma = request.headers.get('stripe-signature');
  if (!firma) return new Response('Falta la firma', { status: 400 });

  try {
    /* El cuerpo EN CRUDO: `request.json()` y volver a serializar rompería la
       firma de forma silenciosa. */
    const crudo = await request.text();
    new Stripe(secretKey).webhooks.constructEvent(crudo, firma, webhookSecret);
  } catch {
    return new Response('Firma inválida', { status: 400 });
  }

  return new Response('ok', { status: 200 });
}
