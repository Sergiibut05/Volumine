'use client';

import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, MathUtils } from 'three';
import { Controls } from './Controls';
import type { ResolvedChartConfig } from '@/lib/config/defaults';
import { ProceduralEnvironment } from './environment';
import { DonutChart } from './charts/DonutChart';
import type { Sector } from './geometry/donut';

/*
  La escena. Todo lo que no es la gráfica en sí: cámara, luz, suelo, controles.
  Es común a todos los tipos de gráfica; lo específico vive en charts/.
*/

const CAMERA_PRESETS = {
  hero: { polar: 62, azimuth: -35, distance: 1 },
  top: { polar: 5, azimuth: 0, distance: 0.95 },
  front: { polar: 82, azimuth: 0, distance: 1.15 },
  isometric: { polar: 54.7, azimuth: -45, distance: 1.05 },
} as const;

function cameraPosition(config: ResolvedChartConfig): [number, number, number] {
  const preset =
    config.camera.preset === 'custom'
      ? { polar: config.camera.polar, azimuth: config.camera.azimuth, distance: 1 }
      : CAMERA_PRESETS[config.camera.preset];

  const polar = MathUtils.degToRad(preset.polar);
  const azimuth = MathUtils.degToRad(preset.azimuth);
  const radius = 4.2 * preset.distance * config.camera.distance;

  return [
    radius * Math.sin(polar) * Math.sin(azimuth),
    radius * Math.cos(polar),
    radius * Math.sin(polar) * Math.cos(azimuth),
  ];
}

export type ChartStageProps = {
  config: ResolvedChartConfig;
  onHover?: (sector: Sector | null) => void;
  frozen?: boolean;
  className?: string;
};

export function ChartStage({ config, onHover, frozen, className }: ChartStageProps) {
  /* Separado del suelo: apoyada sobre el plano, la sombra queda oculta debajo de
     la propia gráfica y se pierde toda la sensación de peso. Proporcional al
     grosor para que se mantenga al cambiarlo. */
  const elevation = config.style.height * 0.75;
  const transparent = config.scene.background.kind === 'transparent';

  return (
    <Canvas
      className={className}
      shadows={config.style.shadow}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        alpha: transparent,
        // El embed puede compartir página con otros: no acaparamos la GPU.
        powerPreference: 'low-power',
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 0.95,
      }}
      camera={{ position: cameraPosition(config), fov: config.camera.fov }}
    >
      {!transparent && <color attach="background" args={[config.scene.background.from]} />}

      <ProceduralEnvironment intensity={config.scene.lightIntensity} />

      <directionalLight
        position={[2.6, 4.2, 2.2]}
        intensity={1.1}
        castShadow={config.style.shadow}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0012}
        shadow-camera-near={0.5}
        shadow-camera-far={14}
        shadow-camera-left={-2.6}
        shadow-camera-right={2.6}
        shadow-camera-top={2.6}
        shadow-camera-bottom={-2.6}
      />

      <group position={[0, elevation, 0]}>
        {(config.type === 'donut' || config.type === 'pie') && (
          <DonutChart config={config} onHover={onHover} frozen={frozen} />
        )}
      </group>

      {config.style.shadow && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
          <planeGeometry args={[24, 24]} />
          <shadowMaterial opacity={0.34} />
        </mesh>
      )}

      {config.interaction.orbit && (
        /* zoom por defecto false: un embed que secuestra la rueda del ratón
           dentro de una página ajena es un embed que la gente quita. */
        <Controls target={[0, elevation, 0]} enableZoom={config.interaction.zoom} />
      )}
    </Canvas>
  );
}
