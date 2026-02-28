# Project Research Summary

**Project:** Catan Web — Browser-based multiplayer Catan with bot AI
**Domain:** Real-time multiplayer browser board game (hex grid, turn-based)
**Researched:** 2026-02-28
**Confidence:** MEDIUM (stack versions need npm verification; rules and architecture are HIGH)

## Executive Summary

Catan Web is a real-time multiplayer board game requiring careful separation of three distinct concerns: a pure rules engine, a real-time server layer, and a browser rendering client. Research across all four domains converges on the same architectural recommendation: treat the game engine as a shared, framework-free TypeScript package that is the single source of truth for rules, imported by both the server (for authoritative enforcement) and the client (for UX affordances like valid placement highlighting). The server holds all authoritative game state; clients are display terminals. This is not an optional design choice — it is the foundational pattern that prevents cheating, avoids state divergence bugs, and enables thorough testing before any networking code is written.

The most important strategic decision for build order is to resist the urge to build the UI first. All four research files independently converge on the same build sequence: game engine first (pure TypeScript, fully testable), then server infrastructure, then bot AI (enabling full simulated games without a browser), then the React client. This order means every layer is independently verifiable before the next is added. The pitfalls research makes clear that getting the hex coordinate system and vertex/edge identity model wrong early causes rewrites — these must be correct in Phase 1, before any rule enforcement code is written.

The primary risks are concentrated in Phase 1 (hex grid data model) and are well-documented with clear mitigations. The longest road algorithm, initial placement snake order, and the state machine for turn flow are all places where naive implementations produce subtle bugs that surface late. Building against a comprehensive unit test suite for the game engine — before any UI or networking — is the single most important risk mitigation across the entire project.

---

## Key Findings

### Recommended Stack

The stack is a pnpm monorepo with three packages: `game-engine` (pure TypeScript, no framework), `server` (Fastify + Socket.IO + Node.js 22 LTS), and `client` (React 19 + Vite 6 + Zustand + Tailwind CSS 4). The game board renders via inline SVG in React — not canvas, not a game engine library. SVG elements are DOM nodes, individually addressable, hover/click capable, and require zero extra dependencies. For a static 19-hex board this is unambiguously correct.

Socket.IO 4.x is the right real-time layer. Its room primitive maps directly to "a game session," automatic reconnection handling is a requirement, and at personal/friends scale there are no performance reasons to reach for a raw WebSocket. Bots run server-side as player slots — not separate processes, not WebSocket clients. They call the same `applyAction()` path as human players, which means the rule enforcer catches illegal bot moves automatically.

**Core technologies:**
- **React 19 + Vite 6:** UI rendering and build toolchain — concurrent rendering, fast HMR for visual iteration
- **TypeScript 5.x (shared):** Shared types between all three packages — prevents translation-layer bugs
- **SVG via React:** Hex board rendering — DOM-addressable, no extra library, correct for static board games
- **Zustand 5.x + Immer:** Client state — replaces full state on server push; immutable updates for bot simulation
- **Socket.IO 4.x:** Real-time bidirectional events — room management, reconnection, event routing included
- **Fastify 5.x + Node.js 22 LTS:** HTTP API (lobby) + WebSocket server host — TypeScript-first, schema validation
- **pnpm workspaces:** Monorepo — shared `game-engine` package importable by server and client
- **Vitest 2.x:** Game engine unit tests — same config as Vite, runs in Node without a browser
- **Playwright 1.x:** E2E tests for 3-5 critical browser paths

See `/home/chris/projects/catan-gst/.planning/research/STACK.md` for full rationale and alternatives considered.

### Expected Features

The game divides cleanly into a two-stage MVP. Stage 1 is solo-vs-bots (no networking): board generation, full rules engine, local game loop, bot AI, and board UI. Stage 2 adds WebSocket room infrastructure and server-authoritative state. This matches the project's stated priority and ensures the game is rules-correct before networking complexity is layered on.

