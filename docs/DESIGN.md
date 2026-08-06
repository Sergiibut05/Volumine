# Dirección de arte

El listón es Awwwards **para la app y el marketing**. El embed es invisible por
diseño: ahí manda `docs/PERFORMANCE-BUDGET.md`.

## La idea

Un producto que vende gráficas bonitas y tiene una web fea no vende nada. La
propia web **es** la demo: el hero es una gráfica Volumine real, renderizada en
vivo, con el mismo renderer que usan los clientes. Si el hero va a 60 fps y se
ve caro, la venta está hecha antes del primer scroll.

Palabra clave de la marca: **materia**. Las gráficas no son dibujos, son objetos
con volumen, peso, canto redondeado y luz encima. Todo el sistema visual apoya
eso: superficies, no líneas.

## Lo que evitamos deliberadamente

- Landing SaaS de plantilla: hero centrado + 3 columnas con iconitos + logos en
  gris + gradiente morado. Es el default de la industria y es invisible.
- Bordes de 1px grises por todas partes. Aquí se separa con **elevación, color y
  espacio**, no con líneas.
- Sombras `box-shadow: 0 1px 3px rgba(0,0,0,.1)` genéricas.
- Inter/Geist para todo. La tipografía es donde más barato se compra carácter.

## Sistema

**Tipografía.** Pareja con contraste real: una display de personalidad para
titulares (grados ópticos, algo de peso) y una grotesca neutra y muy legible
para UI y datos. Números **tabulares siempre** en cualquier cifra. Escala
tipográfica fluida con `clamp()`, no breakpoints.

**Color.** Base oscura profunda —casi negra con tinte, nunca `#000`— porque el
3D con luz IBL se ve caro sobre oscuro y barato sobre blanco. Un acento
saturado que se usa **poco** (foco, CTA, estado activo) para que cuando aparezca
signifique algo. Tema claro obligatorio y de primera, no un `invert()`.

Todo sale de `src/styles/tokens.css` en tres capas: primitivas → semánticas →
de componente. Ningún hex fuera de ahí.

**Espacio y layout.** Escala de espaciado en múltiplos de 4. Grid asimétrico:
las secciones no van todas centradas al mismo ancho. Respiración generosa: el
espacio en blanco es la señal de precio más barata que existe.

**Movimiento.** Es la mitad del efecto y la parte que más fácil se hace mal.

- Duraciones cortas (150-350 ms) para UI, largas (600-1200 ms) para narrativa.
- Easing propio, nunca `ease` del navegador.
- Animaciones ligadas al scroll con **scroll-driven animations de CSS** donde se
  pueda (cero JS) y solo con JS cuando no haya alternativa.
- Transiciones de página con View Transitions API.
- **`prefers-reduced-motion` se respeta en todo, sin excepción.** Es una versión
  alternativa digna, no una versión rota.

**El detalle que se recuerda.** Cada pantalla importante necesita una cosa
memorable: el hero con la gráfica que reacciona al cursor, el editor cambiando
de tema con transición del material en vez de un corte, la vista de compartir
con la gráfica saliendo del iframe. Uno por pantalla, no cinco.

## Accesibilidad — no es opcional y no está reñida con esto

- Contraste AA mínimo en texto, medido, incluyendo texto sobre 3D.
- Todo lo interactivo, navegable por teclado, con foco **visible y bonito**.
- El embed lleva siempre una `<table>` con los datos en el DOM.
- La gráfica tiene `role="img"` y un `aria-label` generado desde los datos.
- Ninguna información se transmite solo por color: siempre etiqueta o valor.

## Antes de aceptar una pantalla como terminada

1. ¿Se ve bien en claro **y** en oscuro?
2. ¿Se ve bien a 360 px de ancho?
3. ¿Sigue siendo usable con `prefers-reduced-motion: reduce`?
4. ¿Se puede recorrer con Tab de principio a fin?
5. ¿Hay algún hex, tamaño o duración escrito a mano fuera de tokens?
6. ¿Se parece a la landing SaaS de plantilla? Si sí, rehacer.
