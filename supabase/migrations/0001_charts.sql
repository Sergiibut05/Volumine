-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0001 — Cuentas, gráficas y permisos                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Lo que decide este fichero, y por qué está escrito así:
--
-- 1. EL EMBED ES ANÓNIMO (ADR 0005). No hay sesión, no hay cookie, no hay
--    manera de saber quién mira. Así que "¿puede verse esta gráfica?" tiene que
--    responderlo la BASE DE DATOS con la clave anónima, no el código. Eso es
--    exactamente lo que hace RLS, y es la razón de elegir Supabase (ADR 0003).
--
-- 2. LA MARCA DE AGUA LA DECIDE EL SERVIDOR, nunca el cliente: si la decidiera
--    el cliente sería trivial quitarla (ADR 0005). Por eso viaja como columna
--    de la fila y la mantiene un trigger desde el plan del dueño.
--
-- 3. PLAN Y CUOTAS DESDE EL DÍA 1 aunque todo sea gratis (CLAUDE.md). Migrar un
--    esquema con gente dentro cuesta mucho más que dejar la columna puesta hoy.
--
-- Cómo aplicarla:  supabase db push     (o pegarla en el SQL Editor)

-- ── perfiles ────────────────────────────────────────────────────────────────
--
-- Tabla propia y no `auth.users` a secas: `auth` es de Supabase y no se toca.
-- Aquí va lo NUESTRO —plan, nombre público— con la misma clave primaria.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  plan text not null default 'free',
  created_at timestamptz not null default now(),

  constraint profiles_plan_valido check (plan in ('free', 'pro', 'team'))
);

comment on table public.profiles is
  'Datos propios del usuario. `auth.users` es de Supabase y no se modifica.';

-- ── límites por plan ────────────────────────────────────────────────────────
--
-- En una TABLA y no en constantes del código por dos motivos: el trigger de
-- cuota necesita leerlos dentro de la misma transacción que el insert, y subir
-- un límite tiene que ser un UPDATE, no un despliegue.

create table public.plan_limits (
  plan text primary key,
  max_charts integer not null,
  -- Lo que separa el plan gratis del de pago hoy. Ver el trigger de abajo.
  watermark boolean not null
);

insert into public.plan_limits (plan, max_charts, watermark) values
  ('free',  20,    true),
  ('pro',   500,   false),
  ('team',  5000,  false);

-- ── identificador público ───────────────────────────────────────────────────
--
-- El `id` uuid no sale nunca a una URL: 36 caracteres en un link que la gente
-- copia y pega a mano es hostil, y el producto ES el link. Un slug corto de 12
-- caracteres da 62^12 combinaciones, que es de sobra para que no se pueda
-- adivinar el de nadie.
--
-- Sin vocales minúsculas ni caracteres que se confundan al leer en voz alta o
-- al copiar de una captura: nada de 0/O ni 1/l/I.

-- `gen_random_bytes` y NO `random()`: `random()` es un generador para simulación,
-- sembrado de forma predecible por sesión. Un slug que se puede predecir es un
-- slug que se puede recorrer, y detrás de él hay gráficas que alguien ha
-- decidido publicar pero no anunciar.
create or replace function public.generar_slug()
returns text
language plpgsql
volatile
as $$
declare
  alfabeto constant text := '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  n constant integer := length(alfabeto);
  bytes bytea := extensions.gen_random_bytes(12);
  resultado text := '';
  i integer;
begin
  for i in 0..11 loop
    -- 56 no divide a 256, así que el módulo sesga un pelo hacia los primeros
    -- caracteres. Con 56^12 ≈ 10^21 combinaciones ese sesgo no acerca a nadie
    -- a adivinar nada, y evitarlo pediría rechazo con bucle sin ganar nada.
    resultado := resultado || substr(alfabeto, 1 + (get_byte(bytes, i) % n), 1);
  end loop;
  return resultado;
end;
$$;

-- ── gráficas ────────────────────────────────────────────────────────────────

