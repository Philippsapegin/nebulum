import "./styles.css";
import * as THREE from "three";
import { PLANET_DICTIONARIES } from "./planetDictionaries.js";
import { GEN_SYLLABLES, MEGAGEN_SYLLABLES } from "./syllables.js";

const params = new URLSearchParams(window.location.search);
const SEED = params.get("seed") || "nebulum";
const NODE_COUNT = 42;
const LINK_DISTANCE = 2.35;
const MAX_LINKS_PER_NODE = 4;
const MAX_SELECTION_POINTS = 48;
const MAX_SELECTION_SEGMENTS = 128;
const MAX_SELECTION_FADING_SEGMENTS = 24;
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
    color: "#ff7467",
    coreColor: "#fffafa",
    size: [0.018, 0.023],
  },
  {
    type: "Orange Dwarf",
    color: "#e4974b",
    coreColor: "#fffaf5",
    size: [0.019, 0.024],
  },
  {
    type: "Orange Star",
    color: "#ffc88e",
    coreColor: "#fff3df",
    size: [0.024, 0.031],
  },
  {
    type: "Yellow Star",
    color: "#ffe476",
    coreColor: "#fff9df",
    size: [0.026, 0.033],
  },
  {
    type: "Yellow-White Star",
    color: "#fff1b7",
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
    color: "#bfd9ff",
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
    color: "#ffaaa2",
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
const MUSIC_TRACKS = [
  "Afar from home.mp3",
  "Defining the rays.mp3",
  "Finite but countless.mp3",
  "Glacial Starch.mp3",
  "Nebulum.mp3",
  "Neural Void - Orbit around the end.mp3",
  "Neural Void - Sagan was small.mp3",
  "Neural Void - TON 618.mp3",
  "Neural Void - Vast Nothingness.mp3",
  "Neutron Lullaby.mp3",
  "Sparkling horizon.mp3",
  "Under the skyes.mp3",
  "Weight of light.mp3",
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
const maskToolToggle = document.querySelector("#mask-tool-toggle");
const skyGradientColorsElement = document.querySelector("#sky-gradient-colors");
const addSkyColorButton = document.querySelector("#add-sky-color");
const regenerateSkyButton = document.querySelector("#regenerate-sky");
const musicPrevButton = document.querySelector("#music-prev");
const musicPlayButton = document.querySelector("#music-play");
const musicPlayIcon = document.querySelector("#music-play-icon");
const musicNextButton = document.querySelector("#music-next");
const musicModeButton = document.querySelector("#music-mode");
const musicModeIcon = document.querySelector("#music-mode-icon");
const musicVolume = document.querySelector("#music-volume");
const musicTrackCurrent = document.querySelector("#music-track-current");
const musicDropdownButton = document.querySelector("#music-dropdown");
const musicPlayer = document.querySelector(".music-player");
const musicTrackListBackdrop = document.querySelector("#music-track-list-backdrop");
const musicTrackList = document.querySelector("#music-track-list");
const musicTrackScrollbar = document.querySelector("#music-track-scrollbar");
const musicTrackScrollbarThumb = document.querySelector("#music-track-scrollbar-thumb");
const starWindow = document.querySelector("#star-window");
const systemGlow = document.querySelector("#system-glow");
const systemStars = document.querySelector("#system-stars");
const starSystem = document.querySelector("#star-system");
const systemParticles = document.querySelector("#system-particles");
const systemHoverNameWrap = document.querySelector("#system-hover-name-wrap");
const systemHoverName = document.querySelector("#system-hover-name");
const systemHoverPanel = document.querySelector("#system-hover-panel");
const systemTooltipBody = document.querySelector("#system-tooltip-body");
const systemTitle = document.querySelector("#system-title");
const backToStarmapButton = document.querySelector("#back-to-starmap");
const systemTransitionOverlay = document.createElement("div");
systemTransitionOverlay.className = "system-transition-overlay";
starWindow.append(systemTransitionOverlay);
const graphEntryOverlay = document.createElement("div");
graphEntryOverlay.className = "graph-entry-overlay";
document.querySelector("#app").append(graphEntryOverlay);

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
const nodes = createNodes(rand).map((node) => ({
  ...node,
  name: createStarName(nameRand),
}));
const planetNameAssignments = createPlanetNameAssignments(nodes);
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
let isMaskToolEnabled = false;
let isStarWindowOpen = false;
let isSystemTransitioning = false;
let isGraphEnteringSystem = false;
let activeSystemNode = null;
let activeSystemStar = null;
let activeSystemStarSurface = null;
let tooltipTypingTimeout = null;
let tooltipTypingInterval = null;
let tooltipClearTimeout = null;
let tooltipTypingToken = 0;
let hoveredSystemBody = null;
let systemTooltipTypingTimeout = null;
let systemTooltipTypingInterval = null;
let systemTooltipClearTimeout = null;
let systemTooltipTypingToken = 0;
let lastFrameTime = performance.now();
let skyRandomVersion = 0;
let skyMesh = null;
let targetCameraDistance = camera.position.z;
let musicTrackIndex = 0;
let musicMode = "order";
let systemMusicPlayerPosition = null;
let isDraggingMusicPlayer = false;
let musicPlayerDragOffset = new THREE.Vector2();
const musicAudio = new Audio();
musicAudio.preload = "metadata";
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

initPanel();
initMusicPlayer();
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
sceneCanvas.addEventListener("wheel", onWheel, { passive: false });
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("pointercancel", onPointerUp);

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

  clearButton.addEventListener("click", () => {
    nodeColors.clear();
    nodeAnimationProgress.clear();
    edgeAnimationProgress.clear();
    edgeAnimationOrigins.clear();
    nodeExitAnimations.clear();
    edgeExitAnimations.clear();
    updateUsedColorsUi();
  });

  addSkyColorButton?.addEventListener("click", () => {
    addSkyGradientColorAt(skyGradientColors.findIndex((color) => !color));
  });

  regenerateSkyButton?.addEventListener("click", regenerateSkyGradient);
}

function initMusicPlayer() {
  if (!musicTrackList || MUSIC_TRACKS.length === 0) {
    return;
  }

  MUSIC_TRACKS.forEach((file, index) => {
    const item = document.createElement("button");
    item.className = "music-track-item";
    item.type = "button";
    item.textContent = getMusicTrackTitle(file);
    item.addEventListener("click", () => {
      setMusicTrack(index, !musicAudio.paused);
      setMusicDropdownOpen(false);
    });
    musicTrackList.append(item);
  });

  musicAudio.volume = Number(musicVolume.value);
  setMusicTrack(0, false);

  musicPrevButton.addEventListener("click", () => playAdjacentTrack(-1));
  musicNextButton.addEventListener("click", () => playAdjacentTrack(1));
  musicPlayButton.addEventListener("click", toggleMusicPlayback);
  musicModeButton.addEventListener("click", cycleMusicMode);
  musicDropdownButton.addEventListener("click", (event) => {
    event.stopPropagation();
    setMusicDropdownOpen(musicTrackList.hidden);
  });
  musicTrackCurrent.addEventListener("click", (event) => {
    event.stopPropagation();
    setMusicDropdownOpen(musicTrackList.hidden);
  });
  musicVolume.addEventListener("input", () => {
    musicAudio.volume = Number(musicVolume.value);
  });
  musicTrackCurrent.addEventListener("pointerdown", (event) => {
    seekMusicFromTrackButton(event);
  });
  musicTrackCurrent.addEventListener("pointermove", (event) => {
    if (event.buttons === 1) {
      seekMusicFromTrackButton(event);
    }
  });
  musicTrackList.addEventListener("scroll", updateMusicTrackScrollbar);
  musicTrackScrollbar?.addEventListener("pointerdown", onMusicScrollbarPointerDown);
  musicPlayer?.addEventListener("pointerdown", onMusicPlayerPointerDown);

  musicAudio.addEventListener("play", updateMusicPlayButton);
  musicAudio.addEventListener("pause", updateMusicPlayButton);
  musicAudio.addEventListener("loadedmetadata", updateMusicProgress);
  musicAudio.addEventListener("timeupdate", updateMusicProgress);
  musicAudio.addEventListener("ended", handleMusicEnded);
  document.addEventListener("pointerdown", (event) => {
    if (
      musicTrackList.hidden ||
      musicTrackList.contains(event.target) ||
      musicTrackScrollbar?.contains(event.target) ||
      musicDropdownButton.contains(event.target) ||
      musicTrackCurrent.contains(event.target)
    ) {
      return;
    }
    setMusicDropdownOpen(false);
  });
}

function setMusicTrack(index, shouldPlay) {
  musicTrackIndex = THREE.MathUtils.euclideanModulo(index, MUSIC_TRACKS.length);
  const file = MUSIC_TRACKS[musicTrackIndex];
  musicAudio.src = `/Music/${encodeURIComponent(file)}`;
  musicTrackCurrent.textContent = getMusicTrackTitle(file);
  updateMusicTrackListUi();
  musicTrackCurrent.style.setProperty("--music-progress", "0%");

  if (shouldPlay) {
    musicAudio.play().catch(() => {});
  }

  updateMusicPlayButton();
}

function toggleMusicPlayback() {
  if (musicAudio.paused) {
    musicAudio.play().catch(() => {});
  } else {
    musicAudio.pause();
  }
}

function playAdjacentTrack(direction) {
  if (musicMode === "shuffle") {
    playRandomTrack();
    return;
  }

  setMusicTrack(musicTrackIndex + direction, !musicAudio.paused);
}

function handleMusicEnded() {
  if (musicMode === "repeat") {
    musicAudio.currentTime = 0;
    musicAudio.play().catch(() => {});
    return;
  }

  if (musicMode === "shuffle") {
    playRandomTrack();
    return;
  }

  setMusicTrack(musicTrackIndex + 1, true);
}

function playRandomTrack() {
  if (MUSIC_TRACKS.length <= 1) {
    setMusicTrack(0, true);
    return;
  }

  let nextIndex = musicTrackIndex;
  while (nextIndex === musicTrackIndex) {
    nextIndex = Math.floor(Math.random() * MUSIC_TRACKS.length);
  }
  setMusicTrack(nextIndex, true);
}

function cycleMusicMode() {
  musicMode = musicMode === "order" ? "repeat" : musicMode === "repeat" ? "shuffle" : "order";
  const icons = {
    order: "/Musplayer/order.svg",
    repeat: "/Musplayer/repeat.svg",
    shuffle: "/Musplayer/shuffle.svg",
  };
  musicModeIcon.src = icons[musicMode];
  musicModeButton.dataset.mode = musicMode;
}

function updateMusicPlayButton() {
  musicPlayIcon.src = musicAudio.paused ? "/Musplayer/play.svg" : "/Musplayer/pause.svg";
  musicPlayIcon.classList.toggle("music-button__icon--play", musicAudio.paused);
}

function updateMusicProgress() {
  if (!Number.isFinite(musicAudio.duration) || musicAudio.duration <= 0) {
    return;
  }

  musicTrackCurrent.style.setProperty("--music-progress", `${(musicAudio.currentTime / musicAudio.duration) * 100}%`);
}

function getMusicTrackTitle(file) {
  return file.replace(/\.mp3$/i, "");
}

function setMusicDropdownOpen(isOpen) {
  musicTrackList.hidden = !isOpen;
  if (musicTrackListBackdrop) {
    musicTrackListBackdrop.hidden = !isOpen;
  }
  if (musicTrackScrollbar) {
    musicTrackScrollbar.hidden = !isOpen;
  }
  musicDropdownButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
  if (isOpen) {
    requestAnimationFrame(updateMusicTrackScrollbar);
  }
}

function updateMusicTrackListUi() {
  musicTrackList.querySelectorAll(".music-track-item").forEach((item, index) => {
    item.classList.toggle("active", index === musicTrackIndex);
  });
  updateMusicTrackScrollbar();
}

function updateMusicTrackScrollbar() {
  if (!musicTrackList || !musicTrackScrollbar || !musicTrackScrollbarThumb || musicTrackList.hidden) {
    return;
  }

  const visibleHeight = musicTrackList.clientHeight;
  const scrollHeight = musicTrackList.scrollHeight;
  const canScroll = scrollHeight > visibleHeight + 1;
  if (musicTrackListBackdrop) {
    musicTrackListBackdrop.style.height = `${musicTrackList.offsetHeight}px`;
  }
  musicTrackScrollbar.hidden = !canScroll;
  if (!canScroll) {
    return;
  }

  musicTrackScrollbar.style.height = `${musicTrackList.offsetHeight}px`;
  const thumbHeight = Math.max(28, (visibleHeight / scrollHeight) * visibleHeight);
  const maxThumbTop = visibleHeight - thumbHeight;
  const maxScrollTop = scrollHeight - visibleHeight;
  const thumbTop = maxScrollTop > 0 ? (musicTrackList.scrollTop / maxScrollTop) * maxThumbTop : 0;
  musicTrackScrollbarThumb.style.height = `${thumbHeight}px`;
  musicTrackScrollbarThumb.style.transform = `translateY(${thumbTop}px)`;
}

function onMusicPlayerPointerDown(event) {
  if (!isStarWindowOpen || isSystemTransitioning || !musicPlayer || event.button !== 0) {
    return;
  }

  if (event.target.closest("button, input, .music-track-list, .music-track-scrollbar")) {
    return;
  }

  event.preventDefault();
  isDraggingMusicPlayer = true;
  setMusicDropdownOpen(false);
  const rect = musicPlayer.getBoundingClientRect();
  musicPlayerDragOffset.set(event.clientX - rect.left, event.clientY - rect.top);
  musicPlayer.setPointerCapture?.(event.pointerId);

  const onMove = (moveEvent) => {
    if (!isDraggingMusicPlayer) {
      return;
    }
    setSystemMusicPlayerPosition(
      moveEvent.clientX - musicPlayerDragOffset.x,
      moveEvent.clientY - musicPlayerDragOffset.y
    );
  };
  const onUp = (upEvent) => {
    isDraggingMusicPlayer = false;
    musicPlayer.releasePointerCapture?.(upEvent.pointerId);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}

function setSystemMusicPlayerPosition(left, top) {
  if (!musicPlayer) {
    return;
  }

  const width = musicPlayer.offsetWidth || 214;
  const height = musicPlayer.offsetHeight || 78;
  const clampedLeft = THREE.MathUtils.clamp(left, 0, Math.max(0, window.innerWidth - width));
  const clampedTop = THREE.MathUtils.clamp(top, 0, Math.max(0, window.innerHeight - height));
  systemMusicPlayerPosition = { left: clampedLeft, top: clampedTop };
  musicPlayer.style.setProperty("--system-player-left", `${clampedLeft}px`);
  musicPlayer.style.setProperty("--system-player-top", `${clampedTop}px`);
}

function ensureSystemMusicPlayerPosition() {
  if (!musicPlayer) {
    return;
  }

  if (!systemMusicPlayerPosition) {
    const left = 18;
    const top = 18 + 30 + 14;
    setSystemMusicPlayerPosition(left, top);
    return;
  }

  setSystemMusicPlayerPosition(systemMusicPlayerPosition.left, systemMusicPlayerPosition.top);
}

function onMusicScrollbarPointerDown(event) {
  if (!musicTrackList || !musicTrackScrollbar || !musicTrackScrollbarThumb) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  musicTrackScrollbar.setPointerCapture?.(event.pointerId);

  const scrollbarRect = musicTrackScrollbar.getBoundingClientRect();
  const thumbRect = musicTrackScrollbarThumb.getBoundingClientRect();
  const grabOffset = event.clientY >= thumbRect.top && event.clientY <= thumbRect.bottom
    ? event.clientY - thumbRect.top
    : thumbRect.height / 2;

  const moveThumb = (clientY) => {
    const visibleHeight = musicTrackList.clientHeight;
    const scrollHeight = musicTrackList.scrollHeight;
    const thumbHeight = musicTrackScrollbarThumb.offsetHeight;
    const maxThumbTop = visibleHeight - thumbHeight;
    const maxScrollTop = scrollHeight - visibleHeight;
    const thumbTop = THREE.MathUtils.clamp(clientY - scrollbarRect.top - grabOffset, 0, maxThumbTop);
    musicTrackList.scrollTop = maxThumbTop > 0 ? (thumbTop / maxThumbTop) * maxScrollTop : 0;
  };

  const onMove = (moveEvent) => moveThumb(moveEvent.clientY);
  const onUp = (upEvent) => {
    musicTrackScrollbar.releasePointerCapture?.(upEvent.pointerId);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };

  moveThumb(event.clientY);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}

function seekMusicFromTrackButton(event) {
  if (!Number.isFinite(musicAudio.duration) || musicAudio.duration <= 0) {
    return;
  }

  const rect = musicTrackCurrent.getBoundingClientRect();
  const progress = THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width, 0, 1);
  musicAudio.currentTime = progress * musicAudio.duration;
  musicTrackCurrent.style.setProperty("--music-progress", `${progress * 100}%`);
}

function updateMaskToolUi() {
  maskToolToggle.classList.toggle("active", isMaskToolEnabled);
  maskToolToggle.textContent = isMaskToolEnabled ? "On" : "Off";
  maskToolToggle.setAttribute("aria-pressed", String(isMaskToolEnabled));
}

function renderSkyGradientControls() {
  skyGradientColorsElement.replaceChildren();
  if (addSkyColorButton) {
    addSkyColorButton.disabled = skyGradientColors.every(Boolean);
  }

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

function hslToHex(h, s, l) {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
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
  const m = l - chroma / 2;
  return `#${match
    .map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hexToRgba(color, alpha) {
  const normalized = normalizeHexColor(color).replace("#", "");
  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red},${green},${blue},${alpha})`;
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
  const color = variant.blackCore
    ? hslToHex(random() * 360, 1, 0.87)
    : variant.color;

  return {
    ...variant,
    color,
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

function createPlanetNameAssignments(systemNodes) {
  const dictionaryPools = {
    Greece: createDictionaryPool(PLANET_DICTIONARIES.Greece),
    Norce: createDictionaryPool(PLANET_DICTIONARIES.Norce),
    Egypt: createDictionaryPool(PLANET_DICTIONARIES.Egypt),
    Feelings: createDictionaryPool(PLANET_DICTIONARIES.Feelings),
  };
  const assignments = new Map();

  for (const node of systemNodes) {
    const random = createRandom(`${SEED}:planet-names:${node.id}`);
    const primaryDictionary = pickSystemPlanetDictionary(random);
    const names = [];

    for (let index = 0; index < node.planets; index += 1) {
      names.push(createPlanetName({
        random,
        systemName: node.name,
        planetIndex: index,
        primaryDictionary,
        dictionaryPools,
      }));
    }

    assignments.set(node.id, names);
  }

  return assignments;
}

function createDictionaryPool(names) {
  return {
    names,
    used: new Set(),
  };
}

function pickSystemPlanetDictionary(random) {
  const variants = ["Greece", "Norce", "Egypt"];
  return variants[Math.floor(random() * variants.length)];
}

function createPlanetName({ random, systemName, planetIndex, primaryDictionary, dictionaryPools }) {
  if (random() >= 0.7) {
    return createDefaultPlanetName(systemName, planetIndex);
  }

  const sourceRoll = random();
  if (sourceRoll < 0.6) {
    return pickUniqueDictionaryName(dictionaryPools[primaryDictionary], random)
      ?? createGenPlanetName(random);
  }
  if (sourceRoll < 0.7) {
    return pickUniqueDictionaryName(dictionaryPools.Feelings, random)
      ?? createGenPlanetName(random);
  }
  return createGenPlanetName(random);
}

function createDefaultPlanetName(systemName, planetIndex) {
  return `${systemName} ${toRoman(planetIndex + 1)}`;
}

function pickUniqueDictionaryName(pool, random) {
  if (!pool || pool.used.size >= pool.names.length) {
    return null;
  }

  const startIndex = Math.floor(random() * pool.names.length);
  for (let offset = 0; offset < pool.names.length; offset += 1) {
    const index = (startIndex + offset) % pool.names.length;
    const name = pool.names[index];
    if (!pool.used.has(name)) {
      pool.used.add(name);
      return name.toUpperCase();
    }
  }

  return null;
}

function createGenPlanetName(random) {
  const roll = random();
  if (roll < 0.5) {
    return pickSyllable(GEN_SYLLABLES, random).toUpperCase();
  }

  const first = pickSyllable(GEN_SYLLABLES, random);
  const second = pickSyllable(GEN_SYLLABLES, random);
  if (roll < 0.625) {
    return `${first}${second}`.toUpperCase();
  }
  if (roll < 0.75) {
    return `${first} ${second}`.toUpperCase();
  }
  if (roll < 0.875) {
    return `${first}'${second}`.toUpperCase();
  }
  return `${first}-${second}`.toUpperCase();
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
      parentId: node.id,
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

function onWheel(event) {
  if (isStarWindowOpen) {
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
    if (body.dataset.hasDisk === "true") {
      lines.push("ACCRETION DISK");
    }

    const moonCount = Number(body.dataset.moons);
    if (moonCount > 0) {
      lines.push(`${moonCount} ${moonCount === 1 ? "MOON" : "MOONS"}`);
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
  if (isGraphEnteringSystem) {
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
  if (isGraphEnteringSystem || isStarWindowOpen) {
    return;
  }

  isGraphEnteringSystem = true;
  isDragging = false;
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
      isGraphEnteringSystem = false;
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
  isStarWindowOpen = true;
  isSystemTransitioning = false;
  document.body.classList.add("system-open");
  ensureSystemMusicPlayerPosition();
  starWindow.classList.remove("system-transitioning");
  setSystemTransitionOffset(0, 0);
  setSystemTransitionOverlay(0);
  activeSystemNode = node;
  isDragging = false;
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
  starWindow.classList.add("visible");
  starWindow.setAttribute("aria-hidden", "false");
}

function closeStarWindow() {
  isStarWindowOpen = false;
  isSystemTransitioning = false;
  document.body.classList.remove("system-open");
  isDraggingMusicPlayer = false;
  setMusicDropdownOpen(false);
  starWindow.classList.remove("system-transitioning");
  setSystemTransitionOffset(0, 0);
  setSystemTransitionOverlay(0);
  releaseSystemPointerLock();
  activeSystemNode = null;
  activeSystemStar = null;
  activeSystemStarSurface = null;
  clearSystemHover();
  systemStars.replaceChildren();
  systemParticles.replaceChildren();
  starWindow.classList.remove("visible");
  starWindow.setAttribute("aria-hidden", "true");
  pointer.set(10, 10);
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
  if (!isStarWindowOpen) {
    return;
  }

  if (!force && (isSystemTransitioning || isGraphEnteringSystem)) {
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
  clearSystemHover();
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
  starSystem.append(star);

  const orbitLayer = createSystemOrbitLayer(width, height);
  const orbitItems = [];
  starSystem.append(orbitLayer);

  const minOrbit = Math.max(starRadius * 1.12, -starX + 96);
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

    const planet = document.createElement("div");
    planet.className = "system-planet";
    planet.style.width = `${planetRadius * 2}px`;
    planet.style.height = `${planetRadius * 2}px`;
    planet.style.left = `${planetX - planetRadius}px`;
    planet.style.top = `${planetY - planetRadius}px`;
    planet.style.background = planetKind.background;
    starSystem.append(planet);

    renderMoons(moonSystem);

    const constructionRadius = getPlanetConstructionRadius(planetRadius, accretionDisk, moonSystem);
    const planetName = planetNameAssignments.get(node.id)?.[index] ?? createDefaultPlanetName(node.name, index);
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
    hitTarget.userData = { label };
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
    starSystem.append(hitTarget);
  }

  drawSystemOrbits(orbitLayer, orbitItems);
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
      const distance = 2 + index * 4;
      const exitDistance = index === 1 ? 0 : 2 + (index - 1) * 4;
      const channel = Math.round(255 * (1 - progress));
      ring.style.setProperty("--wormhole-x", `${(stepX / 14) * distance}px`);
      ring.style.setProperty("--wormhole-y", `${(stepY / 14) * distance}px`);
      ring.style.setProperty("--wormhole-exit-x", `${(stepX / 14) * exitDistance}px`);
      ring.style.setProperty("--wormhole-exit-y", `${(stepY / 14) * exitDistance}px`);
      ring.style.setProperty("--wormhole-size", `${index * 2}px`);
      ring.style.setProperty("--wormhole-blur", `${0.15 + progress * 1.85}px`);
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
  if (isSystemTransitioning || !isStarWindowOpen) {
    return;
  }

  isSystemTransitioning = true;
  starWindow.classList.add("system-transitioning");
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
    activeSystemNode = targetNode;
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
      starWindow.classList.remove("system-transitioning");
      isSystemTransitioning = false;
      updateSystemParallax(clientX, clientY);
      releaseSystemPointerLock();
    };

    requestAnimationFrame(animateArrival);
  };

  requestAnimationFrame(animateTransition);
}

function lockSystemPointer(element = starWindow) {
  if (document.pointerLockElement || !element.requestPointerLock) {
    return;
  }

  const lockResult = element.requestPointerLock();
  if (lockResult?.catch) {
    lockResult.catch(() => {});
  }
}

function releaseSystemPointerLock() {
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

function getSystemPlanetRadius(sizeIndex) {
  return 4 + sizeIndex * ((27 - 4) / 9);
}

function createSystemStarSurface(node, starRadius) {
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
    noise: createSystemStarSurfaceNoise(`${SEED}:system-surface:${node.id}`, starRadius),
  };
}

function createSystemStarSurfaceNoise(seed, radius) {
  const random = createRandom(seed);
  const circumference = Math.PI * 2 * radius;
  const layers = [
    createLoopingNoiseLayer(random, circumference, 5.2, 64, 0.46),
    createLoopingNoiseLayer(random, circumference, 2.7, 72, 0.34),
    createLoopingNoiseLayer(random, circumference, 1.45, 80, 0.2),
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
  const amplitude = 2.5;
  const innerBlend = 60;
  const outerReach = 3;
  const innerRadius = Math.max(0, radius - innerBlend);

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
  const edgeGradient = context.createRadialGradient(center, center, radius - innerBlend, center, center, radius + outerReach);
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

  for (let index = 0; index < cuts; index += 1) {
    cutRadii.push(innerRadius + 2 + random() * Math.max(1, thickness - 4));
  }

  cutRadii.sort((a, b) => a - b);

  return {
    innerRadius,
    outerRadius,
    cutRadii,
    moonOrbitRadius: innerRadius + thickness / 2,
  };
}

function createAccretionDiskElement(accretionDisk, shadowAngle, shadowWidth) {
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

  for (const cutRadius of accretionDisk.cutRadii) {
    addStop(cutRadius - 0.8, "rgba(255,255,255,0.2)");
    addStop(cutRadius - 0.2, "rgba(255,255,255,0)");
    addStop(cutRadius + 0.8, "rgba(255,255,255,0)");
    addStop(cutRadius + 1.4, "rgba(255,255,255,0.2)");
  }

  addStop(accretionDisk.outerRadius, "rgba(255,255,255,0.2)");
  addStop(accretionDisk.outerRadius + 1, "rgba(255,255,255,0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  context.save();
  context.globalCompositeOperation = "destination-out";
  context.translate(center, center);
  context.rotate(shadowAngle);
  context.fillStyle = "rgba(0,0,0,1)";
  context.fillRect(0, -shadowWidth / 2, accretionDisk.outerRadius * 1.8, shadowWidth);
  context.restore();

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
    const moonRadius = moonSizes[Math.floor(random() * moonSizes.length)];
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
    moons.push({ x: moonX, y: moonY, radius: moonRadius });
  }

  return { moonCount, orbitRadius, moons, planetX, planetY };
}

function renderMoons({ moonCount, orbitRadius, moons, planetX, planetY }) {
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
  };
  const normalizedSize = THREE.MathUtils.clamp((node.size - 0.018) / (0.046 - 0.018), 0, 1);
  const scale = typeScale[node.starType] ?? THREE.MathUtils.lerp(0.2, 3, normalizedSize);
  const jitter = 0.9 + random() * 0.2;
  return THREE.MathUtils.clamp(height * scale * jitter, height * 0.2, height * 3);
}

function toRoman(value) {
  return [
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
    "XIII",
  ][value - 1] ?? String(value);
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
  if (isStarWindowOpen && activeSystemNode) {
    renderStarSystem(activeSystemNode);
    renderSystemStars(activeSystemNode);
    renderSystemParticles(activeSystemNode);
    updateSystemGlow(width / 2, height / 2, 0, 0);
  }
  graphRoot.traverse((object) => {
    if (object.userData.isSkyPixels) {
      object.material.uniforms.pixelRatio.value = pixelRatio;
    }
  });
  if (isStarWindowOpen) {
    ensureSystemMusicPlayerPosition();
  }
  updateMusicTrackScrollbar();
}

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const deltaSeconds = Math.min(0.05, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  if (!isStarWindowOpen) {
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
  } else if (activeSystemStarSurface) {
    drawSystemStarSurface(activeSystemStarSurface, now);
  }

  renderer.clear(true, true, true);
  renderer.render(scene, camera);
  renderer.clearDepth();

  for (const [color, group] of getSelectionGroups()) {
    updateSelectionOverlay(color, group.nodes, group.edges, group.fadingEdges);
    renderer.render(selectionOverlay.scene, selectionOverlay.camera);
  }
}
