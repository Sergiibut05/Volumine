import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

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
          // Cache agresiva: la config va en la URL, así que la URL identifica
          // el contenido por completo.
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400',
          },
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
