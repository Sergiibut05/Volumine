import { test, expect, type Page } from '@playwright/test';

/*
  Que no se quede nada sin traducir.

  Existe porque `tsc` garantiza que los dos diccionarios tengan las mismas
  claves, y eso NO garantiza nada de lo que importa: una frase escrita a pelo
  dentro de un componente compila igual de bien y sale en español a quien pidió
  inglés. Los tres primeros restos de esta tanda —el botón de copiar de la barra
  de compartir, los nombres de los temas y las etiquetas de ejemplo del héroe—
  pasaron `tsc`, `lint`, 198 pruebas y un build limpio.

  Se lee la aplicación YA HIDRATADA y no el HTML del servidor: media interfaz
  del editor está detrás de un `<details>` o solo aparece con cierto tipo de
  gráfica. Aquí se abre todo y se recorren los tipos uno a uno.
*/

const ACENTOS = /[áéíóúñ¿¡]/;

/** Palabras que solo pueden venir de una frase sin traducir. */
const ESPAÑOL =
  /\b(el|la|los|las|una|para|con|que|del|sin|tus|cada|desde|hasta|pega|ponle|gráfica|tamaño|copiar|copiado|guardar|guardado|abrir|rellenar|quitar|nombre|fila|serie|periodo|entrar|siempre|oculto|valor|anillo|tarta|barras|globo|medidor|plano|vidrio|mate|nuevo|nueva)\b/i;

const INGLÉS =
  /\b(the|and|your|with|chart|save|saved|labels|from|when|shows|size|copy|copied|open|remove|fill|row|series|period|always|hidden|value|donut|pie|bars|globe|gauge|flat|glass|matte|new|give|name)\b/i;

/*
  Se dicen igual en los dos idiomas, o no son texto de interfaz.

  «Español» y «English» están a propósito: el selector nombra cada idioma EN SU
  IDIOMA, que es la única forma de que lo reconozca quien no lee el otro.
*/
const BLANCA = new Set([
  'English',
  'Español',
  'EN',
  'ES',
  'Volumine',
  'Aurora',
  'Metal',
  'Color',
  'Halo',
  'Chrome',
  'Safari',
  'Edge',
  'Firefox',
  'Madrid',
  'Tablet',
  'Total',
]);

/** Todo lo que se lee en pantalla: texto y atributos que anuncia el navegador. */
async function textoVisible(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const fuera = new Set(['SCRIPT', 'STYLE', 'CODE', 'NOSCRIPT']);
    const salida: string[] = [];

    const recorrer = (nodo: Node) => {
      if (nodo.nodeType === Node.TEXT_NODE) {
        const t = nodo.textContent?.trim() ?? '';
        if (t.length > 2) salida.push(t);
        return;
      }
      if (nodo.nodeType !== Node.ELEMENT_NODE) return;
      const el = nodo as Element;
      if (fuera.has(el.tagName)) return;

      for (const attr of ['placeholder', 'title', 'aria-label', 'alt']) {
        const v = el.getAttribute(attr);
        if (v && v.trim().length > 2) salida.push(v.trim());
      }
      el.childNodes.forEach(recorrer);
    };

    recorrer(document.body);
    return salida;
  });
}

/** Despliega el editor entero: lo plegado y los controles de cada tipo. */
async function desplegarEditor(page: Page) {
  const abrirTodo = () =>
    page.evaluate(() =>
      document.querySelectorAll('details').forEach((d) => (d.open = true)),
    );

  await abrirTodo();
  const tipos = await page.locator('.choices').first().locator('button').count();
  for (let i = 0; i < tipos; i += 1) {
    await page.locator('.choices').first().locator('button').nth(i).click();
    await page.waitForTimeout(200);
  }
  await abrirTodo();
  await page.waitForTimeout(300);
}

for (const caso of [
  {
    locale: 'en-GB',
    sobra: (t: string) => ACENTOS.test(t) || ESPAÑOL.test(t),
    otro: 'español',
  },
  {
    locale: 'es-ES',
    sobra: (t: string) => INGLÉS.test(t),
    otro: 'inglés',
  },
]) {
  test.describe(`interfaz en ${caso.locale}`, () => {
    /*
      `locale` y NO `extraHTTPHeaders['Accept-Language']`.

      Playwright manda su propia cabecera a partir de `locale` —`en-US` por
      defecto— y esa gana. Puesta a mano, la prueba pedía español, recibía
      inglés, y el barrido de restos en inglés fallaba... acusando al código.
    */
    test.use({ locale: caso.locale });

    for (const ruta of ['/', '/entrar', '/crear', '/cafe']) {
      test(`${ruta} no tiene restos en ${caso.otro}`, async ({ page }) => {
        await page.goto(ruta, { waitUntil: 'networkidle' });
        if (ruta === '/crear') await desplegarEditor(page);

        const leido = await textoVisible(page);
        /* Si no se ha leído nada, la prueba no está comprobando nada: una
           pantalla en blanco pasaría cualquier filtro. El listarón es bajo
           porque `/entrar` son cuatro frases y un formulario. */
        expect(leido.length).toBeGreaterThan(5);

        const restos = [...new Set(leido.filter((t) => !BLANCA.has(t) && caso.sobra(t)))];
        expect(restos, `restos en ${caso.otro} en ${ruta}`).toEqual([]);
      });
    }
  });
}

test.describe('el selector de idioma', () => {
  test.use({ locale: 'en-GB' });

  test('cambia la pantalla y se recuerda', async ({ page, context }) => {
    await page.goto('/crear', { waitUntil: 'networkidle' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.locator('.locale-switch button', { hasText: 'ES' }).click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('.topbar input').first()).toHaveAttribute(
      'placeholder',
      'Ponle un nombre',
    );

    /* La cookie es lo que hace que la elección sobreviva a la siguiente
       navegación, y tiene que ganarle a la cabecera del navegador — que aquí
       sigue pidiendo inglés. */
    const cookie = (await context.cookies()).find((c) => c.name === 'volumine-locale');
    expect(cookie?.value).toBe('es');

    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });
});

test.describe('el embed no sabe de idiomas', () => {
  /*
    La regla 1 de CLAUDE.md: `/embed` no lleva nada que no necesite. El idioma
    de la interfaz es una de esas cosas — una gráfica publicada se ve como la
    escribió quien la hizo, la mire quien la mire, y meter i18n ahí costaría
    kilobytes en la ruta que tiene el presupuesto más apretado.
  */
  test('no manda cookie de idioma ni lee la cabecera', async ({ page }) => {
    const respuesta = await page.goto('/embed?c=noesunaconfig', {
      waitUntil: 'domcontentloaded',
    });

    const setCookie = respuesta?.headers()['set-cookie'] ?? '';
    expect(setCookie).not.toContain('volumine-locale');

    const html = (await respuesta?.text()) ?? '';
    expect(html).not.toContain('I18nProvider');
  });
});