**Must have (table stakes):**
- Complete Catan base game rules — hex board generation, all build actions, dice/resource distribution, robber mechanics, dev card deck, longest road, largest army, win detection
- Lobby system — create/join room by 6-char code, display name (no auth), configurable bot count (0-3 bots), host-starts game
- Real-time sync — server-authoritative state, WebSocket broadcasts, reconnect/rejoin with session token
- Bot AI — full rules-compliant play, initial placement, trading, building, robber placement, dev card usage with 500ms artificial delay
- Board UI — SVG hex grid, all piece indicators, valid placement highlights, full HUD (hand, scores, dice, game log)

**Should have (differentiators):**
- Animated dice roll and piece placement transitions
- Bot "thinking" delay that feels natural
- Color-coded game log with event toasts
- Rematch button (core social loop for friends play)
- Dark mode
- Sound effects (user-toggleable)
- Auto-end turn when no valid moves remain

**Defer to v2+:**
- Player-to-player trading — doubles UI complexity; bank/port trading covers most strategic needs
- Spectator mode — explicitly out of scope per PROJECT.md
- Chat — unnecessary for friends use
- User accounts / auth — room codes + display names are sufficient
- Expansions (Seafarers, Cities & Knights) — separate rules systems, out of scope
- Public matchmaking — not needed for friends-only sessions

See `/home/chris/projects/catan-gst/.planning/research/FEATURES.md` for full feature table with complexity ratings.

### Architecture Approach

The architecture is "thin client, fat server": clients send action intents over WebSocket, the server validates against its authoritative game state using the pure game engine, and broadcasts full state snapshots to all room members. The client state store (Zustand) is a read-only projection of the last server broadcast — it never computes new game state. Private information (player hands) is filtered per-player before broadcast: each client sees its own full hand and other players' counts only.

**Major components:**
1. **`packages/game-engine` (pure TypeScript)** — `applyAction(state, action) → {newState, events, error}`; no I/O, no randomness, fully unit-testable; shared between server and client
2. **Game Session Manager (server)** — owns room lifecycle: player slots, bot slots, game start/end, `roomId → GameInstance` map
3. **Bot AI Runner (server)** — server-side player slots; calls `applyAction()` same path as humans after artificial delay; cannot produce illegal moves
4. **WebSocket Server (Socket.IO)** — room-based broadcasting, connection management, action routing
5. **HTTP API (Fastify)** — REST endpoints for lobby CRUD (create room, list rooms, join by code); WebSocket only after room join
6. **React UI + Zustand Store (client)** — renders state snapshot, dispatches action intents, never touches game logic directly

Key patterns: pure game engine, server as single source of truth, action-event separation (players send intents, server emits facts), room-based session isolation, bot-as-server-slot.

See `/home/chris/projects/catan-gst/.planning/research/ARCHITECTURE.md` for data flow diagrams and anti-patterns.

### Critical Pitfalls

1. **Wrong hex coordinate system** — Use cube coordinates (q, r, s where q+r+s=0) internally from day one. Offset coordinates make neighbor lookups and the longest road algorithm substantially harder. This is unrecoverable without a rewrite if caught after game logic is written. Reference: redblobgames.com/grids/hexagons.

2. **Duplicate vertex/edge objects per hex** — Build a canonical global vertex and edge index at board initialization. Each vertex gets a globally unique ID; hexes hold ID references, not copies. Without this, settlement placement only updates one of several duplicate vertex records — rule enforcement is silently broken.

3. **No game flow state machine** — Model turn phases as an explicit FSM (`SETUP_FORWARD`, `SETUP_REVERSE`, `PRE_ROLL`, `POST_ROLL`, `ROBBER_PLACEMENT`, `ROBBER_STEAL`, `GAME_OVER`) from the start. Boolean flag soup makes illegal action combinations possible and every new feature requires auditing all existing flags.

