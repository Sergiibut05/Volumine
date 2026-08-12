# Activar los pagos

El código está entero: `/precios`, `/api/stripe/checkout`, `/api/stripe/portal` y
el webhook. Lo que queda es configuración, y va aquí porque no vive en el
repositorio.

## 0. El modelo: PAGO ÚNICO, no suscripción

La suscripción no encajaba con el producto, y el argumento que la tumbó es una
pregunta que no tenía buena respuesta: **¿qué pasa con las gráficas ya
publicadas cuando alguien cancela?**

- Si vuelve la marca de agua, le rompes la web a un cliente retroactivamente.
- Si no vuelve, pagar un mes equivale a pagar para siempre y nadie renueva.

No hay tercera opción. El valor de Volumine es un EVENTO —haces una gráfica, la
publicas y ya está—, no un servicio que se consume cada mes. Con pago único la
pregunta desaparece.

El código ya lo contempla: `mode: 'payment'` en el checkout y, en el webhook,
`expiresAt: null` — que es lo que hace que sea para siempre. La rama de
suscripción sigue ahí por si algún día vuelve a haber un plan recurrente, y
entonces tendrá sentido: cuando exista un valor CONTINUO de verdad, como poder
actualizar los datos de una gráfica publicada sin cambiar el link.

---

## 1. El precio, en la base de datos

El `price_id` **no se versiona en una migración**: es de una cuenta de Stripe
concreta y cambia entre el modo de prueba y el real. Va como dato, que es donde
lo dejó preparado la migración 0005.

```sql
-- El plan de pago: 19 EUR, una sola vez.
update public.plan_limits
set stripe_price_id = 'PEGA_AQUI_EL_NUEVO_price_id',
    price_cents     = 1900,
    currency        = 'eur'
where plan = 'pro';

-- Y el gratuito baja de 20 a 5. Veinte gráficas gratis son tantas que quien las
-- agota ya no va a pagar nunca, y sobre todo: un plan gratuito muy generoso
-- señala que el producto vale poco.
update public.plan_limits
set max_charts = 5
where plan = 'free';
```

> El `price_id` de arriba **es nuevo**: al pasar de recurrente a puntual hay que
> crear otro precio en Stripe. El anterior (`price_1U3cFu…`) era de 9 €/mes y ya
> no sirve.

Para comprobar que entró:

```sql
select plan, price_cents, currency, stripe_price_id, max_charts, watermark
from public.plan_limits order by price_cents;
```

> ⚠️ **Los IDs de prueba y los reales son distintos.** Si ese precio se creó en
> modo prueba, solo funciona con una `sk_test_`. Mezclar una clave real con un
> precio de prueba da un error de «no such price» al abrir la pasarela, y es el
> fallo más común al activar Stripe. Al pasar a producción hay que rehacer el
> producto en modo real y volver a lanzar este `update`.

## 2. En el panel de Stripe

- [ ] **Impuestos automáticos** — Configuración → Impuestos. Sin esto el
      `automatic_tax` del checkout falla y la pasarela no abre.
- [ ] **Portal de clientes** — Configuración → Portal. Activar *cancelar
      suscripción* y *ver facturas*: es lo que hace útil `/api/stripe/portal` y
      lo que cumple que darse de baja sea tan fácil como suscribirse.
- [ ] **Webhook** — Desarrolladores → Webhooks → `https://volumine.app/api/stripe/webhook`
      con `checkout.session.completed`, `customer.subscription.created`,
      `customer.subscription.updated` y `customer.subscription.deleted`.
- [ ] **Radar**: plan Lite. Ver el razonamiento en la conversación — en Europa,
      3D Secure ya traslada la responsabilidad del fraude al banco emisor.
- [ ] **Descriptor de extracto**: `VOLUMINE.APP`, abreviado `VOLUMINE`. Un nombre
      personal en el extracto es la primera causa de contracargo.

## 3. Variables de entorno

En Vercel y en `.env.local`. **Ninguna lleva `NEXT_PUBLIC_`**: con la `sk_` se
puede hacer cualquier cosa en la cuenta de Stripe, y la `service_role` se salta
RLS entera.

```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
SUPABASE_SERVICE_ROLE_KEY
```

Mientras falte cualquiera de las tres, `billingEnabled()` devuelve `false`: las
rutas de pago responden 404 y `/precios` enseña solo el plan gratuito. Es a
propósito — el producto sigue funcionando entero sin cobrar.

## 4. Probar antes de abrir

- [ ] Con claves de **prueba**, comprar con la tarjeta `4242 4242 4242 4242`.
- [ ] Comprobar en `profiles` que el plan pasó a `pro` y que se guardaron
      `stripe_customer_id` y `stripe_subscription_id`.
- [ ] Comprobar que la marca de agua desaparece de una gráfica publicada.
- [ ] Cancelar desde el portal y ver que vuelve a `free` al expirar.
- [ ] **Rotar la `service_role`** antes de desplegar: se pegó en un chat y hasta
      ahora no la usaba nadie, pero el webhook sí la usa.
