import { PLANET_DICTIONARIES } from "../planetDictionaries.js";
import { GEN_SYLLABLES, MEGAGEN_SYLLABLES } from "../syllables.js";
import { toRoman } from "../utils/math.js";
import { createRandom } from "../utils/random.js";

export function createPlanetNameService({ seed }) {
  const planetDictionaryPools = createPlanetDictionaryPools();
  const systemPlanetDictionaries = new Map();
  const moonNameAssignments = new Map();

  function createPlanetNameAssignments(systemNodes) {
    const assignments = new Map();

    for (const node of systemNodes) {
      const random = createRandom(`${seed}:planet-names:${node.id}`);
      const primaryDictionary = pickSystemPlanetDictionary(random);
      systemPlanetDictionaries.set(node.id, primaryDictionary);
      const names = [];

      for (let index = 0; index < node.planets; index += 1) {
        names.push(createPlanetName({
          random,
          systemName: node.name,
          planetIndex: index,
          primaryDictionary,
          dictionaryPools: planetDictionaryPools,
        }));
      }

      assignments.set(node.id, names);
    }

    return assignments;
  }

  function getMoonNames(systemId, planetIndex, planetName, moonCount) {
    const key = `${systemId}:${planetIndex}`;
    if (moonNameAssignments.has(key)) {
      return moonNameAssignments.get(key).slice(0, moonCount);
    }

    const primaryDictionary = systemPlanetDictionaries.get(systemId) ?? "Greece";
    const random = createRandom(`${seed}:moon-names:${systemId}:${planetIndex}`);
    const names = Array.from({ length: moonCount }, (_, moonIndex) =>
      createPlanetName({
        random,
        systemName: planetName,
        planetIndex: moonIndex,
        primaryDictionary,
        dictionaryPools: planetDictionaryPools,
      }));
    moonNameAssignments.set(key, names);
    return names;
  }

  return {
    createDefaultPlanetName,
    createPlanetNameAssignments,
    getMoonNames,
  };
}

function createPlanetDictionaryPools() {
  return {
    Greece: createDictionaryPool(PLANET_DICTIONARIES.Greece),
    Norce: createDictionaryPool(PLANET_DICTIONARIES.Norce),
    Egypt: createDictionaryPool(PLANET_DICTIONARIES.Egypt),
    Feelings: createDictionaryPool(PLANET_DICTIONARIES.Feelings),
  };
}

function createDictionaryPool(names) {
  return {
    names,
    used: new Set(),
  };
}

function pickSystemPlanetDictionary(random) {
  const variants = ["Greece", "Norce", "Egypt"];
  return variants[Math.floor(random() * variants.length)];
}

function createPlanetName({ random, systemName, planetIndex, primaryDictionary, dictionaryPools }) {
  if (random() >= 0.7) {
    return createDefaultPlanetName(systemName, planetIndex);
  }

  const sourceRoll = random();
  if (sourceRoll < 0.6) {
    return pickUniqueDictionaryName(dictionaryPools[primaryDictionary], random)
      ?? createGenPlanetName(random);
  }
  if (sourceRoll < 0.7) {
    return pickUniqueDictionaryName(dictionaryPools.Feelings, random)
      ?? createGenPlanetName(random);
  }
  return createGenPlanetName(random);
}

function createDefaultPlanetName(systemName, planetIndex) {
  return `${systemName} ${toRoman(planetIndex + 1)}`;
}

function pickUniqueDictionaryName(pool, random) {
  if (!pool || pool.used.size >= pool.names.length) {
    return null;
  }

  const startIndex = Math.floor(random() * pool.names.length);
  for (let offset = 0; offset < pool.names.length; offset += 1) {
    const index = (startIndex + offset) % pool.names.length;
    const name = pool.names[index];
    if (!pool.used.has(name)) {
      pool.used.add(name);
      return name.toUpperCase();
    }
  }

  return null;
}

function createGenPlanetName(random) {
  const roll = random();
  const gen = () => pickSyllable(GEN_SYLLABLES, random);
  const mega = () => pickSyllable(MEGAGEN_SYLLABLES, random);

  if (roll < 0.2) {
    return `${gen()}${gen()}`.toUpperCase();
  }
  if (roll < 0.325) {
    return `${gen()}'${gen()}`.toUpperCase();
  }
  if (roll < 0.45) {
    return `${gen()}${mega()}`.toUpperCase();
  }
  if (roll < 0.575) {
    return `${mega()}${gen()}`.toUpperCase();
  }
  if (roll < 0.7) {
    return `${gen()}'${mega()}`.toUpperCase();
  }
  if (roll < 0.825) {
    return `${mega()}'${gen()}`.toUpperCase();
  }
  if (roll < 0.95) {
    return `${gen()} ${pickNameNumber(random)}`.toUpperCase();
  }
  return `${gen()}-${mega()}`.toUpperCase();
}

function pickNameNumber(random) {
  return Math.floor(random() * 999) + 1;
}

function pickSyllable(syllables, random) {
  return syllables[Math.floor(random() * syllables.length)];
}
