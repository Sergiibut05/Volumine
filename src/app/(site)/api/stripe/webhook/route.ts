import Stripe from 'stripe';
import { billingEnabled, billingEnv } from '@/lib/billing/config';
import { downgrade, planForPrice, setPlanForCustomer } from '@/lib/billing/admin';

/*
  El webhook de Stripe. ESCRITO Y APAGADO.

  Sin las variables de entorno devuelve 404 y no toca nada: mientras el producto
  sea gratis, esta ruta no existe a efectos prácticos.

  ── LO QUE HACE QUE ESTO SEA SEGURO ────────────────────────────────────────

  Es un endpoint PÚBLICO que cambia planes de pago. Cualquiera puede llamarlo.
  Lo único que separa un evento de Stripe de uno inventado es LA FIRMA, y por
  eso se verifica antes de mirar el contenido — antes incluso de parsear el
  JSON.

  Para verificarla hace falta el cuerpo EN CRUDO, byte a byte. Si se leyera con
  `request.json()` y se volviera a serializar, el resultado no coincidiría con
  lo que Stripe firmó y todo evento legítimo se rechazaría. Es el fallo clásico
  de esta integración.

  Se usa la librería y no una verificación propia a mano: son quince líneas de
  criptografía con tolerancia de reloj y varias firmas simultáneas durante una
  rotación de secreto. Escribirlas uno mismo es exactamente el sitio donde no
  conviene ser ingenioso.
*/

export const dynamic = 'force-dynamic';

/**
 * Los eventos que nos importan, y por qué cada uno.
 *
 * Se ignoran los demás en silencio con un 200: Stripe reintenta lo que no
 * responda 2xx, así que devolver error a un evento que no nos interesa se
 * convierte en reintentos eternos.
 */
export async function POST(request: Request) {
  if (!billingEnabled()) {
    // Sin configurar, la ruta no existe. 404 y no 500: no es un fallo.
    return new Response('No disponible', { status: 404 });
  }

  const { secretKey, webhookSecret } = billingEnv();
  const firma = request.headers.get('stripe-signature');
  if (!firma) return new Response('Falta la firma', { status: 400 });

  const stripe = new Stripe(secretKey);

  let evento: Stripe.Event;
  try {
    /* EL CUERPO EN CRUDO. Ver la nota de arriba: `request.json()` aquí rompe la
       verificación de forma silenciosa y difícil de diagnosticar. */
    const crudo = await request.text();
    evento = stripe.webhooks.constructEvent(crudo, firma, webhookSecret);
  } catch {
    /* Firma inválida. Sin detalles en la respuesta: es un endpoint público y
       decir POR QUÉ ha fallado ayuda a quien lo esté probando a ciegas. */
    return new Response('Firma inválida', { status: 400 });
  }

  try {
    switch (evento.type) {
      /* Alguien acaba de pagar. Es el momento en que un usuario y un cliente de
         Stripe quedan atados: el `client_reference_id` lo ponemos nosotros al
         crear la sesión, y es nuestro `id` de usuario. */
      case 'checkout.session.completed': {
        const sesion = evento.data.object;
        const customer = String(sesion.customer ?? '');
        if (!customer) break;

        /*
          DOS CAMINOS, Y EL QUE IMPORTA HOY ES EL SEGUNDO.

          Con suscripción, el precio está dentro de la suscripción y hay una
          fecha de caducidad. Con PAGO ÚNICO no hay suscripción ninguna: el
          precio viene en las líneas de la propia sesión y no caduca nunca.

          Se miran los dos porque el modo lo decide `plan_limits`, no este
          fichero: si algún día vuelve a haber un plan recurrente, esta rama
          sigue funcionando sin tocarla.
        */
        const suscripcion =
          typeof sesion.subscription === 'string' ? sesion.subscription : null;

        if (suscripcion) {
          const sub = await stripe.subscriptions.retrieve(suscripcion);
          const price = sub.items.data[0]?.price?.id;
          const plan = price ? await planForPrice(price) : null;
          if (!plan) break;

          await setPlanForCustomer(customer, plan, {
            subscriptionId: sub.id,
            expiresAt: new Date(sub.items.data[0].current_period_end * 1000).toISOString(),
          });
          break;
        }

        /*
          Pago único. `expiresAt: null` es lo que hace que sea PARA SIEMPRE, y
          es deliberado: quien compró una vez no puede perder lo que compró
          porque nadie va a renovar nada. Es justo lo que arregla la pregunta
          que el modelo de suscripción no sabía contestar —qué pasa con las
          gráficas ya publicadas cuando alguien deja de pagar—.

          Las líneas no vienen en el evento: hay que pedirlas aparte.
        */
        const lineas = await stripe.checkout.sessions.listLineItems(sesion.id, {
          limit: 1,
        });
        const price = lineas.data[0]?.price?.id;
        const plan = price ? await planForPrice(price) : null;
        if (!plan) break;

        await setPlanForCustomer(customer, plan, {
          subscriptionId: null,
          expiresAt: null,
        });
        break;
      }

      /* Cambios de la suscripción: subir de plan, bajar, o que Stripe la marque
         como impagada. `updated` cubre los tres. */
      case 'customer.subscription.updated': {
        const sub = evento.data.object;
        const customer = typeof sub.customer === 'string' ? sub.customer : null;
        if (!customer) break;

        /* `past_due` y `unpaid` NO degradan todavía: Stripe sigue reintentando
           el cobro durante días. Quitarle el plan a alguien porque su tarjeta
           falló un martes es la peor forma de perder un cliente que iba a
           pagar. Se degrada cuando la suscripción muere de verdad. */
        const viva = sub.status === 'active' || sub.status === 'trialing';
        if (!viva) break;

        const price = sub.items.data[0]?.price?.id;
        const plan = price ? await planForPrice(price) : null;
        if (!plan) break;

        await setPlanForCustomer(customer, plan, {
          subscriptionId: sub.id,
          expiresAt: new Date(sub.items.data[0].current_period_end * 1000).toISOString(),
        });
        break;
      }

      /* Se acabó: cancelada o impagada del todo. A gratis.

         Esto dispara el trigger `perfil_repasar_marcas` de la migración 0001, o
         sea que la marca de agua vuelve a TODAS sus gráficas publicadas sola. */
      case 'customer.subscription.deleted': {
        const sub = evento.data.object;
        const customer = typeof sub.customer === 'string' ? sub.customer : null;
        if (customer) await downgrade(customer);
        break;
      }
    }
  } catch {
    /* Un fallo NUESTRO sí devuelve 500 a propósito: Stripe reintenta con espera
       creciente durante días, así que una caída de la base de datos no pierde
       el pago de nadie. Es justo lo contrario del caso de arriba. */
    return new Response('Error al procesar', { status: 500 });
  }

  return new Response('ok', { status: 200 });
}
