# Phase 1: Game Engine - Research

**Researched:** 2026-02-28
**Domain:** Pure TypeScript game rules engine — hex grid, Catan rules, FSM, monorepo setup
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Hex Coordinate System**
- Use **cube coordinates** (q, r, s where q+r+s=0) as the canonical internal representation
- Cube coordinates make neighbor lookup, distance, and path algorithms straightforward
- Offset coordinates (row/col) may be used only for rendering translation — never as the internal model
- Board topology: flat-top hexes (columns of hexes); verify with rendering phase

**Board Model**
- Vertices and edges are **globally unique objects** shared across adjacent hexes — not per-hex local indices
- The vertex that three hexes share is one `Vertex` object referenced by all three `Hex` objects
- `Edge` objects similarly reference their two endpoint `Vertex` objects
- Board is represented as three maps: `hexes: Map<string, Hex>`, `vertices: Map<string, Vertex>`, `edges: Map<string, Edge>` keyed by canonical coordinate strings

**Game State Shape**
- Single immutable-style `GameState` object describing the complete game at any point in time
- Shape: `{ board, players, deck, discardPile, phase, activePlayer, robberHex, longestRoadHolder, largestArmyHolder, turnNumber, winner }`
- `players` is a record keyed by player ID with their hand, built pieces, knight count, roads-built count, dev-cards-in-hand, dev-cards-played-this-turn
- State is serializable to JSON with no functions or class instances (plain objects only)
- Actions use the pattern `applyAction(state: GameState, action: Action): { state: GameState; events: GameEvent[]; error?: string }` — returns new state or error, never mutates

**Turn Phase FSM**
- Game phases modeled as a discriminated union: `'setup-forward' | 'setup-reverse' | 'pre-roll' | 'post-roll' | 'robber-move' | 'robber-steal' | 'discard' | 'road-building' | 'year-of-plenty' | 'game-over'`
- Legal actions derived from current phase: `getLegalActions(state): Action[]`
- FSM transitions are pure functions: `transition(state, action) → nextPhase`
- Only the server calls `applyAction`; no phase mutation happens in bots or clients directly

**Longest Road Algorithm**
- DFS-based traversal that finds the longest continuous road path for a player
- Correctly handles road breaks: opponent settlements on a vertex break continuity
- Recalculated after every road placement (including Road Building dev card)
- Implemented as a standalone pure function with dedicated unit tests
- Tie behavior: current holder keeps the award if challenger ties (not exceeds) them

**Dev Card Rules**
- VP dev cards: counted in victory points immediately when drawn; never "played"
- Action dev cards (knight, monopoly, YoP, road building): tracked separately as `unplayedDevCards` in player state
- `devCardBoughtThisTurn: boolean` flag on player state — action cards cannot be played if this is true
- One dev card play per turn maximum (separate from buying)

**Testing Strategy**
- Unit tests for each rule module: board generation, resource distribution, placement validation, trading, dev cards, longest road, largest army, win detection
- Integration test: simulate a full game deterministically (seeded randomness) end-to-end until a winner
- Longest road gets its own test suite with explicit edge cases (road breaks, ties, multi-branch paths)
- Tests run in Node (no browser); framework: Claude's discretion

**Package Structure**
- Monorepo from the start using npm workspaces: `packages/game-engine`, `packages/server`, `packages/client`
- `packages/game-engine` has zero runtime dependencies — no framework, no external libraries
- TypeScript strict mode enabled; all public API surfaces fully typed

