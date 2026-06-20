import { MOON_PALETTES } from "../moonPalettes.js";
import { createPlanetTexture } from "./planetTexture.js";
import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from "../utils/color.js";
import { createRandom } from "../utils/random.js";

export const MOON_WINDOW_TEXTURE_HEIGHT = 256;

const MOON_TEXTURE_ASPECT = 2;
const MOON_PERSISTENCE = 0.5;
const MOON_SCALE_RANGE = [5, 14];
const MOON_OCTAVES = 7;
const MOON_CRATER_COUNT_RANGE = [200, 220];
const MOON_CRATER_SIZE_RANGE = [3, 6];
const MOON_CRATER_DEPTH_RANGE = [25, 35];
const MOON_CRATER_RIM_RANGE = [25, 40];
const MOLTEN_MOON_SURFACE_SCALE = 7 / 2.5;
const moonTextureCache = new Map();

export function createMoonTexture(seed, textureHeight = MOON_WINDOW_TEXTURE_HEIGHT, options = {}) {
  const paletteMode = options.paletteMode === "molten" ? "molten" : "moon";
  if (paletteMode === "molten") {
    return createPlanetTexture(seed, textureHeight, {
      textureMode: "molten",
      waterPosition: 0,
      iceCaps: 0,
      cloudAlpha: null,
      surfaceScale: MOLTEN_MOON_SURFACE_SCALE,
    });
  }

  const cacheKey = `${seed}:${textureHeight}:${paletteMode}`;
  if (moonTextureCache.has(cacheKey)) {
    return moonTextureCache.get(cacheKey);
  }

  const random = createRandom(seed);
  const palette = MOON_PALETTES[Math.floor(random() * MOON_PALETTES.length)] ?? MOON_PALETTES[0];
  const stops = createShiftedStops(normalizeMoonStops(palette?.stops ?? createDefaultMoonStops()), random);
  const width = textureHeight * MOON_TEXTURE_ASPECT;
  const height = textureHeight;
  const baseScale = Math.round(lerp(MOON_SCALE_RANGE[0], MOON_SCALE_RANGE[1], random()));
  const field = createMoonNoiseField({
    width,
    height,
    scale: baseScale,
    octaves: MOON_OCTAVES,
    seed,
    craterCount: Math.round(lerp(MOON_CRATER_COUNT_RANGE[0], MOON_CRATER_COUNT_RANGE[1], random())),
    craterSize: lerp(MOON_CRATER_SIZE_RANGE[0], MOON_CRATER_SIZE_RANGE[1], random()),
    craterDepth: lerp(MOON_CRATER_DEPTH_RANGE[0], MOON_CRATER_DEPTH_RANGE[1], random()),
    craterRim: lerp(MOON_CRATER_RIM_RANGE[0], MOON_CRATER_RIM_RANGE[1], random()),
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  renderMoonCanvas(canvas, field, stops);

  const texture = {
    url: `url(${canvas.toDataURL("image/png")})`,
    canvas,
    width,
    height,
    edgeColor: rgbToHex(samplePaletteStops(stops, field[Math.floor(height * 0.5) * width + Math.floor(width * 0.13)])),
  };
  moonTextureCache.set(cacheKey, texture);
  return texture;
}

function createMoonNoiseField({ width, height, scale, octaves, seed, craterCount, craterSize, craterDepth, craterRim }) {
  const field = new Float32Array(width * height);
  const baseSeed = hashString(seed);
  const octaveSeeds = [];
  for (let octave = 0; octave < octaves; octave += 1) {
    octaveSeeds.push((baseSeed + Math.imul(octave + 1, 0x9e3779b9)) >>> 0);
  }

  let index = 0;
  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      let sum = 0;
      let amp = 1;
      let ampSum = 0;
      let freq = scale;
      for (let octave = 0; octave < octaves; octave += 1) {
        sum += octaveNoise2D(u, v, freq, freq, octaveSeeds[octave]) * amp;
        ampSum += amp;
        amp *= MOON_PERSISTENCE;
        freq *= 2;
      }
      field[index] = sum / ampSum;
      index += 1;
    }
  }

  applyMoonCraterField(field, { width, height, seed: baseSeed, craterCount, craterSize, craterDepth, craterRim });
  return field;
}

