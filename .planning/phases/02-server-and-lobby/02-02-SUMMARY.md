---
phase: 02-server-and-lobby
plan: 02
subsystem: api
tags: [fastify, socket.io, typescript, vitest, tdd, integration-tests]

# Dependency graph
requires:
  - phase: 02-server-and-lobby
    plan: 01
    provides: "RoomSession, roomStore, roomCode, stateFilter, types"
provides:
  - "Fastify HTTP server with GET /health and POST /rooms"
  - "Socket.IO integration via direct Server attachment with fastify-plugin encapsulation breaking"
  - "Lobby Socket.IO handlers: join-room, set-bot-count, start-game, disconnecting/host-migration"
  - "Integration tests for ROOM-01 through ROOM-04 (11 tests)"
affects:
  - 02-03-game-handlers
  - 03-client

# Tech tracking
tech-stack:
  added:
    - "fastify-plugin@^4.5.1 (transitive from root node_modules) — used to break plugin encapsulation so fastify.io is available on root instance"
  patterns:
    - "Direct Socket.IO Server attachment to fastify.server (avoids fastify-socket.io Fastify 5 type incompatibility)"
    - "fastify-plugin wrapping for root-level decorator visibility"
    - "Test timing: set up event listeners BEFORE triggering the action that emits them"
    - "connectAndWait helper for deterministic socket connection in tests"

key-files:
  created:
    - packages/server/src/index.ts
    - packages/server/src/plugins/socketio.ts
    - packages/server/src/routes/health.ts
    - packages/server/src/routes/rooms.ts
    - packages/server/src/socket/lobbyHandlers.ts
    - packages/server/src/__tests__/helpers.ts
    - packages/server/src/__tests__/lobby.test.ts
  modified: []

key-decisions:
  - "Direct Socket.IO attachment used instead of fastify-socket.io plugin — fastify-socket.io v5.1.0 types incompatible with Fastify 5 TypeScript types; direct new Server(fastify.server) works cleanly"
  - "fastify-plugin required to break encapsulation — without it, fastify.io decorator is scoped to the plugin and undefined on the root instance"
  - "Test event listener ordering — waitForEvent must be set up BEFORE the action that emits the event; join-room emits lobby:state, so consume join state before setting up next listener"

patterns-established:
  - "build()/main() pattern for server entry point — build() for test injection, main() for standalone"
  - "broadcastLobbyState helper centralizes lobby:state construction and emission"
  - "disconnecting event (not disconnect) for host migration — socket.rooms still available in disconnecting"

requirements-completed: [ROOM-01, ROOM-02, ROOM-03, ROOM-04]

# Metrics
duration: 4min
completed: 2026-03-01
---

# Phase 2 Plan 2: Fastify Server, Socket.IO Integration, and Lobby Handlers Summary

**Fastify HTTP server with direct Socket.IO attachment, complete lobby flow (room creation, joining, bot config, game start, host migration), and 11 passing integration tests covering ROOM-01 through ROOM-04**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-01T03:42:11Z
- **Completed:** 2026-03-01T03:45:42Z
- **Tasks:** 2
- **Files created:** 7

## Accomplishments

- Created `packages/server/src/index.ts` with `build()` and `main()` entry points
- Implemented Socket.IO plugin using direct `new Server(fastify.server)` attachment with fastify-plugin encapsulation breaking
- Implemented `GET /health` endpoint returning status, room count, and uptime
- Implemented `POST /rooms` endpoint creating rooms and returning code + playerId
- Implemented full lobby handler suite: `join-room`, `set-bot-count`, `start-game`, `disconnecting`
- Created test helpers: `createTestServer`, `connectClient`, `joinRoom`, `waitForEvent`, `connectAndWait`
- 11 new integration tests covering all ROOM requirements; 30 tests passing total

## Task Commits

Each task was committed atomically:

1. **Task 1: Fastify server build, Socket.IO plugin, and REST routes** - `bb1e220` (feat)
2. **Task 2: Lobby Socket.IO handlers and integration tests** - `c824f4d` (feat)