4. **Longest road algorithm complexity** — Implement as a trail search tracking visited edges per DFS branch, not visited vertices. Opponent settlements break road continuity through a vertex. Test with loops, Y-shapes, and broken chains before integrating into win condition checks.

5. **Race condition between bot actions and human input** — Use a serial action queue. All actions (human and bot) enqueue and process one at a time. Without this, async bot setTimeout fires can interleave with human WebSocket events against the same state object.

6. **Client-authoritative state** — Never allow clients to mutate their local game state before server confirmation. If `gameState.placeSettlement()` is called client-side before receiving server ack, the architecture is wrong. This is a full architectural rewrite to fix late.

See `/home/chris/projects/catan-gst/.planning/research/PITFALLS.md` for the full list of 20 pitfalls with detection and phase tags.

---

## Implications for Roadmap

All four research files independently converge on a 5-phase build order. The dependency graph is deterministic: the game engine must exist before the server can host it; the server must exist before bots can run in it; bots must work before a human client is worth building against; and reconnect/polish comes last when the core product is solid.

### Phase 1: Game Engine (Pure TypeScript, No Networking)

**Rationale:** Everything else depends on this. It is independently testable with no infrastructure. Bugs caught here are cheap; bugs caught in Phase 4 require touching three packages. This phase forces resolution of the two highest-stakes architectural decisions: cube coordinate system and global vertex/edge identity.

**Delivers:**
- Cube-coordinate hex grid with canonical vertex/edge index
- `GameState` TypeScript types shared across all packages
- FSM-based turn phase model (`PRE_ROLL`, `POST_ROLL`, `ROBBER_PLACEMENT`, etc.)
- `validateAction` + `applyAction` for all Catan rules (placement, build, dice, robber, dev cards, trading, win detection)
- Longest road trail algorithm with edge-tracking DFS
- Comprehensive unit test suite (this is the Catan rulebook as code)

**Features addressed:** All table-stakes game rules from FEATURES.md (hex board, placement, trading, dev cards, longest road/largest army, win detection)

**Pitfalls to avoid:** Pitfall 1 (hex coords), Pitfall 2 (vertex identity), Pitfall 5 (state machine), Pitfall 6 (longest road), Pitfall 9 (robber rules), Pitfall 10 (initial placement snake order), Pitfall 11 (port trading rates), Pitfall 13 (VP card rules), Pitfall 14 (7-roll branch), Pitfall 17 (dev card play-on-draw-turn), Pitfall 18 (road building edge case)

**Research flag:** Standard patterns — no additional research needed. Hex grid theory (redblobgames), Catan rules, and FSM patterns are all well-documented.

### Phase 2: Server Infrastructure (WebSocket + HTTP API)

**Rationale:** Game engine must exist before it can be hosted. Server is fully testable without a browser using wscat or Postman. This phase establishes the authoritative server pattern and room management before any client exists to complicate things.

**Delivers:**
- Fastify HTTP API: create room, list rooms, join by code
- Socket.IO WebSocket server with room-based broadcasting
- Game Session Manager: room lifecycle, player slot assignment, game start/end
- Action queue (serial processing — prevents bot/human race conditions)
- Per-player state view generation (hand visible to owner; count-only to others)
- Full state snapshot broadcast on every state change

**Architecture implemented:** WebSocket Server, HTTP API, Game Session Manager components

**Pitfalls to avoid:** Pitfall 3 (client-authoritative state), Pitfall 4 (mutable shared state race), Pitfall 7 (reconnection without session resumption), Pitfall 8 (bot/human race condition via action queue)

**Research flag:** Standard patterns — Socket.IO room management, Fastify setup, action queue pattern are all well-documented.

### Phase 3: Bot AI

**Rationale:** Bots require Phase 1 (game engine) and Phase 2 (session manager). Once bots work, a full simulated game can run server-side without any browser — invaluable for stress-testing rules and bot logic. Completing this phase means a human can load the client and immediately have opponents.