function applyMoonCraterField(field, { width, height, seed, craterCount, craterSize, craterDepth, craterRim }) {
  const random = createRandom(`${seed}:moon-craters`);
  const sizeScale = Math.max(0.001, craterSize / 100);
  const depthScale = Math.max(0, craterDepth / 100);
  const rimScale = Math.max(0, craterRim / 100);
  const aspect = width / height;

  for (let index = 0; index < craterCount; index += 1) {
    const radius = sizeScale * (0.35 + Math.pow(random(), 1.85) * 1.75);
    const age = random();
    const crater = {
      u: random(),
      v: random(),
      radius,
      age,
      depth: depthScale * (0.95 + random() * 1.2) * (1 - age * 0.48),
      rim: rimScale * (0.55 + random() * 1.1) * (1 - age * 0.76),
      roughness: 0.035 + random() * 0.11 + age * 0.08,
      seed: (seed + Math.imul(index + 1, 0x85ebca6b)) >>> 0,
    };
    applyMoonCrater(field, width, height, aspect, crater);
  }
}

function applyMoonCrater(field, width, height, aspect, crater) {
  const influenceRadius = crater.radius * 1.48;
  const influenceX = influenceRadius / Math.max(0.0001, aspect);
  const minY = Math.max(0, Math.floor((crater.v - influenceRadius) * height));
  const maxY = Math.min(height - 1, Math.ceil((crater.v + influenceRadius) * height));
  const minX = Math.floor((crater.u - influenceX) * width);
  const maxX = Math.ceil((crater.u + influenceX) * width);

  for (let y = minY; y <= maxY; y += 1) {
    const v = y / height;
    for (let rawX = minX; rawX <= maxX; rawX += 1) {
      const x = positiveModuloInt(rawX, width);
      const u = x / width;
      const dx = wrappedSignedDistance(u, crater.u) * aspect;
      const dy = v - crater.v;
      const delta = sampleMoonCraterDelta(u, v, dx, dy, crater);
      if (delta === 0) {
        continue;
      }
      const offset = y * width + x;
      field[offset] = clamp01(field[offset] + delta);
    }
  }
}

function sampleMoonCraterDelta(u, v, dx, dy, crater) {
  const distance = Math.hypot(dx, dy);
  const radius = crater.radius;
  if (distance > radius * 1.48) {
    return 0;
  }

  const angle = Math.atan2(dy, dx);
  const edgeNoise = craterAngularNoise(angle, crater.seed);
  const visibilityNoise = craterAngularNoise(angle + 1.73, crater.seed ^ 0xc2b2ae35);
  const erodedRadius = radius * (1 + (edgeNoise - 0.5) * 2 * crater.roughness);
  const t = distance / Math.max(0.0001, erodedRadius);
  const ageSoftness = 0.09 + crater.age * 0.16;
  const floorMask = 1 - smoothstep(0.18, 0.92 + ageSoftness, t);
  const floorRoughness = (octaveNoise2D(u, v, 38, 19, crater.seed ^ 0x27d4eb2f) - 0.5) * crater.depth * 0.16;
  const bowl = floorMask * (-crater.depth + floorRoughness);
  const wallDrop = (smoothstep(0.58, 0.92, t) - smoothstep(0.92, 1.08, t)) * -crater.depth * 0.22;
  const rimBreakup = smoothstep(0.18 + crater.age * 0.42, 0.95, visibilityNoise);
  const rimProfile = Math.exp(-Math.pow((t - 1) / (0.07 + crater.age * 0.08), 2));
  const rim = rimProfile * crater.rim * rimBreakup;
  const ejecta = (1 - smoothstep(1.0, 1.48, t)) * smoothstep(0.94, 1.06, t) * crater.rim * 0.16 * (1 - crater.age);
  return bowl + wallDrop + rim + ejecta;
}

