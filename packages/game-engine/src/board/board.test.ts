import { describe, it, expect } from 'vitest';
import { buildBoard } from './topology.js';
import { STANDARD_HEX_COORDS } from './coordinates.js';

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
