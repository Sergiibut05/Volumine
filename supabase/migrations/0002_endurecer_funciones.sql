-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0002 — Cerrar las funciones que la 0001 dejó expuestas                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Sale del linter de seguridad de Supabase al aplicar la 0001. Dos cosas, y la
-- primera no se me habría ocurrido sola.
--
-- ── 1. TODA función en `public` es un ENDPOINT ──────────────────────────────
--
-- PostgREST publica el esquema `public` entero, funciones incluidas. Así que
-- `crear_perfil`, `comprobar_cuota`, `aplicar_marca_de_agua` y
-- `repasar_marcas_del_dueno` quedaron colgando en `/rest/v1/rpc/<nombre>`,
-- llamables por cualquiera sin sesión. Y son `security definer`, o sea que
-- corren con los permisos de su dueño y se saltan RLS.
--
-- En la práctica no se podían explotar: las cuatro devuelven `trigger`, y
-- Postgres se niega a ejecutar una función de trigger fuera de un trigger. Pero
-- eso es una casualidad afortunada, no un diseño. Si mañana alguien convierte
-- una de estas en una función normal para reutilizarla, el agujero se abre solo
-- y en silencio.
--
-- Quitar el EXECUTE no rompe los triggers: el permiso se comprueba al CREAR el
-- trigger, no cada vez que se dispara.
--
-- ── 2. `search_path` fijo ───────────────────────────────────────────────────
--
-- Una función sin `search_path` propio resuelve los nombres con el del que
-- llama. Quien pueda crear objetos en un esquema que vaya antes puede colar su
-- propia versión de una función y hacer que la nuestra ejecute otra cosa. En
-- `security definer` eso es escalada directa.
--
-- Se pone a vacío: obliga a que todo vaya cualificado, que es como ya estaba
-- escrito. `pg_catalog` se busca siempre, así que `substr`, `now` y compañía
-- siguen funcionando.

alter function public.generar_slug() set search_path = '';
alter function public.tocar_updated_at() set search_path = '';

revoke execute on function public.crear_perfil() from anon, authenticated, public;
revoke execute on function public.tocar_updated_at() from anon, authenticated, public;
revoke execute on function public.aplicar_marca_de_agua() from anon, authenticated, public;
revoke execute on function public.repasar_marcas_del_dueno() from anon, authenticated, public;
revoke execute on function public.comprobar_cuota() from anon, authenticated, public;

-- ¡`generar_slug` NO se toca!
--
-- Es el DEFAULT de `charts.slug`, y un default se evalúa con los permisos de
-- quien hace el INSERT. Quitarle el EXECUTE a `authenticated` rompería guardar
-- una gráfica — con un error de permisos sobre una función que nadie llama
-- explícitamente, que es de los ratos malos que uno puede pasar depurando.
--
-- Que quede expuesta como RPC es inofensivo: devuelve doce caracteres al azar y
-- no toca nada.
