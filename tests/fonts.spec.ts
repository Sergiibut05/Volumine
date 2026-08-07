import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

/*
  Las tipografías que servimos, comprobadas donde se usan: en un navegador.

  ── POR QUÉ ESTO NO PUEDE SER UN TEST UNITARIO ─────────────────────────────

  Lo que hay que verificar es lo que hace HarfBuzz al recortar el fichero, y eso
  solo se ve cuando un motor de texto de verdad lo usa para medir. Nada de esto
  lanza una excepción: una fuente mal recortada carga, se ve casi igual, y falla
  en el detalle.

  Los dos detalles que ya fallaron una vez, los dos encontrados midiendo:

  · `noLayoutClosure` ahorra de 6 a 10 KB por fuente quitando los glifos que
    solo se alcanzan por sustitución… y `tabular-nums` ES una sustitución.
    Podado en Inter, «111» medía 48,8 px y «999» 74,4: los números de una
    carrera de barras bailando de ancho en cada fotograma.
  · Sin declarar el rango de grosor, el navegador trata una fuente variable como
    estática y clava todo en 400. El nombre de la etiqueta dejaría de verse más
    fuerte que su cifra.

  Sin estas pruebas, las dos cosas se rompen el día que alguien actualice una
  fuente o toque el script, y nadie se entera.
*/

type EmbedFont = { family: string; slices: { file: string; unicodeRange: string }[] };

async function manifiesto(): Promise<Record<string, EmbedFont>> {
  return JSON.parse(await readFile('public/embed-fonts/manifest.json', 'utf8'));
}

/** Carga la fuente en la página tal y como la declara el embed. */
async function cargar(page: Page, voz: EmbedFont) {
  await page.evaluate(async ({ family, slices }) => {
    for (const corte of slices) {
      const cara = new FontFace(family, `url(/embed-fonts/${corte.file}) format("woff2")`, {
        // Igual que en el `@font-face` que emite el embed: rango y cobertura.
        weight: '400 600',
        unicodeRange: corte.unicodeRange,
      });
      await cara.load();
      document.fonts.add(cara);
    }
  }, voz);
}

/** Ancho de un texto con esa familia, ese grosor y esas cifras. */
async function ancho(
  page: Page,
  family: string,
  texto: string,
  { peso = 400, tabular = false } = {},
) {
  return page.evaluate(
    ({ family, texto, peso, tabular }) => {
      const s = document.createElement('span');
      s.style.cssText =
        `position:absolute;white-space:pre;font-family:"${family}";font-size:40px;` +
        `font-weight:${peso};font-variant-numeric:${tabular ? 'tabular-nums' : 'normal'}`;
      s.textContent = texto;
      document.body.append(s);
      const w = s.getBoundingClientRect().width;
      s.remove();
      return w;
    },
    { family, texto, peso, tabular },
  );
}

