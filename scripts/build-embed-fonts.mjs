#!/usr/bin/env node
/**
 * Prepara las tipografías que puede pedir un embed.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POR QUÉ HAY FUENTES PROPIAS SI LA REGLA 1 PROHÍBE LAS REMOTAS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Lo que la regla 1 prohíbe es depender de un TERCERO: Google Fonts significa
 * que Google ve la IP de cada visitante de la página de un cliente nuestro —hay
 * sentencias en Alemania declarándolo incompatible con el RGPD por eso—, y el
 * «0 terceros» es lo que la landing vende. Estas se sirven desde nuestro propio
 * dominio: sin cookies, sin rastreo y sin nadie mirando.
 *
 * Y hacen falta por un motivo MEDIDO, no estético. Con familias del sistema, la
 * misma config se ve distinta según el ordenador: `ui-serif` resuelve a Georgia
 * en Windows, a New York en macOS, y a Times donde no haya Georgia. La cadena
 * «Suscripciones 42 k€» mide 134,2 px en Georgia y 109,1 px en Times — un 23%.
 * Eso cambia si la etiqueta cabe, dónde acaba su línea guía y si `fitLabels()`
 * la descarta. O sea que las fuentes del sistema ROMPEN «mismo config, mismos
 * píxeles», que es lo único que este proyecto promete. Una fuente nuestra es la
 * única forma de cumplirlo.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * LO QUE CUESTA, Y QUIÉN LO PAGA
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Una petición más y entre 13 y 25 KB — pero SOLO para la gráfica que elija una.
 * El valor por defecto sigue siendo `system`, que no descarga nada: un embed que
 * no toca la tipografía sigue siendo un archivo y una petición, como anuncia la
 * landing. La elección es explícita y su coste también.
 *
 * De ahí salen las dos decisiones de este script:
 *
 *   · EL EJE DE GROSOR SE RECORTA A 400-600. Las etiquetas usan exactamente dos
 *     grosores: 400 para la cifra y 600 para el nombre. Medido sobre Inter, el
 *     eje entero son 30,1 KB, de 400 a 600 son 20,6 y un grosor fijo 12,3. El
 *     recorte se queda con los dos que se usan por la mitad de precio; fijar uno
 *     solo obligaría a falsear la negrita, que se ve mal.
 *   · EL JUEGO DE CARACTERES SE RECORTA a lo que se puede escribir en una
 *     etiqueta. Esto solo, sin tocar el eje, ahorraba un 8-26%: es lo secundario
 *     y por eso el eje va primero.
 *
 * Salida: public/embed-fonts/<voz>.<hash>.woff2 + manifest.json, igual que el
 * bundle. Generado en cada build y fuera del repo: los binarios no se versionan.
 */
import subsetFont from 'subset-font';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const OUT = path.join(root, 'public/embed-fonts');

/**
 * Las tres voces, con el id que YA VIAJA en los links publicados.
 *
 * `inter`, `display` y `mono` vienen de la v1 del contrato y no se pueden
 * renombrar. Lo que nombran es el papel; el fichero que resuelven es esto.
 */
const VOCES = [
  {
    id: 'inter',
    familia: 'Volumine Sans',
    fichero: '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
    extendido: '@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2',
    licencia: '@fontsource-variable/inter/LICENSE',
    /* Inter saca las cifras tabulares por SUSTITUCIÓN, así que aquí no se puede
       podar el cierre de capa: se llevaría por delante `tabular-nums` y los
       números bailarían de ancho en cada fotograma de una carrera. Cuesta 6 KB
       y se paga. Medido: 20,7 KB podando, 26,9 sin podar. */
    podarCierre: false,
  },
  {
    id: 'display',
    familia: 'Volumine Serif',
    fichero:
      '@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2',
    extendido:
      '@fontsource-variable/source-serif-4/files/source-serif-4-latin-ext-wght-normal.woff2',
    licencia: '@fontsource-variable/source-serif-4/LICENSE',
    /* Sus cifras ya son de ancho fijo sin sustitución: comprobado. */
    podarCierre: true,
  },
  {
    id: 'mono',
    familia: 'Volumine Mono',
    fichero:
      '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
    extendido:
      '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-ext-wght-normal.woff2',
    licencia: '@fontsource-variable/jetbrains-mono/LICENSE',
    /* Monoespaciada: todo mide igual por construcción, y de paso se van las
       ligaduras de programación, que convertirían un «42 -> 50» en una flecha. */
    podarCierre: true,
  },
];

/**
 * Lo que se puede escribir en una etiqueta.
 *
 * `subset-font` recorta por TEXTO, así que hay que escribir los caracteres. Van
 * el ASCII imprimible, el latín acentuado entero —que cubre español, francés,
 * alemán, portugués, polaco, checo…—, la puntuación tipográfica que meten Word
 * y Google Docs al copiar, y las monedas.
 *
 * Lo que NO va: griego, cirílico y CJK. Una etiqueta en esos alfabetos cae al
 * respaldo del sistema, que es exactamente lo que hay hoy — se pierde la
 * ventaja, no la legibilidad. Meterlos multiplicaría el peso por diez para
 * quien no los usa.
 */
