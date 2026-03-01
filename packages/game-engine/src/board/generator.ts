import type { Board, ResourceType, PortType } from '../types.js';
import { buildBoard } from './topology.js';
import { hexKey, cubeNeighbors } from './coordinates.js';

// Official Catan resource distribution (18 land hexes; 1 desert has no resource)
const RESOURCE_DISTRIBUTION: ResourceType[] = [
  'lumber', 'lumber', 'lumber', 'lumber',
  'wool',   'wool',   'wool',   'wool',
  'grain',  'grain',  'grain',  'grain',
  'brick',  'brick',  'brick',
  'ore',    'ore',    'ore',
];

// Official Catan number tokens — 18 tokens for 18 non-desert hexes
// Red numbers (6 and 8) must not be adjacent
const NUMBER_TOKENS: number[] = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

// Official port layout: 9 ports in fixed positions on the outer ring
// 4 generic (3:1) and 5 specific resource (2:1)
const PORT_TYPES: PortType[] = ['3:1', '3:1', '3:1', '3:1', 'lumber', 'wool', 'grain', 'brick', 'ore'];

// Fisher-Yates shuffle — unbiased, injectable rand for test determinism
export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

// LCG seeded RNG for deterministic tests
// Parameters from Numerical Recipes (adequate for test determinism; not cryptographic)
export function makeLcgRng(seed: number): () => number {
  let s = seed >>> 0;
  return (): number => {
    s = ((Math.imul(1664525, s) + 1013904223) | 0) >>> 0;
    return s / 0x100000000;
  };
}

// Check if two hex keys are adjacent using cube coordinate neighbor lookup
function hexesAreAdjacent(keyA: string, keyB: string): boolean {
  const [qa, ra, sa] = keyA.split(',').map(Number) as [number, number, number];
  const neighbors = cubeNeighbors(qa, ra, sa);
  return neighbors.some(([q, r, s]) => hexKey(q, r, s) === keyB);
}

// Check that no two red-number hexes (6 or 8) are adjacent
function hasAdjacentRedNumbers(hexKeys: string[], numberAssignment: Map<string, number>): boolean {
  const redHexKeys = hexKeys.filter(k => {
    const n = numberAssignment.get(k);
    return n === 6 || n === 8;
  });
  for (let i = 0; i < redHexKeys.length; i++) {
    for (let j = i + 1; j < redHexKeys.length; j++) {
      if (hexesAreAdjacent(redHexKeys[i]!, redHexKeys[j]!)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Generate a randomized Catan board with valid resource and number token placement.
 * Retries the token shuffle (not the resource shuffle) until red numbers are non-adjacent.
 * @param rand Injectable RNG for test determinism. Defaults to Math.random.
 */
export function generateBoard(rand: () => number = Math.random): Board {
  const board = buildBoard();
  const allHexKeys = Object.keys(board.hexes);

  // Shuffle hex positions and resources
  const shuffledResources = shuffle([...RESOURCE_DISTRIBUTION], rand);
  const shuffledHexKeys = shuffle(allHexKeys, rand);

  // Assign resources: first 18 hexes get resources, last hex is desert
  const nonDesertHexKeys: string[] = [];
  for (let i = 0; i < shuffledHexKeys.length; i++) {
    const hKey = shuffledHexKeys[i]!;
    const hex = board.hexes[hKey]!;
    if (i < shuffledResources.length) {
      hex.resource = shuffledResources[i]!;
      nonDesertHexKeys.push(hKey);
    } else {
      hex.resource = null; // desert
    }
  }

  // Assign number tokens with retry until no red-number adjacency
  let attempts = 0;
  const MAX_ATTEMPTS = 1000;
  let tokens = shuffle([...NUMBER_TOKENS], rand);

  while (attempts < MAX_ATTEMPTS) {
    const numberAssignment = new Map<string, number>();
    for (let i = 0; i < nonDesertHexKeys.length; i++) {
      numberAssignment.set(nonDesertHexKeys[i]!, tokens[i]!);
    }

    if (!hasAdjacentRedNumbers(nonDesertHexKeys, numberAssignment)) {
      // Valid assignment — apply to board
      for (const [hKey, num] of numberAssignment) {
        board.hexes[hKey]!.number = num;
      }
      break;
    }

    // Retry token shuffle
    tokens = shuffle([...NUMBER_TOKENS], rand);
    attempts++;
  }

  if (attempts === MAX_ATTEMPTS) {
    throw new Error(`Board generation failed after ${MAX_ATTEMPTS} attempts — no valid token placement found`);
  }

  // Assign ports to outer vertices
  // Outer edges are those with only 1 adjacent hex (border edges)
  const outerEdges = Object.values(board.edges).filter(e => e.adjacentHexKeys.length === 1);
  // Shuffle port types and assign to outer vertex pairs (each port spans 2 vertices of an outer edge)
  const shuffledPorts = shuffle([...PORT_TYPES], rand);
  const portEdgeCount = Math.min(shuffledPorts.length, outerEdges.length);
  // Select evenly-spaced outer edges for port positions
  const step = Math.floor(outerEdges.length / portEdgeCount);
  for (let i = 0; i < portEdgeCount; i++) {
    const edge = outerEdges[i * step];
    if (!edge) continue;
    const portType = shuffledPorts[i]!;
    for (const vKey of edge.vertexKeys) {
      const vertex = board.vertices[vKey];
      if (vertex && !vertex.port) {
        vertex.port = { type: portType };
      }
    }
  }

  return board;
}
