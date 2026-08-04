# ADR 0003 — Supabase en lugar de Firebase

**Fecha:** 2026-08-04 · **Estado:** aceptada

## Contexto

Hace falta persistir gráficas (config JSON), usuarios, y una noción de
visibilidad pública/privada que el embed anónimo pueda consultar sin sesión.

## Decisión

Supabase: Postgres + Row Level Security + Auth + Storage (para los pósters
estáticos).

Razones:

- La config de gráfica es un documento JSON dentro de una fila con metadatos
  relacionales (autor, slug, visibilidad, plan). Postgres con una columna
  `jsonb` encaja exactamente; Firestore obligaría a modelar los listados y
  búsquedas a mano.
- **RLS expresa el modelo de permisos en unas pocas líneas**: "cualquiera lee
  una gráfica con `visibility = 'public'`; solo el autor lee/escribe las suyas".
  Eso es literalmente el requisito del embed anónimo.
- Es Postgres estándar: migrar fuera es posible. Firestore es un billete de ida.
- El plan gratuito cubre de sobra la fase actual.

## Alternativas descartadas

- **Firebase/Firestore**: bueno para tiempo real, que no necesitamos en v1.
  Sus queries estorbarían en listados, búsqueda y analítica de embeds.
- **SQLite/Turso**: excelente y barato, pero Supabase trae Auth y Storage
  resueltos y aquí el tiempo vale más que los milisegundos.

## Consecuencias

- Necesitamos escribir políticas RLS con cuidado desde el principio; un fallo
  ahí expone gráficas privadas. Las políticas llevan test propio.
- Hay que ser explícitos con qué clave se usa dónde: el embed usa la clave
  anónima y **solo** puede ver filas públicas. La `service_role` no toca jamás
  código que llegue al cliente.
- El esquema incluye `plan` y contadores de cuota desde el día 1 aunque todo sea
  gratis, para no migrar cuando se monetice.