### Claude's Discretion
- TypeScript compiler options and tsconfig setup
- Test framework choice (Vitest recommended for monorepo compatibility)
- Exact file structure within `packages/game-engine/src/`
- Board generation algorithm details (Fisher-Yates shuffle, number placement retry logic)
- Exact dev card shuffle implementation
- Error type shapes

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope. No new capabilities were introduced.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GAME-01 | Board generates with 19 randomized land hexes (resource types) and number tokens (red numbers not adjacent) | Fisher-Yates shuffle for hex placement; retry/rejection loop for red (6,8) adjacency; cube coordinate neighbor lookup |
| GAME-02 | Initial placement phase runs 2 rounds with reverse turn order in round 2; each player places 1 settlement + 1 road per round | FSM setup-forward / setup-reverse phases; placement validation rules; second settlement gets free resources |
| GAME-03 | Dice roll distributes resources each turn; settlements/cities adjacent to rolled number receive 1/2 resources | Board model: hex→vertex adjacency lookup; resource distribution pure function |
| GAME-04 | Rolling 7 activates robber; players with >7 cards must discard half (rounded down) | FSM discard phase; multiple-player discard sequencing; robber-move phase transition |
| GAME-05 | Active player moves robber to any land hex; may steal one random card from opponent on that hex | FSM robber-steal phase; steal is optional if no opponents present; random card selection |
| GAME-06 | Dev card deck: 14 knights, 5 VP, 2 monopoly, 2 year of plenty, 2 road building; shuffled at game start | Fixed deck composition array; Fisher-Yates shuffle; deck exhaustion handling |
| GAME-07 | Dev cards cannot be played on the same turn they were purchased | `devCardBoughtThisTurn` flag; cleared at turn start; checked before card play |
| GAME-08 | Knight/Monopoly/YoP/Road Building actions; VP cards count immediately and are kept secret | Per-card action handlers; VP cards never enter unplayed pool; Monopoly takes from all opponents |
| GAME-09 | Bank trading at 4:1; port trading at 2:1 or 3:1 based on settlement/city presence at port vertex | Port vertex lookup; trade ratio resolution; bank resource limit (19 per type) |
| GAME-10 | Resource costs enforced: road, settlement, city, dev card | Cost constants; resource deduction with validation before applying |
| GAME-11 | Longest road award (2 VP) to first player with 5+ continuous road segments; recalculated every road build; ties keep current holder | DFS edge-tracking algorithm; road-break on opponent settlement; tie-handling logic |
| GAME-12 | Largest army award (2 VP) to first player to play 3+ knights; subsequent players must exceed current count | Knight count comparison; award transfer logic; threshold is strictly exceed (not tie) |
| GAME-13 | VP calculated continuously; first to 10 VP on their turn wins | VP calculation pure function; win check after every action; VP dev cards included in secret until win |
| GAME-14 | Turn order enforced server-side; only active player may submit actions | `activePlayer` field in GameState; action validation checks playerId === activePlayer |
</phase_requirements>

---

## Summary

Phase 1 builds a pure TypeScript package implementing the complete Catan base game rules. The package has zero runtime dependencies and produces a deterministic, fully serializable `GameState` that any downstream package can import. Every design decision has already been locked down in CONTEXT.md — the research task is to verify implementation details, confirm the standard toolchain, and document the algorithm specifics that matter for writing tasks.

The most important implementation concerns are: (1) the hex vertex/edge coordinate scheme for globally-unique IDs — three hexes sharing a vertex must reference exactly one `Vertex` object, not three separate ones with the same position; (2) the longest road DFS — it must track visited *edges*, not visited *vertices*, because the same vertex can be traversed multiple times across different branch paths; and (3) the FSM phase transitions — the full set of phases is more complex than it first appears because discard-on-7 can affect multiple players in sequence before the robber move is allowed.

The standard toolchain for this package is: TypeScript 5.9.x (latest stable as of 2026-02-28), Vitest 4.0.x as the test runner (Node environment, no browser), npm workspaces for monorepo structure. TypeScript project references with `composite: true` are the correct way to make `packages/game-engine` importable by `packages/server` and `packages/client` without a separate build step during development.

**Primary recommendation:** Build the board model (hex/vertex/edge topology) and its unit tests first — it is the foundation everything else depends on. If the coordinate scheme or vertex identity is wrong, every subsequent module is compromised.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3 | Language, type safety | Latest stable (5.9 released ~Sep 2025); strict mode catches rule-enforcement bugs at compile time |
| Vitest | 4.0.x | Unit test runner | Current major version (4.0.17+ as of Feb 2026); runs in Node with no browser; same config as Vite used in Phase 4 |
| Node.js | 22 LTS | Runtime for tests | LTS release; required by Vitest 4 (minimum Node >=20) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitest/coverage-v8 | 4.0.x | Coverage reporting | Installed alongside vitest; use `--coverage` flag; V8 provider is default and accurate in v4 |
| tsx | latest | Execute TypeScript in Node without compile step | For running ad-hoc scripts (e.g., board generation inspection); not required for tests |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest 4.x | Jest | Jest requires babel/ts-jest transform; Vitest runs TypeScript natively. Vitest shares config with Vite (Phase 4). Use Vitest. |
| npm workspaces | pnpm workspaces | CONTEXT.md specifies npm workspaces. pnpm would be faster but the decision is locked. |
| TypeScript project references | path aliases / ts-paths | Project references give correct incremental builds; path aliases require bundler. Use project references. |