/*
  Dos cortes, y el segundo casi nunca se descarga.

  `latin` lleva lo que se escribe en español, inglés, francés, alemán,
  portugués, italiano, catalán, neerlandés y nórdico — o sea, la práctica
  totalidad de las etiquetas que va a ver este producto.

  `latin-ext` añade polaco, checo, turco, húngaro y rumano. Se declara con
  `unicode-range`, así que el navegador SOLO lo pide si la etiqueta contiene una
  de esas letras: una gráfica en español no descarga un byte de él aunque el
  fichero exista. Es lo mismo que hace Google Fonts, y es la única forma de
  cubrir Europa sin cobrárselo a quien no lo necesita.

  Lo que NO va en ninguno: griego, cirílico y CJK. Una etiqueta en esos
  alfabetos cae a la fuente del sistema, que es exactamente lo que hay hoy.
*/
const CORTES = {
  base: [
    [0x20, 0x7e], // ASCII imprimible
    [0xa0, 0xff], // Latin-1: á é í ó ú ñ ü ç ß ø å …
    [0x2010, 0x2015], // guiones y rayas
    [0x2018, 0x201e], // comillas tipográficas
    [0x2020, 0x2022], // daga, viñeta
    [0x2026, 0x2026], // puntos suspensivos
    [0x2030, 0x2030], // por mil
    [0x2039, 0x203a], // comillas angulares simples
    [0x20a0, 0x20bf], // monedas: € £ ₽ ₹ ₩ …
    [0x2122, 0x2122], // ™
    [0x2212, 0x2212], // menos matemático
  ],
  ext: [
    [0x100, 0x17f], // Latin extendido A: ą ć ę ł ń ś ź ż ř ě š č ğ ş …
    [0x180, 0x24f], // Latin extendido B, lo poco que se usa
  ],
};

function caracteres(rangos) {
  let texto = '';
  for (const [desde, hasta] of rangos) {
    for (let c = desde; c <= hasta; c += 1) texto += String.fromCodePoint(c);
  }
  return texto;
}

/** El `unicode-range` que se escribe en el `@font-face` de cada corte. */
function rangoCss(rangos) {
  return rangos
    .map(([a, b]) =>
      a === b
        ? `U+${a.toString(16).toUpperCase()}`
        : `U+${a.toString(16).toUpperCase()}-${b.toString(16).toUpperCase()}`,
    )
    .join(',');
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const manifest = {};
  let total = 0;

  for (const voz of VOCES) {
    const cortes = [];

    for (const [nombreCorte, fuenteCorte] of [
      ['base', voz.fichero],
      ['ext', voz.extendido],
    ]) {
    const origen = path.join(root, 'node_modules', fuenteCorte);
    const entrada = await readFile(origen);
    const texto = caracteres(CORTES[nombreCorte]);

    const salida = await subsetFont(entrada, texto, {
      targetFormat: 'woff2',
      /* Los dos grosores que usan las etiquetas y ni uno más. Ver la cabecera:
         es de donde sale la mitad del ahorro. */
      variationAxes: { wght: { min: 400, max: 600 } },
      /*
        Podar los glifos que solo se alcanzan por SUSTITUCIÓN ahorra de 6 a 10 KB
        por fuente… y no se puede hacer a ciegas: `tabular-nums` ES una
        sustitución. Podarla en Inter dejaba «111» midiendo 48,8 px y «999»
        74,4 — o sea, los números de una carrera bailando de ancho en cada
        fotograma, sin que nada fallara.

        Por eso es una decisión POR FUENTE y no una optimización global, y por
        eso hay un test —`tests/fonts.spec.ts`— que carga las tres y comprueba
        que las cifras siguen cuadrando. Sin ese test, esto se rompe el día que
        alguien actualice una fuente y nadie se entera.
      */
      noLayoutClosure: voz.podarCierre,
    });

    /* Hash en el nombre para poder cachear un año sin miedo: si el fichero
       cambia, cambia la URL. Mismo trato que el bundle. */
    const hash = createHash('sha256').update(salida).digest('hex').slice(0, 8);
    const nombre = `${voz.id}-${nombreCorte}.${hash}.woff2`;
    await writeFile(path.join(OUT, nombre), salida);

    cortes.push({ file: nombre, unicodeRange: rangoCss(CORTES[nombreCorte]) });
    total += salida.length;
    console.log(
      `  ${(voz.id + ' ' + nombreCorte).padEnd(14)} ${kb(entrada.length).padStart(9)} → ${kb(salida.length).padStart(9)}`,
    );
    }

    /* La licencia viaja al lado del fichero. Las tres son SIL Open Font
       License, que permite servirlas siempre que la licencia acompañe. */
    await writeFile(
      path.join(OUT, `${voz.id}.LICENSE.txt`),
      await readFile(path.join(root, 'node_modules', voz.licencia), 'utf8'),
    );

    manifest[voz.id] = { family: voz.familia, slices: cortes };
  }

  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`  ${'total'.padEnd(14)} ${''.padStart(9)}   ${kb(total).padStart(9)}`);
  console.log('  (una gráfica descarga como mucho el corte «base» de UNA voz;');
  console.log('   «ext» solo si su texto lleva polaco, checo o turco)');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
