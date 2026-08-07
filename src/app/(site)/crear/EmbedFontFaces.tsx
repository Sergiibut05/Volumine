import { readFile } from 'node:fs/promises';
import path from 'node:path';

/*
  Declara en el EDITOR las mismas tipografías que puede servir el embed.

  ── POR QUÉ HACE FALTA ─────────────────────────────────────────────────────

  El editor es una vista previa del link, y una vista previa que miente sobre la
  tipografía miente sobre si la etiqueta cabe. Sin esto, elegir «Serifa» en el
  editor enseñaba la serifa DEL SISTEMA y el embed la nuestra: dos anchos
  distintos, la misma config.

  ── POR QUÉ DECLARARLAS TODAS NO CUESTA NADA ───────────────────────────────

  Un `@font-face` no descarga nada por existir: el navegador pide el fichero la
  primera vez que algo USA esa familia. Así que las tres se declaran siempre y
  se descarga solo la que se elija — y si no se elige ninguna, ninguna.

  Se lee del mismo manifiesto que usa el embed, así que las dos rutas apuntan
  literalmente al mismo fichero con el mismo hash. Si se generan de nuevo, las
  dos cambian a la vez.
*/

type EmbedFont = { family: string; slices: { file: string; unicodeRange: string }[] };

export async function EmbedFontFaces() {
  let fuentes: Record<string, EmbedFont> = {};

  try {
    fuentes = JSON.parse(
      await readFile(path.join(process.cwd(), 'public/embed-fonts/manifest.json'), 'utf8'),
    ) as Record<string, EmbedFont>;
  } catch {
    /* Sin build de fuentes no se declara ninguna y todo cae a las familias del
       sistema. El editor sigue funcionando; pierde la identidad de píxel. */
    return null;
  }

  const css = Object.values(fuentes)
    .flatMap((voz) =>
      voz.slices.map(
        (corte) =>
          `@font-face{font-family:"${voz.family}";` +
          `src:url("/embed-fonts/${corte.file}") format("woff2");` +
          `unicode-range:${corte.unicodeRange};` +
          /* El rango de grosor SE DECLARA: sin él el navegador trata una fuente
             variable como estática y clava todo en 400, así que el nombre de la
             etiqueta dejaría de verse más fuerte que su cifra. */
          `font-weight:400 600;font-style:normal;font-display:swap}`,
      ),
    )
    .join('');

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
