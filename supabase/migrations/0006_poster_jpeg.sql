-- ── el bucket de pósters tiene que aceptar JPEG ─────────────────────────────
--
-- El bucket se creó en la 0004 admitiendo solo `image/png` e `image/webp`.
-- Después, `composePoster()` pasó a devolver JPEG siempre que el fondo es
-- opaco —PNG se reserva para cuando de verdad hace falta canal alfa, porque un
-- PNG de una escena 3D con degradado pesa varias veces más que el JPEG
-- equivalente— y nadie tocó el bucket.
--
-- Resultado: Storage rechazaba CADA subida con un 400, y como `subirPoster()`
-- se traga el error para no bloquear el guardado, la gráfica se guardaba bien y
-- simplemente dejaba de aparecer la miniatura. Un fallo invisible durante
-- semanas.
--
-- La lección para la próxima: `POSTER_FORMATS` en `src/lib/charts/poster.ts` y
-- esta lista son la misma decisión escrita en dos sitios. Si una cambia, la
-- otra también.

update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'posters';
