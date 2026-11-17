/*
  La taza de la tarjeta.

  Tratada como el resto de objetos de la marca: algo apoyado en el papel del
  estudio, con luz de arriba y sombra de contacto debajo — no un emoji ni un
  icono plano. Es SVG y no 3D a propósito: esta página no necesita un contexto
  WebGL para decir «gracias».

  El vapor se mueve con CSS y se queda quieto con `prefers-reduced-motion`
  (ver `.cafe-vapor` en marketing.css).
*/
export function Taza() {
  return (
    <svg className="cafe-taza" viewBox="0 0 200 150" aria-hidden focusable="false">
      <defs>
        <linearGradient id="taza-cuerpo" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--cafe-loza-sombra)" />
          <stop offset="0.35" stopColor="var(--cafe-loza)" />
          <stop offset="0.7" stopColor="var(--cafe-loza)" />
          <stop offset="1" stopColor="var(--cafe-loza-sombra)" />
        </linearGradient>
        <radialGradient id="taza-sombra" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--ink)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--ink)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="taza-cafe" cx="0.45" cy="0.4" r="0.6">
          <stop offset="0" stopColor="var(--cafe-crema)" />
          <stop offset="1" stopColor="var(--cafe-tostado)" />
        </radialGradient>
      </defs>

      {/* Sombra de contacto. */}
      <ellipse cx="96" cy="136" rx="74" ry="9" fill="url(#taza-sombra)" />

      {/* Plato. */}
      <ellipse cx="96" cy="128" rx="70" ry="12" fill="var(--cafe-loza-sombra)" />
      <ellipse cx="96" cy="125" rx="70" ry="11" fill="var(--cafe-loza)" />
      <ellipse cx="96" cy="125" rx="40" ry="5.5" fill="var(--cafe-loza-sombra)" opacity="0.6" />

      {/* Asa. */}
      <path
        d="M140 72c22-4 28 26 2 36"
        fill="none"
        stroke="var(--cafe-loza-sombra)"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M140 72c22-4 28 26 2 36"
        fill="none"
        stroke="var(--cafe-loza)"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Cuerpo. */}
      <path
        d="M50 58h92l-6 46c-2 13-14 22-27 22h-26c-13 0-25-9-27-22l-6-46Z"
        fill="url(#taza-cuerpo)"
      />
      {/* La franja de la marca, en el violeta de siempre. */}
      <path d="M52.6 78h86.8l-1.1 9H53.7Z" fill="var(--spark)" opacity="0.9" />

      {/* Boca y café. */}
      <ellipse cx="96" cy="58" rx="46" ry="9" fill="var(--cafe-loza-sombra)" />
      <ellipse cx="96" cy="59" rx="41" ry="6.5" fill="url(#taza-cafe)" />

      {/* Vapor. */}
      <g className="cafe-vapor" fill="none" stroke="var(--ink-faint)" strokeWidth="3" strokeLinecap="round">
        <path d="M80 44c-8-8 8-14 0-24" />
        <path d="M96 40c-8-8 8-14 0-26" />
        <path d="M112 44c-8-8 8-14 0-24" />
      </g>
    </svg>
  );
}
