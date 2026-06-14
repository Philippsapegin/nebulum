export const NODE_COUNT = 42;
export const LINK_DISTANCE = 2.35;
export const MAX_LINKS_PER_NODE = 4;
export const MAX_SELECTION_POINTS = 48;
export const MAX_SELECTION_SEGMENTS = 128;
export const MAX_SELECTION_FADING_SEGMENTS = 24;

export const STAR_TYPES = [
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
    size: [0.018, 0.021],
  },
  {
    type: "Strange Star",
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

export const ZONE_DATA = {
  "Red Dwarf":          { tidalLock: 5,  hzInner: 2,  hzOuter: 12 },
  "Orange Dwarf":       { tidalLock: 8,  hzInner: 4,  hzOuter: 15 },
  "Orange Star":        { tidalLock: 10, hzInner: 8,  hzOuter: 21 },
  "Yellow Star":        { tidalLock: 12, hzInner: 12, hzOuter: 31 },
  "Yellow-White Star":  { tidalLock: 15, hzInner: 15, hzOuter: 46 },
  "White Star":         { tidalLock: 18, hzInner: 20, hzOuter: 56 },
  "Blue Star":          { tidalLock: 24, hzInner: 28, hzOuter: 75 },
  "Blue Giant":         { tidalLock: 45, hzInner: 38, hzOuter: 81 },
  "Red Giant":          { tidalLock: 30, hzInner: 20, hzOuter: 47 },
  "Blue Supergiant":    { tidalLock: 75, hzInner: 56, hzOuter: 100 },
  "Red Supergiant":     { tidalLock: 60, hzInner: 30, hzOuter: 56 },
  "Neutron Star":       { tidalLock: 8,  hzInner: 5,  hzOuter: 12 },
  "Strange Star":       { tidalLock: 30, hzInner: 56, hzOuter: 88 },
  "Black Hole":         { tidalLock: 95, hzInner: null, hzOuter: null },
};

export const PLANET_SIZE_NAMES = {
  "PLANET": ["tiny", "small", "", "large", "mega", "super", "super type 2", "super type 3", "super type 4", "super type 5"],
  "GAS GIANT": ["anomalous", "anomalous", "anomalous", "tiny", "small", "", "", "", "", ""],
};

export const MOON_SIZE_NAMES = ["small moon", "moon", "big moon"];

export const GRAVITY_BASE_VALUES = {
  "GAS GIANT": [0.1, 0.2, 0.5, 0.8, 1, 2, 3, 4, 5, 6],
  "PLANET": [0.6, 0.8, 1, 1.5, 2, 3, 5, 8, 10, 12],
  "MOON": [0.1, 0.4, 0.8],
};

// Planet detail window stage geometry (must match styles.css .planet-window layout).
export const PLANET_STAGE_WIDTH = 292;
export const PLANET_STAGE_HEIGHT = 380;
export const PLANET_STAGE_CONTENT_RADIUS = 80;

export const MUSIC_TRACKS = [
  "1. Nebulum.mp3",
  "2. Afar from home.mp3",
  "3. Defining the rays.mp3",
  "4. Sparkling horizon.mp3",
  "5. Weight of light.mp3",
  "6. Finite but countless.mp3",
  "7. Sagan was small.mp3",
  "8. Glacial Starch.mp3",
  "9. Neutron Lullaby.mp3",
  "10. TON 618.mp3",
  "11. Under the skyes.mp3",
  "12. Vast Nothingness.mp3",
  "13. Orbit around the end.mp3",
];
