import * as THREE from "three";
import { GAS_GIANT_OCTAVES, GAS_GIANT_WINDOW_TEXTURE_HEIGHT, createGasGiantTexture } from "../planet/gasGiantTexture.js";
import { createMoonTexture } from "../planet/moonTexture.js";
import { PLANET_WINDOW_TEXTURE_HEIGHT, createPlanetTexture } from "../planet/planetTexture.js";
import { createPlanetRotationState, getPlanetRotationPhase } from "../planet/rotation.js";
import { createRandom } from "../utils/random.js";

const PLANET_SCREEN_DISK_INNER_RADIUS_SCALE = 1.62;
const PLANET_SCREEN_DISK_THICKNESS_SCALE = 1.22;
const PLANET_SCREEN_DISK_OUTER_RADIUS_SCALE = 2;
const PLANET_SCREEN_DISK_LIGHT_LAYER = 1;
const PLANET_SCREEN_DISK_LIGHT_RIGHT_OFFSET = 0.28;
const PLANET_SCREEN_DISK_LIGHT_FAR_EDGE_OFFSET = 1.18;
const PLANET_SCREEN_DISK_LIGHT_DECAY = 0;
const PLANET_SCREEN_DISK_LIGHT_INNER_RADIUS_SCALE = 3.63449;
const PLANET_SCREEN_DISK_LIGHT_THICKNESS_SCALE = 1.30606;
const PLANET_SCREEN_DISK_WHITE_LIGHT_DISTANCE_SCALE = 0.58;
const PLANET_SCREEN_DISK_BAND_MIN_COUNT = 12;
const PLANET_SCREEN_DISK_BAND_MAX_COUNT = 26;
const PLANET_SCREEN_DISK_EXTRA_CUT_MIN_COUNT = 2;
const PLANET_SCREEN_DISK_EXTRA_CUT_MAX_COUNT = 7;
const PLANET_SCREEN_DISK_BRIGHT_BAND_MIN_COUNT = 1;
const PLANET_SCREEN_DISK_BRIGHT_BAND_MAX_COUNT = 4;
const PLANET_SCREEN_BUMP_STRENGTH = 1;
const PLANET_SCREEN_SPECULAR_STRENGTH = 0.08;
const PLANET_SCREEN_EMISSIVE_STRENGTH = 0.59;
const PLANET_SCREEN_EMISSIVE_BLOOM_STRENGTH = 2;
const PLANET_SCREEN_CLOUD_SPEED_MULTIPLIER = 1.15;
const PLANET_SCREEN_TIDAL_LOCKED_TEXTURE_OFFSET = 0.006;
const PLANET_SCREEN_EMISSIVE_NOISE_SCALE_MULTIPLIER = 20;
const PLANET_SCREEN_EMISSIVE_NOISE_SCALE = 1;
const PLANET_SCREEN_EMISSIVE_NOISE_SPEED = 0.030;
const PLANET_SCREEN_EMISSIVE_NOISE_BLACK_STOP = 0.16;
const PLANET_SCREEN_EMISSIVE_NOISE_WHITE_STOP = 1;
const PLANET_SCREEN_EMISSIVE_NOISE_OCTAVES = 3;
const MOON_DETAIL_TEXTURE_HEIGHT = 1024;
const MOON_SILHOUETTE_MASK_SIZE = 192;
const MOON_SILHOUETTE_SAMPLES = 256;
const MOON_SILHOUETTE_BASE_RADIUS = 0.47;
const MOON_SILHOUETTE_RADIUS_AMPLITUDE = 0.03;
const MOON_SILHOUETTE_MIN_RADIUS = 0.38;
const MOON_SILHOUETTE_MAX_RADIUS = 0.5;
const MOON_SILHOUETTE_STRENGTH_BY_SIZE = [3, 2, 1];
const MOLTEN_MOON_TEMPERATURE_THRESHOLD = 4000;
const MOON_BLOOM_FLICKER_MIN_INTERVAL = 1.8;
const MOON_BLOOM_FLICKER_MAX_INTERVAL = 14.5;
const MOON_BLOOM_FLICKER_SMOOTHING = 0.56;
const moonSilhouetteMaskCache = new Map();
const moonMaskedTextureCache = new Map();
const moonBloomTextureCache = new Map();

