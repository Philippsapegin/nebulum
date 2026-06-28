import * as THREE from "three";

const CANVAS_CSS_URL_CACHE_NAME = "nebulum-generated-textures-v1";
const MAX_IDLE_CANVAS_TEXTURES = 48;
const cssUrlsByCanvas = new WeakMap();
const cssUrlsByKey = new Map();
const cssUrlEntries = new Set();
const textureEntriesByCanvas = new WeakMap();
const textureEntries = new Set();

export function createCanvasCssUrl(canvas, cacheKey = null) {
  if (!canvas) {
    return null;
  }

  if (cacheKey && cssUrlsByKey.has(cacheKey)) {
    return cssUrlsByKey.get(cacheKey).cssUrl;
  }

  const cachedByCanvas = cssUrlsByCanvas.get(canvas);
  if (cachedByCanvas) {
    if (cacheKey) {
      cssUrlsByKey.set(cacheKey, cachedByCanvas);
    }
    return cachedByCanvas.cssUrl;
  }

  const dataUrl = canvas.toDataURL("image/png");
  const blob = dataUrlToBlob(dataUrl);
  const objectUrl = URL.createObjectURL(blob);
  const entry = {
    blob,
    cssUrl: `url("${objectUrl}")`,
    objectUrl,
  };

  cssUrlsByCanvas.set(canvas, entry);
  cssUrlEntries.add(entry);
  if (cacheKey) {
    cssUrlsByKey.set(cacheKey, entry);
    persistCanvasBlob(cacheKey, blob);
  }

  return entry.cssUrl;
}

export function retainCanvasTexture(canvas, renderer, options = {}) {
  if (!canvas) {
    return null;
  }

  const key = createCanvasTextureKey(options);
  let entries = textureEntriesByCanvas.get(canvas);
  if (!entries) {
    entries = new Map();
    textureEntriesByCanvas.set(canvas, entries);
  }

  let entry = entries.get(key);
  if (!entry) {
    const texture = new THREE.CanvasTexture(canvas);
    configureCanvasTexture(texture, renderer, options);
    entry = {
      canvas,
      entries,
      key,
      keepIdle: options.keepIdle !== false,
      refCount: 0,
      texture,
    };
    entries.set(key, entry);
    textureEntries.add(entry);
  } else {
    configureCanvasTexture(entry.texture, renderer, options);
  }

  entry.refCount += 1;
  entry.lastUsedAt = performance.now();
  return entry;
}

export function releaseCanvasTexture(entry) {
  if (!entry) {
    return;
  }

  entry.refCount = Math.max(0, entry.refCount - 1);
  entry.lastUsedAt = performance.now();

  if (!entry.keepIdle) {
    disposeCanvasTextureEntry(entry);
    return;
  }

  pruneIdleCanvasTextures();
}

export function getRetainedCanvasTexture(entry) {
  return entry?.texture ?? null;
}

export async function clearTextureRuntimeCache() {
  for (const entry of Array.from(textureEntries)) {
    disposeCanvasTextureEntry(entry);
  }

  for (const entry of cssUrlEntries) {
    URL.revokeObjectURL(entry.objectUrl);
  }
  cssUrlEntries.clear();
  cssUrlsByKey.clear();

  if (!("caches" in window)) {
    return false;
  }

  try {
    return await window.caches.delete(CANVAS_CSS_URL_CACHE_NAME);
  } catch {
    return false;
  }
}

function configureCanvasTexture(texture, renderer, options) {
  texture.colorSpace = options.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  texture.wrapS = options.wrapS ?? THREE.RepeatWrapping;
  texture.wrapT = options.wrapT ?? THREE.ClampToEdgeWrapping;
  texture.offset.set(0, 0);
  texture.repeat.set(1, 1);
  texture.center.set(0, 0);
  texture.rotation = 0;
  const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;
  texture.anisotropy = Math.max(
    texture.anisotropy || 1,
    Math.min(options.maxAnisotropy ?? 8, maxAnisotropy),
  );
  texture.needsUpdate = true;
}

function createCanvasTextureKey(options) {
  const colorSpace = options.srgb === false ? "linear" : "srgb";
  const wrapS = options.wrapS ?? THREE.RepeatWrapping;
  const wrapT = options.wrapT ?? THREE.ClampToEdgeWrapping;
  return `${colorSpace}:${wrapS}:${wrapT}:${options.maxAnisotropy ?? 8}`;
}

function pruneIdleCanvasTextures() {
  const idleEntries = Array.from(textureEntries)
    .filter((entry) => entry.refCount === 0)
    .sort((left, right) => (left.lastUsedAt ?? 0) - (right.lastUsedAt ?? 0));

  while (idleEntries.length > MAX_IDLE_CANVAS_TEXTURES) {
    disposeCanvasTextureEntry(idleEntries.shift());
  }
}

function disposeCanvasTextureEntry(entry) {
  if (!entry || !textureEntries.has(entry)) {
    return;
  }

  entry.texture.dispose();
  entry.entries.delete(entry.key);
  textureEntries.delete(entry);
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

function persistCanvasBlob(cacheKey, blob) {
  if (!("caches" in window) || !window.isSecureContext) {
    return;
  }

  const url = new URL(`/__nebulum_texture_cache__/${encodeURIComponent(cacheKey)}.png`, window.location.origin);
  const response = new Response(blob, {
    headers: {
      "Cache-Control": "max-age=31536000, immutable",
      "Content-Type": "image/png",
    },
  });

  window.caches
    .open(CANVAS_CSS_URL_CACHE_NAME)
    .then((cache) => cache.put(url.toString(), response))
    .catch(() => {});
}
