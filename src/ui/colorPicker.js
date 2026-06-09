import * as THREE from "three";
import { hexToHsv, hsvToHex, normalizeHexColor } from "../utils/color.js";

let colorPicker = null;

export function openColorPicker(anchor, color, onChange) {
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