_Note: Task 2 used TDD pattern; infrastructure/helper files written before final implementation verified_

## Files Created/Modified

- `packages/server/src/index.ts` — build() and main() entry points; registers plugins, routes, socket handlers
- `packages/server/src/plugins/socketio.ts` — Direct Socket.IO Server on fastify.server, fastify-plugin for root decorator
- `packages/server/src/routes/health.ts` — GET /health returning { status, rooms, uptime }
- `packages/server/src/routes/rooms.ts` — POST /rooms creating RoomSession, returning { code, playerId }
- `packages/server/src/socket/lobbyHandlers.ts` — join-room, set-bot-count, start-game, disconnecting handlers
- `packages/server/src/__tests__/helpers.ts` — Test utilities: createTestServer, connectClient, joinRoom, waitForEvent, connectAndWait
- `packages/server/src/__tests__/lobby.test.ts` — ROOM-01 through ROOM-04 integration tests (11 tests)

## Decisions Made

- **Direct Socket.IO attachment over plugin** — `fastify-socket.io@5.1.0` types are Fastify-4-era and produce TypeScript errors with Fastify 5 overloads; direct `new Server(fastify.server, opts)` is clean and the plugin still works at runtime for future use
- **fastify-plugin wrapping** — Without `fp()` wrapping, `fastify.decorate('io', io)` is scoped to the child plugin context; the root `app.io` would be `undefined` causing test failures
- **Event listener ordering in tests** — Socket.IO events are delivered asynchronously but may arrive before the test sets up its next listener; pattern: set up listener BEFORE triggering the action

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] fastify-socket.io type incompatibility with Fastify 5**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Plan specified using `fastify-socket.io` plugin registration, but the plugin's TypeScript types (`FastifyPluginAsync<FastifySocketioOptions>`) are incompatible with Fastify 5 `fastify.register()` overloads — TypeScript error TS2769 on all 6 overloads
- **Fix:** Switched to direct `new Server(fastify.server, opts)` attachment — works perfectly with Fastify 5 types, no peer dep issues
- **Files modified:** packages/server/src/plugins/socketio.ts
- **Commit:** bb1e220 (Task 1)

**2. [Rule 3 - Blocking] Missing fastify-plugin encapsulation breaking**
- **Found during:** Task 2 (test execution)
- **Issue:** `fastify.decorate('io', io)` inside a plain async plugin scopes the decorator to the plugin's child context; `app.io` was `undefined` in the root `build()` function, causing `TypeError: Cannot read properties of undefined (reading 'on')` in all tests
- **Fix:** Wrapped `socketioPluginImpl` with `fp()` from `fastify-plugin` — breaks encapsulation so `fastify.io` is visible on the root instance
- **Files modified:** packages/server/src/plugins/socketio.ts
- **Commit:** c824f4d (Task 2)

**3. [Rule 1 - Bug] Test event listener race condition**
- **Found during:** Task 2 (test execution — 2 of 11 tests failed)
- **Issue:** `waitForEvent(hostClient, 'lobby:state')` set up AFTER `joinRoom(guestClient)` would catch the `lobby:state` from the join (botCount=0) instead of the subsequent `set-bot-count` broadcast; similar issue for player-leave test
- **Fix:** Restructured failing tests to set up listeners BEFORE the action that triggers them; consume the join-triggered `lobby:state` first, then set up listener for the target event
- **Files modified:** packages/server/src/__tests__/lobby.test.ts
- **Commit:** c824f4d (Task 2)

---

**Total deviations:** 3 auto-fixed (1 type incompatibility, 1 missing plugin encapsulation, 1 test timing)
**Impact on plan:** All auto-fixes resolved blocking issues. No scope change.

## Issues Encountered

None remaining — all 30 tests pass, TypeScript compiles cleanly.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Server ready for Plan 02-03: game action handlers (`submit-action` event, NET-01/NET-02)
- `registerLobbyHandlers` pattern established — `registerGameHandlers` follows same signature
- Integration test infrastructure in place — `createTestServer` and helpers reusable in 02-03

---
*Phase: 02-server-and-lobby*
*Completed: 2026-03-01*
