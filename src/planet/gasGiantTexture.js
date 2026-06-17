import * as THREE from "three";
import { GAS_GIANT_PALETTES } from "../gasGiantPalettes.js";
import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from "../utils/color.js";
import { createRandom } from "../utils/random.js";

export const GAS_GIANT_SYSTEM_TEXTURE_HEIGHT = 32;
export const GAS_GIANT_WINDOW_TEXTURE_HEIGHT = 1024;
const GAS_GIANT_TEXTURE_ASPECT = 2;
export const GAS_GIANT_OCTAVES = 4;
const GAS_GIANT_PERSISTENCE = 0.5;
const gasGiantTextureCache = new Map();

export function createGasGiantTexture(seed, textureHeight = GAS_GIANT_SYSTEM_TEXTURE_HEIGHT, octaves = GAS_GIANT_OCTAVES) {
  const cacheKey = `${seed}:${textureHeight}:${octaves}`;
  if (gasGiantTextureCache.has(cacheKey)) {
    return gasGiantTextureCache.get(cacheKey);
  }

  const random = createRandom(seed);
  const palette = GAS_GIANT_PALETTES[Math.floor(random() * GAS_GIANT_PALETTES.length)] ?? GAS_GIANT_PALETTES[0];
  const scale = 10 + Math.floor(random() * 15);
  const stretch = 3 + random() * 6;
  const width = textureHeight * GAS_GIANT_TEXTURE_ASPECT;
  const height = textureHeight;
  const field = createGasGiantNoiseField({ width, height, scale, stretch, random, octaves });
  const colors = createShiftedGasGiantStops(palette, random);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);
  for (let index = 0; index < field.length; index += 1) {
    const color = samplePaletteStops(colors, field[index]);
    const offset = index * 4;
    image.data[offset] = color[0];
    image.data[offset + 1] = color[1];
    image.data[offset + 2] = color[2];
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);

  const cloudCanvas = document.createElement("canvas");
  cloudCanvas.width = width;
  cloudCanvas.height = height;
  renderGasGiantCloudCanvas(cloudCanvas, field, colors);

  const texture = {
    url: `url(${canvas.toDataURL("image/png")})`,
    canvas,
    cloudCanvas,
    width,
    height,
    edgeColor: rgbToHex(samplePaletteStops(
      colors,
      field[Math.floor(height * 0.5) * width + Math.floor(width * 0.13)],
    )),
  };
  gasGiantTextureCache.set(cacheKey, texture);
  return texture;
}

function renderGasGiantCloudCanvas(canvas, field, colors) {
  const context = canvas.getContext("2d");
  const image = context.createImageData(canvas.width, canvas.height);
  const alphaRange = getGasGiantCloudAlphaRange(colors);

  for (let index = 0; index < field.length; index += 1) {
    const value = field[index];
    const color = samplePaletteStops(colors, value);
    const alpha = getGasGiantCloudAlpha(value, alphaRange);
    const offset = index * 4;
    image.data[offset] = color[0];
    image.data[offset + 1] = color[1];
    image.data[offset + 2] = color[2];
    image.data[offset + 3] = Math.round(alpha * 255);
  }

  context.putImageData(image, 0, 0);
}

function getGasGiantCloudAlphaRange(colors) {
  if (colors.length < 4) {
    return { start: 0.25, end: 0.75, feather: 0.08 };
  }

  const firstBoundary = (colors[0].pos + colors[1].pos) * 0.5;
  const lastOpaqueIndex = Math.max(1, colors.length - 3);
  const lastBoundary = (colors[lastOpaqueIndex].pos + colors[lastOpaqueIndex + 1].pos) * 0.5;
  return {
    start: firstBoundary,
    end: Math.max(firstBoundary, lastBoundary),
    feather: Math.max(0.025, (lastBoundary - firstBoundary) * 0.18),
  };
}

function getGasGiantCloudAlpha(value, { start, end, feather }) {
  const fadeIn = smoothstep(start - feather, start + feather, value);
  const fadeOut = 1 - smoothstep(end - feather, end + feather, value);
  return THREE.MathUtils.clamp(fadeIn * fadeOut * 0.72, 0, 1);
}

function createGasGiantNoiseField({ width, height, scale, stretch, random, octaves = GAS_GIANT_OCTAVES }) {
  const field = new Float32Array(width * height);
  const octaveSeeds = Array.from({ length: octaves }, () => Math.floor(random() * 0xffffffff));
  let offset = 0;

  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      let sum = 0;
      let amp = 1;
      let ampSum = 0;
      let freqY = scale;
      let freqX = Math.max(1, Math.round(scale / stretch));
      for (let octave = 0; octave < octaves; octave += 1) {
        sum += sampleTileableValueNoise(u, v, freqX, freqY, octaveSeeds[octave]) * amp;
        ampSum += amp;
        amp *= GAS_GIANT_PERSISTENCE;
        freqX = Math.max(1, freqX * 2);
        freqY *= 2;
      }
      field[offset] = sum / ampSum;
      offset += 1;
    }
  }

  return field;
}

function sampleTileableValueNoise(u, v, freqX, freqY, seed) {
  const gx = u * freqX;
  const gy = v * freqY;
  const fx = Math.floor(gx);
  const fy = Math.floor(gy);
  const tx = smoothNoiseStep(gx - fx);
  const ty = smoothNoiseStep(gy - fy);
  const x0 = ((fx % freqX) + freqX) % freqX;
  const y0 = ((fy % freqY) + freqY) % freqY;
  const x1 = (x0 + 1) % freqX;
  const y1 = (y0 + 1) % freqY;
  const a = gasGiantCornerHash(seed, x0, y0);
  const b = gasGiantCornerHash(seed, x1, y0);
  const c = gasGiantCornerHash(seed, x0, y1);
  const d = gasGiantCornerHash(seed, x1, y1);
  const top = THREE.MathUtils.lerp(a, b, tx);
  const bottom = THREE.MathUtils.lerp(c, d, tx);
  return THREE.MathUtils.lerp(top, bottom, ty);
}

function smoothNoiseStep(value) {
  return value * value * (3 - 2 * value);
}

function smoothstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function gasGiantCornerHash(seed, x, y) {
  let hash = (seed ^ Math.imul(x + 1, 2654435761) ^ Math.imul(y + 1, 2246822519)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 15), 2246822519);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489917);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

function createShiftedGasGiantStops(palette, random) {
  return palette.stops
    .map((stop) => ({
      pos: stop.pos,
      rgb: hexToRgb(applyGasGiantColorShift(stop, random)),
    }))
    .sort((a, b) => a.pos - b.pos);
}

function applyGasGiantColorShift(stop, random) {
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
