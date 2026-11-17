# Pagos: solo «invítame a un café»

Volumine es gratis y no tiene plan de pago (ADR 0008). Lo único que se cobra es
la invitación voluntaria de `/cafe`. Este archivo dice qué hace falta para que
funcione y qué quedó del plan Pro que hubo antes.

## Cómo funciona

- `/cafe` — la página. Elige 1, 3 o 5 cafés de 3 € (`src/lib/cafe.ts`).
- `POST /api/stripe/cafe` — crea una sesión de Stripe Checkout con el importe
  **en línea** (`price_data`) y redirige con un 303. En la pasarela se puede
  cambiar la cantidad (hasta 20) y dejar un mensaje, que se lee en el panel de
  Stripe, en el detalle del pago.
- Vuelve a `/cafe?gracias=1`, que solo enseña un mensaje. No hay nada que
  conceder, así que no hay webhook que escuchar ni cuenta que pedir.

## Lo que hace falta

Solo una variable de entorno, en Vercel y en `.env.local`:

```
STRIPE_SECRET_KEY
```

Sin ella `/cafe` se ve igual pero sin botón de pagar. **Ya está puesta**: la de
producción es una clave real (`sk_live_`), comprobado el 2026-11-17 creando una
sesión desde la ruta.

No hay que crear productos ni precios en el panel: el café se describe en cada
sesión. Cambiar el importe es cambiar `PRECIO_CAFE_CENTIMOS` y desplegar.

## Limpieza opcional en el panel de Stripe

Nada de esto es necesario para que funcione:

- **Archivar el producto «Volumine Pro»** y su precio
  `price_1U3lnNJa0WaKbpo4SdRPvEiD` (19 € pago único). La migración 0007 ya lo
  quitó de `plan_limits`, así que ninguna ruta puede venderlo.
- **El webhook** (`/api/stripe/webhook`): se puede dejar como está — la ruta
  verifica la firma y responde 200 — o borrarlo del panel. Si se borra, se puede
  borrar también la ruta y `STRIPE_WEBHOOK_SECRET`.
- `SUPABASE_SERVICE_ROLE_KEY` ya no la usa nada. Se puede quitar de Vercel.

## La base de datos

La migración `0007_sin_plan_de_pago.sql` sube el límite gratuito de 5 a 100
gráficas y quita el `stripe_price_id` del Pro. Se aplica en el SQL Editor de
Supabase o con el MCP de Supabase (`apply_migration`).

Para comprobar que entró:

```sql
select plan, max_charts, watermark, stripe_price_id, price_cents
from public.plan_limits order by plan;
```

## Si algún día vuelve un plan de pago

El esquema sigue entero (`plan`, `plan_limits`, cuota y marca de agua por
trigger). El código del checkout, el portal, el webhook que concedía el plan y
la página de precios está en el historial: el último commit que lo tiene es
`b0c1e9c`. Y antes de cobrar hay que repasar `/legal/terminos` y
`docs/LEGAL.md` (desistimiento, IVA con `automatic_tax`, información
precontractual).
