import {
  ACESFilmicToneMapping,
  Box3,
  Color,
  CylinderGeometry,
  RingGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MathUtils,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SphereGeometry,
  AdditiveBlending,
  BackSide,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Raycaster,
  Scene,
  ShadowMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  type WebGLRenderTarget,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ResolvedChartConfig } from '@/lib/config/defaults';
import { fitShadowVolume } from './shadow-volume';
import {
  computeSectors,
  curveSegmentsFor,
  globalBevel,
  sectorDirection,
  sectorGeometry,
  OUTER_RADIUS,
  type Sector,
} from '../geometry/donut';
import { computeGauge } from '../geometry/gauge';
import {
  barGeometry,
  barRadii,
  computeBars,
  cornerSegmentsFor,
  PLOT_WIDTH,
} from '../geometry/bar';
import { roundedBoxGeometry } from '../geometry/rounded-box';
import {
  DEFAULT_FRAME_MS,
  MAX_VISIBLE,
  frameAt,
  placementsFor,
  valuesAt,
} from '../geometry/bar-race';
import { GLOBE_RADIUS, computeMarkers, landPointsGeometry } from '../geometry/globe';
import { colorForSegment, createMaterial } from './materials';
import { createLabelLayer, type LabelAnchor } from './label-layer';

/*
  El renderer de Volumine, en three plano. Sin React (ADR 0006).

  Es UNA sola implementación de la escena: la usan el embed y el editor. Eso es
  lo que garantiza por construcción que "mismo config, mismos píxeles" siga
  siendo cierto, que es de lo que dependen el render estático y los tests
  visuales.

  Responsabilidad del que lo monta: llamar a `dispose()`. Aquí se crea un
  contexto WebGL, y un navegador solo aguanta entre 8 y 16 a la vez.
*/

type CameraPlacement = { polar: number; azimuth: number; distance: number };

const CAMERA_PRESETS: Record<string, CameraPlacement> = {
  hero: { polar: 62, azimuth: -35, distance: 1 },
  top: { polar: 5, azimuth: 0, distance: 0.95 },
  front: { polar: 82, azimuth: 0, distance: 1.15 },
  isometric: { polar: 54.7, azimuth: -45, distance: 1.05 },
};

/**
 * Encuadres propios de las barras.
 *
 * El anillo es redondo y le da igual el azimut. Una fila de barras no: desde
 * −35° la fila se ve en diagonal, las barras se tapan entre ellas y comparar
 * alturas —que es TODO lo que hace una barra— se vuelve difícil. Casi de frente.
 *
 * La distancia no está aquí: las barras se encuadran midiendo lo que ocupan
 * (`fitDistance`), porque su alto va de 0,16 a 3,2 según `style.height` y un
 * radio fijo se sale de plano por arriba en la mitad del rango.
 */
const BAR_CAMERA_PRESETS: Record<string, CameraPlacement> = {
  hero: { polar: 68, azimuth: -16, distance: 1 },
  isometric: { polar: 58, azimuth: -32, distance: 1 },
};

/**
 * Con más de una serie hay una fila detrás de otra, y casi de frente la de
 * delante tapa la de detrás entera. Hay que subir y abrir: desde arriba las
 * filas se separan en pantalla, y con más azimut se ven las dos caras. Se pierde
 * algo de precisión al comparar alturas, pero ver una barra mal es mejor que no
 * verla.
 */
const BAR_CAMERA_MULTI: Record<string, CameraPlacement> = {
  hero: { polar: 52, azimuth: -30, distance: 1 },
  isometric: { polar: 48, azimuth: -38, distance: 1 },
};

/** Amplitud del vaivén de una gráfica de barras, en grados. Ver el bucle. */
const BAR_SWAY_DEGREES = 13;

/**
 * Zona de captura de un marcador del globo, en radios de globo.
 *
 * Un marcador pequeño mide cuatro píxeles en pantalla, y pedirle a alguien que
 * acierte cuatro píxeles con el ratón —sobre una esfera que además gira— es
 * pedirle que juegue a un juego de puntería. El área sensible es MAYOR que el
 * punto dibujado: se apunta al sitio, no al píxel.
 *
 * Es el mismo criterio que el mínimo de 24 px de zona táctil en una interfaz, y
 * por eso hay un suelo absoluto además del múltiplo: si solo se multiplicara el
 * radio, el marcador más pequeño seguiría siendo imposible de coger.
 */
const MARKER_HIT_SCALE = 2.4;
const MARKER_HIT_FLOOR = 0.055;

/* Ejes de referencia para orientar las piezas del globo. Un cilindro de three
   nace apuntando a +Y y un anillo mira a +Z; para tumbarlos sobre la normal de
   su punto hace falta saber de dónde parten. */
const UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3(0, 0, 1);

/** Reutilizados en el raycast, que corre en cada frame. */
const hitCenter = new Vector3();
const hitCameraDir = new Vector3();

/**
 * Hace que un marcador se pueda señalar apuntando a su alrededor.
 *
 * Sustituye el raycast de la malla por una prueba de distancia del rayo al
 * centro, con un radio mayor que el dibujado. Y descarta los marcadores de la
 * cara de atrás: el rayo atraviesa el globo y sin este filtro se señalarían
 * ciudades que están literalmente al otro lado del planeta.
 */
function makeMarkerEasyToHit(mesh: Mesh, radius: number) {
  const hitRadius = Math.max(radius * MARKER_HIT_SCALE, MARKER_HIT_FLOOR);

  mesh.raycast = (raycaster, intersects) => {
    hitCenter.setFromMatrixPosition(mesh.matrixWorld);

    /* ¿Está en la cara que se ve? El centro del globo es el origen del grupo, y
       la malla está en la superficie: si su dirección desde el centro no apunta
       hacia la cámara, está detrás del planeta. */
    hitCameraDir.copy(raycaster.ray.origin).sub(mesh.parent!.position);
    if (hitCenter.clone().sub(mesh.parent!.position).dot(hitCameraDir) <= 0) return;

    if (raycaster.ray.distanceSqToPoint(hitCenter) > hitRadius * hitRadius) return;

    intersects.push({
      distance: raycaster.ray.origin.distanceTo(hitCenter),
      point: hitCenter.clone(),
      object: mesh,
    });
  };
}

/** Caja que ocupa lo dibujado, centrada en el eje Y. Para encuadrar. */
type PlotBox = { width: number; height: number; depth: number };

/**
 * Aire alrededor de la gráfica al encuadrarla. 1 = pegada al borde.
 *
 * No es solo estética: cuanto más cerca está la cámara, más se abren las barras
 * de los extremos y peor se comparan sus alturas, que es lo único que hace una
 * barra. Este valor es lo más cerca que se puede estar sin que la fila se abanique.
 */
const FIT_MARGIN = 1.3;

/**
 * A qué distancia del centro de la caja hay que ponerse para que quepa entera.
 *
 * Se resuelve proyectando las ocho esquinas y corrigiendo: el error de la
 * estimación es casi lineal en 1/distancia, así que converge en tres o cuatro
 * pasos. Hacerlo con trigonometría a mano obliga a inventarse un factor para la
 * perspectiva —las esquinas de delante se agrandan— y ese factor siempre falla
 * en algún caso; esto no falla en ninguno.
 */
const fitProbe = new PerspectiveCamera();
const fitCorners = Array.from({ length: 8 }, () => new Vector3());
const fitPoint = new Vector3();

function fitDistance(
  box: PlotBox,
  camera: PerspectiveCamera,
  target: Vector3,
  direction: Vector3,
): number {
  let corner = 0;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        fitCorners[corner++].set(
          target.x + (sx * box.width) / 2,
          target.y + (sy * box.height) / 2,
          target.z + (sz * box.depth) / 2,
        );
      }
    }
  }

  fitProbe.fov = camera.fov;
  fitProbe.aspect = camera.aspect;
  fitProbe.near = camera.near;
  fitProbe.far = camera.far;
  fitProbe.updateProjectionMatrix();

  const wanted = 1 / FIT_MARGIN;
  let distance = Math.max(box.width, box.height, box.depth) * 1.5 + 0.5;

  for (let pass = 0; pass < 5; pass++) {
    fitProbe.position.copy(direction).multiplyScalar(distance).add(target);
    fitProbe.lookAt(target);
    fitProbe.updateMatrixWorld();

    let worst = 0;
    for (const point of fitCorners) {
      fitPoint.copy(point).project(fitProbe);
      worst = Math.max(worst, Math.abs(fitPoint.x), Math.abs(fitPoint.y));
    }

    if (worst <= 0 || Math.abs(worst - wanted) < 0.004) break;
    distance *= worst / wanted;
  }

  return distance;
}

