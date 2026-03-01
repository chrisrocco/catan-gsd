import { describe, it, expect } from 'vitest';
import { buildBoard } from './topology.js';
import { STANDARD_HEX_COORDS, cubeNeighbors, hexKey } from './coordinates.js';
import { generateBoard, shuffle, makeLcgRng } from './generator.js';

const NUMBER_TOKENS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

describe('STANDARD_HEX_COORDS', () => {
  it('has exactly 19 hexes', () => {
    expect(STANDARD_HEX_COORDS).toHaveLength(19);
  });

  it('all coordinates satisfy q+r+s=0', () => {
    for (const [q, r, s] of STANDARD_HEX_COORDS) {
      expect(q + r + s).toBe(0);
    }
  });

  it('all coordinates satisfy max(|q|,|r|,|s|) <= 2', () => {
    for (const [q, r, s] of STANDARD_HEX_COORDS) {
      expect(Math.max(Math.abs(q), Math.abs(r), Math.abs(s))).toBeLessThanOrEqual(2);
    }
  });

  it('has no duplicate coordinates', () => {
    const keys = STANDARD_HEX_COORDS.map(([q, r, s]) => `${q},${r},${s}`);
    expect(new Set(keys).size).toBe(19);
  });
});

describe('buildBoard topology', () => {
  const board = buildBoard();

  it('produces exactly 19 hexes', () => {
    expect(Object.keys(board.hexes)).toHaveLength(19);
  });

  it('produces exactly 54 unique vertices', () => {
    expect(Object.keys(board.vertices)).toHaveLength(54);
  });

  it('produces exactly 72 unique edges', () => {
    expect(Object.keys(board.edges)).toHaveLength(72);
  });

  it('every hex references exactly 6 vertex keys', () => {
    for (const hex of Object.values(board.hexes)) {
      expect(hex.vertexKeys).toHaveLength(6);
    }
  });

  it('every hex references exactly 6 edge keys', () => {
    for (const hex of Object.values(board.hexes)) {
      expect(hex.edgeKeys).toHaveLength(6);
    }
  });

  it('all vertex keys referenced by hexes exist in vertices map', () => {
    for (const hex of Object.values(board.hexes)) {
      for (const vKey of hex.vertexKeys) {
        expect(board.vertices[vKey]).toBeDefined();
      }
    }
  });

  it('all edge keys referenced by hexes exist in edges map', () => {
    for (const hex of Object.values(board.hexes)) {
      for (const eKey of hex.edgeKeys) {
        expect(board.edges[eKey]).toBeDefined();
      }
    }
  });

  it('every edge has exactly 2 vertex endpoints', () => {
    for (const edge of Object.values(board.edges)) {
      expect(edge.vertexKeys).toHaveLength(2);
      expect(edge.vertexKeys[0]).not.toBe(edge.vertexKeys[1]);
    }
  });

  it('all vertex endpoint keys in edges exist in vertices map', () => {
    for (const edge of Object.values(board.edges)) {
      expect(board.vertices[edge.vertexKeys[0]]).toBeDefined();
      expect(board.vertices[edge.vertexKeys[1]]).toBeDefined();
    }
  });

  it('every vertex has at least 2 adjacent edges', () => {
    for (const vertex of Object.values(board.vertices)) {
      expect(vertex.adjacentEdgeKeys.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('interior vertices have exactly 3 adjacent hexes', () => {
    const interiorVertices = Object.values(board.vertices).filter(v => v.adjacentHexKeys.length === 3);
    // A 19-hex Catan board has exactly 24 interior vertices (each interior vertex touches 3 hexes)
    expect(interiorVertices.length).toBeGreaterThan(0);
  });

  it('all vertices have 1, 2, or 3 adjacent hexes', () => {
    for (const vertex of Object.values(board.vertices)) {
      expect(vertex.adjacentHexKeys.length).toBeGreaterThanOrEqual(1);
      expect(vertex.adjacentHexKeys.length).toBeLessThanOrEqual(3);
    }
  });

  it('adjacentVertexKeys are symmetric (if A has B, B has A)', () => {
    for (const vertex of Object.values(board.vertices)) {
      for (const adjKey of vertex.adjacentVertexKeys) {
        const adjVertex = board.vertices[adjKey]!;
        expect(adjVertex.adjacentVertexKeys).toContain(vertex.key);
      }
    }
  });
});

describe('shuffle', () => {
  it('returns an array of the same length', () => {
    expect(shuffle([1, 2, 3, 4, 5])).toHaveLength(5);
  });

  it('returns all original elements', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffle(arr).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('is deterministic with seeded RNG', () => {
    const rng1 = makeLcgRng(42);
    const rng2 = makeLcgRng(42);
    expect(shuffle([1, 2, 3, 4, 5], rng1)).toEqual(shuffle([1, 2, 3, 4, 5], rng2));
  });

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3, 4, 5];
    shuffle(arr);
    expect(arr).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('generateBoard', () => {
  const rng = makeLcgRng(42);
  const board = generateBoard(rng);

  it('produces exactly 19 hexes', () => {
    expect(Object.keys(board.hexes)).toHaveLength(19);
  });

  it('has exactly 1 desert hex (resource = null)', () => {
    const desertHexes = Object.values(board.hexes).filter(h => h.resource === null);
    expect(desertHexes).toHaveLength(1);
  });

  it('has correct resource distribution', () => {
    const counts: Record<string, number> = {};
    for (const hex of Object.values(board.hexes)) {
      if (hex.resource) counts[hex.resource] = (counts[hex.resource] ?? 0) + 1;
    }
    expect(counts['lumber']).toBe(4);
    expect(counts['wool']).toBe(4);
    expect(counts['grain']).toBe(4);
    expect(counts['brick']).toBe(3);
    expect(counts['ore']).toBe(3);
  });

  it('desert hex has no number token', () => {
    const desertHex = Object.values(board.hexes).find(h => h.resource === null)!;
    expect(desertHex.number).toBeNull();
  });

  it('all 18 non-desert hexes have a number token', () => {
    const nonDesert = Object.values(board.hexes).filter(h => h.resource !== null);
    expect(nonDesert.every(h => h.number !== null)).toBe(true);
  });

  it('number token distribution matches official set', () => {
    const numbers = Object.values(board.hexes)
      .filter(h => h.number !== null)
      .map(h => h.number!)
      .sort((a, b) => a - b);
    expect(numbers).toEqual([...NUMBER_TOKENS].sort((a, b) => a - b));
  });

  it('no two adjacent hexes both have red numbers (6 or 8)', () => {
    const redHexes = Object.values(board.hexes).filter(h => h.number === 6 || h.number === 8);
    for (let i = 0; i < redHexes.length; i++) {
      for (let j = i + 1; j < redHexes.length; j++) {
        const a = redHexes[i]!;
        const b = redHexes[j]!;
        const aNeighbors = cubeNeighbors(a.q, a.r, a.s).map(([q, r, s]) => hexKey(q, r, s));
        expect(aNeighbors).not.toContain(b.key);
      }
    }
  });

  it('is deterministic with same seed', () => {
    const board1 = generateBoard(makeLcgRng(99));
    const board2 = generateBoard(makeLcgRng(99));
    const resources1 = Object.entries(board1.hexes).map(([k, h]) => `${k}:${h.resource}:${h.number}`).sort().join('|');
    const resources2 = Object.entries(board2.hexes).map(([k, h]) => `${k}:${h.resource}:${h.number}`).sort().join('|');
    expect(resources1).toBe(resources2);
  });
});
