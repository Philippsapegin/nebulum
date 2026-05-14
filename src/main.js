import "./styles.css";
import * as THREE from "three";
import { GEN_SYLLABLES, MEGAGEN_SYLLABLES } from "./syllables.js";

const params = new URLSearchParams(window.location.search);
const SEED = params.get("seed") || "nebulum";
const NODE_COUNT = 42;
const LINK_DISTANCE = 2.35;
const MAX_LINKS_PER_NODE = 4;
const MAX_SELECTION_POINTS = 48;
const MAX_SELECTION_SEGMENTS = 128;
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
const STAR_TYPES = [
  {
    type: "Red Dwarf",
    color: "#fff4f0",
    coreColor: "#fffafa",
    size: [0.018, 0.023],
  },
  {
    type: "Orange Dwarf",
    color: "#fff6ed",
    coreColor: "#fffaf5",
    size: [0.019, 0.024],
  },
  {
    type: "Orange Star",
    color: "#ffdfbd",
    coreColor: "#fff3df",
    size: [0.024, 0.031],
  },
  {
    type: "Yellow Star",
    color: "#fff1b7",
    coreColor: "#fff9df",
    size: [0.026, 0.033],
  },
  {
    type: "Yellow-White Star",
    color: "#fff9d8",
    coreColor: "#fffdf2",
    size: [0.027, 0.034],
  },
  {
    type: "White Star",
    color: "#ffffff",
    coreColor: "#ffffff",
    size: [0.034, 0.04],
  },
  {
    type: "Blue Star",
    color: "#edf5ff",
    coreColor: "#f8fbff",
    size: [0.035, 0.041],
  },
  {
    type: "Blue Giant",
    color: "#bfd9ff",
    coreColor: "#edf5ff",
    size: [0.041, 0.045],
  },
  {
    type: "Red Giant",
    color: "#ffc2ba",
    coreColor: "#fff0ed",
    size: [0.041, 0.045],
  },
  {
    type: "Blue Supergiant",
    color: "#a9ccff",
    coreColor: "#eaf3ff",
    size: [0.045, 0.046],
  },
  {
    type: "Red Supergiant",
    color: "#ffaaa2",
    coreColor: "#ffe8e4",
    size: [0.045, 0.046],
  },
  {
    type: "Neutron Star",
    color: "#c6ffe1",
    coreColor: "#f6fffa",
    size: [0.018, 0.046],
  },
  {
    type: "Black Hole",
    color: "#fff4bf",
    coreColor: "#020202",
    size: [0.018, 0.046],
    blackCore: true,
  },
];

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
const skyGradientColorsElement = document.querySelector("#sky-gradient-colors");
const addSkyColorButton = document.querySelector("#add-sky-color");
const regenerateSkyButton = document.querySelector("#regenerate-sky");

const renderer = new THREE.WebGLRenderer({
  canvas: sceneCanvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050506, 0.045);

const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 12);

const graphRoot = new THREE.Group();
scene.add(graphRoot);

const ambient = new THREE.AmbientLight(0xffffff, 0.14);
scene.add(ambient);

const keyLight = new THREE.PointLight(0xffffff, 1.8, 28);
keyLight.position.set(4, 5, 8);
scene.add(keyLight);

const rand = createRandom(SEED);
const nameRand = createRandom(`${SEED}:names`);
const nodes = createNodes(rand).map((node) => ({
  ...node,
  name: createStarName(nameRand),
}));
const links = createLinks(nodes);
const outerLinks = createOuterLinks(nodes, createRandom(`${SEED}:outer-links`));
const adjacency = createAdjacency(links);
const nodeMeshes = [];
const labelElements = [];
const hitTargets = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(10, 10);
const rotationVelocity = new THREE.Vector2(0, 0);
const targetRotation = new THREE.Euler(-0.18, 0.36, 0, "YXZ");
const linkPulse = createLinkPulse(createRandom(`${SEED}:link-pulse`));

