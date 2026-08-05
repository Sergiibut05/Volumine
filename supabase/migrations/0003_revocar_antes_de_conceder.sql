-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0003 — Escalada de privilegios: cualquiera podía subirse de plan        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Lo encontró `rls.test.ts` la primera vez que se ejecutó. Cuatro tests en rojo
-- y un solo fallo detrás: `update profiles set plan = 'team'` FUNCIONABA.
--
-- Los otros tres eran consecuencia, y por eso el fallo era tan feo: con plan
-- `team` desaparece la marca de agua y la cuota pasa de 20 gráficas a 5000. O
-- sea que la escalada no era "ponerse una etiqueta bonita": era saltarse
-- entero el modelo de negocio con una petición desde la consola del navegador.
--
-- ── QUÉ ESTABA MAL ──────────────────────────────────────────────────────────
--
-- La 0001 hacía esto, creyendo que restringía:
--
--     grant update (display_name) on public.profiles to authenticated;
--
-- Un grant de COLUMNA no restringe: SUMA. Y Supabase ya había concedido `ALL`
-- sobre las tablas nuevas de `public` a `anon` y `authenticated` mediante
-- privilegios por defecto, en el momento de crearlas. Así que la línea de
-- arriba añadía un permiso que ya se tenía, sobre una tabla donde además se
-- tenían todos los demás. Comprobado: los dos roles tenían UPDATE sobre las
-- cinco columnas, `plan` incluida.
--
-- LA LECCIÓN, que vale para cualquier tabla que se añada a partir de ahora:
-- en Supabase hay que REVOCAR ANTES DE CONCEDER. Escribir solo los `grant` que
-- quieres no deja fuera nada, porque partes de "todo concedido", no de cero.
--
-- Y la otra: RLS no cubre esto. RLS decide QUÉ FILAS tocas —y la política de
-- perfiles estaba bien, cada uno solo tocaba la suya—, pero no dice nada de qué
-- COLUMNAS. Las dos capas son necesarias y son independientes.

-- ── perfiles ────────────────────────────────────────────────────────────────

revoke all on public.profiles from anon, authenticated;

-- Leer el propio perfil: hace falta para saber el plan y la cuota.
grant select on public.profiles to authenticated;

-- Y escribir SOLO el nombre. El plan lo cambia el webhook de pagos con
-- `service_role`, que no pasa por aquí. Nunca desde el navegador.
grant update (display_name) on public.profiles to authenticated;

-- `anon` se queda sin nada: quien no ha entrado no tiene perfil que mirar.

-- ── gráficas ────────────────────────────────────────────────────────────────

revoke all on public.charts from anon, authenticated;

-- Leer: los dos. Cuáles se ven lo decide RLS — las públicas para todo el
-- mundo, las propias para su dueño. Esto es lo que hace posible el embed
-- anónimo (ADR 0005).
grant select on public.charts to anon, authenticated;

-- Escribir: solo con sesión. `watermark` se puede mandar en el UPDATE y da
-- igual, porque el trigger lo recalcula desde el plan antes de guardar; y
-- `owner_id` lo bloquea el `with check` de la política.
grant insert, update, delete on public.charts to authenticated;

-- ── límites de plan ─────────────────────────────────────────────────────────

revoke all on public.plan_limits from anon, authenticated;

-- Solo lectura, para poder enseñar "te quedan 3 de 20". Se cambian por
-- migración, nunca desde la aplicación.
grant select on public.plan_limits to anon, authenticated;
