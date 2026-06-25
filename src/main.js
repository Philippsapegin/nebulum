import "./styles.css";
import * as THREE from "three";
import {
  GRAVITY_BASE_VALUES,
  MAX_SELECTION_FADING_SEGMENTS,
  MAX_SELECTION_POINTS,
  MAX_SELECTION_SEGMENTS,
  MOON_SIZE_NAMES,
  MUSIC_TRACKS,
  PLANET_SIZE_NAMES,
  PLANET_STAGE_CONTENT_RADIUS,
  PLANET_STAGE_HEIGHT,
  PLANET_STAGE_WIDTH,
  STAR_TEMPERATURE_RANGES,
  ZONE_DATA,
} from "./constants.js";
import {
  createAdjacency,
  createLinks,
  createNodes,
  createOuterLinks,
  createStarName,
} from "./graph/generate.js";
import { createPlanetNameService } from "./planet/names.js";
import { GAS_GIANT_WINDOW_TEXTURE_HEIGHT, createGasGiantTexture } from "./planet/gasGiantTexture.js";
import { createPlanetTexture } from "./planet/planetTexture.js";
import { createPlanetRotationState, getPlanetRotationPhase } from "./planet/rotation.js";
import { createPlanetScreenController } from "./screens/planetScreen.js";
import { createSystemScreenController } from "./screens/systemScreen.js";
import { openColorPicker } from "./ui/colorPicker.js";
import { createMusicPlayer } from "./ui/musicPlayer.js";
import { hexToRgba, lightenHexColor } from "./utils/color.js";
import { easeOutCubic, smoothstep } from "./utils/math.js";
import { createRandom } from "./utils/random.js";

const params = new URLSearchParams(window.location.search);
const SEED = params.get("seed") || "nebulum";
const PLANET_WATER_TAG_CHANCE = 0.5;
const ATMOSPHERE_TAGS = ["THIN ATMOSPHERE", "ATMOSPHERE", "DENSE ATMOSPHERE"];
const ATMOSPHERE_TEMPERATURE_MULTIPLIERS = {
  "THIN ATMOSPHERE": [1, 1.2],
  "ATMOSPHERE": [1.2, 1.8],
  "DENSE ATMOSPHERE": [1.8, 3],
};
const TIDAL_COMBINE_MAX_TEMPERATURE = 4000;
const glowTexture = createNodeGlowTexture();
const linkPulseTexture = createLinkPulseTexture();
const blackHoleDiskTexture = createBlackHoleDiskTexture();
const blackHoleDiskMaterial = new THREE.SpriteMaterial({
  map: blackHoleDiskTexture,
  color: 0x000000,
  transparent: true,
  opacity: 1,
  depthWrite: false,
  depthTest: false,
  blending: THREE.NormalBlending,
});
const sceneCanvas = document.querySelector("#scene");
const starLabels = document.querySelector("#star-labels");
const hoverNameWrap = document.querySelector("#hover-name-wrap");
const hoverName = document.querySelector("#hover-name");
const hoverPanel = document.querySelector("#hover-panel");
const tooltipType = document.querySelector("#tooltip-type");
const tooltipPlanets = document.querySelector("#tooltip-planets");
const seedInput = document.querySelector("#seed-input");
const regenerateButton = document.querySelector("#regenerate-button");
const currentColorSwatch = document.querySelector("#current-color-swatch");
const currentColorValue = document.querySelector("#current-color-value");
const usedColors = document.querySelector("#used-colors");
const clearButton = document.querySelector("#clear-button");
const maskToolToggle = document.querySelector("#mask-tool-toggle");
const skyGradientColorsElement = document.querySelector("#sky-gradient-colors");
const starWindow = document.querySelector("#star-window");
const systemGlow = document.querySelector("#system-glow");
const systemStars = document.querySelector("#system-stars");
const starSystem = document.querySelector("#star-system");
const systemStarLayer = document.querySelector("#system-star-layer");
const systemParticles = document.querySelector("#system-particles");
const systemHoverNameWrap = document.querySelector("#system-hover-name-wrap");
const systemHoverName = document.querySelector("#system-hover-name");
const systemHoverPanel = document.querySelector("#system-hover-panel");
const systemTooltipBody = document.querySelector("#system-tooltip-body");
const systemTitle = document.querySelector("#system-title");
const backToStarmapButton = document.querySelector("#back-to-starmap");
const toggleTidalZone = document.querySelector("#toggle-tidal-zone");
const toggleHzZone = document.querySelector("#toggle-hz-zone");
const planetWindow = document.querySelector("#planet-window");
const planetWindowClose = document.querySelector("#planet-window-close");
const planetWindowTitle = document.querySelector("#planet-window-title");
const planetWindowSize = document.querySelector("#planet-window-size");
const planetWindowStage = document.querySelector("#planet-window-stage");
const planetWindowLore = document.querySelector("#planet-window-lore");
const planetWindowDivider = document.querySelector("#planet-window-divider");
const planetWindowTags = document.querySelector("#planet-window-tags");
const planetLinkPath = document.querySelector("#planet-link-path");
const planetScreen = document.querySelector("#planet-screen");
const planetScreenBackStarmap = document.querySelector("#planet-screen-back-starmap");
const planetScreenBackSystem = document.querySelector("#planet-screen-back-system");
const objectDetailScreen = document.querySelector("#object-detail-screen");
const objectDetailTexture = document.querySelector("#object-detail-texture");
const objectDetailBackStarmap = document.querySelector("#object-detail-back-starmap");
const objectDetailBackSystem = document.querySelector("#object-detail-back-system");
const objectDetailBackOrbit = document.querySelector("#object-detail-back-orbit");
const systemTransitionOverlay = document.createElement("div");
systemTransitionOverlay.className = "system-transition-overlay";
starWindow.append(systemTransitionOverlay);
const planetEntryOverlay = document.createElement("div");
planetEntryOverlay.className = "planet-entry-overlay";
planetEntryOverlay.innerHTML = `
  <div class="planet-entry-card" aria-hidden="true">
    <div class="planet-entry-name"></div>
    <div class="planet-entry-line"></div>
    <div class="planet-entry-type"></div>
  </div>
`;
starWindow.append(planetEntryOverlay);
const graphEntryOverlay = document.createElement("div");
graphEntryOverlay.className = "graph-entry-overlay";
document.querySelector("#app").append(graphEntryOverlay);
const objectDetailEntryOverlay = document.createElement("div");
objectDetailEntryOverlay.className = "object-detail-entry-overlay";
document.querySelector("#app").append(objectDetailEntryOverlay);

const renderer = new THREE.WebGLRenderer({
  canvas: sceneCanvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;
sceneCanvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  document.body.classList.add("webgl-context-lost");
  window.setTimeout(() => window.location.reload(), 400);
});
sceneCanvas.addEventListener("webglcontextrestored", () => {
  window.location.reload();
});

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050506, 0.045);

const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 12);
const INITIAL_CAMERA_DISTANCE = camera.position.z;
const MIN_CAMERA_DISTANCE = 7.2;
const MAX_CAMERA_DISTANCE = 20;

const graphRoot = new THREE.Group();
scene.add(graphRoot);

const ambient = new THREE.AmbientLight(0xffffff, 0.14);
scene.add(ambient);

const keyLight = new THREE.PointLight(0xffffff, 1.8, 28);
keyLight.position.set(4, 5, 8);
scene.add(keyLight);

const rand = createRandom(SEED);
const nameRand = createRandom(`${SEED}:names`);
const planetNameService = createPlanetNameService({ seed: SEED });
const nodes = createNodes(rand).map((node) => ({
  ...node,
  name: createStarName(nameRand),
}));
const planetNameAssignments = planetNameService.createPlanetNameAssignments(nodes);
const links = createLinks(nodes);
const outerLinks = createOuterLinks(nodes, createRandom(`${SEED}:outer-links`));
const adjacency = createAdjacency(links, nodes);
const nodeMeshes = [];
const labelElements = [];
const hitTargets = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(10, 10);
const lastClientPointer = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);
const rotationVelocity = new THREE.Vector2(0, 0);
const targetRotation = new THREE.Euler(-0.18, 0.36, 0, "YXZ");
const linkPulse = createLinkPulse(createRandom(`${SEED}:link-pulse`));

let isDragging = false;
let activeGraphPointerId = null;
let lastPointer = new THREE.Vector2();
let pointerDownPosition = new THREE.Vector2();
let hoveredNode = null;
let currentMaskColor = "#00e1ff";
let isMaskToolEnabled = false;
let isPlanetEntryTransitioning = false;
let planetEntryTransitionToken = 0;
const gasGiantTextureLayers = new Set();
const planetSurfaceRotationLayers = new Set();
const SYSTEM_PLANET_ROTATION_DISPLAY_SCALE = 3.14;
const PLANET_ENTRY_MIN_OVERLAY_MS = 1500;
const PLANET_ENTRY_ZOOM_MS = 520;
const PLANET_ENTRY_FADE_MS = 420;
const SYSTEM_ORBIT_STAR_EDGE_GAP_CAP = 96;
const OBJECT_DETAIL_SURFACE_WORLD_WIDTH = 2;
const OBJECT_DETAIL_LIGHT_Z = 1.28;
const OBJECT_DETAIL_LIGHT_INTENSITY = 3.71;
const OBJECT_DETAIL_LIGHT_ANGLE_DEGREES = 25;
const OBJECT_DETAIL_LIGHT_PENUMBRA = 0.2;
const OBJECT_DETAIL_AMBIENT_INTENSITY = 0.08;
const OBJECT_DETAIL_AMBIENT_NO_LIGHT_INTENSITY = 1.6;
const OBJECT_DETAIL_DISPLACEMENT_SCALE = 0.3;
const OBJECT_DETAIL_CLOUD_HEIGHT = 0.23;
const OBJECT_DETAIL_HEX_GRID_HEIGHT = OBJECT_DETAIL_CLOUD_HEIGHT - 0.008;
const OBJECT_DETAIL_HEX_GRID_TEXTURE_WIDTH = 2048;
const OBJECT_DETAIL_HEX_GRID_TEXTURE_HEIGHT = 1024;
const OBJECT_DETAIL_CLOUD_ALPHA_TEST = 0.03;
const OBJECT_DETAIL_CLOUD_CYCLE_SECONDS = 180;
const OBJECT_DETAIL_GAS_GIANT_CLOUD_CYCLE_SECONDS = OBJECT_DETAIL_CLOUD_CYCLE_SECONDS / 3;
const OBJECT_DETAIL_GAS_GIANT_TEXTURE_CYCLE_SECONDS = OBJECT_DETAIL_CLOUD_CYCLE_SECONDS * 3;
const OBJECT_DETAIL_CLOUD_SHADOW_STRENGTH = 0.38;
const OBJECT_DETAIL_CLOUD_SHADOW_DARKEN = 0.48;
const OBJECT_DETAIL_CLOUD_SHADOW_OFFSET_U = 0.035;
const OBJECT_DETAIL_CLOUD_SHADOW_OFFSET_V = -0.018;
const OBJECT_DETAIL_CAMERA_HALF_WIDTH = 1.15;
const OBJECT_DETAIL_CAMERA_HALF_HEIGHT = 0.575;
const OBJECT_DETAIL_CURSOR_CLEAR_RADIUS = 0.184;
const OBJECT_DETAIL_CURSOR_CLEAR_FEATHER = 0.12;
const OBJECT_DETAIL_CURSOR_LIGHT_INTENSITY = OBJECT_DETAIL_LIGHT_INTENSITY;
const OBJECT_DETAIL_CURSOR_LIGHT_ANGLE_DEGREES = 12;
const OBJECT_DETAIL_CURSOR_LIGHT_PENUMBRA = 0.62;
const OBJECT_DETAIL_CURSOR_LIGHT_FADE_IN_SPEED = 1.8;
const OBJECT_DETAIL_CURSOR_LIGHT_FADE_OUT_SPEED = 7.5;
const OBJECT_DETAIL_OPTION_FADE_SPEED = 3.2;
const OBJECT_DETAIL_LIGHT_MAX_CHANNEL = 1.08;
const OBJECT_DETAIL_CURSOR_LIGHT_MIN_PROXIMITY = 0.16;
const OBJECT_DETAIL_TINT_LIGHT_INTENSITY = 0.46;
const OBJECT_DETAIL_TINT_LIGHT_ANGLE_DEGREES = 30;
const OBJECT_DETAIL_TINT_LIGHT_PENUMBRA = 0.72;
const OBJECT_DETAIL_LIGHT_FALLBACK_DAY_SECONDS = 24;
const OBJECT_DETAIL_LIGHT_WRAP_MARGIN = 0.9;
const OBJECT_DETAIL_OBSERVED_DEFAULT_WIDTH_PERCENT = 89;
const OBJECT_DETAIL_OBSERVED_DEFAULT_HEIGHT_PERCENT = 95;
const OBJECT_DETAIL_HOVER_WIDTH_PERCENT = 87;
const OBJECT_DETAIL_HOVER_HEIGHT_PERCENT = 87;
const OBJECT_DETAIL_DAY_MARKER_EDGE_FADE = 0.02;
let activeSystemStar = null;
let activeSystemStarSurface = null;
let tooltipTypingTimeout = null;
let tooltipTypingInterval = null;
let tooltipClearTimeout = null;
let tooltipTypingToken = 0;
let hoveredSystemBody = null;
let isTidalZoneVisible = false;
let isHzZoneVisible = false;
let activeZoneElements = [];
let isPlanetWindowOpen = false;
let openPlanetData = null;
let objectDetailOrbitPlanet = null;
let isObjectDetailOpen = false;
let objectDetailToken = 0;
let objectDetail3D = null;
const objectDetailOptions = {
  light: true,
  clouds: true,
};
let isDraggingPlanetWindow = false;
const planetWindowOffset = { x: 0, y: 0 };
const planetWindowDragStart = { x: 0, y: 0, offsetX: 0, offsetY: 0 };
let systemTooltipTypingTimeout = null;
let systemTooltipTypingInterval = null;
let systemTooltipClearTimeout = null;
let systemTooltipTypingToken = 0;
let lastFrameTime = performance.now();
let skyRandomVersion = 0;
let skyMesh = null;
let targetCameraDistance = camera.position.z;
const skyGradientColors = ["#27648f", "#000000", "#884d26", "#000000"];
const nodeColors = new Map();
const nodeAnimationProgress = new Map();
const edgeAnimationProgress = new Map();
const edgeAnimationOrigins = new Map();
const nodeExitAnimations = new Map();
const edgeExitAnimations = new Map();
const selectionOverlay = createSelectionOverlay();
const selectionScreenSize = new THREE.Vector2();
const systemGlowLayer = createSystemGlowLayer();
let planetScreenRenderer = null;
let planetScreenRendererPromise = null;
const systemScreenController = createSystemScreenController({ root: starWindow });
const musicPlayerController = createMusicPlayer({
  tracks: MUSIC_TRACKS,
  canDragInSystem: () => systemScreenController.isOpen() && !systemScreenController.isTransitioning(),
});
const planetScreenController = createPlanetScreenController({
  root: planetScreen,
  getPointer: () => ({ x: lastClientPointer.x, y: lastClientPointer.y }),
  onBeforeOpen: () => {
    setSystemHover(null);
    closePlanetWindow();
  },
  render: (planet) => {
    if (planetScreenRenderer) {
      planetScreenRenderer.render(planet);
      return;
    }
    renderPlanetScreenLoadFallback(planet);
  },
  renderFallback: (planet) => {
    if (planetScreenRenderer) {
      planetScreenRenderer.renderFallback(planet);
      return;
    }
    renderPlanetScreenLoadFallback(planet);
  },
  dispose3D: () => {
    planetScreenRenderer?.dispose3D();
  },
  drawStarSurface: drawSystemStarSurface,
  update3D: (surface, deltaSeconds, now) => {
    planetScreenRenderer?.update3D(surface, deltaSeconds, now);
  },
  setOpenPlanetData: (planet) => {
    openPlanetData = planet;
  },
});

initPanel();
musicPlayerController.init();
buildSky(createRandom(`${SEED}:sky`));
buildLocalSpaceStars(createRandom(`${SEED}:local-space`));
buildLinks(links);
buildOuterLinks(outerLinks);
buildNodes(nodes);
graphRoot.add(linkPulse.sprite);
resize();
animate();

window.addEventListener("resize", resize);
document.addEventListener("pointermove", onPointerMove, { capture: true });
sceneCanvas.addEventListener("pointerdown", onPointerDown);
sceneCanvas.addEventListener("wheel", onWheel, { passive: false });
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("pointercancel", onPointerUp);
window.addEventListener("blur", cancelGraphDrag);
sceneCanvas.addEventListener("lostpointercapture", cancelGraphDrag);
document.addEventListener("pointerdown", releaseStaleGraphCapture, { capture: true });

function initPanel() {
  seedInput.value = SEED;
  updateCurrentColorUi();
  updateUsedColorsUi();
  updateMaskToolUi();
  renderSkyGradientControls();

  regenerateButton.addEventListener("click", regenerateFromSeedInput);
  seedInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      regenerateFromSeedInput();
    }
  });

  currentColorSwatch.addEventListener("click", (event) => {
    event.stopPropagation();
    openColorPicker(currentColorSwatch, currentMaskColor, (color) => {
      currentMaskColor = color;
      updateCurrentColorUi();
    });
  });

  maskToolToggle.addEventListener("click", () => {
    isMaskToolEnabled = !isMaskToolEnabled;
    updateMaskToolUi();
  });

  backToStarmapButton.addEventListener("click", closeStarWindow);

  toggleTidalZone.addEventListener("click", () => {
    isTidalZoneVisible = !isTidalZoneVisible;
    toggleTidalZone.setAttribute("aria-pressed", String(isTidalZoneVisible));
    for (const { el, zone } of activeZoneElements) {
      if (zone === "tidal") el.classList.toggle("visible", isTidalZoneVisible);
    }
  });

  toggleHzZone.addEventListener("click", () => {
    isHzZoneVisible = !isHzZoneVisible;
    toggleHzZone.setAttribute("aria-pressed", String(isHzZoneVisible));
    for (const { el, zone } of activeZoneElements) {
      if (zone === "hz") el.classList.toggle("visible", isHzZoneVisible);
    }
  });

  planetScreenBackSystem.addEventListener("click", returnToStarSystemFromPlanet);
  planetScreenBackStarmap.addEventListener("click", () => {
    planetScreenController.close();
    closeObjectDetailScreen();
    closeStarWindow();
  });
  objectDetailBackSystem.addEventListener("click", () => {
    closeObjectDetailScreen();
    returnToStarSystemFromPlanet();
  });
  objectDetailBackStarmap.addEventListener("click", () => {
    closeObjectDetailScreen();
    planetScreenController.close();
    closeStarWindow();
  });
  objectDetailBackOrbit.addEventListener("click", returnToOrbitFromObjectDetail);
  objectDetailScreen.addEventListener("pointermove", updateObjectDetailCursorInteraction);
  objectDetailScreen.addEventListener("pointerleave", clearObjectDetailCursorInteraction);

  planetWindowClose.addEventListener("click", closePlanetWindow);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isObjectDetailOpen) {
      returnToOrbitFromObjectDetail();
      return;
    }
    if (event.key === "Escape" && planetScreenController.isOpen()) {
      planetScreenController.close();
      return;
    }
    if (event.key === "Escape" && isPlanetWindowOpen) {
      closePlanetWindow();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!isPlanetWindowOpen) {
      return;
    }
    if (planetWindow.contains(event.target)) {
      return;
    }
    if (event.target instanceof Element &&
        event.target.closest(".system-planet-hit, .music-player")) {
      return;
    }
    closePlanetWindow();
  });

  planetWindow.addEventListener("pointerdown", (event) => {
    if (event.target !== planetWindow) {
      return;
    }
    event.preventDefault();
    isDraggingPlanetWindow = true;
    planetWindow.classList.add("dragging");
    planetWindow.setPointerCapture(event.pointerId);
    planetWindowDragStart.x = event.clientX;
    planetWindowDragStart.y = event.clientY;
    planetWindowDragStart.offsetX = planetWindowOffset.x;
    planetWindowDragStart.offsetY = planetWindowOffset.y;
  });

  planetWindow.addEventListener("pointermove", (event) => {
    if (!isDraggingPlanetWindow) {
      return;
    }
    planetWindowOffset.x = planetWindowDragStart.offsetX + (event.clientX - planetWindowDragStart.x);
    planetWindowOffset.y = planetWindowDragStart.offsetY + (event.clientY - planetWindowDragStart.y);
    planetWindow.style.setProperty("--pw-x", `${planetWindowOffset.x}px`);
    planetWindow.style.setProperty("--pw-y", `${planetWindowOffset.y}px`);
  });

  const endPlanetWindowDrag = (event) => {
    if (!isDraggingPlanetWindow) {
      return;
    }
    isDraggingPlanetWindow = false;
    planetWindow.classList.remove("dragging");
    if (planetWindow.hasPointerCapture(event.pointerId)) {
      planetWindow.releasePointerCapture(event.pointerId);
    }
  };
  planetWindow.addEventListener("pointerup", endPlanetWindowDrag);
  planetWindow.addEventListener("pointercancel", endPlanetWindowDrag);

  clearButton.addEventListener("click", () => {
    nodeColors.clear();
    nodeAnimationProgress.clear();
    edgeAnimationProgress.clear();
    edgeAnimationOrigins.clear();
    nodeExitAnimations.clear();
    edgeExitAnimations.clear();
    updateUsedColorsUi();
  });

}

function updateMaskToolUi() {
  maskToolToggle.classList.toggle("active", isMaskToolEnabled);
  maskToolToggle.textContent = isMaskToolEnabled ? "On" : "Off";
  maskToolToggle.setAttribute("aria-pressed", String(isMaskToolEnabled));
}

function renderSkyGradientControls() {
  skyGradientColorsElement.replaceChildren();

  for (let index = 0; index < 4; index += 1) {
    const wrapper = document.createElement("div");
    wrapper.className = "gradient-color-wrap";
    const color = skyGradientColors[index] || null;

    const input = document.createElement("button");
    input.className = color ? "gradient-color" : "gradient-color gradient-color--empty";
    input.type = "button";
    input.title = color ? `Space gradient color ${index + 1}` : "Add space gradient color";

    if (color) {
      input.style.color = color;
      input.addEventListener("click", (event) => {
        event.stopPropagation();
        openColorPicker(input, color, (nextColor) => {
          skyGradientColors[index] = nextColor;
          input.style.color = nextColor;
          updateSkyTexture();
        });
      });
    } else {
      input.addEventListener("click", () => addSkyGradientColorAt(index));
    }

    wrapper.append(input);

    if (color) {
      const removeButton = document.createElement("button");
      removeButton.className = "gradient-remove";
      removeButton.type = "button";
      removeButton.textContent = "x";
      removeButton.title = "Remove color";
      removeButton.addEventListener("click", () => {
        skyGradientColors[index] = null;
        renderSkyGradientControls();
        updateSkyTexture();
      });
      wrapper.append(removeButton);
    }

    skyGradientColorsElement.append(wrapper);
  }

  const regenButton = document.createElement("button");
  regenButton.className = "gradient-regen";
  regenButton.type = "button";
  regenButton.title = "Regenerate space gradient";
  regenButton.textContent = "R";
  regenButton.addEventListener("click", regenerateSkyGradient);
  skyGradientColorsElement.append(regenButton);
}

function addSkyGradientColorAt(index) {
  if (index < 0 || index >= 4) {
    return;
  }

  skyGradientColors[index] = "#070812";
  renderSkyGradientControls();
  updateSkyTexture();
}

function regenerateSkyGradient() {
  skyRandomVersion += 1;
  updateSkyTexture();
}

function regenerateFromSeedInput() {
  const nextSeed = seedInput.value.trim() || "nebulum";
  const url = new URL(window.location.href);
  url.searchParams.set("seed", nextSeed);
  url.searchParams.delete("multiplier");
  window.location.href = url.toString();
}

function updateCurrentColorUi() {
  currentColorSwatch.style.color = currentMaskColor;
  currentColorValue.textContent = currentMaskColor;
}

function updateUsedColorsUi() {
  usedColors.replaceChildren();

  for (const color of getUsedMaskColors()) {
    const button = document.createElement("button");
    button.className = "used-color";
    button.type = "button";
    button.title = color;
    button.style.color = color;
    button.addEventListener("click", () => {
      currentMaskColor = color;
      updateCurrentColorUi();
    });
    usedColors.append(button);
  }
}

function getUsedMaskColors() {
  return Array.from(new Set(nodeColors.values())).sort();
}