create table public.charts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,

  -- Lo que va en la URL del embed. Único, corto y no adivinable.
  slug text not null unique default public.generar_slug(),

  title text,
  -- Duplicado del `config->>'type'` a propósito: los listados filtran y ordenan
  -- por tipo, y un índice sobre una expresión jsonb es más frágil de mantener.
  type text not null,

  -- LA CONFIG ENTERA, tal cual. `jsonb` y no columnas por campo: el contrato
  -- está versionado en docs/chart-config-schema.md y lo valida Zod al leerlo.
  -- Partirlo en columnas obligaría a una migración de BBDD por cada campo nuevo,
  -- que es justo lo que el contrato permite hacer sin migración ninguna.
  config jsonb not null,

  visibility text not null default 'private',

  -- Denormalizado desde el plan del dueño, por trigger.
  --
  -- Va aquí y no se consulta al vuelo porque el embed lo lee SIN SESIÓN: para
  -- mirar el plan del dueño tendría que poder leer su perfil, y el perfil de
  -- otra persona no se lee nunca. Un booleano ya calculado en la fila pública
  -- no filtra nada.
  watermark boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint charts_visibility_valida check (visibility in ('private', 'public')),
  constraint charts_type_valido
    check (type in ('donut', 'pie', 'bar', 'bar-race', 'globe', 'gauge')),
  -- Tope duro de tamaño. Una config de 200 filas ronda los 20 KB; 256 KB deja
  -- muchísimo margen y a la vez impide que alguien use esto de almacén.
  constraint charts_config_acotada check (pg_column_size(config) < 262144)
);

comment on column public.charts.config is
  'ChartConfig completa. Contrato en docs/chart-config-schema.md, validado con Zod al leer.';

-- El listado del usuario: sus gráficas, las últimas primero.
create index charts_owner_idx on public.charts (owner_id, updated_at desc);
-- La consulta del embed. Parcial: solo hay que buscar entre las públicas, y así
-- el índice ocupa lo que ocupan las públicas y no toda la tabla.
create index charts_slug_publicas_idx on public.charts (slug)
  where visibility = 'public';

-- ── triggers ────────────────────────────────────────────────────────────────

-- Perfil automático al registrarse. Sin esto, un usuario recién creado no tiene
-- plan y el trigger de cuota no sabría contra qué contar.
create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger crear_perfil_al_registrarse
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- `updated_at` de verdad: si lo pusiera el cliente, bastaría con mentir en el
-- payload para colarse arriba del listado.
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
as $$
begin
  /* Una fila a la que solo le ha cambiado la marca de agua NO se ha editado.

     El repaso al cambiar de plan (más abajo) toca todas las gráficas del
     usuario de golpe. Sin esta excepción, pagar reordenaría el listado entero
     por fecha y parecería que se han modificado veinte gráficas a la vez. */
  if new.watermark is distinct from old.watermark
     and to_jsonb(new) - 'watermark' - 'updated_at'
       = to_jsonb(old) - 'watermark' - 'updated_at' then
    new.updated_at := old.updated_at;
    return new;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger charts_tocar_updated_at
  before update on public.charts
  for each row execute function public.tocar_updated_at();

-- La marca de agua sale del PLAN, y el cliente no pinta nada aquí. Se recalcula
-- en cada insert y en cada update: si alguien manda `watermark: false` en el
-- payload, esto lo pisa antes de que la fila se guarde.
create or replace function public.aplicar_marca_de_agua()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  con_marca boolean;
begin
  select l.watermark into con_marca
  from public.profiles p
  join public.plan_limits l on l.plan = p.plan
  where p.id = new.owner_id;

  -- Sin perfil no hay plan conocido: se asume el más restrictivo.
  new.watermark := coalesce(con_marca, true);
  return new;
end;
$$;

create trigger charts_aplicar_marca_de_agua
  before insert or update on public.charts
  for each row execute function public.aplicar_marca_de_agua();

-- Y al revés: si el plan CAMBIA, hay que repasar las gráficas que ya existen.
--
-- Sin esto, quien pague seguiría viendo la marca de agua en todo lo que publicó
-- antes de pagar —hasta volver a tocar cada gráfica una por una—, que es la
-- peor primera impresión posible de un plan de pago. Y al revés: quien cancele
-- se quedaría sin marca para siempre.
create or replace function public.repasar_marcas_del_dueno()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  con_marca boolean;
begin
  if new.plan is not distinct from old.plan then
    return new;
  end if;

  select l.watermark into con_marca
  from public.plan_limits l where l.plan = new.plan;

  update public.charts
  set watermark = coalesce(con_marca, true)
  where owner_id = new.id
    and watermark is distinct from coalesce(con_marca, true);

  return new;
end;
$$;

create trigger perfil_repasar_marcas
  after update of plan on public.profiles
  for each row execute function public.repasar_marcas_del_dueno();

