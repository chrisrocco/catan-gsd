# Architecture Patterns

**Domain:** Real-time multiplayer browser board game (Catan base game)
**Researched:** 2026-02-28
**Confidence:** HIGH — established patterns, confirmed by boardgame.io, colyseus, lichess, and other open-source multiplayer game codebases

---

## Recommended Architecture

### Overview

A "thin client, fat server" model where the server is the single source of truth for all game state. Clients send player actions (intents); the server validates, mutates state, and broadcasts the new authoritative state to all players in the room. Bots live server-side and participate identically to human players from the game engine's perspective.

```
┌─────────────────────────────────────────────────────┐
│                   BROWSER CLIENT                    │
│                                                     │
│  ┌──────────────┐    ┌──────────────────────────┐  │
│  │  React UI    │◄───│  Client State Store       │  │
│  │  (render     │    │  (local copy of server    │  │
│  │   only)      │    │   game state, read-only)  │  │
│  └──────┬───────┘    └──────────────┬────────────┘  │
│         │ user action               │ state update   │
│         ▼                           ▲               │
│  ┌──────────────┐    ┌──────────────┴────────────┐  │
│  │  Action      │───►│  WebSocket Client          │  │
│  │  Dispatch    │    │  (send actions, receive    │  │
│  │              │    │   state broadcasts)        │  │
│  └──────────────┘    └──────────────┬─────────────┘  │
└──────────────────────────────────────┼───────────────┘
                                       │ WebSocket
┌──────────────────────────────────────┼───────────────┐
│                SERVER                │               │
│                                      │               │
│  ┌──────────────────────────────────▼─────────────┐ │
│  │               WebSocket Server                  │ │
│  │  (Socket.IO or ws — manages rooms/connections)  │ │
│  └─────────────────────┬───────────────────────────┘ │
│                        │                             │
│  ┌─────────────────────▼───────────────────────────┐ │
│  │              Game Session Manager                │ │
│  │  (lobbies, player slots, bot slots, game start)  │ │
│  └─────────────────────┬───────────────────────────┘ │
│                        │                             │
│  ┌─────────────────────▼───────────────────────────┐ │
│  │              Game Engine (Core)                  │ │
│  │                                                  │ │
│  │  ┌──────────────────────────────────────────┐   │ │
│  │  │  Game State                              │   │ │
│  │  │  - Board (hex grid, tiles, tokens)       │   │ │
│  │  │  - Players (hand, roads, settlements)    │   │ │
│  │  │  - Bank (resources, dev cards)           │   │ │
│  │  │  - Turn phase (setup, main, robber, etc) │   │ │
│  │  │  - Dice result, largest army, longest    │   │ │
│  │  │    road, victory points                  │   │ │
│  │  └──────────────────────────────────────────┘   │ │
│  │                                                  │ │
│  │  ┌──────────────────────────────────────────┐   │ │
│  │  │  Rule Enforcer                           │   │ │
│  │  │  - validate(action, state) → ok | error  │   │ │
│  │  │  - apply(action, state) → newState       │   │ │
│  │  └──────────────────────────────────────────┘   │ │
│  └─────────────────────┬───────────────────────────┘ │
│                        │                             │
│  ┌─────────────────────▼───────────────────────────┐ │
│  │              Bot AI Runner                       │ │
│  │  (server-side; calls game engine actions on      │ │
│  │   behalf of bot players, same path as humans)    │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  ┌──────────────────────────────────────────────────┐ │
│  │              HTTP API                             │ │
│  │  (lobby CRUD, room creation, join by code)        │ │
│  └──────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With | Lives In |
|-----------|---------------|-------------------|----------|
| **React UI** | Render board and controls from state snapshot. Accept user gestures. Never compute game logic. | Client State Store (read), Action Dispatch (write) | Browser |
| **Client State Store** | Hold the latest server-pushed game state snapshot. Derive display values (valid placements, resource counts). No mutation logic. | WebSocket Client (receives updates), React UI (provides data) | Browser |
| **WebSocket Client** | Maintain persistent connection. Send player actions as JSON messages. Receive state broadcasts. Handle reconnect. | Server WebSocket layer | Browser |
| **WebSocket Server** | Accept connections. Route messages to Game Session Manager. Broadcast state diffs or snapshots to room members. | WebSocket Client (N connections), Game Session Manager | Server |
| **Game Session Manager** | Owns the lifecycle of a game room: player join/leave, slot assignment, bot slot creation, game start/end. Keeps a map of `roomId → GameInstance`. | WebSocket Server, Game Engine, HTTP API | Server |
| **Game Engine (Core)** | Pure functional logic: validate actions, compute new state. No I/O, no WebSocket, no DB. Input: (state, action) → output: (newState, events). | Game Session Manager (called by), Bot AI (called by) | Server (importable in tests) |
| **Rule Enforcer** | Sub-module of Game Engine. All Catan rules: placement legality, resource costs, robber mechanics, trade ratios, dev card effects, victory condition. | Game Engine only | Server |
| **Bot AI Runner** | For each bot slot: observe current state, decide action, submit action through the same `applyAction()` path as humans. Runs asynchronously on the server after each state change that advances to a bot's turn. | Game Engine, Game Session Manager | Server |
| **HTTP API** | REST endpoints for lobby: list open rooms, create room, join room by code. Returns room metadata. WebSocket upgrade handled separately. | Browser (pre-game lobby), Game Session Manager | Server |

---

## Data Flow

### Human Player Makes a Move

```
1. Player clicks UI element (e.g., "Build Settlement at vertex 7")
2. React UI dispatches action object: { type: "BUILD_SETTLEMENT", vertex: 7 }
3. WebSocket Client sends JSON to server: { roomId, playerId, action }
4. Server WebSocket receives message, identifies room
5. Game Session Manager routes to GameInstance
6. Game Engine: validate(action, currentState)
   - INVALID: server sends error back to that player only; state unchanged
   - VALID: game engine applies action → produces newState + event list