**Installation (root):**
```bash
npm install
# workspaces are set up via root package.json — no explicit install needed per-package
```

**Installation (game-engine package dev dependencies):**
```bash
npm install -D vitest @vitest/coverage-v8 typescript --workspace=packages/game-engine
```

---

## Architecture Patterns

### Recommended Project Structure

```
/                               # monorepo root
├── package.json                # "workspaces": ["packages/*"], "private": true
├── tsconfig.base.json          # shared compiler options (strict, target, moduleResolution)
├── tsconfig.json               # root references: [{path: "packages/game-engine"}]
└── packages/
    ├── game-engine/
    │   ├── package.json        # name: "@catan/game-engine", no runtime deps
    │   ├── tsconfig.json       # extends ../../tsconfig.base.json, composite: true
    │   ├── vitest.config.ts    # environment: "node"
    │   └── src/
    │       ├── index.ts        # public API re-exports
    │       ├── types.ts        # GameState, Action, GameEvent, Player, Board discriminated unions
    │       ├── board/
    │       │   ├── coordinates.ts   # cube coord math: neighbors, distance, hex key serialization
    │       │   ├── topology.ts      # buildBoard(): constructs Hex/Vertex/Edge maps with shared objects
    │       │   ├── generator.ts     # generateBoard(): assigns resources/numbers via Fisher-Yates + retry
    │       │   └── board.test.ts    # board generation tests
    │       ├── engine/
    │       │   ├── actions.ts       # applyAction() dispatcher
    │       │   ├── fsm.ts           # phase transition table; getLegalActions()
    │       │   ├── placement.ts     # settlement/road/city placement validation
    │       │   ├── resources.ts     # distributeResources(), buildCost(), trade validation
    │       │   ├── robber.ts        # robber move + steal handlers
    │       │   ├── devCards.ts      # deck initialization, draw, play handlers per card type
    │       │   ├── longestRoad.ts   # computeLongestRoad(state, playerId): DFS edge-tracking
    │       │   ├── largestArmy.ts   # checkLargestArmy() after each knight play
    │       │   ├── victory.ts       # computeVP(), checkWin()
    │       │   └── *.test.ts        # co-located test files per module
    │       └── __tests__/
    │           └── integration.test.ts  # full-game seeded simulation
    ├── server/                 # Phase 2
    └── client/                 # Phase 4
```

### Pattern 1: Cube Coordinate Keys for Map Lookup

**What:** Every hex, vertex, and edge is identified by a canonical string key derived from its cube coordinates. This key is used as the map index throughout the engine.

**When to use:** Everywhere a hex, vertex, or edge is looked up, stored, or compared.

**Example:**
```typescript
// Source: redblobgames.com/grids/hexagons + project design
// Hex key: serialize cube coords directly
function hexKey(q: number, r: number, s: number): string {
  return `${q},${r},${s}`;
}

// Vertex key: a vertex sits at the corner shared by 3 hexes.
// Canonical form: sort the 3 contributing hex keys, join them.
// This ensures the same vertex has the same key regardless of which hex "owns" it.
function vertexKey(hexKeys: [string, string, string]): string {
  return hexKeys.slice().sort().join('|');
}

// Edge key: an edge is shared by 2 hexes (or 1 hex + sea).
// Canonical form: sort the 2 contributing hex keys, join them.
function edgeKey(hexKey1: string, hexKey2: string): string {
  return [hexKey1, hexKey2].slice().sort().join('~');
}
```

### Pattern 2: Global Vertex/Edge Index Construction

**What:** During `buildBoard()`, walk all 19 hexes. For each hex, compute the 6 vertex positions and 6 edge positions using the cube coordinate geometry. Before adding a vertex, check if its canonical key already exists in `vertices: Map<string, Vertex>`. If it does, reuse the existing object. This ensures 3 adjacent hexes hold a reference to the *same* Vertex object.

**When to use:** Board initialization only — `buildBoard()` is called once at game start.

