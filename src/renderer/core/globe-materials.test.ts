import { describe, expect, it } from 'vitest';
import { ShaderLib } from 'three';
import { globeLandMaterial } from './globe-materials';

/*
  Los puntos del globo retocan el shader de `PointsMaterial` buscando y
  sustituyendo TRES líneas de three. Si una actualización de three cambia una
  de ellas, `replace` no encuentra nada y no avisa: el globo sigue compilando,
  pero con los puntos cuadrados, diminutos o —si falla solo la parte del
  vértice— negros, porque el fragment leería una variable que nadie escribe.

  Esto convierte ese fallo callado en un test rojo el día que se suba three.
*/

describe('los retoques del shader de los puntos del globo', () => {
  it('encuentran en three las líneas que sustituyen', () => {
    const { vertexShader, fragmentShader } = ShaderLib.points;
    expect(vertexShader).toContain('#include <project_vertex>');
    expect(vertexShader).toContain('gl_PointSize *= ( scale / - mvPosition.z );');
    expect(fragmentShader).toContain('vec4 diffuseColor = vec4( diffuse, opacity );');
  });

  it('las sustituyen de verdad', () => {
    const material = globeLandMaterial('#ffffff', 0.016);
    const shader = {
      vertexShader: ShaderLib.points.vertexShader,
      fragmentShader: ShaderLib.points.fragmentShader,
      uniforms: {},
    };
    material.onBeforeCompile(shader as never, undefined as never);

    expect(shader.vertexShader).toContain('projectionMatrix[ 1 ][ 1 ]');
    expect(shader.vertexShader).toContain('vShade =');
    expect(shader.fragmentShader).toContain('diffuse * vShade');
    expect(shader.fragmentShader).toContain('discard');
  });
});
