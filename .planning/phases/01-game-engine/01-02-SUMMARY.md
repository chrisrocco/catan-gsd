---
phase: 01-game-engine
plan: 02
subsystem: game-engine
tags: [typescript, vitest, cube-coordinates, hex-grid, topology, board-generation, fisher-yates, lcg-rng]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Board, Hex, Vertex, Edge, ResourceType, PortType types from @catan/game-engine"
provides:
  - "coordinates.ts: hexKey, vertexKey, edgeKey, cubeNeighbors, cornerNeighborDirections, edgeNeighborDirection, STANDARD_HEX_COORDS, FLAT_TOP_CORNER_ANGLES_DEG"
  - "topology.ts: buildBoard() — 19 hexes, 54 globally-unique vertices, 72 globally-unique edges with full adjacency wiring"
  - "generator.ts: generateBoard(), shuffle(), makeLcgRng() — randomized board with red-number adjacency enforcement"
  - "board.test.ts: 29 tests confirming topology invariants and generator correctness"
affects:
  - "03-game-logic: imports buildBoard/generateBoard for initial game state construction"
  - "04-placement-validation: uses vertex/edge adjacency maps for settlement/road validation"
  - "05-resource-distribution: uses board hex adjacency for dice roll payout"
  - "06-longest-road: uses edge/vertex adjacency graph"
  - "07-rendering: uses FLAT_TOP_CORNER_ANGLES_DEG and STANDARD_HEX_COORDS for layout"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cube coordinate vertex keys: sorted join of ALL three surrounding hex keys (including virtual sea hexes) for global uniqueness"
    - "Flat-top corner formula: vertex i is shared by neighbors at direction i and (i+5)%6 — NOT (i+1)%6"
    - "Border edge keys: hKey~sea~edgeIdx format to disambiguate multiple border edges per outer hex"
    - "Red-number retry loop: shuffle tokens, check adjacency, retry up to 1000x (typically resolves in <5 attempts)"
    - "Fisher-Yates shuffle with injectable RNG parameter for test determinism"
    - "LCG RNG (Numerical Recipes params) for seeded deterministic test boards"

key-files:
  created:
    - "packages/game-engine/src/board/coordinates.ts: cube math primitives + 19-coord STANDARD_HEX_COORDS"
    - "packages/game-engine/src/board/topology.ts: buildBoard() producing shared vertex/edge objects"
    - "packages/game-engine/src/board/generator.ts: generateBoard(), shuffle(), makeLcgRng()"
    - "packages/game-engine/src/board/board.test.ts: 29 topology + generator invariant tests"
  modified: []

key-decisions:
  - "Vertex keys include virtual sea hex coordinates: using all 3 surrounding hex keys (real or virtual) guarantees globally unique vertex IDs even for border vertices with only 1 land neighbor"
  - "cornerNeighborDirections uses (i+5)%6 not (i+1)%6: flat-top vertex i is between edge (i-1) and edge i, sharing neighbors at directions (i+5)%6 and i"
  - "Border edges keyed as hKey~sea~edgeIdx: prevents key collision when multiple outer-ring hexes have border edges in the same direction"
  - "Port placement uses evenly-spaced outer edges: step = floor(outerEdgeCount / 9) — simple and deterministic"

patterns-established:
  - "Canonical vertex key: [...hexKeys].sort().join('|') — always sort 3 hex key contributors including sea"
  - "Canonical edge key: [hexKey1, hexKey2].sort().join('~') for interior; hKey~sea~idx for border"
  - "TDD Red→Green: write failing tests first, then implement minimum code to pass"

requirements-completed:
  - "GAME-01"

# Metrics
duration: 7min
completed: 2026-03-01
---

# Phase 1 Plan 2: Hex Grid Foundation Summary

**Flat-top cube-coordinate hex grid with 19 hexes, 54 globally-unique shared vertices, 72 globally-unique shared edges, and randomized board generation enforcing no adjacent red numbers (6/8) via Fisher-Yates retry loop**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-01T01:11:50Z
- **Completed:** 2026-03-01T01:18:45Z
- **Tasks:** 2 (each with TDD RED + GREEN commits)
- **Files modified:** 4