function buildNodes(points) {
  const geometry = new THREE.SphereGeometry(1, 24, 16);
  const hitGeometry = new THREE.SphereGeometry(1, 16, 10);
  const hitMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  for (const node of points) {
    const material = new THREE.MeshStandardMaterial({
      color: node.coreColor,
      emissive: node.coreColor,
      emissiveIntensity: node.blackCore ? 0.1 : 5.8 * node.glowBoost,
      roughness: 0.1,
      metalness: 0,
      transparent: false,
      depthWrite: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(node.position);
    mesh.scale.setScalar(node.size);
    mesh.userData.node = node;
    mesh.renderOrder = node.blackCore ? 8 : 0;

    const glow = createNodeGlow(node);

    mesh.userData.glow = glow;
    nodeMeshes.push(mesh);
    graphRoot.add(mesh);
    graphRoot.add(glow);
    labelElements.push(createStarLabel(node));

    if (node.blackCore) {
      const disk = new THREE.Sprite(blackHoleDiskMaterial);
      disk.position.copy(node.position);
      disk.scale.setScalar(node.size * 3.1);
      disk.renderOrder = 40;
      graphRoot.add(disk);
    }

    const hitTarget = new THREE.Mesh(hitGeometry, hitMaterial);
    hitTarget.position.copy(node.position);
    hitTarget.scale.setScalar(node.size * 6.2);
    hitTarget.userData.node = node;
    hitTarget.userData.visual = mesh;
    hitTargets.push(hitTarget);
    graphRoot.add(hitTarget);
  }
}

function createStarLabel(node) {
  const label = document.createElement("div");
  label.className = "star-label";
  label.textContent = node.name;
  starLabels.append(label);
  return label;
}

function buildLinks(edges) {
  const positions = new Float32Array(edges.length * 6);
  edges.forEach((edge, index) => {
    const start = nodes[edge.a].position;
    const end = nodes[edge.b].position;
    positions.set([start.x, start.y, start.z, end.x, end.y, end.z], index * 6);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.46,
    blending: THREE.AdditiveBlending,
  });

  const lineSegments = new THREE.LineSegments(geometry, material);
  graphRoot.add(lineSegments);

  const halo = new THREE.LineSegments(
    geometry.clone(),
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.scale.setScalar(1.004);
  graphRoot.add(halo);
}

function buildOuterLinks(edges) {
  if (edges.length === 0) {
    return;
  }

  const positions = new Float32Array(edges.length * 6);
  const alphas = new Float32Array(edges.length * 2);

  edges.forEach((edge, index) => {
    positions.set(
      [
        edge.start.x,
        edge.start.y,
        edge.start.z,
        edge.end.x,
        edge.end.y,
        edge.end.z,
      ],
      index * 6,
    );
    alphas.set([edge.opacity, 0], index * 2);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("alpha", new THREE.BufferAttribute(alphas, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: 1 },
    },
    vertexShader: `
      attribute float alpha;
      varying float vAlpha;

      void main() {
        vAlpha = alpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float opacity;
      varying float vAlpha;

      void main() {
        gl_FragColor = vec4(vec3(1.0), vAlpha * opacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const lineSegments = new THREE.LineSegments(geometry, material);
  graphRoot.add(lineSegments);

  const halo = new THREE.LineSegments(
    geometry.clone(),
    material.clone(),
  );
  halo.material.transparent = true;
  halo.material.depthWrite = false;
  halo.material.blending = THREE.AdditiveBlending;
  halo.material.uniforms.opacity.value = 0.28;
  halo.scale.setScalar(1.004);
  graphRoot.add(halo);
}

function buildSky(random) {
  skyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(42, 160, 96),
    createSkyGradientMaterial(random),
  );
  skyMesh.renderOrder = -10;
  graphRoot.add(skyMesh);

  const starCount = 1800;
  const radius = 39;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);

  for (let index = 0; index < starCount; index += 1) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    const starRadius = radius + (random() - 0.5) * 4;
    const offset = index * 3;
    const brightness = 0.58 + random() * random() * 0.42;

    positions[offset] = Math.sin(phi) * Math.cos(theta) * starRadius;
    positions[offset + 1] = Math.cos(phi) * starRadius;
    positions[offset + 2] = Math.sin(phi) * Math.sin(theta) * starRadius;
    colors[offset] = brightness;
    colors[offset + 1] = brightness;
    colors[offset + 2] = brightness;
    sizes[index] = random() > 0.9 ? 2.1 : 1.25 + random() * 0.45;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
      uniform float pixelRatio;
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;

      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = size * pixelRatio;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;

      void main() {
        vec2 point = gl_PointCoord - vec2(0.5);
        float distanceFromCenter = length(point);
        if (distanceFromCenter > 0.5) {
          discard;
        }
        float alpha = smoothstep(0.5, 0.16, distanceFromCenter);
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  const pixelStars = new THREE.Points(geometry, material);
  pixelStars.frustumCulled = false;
  pixelStars.renderOrder = -9;
  pixelStars.userData.isSkyPixels = true;
  graphRoot.add(pixelStars);
}

function createSkyGradientMaterial(random) {
  const activeSkyColors = getActiveSkyGradientColors();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      skyColors: { value: createSkyColorUniforms(activeSkyColors) },
      skyColorCount: { value: activeSkyColors.length },
      skyAnchors: { value: createSkyAnchorUniforms(random) },
    },
    vertexShader: `
      varying vec3 vDirection;

      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 skyColors[4];
      uniform int skyColorCount;
      uniform vec3 skyAnchors[8];
      varying vec3 vDirection;

      void main() {
        vec3 direction = normalize(vDirection);
        vec3 color = vec3(0.0015);
        float totalWeight = 0.0001;

        for (int i = 0; i < 4; i += 1) {
          if (i >= skyColorCount) {
            break;
          }

          vec3 anchorA = normalize(skyAnchors[i * 2]);
          vec3 anchorB = normalize(skyAnchors[i * 2 + 1]);
          float lobeA = pow(max(dot(direction, anchorA) * 0.5 + 0.5, 0.0), 3.1);
          float lobeB = pow(max(dot(direction, anchorB) * 0.5 + 0.5, 0.0), 4.7) * 0.72;
          float weight = 0.12 + lobeA + lobeB;
          color += skyColors[i] * weight;
          totalWeight += weight;
        }

        color /= totalWeight;
        float wave = sin(dot(direction, skyAnchors[6]) * 5.2 + dot(direction, skyAnchors[7]) * 2.1);
        color *= 0.94 + wave * 0.035;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  material.toneMapped = false;
  return material;
}

function getActiveSkyGradientColors() {
  const colors = skyGradientColors.filter(Boolean);
  return colors.length > 0 ? colors : ["#050914"];
}

function createSkyColorUniforms(activeSkyColors = getActiveSkyGradientColors()) {
  const colors = activeSkyColors;
  return Array.from({ length: 4 }, (_, index) => {
    const color = new THREE.Color(colors[Math.min(index, colors.length - 1)]);
    return new THREE.Vector3(color.r, color.g, color.b);
  });
}

function createSkyAnchorUniforms(random) {
  return Array.from({ length: 8 }, () => {
    const theta = random() * Math.PI * 2;
    const z = random() * 2 - 1;
    const radius = Math.sqrt(Math.max(0, 1 - z * z));
    return new THREE.Vector3(Math.cos(theta) * radius, z, Math.sin(theta) * radius);
  });
}

function updateSkyTexture() {
  if (!skyMesh) {
    return;
  }

  skyMesh.material.dispose();
  skyMesh.material = createSkyGradientMaterial(createRandom(`${SEED}:sky:${skyRandomVersion}`));
}

function buildLocalSpaceStars(random) {
  const starCount = 520;
  const minRadius = 7.2;
  const maxRadius = 18;
  const positions = new Float32Array(starCount * 3);
  const brightnesses = new Float32Array(starCount);
  const sizes = new Float32Array(starCount);

  for (let index = 0; index < starCount; index += 1) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    const radius = minRadius + random() * (maxRadius - minRadius);
    const offset = index * 3;

    positions[offset] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[offset + 1] = Math.cos(phi) * radius;
    positions[offset + 2] = Math.sin(phi) * Math.sin(theta) * radius;
    brightnesses[index] = 0.38 + random() * random() * 0.48;
    sizes[index] = 1 + Math.pow(random(), 2.4) * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("brightness", new THREE.BufferAttribute(brightnesses, 1));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
      uniform float pixelRatio;
      attribute float brightness;
      attribute float size;
      varying float vBrightness;

      void main() {
        vBrightness = brightness;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = size * pixelRatio;
      }
    `,
    fragmentShader: `
      varying float vBrightness;

      void main() {
        gl_FragColor = vec4(vec3(vBrightness), 0.72);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  const localStars = new THREE.Points(geometry, material);
  localStars.frustumCulled = false;
  localStars.renderOrder = -8;
  localStars.userData.isSkyPixels = true;
  graphRoot.add(localStars);
}

function createNodeGlow(node) {
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: node.glowColor,
      transparent: true,
      opacity: node.blackCore ? 0.82 : Math.min(1, node.glowBoost),
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  glow.position.copy(node.position);
  glow.scale.setScalar(node.size * 44 * node.glowScaleBoost);
  glow.userData.baseScale = node.size * 44 * node.glowScaleBoost;
  return glow;
}

function createNodeGlowTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const image = context.createImageData(size, size);
  const center = size / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5 - center) / center;
      const dy = (y + 0.5 - center) / center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const coreEdge = 0.075;
      const index = (y * size + x) * 4;

      if (distance > 1) {
        image.data[index + 3] = 0;
        continue;
      }

      const core = smoothstep(coreEdge + 0.008, coreEdge - 0.008, distance) * 0.72;
      const rim = Math.exp(-Math.abs(distance - coreEdge) * 54) * 0.54;
      const falloff =
        Math.max(0, Math.log(1 + (1 - distance) * 7) / Math.log(8)) *
        Math.exp(-distance * 3.6) *
        0.28;
      const alpha = Math.min(1, core + rim + falloff);

      image.data[index] = 255;
      image.data[index + 1] = 255;
      image.data[index + 2] = 255;
      image.data[index + 3] = Math.round(alpha * 255);
    }
  }

  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createLinkPulseTexture() {
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(48, 48, 0, 48, 48, 48);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.18, "rgba(255,255,255,0.72)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createLinkPulse(random) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: linkPulseTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sprite.scale.setScalar(0.14);
  sprite.renderOrder = 6;

  return {
    sprite,
    random,
    edge: null,
    elapsed: 0,
    duration: 0.85,
    wait: 0.2 + random() * 0.8,
  };
}

function updateLinkPulse(deltaSeconds) {
  if (links.length === 0) {
    return;
  }

  if (!linkPulse.edge) {
    linkPulse.wait -= deltaSeconds;
    linkPulse.sprite.material.opacity = 0;

    if (linkPulse.wait <= 0) {
      linkPulse.edge = links[Math.floor(linkPulse.random() * links.length)];
      linkPulse.elapsed = 0;
      linkPulse.duration = 0.55 + linkPulse.random() * 0.7;
    }
    return;
  }

  linkPulse.elapsed += deltaSeconds;
  const progress = Math.min(1, linkPulse.elapsed / linkPulse.duration);
  const start = nodes[linkPulse.edge.a].position;
  const end = nodes[linkPulse.edge.b].position;
  linkPulse.sprite.position.copy(start).lerp(end, progress);
  linkPulse.sprite.material.opacity = Math.sin(progress * Math.PI) * 0.92;

  if (progress >= 1) {
    linkPulse.edge = null;
    linkPulse.wait = 0.2 + linkPulse.random() * 0.8;
    linkPulse.sprite.material.opacity = 0;
  }
}

function createBlackHoleDiskTexture() {
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, size, size);
  context.beginPath();
  context.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
  context.fillStyle = "rgba(0,0,0,1)";
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSelectionOverlay() {
  const pointUniforms = Array.from(
    { length: MAX_SELECTION_POINTS },
    () => new THREE.Vector2(-10000, -10000),
  );
  const pointRadiusUniforms = Array.from({ length: MAX_SELECTION_POINTS }, () => 0);
  const segmentStartUniforms = Array.from(
    { length: MAX_SELECTION_SEGMENTS },
    () => new THREE.Vector2(-10000, -10000),
  );
  const segmentEndUniforms = Array.from(
    { length: MAX_SELECTION_SEGMENTS },
    () => new THREE.Vector2(-10000, -10000),
  );
  const fadingSegmentStartUniforms = Array.from(
    { length: MAX_SELECTION_FADING_SEGMENTS },
    () => new THREE.Vector2(-10000, -10000),
  );
  const fadingSegmentEndUniforms = Array.from(
    { length: MAX_SELECTION_FADING_SEGMENTS },
    () => new THREE.Vector2(-10000, -10000),
  );
  const fadingSegmentProgressUniforms = Array.from(
    { length: MAX_SELECTION_FADING_SEGMENTS },
    () => 0,
  );

  const overlayScene = new THREE.Scene();
  const overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { value: new THREE.Vector2(1, 1) },
      points: { value: pointUniforms },
      pointRadii: { value: pointRadiusUniforms },
      segmentStarts: { value: segmentStartUniforms },
      segmentEnds: { value: segmentEndUniforms },
      fadingSegmentStarts: { value: fadingSegmentStartUniforms },
      fadingSegmentEnds: { value: fadingSegmentEndUniforms },
      fadingSegmentProgresses: { value: fadingSegmentProgressUniforms },
      pointCount: { value: 0 },
      segmentCount: { value: 0 },
      fadingSegmentCount: { value: 0 },
      nodeRadius: { value: 31 },
      tubeRadius: { value: 16 },
      strokeWidth: { value: 1 },
      glowWidth: { value: 5 },
      opacity: { value: 0.36 },
      color: { value: new THREE.Color(0x00e1ff) },
      strokeColor: { value: new THREE.Color(0x80f0ff) },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      #define MAX_POINTS ${MAX_SELECTION_POINTS}
      #define MAX_SEGMENTS ${MAX_SELECTION_SEGMENTS}
      #define MAX_FADING_SEGMENTS ${MAX_SELECTION_FADING_SEGMENTS}

      uniform vec2 resolution;
      uniform vec2 points[MAX_POINTS];
      uniform float pointRadii[MAX_POINTS];
      uniform vec2 segmentStarts[MAX_SEGMENTS];
      uniform vec2 segmentEnds[MAX_SEGMENTS];
      uniform vec2 fadingSegmentStarts[MAX_FADING_SEGMENTS];
      uniform vec2 fadingSegmentEnds[MAX_FADING_SEGMENTS];
      uniform float fadingSegmentProgresses[MAX_FADING_SEGMENTS];
      uniform int pointCount;
      uniform int segmentCount;
      uniform int fadingSegmentCount;
      uniform float nodeRadius;
      uniform float tubeRadius;
      uniform float strokeWidth;
      uniform float glowWidth;
      uniform float opacity;
      uniform vec3 color;
      uniform vec3 strokeColor;

      float circleSdf(vec2 pixel, vec2 center, float radius) {
        return length(pixel - center) - radius;
      }

      float capsuleSdf(vec2 pixel, vec2 start, vec2 end, float radius) {
        vec2 segment = end - start;
        float segmentLength = dot(segment, segment);
        if (segmentLength < 0.001) {
          return circleSdf(pixel, start, radius);
        }
        float t = clamp(dot(pixel - start, segment) / segmentLength, 0.0, 1.0);
        vec2 closest = start + segment * t;
        return length(pixel - closest) - radius;
      }

      vec2 capsuleDistanceAndT(vec2 pixel, vec2 start, vec2 end, float radius) {
        vec2 segment = end - start;
        float segmentLength = dot(segment, segment);
        if (segmentLength < 0.001) {
          return vec2(circleSdf(pixel, start, radius), 0.0);
        }
        float t = clamp(dot(pixel - start, segment) / segmentLength, 0.0, 1.0);
        vec2 closest = start + segment * t;
        return vec2(length(pixel - closest) - radius, t);
      }

      void main() {
        vec2 pixel = gl_FragCoord.xy;
        float distanceToSelection = 100000.0;
        float fadingFill = 0.0;
        float fadingStroke = 0.0;
        float fadingGlow = 0.0;

        for (int index = 0; index < MAX_POINTS; index += 1) {
          if (index >= pointCount) {
            break;
          }
          distanceToSelection = min(
            distanceToSelection,
            circleSdf(pixel, points[index], pointRadii[index])
          );
        }

        for (int index = 0; index < MAX_SEGMENTS; index += 1) {
          if (index >= segmentCount) {
            break;
          }
          distanceToSelection = min(
            distanceToSelection,
            capsuleSdf(pixel, segmentStarts[index], segmentEnds[index], tubeRadius)
          );
        }

        for (int index = 0; index < MAX_FADING_SEGMENTS; index += 1) {
          if (index >= fadingSegmentCount) {
            break;
          }

          vec2 distanceAndT = capsuleDistanceAndT(
            pixel,
            fadingSegmentStarts[index],
            fadingSegmentEnds[index],
            tubeRadius
          );
          float distanceToFading = distanceAndT.x;
          float t = distanceAndT.y;
          float segmentProgress = fadingSegmentProgresses[index];
          float growMask = smoothstep(1.0 - segmentProgress - 0.08, 1.0 - segmentProgress, t);
          float fade = (1.0 - smoothstep(0.25, 1.0, t)) * growMask;

          fadingFill = max(fadingFill, step(distanceToFading, 0.0) * fade);
          fadingStroke = max(
            fadingStroke,
            step(abs(distanceToFading), strokeWidth) *
            step(0.001, abs(distanceToFading)) *
            fade
          );
          fadingGlow = max(
            fadingGlow,
            smoothstep(glowWidth, strokeWidth, distanceToFading) *
            step(strokeWidth, distanceToFading) *
            fade
          );
        }

        float fillMask = step(distanceToSelection, 0.0);
        float strokeMask =
          step(abs(distanceToSelection), strokeWidth) *
          step(0.001, abs(distanceToSelection));
        float glowMask =
          smoothstep(glowWidth, strokeWidth, distanceToSelection) *
          step(strokeWidth, distanceToSelection);
        float combinedFill = max(fillMask, fadingFill);
        float baseBoundaryVisible = 1.0 - smoothstep(0.001, 0.88, fadingFill);
        float fadingBoundaryVisible = 1.0 - fillMask;
        float combinedStroke = max(
          strokeMask * baseBoundaryVisible,
          fadingStroke * fadingBoundaryVisible
        );
        float combinedGlow = max(
          glowMask * baseBoundaryVisible,
          fadingGlow * fadingBoundaryVisible
        );
        float glowAlpha = combinedGlow * 0.42;
        float alpha = max(max(combinedFill * opacity, glowAlpha), combinedStroke);

        if (alpha <= 0.001) {
          discard;
        }

        vec3 finalColor = mix(color, strokeColor, max(combinedStroke, combinedGlow * 0.58));
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  overlayScene.add(quad);

  return {
    scene: overlayScene,
    camera: overlayCamera,
    material,
    points: pointUniforms,
    pointRadii: pointRadiusUniforms,
    segmentStarts: segmentStartUniforms,
    segmentEnds: segmentEndUniforms,
    fadingSegmentStarts: fadingSegmentStartUniforms,
    fadingSegmentEnds: fadingSegmentEndUniforms,
    fadingSegmentProgresses: fadingSegmentProgressUniforms,
  };
}

function createSystemGlowLayer() {
  const glowRenderer = new THREE.WebGLRenderer({
    canvas: systemGlow,
    alpha: true,
    antialias: false,
    powerPreference: "high-performance",
  });
  glowRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  glowRenderer.setClearColor(0x000000, 0);
  glowRenderer.outputColorSpace = THREE.SRGBColorSpace;

  const glowScene = new THREE.Scene();
  const glowCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { value: new THREE.Vector2(1, 1) },
      starCenter: { value: new THREE.Vector2(0, 0) },
      starRadius: { value: 1 },
      glowColor: { value: new THREE.Color(1, 1, 1) },
      intensity: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec2 resolution;
      uniform vec2 starCenter;
      uniform float starRadius;
      uniform vec3 glowColor;
      uniform float intensity;
      varying vec2 vUv;

      void main() {
        vec2 pixel = vec2(vUv.x * resolution.x, (1.0 - vUv.y) * resolution.y);
        float distanceToCenter = length(pixel - starCenter);
        float signedDistance = distanceToCenter - starRadius;
        float edgeDistance = abs(signedDistance);
        float edgeCore = exp(-edgeDistance * 0.034) * 0.34;
        float outerFalloff = log(1.0 + max(signedDistance, 0.0) * 0.018) / log(4.2);
        outerFalloff = (1.0 - clamp(outerFalloff, 0.0, 1.0)) * exp(-max(signedDistance, 0.0) * 0.0026) * 0.34;
        float innerFalloff = exp(-max(-signedDistance, 0.0) * 0.008) * 0.12;
        float edgeRim = exp(-edgeDistance * 0.105) * 0.28;
        float fadeLimit = resolution.x * 0.75;
        float linearDistanceFade = clamp(1.0 - max(signedDistance, 0.0) / max(fadeLimit, 1.0), 0.0, 1.0);
        float alpha = clamp((edgeCore + edgeRim + outerFalloff + innerFalloff) * intensity * linearDistanceFade, 0.0, 0.78);

        if (alpha <= 0.001) {
          discard;
        }

        gl_FragColor = vec4(glowColor * (0.62 + intensity * 0.24), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  glowMaterial.toneMapped = false;
  glowScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), glowMaterial));

  return {
    renderer: glowRenderer,
    material: glowMaterial,
    scene: glowScene,
    camera: glowCamera,
    resize(width, height) {
      const pixelRatio = Math.min(window.devicePixelRatio, 2);
      glowRenderer.setPixelRatio(pixelRatio);
      glowRenderer.setSize(width, height, false);
      glowMaterial.uniforms.resolution.value.set(width * pixelRatio, height * pixelRatio);
    },
    render({ centerX, centerY, radius, color, intensity }) {
      const pixelRatio = Math.min(window.devicePixelRatio, 2);
      glowMaterial.uniforms.starCenter.value.set(centerX * pixelRatio, centerY * pixelRatio);
      glowMaterial.uniforms.starRadius.value = radius * pixelRatio;
      glowMaterial.uniforms.glowColor.value.set(color);
      glowMaterial.uniforms.intensity.value = intensity;
      glowRenderer.render(glowScene, glowCamera);
    },
  };
}

function onPointerDown(event) {
  if (event.button !== 0 || systemScreenController.isOpen() || systemScreenController.isGraphEntering()) {
    return;
  }

  isDragging = true;
  activeGraphPointerId = event.pointerId;
  lastPointer.set(event.clientX, event.clientY);
  pointerDownPosition.set(event.clientX, event.clientY);
  sceneCanvas.classList.add("dragging");
  sceneCanvas.setPointerCapture(event.pointerId);
}

function onPointerUp(event) {
  if (activeGraphPointerId !== event.pointerId) {
    return;
  }

  if (event.type === "pointercancel") {
    cancelGraphDrag(event);
    return;
  }

  const clickDistance = pointerDownPosition.distanceTo(new THREE.Vector2(event.clientX, event.clientY));
  cancelGraphDrag(event);
  if (clickDistance < 5) {
    selectNodeAt(event.clientX, event.clientY);
  }
}

function releaseStaleGraphCapture(event) {
  if (event.target === sceneCanvas) {
    return;
  }

  if (activeGraphPointerId !== null || isDragging) {
    cancelGraphDrag();
  }

  if (!systemScreenController.isOpen()) {
    forceCloseViewOverlays();
  }
}

function cancelGraphDrag(event) {
  const pointerId = event?.pointerId ?? activeGraphPointerId;
  isDragging = false;
  activeGraphPointerId = null;
  sceneCanvas.classList.remove("dragging");
  if (pointerId !== null && pointerId !== undefined && sceneCanvas.hasPointerCapture(pointerId)) {
    sceneCanvas.releasePointerCapture(pointerId);
  }
}

function onPointerMove(event) {
  if (isDragging && event.buttons !== undefined && (event.buttons & 1) === 0) {
    cancelGraphDrag(event);
  }

  lastClientPointer.set(event.clientX, event.clientY);
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  updateSystemParallax(event.clientX, event.clientY);

  if (isDragging) {
    const deltaX = event.clientX - lastPointer.x;
    const deltaY = event.clientY - lastPointer.y;
    targetRotation.y += deltaX * 0.006;
    targetRotation.x += deltaY * 0.006;
    targetRotation.x = THREE.MathUtils.clamp(targetRotation.x, -1.15, 1.15);
    rotationVelocity.set(deltaY * 0.00035, deltaX * 0.00035);
    lastPointer.set(event.clientX, event.clientY);
  }

  positionTooltip(event.clientX, event.clientY);
}

function forceCloseViewOverlays() {
  if (!starWindow.classList.contains("visible") &&
      !planetScreen.classList.contains("visible") &&
      !document.body.classList.contains("system-open")) {
    return;
  }

  planetScreenController.close();
  cancelPlanetEntryTransition();
  systemScreenController.setTransitioning(false);
  starWindow.classList.remove("visible", "system-transitioning", "planet-entry-moving");
  starWindow.setAttribute("aria-hidden", "true");
  document.body.classList.remove("system-open");
  setSystemTransitionOffset(0, 0);
  setSystemTransitionOverlay(0);
}

function onWheel(event) {
  if (systemScreenController.isOpen()) {
    return;
  }

  event.preventDefault();
  const zoomFactor = Math.exp(event.deltaY * 0.0012);
  targetCameraDistance = THREE.MathUtils.clamp(
    targetCameraDistance * zoomFactor,
    MIN_CAMERA_DISTANCE,
    MAX_CAMERA_DISTANCE,
  );
}

function updateHover() {
  raycaster.setFromCamera(pointer, camera);
  const nextHover = getNodeHit()?.userData.visual ?? null;

  if (hoveredNode === nextHover) {
    return;
  }

  if (hoveredNode) {
    hoveredNode.material.emissiveIntensity = hoveredNode.userData.node.blackCore
      ? 0.1
      : 5.8 * hoveredNode.userData.node.glowBoost;
    hoveredNode.scale.setScalar(hoveredNode.userData.node.size);
    hoveredNode.userData.glow.scale.setScalar(hoveredNode.userData.glow.userData.baseScale);
    hoveredNode.userData.glow.material.opacity = 0.82;
  }

  const previousHoveredNode = hoveredNode;
  const isNewHoveredStar =
    Boolean(nextHover) &&
    (!previousHoveredNode ||
      previousHoveredNode.userData.node.id !== nextHover.userData.node.id);
  const isReturningDuringExit = Boolean(nextHover && tooltipClearTimeout);
  const useFastEnter = isNewHoveredStar && (Boolean(previousHoveredNode) || isReturningDuringExit);

  hoveredNode = nextHover;
  hoverNameWrap.classList.toggle("fast-enter", useFastEnter);
  hoverPanel.classList.toggle("fast-enter", useFastEnter);
  hoverNameWrap.classList.toggle("visible", Boolean(hoveredNode));
  hoverPanel.classList.toggle("visible", Boolean(hoveredNode));
  hoverNameWrap.setAttribute("aria-hidden", hoveredNode ? "false" : "true");
  hoverPanel.setAttribute("aria-hidden", hoveredNode ? "false" : "true");

  if (hoveredNode) {
    clearTooltipContentCleanup();
    hoverName.textContent = hoveredNode.userData.node.name;
  }

  scheduleTooltipTypewriter(hoveredNode?.userData.node ?? null, useFastEnter);

  if (hoveredNode) {
    hoveredNode.material.emissiveIntensity = hoveredNode.userData.node.blackCore
      ? 0.18
      : 8.6 * hoveredNode.userData.node.glowBoost;
    hoveredNode.scale.setScalar(hoveredNode.userData.node.size);
    hoveredNode.userData.glow.scale.setScalar(hoveredNode.userData.glow.userData.baseScale);
    hoveredNode.userData.glow.material.opacity = 0.96;
  }
}

function scheduleTooltipTypewriter(node, immediate = false) {
  tooltipTypingToken += 1;
  const token = tooltipTypingToken;
  clearTooltipTyping();
  hoverPanel.classList.remove("typing", "typed");

  if (!node) {
    scheduleTooltipContentCleanup();
    return;
  }

  tooltipType.textContent = "";
  tooltipPlanets.textContent = "";
  const typeText = node.starType.toUpperCase();
  const planetsText = node.planets > 0 ? `${node.planets} PLANETS` : "";
  hoverPanel.classList.toggle("has-planets", Boolean(planetsText));
  const typewriterDelay = immediate ? 340 : 1580;
  tooltipTypingTimeout = window.setTimeout(() => {
    if (token !== tooltipTypingToken) {
      return;
    }

    hoverPanel.classList.add("typing");
    const fullText = planetsText ? `${typeText}\n${planetsText}` : typeText;
    let index = 0;

    tooltipTypingInterval = window.setInterval(() => {
      if (token !== tooltipTypingToken) {
        clearTooltipTyping();
        return;
      }

      index += 1;
      const typed = fullText.slice(0, index);
      const [typeLine = "", typedPlanetsLine] = typed.split("\n");
      const planetsLine = typedPlanetsLine ?? (planetsText ? "\u00a0" : "");
      tooltipType.textContent = typeLine;
      tooltipPlanets.textContent = planetsLine;

      if (index >= fullText.length) {
        clearTooltipTyping();
        hoverPanel.classList.remove("typing");
        hoverPanel.classList.add("typed");
      }
    }, 28);
  }, typewriterDelay);
}

function scheduleTooltipContentCleanup() {
  clearTooltipContentCleanup();
  tooltipClearTimeout = window.setTimeout(() => {
    hoverName.textContent = "";
    tooltipType.textContent = "";
    tooltipPlanets.textContent = "";
    hoverPanel.classList.remove("has-planets");
    tooltipClearTimeout = null;
  }, 560);
}

function clearTooltipContentCleanup() {
  if (tooltipClearTimeout) {
    window.clearTimeout(tooltipClearTimeout);
    tooltipClearTimeout = null;
  }
}

function clearTooltipTyping() {
  if (tooltipTypingTimeout) {
    window.clearTimeout(tooltipTypingTimeout);
    tooltipTypingTimeout = null;
  }
  if (tooltipTypingInterval) {
    window.clearInterval(tooltipTypingInterval);
    tooltipTypingInterval = null;
  }
}

function setSystemHover(body) {
  if (isPlanetWindowOpen) {
    body = null;
  }

  if (hoveredSystemBody === body) {
    return;
  }

  if (hoveredSystemBody?.userData?.label) {
    hoveredSystemBody.userData.label.classList.remove("hidden");
  }

  const previousHoveredBody = hoveredSystemBody;
  const isNewHoveredBody =
    Boolean(body) &&
    (!previousHoveredBody ||
      previousHoveredBody.dataset.name !== body.dataset.name);
  const isReturningDuringExit = Boolean(body && systemTooltipClearTimeout);
  const useFastEnter = isNewHoveredBody && (Boolean(previousHoveredBody) || isReturningDuringExit);

  hoveredSystemBody = body;
  systemHoverNameWrap.classList.toggle("fast-enter", useFastEnter);
  systemHoverPanel.classList.toggle("fast-enter", useFastEnter);
  systemHoverNameWrap.classList.toggle("visible", Boolean(hoveredSystemBody));
  systemHoverPanel.classList.toggle("visible", Boolean(hoveredSystemBody));
  systemHoverNameWrap.setAttribute("aria-hidden", hoveredSystemBody ? "false" : "true");
  systemHoverPanel.setAttribute("aria-hidden", hoveredSystemBody ? "false" : "true");

  if (hoveredSystemBody) {
    clearSystemTooltipContentCleanup();
    systemHoverName.textContent = hoveredSystemBody.dataset.name;
    hoveredSystemBody.userData?.label?.classList.add("hidden");
  }

  scheduleSystemTooltipTypewriter(hoveredSystemBody, useFastEnter);
}

function scheduleSystemTooltipTypewriter(body, immediate = false) {
  systemTooltipTypingToken += 1;
  const token = systemTooltipTypingToken;
  clearSystemTooltipTyping();
  systemHoverPanel.classList.remove("typing", "typed");

  if (!body) {
    scheduleSystemTooltipContentCleanup();
    return;
  }

  systemTooltipBody.replaceChildren();
  const lines = [body.dataset.kind];

  if (body.dataset.planets !== undefined) {
    const planets = Number(body.dataset.planets);
    if (planets > 0) {
      lines.push(`${planets} ${planets === 1 ? "PLANET" : "PLANETS"}`);
    }
  } else {
    const tags = body.dataset.tags
      ? body.dataset.tags.split("|").filter(Boolean)
      : [];
    lines.push(...tags);

    if (body.dataset.gravity) {
      lines.push(`g: ${body.dataset.gravity}`);
    }

    if (body.dataset.temperature) {
      lines.push(`t: ${body.dataset.temperature}\u00b0C`);
    }

    if (body.dataset.dayCycle) {
      lines.push(`D: ${body.dataset.dayCycle}h`);
    }
  }

  const typewriterDelay = immediate ? 340 : 1580;
  systemTooltipTypingTimeout = window.setTimeout(() => {
    if (token !== systemTooltipTypingToken) {
      return;
    }

    systemHoverPanel.classList.add("typing");
    const fullText = lines.join("\n");
    let index = 0;

    systemTooltipTypingInterval = window.setInterval(() => {
      if (token !== systemTooltipTypingToken) {
        clearSystemTooltipTyping();
        return;
      }

      index += 1;
      const typedLines = fullText.slice(0, index).split("\n");
      systemTooltipBody.replaceChildren(...typedLines.map((line, lineIndex) => {
        const element = document.createElement("div");
        element.className = lineIndex === 0 ? "tooltip__line tooltip__line--primary" : "tooltip__line";
        element.textContent = line || "\u00a0";
        return element;
      }));

      if (index >= fullText.length) {
        clearSystemTooltipTyping();
        systemHoverPanel.classList.remove("typing");
        systemHoverPanel.classList.add("typed");
      }
    }, 28);
  }, typewriterDelay);
}

function clearSystemHover() {
  if (hoveredSystemBody?.userData?.label) {
    hoveredSystemBody.userData.label.classList.remove("hidden");
  }
  hoveredSystemBody = null;
  systemHoverNameWrap.classList.remove("visible", "fast-enter");
  systemHoverPanel.classList.remove("visible", "fast-enter", "typing", "typed");
  systemHoverNameWrap.setAttribute("aria-hidden", "true");
  systemHoverPanel.setAttribute("aria-hidden", "true");
  scheduleSystemTooltipContentCleanup();
}

function scheduleSystemTooltipContentCleanup() {
  clearSystemTooltipContentCleanup();
  systemTooltipClearTimeout = window.setTimeout(() => {
    systemHoverName.textContent = "";
    systemTooltipBody.replaceChildren();
    systemTooltipClearTimeout = null;
  }, 560);
}

function clearSystemTooltipContentCleanup() {
  if (systemTooltipClearTimeout) {
    window.clearTimeout(systemTooltipClearTimeout);
    systemTooltipClearTimeout = null;
  }
}

function clearSystemTooltipTyping() {
  if (systemTooltipTypingTimeout) {
    window.clearTimeout(systemTooltipTypingTimeout);
    systemTooltipTypingTimeout = null;
  }
  if (systemTooltipTypingInterval) {
    window.clearInterval(systemTooltipTypingInterval);
    systemTooltipTypingInterval = null;
  }
}

function selectNodeAt(clientX, clientY) {
  if (systemScreenController.isGraphEntering()) {
    return;
  }

  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;

  const hit = getNodeHit() ?? getScreenNodeHit(clientX, clientY);
  if (!hit) {
    return;
  }

  if (!isMaskToolEnabled) {
    startGraphToSystemTransition(hit.userData.node, clientX, clientY);
    return;
  }

  const nodeId = hit.userData.node.id;
  const nodeColor = nodeColors.get(nodeId);

  if (nodeColor === currentMaskColor) {
    startNodeExitAnimation(nodeId, nodeColor);
    nodeColors.delete(nodeId);
    nodeAnimationProgress.delete(nodeId);
    removeEdgeAnimationsForNode(nodeId);
  } else {
    if (nodeColor) {
      startNodeExitAnimation(nodeId, nodeColor);
    } else {
      nodeExitAnimations.delete(nodeId);
    }
    nodeColors.set(nodeId, currentMaskColor);
    nodeAnimationProgress.set(nodeId, 0);
    addEdgeAnimationsForNode(nodeId, currentMaskColor);
  }

  updateUsedColorsUi();
}

function startGraphToSystemTransition(node, clientX, clientY) {
  if (systemScreenController.isGraphEntering() || systemScreenController.isOpen()) {
    return;
  }

  systemScreenController.setGraphEntering(true);
  cancelGraphDrag();
  rotationVelocity.set(0, 0);
  hoveredNode = null;
  hoverNameWrap.classList.remove("visible", "fast-enter");
  hoverPanel.classList.remove("visible", "fast-enter", "typing", "typed", "has-planets");
  scheduleTooltipContentCleanup();

  const centerX = clientX;
  const centerY = clientY;
  const diveDuration = 860;
  const revealDuration = 920;
  const startedAt = performance.now();

  graphEntryOverlay.style.setProperty("--entry-alpha", "0");
  graphEntryOverlay.classList.add("active");
  document.body.classList.add("graph-entry-moving");
  lockSystemPointer(sceneCanvas);
  setGraphEntryMotion(0, 0, 1, 0);

  const animateEntry = (now) => {
    const elapsed = now - startedAt;

    if (elapsed < diveDuration) {
      const progress = THREE.MathUtils.clamp(elapsed / diveDuration, 0, 1);
      const speedCurve = Math.pow(progress, 2.35);
      const darkCurve = Math.pow(progress, 1.22);
      graphEntryOverlay.style.setProperty("--entry-alpha", `${darkCurve}`);
      setGraphEntryMotion(
        (window.innerWidth / 2 - centerX) * speedCurve,
        (window.innerHeight / 2 - centerY) * speedCurve,
        1 + speedCurve * 9,
        speedCurve * 5,
        centerX,
        centerY,
      );
      requestAnimationFrame(animateEntry);
      return;
    }

    graphEntryOverlay.style.setProperty("--entry-alpha", "1");
    openStarWindow(node);
    updateSystemParallax(centerX, centerY, true);
    setGraphEntryMotion(0, 0, 1, 0);
    document.body.classList.remove("graph-entry-moving");

    const targetStarX = activeSystemStar.x;
    const entryOffsetX = window.innerWidth / 2 - targetStarX;
    setSystemTransitionOffset(entryOffsetX, 0);
    updateSystemGlow(centerX, centerY, entryOffsetX, 0);
    const revealStartedAt = performance.now();
    const animateReveal = (revealNow) => {
      const progress = THREE.MathUtils.clamp((revealNow - revealStartedAt) / revealDuration, 0, 1);
      const eased = easeOutCubic(progress);
      const offsetX = entryOffsetX * (1 - eased);
      setSystemTransitionOffset(offsetX, 0);
      updateSystemGlow(centerX, centerY, offsetX, 0);
      graphEntryOverlay.style.setProperty("--entry-alpha", `${1 - eased}`);

      if (progress < 1) {
        requestAnimationFrame(animateReveal);
        return;
      }

      setSystemTransitionOffset(0, 0);
      graphEntryOverlay.classList.remove("active");
      graphEntryOverlay.style.setProperty("--entry-alpha", "0");
      systemScreenController.setGraphEntering(false);
      updateSystemParallax(centerX, centerY);
      releaseSystemPointerLock();
    };

    requestAnimationFrame(animateReveal);
  };

  requestAnimationFrame(animateEntry);
}

function setGraphEntryMotion(x, y, scale, blur, originX = window.innerWidth / 2, originY = window.innerHeight / 2) {
  document.body.style.setProperty("--graph-entry-x", `${x}px`);
  document.body.style.setProperty("--graph-entry-y", `${y}px`);
  document.body.style.setProperty("--graph-entry-scale", String(scale));
  document.body.style.setProperty("--graph-entry-blur", `${blur}px`);
  document.body.style.setProperty("--graph-entry-origin-x", `${originX}px`);
  document.body.style.setProperty("--graph-entry-origin-y", `${originY}px`);
}

function openStarWindow(node) {
  systemScreenController.open(node);
  musicPlayerController.ensureSystemPosition();
  setSystemTransitionOffset(0, 0);
  setSystemTransitionOverlay(0);
  cancelGraphDrag();
  rotationVelocity.set(0, 0);
  targetRotation.set(graphRoot.rotation.x, graphRoot.rotation.y, graphRoot.rotation.z);
  sceneCanvas.classList.remove("dragging");
  hoveredNode = null;
  hoverNameWrap.classList.remove("visible", "fast-enter");
  hoverPanel.classList.remove("visible", "fast-enter", "typing", "typed", "has-planets");
  scheduleTooltipContentCleanup();
  renderStarSystem(node);
  renderSystemStars(node);
  renderSystemParticles(node);
  updateSystemGlow(window.innerWidth / 2, window.innerHeight / 2, 0, 0);
  preloadPlanetScreenRenderer();
}

function closeStarWindow() {
  cancelPlanetEntryTransition();
  systemScreenController.close();
  musicPlayerController.cancelDrag();
  musicPlayerController.closeDropdown();
  setSystemTransitionOffset(0, 0);
  setSystemTransitionOverlay(0);
  releaseSystemPointerLock();
  planetScreenController.close();
  closeObjectDetailScreen({ preserveTransitionOverlay: true });
  closePlanetWindow();
  activeSystemStar = null;
  activeSystemStarSurface = null;
  gasGiantTextureLayers.clear();
  planetSurfaceRotationLayers.clear();
  clearSystemHover();
  systemStars.replaceChildren();
  systemStarLayer.replaceChildren();
  systemParticles.replaceChildren();
  pointer.set(10, 10);
}

function cancelPlanetEntryTransition() {
  planetEntryTransitionToken += 1;
  isPlanetEntryTransitioning = false;
  starWindow.classList.remove("planet-entry-moving");
  planetEntryOverlay.classList.remove("active", "leaving");
  planetEntryOverlay.style.setProperty("--planet-entry-alpha", "0");
  starWindow.style.setProperty("--planet-entry-scale", "1");
}

async function loadPlanetScreenRenderer() {
  if (planetScreenRenderer) {
    return planetScreenRenderer;
  }

  if (!planetScreenRendererPromise) {
    planetScreenRendererPromise = import("./screens/planetScreenRenderer.js")
      .then(({ createPlanetScreenRenderer }) => {
        planetScreenRenderer = createPlanetScreenRenderer({
          root: planetScreen,
          controller: planetScreenController,
          seed: SEED,
          createSystemStarSurface,
          drawSystemStarSurface,
          onOpenObjectDetail: openObjectDetailFromPlanetView,
        });
        return planetScreenRenderer;
      })
      .catch((error) => {
        planetScreenRendererPromise = null;
        throw error;
      });
  }

  return planetScreenRendererPromise;
}

function preloadPlanetScreenRenderer() {
  loadPlanetScreenRenderer().catch((error) => {
    console.warn("Planet screen module preload failed", error);
  });
}

function renderPlanetScreenLoadFallback(planet) {
  planetScreenController.state.activeStar = null;
  planetScreenController.state.activeStarSurface = null;
  planetScreenController.clearRendered();

  const title = document.createElement("div");
  title.className = "planet-screen__title";
  title.textContent = planet.name;
  planetScreen.append(title);
}

async function returnToStarSystemFromPlanet() {
  const activeNode = systemScreenController.state.activeNode;
  if (!activeNode) {
    closeStarWindow();
    return;
  }

  cancelPlanetEntryTransition();
  await runPlanetScreenZoomOutTransition({
    originX: window.innerWidth / 2,
    originY: window.innerHeight / 2,
  });
  planetScreenController.close();
  closePlanetWindow();
  systemScreenController.open(activeNode);
  musicPlayerController.ensureSystemPosition();
  setSystemTransitionOffset(0, 0);
  setSystemTransitionOverlay(0);
  renderStarSystem(activeNode);
  renderSystemStars(activeNode);
  renderSystemParticles(activeNode);
  updateSystemGlow(window.innerWidth / 2, window.innerHeight / 2, 0, 0);
  updateSystemParallax(lastClientPointer.x, lastClientPointer.y, true);
  preloadPlanetScreenRenderer();
  snapPlanetScreenHidden();
  await revealObjectDetailEntryOverlay(300);
}

async function openObjectDetailFromPlanetView(detail, clientX = window.innerWidth / 2, clientY = window.innerHeight / 2) {
  if (!detail || !openPlanetData) {
    return;
  }

  objectDetailOrbitPlanet = openPlanetData;
  isObjectDetailOpen = true;
  objectDetailOptions.light = true;
  objectDetailOptions.clouds = true;
  starWindow.classList.add("object-detail-open");
  const detailToken = ++objectDetailToken;
  cancelPlanetEntryTransition();
  closePlanetWindow();
  disposeObjectDetail3D();
  objectDetailTexture.replaceChildren();
  objectDetailTexture.style.backgroundImage = "none";

  const origin = getObjectDetailEntryOrigin(detail, clientX, clientY);
  planetScreen.style.setProperty("--surface-entry-origin-x", `${origin.x}px`);
  planetScreen.style.setProperty("--surface-entry-origin-y", `${origin.y}px`);
  planetScreen.style.setProperty("--surface-entry-scale", "1");
  objectDetailEntryOverlay.classList.add("active");
  objectDetailEntryOverlay.style.setProperty("--surface-entry-alpha", "0");

  await nextAnimationFrame();
  if (!isObjectDetailOpen || detailToken !== objectDetailToken) {
    return;
  }

  planetScreen.classList.add("surface-entry-moving");
  planetScreen.style.setProperty("--surface-entry-scale", "7");
  objectDetailEntryOverlay.style.setProperty("--surface-entry-alpha", "1");

  await delay(420);
  if (!isObjectDetailOpen || detailToken !== objectDetailToken) {
    return;
  }

  planetScreenController.close();

  await nextAnimationFrame();
  if (!isObjectDetailOpen || detailToken !== objectDetailToken) {
    return;
  }

  renderObjectDetailContent(detail);
  objectDetailScreen.style.removeProperty("opacity");
  objectDetailScreen.style.removeProperty("transition");
  objectDetailScreen.classList.add("visible");
  objectDetailScreen.setAttribute("aria-hidden", "false");

  await nextAnimationFrame();
  if (!isObjectDetailOpen || detailToken !== objectDetailToken) {
    return;
  }

  resetTransitionSurfaces();
  objectDetailEntryOverlay.style.setProperty("--surface-entry-alpha", "0");
  await delay(240);
  if (!isObjectDetailOpen || detailToken !== objectDetailToken) {
    return;
  }

  objectDetailEntryOverlay.classList.remove("active");
  scheduleObjectDetailTextureUpgrade(detail, detailToken);
}

function getObjectDetailEntryOrigin(detail, clientX, clientY) {
  if (detail.kind === "PLANET" || detail.kind === "GAS GIANT") {
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight,
    };
  }

  return {
    x: THREE.MathUtils.clamp(clientX, 0, window.innerWidth),
    y: THREE.MathUtils.clamp(clientY, 0, window.innerHeight),
  };
}

function scheduleObjectDetailTextureUpgrade(detail, detailToken) {
  if (!detail?.createTexture) {
    return;
  }

  const runUpgrade = () => {
    if (!isObjectDetailOpen || detailToken !== objectDetailToken) {
      return;
    }

    const texture = detail.createTexture();
    if (!isObjectDetailOpen || detailToken !== objectDetailToken || !texture) {
      return;
    }

    if (typeof texture === "string") {
      detail.textureUrl = texture;
    } else {
      detail.textureUrl = texture.url ?? detail.textureUrl;
      detail.textureCanvas = texture.canvas ?? detail.textureCanvas;
      detail.cloudCanvas = texture.cloudCanvas ?? detail.cloudCanvas;
      detail.bumpCanvas = texture.bumpCanvas ?? detail.bumpCanvas;
      detail.emissiveCanvas = detail.kind === "MOON"
        ? null
        : texture.emissiveCanvas ?? detail.emissiveCanvas;
    }
    renderObjectDetailContent(detail);
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(runUpgrade, { timeout: 900 });
    return;
  }

  window.setTimeout(runUpgrade, 360);
}

function renderObjectDetailContent(detail) {
  disposeObjectDetail3D();
  objectDetailTexture.replaceChildren();
  objectDetailTexture.style.backgroundImage = "none";

  if ((detail.kind === "PLANET" || detail.kind === "GAS GIANT" || detail.kind === "MOON") && detail.textureCanvas) {
    renderObjectDetailPlanetSurface(detail);
    renderObjectDetailFrame(detail);
    return;
  }

  objectDetailTexture.style.backgroundImage = detail.textureUrl ?? "none";
  renderObjectDetailFlatHexGrid(detail);
  renderObjectDetailFrame(detail);
}

function renderObjectDetailFrame(detail) {
  const frame = document.createElement("div");
  frame.className = "object-detail-screen__frame";
  frame.style.color = detail.starGlowColor ?? "rgba(255, 255, 255, 0.92)";

  const topLine = document.createElement("div");
  topLine.className = "object-detail-screen__line object-detail-screen__line--top";
  const markerLayer = document.createElement("div");
  markerLayer.className = "object-detail-screen__marker-layer";
  for (let index = 0; index < 2; index += 1) {
    const marker = document.createElement("div");
    marker.className = `object-detail-screen__day-marker${detail.starBlackCore ? " black-hole" : ""}`;
    marker.innerHTML = `
      <span class="object-detail-screen__day-marker-mask"></span>
      <span class="object-detail-screen__day-marker-glow"></span>
      <svg class="object-detail-screen__day-marker-triangle" viewBox="0 0 9 7" aria-hidden="true">
        <path d="M1 1 L4.5 6 L8 1 Z" />
      </svg>
    `;
    markerLayer.append(marker);
  }

  const bottomLine = document.createElement("div");
  bottomLine.className = "object-detail-screen__line object-detail-screen__line--bottom";
  const title = document.createElement("div");
  title.className = "object-detail-screen__body-title";
  title.textContent = detail.name ?? "";
  const info = createObjectDetailInfo(detail);
  const controls = createObjectDetailOptionControls();

  frame.append(topLine, markerLayer, bottomLine, title, info, controls);
  objectDetailTexture.append(frame);
  updateObjectDetailFrame();
}

function createObjectDetailOptionControls() {
  const controls = document.createElement("div");
  controls.className = "object-detail-screen__options";
  controls.append(
    createObjectDetailOptionControl("LIGHT", "light"),
    createObjectDetailOptionControl("CLOUDS", "clouds"),
  );
  return controls;
}

function createObjectDetailOptionControl(labelText, optionKey) {
  const row = document.createElement("label");
  row.className = "object-detail-screen__option";
  const label = document.createElement("span");
  label.className = "object-detail-screen__option-label";
  label.textContent = labelText;
  const button = document.createElement("button");
  button.className = "object-detail-screen__option-button";
  button.type = "button";
  button.dataset.option = optionKey;
  button.setAttribute("aria-label", labelText);
  button.setAttribute("aria-pressed", String(Boolean(objectDetailOptions[optionKey])));
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setObjectDetailOption(optionKey, !objectDetailOptions[optionKey]);
  });
  row.append(label, button);
  return row;
}

function setObjectDetailOption(optionKey, isEnabled) {
  objectDetailOptions[optionKey] = Boolean(isEnabled);
  objectDetailTexture
    .querySelectorAll(`.object-detail-screen__option-button[data-option="${optionKey}"]`)
    .forEach((button) => {
      button.setAttribute("aria-pressed", String(Boolean(isEnabled)));
    });
  if (objectDetail3D) {
    objectDetail3D.targetLightMix = objectDetailOptions.light ? 1 : 0;
    objectDetail3D.targetCloudMix = objectDetailOptions.clouds ? 1 : 0;
  }
}

function createObjectDetailInfo(detail) {
  const info = document.createElement("div");
  info.className = "object-detail-screen__info";

  const columns = [
    [
      ["ATMO", formatObjectDetailAtmosphere(detail.atmosphere)],
      ["WATER", formatObjectDetailWater(detail.waterPosition)],
      ["GRAVITY", formatObjectDetailGravity(detail.gravity)],
    ],
    [
      ["DAY CYCLE", formatObjectDetailDayCycle(detail.dayCycleSeconds)],
      ["DAY TEMP", formatObjectDetailTemperature(detail.temperature)],
      ["NIGHT TEMP", formatObjectDetailTemperature(detail.temperature)],
    ],
  ];

  for (const rows of columns) {
    const column = document.createElement("dl");
    column.className = "object-detail-screen__info-column";
    for (const [labelText, valueText] of rows) {
      const row = document.createElement("div");
      row.className = "object-detail-screen__info-row";
      const label = document.createElement("dt");
      label.textContent = labelText;
      const value = document.createElement("dd");
      value.textContent = valueText;
      row.append(label, value);
      column.append(row);
    }
    info.append(column);
  }

  return info;
}

function formatObjectDetailAtmosphere(atmosphere) {
  if (atmosphere === "THIN ATMOSPHERE") {
    return "THIN";
  }
  if (atmosphere === "ATMOSPHERE") {
    return "STANDART";
  }
  if (atmosphere === "DENSE ATMOSPHERE") {
    return "DENSE";
  }
  return "NONE";
}

function formatObjectDetailWater(waterPosition) {
  if (!Number.isFinite(waterPosition) || waterPosition <= 0) {
    return "NONE";
  }
  return `${Math.round(waterPosition * 100)}%`;
}

function formatObjectDetailGravity(gravity) {
  if (!Number.isFinite(gravity)) {
    return "NONE";
  }
  return `${gravity.toFixed(2).replace(/\.?0+$/, "")}g`;
}

function formatObjectDetailDayCycle(dayCycleSeconds) {
  if (!Number.isFinite(dayCycleSeconds)) {
    return "\u221e";
  }
  return `${dayCycleSeconds.toFixed(1).replace(/\.0$/, "")}h`;
}

function formatObjectDetailTemperature(temperature) {
  if (!Number.isFinite(temperature)) {
    return "NONE";
  }
  return `${Math.round(temperature)}\u00b0C`;
}

function updateObjectDetailObservedBounds() {
  const rect = objectDetailTexture.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const bounds = getObjectDetailBoundRect(
    rect,
    OBJECT_DETAIL_OBSERVED_DEFAULT_WIDTH_PERCENT,
    OBJECT_DETAIL_OBSERVED_DEFAULT_HEIGHT_PERCENT,
  );

  objectDetailTexture.style.setProperty("--object-detail-observed-left", `${bounds.left}px`);
  objectDetailTexture.style.setProperty("--object-detail-observed-top", `${bounds.top}px`);
  objectDetailTexture.style.setProperty("--object-detail-observed-right", `${rect.width - bounds.right}px`);
  objectDetailTexture.style.setProperty("--object-detail-observed-bottom", `${rect.height - bounds.bottom}px`);
  return bounds;
}

function updateObjectDetailHoverBounds() {
  const rect = objectDetailTexture.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return getObjectDetailBoundRect(
    rect,
    OBJECT_DETAIL_HOVER_WIDTH_PERCENT,
    OBJECT_DETAIL_HOVER_HEIGHT_PERCENT,
  );
}

function getObjectDetailBoundRect(rect, widthPercent, heightPercent) {
  const rawBounds = objectDetail3D
    ? getObjectDetailProjectedSurfaceBounds(rect, widthPercent, heightPercent)
    : {
      left: 0,
      top: 0,
      right: rect.width,
      bottom: rect.height,
    };
  const left = THREE.MathUtils.clamp(
    Math.max(rawBounds.left, -rect.left),
    0,
    rect.width,
  );
  const right = THREE.MathUtils.clamp(
    Math.min(rawBounds.right, window.innerWidth - rect.left),
    left,
    rect.width,
  );
  const top = THREE.MathUtils.clamp(
    Math.max(rawBounds.top, -rect.top),
    0,
    rect.height,
  );
  const bottom = THREE.MathUtils.clamp(
    Math.min(rawBounds.bottom, window.innerHeight - rect.top),
    top,
    rect.height,
  );
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function getObjectDetailProjectedSurfaceBounds(rect, widthPercent, heightPercent) {
  const width = rect.width * widthPercent / 100;
  const height = rect.height * heightPercent / 100;
  const left = (rect.width - width) / 2;
  const right = left + width;
  const top = (rect.height - height) / 2;
  const bottom = top + height;
  return { left, top, right, bottom };
}

function renderObjectDetailFlatHexGrid(detail) {
  const canvas = document.createElement("canvas");
  canvas.className = "object-detail-screen__hex-overlay";
  canvas.width = OBJECT_DETAIL_HEX_GRID_TEXTURE_WIDTH;
  canvas.height = OBJECT_DETAIL_HEX_GRID_TEXTURE_HEIGHT;
  const hexes = drawObjectDetailHexGrid(canvas, detail.bodySizeRank);
  canvas.objectDetailHexes = hexes;
  canvas.dataset.hexCount = String(hexes.length);
  objectDetailTexture.append(canvas);
}

function closeObjectDetailScreen({ preserveTransitionOverlay = false, keepSystemHidden = false } = {}) {
  isObjectDetailOpen = false;
  objectDetailToken += 1;
  if (!keepSystemHidden) {
    starWindow.classList.remove("object-detail-open");
  }
  disposeObjectDetail3D();
  if (!preserveTransitionOverlay) {
    objectDetailEntryOverlay.classList.remove("active");
    objectDetailEntryOverlay.style.setProperty("--surface-entry-alpha", "0");
    planetScreen.classList.remove("surface-entry-moving");
    planetScreen.style.setProperty("--surface-entry-scale", "1");
    objectDetailScreen.classList.remove("object-detail-exit-moving");
    objectDetailScreen.style.setProperty("--object-detail-exit-scale", "1");
  }
  objectDetailScreen.classList.remove("visible");
  objectDetailScreen.setAttribute("aria-hidden", "true");
  objectDetailTexture.replaceChildren();
  objectDetailTexture.style.backgroundImage = "none";
}

function renderObjectDetailPlanetSurface(detail) {
  const canvas = document.createElement("canvas");
  canvas.className = "object-detail-screen__canvas";
  objectDetailTexture.append(canvas);

  const renderer3D = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer3D.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer3D.outputColorSpace = THREE.SRGBColorSpace;
  renderer3D.shadowMap.enabled = true;
  renderer3D.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene3D = new THREE.Scene();
  const camera3D = new THREE.OrthographicCamera(
    -OBJECT_DETAIL_CAMERA_HALF_WIDTH,
    OBJECT_DETAIL_CAMERA_HALF_WIDTH,
    OBJECT_DETAIL_CAMERA_HALF_HEIGHT,
    -OBJECT_DETAIL_CAMERA_HALF_HEIGHT,
    0.01,
    20,
  );
  camera3D.position.set(0, 0, 3);
  camera3D.lookAt(0, 0, 0);
  const ambientLight = new THREE.AmbientLight(0xffffff, OBJECT_DETAIL_AMBIENT_INTENSITY);
  scene3D.add(ambientLight);

  const colorMap = new THREE.CanvasTexture(detail.textureCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.ClampToEdgeWrapping;
  colorMap.anisotropy = Math.min(8, renderer3D.capabilities.getMaxAnisotropy());
  colorMap.needsUpdate = true;

  const heightMap = detail.bumpCanvas
    ? new THREE.CanvasTexture(detail.bumpCanvas)
    : null;
  if (heightMap) {
    heightMap.colorSpace = THREE.NoColorSpace;
    heightMap.wrapS = THREE.RepeatWrapping;
    heightMap.wrapT = THREE.ClampToEdgeWrapping;
    heightMap.needsUpdate = true;
  }
  const emissiveMap = detail.emissiveCanvas
    ? new THREE.CanvasTexture(detail.emissiveCanvas)
    : null;
  if (emissiveMap) {
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
    emissiveMap.wrapS = THREE.RepeatWrapping;
    emissiveMap.wrapT = THREE.ClampToEdgeWrapping;
    emissiveMap.anisotropy = Math.min(8, renderer3D.capabilities.getMaxAnisotropy());
    emissiveMap.needsUpdate = true;
  }
  const cloudMap = detail.cloudCanvas
    ? new THREE.CanvasTexture(detail.cloudCanvas)
    : null;
  if (cloudMap) {
    cloudMap.colorSpace = THREE.SRGBColorSpace;
    cloudMap.wrapS = THREE.RepeatWrapping;
    cloudMap.wrapT = THREE.ClampToEdgeWrapping;
    cloudMap.anisotropy = Math.min(8, renderer3D.capabilities.getMaxAnisotropy());
    cloudMap.needsUpdate = true;
  }

  const hasDisplacement = Boolean(heightMap);
  const geometry = hasDisplacement
    ? new THREE.PlaneGeometry(2, 1, 512, 256)
    : new THREE.PlaneGeometry(2, 1, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    map: colorMap,
    displacementMap: heightMap ?? undefined,
    displacementScale: hasDisplacement ? OBJECT_DETAIL_DISPLACEMENT_SCALE : 0,
    displacementBias: hasDisplacement ? -0.035 : 0,
    emissive: emissiveMap ? 0xffffff : 0x000000,
    emissiveMap: emissiveMap ?? undefined,
    emissiveIntensity: emissiveMap ? 0.59 : 0,
    roughness: 0.86,
    metalness: 0,
  });
  applyObjectDetailSurfaceEffects(material, cloudMap ?? colorMap, Boolean(cloudMap));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  scene3D.add(mesh);

  const hexGrid = createObjectDetailHexGrid(detail, renderer3D);
  scene3D.add(hexGrid.mesh);

  const cloudGeometry = cloudMap ? new THREE.PlaneGeometry(2, 1, 1, 1) : null;
  const cloudMaterial = cloudMap
    ? new THREE.MeshStandardMaterial({
      map: cloudMap,
      transparent: true,
      opacity: objectDetailOptions.clouds ? 1 : 0,
      alphaTest: OBJECT_DETAIL_CLOUD_ALPHA_TEST,
      depthWrite: false,
      roughness: 0.9,
      metalness: 0,
    })
    : null;
  if (cloudMaterial) {
    applyObjectDetailCloudClear(cloudMaterial);
  }
  const cloudDepthMaterial = cloudMap
    ? new THREE.MeshDepthMaterial({
      map: cloudMap,
      alphaTest: OBJECT_DETAIL_CLOUD_ALPHA_TEST,
      depthPacking: THREE.RGBADepthPacking,
    })
    : null;
  let cloudMesh = null;
  if (cloudGeometry && cloudMaterial && cloudDepthMaterial) {
    cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    cloudMesh.position.z = OBJECT_DETAIL_CLOUD_HEIGHT;
    cloudMesh.castShadow = true;
    cloudMesh.receiveShadow = false;
    cloudMesh.customDepthMaterial = cloudDepthMaterial;
    cloudMesh.renderOrder = 2;
    scene3D.add(cloudMesh);
  }

  const lightDaySeconds = detail.dayCycleSeconds === Infinity
    ? Infinity
    : Number.isFinite(detail.dayCycleSeconds)
      ? Math.max(0.001, detail.dayCycleSeconds)
      : OBJECT_DETAIL_LIGHT_FALLBACK_DAY_SECONDS;
  const spotStartXs = detail.kind === "MOON"
    ? [-OBJECT_DETAIL_SURFACE_WORLD_WIDTH, 0]
    : lightDaySeconds === Infinity
      ? [-0.94, 0.94]
      : [-1, 1];
  const spotLights = spotStartXs.map((startX) => {
    const target = new THREE.Object3D();
    target.position.set(startX, 0, 0);
    scene3D.add(target);

    const light = new THREE.SpotLight(
      0xffffff,
      OBJECT_DETAIL_LIGHT_INTENSITY,
      8,
      THREE.MathUtils.degToRad(OBJECT_DETAIL_LIGHT_ANGLE_DEGREES),
      OBJECT_DETAIL_LIGHT_PENUMBRA,
      0.8,
    );
    light.position.set(startX, 0, OBJECT_DETAIL_LIGHT_Z);
    light.target = target;
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.00008;
    light.shadow.normalBias = 0.015;
    scene3D.add(light);

    const tintLight = new THREE.SpotLight(
      new THREE.Color(detail.starGlowColor ?? "#ffffff"),
      OBJECT_DETAIL_TINT_LIGHT_INTENSITY,
      8,
      THREE.MathUtils.degToRad(OBJECT_DETAIL_TINT_LIGHT_ANGLE_DEGREES),
      OBJECT_DETAIL_TINT_LIGHT_PENUMBRA,
      0.8,
    );
    tintLight.position.set(startX, 0, OBJECT_DETAIL_LIGHT_Z);
    tintLight.target = target;
    tintLight.castShadow = false;
    scene3D.add(tintLight);
    return { light, tintLight, target, startX };
  });

  const cursorTarget = new THREE.Object3D();
  cursorTarget.position.set(0, 0, 0);
  scene3D.add(cursorTarget);
  const cursorLight = new THREE.SpotLight(
    0xffffff,
    0,
    8,
    THREE.MathUtils.degToRad(OBJECT_DETAIL_CURSOR_LIGHT_ANGLE_DEGREES),
    OBJECT_DETAIL_CURSOR_LIGHT_PENUMBRA,
    0.8,
  );
  cursorLight.position.set(0, 0, OBJECT_DETAIL_LIGHT_Z);
  cursorLight.target = cursorTarget;
  cursorLight.castShadow = false;
  scene3D.add(cursorLight);

  objectDetail3D = {
    renderer: renderer3D,
    scene: scene3D,
    camera: camera3D,
    geometry,
    material,
    colorMap,
    heightMap,
    emissiveMap,
    isGasGiant: detail.kind === "GAS GIANT",
    hexGrid,
    cloudMap,
    cloudGeometry,
    cloudMaterial,
    cloudDepthMaterial,
    cloudMesh,
    ambientLight,
    spotLights,
    cursorLight,
    cursorTarget,
    cursorLightIntensity: 0,
    cursorEffectMix: 0,
    cursorLightUpdatedAt: performance.now(),
    lightMix: objectDetailOptions.light ? 1 : 0,
    targetLightMix: objectDetailOptions.light ? 1 : 0,
    cloudMix: objectDetailOptions.clouds ? 1 : 0,
    targetCloudMix: objectDetailOptions.clouds ? 1 : 0,
    optionMixUpdatedAt: performance.now(),
    cursor: {
      active: false,
      uv: new THREE.Vector2(0.5, 0.5),
      world: new THREE.Vector2(0, 0),
      clearRadius: OBJECT_DETAIL_CURSOR_CLEAR_RADIUS,
      clearFeather: OBJECT_DETAIL_CURSOR_CLEAR_FEATHER,
    },
    lightStartedAt: performance.now(),
    lightDaySeconds,
    bodyTextureCycleSeconds: detail.kind === "GAS GIANT"
      ? OBJECT_DETAIL_GAS_GIANT_TEXTURE_CYCLE_SECONDS
      : Infinity,
    cloudCycleSeconds: detail.kind === "GAS GIANT"
      ? OBJECT_DETAIL_GAS_GIANT_CLOUD_CYCLE_SECONDS
      : OBJECT_DETAIL_CLOUD_CYCLE_SECONDS,
  };

  resizeObjectDetail3D();
  updateObjectDetailLightMotion(performance.now());
  renderObjectDetail3D();
}

function resizeObjectDetail3D() {
  if (!objectDetail3D) {
    return;
  }

  const rect = objectDetailTexture.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  objectDetail3D.renderer.setSize(width, height, false);
  objectDetail3D.camera.updateProjectionMatrix();
  updateObjectDetailObservedBounds();
  updateObjectDetailHoverBounds();
}

function renderObjectDetail3D() {
  if (!objectDetail3D) {
    return;
  }

  objectDetail3D.renderer.render(objectDetail3D.scene, objectDetail3D.camera);
}

function updateObjectDetailCursorInteraction(event) {
  if (!objectDetail3D?.cursor || !isObjectDetailOpen) {
    return;
  }

  const rect = objectDetailTexture.getBoundingClientRect();
  const bounds = updateObjectDetailHoverBounds();
  if (rect.width <= 0 || rect.height <= 0 || !bounds) {
    return;
  }
  const left = rect.left + bounds.left;
  const right = rect.left + bounds.right;
  const top = rect.top + bounds.top;
  const bottom = rect.top + bounds.bottom;
  const rawU = (event.clientX - left) / bounds.width;
  const rawScreenV = (event.clientY - top) / bounds.height;
  const insideHoverZone = rawU >= 0 && rawU <= 1 && rawScreenV >= 0 && rawScreenV <= 1;
  const shaderU = THREE.MathUtils.clamp(rawU, 0, 1);
  const shaderScreenV = THREE.MathUtils.clamp(rawScreenV, 0, 1);
  const textureV = 1 - shaderScreenV;
  const worldX = (rawU - 0.5) * OBJECT_DETAIL_SURFACE_WORLD_WIDTH;
  const worldY = 0.5 - rawScreenV;
  objectDetail3D.cursor.active = insideHoverZone;
  objectDetail3D.cursor.uv.set(shaderU, textureV);
  objectDetail3D.cursor.world.set(worldX, worldY);
  updateObjectDetailCursorLight(performance.now());
  updateObjectDetailCursorUniforms();
  renderObjectDetail3D();
}

function clearObjectDetailCursorInteraction() {
  if (!objectDetail3D?.cursor) {
    return;
  }

  objectDetail3D.cursor.active = false;
  updateObjectDetailCursorLight(performance.now());
  updateObjectDetailCursorUniforms();
  renderObjectDetail3D();
}

function updateObjectDetailCursorLight(now = performance.now()) {
  if (!objectDetail3D?.cursorLight || !objectDetail3D?.cursorTarget || !objectDetail3D?.cursor) {
    return;
  }

  const { active, world } = objectDetail3D.cursor;
  const x = world.x;
  const y = world.y;
  objectDetail3D.cursorLight.position.set(x, y, OBJECT_DETAIL_LIGHT_Z);
  objectDetail3D.cursorTarget.position.set(x, y, 0);
  const lightMix = THREE.MathUtils.clamp(objectDetail3D.lightMix ?? 1, 0, 1);
  const targetIntensity = active
    ? OBJECT_DETAIL_CURSOR_LIGHT_INTENSITY * getObjectDetailCursorLightProximityMultiplier(world) * lightMix
    : 0;
  const previous = objectDetail3D.cursorLightUpdatedAt ?? now;
  const deltaSeconds = Math.max(0, (now - previous) / 1000);
  const fadeSpeed = active
    ? OBJECT_DETAIL_CURSOR_LIGHT_FADE_IN_SPEED
    : OBJECT_DETAIL_CURSOR_LIGHT_FADE_OUT_SPEED;
  const smoothing = 1 - Math.exp(-fadeSpeed * deltaSeconds);
  objectDetail3D.cursorLightIntensity = THREE.MathUtils.lerp(
    objectDetail3D.cursorLightIntensity ?? 0,
    targetIntensity,
    smoothing,
  );
  objectDetail3D.cursorEffectMix = THREE.MathUtils.lerp(
    objectDetail3D.cursorEffectMix ?? 0,
    active ? 1 : 0,
    smoothing,
  );
  objectDetail3D.cursorLight.intensity = objectDetail3D.cursorLightIntensity;
  objectDetail3D.cursorLightUpdatedAt = now;
}

function getObjectDetailCursorLightProximityMultiplier(world) {
  if (!objectDetail3D?.spotLights?.length) {
    return 1;
  }

  const daySpotRadius = OBJECT_DETAIL_LIGHT_Z * Math.tan(THREE.MathUtils.degToRad(OBJECT_DETAIL_LIGHT_ANGLE_DEGREES));
  const nearestFactor = objectDetail3D.spotLights.reduce((factor, item) => {
    const distance = Math.hypot(world.x - item.target.position.x, world.y - item.target.position.y);
    const proximity = 1 - THREE.MathUtils.smoothstep(distance, daySpotRadius * 0.25, daySpotRadius);
    return Math.max(factor, proximity);
  }, 0);
  return THREE.MathUtils.lerp(1, OBJECT_DETAIL_CURSOR_LIGHT_MIN_PROXIMITY, nearestFactor);
}

function updateObjectDetailLightMotion(now) {
  if (!objectDetail3D?.spotLights) {
    return false;
  }

  updateObjectDetailOptionMixes(now);
  const elapsedSeconds = (now - objectDetail3D.lightStartedAt) / 1000;
  const speed = Number.isFinite(objectDetail3D.lightDaySeconds)
    ? OBJECT_DETAIL_SURFACE_WORLD_WIDTH / objectDetail3D.lightDaySeconds
    : 0;
  for (const item of objectDetail3D.spotLights) {
    const x = wrapObjectDetailLightX(item.startX + elapsedSeconds * speed);
    item.light.position.set(x, 0, OBJECT_DETAIL_LIGHT_Z);
    item.tintLight.position.set(x, 0, OBJECT_DETAIL_LIGHT_Z);
    item.target.position.set(x, 0, 0);
  }
  updateObjectDetailCursorLight(now);
  if (Number.isFinite(objectDetail3D.bodyTextureCycleSeconds)) {
    const bodyPhase = elapsedSeconds / objectDetail3D.bodyTextureCycleSeconds;
    objectDetail3D.colorMap.offset.x = ((bodyPhase % 1) + 1) % 1;
  }
  if (objectDetail3D.cloudMap) {
    const cloudCycleSeconds = Number.isFinite(objectDetail3D.cloudCycleSeconds)
      ? objectDetail3D.cloudCycleSeconds
      : OBJECT_DETAIL_CLOUD_CYCLE_SECONDS;
    const cloudPhase = elapsedSeconds / cloudCycleSeconds;
    objectDetail3D.cloudMap.offset.x = ((cloudPhase % 1) + 1) % 1;
  }
  updateObjectDetailSurfaceEffectUniforms();
  updateObjectDetailFrame();
  return true;
}

function updateObjectDetailFrame() {
  updateObjectDetailObservedBounds();
  updateObjectDetailHoverBounds();
  const markers = objectDetailTexture.querySelectorAll(".object-detail-screen__day-marker");
  if (!markers.length || !objectDetail3D?.spotLights?.length) {
    return;
  }

  objectDetail3D.spotLights.forEach((item, index) => {
    const marker = markers[index];
    if (!marker) {
      return;
    }
    const relative = (item.target.position.x + OBJECT_DETAIL_SURFACE_WORLD_WIDTH / 2) / OBJECT_DETAIL_SURFACE_WORLD_WIDTH;
    const edgeScale = Math.min(
      THREE.MathUtils.smoothstep(relative, 0, OBJECT_DETAIL_DAY_MARKER_EDGE_FADE),
      1 - THREE.MathUtils.smoothstep(relative, 1 - OBJECT_DETAIL_DAY_MARKER_EDGE_FADE, 1),
    );
    marker.style.left = `${THREE.MathUtils.clamp(relative, 0, 1) * 100}%`;
    marker.style.visibility = relative >= 0 && relative <= 1 ? "visible" : "hidden";
    marker.style.setProperty("--object-detail-day-marker-edge-scale", String(edgeScale));
  });
}

function updateObjectDetailOptionMixes(now = performance.now()) {
  if (!objectDetail3D) {
    return;
  }

  const previous = objectDetail3D.optionMixUpdatedAt ?? now;
  const deltaSeconds = Math.max(0, (now - previous) / 1000);
  const smoothing = 1 - Math.exp(-OBJECT_DETAIL_OPTION_FADE_SPEED * deltaSeconds);
  objectDetail3D.lightMix = THREE.MathUtils.lerp(
    objectDetail3D.lightMix ?? 1,
    objectDetail3D.targetLightMix ?? 1,
    smoothing,
  );
  objectDetail3D.cloudMix = THREE.MathUtils.lerp(
    objectDetail3D.cloudMix ?? 1,
    objectDetail3D.targetCloudMix ?? 1,
    smoothing,
  );
  objectDetail3D.optionMixUpdatedAt = now;

  const lightMix = THREE.MathUtils.clamp(objectDetail3D.lightMix, 0, 1);
  const cloudMix = THREE.MathUtils.clamp(objectDetail3D.cloudMix, 0, 1);
  objectDetail3D.ambientLight.intensity = THREE.MathUtils.lerp(
    OBJECT_DETAIL_AMBIENT_NO_LIGHT_INTENSITY,
    OBJECT_DETAIL_AMBIENT_INTENSITY,
    lightMix,
  );
  for (const item of objectDetail3D.spotLights) {
    item.light.intensity = OBJECT_DETAIL_LIGHT_INTENSITY * lightMix;
    item.tintLight.intensity = OBJECT_DETAIL_TINT_LIGHT_INTENSITY * lightMix;
  }
  if (objectDetail3D.cloudMaterial) {
    objectDetail3D.cloudMaterial.opacity = cloudMix;
  }
  if (objectDetail3D.cloudMesh) {
    objectDetail3D.cloudMesh.visible = cloudMix > 0.01;
    objectDetail3D.cloudMesh.castShadow = cloudMix > 0.04;
  }
}

function wrapObjectDetailLightX(x) {
  const rightEdge = OBJECT_DETAIL_SURFACE_WORLD_WIDTH / 2 + OBJECT_DETAIL_LIGHT_WRAP_MARGIN;
  const wrapSpan = OBJECT_DETAIL_SURFACE_WORLD_WIDTH * 2;
  let wrapped = x;
  while (wrapped > rightEdge) {
    wrapped -= wrapSpan;
  }
  return wrapped;
}

function createObjectDetailHexGrid(detail, renderer3D) {
  const canvas = document.createElement("canvas");
  canvas.width = OBJECT_DETAIL_HEX_GRID_TEXTURE_WIDTH;
  canvas.height = OBJECT_DETAIL_HEX_GRID_TEXTURE_HEIGHT;
  const hexes = drawObjectDetailHexGrid(canvas, detail.bodySizeRank);
  canvas.objectDetailHexes = hexes;
  canvas.dataset.hexCount = String(hexes.length);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer3D.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;

  const geometry = new THREE.PlaneGeometry(2, 1, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = OBJECT_DETAIL_HEX_GRID_HEIGHT;
  mesh.renderOrder = 1;
  return { canvas, texture, geometry, material, mesh, hexes };
}

function drawObjectDetailHexGrid(canvas, bodySizeRank = 12) {
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = "rgba(216, 238, 255, 0.5)";
  context.lineWidth = 1.15;
  context.shadowColor = "rgba(60, 170, 255, 0.12)";
  context.shadowBlur = 3;

  const rank = THREE.MathUtils.clamp(Math.round(bodySizeRank), 0, 12);
  const columns = 7 + rank * 2;
  const horizontalPadding = width * 0.006;
  const hexRadius = (width - horizontalPadding * 2) / (1.5 * (columns - 1) + 2);
  const hexHeight = Math.sqrt(3) * hexRadius;
  const hexHalfHeight = hexHeight / 2;
  const horizontalStep = hexRadius * 1.5;
  const verticalStep = hexHeight;
  const rows = Math.max(1, Math.floor((height - hexHeight) / verticalStep) + 1);
  const startX = horizontalPadding + hexRadius;
  const gridHeight = hexHeight + Math.max(0, rows - 1) * verticalStep;
  const startY = hexHalfHeight + Math.max(0, (height - gridHeight) / 2);
  const hexes = [];

  for (let column = 0; column < columns; column += 1) {
    const centerX = startX + column * horizontalStep;
    const columnOffset = column % 2 === 0 ? 0 : verticalStep / 2;
    for (let row = 0; row < rows; row += 1) {
      const centerY = startY + row * verticalStep + columnOffset;
      if (!isObjectDetailHexFullyVisible(centerX, centerY, hexRadius, hexHalfHeight, width, height)) {
        continue;
      }
      const address = `${column}:${row}`;
      hexes.push({ address, column, row, x: centerX / width, y: centerY / height });
      drawObjectDetailHex(context, centerX, centerY, hexRadius);
    }
  }
  return hexes;
}

function drawObjectDetailHex(context, centerX, centerY, radius) {
  context.beginPath();
  for (let index = 0; index < 6; index += 1) {
    const angle = THREE.MathUtils.degToRad(60 * index);
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.closePath();
  context.stroke();
}

function isObjectDetailHexFullyVisible(centerX, centerY, radius, halfHeight, width, height) {
  return centerX - radius >= 0
    && centerX + radius <= width
    && centerY - halfHeight >= 0
    && centerY + halfHeight <= height;
}

function applyObjectDetailSurfaceEffects(material, cloudMap, hasCloudShadow) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.detailCloudShadowMap = { value: cloudMap };
    shader.uniforms.detailHasCloudShadow = { value: hasCloudShadow ? 1 : 0 };
    shader.uniforms.detailCloudShadowTextureOffset = { value: new THREE.Vector2(0, 0) };
    shader.uniforms.detailCloudShadowOffset = {
      value: new THREE.Vector2(OBJECT_DETAIL_CLOUD_SHADOW_OFFSET_U, OBJECT_DETAIL_CLOUD_SHADOW_OFFSET_V),
    };
    shader.uniforms.detailCloudShadowStrength = { value: OBJECT_DETAIL_CLOUD_SHADOW_STRENGTH };
    shader.uniforms.detailCloudShadowDarken = { value: OBJECT_DETAIL_CLOUD_SHADOW_DARKEN };
    shader.uniforms.detailCursorUv = { value: new THREE.Vector2(0.5, 0.5) };
    shader.uniforms.detailCursorActive = { value: 0 };
    shader.uniforms.detailCursorClearRadius = { value: OBJECT_DETAIL_CURSOR_CLEAR_RADIUS };
    shader.uniforms.detailCursorClearFeather = { value: OBJECT_DETAIL_CURSOR_CLEAR_FEATHER };
    shader.uniforms.detailLightMaxChannel = { value: OBJECT_DETAIL_LIGHT_MAX_CHANNEL };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vDetailCloudShadowUv;
`,
      )
      .replace(
        "#include <project_vertex>",
        `vDetailCloudShadowUv = uv;
#include <project_vertex>`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform sampler2D detailCloudShadowMap;
uniform float detailHasCloudShadow;
uniform vec2 detailCloudShadowTextureOffset;
uniform vec2 detailCloudShadowOffset;
uniform float detailCloudShadowStrength;
uniform float detailCloudShadowDarken;
uniform vec2 detailCursorUv;
uniform float detailCursorActive;
uniform float detailCursorClearRadius;
uniform float detailCursorClearFeather;
uniform float detailLightMaxChannel;
varying vec2 vDetailCloudShadowUv;
`,
      )
      .replace(
        "#include <dithering_fragment>",
        `vec2 detailAspectUv = vec2((vDetailCloudShadowUv.x - detailCursorUv.x) * 2.0, vDetailCloudShadowUv.y - detailCursorUv.y);
float detailCursorDistance = length(detailAspectUv);
float detailCursorClear = mix(1.0, smoothstep(detailCursorClearRadius, detailCursorClearRadius + detailCursorClearFeather, detailCursorDistance), detailCursorActive);
float detailCloudShadowAlpha = texture2D(detailCloudShadowMap, vDetailCloudShadowUv + detailCloudShadowTextureOffset + detailCloudShadowOffset).a * detailCursorClear;
float detailCloudShadow = clamp(detailCloudShadowAlpha * detailCloudShadowStrength * detailHasCloudShadow, 0.0, 1.0);
gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * detailCloudShadowDarken, detailCloudShadow);
float detailLightMax = max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b);
if (detailLightMax > detailLightMaxChannel) {
  gl_FragColor.rgb *= detailLightMaxChannel / detailLightMax;
}
#include <dithering_fragment>`,
      );
    material.userData.detailSurfaceEffectShader = shader;
    updateObjectDetailSurfaceEffectUniforms();
  };
}

