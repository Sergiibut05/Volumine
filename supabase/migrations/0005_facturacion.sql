-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0005 — Facturación: preparada, apagada                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- El producto es gratis hoy y va a seguir siéndolo un tiempo. Esto no lo
-- cambia: añade lo que hace falta para poder cobrar el día que se decida, sin
-- migrar nada con gente dentro.
--
-- LA PARTE DIFÍCIL YA ESTABA HECHA desde la 0001: `plan`, `plan_limits`, la
-- cuota por trigger y la marca de agua derivada del plan. Eso es lo que habría
-- costado añadir con usuarios reales. Lo que falta aquí es la fontanería para
-- hablar con Stripe, que es poco.
--
-- ── QUIÉN PUEDE CAMBIAR UN PLAN ─────────────────────────────────────────────
--
-- NADIE desde el navegador, y eso ya lo garantiza la 0003: `authenticated` solo
-- tiene permiso de UPDATE sobre la columna `display_name`. El plan lo cambia el
-- webhook de Stripe con `service_role`, que se salta RLS y no pasa por ese
-- permiso.
--
-- Esa separación es justo lo que hace que esto sea seguro sin código extra: un
-- usuario no puede subirse de plan aunque descubra el endpoint, porque la
-- barrera está en Postgres y no en una comprobación nuestra.

alter table public.profiles
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text unique,
  /*
    Cuándo deja de valer el plan actual.

    Se guarda para poder degradar a `free` sin depender de que llegue un webhook
    concreto: si Stripe falla o se pierde un evento, una tarea puede mirar esta
    fecha. Sin ella, un impago que no notifique dejaría a alguien en `pro` para
    siempre.
  */
  add column plan_expires_at timestamptz;

comment on column public.profiles.stripe_customer_id is
  'Cliente de Stripe. Lo escribe el webhook con service_role, nunca el cliente.';

/*
  Índice para el webhook.

  Stripe manda el `customer`, no nuestro `id`: cada evento entra buscando por
  esta columna. Sin índice, cada webhook sería un recorrido de toda la tabla —
  irrelevante con cien filas, y un problema el día que haya cien mil.

  Parcial, porque la inmensa mayoría de perfiles no tendrán cliente de Stripe
  nunca: el índice ocupa lo que ocupan los que pagan.
*/
create index profiles_stripe_customer_idx on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

/*
  El precio de cada plan, junto a sus límites.

  Va en la tabla y no en el código por lo mismo que los límites: cambiar un
  precio tiene que ser un UPDATE, no un despliegue. Y el identificador del
  precio de Stripe vive aquí para que el checkout no lo lleve escrito a mano —
  un `price_id` mal copiado cobra otra cosa.
*/
alter table public.plan_limits
  add column stripe_price_id text,
  /* En céntimos y en enteros. Un precio en coma flotante acaba cobrando 9,989. */
  add column price_cents integer not null default 0,
  add column currency text not null default 'eur';

comment on column public.plan_limits.stripe_price_id is
  'El `price_...` de Stripe. Se rellena al configurar los productos, no antes.';
