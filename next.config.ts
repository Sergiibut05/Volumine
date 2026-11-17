import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /*
    `/precios` existió y está enlazada desde fuera (buscadores, la tarjeta de X,
    quien la guardase). Con el plan de pago quitado (ADR 0008) lo que queda en
    su sitio es el café: redirección PERMANENTE, para que los buscadores
    trasladen la página en vez de dejar un 404.
  */
  async redirects() {
    return [{ source: '/precios', destination: '/cafe', permanent: true }];
  },

  async headers() {
    return [
      {
        /*
          /embed tiene que poder cargarse dentro de CUALQUIER página (ADR 0005).
          Next no envía X-Frame-Options por defecto, pero lo declaramos explícito
          aquí para que quede claro que su ausencia es intencionada y para que
          nadie añada una cabecera global que lo rompa sin darse cuenta.
        */
        source: '/embed/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          /*
            AQUÍ NO VA `Cache-Control`, Y ES IMPORTANTE.

            Lo llevaba, con caché de un año y este razonamiento: «la config va en
            la URL, así que la URL identifica el contenido por completo». Era
            cierto cuando `/embed` solo existía con `?c=`. Dejó de serlo al
            añadir `/embed/{slug}`, donde detrás hay una FILA que su dueño puede
            editar o DESPUBLICAR.

            Y esta regla PISA la cabecera que pone el route handler, así que la
            ruta guardada creía servirse con un minuto de caché y en realidad
            salía con un año. Despublicar no habría despublicado nada: la gráfica
            habría seguido sirviéndose desde el borde durante meses. Fallo de
            privacidad, no de frescura.

            Ahora cada ruta pone la suya (ver src/embed/serve.ts): un año la de
            config-en-URL, un minuto la guardada. Lo encontró la prueba de punta
            a punta, no la lectura del código — el código de la ruta era correcto
            y lo seguía siendo.
          */
        ],
      },
      {
        // El resto del sitio sí se protege contra enmarcado.
        source: '/((?!embed).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
