import { createRandom } from "../utils/random.js";

const ABSOLUTE_ZERO_CELSIUS = -272;
const BASE_DAY_CYCLE_SECONDS = 24;
const REGULAR_NIGHT_MIN_DROP = 4;
const REGULAR_NIGHT_DROP_RANGE = 116;
const WATER_THERMAL_INERTIA = 0.45;
const VACUUM_WATER_THERMAL_INERTIA = WATER_THERMAL_INERTIA / 3;
const TIDAL_WATER_TRANSPORT = 0.15;
const TIDAL_MAX_HEAT_TRANSPORT = 0.5;

const ATMOSPHERE_NIGHT_DROP_FACTORS = Object.freeze({
  "THIN ATMOSPHERE": 0.85,
  ATMOSPHERE: 0.55,
  "DENSE ATMOSPHERE": 0.3,
});

const TIDAL_HEAT_TRANSPORT = Object.freeze({
  "THIN ATMOSPHERE": 0.08,
  ATMOSPHERE: 0.18,
  "DENSE ATMOSPHERE": 0.32,
});

export function createPlanetTemperatureProfile({
  seed,
  dayTemperature,
  orbitPosition,
  atmosphere,
  hasWater,
  waterPosition,
  dayCycleSeconds,
  tidallyLocked,
}) {
  if (!Number.isFinite(dayTemperature)) {
    return {
      dayTemperature: null,
      nightTemperature: null,
      temperatureDelta: null,
      heatTransport: null,
    };
  }

  const random = createRandom(String(seed ?? "planet-night-temperature"));
  const seededVariation = lerp(0.9, 1.1, random());
  return tidallyLocked
    ? createTidallyLockedProfile({
      dayTemperature,
      atmosphere,
      hasWater,
      waterPosition,
      seededVariation,
    })
    : createRegularProfile({
      dayTemperature,
      orbitPosition,
      atmosphere,
      hasWater,
      waterPosition,
      dayCycleSeconds,
      seededVariation,
    });
}

export function createStaticTemperatureProfile(dayTemperature) {
  const normalizedTemperature = Number.isFinite(dayTemperature)
    ? Math.round(dayTemperature)
    : null;
  return {
    dayTemperature: normalizedTemperature,
    nightTemperature: normalizedTemperature,
    temperatureDelta: normalizedTemperature === null ? null : 0,
    heatTransport: null,
  };
}

function createRegularProfile({
  dayTemperature,
  orbitPosition,
  atmosphere,
  hasWater,
  waterPosition,
  dayCycleSeconds,
  seededVariation,
}) {
  const normalizedOrbit = clamp(orbitPosition, 0, 1);
  const proximity = 1 - normalizedOrbit;
  const baseDrop = REGULAR_NIGHT_MIN_DROP
    + REGULAR_NIGHT_DROP_RANGE * proximity ** 1.6;
  const atmosphereFactor = ATMOSPHERE_NIGHT_DROP_FACTORS[atmosphere] ?? 1.25;
  const normalizedWater = hasWater ? clamp(waterPosition, 0, 1) : 0;
  const waterInertia = atmosphere
    ? WATER_THERMAL_INERTIA
    : VACUUM_WATER_THERMAL_INERTIA;
  const waterFactor = 1 - waterInertia * normalizedWater;
  const normalizedDayCycle = Number.isFinite(dayCycleSeconds) && dayCycleSeconds > 0
    ? dayCycleSeconds
    : BASE_DAY_CYCLE_SECONDS;
  const dayCycleFactor = clamp(
    (normalizedDayCycle / BASE_DAY_CYCLE_SECONDS) ** 0.2,
    0.7,
    1.5,
  );
  const rawDrop = baseDrop
    * atmosphereFactor
    * waterFactor
    * dayCycleFactor
    * seededVariation;
  const nightTemperature = Math.round(Math.max(
    ABSOLUTE_ZERO_CELSIUS,
    dayTemperature - rawDrop,
  ));
  const normalizedDayTemperature = Math.round(dayTemperature);

  return {
    dayTemperature: normalizedDayTemperature,
    nightTemperature,
    temperatureDelta: Math.max(0, normalizedDayTemperature - nightTemperature),
    heatTransport: null,
  };
}

function createTidallyLockedProfile({
  dayTemperature,
  atmosphere,
  hasWater,
  waterPosition,
  seededVariation,
}) {
  const atmosphereTransport = TIDAL_HEAT_TRANSPORT[atmosphere] ?? 0.02;
  const normalizedWater = hasWater && atmosphere
    ? clamp(waterPosition, 0, 1)
    : 0;
  const heatTransport = clamp(
    (atmosphereTransport + TIDAL_WATER_TRANSPORT * normalizedWater) * seededVariation,
    0,
    TIDAL_MAX_HEAT_TRANSPORT,
  );
  const availableHeat = Math.max(0, dayTemperature - ABSOLUTE_ZERO_CELSIUS);
  const nightTemperature = Math.round(
    ABSOLUTE_ZERO_CELSIUS + availableHeat * heatTransport,
  );
  const normalizedDayTemperature = Math.round(dayTemperature);
  const normalizedNightTemperature = Math.min(
    normalizedDayTemperature,
    nightTemperature,
  );

  return {
    dayTemperature: normalizedDayTemperature,
    nightTemperature: normalizedNightTemperature,
    temperatureDelta: Math.max(0, normalizedDayTemperature - normalizedNightTemperature),
    heatTransport: Number(heatTransport.toFixed(4)),
  };
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function lerp(min, max, amount) {
  return min + (max - min) * amount;
}
