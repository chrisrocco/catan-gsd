# Phase 1: Game Engine - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a pure TypeScript package (`packages/game-engine`) implementing the complete Catan base game rules with no I/O, no networking, and no UI dependencies. The engine is a shared package imported by the server (Phase 2), bot AI (Phase 3), and indirectly by the client. Everything is testable in isolation by running TypeScript/Node — no browser required.

</domain>

<decisions>
## Implementation Decisions

### Hex Coordinate System
- Use **cube coordinates** (q, r, s where q+r+s=0) as the canonical internal representation
- Cube coordinates make neighbor lookup, distance, and path algorithms straightforward
- Offset coordinates (row/col) may be used only for rendering translation — never as the internal model
- Board topology: flat-top hexes (columns of hexes); verify with rendering phase

### Board Model
- Vertices and edges are **globally unique objects** shared across adjacent hexes — not per-hex local indices
- The vertex that three hexes share is one `Vertex` object referenced by all three `Hex` objects
- `Edge` objects similarly reference their two endpoint `Vertex` objects
- Board is represented as three maps: `hexes: Map<string, Hex>`, `vertices: Map<string, Vertex>`, `edges: Map<string, Edge>` keyed by canonical coordinate strings

### Game State Shape
- Single immutable-style `GameState` object describing the complete game at any point in time
- Shape: `{ board, players, deck, discardPile, phase, activePlayer, robberHex, longestRoadHolder, largestArmyHolder, turnNumber, winner }`
- `players` is a record keyed by player ID with their hand, built pieces, knight count, roads-built count, dev-cards-in-hand, dev-cards-played-this-turn
- State is serializable to JSON with no functions or class instances (plain objects only)
- Actions use the pattern `applyAction(state: GameState, action: Action): { state: GameState; events: GameEvent[]; error?: string }` — returns new state or error, never mutates

### Turn Phase FSM
- Game phases modeled as a discriminated union: `'setup-forward' | 'setup-reverse' | 'pre-roll' | 'post-roll' | 'robber-move' | 'robber-steal' | 'discard' | 'road-building' | 'year-of-plenty' | 'game-over'`
- Legal actions derived from current phase: `getLegalActions(state): Action[]`
- FSM transitions are pure functions: `transition(state, action) → nextPhase`
- Only the server calls `applyAction`; no phase mutation happens in bots or clients directly

### Longest Road Algorithm
- DFS-based traversal that finds the longest continuous road path for a player
- Correctly handles road breaks: opponent settlements on a vertex break continuity
- Recalculated after every road placement (including Road Building dev card)
- Implemented as a standalone pure function with dedicated unit tests
- Tie behavior: current holder keeps the award if challenger ties (not exceeds) them

### Dev Card Rules
- VP dev cards: counted in victory points immediately when drawn; never "played"
- Action dev cards (knight, monopoly, YoP, road building): tracked separately as `unplayedDevCards` in player state
- `devCardBoughtThisTurn: boolean` flag on player state — action cards cannot be played if this is true
- One dev card play per turn maximum (separate from buying)

### Testing Strategy
- Unit tests for each rule module: board generation, resource distribution, placement validation, trading, dev cards, longest road, largest army, win detection
- Integration test: simulate a full game deterministically (seeded randomness) end-to-end until a winner
- Longest road gets its own test suite with explicit edge cases (road breaks, ties, multi-branch paths)
- Tests run in Node (no browser); framework: Claude's discretion

### Package Structure
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

</decisions>

<specifics>
## Specific Ideas

- The research specifically flagged cube coordinates as unrecoverable if wrong — treat this as a hard constraint, not a preference
- Research flagged globally-unique vertices/edges as a critical correctness requirement (not just style)
- The `applyAction(state, action) → { state, events, error }` pattern was identified by architecture research as the correct interface for server authority and bot integration
- Bots will call `getLegalActions(state)` to enumerate moves and `applyAction` to apply them — no special bot-only interfaces needed

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None established yet — this phase sets the patterns for all subsequent phases

### Integration Points
- `packages/game-engine` will be imported by `packages/server` in Phase 2
- `packages/game-engine` will be imported by `packages/server` bot module in Phase 3
- `packages/game-engine` types will be imported by `packages/client` in Phase 4 (for TypeScript type safety on received state)
- The `GameState` type and `Action` discriminated union are the primary public API surface

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope. No new capabilities were introduced.

</deferred>

---

*Phase: 01-game-engine*
*Context gathered: 2026-02-28*