## Accomplishments
- buildBoard() confirmed producing exactly 19 hexes, 54 vertices, 72 edges with correct shared topology
- generateBoard() passes all resource distribution (4/4/4/3/3 + desert) and red-number adjacency tests
- Seeded determinism via makeLcgRng() — same seed always produces identical board
- Discovered and fixed critical flat-top hex corner geometry formula during implementation

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing topology tests** - `9f9fa38` (test)
2. **Task 1 GREEN: coordinates.ts + topology.ts** - `39431af` (feat)
3. **Task 2 RED: Failing generator tests** - `dcb895d` (test)
4. **Task 2 GREEN: generator.ts** - `779ec59` (feat)

_Note: Both tasks used TDD — test commit followed by implementation commit_

## Files Created/Modified
- `packages/game-engine/src/board/coordinates.ts` - Cube math: hexKey, vertexKey, edgeKey, cubeNeighbors, cornerNeighborDirections, STANDARD_HEX_COORDS (19 entries), FLAT_TOP_CORNER_ANGLES_DEG
- `packages/game-engine/src/board/topology.ts` - buildBoard(): constructs Board with globally-unique Vertex and Edge objects, full adjacency wiring
- `packages/game-engine/src/board/generator.ts` - generateBoard(), shuffle() (Fisher-Yates), makeLcgRng() (LCG seeded RNG)
- `packages/game-engine/src/board/board.test.ts` - 29 topology invariant and generator correctness tests

## Topology Confirmation

- **Vertices:** 54 unique (confirmed: 24 interior with 3 adjacent hexes, 30 border with 1-2 adjacent hexes)
- **Edges:** 72 unique (confirmed: interior edges have 2 adjacent hexes, border edges have 1)
- **Adjacency symmetry:** all adjacentVertexKeys confirmed symmetric

## Decisions Made
- Vertex keys include virtual sea hex coordinates to guarantee global uniqueness for border vertices. A border vertex touching only 1 land hex still has 3 unique surrounding cube positions (the land hex + 2 virtual sea hexes at specific cube coordinates). Including all 3 ensures no two border vertices of different outer-ring hexes collide.
- `cornerNeighborDirections` uses `(i+5)%6` not `(i+1)%6` — required by flat-top hex geometry where vertex i sits between edge i-1 and edge i.
- Border edges use `hKey~sea~edgeIdx` format so each outer hex's 2-3 border edges get distinct keys.
- Port placement uses evenly-spaced outer edges (step = 6), distributing 9 ports across 30 border edges.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed cornerNeighborDirections formula: (i+1)%6 → (i+5)%6**
- **Found during:** Task 1 GREEN (topology builder implementation)
- **Issue:** The plan's `cornerNeighborDirections` used `(i+1)%6` for the second neighbor direction. In flat-top hex geometry, vertex `i` is at angle `60*i°` and sits between edge `(i-1)%6` and edge `i`. Edge `i` is shared with neighbor at direction `i`; edge `(i-1)%6` is shared with neighbor at direction `(i-1+6)%6 = (i+5)%6`. The correct second direction is `(i+5)%6`, NOT `(i+1)%6`.
- **Symptom:** 48 vertices instead of 54; 11 vertices with only 1 adjacent edge (outer-ring corner vertices); some edges had duplicate vertex endpoints.
- **Fix:** Changed formula in `cornerNeighborDirections` to return `CUBE_DIRECTIONS[(i+5)%6]` as the second direction. Updated function comment to document the geometric derivation.
- **Files modified:** `packages/game-engine/src/board/coordinates.ts`
- **Verification:** Tests confirmed 54 vertices, 72 edges, no vertices with < 2 adjacent edges, no duplicate edge endpoints, adjacency symmetry maintained.
- **Committed in:** `39431af` (Task 1 feat commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Critical correctness fix — the wrong formula produced 48 vertices instead of 54, which would have caused silent bugs in all downstream modules (placement validation, resource distribution, longest road). No scope creep.

## Issues Encountered
- The plan code sample used `(i+1)%6` for corner neighbor direction. The flat-top hex geometry requires `(i+5)%6`. Geometrically: vertex `i` is between edges `i-1` and `i`, sharing those edges with neighbors at directions `(i+5)%6` and `i`. Debugging required isolating specific outer-ring hexes and manually tracing which neighbors share each corner.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Board topology is proven correct with 41 passing tests
- `buildBoard()` and `generateBoard()` are ready for import by game logic modules
- Vertex and edge keys are stable and deterministic — downstream modules can rely on them
- `FLAT_TOP_CORNER_ANGLES_DEG` and `STANDARD_HEX_COORDS` are ready for Phase 4 rendering

---
*Phase: 01-game-engine*
*Completed: 2026-03-01*
