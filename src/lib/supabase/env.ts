/*
  Las dos únicas variables que hacen falta para hablar con Supabase, y la
  comprobación de que no se ha colado la que NO debe salir de aquí.
*/

/**
 * URL y clave anónima del proyecto.
 *
 * La clave anónima es PÚBLICA por diseño: viaja al navegador en cada petición y
 * cualquiera puede leerla del bundle. Lo que impide que sirva para nada malo no
 * es el secreto, es RLS: con esta clave solo se ven gráficas públicas y las
 * propias de quien tenga sesión (ver la migración 0001).
 *
 * Se leen con `process.env.NOMBRE_LITERAL` y no por índice porque Next sustituye
 * las `NEXT_PUBLIC_*` en tiempo de build buscando el texto exacto. Con
 * `process.env[nombre]` no las encuentra y llegan como `undefined` al navegador.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Están en Supabase → Project Settings → API. Ver .env.example.',
    );
  }

  return { url, anonKey };
}

/**
 * ¿Hay Supabase configurado?
 *
 * El editor y el embed por URL funcionan sin cuenta ninguna, y tienen que
 * seguir funcionando en un clon recién bajado sin `.env`. Solo lo que de verdad
 * necesita base de datos —guardar, listar, `/embed/{slug}`— comprueba esto y
 * dice que no está disponible, en vez de reventar la aplicación entera.
 */
export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
