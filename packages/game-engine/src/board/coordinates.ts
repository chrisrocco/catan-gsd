// Cube coordinate math for flat-top hexagonal grid
// Reference: redblobgames.com/grids/hexagons/

// Direction vectors for 6 neighbors in cube coordinates (flat-top)
export const CUBE_DIRECTIONS: readonly [number, number, number][] = [
  [+1, -1,  0],
  [+1,  0, -1],
  [ 0, +1, -1],
  [-1, +1,  0],
  [-1,  0, +1],
  [ 0, -1, +1],
] as const;

// Flat-top hex: 6 vertex corner offsets relative to hex center, as [angle_index]
// For a hex with circumradius R (center to vertex), flat-top corners are at:
// angle = 60° * i, starting from 0° (rightmost)
// In pixel space: x = R * cos(60° * i), y = R * sin(60° * i)
// Stored as [cos_fraction, sin_fraction] for use with hex size in Phase 4
export const FLAT_TOP_CORNER_ANGLES_DEG: readonly number[] = [0, 60, 120, 180, 240, 300];

// The 19 cube coordinates for a standard Catan board (radius 2 hexagonal grid)
// All satisfy q + r + s = 0 and max(|q|, |r|, |s|) <= 2
export const STANDARD_HEX_COORDS: readonly [number, number, number][] = [
  // Center
  [ 0,  0,  0],
  // Ring 1
  [ 1, -1,  0], [ 1,  0, -1], [ 0,  1, -1],
  [-1,  1,  0], [-1,  0,  1], [ 0, -1,  1],
  // Ring 2
  [ 2, -2,  0], [ 2, -1, -1], [ 2,  0, -2],
  [ 1,  1, -2], [ 0,  2, -2], [-1,  2, -1],
  [-2,  2,  0], [-2,  1,  1], [-2,  0,  2],
  [-1, -1,  2], [ 0, -2,  2], [ 1, -2,  1],
];

export function hexKey(q: number, r: number, s: number): string {
  return `${q},${r},${s}`;
}

export function cubeNeighbors(q: number, r: number, s: number): [number, number, number][] {
  return CUBE_DIRECTIONS.map(([dq, dr, ds]) => [q + dq, r + dr, s + ds]);
}

// A vertex is shared by exactly 3 hexes (interior) or fewer (border).
// Its canonical key is the sorted join of the hex keys that share it.
// We derive a vertex from a hex corner: each flat-top hex corner i is shared
// by the hex itself plus the two neighbors at directions (i) and (i+1 mod 6).
export function vertexKey(hexKeys: string[]): string {
  return [...hexKeys].sort().join('|');
}

// An edge is shared by at most 2 hexes. Its canonical key is the sorted join
// of the hex keys that share it (or just one hex key for border edges).
export function edgeKey(hexKey1: string, hexKey2: string): string {
  return [hexKey1, hexKey2].sort().join('~');
}

// Given hex (q,r,s) and corner index 0-5, return the two neighbor hexes
// that share this corner with (q,r,s).
// In flat-top orientation, vertex i (at angle 60*i degrees) is shared by
// neighbors at direction i and direction (i+5)%6. This comes from the geometry:
// vertex i is between edges (i-1) and i, which are shared with neighbors
// at directions (i+5)%6 and i respectively.
export function cornerNeighborDirections(cornerIndex: number): [[number,number,number], [number,number,number]] {
  const i = cornerIndex % 6;
  const j = (cornerIndex + 5) % 6;
  return [CUBE_DIRECTIONS[i] as [number,number,number], CUBE_DIRECTIONS[j] as [number,number,number]];
}

// Given hex (q,r,s) and edge index 0-5, return the one neighbor hex
// that shares this edge. Edge i is between corners i and i+1, shared with neighbor at direction i.
export function edgeNeighborDirection(edgeIndex: number): [number, number, number] {
  return CUBE_DIRECTIONS[edgeIndex % 6] as [number, number, number];
}
