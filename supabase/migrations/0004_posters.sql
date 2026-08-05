-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0004 — Pósters: la imagen fija de cada gráfica                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- PARA QUÉ. Dos cosas que hoy no funcionan:
--
--   · Pegar un link de Voluma en Slack, Notion o WhatsApp no enseña nada. Sin
--     `og:image` sale un rectángulo con el título y ya. Para un producto cuyo
--     producto ES EL LINK, eso es el peor sitio posible donde fallar.
--   · Sin WebGL —navegador viejo, GPU en lista negra, `prefers-reduced-motion`
--     llevado al extremo— el embed solo tiene la tabla de datos.
--
-- CÓMO SE GENERA, que es la decisión de fondo: LA CAPTURA EL NAVEGADOR al
-- guardar, con `canvas.toDataURL()` sobre la escena que YA ha dibujado. No se
-- vuelve a renderizar en el servidor.
--
-- Renderizar 3D en servidor pediría WebGL sin GPU —`headless-gl` con
-- dependencias nativas, o un navegador completo por petición—: la pieza más
-- frágil y más cara de toda la aplicación, para reproducir exactamente lo que
-- el cliente acababa de dibujar. Y no daría el mismo píxel, que es justo lo que
-- el proyecto promete.
--
-- Contrapartida asumida: solo tienen póster las gráficas GUARDADAS. Las de
-- config-en-URL no, y está bien — esas se pegan en un iframe, no se comparten
-- como link.

-- ── el bucket ───────────────────────────────────────────────────────────────
--
-- Público en lectura: un póster tiene que poder pedirlo el servidor de Slack,
-- que no tiene sesión ni la va a tener. Es exactamente el mismo razonamiento
-- que el del embed anónimo (ADR 0005).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('posters', 'posters', true, 2097152, array['image/png', 'image/webp'])
on conflict (id) do nothing;

-- ── quién puede escribir ────────────────────────────────────────────────────
--
-- La ruta es `<owner_id>/<slug>.png`. Meter el dueño en la RUTA es lo que
-- permite comprobar la propiedad sin consultar `charts`: la primera carpeta
-- tiene que ser tu propio id.
--
-- `storage.foldername(name)` devuelve los tramos de la ruta; el [1] es el
-- primero. Comparado con `auth.uid()`, nadie puede escribir en la carpeta de
-- otro ni sobreescribirle un póster.

create policy "posters: subir en la carpeta propia"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'posters'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "posters: reemplazar el propio"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'posters'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'posters'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "posters: borrar el propio"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'posters'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lectura para cualquiera, con y sin sesión. El bucket es público, pero la
-- política tiene que existir igual: sin ella `storage.objects` no deja leer.
create policy "posters: leer"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'posters');

-- ── la columna ──────────────────────────────────────────────────────────────
--
-- Se guarda la RUTA, no la URL completa. La URL lleva dentro el dominio del
-- proyecto de Supabase, y guardarla entera ataría cada fila a ese dominio para
-- siempre: mover el proyecto, o poner un CDN propio delante, obligaría a
-- reescribir todas las filas.

alter table public.charts add column poster_path text;

comment on column public.charts.poster_path is
  'Ruta dentro del bucket `posters`. La URL se compone al servir; ver lib/charts/poster.ts.';
