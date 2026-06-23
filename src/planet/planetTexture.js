import * as THREE from "three";
import { MOLTEN_PALETTES } from "../moltenPalettes.js";
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
const TIDAL_ICE_SPREAD = 45;
const TIDAL_MOLTEN_SPREAD = 45;
const TIDAL_EDGE_MACRO_FREQ = 1;
const TIDAL_EDGE_MACRO_AMP = 0;
const TIDAL_EDGE_DETAIL_FREQ = 12;
const TIDAL_EDGE_DETAIL_AMP = 0.02;
const TIDAL_EDGE_SOFTNESS = 0.03;
const planetTextureCache = new Map();

export function createPlanetTexture(seed, textureHeight = PLANET_SYSTEM_TEXTURE_HEIGHT, options = {}) {
  const waterPosition = THREE.MathUtils.clamp(options.waterPosition ?? 0, 0, 1);
  const iceCaps = THREE.MathUtils.clamp(options.iceCaps ?? 0, 0, 55);
  const cloudAlpha = Number.isFinite(options.cloudAlpha)
    ? THREE.MathUtils.clamp(options.cloudAlpha, 0, 1)
    : null;
  const createUrls = options.createUrls ?? true;
  const textureMode = options.textureMode ?? "default";
  const surfaceScale = options.surfaceScale ?? 7;
  const freezeWater = Boolean(options.freezeWater);
  const cacheKey = `${seed}:${textureHeight}:${waterPosition.toFixed(4)}:${iceCaps.toFixed(2)}:${cloudAlpha ?? "no-clouds"}:${textureMode}:${surfaceScale.toFixed(3)}:${freezeWater ? "frozen-water" : "normal-water"}:${createUrls ? "urls" : "canvas"}`;
  if (planetTextureCache.has(cacheKey)) {
    return planetTextureCache.get(cacheKey);
  }

  const random = createRandom(seed);
  const palette = selectPlanetPalette(random, waterPosition > 0, textureMode);
  const moltenPalette = textureMode === "tidal-combine" || textureMode === "molten"
    ? selectMoltenPalette(random)
    : null;
  const width = textureHeight * PLANET_TEXTURE_ASPECT;
  const height = textureHeight;
  const surfaceStops = createShiftedStops(
    textureMode === "molten"
      ? normalizeMoltenStops(moltenPalette?.stops ?? palette.stops)
      : normalizePlanetWaterStops(palette.stops, textureMode === "tidal-combine" ? 0 : waterPosition),
    random,
  );
  const iceStops = createShiftedStops(normalizePlanetWaterStops(palette.iceStops ?? palette.stops, 0), random);
  const moltenStops = moltenPalette
    ? createShiftedStops(normalizeMoltenStops(moltenPalette.stops), random)
    : null;
  const cloudPalette = textureMode === "molten" && moltenPalette ? moltenPalette : palette;
  const cloudStops = cloudAlpha === null
    ? null
    : createShiftedStops(normalizeCloudStops(cloudPalette.cloudStops ?? createDefaultCloudStops(), cloudAlpha), random);
  const moltenCloudStops = cloudAlpha === null || !moltenPalette
    ? null
    : createShiftedStops(normalizeCloudStops(moltenPalette.cloudStops ?? createDefaultCloudStops(), cloudAlpha), random);
  const field = createSurfaceNoiseField({
    width,
    height,
    scale: surfaceScale,
    octaves: PLANET_SURFACE_OCTAVES,
    seed: `${seed}:surface`,
  });
  const surfaceCanvas = document.createElement("canvas");
  surfaceCanvas.width = width;
  surfaceCanvas.height = height;
  if (textureMode === "tidal-combine") {
    renderTidalSurfaceCanvas(surfaceCanvas, field, surfaceStops, iceStops, moltenStops, `${seed}:tidal`);
  } else {
    renderSurfaceCanvas(surfaceCanvas, field, surfaceStops, iceStops, {
      seed: `${seed}:ice`,
      iceCaps: textureMode === "molten" ? 0 : iceCaps,
      freezeWater,
      waterPosition,
    });
  }

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

  const emissiveCanvas = moltenStops ? document.createElement("canvas") : null;
  if (emissiveCanvas) {
    emissiveCanvas.width = width;
    emissiveCanvas.height = height;
    renderEmissiveCanvas(emissiveCanvas, field, moltenStops, {
      seed: `${seed}:emissive`,
      textureMode,
    });
  }

  const texture = {
    url: createUrls ? `url(${surfaceCanvas.toDataURL("image/png")})` : null,
    cloudUrl: createUrls && cloudCanvas ? `url(${cloudCanvas.toDataURL("image/png")})` : null,
    canvas: surfaceCanvas,
    cloudCanvas,
    specularCanvas,
    bumpCanvas,
    emissiveCanvas,
    textureMode,
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

function selectPlanetPalette(random, hasWater, textureMode = "default") {
  const matchingPalettes = PLANET_PALETTES.filter((palette) => {
    const isBarrenPalette = palette.name?.startsWith("B.");
    if (textureMode === "tidal-combine") {
      return isBarrenPalette;
    }
    return hasWater ? !isBarrenPalette : isBarrenPalette;
  });
  const palettes = matchingPalettes.length ? matchingPalettes : PLANET_PALETTES;
  return palettes[Math.floor(random() * palettes.length)] ?? PLANET_PALETTES[0];
}

function selectMoltenPalette(random) {
  return MOLTEN_PALETTES[Math.floor(random() * MOLTEN_PALETTES.length)] ?? MOLTEN_PALETTES[0];
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

function renderEmissiveCanvas(canvas, field, moltenStops, { seed, textureMode }) {
  const context = canvas.getContext("2d");
  const image = context.createImageData(canvas.width, canvas.height);
  for (let index = 0; index < field.length; index += 1) {
    const value = THREE.MathUtils.clamp(field[index], 0, 1);
    const x = index % canvas.width;
    const y = Math.floor(index / canvas.width);
    const u = x / canvas.width;
    const v = y / canvas.height;
    const stopInfo = samplePaletteStopInfo(moltenStops, value);
    const strength = getMoltenEmissiveStrength(stopInfo.label);
    const tidalMask = textureMode === "tidal-combine"
      ? getTidalEdgeMask(u, v, TIDAL_MOLTEN_SPREAD, `${seed}:molten`)
      : 1;
    const intensity = strength * tidalMask;
    const offset = index * 4;
    image.data[offset] = stopInfo.rgb[0] * intensity;
    image.data[offset + 1] = stopInfo.rgb[1] * intensity;
    image.data[offset + 2] = stopInfo.rgb[2] * intensity;
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

function getMoltenEmissiveStrength(label) {
  if (label === "deep lava") {
    return 1;
  }
  if (label === "lava") {
    return 0.74;
  }
  return 0;
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
    const waterLimit = surfaceStops[1]?.pos ?? 0;
    const specularWaterLimit = THREE.MathUtils.clamp((iceConfig.waterPosition ?? waterLimit) + 0.01, 0, 1);
    const shouldFreezeWater = iceConfig.freezeWater && baseNoise <= specularWaterLimit && specularWaterLimit > 0;
    const iceAlpha = shouldFreezeWater
      ? 1
      : getIceMaskAlpha(index, width, height, iceMask, baseNoise, waterLimit);
    const iceColor = iceAlpha > 0 ? samplePaletteStops(iceStops, baseNoise) : color;
    const offset = index * 4;
    image.data[offset] = THREE.MathUtils.lerp(color[0], iceColor[0], iceAlpha);
    image.data[offset + 1] = THREE.MathUtils.lerp(color[1], iceColor[1], iceAlpha);
    image.data[offset + 2] = THREE.MathUtils.lerp(color[2], iceColor[2], iceAlpha);
    image.data[offset + 3] = 255;
  }

  context.putImageData(image, 0, 0);
}

function renderTidalSurfaceCanvas(canvas, field, surfaceStops, iceStops, moltenStops, seed) {
  const width = canvas.width;
  const height = canvas.height;
  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);

  for (let index = 0; index < field.length; index += 1) {
    const baseNoise = THREE.MathUtils.clamp(field[index], 0, 1);
    const x = index % width;
    const y = Math.floor(index / width);
    const u = x / width;
    const v = y / height;
    const baseColor = samplePaletteStops(surfaceStops, baseNoise);
    const iceColor = samplePaletteStops(iceStops, baseNoise);
    const moltenColor = samplePaletteStops(moltenStops, baseNoise);
    const iceAlpha = getTidalCenterMask(u, v, TIDAL_ICE_SPREAD, `${seed}:ice`);
    const moltenAlpha = getTidalEdgeMask(u, v, TIDAL_MOLTEN_SPREAD, `${seed}:molten`);
    const offset = index * 4;
    const iced = [
      THREE.MathUtils.lerp(baseColor[0], iceColor[0], iceAlpha),
      THREE.MathUtils.lerp(baseColor[1], iceColor[1], iceAlpha),
      THREE.MathUtils.lerp(baseColor[2], iceColor[2], iceAlpha),
    ];
    image.data[offset] = THREE.MathUtils.lerp(iced[0], moltenColor[0], moltenAlpha);
    image.data[offset + 1] = THREE.MathUtils.lerp(iced[1], moltenColor[1], moltenAlpha);
    image.data[offset + 2] = THREE.MathUtils.lerp(iced[2], moltenColor[2], moltenAlpha);
    image.data[offset + 3] = 255;
  }

  context.putImageData(image, 0, 0);
}

function renderCloudCanvas(canvas, { seed, stops, moltenStops = null, octaves = PLANET_CLOUD_OCTAVES }) {
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
      const moltenColor = moltenStops ? samplePaletteStops(moltenStops.slice(1), cloud) : null;
      const moltenAlpha = moltenStops ? getTidalEdgeMask(positiveModulo(u + 0.17, 1), v, TIDAL_MOLTEN_SPREAD, `${seed}:molten-cloud`) : 0;
      const offset = (y * width + x) * 4;
      image.data[offset] = moltenColor ? THREE.MathUtils.lerp(color[0], moltenColor[0], moltenAlpha) : color[0];
      image.data[offset + 1] = moltenColor ? THREE.MathUtils.lerp(color[1], moltenColor[1], moltenAlpha) : color[1];
      image.data[offset + 2] = moltenColor ? THREE.MathUtils.lerp(color[2], moltenColor[2], moltenAlpha) : color[2];
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
    capWidth: THREE.MathUtils.clamp(iceCaps / 100, 0, 0.55),
    isFullCoverage: iceCaps >= 55,
    macroFreq: 7 + Math.floor(random() * 7),
    macroAmp: 5 + random() * 7,
    detailFreq: 50,
    detailAmp: 3,
    seed,
  };
}

function getIceMaskAlpha(index, width, height, config, noiseValue, waterLimit) {
  if (!config.capWidth) {
    return 0;
  }
  if (config.isFullCoverage) {
    return 1;
  }

  const x = index % width;
  const y = Math.floor(index / width);
  const u = x / width;
  const v = y / height;
  const isWater = noiseValue <= waterLimit;
  const localCapWidth = Math.min(0.5, config.capWidth + (isWater ? 0 : 0.05));
  const northEdge = createPoleIceEdge(u, v, config.seed, config, localCapWidth, isWater);
  const southEdge = createPoleIceEdge(u, 1 - v, hashString(`${config.seed}:south`), config, localCapWidth, isWater);
  const edge = Math.max(northEdge, southEdge);

  if (isWater) {
    return edge >= 0 ? 1 : 0;
  }

  const softBand = Math.max(0.036, localCapWidth * 0.66);
  return THREE.MathUtils.clamp((edge + softBand) / softBand, 0, 1);
}

function createPoleIceEdge(u, distanceFromPole, seed, config, localCapWidth, isWater) {
  const normalizedPoleDistance = distanceFromPole / 0.5;
  const edgeOffset = createLayeredIceEdgeOffset(u, normalizedPoleDistance, seed, config, isWater);
  const edge = Math.max(0, localCapWidth * 1.35 + edgeOffset);
  return edge - distanceFromPole;
}

function createLayeredIceEdgeOffset(u, normalizedPoleDistance, seed, config, isWater) {
  const macroFreq = Math.max(1, Math.round(config.macroFreq ?? 2));
  const detailFreq = Math.max(1, Math.round(config.detailFreq ?? 7));
  const macroAmp = Math.max(0, (config.macroAmp ?? 9) / 100);
  const detailAmp = isWater ? Math.max(0, (config.detailAmp ?? 4) / 100) : 0;
  const macro =
    sampleTileableValueNoise(u, 0.13, macroFreq, 1, hashString(`${seed}:macro-a`)) * 0.58 +
    sampleTileableValueNoise(u, 0.49, macroFreq + 1, 1, hashString(`${seed}:macro-b`)) * 0.42;
  const macroWave = (macro - 0.5) * 2;
  let detailWave = 0;

  if (detailAmp > 0) {
    const irregularity =
      sampleTileableValueNoise(u, 0.31, detailFreq, 1, hashString(`${seed}:detail-a`)) * 0.38 +
      sampleTileableValueNoise(u, 0.67, detailFreq * 2 - 1, 1, hashString(`${seed}:detail-b`)) * 0.31 +
      sampleTileableValueNoise(u, normalizedPoleDistance + 0.17, detailFreq * 3 + 2, 5, hashString(`${seed}:detail-c`)) * 0.2 +
      sampleTileableValueNoise(u, 0.83, detailFreq * 5 + 2, 1, hashString(`${seed}:detail-d`)) * 0.11;
    detailWave = (irregularity - 0.5) * 2;
  }

  return macroWave * macroAmp + detailWave * detailAmp;
}

function getTidalCenterMask(u, v, percent, seed) {
  const width = THREE.MathUtils.clamp(percent / 100, 0, 1) * 0.5;
  if (width <= 0) {
    return 0;
  }
  if (u < 0.5) {
    const distanceFromCenter = 0.5 - u;
    const edge = Math.max(0, width + getTidalEdgeOffset(v, `${seed}:left`));
    return 1 - smoothstep(edge, edge + TIDAL_EDGE_SOFTNESS, distanceFromCenter);
  }

  const distanceFromCenter = u - 0.5;
  const edge = Math.max(0, width + getTidalEdgeOffset(v, `${seed}:right`));
  return 1 - smoothstep(edge, edge + TIDAL_EDGE_SOFTNESS, distanceFromCenter);
}

function getTidalEdgeMask(u, v, percent, seed) {
  const width = THREE.MathUtils.clamp(percent / 100, 0, 1) * 0.5;
  if (width <= 0) {
    return 0;
  }
  const leftEdge = Math.max(0, width + getTidalEdgeOffset(v, `${seed}:left`));
  const rightEdge = Math.max(0, width + getTidalEdgeOffset(v, `${seed}:right`));
  return Math.max(
    1 - smoothstep(leftEdge, leftEdge + TIDAL_EDGE_SOFTNESS, u),
    1 - smoothstep(rightEdge, rightEdge + TIDAL_EDGE_SOFTNESS, 1 - u),
  );
}

function getTidalEdgeOffset(v, seed) {
  const macro = sampleTileableValueNoise(v, 0.19, TIDAL_EDGE_MACRO_FREQ, 1, hashString(`${seed}:macro`));
  const detail = sampleTileableValueNoise(v, 0.31, TIDAL_EDGE_DETAIL_FREQ, 1, hashString(`${seed}:detail`));
  return (macro - 0.5) * 2 * TIDAL_EDGE_MACRO_AMP + (detail - 0.5) * 2 * TIDAL_EDGE_DETAIL_AMP;
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

function normalizeMoltenStops(stops) {
  return stops.map((stop) => ({ ...stop })).sort((left, right) => left.pos - right.pos);
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
      label: stop.label,
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

function samplePaletteStopInfo(stops, value) {
  if (value <= stops[0].pos) {
    return stops[0];
  }
  const last = stops[stops.length - 1];
  if (value >= last.pos) {
    return last;
  }

  for (let index = 0; index < stops.length - 1; index += 1) {
    const left = stops[index];
    const right = stops[index + 1];
    if (value <= right.pos) {
      const t = (value - left.pos) / Math.max(0.0001, right.pos - left.pos);
      return {
        label: t < 0.5 ? left.label : right.label,
        rgb: [
          THREE.MathUtils.lerp(left.rgb[0], right.rgb[0], t),
          THREE.MathUtils.lerp(left.rgb[1], right.rgb[1], t),
          THREE.MathUtils.lerp(left.rgb[2], right.rgb[2], t),
        ],
      };
    }
  }

  return last;
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
