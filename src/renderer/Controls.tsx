'use client';

import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/*
  Órbita con los controles que ya trae three, no con los de drei.

  drei es cómodo, pero su <OrbitControls /> arrastra el núcleo de la librería al
  bundle y /embed no tiene sitio para eso (docs/PERFORMANCE-BUDGET.md). Aquí solo
  entra el archivo de controles.
*/

export type ControlsProps = {
  target: [number, number, number];
  enableZoom: boolean;
};

export function Controls({ target, enableZoom }: ControlsProps) {
  const camera = useThree((s) => s.camera);
  const domElement = useThree((s) => s.gl.domElement);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const controls = new OrbitControls(camera, domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controlsRef.current = controls;

    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, domElement]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.enableZoom = enableZoom;
    controls.target.set(target[0], target[1], target[2]);
    controls.update();
  }, [enableZoom, target]);

  useFrame(() => {
    controlsRef.current?.update();
  });

  return null;
}