/**
 * Lo que se sabe de la pieza señalada, sin hablar de sectores ni de barras.
 *
 * Antes era el `Sector` entero, y eso ataba el tooltip a la geometría del
 * anillo: al llegar las barras no había nada que pasarle.
 */
export type HoverInfo = {
  /** Índice en `data.labels`. */
  index: number;
  label: string;
  value: number;
  /** Fracción del total, 0..1. `null` si el tipo no reparte un total. */
  fraction: number | null;
  /** Nombre de la serie. `null` cuando solo hay una. */
  series: string | null;
  /**
   * Este dato YA tiene su etiqueta escrita y visible en pantalla.
   *
   * Existe para que el anfitrión no repita en un tooltip lo que ya se está
   * leyendo al lado de la pieza. Lo decide el renderer y no el anfitrión porque
   * es el único que sabe qué etiquetas ha llegado a dibujar: con muchas
   * categorías algunas se descartan por falta de sitio, y esas SÍ necesitan
   * tooltip.
   */
  labelled: boolean;
} | null;

export type ChartRendererHandle = {
  /** Reemplaza el config. Reconstruye solo lo que de verdad haya cambiado. */
  update(config: ResolvedChartConfig): void;
  /** Libera geometrías, materiales, entorno y el contexto WebGL. */
  dispose(): void;
  onHover(callback: (info: HoverInfo) => void): void;
  /**
   * Avisa del periodo que se está mostrando en una carrera. `null` en el resto
   * de tipos. El texto lo pinta el anfitrión en HTML: en el bundle no hay
   * fuentes que dibujar en 3D, y en HTML se lee más nítido.
   */
  onFrame(callback: (label: string | null) => void): void;
  /** Un frame a mano, para capturas y tests visuales. */
  renderOnce(): void;
  /**
   * La escena tal y como se ve ahora, en PNG.
   *
   * Dibuja y lee el canvas EN LA MISMA VUELTA, sin ceder al navegador entre
   * medias. Es lo que permite no activar `preserveDrawingBuffer`, que obliga a
   * la GPU a conservar el buffer de cada frame y cuesta rendimiento en TODOS
   * los embeds para algo que se usa una vez al guardar.
   */
  capture(): string;
};

/* Lo que se GUARDA de cada pieza. `labelled` no está aquí a propósito: no es un
   dato de la pieza sino del momento —depende de si su etiqueta ha cabido en
   pantalla ahora mismo— y se calcula al emitir el hover. */
type PieceInfo = Omit<NonNullable<HoverInfo>, 'labelled'>;

type Piece = {
  info: PieceInfo;
  mesh: Mesh;
  /** Sitio de la pieza en el grupo. El realce y el explode se suman a esto. */
  base: Vector3;
  /** Hacia dónde se aparta al realzarla. Nula si el realce es solo vertical. */
  direction: Vector3;
  hoverAmount: number;
  /** Cómo responde al puntero. Un punto del globo crece; el resto se levanta. */
  hoverStyle: 'lift' | 'grow';
  /**
   * De dónde sale la línea guía de su etiqueta, en coordenadas locales del
   * grupo. `null` en los tipos que todavía no tienen etiquetas.
   */
  anchor: Vector3 | null;
  /** Centro alrededor del cual la etiqueta puede quedar oculta. Solo el globo. */
  occludeAround?: Vector3;
};

function cameraPlacement(config: ResolvedChartConfig): CameraPlacement {
  if (config.camera.preset === 'custom') {
    return { polar: config.camera.polar, azimuth: config.camera.azimuth, distance: 1 };
  }
  /* La carrera se encuadra como una fila de barras: es una fila de barras. Pero
     nunca con el preset de varias series, porque sus series son periodos que se
     ven de uno en uno, no filas que compitan por el espacio. */
  /* El medidor se mira SIEMPRE de frente en azimut. Con los −35° del encuadre
     normal, el hueco de abajo —que es el cero de la escala— se va a las diez y
     media en pantalla, y el dibujo deja de decir por dónde empieza a contarse.
     El anillo puede permitírselo porque le da igual dónde tenga el corte; a este
     no, porque su corte significa algo. El preset `custom` ya ha salido arriba:
     ahí manda el azimut que haya pedido quien monta la gráfica. */
  if (config.type === 'gauge') {
    return {
      ...(CAMERA_PRESETS[config.camera.preset] ?? CAMERA_PRESETS.hero),
      azimuth: 0,
    };
  }

  const bars =
    config.type === 'bar' || config.type === 'bar-race' ? BAR_CAMERA_PRESETS : null;
  const stacked = config.type === 'bar' && config.data.series.length > 1;
  const byType = bars
    ? (stacked ? BAR_CAMERA_MULTI : bars)[config.camera.preset]
    : undefined;

  return byType ?? CAMERA_PRESETS[config.camera.preset] ?? CAMERA_PRESETS.hero;
}

/** Vector unitario hacia la cámara, desde lo que mira. */
function cameraDirection(config: ResolvedChartConfig): Vector3 {
  const preset = cameraPlacement(config);
  const polar = MathUtils.degToRad(preset.polar);
  const azimuth = MathUtils.degToRad(preset.azimuth);

  return new Vector3(
    Math.sin(polar) * Math.sin(azimuth),
    Math.cos(polar),
    Math.sin(polar) * Math.cos(azimuth),
  );
}

function cameraPosition(config: ResolvedChartConfig): Vector3 {
  const preset = cameraPlacement(config);

  const polar = MathUtils.degToRad(preset.polar);
  const azimuth = MathUtils.degToRad(preset.azimuth);
  const radius = 4.2 * preset.distance * config.camera.distance;

  return new Vector3(
    radius * Math.sin(polar) * Math.sin(azimuth),
    radius * Math.cos(polar),
    radius * Math.sin(polar) * Math.cos(azimuth),
  );
}

/** Clave de lo que obliga a regenerar la geometría. Nada más la regenera. */
/**
 * Qué obliga a reconstruir la escena.
 *
 * Se serializa TODO `data` y TODO `style` salvo lo que se aplica por frame.
 *
 * Antes esto era una lista de campos escrita a mano, y esa lista se quedaba
 * corta con cada tipo nuevo: el globo llegó con `data.coords` y con
 * `style.globe`, ninguno de los dos estaba enumerado, y el resultado era que
 * cambiar una coordenada o mover el slider de densidad no repintaba nada. No
 * daba error: simplemente no pasaba nada, que es el peor fallo posible.
 *
 * Enumerar lo que NO entra es una lista corta y estable —lo que se aplica en el
 * bucle o al colocar la cámara—; enumerar lo que sí entra crece con cada tipo y
 * alguien acaba olvidándose.
 */
function buildKey(config: ResolvedChartConfig): string {
  /* `explode` mueve las piezas en el bucle, no cambia su forma: incluirlo
     reconstruiría el globo entero —29.000 muestras— en cada paso del slider. */
  const { explode: _explode, ...style } = config.style;

  /* El único material que se elige mirando la ESCENA y no el estilo: el fondo
     de escala del medidor en modo `auto` se aclara u oscurece según el fondo de
     la página. Sin esto, cambiar el fondo dejaría el gris del anterior —el
     mismo fallo silencioso que tuvo el globo, y por eso está anotado aquí. */
  const sceneTint =
    config.type === 'gauge' && config.style.gauge.trackColor === 'auto'
      ? config.scene.background
      : null;

  return JSON.stringify([config.type, config.data, style, sceneTint]);
}

