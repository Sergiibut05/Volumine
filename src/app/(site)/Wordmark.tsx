/*
  La marca: un símbolo y el nombre.

  EL SÍMBOLO ES UN ANILLO CON CANTO, visto desde arriba y en escorzo. No es
  decoración abstracta: es literalmente lo que el producto dibuja, y el canto
  redondeado es el rasgo que lo diferencia de cualquier librería de gráficas
  (ADR 0004). Un logo que enseña el producto ahorra tener que explicarlo.

  Dos elipses apiladas —la de abajo más oscura— es lo mínimo que se lee como
  VOLUMEN a 16 píxeles. Con una sola se ve un aro plano; con sombreado real se
  convierte en una mancha. Ese "mínimo que aún se lee" es lo que decide la forma
  de un símbolo, no lo bonito que quede a 200 px.

  Sin dependencias ni archivos: SVG en línea, así sirve igual en la landing, en
  el editor y en el HTML del embed, que no puede pedir una imagen a nadie.
*/

export function VolumaMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      focusable="false"
      style={{ display: 'block', flex: 'none' }}
    >
      {/* El canto: la misma elipse desplazada hacia abajo. Es lo que da grosor. */}
      <ellipse
        cx="12"
        cy="14.2"
        rx="9"
        ry="5.6"
        stroke="currentColor"
        strokeWidth="3.6"
        opacity="0.42"
      />
      {/* La cara de arriba. */}
      <ellipse cx="12" cy="11" rx="9" ry="5.6" stroke="currentColor" strokeWidth="3.6" />
    </svg>
  );
}

/**
 * Símbolo + nombre.
 *
 * El nombre va en la display y con el interletrado apretado: a tamaño pequeño,
 * una grotesca con espaciado normal se lee como texto de interfaz y no como
 * marca. `size` es el cuerpo del texto; el símbolo se ajusta solo.
 */
export function Wordmark({ size = 1.0625 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${size * 0.42}rem`,
        fontFamily: 'var(--font-display), sans-serif',
        fontWeight: 700,
        fontSize: `${size}rem`,
        letterSpacing: '-0.025em',
        lineHeight: 1,
        color: 'inherit',
      }}
    >
      <VolumaMark size={size * 19} />
      Voluma
    </span>
  );
}
