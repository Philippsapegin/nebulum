import test from "node:test";
import assert from "node:assert/strict";
import {
  PLANET_BUILDING_SKINS,
  PLANET_CLASSIFICATION_STATES,
  classifyPlanet,
} from "../src/planet/classification.js";

const atmosphere = "ATMOSPHERE";

function classify(overrides = {}) {
  return classifyPlanet({
    kind: "PLANET",
    temperature: 45,
    atmosphere,
    hasWater: true,
    waterPosition: 0.45,
    tidallyLocked: false,
    textureMode: "default",
    ...overrides,
  });
}

test("classifies temperate wet planets as GRAIL I", () => {
  assert.equal(classify().label, "GRAIL I");
  assert.equal(classify({ waterPosition: 0.5 }).label, "FLOODED GRAIL I");
  assert.equal(classify({ waterPosition: 0.9 }).label, "OCEANIC GRAIL I");
});

test("combines temperature and low-water modifiers for GRAIL II", () => {
  assert.equal(
    classify({ temperature: -20, waterPosition: 0.35 }).label,
    "ICY CONTINENTAL GRAIL II",
  );
  assert.equal(
    classify({ temperature: 40, waterPosition: 0.05 }).label,
    "ARID GRAIL II",
  );
  assert.equal(
    classify({ temperature: 85, waterPosition: 0.55 }).label,
    "HOT GRAIL II",
  );
});

test("classifies atmospheric planets without WATER as GRAIL III", () => {
  assert.equal(
    classify({ temperature: -75, hasWater: false, waterPosition: 0 }).label,
    "ICY GRAIL III",
  );
  assert.equal(
    classify({ temperature: 45, hasWater: false, waterPosition: 0 }).label,
    "DESERT GRAIL III",
  );
});

test("marks atmosphere-free planets unhabitable and selects sealed buildings", () => {
  const result = classify({
    temperature: 10,
    atmosphere: null,
  });

  assert.equal(result.label, "BARREN UNHABITABLE");
  assert.equal(result.buildingSkin, PLANET_BUILDING_SKINS.SEALED);
  assert.equal(result.requiresSealedBuildings, true);
});

test("classifies temperatures outside the GRAIL range", () => {
  assert.equal(classify({ temperature: -120 }).label, "FROZEN PLANET");
  assert.equal(
    classify({ temperature: -120, hasWater: false, waterPosition: 0 }).label,
    "FROSTED WASTELAND",
  );
  assert.equal(classify({ temperature: 250 }).label, "SCORCHED");
  assert.equal(classify({ temperature: 700 }).label, "CANDENT");
  assert.equal(classify({ temperature: 2500 }).label, "HELL");
  assert.equal(classify({ temperature: 6000 }).label, "UNINHABITABLE");
});

test("keeps classification boundaries deterministic", () => {
  assert.equal(classify({ temperature: 20, waterPosition: 0.4 }).label, "GRAIL I");
  assert.equal(classify({ temperature: 70, waterPosition: 0.4 }).label, "GRAIL I");
  assert.equal(classify({ temperature: -100 }).label, "ICY GRAIL II");
  assert.equal(classify({ temperature: 100 }).label, "HOT GRAIL II");
  assert.equal(classify({ temperature: 400 }).label, "SCORCHED");
  assert.equal(classify({ temperature: 1000 }).label, "CANDENT");
  assert.equal(classify({ temperature: 5000 }).label, "HELL");
});

test("defers ordinary tidally locked planets but classifies molten ones", () => {
  const deferred = classify({ tidallyLocked: true });
  assert.equal(deferred.state, PLANET_CLASSIFICATION_STATES.DEFERRED);
  assert.equal(deferred.label, null);

  const molten = classify({
    tidallyLocked: true,
    textureMode: "molten",
  });
  assert.equal(molten.label, "UNINHABITABLE MOLTEN");
});

test("excludes gas giants", () => {
  const result = classify({ kind: "GAS GIANT" });
  assert.equal(result.state, PLANET_CLASSIFICATION_STATES.EXCLUDED);
  assert.equal(result.label, null);
});
