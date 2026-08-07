import { describe, expect, it } from 'vitest';
import { minifyCss } from '../../scripts/minify-css.mjs';

/*
  Lo que se comprueba aquí no es «que quede pequeño», es que **no se rompa nada
  en silencio**. Un CSS mal minificado no da error: la regla se descarta y la
  gráfica sale mal dentro de la página de un cliente, sin nada en consola.

  Los dos casos peligrosos son los espacios que SÍ significan algo en CSS
  moderno: los de `rgb(a b c / d)` y los de `calc()`.
*/

const min = minifyCss;

describe('minifyCss', () => {
  it('quita los comentarios, que es de donde sale el peso', () => {
    expect(min('/* una nota larga */ a{color:red}')).toBe('a{color:red}');
    expect(min('a{/* dentro */color:red}')).toBe('a{color:red}');
    expect(min('/* multi\n   linea */\na{color:red}')).toBe('a{color:red}');
  });

  it('NO toca el espacio detrás de `:` — cuesta 179 bytes y no se toca', () => {
    /* Quitarlo es seguro en una declaración y NO en un selector (`a :hover` no
       es `a:hover`). Distinguir los dos casos pide entender la gramática, y el
       ahorro son 179 bytes sobre un fichero que ya entra en presupuesto por
       3 KB. La regla del proyecto es medir antes de complicar: medido. */
    expect(min('a{ color: red }')).toBe('a{color: red}');
  });

  it('NO toca los espacios de `rgb(a b c / d)`', () => {
    /* La sintaxis moderna separa canales por espacios. Quitarlos convierte el
       color en basura y el navegador descarta la declaración entera. */
    const out = min('a{ background: rgb(255 255 255 / 0.1); }');
    expect(out).toBe('a{background: rgb(255 255 255 / 0.1)}');
  });

  it('NO toca los operadores de `calc()`', () => {
    /* En `calc` los espacios alrededor de `+` y `-` son obligatorios, y sin
       ellos la expresión no es válida. */
    expect(min('a{ width: calc(100% - 24px); }')).toBe('a{width: calc(100% - 24px)}');
    /* La coma sí pierde su espacio, y eso es seguro en cualquier valor de CSS.
       El `-` de la resta y el `*` conservan los suyos, que es lo que importa. */
    expect(min('a{ font-size: calc(0.8125rem * var(--x, 1)); }')).toBe(
      'a{font-size: calc(0.8125rem * var(--x,1))}',
    );
  });

  it('respeta los selectores con atributo y comillas', () => {
    expect(min("[data-finish='plain'] .label { opacity: 1; }")).toBe(
      "[data-finish='plain'] .label{opacity: 1}",
    );
  });

  it('mantiene el espacio que separa selectores descendientes', () => {
    /* Sin ese espacio, `.a .b` pasa a ser `.ab`: otro selector distinto que
       no casa con nada y no avisa. */
    expect(min('.a .b{color:red}')).toBe('.a .b{color:red}');
    expect(min('.a  >  .b{color:red}')).toBe('.a > .b{color:red}');
  });

  it('aguanta varias reglas y listas de selectores', () => {
    expect(min('a,\nb {\n  color: red;\n}\nc {\n  color: blue;\n}')).toBe(
      'a,b{color: red}c{color: blue}',
    );
  });

  it('el CSS de verdad del embed sigue siendo válido tras pasar por aquí', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile('src/styles/embed.css', 'utf8');
    const out = min(source);

    // Ni un comentario, y bastante más corto.
    expect(out).not.toContain('/*');
    expect(out.length).toBeLessThan(source.length * 0.55);

    // Las llaves siguen cuadrando: es la señal más barata de que no se ha
    // comido nada a medias.
    const abre = (out.match(/{/g) ?? []).length;
    const cierra = (out.match(/}/g) ?? []).length;
    expect(abre).toBe(cierra);
    expect(abre).toBeGreaterThan(20);

    // Y los dos valores que más fácil se rompen siguen enteros.
    expect(out).toContain('rgb(255 255 255 / 0.1)');
    expect(out).toContain('calc(0.8125rem * var(--volumine-label-scale,1))');

    /* Y entra en presupuesto, que es la razón de que esto exista. El margen
       sobra a propósito: el CSS crece con cada tipo nuevo. */
    expect(Buffer.byteLength(out)).toBeLessThan(8 * 1024);
  });
});
