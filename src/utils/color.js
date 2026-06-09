import * as THREE from "three";

export function normalizeHexColor(color) {
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

export function hexToHsv(color) {
  const normalized = normalizeHexColor(color).replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let h = 0;

  if (delta) {
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

export function hsvToHex({ h, s, v }) {
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

export function hslToHex(h, s, l) {
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

export function rgbToHex([red, green, blue]) {
  return `#${[red, green, blue]
    .map((channel) => Math.round(Math.max(0, Math.min(255, channel))).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function hexToRgb(color) {
  const normalized = normalizeHexColor(color).replace("#", "");
  const value = Number.parseInt(normalized, 16);

  return [
    (value >> 16) & 255,
    (value >> 8) & 255,
    value & 255,
  ];
}

export function rgbToHsl([red, green, blue]) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return [0, 0, lightness * 100];
  }

  const saturation = lightness > 0.5
    ? delta / (2 - max - min)
    : delta / (max + min);
  const hue = max === r
    ? ((g - b) / delta + (g < b ? 6 : 0)) * 60
    : max === g
      ? ((b - r) / delta + 2) * 60
      : ((r - g) / delta + 4) * 60;

  return [hue, saturation * 100, lightness * 100];
}

export function hslToRgb([hue, saturation, lightness]) {
  const h = (((hue % 360) + 360) % 360) / 360;
  const s = saturation / 100;
  const l = lightness / 100;

  if (s === 0) {
    return [l * 255, l * 255, l * 255];
  }

  const hueToRgb = (p, q, t) => {
    let nextT = t;
    if (nextT < 0) nextT += 1;
    if (nextT > 1) nextT -= 1;
    if (nextT < 1 / 6) return p + (q - p) * 6 * nextT;
    if (nextT < 1 / 2) return q;
    if (nextT < 2 / 3) return p + (q - p) * (2 / 3 - nextT) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return [
    hueToRgb(p, q, h + 1 / 3) * 255,
    hueToRgb(p, q, h) * 255,
    hueToRgb(p, q, h - 1 / 3) * 255,
  ];
}

export function hexToRgba(color, alpha) {
  const normalized = normalizeHexColor(color).replace("#", "");
  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red},${green},${blue},${alpha})`;
}

export function lightenHexColor(color, amount = 0.5) {
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
