'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
/* Imports nombrados, nunca `import * as THREE`: con el namespace entero el
   bundler no puede descartar nada y three viaja completo al embed. */
import {
  Group,
  Material,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  Vector3,
  type BufferGeometry,
} from 'three';
import type { ResolvedChartConfig } from '@/lib/config/defaults';
import {
  computeSectors,
  globalBevel,
  curveSegmentsFor,
  sectorGeometry,
  sectorDirection,
  OUTER_RADIUS,
  type Sector,
} from '../geometry/donut';

/*
  Renderer de donut/pie. Función pura de ChartConfig: mismo config, mismos
  píxeles. Sin aleatoriedad sin sembrar y sin leer el reloj fuera de la
  animación — es lo que hace posibles el render estático y los tests visuales.
*/

export type DonutChartProps = {
  config: ResolvedChartConfig;
  onHover?: (sector: Sector | null) => void;
  /** Desactiva movimiento sin tocar el config (lo usa el render estático). */
  frozen?: boolean;
};

type Piece = {
  sector: Sector;
  geometry: BufferGeometry;
  material: Material;
  direction: Vector3;
  color: string;
};

function resolveColor(config: ResolvedChartConfig, index: number): string {
  const override = config.data.series[0]?.colors?.[index];
  if (override) return override;
  const palette = config.style.palette;
  return palette[index % palette.length];
}

function createMaterial(config: ResolvedChartConfig, color: string): Material {
  const common = {
    // El hex se pasa tal cual: con la gestión de color de three activada, Color
    // ya lo interpreta como sRGB. Convertirlo a mano lo hace dos veces y los
    // colores salen lavados (docs/STATE.md).
    color,
    roughness: config.style.roughness,
    metalness: config.style.metalness,
  };

  switch (config.style.material) {
    case 'matte':
      return new MeshStandardMaterial({ ...common, metalness: 0, roughness: 0.9 });
    case 'metal':
      return new MeshStandardMaterial({ ...common, metalness: 1, roughness: 0.25 });
    case 'glass':
      return new MeshPhysicalMaterial({
        ...common,
        transmission: 0.9,
        thickness: 0.5,
        roughness: 0.1,
      });
    case 'toon':
      return new MeshToonMaterial({ color });
    case 'physical':
    default:
      return new MeshPhysicalMaterial({
        ...common,
        clearcoat: 0.3,
        clearcoatRoughness: 0.25,
      });
  }
}

export function DonutChart({ config, onHover, frozen = false }: DonutChartProps) {
  const groupRef = useRef<Group>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const hoverAmount = useRef<Map<number, number>>(new Map());

  // Vectores reutilizables: crear objetos por frame es presión de GC y tirones.
  const tmpDir = useRef(new Vector3());

  const values = config.data.series[0]?.values ?? [];

  /*
    Geometrías y materiales se crean AQUÍ, fuera del render loop, y se
    memoizan por lo que de verdad afecta a la forma (CLAUDE.md).
  */
  const pieces = useMemo<Piece[]>(() => {
    const { innerRadius, height, gap, bevel } = config.style;
    const innerR = innerRadius * OUTER_RADIUS;
    const sectors = computeSectors(values, gap);
    if (sectors.length === 0) return [];

    const limits = {
      innerR,
      outerR: OUTER_RADIUS,
      depth: height,
      gapAngle: gap * Math.PI * 2,
    };

    // UN SOLO bevel para todo el donut: si se calcula por sector, las juntas no
    // casan y parece que las piezas se traspasan (ver geometry/donut.ts).
    const bevelAbs = globalBevel(sectors, limits, bevel);

    return sectors.map((sector) => ({
      sector,
      geometry: sectorGeometry({
        sector,
        innerR,
        outerR: OUTER_RADIUS,
        depth: height,
        bevel: bevelAbs,
        curveSegments: curveSegmentsFor(sector),
      }),
      material: createMaterial(config, resolveColor(config, sector.index)),
      direction: sectorDirection(sector),
      color: resolveColor(config, sector.index),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    values.join(','),
    config.style.innerRadius,
    config.style.height,
    config.style.gap,
    config.style.bevel,
    config.style.material,
    config.style.roughness,
    config.style.metalness,
    config.style.palette.join(','),
  ]);

  // Liberar la geometría y el material anteriores cuando cambian o al desmontar.
  useEffect(() => {
    return () => {
      for (const piece of pieces) {
        piece.geometry.dispose();
        piece.material.dispose();
      }
    };
  }, [pieces]);

  const reduceMotion =
    config.motion.reducedMotion === 'respect' &&
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const animate = !frozen && !reduceMotion && config.motion.reducedMotion !== 'force-off';

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const group = groupRef.current;
    if (!group) return;

    if (animate && config.motion.autoRotate) {
      group.rotation.y += (config.motion.speed / 60) * Math.PI * 2 * delta;
    }

    // Realce interpolado, nunca a saltos.
    const lift = config.motion.hover === 'lift' || config.motion.hover === 'explode';
    for (let i = 0; i < group.children.length; i += 1) {
      const mesh = group.children[i];
      const piece = pieces[i];
      if (!piece) continue;

      const target = piece.sector.index === hovered && lift ? 1 : 0;
      const current = hoverAmount.current.get(piece.sector.index) ?? 0;
      const next = current + (target - current) * (1 - Math.pow(0.001, delta));
      hoverAmount.current.set(piece.sector.index, next);

      const push = config.style.explode * 0.35 + next * 0.05;
      tmpDir.current.copy(piece.direction).multiplyScalar(push);
      mesh.position.set(tmpDir.current.x, next * 0.09, tmpDir.current.z);
    }
  });

  return (
    <group ref={groupRef}>
      {pieces.map((piece) => (
        <mesh
          key={piece.sector.index}
          geometry={piece.geometry}
          material={piece.material}
          castShadow={config.style.shadow}
          receiveShadow={config.style.shadow}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(piece.sector.index);
            onHover?.(piece.sector);
          }}
          onPointerOut={() => {
            setHovered(null);
            onHover?.(null);
          }}
        />
      ))}
    </group>
  );
}