**Delivers:**
- Bot player slot type (no WebSocket, server-driven)
- Heuristic scoring for: initial placement (pip count + diversity), road extension (toward viable settlement vertex), building priority (settlement > city > dev card), dev card usage, bank/port trading trigger
- Forcing function: after N idle turns, bot takes best available action regardless of score threshold
- Bot runner integrated into Game Session Manager with 500-1500ms artificial delay
- Bot-vs-bot simulation capability for testing

**Pitfalls to avoid:** Pitfall 12 (bot local optimum/idle), Pitfall 8 (race condition — already addressed by action queue in Phase 2)

**Research flag:** MEDIUM confidence on bot heuristics — specific scoring weights will need tuning. No additional research phase needed, but expect iteration during implementation. Run 100+ bot-vs-bot games to validate game length is reasonable.

### Phase 4: Browser Client (React UI)

**Rationale:** Client is built against a fully working server+bots. Development is dramatically easier when you can load a URL and have bots play against you immediately. The board rendering choices (SVG via React) are settled — no prototyping needed.

**Delivers:**
- SVG hex board renderer (flat-top or pointy-top — pick one, be consistent)
- Click detection via precomputed vertex/edge pixel positions with distance threshold (not bounding boxes)
- Zustand client store receiving server state broadcasts
- Action dispatch: player clicks → intent messages → WebSocket → server
- Full in-game HUD: resource hand, dev card hand, dice result, scoreboard, game log, building cost reference
- Lobby UI: create/join room, configure bots, player ready list
- Valid placement highlighting (client computes for UX; server re-validates all moves)

**Features addressed:** All UI board rendering and HUD features from FEATURES.md

**Pitfalls to avoid:** Pitfall 15 (click detection via distance-to-vertex, not bounding boxes), Anti-pattern 1 (game logic in client — client highlights are UX only, server re-validates)

**Research flag:** Standard patterns — React + SVG board rendering is well-documented. No additional research needed.

### Phase 5: Multiplayer Polish and Reconnection

**Rationale:** Core product must be solid before polish. Reconnection handling has specific UX implications (session tokens, grace period, bot takeover during disconnect) that need the entire stack working to test properly.

**Delivers:**
- Session token reconnect: UUID in sessionStorage, 60-120s grace period on server, full state re-send on rejoin
- Disconnect handling: mark player disconnected, optional bot takeover during grace period
- Animated dice roll and piece placement transitions
- Color-coded game log with event toast notifications
- Rematch button
- End-game screen with final scores
- Dark mode (CSS custom properties)
- Sound effects (user-toggleable)

**Features addressed:** Differentiator features from FEATURES.md (animations, rematch, toasts, dark mode)

**Pitfalls to avoid:** Pitfall 7 (reconnection — session tokens and grace period), Pitfall 20 (Monopoly aggregate-only broadcast)

**Research flag:** Standard patterns — reconnection with session tokens is well-documented. No additional research needed.

### Phase Ordering Rationale

