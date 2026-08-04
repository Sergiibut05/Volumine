import {
  Material,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
} from 'three';
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
      return new MeshToonMaterial({ color });
    case 'physical':
    default:
      return new MeshPhysicalMaterial({
        ...base,
        clearcoat: 0.3,
        clearcoatRoughness: 0.25,
      });
  }
}
