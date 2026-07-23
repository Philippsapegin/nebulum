const ATMOSPHERE_TAGS = new Set([
  "THIN ATMOSPHERE",
  "ATMOSPHERE",
  "DENSE ATMOSPHERE",
]);

export const PLANET_BUILDING_SKINS = Object.freeze({
  ATMOSPHERIC: "atmospheric",
  SEALED: "sealed",
});

export const PLANET_CLASSIFICATION_STATES = Object.freeze({
  CLASSIFIED: "classified",
  DEFERRED: "deferred",
  EXCLUDED: "excluded",
});

export function classifyPlanet({
  kind,
  temperature,
  atmosphere,
  hasWater,
  waterPosition,
  tidallyLocked,
  textureMode,
}) {
  const hasAtmosphere = ATMOSPHERE_TAGS.has(atmosphere);
  const buildingSkin = hasAtmosphere
    ? PLANET_BUILDING_SKINS.ATMOSPHERIC
    : PLANET_BUILDING_SKINS.SEALED;
  const baseResult = {
    state: PLANET_CLASSIFICATION_STATES.CLASSIFIED,
    label: null,
    habitabilityClass: null,
    modifiers: [],
    buildingSkin,
    requiresSealedBuildings: !hasAtmosphere,
  };

  if (kind !== "PLANET") {
    return {
      ...baseResult,
      state: PLANET_CLASSIFICATION_STATES.EXCLUDED,
    };
  }

  if (tidallyLocked) {
    if (textureMode === "molten") {
      return createClassification(baseResult, "UNINHABITABLE MOLTEN");
    }
    return {
      ...baseResult,
      state: PLANET_CLASSIFICATION_STATES.DEFERRED,
    };
  }

  if (!Number.isFinite(temperature)) {
    return {
      ...baseResult,
      state: PLANET_CLASSIFICATION_STATES.DEFERRED,
    };
  }

  if (!hasAtmosphere) {
    const modifiers = getDryTemperatureModifiers(temperature);
    return createClassification(baseResult, "UNHABITABLE", modifiers);
  }

  if (temperature < -100) {
    return createClassification(
      baseResult,
      hasWater ? "FROZEN PLANET" : "FROSTED WASTELAND",
    );
  }

  if (temperature > 100) {
    return createClassification(baseResult, getHotPlanetClass(temperature));
  }

  if (!hasWater) {
    return createClassification(
      baseResult,
      "GRAIL III",
      getDryTemperatureModifiers(temperature),
    );
  }

  const normalizedWater = normalizeWaterPosition(waterPosition);
  const isGrailOne = temperature >= 20
    && temperature <= 70
    && normalizedWater >= 0.4;
  if (isGrailOne) {
    return createClassification(
      baseResult,
      "GRAIL I",
      getWetWorldModifiers(normalizedWater),
    );
  }

  return createClassification(
    baseResult,
    "GRAIL II",
    [
      ...getGrailTwoTemperatureModifiers(temperature),
      ...getLowWaterModifiers(normalizedWater),
    ],
  );
}

function createClassification(baseResult, habitabilityClass, modifiers = []) {
  return {
    ...baseResult,
    label: [...modifiers, habitabilityClass].join(" "),
    habitabilityClass,
    modifiers,
  };
}

function normalizeWaterPosition(waterPosition) {
  if (!Number.isFinite(waterPosition)) {
    return 0;
  }
  return Math.min(1, Math.max(0, waterPosition));
}

function getWetWorldModifiers(waterPosition) {
  if (waterPosition >= 0.9) {
    return ["OCEANIC"];
  }
  if (waterPosition >= 0.5) {
    return ["FLOODED"];
  }
  return [];
}

function getLowWaterModifiers(waterPosition) {
  if (waterPosition < 0.1) {
    return ["ARID"];
  }
  if (waterPosition < 0.3) {
    return ["SAVANNA"];
  }
  if (waterPosition < 0.4) {
    return ["CONTINENTAL"];
  }
  return [];
}

function getGrailTwoTemperatureModifiers(temperature) {
  if (temperature < -10) {
    return ["ICY"];
  }
  if (temperature < 20) {
    return ["COLD"];
  }
  if (temperature > 70) {
    return ["HOT"];
  }
  return [];
}

function getDryTemperatureModifiers(temperature) {
  if (temperature < -50) {
    return ["ICY"];
  }
  if (temperature < 0) {
    return ["COLD"];
  }
  if (temperature < 30) {
    return ["BARREN"];
  }
  if (temperature < 70) {
    return ["DESERT"];
  }
  if (temperature <= 100) {
    return ["ASHEN"];
  }
  return [];
}

function getHotPlanetClass(temperature) {
  if (temperature <= 400) {
    return "SCORCHED";
  }
  if (temperature <= 1000) {
    return "CANDENT";
  }
  if (temperature <= 5000) {
    return "HELL";
  }
  return "UNINHABITABLE";
}