export function createPlanetScreenRenderer({
  root,
  controller,
  seed,
  createSystemStarSurface,
  drawSystemStarSurface,
  onOpenObjectDetail,
}) {
  const planetScreen = root;
  const planetScreenController = controller;
  const SEED = seed;
  const openObjectDetail = onOpenObjectDetail;

function renderPlanetScreenFallback(planet) {
  planetScreenController.state.activeStar = null;
  planetScreenController.state.activeStarSurface = null;
  disposePlanetScreen3D();
  planetScreenController.clearRendered();

  const title = document.createElement("div");
  title.className = "planet-screen__title";
  title.textContent = planet.name;
  planetScreen.append(title);
}

function renderPlanetScreen(planet) {
  planetScreenController.state.activeStarSurface = null;
  planetScreenController.state.activeMoons = [];
  disposePlanetScreen3D();
  planetScreenController.clearRendered();

  const width = window.innerWidth;
  const height = window.innerHeight;
  const random = createRandom(`${SEED}:planet-screen:${planet.systemId}:${planet.name}`);

  const backgroundDepth = 0.26;
  const backgroundLayer = createPlanetScreenLayer("planet-screen__layer--background", backgroundDepth);
  const planetLayer = createPlanetScreenLayer("planet-screen__layer--planet", -0.18);
  const moonLayers = [-1.24, -2.15, -3.24].map((depth, index) =>
    createPlanetScreenLayer(`planet-screen__layer--moon planet-screen__layer--moon-${index + 1}`, depth));
  const starGeometry = getPlanetScreenParentStarGeometry(planet, width, height);
  const planetGeometry = getPlanetScreenPlanetGeometry(planet, width, height);
  const starDir = getDirection(
    starGeometry.x,
    starGeometry.y,
    planetGeometry.centerX,
    planetGeometry.centerY,
  );

  renderPlanetScreenStars(backgroundLayer, random, width, height);
  renderPlanetScreenParentStar(backgroundLayer, planet, starGeometry, backgroundDepth);
  renderPlanetScreenPlanet(planetLayer, planet, planetGeometry, starDir);
  renderPlanetScreenMoons(moonLayers, planet, width, height, starGeometry, starDir);
  renderPlanetScreenTitle(planetScreen, planet);
  applyMoonBloomSettings();

  planetScreen.prepend(...moonLayers.reverse());
  planetScreen.prepend(planetLayer);
  planetScreen.prepend(backgroundLayer);
}

function createPlanetScreenLayer(extraClass, depth) {
  const layer = document.createElement("div");
  layer.className = `planet-screen__layer ${extraClass}`;
  layer.style.setProperty("--planet-screen-depth", String(depth));
  return layer;
}

function renderPlanetScreenStars(layer, random, width, height) {
  const count = Math.max(120, Math.floor((width * height) / 11000));
  for (let index = 0; index < count; index += 1) {
    const star = document.createElement("span");
    star.className = "planet-screen__star";
    star.style.left = `${random() * 100}%`;
    star.style.top = `${random() * 100}%`;
    star.style.opacity = `${0.18 + random() * 0.62}`;
    layer.append(star);
  }
}

function renderPlanetScreenTitle(root, planet) {
  const title = document.createElement("div");
  title.className = "planet-screen__title";
  title.textContent = planet.name;
  root.append(title);
}

function getPlanetScreenParentStarGeometry(planet, width, height) {
  const distanceFraction = THREE.MathUtils.clamp(
    (planet.orbitRadius - planet.minOrbit) / Math.max(1, planet.maxOrbit - planet.minOrbit),
    0,
    1,
  );
  const radius = Math.max(1, planet.systemStarRadius * 0.5 * (1 - distanceFraction));
  return {
    x: width * 0.74,
    y: height * 0.22,
    radius,
  };
}

function renderPlanetScreenParentStar(layer, planet, geometry, depth) {
  const hoverGlow = document.createElement("div");
  hoverGlow.className = "planet-screen__star-hover-glow";
  const hoverSize = Math.max(window.innerWidth, window.innerHeight) * 1.5;
  hoverGlow.style.width = `${hoverSize}px`;
  hoverGlow.style.height = `${hoverSize}px`;
  hoverGlow.style.left = `${geometry.x}px`;
  hoverGlow.style.top = `${geometry.y}px`;
  hoverGlow.style.color = planet.systemStarColor;
  planetScreen.append(hoverGlow);
  planetScreenController.state.activeStar = {
    element: hoverGlow,
    x: geometry.x,
    y: geometry.y,
    radius: geometry.radius,
    depth,
    isBlackHole: Boolean(planet.systemStarBlackCore),
  };

  const star = document.createElement("div");
  star.className = "planet-screen__parent-star";
  star.style.width = `${geometry.radius * 2}px`;
  star.style.height = `${geometry.radius * 2}px`;
  star.style.left = `${geometry.x - geometry.radius}px`;
  star.style.top = `${geometry.y - geometry.radius}px`;
  star.style.color = planet.systemStarColor;
  star.style.background = planet.systemStarBlackCore
    ? "radial-gradient(circle, #000 0 100%)"
    : `radial-gradient(circle, #fff 0 40%, ${planet.systemStarCoreColor} 55%, ${planet.systemStarColor} 78%, rgba(255,255,255,0) 100%)`;
  if (!planet.systemStarBlackCore && geometry.radius >= 8) {
    const starSurface = createSystemStarSurface({
      id: `${planet.systemId}:planet-view`,
      coreColor: planet.systemStarCoreColor,
      glowColor: planet.systemStarColor,
    }, geometry.radius, {
      edgeScale: getPlanetViewStarEdgeScale(geometry.radius),
    });
    star.append(starSurface.canvas);
    planetScreenController.state.activeStarSurface = starSurface;
    drawSystemStarSurface(starSurface, performance.now());
  }
  layer.append(star);
}

function getPlanetScreenPlanetGeometry(planet, width, height) {
  const radius = THREE.MathUtils.lerp(width * 0.25, width * 2, planet.sizeIndex / 9);
  return {
    centerX: width / 2,
    centerY: height + radius - height * 0.2,
    radius,
  };
}

function getPlanetViewStarEdgeScale(radius) {
  return THREE.MathUtils.clamp(radius / 560, 0.16, 2.4);
}

function getDirection(targetX, targetY, originX, originY) {
  const length = Math.hypot(targetX - originX, targetY - originY) || 1;
  return {
    x: (targetX - originX) / length,
    y: (targetY - originY) / length,
  };
}

function renderPlanetScreenPlanet(layer, planet, geometry, starDir) {
  const { centerX, centerY, radius } = geometry;

  const body = document.createElement("div");
  body.className = "planet-screen__planet";
  body.style.width = `${radius * 2}px`;
  body.style.height = `${radius * 2}px`;
  body.style.left = `${centerX - radius}px`;
  body.style.top = `${centerY - radius}px`;
  const texture = planet.kind === "GAS GIANT" && planet.gasGiantTextureSeed
    ? createGasGiantTexture(planet.gasGiantTextureSeed, GAS_GIANT_WINDOW_TEXTURE_HEIGHT, GAS_GIANT_OCTAVES + 3)
    : planet.kind === "PLANET" && planet.planetTextureSeed
      ? createPlanetTexture(planet.planetTextureSeed, PLANET_WINDOW_TEXTURE_HEIGHT, {
        ...planet.surfaceTextureParams,
        createUrls: false,
      })
      : planet.gasGiantTexture;
  const glowColor = texture?.edgeColor ?? planet.background ?? "#ffffff";
  layer.append(body);

  const sphere3D = createPlanetScreen3D(planet, texture, geometry, starDir, glowColor);
  layer.append(sphere3D.canvas);
  renderPlanetScreenObjectHit(planetScreen, {
    x: centerX,
    y: centerY,
    radius,
    depth: -0.18,
    detail: createPlanetScreenBodyDetail(planet, texture),
  });
  planetScreenController.state.active3D = sphere3D;
  renderPlanetScreen3D(sphere3D);
}

function createMoonSilhouetteShape(seed, textureCanvas, strength = 1) {
  if (!textureCanvas) {
    return null;
  }
  const normalizedStrength = THREE.MathUtils.clamp(strength, 0, Math.max(...MOON_SILHOUETTE_STRENGTH_BY_SIZE));
  const cacheKey = `${seed}:${textureCanvas.width}x${textureCanvas.height}:${normalizedStrength.toFixed(3)}`;
  if (moonSilhouetteMaskCache.has(cacheKey)) {
    return moonSilhouetteMaskCache.get(cacheKey);
  }

  const sourceContext = textureCanvas.getContext("2d", { willReadFrequently: true });
  const source = sourceContext.getImageData(0, 0, textureCanvas.width, textureCanvas.height).data;
  const boundary = Array.from({ length: MOON_SILHOUETTE_SAMPLES }, (_, index) => {
    const u = index / MOON_SILHOUETTE_SAMPLES;
    const low = sampleMoonTextureLuminance(source, textureCanvas.width, textureCanvas.height, u, 0.31);
    const mid = sampleMoonTextureLuminance(source, textureCanvas.width, textureCanvas.height, u, 0.53);
    const high = sampleMoonTextureLuminance(source, textureCanvas.width, textureCanvas.height, u, 0.77);
    const signal = low * 0.48 + mid * 0.34 + high * 0.18;
    const radius = MOON_SILHOUETTE_BASE_RADIUS
      + (signal - 0.5) * 2 * MOON_SILHOUETTE_RADIUS_AMPLITUDE * normalizedStrength;
    return THREE.MathUtils.clamp(
      radius,
      MOON_SILHOUETTE_MIN_RADIUS,
      MOON_SILHOUETTE_MAX_RADIUS,
    );
  });
  const smoothedBoundary = boundary.map((_, index) => {
    let sum = 0;
    let weightSum = 0;
    for (let offset = -3; offset <= 3; offset += 1) {
      const wrapped = (index + offset + MOON_SILHOUETTE_SAMPLES) % MOON_SILHOUETTE_SAMPLES;
      const weight = 4 - Math.abs(offset);
      sum += boundary[wrapped] * weight;
      weightSum += weight;
    }
    return sum / weightSum;
  });

  const canvas = document.createElement("canvas");
  canvas.width = MOON_SILHOUETTE_MASK_SIZE;
  canvas.height = MOON_SILHOUETTE_MASK_SIZE;
  const context = canvas.getContext("2d");
  const image = context.createImageData(canvas.width, canvas.height);
  const center = (MOON_SILHOUETTE_MASK_SIZE - 1) / 2;
  const feather = 1.35 / MOON_SILHOUETTE_MASK_SIZE;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const dx = (x - center) / MOON_SILHOUETTE_MASK_SIZE;
      const dy = (y - center) / MOON_SILHOUETTE_MASK_SIZE;
      const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
      const sample = angle / (Math.PI * 2) * MOON_SILHOUETTE_SAMPLES;
      const indexA = Math.floor(sample) % MOON_SILHOUETTE_SAMPLES;
      const indexB = (indexA + 1) % MOON_SILHOUETTE_SAMPLES;
      const radius = THREE.MathUtils.lerp(smoothedBoundary[indexA], smoothedBoundary[indexB], sample - Math.floor(sample));
      const distance = Math.hypot(dx, dy);
      const alpha = 1 - THREE.MathUtils.smoothstep(radius - feather, radius + feather, distance);
      const offset = (y * canvas.width + x) * 4;
      const value = Math.round(THREE.MathUtils.clamp(alpha, 0, 1) * 255);
      image.data[offset] = value;
      image.data[offset + 1] = value;
      image.data[offset + 2] = value;
      image.data[offset + 3] = value;
    }
  }
  context.putImageData(image, 0, 0);
  const clipPath = createMoonSilhouetteClipPath(smoothedBoundary);
  const shape = {
    boundary: smoothedBoundary,
    clipPath,
    maskUrl: `url(${canvas.toDataURL("image/png")})`,
  };
  moonSilhouetteMaskCache.set(cacheKey, shape);
  return shape;
}

function createMoonSilhouetteClipPath(boundary) {
  const points = boundary.map((radius, index) => {
    const angle = (index / boundary.length) * Math.PI * 2;
    const x = 50 + Math.cos(angle) * radius * 100;
    const y = 50 + Math.sin(angle) * radius * 100;
    return `${x.toFixed(2)}% ${y.toFixed(2)}%`;
  });
  return `polygon(${points.join(",")})`;
}

function applyMoonSilhouetteShape(element, shape) {
  if (!element || !shape) {
    return;
  }
  element.style.setProperty("--moon-silhouette-mask", shape.maskUrl);
  element.style.setProperty("--moon-silhouette-clip", shape.clipPath);
}

function sampleMoonTextureLuminance(data, width, height, u, v) {
  const x = Math.max(0, Math.min(width - 1, Math.floor(u * width)));
  const y = Math.max(0, Math.min(height - 1, Math.floor(v * height)));
  const offset = (y * width + x) * 4;
  return (data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722) / 255;
}

function getMoonDebugSettings() {
  const settings = planetScreenController.state.moonDebugSettings;
  settings.shadowStrength = Number.isFinite(settings.shadowStrength) ? settings.shadowStrength : 1.2;
  settings.bloomStrength = Number.isFinite(settings.bloomStrength) ? settings.bloomStrength : 1.3;
  settings.bloomBlur = Number.isFinite(settings.bloomBlur) ? settings.bloomBlur : 6.5;
  settings.bloomPulse = Number.isFinite(settings.bloomPulse) ? settings.bloomPulse : 1;
  settings.nearHaloRadius = Number.isFinite(settings.nearHaloRadius) ? settings.nearHaloRadius : -6.6;
  return settings;
}

function applyMoonBloomSettings(settings = getMoonDebugSettings()) {
  planetScreen.style.setProperty("--moon-bloom-strength", settings.bloomStrength.toFixed(2));
  planetScreen.style.setProperty("--moon-near-halo-radius", `${settings.nearHaloRadius.toFixed(2)}%`);
}

function applyMoonBloomTexture(element, seed, emissiveCanvas, shape, blur) {
  const bloom = createMoonBloomTexture(seed, emissiveCanvas, shape, blur);
  if (!bloom) {
    return;
  }
  element.style.backgroundImage = bloom.url;
  element.style.inset = `${(-bloom.insetPercent).toFixed(3)}%`;
}

function createMoonBloomTexture(seed, emissiveCanvas, shape, blur) {
  if (!emissiveCanvas || !shape?.boundary?.length) {
    return null;
  }
  const normalizedBlur = THREE.MathUtils.clamp(blur, 0, 48);
  const cacheKey = `${seed}:${emissiveCanvas.width}x${emissiveCanvas.height}:${normalizedBlur.toFixed(2)}`;
  if (moonBloomTextureCache.has(cacheKey)) {
    return moonBloomTextureCache.get(cacheKey);
  }

  const baseSize = Math.max(1, Math.min(emissiveCanvas.height, emissiveCanvas.width / 2));
  const blurPixels = Math.max(0, normalizedBlur * (baseSize / 128));
  const padding = Math.ceil(Math.max(2, blurPixels * 4));
  const outputSize = baseSize + padding * 2;
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = outputSize;
  sourceCanvas.height = outputSize;
  const sourceContext = sourceCanvas.getContext("2d");
  sourceContext.drawImage(
    emissiveCanvas,
    0,
    0,
    baseSize,
    baseSize,
    padding,
    padding,
    baseSize,
    baseSize,
  );
  sourceContext.globalCompositeOperation = "destination-in";
  sourceContext.beginPath();
  shape.boundary.forEach((radius, index) => {
    const angle = (index / shape.boundary.length) * Math.PI * 2;
    const x = padding + baseSize * 0.5 + Math.cos(angle) * radius * baseSize;
    const y = padding + baseSize * 0.5 + Math.sin(angle) * radius * baseSize;
    if (index === 0) {
      sourceContext.moveTo(x, y);
    } else {
      sourceContext.lineTo(x, y);
    }
  });
  sourceContext.closePath();
  sourceContext.fillStyle = "#fff";
  sourceContext.fill();
  sourceContext.globalCompositeOperation = "source-over";

  const bloomCanvas = document.createElement("canvas");
  bloomCanvas.width = outputSize;
  bloomCanvas.height = outputSize;
  const bloomContext = bloomCanvas.getContext("2d");
  bloomContext.filter = `blur(${blurPixels.toFixed(2)}px)`;
  bloomContext.drawImage(sourceCanvas, 0, 0);
  bloomContext.filter = "none";

  const bloom = {
    url: `url(${bloomCanvas.toDataURL("image/png")})`,
    insetPercent: (padding / baseSize) * 100,
  };
  moonBloomTextureCache.set(cacheKey, bloom);
  return bloom;
}

