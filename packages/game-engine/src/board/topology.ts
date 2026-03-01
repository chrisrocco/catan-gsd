import type { Board, Hex, Vertex, Edge } from '../types.js';
import {
  STANDARD_HEX_COORDS,
  hexKey,
  vertexKey,
  edgeKey,
  cornerNeighborDirections,
  edgeNeighborDirection,
} from './coordinates.js';

/**
 * Build the Catan board topology: 19 hexes with globally-unique shared Vertex and Edge objects.
 * Resources and number tokens are NOT assigned here — see generator.ts.
 * Vertices are shared objects: three hexes sharing a corner reference the exact same Vertex instance.
 * Edges are shared objects: two hexes sharing an edge reference the exact same Edge instance.
 */
export function buildBoard(): Board {
  const hexes: Record<string, Hex> = {};
  const vertices: Record<string, Vertex> = {};
  const edges: Record<string, Edge> = {};

  // Collect all hex keys for neighbor lookup
  const hexKeySet = new Set(STANDARD_HEX_COORDS.map(([q, r, s]) => hexKey(q, r, s)));

  for (const [q, r, s] of STANDARD_HEX_COORDS) {
    const hKey = hexKey(q, r, s);
    const hexVertexKeys: string[] = [];
    const hexEdgeKeys: string[] = [];

    // Build 6 vertices for this hex
    for (let corner = 0; corner < 6; corner++) {
      const [dir1, dir2] = cornerNeighborDirections(corner);
      const n1Key = hexKey(q + dir1[0], r + dir1[1], s + dir1[2]);
      const n2Key = hexKey(q + dir2[0], r + dir2[1], s + dir2[2]);

      // Vertex key: always use all 3 hex keys (including sea hexes) to guarantee global uniqueness.
      // This ensures border vertices (touching sea) are never confused with each other.
      const sharingHexes = [hKey, n1Key, n2Key];
      const vKey = vertexKey(sharingHexes);

      if (!vertices[vKey]) {
        vertices[vKey] = {
          key: vKey,
          building: null,
          port: null,
          adjacentHexKeys: [],
          adjacentEdgeKeys: [],
          adjacentVertexKeys: [],
        };
      }
      if (!vertices[vKey]!.adjacentHexKeys.includes(hKey)) {
        vertices[vKey]!.adjacentHexKeys.push(hKey);
      }
      hexVertexKeys.push(vKey);
    }

    // Build 6 edges for this hex
    for (let edgeIdx = 0; edgeIdx < 6; edgeIdx++) {
      const dir = edgeNeighborDirection(edgeIdx);
      const neighborKey = hexKey(q + dir[0], r + dir[1], s + dir[2]);

      // Edge key: interior edges use sorted pair of hex keys; border edges get unique key per direction
      const finalEKey = hexKeySet.has(neighborKey)
        ? edgeKey(hKey, neighborKey)
        : `${hKey}~sea~${edgeIdx}`;

      if (!edges[finalEKey]) {
        // Determine the 2 vertex endpoints of this edge: corners edgeIdx and (edgeIdx+1)%6
        const v1Key = hexVertexKeys[edgeIdx]!;
        const v2Key = hexVertexKeys[(edgeIdx + 1) % 6]!;
        edges[finalEKey] = {
          key: finalEKey,
          road: null,
          vertexKeys: [v1Key, v2Key],
          adjacentHexKeys: [hKey],
        };
      } else {
        // Edge already exists from the adjacent hex — add this hex to its adjacentHexKeys
        if (!edges[finalEKey]!.adjacentHexKeys.includes(hKey)) {
          edges[finalEKey]!.adjacentHexKeys.push(hKey);
        }
      }
      hexEdgeKeys.push(finalEKey);
    }

    // Wire adjacentEdgeKeys onto vertices
    for (const vKey of hexVertexKeys) {
      for (const eKey of hexEdgeKeys) {
        const edge = edges[eKey]!;
        if (edge.vertexKeys.includes(vKey) && !vertices[vKey]!.adjacentEdgeKeys.includes(eKey)) {
          vertices[vKey]!.adjacentEdgeKeys.push(eKey);
        }
      }
    }

    hexes[hKey] = {
      key: hKey,
      q,
      r,
      s,
      resource: null,
      number: null,
      vertexKeys: hexVertexKeys,
      edgeKeys: hexEdgeKeys,
    };
  }

  // Wire adjacentVertexKeys for each vertex (vertices connected by a shared edge)
  for (const edge of Object.values(edges)) {
    const [v1Key, v2Key] = edge.vertexKeys;
    const v1 = vertices[v1Key]!;
    const v2 = vertices[v2Key]!;
    if (!v1.adjacentVertexKeys.includes(v2Key)) v1.adjacentVertexKeys.push(v2Key);
    if (!v2.adjacentVertexKeys.includes(v1Key)) v2.adjacentVertexKeys.push(v1Key);
  }

  return { hexes, vertices, edges };
}
