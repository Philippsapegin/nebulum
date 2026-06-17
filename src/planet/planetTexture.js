import * as THREE from "three";
import { PLANET_PALETTES } from "../planetPalettes.js";
import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from "../utils/color.js";
import { createRandom } from "../utils/random.js";

export const PLANET_SYSTEM_TEXTURE_HEIGHT = 32;
export const PLANET_WINDOW_TEXTURE_HEIGHT = 1024;
const PLANET_TEXTURE_ASPECT = 2;
const PLANET_SURFACE_OCTAVES = 9;
const PLANET_CLOUD_OCTAVES = 7;
const PLANET_PERSISTENCE = 0.5;
const PLANET_CLOUD_ALPHA_SPAN = 0.28;
const planetTextureCache = new Map();

export function createPlanetTexture(seed, textureHeight = PLANET_SYSTEM_TEXTURE_HEIGHT, options = {}) {
  const waterPosition = THREE.MathUtils.clamp(options.waterPosition ?? 0, 0, 1);
  const iceCaps = THREE.MathUtils.clamp(options.iceCaps ?? 0, 0, 55);
  const cloudAlpha = Number.isFinite(options.cloudAlpha)
    ? THREE.MathUtils.clamp(options.cloudAlpha, 0, 1)
    : null;
  const createUrls = options.createUrls ?? true;
  const cacheKey = `${seed}:${textureHeight}:${waterPosition.toFixed(4)}:${iceCaps.toFixed(2)}:${cloudAlpha ?? "no-clouds"}:${createUrls ? "urls" : "canvas"}`;
  if (planetTextureCache.has(cacheKey)) {
    return planetTextureCache.get(cacheKey);
  }

  const random = createRandom(seed);
  const palette = selectPlanetPalette(random, waterPosition > 0);
  const width = textureHeight * PLANET_TEXTURE_ASPECT;
  const height = textureHeight;
  const surfaceStops = createShiftedStops(normalizePlanetWaterStops(palette.stops, waterPosition), random);
  const iceStops = createShiftedStops(normalizePlanetWaterStops(palette.iceStops ?? palette.stops, waterPosition), random);
  const cloudStops = cloudAlpha === null
    ? null
    : createShiftedStops(normalizeCloudStops(palette.cloudStops ?? createDefaultCloudStops(), cloudAlpha), random);
  const field = createSurfaceNoiseField({
    width,
    height,
    scale: 7,
    octaves: PLANET_SURFACE_OCTAVES,
    seed: `${seed}:surface`,
  });
  const surfaceCanvas = document.createElement("canvas");
  surfaceCanvas.width = width;
  surfaceCanvas.height = height;
  renderSurfaceCanvas(surfaceCanvas, field, surfaceStops, iceStops, {
    seed: `${seed}:ice`,
    iceCaps,
  });

  const cloudCanvas = cloudStops ? document.createElement("canvas") : null;
  if (cloudCanvas) {
    cloudCanvas.width = width;
    cloudCanvas.height = height;
    renderCloudCanvas(cloudCanvas, {
      seed: `${seed}:clouds`,
      stops: cloudStops,
    });
  }

  const specularCanvas = document.createElement("canvas");
  specularCanvas.width = width;
  specularCanvas.height = height;
  renderSpecularCanvas(specularCanvas, field, waterPosition);

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  renderBumpCanvas(bumpCanvas, field, waterPosition);

  const texture = {
    url: createUrls ? `url(${surfaceCanvas.toDataURL("image/png")})` : null,
    cloudUrl: createUrls && cloudCanvas ? `url(${cloudCanvas.toDataURL("image/png")})` : null,
    canvas: surfaceCanvas,
    cloudCanvas,
    specularCanvas,
    bumpCanvas,
    width,
    height,
    edgeColor: rgbToHex(samplePaletteStops(
      surfaceStops,
      field[Math.floor(height * 0.5) * width + Math.floor(width * 0.13)],
    )),
  };
  planetTextureCache.set(cacheKey, texture);
  return texture;
}

function selectPlanetPalette(random, hasWater) {
  const matchingPalettes = PLANET_PALETTES.filter((palette) => {
    const isBarrenPalette = palette.name?.startsWith("B.");
    return hasWater ? !isBarrenPalette : isBarrenPalette;
  });
  const palettes = matchingPalettes.length ? matchingPalettes : PLANET_PALETTES;
  return palettes[Math.floor(random() * palettes.length)] ?? PLANET_PALETTES[0];
}