7. Game Session Manager updates GameInstance state
8. Server broadcasts newState to ALL connections in the room (JSON)
9. Each client's WebSocket Client receives broadcast
10. Client State Store updates with new snapshot
11. React UI re-renders from new state
```

### Bot Takes a Turn

```
1. After step 7 above, Game Session Manager checks: is it a bot's turn?
2. YES: Bot AI Runner is invoked with currentState
3. Bot computes decision (synchronous or async with small delay for UX)
4. Bot submits action through same applyAction() call as humans
5. Goes to step 6 above — identical path, no special cases
```

### State Broadcast Strategy

Broadcast **full state snapshots** (not diffs) for simplicity during initial development. Catan state is modest in size (< 10KB JSON for a full game state). Switch to delta/event-based broadcasting only if profiling reveals issues.

**What each player receives:** A view of game state that includes their own hand fully visible and other players' resource counts but NOT card details (hand size only until trades occur). The server computes each player's view before sending.

---

## Patterns to Follow

### Pattern 1: Pure Game Engine

**What:** The game engine is a pure module — `applyAction(state, action) → { newState, events, error }`. No side effects. No network calls. No randomness injected from outside (dice results passed in, not rolled inside).

**When:** Always. This is the foundation.

**Why:** Enables deterministic unit testing of every rule. Enables server-side bot AI to call the same code as player validation. Enables replay.

**Example:**
```typescript
// Pure function — no I/O
function applyAction(state: GameState, action: GameAction): ActionResult {
  const error = validateAction(state, action);
  if (error) return { ok: false, error };
  const newState = produce(state, draft => {
    // immer-style mutation of draft
    applyMutation(draft, action);
  });
  return { ok: true, newState, events: deriveEvents(state, newState) };
}
```

### Pattern 2: Server as Single Source of Truth

**What:** No game logic runs in the browser. The client only renders state it received from the server. If the server rejects an action, the client reverts any optimistic UI.

**When:** Always for rule-enforced games.

**Why:** Prevents cheating. Ensures all players see consistent state. Simplifies debugging — one place to audit.

**Practical note:** For Catan (turn-based, not twitch-based), do NOT implement optimistic updates. Show pending state only when UX demands it (e.g., dice roll animation). Wait for server confirmation before updating the board.

### Pattern 3: Action-Event Architecture

**What:** Players send **actions** (intentions). The server emits **events** (facts). Actions are ephemeral; events describe what happened.

**When:** Helpful once multiple things need to react to game changes (UI animations, sound, chat, bots).

**Example:**
```
Action:  { type: "ROLL_DICE" }
Events:  [
  { type: "DICE_ROLLED", result: [3, 4] },
  { type: "RESOURCES_DISTRIBUTED", gains: { alice: {wood:1}, bob: {ore:2} } },
  { type: "ROBBER_TRIGGERED" }   // if roll was 7
]
```

### Pattern 4: Room-Based Session Isolation

**What:** Each game session is a room with its own isolated game state. The room ID is the unit of multiplayer coordination.

**When:** Always for multi-session systems.

**Implementation:** Socket.IO `room` primitive maps directly to this. All broadcasts use `io.to(roomId).emit(event, data)`.

### Pattern 5: Bot as Server-Side Player Slot

**What:** Bots are not separate processes. They are player slots in a game session that happen to have their decision logic run on the server. They do not connect via WebSocket — the server calls their logic directly.

**When:** Simplest bot integration path.

**Why:** No networking overhead. Bots participate in the same validation path — impossible for buggy bot code to make illegal moves without hitting the rule enforcer. Bot delay is controlled (add artificial setTimeout for UX).

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Game Logic in the Client

**What:** Implementing rule validation in the browser (e.g., computing valid settlement placements client-side and trusting that result).

**Why bad:** Clients can be modified. Any logic in the browser is not authoritative. Leads to state divergence bugs.

**Instead:** Client may compute valid options for UI highlighting (as a UX aid), but the server always re-validates before accepting. Duplication is acceptable and correct.

### Anti-Pattern 2: Mutable Shared State Object

**What:** Storing game state in a directly mutated object passed around the server.

**Why bad:** Race conditions if async bot AI or network events interleave. Hard to unit test. Hard to audit state changes.

**Instead:** Treat game state as immutable. Each action produces a new state. Use immer or spread copying. Mutation happens only inside `applyAction`.

### Anti-Pattern 3: WebSocket-Only Architecture (No HTTP)

**What:** Doing everything (lobby, room creation, join) over WebSocket from day one.

**Why bad:** Makes pre-game flows complex. Room listing, room creation, and join-by-code are naturally REST operations (request-response, not push-based).

**Instead:** Use HTTP REST for lobby/room CRUD. Switch to WebSocket only after the player joins a room. Simpler, cacheable, standard.

### Anti-Pattern 4: Full State Diff Protocol Too Early

**What:** Implementing a delta/patch protocol (JSON Patch, binary diff) before the product works end-to-end.

**Why bad:** Premature optimization. Catan game state is small. Diff logic is complex and a source of desync bugs.

**Instead:** Broadcast full state snapshots. Optimize later only if needed.

### Anti-Pattern 5: Per-Turn Persistence to a Database

**What:** Writing game state to a database on every action.

**Why bad:** Adds latency to every move. Adds a hard dependency that blocks development of game logic.

**Instead:** Hold game state in server memory. Add optional persistence (Redis or SQLite for session recovery) only if reconnect/resume is a requirement. Per PROJECT.md, this is personal-use scope — in-memory is sufficient.

---

## Suggested Build Order

This ordering ensures each phase is independently testable and that later phases never require rewriting earlier ones.

### Phase 1: Game Engine (Pure, No Networking)

Build the game engine as a pure TypeScript module. No server, no browser.

Deliverables:
- Board generation (hex grid, randomized tiles and tokens)
- Game state type definitions
- `validateAction` + `applyAction` for all rule types
- Full unit test coverage for rules

**Why first:** Everything else depends on it. Testable without any infrastructure. Bugs found here are cheap to fix.

### Phase 2: Server Infrastructure (WebSocket + HTTP)

Wrap the game engine in a Node.js server.

Deliverables:
- HTTP API: create room, list rooms, join by code
- WebSocket server with room-based broadcasting
- Game Session Manager (room lifecycle, player slots)
- Integration: game engine called on action receipt, state broadcast on change

**Why second:** Game engine must exist before it can be hosted. Server is testable without a browser (use wscat or Postman).

### Phase 3: Bot AI

Implement bot player logic on the server.

Deliverables:
- Bot player slot type (no WebSocket connection, server-driven)
- Bot decision logic: strategic settlement placement, resource-aware building, basic dev card use
- Bot runner integrated into Game Session Manager (auto-advances on bot turns)

**Why third:** Bots require the game engine (Phase 1) and the session manager (Phase 2). With bots, you can run a full simulated game without a browser — invaluable for testing.

### Phase 4: Browser Client (React UI)

Build the browser client against the now-working server.

Deliverables:
- Hex board renderer (canvas or SVG)
- Game state store (receives server broadcasts)
- Action dispatch (sends player actions over WebSocket)
- All in-game UI: hand display, building controls, dice roll, trade panel, dev cards
- Lobby UI: create/join room

**Why fourth:** Client can be built against a fully working server+bots. Development is easier when you can load a URL and have bots play against you immediately.

### Phase 5: Multiplayer Polish

Deliverables:
- Reconnect handling (rejoin room by ID, re-receive current state)
- Player-visible event log ("Alice rolled a 7. Bob placed the robber.")
- Turn timer (optional — prevents stalled games)
- End-game screen with final scores

**Why last:** Core product must be solid before adding polish.

---

## Scalability Considerations

| Concern | At 1-10 concurrent games | At 100+ concurrent games | Notes |
|---------|--------------------------|--------------------------|-------|
| State storage | In-process JS Map | Redis for state + pub/sub | Not needed for personal-use scope |
| WebSocket connections | Single Node.js process handles easily | Multiple processes + sticky sessions | Not needed for personal-use scope |
| Bot CPU | Synchronous per-turn call is fine | Worker threads or async queue | Catan bot logic is low CPU — not a concern |
| Game persistence | None needed | SQLite or Postgres for game history | Out of scope per PROJECT.md |

**Recommendation:** For personal/friends use (simultaneous games in single digits), a single Node.js process with in-memory state is entirely sufficient. Do not prematurely architect for scale.

---

## How Server-Side Rule Enforcement Works with Real-Time Clients

The flow for every action:

1. Client sends action intent over WebSocket
2. Server receives, calls `validateAction(currentState, action)`
3. If invalid: server sends `{ type: "ACTION_REJECTED", reason: "..." }` back to that player only. Client shows error message. No state change.
4. If valid: server calls `applyAction(currentState, action)`, updates session state, broadcasts new state to all room members
5. All clients (including the acting player) update their local state from the broadcast

This means the client never trusts its own prediction of what the new state will be. The server's broadcast is always the ground truth. For a turn-based game like Catan (moves take seconds, not milliseconds), this round-trip latency is imperceptible.

**Private information (player hands):** The server must compute a view per player before broadcasting. Each player receives:
- Their own hand: full details
- Other players' hands: resource counts only (no card identities)
- Dev card deck: count only, not contents

---

## How Bots Integrate

Bots are **not** WebSocket clients. They are server-side objects that implement the same interface as a player action submission.

```typescript
interface PlayerSlot {
  id: string;
  type: 'human' | 'bot';
  // For human: connected WebSocket socket
  // For bot: null — server drives the turn
}
```

After each state transition, the Game Session Manager checks:
```
currentState.activePlayer.type === 'bot'
  → schedule botAI.decideTurn(state) with a short delay (500-1500ms for UX)
  → submit resulting action through the normal applyAction path
  → broadcast updated state as usual
```

This means bots cannot bypass rule validation. If a bot AI bug produces an illegal action, the rule enforcer rejects it just like a human's illegal move. Bot logic only needs to produce plausible actions — the engine ensures correctness.

**Bot AI approach for Catan:**
- Settlement placement: score vertices by pip count and resource diversity
- Road placement: extend toward best unoccupied vertex
- Building priority: settlement > city > dev card, weighted by resource availability
- Dev card use: knight before rolling if behind on army count; others situationally
- No look-ahead search needed for "reasonably competitive" — greedy heuristics are sufficient

---

## Sources

All findings based on established patterns from:
- boardgame.io open-source framework architecture (HIGH confidence — well-documented public framework)
- Colyseus multiplayer game server architecture (HIGH confidence — well-documented public framework)
- Lichess (chess) open-source architecture (HIGH confidence — public codebase)
- General real-time multiplayer game design literature (HIGH confidence — stable domain knowledge)
- socket.io room-based broadcasting patterns (HIGH confidence — stable since v2)

Note: External research tools were unavailable during this session. All findings are drawn from training knowledge of established, stable architectural patterns. The "thin client, fat server" and "authoritative server" patterns are industry standard and have not materially changed since 2018. Confidence is HIGH for this domain.