function applyObjectDetailCloudClear(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.detailCursorUv = { value: new THREE.Vector2(0.5, 0.5) };
    shader.uniforms.detailCursorActive = { value: 0 };
    shader.uniforms.detailCursorClearRadius = { value: OBJECT_DETAIL_CURSOR_CLEAR_RADIUS };
    shader.uniforms.detailCursorClearFeather = { value: OBJECT_DETAIL_CURSOR_CLEAR_FEATHER };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vDetailCursorCloudUv;`,
      )
      .replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
vDetailCursorCloudUv = uv;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform vec2 detailCursorUv;
uniform float detailCursorActive;
uniform float detailCursorClearRadius;
uniform float detailCursorClearFeather;
varying vec2 vDetailCursorCloudUv;`,
      )
      .replace(
        "#include <alphatest_fragment>",
        `vec2 detailCursorCloudAspectUv = vec2((vDetailCursorCloudUv.x - detailCursorUv.x) * 2.0, vDetailCursorCloudUv.y - detailCursorUv.y);
float detailCursorCloudDistance = length(detailCursorCloudAspectUv);
float detailCursorCloudKeep = mix(1.0, smoothstep(detailCursorClearRadius, detailCursorClearRadius + detailCursorClearFeather, detailCursorCloudDistance), detailCursorActive);
diffuseColor.a *= detailCursorCloudKeep;
#include <alphatest_fragment>`,
      );
    material.userData.detailCloudClearShader = shader;
    updateObjectDetailCursorUniforms();
  };
}