function renderSpecularCanvas(canvas, field, waterPosition) {
  const context = canvas.getContext("2d");
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = canvas.width;
  sourceCanvas.height = canvas.height;
  const sourceContext = sourceCanvas.getContext("2d");
  const image = sourceContext.createImageData(canvas.width, canvas.height);
  const specularWaterPosition = THREE.MathUtils.clamp(waterPosition + 0.01, 0, 1);
  for (let index = 0; index < field.length; index += 1) {
    const value = field[index] <= specularWaterPosition && waterPosition > 0 ? 255 : 0;
    const offset = index * 4;
    image.data[offset] = value;
    image.data[offset + 1] = value;
    image.data[offset + 2] = value;
    image.data[offset + 3] = 255;
  }
  sourceContext.putImageData(image, 0, 0);

  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = canvas.width * 3;
  blurCanvas.height = canvas.height;
  const blurContext = blurCanvas.getContext("2d");
  blurContext.drawImage(sourceCanvas, 0, 0);
  blurContext.drawImage(sourceCanvas, canvas.width, 0);
  blurContext.drawImage(sourceCanvas, canvas.width * 2, 0);
  const filteredCanvas = document.createElement("canvas");
  filteredCanvas.width = blurCanvas.width;
  filteredCanvas.height = blurCanvas.height;
  const filteredContext = filteredCanvas.getContext("2d");
  filteredContext.filter = "blur(2px)";
  filteredContext.drawImage(blurCanvas, 0, 0);
  filteredContext.filter = "none";
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    filteredCanvas,
    canvas.width,
    0,
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  context.filter = "none";
}

function renderBumpCanvas(canvas, field, waterPosition) {
  const context = canvas.getContext("2d");
  const image = context.createImageData(canvas.width, canvas.height);
  const landSpan = Math.max(0.0001, 1 - waterPosition);
  const waterValue = 42;
  for (let index = 0; index < field.length; index += 1) {
    const noise = field[index];
    const value = noise <= waterPosition
      ? waterValue
      : Math.round(waterValue + ((noise - waterPosition) / landSpan) * (255 - waterValue));
    const offset = index * 4;
    image.data[offset] = value;
    image.data[offset + 1] = value;
    image.data[offset + 2] = value;
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

function createSurfaceNoiseField({ width, height, scale, octaves, seed }) {
  const random = createRandom(seed);
  const octaveSeeds = Array.from({ length: octaves }, () => Math.floor(random() * 0xffffffff));
  const field = new Float32Array(width * height);
  let offset = 0;

  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      let sum = 0;
      let amp = 1;
      let ampSum = 0;
      let freq = scale;
      for (let octave = 0; octave < octaves; octave += 1) {
        sum += sampleTileableValueNoise(u, v, freq, freq, octaveSeeds[octave]) * amp;
        ampSum += amp;
        amp *= PLANET_PERSISTENCE;
        freq *= 2;
      }
      field[offset] = sum / ampSum;
      offset += 1;
    }
  }

  return field;
}

function renderSurfaceCanvas(canvas, field, surfaceStops, iceStops, iceConfig) {
  const width = canvas.width;
  const height = canvas.height;
  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);
  const iceMask = createIceMaskConfig(iceConfig.seed, iceConfig.iceCaps);

  for (let index = 0; index < field.length; index += 1) {
    const baseNoise = THREE.MathUtils.clamp(field[index], 0, 1);
    const color = samplePaletteStops(surfaceStops, baseNoise);
    const iceAlpha = getIceMaskAlpha(index, width, height, iceMask, baseNoise, surfaceStops[1]?.pos ?? 0);
    const iceColor = iceAlpha > 0 ? samplePaletteStops(iceStops, baseNoise) : color;
    const offset = index * 4;
    image.data[offset] = THREE.MathUtils.lerp(color[0], iceColor[0], iceAlpha);
    image.data[offset + 1] = THREE.MathUtils.lerp(color[1], iceColor[1], iceAlpha);
    image.data[offset + 2] = THREE.MathUtils.lerp(color[2], iceColor[2], iceAlpha);
    image.data[offset + 3] = 255;
  }

  context.putImageData(image, 0, 0);
}

