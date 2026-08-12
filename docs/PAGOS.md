# Activar los pagos

El código está entero: `/precios`, `/api/stripe/checkout`, `/api/stripe/portal` y
el webhook. Lo que queda es configuración, y va aquí porque no vive en el
repositorio.

## 1. El precio, en la base de datos

El `price_id` **no se versiona en una migración**: es de una cuenta de Stripe
concreta y cambia entre el modo de prueba y el real. Va como dato, que es donde
lo dejó preparado la migración 0005.

```sql
update public.plan_limits
set stripe_price_id = 'price_1U3cFuJa0WaKbpo4PWLqBBHR',
    price_cents     = 900,
    currency        = 'eur'
where plan = 'pro';
```

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