function updateObjectDetailSurfaceEffectUniforms() {
  const shader = objectDetail3D?.material?.userData.detailSurfaceEffectShader;
  if (!shader || !objectDetail3D?.spotLights?.length) {
    return;
  }

  shader.uniforms.detailCloudShadowTextureOffset.value.set(objectDetail3D.cloudMap?.offset.x ?? 0, 0);
  shader.uniforms.detailCloudShadowStrength.value = OBJECT_DETAIL_CLOUD_SHADOW_STRENGTH
    * THREE.MathUtils.clamp(objectDetail3D.cloudMix ?? 1, 0, 1);
  updateObjectDetailCursorUniforms();
}

function updateObjectDetailCursorUniforms() {
  if (!objectDetail3D?.cursor) {
    return;
  }

  const { uv, clearRadius, clearFeather } = objectDetail3D.cursor;
  const activeMix = objectDetail3D.cursorEffectMix ?? 0;
  for (const shader of [
    objectDetail3D.material?.userData.detailSurfaceEffectShader,
    objectDetail3D.cloudMaterial?.userData.detailCloudClearShader,
  ]) {
    if (!shader) {
      continue;
    }
    shader.uniforms.detailCursorActive.value = activeMix;
    shader.uniforms.detailCursorUv.value.copy(uv);
    shader.uniforms.detailCursorClearRadius.value = clearRadius;
    shader.uniforms.detailCursorClearFeather.value = clearFeather;
  }
}

