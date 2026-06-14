import * as THREE from "three";
import { createRandom } from "../utils/random.js";

const PLANET_BASE_ROTATION_PERIOD = 24;
const PLANET_MIN_ROTATION_PERIOD = 1;
const PLANET_MAX_ROTATION_PERIOD = 500;
const PLANET_ROTATION_SIGMA_SPAN = 3;

export function createPlanetRotationState({ seed, systemId, planetName, tidallyLocked }) {
  const random = createRandom(`${seed}:planet-screen-rotation:${systemId}:${planetName}`);
  const initialOffset = random();
  if (tidallyLocked) {
    return {
      initialOffset,
      period: Infinity,
      turnsPerSecond: 0,
    };
  }

  const period = getPlanetRotationPeriod(random);
  return {
    initialOffset,
    period,
    turnsPerSecond: 1 / period,
  };
}

export function getPlanetRotationPhase(rotation, elapsedSeconds) {
  if (!rotation || rotation.turnsPerSecond === 0) {
    return rotation?.initialOffset ?? 0;
  }

  return positiveModulo(rotation.initialOffset + elapsedSeconds * rotation.turnsPerSecond, 1);
}

function getPlanetRotationPeriod(random) {
  const normalValue = sampleStandardNormal(random);
  const leftSigma = (PLANET_BASE_ROTATION_PERIOD - PLANET_MIN_ROTATION_PERIOD) /
    PLANET_ROTATION_SIGMA_SPAN;
  const rightSigma = (PLANET_MAX_ROTATION_PERIOD - PLANET_BASE_ROTATION_PERIOD) /
    PLANET_ROTATION_SIGMA_SPAN;
  const sigma = normalValue < 0 ? leftSigma : rightSigma;

  return THREE.MathUtils.clamp(
    PLANET_BASE_ROTATION_PERIOD + normalValue * sigma,
    PLANET_MIN_ROTATION_PERIOD,
    PLANET_MAX_ROTATION_PERIOD,
  );
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function sampleStandardNormal(random) {
  const u1 = Math.max(Number.EPSILON, random());
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