function renderCloudCanvas(canvas, { seed, stops, octaves = PLANET_CLOUD_OCTAVES }) {
  const width = canvas.width;
  const height = canvas.height;
  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);
  const alphaCutoff = stops[0]?.pos ?? 0.48;
  const scale = createSeededCloudScale(seed);

  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const cloud = createCloudNoise(u, v, seed, scale, octaves);
      const alpha = smoothstep(alphaCutoff, Math.min(1, alphaCutoff + PLANET_CLOUD_ALPHA_SPAN), cloud);
      const color = samplePaletteStops(stops.slice(1), cloud);
      const offset = (y * width + x) * 4;
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
      image.data[offset + 3] = Math.round(alpha * 255);
    }
  }

  context.putImageData(image, 0, 0);
}

function createSeededCloudScale(seed) {
  return 14 + Math.floor(createRandom(`${seed}:scale`)() * 9);
}

function createCloudNoise(u, v, seed, baseFreq, octaveCount = PLANET_CLOUD_OCTAVES) {
  const macroFreqX = Math.max(1, Math.round(baseFreq * 0.45));
  const macroFreqY = Math.max(1, Math.round(baseFreq * 0.24));
  const warpA = sampleTileableValueNoise(u, v, macroFreqX, macroFreqY, hashString(`${seed}:warp-a`)) - 0.5;
  const warpB = sampleTileableValueNoise(u + 0.31, v + 0.17, macroFreqX + 2, macroFreqY + 1, hashString(`${seed}:warp-b`)) - 0.5;
  const latitudeWind = Math.sin(v * Math.PI * 2) * 0.035;
  const warpedU = u + latitudeWind + warpA * 0.12;
  const warpedV = v + warpB * 0.16 + Math.sin(u * Math.PI * 4 + warpA * 4) * 0.025;
  const random = createRandom(`${seed}:octaves`);

  let sum = 0;
  let amp = 1;
  let ampSum = 0;
  for (let octave = 0; octave < octaveCount; octave += 1) {
    const freqX = Math.max(1, Math.round(baseFreq * 2 ** octave));
    const freqY = Math.max(1, Math.round(baseFreq * 0.5 * 2 ** octave));
    sum += sampleTileableValueNoise(
      warpedU + warpB * 0.08,
      warpedV + warpA * 0.08,
      freqX,
      freqY,
      Math.floor(random() * 0xffffffff),
    ) * amp;
    ampSum += amp;
    amp *= 0.55;
  }

  const bands = Math.sin((warpedV + warpA * 0.05) * Math.PI * 10) * 0.035;
  return THREE.MathUtils.clamp(sum / ampSum + bands, 0, 1);
}

function createIceMaskConfig(seed, iceCaps) {
  const random = createRandom(seed);
  return {
    width: THREE.MathUtils.clamp(iceCaps / 100, 0, 0.5),
    isFullCoverage: iceCaps >= 55,
    macroFreq: 7 + Math.floor(random() * 7),
    macroAmp: (5 + random() * 7) / 100,
    detailFreq: 50,
    detailAmp: 3 / 100,
    seed,
  };
}

function getIceMaskAlpha(index, width, height, config, noiseValue, waterLimit) {
  if (!config.width) {
    return 0;
  }
  if (config.isFullCoverage) {
    return 1;
  }

  const x = index % width;
  const y = Math.floor(index / width);
  const u = x / width;
  const v = y / height;
  const poleDistance = Math.min(v, 1 - v);
  const isLand = noiseValue > waterLimit;
  const wave =
    (sampleTileableValueNoise(u, 0.23, config.macroFreq, 1, hashString(`${config.seed}:macro`)) - 0.5) * 2 * config.macroAmp +
    (isLand ? 0 : (sampleTileableValueNoise(u, 0.61, config.detailFreq, 1, hashString(`${config.seed}:detail`)) - 0.5) * 2 * config.detailAmp);
  const edge = THREE.MathUtils.clamp(config.width + wave, 0, 0.5);
  const softness = isLand ? 0.035 : 0.012;
  return 1 - smoothstep(edge, edge + softness, poleDistance);
}

function normalizePlanetWaterStops(stops, waterPosition) {
  const normalized = stops.map((stop) => ({ ...stop }));
  const previousWater = THREE.MathUtils.clamp(normalized[1]?.pos ?? 0.5, 0.01, 0.99);
  const landRelative = normalized.map((stop, index) => {
    if (index < 2) return 0;
    return THREE.MathUtils.clamp((stop.pos - previousWater) / Math.max(0.0001, 1 - previousWater), 0, 1);
  });

  normalized[1].pos = waterPosition;
  normalized[0].pos = waterPosition * 0.75;
  for (let index = 2; index < normalized.length; index += 1) {
    normalized[index].pos = waterPosition + landRelative[index] * (1 - waterPosition);
  }
  normalized[normalized.length - 1].pos = 1;
  return normalized;
}

