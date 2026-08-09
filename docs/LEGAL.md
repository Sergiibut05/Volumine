# Obligaciones legales

**Esto no es asesoramiento jurídico.** Es el andamiaje: la estructura correcta,
ajustada a lo que el producto hace de verdad, con los huecos marcados. Antes de
abrir al público debería revisarlo alguien que sepa — sobre todo si cambia el
país de establecimiento o en cuanto se empiece a cobrar.

Se ha escrito asumiendo **establecimiento en España** y, por tanto, RGPD +
LOPDGDD + LSSI-CE. Si el titular se domicilia en otro sitio, cambian los
artículos y la autoridad de control.

---

## 1. Los datos del titular — ✅ RELLENADOS

Están en **`src/lib/legal.ts`**, en un solo sitio para que no se contradigan
entre páginas. Titular: Sergii Butrii, persona física (sin datos registrales).

**Pendiente antes de abrir:**

- [x] ~~Registrar `volumine.app`~~ — hecho y funcionando.
- [ ] **Correo con el dominio propio.** El contacto sigue siendo un Gmail cuyo
      nombre (`voluma.app@`) ni siquiera coincide con el dominio (`volumine.app`).
      Legalmente vale; en un aviso legal siembra justo la duda que ese documento
      existe para despejar. Ver el apartado 8.
- [ ] **Decidir el domicilio publicado.** Ver el apartado 9: no tiene por qué ser
      la vivienda.

La referencia de qué significa cada campo:

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

---

## 8. El correo con dominio propio

Los pasos concretos están en **`docs/CORREO.md`**: recibir con Cloudflare Email
Routing y enviar con el «Enviar como» de Gmail, las dos cosas gratis.

El único punto donde se rompe es el **SPF** — solo puede haber un registro por
dominio, y aquí hay dos servicios que quieren el suyo—, así que va explicado
aparte.

Cuando funcione, `email` en `src/lib/legal.ts` pasa a `hola@volumine.app` y las
cuatro páginas se actualizan solas.

---

## 9. El domicilio no tiene por qué ser tu casa

El artículo 10 de la LSSI obliga a publicar «su domicilio o, en su defecto, la
dirección de uno de sus establecimientos permanentes en España». **Obliga a
publicar un domicilio, no a publicar tu vivienda.** Vale cualquier dirección real
donde se te pueda notificar de forma efectiva:

- **La gestoría o asesoría** que lleve las cuentas. Muchas ofrecen recibir
  notificaciones y algunas lo incluyen en la cuota. Es la salida más barata.
- **Un coworking con domiciliación**, que suele rondar los 20-50 € al mes e
  incluye recepción de correo.
- **Un servicio de domiciliación** de los que se dedican a esto.

Lo que **no** sirve es un apartado de correos: no es un domicilio a efectos de
notificaciones.

Ojo con no confundirlo con el **domicilio fiscal** del modelo 036/037, que es
otra cosa y va ante Hacienda. Que quieras cambiar el publicado no significa que
tengas que cambiar el fiscal, ni al revés — eso conviene consultarlo con quien
lleve tus impuestos.

### El NIF sí es obligatorio

Aquí no hay salida siendo persona física: el mismo artículo 10 lo exige de forma
expresa y no hay exención. Dos matices, por si sirven de consuelo:

- Tu NIE **ya viaja** en cada factura que emites y en cada contrato que firmas.
  No es un secreto del tipo de una contraseña: identifica, no autoriza. Por sí
  solo no permite hacer nada en tu nombre.
- La única forma de no publicar un identificador personal es que el prestador no
  sea una persona sino una **sociedad**: entonces se publica el CIF de la S.L. y
  su domicilio social. Eso implica constitución, contabilidad y más costes fijos,
  así que solo compensa si el proyecto va a crecer — y conviene saber que los
  administradores constan igualmente en el Registro Mercantil, que es público.