-- Cuota por plan.
--
-- En un TRIGGER y no en el código de la aplicación: es la única capa por la que
-- pasan todos los caminos. Comprobarlo en el servidor de Next dejaría la puerta
-- abierta a cualquier cliente que hable directamente con la API de Supabase,
-- que es una API pública con la clave anónima.
create or replace function public.comprobar_cuota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tope integer;
  actuales integer;
begin
  select l.max_charts into tope
  from public.profiles p
  join public.plan_limits l on l.plan = p.plan
  where p.id = new.owner_id;

  if tope is null then
    raise exception 'no hay plan para el usuario %', new.owner_id
      using errcode = 'check_violation';
  end if;

  select count(*) into actuales
  from public.charts
  where owner_id = new.owner_id;

  if actuales >= tope then
    raise exception 'cuota agotada: el plan permite % gráficas', tope
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger charts_comprobar_cuota
  before insert on public.charts
  for each row execute function public.comprobar_cuota();

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  RLS — aquí es donde un fallo expone gráficas privadas (ADR 0003)        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table public.profiles    enable row level security;
alter table public.charts      enable row level security;
alter table public.plan_limits enable row level security;

-- Perfiles: cada uno el suyo y nada más. Ni siquiera el nombre de otro.
create policy "perfil propio: leer"
  on public.profiles for select
  using (auth.uid() = id);

create policy "perfil propio: actualizar"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- OJO: no hay política de INSERT ni de DELETE sobre `profiles`. El alta la hace
-- el trigger `crear_perfil` en `security definer`, que se salta RLS. Sin
-- política, nadie puede crearse un perfil a mano y ponerse `plan = 'team'`.

-- Los límites los lee cualquiera: hacen falta para enseñar "te quedan 3 de 20"
-- y no son secreto. Sin política de escritura: se cambian por migración.
create policy "límites de plan: leer"
  on public.plan_limits for select
  using (true);

-- ── la política que importa ─────────────────────────────────────────────────
--
-- ESTA es la que hace posible el embed anónimo. `visibility = 'public'` se
-- comprueba en Postgres, con la clave anónima, sin sesión: por muy roto que
-- esté el código de la aplicación, una gráfica privada no sale de aquí.
--
-- El orden del OR no es casual: lo primero es lo que evalúa el visitante
-- anónimo, para el que `auth.uid()` es NULL.
create policy "gráficas: leer las públicas o las propias"
  on public.charts for select
  using (visibility = 'public' or auth.uid() = owner_id);

-- Escritura: solo el dueño, y `with check` además de `using`.
--
-- Sin `with check`, un UPDATE podría cambiar `owner_id` y REGALARLE una gráfica
-- a otra persona —o quitársela—. `using` mira la fila de antes; `with check`
-- mira la de después. Hacen falta las dos.
create policy "gráficas: crear las propias"
  on public.charts for insert
  with check (auth.uid() = owner_id);

create policy "gráficas: actualizar las propias"
  on public.charts for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "gráficas: borrar las propias"
  on public.charts for delete
  using (auth.uid() = owner_id);

-- ── permisos de tabla ───────────────────────────────────────────────────────
--
-- RLS filtra FILAS; los GRANT deciden si se puede tocar la tabla siquiera. Las
-- dos capas hacen falta: sin GRANT, RLS no llega a evaluarse.

grant select on public.charts to anon, authenticated;
grant insert, update, delete on public.charts to authenticated;
grant select on public.profiles to authenticated;

-- ¡OJO CON ESTA LÍNEA! `grant update (display_name)` y no `grant update`.
--
-- La política de RLS de arriba deja a cada uno actualizar SU fila, pero no dice
-- nada de QUÉ columnas. Con un `grant update` a secas, cualquiera con sesión
-- podía hacer `update profiles set plan = 'team'` contra la API pública y
-- subirse de plan solo. RLS filtra filas; los permisos de columna filtran
-- columnas, y aquí hacen falta los dos.
--
-- El plan lo cambia el webhook de pagos con `service_role`, que se salta RLS y
-- no pasa por este grant. Y nunca desde el navegador.
grant update (display_name) on public.profiles to authenticated;
grant select on public.plan_limits to anon, authenticated;

-- `anon` NO tiene insert/update/delete en ninguna tabla. Un visitante del embed
-- puede leer gráficas públicas y nada más.
