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
      {/*
        LA TINTA VA CENTRADA EN LA CAJA.

        Antes las elipses iban en cy=11 y cy=14.2 con radio 5,6: la tinta ocupaba
        de 5,4 a 19,8, o sea centrada en 12,6 dentro de una caja de 24. Medio
        píxel de caída a este tamaño, pero al alinear el símbolo con el texto por
        el centro de su CAJA, ese medio píxel se ve — un logotipo descuadrado se
        nota antes que se explica.

        Bajadas las dos 0,6 para que la tinta quede centrada en 12.
      */}
      {/* El canto: la misma elipse desplazada hacia abajo. Es lo que da grosor. */}
      <ellipse
        cx="12"
        cy="13.6"
        rx="9"
        ry="5.6"
        stroke="currentColor"
        strokeWidth="3.6"
        opacity="0.42"
      />
      {/* La cara de arriba. */}
      <ellipse cx="12" cy="10.4" rx="9" ry="5.6" stroke="currentColor" strokeWidth="3.6" />
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
        /*
          INTERLINEADO NORMAL, NO 1.

          Con `line-height: 1` la caja se ciñe al cuerpo de la fuente y la tinta
          del texto —que no llega abajo del todo porque «Voluma» no tiene
          descendentes— queda ALTA dentro de ella. Sus vecinos en la barra usan
          interlineado normal, así que su tinta sí se centra. Medido: la marca
          quedaba 4,3 px por encima del separador y del nombre.

          Centrar las CAJAS no basta cuando las cajas se calculan distinto. Se
          igualan los interlineados y se centran solas.
        */
        color: 'inherit',
      }}
    >
      {/*
        SIN ajuste óptico: el símbolo se centra con su caja y ya está.

        Llevaba un `translateY(-0.055em)` para compensar que el texto no tiene
        descendentes y su tinta queda alta. En teoría es correcto —es el ajuste
        de siempre al montar un logotipo—, pero sumado a haber centrado la tinta
        del símbolo dentro de su caja, se pasaba: el símbolo quedaba visiblemente
        por encima de la palabra.

        Dos correcciones ópticas en la misma dirección se acumulan. Con la tinta
        ya centrada, esta sobra.
      */}
      <VolumaMark size={size * 19} />
      Voluma
    </span>
  );
}