function createMaskedMoonTextureUrl(seed, textureCanvas, shape, cacheTag = "texture") {
  if (!textureCanvas || !shape?.boundary?.length) {
    return null;
  }
  const cacheKey = `${cacheTag}:${seed}:${textureCanvas.width}x${textureCanvas.height}`;
  if (moonMaskedTextureCache.has(cacheKey)) {
    return moonMaskedTextureCache.get(cacheKey);
  }

  const size = Math.max(1, Math.min(textureCanvas.height, textureCanvas.width / 2));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.drawImage(textureCanvas, 0, 0, size, size, 0, 0, size, size);
  context.globalCompositeOperation = "destination-in";
  context.beginPath();
  shape.boundary.forEach((radius, index) => {
    const angle = (index / shape.boundary.length) * Math.PI * 2;
    const x = size * 0.5 + Math.cos(angle) * radius * size;
    const y = size * 0.5 + Math.sin(angle) * radius * size;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.closePath();
  context.fillStyle = "#fff";
  context.fill();
  context.globalCompositeOperation = "source-over";

  const url = `url(${canvas.toDataURL("image/png")})`;
  moonMaskedTextureCache.set(cacheKey, url);
  return url;
}

function createPlanetScreenBodyDetail(planet, texture) {
  return {
    kind: planet.kind,
    name: planet.name,
    textureUrl: getPlanetScreenTextureUrl(texture),
    textureCanvas: texture?.canvas ?? null,
    cloudCanvas: texture?.cloudCanvas ?? null,
    bumpCanvas: planet.kind === "PLANET" ? texture?.bumpCanvas ?? null : null,
    emissiveCanvas: planet.kind === "PLANET" ? texture?.emissiveCanvas ?? null : null,
    dayCycleSeconds: planet.dayCycleSeconds,
    starGlowColor: planet.systemStarColor,
    starBlackCore: Boolean(planet.systemStarBlackCore),
    sizeIndex: planet.sizeIndex,
    bodySizeRank: planet.sizeIndex + 3,
  };
}

function getPlanetScreenTextureUrl(texture) {
  if (texture?.url) {
    return texture.url;
  }

  return texture?.canvas
    ? `url(${texture.canvas.toDataURL("image/png")})`
    : null;
}

function renderPlanetScreenObjectHit(root, { x, y, radius, depth, detail }) {
  if (!openObjectDetail || !detail?.textureUrl) {
    return;
  }

  const hit = document.createElement("button");
  hit.className = "planet-screen__object-hit";
  hit.type = "button";
  hit.setAttribute("aria-label", detail.name ? `Open ${detail.name}` : "Open object");
  hit.style.width = `${radius * 2}px`;
  hit.style.height = `${radius * 2}px`;
  hit.style.left = `${x - radius - 80}px`;
  hit.style.top = `${y - radius - 80}px`;
  hit.style.setProperty("--planet-screen-hit-depth", String(depth));
  hit.addEventListener("click", (event) => {
    event.stopPropagation();
    openObjectDetail(detail, event.clientX, event.clientY);
  });
  root.append(hit);
}

function getPlanetScreenEmissiveNoiseFrequency() {
  return PLANET_SCREEN_EMISSIVE_NOISE_SCALE * PLANET_SCREEN_EMISSIVE_NOISE_SCALE_MULTIPLIER;
}

function getPlanetScreenEmissiveNoiseUniforms() {
  return {
    emissiveNoiseScale: { value: getPlanetScreenEmissiveNoiseFrequency() },
    emissiveNoiseSpeed: { value: PLANET_SCREEN_EMISSIVE_NOISE_SPEED },
    emissiveNoiseBlackStop: { value: PLANET_SCREEN_EMISSIVE_NOISE_BLACK_STOP },
    emissiveNoiseWhiteStop: { value: PLANET_SCREEN_EMISSIVE_NOISE_WHITE_STOP },
    emissiveNoiseOctaves: { value: PLANET_SCREEN_EMISSIVE_NOISE_OCTAVES },
  };
}

function renderPlanetScreenMoons(layers, planet, width, height, starGeometry, starDir) {
  const moonSizes = [height * 0.03, height * 0.05, height * 0.07];
  const moonPaletteMode = shouldUseMoltenMoons(planet) ? "molten" : "moon";
  const positions = [
    { x: width * 0.58, y: height * 0.46 },
    { x: width * 0.83, y: height * 0.68 },
    { x: width * 0.36, y: height * 0.72 },
  ];
  for (const [index, moon] of planet.moonList.slice(0, 3).entries()) {
    const layer = layers[index];
    const depth = Number(layer.style.getPropertyValue("--planet-screen-depth")) || 0;
    const radius = moonSizes[Math.max(0, Math.min(2, Math.round((moon.radius - 1.2) / 0.4)))];
    const position = positions[index];
    const starSafeDistance = starGeometry.radius + radius + 36;
    const distanceToStar = Math.hypot(position.x - starGeometry.x, position.y - starGeometry.y);
    const x = distanceToStar < starSafeDistance
      ? position.x - (starSafeDistance - distanceToStar)
      : position.x;
    const y = position.y;
    const moonElement = document.createElement("div");
    moonElement.className = "planet-screen__moon";
    moonElement.style.width = `${radius * 2}px`;
    moonElement.style.height = `${radius * 2}px`;
    moonElement.style.left = `${x - radius}px`;
    moonElement.style.top = `${y - radius}px`;
    const moonTextureSeed = `${SEED}:moon-texture:${planet.systemId}:${planet.name}:${moon.name}`;
    const moonTexture = createMoonTexture(moonTextureSeed, undefined, {
      paletteMode: moonPaletteMode,
    });
    const moonDetail = {
      kind: "MOON",
      name: moon.name,
      textureUrl: moonTexture.url,
      textureCanvas: moonTexture.canvas,
      dayCycleSeconds: Infinity,
      starGlowColor: planet.systemStarColor,
      starBlackCore: Boolean(planet.systemStarBlackCore),
      sizeIndex: moon.sizeIndex,
      bodySizeRank: moon.sizeIndex,
      createTexture: () => createMoonTexture(moonTextureSeed, MOON_DETAIL_TEXTURE_HEIGHT, {
        paletteMode: moonPaletteMode,
      }) ?? null,
    };
    const moonTextureElement = document.createElement("span");
    moonTextureElement.className = "planet-screen__moon-texture";
    const silhouetteStrength = getMoonSilhouetteStrength(moon.sizeIndex);
    const silhouetteShape = createMoonSilhouetteShape(moonTextureSeed, moonTexture.canvas, silhouetteStrength);
    moonTextureElement.style.backgroundImage = createMaskedMoonTextureUrl(moonTextureSeed, moonTexture.canvas, silhouetteShape) ?? moonTexture.url;
    applyMoonSilhouetteShape(
      moonElement,
      silhouetteShape,
    );
    const moonShade = document.createElement("span");
    moonShade.className = "planet-screen__moon-shade";
    const moonBloomSoft = moonTexture.emissiveCanvas
      ? document.createElement("span")
      : null;
    const moonBloomCore = moonTexture.emissiveCanvas
      ? document.createElement("span")
      : null;
    if (moonBloomSoft && moonBloomCore) {
      const bloomUrl = createMaskedMoonTextureUrl(
        `${moonTextureSeed}:bloom-core`,
        moonTexture.emissiveCanvas,
        silhouetteShape,
        "bloom-core",
      ) ?? `url(${moonTexture.emissiveCanvas.toDataURL("image/png")})`;
      moonBloomSoft.className = "planet-screen__moon-bloom planet-screen__moon-bloom--soft";
      applyMoonBloomTexture(
        moonBloomSoft,
        moonTextureSeed,
        moonTexture.emissiveCanvas,
        silhouetteShape,
        getMoonDebugSettings().bloomBlur,
      );
      moonBloomCore.className = "planet-screen__moon-bloom planet-screen__moon-bloom--core";
      moonBloomCore.style.backgroundImage = bloomUrl;
      moonElement.style.setProperty("--moon-bloom-flicker", "1");
    }
    const moonRimInner = document.createElement("span");
    moonRimInner.className = "planet-screen__moon-rim planet-screen__moon-rim--inner";
    const moonRimNear = document.createElement("span");
    moonRimNear.className = "planet-screen__moon-rim planet-screen__moon-rim--near";
    const moonRimFar = document.createElement("span");
    moonRimFar.className = "planet-screen__moon-rim planet-screen__moon-rim--far";
    moonElement.style.setProperty("--moon-rim-color", planet.systemStarColor);
    moonElement.append(
      moonTextureElement,
      moonShade,
      ...(moonBloomSoft && moonBloomCore ? [moonBloomSoft, moonBloomCore] : []),
      moonRimInner,
      moonRimNear,
      moonRimFar,
    );
    layer.append(moonElement);
    const moonLabel = document.createElement("div");
    moonLabel.className = "planet-screen__moon-label";
    moonLabel.textContent = moon.name;
    moonLabel.style.left = `${x - 80}px`;
    moonLabel.style.top = `${y - radius - 7 - 80}px`;
    moonLabel.style.setProperty("--planet-screen-label-depth", String(depth));
    planetScreen.append(moonLabel);
    planetScreenController.state.activeMoons.push({
      element: moonElement,
      x,
      y,
      radius,
      depth,
      bloomFlicker: moonBloomSoft && moonBloomCore
        ? createMoonBloomFlicker(`${SEED}:moon-bloom-flicker:${moon.name}`)
        : null,
    });
    renderPlanetScreenObjectHit(planetScreen, {
      x,
      y,
      radius,
      depth,
      detail: moonDetail,
    });
  }
}

function shouldUseMoltenMoons(planet) {
  const textureMode = planet.surfaceTextureParams?.textureMode;
  return textureMode === "molten"
    || textureMode === "tidal-combine"
    || (Number.isFinite(planet.temperature) && planet.temperature > MOLTEN_MOON_TEMPERATURE_THRESHOLD);
}

function getMoonSilhouetteStrength(sizeIndex) {
  return MOON_SILHOUETTE_STRENGTH_BY_SIZE[
    THREE.MathUtils.clamp(Math.round(sizeIndex), 0, MOON_SILHOUETTE_STRENGTH_BY_SIZE.length - 1)
  ] ?? MOON_SILHOUETTE_STRENGTH_BY_SIZE[1];
}

function createMoonBloomFlicker(seed) {
  const random = createRandom(seed);
  return {
    random,
    value: random(),
    target: random(),
    nextChangeAt: 0,
  };
}

function createPlanetScreen3D(planet, texture, geometry, starDir, glowColor) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const layerOverscan = 180;
  const layerInsetCompensation = 80;
  const canvas = document.createElement("canvas");
  canvas.className = "planet-screen__sphere-surface";
  const renderWidth = width + layerOverscan * 2;
  const renderHeight = height + layerOverscan * 2;
  canvas.style.width = `${renderWidth}px`;
  canvas.style.height = `${renderHeight}px`;
  canvas.style.left = `${layerInsetCompensation - layerOverscan}px`;
  canvas.style.top = `${layerInsetCompensation - layerOverscan}px`;

  const renderer3D = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer3D.setClearColor(0x000000, 0);
  renderer3D.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer3D.setSize(renderWidth, renderHeight, false);
  renderer3D.outputColorSpace = THREE.SRGBColorSpace;

  const scene3D = new THREE.Scene();
  const fov = 75;
  const cameraDistance = renderHeight / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
  const camera3D = new THREE.PerspectiveCamera(
    fov,
    renderWidth / renderHeight,
    0.1,
    cameraDistance + geometry.radius * 6,
  );
  camera3D.layers.enable(PLANET_SCREEN_DISK_LIGHT_LAYER);
  camera3D.position.set(renderWidth / 2, renderHeight / 2, cameraDistance);
  camera3D.lookAt(renderWidth / 2, renderHeight / 2, 0);

  const sourceCanvas = texture?.canvas ?? createFallbackPlanetTextureCanvas(planet.background);
  const map = new THREE.CanvasTexture(sourceCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.anisotropy = Math.min(8, renderer3D.capabilities.getMaxAnisotropy());
  map.needsUpdate = true;
  const isPlanetTexture = planet.kind === "PLANET" && Boolean(texture?.canvas);
  const isGasGiantTexture = planet.kind === "GAS GIANT" && Boolean(texture?.canvas);
  const bumpMap = texture?.bumpCanvas && isPlanetTexture
    ? createPlanetScreenCanvasTexture(texture.bumpCanvas, renderer3D, false)
    : null;
  const specularMap = texture?.specularCanvas && isPlanetTexture
    ? createPlanetScreenCanvasTexture(texture.specularCanvas, renderer3D, false)
    : null;
  const emissiveMap = texture?.emissiveCanvas && isPlanetTexture
    ? createPlanetScreenCanvasTexture(texture.emissiveCanvas, renderer3D, true)
    : null;
  const cloudMap = texture?.cloudCanvas && isPlanetTexture
    ? createPlanetScreenCanvasTexture(texture.cloudCanvas, renderer3D, true)
    : texture?.cloudCanvas && isGasGiantTexture
      ? createPlanetScreenCanvasTexture(texture.cloudCanvas, renderer3D, true)
    : null;
  const rotation = createPlanetRotationState({
    seed: SEED,
    systemId: planet.systemId,
    planetName: planet.name,
    tidallyLocked: planet.tidallyLocked,
  });
  const cloudRotation = createPlanetRotationState({
    seed: SEED,
    systemId: planet.systemId,
    planetName: planet.name,
    tidallyLocked: false,
  });
  if (planet.tidallyLocked) {
    cloudRotation.period = 48;
    cloudRotation.turnsPerSecond = 1 / 48;
  }
  const cloudSpeedMultiplier = planet.tidallyLocked ? 1 : PLANET_SCREEN_CLOUD_SPEED_MULTIPLIER;
  const rotationPhase = getPlanetRotationPhase(rotation, performance.now() * 0.001);
  const manualTextureOffset = planet.tidallyLocked ? PLANET_SCREEN_TIDAL_LOCKED_TEXTURE_OFFSET : 0;
  const cloudRotationPhase = getPlanetRotationPhase({
    ...cloudRotation,
    turnsPerSecond: cloudRotation.turnsPerSecond * cloudSpeedMultiplier,
  }, performance.now() * 0.001);
  map.offset.x = rotationPhase + manualTextureOffset;

  const geometry3D = new THREE.SphereGeometry(geometry.radius, 128, 64);
  const planetSizeFactor = THREE.MathUtils.clamp(planet.sizeIndex / 9, 0, 1);
  const lightLift = THREE.MathUtils.lerp(0.23, 0.035, planetSizeFactor);
  const shadowFeather = THREE.MathUtils.lerp(0.18, 0.08, planetSizeFactor);
  const textureDirectionAngle = Math.atan2(-starDir.y, starDir.x);
  const baseQuaternion = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 0, 1), textureDirectionAngle);
  const cloudScale = THREE.MathUtils.lerp(1.006, 1.002, planetSizeFactor);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      planetMap: { value: map },
      bumpMap: { value: bumpMap ?? map },
      specularMap: { value: specularMap ?? map },
      emissiveMap: { value: emissiveMap ?? map },
      textureOffset: { value: new THREE.Vector2(rotationPhase + manualTextureOffset, 0) },
      bumpStrength: { value: bumpMap ? PLANET_SCREEN_BUMP_STRENGTH : 0 },
      bumpTexelSize: { value: new THREE.Vector2(1 / sourceCanvas.width, 1 / sourceCanvas.height) },
      specularStrength: { value: specularMap ? PLANET_SCREEN_SPECULAR_STRENGTH : 0 },
      emissiveStrength: { value: emissiveMap ? PLANET_SCREEN_EMISSIVE_STRENGTH : 0 },
      ...getPlanetScreenEmissiveNoiseUniforms(),
      emissiveTime: { value: performance.now() * 0.001 },
      reflectedLightColor: { value: new THREE.Color(planet.systemStarColor) },
      diskShadowNormal: { value: new THREE.Vector3(0, 0, 1) },
      diskShadowStrength: { value: 0 },
    },
    vertexShader: `
      varying vec3 vLocalPosition;
      varying vec3 vNormalView;
      varying vec3 vTangentUView;
      varying vec3 vTangentVView;
      void main() {
        vec3 localNormal = normalize(position);
        vec3 tangentU = vec3(localNormal.z, 0.0, -localNormal.x);
        tangentU = normalize(mix(vec3(1.0, 0.0, 0.0), tangentU, step(0.0001, dot(tangentU, tangentU))));
        vec3 tangentV = vec3(0.0, 1.0, 0.0) - localNormal * localNormal.y;
        tangentV = normalize(mix(vec3(0.0, 0.0, 1.0), tangentV, step(0.0001, dot(tangentV, tangentV))));
        vLocalPosition = position;
        vNormalView = normalize(normalMatrix * normal);
        vTangentUView = normalize(normalMatrix * tangentU);
        vTangentVView = normalize(normalMatrix * tangentV);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D planetMap;
      uniform sampler2D bumpMap;
      uniform sampler2D specularMap;
      uniform sampler2D emissiveMap;
      uniform vec2 textureOffset;
      uniform float bumpStrength;
      uniform vec2 bumpTexelSize;
      uniform float specularStrength;
      uniform float emissiveStrength;
      uniform float emissiveNoiseScale;
      uniform float emissiveNoiseSpeed;
      uniform float emissiveNoiseBlackStop;
      uniform float emissiveNoiseWhiteStop;
      uniform float emissiveNoiseOctaves;
      uniform float emissiveTime;
      uniform vec3 reflectedLightColor;
      uniform vec3 diskShadowNormal;
      uniform float diskShadowStrength;
      varying vec3 vLocalPosition;
      varying vec3 vNormalView;
      varying vec3 vTangentUView;
      varying vec3 vTangentVView;
      const float PI = 3.141592653589793;
      float getPlanetBumpHeight(vec3 color) {
        return dot(color, vec3(0.299, 0.587, 0.114));
      }
      float emissiveHash(vec2 point) {
        return fract(sin(dot(point, vec2(41.31, 289.17))) * 19341.1415);
      }
      float emissiveNoise(vec2 uvPoint, vec2 frequency) {
        if (frequency.x <= 0.0 || frequency.y <= 0.0) {
          return 0.5;
        }
        vec2 point = uvPoint * frequency;
        vec2 cell = floor(point);
        vec2 local = smoothstep(vec2(0.0), vec2(1.0), fract(point));
        vec2 cell00 = mod(cell, frequency);
        vec2 cell10 = mod(cell + vec2(1.0, 0.0), frequency);
        vec2 cell01 = mod(cell + vec2(0.0, 1.0), frequency);
        vec2 cell11 = mod(cell + vec2(1.0, 1.0), frequency);
        float a = emissiveHash(cell00);
        float b = emissiveHash(cell10);
        float c = emissiveHash(cell01);
        float d = emissiveHash(cell11);
        return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
      }
      float emissiveOctaveNoise(vec2 uvPoint) {
        float total = 0.0;
        float amplitude = 1.0;
        float amplitudeTotal = 0.0;
        for (int octave = 0; octave < 8; octave += 1) {
          if (float(octave) >= emissiveNoiseOctaves) {
            break;
          }
          float octaveScale = pow(2.0, float(octave));
          total += emissiveNoise(uvPoint, vec2(emissiveNoiseScale * octaveScale, emissiveNoiseScale * octaveScale * 0.5)) * amplitude;
          amplitudeTotal += amplitude;
          amplitude *= 0.5;
        }
        return total / max(amplitudeTotal, 0.0001);
      }
      float emissiveNoiseMask(vec2 uvPoint) {
        float blackStop = clamp(emissiveNoiseBlackStop, 0.0, 1.0);
        float whiteStop = max(blackStop + 0.001, clamp(emissiveNoiseWhiteStop, 0.0, 1.0));
        return smoothstep(blackStop, whiteStop, emissiveOctaveNoise(uvPoint));
      }
      void main() {
        vec3 localNormal = normalize(vLocalPosition);
        float cylindricalU = atan(localNormal.x, localNormal.z) / (2.0 * PI) + 0.5;
        float cylindricalV = clamp(localNormal.y * 0.5 + 0.5, 0.0, 1.0);
        vec2 uv = vec2(cylindricalU + textureOffset.x, cylindricalV);
        vec3 base = texture2D(planetMap, uv).rgb;
        float heightLeft = getPlanetBumpHeight(texture2D(bumpMap, uv - vec2(bumpTexelSize.x, 0.0)).rgb);
        float heightRight = getPlanetBumpHeight(texture2D(bumpMap, uv + vec2(bumpTexelSize.x, 0.0)).rgb);
        float heightDown = getPlanetBumpHeight(texture2D(bumpMap, uv - vec2(0.0, bumpTexelSize.y)).rgb);
        float heightUp = getPlanetBumpHeight(texture2D(bumpMap, uv + vec2(0.0, bumpTexelSize.y)).rgb);
        vec2 heightGradient = vec2(heightRight - heightLeft, heightUp - heightDown);
        float bumpPoleFade = smoothstep(0.04, 0.18, cylindricalV) * (1.0 - smoothstep(0.82, 0.96, cylindricalV));
        vec3 normalView = normalize(
          vNormalView - (vTangentUView * heightGradient.x + vTangentVView * heightGradient.y) * bumpStrength * bumpPoleFade
        );
        vec3 lightView = normalize(vec3(0.0, ${lightLift.toFixed(4)}, -1.0));
        float lit = smoothstep(0.0, ${shadowFeather.toFixed(4)}, dot(normalView, lightView));
        vec3 color = base * lit;
        float specularMask = texture2D(specularMap, uv).r;
        float specular = pow(max(dot(reflect(-lightView, normalView), vec3(0.0, 0.0, 1.0)), 0.0), 24.0) * specularMask * specularStrength * lit;
        color += vec3(specular);
        vec3 emissive = texture2D(emissiveMap, uv).rgb;
        vec2 emissiveUv = vec2(fract(uv.x + emissiveTime * emissiveNoiseSpeed), uv.y);
        float emissiveMask = emissiveNoiseMask(emissiveUv);
        color += emissive * emissiveStrength * emissiveMask;
        float reflectedLight = pow(lit, 0.72) * 0.055;
        float rim = pow(1.0 - abs(normalView.z), 1.55);
        float litRim = rim * (0.045 + lit * 0.045);
        float diskPlaneDistance = abs(dot(localNormal, normalize(diskShadowNormal)));
        float diskBand = 1.0 - smoothstep(0.045, 0.18, diskPlaneDistance);
        float diskShadow = diskBand * smoothstep(0.04, 0.7, lit) * diskShadowStrength;
        color *= 1.0 - diskShadow;
        color += base * reflectedLightColor * reflectedLight;
        color += reflectedLightColor * litRim;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geometry3D, material);
  mesh.position.set(geometry.centerX + layerOverscan, height - geometry.centerY + layerOverscan, 0);
  mesh.renderOrder = 1;
  mesh.quaternion.copy(baseQuaternion);

  scene3D.add(mesh);

  const disk3D = createPlanetScreen3DDisk(planet, geometry.radius);
  let diskLight = null;
  if (disk3D) {
    disk3D.group.position.copy(mesh.position);
    const diskNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(disk3D.group.quaternion);
    const meshInverse = mesh.quaternion.clone().invert();
    material.uniforms.diskShadowNormal.value.copy(diskNormal.applyQuaternion(meshInverse).normalize());
    material.uniforms.diskShadowStrength.value = 0.34;
    diskLight = createPlanetScreenDiskLight(planet, mesh.position, disk3D);
    scene3D.add(diskLight.group);
    scene3D.add(disk3D.group);
  }

  const glowPixelRatio = Math.min(window.devicePixelRatio, 1.5);
  const glowTargetScale = 0.34;
  const glowTargetWidth = Math.max(1, Math.ceil(renderWidth * glowPixelRatio * glowTargetScale));
  const glowTargetHeight = Math.max(1, Math.ceil(renderHeight * glowPixelRatio * glowTargetScale));
  const glowTargetOptions = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    depthBuffer: false,
    stencilBuffer: false,
  };
  const glowTargetA = new THREE.WebGLRenderTarget(glowTargetWidth, glowTargetHeight, glowTargetOptions);
  const glowTargetB = new THREE.WebGLRenderTarget(glowTargetWidth, glowTargetHeight, glowTargetOptions);
  glowTargetA.texture.colorSpace = THREE.SRGBColorSpace;
  glowTargetB.texture.colorSpace = THREE.SRGBColorSpace;
  const glowScene = new THREE.Scene();
  const postScene = new THREE.Scene();
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const rimGlowColor = new THREE.Color(glowColor).lerp(new THREE.Color(0xffffff), 0.34);
  const glowGeometry = new THREE.SphereGeometry(geometry.radius, 160, 80);
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: rimGlowColor },
      visibleOffset: { value: new THREE.Vector2(layerOverscan - layerInsetCompensation, layerOverscan - layerInsetCompensation) },
      visibleSize: { value: new THREE.Vector2(width, height) },
    },
    vertexShader: `
      varying vec3 vNormalView;
      void main() {
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform vec2 visibleOffset;
      uniform vec2 visibleSize;
      varying vec3 vNormalView;
      const float PI = 3.141592653589793;
      void main() {
        vec3 normalView = normalize(vNormalView);
        float silhouette = 1.0 - abs(normalView.z);
        float broadGlow = pow(silhouette, 2.25) * 0.78;
        float softCore = pow(silhouette, 7.4) * 1.08;
        float backSideMask = 1.0 - smoothstep(-0.08, 0.02, normalView.z);
        float screenX = clamp((gl_FragCoord.x - visibleOffset.x) / max(1.0, visibleSize.x), 0.0, 1.0);
        float screenFade = pow(sin(screenX * PI), 1.15);
        float alpha = (broadGlow + softCore) * screenFade * backSideMask;
        if (alpha < 0.002) {
          discard;
        }
        gl_FragColor = vec4(glowColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
  glowMesh.position.copy(mesh.position);
  glowMesh.quaternion.copy(baseQuaternion);
  const glowScale = THREE.MathUtils.lerp(1.014, 1.006, planetSizeFactor);
  glowMesh.scale.setScalar(glowScale);
  glowMesh.renderOrder = 3;
  glowScene.add(glowMesh);

  let bloomGeometry = null;
  let bloomMaterial = null;
  let bloomMesh = null;
  if (emissiveMap) {
    bloomGeometry = new THREE.SphereGeometry(geometry.radius, 160, 80);
    bloomMaterial = createPlanetScreenEmissiveBloomMaterial({
      emissiveMap,
      offset: rotationPhase + manualTextureOffset,
    });
    bloomMesh = new THREE.Mesh(bloomGeometry, bloomMaterial);
    bloomMesh.position.copy(mesh.position);
    bloomMesh.quaternion.copy(baseQuaternion);
    bloomMesh.scale.setScalar(1.001);
    bloomMesh.renderOrder = 2;
    glowScene.add(bloomMesh);
  }

  let cloudMesh = null;
  let cloudGeometry = null;
  let cloudMaterial = null;
  if (cloudMap) {
    cloudGeometry = new THREE.SphereGeometry(geometry.radius, 160, 80);
    cloudMaterial = isGasGiantTexture
      ? createPlanetScreenGasGiantCloudMaterial({
        cloudMap,
        offset: cloudRotationPhase,
        reflectedLightColor: planet.systemStarColor,
        lightLift,
        shadowFeather,
      })
      : createPlanetScreenCloudMaterial({
        cloudMap,
        offset: cloudRotationPhase,
        reflectedLightColor: planet.systemStarColor,
        lightLift,
        shadowFeather,
      });
    cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    cloudMesh.position.copy(mesh.position);
    cloudMesh.quaternion.copy(baseQuaternion);
    cloudMesh.scale.setScalar(cloudScale);
    cloudMesh.renderOrder = 3;
    scene3D.add(cloudMesh);
  }

  const blurMaterial = new THREE.ShaderMaterial({
    uniforms: {
      inputTexture: { value: glowTargetA.texture },
      direction: { value: new THREE.Vector2(1, 0) },
      resolution: { value: new THREE.Vector2(glowTargetWidth, glowTargetHeight) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D inputTexture;
      uniform vec2 direction;
      uniform vec2 resolution;
      varying vec2 vUv;
      void main() {
        vec2 stepSize = direction / resolution;
        vec4 color = texture2D(inputTexture, vUv) * 0.227027;
        color += texture2D(inputTexture, vUv + stepSize * 1.384615) * 0.316216;
        color += texture2D(inputTexture, vUv - stepSize * 1.384615) * 0.316216;
        color += texture2D(inputTexture, vUv + stepSize * 3.230769) * 0.070270;
        color += texture2D(inputTexture, vUv - stepSize * 3.230769) * 0.070270;
        gl_FragColor = color;
      }
    `,
    depthWrite: false,
    depthTest: false,
  });
  const blurQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMaterial);
  const blurScene = new THREE.Scene();
  blurScene.add(blurQuad);

  const compositeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      inputTexture: { value: glowTargetA.texture },
      resolution: { value: new THREE.Vector2(renderWidth * glowPixelRatio, renderHeight * glowPixelRatio) },
      intensity: { value: 5.6 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D inputTexture;
      uniform vec2 resolution;
      uniform float intensity;
      varying vec2 vUv;
      float noise(vec2 point) {
        return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453123);
      }
      void main() {
        vec4 glow = texture2D(inputTexture, vUv);
        float dither = (noise(gl_FragCoord.xy) - 0.5) / 255.0;
        float energy = clamp(glow.a * intensity + dither, 0.0, 1.0);
        if (energy <= 0.001) {
          discard;
        }
        gl_FragColor = vec4(glow.rgb * energy, 0.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    toneMapped: false,
  });
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compositeMaterial));

  return {
    canvas,
    renderer: renderer3D,
    scene: scene3D,
    camera: camera3D,
    mesh,
    texture: map,
    textureRotation: rotation,
    manualTextureOffset,
    isTidallyLocked: planet.tidallyLocked,
    bumpTexture: bumpMap,
    specularTexture: specularMap,
    emissiveTexture: emissiveMap,
    cloudTexture: cloudMap,
    cloudTextureRotation: cloudRotation,
    cloudSpeedMultiplier,
    cloudMesh,
    cloudGeometry,
    cloudMaterial,
    geometry: geometry3D,
    material,
    disk3D,
    diskLight,
    glowScene,
    glowTargetA,
    glowTargetB,
    glowGeometry,
    glowMaterial,
    bloomGeometry,
    bloomMaterial,
    bloomMesh,
    blurScene,
    blurMaterial,
    compositeScene: postScene,
    compositeCamera: postCamera,
    compositeMaterial,
  };
}

function createPlanetScreenCanvasTexture(canvas, renderer3D, srgb = true) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = Math.min(8, renderer3D.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return texture;
}

function createPlanetScreenEmissiveBloomMaterial({ emissiveMap, offset }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      emissiveMap: { value: emissiveMap },
      textureOffset: { value: new THREE.Vector2(offset, 0) },
      emissiveTime: { value: performance.now() * 0.001 },
      ...getPlanetScreenEmissiveNoiseUniforms(),
      emissiveBloomStrength: { value: PLANET_SCREEN_EMISSIVE_BLOOM_STRENGTH },
    },
    vertexShader: `
      varying vec3 vLocalPosition;
      void main() {
        vLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D emissiveMap;
      uniform vec2 textureOffset;
      uniform float emissiveTime;
      uniform float emissiveNoiseScale;
      uniform float emissiveNoiseSpeed;
      uniform float emissiveNoiseBlackStop;
      uniform float emissiveNoiseWhiteStop;
      uniform float emissiveNoiseOctaves;
      uniform float emissiveBloomStrength;
      varying vec3 vLocalPosition;
      const float PI = 3.141592653589793;
      float emissiveHash(vec2 point) {
        return fract(sin(dot(point, vec2(41.31, 289.17))) * 19341.1415);
      }
      float emissiveNoise(vec2 uvPoint, vec2 frequency) {
        if (frequency.x <= 0.0 || frequency.y <= 0.0) {
          return 0.5;
        }
        vec2 point = uvPoint * frequency;
        vec2 cell = floor(point);
        vec2 local = smoothstep(vec2(0.0), vec2(1.0), fract(point));
        vec2 cell00 = mod(cell, frequency);
        vec2 cell10 = mod(cell + vec2(1.0, 0.0), frequency);
        vec2 cell01 = mod(cell + vec2(0.0, 1.0), frequency);
        vec2 cell11 = mod(cell + vec2(1.0, 1.0), frequency);
        float a = emissiveHash(cell00);
        float b = emissiveHash(cell10);
        float c = emissiveHash(cell01);
        float d = emissiveHash(cell11);
        return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
      }
      float emissiveOctaveNoise(vec2 uvPoint) {
        float total = 0.0;
        float amplitude = 1.0;
        float amplitudeTotal = 0.0;
        for (int octave = 0; octave < 8; octave += 1) {
          if (float(octave) >= emissiveNoiseOctaves) {
            break;
          }
          float octaveScale = pow(2.0, float(octave));
          total += emissiveNoise(uvPoint, vec2(emissiveNoiseScale * octaveScale, emissiveNoiseScale * octaveScale * 0.5)) * amplitude;
          amplitudeTotal += amplitude;
          amplitude *= 0.5;
        }
        return total / max(amplitudeTotal, 0.0001);
      }
      float emissiveNoiseMask(vec2 uvPoint) {
        float blackStop = clamp(emissiveNoiseBlackStop, 0.0, 1.0);
        float whiteStop = max(blackStop + 0.001, clamp(emissiveNoiseWhiteStop, 0.0, 1.0));
        return smoothstep(blackStop, whiteStop, emissiveOctaveNoise(uvPoint));
      }
      void main() {
        vec3 localNormal = normalize(vLocalPosition);
        float cylindricalU = atan(localNormal.x, localNormal.z) / (2.0 * PI) + 0.5;
        float cylindricalV = clamp(localNormal.y * 0.5 + 0.5, 0.0, 1.0);
        vec2 uv = vec2(cylindricalU + textureOffset.x, cylindricalV);
        vec3 emissive = texture2D(emissiveMap, uv).rgb;
        vec2 emissiveUv = vec2(fract(uv.x + emissiveTime * emissiveNoiseSpeed), uv.y);
        float emissiveMask = emissiveNoiseMask(emissiveUv);
        float mask = max(max(emissive.r, emissive.g), emissive.b);
        float alpha = clamp(mask * emissiveBloomStrength * emissiveMask, 0.0, 1.0);
        if (alpha <= 0.001) {
          discard;
        }
        gl_FragColor = vec4(emissive * emissiveBloomStrength * emissiveMask, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function createPlanetScreenCloudMaterial({
  cloudMap,
  offset,
  reflectedLightColor,
  lightLift,
  shadowFeather,
}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      cloudMap: { value: cloudMap },
      textureOffset: { value: new THREE.Vector2(offset, 0) },
      reflectedLightColor: { value: new THREE.Color(reflectedLightColor) },
    },
    vertexShader: `
      varying vec3 vLocalPosition;
      varying vec3 vNormalView;
      void main() {
        vLocalPosition = position;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D cloudMap;
      uniform vec2 textureOffset;
      uniform vec3 reflectedLightColor;
      varying vec3 vLocalPosition;
      varying vec3 vNormalView;
      const float PI = 3.141592653589793;
      void main() {
        vec3 localNormal = normalize(vLocalPosition);
        float cylindricalU = atan(localNormal.x, localNormal.z) / (2.0 * PI) + 0.5;
        float cylindricalV = clamp(localNormal.y * 0.5 + 0.5, 0.0, 1.0);
        vec4 cloud = texture2D(cloudMap, vec2(cylindricalU + textureOffset.x, cylindricalV));
        if (cloud.a < 0.01) {
          discard;
        }
        vec3 normalView = normalize(vNormalView);
        vec3 lightView = normalize(vec3(0.0, ${lightLift.toFixed(4)}, -1.0));
        float rawLight = dot(normalView, lightView);
        if (rawLight <= 0.0) {
          discard;
        }
        float lit = smoothstep(0.0, ${shadowFeather.toFixed(4)}, rawLight);
        float terminatorTint = (1.0 - smoothstep(0.0, ${shadowFeather.toFixed(4)} * 1.6, rawLight)) * lit;
        vec3 color = mix(cloud.rgb * (0.45 + lit * 0.62), cloud.rgb * reflectedLightColor, terminatorTint * 0.58);
        gl_FragColor = vec4(color, cloud.a * lit * 0.92);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}

function createPlanetScreenGasGiantCloudMaterial({
  cloudMap,
  offset,
  reflectedLightColor,
  lightLift,
  shadowFeather,
}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      cloudMap: { value: cloudMap },
      textureOffset: { value: new THREE.Vector2(offset, 0) },
      reflectedLightColor: { value: new THREE.Color(reflectedLightColor) },
    },
    vertexShader: `
      varying vec3 vLocalPosition;
      varying vec3 vNormalView;
      void main() {
        vLocalPosition = position;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D cloudMap;
      uniform vec2 textureOffset;
      uniform vec3 reflectedLightColor;
      varying vec3 vLocalPosition;
      varying vec3 vNormalView;
      const float PI = 3.141592653589793;

      void main() {
        vec3 localNormal = normalize(vLocalPosition);
        float cylindricalU = atan(localNormal.x, localNormal.z) / (2.0 * PI) + 0.5;
        float cylindricalV = clamp(localNormal.y * 0.5 + 0.5, 0.0, 1.0);
        vec2 uv = vec2(cylindricalU + textureOffset.x, cylindricalV);
        vec4 cloud = texture2D(cloudMap, uv);
        vec3 normalView = normalize(vNormalView);
        vec3 lightView = normalize(vec3(0.0, ${lightLift.toFixed(4)}, -1.0));
        float rawLight = dot(normalView, lightView);
        if (rawLight <= 0.0) {
          discard;
        }
        float lit = smoothstep(0.0, ${shadowFeather.toFixed(4)}, rawLight);
        float alpha = cloud.a * lit;
        if (alpha < 0.01) {
          discard;
        }
        float terminatorTint = (1.0 - smoothstep(0.0, ${shadowFeather.toFixed(4)} * 1.6, rawLight)) * lit;
        vec3 baseColor = cloud.rgb * (0.52 + lit * 0.58);
        vec3 color = mix(baseColor, cloud.rgb * reflectedLightColor, terminatorTint * 0.48);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}

function createPlanetScreen3DDisk(planet, planetScreenRadius) {
  if (!planet.accretionDisk) {
    return null;
  }

  const diskGeometry = getPlanetScreenDiskGeometry(planet, planetScreenRadius);
  const sourceInner = diskGeometry.sourceInnerRadius;
  const sourceThickness = diskGeometry.sourceThickness;
  const group = new THREE.Group();
  const geometries = [];
  const materials = [];
  const baseColor = new THREE.Color(0xbfc0c2).lerp(new THREE.Color(planet.systemStarColor), 0.08);
  const segmentColor = baseColor;

  const cutRanges = createPlanetScreenDiskCutRanges(
    planet,
    diskGeometry,
    planetScreenRadius,
    sourceInner,
    sourceThickness,
  );
  const heterogeneousBands = createPlanetScreenDiskHeterogeneousBands(
    planet,
    diskGeometry,
    planetScreenRadius,
    segmentColor,
    cutRanges,
  );

  let cursor = diskGeometry.innerRadius;
  const addRing = ({
    innerRadius,
    outerRadius,
    color,
    depthWrite = true,
    radialSegments = 1536,
    renderOrder = 2,
    zOffset = 0,
    polygonOffset = false,
  }) => {
    if (outerRadius <= innerRadius + 0.1) {
      return;
    }

    const radialSubdivisions = Math.max(
      2,
      Math.min(18, Math.ceil((outerRadius - innerRadius) / Math.max(planetScreenRadius * 0.018, 8))),
    );
    const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, radialSegments, radialSubdivisions);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.05,
      roughness: 0.86,
      transparent: false,
      depthWrite,
      depthTest: true,
      polygonOffset,
      polygonOffsetFactor: polygonOffset ? -3 : 0,
      polygonOffsetUnits: polygonOffset ? -3 : 0,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(ringGeometry, ringMaterial);
    mesh.position.z = zOffset;
    mesh.layers.set(PLANET_SCREEN_DISK_LIGHT_LAYER);
    mesh.renderOrder = renderOrder;
    group.add(mesh);
    geometries.push(ringGeometry);
    materials.push(ringMaterial);
  };

  for (const range of cutRanges) {
    addRing({
      innerRadius: cursor,
      outerRadius: range.start,
      color: segmentColor,
    });
    cursor = Math.max(cursor, range.end);
  }
  addRing({
    innerRadius: cursor,
    outerRadius: diskGeometry.outerRadius,
    color: segmentColor,
  });

  for (const [index, band] of heterogeneousBands.entries()) {
    addRing({
      innerRadius: band.innerRadius,
      outerRadius: band.outerRadius,
      color: band.color,
      depthWrite: false,
      renderOrder: 3,
      zOffset: Math.max(2, planetScreenRadius * 0.004) + index * 0.02,
      polygonOffset: true,
    });
  }

  applyPlanetDiskRotationToGroup(group, planet);
  group.renderOrder = 2;

  return {
    group,
    geometries,
    materials,
    diskGeometry,
  };
}

function createPlanetScreenDiskCutRanges(planet, diskGeometry, planetScreenRadius, sourceInner, sourceThickness) {
  const sourceCutHalfWidth = getPlanetScreenDiskCutHalfWidth(diskGeometry, planetScreenRadius);
  const sourceCutRanges = planet.accretionDisk.cutRadii.map((cutRadius) => {
    const relative = THREE.MathUtils.clamp((cutRadius - sourceInner) / sourceThickness, 0, 1);
    const radius = THREE.MathUtils.lerp(diskGeometry.innerRadius, diskGeometry.outerRadius, relative);
    return {
      start: Math.max(diskGeometry.innerRadius, radius - sourceCutHalfWidth),
      end: Math.min(diskGeometry.outerRadius, radius + sourceCutHalfWidth),
    };
  });
  const extraCutRanges = createPlanetScreenDiskExtraCutRanges(planet, diskGeometry, planetScreenRadius);

  return mergePlanetScreenDiskRanges([...sourceCutRanges, ...extraCutRanges]);
}

function createPlanetScreenDiskExtraCutRanges(planet, diskGeometry, planetScreenRadius) {
  const random = createRandom(`${SEED}:planet-screen-extra-disk-cuts:${planet.systemId}:${planet.name}`);
  const thickness = diskGeometry.thickness;
  const count = THREE.MathUtils.clamp(
    Math.round(thickness / Math.max(planetScreenRadius * 0.72, 1)) + Math.floor(random() * 2),
    PLANET_SCREEN_DISK_EXTRA_CUT_MIN_COUNT,
    PLANET_SCREEN_DISK_EXTRA_CUT_MAX_COUNT,
  );
  const ranges = [];
  const cutHalfWidthMin = Math.max(3, planetScreenRadius * 0.003);
  const cutHalfWidthMax = Math.max(cutHalfWidthMin, Math.min(planetScreenRadius * 0.018, thickness * 0.014));

  for (let index = 0; index < count; index += 1) {
    const step = (index + 0.5 + (random() - 0.5) * 0.54) / count;
    const radius = THREE.MathUtils.lerp(diskGeometry.innerRadius, diskGeometry.outerRadius, THREE.MathUtils.clamp(step, 0.04, 0.96));
    const cutHalfWidth = THREE.MathUtils.lerp(cutHalfWidthMin, cutHalfWidthMax, random());
    ranges.push({
      start: Math.max(diskGeometry.innerRadius, radius - cutHalfWidth),
      end: Math.min(diskGeometry.outerRadius, radius + cutHalfWidth),
    });
  }

  return ranges;
}

function mergePlanetScreenDiskRanges(ranges) {
  const sortedRanges = ranges
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);
  const mergedRanges = [];

  for (const range of sortedRanges) {
    const previous = mergedRanges.at(-1);
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      mergedRanges.push({ ...range });
    }
  }

  return mergedRanges;
}

function createPlanetScreenDiskHeterogeneousBands(planet, diskGeometry, planetScreenRadius, baseColor, cutRanges) {
  const random = createRandom(`${SEED}:planet-screen-disk-bands:${planet.systemId}:${planet.name}`);
  const bands = [];
  const sourceInner = diskGeometry.sourceInnerRadius;
  const sourceThickness = diskGeometry.sourceThickness;
  const thickness = diskGeometry.thickness;
  const sourceBands = planet.accretionDisk.bandRadii ?? [];
  const dynamicCount = THREE.MathUtils.clamp(
    Math.round(thickness / Math.max(planetScreenRadius * 0.045, 1)),
    PLANET_SCREEN_DISK_BAND_MIN_COUNT,
    PLANET_SCREEN_DISK_BAND_MAX_COUNT,
  );

  const addBand = (radius, width, color) => {
    const clampedRadius = THREE.MathUtils.clamp(radius, diskGeometry.innerRadius, diskGeometry.outerRadius);
    const clampedWidth = THREE.MathUtils.clamp(width, planetScreenRadius * 0.004, thickness * 0.12);
    const innerRadius = clampedRadius - clampedWidth * 0.5;
    const outerRadius = clampedRadius + clampedWidth * 0.5;
    const crossesDisk = outerRadius > diskGeometry.innerRadius && innerRadius < diskGeometry.outerRadius;
    const fillsCut = cutRanges.some((range) => outerRadius > range.start && innerRadius < range.end);
    if (!crossesDisk || fillsCut) {
      return;
    }
    bands.push({
      color,
      innerRadius: Math.max(diskGeometry.innerRadius, innerRadius),
      outerRadius: Math.min(diskGeometry.outerRadius, outerRadius),
    });
  };

  for (const band of sourceBands) {
    const relative = THREE.MathUtils.clamp((band.radius - sourceInner) / sourceThickness, 0, 1);
    const radius = THREE.MathUtils.lerp(diskGeometry.innerRadius, diskGeometry.outerRadius, relative);
    const width = Math.max(planetScreenRadius * 0.014, thickness * 0.018) * (1.2 + band.width * 1.8);
    const color = baseColor.clone().lerp(
      new THREE.Color(0xffffff),
      THREE.MathUtils.clamp(0.12 + band.alpha * 0.5, 0.12, 0.36),
    );
    addBand(radius, width, color);
  }

  for (let index = 0; index < dynamicCount; index += 1) {
    const step = (index + 0.5 + (random() - 0.5) * 0.42) / dynamicCount;
    const radius = THREE.MathUtils.lerp(diskGeometry.innerRadius, diskGeometry.outerRadius, step);
    const width = thickness * THREE.MathUtils.lerp(0.006, 0.028, random());
    const color = baseColor.clone().lerp(
      new THREE.Color(0xffffff),
      THREE.MathUtils.lerp(0.05, 0.16, random()),
    );
    addBand(radius, width, color);
  }

  const brightBandCount = THREE.MathUtils.clamp(
    Math.round(thickness / Math.max(planetScreenRadius * 0.85, 1)) + Math.floor(random() * 2),
    PLANET_SCREEN_DISK_BRIGHT_BAND_MIN_COUNT,
    PLANET_SCREEN_DISK_BRIGHT_BAND_MAX_COUNT,
  );
  for (let index = 0; index < brightBandCount; index += 1) {
    const radius = THREE.MathUtils.lerp(diskGeometry.innerRadius, diskGeometry.outerRadius, 0.12 + random() * 0.76);
    const width = thickness * THREE.MathUtils.lerp(0.055, 0.14, random());
    const color = baseColor.clone().lerp(new THREE.Color(0xffffff), THREE.MathUtils.lerp(0.28, 0.52, random()));
    addBand(radius, width, color);
  }

  return bands.sort((a, b) => a.innerRadius - b.innerRadius);
}

function createPlanetScreenDiskLight(planet, planetCenter, disk3D) {
  const { outerRadius } = disk3D.diskGeometry;
  const farEdgeDirection = getPlanetScreenDiskFarEdgeDirection(disk3D.group);
  const lightPosition = planetCenter.clone()
    .addScaledVector(farEdgeDirection, outerRadius * PLANET_SCREEN_DISK_LIGHT_FAR_EDGE_OFFSET)
    .addScaledVector(new THREE.Vector3(1, 0, 0), outerRadius * PLANET_SCREEN_DISK_LIGHT_RIGHT_OFFSET);
  const lightDistance = getPlanetScreenDiskLightDistance(disk3D.diskGeometry);
  const group = new THREE.Group();
  const pointLight = new THREE.PointLight(
    new THREE.Color(planet.systemStarColor),
    0.85,
    lightDistance,
    PLANET_SCREEN_DISK_LIGHT_DECAY,
  );
  const whitePointLight = new THREE.PointLight(
    0xffffff,
    1.35,
    lightDistance * PLANET_SCREEN_DISK_WHITE_LIGHT_DISTANCE_SCALE,
    PLANET_SCREEN_DISK_LIGHT_DECAY,
  );
  pointLight.position.copy(lightPosition);
  whitePointLight.position.copy(lightPosition);
  pointLight.layers.set(PLANET_SCREEN_DISK_LIGHT_LAYER);
  whitePointLight.layers.set(PLANET_SCREEN_DISK_LIGHT_LAYER);
  group.add(pointLight, whitePointLight);
  return {
    group,
    pointLight,
    whitePointLight,
  };
}

function getPlanetScreenDiskLightDistance(diskGeometry) {
  return Math.max(
    1,
    diskGeometry.innerRadius * PLANET_SCREEN_DISK_LIGHT_INNER_RADIUS_SCALE
      + diskGeometry.thickness * PLANET_SCREEN_DISK_LIGHT_THICKNESS_SCALE,
  );
}

function getPlanetScreenDiskFarEdgeDirection(group) {
  const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(group.quaternion);
  const localY = new THREE.Vector3(0, 1, 0).applyQuaternion(group.quaternion);
  const farEdgeDirection = localX.multiplyScalar(-localX.z).add(localY.multiplyScalar(-localY.z));
  if (farEdgeDirection.lengthSq() < 0.0001) {
    return new THREE.Vector3(0, 0, -1);
  }
  return farEdgeDirection.normalize();
}

function getPlanetScreenDiskGeometry(planet, planetScreenRadius) {
  const diskScale = planetScreenRadius / planet.radius;
  const originalThickness = Math.max(1, (planet.accretionDisk.outerRadius - planet.accretionDisk.innerRadius) * diskScale);
  const innerRadius = planetScreenRadius * PLANET_SCREEN_DISK_INNER_RADIUS_SCALE;
  const thickness = originalThickness * PLANET_SCREEN_DISK_THICKNESS_SCALE * PLANET_SCREEN_DISK_OUTER_RADIUS_SCALE;

  return {
    innerRadius,
    outerRadius: innerRadius + thickness,
    thickness,
    sourceInnerRadius: planet.accretionDisk.innerRadius,
    sourceThickness: Math.max(1, planet.accretionDisk.outerRadius - planet.accretionDisk.innerRadius),
  };
}

function getPlanetScreenDiskCutHalfWidth(diskGeometry, planetScreenRadius) {
  const minWidth = Math.max(6, planetScreenRadius * 0.01);
  const preferredWidth = diskGeometry.thickness * 0.045;
  const maxWidth = Math.max(
    minWidth,
    Math.min(planetScreenRadius * 0.12, diskGeometry.thickness * 0.16),
  );

  return THREE.MathUtils.clamp(preferredWidth, minWidth, maxWidth);
}

function applyPlanetDiskRotationToGroup(group, planet) {
  const rotationRandom = createRandom(`${SEED}:planet-screen-disk-rotation:${planet.systemId}:${planet.name}`);
  const rotationX = THREE.MathUtils.lerp(-129, -21, rotationRandom());
  group.rotation.set(
    THREE.MathUtils.degToRad(rotationX),
    THREE.MathUtils.degToRad(50),
    0,
  );
}

function renderPlanetScreen3D(surface) {
  const renderer3D = surface.renderer;
  renderer3D.setRenderTarget(null);
  renderer3D.autoClear = true;
  renderer3D.clear(true, true, true);
  renderer3D.render(surface.scene, surface.camera);

  renderer3D.setRenderTarget(surface.glowTargetA);
  renderer3D.clear(true, true, true);
  renderer3D.render(surface.glowScene, surface.camera);

  surface.blurMaterial.uniforms.inputTexture.value = surface.glowTargetA.texture;
  surface.blurMaterial.uniforms.direction.value.set(1, 0);
  renderer3D.setRenderTarget(surface.glowTargetB);
  renderer3D.clear(true, true, true);
  renderer3D.render(surface.blurScene, surface.compositeCamera);

  surface.blurMaterial.uniforms.inputTexture.value = surface.glowTargetB.texture;
  surface.blurMaterial.uniforms.direction.value.set(0, 1);
  renderer3D.setRenderTarget(surface.glowTargetA);
  renderer3D.clear(true, true, true);
  renderer3D.render(surface.blurScene, surface.compositeCamera);

  surface.blurMaterial.uniforms.inputTexture.value = surface.glowTargetA.texture;
  surface.blurMaterial.uniforms.direction.value.set(1, 0);
  renderer3D.setRenderTarget(surface.glowTargetB);
  renderer3D.clear(true, true, true);
  renderer3D.render(surface.blurScene, surface.compositeCamera);

  surface.blurMaterial.uniforms.inputTexture.value = surface.glowTargetB.texture;
  surface.blurMaterial.uniforms.direction.value.set(0, 1);
  renderer3D.setRenderTarget(surface.glowTargetA);
  renderer3D.clear(true, true, true);
  renderer3D.render(surface.blurScene, surface.compositeCamera);

  renderer3D.setRenderTarget(null);
  renderer3D.autoClear = false;
  renderer3D.render(surface.compositeScene, surface.compositeCamera);
  renderer3D.autoClear = true;
}

function updatePlanetScreen3D(surface, deltaSeconds, now) {
  let needsRender = false;
  const manualTextureOffset = surface.isTidallyLocked ? PLANET_SCREEN_TIDAL_LOCKED_TEXTURE_OFFSET : 0;
  if (surface.textureRotation?.turnsPerSecond !== 0) {
    surface.texture.offset.x = getPlanetRotationPhase(surface.textureRotation, now * 0.001) + manualTextureOffset;
    surface.material.uniforms.textureOffset.value.x = surface.texture.offset.x;
    if (surface.bloomMaterial) {
      surface.bloomMaterial.uniforms.textureOffset.value.x = surface.texture.offset.x;
    }
    needsRender = true;
  } else if (surface.material.uniforms.textureOffset.value.x !== manualTextureOffset) {
    surface.texture.offset.x = manualTextureOffset;
    surface.material.uniforms.textureOffset.value.x = manualTextureOffset;
    if (surface.bloomMaterial) {
      surface.bloomMaterial.uniforms.textureOffset.value.x = manualTextureOffset;
    }
    needsRender = true;
  }
  if (surface.emissiveTexture) {
    surface.material.uniforms.emissiveTime.value = now * 0.001;
    if (surface.bloomMaterial) {
      surface.bloomMaterial.uniforms.emissiveTime.value = now * 0.001;
    }
    needsRender = true;
  }

  if (surface.cloudTexture && surface.cloudTextureRotation?.turnsPerSecond !== 0) {
    const cloudPhase = getPlanetRotationPhase({
      ...surface.cloudTextureRotation,
      turnsPerSecond: surface.cloudTextureRotation.turnsPerSecond * surface.cloudSpeedMultiplier,
    }, now * 0.001);
    surface.cloudTexture.offset.x = cloudPhase;
    surface.cloudMaterial.uniforms.textureOffset.value.x = cloudPhase;
    needsRender = true;
  }

  if (needsRender) {
    renderPlanetScreen3D(surface);
  }
  updatePlanetScreenMoonBloom(now, deltaSeconds);
}

function updatePlanetScreenMoonBloom(now, deltaSeconds) {
  const seconds = now * 0.001;
  const smoothing = 1 - Math.exp(-MOON_BLOOM_FLICKER_SMOOTHING * deltaSeconds);
  for (const moon of planetScreenController.state.activeMoons ?? []) {
    const flicker = moon.bloomFlicker;
    if (!flicker || !moon.element) {
      continue;
    }
    if (seconds >= flicker.nextChangeAt) {
      flicker.target = flicker.random() < 0.18
        ? 0
        : Math.pow(flicker.random(), 1.45);
      flicker.nextChangeAt = seconds + THREE.MathUtils.lerp(
        MOON_BLOOM_FLICKER_MIN_INTERVAL,
        MOON_BLOOM_FLICKER_MAX_INTERVAL,
        flicker.random(),
      );
    }
    flicker.value = THREE.MathUtils.lerp(flicker.value, flicker.target, smoothing);
    const pulse = getMoonDebugSettings().bloomPulse;
    const visibleValue = THREE.MathUtils.lerp(1, flicker.value, pulse);
    moon.element.style.setProperty("--moon-bloom-flicker", THREE.MathUtils.clamp(visibleValue, 0, 1).toFixed(3));
  }
}

function disposePlanetScreen3D() {
  const activePlanetScreen3D = planetScreenController.state.active3D;
  if (!activePlanetScreen3D) {
    return;
  }

  activePlanetScreen3D.texture.dispose();
  activePlanetScreen3D.bumpTexture?.dispose();
  activePlanetScreen3D.specularTexture?.dispose();
  activePlanetScreen3D.emissiveTexture?.dispose();
  activePlanetScreen3D.cloudTexture?.dispose();
  activePlanetScreen3D.geometry.dispose();
  activePlanetScreen3D.material.dispose();
  activePlanetScreen3D.cloudGeometry?.dispose();
  activePlanetScreen3D.cloudMaterial?.dispose();
  activePlanetScreen3D.disk3D?.geometries?.forEach((geometry) => geometry.dispose());
  activePlanetScreen3D.disk3D?.materials?.forEach((material) => material.dispose());
  activePlanetScreen3D.glowTargetA?.dispose();
  activePlanetScreen3D.glowTargetB?.dispose();
  activePlanetScreen3D.glowGeometry?.dispose();
  activePlanetScreen3D.glowMaterial?.dispose();
  activePlanetScreen3D.bloomGeometry?.dispose();
  activePlanetScreen3D.bloomMaterial?.dispose();
  activePlanetScreen3D.blurMaterial?.dispose();
  activePlanetScreen3D.compositeMaterial?.dispose();
  activePlanetScreen3D.renderer.dispose();
  activePlanetScreen3D.renderer.forceContextLoss();
  activePlanetScreen3D.renderer.domElement = null;
  activePlanetScreen3D.canvas.width = 1;
  activePlanetScreen3D.canvas.height = 1;
  activePlanetScreen3D.canvas.remove();
  planetScreenController.state.active3D = null;
}

function createFallbackPlanetTextureCanvas(background) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#f5f5f5");
  gradient.addColorStop(0.5, "#d6d6d6");
  gradient.addColorStop(1, "#8f8f8f");
  context.fillStyle = background?.startsWith("#") ? background : gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}
  return {
    dispose3D: disposePlanetScreen3D,
    render: renderPlanetScreen,
    renderFallback: renderPlanetScreenFallback,
    update3D: updatePlanetScreen3D,
  };
}