let isDragging = false;
let lastPointer = new THREE.Vector2();
let pointerDownPosition = new THREE.Vector2();
let hoveredNode = null;
let currentMaskColor = "#00e1ff";
let tooltipTypingTimeout = null;
let tooltipTypingInterval = null;
let tooltipClearTimeout = null;
let tooltipTypingToken = 0;
let lastFrameTime = performance.now();
let skyRandomVersion = 0;
let skyMesh = null;
const skyGradientColors = ["#27648f", "#000000", "#884d26", "#000000"];
const nodeColors = new Map();
const nodeAnimationProgress = new Map();
const edgeAnimationProgress = new Map();
const edgeAnimationOrigins = new Map();
const nodeExitAnimations = new Map();
const edgeExitAnimations = new Map();
const selectionOverlay = createSelectionOverlay();
const selectionScreenSize = new THREE.Vector2();

initPanel();
buildSky(createRandom(`${SEED}:sky`));
buildLocalSpaceStars(createRandom(`${SEED}:local-space`));
buildLinks(links);
buildOuterLinks(outerLinks);
buildNodes(nodes);
graphRoot.add(linkPulse.sprite);
resize();
animate();

window.addEventListener("resize", resize);
window.addEventListener("pointermove", onPointerMove);
sceneCanvas.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("pointercancel", onPointerUp);

function initPanel() {
  seedInput.value = SEED;
  updateCurrentColorUi();
  updateUsedColorsUi();
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

  clearButton.addEventListener("click", () => {
    nodeColors.clear();
    nodeAnimationProgress.clear();
    edgeAnimationProgress.clear();
    edgeAnimationOrigins.clear();
    nodeExitAnimations.clear();
    edgeExitAnimations.clear();
    updateUsedColorsUi();
  });

  addSkyColorButton.addEventListener("click", () => {
    if (skyGradientColors.length >= 4) {
      return;
    }

    skyGradientColors.push("#070812");
    renderSkyGradientControls();
    updateSkyTexture();
  });

  regenerateSkyButton.addEventListener("click", () => {
    skyRandomVersion += 1;
    updateSkyTexture();
  });
}

function renderSkyGradientControls() {
  skyGradientColorsElement.replaceChildren();
  addSkyColorButton.disabled = skyGradientColors.length >= 4;

  for (let index = 0; index < skyGradientColors.length; index += 1) {
    const wrapper = document.createElement("div");
    wrapper.className = "gradient-color-wrap";

    const input = document.createElement("button");
    input.className = "gradient-color";
    input.type = "button";
    input.style.color = skyGradientColors[index];
    input.style.backgroundColor = skyGradientColors[index];
    input.title = `Sky gradient color ${index + 1}`;
    input.addEventListener("click", (event) => {
      event.stopPropagation();
      openColorPicker(input, skyGradientColors[index], (color) => {
        skyGradientColors[index] = color;
        input.style.color = color;
        input.style.backgroundColor = color;
        updateSkyTexture();
      });
    });

    wrapper.append(input);

    if (skyGradientColors.length > 1) {
      const removeButton = document.createElement("button");
      removeButton.className = "gradient-remove";
      removeButton.type = "button";
      removeButton.textContent = "x";
      removeButton.title = "Remove color";
      removeButton.addEventListener("click", () => {
        skyGradientColors.splice(index, 1);
        renderSkyGradientControls();
        updateSkyTexture();
      });
      wrapper.append(removeButton);
    }

    skyGradientColorsElement.append(wrapper);
  }
}

function regenerateFromSeedInput() {
  const nextSeed = seedInput.value.trim() || "nebulum";
  const url = new URL(window.location.href);
  url.searchParams.set("seed", nextSeed);
  url.searchParams.delete("multiplier");
  window.location.href = url.toString();
}

