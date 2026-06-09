import * as THREE from "three";
import {
  LINK_DISTANCE,
  MAX_LINKS_PER_NODE,
  NODE_COUNT,
  STAR_TYPES,
} from "../constants.js";
import { GEN_SYLLABLES, MEGAGEN_SYLLABLES } from "../syllables.js";
import { hslToHex } from "../utils/color.js";

export function createNodes(random) {
  return Array.from({ length: NODE_COUNT }, (_, id) => {
    const star = createStarProfile(random);
    const radius = 1.4 + random() * 3.55;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    const drift = new THREE.Vector3(
      (random() - 0.5) * 1.8,
      (random() - 0.5) * 1.4,
      (random() - 0.5) * 1.8,
    );

    return {
      id,
      position: new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * radius,
        Math.cos(phi) * radius * 0.78,
        Math.sin(phi) * Math.sin(theta) * radius,
      ).add(drift),
      size: star.size,
      starType: star.type,
      glowColor: star.color,
      coreColor: star.coreColor,
      blackCore: star.blackCore,
      glowBoost: (star.type === "Neutron Star" || star.type === "Strange Star") ? 1.28 : 1,
      glowScaleBoost: (star.type === "Neutron Star" || star.type === "Strange Star") ? 1 : 1,
      planets: Math.floor(random() * 14),
    };
  });
}

function createStarProfile(random) {
  const variant = STAR_TYPES[Math.floor(random() * STAR_TYPES.length)];
  const [minSize, maxSize] = variant.size;
  const color = variant.blackCore
    ? hslToHex(random() * 360, 1, 0.87)
    : variant.color;

  return {
    ...variant,
    color,
    size: minSize + random() * (maxSize - minSize),
  };
}

export function createStarName(random) {
  const useMega = random() >= 0.7;
  const syllables = useMega ? MEGAGEN_SYLLABLES : GEN_SYLLABLES;
  const variant = random();

  if (useMega) {
    if (variant < 0.5) {
      return joinSyllables(syllables, random, 2);
    }
    if (variant < 0.9) {
      return `${pickSyllable(syllables, random)}-${pickNameNumber(random)}`.toUpperCase();
    }
    return pickSyllable(syllables, random).toUpperCase();
  }

  if (variant < 0.5) {
    return joinSyllables(syllables, random, 2);
  }
  if (variant < 0.8) {
    return joinSyllables(syllables, random, 3);
  }
  if (variant < 0.9) {
    return `${pickSyllable(syllables, random)}-${pickNameNumber(random)}`.toUpperCase();
  }
  if (variant < 0.95) {
    return `${pickSyllable(syllables, random)}-${pickSyllable(syllables, random)}`.toUpperCase();
  }
  return `${pickSyllable(syllables, random)}'${pickSyllable(syllables, random)}`.toUpperCase();
}

function joinSyllables(syllables, random, count) {
  return Array.from({ length: count }, () => pickSyllable(syllables, random))
    .join("")
    .toUpperCase();
}

function pickNameNumber(random) {
  return Math.floor(random() * 999) + 1;
}

function pickSyllable(syllables, random) {
  return syllables[Math.floor(random() * syllables.length)];
}

export function createLinks(points) {
  const candidates = [];
  const used = new Set();
  const links = [];
  const degree = new Map(points.map((node) => [node.id, 0]));

  for (let a = 0; a < points.length; a += 1) {
    for (let b = a + 1; b < points.length; b += 1) {
      const distance = points[a].position.distanceTo(points[b].position);
      if (distance < LINK_DISTANCE) {
        candidates.push({ a, b, distance });
      }
    }
  }

  candidates.sort((left, right) => left.distance - right.distance);

  for (let nodeIndex = 1; nodeIndex < points.length; nodeIndex += 1) {
    let nearest = null;
    for (let otherIndex = 0; otherIndex < nodeIndex; otherIndex += 1) {
      const distance = points[nodeIndex].position.distanceTo(points[otherIndex].position);
      if (!nearest || distance < nearest.distance) {
        nearest = { a: nodeIndex, b: otherIndex, distance };
      }
    }
    addLink(nearest);
  }

  for (const link of candidates) {
    if (degree.get(link.a) >= MAX_LINKS_PER_NODE || degree.get(link.b) >= MAX_LINKS_PER_NODE) {
      continue;
    }
    addLink(link);
  }

  return links;

  function addLink(link) {
    const low = Math.min(link.a, link.b);
    const high = Math.max(link.a, link.b);
    const key = `${low}:${high}`;
    if (used.has(key)) {
      return;
    }
    used.add(key);
    links.push({ a: low, b: high, distance: link.distance });
    degree.set(low, degree.get(low) + 1);
    degree.set(high, degree.get(high) + 1);
  }
}

export function createOuterLinks(points, random) {
  const targetCount = 4 + Math.floor(random() * 3);
  const edgeNodes = [...points]
    .sort((left, right) => right.position.lengthSq() - left.position.lengthSq())
    .slice(0, Math.max(targetCount * 2, Math.ceil(points.length * 0.32)));
  const picked = [];

  while (picked.length < targetCount && edgeNodes.length > 0) {
    const index = Math.floor(random() * edgeNodes.length);
    const [node] = edgeNodes.splice(index, 1);
    const outward = node.position.clone().normalize();
    const jitter = new THREE.Vector3(
      random() - 0.5,
      (random() - 0.5) * 0.7,
      random() - 0.5,
    );
    jitter.addScaledVector(outward, -jitter.dot(outward)).normalize();
    const direction = outward.addScaledVector(jitter, 0.16 + random() * 0.18).normalize();
    const length = 1.15 + random() * 1.35;

    picked.push({
      parentId: node.id,
      start: node.position.clone(),
      end: node.position.clone().addScaledVector(direction, length),
      opacity: 0.26 + random() * 0.18,
    });
  }

  return picked;
}

export function createAdjacency(edges, points) {
  const adjacencyMap = new Map(points.map((node) => [node.id, new Set()]));
  for (const edge of edges) {
    adjacencyMap.get(edge.a).add(edge.b);
    adjacencyMap.get(edge.b).add(edge.a);
  }
  return adjacencyMap;
}
