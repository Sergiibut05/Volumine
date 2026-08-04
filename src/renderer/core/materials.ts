import { Material, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import type { ResolvedChartConfig } from '@/lib/config/defaults';

/*
  Materiales de la gráfica.

  Presets con nombre antes que sliders físicos: la gente sabe si quiere que
  parezca plástico o metal, no sabe qué es la rugosidad (docs/CUSTOMIZATION.md).
*/

/**
 * Color de un segmento: primero el override puntual, luego la paleta.
 *
 * El hex se pasa tal cual. Con la gestión de color de three activada, `Color` ya
 * lo interpreta como sRGB; convertirlo a mano lo hace dos veces y los colores
 * salen lavados.
 */
export function colorForSegment(config: ResolvedChartConfig, index: number): string {
  const override = config.data.series[0]?.colors?.[index];
  if (override) return override;
  const palette = config.style.palette;
  return palette[index % palette.length];
}

export function createMaterial(config: ResolvedChartConfig, color: string): Material {
  const base = {
    color,
    roughness: config.style.roughness,
    metalness: config.style.metalness,
  };

  switch (config.style.material) {
    case 'matte':
      return new MeshStandardMaterial({ ...base, metalness: 0, roughness: 0.9 });
    case 'metal':
      return new MeshStandardMaterial({ ...base, metalness: 1, roughness: 0.25 });
    case 'glass':
      return new MeshPhysicalMaterial({
        ...base,
        transmission: 0.9,
        thickness: 0.5,
        roughness: 0.1,
      });
    case 'toon':
      /*
        "Plano" NO es cel-shading, y tampoco puede ser un material sin PBR.

        Se descartó `MeshToonMaterial` porque cuantiza la luz en bandas y sobre
        una pared cilíndrica eso se ve como un escalonado serrado. Se sustituyó
        por Lambert, y ese cambio traía un problema peor: three solo conecta
        `scene.environment` a los materiales PBR — literalmente
        `material.isMeshStandardMaterial ? scene.environment : null`, en
        WebGLPrograms. Nuestra escena se ilumina casi entera por IBL y no tiene
        luz ambiente, así que Lambert se quedaba con una sola direccional y sin
        relleno: el acabado salía casi negro.

        Lo que pide este acabado es "mate, sin brillos, para acompañar a un texto
        largo". Eso es difuso puro, que en PBR es rugosidad 1 y metalness 0. El
        emisivo bajo, del color del propio segmento, levanta las zonas en sombra:
        es lo que lo deja PLANO de verdad —poco recorrido entre luz y sombra— en
        vez de solo mate.
      */
      return new MeshStandardMaterial({
        color,
        roughness: 1,
        metalness: 0,
        emissive: color,
        emissiveIntensity: 0.35,
      });
    case 'physical':
    default:
      return new MeshPhysicalMaterial({
        ...base,
        clearcoat: 0.3,
        clearcoatRoughness: 0.25,
      });
  }
}
