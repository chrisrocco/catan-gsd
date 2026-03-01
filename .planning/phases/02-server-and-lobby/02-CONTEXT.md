# Phase 2: Server and Lobby - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

A running Fastify HTTP server with Socket.IO hosts game sessions with real-time state sync. Players can create and join rooms via shareable room code, configure bot slots, and play a full game with server-side validation and state broadcast. No browser UI in this phase — tested via integration tests with Socket.IO clients.

</domain>

<decisions>
## Implementation Decisions

### Server Framework & Transport
- Fastify for HTTP REST endpoints + Socket.IO for real-time WebSocket communication
- Single process: Fastify and Socket.IO share one port
- REST API for room management (create, join, list); WebSocket for gameplay actions and state sync
- Default port 3000, configurable via PORT env var

### State Storage
- In-memory game state (Map of room code → game session)
- No database persistence — games lost on server restart
- Acceptable for personal use with friends

### Room Lifecycle
- Room codes: 4-letter uppercase words (e.g., CAKE) — easy to read aloud
- Host migration: if host disconnects, next connected player becomes host
- Auto-expiry: rooms cleaned up after 2 hours of inactivity
- Players pick colors (red/blue/white/orange) in lobby, first come first served

### Game Session Hosting
- Full GameState broadcast after every action (not diffs) — state is small (~5KB)
- Server-side state filtering: each player receives a personalized view with opponents' hand details stripped (prevents cheating via dev tools)
- GameEvent array broadcast alongside state update — enables client animations and game log
- Invalid actions silently rejected with error event to submitting client only

### Validation & Security
- All actions validated server-side via existing applyAction dispatcher
- Only active player may submit actions (enforced by game engine FSM)
- Invalid actions return error to submitter, no broadcast to other players

### Package Structure
- New package: `packages/server`
- Imports `game-engine` as workspace dependency
- Integration tests spin up real Fastify+Socket.IO instance with test clients
- GET /health endpoint for server status and active room count

### Claude's Discretion
- Socket.IO event naming conventions
- Internal room/session class structure
- Error response format details
- Exact health endpoint response shape
- Test helper utilities

</decisions>

<specifics>
## Specific Ideas

- Server wraps the existing `applyAction(state, action) → ActionResult` from game-engine as the core game loop
- Room code generation should avoid offensive words
- Player reconnection (NET-03) uses original room code + display name to rejoin

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `applyAction(state, action) → ActionResult`: Central game dispatcher — server wraps this directly
- `GameState` interface: Fully JSON-serializable, ready for Socket.IO broadcast
- `Action` discriminated union: Client submits these, server validates and applies
- `GameEvent` union: Server broadcasts these alongside state updates
- `isActionLegalInPhase()`: FSM validation already built into engine

### Established Patterns
- Pure functional approach: `applyAction` never mutates input, returns new state
- All types in `packages/game-engine/src/types.ts` — single source of truth
- Vitest for testing with injectable RNG for deterministic tests
- npm workspaces monorepo structure

### Integration Points
- `packages/server` imports from `@catan/game-engine` (workspace dependency)
- `ActionResult.error` string signals invalid actions — server maps to error events
- `ActionResult.events` array provides game events for broadcast
- `GameState` serialized directly to Socket.IO clients (with filtering)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-server-and-lobby*
*Context gathered: 2026-02-28*