function updateCurrentColorUi() {
  currentColorSwatch.style.backgroundColor = currentMaskColor;
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
    button.style.backgroundColor = color;
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

function normalizeHexColor(color) {
  const trimmed = color.trim().toLowerCase();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  const shortMatch = withHash.match(/^#([0-9a-f]{3})$/);
  if (shortMatch) {
    return `#${shortMatch[1]
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`;
  }
  return withHash;
}

let colorPicker = null;

function openColorPicker(anchor, color, onChange) {
  if (!colorPicker) {
    colorPicker = createColorPicker();
  }

  colorPicker.anchor = anchor;
  colorPicker.onChange = onChange;
  setColorPickerColor(color, false);
  positionColorPicker(anchor);
  colorPicker.root.hidden = false;
}

function createColorPicker() {
  const root = document.createElement("div");
  root.className = "color-popover";
  root.hidden = true;
  root.innerHTML = `
    <div class="color-popover__plane">
      <span class="color-popover__handle"></span>
    </div>
    <input class="color-popover__hue" type="range" min="0" max="360" step="1" />
    <input class="color-popover__hex" type="text" autocomplete="off" spellcheck="false" maxlength="7" />
  `;
  document.body.append(root);

  const picker = {
    root,
    plane: root.querySelector(".color-popover__plane"),
    handle: root.querySelector(".color-popover__handle"),
    hue: root.querySelector(".color-popover__hue"),
    hex: root.querySelector(".color-popover__hex"),
    hsv: { h: 0, s: 1, v: 1 },
    anchor: null,
    onChange: null,
  };

  picker.plane.addEventListener("pointerdown", (event) => {
    picker.plane.setPointerCapture(event.pointerId);
    updatePickerFromPlane(event);
  });
  picker.plane.addEventListener("pointermove", (event) => {
    if (event.buttons !== 1) {
      return;
    }
    updatePickerFromPlane(event);
  });
  picker.hue.addEventListener("input", () => {
    picker.hsv.h = Number(picker.hue.value);
    emitPickerColor();
  });
  picker.hex.addEventListener("input", () => {
    const normalized = normalizeHexColor(picker.hex.value);
    if (!/^#[0-9a-f]{6}$/.test(normalized)) {
      return;
    }
    setColorPickerColor(normalized, true);
  });
  root.addEventListener("pointerdown", (event) => event.stopPropagation());
  document.addEventListener("pointerdown", (event) => {
    if (root.hidden || root.contains(event.target) || picker.anchor?.contains(event.target)) {
      return;
    }
    root.hidden = true;
  });
  window.addEventListener("resize", () => {
    if (!root.hidden && picker.anchor) {
      positionColorPicker(picker.anchor);
    }
  });

  return picker;
}

function positionColorPicker(anchor) {
  const rect = anchor.getBoundingClientRect();
  const width = 234;
  const left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.left));
  const top = Math.min(window.innerHeight - 278, rect.bottom + 8);
  colorPicker.root.style.left = `${left}px`;
  colorPicker.root.style.top = `${Math.max(8, top)}px`;
}

function updatePickerFromPlane(event) {
  const rect = colorPicker.plane.getBoundingClientRect();
  const x = THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const y = THREE.MathUtils.clamp((event.clientY - rect.top) / rect.height, 0, 1);
  colorPicker.hsv.s = x;
  colorPicker.hsv.v = 1 - y;
  emitPickerColor();
}

function setColorPickerColor(color, emit) {
  colorPicker.hsv = hexToHsv(color);
  if (emit) {
    emitPickerColor();
  } else {
    updateColorPickerUi(color);
  }
}

function emitPickerColor() {
  const color = hsvToHex(colorPicker.hsv);
  updateColorPickerUi(color);
  colorPicker.onChange?.(color);
}

function updateColorPickerUi(color) {
  const { h, s, v } = colorPicker.hsv;
  colorPicker.root.style.setProperty("--picker-hue", `hsl(${h} 100% 50%)`);
  colorPicker.handle.style.left = `${s * 100}%`;
  colorPicker.handle.style.top = `${(1 - v) * 100}%`;
  colorPicker.hue.value = String(Math.round(h));
  colorPicker.hex.value = color;
}