function disposeObjectDetail3D() {
  if (!objectDetail3D) {
    return;
  }

  objectDetail3D.geometry.dispose();
  objectDetail3D.material.dispose();
  objectDetail3D.colorMap.dispose();
  objectDetail3D.heightMap?.dispose();
  objectDetail3D.emissiveMap?.dispose();
  objectDetail3D.hexGrid?.texture.dispose();
  objectDetail3D.hexGrid?.geometry.dispose();
  objectDetail3D.hexGrid?.material.dispose();
  objectDetail3D.cloudMap?.dispose();
  objectDetail3D.cloudGeometry?.dispose();
  objectDetail3D.cloudMaterial?.dispose();
  objectDetail3D.cloudDepthMaterial?.dispose();
  objectDetail3D.renderer.dispose();
  objectDetail3D.renderer.forceContextLoss();
  objectDetail3D.renderer.domElement = null;
  objectDetail3D = null;
}

async function returnToOrbitFromObjectDetail() {
  const planet = objectDetailOrbitPlanet;
  if (!planet) {
    closeObjectDetailScreen();
    return;
  }

  await runObjectDetailZoomOutTransition();
  closeObjectDetailScreen({ preserveTransitionOverlay: true, keepSystemHidden: true });

  try {
    await loadPlanetScreenRenderer();
  } catch (error) {
    console.error("Planet screen module failed to load", error);
  }
  planetScreenController.open(planet);
  starWindow.classList.remove("object-detail-open");
  planetScreenController.updateParallax(lastClientPointer.x, lastClientPointer.y);
  resetTransitionSurfaces();
  snapObjectDetailHidden();
  await revealObjectDetailEntryOverlay(260);
}

async function runPlanetScreenZoomOutTransition({ originX, originY }) {
  planetScreen.style.setProperty("--surface-entry-origin-x", `${originX}px`);
  planetScreen.style.setProperty("--surface-entry-origin-y", `${originY}px`);
  planetScreen.style.setProperty("--surface-entry-scale", "1");
  objectDetailEntryOverlay.classList.add("active");
  objectDetailEntryOverlay.style.setProperty("--surface-entry-alpha", "0");
  await nextAnimationFrame();
  planetScreen.classList.add("surface-entry-moving");
  planetScreen.style.setProperty("--surface-entry-scale", "0.08");
  objectDetailEntryOverlay.style.setProperty("--surface-entry-alpha", "1");
  await delay(500);
}

async function runObjectDetailZoomOutTransition() {
  objectDetailScreen.style.setProperty("--object-detail-exit-scale", "1");
  objectDetailEntryOverlay.classList.add("active");
  objectDetailEntryOverlay.style.setProperty("--surface-entry-alpha", "0");
  await nextAnimationFrame();
  objectDetailScreen.classList.add("object-detail-exit-moving");
  objectDetailScreen.style.setProperty("--object-detail-exit-scale", "0.08");
  objectDetailEntryOverlay.style.setProperty("--surface-entry-alpha", "1");
  await delay(500);
}

async function revealObjectDetailEntryOverlay(duration = 360) {
  await nextAnimationFrame();
  objectDetailEntryOverlay.style.setProperty("--surface-entry-alpha", "0");
  await delay(duration);
  objectDetailEntryOverlay.classList.remove("active");
  planetScreen.style.removeProperty("opacity");
  planetScreen.style.removeProperty("transition");
  objectDetailScreen.style.removeProperty("opacity");
  objectDetailScreen.style.removeProperty("transition");
}

function resetTransitionSurfaces() {
  planetScreen.classList.remove("surface-entry-moving");
  planetScreen.style.setProperty("--surface-entry-scale", "1");
  objectDetailScreen.classList.remove("object-detail-exit-moving");
  objectDetailScreen.style.setProperty("--object-detail-exit-scale", "1");
}

function snapObjectDetailHidden() {
  objectDetailScreen.style.transition = "none";
  objectDetailScreen.style.opacity = "0";
  objectDetailScreen.classList.remove("visible");
  void objectDetailScreen.offsetWidth;
}

function snapPlanetScreenHidden() {
  planetScreen.style.transition = "none";
  planetScreen.style.opacity = "0";
  planetScreen.classList.remove("surface-entry-moving");
  planetScreen.style.setProperty("--surface-entry-scale", "1");
  void planetScreen.offsetWidth;
}

function renderSystemStars(node) {
  systemStars.replaceChildren();
  const random = createRandom(`${SEED}:system-stars:${node.id}`);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const overscan = 96;
  const starCount = 160;

  for (let index = 0; index < starCount; index += 1) {
    const star = document.createElement("span");
    const depth = random();
    const size = depth > 0.92 ? 2 : 1;
    star.className = "system-bg-star";
    star.style.left = `${random() * (width + overscan * 2)}px`;
    star.style.top = `${random() * (height + overscan * 2)}px`;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.opacity = `${0.22 + random() * 0.58}`;
    star.style.setProperty("--depth", `${0.25 + depth * 0.75}`);
    systemStars.append(star);
  }
}

function renderSystemParticles(node) {
  systemParticles.replaceChildren();
  const random = createRandom(`${SEED}:system-particles:${node.id}`);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const overscan = 128;
  const particleCount = 95;

  for (let index = 0; index < particleCount; index += 1) {
    const particle = document.createElement("span");
    const depth = random();
    const size = 1 + random() * 1.4;
    particle.className = "system-particle";
    particle.style.left = `${random() * (width + overscan * 2)}px`;
    particle.style.top = `${random() * (height + overscan * 2)}px`;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.opacity = `${0.16 + random() * 0.34}`;
    particle.style.setProperty("--depth", `${0.45 + depth * 0.75}`);
    systemParticles.append(particle);
  }
}

function updateSystemParallax(clientX, clientY, force = false) {
  if (!systemScreenController.isOpen()) {
    return;
  }

  if (!force && isPlanetEntryTransitioning) {
    return;
  }

  if (planetScreenController.isOpen()) {
    planetScreenController.updateParallax(clientX, clientY);
    return;
  }

  if (!force && (systemScreenController.isTransitioning() || systemScreenController.isGraphEntering())) {
    return;
  }

  positionSystemTooltip(clientX, clientY);
  const offsetX = (clientX / window.innerWidth - 0.5) * -30;
  const offsetY = (clientY / window.innerHeight - 0.5) * -20;
  const systemOffsetX = (clientX / window.innerWidth - 0.5) * -34;
  const systemOffsetY = (clientY / window.innerHeight - 0.5) * -20;
  const particleOffsetX = (clientX / window.innerWidth - 0.5) * 42;
  const particleOffsetY = (clientY / window.innerHeight - 0.5) * 28;
  systemStars.style.setProperty("--parallax-x", `${offsetX}px`);
  systemStars.style.setProperty("--parallax-y", `${offsetY}px`);
  systemParticles.style.setProperty("--particle-parallax-x", `${particleOffsetX}px`);
  systemParticles.style.setProperty("--particle-parallax-y", `${particleOffsetY}px`);
  starSystem.style.setProperty("--system-parallax-x", `${systemOffsetX}px`);
  starSystem.style.setProperty("--system-parallax-y", `${systemOffsetY}px`);
  systemStarLayer.style.setProperty("--system-parallax-x", `${systemOffsetX}px`);
  systemStarLayer.style.setProperty("--system-parallax-y", `${systemOffsetY}px`);
  updateSystemGlow(clientX, clientY, systemOffsetX, systemOffsetY);
}

function updateSystemGlow(clientX, clientY, systemOffsetX = 0, systemOffsetY = 0) {
  if (!activeSystemStar) {
    return;
  }

  const glowX = activeSystemStar.x + systemOffsetX;
  const glowY = activeSystemStar.y + systemOffsetY;
  const distanceToCenter = Math.hypot(clientX - glowX, clientY - glowY);
  const distanceToEdge = Math.max(0, distanceToCenter - activeSystemStar.radius);
  const rightEdgeX = glowX + activeSystemStar.radius;
  const falloffRadius = Math.max(260, window.innerWidth * 0.75 - rightEdgeX);
  const proximity = 1 - THREE.MathUtils.clamp(distanceToEdge / falloffRadius, 0, 1);
  systemGlowLayer.render({
    centerX: glowX,
    centerY: glowY,
    radius: activeSystemStar.radius,
    color: activeSystemStar.glowColor,
    intensity: proximity * 1.72,
  });
}

function renderStarSystem(node) {
  starSystem.replaceChildren();
  systemStarLayer.replaceChildren();
  gasGiantTextureLayers.clear();
  planetSurfaceRotationLayers.clear();
  clearSystemHover();
  planetScreenController.close();
  closePlanetWindow();
  systemTitle.textContent = `${node.name} SYSTEM`;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const centerY = height / 2;
  const random = createRandom(`${SEED}:system:${node.id}`);
  const starRadius = getSystemStarRadius(node, height, random);
  const starX = -starRadius * 0.8;
  activeSystemStar = {
    x: starX,
    y: centerY,
    radius: starRadius,
    glowColor: node.glowColor,
  };
  const star = document.createElement("div");
  star.className = "system-star";
  star.classList.toggle("black-hole", Boolean(node.blackCore));
  star.style.width = `${starRadius * 2}px`;
  star.style.height = `${starRadius * 2}px`;
  star.style.left = `${starX - starRadius}px`;
  star.style.top = `${centerY - starRadius}px`;
  star.style.color = node.glowColor;
  star.style.setProperty("--star-edge-blend", `${Math.min(60, starRadius * 0.28)}px`);
  const starBackground = node.blackCore
    ? "radial-gradient(circle at center, #000 0 100%)"
    : `radial-gradient(circle at center, #fff 0 42%, ${node.coreColor} 52%, ${node.glowColor} 66%, rgba(255,255,255,0.2) 82%, rgba(255,255,255,0) 100%)`;
  const starFill = document.createElement("span");
  starFill.className = "system-star__fill";
  starFill.style.background = starBackground;
  star.append(starFill);
  activeSystemStarSurface = null;
  if (!node.blackCore) {
    const starSurface = createSystemStarSurface(node, starRadius);
    star.append(starSurface.canvas);
    activeSystemStarSurface = starSurface;
    drawSystemStarSurface(starSurface, performance.now());
  }
  systemStarLayer.append(star);

  const orbitLayer = createSystemOrbitLayer(width, height);
  const orbitItems = [];
  starSystem.append(orbitLayer);

  const starEdgeOrbit = starRadius + Math.min(starRadius * 0.12, SYSTEM_ORBIT_STAR_EDGE_GAP_CAP);
  const minOrbit = Math.max(starEdgeOrbit, -starX + 96);
  const maxOrbit = Math.max(minOrbit + 80, width - starX - 84);
  const orbitRadii = createSystemOrbitRadii(node.planets, minOrbit, maxOrbit, random);

  const occupiedPlanets = [];
  for (let index = 0; index < node.planets; index += 1) {
    const orbitRadius = orbitRadii[index];
    const safeVertical = Math.max(24, centerY - 58);
    const maxAngle = Math.min(0.78, Math.asin(Math.min(0.9, safeVertical / orbitRadius)));
    const angle = (random() * 2 - 1) * maxAngle * 0.94;
    const planetSizeIndex = Math.floor(random() * 10);
    const isAsteroidBelt = random() < 0.05;

    if (isAsteroidBelt) {
      const belt = createAsteroidBelt(random, orbitRadius);
      const beltElement = document.createElement("div");
      beltElement.className = "system-asteroid-belt";
      beltElement.style.width = `${belt.outerRadius * 2}px`;
      beltElement.style.height = `${belt.outerRadius * 2}px`;
      beltElement.style.left = `${starX - belt.outerRadius}px`;
      beltElement.style.top = `${centerY - belt.outerRadius}px`;
      beltElement.style.background = belt.background;
      starSystem.append(beltElement);
      continue;
    }

    orbitItems.push({
      centerX: starX,
      centerY,
      radius: orbitRadius,
      planetAngle: angle,
    });

    const planetRadius = getSystemPlanetRadius(planetSizeIndex);
    const planetX = starX + Math.cos(angle) * orbitRadius;
    const planetY = centerY + Math.sin(angle) * orbitRadius;
    occupiedPlanets.push({ x: planetX, y: planetY, radius: planetRadius });
    const planetKind = createPlanetKind(random, planetSizeIndex);
    const gasGiantTextureSeed = `${SEED}:gas-giant:${node.id}:${index}`;
    const gasGiantTexture = planetKind.label === "GAS GIANT"
      ? createGasGiantTexture(gasGiantTextureSeed)
      : null;
    const zoneInfo = ZONE_DATA[node.starType];
    const orbitFraction = (orbitRadius - minOrbit) / (maxOrbit - minOrbit) * 100;
    const isTidallyLocked = zoneInfo && orbitFraction <= zoneInfo.tidalLock;
    const accretionDisk = createAccretionDisk(random, planetRadius, planetSizeIndex);
    const moonSystem = createMoonSystem({
      random,
      planetX,
      planetY,
      planetRadius,
      planetSizeIndex,
      accretionDisk,
      starX,
      centerY,
      starRadius,
    });

    if (accretionDisk) {
      const disk = createAccretionDiskElement(
        accretionDisk,
        Math.atan2(planetY - centerY, planetX - starX),
        planetRadius * 2,
      );
      disk.className = "system-accretion-disk";
      const diskSize = Number.parseFloat(disk.style.width);
      disk.style.left = `${planetX - diskSize / 2}px`;
      disk.style.top = `${planetY - diskSize / 2}px`;
      starSystem.append(disk);
    }

    const toStarLength = Math.hypot(starX - planetX, centerY - planetY) || 1;
    const starDirX = (starX - planetX) / toStarLength;
    const starDirY = (centerY - planetY) / toStarLength;
    const planetName = planetNameAssignments.get(node.id)?.[index] ?? planetNameService.createDefaultPlanetName(node.name, index);
    const planetGravity = createGravityValue({
      kind: planetKind.label,
      sizeIndex: planetSizeIndex,
      seed: `${SEED}:gravity:${node.id}:${planetName}`,
    });
    const basePlanetTemperature = createBaseTemperatureValue({
      starType: node.starType,
      orbitFraction,
      seed: `${SEED}:temperature:${node.id}`,
    });
    const planetSurfaceTags = planetKind.label === "PLANET"
      ? createPlanetSurfaceTags({
        seed: `${SEED}:planet-tags:${node.id}:${planetName}`,
        temperature: basePlanetTemperature,
      })
      : { tags: [], hasWater: false, atmosphere: null, temperature: basePlanetTemperature };
    const planetTemperature = planetSurfaceTags.temperature;
    const planetTextureParams = planetKind.label === "PLANET"
      ? createPlanetTextureParams({
        seed: `${SEED}:planet-texture-params:${node.id}:${planetName}`,
        temperature: planetTemperature,
        hasWater: planetSurfaceTags.hasWater,
        atmosphere: planetSurfaceTags.atmosphere,
        tidallyLocked: Boolean(isTidallyLocked),
      })
      : null;
    const planetTextureSeed = `${SEED}:planet-texture:${node.id}:${planetName}`;
    const planetTexture = planetKind.label === "PLANET"
      ? createPlanetTexture(planetTextureSeed, undefined, planetTextureParams)
      : null;
    const planetRotation = createPlanetRotationState({
      seed: SEED,
      systemId: node.id,
      planetName,
      tidallyLocked: Boolean(isTidallyLocked),
    });
    const planetUnlockedRotation = createPlanetRotationState({
      seed: SEED,
      systemId: node.id,
      planetName,
      tidallyLocked: false,
    });

    const planet = document.createElement("div");
    planet.className = "system-planet";
    planet.style.width = `${planetRadius * 2}px`;
    planet.style.height = `${planetRadius * 2}px`;
    planet.style.left = `${planetX - planetRadius}px`;
    planet.style.top = `${planetY - planetRadius}px`;
    planet.append(createPlanetGlow(planetRadius, starDirX, starDirY));
    planet.append(createPlanetSurface(
      planetKind.background,
      gasGiantTexture,
      planetTexture,
      planetRadius,
      starDirX,
      starDirY,
      false,
      Boolean(isTidallyLocked),
      {
        rotation: planetRotation,
        cloudRotation: planetUnlockedRotation,
      },
    ));
    starSystem.append(planet);

    renderMoons({ ...moonSystem, starDirX, starDirY });

    const constructionRadius = getPlanetConstructionRadius(planetRadius, accretionDisk, moonSystem);
    const moonNames = planetNameService.getMoonNames(node.id, index, planetName, moonSystem.moonCount);
    const label = document.createElement("div");
    label.className = "system-planet-label";
    label.textContent = planetName;
    label.style.left = `${planetX}px`;
    label.style.top = `${planetY - constructionRadius - 9}px`;
    starSystem.append(label);

    const hitTargetRadius = Math.max(constructionRadius, planetRadius + 10);
    const hitTarget = document.createElement("div");
    hitTarget.className = "system-planet-hit";
    hitTarget.style.width = `${hitTargetRadius * 2}px`;
    hitTarget.style.height = `${hitTargetRadius * 2}px`;
    hitTarget.style.left = `${planetX - hitTargetRadius}px`;
    hitTarget.style.top = `${planetY - hitTargetRadius}px`;
    hitTarget.dataset.name = planetName;
    hitTarget.dataset.kind = planetKind.label;
    hitTarget.dataset.hasDisk = accretionDisk ? "true" : "false";
    hitTarget.dataset.moons = String(moonSystem.moonCount);
    hitTarget.dataset.radius = String(planetRadius);
    hitTarget.dataset.tidallyLocked = isTidallyLocked ? "true" : "false";
    hitTarget.dataset.gravity = formatGravityValue(planetGravity);
    hitTarget.dataset.temperature = formatTemperatureValue(planetTemperature);
    hitTarget.dataset.dayCycle = formatDayCycleValue(planetRotation.period);
    hitTarget.dataset.tags = planetSurfaceTags.tags.join("|");
    const planetInfo = {
      name: planetName,
      kind: planetKind.label,
      background: planetKind.background,
      gasGiantTexture,
      gasGiantTextureSeed: gasGiantTexture ? gasGiantTextureSeed : null,
      planetTexture,
      planetTextureSeed,
      sizeIndex: planetSizeIndex,
      element: planet,
      radius: planetRadius,
      orbitRadius,
      minOrbit,
      maxOrbit,
      systemStarRadius: starRadius,
      systemStarColor: node.glowColor,
      systemStarCoreColor: node.coreColor,
      systemStarBlackCore: Boolean(node.blackCore),
      systemId: node.id,
      gravity: planetGravity,
      temperature: planetTemperature,
      tags: planetSurfaceTags.tags,
      surfaceTextureParams: planetTextureParams,
      dayCycleSeconds: planetRotation.period,
      // Window scale excludes the accretion disk so a planet with a large disk
      // is not shrunk; the disk is allowed to overflow the stage instead.
      extentRadius: accretionDisk
        ? planetRadius
        : getPlanetConstructionRadius(planetRadius, null, moonSystem),
      starDirX,
      starDirY,
      accretionDisk,
      diskShadowAngle: Math.atan2(planetY - centerY, planetX - starX),
      moonCount: moonSystem.moonCount,
      moonOrbitRadius: moonSystem.orbitRadius,
      moonList: moonSystem.moons.map((moon, moonIndex) => ({
        dx: moon.x - planetX,
        dy: moon.y - planetY,
        radius: moon.radius,
        sizeIndex: moon.sizeIndex,
        sizeName: getMoonSizeLabel(moon),
        gravity: createGravityValue({
          kind: "MOON",
          sizeIndex: moon.sizeIndex,
          seed: `${SEED}:gravity:${node.id}:${planetName}:moon:${moonIndex}`,
        }),
        name: moonNames[moonIndex] ?? planetNameService.createDefaultPlanetName(planetName, moonIndex),
      })),
      hasDisk: Boolean(accretionDisk),
      tidallyLocked: Boolean(isTidallyLocked),
      lore: createPlanetLore(createRandom(`${SEED}:planet-lore:${node.id}:${index}`)),
    };
    hitTarget.userData = { label, planet: planetInfo };
    hitTarget.addEventListener("pointerenter", (event) => {
      positionSystemTooltip(event.clientX, event.clientY);
      setSystemHover(hitTarget);
    });
    hitTarget.addEventListener("pointermove", (event) => {
      positionSystemTooltip(event.clientX, event.clientY);
    });
    hitTarget.addEventListener("pointerleave", () => {
      if (hoveredSystemBody === hitTarget) {
        setSystemHover(null);
      }
    });
    hitTarget.addEventListener("click", (event) => {
      event.stopPropagation();
      lastClientPointer.set(event.clientX, event.clientY);
      startPlanetEntryTransition(planetInfo, event.clientX, event.clientY);
    });
    starSystem.append(hitTarget);
  }

  drawSystemOrbits(orbitLayer, orbitItems);
  renderSystemZones(node, starX, centerY, minOrbit, maxOrbit);
  renderSystemJumps({
    node,
    starX,
    centerY,
    width,
    height,
    starRadius,
    minOrbit,
    maxOrbit,
    orbitRadii,
    occupiedPlanets,
    random,
  });
}

function renderSystemZones(node, starX, centerY, minOrbit, maxOrbit) {
  activeZoneElements = [];
  const zoneInfo = ZONE_DATA[node.starType];
  if (!zoneInfo) return;

  const span = maxOrbit - minOrbit;

  if (zoneInfo.tidalLock > 0) {
    const tidalRadius = minOrbit + span * (zoneInfo.tidalLock / 100);
    const el = document.createElement("div");
    el.className = "system-zone system-zone--tidal";
    if (isTidalZoneVisible) el.classList.add("visible");
    el.style.width = `${tidalRadius * 2}px`;
    el.style.height = `${tidalRadius * 2}px`;
    el.style.left = `${starX - tidalRadius}px`;
    el.style.top = `${centerY - tidalRadius}px`;
    starSystem.append(el);
    activeZoneElements.push({ el, zone: "tidal" });
  }

  if (zoneInfo.hzInner !== null && zoneInfo.hzOuter !== null) {
    const hzOuterRadius = minOrbit + span * (zoneInfo.hzOuter / 100);
    const hzInnerRadius = minOrbit + span * (zoneInfo.hzInner / 100);
    const innerPct = (hzInnerRadius / hzOuterRadius) * 100;
    const hzEl = document.createElement("div");
    hzEl.className = "system-zone system-zone--hz";
    if (isHzZoneVisible) hzEl.classList.add("visible");
    hzEl.style.width = `${hzOuterRadius * 2}px`;
    hzEl.style.height = `${hzOuterRadius * 2}px`;
    hzEl.style.left = `${starX - hzOuterRadius}px`;
    hzEl.style.top = `${centerY - hzOuterRadius}px`;
    hzEl.style.setProperty("--hz-inner-pct", `${innerPct}%`);
    starSystem.append(hzEl);
    activeZoneElements.push({ el: hzEl, zone: "hz" });
  }
}

function createPlanetLore(random) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  const openings = [
    "Charted by long-range survey drones,",
    "First catalogued during the deep-sky census,",
    "Known to old star-charts only as a faint smudge,",
    "Whispered about in the logs of passing freighters,",
    "Lost for centuries, then rediscovered by accident,",
    "Marked on every navigator's map with quiet caution,",
    "Named after a captain who never returned,",
    "Beyond the reach of the early colony beacons,",
  ];
  const bodies = [
    "this world turns through a slow, patient dark.",
    "it carries scars from an age no record remembers.",
    "its surface hums with storms older than the colonies.",
    "it drifts in silence, indifferent to the ships above.",
    "the planet keeps a climate no instrument fully trusts.",
    "it holds a horizon that has swallowed many expeditions.",
    "its gravity pulls at more than just stone and ice.",
    "the world wears a sky the colour of cooling iron.",
  ];
  const closers = [
    "Few who orbit it leave entirely unchanged.",
    "Settlers speak of it with equal parts dread and longing.",
    "Its true name, they say, was never written down.",
    "What it guards beneath the clouds remains unmeasured.",
    "Light behaves strangely here, and so do travellers.",
    "It waits, as it has always waited.",
    "Survey crews still argue over what they saw.",
    "The maps mark it simply, and warmly, as home.",
  ];
  return `${pick(openings)} ${pick(bodies)} ${pick(closers)}`;
}

function getPlanetSizeLabel(planet) {
  const names = PLANET_SIZE_NAMES[planet.kind] ?? [];
  const sizeName = names[planet.sizeIndex] ?? "";
  return `${sizeName} ${planet.kind}`.trim().toUpperCase();
}

function getMoonSizeLabel(moon) {
  return (MOON_SIZE_NAMES[moon.sizeIndex] ?? "moon").toUpperCase();
}

function createGravityValue({ kind, sizeIndex, seed }) {
  const baseValues = GRAVITY_BASE_VALUES[kind] ?? [];
  const baseGravity = baseValues[sizeIndex] ?? 1;
  const maxShift = getGravityMaxShift(kind, sizeIndex);
  const random = createRandom(seed);
  const gravity = baseGravity + (random() * 2 - 1) * maxShift;

  return Math.max(0.01, Number(gravity.toFixed(2)));
}

function getGravityMaxShift(kind, sizeIndex) {
  if (kind === "GAS GIANT") {
    return sizeIndex < 5 ? 0.2 : 0.4;
  }

  if (kind === "PLANET") {
    return sizeIndex < 2 ? 0.2 : 1;
  }

  if (kind === "MOON") {
    return 0.2;
  }

  return 0;
}

function formatGravityValue(gravity) {
  return gravity.toFixed(2).replace(/\.?0+$/, "");
}

function formatDayCycleValue(period) {
  if (!Number.isFinite(period)) {
    return "\u221e";
  }

  return period.toFixed(1).replace(/\.0$/, "");
}

function createPlanetSurfaceTags({ seed, temperature }) {
  const random = createRandom(seed);
  const atmosphereRoll = random();
  const atmosphere = atmosphereRoll < 0.4
    ? null
    : ATMOSPHERE_TAGS[Math.min(ATMOSPHERE_TAGS.length - 1, Math.floor((atmosphereRoll - 0.4) / 0.2))];
  const adjustedTemperature = applyAtmosphereTemperature({
    atmosphere,
    temperature,
    seed: `${seed}:atmosphere-temperature`,
  });
  const hasWater = adjustedTemperature <= 100 && random() < PLANET_WATER_TAG_CHANCE;
  const tags = [];
  if (hasWater) {
    tags.push("WATER");
  }
  if (atmosphere) {
    tags.push(atmosphere);
  }

  return { tags, hasWater, atmosphere, temperature: adjustedTemperature };
}

function applyAtmosphereTemperature({ atmosphere, temperature, seed }) {
  const multiplierRange = ATMOSPHERE_TEMPERATURE_MULTIPLIERS[atmosphere];
  if (!multiplierRange) {
    return temperature;
  }

  const random = createRandom(seed);
  const multiplier = THREE.MathUtils.lerp(multiplierRange[0], multiplierRange[1], random());
  if (temperature < 0) {
    return temperature / multiplier;
  }

  return temperature * multiplier;
}

function createPlanetTextureParams({ seed, temperature, hasWater, atmosphere, tidallyLocked }) {
  const waterRandom = createRandom(`${seed}:water`);
  const atmosphereRandom = createRandom(`${seed}:atmosphere`);
  const textureMode = tidallyLocked && temperature >= 0
    ? temperature > TIDAL_COMBINE_MAX_TEMPERATURE
      ? "molten"
      : "tidal-combine"
    : "default";
  const hotAndDry = temperature > 100;
  const forceDryTexture = textureMode !== "default";
  const waterPosition = hasWater && !hotAndDry && !forceDryTexture
    ? 0.3 + waterRandom() * 0.4
    : 0;
  const iceCaps = hasWater && !hotAndDry && !forceDryTexture
    ? createTemperatureIceCaps(temperature)
    : 0;
  const cloudAlpha = createAtmosphereCloudAlpha(atmosphere, atmosphereRandom);
  const freezeWater = hasWater && !atmosphere && !hotAndDry && !forceDryTexture;

  return {
    waterPosition,
    iceCaps,
    cloudAlpha,
    freezeWater,
    textureMode,
  };
}

