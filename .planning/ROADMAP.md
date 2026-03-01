# Roadmap: Catan Web

## Overview

Build a fully playable browser-based Catan implementation in five phases, ordered by dependency. The game engine is pure TypeScript with no I/O and comes first — it is the foundation every other phase builds on. Server infrastructure and rooms come next, then bots (enabling full simulated games without a browser), then the React client (built against a working server), then reconnection handling and multiplayer polish. Each phase delivers a independently testable artifact before the next begins.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Game Engine** - Pure TypeScript rules engine with no networking; the authoritative Catan rulebook as code (completed 2026-03-01)
- [ ] **Phase 2: Server and Lobby** - Fastify HTTP API, Socket.IO WebSocket server, room lifecycle, and authoritative game session hosting
- [ ] **Phase 3: Bot AI** - Server-side bot players that take fully legal turns using heuristic strategy
- [ ] **Phase 4: Browser Client** - React + SVG board, full HUD, lobby UI, and Zustand client state wired to the server
- [ ] **Phase 5: Multiplayer Polish and Reconnection** - Reconnect/rejoin handling and multiplayer end-game polish

## Phase Details

### Phase 1: Game Engine
**Goal**: A complete, fully tested Catan rules engine exists as a pure TypeScript package that any phase can import
**Depends on**: Nothing (first phase)
**Requirements**: GAME-01, GAME-02, GAME-03, GAME-04, GAME-05, GAME-06, GAME-07, GAME-08, GAME-09, GAME-10, GAME-11, GAME-12, GAME-13, GAME-14
**Success Criteria** (what must be TRUE):
  1. A randomized 19-hex board generates with valid resource and number token placement (no red numbers adjacent), verifiable by running the board generator and inspecting output
  2. All build actions (road, settlement, city, dev card) are rejected when the player lacks required resources or placement is illegal
  3. A full game can be simulated end-to-end in code (no browser) — initial placement, turns, resource distribution, robber, dev cards, trading — until a player reaches 10 VP and the game ends
  4. Longest road and largest army awards transfer correctly in edge cases (ties keep current holder, road breaks update the holder)
  5. The turn-phase state machine prevents out-of-order actions (e.g., building before rolling, playing a dev card bought this turn)
**Plans**: 6 plans identified
- [x] 01-01: Monorepo scaffold and core type definitions (complete)
- [x] 01-02: Board generation (complete)
- [x] 01-03: Turn-phase FSM, placement validation, and action dispatcher (complete)
- [x] 01-04: Dice rolling, resource distribution, and robber mechanics (complete)
- [x] 01-05: Trading module — port rate resolution and build cost validation (complete)
- [x] 01-06: Dev card lifecycle — buy, play all card types, end turn (complete)

### Phase 2: Server and Lobby
**Goal**: A running server hosts game sessions with real-time state sync; players can create and join rooms via room code
**Depends on**: Phase 1
**Requirements**: ROOM-01, ROOM-02, ROOM-03, ROOM-04, NET-01, NET-02
**Success Criteria** (what must be TRUE):
  1. A player can create a room and receive a shareable room code, then a second player can join by entering that code and a display name with no account required
  2. The host can configure 0–3 bot slots and start the game; the game begins only when the host triggers it
  3. Every action submitted by a client is validated server-side; an invalid action (e.g., building without resources) is rejected and the game state does not change
  4. After any state change, all connected clients in the room receive a broadcast of the updated game state within one round-trip
**Plans**: 3 plans identified
- [x] 02-01: Server package scaffold, types, room infrastructure, and game-engine exports update (complete)
- [ ] 02-02: Fastify server, REST routes, lobby Socket.IO handlers, and integration tests
- [ ] 02-03: Game action handler, state broadcast, and integration tests

### Phase 3: Bot AI
**Goal**: Server-side bot players participate in complete games, making legal and strategically reasonable decisions without human input
**Depends on**: Phase 2
**Requirements**: BOT-01, BOT-02, BOT-03, BOT-04, BOT-05, BOT-06
**Success Criteria** (what must be TRUE):
  1. A bot-vs-bot game (no human players) runs to completion server-side without getting stuck, erroring, or producing an illegal move
  2. Bot initial settlement placements cluster around high-probability numbers (6, 8, 5, 9) and show resource type variety across settlements
  3. Bots build roads, settlements, cities, and dev cards during the course of a game and reach 10 VP within a reasonable number of turns
  4. A bot holding excess resources executes a bank or port trade rather than passing indefinitely
  5. A bot uses knight, monopoly, year of plenty, and road building cards during gameplay, not ignoring them in hand
**Plans**: TBD

### Phase 4: Browser Client
**Goal**: A human player can load the app in a browser, join a room, and play a full game against bots with complete board visibility and HUD
**Depends on**: Phase 3
**Requirements**: BOARD-01, BOARD-02, BOARD-03, HUD-01, HUD-02, HUD-03, HUD-04, HUD-05, HUD-06
**Success Criteria** (what must be TRUE):
  1. The hex board renders correctly in the browser — 19 land hexes with resource colors, number tokens with pip dots, port labels on sea hexes, and all pieces (settlements, cities, roads, robber) visible in distinct player colors
  2. During build actions and initial placement, valid vertices and edges are highlighted; clicking an invalid location does nothing
  3. A player can see their own resource hand and unplayed dev cards in a private panel; other players' card counts (not contents) are visible to all
  4. The dice result, current turn phase label, VP scoreboard, game log, and building cost reference are visible and update correctly throughout a game
  5. A human player can play a complete game against bots from lobby creation through win detection using only the browser UI
**Plans**: TBD

### Phase 5: Multiplayer Polish and Reconnection
**Goal**: Players who disconnect can rejoin their in-progress game; a complete multiplayer game between humans and bots works end-to-end
**Depends on**: Phase 4
**Requirements**: NET-03
**Success Criteria** (what must be TRUE):
  1. A player who closes or refreshes the browser tab can rejoin the same game using the original room code and display name, and receives the current game state
  2. The disconnected player's slot remains in the game during the reconnect grace period without breaking other players' turns
  3. Two human players in different browser sessions can play a complete game together, each seeing a correct view of the board and receiving real-time state updates
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Game Engine | 6/6 | Complete   | 2026-03-01 |
| 2. Server and Lobby | 2/3 | In Progress|  |
| 3. Bot AI | 0/TBD | Not started | - |
| 4. Browser Client | 0/TBD | Not started | - |
| 5. Multiplayer Polish and Reconnection | 0/TBD | Not started | - |
