import {
  ACESFilmicToneMapping,
  Color,
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
  PCFSoftShadowMap,
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
import {
  computeSectors,
  curveSegmentsFor,
  globalBevel,
  sectorDirection,
  sectorGeometry,
  OUTER_RADIUS,
} from '../geometry/donut';
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

/*
  El renderer de Voluma, en three plano. Sin React (ADR 0006).

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
};

type Piece = {
  info: NonNullable<HoverInfo>;
  mesh: Mesh;
  /** Sitio de la pieza en el grupo. El realce y el explode se suman a esto. */
  base: Vector3;
  /** Hacia dónde se aparta al realzarla. Nula si el realce es solo vertical. */
  direction: Vector3;
  hoverAmount: number;
};

function cameraPlacement(config: ResolvedChartConfig): CameraPlacement {
  if (config.camera.preset === 'custom') {
    return { polar: config.camera.polar, azimuth: config.camera.azimuth, distance: 1 };
  }
  /* La carrera se encuadra como una fila de barras: es una fila de barras. Pero
     nunca con el preset de varias series, porque sus series son periodos que se
     ven de uno en uno, no filas que compitan por el espacio. */
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
function geometryKey(config: ResolvedChartConfig): string {
  const s = config.style;
  return [
    config.type,
    // Todas las series: las barras usan más de una.
    config.data.series.map((serie) => serie.values.join(',')).join(';'),
    s.innerRadius,
    s.height,
    s.gap,
    s.bevel,
    s.cornerRadius,
  ].join('|');
}

function materialKey(config: ResolvedChartConfig): string {
  const s = config.style;
  return [
    s.material,
    s.roughness,
    s.metalness,
    s.palette.join(','),
    config.data.series[0]?.colors?.join(',') ?? '',
  ].join('|');
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = config.style.shadow;
  renderer.shadowMap.type = PCFSoftShadowMap;

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
  let currentGeometryKey = '';
  let currentMaterialKey = '';

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
    info: NonNullable<HoverInfo>,
    base: Vector3,
    direction: Vector3,
  ) {
    const material = createMaterial(config, colorForSegment(config, colorIndex));
    const mesh = new Mesh(geometry, material);
    mesh.position.copy(base);
    mesh.castShadow = config.style.shadow;
    mesh.receiveShadow = config.style.shadow;

    group.add(mesh);
    pieces.push({ info, mesh, base, direction, hoverAmount: 0 });
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
      );
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

  function disposeGlobe() {
    for (const object of [globeBody, globeLand, globeGlow]) {
      if (!object) continue;
      group.remove(object);
      object.geometry.dispose();
      (object.material as Material).dispose();
    }
    globeBody = null;
    globeLand = null;
    globeGlow = null;
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
    for (const marker of layout.markers) {
      const color = colorForSegment(config, marker.index);
      const mesh = new Mesh(
        new SphereGeometry(marker.radius, 18, 14),
        new MeshBasicMaterial({ color }),
      );
      mesh.position.copy(marker.position);
      makeMarkerEasyToHit(mesh, marker.radius);
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
        /* Al señalarlo se separa de la superficie, no sube: "arriba" en una
           esfera es distinto en cada punto. */
        direction: marker.normal.clone(),
        hoverAmount: 0,
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
  };

  function build() {
    disposePieces();
    disposeGlobe();
    raceLanes = [];
    zeroPlane.visible = false;
    (BUILDERS[config.type] ?? buildRing)();
  }

  function applySceneSettings() {
    scene.environmentIntensity = config.scene.lightIntensity;
    scene.background = transparent() ? null : new Color(config.scene.background.from);
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

    placeCamera();
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

    if (!hoverCallback) return;
    hoverCallback(next ? next.info : null);
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
      if (!target.visible) return;

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
      lane.piece.base.set(-PLOT_WIDTH / 2 + raceCell * (lane.slot + 0.5), 0, 0);
    });
  }

  function tick(now: number) {
    frame = requestAnimationFrame(tick);
    const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
    lastTime = now;

    if (motionEnabled() && config.motion.autoRotate) {
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

    updateHover();

    // Realce interpolado, nunca a saltos.
    const canLift = config.motion.hover === 'lift' || config.motion.hover === 'explode';
    const smoothing = 1 - Math.pow(0.001, delta);
    for (const piece of pieces) {
      const target = piece === hovered && canLift ? 1 : 0;
      piece.hoverAmount += (target - piece.hoverAmount) * smoothing;

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
  }

  // ── arranque ──────────────────────────────────────────────────────────────

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);

  currentGeometryKey = geometryKey(config);
  currentMaterialKey = materialKey(config);
  build();
  applySceneSettings();
  resize();
  frame = requestAnimationFrame(tick);

  return {
    update(next) {
      const previous = config;
      config = next;

      const nextGeometryKey = geometryKey(next);
      const nextMaterialKey = materialKey(next);

      // Regenerar geometría es caro: solo cuando cambia algo que la afecta.
      if (
        nextGeometryKey !== currentGeometryKey ||
        nextMaterialKey !== currentMaterialKey
      ) {
        currentGeometryKey = nextGeometryKey;
        currentMaterialKey = nextMaterialKey;
        build();
      }

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

    dispose() {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);

      disposePieces();
      disposeGlobe();
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
