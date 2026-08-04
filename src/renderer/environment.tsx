'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Mesh, PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/*
  Iluminación basada en imagen, generada por procedimiento.

  `RoomEnvironment` viene dentro de three y se calcula en el cliente: cero
  peticiones de red. drei ofrece <Environment preset="studio" /> pero descarga un
  HDR de un CDN, y /embed no hace peticiones a terceros — ni una (ADR 0005).

  Es lo que separa "se ve caro" de "se ve a WebGL".
*/

export function ProceduralEnvironment({ intensity }: { intensity: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    // Fuera del render loop, una sola vez, y se libera al desmontar.
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);

    scene.environment = target.texture;

    return () => {
      scene.environment = null;
      target.texture.dispose();
      room.traverse((obj) => {
        if (obj instanceof Mesh) {
          obj.geometry?.dispose();
          const material = obj.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material?.dispose();
        }
      });
      pmrem.dispose();
    };
  }, [gl, scene]);

  useEffect(() => {
    /* Medido: por encima de ~0.7 el IBL blanco lava el color y todo parece
       plastilina pastel. Ver docs/STATE.md. */
    scene.environmentIntensity = intensity;
  }, [scene, intensity]);

  return null;
}