function createTemperatureIceCaps(temperature) {
  if (temperature > 100) {
    return 0;
  }

  if (temperature >= 0) {
    return THREE.MathUtils.lerp(5, 1, temperature / 100);
  }

  return THREE.MathUtils.lerp(5, 55, THREE.MathUtils.clamp(-temperature / 100, 0, 1));
}

function createAtmosphereCloudAlpha(atmosphere, random) {
  if (atmosphere === "THIN ATMOSPHERE") {
    return 0.5 + random() * 0.05;
  }
  if (atmosphere === "ATMOSPHERE") {
    return 0.4 + random() * 0.1;
  }
  if (atmosphere === "DENSE ATMOSPHERE") {
    return 0.25 + random() * 0.15;
  }

  return null;
}

function createBaseTemperatureValue({ starType, orbitFraction, seed }) {
  const zoneInfo = ZONE_DATA[starType];
  if (!zoneInfo || zoneInfo.hzInner === null || zoneInfo.hzOuter === null) {
    return -272;
  }

  const habitableSpan = zoneInfo.hzOuter - zoneInfo.hzInner;
  if (habitableSpan <= 0) {
    return -272;
  }

  if (orbitFraction >= zoneInfo.hzInner) {
    const temperature = 100 - ((orbitFraction - zoneInfo.hzInner) / habitableSpan) * 100;
    return Math.max(-272, Math.round(temperature));
  }

  const starEdgeTemperature = createStarEdgeTemperature(starType, seed);
  const innerRatio = THREE.MathUtils.clamp(orbitFraction / zoneInfo.hzInner, 0, 1);
  const temperature = THREE.MathUtils.lerp(starEdgeTemperature, 100, innerRatio);

  return Math.round(temperature);
}

function createStarEdgeTemperature(starType, seed) {
  const range = STAR_TEMPERATURE_RANGES[starType];
  if (!range) {
    return 100;
  }

  const random = createRandom(seed);
  return range[0] + random() * (range[1] - range[0]);
}

function formatTemperatureValue(temperature) {
  return String(Math.round(temperature));
}

async function startPlanetEntryTransition(planet, clientX, clientY) {
  if (!planet || isPlanetEntryTransitioning || planetScreenController.isOpen() || systemScreenController.isTransitioning()) {
    return;
  }

  isPlanetEntryTransitioning = true;
  const transitionToken = ++planetEntryTransitionToken;
  const rendererPromise = loadPlanetScreenRenderer();
  lastClientPointer.set(clientX, clientY);
  clearSystemHover();
  closePlanetWindow();
  setPlanetEntryOverlayContent(planet);
  starWindow.style.setProperty("--planet-entry-origin-x", `${clientX}px`);
  starWindow.style.setProperty("--planet-entry-origin-y", `${clientY}px`);
  starWindow.style.setProperty("--planet-entry-scale", "1");
  planetEntryOverlay.classList.add("active");
  planetEntryOverlay.style.setProperty("--planet-entry-alpha", "0");
  const minOverlayVisiblePromise = delay(PLANET_ENTRY_MIN_OVERLAY_MS);

  await nextAnimationFrame();
  if (transitionToken !== planetEntryTransitionToken) {
    return;
  }

  starWindow.classList.add("planet-entry-moving");
  starWindow.style.setProperty("--planet-entry-scale", "9");
  planetEntryOverlay.style.setProperty("--planet-entry-alpha", "1");

  await delay(PLANET_ENTRY_ZOOM_MS);
  if (transitionToken !== planetEntryTransitionToken) {
    return;
  }

  try {
    await rendererPromise;
  } catch (error) {
    console.error("Planet screen module failed to load", error);
  }

  planetScreenController.open(planet);
  await nextAnimationFrame();
  if (transitionToken !== planetEntryTransitionToken) {
    return;
  }

  await nextAnimationFrame();
  if (transitionToken !== planetEntryTransitionToken) {
    return;
  }

  await minOverlayVisiblePromise;
  if (transitionToken !== planetEntryTransitionToken) {
    return;
  }

  planetEntryOverlay.classList.add("leaving");
  planetEntryOverlay.style.setProperty("--planet-entry-alpha", "0");
  await delay(PLANET_ENTRY_FADE_MS);
  if (transitionToken !== planetEntryTransitionToken) {
    return;
  }

  planetEntryOverlay.classList.remove("active", "leaving");
  starWindow.classList.remove("planet-entry-moving");
  starWindow.style.setProperty("--planet-entry-scale", "1");
  isPlanetEntryTransitioning = false;
  planetScreenController.updateParallax(lastClientPointer.x, lastClientPointer.y);
}

function setPlanetEntryOverlayContent(planet) {
  planetEntryOverlay.querySelector(".planet-entry-name").textContent = planet.name;
  planetEntryOverlay.querySelector(".planet-entry-type").textContent = getPlanetSizeLabel(planet);
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function nextAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function openPlanetWindow(planet) {
  if (!planet) {
    return;
  }

  // Keep the window where it is when swapping to another planet; only recentre
  // it when opening fresh.
  const wasOpen = isPlanetWindowOpen;
  isPlanetWindowOpen = true;
  openPlanetData = planet;
  setSystemHover(null);

  if (!wasOpen) {
    planetWindowOffset.x = 0;
    planetWindowOffset.y = 0;
    planetWindow.style.setProperty("--pw-x", "0px");
    planetWindow.style.setProperty("--pw-y", "0px");
  }

  planetWindowTitle.textContent = planet.name;
  planetWindowSize.textContent = getPlanetSizeLabel(planet);
  planetWindowLore.textContent = planet.lore;
  renderPlanetStage(planet);

  const tags = [];
  if (planet.tidallyLocked) {
    tags.push("TIDALLY LOCKED");
  }
  if (planet.hasDisk) {
    tags.push("ACCRETION DISK");
  }
  planetWindowTags.replaceChildren(...tags.map((text) => {
    const tag = document.createElement("span");
    tag.className = "planet-window__tag";
    tag.textContent = text;
    return tag;
  }));
  planetWindowDivider.classList.toggle("empty", tags.length === 0);

  planetWindow.classList.add("visible");
  planetWindow.setAttribute("aria-hidden", "false");
}

function renderPlanetStage(planet) {
  planetWindowStage.replaceChildren();

  const center = PLANET_STAGE_WIDTH / 2;
  const displayPlanetRadius = THREE.MathUtils.clamp(planet.radius * 2.18, 24, 58);
  const visibleMoonCount = Math.min(planet.moonList.length, 3);
  const orbitGap = 30;
  const moonOrbitRadii = planet.moonList
    .slice(0, visibleMoonCount)
    .map((moon, index) => displayPlanetRadius + orbitGap * (index + 1) + THREE.MathUtils.clamp(moon.radius * 0.9, 2, 5));
  const diskScale = displayPlanetRadius / planet.radius;
  const farMoonOrbit = moonOrbitRadii.at(-1) ?? displayPlanetRadius;
  const scaledDisk = planet.accretionDisk
    ? createPlanetWindowDiskGeometry(planet.accretionDisk, diskScale, farMoonOrbit)
    : null;
  const diskOuterRadius = scaledDisk?.outerRadius ?? 0;
  const lowerExtent = Math.max(
    displayPlanetRadius,
    moonOrbitRadii.at(-1) ?? 0,
    diskOuterRadius > 0 ? diskOuterRadius : 0,
  );
  const upperExtent = displayPlanetRadius;
  const totalExtent = upperExtent + lowerExtent;
  const planetY = THREE.MathUtils.clamp(
    (PLANET_STAGE_HEIGHT - totalExtent) / 2 + upperExtent,
    upperExtent + 8,
    PLANET_STAGE_HEIGHT - lowerExtent - 8,
  );

  const planetElement = document.createElement("div");
  planetElement.className = "planet-window__planet";
  planetElement.style.width = `${displayPlanetRadius * 2}px`;
  planetElement.style.height = `${displayPlanetRadius * 2}px`;
  planetElement.style.left = `${center - displayPlanetRadius}px`;
  planetElement.style.top = `${planetY - displayPlanetRadius}px`;
  planetElement.append(createPlanetGlow(displayPlanetRadius, planet.starDirX, planet.starDirY));
  const displayGasGiantTexture = planet.gasGiantTextureSeed
    ? createGasGiantTexture(planet.gasGiantTextureSeed, GAS_GIANT_WINDOW_TEXTURE_HEIGHT)
    : planet.gasGiantTexture;
  const displayPlanetRotation = createPlanetRotationState({
    seed: SEED,
    systemId: planet.systemId,
    planetName: planet.name,
    tidallyLocked: planet.tidallyLocked,
  });
  planetElement.append(createPlanetSurface(
    planet.background,
    displayGasGiantTexture,
    null,
    displayPlanetRadius,
    planet.starDirX,
    planet.starDirY,
    true,
    false,
    {
      rotation: displayPlanetRotation,
    },
  ));
  planetWindowStage.append(planetElement);

  const caption = document.createElement("div");
  caption.className = "planet-window__caption";
  caption.style.left = `${Math.min(center + displayPlanetRadius + 12, PLANET_STAGE_WIDTH - 96)}px`;
  caption.style.top = `${Math.max(10, planetY - displayPlanetRadius * 0.42)}px`;
  caption.innerHTML = `
    <div class="planet-window__caption-name"></div>
    <div class="planet-window__caption-size"></div>
  `;
  caption.querySelector(".planet-window__caption-name").textContent = planet.name;
  caption.querySelector(".planet-window__caption-size").textContent = getPlanetSizeLabel(planet);
  planetWindowStage.append(caption);

  for (const [index, moon] of planet.moonList.slice(0, visibleMoonCount).entries()) {
    const moonRadius = THREE.MathUtils.clamp(moon.radius * 2.18, 2.6, 6.2);
    const orbitRadius = moonOrbitRadii[index];
    const angle = Math.PI / 2 + (index - (visibleMoonCount - 1) / 2) * 0.18;
    const orbit = document.createElement("div");
    orbit.className = "planet-window__moon-orbit";
    orbit.style.width = `${orbitRadius * 2}px`;
    orbit.style.height = `${orbitRadius * 2}px`;
    orbit.style.left = `${center}px`;
    orbit.style.top = `${planetY}px`;
    planetWindowStage.append(orbit);

    const moonElement = document.createElement("div");
    moonElement.className = "planet-window__moon";
    moonElement.style.width = `${moonRadius * 2}px`;
    moonElement.style.height = `${moonRadius * 2}px`;
    moonElement.style.left = `${center + Math.cos(angle) * orbitRadius - moonRadius}px`;
    moonElement.style.top = `${planetY + Math.sin(angle) * orbitRadius - moonRadius}px`;
    planetWindowStage.append(moonElement);
  }

  if (scaledDisk) {
    const disk = createAccretionDiskElement(
      scaledDisk,
      planet.diskShadowAngle,
      displayPlanetRadius * 2,
    );
    disk.className = "planet-window__disk planet-window__disk--bottom";
    const diskSize = Number.parseFloat(disk.style.width);
    disk.style.left = `${center - diskSize / 2}px`;
    disk.style.top = `${planetY - diskSize / 2}px`;
    planetWindowStage.append(disk);
  }
}

function createPlanetWindowDiskGeometry(accretionDisk, diskScale, farMoonOrbit) {
  const originalInner = accretionDisk.innerRadius * diskScale;
  const originalThickness = Math.max(8, (accretionDisk.outerRadius - accretionDisk.innerRadius) * diskScale);
  const minInnerRadius = farMoonOrbit + 38;
  const maxOuterRadius = PLANET_STAGE_HEIGHT - 18;
  const targetInnerRadius = Math.max(originalInner, minInnerRadius);
  const availableThickness = Math.max(8, maxOuterRadius - targetInnerRadius);
  const compressedThickness = Math.max(8, Math.min(originalThickness * 0.46, availableThickness));
  const innerRadius = Math.min(targetInnerRadius, maxOuterRadius - compressedThickness);
  const outerRadius = innerRadius + compressedThickness;
  const cutRadii = accretionDisk.cutRadii
    .map((cutRadius) => {
      const t = THREE.MathUtils.clamp(
        (cutRadius - accretionDisk.innerRadius) /
          Math.max(1, accretionDisk.outerRadius - accretionDisk.innerRadius),
        0,
        1,
      );
      return innerRadius + t * compressedThickness;
    })
    .filter((cutRadius) => cutRadius > innerRadius + 1.4 && cutRadius < outerRadius - 1.4);

  return {
    innerRadius,
    outerRadius,
    cutRadii,
  };
}

function updatePlanetLink() {
  if (!isPlanetWindowOpen || !openPlanetData?.element) {
    planetLinkPath.setAttribute("d", "");
    return;
  }

  const planetRect = openPlanetData.element.getBoundingClientRect();
  const planetCenterX = planetRect.left + planetRect.width / 2;
  const planetCenterY = planetRect.top + planetRect.height / 2;
  const planetRadius = planetRect.width / 2;

  const windowRect = planetWindow.getBoundingClientRect();
  const windowCenterX = windowRect.left + windowRect.width / 2;
  const windowCenterY = windowRect.top + windowRect.height / 2;

  // Unit vector from the planet centre toward the window centre.
  const toWindowX = windowCenterX - planetCenterX;
  const toWindowY = windowCenterY - planetCenterY;
  const distance = Math.hypot(toWindowX, toWindowY) || 1;
  const dirX = toWindowX / distance;
  const dirY = toWindowY / distance;

  // Start: nearest point on the planet — its edge toward the window centre.
  const startX = planetCenterX + dirX * planetRadius;
  const startY = planetCenterY + dirY * planetRadius;

  // End: nearest point on the window frame, modelled as a rounded rectangle so
  // the attachment point and its normal rotate smoothly around the corners.
  const cornerRadius = Math.min(30, windowRect.width / 2, windowRect.height / 2);
  const skeletonX = THREE.MathUtils.clamp(
    planetCenterX,
    windowRect.left + cornerRadius,
    windowRect.right - cornerRadius,
  );
  const skeletonY = THREE.MathUtils.clamp(
    planetCenterY,
    windowRect.top + cornerRadius,
    windowRect.bottom - cornerRadius,
  );
  let normalX = planetCenterX - skeletonX;
  let normalY = planetCenterY - skeletonY;
  const normalLength = Math.hypot(normalX, normalY);
  if (normalLength < 0.001) {
    normalX = -dirX;
    normalY = -dirY;
  } else {
    normalX /= normalLength;
    normalY /= normalLength;
  }
  const endX = skeletonX + normalX * cornerRadius;
  const endY = skeletonY + normalY * cornerRadius;

  // Bezier arms scale with the gap the curve actually spans, so a window held
  // close to the planet produces a short, untangled line.
  const span = Math.hypot(endX - startX, endY - startY);
  const arm = Math.min(span * 0.42, 220);
  const control1X = startX + dirX * arm;
  const control1Y = startY + dirY * arm;
  const control2X = endX + normalX * arm;
  const control2Y = endY + normalY * arm;

  planetLinkPath.setAttribute(
    "d",
    `M ${startX.toFixed(1)} ${startY.toFixed(1)} C ${control1X.toFixed(1)} ${control1Y.toFixed(1)}, ${control2X.toFixed(1)} ${control2Y.toFixed(1)}, ${endX.toFixed(1)} ${endY.toFixed(1)}`,
  );
}

function closePlanetWindow() {
  if (!isPlanetWindowOpen) {
    return;
  }

  isPlanetWindowOpen = false;
  openPlanetData = null;
  isDraggingPlanetWindow = false;
  planetWindow.classList.remove("visible", "dragging");
  planetWindow.setAttribute("aria-hidden", "true");
  planetLinkPath.setAttribute("d", "");
}

function renderSystemJumps({
  node,
  starX,
  centerY,
  width,
  height,
  starRadius,
  minOrbit,
  maxOrbit,
  orbitRadii,
  occupiedPlanets,
  random,
}) {
  const neighbors = Array.from(adjacency.get(node.id) ?? [])
    .map((id) => nodes[id])
    .sort((left, right) => left.name.localeCompare(right.name));
  const gateRadius = getSystemPlanetRadius(0);

  neighbors.forEach((neighbor, index) => {
    const position = createSystemJumpPosition({
      index,
      count: neighbors.length,
      starX,
      centerY,
      width,
      height,
      starRadius,
      minOrbit,
      maxOrbit,
      orbitRadii,
      occupiedPlanets,
      gateRadius,
      random,
    });
    const directionLength = Math.max(1, Math.hypot(position.x - starX, position.y - centerY));
    const stepX = ((position.x - starX) / directionLength) * 10;
    const stepY = ((position.y - centerY) / directionLength) * 10;
    const gate = createSystemGate({
      className: "system-jump",
      labelText: `TO ${neighbor.name}`,
      radius: gateRadius,
      x: position.x,
      y: position.y,
      stepX,
      stepY,
    });
    gate.dataset.kind = neighbor.starType;
    gate.dataset.planets = String(neighbor.planets);
    gate.addEventListener("click", (event) => {
      event.stopPropagation();
      startSystemJumpTransition(neighbor, stepX / 10, stepY / 10, gate, event.clientX, event.clientY);
    });
    starSystem.append(gate);
  });

  const wormholes = outerLinks
    .filter((link) => link.parentId === node.id)
    .sort((left, right) => left.end.lengthSq() - right.end.lengthSq());

  wormholes.forEach((link, index) => {
    const position = createSystemWormholePosition({
      index,
      count: wormholes.length,
      starX,
      centerY,
      width,
      height,
      minOrbit,
      maxOrbit,
      occupiedPlanets,
      gateRadius: 6,
      random,
    });
    const directionLength = Math.max(1, Math.hypot(position.x - starX, position.y - centerY));
    const stepX = ((position.x - starX) / directionLength) * 14;
    const stepY = ((position.y - centerY) / directionLength) * 14;
    const gate = createSystemGate({
      className: "system-jump system-jump--wormhole",
      labelText: "WORMHOLE",
      radius: 6,
      x: position.x,
      y: position.y,
      stepX,
      stepY,
      echoCount: 12,
    });
    gate.querySelectorAll(".system-jump__echo").forEach((ring, ringIndex) => {
      const index = ringIndex + 1;
      const progress = (index - 1) / 11;
      // First ring offset by 15px; each subsequent gap grows by 3px.
      const ringDistance = (n) => (n <= 0 ? 0 : 1.5 * n * n + 8.5 * n + 5);
      const distance = ringDistance(index);
      const exitDistance = ringDistance(index - 1);
      const channel = Math.round(255 * (1 - progress));
      ring.style.setProperty("--wormhole-x", `${(stepX / 14) * distance}px`);
      ring.style.setProperty("--wormhole-y", `${(stepY / 14) * distance}px`);
      ring.style.setProperty("--wormhole-exit-x", `${(stepX / 14) * exitDistance}px`);
      ring.style.setProperty("--wormhole-exit-y", `${(stepY / 14) * exitDistance}px`);
      ring.style.setProperty("--wormhole-size", `${index * 2}px`);
      ring.style.setProperty("--wormhole-blur", `${0.1 + progress * 7.9}px`);
      ring.style.setProperty("--wormhole-alpha", `${0.28 + (index / 12) * 0.72}`);
      ring.style.setProperty("--wormhole-color", `rgba(255, ${channel}, ${channel}, ${0.34 + progress * 0.66})`);
      ring.style.transitionDelay = `${(index - 1) * 42}ms`;
    });
    gate.type = "button";
    gate.tabIndex = -1;
    starSystem.append(gate);
  });
}

function createSystemGate({ className, labelText, radius, x, y, stepX, stepY, echoCount = 5 }) {
  const gate = document.createElement("button");
  gate.className = className;
  gate.type = "button";
  gate.style.width = `${radius * 2}px`;
  gate.style.height = `${radius * 2}px`;
  gate.style.left = `${x - radius}px`;
  gate.style.top = `${y - radius}px`;
  gate.style.setProperty("--jump-step-x", `${stepX}px`);
  gate.style.setProperty("--jump-step-y", `${stepY}px`);
  gate.dataset.name = labelText;
  gate.dataset.radius = String(radius);

  const label = document.createElement("span");
  label.className = "system-jump__label";
  label.textContent = labelText;
  gate.append(label);

  for (let ringIndex = 1; ringIndex <= echoCount; ringIndex += 1) {
    const ring = document.createElement("span");
    ring.className = `system-jump__echo system-jump__echo--${ringIndex}`;
    gate.append(ring);
  }

  gate.userData = { label };
  gate.addEventListener("pointerenter", (event) => {
    positionSystemTooltip(event.clientX, event.clientY);
    if (gate.classList.contains("system-jump--wormhole")) {
      startWormholeHover(gate, echoCount);
    } else {
      gate.classList.add("active");
      setSystemHover(gate);
    }
  });
  gate.addEventListener("pointermove", (event) => {
    positionSystemTooltip(event.clientX, event.clientY);
  });
  gate.addEventListener("pointerleave", () => {
    if (gate.classList.contains("system-jump--wormhole")) {
      endWormholeHover(gate, echoCount);
    } else {
      gate.classList.remove("active");
      if (hoveredSystemBody === gate) {
        setSystemHover(null);
      }
    }
  });

  return gate;
}

function startWormholeHover(gate, echoCount) {
  clearWormholeTimers(gate);
  gate.userData.hovering = true;
  gate.userData.enterStartedAt = performance.now();
  gate.userData.enterDuration = (echoCount - 1) * 42 + 190;
  gate.classList.remove("exiting");
  gate.querySelectorAll(".system-jump__echo").forEach((ring, ringIndex) => {
    ring.style.transitionDelay = `${ringIndex * 42}ms`;
  });
  gate.classList.add("active");
}

function endWormholeHover(gate, echoCount) {
  gate.userData.hovering = false;
  clearWormholeTimers(gate);

  const elapsed = performance.now() - (gate.userData.enterStartedAt ?? 0);
  const wait = Math.max(0, (gate.userData.enterDuration ?? 0) - elapsed);
  gate.userData.exitTimer = window.setTimeout(() => {
    gate.querySelectorAll(".system-jump__echo").forEach((ring, ringIndex) => {
      ring.style.transitionDelay = `${(echoCount - ringIndex - 1) * 42}ms`;
    });
    gate.classList.add("exiting");
    gate.classList.remove("active");
    gate.userData.cleanupTimer = window.setTimeout(() => {
      if (!gate.userData.hovering) {
        gate.classList.remove("exiting");
        gate.querySelectorAll(".system-jump__echo").forEach((ring, ringIndex) => {
          ring.style.transitionDelay = `${ringIndex * 42}ms`;
        });
      }
    }, echoCount * 42 + 220);
  }, wait);
}

function clearWormholeTimers(gate) {
  if (gate.userData.exitTimer) {
    window.clearTimeout(gate.userData.exitTimer);
    gate.userData.exitTimer = null;
  }
  if (gate.userData.cleanupTimer) {
    window.clearTimeout(gate.userData.cleanupTimer);
    gate.userData.cleanupTimer = null;
  }
}

function createSystemWormholePosition({
  index,
  count,
  starX,
  centerY,
  height,
  minOrbit,
  maxOrbit,
  occupiedPlanets,
  gateRadius,
  random,
}) {
  const span = Math.max(1, maxOrbit - minOrbit);
  const countOffset = count > 1 ? index / (count - 1) : random();
  let fallback = null;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const radius = minOrbit + span * THREE.MathUtils.clamp(
      0.16 + ((countOffset + random() * 0.18 + attempt * 0.09) % 1) * 0.68,
      0,
      1,
    );
    const upper = random() < 0.5;
    const bandMin = upper ? 42 : height * 0.67;
    const bandMax = upper ? height * 0.33 : height - 42;
    const y = THREE.MathUtils.clamp(
      bandMin + random() * Math.max(1, bandMax - bandMin) + (count > 1 ? (index / Math.max(1, count - 1) - 0.5) * 24 : 0),
      42,
      height - 42,
    );
    const position = { x: starX + radius, y };
    fallback ??= position;

    if (!isSystemGateOnPlanet(position, occupiedPlanets, gateRadius)) {
      return position;
    }
  }

  return fallback;
}

function createSystemJumpPosition({
  index,
  count,
  starX,
  centerY,
  width,
  height,
  starRadius,
  minOrbit,
  maxOrbit,
  orbitRadii,
  occupiedPlanets,
  gateRadius,
  random,
}) {
  let fallback = null;

  for (let attempt = 0; attempt < 18; attempt += 1) {
    const radius = createSystemJumpRadius({
      index,
      count,
      starRadius,
      minOrbit,
      maxOrbit,
      orbitRadii,
      random,
      attempt,
    });
    const x = THREE.MathUtils.clamp(starX + radius, 54, width - 54);
    const upper = random() < 0.5;
    const bandMin = upper ? 42 : height * 0.67;
    const bandMax = upper ? height * 0.33 : height - 42;
    const stagger = count > 1 ? (index / Math.max(1, count - 1) - 0.5) * 34 : 0;
    const y = THREE.MathUtils.clamp(bandMin + random() * Math.max(1, bandMax - bandMin) + stagger, 42, height - 42);
    const position = { x, y };
    fallback ??= position;

    if (!isSystemGateOnPlanet(position, occupiedPlanets, gateRadius)) {
      return position;
    }
  }

  return fallback;
}

function createSystemJumpRadius({
  index,
  count,
  starRadius,
  minOrbit,
  maxOrbit,
  orbitRadii,
  random,
  attempt,
}) {
  if (orbitRadii.length >= 2) {
    const slot = Math.floor((random() + attempt * 0.37) * (orbitRadii.length - 1)) % (orbitRadii.length - 1);
    return THREE.MathUtils.lerp(orbitRadii[slot], orbitRadii[slot + 1], 0.28 + random() * 0.44);
  }

  if (orbitRadii.length === 1) {
    const inner = Math.max(starRadius * 1.18, minOrbit * 0.78);
    return THREE.MathUtils.lerp(inner, orbitRadii[0], 0.35 + random() * 0.46);
  }

  const span = Math.max(1, maxOrbit - minOrbit);
  const countOffset = count > 1 ? index / (count - 1) : random();
  const seededOffset = (countOffset + random() * 0.22 + attempt * 0.13) % 1;
  return minOrbit + span * THREE.MathUtils.clamp(0.08 + seededOffset * 0.84, 0, 1);
}

function isSystemGateOnPlanet(position, occupiedPlanets, gateRadius) {
  return occupiedPlanets.some((planet) => (
    Math.hypot(position.x - planet.x, position.y - planet.y) < planet.radius + gateRadius + 4
  ));
}

