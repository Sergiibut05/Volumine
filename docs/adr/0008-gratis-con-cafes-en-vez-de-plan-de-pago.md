# ADR 0008 — Gratis, con «invítame a un café» en vez de un plan de pago

**Fecha:** 2026-11-17 · **Estado:** aceptada · **Sustituye:** el modelo de
`docs/PAGOS.md` (plan Pro de pago único, 19 €)

## Contexto

Había un plan Pro de pago único: sin marca de agua y 500 gráficas, frente a las
5 del gratuito. Todo el camino estaba escrito y encendido en producción —página
de precios, checkout, webhook que concedía el plan, portal— pero el proyecto
lleva meses parado y no tiene a nadie empujando la venta.

Un plan de pago sin mantenimiento es peor que no tenerlo: obliga a contestar
correos de facturación, a mantener el IVA y el desistimiento al día, y deja a
los usuarios gratuitos contra un límite de 5 gráficas cuyo único propósito era
empujar hacia una compra que nadie atiende.

## Decisión

- **Todo es gratis para todo el mundo.** No hay plan de pago a la venta.
- En el sitio de `/precios` hay una página `/cafe` al estilo Buy Me a Coffee:
  1, 3 o 5 cafés de 3 €, y se puede cambiar la cantidad y dejar un mensaje en
  la propia pasarela.
- Se cobra con **la cuenta de Stripe que ya existía**, con el importe en línea
  (`price_data`). No hace falta dar de alta productos ni precios, ni webhook,
  ni `service_role`: solo `STRIPE_SECRET_KEY`. Sin plataforma intermedia, sin
  su comisión y sin una cuenta nueva que crear a mano.
- No hace falta cuenta para invitar, y **invitar no desbloquea nada**. La
  página y las condiciones lo dicen explícitamente.
- El límite gratuito sube de 5 a 100 gráficas (migración 0007). Sigue habiendo
  tope para proteger la base y el Storage frente a abusos.
- La marca de agua se queda en el plan gratuito: es el «Volumine» de la esquina
  y es como lo descubre más gente. Quitarla para todos es un `UPDATE` (ver la
  migración 0007).
- `/precios` redirige con 308 a `/cafe`.

## Consecuencias

- El **esquema no cambia**: `plan`, `plan_limits`, la cuota por trigger y la
  marca de agua derivada del plan siguen ahí. Volver a cobrar un plan es un
  `UPDATE` y recuperar del historial de git las rutas borradas (el último
  commit con ellas es `b0c1e9c`).
- El webhook de Stripe se queda reducido a verificar la firma y responder 200:
  en el panel hay un endpoint suscrito a `checkout.session.completed`, que es
  lo que dispara cada café, y si la ruta desapareciera Stripe acabaría
  desactivándolo tras días de reintentos y correos de aviso.
- Una invitación sin contraprestación no es una venta de servicio digital: no
  hay desistimiento de contenido digital que gestionar ni `automatic_tax` que
  configurar. Sigue siendo un ingreso a efectos fiscales.