/*
  ══════════════════════════════════════════════════════════════════════════
  CUÁNTOS PÍXELES DE VERDAD SE DIBUJAN
  ══════════════════════════════════════════════════════════════════════════

  Antes era `min(devicePixelRatio, 2)`, que es lo razonable en una página
  normal y falla en un editor de lienzo. En Canva la gráfica se veía borrosa,
  y la causa está medida: el embed se maqueta a 400×225 y el lienzo entero se
  amplía con `transform: scale()`. El canvas se dibuja a 400×225 y se ESTIRA a
  800×450.

  Y no se puede detectar. Se probó: dentro del iframe, `getBoundingClientRect`
  devuelve el tamaño SIN escalar, porque la transformación vive en el
  documento padre y el iframe tiene su propio sistema de coordenadas.
  `devicePixelRatio` tampoco se entera. No hay señal que leer.

  Así que en vez de adivinar la escala, se dibuja con densidad suficiente para
  aguantar un zoom razonable — y con un tope, porque el coste de rellenar es
  proporcional a los píxeles y esto corre en el móvil de otra persona:

    · un mínimo de píxeles TOTALES, que solo sube la densidad cuando el hueco
      es pequeño (que es justo el caso del lienzo, y donde ampliar es barato);
    · un tope de densidad, para no pasarse en una pantalla ya densa;
    · un tope de píxeles totales, que es el que impide que un embed a pantalla
      completa en un portátil flojo se ponga a rellenar cuatro veces más.

  Un hueco de 400×225 pasa de 90.000 píxeles a 810.000 — nada para una GPU— y
  aguanta que lo amplíen al triple sin verse blando. Uno de 1200×675 apenas se
  mueve, porque ya tenía densidad de sobra.
*/
const MIN_PIXELES = 1_200_000;
const MAX_PIXELES = 4_000_000;
const MAX_DENSIDAD = 3;

function pixelRatioPara(width: number, height: number): number {
  const area = Math.max(1, width * height);
  const dpr = window.devicePixelRatio || 1;

  /* Nunca por debajo de lo que pide la pantalla, ni por debajo de lo que hace
     falta para aguantar una ampliación. */
  const querido = Math.max(dpr, Math.sqrt(MIN_PIXELES / area));
  const porArea = Math.sqrt(MAX_PIXELES / area);

  return Math.max(1, Math.min(querido, MAX_DENSIDAD, porArea));
}


