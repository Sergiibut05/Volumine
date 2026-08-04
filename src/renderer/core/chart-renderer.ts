import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MathUtils,
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
  type Sector,
} from '../geometry/donut';
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

const CAMERA_PRESETS = {
  hero: { polar: 62, azimuth: -35, distance: 1 },
  top: { polar: 5, azimuth: 0, distance: 0.95 },
  front: { polar: 82, azimuth: 0, distance: 1.15 },
  isometric: { polar: 54.7, azimuth: -45, distance: 1.05 },
} as const;

export type HoverInfo = { sector: Sector; label: string; value: number } | null;

export type ChartRendererHandle = {
  /** Reemplaza el config. Reconstruye solo lo que de verdad haya cambiado. */
  update(config: ResolvedChartConfig): void;
  /** Libera geometrías, materiales, entorno y el contexto WebGL. */
  dispose(): void;
  onHover(callback: (info: HoverInfo) => void): void;
  /** Un frame a mano, para capturas y tests visuales. */
  renderOnce(): void;
};

type Piece = {
  sector: Sector;
  mesh: Mesh;
  direction: Vector3;
  hoverAmount: number;
};

function cameraPosition(config: ResolvedChartConfig): Vector3 {
  const preset =
    config.camera.preset === 'custom'
      ? { polar: config.camera.polar, azimuth: config.camera.azimuth, distance: 1 }
      : CAMERA_PRESETS[config.camera.preset];

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
    config.data.series[0]?.values.join(','),
    s.innerRadius,
    s.height,
    s.gap,
    s.bevel,
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

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;

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

  function disposePieces() {
    for (const piece of pieces) {
      group.remove(piece.mesh);
      piece.mesh.geometry.dispose();
      (piece.mesh.material as Material).dispose();
    }
    pieces = [];
    hovered = null;
  }

  function build() {
    disposePieces();

    const { innerRadius, height, gap, bevel } = config.style;
    const innerR = innerRadius * OUTER_RADIUS;
    const values = config.data.series[0]?.values ?? [];
    const sectors = computeSectors(values, gap);
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
      const geometry: BufferGeometry = sectorGeometry({
        sector,
        innerR,
        outerR: OUTER_RADIUS,
        depth: height,
        bevel: bevelAbs,
        curveSegments: curveSegmentsFor(sector),
      });
      const material = createMaterial(config, colorForSegment(config, sector.index));
      const mesh = new Mesh(geometry, material);
      mesh.castShadow = config.style.shadow;
      mesh.receiveShadow = config.style.shadow;

      group.add(mesh);
      pieces.push({ sector, mesh, direction: sectorDirection(sector), hoverAmount: 0 });
    }
  }

  function applySceneSettings() {
    scene.environmentIntensity = config.scene.lightIntensity;
    scene.background = transparent() ? null : new Color(config.scene.background.from);
    renderer.shadowMap.enabled = config.style.shadow;
    key.castShadow = config.style.shadow;
    floor.visible = config.style.shadow;

    /* Separado del suelo: apoyada sobre el plano, la sombra queda oculta debajo
       de la propia gráfica y se pierde la sensación de peso. Proporcional al
       grosor para que se mantenga al cambiarlo. */
    group.position.y = config.style.height * 0.75;

    camera.fov = config.camera.fov;
    camera.position.copy(cameraPosition(config));
    camera.updateProjectionMatrix();

    controls.enabled = config.interaction.orbit;
    controls.enableZoom = config.interaction.zoom;
    controls.target.set(0, group.position.y, 0);
    controls.update();
  }

  function resize() {
    const width = container.clientWidth || canvas.clientWidth || 1;
    const height = container.clientHeight || canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
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
    if (!next) {
      hoverCallback(null);
      return;
    }
    hoverCallback({
      sector: next.sector,
      label: config.data.labels[next.sector.index] ?? '',
      value: config.data.series[0]?.values[next.sector.index] ?? 0,
    });
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

  function tick(now: number) {
    frame = requestAnimationFrame(tick);
    const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
    lastTime = now;

    if (motionEnabled() && config.motion.autoRotate) {
      group.rotation.y += (config.motion.speed / 60) * Math.PI * 2 * delta;
    }

    updateHover();

    // Realce interpolado, nunca a saltos.
    const canLift = config.motion.hover === 'lift' || config.motion.hover === 'explode';
    const smoothing = 1 - Math.pow(0.001, delta);
    for (const piece of pieces) {
      const target = piece === hovered && canLift ? 1 : 0;
      piece.hoverAmount += (target - piece.hoverAmount) * smoothing;

      const push = config.style.explode * 0.35 + piece.hoverAmount * 0.05;
      tmpVector.copy(piece.direction).multiplyScalar(push);
      piece.mesh.position.set(tmpVector.x, piece.hoverAmount * 0.09, tmpVector.z);
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
      controls.dispose();

      floorGeometry.dispose();
      floorMaterial.dispose();

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