function normalizeCloudStops(stops, alphaPosition) {
  const normalized = stops.map((stop) => ({ ...stop }));
  const previousAlpha = THREE.MathUtils.clamp(normalized[0]?.pos ?? 0.48, 0.01, 0.99);
  const cloudRelative = normalized.map((stop, index) => {
    if (index === 0) return 0;
    return THREE.MathUtils.clamp((stop.pos - previousAlpha) / Math.max(0.0001, 1 - previousAlpha), 0, 1);
  });
  normalized[0].pos = alphaPosition;
  for (let index = 1; index < normalized.length; index += 1) {
    normalized[index].pos = alphaPosition + cloudRelative[index] * (1 - alphaPosition);
  }
  normalized[normalized.length - 1].pos = 1;
  return normalized;
}

function createDefaultCloudStops() {
  return [
    { pos: 0.48, color: "#000000", hueShift: [0, 0], brightnessShift: [0, 0] },
    { pos: 0.52, color: "#bac8cf", hueShift: [-2, 2], brightnessShift: [-5, 5] },
    { pos: 0.74, color: "#e3edf1", hueShift: [-2, 2], brightnessShift: [-4, 4] },
    { pos: 1, color: "#ffffff", hueShift: [-1, 1], brightnessShift: [-3, 3] },
  ];
}

function createShiftedStops(stops, random) {
  return stops
    .map((stop) => ({
      pos: stop.pos,
      rgb: hexToRgb(applyColorShift(stop, random)),
    }))
    .sort((a, b) => a.pos - b.pos);
}

function applyColorShift(stop, random) {
  const hueShift = stop.hueShift ?? [0, 0];
  const brightnessShift = stop.brightnessShift ?? [0, 0];
  const hsl = rgbToHsl(hexToRgb(stop.color));
  hsl[0] += hueShift[0] + random() * (hueShift[1] - hueShift[0]);
  hsl[2] = THREE.MathUtils.clamp(
    hsl[2] + brightnessShift[0] + random() * (brightnessShift[1] - brightnessShift[0]),
    0,
    100,
  );
  return rgbToHex(hslToRgb(hsl));
}

function samplePaletteStops(stops, value) {
  if (value <= stops[0].pos) {
    return stops[0].rgb;
  }
  const last = stops[stops.length - 1];
  if (value >= last.pos) {
    return last.rgb;
  }

  for (let index = 0; index < stops.length - 1; index += 1) {
    const left = stops[index];
    const right = stops[index + 1];
    if (value <= right.pos) {
      const t = (value - left.pos) / Math.max(0.0001, right.pos - left.pos);
      return [
        THREE.MathUtils.lerp(left.rgb[0], right.rgb[0], t),
        THREE.MathUtils.lerp(left.rgb[1], right.rgb[1], t),
        THREE.MathUtils.lerp(left.rgb[2], right.rgb[2], t),
      ];
    }
  }

  return last.rgb;
}

function sampleTileableValueNoise(u, v, freqX, freqY, seed) {
  const gx = positiveModulo(u, 1) * freqX;
  const gy = positiveModulo(v, 1) * freqY;
  const fx = Math.floor(gx);
  const fy = Math.floor(gy);
  const tx = smoothNoiseStep(gx - fx);
  const ty = smoothNoiseStep(gy - fy);
  const x0 = ((fx % freqX) + freqX) % freqX;
  const y0 = ((fy % freqY) + freqY) % freqY;
  const x1 = (x0 + 1) % freqX;
  const y1 = (y0 + 1) % freqY;
  const a = cornerHash(seed, x0, y0);
  const b = cornerHash(seed, x1, y0);
  const c = cornerHash(seed, x0, y1);
  const d = cornerHash(seed, x1, y1);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(a, b, tx),
    THREE.MathUtils.lerp(c, d, tx),
    ty,
  );
}

function cornerHash(seed, x, y) {
  let hash = (seed ^ Math.imul(x + 1, 2654435761) ^ Math.imul(y + 1, 2246822519)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 15), 2246822519);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489917);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function smoothNoiseStep(value) {
  return value * value * (3 - 2 * value);
}

function smoothstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}