export function createChartRenderer(
  canvas: HTMLCanvasElement,
  initialConfig: ResolvedChartConfig,
): ChartRendererHandle {
  let config = initialConfig;
  const container = canvas.parentElement ?? canvas;

  const transparent = () => config.scene.background.kind === 'transparent';

  const renderer = new WebGLRenderer({
    canvas,
    antialias: window.devicePixelRatio < 2,
    alpha: true,
    // El embed puede compartir página con otros widgets: no acaparamos la GPU.
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(pixelRatioPara(1, 1));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = config.style.shadow;
  /*
    `PCFShadowMap` y no `PCFSoftShadowMap`, que era lo que había.

    Los dos difuminan; la diferencia es que el «soft» usa un núcleo FIJO de un
    téxel e IGNORA `shadow.radius`. Mientras el volumen de sombra era fijo eso
    daba igual, porque el téxel medía siempre lo mismo. Al ceñir el volumen el
    téxel se hizo pequeño, y el desenfoque encogió con él: la sombra salió más
    definida y con el borde duro.

    Este respeta `radius`, así que el desenfoque se puede pedir en unidades DEL
    MUNDO y sale igual de suave con cualquier gráfica. Ver `suavizarSombra()`.
  */
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  const camera = new PerspectiveCamera(config.camera.fov, 1, 0.1, 100);

  /* Iluminación basada en imagen, generada por procedimiento. RoomEnvironment
     viene dentro de three y se calcula en el cliente: cero peticiones de red,
     que es innegociable en el embed (ADR 0005). */
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  let envTarget: WebGLRenderTarget | null = pmrem.fromScene(room, 0.04);
  scene.environment = envTarget.texture;

  const key = new DirectionalLight(0xffffff, 1.1);
  key.position.set(2.6, 4.2, 2.2);
  key.shadow.mapSize.set(1024, 1024);
  /* El volumen se recalcula en `fitShadowCamera()` cada vez que cambia lo que
     hay. Estos valores solo tienen que ser válidos para el primer fotograma. */
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 14;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.bias = -0.0012;
  scene.add(key);

  const floorGeometry = new PlaneGeometry(24, 24);
  const floorMaterial = new ShadowMaterial({ opacity: 0.34 });
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.001;
  floor.receiveShadow = true;
  scene.add(floor);

  const group = new Group();
  scene.add(group);

  /*
    Plano de cero. Solo aparece cuando hay valores negativos, y entonces es
    obligatorio: una barra negativa cuelga de la línea de cero, y sin esa línea
    dibujada lo que se ve es una barra corta flotando. El primer render de
    negativos era exactamente eso.

    Gris, no un color del tema —es una guía, no un dato—, y con el tono elegido
    según el fondo: sobre papel tiene que oscurecer y sobre negro aclarar, o no
    se ve. Con fondo transparente no sabemos qué hay detrás y se usa un gris
    medio, que es lo único que funciona en los dos casos.

    Material sin iluminación a propósito: si le diera la luz, competiría con las
    barras.

    Se crea UNA vez y se reposiciona; nada de geometrías nuevas por build.
  */
  const zeroPlaneGeometry = new PlaneGeometry(1, 1);
  const zeroPlaneMaterial = new MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  const zeroPlane = new Mesh(zeroPlaneGeometry, zeroPlaneMaterial);
  zeroPlane.rotation.x = -Math.PI / 2;
  zeroPlane.visible = false;
  // Invisible al puntero: si no, tapa el hover de las barras que hay detrás.
  zeroPlane.raycast = () => {};
  group.add(zeroPlane);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;

  let userMovedCamera = false;
  controls.addEventListener('start', () => {
    userMovedCamera = true;
  });

  let pieces: Piece[] = [];
  let currentKey = '';

  /* La capa de etiquetas la monta el RENDERER y no la página: es lo que hace
     que el editor y el embed enseñen lo mismo sin ponerse de acuerdo. Ver
     label-layer.ts. */
  const labelLayer = createLabelLayer(container);

  /* Qué obliga a rehacer el DOM de las etiquetas SIN tocar la geometría:
     encenderlas, cambiar de modo, pedir el porcentaje, cambiar la unidad. Sin
     esto habría que elegir entre rehacerlas en cada frame —decenas de nodos por
     segundo mientras se arrastra un slider— o que no se enteraran. */
  const labelsKeyOf = (c: ResolvedChartConfig) => JSON.stringify([c.labels, c.data.format]);
  let labelsKey = '';

  // Reutilizables: crear objetos por frame es presión de GC y tirones.
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const tmpVector = new Vector3();

  let pointerInside = false;
  let hovered: Piece | null = null;
  let hoverCallback: ((info: HoverInfo) => void) | null = null;

  /* La etiqueta del periodo de una carrera sale por aquí, no se dibuja en 3D.
     El bundle no lleva ninguna fuente —ni puede, por presupuesto— así que el
     texto lo pinta el anfitrión en HTML, que además se lee más nítido. */
  let frameCallback: ((label: string | null) => void) | null = null;

  function disposePieces() {
    for (const piece of pieces) {
      group.remove(piece.mesh);
      piece.mesh.geometry.dispose();
      (piece.mesh.material as Material).dispose();
    }
    pieces = [];
    hovered = null;
  }

  /** Lo que ocupa el sólido que hay en el grupo. Para encuadrar y para orbitar. */
  let plotBox: PlotBox = { width: 0, height: 0, depth: 0 };

  function addPiece(
    geometry: BufferGeometry,
    colorIndex: number,
    info: PieceInfo,
    base: Vector3,
    direction: Vector3,
    /**
     * `color` salta la paleta, y `inert` deja la pieza fuera del ratón. Las dos
     * son para el fondo de escala del medidor: no es un dato, es el hueco que
     * falta por llenar, así que ni gasta un color de la paleta ni tiene tooltip.
     * Sigue en `pieces` para que se libere con todo lo demás.
     */
    options: { color?: string; inert?: boolean; anchor?: Vector3 } = {},
  ) {
    const material = createMaterial(
      config,
      options.color ?? colorForSegment(config, colorIndex),
    );
    const mesh = new Mesh(geometry, material);
    mesh.position.copy(base);
    mesh.castShadow = config.style.shadow;
    mesh.receiveShadow = config.style.shadow;
    if (options.inert) mesh.raycast = () => {};

    group.add(mesh);
    pieces.push({
      info,
      mesh,
      base,
      direction,
      hoverAmount: 0,
      hoverStyle: 'lift',
      anchor: options.anchor ?? null,
    });
  }

  function buildRing() {
    const { innerRadius, height, gap, bevel } = config.style;
    const innerR = innerRadius * OUTER_RADIUS;
    const values = config.data.series[0]?.values ?? [];
    const sectors = computeSectors(values, gap);
    plotBox = { width: OUTER_RADIUS * 2, height, depth: OUTER_RADIUS * 2 };
    if (sectors.length === 0) return;

    const limits = {
      innerR,
      outerR: OUTER_RADIUS,
      depth: height,
      gapAngle: gap * Math.PI * 2,
    };
    // UN SOLO bevel para todo el donut: por sector, las juntas no casan.
    const bevelAbs = globalBevel(sectors, limits, bevel);

    for (const sector of sectors) {
      addPiece(
        sectorGeometry({
          sector,
          innerR,
          outerR: OUTER_RADIUS,
          depth: height,
          bevel: bevelAbs,
          curveSegments: curveSegmentsFor(sector),
        }),
        sector.index,
        {
          index: sector.index,
          label: config.data.labels[sector.index] ?? '',
          value: values[sector.index] ?? 0,
          fraction: sector.fraction,
          series: null,
        },
        new Vector3(0, 0, 0),
        sectorDirection(sector),
        {
          /* La línea guía sale del BORDE EXTERIOR, a media altura del canto.
             Del centro del sector saldría desde debajo de la propia pieza y la
             línea se vería atravesarla. */
          anchor: sectorDirection(sector)
            .clone()
            .multiplyScalar(OUTER_RADIUS)
            .setY(height / 2),
        },
      );
    }
  }

  /*
    MEDIDOR
    -------
    El mismo sólido que el anillo, otro reparto del arco (geometry/gauge.ts). No
    hay geometría nueva: si mañana mejora el canto redondeado, mejora aquí solo.

    Dos cosas propias. Una, el FONDO DE ESCALA: la parte que falta para llegar al
    tope, en gris. Sin ella un 30% y un 90% se distinguen, pero no se sabe sobre
    qué — el hueco vacío es el que dice cuánto cabía. Dos, la CIFRA DEL CENTRO,
    que la pinta el anfitrión en HTML (ver `onValue`), porque el bundle no lleva
    fuentes ni puede llevarlas.
  */
  function trackColor(): string {
    if (config.style.gauge.trackColor !== 'auto') return config.style.gauge.trackColor;
    /*
      El fondo tiene que verse y no competir. Es un sólido con la misma luz y el
      mismo canto que el dato, así que en cuanto sube de tono pesa lo mismo que
      él y el medidor se lee como un anillo de dos trozos: se pierde de un
      vistazo cuál es la cifra y cuál el hueco.

      Sobre fondo transparente no sabemos qué hay detrás, y un gris medio-oscuro
      es el único que se sostiene contra blanco y contra negro.
    */
    if (transparent()) return '#5c5c6b';
    const bg = new Color(config.scene.background.from);
    const light = 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b > 0.2;
    return light ? '#cfcfdb' : '#33333f';
  }

  function buildGauge() {
    const { innerRadius, height, gap, bevel, gauge } = config.style;
    const innerR = innerRadius * OUTER_RADIUS;
    const values = config.data.series[0]?.values ?? [];
    const layout = computeGauge(values, {
      max: gauge.max,
      sweepDegrees: gauge.sweep,
      gapTurns: gap,
    });

    plotBox = { width: OUTER_RADIUS * 2, height, depth: OUTER_RADIUS * 2 };

    const limits = {
      innerR,
      outerR: OUTER_RADIUS,
      depth: height,
      gapAngle: gap * Math.PI * 2,
    };
    /* El fondo entra en el cálculo del canto igual que los demás trozos: si se
       quedara fuera, con un 3% lleno tendría un canto más grueso que el dato y
       parecería que el fondo está por encima. */
    const all = layout.track ? [...layout.sectors, layout.track] : layout.sectors;
    const bevelAbs = globalBevel(all, limits, bevel);

    const piece = (sector: Sector, options: { color?: string; inert?: boolean } = {}) =>
      addPiece(
        sectorGeometry({
          sector,
          innerR,
          outerR: OUTER_RADIUS,
          depth: height,
          bevel: bevelAbs,
          curveSegments: curveSegmentsFor(sector),
        }),
        sector.index,
        {
          index: sector.index,
          label: config.data.labels[sector.index] ?? '',
          value: values[sector.index] ?? 0,
          /* Contra el TOPE, no contra la suma. En un anillo «32%» quiere decir
             32% de lo que hay; en un medidor, 32% de lo que cabe. */
          fraction: gauge.max > 0 ? (values[sector.index] ?? 0) / gauge.max : null,
          series: null,
        },
        new Vector3(0, 0, 0),
        sectorDirection(sector),
        options,
      );

    for (const sector of layout.sectors) piece(sector);
    if (layout.track && gauge.track) {
      piece(layout.track, { color: trackColor(), inert: true });
    }
  }

  function buildBars() {
    const { height, gap, bevel, cornerRadius } = config.style;
    const layout = computeBars(
      config.data.series.map((serie) => serie.values),
      { gap, height },
    );
    plotBox = { width: PLOT_WIDTH, height: layout.totalHeight, depth: layout.totalDepth };
    if (layout.bars.length === 0) return;

    /* Sobresale un poco de la parrilla: una línea que acaba justo donde acaba la
       última barra no se lee como referencia, se lee como parte de la barra. */
    zeroPlane.visible = layout.baseline > 0;
    zeroPlane.scale.set(PLOT_WIDTH * 1.08, layout.totalDepth * 1.12, 1);
    /* Un pelo por encima del cero: la cara superior de una barra negativa acaba
       exactamente ahí, y coplanares se pelean por el mismo píxel. */
    zeroPlane.position.y = layout.baseline + 0.004;

    const cornerSegments = cornerSegmentsFor(layout.bars.length);
    const multi = config.data.series.length > 1;

    for (const bar of layout.bars) {
      addPiece(
        barGeometry({
          height: bar.height,
          layout,
          style: { bevel, cornerRadius },
          cornerSegments,
        }),
        bar.colorIndex,
        {
          index: bar.index,
          label: config.data.labels[bar.index] ?? '',
          value: bar.value,
          fraction: bar.fraction,
          series: multi ? (config.data.series[bar.series]?.name ?? null) : null,
        },
        new Vector3(bar.x, bar.y, bar.z),
        /* Sin dirección: una barra realzada sube, no se aparta. Apartarla la
           sacaría de su celda y dejaría de estar donde dice su categoría. */
        new Vector3(0, 0, 0),
        {
          /*
            La etiqueta va BAJO la barra, no encima.

            Encima tendría que esquivar una altura que cambia con el dato, y con
            dos barras muy desiguales las etiquetas quedarían a alturas
            distintas — se leerían como si dijeran algo sobre el valor. Abajo
            todas están en la misma línea, que es lo que hace un eje.

            Se ancla en la CARA DELANTERA de la base (media profundidad hacia la
            cámara). Desde el centro de la barra, la propia barra tapa el punto
            en cuanto la escena se inclina, y la etiqueta parecería flotar
            detrás. Al ir en el plano de la base y no en pantalla, hereda la
            perspectiva: la fila de nombres se inclina con la gráfica, que es
            justo el efecto de una gráfica 3D bien hecha.
          */
          anchor: new Vector3(
            bar.x,
            layout.baseline,
            bar.z + Math.max(layout.width, 0.05) / 2,
          ),
        },
      );
    }
  }

  /*
    BARRAS ANIMADAS
    ---------------
    Una pieza por CATEGORÍA, no por barra: la misma pieza recorre la carrera
    entera cambiando de altura y de sitio. Reconstruirlas cada periodo perdería
    el movimiento, que es justo lo que hay que ver.

    La altura se resuelve escalando en Y y reconstruyendo la geometría solo
    cuando se aleja más de un 4% de la que está construida. Reconstruir cada
    frame asignaría objetos dentro del bucle de render —prohibido por CLAUDE.md—
    y escalar sin más deforma el canto: una barra el doble de alta tendría el
    canto superior el doble de estirado. El 4% no se ve y acota las dos cosas.
  */
  const RACE_REBUILD_TOLERANCE = 0.04;
  type RaceLane = {
    piece: Piece;
    /** Altura con la que está construida su geometría ahora mismo. */
    builtHeight: number;
    /** Hueco en el que está, interpolado. Entero = ya ha llegado. */
    slot: number;
  };
  let raceLanes: RaceLane[] = [];
  let raceElapsed = 0;
  let raceLabel: string | null = null;

  function raceValues() {
    return config.data.series.map((serie) => serie.values);
  }

  function buildRace() {
    raceLanes = [];
    raceElapsed = 0;

    const series = raceValues();
    const categories = config.data.labels.length;
    const shown = Math.min(categories, MAX_VISIBLE);
    const { height, gap, bevel, cornerRadius } = config.style;

    /* La parrilla se calcula con los valores del PRIMER periodo pero con el
       máximo de TODA la carrera: si la escala cambiara en cada periodo, una
       barra podría encoger mientras su valor sube y la carrera mentiría. */
    const layout = computeBars(series, { gap, height });
    /* El fondo que ocupa es el de UNA fila: los periodos se ven de uno en uno,
       no uno detrás de otro como las series de las barras agrupadas. */
    plotBox = {
      width: PLOT_WIDTH,
      height: layout.totalHeight,
      depth: Math.max(layout.width, 0.05),
    };
    if (layout.bars.length === 0 || shown === 0) return;

    const cell = PLOT_WIDTH / shown;
    const air = layout.width > 0 ? 1 - layout.width / (PLOT_WIDTH / categories) : 0.17;
    const width = cell * (1 - air);
    const cornerSegments = cornerSegmentsFor(shown);
    const first = valuesAt(
      series,
      frameAt(0, series.length, [], { frameMs: 1, loop: false }),
      categories,
    );
    const max = Math.max(...series.flat().filter(Number.isFinite), 0);
    const scale = max > 0 ? layout.totalHeight / max : 0;

    config.data.labels.forEach((label, index) => {
      const startHeight = Math.max((first[index] ?? 0) * scale, 1e-3);
      const geometry = roundedBoxGeometry({
        width,
        depth: width,
        height: startHeight,
        cornerSegments,
        ...barRadii(startHeight, { width, depth: width }, { bevel, cornerRadius }),
      });

      addPiece(
        geometry,
        index,
        { index, label, value: first[index] ?? 0, fraction: null, series: null },
        new Vector3(0, 0, 0),
        new Vector3(0, 0, 0),
        {
          /* Se crea aquí pero se MUEVE en cada frame (ver updateRace): en una
             carrera la barra cambia de sitio y de altura constantemente, así que
             una etiqueta fija dejaría de señalar a su barra al primer
             adelantamiento. Es lo que separa este tipo de los demás: aquí
             colocar no basta, hay que seguir. */
          anchor: new Vector3(0, 0, 0),
        },
      );
      raceLanes.push({
        piece: pieces[pieces.length - 1],
        builtHeight: startHeight,
        slot: index,
      });
    });

    raceScale = scale;
    raceCell = cell;
    raceWidth = width;
    raceSegments = cornerSegments;
  }

  let raceScale = 0;
  let raceCell = 0;
  let raceWidth = 0;
  let raceSegments = 8;

  /*
    GLOBO
    -----
    Planteamiento tomado de cobe (cobe.vercel.app): la tierra es una nube de
    PUNTOS, no contornos. Tres objetos que no son datos —planeta, puntos y
    halo— más un marcador por dato, que sí lo es.

    Los tres primeros no responden al ratón: nadie quiere el tooltip de "el
    planeta". Van aparte de `pieces` y se liberan en `disposeGlobe()`.

    Todos los puntos de tierra caben en UNA llamada de dibujo: son un solo
    objeto `Points`, no once mil mallas.
  */
  let globeBody: Mesh | null = null;
  let globeLand: Points | null = null;
  let globeGlow: Mesh | null = null;
  /* Palos de chincheta y anillos de pulso: acompañan a un marcador pero NO son
     datos —no responden al ratón ni tienen tooltip—, así que van aquí y no en
     `pieces`. Si estuvieran en `pieces`, señalar el palo de Madrid abriría el
     tooltip de Madrid desde un sitio que no es Madrid. */
  let globeExtras: Mesh[] = [];
  /** Anillos que laten, con su desfase. Se animan en el bucle. */
  let pulses: { mesh: Mesh; base: number; phase: number }[] = [];

  function disposeGlobe() {
    for (const object of [globeBody, globeLand, globeGlow, ...globeExtras]) {
      if (!object) continue;
      group.remove(object);
      object.geometry.dispose();
      (object.material as Material).dispose();
    }
    globeBody = null;
    globeLand = null;
    globeGlow = null;
    globeExtras = [];
    pulses = [];
  }

  function buildGlobe() {
    const globe = config.style.globe;
    const values = config.data.series[0]?.values ?? [];
    const layout = computeMarkers(values, config.data.coords, { size: globe.markerSize });

    /* Se encuadra por el diámetro más el marcador mayor, y con más aire que el
       resto de tipos: un globo pegado a los bordes deja de leerse como un objeto
       suelto y parece un fondo. */
    /* El halo es una esfera del 1,18 del radio, así que encuadrar solo por el
       globo lo deja cortado por los bordes. */
    const reach = Math.max(GLOBE_RADIUS + layout.largest, GLOBE_RADIUS * 1.18) * 2 * 1.16;
    plotBox = { width: reach, height: reach, depth: reach };

    /* El planeta. Mate y sin recibir el entorno: una esfera lisa y pulida
       refleja el IBL en manchas grandes que parecen suciedad, y aquí lo único
       que tiene que hacer es tapar los puntos de la cara de atrás. */
    globeBody = new Mesh(
      new SphereGeometry(GLOBE_RADIUS, 64, 48),
      new MeshBasicMaterial({ color: globe.base }),
    );
    globeBody.raycast = () => {};
    group.add(globeBody);

    /* Los puntos de tierra, justo encima de la superficie. Sin iluminar: en cobe
       el mapa es color plano, y es lo que mantiene el dibujo legible cuando el
       globo gira y media esfera queda en sombra. */
    globeLand = new Points(
      landPointsGeometry(globe.density),
      new PointsMaterial({
        color: globe.land,
        /* En unidades de mundo, no de píxel: así el punto crece al acercar el
           zoom y el mapa no se deshace. */
        size: 0.004 + globe.dotSize * 0.016,
        sizeAttenuation: true,
        transparent: true,
        depthWrite: false,
      }),
    );
    globeLand.scale.setScalar(1.004);
    globeLand.raycast = () => {};
    group.add(globeLand);

    /* Halo atmosférico: una esfera mayor vista por dentro, que solo se pinta
       donde el borde mira de canto. Es lo que despega el globo del fondo sin
       necesidad de post-proceso, que no cabe en el presupuesto del embed. */
    globeGlow = new Mesh(
      new SphereGeometry(GLOBE_RADIUS * 1.18, 48, 32),
      new ShaderMaterial({
        uniforms: { uColor: { value: new Color(globe.glow) } },
        transparent: true,
        depthWrite: false,
        side: BackSide,
        blending: AdditiveBlending,
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform vec3 uColor;
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            // Fresnel: opaco de canto, transparente de frente.
            float rim = 1.0 - abs(dot(vNormal, vView));
            gl_FragColor = vec4(uColor, pow(rim, 3.2) * 0.55);
          }`,
      }),
    );
    globeGlow.raycast = () => {};
    group.add(globeGlow);

    if (layout.markers.length === 0) return;

    /* Los marcadores SÍ son datos: mallas propias para que el raycaster y el
       tooltip funcionen igual que en el resto de tipos. Emisivos, para que se
       lean sobre la cara oscura del planeta sin depender de dónde dé la luz. */
    const forma = config.style.globe.marker;

    for (const marker of layout.markers) {
      const color = colorForSegment(config, marker.index);

      /*
        En chincheta la CABEZA tiene un mínimo.

        El radio del marcador es proporcional al valor, así que un dato pequeño
        daba una bola diminuta encima de un palo — se leía como un pincho o una
        flecha, no como una chincheta. La cabeza es el gesto que hace reconocible
        la forma; el dato lo sigue contando el tamaño por encima de ese mínimo.
      */
      const radio =
        config.style.globe.marker === 'pin'
          ? Math.max(marker.radius, GLOBE_RADIUS * 0.026)
          : marker.radius;

      const mesh = new Mesh(
        new SphereGeometry(radio, 18, 14),
        new MeshBasicMaterial({ color }),
      );
      mesh.position.copy(marker.position);

      /*
        CHINCHETA. La bola se despega de la superficie y se une con un palo fino
        hasta el suelo.

        No es adorno: en una esfera, los puntos cerca del limbo se ven de canto y
        se confunden con la silueta del planeta. Levantándolos se recorta contra
        el fondo la bola, y el palo dice exactamente dónde toca — que es el dato.
      */
      if (forma === 'pin') {
        /*
          El palo mide lo mismo para TODOS, medido sobre el planeta y no sobre
          la bola.

          Antes era `marker.radius * 3.4`, o sea proporcional al valor: un dato
          pequeño tenía una bola pequeña Y un palo diminuto, así que el cilindro
          quedaba más corto que la propia bola y se veía como un pincho
          atravesándola en vez de como una chincheta. Además el conjunto crecía
          con el dato dos veces —bola y altura—, exagerando las diferencias.

          Con altura fija, todas las cabezas quedan en el mismo plano sobre la
          superficie, que es lo que hace una chincheta de mapa: la altura no es
          dato, es el gesto de despegarla del suelo.
        */
        const alto = GLOBE_RADIUS * 0.075;
        mesh.position.add(marker.normal.clone().multiplyScalar(alto));

        /* Grosor también fijo y fino, y se hunde un poco EN la superficie para
           que no se vea el corte del cilindro flotando sobre el planeta. */
        const grosor = GLOBE_RADIUS * 0.0095;
        const palo = new Mesh(
          new CylinderGeometry(grosor, grosor, alto * 1.15, 8),
          new MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }),
        );
        // El cilindro nace en Y; se tumba sobre la normal de su punto.
        palo.position
          .copy(marker.position)
          .add(marker.normal.clone().multiplyScalar(alto * 0.5 - alto * 0.075));
        palo.quaternion.setFromUnitVectors(UP, marker.normal);
        palo.raycast = () => {};
        group.add(palo);
        globeExtras.push(palo);
      }

      /*
        PULSO. Un anillo plano, pegado a la superficie y mirando hacia fuera, que
        crece y se desvanece.

        Dice «esto está pasando ahora», que es lo que un punto quieto no puede
        decir. Se anima en el bucle escalando y bajando la opacidad; no se
        reconstruye nada por frame.
      */
      if (forma === 'pulse') {
        const anillo = new Mesh(
          new RingGeometry(marker.radius * 1.5, marker.radius * 1.9, 24),
          new MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.5,
            side: DoubleSide,
            depthWrite: false,
          }),
        );
        anillo.position
          .copy(marker.position)
          .add(marker.normal.clone().multiplyScalar(marker.radius * 0.2));
        anillo.quaternion.setFromUnitVectors(FORWARD, marker.normal);
        anillo.raycast = () => {};
        group.add(anillo);
        globeExtras.push(anillo);
        pulses.push({ mesh: anillo, base: marker.radius, phase: pulses.length * 0.35 });
      }
      makeMarkerEasyToHit(mesh, radio);
      group.add(mesh);

      pieces.push({
        info: {
          index: marker.index,
          label: config.data.labels[marker.index] ?? '',
          value: marker.value,
          fraction: marker.fraction,
          series: null,
        },
        mesh,
        base: marker.position.clone(),
        direction: marker.normal.clone(),
        hoverAmount: 0,
        hoverStyle: 'grow',
        /*
          La etiqueta se ancla POR ENCIMA del marcador, no en él: centrada sobre
          el punto, la píldora taparía justo el punto que está señalando.

          `occludeAround` es el centro del globo en locales, que es el origen del
          grupo. Con él, la capa esconde las etiquetas de la cara de atrás — sin
          eso, media esfera de nombres seguiría flotando sobre el planeta, porque
          el HTML se pinta encima de todo y no lo tapa la geometría.
        */
        anchor: marker.position
          .clone()
          .add(marker.normal.clone().multiplyScalar(marker.radius * 1.6)),
        occludeAround: new Vector3(0, 0, 0),
      });
    }
  }

  /* Un tipo, una función de construcción. Es el registro que pide la skill
     `add-chart-type`, en la forma que permite la ADR 0006: nada de componentes,
     porque aquí no hay React. */
  const BUILDERS: Record<ResolvedChartConfig['type'], () => void> = {
    donut: buildRing,
    pie: buildRing,
    bar: buildBars,
    'bar-race': buildRace,
    globe: buildGlobe,
    gauge: buildGauge,
  };

  function build() {
    disposePieces();
    disposeGlobe();
    raceLanes = [];
    zeroPlane.visible = false;
    (BUILDERS[config.type] ?? buildRing)();
    refreshLabels();
  }

  /** Rehace el DOM de las etiquetas a partir de las piezas que haya ahora. */
  function refreshLabels() {
    const anchors: LabelAnchor[] = [];
    for (const piece of pieces) {
      if (!piece.anchor) continue;
      anchors.push({
        index: piece.info.index,
        label: piece.info.label,
        value: piece.info.value,
        fraction: piece.info.fraction,
        color: colorForSegment(config, piece.info.index),
        anchor: piece.anchor,
        occludeAround: piece.occludeAround,
      });
    }
    /* El anillo y la tarta rodean un centro, así que sus etiquetas rodean el
       dibujo con línea guía. El globo y la carrera las ponen ENCIMA —debajo
       taparían el marcador y la punta de la barra—, y las barras fijas debajo,
       donde va el eje. La carrera no puede usar ese sitio: sus barras cambian de
       carril constantemente y el nombre tiene que ir pegado a SU barra, no a una
       posición del eje que un segundo después ocupa otra. */
    const colocacion =
      config.type === 'donut' || config.type === 'pie'
        ? 'radial'
        : config.type === 'globe' || config.type === 'bar-race'
          ? 'over'
          : 'point';
    labelLayer.rebuild(anchors, config, colocacion);
  }

  function applySceneSettings() {
    scene.environmentIntensity = config.scene.lightIntensity;
    /*
      EL DEGRADADO NO LO PINTA WEBGL, LO PINTA CSS.

      `scene.background` de three solo admite un color plano o una textura. Antes
      se le pasaba `background.from` sin mirar el `kind`, así que elegir
      «degradado» daba exactamente lo mismo que «sólido»: el primer color y ya.

      La alternativa dentro de WebGL sería un quad con shader o una textura
      generada — más código, más que liberar, y peor resultado: un degradado de
      CSS se compone a resolución de pantalla y no tiene banding. Aquí el canvas
      se deja TRANSPARENTE y el degradado va en el contenedor, detrás.

      El ángulo se pasa tal cual: `linear-gradient` mide desde arriba en sentido
      horario, que es la misma convención que documenta el esquema.
    */
    const fondo = config.scene.background;
    const degradado = !transparent() && fondo.kind === 'gradient';

    scene.background = transparent() || degradado ? null : new Color(fondo.from);
    container.style.background = degradado
      ? `linear-gradient(${fondo.angle}deg, ${fondo.from}, ${fondo.to})`
      : '';
    renderer.shadowMap.enabled = config.style.shadow;
    key.castShadow = config.style.shadow;
    floor.visible = config.style.shadow;

    if (transparent()) {
      zeroPlaneMaterial.color.setHex(0x8a8a95);
      zeroPlaneMaterial.opacity = 0.3;
    } else {
      // Luminancia relativa del fondo, ya en lineal: es como three guarda el color.
      const bg = new Color(config.scene.background.from);
      const light = 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b > 0.2;
      zeroPlaneMaterial.color.setHex(light ? 0x3a3a44 : 0xdcdce6);
      zeroPlaneMaterial.opacity = light ? 0.22 : 0.26;
    }

    /* El anillo se separa del suelo: apoyado sobre el plano, su sombra queda
       oculta debajo de él y se pierde la sensación de peso. Proporcional al
       grosor para que aguante al cambiarlo.

       Las barras no se separan. Una barra flotando deja de leerse como barra, y
       su sombra se ve de todas formas porque son altas. */
    const standing = config.type === 'bar' || config.type === 'bar-race';
    /* El globo flota: es una esfera, apoyarla en el suelo la haría rodar en la
       cabeza de quien la mira. Se centra a la altura de su propio radio. */
    group.position.y =
      config.type === 'globe'
        ? GLOBE_RADIUS * 1.35
        : standing
          ? 0
          : config.style.height * 0.75;

    /* La etiqueta de periodo solo existe en las carreras. Al cambiar de tipo hay
       que apagarla, o se queda un número colgado sobre una gráfica que ya no
       tiene tiempo. */
    if (config.type !== 'bar-race' && raceLabel !== null) {
      raceLabel = null;
      frameCallback?.(null);
    }

    /* Un globo se mira por debajo del ecuador sin problema; el resto de tipos
       no, porque verles la base no aporta nada y desorienta. */
    controls.minPolarAngle = config.type === 'globe' ? 0.05 : 0.12;
    controls.maxPolarAngle = config.type === 'globe' ? Math.PI - 0.05 : Math.PI / 2 - 0.04;

    /* Sin rotación automática, el ángulo vuelve a cero. Si no, apagarla deja la
       pieza girada donde estuviera y el mismo config da píxeles distintos, que es
       justo lo que rompe el render estático y las capturas de test. */
    if (!config.motion.autoRotate) {
      group.rotation.y = 0;
      swayPhase = 0;
    }

    controls.enabled = config.interaction.orbit;
    controls.enableZoom = config.interaction.zoom;

    fitShadowCamera();
    placeCamera();
  }

  /*
    La cámara de sombra, ceñida a lo que hay. El porqué y la aritmética están en
    `shadow-volume.ts`, que es donde se pueden comprobar con tests.
  */
  const shadowBox = new Box3();
  const luzHacia = new Vector3();

  function fitShadowCamera() {
    if (!config.style.shadow) return;

    const shadow = key.shadow;
    const cam = shadow.camera;

    /* El alto sale de la caja de verdad: cada tipo coloca su contenido a su
       manera —el anillo flota, las barras se apoyan, el globo se centra en su
       radio— y replicar esa aritmética aquí sería copiarla para que se
       desincronice a la primera. Al girar solo sobre Y, el alto no cambia. */
    group.updateMatrixWorld(true);
    shadowBox.setFromObject(group);
    if (shadowBox.isEmpty()) return;

    /* Donde three va a poner la cámara al renderizar. Sin esto, la matriz de
       vista con la que se calcula sería la del fotograma anterior. */
    key.updateMatrixWorld();
    key.target.updateMatrixWorld();
    shadow.updateMatrices(key);

    /* Cuánto baja la luz por unidad de rayo. Es lo que convierte una altura en
       recorrido, y sin ello no se sabe hasta dónde llega la sombra por el
       suelo — que fue exactamente el fallo del corte recto. */
    const caidaY = Math.abs(luzHacia.copy(key.position).normalize().y);

    const volumen = fitShadowVolume(cam.matrixWorldInverse, {
      radius: Math.hypot(plotBox.width, plotBox.depth) / 2,
      casterLow: shadowBox.min.y,
      casterHigh: shadowBox.max.y,
      floorY: floor.position.y,
      lightDropY: caidaY,
      mapSize: shadow.mapSize.x,
    });
    if (!volumen) return;

    Object.assign(cam, volumen);
    cam.updateProjectionMatrix();
    suavizarSombra(volumen);
  }

  /**
   * Cuánto se difumina el borde de la sombra, MEDIDO EN EL MUNDO.
   *
   * `shadow.radius` se cuenta en téxeles, y el téxel ya no mide siempre lo
   * mismo: depende de lo ceñido que salga el volumen, o sea del tipo de gráfica
   * y de su tamaño. Dejarlo en un número fijo daría un anillo con el borde
   * blando y unas barras altas con el borde duro, sin que nadie hubiera pedido
   * la diferencia.
   *
   * Pidiéndolo en unidades del mundo y convirtiéndolo aquí, la sombra se ve
   * igual en todas. Es la misma idea que el tamaño de las etiquetas: se declara
   * lo que se quiere ver, no la cantidad de píxeles que hacen falta hoy.
   */
  function suavizarSombra(volumen: { left: number; right: number }) {
    const shadow = key.shadow;
    const texel = (volumen.right - volumen.left) / shadow.mapSize.x;
    if (!(texel > 0)) return;

    /* Medido a ojo sobre el anillo por defecto: por debajo el borde se ve
       recortado y por encima la sombra pierde la forma del sólido. */
    const DESENFOQUE = 0.05;

    /* El tope no es decorativo: son NUEVE muestras repartidas por el radio, así
       que estirarlo mucho deja de verse como desenfoque y empieza a verse como
       nueve copias de la sombra. */
    shadow.radius = Math.min(8, Math.max(1, DESENFOQUE / texel));
  }

  /*
    Colocar la cámara depende del aspecto del hueco, así que también hay que
    hacerlo al redimensionar — antes solo se hacía al aplicar el config. Lo que
    NO se hace es reencuadrar después de que el usuario haya girado o hecho zoom:
    que la gráfica te vuelva a su sitio porque has cambiado el tamaño de la
    ventana se siente como perder el trabajo.
  */
  function placeCamera() {
    const standing = config.type === 'bar' || config.type === 'bar-race';

    camera.fov = config.camera.fov;
    camera.updateProjectionMatrix();

    // Se orbita alrededor del centro de lo que hay, no del suelo.
    const target = new Vector3(0, standing ? plotBox.height / 2 : group.position.y, 0);
    controls.target.copy(target);

    if (standing) {
      /* Las barras se miden: su alto cambia veinte veces entre los extremos de
         `style.height`, y el usuario ajusta desde `camera.distance`. */
      const direction = cameraDirection(config);
      const distance =
        fitDistance(plotBox, camera, target, direction) * config.camera.distance;
      camera.position.copy(direction).multiplyScalar(distance).add(target);
    } else {
      camera.position.copy(cameraPosition(config));
    }

    controls.update();
  }

  function resize() {
    const width = container.clientWidth || canvas.clientWidth || 1;
    const height = container.clientHeight || canvas.clientHeight || 1;
    renderer.setPixelRatio(pixelRatioPara(width, height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!userMovedCamera) placeCamera();
  }

  // ── interacción ───────────────────────────────────────────────────────────

  function onPointerMove(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    pointerInside = true;
  }

  function onPointerLeave() {
    pointerInside = false;
  }

  function updateHover() {
    if (!config.interaction.tooltip && config.motion.hover === 'none') return;

    let next: Piece | null = null;
    if (pointerInside) {
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(group.children, false)[0];
      if (hit) next = pieces.find((p) => p.mesh === hit.object) ?? null;
    }

    if (next === hovered) return;
    hovered = next;
    canvas.style.cursor = next ? 'pointer' : '';

    labelLayer.highlight(next ? next.info.index : null);

    if (!hoverCallback) return;
    hoverCallback(
      next ? { ...next.info, labelled: labelLayer.isLabelled(next.info.index) } : null,
    );
  }

  // ── bucle ─────────────────────────────────────────────────────────────────

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function motionEnabled() {
    if (config.motion.reducedMotion === 'force-off') return false;
    if (config.motion.reducedMotion === 'respect' && prefersReducedMotion) return false;
    return true;
  }

  let lastTime = 0;
  let frame = 0;
  let swayPhase = 0;
  let pulseTime = 0;

  /**
   * Avanza la carrera un frame.
   *
   * Tres cosas se mueven a la vez y las tres tienen que ir suaves: el valor
   * (altura), el puesto (posición en X) y la etiqueta del periodo. El puesto se
   * interpola aparte del valor porque un adelantamiento es un salto discreto en
   * el ranking, y sin suavizarlo las barras se teletransportan.
   */
  function updateRace(delta: number) {
    if (raceLanes.length === 0) return;

    const series = raceValues();
    const names = config.data.series.map((serie) => serie.name);
    const frameMs = config.motion.frameDuration ?? DEFAULT_FRAME_MS;

    if (motionEnabled()) raceElapsed += delta * 1000;

    const at = frameAt(raceElapsed, series.length, names, { frameMs, loop: true });
    const values = valuesAt(series, at, config.data.labels.length);
    const places = placementsFor(values);

    if (at.label !== raceLabel) {
      raceLabel = at.label;
      frameCallback?.(raceLabel);
    }

    const smoothing = 1 - Math.pow(0.0015, delta);

    raceLanes.forEach((lane, index) => {
      const target = places[index];
      const value = values[index] ?? 0;
      const height = Math.max(value * raceScale, 1e-3);

      lane.piece.info.value = value;
      lane.piece.mesh.visible = target.visible;
      /* Un carril que sale del top se lleva su etiqueta: dejarla dejaría un
         nombre flotando sobre una barra que ya no está. */
      labelLayer.setVisible(lane.piece.info.index, target.visible);
      if (!target.visible) return;
      labelLayer.setValue(lane.piece.info.index, value);

      // Puesto: se persigue el destino en vez de saltar a él.
      lane.slot += (target.slot - lane.slot) * smoothing;

      /* La geometría solo se rehace si el escalado se alejaría más de la
         tolerancia. Ver RACE_REBUILD_TOLERANCE. */
      if (Math.abs(height - lane.builtHeight) / lane.builtHeight > RACE_REBUILD_TOLERANCE) {
        const geometry = roundedBoxGeometry({
          width: raceWidth,
          depth: raceWidth,
          height,
          cornerSegments: raceSegments,
          ...barRadii(
            height,
            { width: raceWidth, depth: raceWidth },
            { bevel: config.style.bevel, cornerRadius: config.style.cornerRadius },
          ),
        });
        lane.piece.mesh.geometry.dispose();
        lane.piece.mesh.geometry = geometry;
        lane.builtHeight = height;
      }

      lane.piece.mesh.scale.y = height / lane.builtHeight;
      const x = -PLOT_WIDTH / 2 + raceCell * (lane.slot + 0.5);
      lane.piece.base.set(x, 0, 0);

      /* La etiqueta viaja con su barra y se queda ARRIBA, sobre la punta: es
         donde el ojo ya está mirando para comparar alturas, y así el nombre no
         se pierde entre las barras vecinas cuando la fila se aprieta.

         La `z` se adelanta media barra hacia la cámara por lo mismo que en las
         barras fijas: desde el centro, la propia barra tapa el punto en cuanto
         la escena se inclina. */
      lane.piece.anchor?.set(x, height, raceWidth / 2);
    });
  }

  function tick(now: number) {
    frame = requestAnimationFrame(tick);
    const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
    lastTime = now;

    /*
      UN MEDIDOR NO GIRA. Ni entero ni con vaivén.

      El hueco de abajo ES el cero de la escala: girar el anillo lo lleva de
      paseo y el dibujo deja de decir por dónde empieza a contarse. Encima la
      cifra del centro la pinta el anfitrión en HTML y está quieta, así que un
      arco moviéndose bajo un número fijo se lee como dos cosas distintas
      pegadas, no como una.
    */
    if (motionEnabled() && config.motion.autoRotate && config.type !== 'gauge') {
      const rate = (config.motion.speed / 60) * Math.PI * 2 * delta;

      if (config.type === 'bar' || config.type === 'bar-race') {
        /* Las barras NO dan la vuelta.
           Media vuelta pone la fila de canto —cinco barras convertidas en una— y
           una vuelta entera la deja del revés, con la primera categoría a la
           derecha. Las dos cosas mienten sobre los datos. `autoRotate` en barras
           es un vaivén: mantiene la pieza viva y no cambia nunca el orden de
           lectura. */
        swayPhase += rate;
        group.rotation.y = Math.sin(swayPhase) * MathUtils.degToRad(BAR_SWAY_DEGREES);
      } else {
        group.rotation.y += rate;
      }
    }

    if (config.type === 'bar-race') updateRace(delta);

    /*
      El latido. Cada anillo crece de 1 a ~2,2 y se apaga al llegar, y vuelve a
      empezar. Con desfase entre marcadores: todos a la vez late como un fallo
      de sincronía, escalonados late como actividad.

      Se escala y se cambia la opacidad de mallas que YA existen — nada de
      geometría nueva por frame (CLAUDE.md).
    */
    if (pulses.length > 0 && motionEnabled()) {
      pulseTime += delta;
      for (const pulse of pulses) {
        const t = (pulseTime * 0.55 + pulse.phase) % 1;
        pulse.mesh.scale.setScalar(1 + t * 1.2);
        (pulse.mesh.material as MeshBasicMaterial).opacity = 0.5 * (1 - t) ** 1.6;
      }
    }

    updateHover();

    // Realce interpolado, nunca a saltos.
    const canLift = config.motion.hover === 'lift' || config.motion.hover === 'explode';
    const smoothing = 1 - Math.pow(0.001, delta);
    for (const piece of pieces) {
      const target = piece === hovered && canLift ? 1 : 0;
      piece.hoverAmount += (target - piece.hoverAmount) * smoothing;

      /*
        Un marcador del globo CRECE, no se levanta.

        Levantarlo lo que se levanta un sector del anillo lo despega del planeta
        y deja de señalar un sitio, que es lo único que hace. Un punto pequeño
        además no tiene sitio donde subir: crecer un poco es el gesto que se lee
        a ese tamaño, y el que usa cualquier mapa de puntos.
      */
      if (piece.hoverStyle === 'grow') {
        piece.mesh.scale.setScalar(1 + piece.hoverAmount * 0.45);
        tmpVector.copy(piece.direction).multiplyScalar(piece.hoverAmount * 0.008);
        piece.mesh.position.copy(piece.base).add(tmpVector);
        continue;
      }

      const push = config.style.explode * 0.35 + piece.hoverAmount * 0.05;
      tmpVector.copy(piece.direction).multiplyScalar(push);
      piece.mesh.position.set(
        piece.base.x + tmpVector.x,
        piece.base.y + piece.hoverAmount * 0.09,
        piece.base.z + tmpVector.z,
      );
    }

    controls.update();
    renderer.render(scene, camera);

    /* Después de `controls.update()` y del render: las etiquetas se proyectan
       con la matriz de ESTE frame, no con la del anterior. Un frame de retraso
       se ve como un temblor de la etiqueta respecto a su pieza al orbitar. */
    labelLayer.update(camera, group, canvas.clientWidth, canvas.clientHeight);
  }

  // ── arranque ──────────────────────────────────────────────────────────────

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);

  currentKey = buildKey(config);
  labelsKey = labelsKeyOf(config);
  build();
  applySceneSettings();
  resize();
  frame = requestAnimationFrame(tick);

  return {
    update(next) {
      const previous = config;
      config = next;

      const nextKey = buildKey(next);

      // Regenerar geometría es caro: solo cuando cambia algo que la afecta.
      const nextLabels = labelsKeyOf(next);

      if (nextKey !== currentKey) {
        currentKey = nextKey;
        // `build()` rehace las etiquetas por su cuenta.
        build();
      } else if (nextLabels !== labelsKey) {
        refreshLabels();
      }

      labelsKey = nextLabels;
      applySceneSettings();
      if (previous.camera.fov !== next.camera.fov) resize();
    },

    onFrame(callback) {
      frameCallback = callback;
      callback(raceLabel);
    },

    onHover(callback) {
      hoverCallback = callback;
    },

    renderOnce() {
      renderer.render(scene, camera);
    },

    capture() {
      renderer.render(scene, camera);
      return canvas.toDataURL('image/png');
    },

    dispose() {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);

      disposePieces();
      disposeGlobe();
      labelLayer.dispose();
      controls.dispose();

      floorGeometry.dispose();
      floorMaterial.dispose();
      zeroPlaneGeometry.dispose();
      zeroPlaneMaterial.dispose();

      scene.environment = null;
      envTarget?.texture.dispose();
      envTarget = null;
      room.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry?.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else (material as Material | undefined)?.dispose();
        }
      });
      pmrem.dispose();

      // Suelta el contexto WebGL. Sin esto, seis embeds en una página de Notion
      // agotan el límite del navegador y los últimos no pintan nada.
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
