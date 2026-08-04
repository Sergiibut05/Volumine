#!/usr/bin/env node
/**
 * Rasteriza la tierra del mundo a una máscara de bits y la escribe como módulo.
 *
 * POR QUÉ EN BUILD Y NO EN RUNTIME
 * --------------------------------
 * El TopoJSON de `world-atlas` son 54 KB y hace falta `topojson-client` y
 * `d3-geo` para leerlo. Nada de eso puede entrar en `/embed`, que tiene 180 KB
 * para todo (regla 1 de CLAUDE.md).
 *
 * Rasterizado a 0,5° el mundo entero cabe en una rejilla de 720×360 bits = 32 KB
 * en crudo, que en base64 y comprimido se queda en unos pocos KB. Esa rejilla es
 * lo único que viaja al navegador: el TopoJSON, topojson-client y d3-geo se
 * quedan aquí, como dependencias de desarrollo.
 *
 * 0,5° no es un número redondo cualquiera: con ~16.000 puntos repartidos por la
 * esfera, la separación media entre puntos es de 1°, así que la máscara tiene el
 * doble de resolución que el muestreo y las costas no aliasean.
 *
 * Salida: src/renderer/geometry/globe-map.ts (generado, se commitea).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import { geoContains } from 'd3-geo';

const require = createRequire(import.meta.url);

/** Grados por celda. Ver la cabecera. */
const STEP = 0.5;
const WIDTH = Math.round(360 / STEP);
const HEIGHT = Math.round(180 / STEP);

const topology = JSON.parse(
  await readFile(require.resolve('world-atlas/land-110m.json'), 'utf8'),
);
const land = feature(topology, topology.objects.land);

const bytes = new Uint8Array(Math.ceil((WIDTH * HEIGHT) / 8));
let landCells = 0;

for (let y = 0; y < HEIGHT; y += 1) {
  // Centro de la celda, no su esquina: en el borde de una costa la esquina cae
  // fuera la mitad de las veces y el litoral sale mordido.
  const lat = 90 - (y + 0.5) * STEP;

  for (let x = 0; x < WIDTH; x += 1) {
    const lon = -180 + (x + 0.5) * STEP;
    if (!geoContains(land, [lon, lat])) continue;

    const index = y * WIDTH + x;
    bytes[index >> 3] |= 1 << (index & 7);
    landCells += 1;
  }
}

const base64 = Buffer.from(bytes).toString('base64');
const gz = gzipSync(Buffer.from(base64)).length;

const source = `/*
  GENERADO por scripts/build-globe-map.mjs — no editar a mano.

  Máscara de tierra del mundo a ${STEP}°: ${WIDTH}×${HEIGHT} bits, un bit por celda,
  empaquetada en base64. Origen: world-atlas/land-110m (Natural Earth, dominio
  público), rasterizado en build para que ni el TopoJSON ni sus librerías entren
  en el bundle de /embed.

  ${(bytes.length / 1024).toFixed(1)} KB en crudo · ${(base64.length / 1024).toFixed(1)} KB en base64 · ~${(gz / 1024).toFixed(1)} KB comprimido.
*/

export const MAP_WIDTH = ${WIDTH};
export const MAP_HEIGHT = ${HEIGHT};
export const MAP_STEP_DEGREES = ${STEP};

const PACKED =
  '${base64}';

let decoded: Uint8Array | null = null;

/** Descomprime la máscara la primera vez que se pide, y la reutiliza después. */
function bits(): Uint8Array {
  if (decoded) return decoded;
  const binary = atob(PACKED);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  decoded = out;
  return out;
}

/** ¿Hay tierra en esta coordenada? Latitud y longitud en grados. */
export function isLand(lat: number, lon: number): boolean {
  const y = Math.floor((90 - lat) / MAP_STEP_DEGREES);
  const x = Math.floor((lon + 180) / MAP_STEP_DEGREES);
  if (y < 0 || y >= MAP_HEIGHT) return false;

  // La longitud da la vuelta: -181° es 179°.
  const wrapped = ((x % MAP_WIDTH) + MAP_WIDTH) % MAP_WIDTH;
  const index = y * MAP_WIDTH + wrapped;
  return (bits()[index >> 3] & (1 << (index & 7))) !== 0;
}
`;

await writeFile('src/renderer/geometry/globe-map.ts', source);

console.log(
  `  mapa del globo  ${WIDTH}×${HEIGHT} · ${landCells} celdas de tierra · ` +
    `${(base64.length / 1024).toFixed(1)} KB base64 · ~${(gz / 1024).toFixed(1)} KB comprimido`,
);
