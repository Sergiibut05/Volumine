# El correo del dominio

Cómo queda `hola@volumine.app`: **recibir** con Cloudflare Email Routing y
**enviar** desde el Gmail de siempre. Las dos partes son gratis.

> El paso que rompe esto si se hace mal es el **SPF**. Va explicado abajo, en el
> apartado 3, y es literalmente el único sitio donde se puede meter la pata.

---

## 1. Recibir — Cloudflare Email Routing

Requisito: `volumine.app` tiene que usar Cloudflare como DNS. Si se compró en
otro registrador, basta con cambiar los _nameservers_ a los que indique
Cloudflare; el dominio sigue siendo del mismo sitio.

1. Panel de Cloudflare → el dominio → **Email** → **Email Routing** → _Get
   started_.
2. Cloudflare propone los registros **MX** y un **TXT de SPF** y los añade solo.
   Aceptar.
3. **Destination addresses** → añadir `voluma.app@gmail.com`. Llega un correo de
   verificación a ese buzón: hay que pulsar el enlace o el reenvío no se activa.
4. **Routing rules** → _Create address_:
   - Custom address: `hola@volumine.app`
   - Action: _Send to an email_ → `voluma.app@gmail.com`

Con esto ya llega el correo. Tarda unos minutos en propagar.

> Cloudflare Email Routing **solo recibe**. No es un buzón: no se puede enviar
> desde él, y por eso hace falta el paso 2.

---

## 2. Enviar — «Enviar como» de Gmail

Gmail deja mandar poniendo otra dirección en el remitente, pero necesita un SMTP
por el que salir. Se usa el del propio Gmail.

Antes hace falta una **contraseña de aplicación** de Google, que exige tener la
verificación en dos pasos activada: cuenta de Google → _Seguridad_ →
_Verificación en 2 pasos_ → _Contraseñas de aplicaciones_.

> ⚠️ Esa contraseña **no entra en el repositorio** ni en ningún `.env`
> versionado. Es una credencial de una cuenta personal de Google: quien la tenga
> puede enviar correo como tú.

Luego, en Gmail → **Configuración** → _Cuentas e importación_ → **Enviar como** →
_Añadir otra dirección de correo_:

| Campo             | Valor                       |
| ----------------- | --------------------------- |
| Nombre            | Volumine                    |
| Dirección         | `hola@volumine.app`         |
| Tratar como alias | Desmarcado                  |
| Servidor SMTP     | `smtp.gmail.com`            |
| Puerto            | 587                         |
| Usuario           | `voluma.app@gmail.com`      |
| Contraseña        | la contraseña de aplicación |
| Conexión          | TLS                         |

Gmail manda un **código de verificación a `hola@volumine.app`**. Como el paso 1
ya está hecho, ese código cae en el mismo Gmail: se copia y se pega.

Al final, en _Enviar como_, marcar `hola@volumine.app` como **predeterminada** si
se quiere que sea la que sale por defecto.

---

## 3. El SPF, que es donde se rompe

**Solo puede haber UN registro SPF por dominio.** Dos registros `v=spf1` no se
suman: los servidores que reciben tratan la situación como configuración
inválida y el resultado es peor que no tener ninguno.

El problema es que aquí hay dos cosas que quieren su SPF:

- Cloudflare Email Routing añade el suyo al activar el reenvío.
- Enviar desde `smtp.gmail.com` necesita el de Google.

Así que hay que **fundirlos en una sola línea**. En Cloudflare → DNS, editar el
TXT de la raíz del dominio y dejarlo así:

```
v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all
```

Y comprobar que **no queda ningún otro TXT que empiece por `v=spf1`**.

### DMARC, recomendable

Un TXT en `_dmarc.volumine.app`:

```
v=DMARC1; p=none; rua=mailto:hola@volumine.app
```

`p=none` no rechaza nada: solo pide informes. Es la forma de ver quién manda
correo en nombre del dominio antes de endurecer nada.

### DKIM: aquí no lo hay, y conviene saberlo

Enviando por `smtp.gmail.com`, Google firma con **su** dominio, no con
`volumine.app`. No es un fallo de configuración: es el límite del método. El
correo llega igual —el SPF lo respalda—, pero la entregabilidad nunca será la de
un proveedor donde el dominio se verifica de verdad.

Para el correo de una persona da igual. Para el correo automático del producto,
no: ver abajo.

---

## 4. Esto NO es el SMTP del producto

Son dos cosas distintas y conviene no mezclarlas:

- **`hola@volumine.app`** — correo de persona. Contacto del aviso legal,
  responder a quien escriba. Volumen: unos pocos al día. Con lo de arriba sobra.
- **Los enlaces de acceso** (`signInWithOtp`) — correo automático que sale solo
  cada vez que alguien entra.

Para lo segundo, Gmail es un parche que aguanta el principio:

- Una cuenta gratuita permite del orden de **500 destinatarios al día**, y Google
  puede bloquearla por uso automatizado.
- **Sin DKIM propio**, un correo transaccional que dice venir de `volumine.app`
  pero sale de servidores de Google tiene bastantes papeletas de acabar en spam.
  Y un enlace de acceso en spam es un usuario que no entra: no hay reintento
  posible, se va.

Cuando eso empiece a doler, un proveedor dedicado (Resend, Postmark, SES)
verifica el dominio con DKIM propio, no tiene límite diario de cuenta personal y
da métricas de entrega. Ahí sí se firma como `volumine.app` de verdad.

---

## 5. Cuando funcione

Cambiar el contacto en **`src/lib/legal.ts`**:

```ts
email: 'hola@volumine.app',
```

Es una línea, y arrastra sola las cuatro páginas legales y el enlace de contacto
del pie.
