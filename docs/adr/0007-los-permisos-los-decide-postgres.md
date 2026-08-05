# ADR 0007 — Los permisos los decide Postgres, no el servidor de Next

**Fecha:** 2026-08-05 · **Estado:** aceptada

## Contexto

Al añadir cuentas hay dos sitios donde se puede decidir quién ve qué:

1. En el servidor de la aplicación, comprobando la sesión antes de consultar,
   normalmente con una clave `service_role` que se salta RLS.
2. En la base de datos, con RLS, usando siempre la clave anónima más la sesión
   del usuario.

El primero es el patrón por defecto de casi cualquier tutorial de Next con
Supabase, y es más cómodo: se consulta sin restricciones y se filtra después.

Aquí hay una circunstancia que cambia el cálculo. La API de Supabase es
**pública**: la clave anónima viaja en el bundle y cualquiera puede hablar con
la base de datos directamente desde una consola, sin pasar por nuestro servidor.
Con lo cual la comprobación del servidor de Next no es _la_ puerta, es _una_ de
las puertas.

## Decisión

**RLS es la única regla de permisos.** No hay ninguna comprobación de propiedad
escrita a mano en el código de la aplicación.

En concreto:

- El servidor de Next usa la **clave anónima** con la sesión del usuario en
  cookies, igual que si la petición viniera del navegador. Que corra en el
  servidor no le da permisos extra.
- La `service_role` **no aparece en el repositorio**. Cuando haga falta (webhook
  de pagos, tareas administrativas) irá en la configuración del despliegue.
- Las escrituras van por **server actions** para que el `owner_id` salga de la
  sesión y no de un formulario. Es cinturón sobre tirantes: RLS lo rechazaría
  igual, pero el mejor sitio para no cometer un error es donde no se puede.
- Lo que el cliente **no puede decidir** se resuelve con **triggers**, no con
  validación en la aplicación: la marca de agua sale del plan del dueño y la
  cuota se comprueba antes de cada insert. Un trigger es la única capa por la
  que pasan todos los caminos.
- Los permisos de **columna** complementan a RLS: la política deja actualizar tu
  perfil, y `grant update (display_name)` impide que "actualizar tu perfil"
  incluya ponerte `plan = 'team'`. RLS filtra filas, los grants filtran columnas,
  y hacen falta los dos.

## Consecuencias

- Una política mal escrita no da error: devuelve cero filas o de más, en
  silencio. Por eso las políticas llevan **test propio** (`rls.test.ts`), y esos
  tests prueban Postgres con la clave anónima, no nuestro código.
- Hay consultas algo menos eficientes: `myCharts()` no filtra por `owner_id`
  porque RLS ya lo hace. Se acepta — el índice está y la alternativa es tener la
  regla escrita dos veces en dos sitios que pueden discrepar.
- El embed anónimo sale gratis: es exactamente la misma política vista sin
  sesión (ADR 0005). No hay un camino especial que mantener.
- Si algún día hace falta un panel de administración, no puede construirse sobre
  este acceso: necesitará `service_role` y vivir fuera del cliente.

## Alternativas descartadas

- **Comprobar en el servidor con `service_role`**: deja la API pública sin
  proteger y traslada la seguridad a que ningún endpoint se olvide de un `if`.
- **Las dos cosas**: es lo que suena más seguro y es peor. Dos reglas que
  expresan lo mismo terminan discrepando, y la que gana es la más laxa.