**Example:**
```typescript
// Source: project design derived from redblobgames topology model
function buildBoard(): Board {
  const hexes = new Map<string, Hex>();
  const vertices = new Map<string, Vertex>();
  const edges = new Map<string, Edge>();

  for (const [q, r, s] of STANDARD_HEX_COORDS) {
    const hKey = hexKey(q, r, s);
    const hex: Hex = { key: hKey, q, r, s, resource: null, number: null, vertices: [], edges: [] };

    for (let corner = 0; corner < 6; corner++) {
      const vKey = computeVertexKey(q, r, s, corner); // derives 3-hex canonical key
      if (!vertices.has(vKey)) {
        vertices.set(vKey, { key: vKey, building: null, port: null, adjacentHexes: [], adjacentEdges: [], adjacentVertices: [] });
      }
      const vertex = vertices.get(vKey)!;
      vertex.adjacentHexes.push(hex);
      hex.vertices.push(vertex);
    }
    // similar for edges...
    hexes.set(hKey, hex);
  }
  return { hexes, vertices, edges };
}
```

### Pattern 3: Immutable State with applyAction

**What:** `applyAction` takes a state snapshot and returns a new state snapshot. It never mutates the input. This makes state history trivial to inspect, bot simulation safe (bots can speculatively explore branches), and testing straightforward.

**When to use:** Every game action — placement, build, roll, trade, dev card play.

**Example:**
```typescript
// Source: project design
type ActionResult = {
  state: GameState;
  events: GameEvent[];
  error?: string;
};

function applyAction(state: GameState, action: Action): ActionResult {
  // Validate action is legal given current phase and player
  const validationError = validateAction(state, action);
  if (validationError) {
    return { state, events: [], error: validationError };
  }
  // Apply action: return new state object (spread + modify)
  const newState = applyActionUnchecked(state, action);
  const events = deriveEvents(state, newState, action);
  return { state: newState, events };
}
```

### Pattern 4: FSM Phase Transitions

**What:** Current phase determines which actions are legal. Transitions are a pure lookup table from `(currentPhase, actionType) → nextPhase`. Anything not in the table is illegal.

**When to use:** Every action dispatch — checked before any state mutation.

**Example:**
```typescript
// Source: project design
type GamePhase =
  | 'setup-forward'
  | 'setup-reverse'
  | 'pre-roll'
  | 'post-roll'
  | 'robber-move'
  | 'robber-steal'
  | 'discard'
  | 'road-building'
  | 'year-of-plenty'
  | 'game-over';

// Legal action types per phase (partial example)
const LEGAL_ACTIONS: Record<GamePhase, ActionType[]> = {
  'pre-roll':    ['ROLL_DICE', 'PLAY_DEV_CARD', 'BUILD_ROAD', 'BUILD_SETTLEMENT', 'BUILD_CITY', 'BUY_DEV_CARD', 'TRADE', 'END_TURN'],
  'post-roll':   ['BUILD_ROAD', 'BUILD_SETTLEMENT', 'BUILD_CITY', 'BUY_DEV_CARD', 'PLAY_DEV_CARD', 'TRADE', 'END_TURN'],
  'robber-move': ['MOVE_ROBBER'],
  'robber-steal':['STEAL_RESOURCE', 'SKIP_STEAL'],
  'discard':     ['DISCARD_RESOURCES'],
  // ...
};
```

### Pattern 5: Longest Road DFS with Edge Tracking

**What:** DFS starting from each road-owning vertex, tracking the *set of edges visited* in the current path. When all edges from a vertex are exhausted or blocked by an opponent settlement, backtrack and try other paths.

**Key insight:** Track visited edges per DFS branch, not visited vertices. A vertex can appear multiple times in a valid road (e.g., a T-junction where two branches meet). Blocking condition: if a vertex has a settlement/city owned by a *different* player, roads cannot continue through it.

**When to use:** Called after every road placement and road-building dev card.

**Example:**
```typescript
// Source: project design + algorithm research (verified against Catan Fandom wiki rules)
function computeLongestRoadLength(state: GameState, playerId: string): number {
  const playerEdges = getPlayerRoads(state, playerId); // Set<string> of edge keys
  let maxLength = 0;

  for (const startEdge of playerEdges) {
    for (const startVertex of getEdgeEndpoints(state.board, startEdge)) {
      const length = dfsRoad(state, playerId, startVertex, startEdge, new Set([startEdge]));
      maxLength = Math.max(maxLength, length);
    }
  }
  return maxLength;
}

function dfsRoad(
  state: GameState,
  playerId: string,
  vertex: Vertex,
  _prevEdge: string,
  visitedEdges: Set<string>
): number {
  let maxLength = visitedEdges.size;

  // Vertex is blocked if an opponent has a building here
  const building = vertex.building;
  if (building && building.playerId !== playerId) {
    return visitedEdges.size; // road continues but does NOT pass through this vertex
  }

  for (const edge of vertex.adjacentEdges) {
    if (visitedEdges.has(edge.key)) continue;
    if (edge.road?.playerId !== playerId) continue;

    const nextVertex = edge.vertices.find(v => v.key !== vertex.key)!;
    visitedEdges.add(edge.key);
    const length = dfsRoad(state, playerId, nextVertex, edge.key, visitedEdges);
    maxLength = Math.max(maxLength, length);
    visitedEdges.delete(edge.key); // backtrack
  }
  return maxLength;
}
```

