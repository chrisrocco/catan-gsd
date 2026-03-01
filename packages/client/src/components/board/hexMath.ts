import type { Edge } from '@catan/game-engine';

export const HEX_SIZE = 50;
const SQRT3 = Math.sqrt(3);

export interface Point {
  x: number;
  y: number;
}

/**
 * Convert cube coordinates to pixel position (flat-top orientation).
 * Flat-top: flat sides on left/right, pointy on top/bottom.
 */
export function cubeToPixel(q: number, r: number): Point {
  const x = HEX_SIZE * ((3 / 2) * q);
  const y = HEX_SIZE * ((SQRT3 / 2) * q + SQRT3 * r);
  return { x, y };
}

/**
 * Generate SVG polygon points string for a flat-top hexagon.
 */
export function hexPoints(cx: number, cy: number, size: number): string {
  return [0, 60, 120, 180, 240, 300]
    .map((angle) => {
      const rad = (Math.PI / 180) * angle;
      return `${cx + size * Math.cos(rad)},${cy + size * Math.sin(rad)}`;
    })
    .join(' ');
}

/**
 * Parse "q,r,s" hex key into cube coordinates.
 */
export function parseCubeCoords(hexKey: string): { q: number; r: number; s: number } {
  const parts = hexKey.split(',');
  return {
    q: Number(parts[0]),
    r: Number(parts[1]),
    s: Number(parts[2]),
  };
}

/**
 * Compute vertex pixel position from its key.
 * Vertex key = "h1|h2|h3" (sorted hex keys, may include virtual sea hexes).
 * Position = centroid of the hex centers.
 */
export function vertexPosition(vertexKey: string): Point {
  const hexKeys = vertexKey.split('|');
  let totalX = 0;
  let totalY = 0;

  for (const hk of hexKeys) {
    const { q, r } = parseCubeCoords(hk);
    const pos = cubeToPixel(q, r);
    totalX += pos.x;
    totalY += pos.y;
  }

  return {
    x: totalX / hexKeys.length,
    y: totalY / hexKeys.length,
  };
}

/**
 * Compute edge endpoint positions from edge's vertexKeys.
 * Uses vertex positions (computed from hex key centroids).
 */
export function edgeEndpoints(edge: Edge): [Point, Point] {
  return [vertexPosition(edge.vertexKeys[0]), vertexPosition(edge.vertexKeys[1])];
}

/**
 * Compute board bounds from all hex positions for SVG viewBox.
 */
export function computeBoardBounds(
  hexPositions: Map<string, Point>,
): { minX: number; minY: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pos of hexPositions.values()) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x);
    maxY = Math.max(maxY, pos.y);
  }

  const pad = HEX_SIZE * 1.5;
  return {
    minX: minX - pad,
    minY: minY - pad,
    width: maxX - minX + 2 * pad,
    height: maxY - minY + 2 * pad,
  };
}
