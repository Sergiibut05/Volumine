-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0007 — Sin plan de pago: el gratuito deja de ser una muestra            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- El plan Pro se quitó (ADR 0008). Volumine es gratis y lo único que se cobra
-- es una invitación voluntaria que no desbloquea nada.
--
-- Con eso, el límite de 5 gráficas del plan gratuito se convierte en una pared
-- SIN PUERTA: se había bajado de 20 a 5 para empujar a pagar (docs/PAGOS.md), y
-- ya no hay a dónde empujar. Quien llegase a 5 solo podría borrar.
--
-- Se sube a 100 y no a «infinito» a propósito: el tope sigue protegiendo la
-- base y el Storage de los pósters frente a un script que guarde en bucle, que
-- es para lo que sirve una cuota cuando no se cobra.
--
-- ── LO QUE NO SE TOCA ──────────────────────────────────────────────────────
--
-- · El ESQUEMA. `plan`, `plan_limits`, el trigger de cuota y la marca de agua
--   derivada del plan siguen ahí: CLAUDE.md pide que nada impida cobrar mañana,
--   y volver a tener un plan de pago es un UPDATE, no una migración con gente
--   dentro.
-- · La MARCA DE AGUA del plan gratuito. Es el pequeño «Volumine» de la esquina
--   del embed y es como lo descubre más gente; la página del café lo dice tal
--   cual. Quitarla para todos es una línea:
--       update public.plan_limits set watermark = false where plan = 'free';
--   y el trigger `perfil_repasar_marcas` NO se dispara con eso (solo con un
--   cambio de plan del perfil), así que habría que repasar las gráficas:
--       update public.charts c set watermark = false
--       from public.profiles p where p.id = c.owner_id and p.plan = 'free';

update public.plan_limits
set max_charts = 100
where plan = 'free';

-- El precio de Stripe del Pro deja de estar a la venta. Sin `stripe_price_id`
-- ninguna ruta podría abrir una pasarela para él aunque alguien recuperase el
-- código antiguo del historial. El importe se queda como dato histórico.
update public.plan_limits
set stripe_price_id = null
where plan in ('pro', 'team');
