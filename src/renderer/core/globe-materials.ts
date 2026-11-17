import { BackSide, Color, PointsMaterial, ShaderMaterial } from 'three';

/*
  Los tres materiales del globo: planeta, puntos de tierra y halo.

  Viven aparte del renderer porque son SHADERS y no configuración de material,
  y porque cada uno lleva una corrección que no se deduce de leer el código:

  · EL PLANETA era un `MeshBasicMaterial` — color plano, sin luz. Por eso se
    veía como un disco recortado y no como una esfera. Ahora lleva la misma luz
    de estudio que el resto de tipos, FIJA RESPECTO A LA CÁMARA (arriba a la
    izquierda y de frente): el globo gira debajo de la luz, como un objeto en
    un set, en vez de llevarse la sombra con él.

  · EL HALO estaba al revés. Medía el fresnel de la esfera exterior, así que era
    más intenso en SU borde —lejos del planeta— y transparente junto a él: un
    aro con el canto duro por fuera. Una atmósfera es lo contrario: máxima
    pegada al planeta y desvaneciéndose hacia fuera. Además sumaba color
    (`AdditiveBlending`), que sobre un fondo claro se lava a blanco; con mezcla
    normal se ve igual sobre papel que sobre negro.

  · LOS PUNTOS salían de ~1 px. `PointsMaterial` con atenuación calcula
    `tamaño × (alto/2) / distancia` y NO divide por `tan(fov/2)`, así que un
    tamaño «en unidades de mundo» sale entre 2,5 y 3 veces más pequeño de lo
    que dice. Se corrige en el shader con `projectionMatrix[1][1]`, que es
    justo `1/tan(fov/2)` — y sigue siendo correcto si cambia el fov. Y eran
    CUADRADOS: `PointsMaterial` dibuja cuadrados si no se le da textura; aquí
    se recortan a círculo en el fragment, sin textura que cargar ni liberar.

  Todos terminan con `tonemapping` y `colorspace`, que un `ShaderMaterial` no
  añade solo. Sin ellos el color sale en lineal leído como sRGB —más oscuro y
  más saturado que el hex que eligió la persona—, que es lo que le pasaba al
  halo antes.
*/

/** La luz del planeta, en espacio de cámara. La misma en los tres shaders. */
const LUZ = 'normalize( vec3( -0.45, 0.6, 0.65 ) )';

const VERTEX_ESFERA = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vNormal = normalize( normalMatrix * normal );
    vec4 mv = modelViewMatrix * vec4( position, 1.0 );
    vView = normalize( -mv.xyz );
    gl_Position = projectionMatrix * mv;
  }
`;

/**
 * El planeta: color del tema, sombreado suave y un borde que ya tiñe del color
 * del halo, para que planeta y atmósfera se fundan en vez de cortarse.
 *
 * El lado en sombra no baja de ~55%: un globo con media cara negra deja de
 * leerse como mapa justo donde hay datos.
 */
export function globeBodyMaterial(base: string, glow: string): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uBase: { value: new Color(base) },
      uGlow: { value: new Color(glow) },
    },
    vertexShader: VERTEX_ESFERA,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase;
      uniform vec3 uGlow;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec3 n = normalize( vNormal );
        vec3 v = normalize( vView );
        vec3 l = ${LUZ};

        float lambert = max( dot( n, l ), 0.0 );
        float facing = max( dot( n, v ), 0.0 );

        vec3 color = uBase * ( 0.55 + 0.6 * lambert );
        /* Un poco del color del halo en la cara iluminada: en un tema oscuro
           el planeta es casi negro y multiplicar casi-negro no da volumen. */
        color += uGlow * lambert * 0.07;
        /* El borde, del color de la atmósfera. */
        color = mix( color, uGlow, pow( 1.0 - facing, 3.0 ) * 0.6 );
        /* Un brillo pequeño arriba a la izquierda: lo que hace que una esfera
           se lea como esfera y no como círculo sombreado. */
        float brillo = pow( max( dot( reflect( -l, n ), v ), 0.0 ), 64.0 );
        color += vec3( brillo * 0.03 );

        gl_FragColor = vec4( color, 1.0 );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * El halo: una esfera mayor vista por dentro.
 *
 * Para cada fragmento se calcula a qué distancia del centro cae EN PANTALLA
 * (`sqrt(1 − (n·v)²)` en radios de halo) y la opacidad baja desde el contorno
 * del planeta hasta cero en el borde del halo. Dentro del contorno no se ve: lo
 * tapa el planeta, que escribe profundidad.
 *
 * @param inner El radio del planeta en radios de halo (1 / 1,18).
 */
export function globeGlowMaterial(glow: string, inner: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(glow) },
      uInner: { value: inner },
    },
    transparent: true,
    depthWrite: false,
    side: BackSide,
    vertexShader: VERTEX_ESFERA,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uInner;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float d = abs( dot( normalize( vNormal ), normalize( vView ) ) );
        float r = sqrt( max( 1.0 - d * d, 0.0 ) );
        float t = clamp( ( r - uInner ) / ( 1.0 - uInner ), 0.0, 1.0 );
        gl_FragColor = vec4( uColor, pow( 1.0 - t, 2.4 ) * 0.62 );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * Los puntos de tierra. Un `PointsMaterial` de three con tres retoques por
 * `onBeforeCompile`: tamaño de verdad en unidades de mundo, recorte a círculo,
 * y la misma luz que el planeta — con los puntos del limbo apagándose, que es
 * lo que da la curvatura en vez de un borde de puntos amontonados.
 *
 * @param size Diámetro del punto en unidades de mundo (radio del globo = 1).
 */
export function globeLandMaterial(land: string, size: number): PointsMaterial {
  const material = new PointsMaterial({
    color: land,
    size,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
  });

  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'varying float vShade;\nvarying float vFade;\n' +
      shader.vertexShader
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vec3 globeN = normalize( normalMatrix * position );
          vec3 globeV = normalize( -mvPosition.xyz );
          vShade = 0.62 + 0.5 * max( dot( globeN, ${LUZ} ), 0.0 );
          vFade = smoothstep( 0.0, 0.42, dot( globeN, globeV ) );`,
        )
        .replace(
          'gl_PointSize *= ( scale / - mvPosition.z );',
          'gl_PointSize *= ( scale / - mvPosition.z ) * projectionMatrix[ 1 ][ 1 ];',
        );

    shader.fragmentShader =
      'varying float vShade;\nvarying float vFade;\n' +
      shader.fragmentShader.replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `float globeR = length( gl_PointCoord - 0.5 );
        if ( globeR > 0.5 ) discard;
        vec4 diffuseColor = vec4(
          diffuse * vShade,
          opacity * vFade * smoothstep( 0.5, 0.36, globeR )
        );`,
      );
  };
  /* Un programa propio: sin esto three podría reutilizar el de otro
     `PointsMaterial` sin los retoques. */
  material.customProgramCacheKey = () => 'volumine-globe-land';

  return material;
}
