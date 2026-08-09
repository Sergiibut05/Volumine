# Obligaciones legales

**Esto no es asesoramiento jurídico.** Es el andamiaje: la estructura correcta,
ajustada a lo que el producto hace de verdad, con los huecos marcados. Antes de
abrir al público debería revisarlo alguien que sepa — sobre todo si cambia el
país de establecimiento o en cuanto se empiece a cobrar.

Se ha escrito asumiendo **establecimiento en España** y, por tanto, RGPD +
LOPDGDD + LSSI-CE. Si el titular se domicilia en otro sitio, cambian los
artículos y la autoridad de control.

---

## 1. Lo que hay que rellenar (bloquea la publicación)

Todo en **`src/lib/legal.ts`**, en un solo sitio para que no se contradigan
entre páginas. Mientras falte cualquiera, las páginas legales muestran un aviso
rojo.

| Campo       | De dónde sale                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `nombre`    | Nombre y apellidos si eres autónomo; razón social si es una S.L.                                                         |
| `nif`       | Tu NIF, o el CIF de la sociedad                                                                                          |
| `domicilio` | Domicilio a efectos de notificaciones. Debe ser real: es donde te pueden notificar                                       |
| `email`     | Correo de contacto. Sirve también para ejercer derechos de protección de datos                                           |
| `dominio`   | El dominio definitivo, sin `https://`                                                                                    |
| `registro`  | **Solo** si es una sociedad: registro mercantil, tomo, folio, hoja. En persona física se queda en `null` y no se muestra |

> Un aviso legal sin NIF no es un aviso legal incompleto: es un incumplimiento
> del artículo 10 de la LSSI.

---

## 2. Lo que hay que aceptar en cada proveedor

Tienen contrato de encargado de tratamiento estándar, pero **hay que aceptarlo
activamente** en cada panel. Sin eso, la cesión de datos no está amparada.

- [ ] **Supabase** — DPA en el panel de la organización · <https://supabase.com/legal/dpa>
- [ ] **Vercel** — DPA en Settings → Legal · <https://vercel.com/legal/dpa>
- [ ] **Stripe** — al activar los pagos · <https://stripe.com/legal/dpa>

Cada servicio nuevo que llegue a ver datos de usuarios entra en `ENCARGADOS`
(en `src/lib/legal.ts`) **antes** de entrar en producción, y aparece solo en la
tabla de la política de privacidad.

---

## 3. Registro de actividades de tratamiento (art. 30 RGPD)

Documento **interno**, no se publica. Obligatorio salvo excepciones que casi
nunca aplican cuando hay tratamiento habitual. Con la política de privacidad ya
escrita, el registro es un resumen de lo mismo: finalidades, categorías de
interesados y de datos, destinatarios, transferencias, plazos y medidas de
seguridad. La AEPD publica una plantilla.

- [ ] Redactarlo y guardarlo fuera del repositorio

---

## 4. Por qué no hace falta banner de cookies

Auditado en el código, no supuesto. Se ponen **dos** cookies:

- `sb-…-auth-token` — sesión de Supabase Auth
- `volumine-locale` — idioma elegido a mano

Las dos son técnicas, así que entran en la exención del **art. 22.2 LSSI**:
estrictamente necesarias para prestar un servicio pedido expresamente. Nada de
analítica, publicidad ni medición de terceros.

> ⚠️ **Esto se rompe en cuanto entre una sola herramienta de analítica.** Ese
> día aparecen a la vez la obligación del banner (con rechazo tan fácil como la
> aceptación) y la necesidad de reescribir `/legal/cookies`. Las dos cosas van
> juntas.

La ruta `/embed` no pone cookies ni llama a terceros, y eso es una regla dura
del proyecto (`CLAUDE.md`). Es un argumento comercial real para quien tenga que
incrustar en un sitio con política estricta.

---

## 5. Cuando se empiece a cobrar

Nada de esto aplica hoy, pero conviene tenerlo escrito antes de tocar Stripe.

- [ ] **Derecho de desistimiento** (14 días). En contenido digital hay excepción,
      pero exige recabar **consentimiento previo y expreso** para empezar antes
      de que pase el plazo, y que el usuario reconozca que pierde el derecho.
      Eso se implementa **en la pasarela**, no en un texto: una casilla marcada
      por la persona, con constancia de que se marcó.
- [ ] **Información precontractual**: precio con impuestos, duración, renovación
      automática y cómo cancelar, todo antes del botón de pagar.
- [ ] El botón de pago debe decir que obliga a pagar («Suscribirse y pagar»),
      no un genérico «Continuar».
- [ ] **Facturas** y su conservación según normativa mercantil y fiscal.
- [ ] Repasar el apartado «Precio» de `/legal/terminos`, hoy escrito en futuro.

---

## 6. Revisiones

- `ULTIMA_REVISION` en `src/lib/legal.ts` se actualiza **a mano** cuando cambia
  el texto. Está así a propósito: una fecha que se actualiza sola cada día es
  una mentira sobre la vigencia del documento.
- Si cambia de forma relevante la política de privacidad, hay que avisar en el
  sitio y por correo a quien tenga cuenta.

---

## 7. Lo que queda fuera de este repositorio

- [ ] Alta censal y, si procede, en autónomos
- [ ] Comprobar si hace falta **delegado de protección de datos**. Con este
      tratamiento lo normal es que no, pero conviene dejarlo razonado por escrito
- [ ] Procedimiento para atender derechos y para notificar brechas a la AEPD en
      72 horas. No hace falta que sea complejo, pero sí que exista antes de que
      haga falta