test.describe('las tipografías del embed', () => {
  test('se sirven, y solo pesan lo que dice el presupuesto', async ({ page }) => {
    const fuentes = await manifiesto();
    expect(Object.keys(fuentes)).toEqual(['inter', 'display', 'mono']);

    for (const voz of Object.values(fuentes)) {
      expect(voz.slices.length, `${voz.family} sin cortes`).toBe(2);

      for (const corte of voz.slices) {
        const res = await page.request.get(`/embed-fonts/${corte.file}`);
        expect(res.status(), corte.file).toBe(200);

        const cuerpo = await res.body();
        expect(cuerpo.length, `${corte.file} pasa del tope`).toBeLessThan(32 * 1024);
        // woff2 empieza por «wOF2». Si falla, se está sirviendo otra cosa.
        expect(cuerpo.subarray(0, 4).toString('latin1')).toBe('wOF2');
      }
    }
  });

  test('las cifras siguen cuadrando en columna', async ({ page }) => {
    await page.goto('/');
    const fuentes = await manifiesto();

    for (const voz of Object.values(fuentes)) {
      await cargar(page, voz);
      const unos = await ancho(page, voz.family, '111', { tabular: true });
      const nueves = await ancho(page, voz.family, '999', { tabular: true });

      /* Con cifras tabulares, todos los dígitos miden lo mismo. Si esto falla,
         una carrera de barras tiembla en cada fotograma. */
      expect(
        Math.abs(unos - nueves),
        `${voz.family}: 111=${unos} 999=${nueves}`,
      ).toBeLessThan(0.5);
    }
  });

  test('los dos grosores de verdad son distintos', async ({ page }) => {
    await page.goto('/');
    const fuentes = await manifiesto();

    for (const [id, voz] of Object.entries(fuentes)) {
      await cargar(page, voz);

      /* En una monoespaciada el ancho NO cambia con el grosor —es su gracia—,
         así que ahí se mide el grosor del trazo en vez del ancho. */
      if (id === 'mono') {
        const tinta = await page.evaluate(
          ({ family }) => {
            const c = document.createElement('canvas');
            c.width = 80;
            c.height = 80;
            const x = c.getContext('2d')!;
            const oscuros = (peso: number) => {
              x.clearRect(0, 0, 80, 80);
              x.fillStyle = '#000';
              x.font = `${peso} 60px "${family}"`;
              x.fillText('8', 5, 60);
              const d = x.getImageData(0, 0, 80, 80).data;
              let n = 0;
              for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n += 1;
              return n;
            };
            return { w400: oscuros(400), w600: oscuros(600) };
          },
          { family: voz.family },
        );
        expect(tinta.w600, `${voz.family} no engorda`).toBeGreaterThan(tinta.w400 * 1.05);
        continue;
      }

      const w400 = await ancho(page, voz.family, 'Suscripciones', { peso: 400 });
      const w600 = await ancho(page, voz.family, 'Suscripciones', { peso: 600 });
      expect(w600, `${voz.family}: 400=${w400} 600=${w600}`).toBeGreaterThan(w400);
    }
  });

  test('tienen los acentos y las monedas que usa una etiqueta', async ({ page }) => {
    await page.goto('/');
    const fuentes = await manifiesto();

    /*
      Cómo se sabe si un glifo ESTÁ en una fuente, desde el navegador.

      Comparando su ancho con la fuente puesta delante de un respaldo conocido,
      contra el ancho con SOLO el respaldo. Si el glifo está, lo dibuja la
      nuestra y los anchos difieren; si no está, el navegador cae al respaldo en
      los dos casos y miden exactamente igual.

      Contar caracteres o comparar cadenas no sirve: en una monoespaciada
      «ñáéíóú» y «naeiou» miden lo mismo estén los acentos o no, que es
      justamente como la primera versión de esta prueba se engañó a sí misma.
    */
    const estaEnLaFuente = (family: string, ch: string) =>
      page.evaluate(
        ({ family, ch }) => {
          const c = document.createElement('canvas').getContext('2d')!;
          const mide = (f: string) => {
            c.font = `40px ${f}`;
            return c.measureText(ch).width;
          };
          return Math.abs(mide(`"${family}", monospace`) - mide('monospace')) > 0.01;
        },
        { family, ch },
      );

    for (const voz of Object.values(fuentes)) {
      await cargar(page, voz);

      /* Latin-1 y puntuación tipográfica van en el corte base; las letras
         polacas, checas y turcas en el extendido. Los dos tienen que estar. */
      for (const ch of ['ñ', 'á', 'ü', 'ç', 'ß', '€', '£', '—', '…', 'ł', 'ř', 'ğ']) {
        expect(await estaEnLaFuente(voz.family, ch), `${voz.family} no trae «${ch}»`).toBe(
          true,
        );
      }

      /*
        Y el control negativo: lo que se dejó fuera A PROPÓSITO tiene que estar
        fuera. Sin esto, la prueba de arriba pasaría igual con una fuente sin
        recortar, y no diría nada de lo que de verdad se está midiendo.
      */
      for (const ch of ['好', 'д', 'α']) {
        expect(
          await estaEnLaFuente(voz.family, ch),
          `${voz.family} trae «${ch}», que debería estar recortado`,
        ).toBe(false);
      }
    }
  });

  test('una gráfica con `system` NO descarga ninguna', async ({ page }) => {
    /*
      Es la promesa de la landing: un archivo, una petición. Se comprueba
      mirando lo que el navegador PIDE de verdad, no lo que dice el HTML.
    */
    const pedidas: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/embed-fonts/')) pedidas.push(r.url());
    });

    await page.goto('/dev/embed', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    expect(pedidas, 'el embed por defecto ha pedido una tipografía').toEqual([]);
  });
});