function startSystemJumpTransition(targetNode, directionX, directionY, gate, clientX, clientY) {
  if (systemScreenController.isTransitioning() || !systemScreenController.isOpen()) {
    return;
  }

  systemScreenController.setTransitioning(true);
  gate?.classList.add("jumping");
  clearSystemHover();
  lockSystemPointer();

  const length = Math.max(1, Math.hypot(directionX, directionY));
  const unitX = directionX / length;
  const unitY = directionY / length;
  const travel = Math.max(window.innerWidth, window.innerHeight) * 1.08;
  const exitX = unitX * travel;
  const exitY = unitY * travel;
  const chargeDuration = 220;
  const departDuration = 720;
  const arriveDuration = 920;
  const startedAt = performance.now();

  setSystemTransitionOffset(0, 0);
  setSystemTransitionOverlay(0);

  const animateTransition = (now) => {
    const elapsed = now - startedAt;

    if (elapsed < chargeDuration) {
      requestAnimationFrame(animateTransition);
      return;
    }

    const departElapsed = elapsed - chargeDuration;
    if (departElapsed < departDuration) {
      const progress = THREE.MathUtils.clamp(departElapsed / departDuration, 0, 1);
      const speedCurve = Math.pow(progress, 2.55);
      const blackCurve = Math.pow(progress, 1.35);
      const offsetX = -exitX * speedCurve;
      const offsetY = -exitY * speedCurve;
      setSystemTransitionOffset(offsetX, offsetY);
      updateSystemGlow(clientX, clientY, offsetX, offsetY);
      setSystemTransitionOverlay(blackCurve);
      requestAnimationFrame(animateTransition);
      return;
    }

    setSystemTransitionOverlay(1);
    renderStarSystem(targetNode);
    renderSystemStars(targetNode);
    renderSystemParticles(targetNode);
    preloadPlanetScreenRenderer();
    systemScreenController.setActiveNode(targetNode);
    setSystemTransitionOffset(exitX, exitY);
    updateSystemGlow(clientX, clientY, exitX, exitY);

    const arriveStartedAt = performance.now();
    const animateArrival = (arrivalNow) => {
      const progress = THREE.MathUtils.clamp((arrivalNow - arriveStartedAt) / arriveDuration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3.1);
      const offsetX = exitX * (1 - eased);
      const offsetY = exitY * (1 - eased);
      setSystemTransitionOffset(offsetX, offsetY);
      setSystemTransitionOverlay(1 - eased);
      updateSystemGlow(clientX, clientY, offsetX, offsetY);

      if (progress < 1) {
        requestAnimationFrame(animateArrival);
        return;
      }

      setSystemTransitionOffset(0, 0);
      setSystemTransitionOverlay(0);
      systemScreenController.setTransitioning(false);
      updateSystemParallax(clientX, clientY);
      releaseSystemPointerLock();
    };

    requestAnimationFrame(animateArrival);
  };

  requestAnimationFrame(animateTransition);
}

function lockSystemPointer(element = starWindow) {
  document.body.classList.add("transition-pointer-frozen");
  void element;
}

function releaseSystemPointerLock() {
  document.body.classList.remove("transition-pointer-frozen");
  if (document.pointerLockElement && document.exitPointerLock) {
    document.exitPointerLock();
  }
}

function setSystemTransitionOffset(x, y) {
  starWindow.style.setProperty("--system-transition-x", `${x}px`);
  starWindow.style.setProperty("--system-transition-y", `${y}px`);
}

function setSystemTransitionOverlay(opacity) {
  systemTransitionOverlay.style.opacity = String(THREE.MathUtils.clamp(opacity, 0, 1));
}

function updateSystemPlanetRotationLayers(deltaSeconds, now) {
  if (!systemScreenController.isOpen() ||
    (gasGiantTextureLayers.size === 0 && planetSurfaceRotationLayers.size === 0)) {
    return;
  }

  for (const layer of Array.from(gasGiantTextureLayers)) {
    if (!layer.isConnected || layer.dataset.staticTexture === "true") {
      gasGiantTextureLayers.delete(layer);
      continue;
    }

    const tileWidth = layer.gasGiantTileWidth || 1;
    const phase = getSystemTextureDriftPhase(
      layer.planetRotation,
      now * 0.001,
      layer.textureSpeedMultiplier || 1,
    );
    const angle = layer.gasGiantAngle || 0;
    layer.style.backgroundPosition = `${(-phase * tileWidth).toFixed(2)}px center`;
    layer.style.transform = `translate3d(-50%, -50%, 0) rotate(${angle}rad)`;
  }

  for (const layer of Array.from(planetSurfaceRotationLayers)) {
    if (!layer.isConnected) {
      planetSurfaceRotationLayers.delete(layer);
      continue;
    }

    const angle = getSystemPlanetRotationDisplayPhase(layer.planetRotation, now * 0.001) * Math.PI * 2;
    layer.style.transform = `rotate(${angle.toFixed(5)}rad)`;
  }
}

function getSystemPlanetRotationDisplayPhase(rotation, elapsedSeconds) {
  if (!rotation || rotation.turnsPerSecond === 0) {
    return rotation?.initialOffset ?? 0;
  }

  return getPlanetRotationPhase({
    ...rotation,
    turnsPerSecond: rotation.turnsPerSecond * SYSTEM_PLANET_ROTATION_DISPLAY_SCALE,
  }, elapsedSeconds);
}

function getSystemTextureDriftPhase(rotation, elapsedSeconds, speedMultiplier = 1) {
  if (!rotation || rotation.turnsPerSecond === 0) {
    return rotation?.initialOffset ?? 0;
  }

  return getPlanetRotationPhase({
    ...rotation,
    turnsPerSecond: rotation.turnsPerSecond * SYSTEM_PLANET_ROTATION_DISPLAY_SCALE * speedMultiplier,
  }, elapsedSeconds);
}

function getSystemPlanetRadius(sizeIndex) {
  return 4 + sizeIndex * ((27 - 4) / 9);
}

function createSystemStarSurface(node, starRadius, options = {}) {
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const displaySize = starRadius * 2;
  const overscan = 12;
  const canvasSize = displaySize + overscan * 2;
  const canvas = document.createElement("canvas");
  canvas.className = "system-star__surface";
  canvas.width = Math.ceil(canvasSize * pixelRatio);
  canvas.height = Math.ceil(canvasSize * pixelRatio);
  canvas.style.left = `${-overscan}px`;
  canvas.style.top = `${-overscan}px`;
  canvas.style.width = `${canvasSize}px`;
  canvas.style.height = `${canvasSize}px`;

  return {
    canvas,
    context: canvas.getContext("2d"),
    displaySize,
    canvasSize,
    overscan,
    pixelRatio,
    coreColor: node.coreColor,
    glowColor: node.glowColor,
    edgeScale: options.edgeScale ?? 1,
    noise: createSystemStarSurfaceNoise(`${SEED}:system-surface:${node.id}`, starRadius, options.edgeScale ?? 1),
  };
}

function createSystemStarSurfaceNoise(seed, radius, edgeScale = 1) {
  const random = createRandom(seed);
  const circumference = Math.PI * 2 * radius;
  const layers = [
    createLoopingNoiseLayer(random, circumference, 5.2 * edgeScale, 64, 0.46),
    createLoopingNoiseLayer(random, circumference, 2.7 * edgeScale, 72, 0.34),
    createLoopingNoiseLayer(random, circumference, 1.45 * edgeScale, 80, 0.2),
  ];

  return { layers };
}

function createLoopingNoiseLayer(random, circumference, cellPx, timeCells, weight) {
  const spatialCells = Math.max(96, Math.min(4096, Math.round(circumference / cellPx)));
  const values = new Float32Array(spatialCells * timeCells);

  for (let index = 0; index < values.length; index += 1) {
    values[index] = random() * 2 - 1;
  }

  return { spatialCells, timeCells, weight, values };
}

function smoothNoiseStep(value) {
  return value * value * (3 - 2 * value);
}

function sampleLoopingNoiseLayer(layer, spatialPosition, timePosition) {
  const { spatialCells, timeCells, values } = layer;
  const spatialBase = Math.floor(spatialPosition) % spatialCells;
  const timeBase = Math.floor(timePosition) % timeCells;
  const spatialNext = (spatialBase + 1) % spatialCells;
  const timeNext = (timeBase + 1) % timeCells;
  const spatialBlend = smoothNoiseStep(spatialPosition - Math.floor(spatialPosition));
  const timeBlend = smoothNoiseStep(timePosition - Math.floor(timePosition));
  const row = timeBase * spatialCells;
  const nextRow = timeNext * spatialCells;
  const top = THREE.MathUtils.lerp(values[row + spatialBase], values[row + spatialNext], spatialBlend);
  const bottom = THREE.MathUtils.lerp(values[nextRow + spatialBase], values[nextRow + spatialNext], spatialBlend);

  return THREE.MathUtils.lerp(top, bottom, timeBlend);
}

function sampleSystemStarSurfaceNoise(noise, angleRatio, timeRatio) {
  let value = 0;
  let weightTotal = 0;

  noise.layers.forEach((layer) => {
    const spatialPosition = angleRatio * layer.spatialCells;
    const timePosition = timeRatio * layer.timeCells;
    value += sampleLoopingNoiseLayer(layer, spatialPosition, timePosition) * layer.weight;
    weightTotal += layer.weight;
  });

  return value / weightTotal;
}

function drawSystemStarSurface(surface, now) {
  const { context, canvasSize, displaySize, overscan, pixelRatio } = surface;
  const center = canvasSize / 2;
  const radius = displaySize / 2;
  const timeRatio = (now % 34200) / 34200;
  const points = Math.max(1800, Math.min(7200, Math.ceil(radius * 7.5)));
  const edgeScale = surface.edgeScale ?? 1;
  const amplitude = THREE.MathUtils.clamp(2.5 * edgeScale, 0.28, 6);
  const innerBlend = THREE.MathUtils.clamp(60 * edgeScale, 1, 110);
  const outerReach = THREE.MathUtils.clamp(3 * edgeScale, 0.35, 7.2);
  const innerRadius = Math.max(0, radius - innerBlend);
  const gradientInnerRadius = Math.max(0, radius - innerBlend);
  const gradientOuterRadius = Math.max(gradientInnerRadius + 0.1, radius + outerReach);

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, canvasSize, canvasSize);
  context.beginPath();

  for (let index = 0; index <= points; index += 1) {
    const angleRatio = index / points;
    const angle = angleRatio * Math.PI * 2;
    const wave = sampleSystemStarSurfaceNoise(surface.noise, angleRatio, timeRatio);
    const pointRadius = radius + outerReach + wave * amplitude;
    const x = center + Math.cos(angle) * pointRadius;
    const y = center + Math.sin(angle) * pointRadius;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.closePath();
  context.arc(center, center, innerRadius, Math.PI * 2, 0, true);
  const edgeGradient = context.createRadialGradient(
    center,
    center,
    gradientInnerRadius,
    center,
    center,
    gradientOuterRadius,
  );
  edgeGradient.addColorStop(0, "rgba(255,255,255,0)");
  edgeGradient.addColorStop(0.32, hexToRgba(surface.glowColor, 0.12));
  edgeGradient.addColorStop(0.62, hexToRgba(surface.glowColor, 0.34));
  edgeGradient.addColorStop(0.84, hexToRgba(surface.glowColor, 0.7));
  edgeGradient.addColorStop(1, surface.glowColor);
  context.fillStyle = edgeGradient;
  context.fill("evenodd");
}

function createSystemOrbitLayer(width, height) {
  const overscan = 180;
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const canvas = document.createElement("canvas");
  canvas.className = "system-orbit-layer";
  canvas.dataset.overscan = String(overscan);
  canvas.width = Math.ceil((width + overscan * 2) * pixelRatio);
  canvas.height = Math.ceil((height + overscan * 2) * pixelRatio);
  canvas.style.left = `${-overscan}px`;
  canvas.style.top = `${-overscan}px`;
  canvas.style.width = `${width + overscan * 2}px`;
  canvas.style.height = `${height + overscan * 2}px`;
  return canvas;
}

function drawSystemOrbits(canvas, orbitItems) {
  const context = canvas.getContext("2d");
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const overscan = Number(canvas.dataset.overscan) || 0;
  const width = canvas.width / pixelRatio;
  const height = canvas.height / pixelRatio;

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.lineWidth = 1;
  context.lineCap = "round";

  for (const orbit of orbitItems) {
    drawNoisyOrbit(context, orbit, overscan, width, height);
  }

  for (const orbit of orbitItems) {
    drawCleanOrbitSegment(context, orbit, overscan);
  }
}

function drawNoisyOrbit(context, orbit, overscan, width, height) {
  const centerX = orbit.centerX + overscan;
  const centerY = orbit.centerY + overscan;
  const step = Math.max(0.0025, 3.6 / orbit.radius);

  for (let angle = 0; angle < Math.PI * 2; angle += step) {
    const nextAngle = Math.min(Math.PI * 2, angle + step);
    const middleAngle = (angle + nextAngle) / 2;
    const x = centerX + Math.cos(middleAngle) * orbit.radius;
    const y = centerY + Math.sin(middleAngle) * orbit.radius;

    if (x < -12 || x > width + 12 || y < -12 || y > height + 12) {
      continue;
    }

    const largeNoise =
      0.5 +
      0.5 * Math.sin(x * 0.0061 + y * 0.0037 + Math.sin(y * 0.0022) * 2.4);
    const fineNoise = Math.sin(x * 0.085 + y * 0.22) * Math.sin(x * 0.19 - y * 0.073);
    const fineCut = fineNoise > 0.82 ? 0 : 1;
    const alpha = 0.34 * (0.5 + largeNoise * 0.5) * fineCut;

    if (alpha <= 0.01) {
      continue;
    }

    context.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    context.beginPath();
    context.arc(centerX, centerY, orbit.radius, angle, nextAngle);
    context.stroke();
  }
}

function drawCleanOrbitSegment(context, orbit, overscan) {
  const centerX = orbit.centerX + overscan;
  const centerY = orbit.centerY + overscan;
  const span = 0.18;
  const pieces = 32;

  for (let index = 0; index < pieces; index += 1) {
    const startT = index / pieces;
    const endT = (index + 1) / pieces;
    const middleT = (startT + endT) / 2;
    const fade = Math.sin(middleT * Math.PI);
    const startAngle = orbit.planetAngle - span + startT * span * 2;
    const endAngle = orbit.planetAngle - span + endT * span * 2;

    context.strokeStyle = `rgba(255,255,255,${(0.46 * fade).toFixed(3)})`;
    context.beginPath();
    context.arc(centerX, centerY, orbit.radius, startAngle, endAngle);
    context.stroke();
  }
}

function createPlanetKind(random, sizeIndex) {
  const planetChances = [1, 0.95, 0.9, 0.85, 0.6, 0.15, 0.07, 0.03, 0.02, 0];
  const isPlanet = random() < planetChances[sizeIndex];

  if (isPlanet) {
    const lightness = 66 + random() * 18;
    return {
      label: "PLANET",
      background: `radial-gradient(circle at 38% 34%, hsl(0 0% ${Math.min(96, lightness + 18)}%) 0 24%, hsl(0 0% ${lightness}%) 56%, hsl(0 0% ${Math.max(32, lightness - 24)}%) 100%)`,
    };
  }

  const hue = Math.floor(random() * 360);
  const saturation = 18 + random() * 18;
  const lightness = 74 + random() * 12;
  return {
    label: "GAS GIANT",
    background: `radial-gradient(circle at 38% 34%, hsl(${hue} ${saturation}% ${Math.min(96, lightness + 14)}%) 0 22%, hsl(${hue} ${saturation}% ${lightness}%) 52%, hsl(${hue} ${Math.max(8, saturation - 8)}% ${Math.max(48, lightness - 22)}%) 100%)`,
  };
}

function applyGasGiantTexture(element, texture, displayRadius, isStatic = false, starDirX = -1, starDirY = 0, rotation = null) {
  element.style.background = "transparent";
  const isWindowSurface = element.classList.contains("planet-window__planet") ||
    element.classList.contains("planet-window__surface");
  element.classList.add(
    "gas-giant-surface",
    isWindowSurface ? "planet-window__planet--gas-giant" : "system-planet--gas-giant",
  );

  const textureLayer = document.createElement("span");
  textureLayer.className = "gas-giant-texture";
  const driftLayer = document.createElement("span");
  driftLayer.className = "gas-giant-texture__drift";
  driftLayer.style.setProperty("--gas-giant-texture", texture.url);
  const tileWidth = isWindowSurface ? texture.width : displayRadius * 4;
  driftLayer.style.setProperty("--gas-giant-tile-width", `${tileWidth}px`);
  driftLayer.style.setProperty(
    "--gas-giant-tile-height",
    `${isWindowSurface ? texture.height : displayRadius * 2}px`,
  );
  const angle = Math.atan2(starDirY, starDirX);
  driftLayer.style.setProperty("--gas-giant-angle", `${angle}rad`);
  driftLayer.dataset.staticTexture = isStatic ? "true" : "false";
  driftLayer.gasGiantTileWidth = tileWidth;
  driftLayer.gasGiantAngle = angle;
  driftLayer.planetRotation = rotation;
  const phase = getSystemPlanetRotationDisplayPhase(rotation, performance.now() * 0.001);
  driftLayer.style.backgroundPosition = `${(-phase * tileWidth).toFixed(2)}px center`;
  if (isStatic || rotation?.turnsPerSecond === 0) {
    driftLayer.classList.add("gas-giant-texture__drift--static");
    driftLayer.style.transform = `translate3d(-50%, -50%, 0) rotate(${angle}rad)`;
  } else {
    gasGiantTextureLayers.add(driftLayer);
  }
  textureLayer.append(driftLayer);
  element.append(textureLayer);

  const highlight = document.createElement("span");
  highlight.className = "gas-giant-highlight";
  element.append(highlight);
}

const PLANET_CLOUD_SYSTEM_SPEED_MULTIPLIER = 1.15;

function applyPlanetTexture(
  element,
  texture,
  displayRadius,
  isStatic = false,
  starDirX = -1,
  starDirY = 0,
  rotation = null,
  cloudRotation = rotation,
) {
  element.style.background = "transparent";
  const angle = Math.atan2(starDirY, starDirX);
  const tileWidth = displayRadius * 4;
  const tileHeight = displayRadius * 2;
  const isTidalCombineTexture = texture.textureMode === "tidal-combine";

  element.append(createPlanetTextureLayer({
    className: "planet-texture",
    textureUrl: texture.url,
    tileWidth,
    tileHeight,
    angle,
    isStatic: isStatic || isTidalCombineTexture,
    rotation: isTidalCombineTexture ? null : rotation,
    speedMultiplier: 1,
    initialPhase: isTidalCombineTexture ? 0.5 : null,
  }));

  if (texture.cloudUrl) {
    element.append(createPlanetTextureLayer({
      className: "planet-texture planet-texture--cloud",
      textureUrl: texture.cloudUrl,
      tileWidth,
      tileHeight,
      angle,
      isStatic: false,
      rotation: cloudRotation,
      speedMultiplier: PLANET_CLOUD_SYSTEM_SPEED_MULTIPLIER,
    }));
  }

  const highlight = document.createElement("span");
  highlight.className = "planet-texture-highlight";
  element.append(highlight);
}

function createPlanetTextureLayer({
  className,
  textureUrl,
  tileWidth,
  tileHeight,
  angle,
  isStatic,
  rotation,
  speedMultiplier,
  initialPhase = null,
}) {
  const textureLayer = document.createElement("span");
  textureLayer.className = className;
  const driftLayer = document.createElement("span");
  driftLayer.className = "planet-texture__drift";
  driftLayer.style.setProperty("--gas-giant-texture", textureUrl);
  driftLayer.style.setProperty("--gas-giant-tile-width", `${tileWidth}px`);
  driftLayer.style.setProperty("--gas-giant-tile-height", `${tileHeight}px`);
  driftLayer.style.setProperty("--gas-giant-angle", `${angle}rad`);
  driftLayer.dataset.staticTexture = isStatic ? "true" : "false";
  driftLayer.gasGiantTileWidth = tileWidth;
  driftLayer.gasGiantAngle = angle;
  driftLayer.planetRotation = rotation;
  driftLayer.textureSpeedMultiplier = speedMultiplier;
  const phase = Number.isFinite(initialPhase)
    ? initialPhase
    : getSystemTextureDriftPhase(rotation, performance.now() * 0.001, speedMultiplier);
  driftLayer.style.backgroundPosition = `${(-phase * tileWidth).toFixed(2)}px center`;
  if (isStatic || rotation?.turnsPerSecond === 0) {
    driftLayer.classList.add("planet-texture__drift--static");
    driftLayer.style.transform = `translate3d(-50%, -50%, 0) rotate(${angle}rad)`;
  } else {
    gasGiantTextureLayers.add(driftLayer);
  }
  textureLayer.append(driftLayer);
  return textureLayer;
}

function createPlanetSurface(
  background,
  gasGiantTexture,
  planetTexture,
  radius,
  starDirX,
  starDirY,
  isWindow = false,
  isTextureStatic = false,
  options = {},
) {
  const surface = document.createElement("div");
  surface.className = isWindow ? "planet-window__surface" : "system-planet__surface";
  if (gasGiantTexture) {
    applyGasGiantTexture(surface, gasGiantTexture, radius, isTextureStatic, starDirX, starDirY, options.rotation);
  } else if (planetTexture) {
    applyPlanetTexture(surface, planetTexture, radius, isTextureStatic, starDirX, starDirY, options.rotation, options.cloudRotation);
  } else {
    surface.append(createPlanetSurfaceFill(background, options.rotation));
  }
  if (options.innerLightColor) {
    surface.append(createPlanetInnerLight(radius, starDirX, starDirY, options.innerLightColor));
  }
  surface.append(createPlanetShadow(radius, starDirX, starDirY, options));
  return surface;
}

function createPlanetSurfaceFill(background, rotation = null) {
  const fill = document.createElement("span");
  fill.className = "system-planet__surface-fill";
  fill.style.background = background;
  fill.planetRotation = rotation;
  const angle = getSystemPlanetRotationDisplayPhase(rotation, performance.now() * 0.001) * Math.PI * 2;
  fill.style.transform = `rotate(${angle.toFixed(5)}rad)`;
  if (rotation?.turnsPerSecond !== 0) {
    planetSurfaceRotationLayers.add(fill);
  } else {
    fill.classList.add("system-planet__surface-fill--static");
  }
  return fill;
}

// Light circle offset toward the star; shadow width on axis equals this offset,
// so 2R/5 leaves a shadow ~1/5 of the disc with a concave (curved) edge.
const PLANET_SHADOW_OFFSET = 2 / 5;

function createPlanetShadow(radius, starDirX, starDirY, options = {}) {
  // The circle is a sphere: cast a concave (crescent) shadow opposite the star,
  // modelled as a soft multiply overlay rather than a solid cutout.
  const overscan = Math.max(2.5, Math.min(5, radius * 0.08));
  const center = radius + overscan;
  const lightOffset = radius * (options.shadowOffset ?? (PLANET_SHADOW_OFFSET + 0.12));
  const lightCx = center + starDirX * lightOffset;
  const lightCy = center + starDirY * lightOffset;
  const blur = Math.max(radius * (options.shadowBlurScale ?? 0.68), 5.2);

  const shadow = document.createElement("div");
  shadow.className = "system-planet-shadow";
  shadow.style.width = `${center * 2}px`;
  shadow.style.height = `${center * 2}px`;
  shadow.style.left = `${-overscan}px`;
  shadow.style.top = `${-overscan}px`;
  const shadowAlpha = options.shadowAlpha ?? 0.82;
  shadow.style.background =
    `radial-gradient(circle at ${lightCx.toFixed(2)}px ${lightCy.toFixed(2)}px, ` +
    `rgba(0, 0, 0, 0) ${(radius - blur * 0.92).toFixed(2)}px, ` +
    `rgba(0, 0, 0, ${shadowAlpha}) ${(radius + blur * 0.48).toFixed(2)}px)`;
  return shadow;
}

function createPlanetScreenPlanetGlow(radius, starDirX, starDirY, color) {
  const outerExtent = Math.max(3, Math.min(8, radius * 0.018));
  const glow = document.createElement("div");
  glow.className = "planet-screen__planet-glow";
  glow.style.width = `${(radius + outerExtent) * 2}px`;
  glow.style.height = `${(radius + outerExtent) * 2}px`;
  glow.style.left = `${-outerExtent}px`;
  glow.style.top = `${-outerExtent}px`;
  glow.style.color = color;
  glow.style.background =
    `radial-gradient(circle, ` +
    `rgba(255,255,255,0) ${(radius - outerExtent * 0.9).toFixed(2)}px, ` +
    `currentColor ${(radius - outerExtent * 0.25).toFixed(2)}px, ` +
    `currentColor ${(radius + 0.9).toFixed(2)}px, ` +
    `rgba(255,255,255,0) ${(radius + outerExtent).toFixed(2)}px)`;

  const maskRadius = radius + outerExtent;
  const maskOffset = radius * 0.82 + outerExtent;
  const maskCx = maskRadius + starDirX * maskOffset;
  const maskCy = maskRadius + starDirY * maskOffset;
  const soft = Math.max(radius * 0.22, 8);
  const maskImage =
    `radial-gradient(circle at ${maskCx.toFixed(2)}px ${maskCy.toFixed(2)}px, ` +
    `#000 ${(radius - soft).toFixed(2)}px, ` +
    `rgba(0,0,0,0) ${(radius + soft).toFixed(2)}px)`;
  glow.style.maskImage = maskImage;
  glow.style.webkitMaskImage = maskImage;
  return glow;
}

function createPlanetInnerLight(radius, starDirX, starDirY, color) {
  const light = document.createElement("div");
  light.className = "system-planet-inner-light";
  const lightCx = 50 + starDirX * 34;
  const lightCy = 50 + starDirY * 34;
  light.style.color = color;
  light.style.background =
    `radial-gradient(circle at ${lightCx.toFixed(2)}% ${lightCy.toFixed(2)}%, ` +
    `color-mix(in srgb, currentColor 72%, white) 0 12%, ` +
    `color-mix(in srgb, currentColor 44%, transparent) 34%, ` +
    `color-mix(in srgb, currentColor 14%, transparent) 58%, ` +
    `rgba(255,255,255,0) 84%)`;
  return light;
}

function createPlanetGlow(radius, starDirX, starDirY) {
  // Rim glow, sized relative to the planet, masked off on the shadowed side so
  // the planet only glows where it is lit. The glow peaks exactly at the rim
  // (no gap) and the mask circle shares the shadow's terminator.
  const glowExtent = Math.max(radius * 0.72, 4);

  const glow = document.createElement("div");
  glow.className = "system-planet-glow";
  glow.style.width = `${(radius + glowExtent) * 2}px`;
  glow.style.height = `${(radius + glowExtent) * 2}px`;
  glow.style.left = `${-glowExtent}px`;
  glow.style.top = `${-glowExtent}px`;
  const innerFeather = Math.max(3.6, radius * 0.26);
  const innerMid = Math.max(1.8, radius * 0.13);
  glow.style.background =
    `radial-gradient(circle, ` +
    `rgba(255, 255, 255, 0) ${(radius - innerFeather).toFixed(2)}px, ` +
    `rgba(255, 255, 255, 0.07) ${(radius - innerMid).toFixed(2)}px, ` +
    `rgba(255, 255, 255, 0.18) ${(radius - 1.1).toFixed(2)}px, ` +
    `rgba(255, 255, 255, 0.3) ${(radius + 0.15).toFixed(2)}px, ` +
    `rgba(255, 255, 255, 0.09) ${(radius + glowExtent * 0.48).toFixed(2)}px, ` +
    `rgba(255, 255, 255, 0) ${(radius + glowExtent).toFixed(2)}px)`;

  // Mask circle: same terminator as the shadow, with a soft falloff. This keeps
  // the raised glow as a concave crescent instead of a full halo over the planet.
  const maskRadius = radius + glowExtent;
  const maskOffset = radius * PLANET_SHADOW_OFFSET + glowExtent;
  const maskCx = maskRadius + starDirX * maskOffset;
  const maskCy = maskRadius + starDirY * maskOffset;
  const maskTerminatorRadius = radius + glowExtent * 0.24;
  const soft = Math.max(radius * 0.2, glowExtent * 0.5, 3.2);
  const maskImage =
    `radial-gradient(circle at ${maskCx.toFixed(2)}px ${maskCy.toFixed(2)}px, ` +
    `#000 ${(maskTerminatorRadius - soft).toFixed(2)}px, ` +
    `rgba(0, 0, 0, 0) ${(maskTerminatorRadius + soft).toFixed(2)}px)`;
  glow.style.maskImage = maskImage;
  glow.style.webkitMaskImage = maskImage;
  return glow;
}

