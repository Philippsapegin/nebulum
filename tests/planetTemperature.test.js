import test from "node:test";
import assert from "node:assert/strict";
import {
  createPlanetTemperatureProfile,
  createStaticTemperatureProfile,
} from "../src/planet/temperature.js";

const basePlanet = {
  seed: "temperature-test",
  dayTemperature: 50,
  orbitPosition: 0.5,
  atmosphere: "ATMOSPHERE",
  hasWater: true,
  waterPosition: 0.5,
  dayCycleSeconds: 24,
  tidallyLocked: false,
};

function createProfile(overrides = {}) {
  return createPlanetTemperatureProfile({
    ...basePlanet,
    ...overrides,
  });
}

test("night temperature generation is deterministic", () => {
  assert.deepEqual(createProfile(), createProfile());
});

test("regular planets cool less far from the star", () => {
  const near = createProfile({ orbitPosition: 0 });
  const far = createProfile({ orbitPosition: 1 });
  assert.ok(near.temperatureDelta > far.temperatureDelta);
});

test("atmosphere and water reduce regular night cooling", () => {
  const vacuumDry = createProfile({
    atmosphere: null,
    hasWater: false,
    waterPosition: 0,
  });
  const denseDry = createProfile({
    atmosphere: "DENSE ATMOSPHERE",
    hasWater: false,
    waterPosition: 0,
  });
  const denseWet = createProfile({
    atmosphere: "DENSE ATMOSPHERE",
    hasWater: true,
    waterPosition: 0.7,
  });

  assert.ok(vacuumDry.temperatureDelta > denseDry.temperatureDelta);
  assert.ok(denseDry.temperatureDelta > denseWet.temperatureDelta);
});

test("longer days produce a larger regular temperature drop", () => {
  const shortDay = createProfile({ dayCycleSeconds: 1 });
  const longDay = createProfile({ dayCycleSeconds: 500 });
  assert.ok(longDay.temperatureDelta > shortDay.temperatureDelta);
});

test("tidally locked nights use heat transport instead of rotation", () => {
  const vacuum = createProfile({
    tidallyLocked: true,
    atmosphere: null,
    hasWater: false,
    waterPosition: 0,
    dayCycleSeconds: Infinity,
  });
  const denseWet = createProfile({
    tidallyLocked: true,
    atmosphere: "DENSE ATMOSPHERE",
    hasWater: true,
    waterPosition: 0.6,
    dayCycleSeconds: Infinity,
  });

  assert.ok(vacuum.nightTemperature <= -260);
  assert.ok(denseWet.nightTemperature > vacuum.nightTemperature);
  assert.ok(denseWet.temperatureDelta > 100);
  assert.ok(denseWet.heatTransport > vacuum.heatTransport);
});

test("temperature never falls below the project absolute-zero floor", () => {
  const profile = createProfile({
    dayTemperature: -270,
    atmosphere: null,
    hasWater: false,
    orbitPosition: 0,
  });
  assert.equal(profile.nightTemperature, -272);
});

test("static profiles preserve unsupported body temperatures", () => {
  assert.deepEqual(createStaticTemperatureProfile(35), {
    dayTemperature: 35,
    nightTemperature: 35,
    temperatureDelta: 0,
    heatTransport: null,
  });
});