function hexToHsv(color) {
  const normalized = normalizeHexColor(color).replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let h = 0;

  if (delta > 0) {
    if (max === red) {
      h = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      h = 60 * ((blue - red) / delta + 2);
    } else {
      h = 60 * ((red - green) / delta + 4);
    }
  }

  return {
    h: h < 0 ? h + 360 : h,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

function hsvToHex({ h, s, v }) {
  const chroma = v * s;
  const hue = h / 60;
  const x = chroma * (1 - Math.abs((hue % 2) - 1));
  const match = hue < 1
    ? [chroma, x, 0]
    : hue < 2
      ? [x, chroma, 0]
      : hue < 3
        ? [0, chroma, x]
        : hue < 4
          ? [0, x, chroma]
          : hue < 5
            ? [x, 0, chroma]
            : [chroma, 0, x];
  const m = v - chroma;
  return `#${match
    .map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function lightenHexColor(color, amount = 0.5) {
  const normalized = normalizeHexColor(color).replace("#", "");
  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const lighten = (channel) => Math.round(channel + (255 - channel) * amount);
  return new THREE.Color(
    lighten(red) / 255,
    lighten(green) / 255,
    lighten(blue) / 255,
  );
}

function createRandom(seed) {
  let hash = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967296;
  };
}

function createNodes(random) {
  return Array.from({ length: NODE_COUNT }, (_, id) => {
    const star = createStarProfile(random);
    const radius = 1.4 + random() * 3.55;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    const drift = new THREE.Vector3(
      (random() - 0.5) * 1.8,
      (random() - 0.5) * 1.4,
      (random() - 0.5) * 1.8,
    );

    return {
      id,
      position: new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * radius,
        Math.cos(phi) * radius * 0.78,
        Math.sin(phi) * Math.sin(theta) * radius,
      ).add(drift),
      size: star.size,
      starType: star.type,
      glowColor: star.color,
      coreColor: star.coreColor,
      blackCore: star.blackCore,
      glowBoost: star.type === "Neutron Star" ? 1.28 : 1,
      glowScaleBoost: star.type === "Neutron Star" ? 1 : 1,
      planets: Math.floor(random() * 14),
    };
  });
}

function createStarProfile(random) {
  const variant = STAR_TYPES[Math.floor(random() * STAR_TYPES.length)];
  const [minSize, maxSize] = variant.size;

  return {
    ...variant,
    size: minSize + random() * (maxSize - minSize),
  };
}

function createStarName(random) {
  const useMega = random() >= 0.7;
  const syllables = useMega ? MEGAGEN_SYLLABLES : GEN_SYLLABLES;
  const variant = random();

  if (useMega) {
    if (variant < 0.5) {
      return joinSyllables(syllables, random, 2);
    }
    if (variant < 0.9) {
      return `${pickSyllable(syllables, random)}-${pickNameNumber(random)}`.toUpperCase();
    }
    return pickSyllable(syllables, random).toUpperCase();
  }

  if (variant < 0.5) {
    return joinSyllables(syllables, random, 2);
  }
  if (variant < 0.8) {
    return joinSyllables(syllables, random, 3);
  }
  if (variant < 0.9) {
    return `${pickSyllable(syllables, random)}-${pickNameNumber(random)}`.toUpperCase();
  }
  if (variant < 0.95) {
    return `${pickSyllable(syllables, random)}-${pickSyllable(syllables, random)}`.toUpperCase();
  }
  return `${pickSyllable(syllables, random)}'${pickSyllable(syllables, random)}`.toUpperCase();
}

function joinSyllables(syllables, random, count) {
  return Array.from({ length: count }, () => pickSyllable(syllables, random))
    .join("")
    .toUpperCase();
}

function pickNameNumber(random) {
  return Math.floor(random() * 999) + 1;
}

function pickSyllable(syllables, random) {
  return syllables[Math.floor(random() * syllables.length)];
}

function createLinks(points) {
  const candidates = [];
  const used = new Set();
  const links = [];
  const degree = new Map(points.map((node) => [node.id, 0]));

  for (let a = 0; a < points.length; a += 1) {
    for (let b = a + 1; b < points.length; b += 1) {
      const distance = points[a].position.distanceTo(points[b].position);
      if (distance < LINK_DISTANCE) {
        candidates.push({ a, b, distance });
      }
    }
  }

  candidates.sort((left, right) => left.distance - right.distance);

  for (let nodeIndex = 1; nodeIndex < points.length; nodeIndex += 1) {
    let nearest = null;
    for (let otherIndex = 0; otherIndex < nodeIndex; otherIndex += 1) {
      const distance = points[nodeIndex].position.distanceTo(points[otherIndex].position);
      if (!nearest || distance < nearest.distance) {
        nearest = { a: nodeIndex, b: otherIndex, distance };
      }
    }
    addLink(nearest);
  }

  for (const link of candidates) {
    if (degree.get(link.a) >= MAX_LINKS_PER_NODE || degree.get(link.b) >= MAX_LINKS_PER_NODE) {
      continue;
    }
    addLink(link);
  }

  return links;

  function addLink(link) {
    const low = Math.min(link.a, link.b);
    const high = Math.max(link.a, link.b);
    const key = `${low}:${high}`;
    if (used.has(key)) {
      return;
    }
    used.add(key);
    links.push({ a: low, b: high, distance: link.distance });
    degree.set(low, degree.get(low) + 1);
    degree.set(high, degree.get(high) + 1);
  }
}

function createOuterLinks(points, random) {
  const targetCount = 4 + Math.floor(random() * 3);
  const edgeNodes = [...points]
    .sort((left, right) => right.position.lengthSq() - left.position.lengthSq())
    .slice(0, Math.max(targetCount * 2, Math.ceil(points.length * 0.32)));
  const picked = [];

  while (picked.length < targetCount && edgeNodes.length > 0) {
    const index = Math.floor(random() * edgeNodes.length);
    const [node] = edgeNodes.splice(index, 1);
    const outward = node.position.clone().normalize();
    const jitter = new THREE.Vector3(
      random() - 0.5,
      (random() - 0.5) * 0.7,
      random() - 0.5,
    );
    jitter.addScaledVector(outward, -jitter.dot(outward)).normalize();
    const direction = outward.addScaledVector(jitter, 0.16 + random() * 0.18).normalize();
    const length = 1.15 + random() * 1.35;

    picked.push({
      start: node.position.clone(),
      end: node.position.clone().addScaledVector(direction, length),
      opacity: 0.26 + random() * 0.18,
    });
  }

  return picked;
}

function createAdjacency(edges) {
  const adjacencyMap = new Map(nodes.map((node) => [node.id, new Set()]));
  for (const edge of edges) {
    adjacencyMap.get(edge.a).add(edge.b);
    adjacencyMap.get(edge.b).add(edge.a);
  }
  return adjacencyMap;
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
  const material = new THREE.ShaderMaterial({
    uniforms: {
      skyColors: { value: createSkyColorUniforms() },
      skyColorCount: { value: skyGradientColors.length },
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

function createSkyColorUniforms() {
  const colors = skyGradientColors.length > 0 ? skyGradientColors : ["#050914"];
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

function smoothstep(edge0, edge1, value) {
  const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
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

  const overlayScene = new THREE.Scene();
  const overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { value: new THREE.Vector2(1, 1) },
      points: { value: pointUniforms },
      pointRadii: { value: pointRadiusUniforms },
      segmentStarts: { value: segmentStartUniforms },
      segmentEnds: { value: segmentEndUniforms },
      pointCount: { value: 0 },
      segmentCount: { value: 0 },
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

      uniform vec2 resolution;
      uniform vec2 points[MAX_POINTS];
      uniform float pointRadii[MAX_POINTS];
      uniform vec2 segmentStarts[MAX_SEGMENTS];
      uniform vec2 segmentEnds[MAX_SEGMENTS];
      uniform int pointCount;
      uniform int segmentCount;
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

      void main() {
        vec2 pixel = gl_FragCoord.xy;
        float distanceToSelection = 100000.0;

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

        float fillMask = step(distanceToSelection, 0.0);
        float strokeMask =
          step(abs(distanceToSelection), strokeWidth) *
          step(0.001, abs(distanceToSelection));
        float glowMask =
          smoothstep(glowWidth, strokeWidth, distanceToSelection) *
          step(strokeWidth, distanceToSelection);
        float glowAlpha = glowMask * 0.42;
        float alpha = max(max(fillMask * opacity, glowAlpha), strokeMask);

        if (alpha <= 0.001) {
          discard;
        }

        vec3 finalColor = mix(color, strokeColor, max(strokeMask, glowMask * 0.58));
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
  };
}

function onPointerDown(event) {
  isDragging = true;
  lastPointer.set(event.clientX, event.clientY);
  pointerDownPosition.set(event.clientX, event.clientY);
  sceneCanvas.classList.add("dragging");
  sceneCanvas.setPointerCapture(event.pointerId);
}

function onPointerUp(event) {
  const clickDistance = pointerDownPosition.distanceTo(new THREE.Vector2(event.clientX, event.clientY));
  isDragging = false;
  sceneCanvas.classList.remove("dragging");
  if (sceneCanvas.hasPointerCapture(event.pointerId)) {
    sceneCanvas.releasePointerCapture(event.pointerId);
  }
  if (clickDistance < 5) {
    selectNodeAt(event.clientX, event.clientY);
  }
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

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

function selectNodeAt(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;

  const hit = getNodeHit() ?? getScreenNodeHit(clientX, clientY);
  if (!hit) {
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

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
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

function updateSelectionOverlay(color, selectedNodeItems, visibleEdges) {
  const material = selectionOverlay.material;
  const pointCount = Math.min(selectedNodeItems.length, MAX_SELECTION_POINTS);
  const segmentCount = Math.min(visibleEdges.length, MAX_SELECTION_SEGMENTS);
  const pixelRatio = Math.min(window.devicePixelRatio, 2);

  renderer.getDrawingBufferSize(selectionScreenSize);
  material.uniforms.resolution.value.copy(selectionScreenSize);
  material.uniforms.nodeRadius.value = 31 * pixelRatio;
  material.uniforms.tubeRadius.value = 16 * pixelRatio;
  material.uniforms.strokeWidth.value = 1 * pixelRatio;
  material.uniforms.glowWidth.value = 5 * pixelRatio;
  material.uniforms.pointCount.value = pointCount;
  material.uniforms.segmentCount.value = segmentCount;
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
}

function getSelectionGroups() {
  const groups = new Map();

  for (const [nodeId, color] of nodeColors) {
    if (!groups.has(color)) {
      groups.set(color, { nodes: [], edges: [] });
    }
    groups.get(color).nodes.push({
      id: nodeId,
      progress: nodeAnimationProgress.get(nodeId) ?? 1,
    });
  }

  for (const [nodeId, animation] of nodeExitAnimations) {
    if (!groups.has(animation.color)) {
      groups.set(animation.color, { nodes: [], edges: [] });
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

  for (const animation of edgeExitAnimations.values()) {
    if (!groups.has(animation.color)) {
      groups.set(animation.color, { nodes: [], edges: [] });
    }
    groups.get(animation.color).edges.push(animation);
  }

  return groups;
}

function projectNodeToScreen(nodeId) {
  const projected = nodes[nodeId].position.clone().applyMatrix4(graphRoot.matrixWorld).project(camera);
  return new THREE.Vector2(
    (projected.x * 0.5 + 0.5) * selectionScreenSize.x,
    (projected.y * 0.5 + 0.5) * selectionScreenSize.y,
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
  const nameWidth = hoverNameWrap.offsetWidth || 120;
  const panelHeight = hoverPanel.offsetHeight || 63;
  const panelWidth = hoverPanel.offsetWidth || 112;
  const centeredNameX = THREE.MathUtils.clamp(clientX, nameWidth / 2 + 12, window.innerWidth - nameWidth / 2 - 12);
  const centeredPanelX = THREE.MathUtils.clamp(clientX, panelWidth / 2 + 12, window.innerWidth - panelWidth / 2 - 12);
  const nameTop = THREE.MathUtils.clamp(clientY - 62, 12, window.innerHeight - 24);
  const panelTop = THREE.MathUtils.clamp(clientY + 10, 12, window.innerHeight - panelHeight - 12);

  hoverNameWrap.style.left = `${centeredNameX}px`;
  hoverNameWrap.style.top = `${nameTop}px`;
  hoverPanel.style.left = `${centeredPanelX}px`;
  hoverPanel.style.top = `${panelTop}px`;
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  graphRoot.traverse((object) => {
    if (object.userData.isSkyPixels) {
      object.material.uniforms.pixelRatio.value = pixelRatio;
    }
  });
}

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const deltaSeconds = Math.min(0.05, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  updateHover();
  updateStarLabels();
  updateSelectionAnimations();
  updateLinkPulse(deltaSeconds);

  graphRoot.rotation.x = THREE.MathUtils.lerp(graphRoot.rotation.x, targetRotation.x, 0.08);
  graphRoot.rotation.y = THREE.MathUtils.lerp(graphRoot.rotation.y, targetRotation.y, 0.08);
  graphRoot.rotation.z = Math.sin(performance.now() * 0.00012) * 0.025;

  if (!isDragging) {
    targetRotation.x += rotationVelocity.x;
    targetRotation.y += rotationVelocity.y;
    rotationVelocity.multiplyScalar(0.95);
  }

  renderer.clear(true, true, true);
  renderer.render(scene, camera);
  renderer.clearDepth();

  for (const [color, group] of getSelectionGroups()) {
    updateSelectionOverlay(color, group.nodes, group.edges);
    renderer.render(selectionOverlay.scene, selectionOverlay.camera);
  }
}