function createAsteroidBelt(random, orbitRadius) {
  const halfWidth = 8 + random() * 22;
  const innerRadius = Math.max(1, orbitRadius - halfWidth);
  const outerRadius = orbitRadius + halfWidth;
  const cuts = 2 + Math.floor(random() * 6);
  const stops = [
    "transparent 0",
    `transparent ${innerRadius - 1}px`,
    `rgba(255,255,255,0.12) ${innerRadius}px`,
  ];

  for (let index = 0; index < cuts; index += 1) {
    const cutRadius = innerRadius + 2 + random() * Math.max(1, halfWidth * 2 - 4);
    stops.push(`rgba(255,255,255,0.12) ${cutRadius - 0.8}px`);
    stops.push(`transparent ${cutRadius - 0.2}px`);
    stops.push(`transparent ${cutRadius + 0.8}px`);
    stops.push(`rgba(255,255,255,0.12) ${cutRadius + 1.4}px`);
  }

  stops.push(`rgba(255,255,255,0.12) ${outerRadius}px`);
  stops.push(`transparent ${outerRadius + 1}px`);

  return {
    outerRadius,
    background: `radial-gradient(circle at center, ${stops.join(", ")})`,
  };
}

function createAccretionDisk(random, planetRadius, sizeIndex) {
  const chances = [0.02, 0.03, 0.04, 0.05, 0.06, 0.1, 0.15, 0.25, 0.35, 0.4];
  if (random() >= chances[sizeIndex]) {
    return null;
  }

  const innerRadius = planetRadius + 1 + random() * Math.max(1, planetRadius - 1);
  const thickness = planetRadius * 0.5 + random() * planetRadius * 2.5;
  const outerRadius = innerRadius + thickness;
  const cuts = Math.floor(random() * 4);
  const cutRadii = [];
  const bandCount = 1 + Math.floor(random() * 5);
  const bandRadii = [];

  for (let index = 0; index < cuts; index += 1) {
    cutRadii.push(innerRadius + 2 + random() * Math.max(1, thickness - 4));
  }

  for (let index = 0; index < bandCount; index += 1) {
    bandRadii.push({
      radius: innerRadius + 1 + random() * Math.max(1, thickness - 2),
      width: 0.8 + random() * 1.7,
      alpha: 0.1 + random() * 0.18,
    });
  }

  cutRadii.sort((a, b) => a - b);
  bandRadii.sort((a, b) => a.radius - b.radius);

  return {
    innerRadius,
    outerRadius,
    cutRadii,
    bandRadii,
    moonOrbitRadius: innerRadius + thickness / 2,
  };
}

function createAccretionDiskElement(accretionDisk, shadowAngle, shadowWidth, includeShadow = true, cutWidthScale = 1) {
  const size = Math.ceil(accretionDisk.outerRadius * 2 + 2);
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(size * pixelRatio);
  canvas.height = Math.ceil(size * pixelRatio);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;

  const context = canvas.getContext("2d");
  context.scale(pixelRatio, pixelRatio);

  const center = size / 2;
  const gradient = context.createRadialGradient(center, center, 0, center, center, accretionDisk.outerRadius + 1);
  let lastStop = 0;
  const addStop = (radius, color) => {
    const stop = Math.max(
      lastStop,
      THREE.MathUtils.clamp(radius / (accretionDisk.outerRadius + 1), 0, 1),
    );
    gradient.addColorStop(stop, color);
    lastStop = stop;
  };

  addStop(0, "rgba(255,255,255,0)");
  addStop(accretionDisk.innerRadius - 0.8, "rgba(255,255,255,0)");
  addStop(accretionDisk.innerRadius, "rgba(255,255,255,0.2)");

  const cutHalfWidth = Math.max(0.8, cutWidthScale * 0.8);
  for (const cutRadius of accretionDisk.cutRadii) {
    addStop(cutRadius - cutHalfWidth, "rgba(255,255,255,0.2)");
    addStop(cutRadius - cutHalfWidth * 0.25, "rgba(255,255,255,0)");
    addStop(cutRadius + cutHalfWidth, "rgba(255,255,255,0)");
    addStop(cutRadius + cutHalfWidth * 1.75, "rgba(255,255,255,0.2)");
  }

  addStop(accretionDisk.outerRadius, "rgba(255,255,255,0.2)");
  addStop(accretionDisk.outerRadius + 1, "rgba(255,255,255,0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  if (includeShadow) {
    context.save();
    context.globalCompositeOperation = "destination-out";
    context.translate(center, center);
    context.rotate(shadowAngle);
    context.fillStyle = "rgba(0,0,0,1)";
    context.fillRect(0, -shadowWidth / 2, accretionDisk.outerRadius * 1.8, shadowWidth);
    context.restore();
  }

  return canvas;
}

function createMoonSystem({
  random,
  planetX,
  planetY,
  planetRadius,
  planetSizeIndex,
  accretionDisk,
  starX,
  centerY,
  starRadius,
}) {
  const roll = random();
  const moonCount = roll < 0.5 ? 0 : roll < 0.8 ? 1 : roll < 0.9 ? 2 : roll < 0.95 ? 3 : 0;
  const smallOrbitBonus = [5, 4, 3][planetSizeIndex] ?? 0;
  const orbitRadius = accretionDisk
    ? accretionDisk.moonOrbitRadius
    : planetRadius * (1.35 + random() * 0.65) + smallOrbitBonus;
  const moons = [];

  if (moonCount === 0) {
    return { moonCount, orbitRadius, moons, planetX, planetY };
  }

  const startAngle = random() * Math.PI * 2;
  const moonSizes = [1.2, 1.6, 2];
  const placedMoons = [];

  for (let index = 0; index < moonCount; index += 1) {
    const sector = (Math.PI * 2) / moonCount;
    const moonSizeIndex = Math.floor(random() * moonSizes.length);
    const moonRadius = moonSizes[moonSizeIndex];
    const angle = pickSafeMoonAngle({
      random,
      baseAngle: startAngle + sector * index,
      sector,
      planetX,
      planetY,
      orbitRadius,
      moonRadius,
      placedMoons,
      starX,
      centerY,
      starRadius,
    });
    const moonX = planetX + Math.cos(angle) * orbitRadius;
    const moonY = planetY + Math.sin(angle) * orbitRadius;
    placedMoons.push({ x: moonX, y: moonY, radius: moonRadius });
    moons.push({ x: moonX, y: moonY, radius: moonRadius, sizeIndex: moonSizeIndex });
  }

  return { moonCount, orbitRadius, moons, planetX, planetY };
}

function renderMoons({ moonCount, orbitRadius, moons, planetX, planetY, starDirX, starDirY }) {
  if (moonCount === 0) {
    return;
  }

  const orbit = document.createElement("div");
  orbit.className = "system-moon-orbit";
  orbit.style.width = `${orbitRadius * 2}px`;
  orbit.style.height = `${orbitRadius * 2}px`;
  orbit.style.left = `${planetX - orbitRadius}px`;
  orbit.style.top = `${planetY - orbitRadius}px`;
  starSystem.append(orbit);

  for (const moonItem of moons) {
    const moon = document.createElement("div");
    moon.className = "system-moon";
    moon.style.width = `${moonItem.radius * 2}px`;
    moon.style.height = `${moonItem.radius * 2}px`;
    moon.style.left = `${moonItem.x - moonItem.radius}px`;
    moon.style.top = `${moonItem.y - moonItem.radius}px`;
    starSystem.append(moon);
  }
}

function getPlanetConstructionRadius(planetRadius, accretionDisk, moonSystem) {
  const moonRadius = moonSystem.moons.reduce((maxRadius, moon) => Math.max(maxRadius, moon.radius), 0);
  return Math.max(
    planetRadius,
    accretionDisk?.outerRadius ?? 0,
    moonSystem.moonCount > 0 ? moonSystem.orbitRadius + moonRadius + 2 : 0,
  );
}

function pickSafeMoonAngle({
  random,
  baseAngle,
  sector,
  planetX,
  planetY,
  orbitRadius,
  moonRadius,
  placedMoons,
  starX,
  centerY,
  starRadius,
}) {
  const fallbackAngles = [0, -0.42, 0.42, -0.78, 0.78];
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const angle = baseAngle + (random() - 0.5) * sector * 0.72;
    if (isSafeMoonPosition(angle)) {
      return angle;
    }
  }

  for (const angle of fallbackAngles) {
    if (isSafeMoonPosition(angle)) {
      return angle;
    }
  }

  return 0;

  function isSafeMoonPosition(angle) {
    const moonX = planetX + Math.cos(angle) * orbitRadius;
    const moonY = planetY + Math.sin(angle) * orbitRadius;
    const starDistance = Math.hypot(moonX - starX, moonY - centerY);
    const insideStar = starDistance < starRadius + moonRadius + 14;
    const outsideViewport =
      moonX < moonRadius + 8 ||
      moonX > window.innerWidth - moonRadius - 8 ||
      moonY < moonRadius + 8 ||
      moonY > window.innerHeight - moonRadius - 8;
    const hitsMoon = placedMoons.some((moon) => (
      Math.hypot(moonX - moon.x, moonY - moon.y) < moonRadius + moon.radius + 4
    ));

    return !insideStar && !outsideViewport && !hitsMoon;
  }
}

function createSystemOrbitRadii(count, minOrbit, maxOrbit, random) {
  if (count <= 0) {
    return [];
  }

  const span = maxOrbit - minOrbit;
  const slack = THREE.MathUtils.clamp((13 - count) / 12, 0, 1);

  if (count === 1) {
    const inset = span * slack * 0.18;
    return [THREE.MathUtils.lerp(minOrbit + inset, maxOrbit - inset, random())];
  }

  const minGap = Math.min(74, span / (count - 1) * 0.58);
  const startInset = random() * span * slack * 0.24;
  const endInset = random() * span * slack * 0.2;
  let startOrbit = minOrbit + startInset;
  let endOrbit = maxOrbit - endInset;
  const minRequiredSpan = minGap * (count - 1);

  if (endOrbit - startOrbit < minRequiredSpan) {
    const midpoint = (startOrbit + endOrbit) / 2;
    startOrbit = Math.max(minOrbit, midpoint - minRequiredSpan / 2);
    endOrbit = Math.min(maxOrbit, startOrbit + minRequiredSpan);
    startOrbit = Math.max(minOrbit, endOrbit - minRequiredSpan);
  }

  const usableSpan = endOrbit - startOrbit;
  const remaining = Math.max(0, usableSpan - minGap * (count - 1));
  const weights = Array.from({ length: count - 1 }, () => 0.55 + random() * 1.35);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const radii = [startOrbit];

  for (let index = 0; index < weights.length; index += 1) {
    const extraGap = totalWeight > 0 ? (remaining * weights[index]) / totalWeight : 0;
    radii.push(radii[index] + minGap + extraGap);
  }

  return radii;
}

function getSystemStarRadius(node, height, random) {
  const typeScale = {
    "Neutron Star": 0.12,
    "Red Dwarf": 0.2,
    "Orange Dwarf": 0.24,
    "Orange Star": 0.36,
    "Yellow Star": 0.44,
    "Yellow-White Star": 0.52,
    "White Star": 0.76,
    "Blue Star": 0.9,
    "Blue Giant": 1.34,
    "Red Giant": 1.46,
    "Blue Supergiant": 2.42,
    "Red Supergiant": 3,
    "Strange Star": 3,
  };
  const normalizedSize = THREE.MathUtils.clamp((node.size - 0.018) / (0.046 - 0.018), 0, 1);
  const scale = typeScale[node.starType] ?? THREE.MathUtils.lerp(0.2, 3, normalizedSize);
  const jitter = 0.9 + random() * 0.2;
  return THREE.MathUtils.clamp(height * scale * jitter, height * 0.2, height * 3);
}

function startNodeExitAnimation(nodeId, color) {
  nodeExitAnimations.set(nodeId, { color, progress: 1 });

  for (const neighborId of adjacency.get(nodeId)) {
    if (nodeColors.get(neighborId) !== color) {
      continue;
    }

    const key = getEdgeAnimationKey(color, nodeId, neighborId);
    edgeExitAnimations.set(key, {
      color,
      a: nodeId,
      b: neighborId,
      origin: neighborId,
      progress: 1,
    });
    edgeAnimationProgress.delete(key);
    edgeAnimationOrigins.delete(key);
  }
}

function addEdgeAnimationsForNode(nodeId, color) {
  for (const neighborId of adjacency.get(nodeId)) {
    if (nodeColors.get(neighborId) !== color) {
      continue;
    }

    const key = getEdgeAnimationKey(color, nodeId, neighborId);
    edgeAnimationProgress.set(key, 0);
    edgeAnimationOrigins.set(key, neighborId);
  }
}

function removeEdgeAnimationsForNode(nodeId) {
  for (const key of Array.from(edgeAnimationProgress.keys())) {
    if (key.includes(`:${nodeId}:`) || key.endsWith(`:${nodeId}`)) {
      edgeAnimationProgress.delete(key);
      edgeAnimationOrigins.delete(key);
    }
  }
}

function getEdgeAnimationKey(color, a, b) {
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  return `${color}:${low}:${high}`;
}

function updateSelectionAnimations() {
  for (const [nodeId, progress] of nodeAnimationProgress) {
    nodeAnimationProgress.set(nodeId, Math.min(1, progress + 0.055));
  }

  for (const [key, progress] of edgeAnimationProgress) {
    edgeAnimationProgress.set(key, Math.min(1, progress + 0.055));
  }

  for (const [nodeId, animation] of nodeExitAnimations) {
    animation.progress = Math.max(0, animation.progress - 0.065);
    if (animation.progress <= 0) {
      nodeExitAnimations.delete(nodeId);
    }
  }

  for (const [key, animation] of edgeExitAnimations) {
    animation.progress = Math.max(0, animation.progress - 0.065);
    if (animation.progress <= 0) {
      edgeExitAnimations.delete(key);
    }
  }
}

function getNodeHit() {
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(hitTargets, false)[0]?.object ?? null;
}

function getScreenNodeHit(clientX, clientY) {
  graphRoot.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);

  const target = new THREE.Vector2(clientX, clientY);
  const projected = new THREE.Vector3();
  let bestIndex = -1;
  let bestDistance = Infinity;

  for (let index = 0; index < nodes.length; index += 1) {
    projected.copy(nodes[index].position).applyMatrix4(graphRoot.matrixWorld).project(camera);

    if (projected.z < -1 || projected.z > 1) {
      continue;
    }

    const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-projected.y * 0.5 + 0.5) * window.innerHeight;
    const distance = target.distanceTo(new THREE.Vector2(screenX, screenY));

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  if (bestIndex === -1 || bestDistance > 18) {
    return null;
  }

  return {
    userData: {
      node: nodes[bestIndex],
      visual: nodeMeshes[bestIndex],
    },
  };
}

function updateSelectionOverlay(color, selectedNodeItems, visibleEdges, fadingEdges) {
  const material = selectionOverlay.material;
  const pointCount = Math.min(selectedNodeItems.length, MAX_SELECTION_POINTS);
  const segmentCount = Math.min(visibleEdges.length, MAX_SELECTION_SEGMENTS);
  const fadingSegmentCount = Math.min(fadingEdges.length, MAX_SELECTION_FADING_SEGMENTS);
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const zoomScale = INITIAL_CAMERA_DISTANCE / camera.position.z;

  renderer.getDrawingBufferSize(selectionScreenSize);
  material.uniforms.resolution.value.copy(selectionScreenSize);
  material.uniforms.nodeRadius.value = 31 * pixelRatio * zoomScale;
  material.uniforms.tubeRadius.value = 16 * pixelRatio * zoomScale;
  material.uniforms.strokeWidth.value = Math.max(1, 1 * pixelRatio * zoomScale);
  material.uniforms.glowWidth.value = 5 * pixelRatio * zoomScale;
  material.uniforms.pointCount.value = pointCount;
  material.uniforms.segmentCount.value = segmentCount;
  material.uniforms.fadingSegmentCount.value = fadingSegmentCount;
  material.uniforms.color.value.set(color);
  material.uniforms.strokeColor.value.copy(lightenHexColor(color, 0.5));

  graphRoot.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);

  for (let index = 0; index < MAX_SELECTION_POINTS; index += 1) {
    if (index < pointCount) {
      const nodeItem = selectedNodeItems[index];
      const screenPoint = projectNodeToScreen(nodeItem.id);
      selectionOverlay.points[index].copy(screenPoint);
      selectionOverlay.pointRadii[index] =
        material.uniforms.nodeRadius.value * easeOutCubic(nodeItem.progress);
    } else {
      selectionOverlay.points[index].set(-10000, -10000);
      selectionOverlay.pointRadii[index] = 0;
    }
  }

  for (let index = 0; index < MAX_SELECTION_SEGMENTS; index += 1) {
    if (index < segmentCount) {
      const edge = visibleEdges[index];
      const origin = edge.origin;
      const progress = easeOutCubic(edge.progress);
      const startPoint = projectNodeToScreen(edge.a);
      const endPoint = projectNodeToScreen(edge.b);

      if (origin === edge.a) {
        selectionOverlay.segmentStarts[index].copy(startPoint);
        selectionOverlay.segmentEnds[index].copy(startPoint).lerp(endPoint, progress);
      } else if (origin === edge.b) {
        selectionOverlay.segmentStarts[index].copy(endPoint);
        selectionOverlay.segmentEnds[index].copy(endPoint).lerp(startPoint, progress);
      } else {
        selectionOverlay.segmentStarts[index].copy(startPoint);
        selectionOverlay.segmentEnds[index].copy(endPoint);
      }
    } else {
      selectionOverlay.segmentStarts[index].set(-10000, -10000);
      selectionOverlay.segmentEnds[index].set(-10000, -10000);
    }
  }

  for (let index = 0; index < MAX_SELECTION_FADING_SEGMENTS; index += 1) {
    if (index < fadingSegmentCount) {
      const edge = fadingEdges[index];
      const clippedSegment = projectSegmentToScreen(edge.start, edge.end);

      if (!clippedSegment) {
        selectionOverlay.fadingSegmentStarts[index].set(-10000, -10000);
        selectionOverlay.fadingSegmentEnds[index].set(-10000, -10000);
        selectionOverlay.fadingSegmentProgresses[index] = 0;
        continue;
      }

      selectionOverlay.fadingSegmentStarts[index].copy(clippedSegment.start);
      selectionOverlay.fadingSegmentEnds[index].copy(clippedSegment.end);
      selectionOverlay.fadingSegmentProgresses[index] = easeOutCubic(edge.progress);
    } else {
      selectionOverlay.fadingSegmentStarts[index].set(-10000, -10000);
      selectionOverlay.fadingSegmentEnds[index].set(-10000, -10000);
      selectionOverlay.fadingSegmentProgresses[index] = 0;
    }
  }
}

function getSelectionGroups() {
  const groups = new Map();

  for (const [nodeId, color] of nodeColors) {
    if (!groups.has(color)) {
      groups.set(color, { nodes: [], edges: [], fadingEdges: [] });
    }
    groups.get(color).nodes.push({
      id: nodeId,
      progress: nodeAnimationProgress.get(nodeId) ?? 1,
    });
  }

  for (const [nodeId, animation] of nodeExitAnimations) {
    if (!groups.has(animation.color)) {
      groups.set(animation.color, { nodes: [], edges: [], fadingEdges: [] });
    }
    groups.get(animation.color).nodes.push({
      id: nodeId,
      progress: animation.progress,
    });
  }

  for (const link of links) {
    const startColor = nodeColors.get(link.a);
    if (startColor && startColor === nodeColors.get(link.b)) {
      const key = getEdgeAnimationKey(startColor, link.a, link.b);
      groups.get(startColor).edges.push({
        ...link,
        origin: edgeAnimationOrigins.get(key),
        progress: edgeAnimationProgress.get(key) ?? 1,
      });
    }
  }

  for (const link of outerLinks) {
    const color = nodeColors.get(link.parentId);
    if (!color) {
      continue;
    }

    groups.get(color).fadingEdges.push({
      ...link,
      progress: nodeAnimationProgress.get(link.parentId) ?? 1,
    });
  }

  for (const [nodeId, animation] of nodeExitAnimations) {
    if (!groups.has(animation.color)) {
      groups.set(animation.color, { nodes: [], edges: [], fadingEdges: [] });
    }

    for (const link of outerLinks) {
      if (link.parentId !== nodeId) {
        continue;
      }

      groups.get(animation.color).fadingEdges.push({
        ...link,
        progress: animation.progress,
      });
    }
  }

  for (const animation of edgeExitAnimations.values()) {
    if (!groups.has(animation.color)) {
      groups.set(animation.color, { nodes: [], edges: [], fadingEdges: [] });
    }
    groups.get(animation.color).edges.push(animation);
  }

  return groups;
}

function projectNodeToScreen(nodeId) {
  return projectVectorToScreen(nodes[nodeId].position);
}

function projectVectorToScreen(vector) {
  const projected = vector.clone().applyMatrix4(graphRoot.matrixWorld).project(camera);
  return new THREE.Vector2(
    (projected.x * 0.5 + 0.5) * selectionScreenSize.x,
    (projected.y * 0.5 + 0.5) * selectionScreenSize.y,
  );
}

function projectSegmentToScreen(start, end) {
  const startWorld = start.clone().applyMatrix4(graphRoot.matrixWorld);
  const endWorld = end.clone().applyMatrix4(graphRoot.matrixWorld);
  const startCamera = startWorld.clone().applyMatrix4(camera.matrixWorldInverse);
  const endCamera = endWorld.clone().applyMatrix4(camera.matrixWorldInverse);
  const nearZ = -camera.near;
  const startVisible = startCamera.z <= nearZ;
  const endVisible = endCamera.z <= nearZ;

  if (!startVisible && !endVisible) {
    return null;
  }

  if (startVisible !== endVisible) {
    const t = (nearZ - startCamera.z) / (endCamera.z - startCamera.z);
    const clipped = startCamera.clone().lerp(endCamera, THREE.MathUtils.clamp(t, 0, 1));

    if (startVisible) {
      endCamera.copy(clipped);
    } else {
      startCamera.copy(clipped);
    }
  }

  return {
    start: projectCameraSpaceToScreen(startCamera),
    end: projectCameraSpaceToScreen(endCamera),
  };
}

function projectCameraSpaceToScreen(cameraSpacePoint) {
  const projected = new THREE.Vector4(
    cameraSpacePoint.x,
    cameraSpacePoint.y,
    cameraSpacePoint.z,
    1,
  ).applyMatrix4(camera.projectionMatrix);
  const inverseW = 1 / projected.w;
  const x = projected.x * inverseW;
  const y = projected.y * inverseW;

  return new THREE.Vector2(
    (x * 0.5 + 0.5) * selectionScreenSize.x,
    (y * 0.5 + 0.5) * selectionScreenSize.y,
  );
}

function updateStarLabels() {
  graphRoot.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);

  const width = window.innerWidth;
  const height = window.innerHeight;
  const projected = new THREE.Vector3();

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const label = labelElements[index];
    projected.copy(node.position).applyMatrix4(graphRoot.matrixWorld).project(camera);

    const visible =
      projected.z > -1 &&
      projected.z < 1 &&
      projected.x > -1.08 &&
      projected.x < 1.08 &&
      projected.y > -1.08 &&
      projected.y < 1.08;
    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (-projected.y * 0.5 + 0.5) * height - 10;

    label.style.left = `${x}px`;
    label.style.top = `${y}px`;
    label.classList.toggle("hidden", !visible || hoveredNode?.userData.node.id === node.id);
  }
}

function positionTooltip(clientX, clientY) {
  positionHoverElements(clientX, clientY, hoverNameWrap, hoverPanel);
}

function positionSystemTooltip(clientX, clientY) {
  const radiusOffset = hoveredSystemBody ? Number(hoveredSystemBody.dataset.radius) + 2 : 0;
  positionHoverElements(clientX, clientY, systemHoverNameWrap, systemHoverPanel, radiusOffset);
}

function positionHoverElements(clientX, clientY, nameElement, panelElement, verticalOffset = 0) {
  const nameWidth = nameElement.offsetWidth || 120;
  const panelHeight = panelElement.offsetHeight || 63;
  const panelWidth = panelElement.offsetWidth || 112;
  const centeredNameX = THREE.MathUtils.clamp(clientX, nameWidth / 2 + 12, window.innerWidth - nameWidth / 2 - 12);
  const centeredPanelX = THREE.MathUtils.clamp(clientX, panelWidth / 2 + 12, window.innerWidth - panelWidth / 2 - 12);
  const nameTop = THREE.MathUtils.clamp(clientY - 62 - verticalOffset, 12, window.innerHeight - 24);
  const panelTop = THREE.MathUtils.clamp(clientY + 10 + verticalOffset, 12, window.innerHeight - panelHeight - 12);

  nameElement.style.left = `${centeredNameX}px`;
  nameElement.style.top = `${nameTop}px`;
  panelElement.style.left = `${centeredPanelX}px`;
  panelElement.style.top = `${panelTop}px`;
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  systemGlowLayer.resize(width, height);
  const didResizePlanetScreen = planetScreenController.resize();
  if (
    !didResizePlanetScreen &&
    !isObjectDetailOpen &&
    systemScreenController.isOpen() &&
    systemScreenController.state.activeNode
  ) {
    renderStarSystem(systemScreenController.state.activeNode);
    renderSystemStars(systemScreenController.state.activeNode);
    renderSystemParticles(systemScreenController.state.activeNode);
    updateSystemGlow(width / 2, height / 2, 0, 0);
  }
  graphRoot.traverse((object) => {
    if (object.userData.isSkyPixels) {
      object.material.uniforms.pixelRatio.value = pixelRatio;
    }
  });
  if (systemScreenController.isOpen()) {
    musicPlayerController.ensureSystemPosition();
  }
  resizeObjectDetail3D();
  renderObjectDetail3D();
  musicPlayerController.updateScrollbar();
}

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const deltaSeconds = Math.min(0.05, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  if (!systemScreenController.isOpen()) {
    updateHover();
    updateStarLabels();
    updateSelectionAnimations();
    updateLinkPulse(deltaSeconds);

    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCameraDistance, 0.14);
    graphRoot.rotation.x = THREE.MathUtils.lerp(graphRoot.rotation.x, targetRotation.x, 0.08);
    graphRoot.rotation.y = THREE.MathUtils.lerp(graphRoot.rotation.y, targetRotation.y, 0.08);
    graphRoot.rotation.z = Math.sin(performance.now() * 0.00012) * 0.025;

    if (!isDragging) {
      targetRotation.x += rotationVelocity.x;
      targetRotation.y += rotationVelocity.y;
      rotationVelocity.multiplyScalar(0.95);
    }
  } else if (!planetScreenController.isOpen() && !isObjectDetailOpen && activeSystemStarSurface) {
    drawSystemStarSurface(activeSystemStarSurface, now);
  }

  if (systemScreenController.isOpen() && !planetScreenController.isOpen() && !isObjectDetailOpen) {
    updateSystemParallax(lastClientPointer.x, lastClientPointer.y);
  }

  planetScreenController.tick(now, deltaSeconds);

  if (updateObjectDetailLightMotion(now)) {
    renderObjectDetail3D();
  }

  if (!planetScreenController.isOpen() && !isObjectDetailOpen) {
    updateSystemPlanetRotationLayers(deltaSeconds, now);
  }

  if (isPlanetWindowOpen) {
    updatePlanetLink();
  }

  renderer.clear(true, true, true);
  renderer.render(scene, camera);
  renderer.clearDepth();

  for (const [color, group] of getSelectionGroups()) {
    updateSelectionOverlay(color, group.nodes, group.edges, group.fadingEdges);
    renderer.render(selectionOverlay.scene, selectionOverlay.camera);
  }
}