function renderMoonCanvas(canvas, field, stops) {
  const width = canvas.width;
  const height = canvas.height;
  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);
  for (let index = 0; index < field.length; index += 1) {
    const color = samplePaletteStops(stops, field[index]);
    const offset = index * 4;
    image.data[offset] = color[0];
    image.data[offset + 1] = color[1];
    image.data[offset + 2] = color[2];
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

function normalizeMoonStops(stops) {
  const defaults = createDefaultMoonStops();
  const normalized = defaults.map((defaultStop, index) => ({
    ...defaultStop,
    ...(stops[index] ?? {}),
    pos: Number.isFinite(stops[index]?.pos) ? clamp01(stops[index].pos) : defaultStop.pos,
  }));
  normalized[0].pos = 0;
  for (let index = 1; index < normalized.length; index += 1) {
    normalized[index].pos = Math.max(normalized[index - 1].pos, clamp01(normalized[index].pos));
  }
  normalized[normalized.length - 1].pos = 1;
  return normalized;
}

function createDefaultMoonStops() {
  const labels = ["basins", "maria", "regolith", "craters", "highlands", "peaks"];
  const colors = ["#2f3136", "#55565b", "#818085", "#a9a7a2", "#c9c6bd", "#ece8dd"];
  return labels.map((label, index) => ({
    pos: index / (labels.length - 1),
    color: colors[index],
    label,
    hueShift: [-3, 3],
    brightnessShift: [-5, 5],
  }));
}

function createShiftedStops(stops, random) {
  return stops.map((stop) => ({
    ...stop,
    color: shiftedColor(stop, random),
  }));
}

function shiftedColor(stop, random) {
  const hueRange = stop.hueShift ?? [0, 0];
  const brightnessRange = stop.brightnessShift ?? [0, 0];
  const hueShift = hueRange[0] + random() * (hueRange[1] - hueRange[0]);
  const brightnessShift = brightnessRange[0] + random() * (brightnessRange[1] - brightnessRange[0]);
  const hsl = rgbToHsl(hexToRgb(stop.color));
  hsl[0] += hueShift;
  hsl[2] = Math.max(0, Math.min(100, hsl[2] + brightnessShift));
  return rgbToHex(hslToRgb(hsl));
}

function samplePaletteStops(stops, value) {
  const sorted = stops.slice().sort((a, b) => a.pos - b.pos);
  if (value <= sorted[0].pos) {
    return hexToRgb(sorted[0].color);
  }
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    if (value <= next.pos) {
      const span = next.pos - current.pos || 1;
      const amount = (value - current.pos) / span;
      const from = hexToRgb(current.color);
      const to = hexToRgb(next.color);
      return [
        from[0] + (to[0] - from[0]) * amount,
        from[1] + (to[1] - from[1]) * amount,
        from[2] + (to[2] - from[2]) * amount,
      ];
    }
  }
  return hexToRgb(sorted[sorted.length - 1].color);
}

function octaveNoise2D(u, v, freqX, freqY, octaveSeed) {
  const gx = positiveModulo(u, 1) * freqX;
  const gy = positiveModulo(v, 1) * freqY;
  const fx = Math.floor(gx);
  const fy = Math.floor(gy);
  const tx = smooth(gx - fx);
  const ty = smooth(gy - fy);
  const x0 = positiveModuloInt(fx, freqX);
  const y0 = positiveModuloInt(fy, freqY);
  const x1 = (x0 + 1) % freqX;
  const y1 = (y0 + 1) % freqY;
  const v00 = cornerHash(octaveSeed, x0, y0);
  const v10 = cornerHash(octaveSeed, x1, y0);
  const v01 = cornerHash(octaveSeed, x0, y1);
  const v11 = cornerHash(octaveSeed, x1, y1);
  const a = v00 + (v10 - v00) * tx;
  const b = v01 + (v11 - v01) * tx;
  return a + (b - a) * ty;
}

function craterAngularNoise(angle, seed) {
  const normalized = positiveModulo(angle / (Math.PI * 2), 1);
  return octaveNoise2D(normalized, 0.37, 9, 1, seed) * 0.55
    + octaveNoise2D(normalized, 0.71, 17, 1, seed ^ 0x9e3779b9) * 0.3
    + octaveNoise2D(normalized, 0.13, 31, 1, seed ^ 0x165667b1) * 0.15;
}

function cornerHash(octaveSeed, x, y) {
  let hash = (octaveSeed ^ Math.imul(x + 1, 2654435761) ^ Math.imul(y + 1, 2246822519)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 15), 2246822519);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489917);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

function hashString(value) {
  let hash = 1779033703 ^ value.length;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return hash >>> 0;
}

function smooth(value) {
  return value * value * (3 - 2 * value);
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / (edge1 - edge0 || 1));
  return smooth(t);
}

function wrappedSignedDistance(a, b) {
  let delta = a - b;
  if (delta > 0.5) delta -= 1;
  if (delta < -0.5) delta += 1;
  return delta;
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function positiveModuloInt(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}