### Anti-Patterns to Avoid

- **Per-hex local vertex indices:** Storing vertex 0-5 per hex and computing neighbors by index arithmetic. This causes silent duplicate-object bugs. Always use the global vertex map.
- **Mutable state in applyAction:** Mutating the input `state` object then returning it. Breaks bot simulation (bot holds a reference to the "before" state and it changes). Always spread to a new object.
- **Boolean flag soup for turn phases:** Using `hasRolled`, `hasPlayedDevCard`, `isDiscarding`, `isMovingRobber` flags. This allows illegal action combinations. Use the explicit FSM phase string instead.
- **Visited-vertex DFS for longest road:** Tracking visited vertices prevents valid road paths that backtrack through junctions. Track visited *edges* instead.
- **Class instances in GameState:** Putting methods on `Hex`, `Vertex`, or `Player` objects. State must be plain JSON-serializable objects for server broadcasting in Phase 2.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Array shuffling | Custom shuffle | Fisher-Yates (implement inline, 5 lines) | Fisher-Yates is the only provably unbiased shuffle; any other approach has subtle bias |
| Seeded randomness for tests | Custom PRNG | Inline LCG or pass a `rand: () => number` function parameter | Tests need deterministic runs; inject the RNG as a parameter to keep the engine pure |
| Hex neighbor lookup | Custom offset math per orientation | Cube coordinate direction vectors (6 fixed vectors) | Cube neighbor is a vector add; offset neighbor requires conditional row-parity logic |
| TypeScript compilation toolchain | Custom build script | `tsc --build` with project references | Project references handle incremental builds and cross-package type resolution correctly |
| Test runner configuration | Jest with ts-jest | Vitest 4.x with native TypeScript support | Vitest runs TypeScript without transformation overhead; same ecosystem as Phase 4 Vite |

**Key insight:** The game engine's complexity is entirely in the rules logic, not the toolchain. Use the minimum toolchain (TypeScript + Vitest) and invest all energy in correctness of game rules.

---

## Common Pitfalls

### Pitfall 1: Wrong Vertex Identity Model

**What goes wrong:** Treating vertex positions as coordinates-per-hex rather than globally unique objects. Settlement placement updates one vertex record, but two other hex objects still reference a different vertex object at the same position. Validity checks pass for the wrong vertex.

**Why it happens:** It feels natural to model each hex as "having" 6 vertices. The shared-object model requires more setup code during board initialization.

**How to avoid:** Build `vertices: Map<string, Vertex>` during `buildBoard()`. Every hex holds *references* to Vertex objects from that global map. The canonical vertex key (derived from the 3 hexes sharing it) is computed once and reused.

**Warning signs:** Settlement placement doesn't prevent a second settlement within 1 step; resource distribution gives resources to the wrong hexes.

### Pitfall 2: Longest Road Vertex Blocking vs. Edge Tracking Confusion

**What goes wrong:** DFS traversal marks the *vertex* as visited and doesn't allow returning to it. This incorrectly breaks valid roads that pass through a junction vertex multiple times via different edges.

**Why it happens:** Standard DFS tracks visited vertices. Longest-path-without-edge-repeat is a different problem.