- **Dependency-driven order:** The game engine is a prerequisite for every other phase. No phase can be reordered without creating a dependency gap.
- **Test-first validation:** Each phase produces a testable artifact before the next phase begins. Bugs are caught in the cheapest context.
- **Pitfall front-loading:** All critical architectural pitfalls (cube coords, vertex identity, FSM, authoritative server, action queue) are addressed in Phases 1-2. Phases 3-5 deal with moderate and minor pitfalls only.
- **Features.md two-stage MVP:** This phase structure directly implements the FEATURES.md recommendation: Stage 1 (solo-vs-bots) = Phases 1-4 without networking; Stage 2 (real-time multiplayer) = Phase 2 and 5.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 3 (Bot AI):** Heuristic scoring weights for settlement placement and building priority will need empirical tuning. Plan for multiple iteration cycles and bot-vs-bot simulation runs to validate. No external research needed — this is calibration work.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Game Engine):** Hex grid theory is canonical (redblobgames), Catan rules are fixed and well-documented, FSM patterns are established.
- **Phase 2 (Server Infrastructure):** Socket.IO room patterns, Fastify setup, and action queue pattern are all thoroughly documented.
- **Phase 4 (Browser Client):** React + SVG board rendering is well-documented; Zustand client store pattern is established.
- **Phase 5 (Polish):** CSS animations, session token reconnect, and toast patterns are standard web development.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | All technology choices are correct; specific version numbers need npm verification before pinning. Core choices (React, Socket.IO, SVG, pnpm workspaces) are HIGH confidence; Zustand 5.x and Fastify 5.x release status needs verification. |
| Features | HIGH | Catan rules are fixed and authoritative. The feature division (table stakes / differentiators / anti-features) is well-grounded. Web search was restricted so competitor feature comparisons are training-knowledge-only, but this does not affect the core game feature set. |
| Architecture | HIGH | "Thin client, fat server" with server-authoritative state is established industry pattern for real-time multiplayer games. Patterns are stable and confirmed by boardgame.io, Colyseus, Lichess, and Socket.IO documentation. |
| Pitfalls | HIGH | Hex coordinate pitfalls are canonical. Catan rule pitfalls are sourced from official rulebook and known FAQ items. WebSocket pitfalls are established patterns. Bot AI pitfalls are MEDIUM — implementation-specific. |

**Overall confidence:** MEDIUM-HIGH — the architectural foundation and feature scope are solid. The primary uncertainty is npm package version verification, not design decisions.

### Gaps to Address

- **Package version pinning:** Verify React 19.x, Zustand 5.x, Fastify 5.x, Vite 6.x, Tailwind 4.x, Vitest 2.x, Immer 10.x, Playwright 1.x against current npm registry before starting Phase 1. See the version table in STACK.md.
- **Hex orientation choice:** Flat-top vs pointy-top hex orientation must be decided before Phase 4 (rendering). Both work; the pixel conversion formulas differ. Choose one at game engine design time and document it — the rendering phase cannot start without this.
- **Player-to-player trading deferral:** FEATURES.md defers this to v2. If the project owner wants it in v1, the UI complexity estimate should be revisited. The server-side implementation is straightforward (trade offer state in FSM), but the offer/counter-offer UI is the blocker.
- **Bot difficulty tuning:** Phase 3 confidence is MEDIUM. Budget time for bot-vs-bot simulation and heuristic calibration. The forcing function (build after N idle turns) is essential but threshold values need empirical testing.

---

## Sources

### Primary (HIGH confidence)
- Official Catan rulebook and FAQ (Catan GmbH) — all game rules and edge cases
- Redblobgames hex grid guide (redblobgames.com/grids/hexagons) — cube coordinates, vertex/edge topology, pixel conversion
- boardgame.io open-source framework — architectural patterns for authoritative server, action-event model
- Colyseus multiplayer game server — room-based session patterns
- Lichess open-source chess server — thin client / fat server model at scale
- Socket.IO v4 documentation (socket.io/docs/v4) — room primitives, reconnection, event routing

### Secondary (MEDIUM confidence)
- React 19 release notes (react.dev) — concurrent rendering model
- Vite 6 release notes (vitejs.dev) — HMR and build configuration
- Zustand documentation (github.com/pmndrs/zustand) — flat store model, server-state replacement pattern
- Fastify documentation (fastify.dev) — TypeScript support, plugin ecosystem
- Tailwind CSS v4 documentation (tailwindcss.com) — zero-config JIT engine
- Training knowledge of colonist.io, catan.com, BoardGameArena implementations (mid-2025) — feature landscape

### Tertiary (LOW confidence)
- Specific npm package version numbers — all listed versions require verification against current npm registry before implementation begins

---
*Research completed: 2026-02-28*
*Ready for roadmap: yes*