**How to avoid:** Track `visitedEdges: Set<string>` per DFS branch. A vertex may be revisited as long as no edge is reused. Apply the blocking rule separately: if a vertex has an *opponent* building, road continuity is broken (the DFS should not continue through that vertex, but the length so far is still counted up to that vertex's incoming edge).

**Warning signs:** Longest road calculations return values lower than visually obvious roads; road break from own settlement incorrectly stops counting.

### Pitfall 3: Discard Phase Multi-Player Sequencing

**What goes wrong:** When a 7 is rolled, multiple players may need to discard. A naive implementation activates the robber move phase immediately after one player discards, skipping remaining discards.

**Why it happens:** The discard requirement affects all players with >7 cards simultaneously, but actions are processed one at a time.

**How to avoid:** Track `discardQueue: string[]` (player IDs who still need to discard) in `GameState`. Transition to `robber-move` phase only when `discardQueue` is empty. The discard phase allows action only from the first player in the queue; each discard action removes from the queue and the phase stays `discard` until the queue is empty.

**Warning signs:** Integration test shows robber moving before all required discards are processed.

### Pitfall 4: Dev Card Play Timing

**What goes wrong:** A player buys a dev card and immediately plays it in the same turn. The engine allows this because the card is now in their hand.

**Why it happens:** The "bought this turn" restriction requires tracking something beyond card presence in hand.

**How to avoid:** Use `devCardBoughtThisTurn: boolean` on player state (locked in CONTEXT.md). Set to `true` on `BUY_DEV_CARD` action, reset to `false` on `END_TURN`. `PLAY_DEV_CARD` action is invalid if `devCardBoughtThisTurn === true`.

**Warning signs:** Full-game integration test reaches 10 VP suspiciously quickly; a bot buys and immediately plays a road-building card.

### Pitfall 5: Red Number Adjacency Constraint During Board Generation

**What goes wrong:** Board generation shuffles hexes and tokens but doesn't enforce that 6 and 8 tokens are never on adjacent hexes. The resulting board violates the basic setup rule.

**Why it happens:** The constraint is an adjacency check, not just a random shuffle. Naive random placement has roughly a 15–25% chance of producing an invalid board.

**How to avoid:** Use retry-based generation: shuffle hex list and number token list with Fisher-Yates; assign tokens to hexes (skip desert); check all 6-token and 8-token hexes for adjacency using cube coordinate neighbor lookup; if any pair is adjacent, retry the token shuffle only (hex resources can stay). Log retry count in tests to verify the retry loop terminates in practice.

**Warning signs:** Board generation occasionally produces adjacent 6/8 tokens; unit test for generator fails intermittently.

### Pitfall 6: Second Settlement Free Resources

**What goes wrong:** During setup, the second settlement placement (setup-reverse phase) grants the placing player 1 of each resource adjacent to that settlement. Forgetting this makes initial resource distribution wrong for the entire game.

**Why it happens:** The rule is easy to skip — it doesn't appear in the regular turn flow.

**How to avoid:** The `PLACE_SETTLEMENT` action handler checks `state.phase === 'setup-reverse'` and, if true, distributes resources from adjacent hexes to the placing player's hand after placing the settlement.

**Warning signs:** All players start a simulated game with zero resources; first turn builds are impossible for all players.

### Pitfall 7: VP Dev Card Visibility

**What goes wrong:** VP dev card counts are included in the public VP total broadcast to all players before the holder wins. Opponents can see a player approaching 10 VP through their VP cards.

**Why it happens:** VP calculation iterates all player cards naively including VP cards.

**How to avoid:** `computeVP(state, playerId, perspective: 'own' | 'public')` — when `perspective === 'public'`, exclude VP dev cards from the total. When `perspective === 'own'`, include them. The server uses `'own'` when building a player's private state view, `'public'` for the opponent-visible scoreboard. Win detection always uses `'own'`.

**Warning signs:** Opponents can predict a player's win before it's announced; scoreboard shows 9+ VP before a player wins with VP cards.

### Pitfall 8: Bank Resource Depletion

**What goes wrong:** The bank runs out of a resource type. Players receiving resources on a dice roll should receive 0 of that resource if the bank has none (or fewer than all claimants, in which case no one gets that resource for that roll per official rules).

**Why it happens:** Most implementations just add resources without checking bank totals.

**How to avoid:** Track `bank: Record<ResourceType, number>` in `GameState` (19 of each resource type at start). Resource distribution checks bank supply before distributing. If bank has fewer than the total number owed, *no player* receives that resource on that roll.

**Warning signs:** Infinite resource accumulation in long integration tests; bank goes negative.

---

## Code Examples

### Cube Coordinate Neighbor Direction Vectors

```typescript
// Source: redblobgames.com/grids/hexagons/ — canonical 6 directions
// For flat-top hexes: directions for horizontal neighbors
const CUBE_DIRECTIONS: [number, number, number][] = [
  [+1, -1,  0],
  [+1,  0, -1],
  [ 0, +1, -1],
  [-1, +1,  0],
  [-1,  0, +1],
  [ 0, -1, +1],
];

function cubeNeighbors(q: number, r: number, s: number): [number, number, number][] {
  return CUBE_DIRECTIONS.map(([dq, dr, ds]) => [q + dq, r + dr, s + ds]);
}
```

### Standard Catan Board Data

```typescript
// Source: Official Catan rulebook (Catan GmbH, 2020/2025 edition)
// 19 land hexes: 4 forest (lumber), 4 pasture (wool), 4 fields (grain),
//                3 hills (brick), 3 mountains (ore), 1 desert
const RESOURCE_DISTRIBUTION: ResourceType[] = [
  'lumber', 'lumber', 'lumber', 'lumber',
  'wool',   'wool',   'wool',   'wool',
  'grain',  'grain',  'grain',  'grain',
  'brick',  'brick',  'brick',
  'ore',    'ore',    'ore',
  // desert handled separately — gets no number token
];

// 18 number tokens (desert hex gets no token)
// Red numbers (6 and 8) cannot be adjacent
const NUMBER_TOKENS: number[] = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

// 9 ports: 4 generic (3:1 any resource), 5 specific (2:1 one resource)
const PORT_TYPES: PortType[] = ['3:1', '3:1', '3:1', '3:1', 'lumber', 'wool', 'grain', 'brick', 'ore'];

// Dev card deck composition (25 cards total)
// Source: Official Catan rulebook
const DEV_CARD_DECK: DevCardType[] = [
  ...Array(14).fill('knight'),
  ...Array(5).fill('victory-point'),
  ...Array(2).fill('road-building'),
  ...Array(2).fill('year-of-plenty'),
  ...Array(2).fill('monopoly'),
];
```

### Fisher-Yates Shuffle

```typescript
// Source: Fisher-Yates algorithm (Durstenfeld, 1964)
// Pass rand as parameter so callers can inject seeded RNG for tests
function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Usage with seeded RNG for deterministic tests
function makeLcgRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (1664525 * s + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}
```

### Vitest Configuration for Node-only Package

```typescript
// Source: vitest.dev/guide (Vitest 4.0.17)
// packages/game-engine/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
    },
  },
});
```

### Root Package.json for npm Workspaces

```json
{
  "name": "catan",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "test": "npm run test --workspaces --if-present",
    "build": "tsc --build"
  },
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
```

### TypeScript Base Config for Monorepo

```json
// tsconfig.base.json (monorepo root)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "incremental": true
  }
}

// packages/game-engine/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "references": []
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vitest `defineWorkspace()` | `projects: []` in `vitest.config.ts` | Vitest 3.2 (workspace deprecated) | For a simple 3-package monorepo, root `projects` config is sufficient; no separate workspace file needed |
| Vitest `coverage.experimentalAstAwareRemapping` | Always-on by default | Vitest 4.0 | V8 coverage is now as accurate as Istanbul; no config option needed |
| `ts-jest` / babel-jest for TypeScript | Vitest native TypeScript | ~2022 onward | No transform configuration needed; TypeScript runs as-is |
| TypeScript 5.x with decorator proposal | TypeScript 5.9 stable decorators | TypeScript 5.0+ | Standard decorators are stable; this project does not use them, but no compat concerns |

**Deprecated/outdated:**
- `vitest.workspace.ts` file: Deprecated in Vitest 3.2. Use `projects: ['packages/*']` in root `vitest.config.ts` instead.
- `coverage.experimentalAstAwareRemapping`: Removed in Vitest 4.0, now always enabled.
- Jest for new TypeScript projects: Requires `ts-jest` or Babel transform; Vitest is the modern replacement.

---

## Open Questions

1. **Flat-top hex orientation — pixel-to-vertex coordinate mapping**
   - What we know: CONTEXT.md locks flat-top hexes. Redblobgames documents the pixel conversion formulas for flat-top orientation specifically: `x = size * (3/2 * q)`, `y = size * (sqrt(3)/2 * q + sqrt(3) * r)`.
   - What's unclear: The exact vertex pixel positions for the 6 corners of a flat-top hex (needed in Phase 4 for click detection) depend on the hex size. This is not needed in Phase 1 (pure engine, no rendering), but the engine's vertex model must be consistent with how Phase 4 will map vertices to screen coordinates.
   - Recommendation: Document the 6 corner offsets (as fractions of hex size) in `coordinates.ts` as a constant — even if unused in Phase 1 — so Phase 4 can rely on them without re-deriving. Flat-top corner offsets are `[size, 0]`, `[size/2, size*sqrt(3)/2]`, `[-size/2, size*sqrt(3)/2]`, `[-size, 0]`, `[-size/2, -size*sqrt(3)/2]`, `[size/2, -size*sqrt(3)/2]` (relative to hex center).

2. **Standard hex coordinate positions for the 19-hex Catan board**
   - What we know: The board is a hexagonal shape of hexes (not a rectangle). In cube coordinates centered at (0,0,0), the 19 hexes occupy coordinates where `max(|q|, |r|, |s|) <= 2`.
   - What's unclear: The exact set of 19 coordinates. This is deterministic from the constraint but must be enumerated correctly in code.
   - Recommendation: The 19 hexes with `max(|q|, |r|, |s|) <= 2` is the standard 3-radius hex grid (radius 2). Enumerate them in `topology.ts` as a constant array — 19 entries, all satisfying q+r+s=0 and max(|q|,|r|,|s|) ≤ 2. This can be verified by counting: the formula for a hex grid of radius n is `3n² + 3n + 1`; for n=2, that is `12 + 6 + 1 = 19`. Correct.

3. **Port vertex positions on the standard board**
   - What we know: The standard Catan board has 9 ports in fixed positions (4 generic 3:1, 5 specific 2:1). Port positions are on the outer sea-facing vertices of the 19-hex island. In a random setup only the hex resource/number layout varies; port positions on the sea frame are fixed.
   - What's unclear: The exact vertex keys for the 9 × 2 port vertices (each port occupies 2 vertices). These depend on which outer hex edges face the sea.
   - Recommendation: Hard-code port positions as a constant in `generator.ts` by listing the vertex pairs for each of the 9 port slots. This can be derived from the 19-hex layout by finding all outer edges (edges with only 1 adjacent land hex). Phase 1 can verify ports are correctly assigned by checking that all valid 4:1 trades are replaced by better rates when a settlement is on a port vertex.

---

## Sources

### Primary (HIGH confidence)
- Redblobgames hexagonal grids (https://www.redblobgames.com/grids/hexagons/) — cube coordinates, neighbor directions, pixel conversion formulas; updated March 2025
- Official Catan rulebook PDF (Catan GmbH, 2025 edition https://www.catan.com/sites/default/files/2025-03/CN3081%20CATAN-The%20Game%20Rulebook%20secure%20(1).pdf) — dev card composition, port types, setup rules
- Vitest official docs (https://vitest.dev/guide/) — version 4.0.17 current; Node environment; project configuration
- TypeScript npm (https://www.npmjs.com/package/typescript) — version 5.9.3 current stable as of 2026-02-28
- npm workspaces docs (https://docs.npmjs.com/cli/v7/using-npm/workspaces/) — workspace root setup, private:true requirement

### Secondary (MEDIUM confidence)
- Catan Fandom Wiki (https://catan.fandom.com/wiki/Longest_Road) — longest road rules, tie behavior; cross-verified with official rulebook
- Catan Fandom Wiki (https://catan.fandom.com/wiki/Development_card) — dev card counts: 14 knight, 5 VP, 2 monopoly, 2 YoP, 2 road building = 25 total
- Vitest blog post (https://vitest.dev/blog/vitest-4) — Vitest 4.0 breaking changes confirmed: basic reporter removed, V8 coverage remapping always-on
- Vitest 4.0 coverage docs (https://vitest.dev/guide/coverage.html) — @vitest/coverage-v8 configuration
- WebSearch: "Vitest 2026" — confirmed version 4.0.18 as latest with 11-18M weekly downloads

### Tertiary (LOW confidence)
- Board generation retry statistics ("15-25% invalid boards before retry") — estimated from combinatorial argument, not measured; actual retry rate in implementation should be logged and verified in tests
- LCG PRNG parameters (1664525, 1013904223) — standard Numerical Recipes LCG, adequate for test determinism; not cryptographic

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Vitest 4.0.17 and TypeScript 5.9.3 are confirmed current versions from npm; npm workspaces setup is official docs
- Architecture: HIGH — all patterns are locked in CONTEXT.md from prior research; these findings confirm and detail the implementation
- Catan rules data: HIGH — dev card deck composition and hex counts verified from official rulebook and secondary sources
- Longest road algorithm: HIGH — DFS edge-tracking approach confirmed by multiple sources; tie-handling and blocking rules cross-verified
- Pitfalls: HIGH for structural pitfalls (vertex identity, FSM, discard sequencing); MEDIUM for retry statistics (estimated)

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (Vitest and TypeScript version numbers may increment; architecture is stable)
