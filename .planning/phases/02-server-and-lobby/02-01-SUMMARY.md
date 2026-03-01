---
phase: 02-server-and-lobby
plan: 01
subsystem: api
tags: [fastify, socket.io, typescript, vitest, bad-words-next, tdd]

# Dependency graph
requires:
  - phase: 01-game-engine
    provides: "applyAction, createInitialGameState, GameState, Action, ActionResult types"
provides:
  - "@catan/server package scaffold with Fastify + Socket.IO typed event interfaces"
  - "generateRoomCode: CVCV pattern, uniqueness, profanity-filtered room codes"
  - "RoomSession class: full room lifecycle management"
  - "roomStore: Map-based singleton with cleanup helpers"
  - "filterStateForPlayer: strips opponent private data before broadcast"
affects:
  - 02-02-server-routes
  - 02-03-socket-handlers
  - 03-client

# Tech tracking
tech-stack:
  added:
    - "fastify@^5.7.4 — HTTP server"
    - "socket.io@^4.8.3 — WebSocket server"
    - "fastify-socket.io@^5.0.0 — Fastify plugin for Socket.IO (installed with --legacy-peer-deps due to fastify@5 peer mismatch)"
    - "bad-words-next@^3.2.0 — Profanity filtering for room codes"
  patterns:
    - "Workspace-local packages linked with '*' version (npm workspaces, not pnpm)"
    - "Typed Socket.IO events via ServerToClientEvents/ClientToServerEvents interfaces"
    - "State filtering per-player before broadcast: strips hand, unplayedDevCards, vpDevCards"
    - "CVCV room code pattern: Consonant-Vowel-Consonant-Vowel, uppercase"

key-files:
  created:
    - packages/server/package.json
    - packages/server/tsconfig.json
    - packages/server/vitest.config.ts
    - packages/server/src/types.ts
    - packages/server/src/game/roomCode.ts
    - packages/server/src/game/roomCode.test.ts
    - packages/server/src/game/RoomSession.ts
    - packages/server/src/game/roomStore.ts
    - packages/server/src/game/stateFilter.ts
    - packages/server/src/game/stateFilter.test.ts
    - packages/server/src/types.test.ts
  modified:
    - packages/game-engine/src/index.ts

key-decisions:
  - "npm workspace '*' not 'workspace:*' — npm does not support pnpm/yarn workspace: protocol"
  - "fastify-socket.io installed with --legacy-peer-deps — package declares peer fastify@4.x but we use fastify@5; will update to compatible plugin in 02-02 if needed"
  - "Player type uses knightCount/roadCount/settlementCount/cityCount — actual types differ from plan context (plan had outdated interface snapshot)"
  - "GamePhase uses kebab-case values ('pre-roll', 'post-roll', etc.) not SCREAMING_SNAKE_CASE — discovered from actual types.ts"

patterns-established:
  - "RoomSession encapsulates all room state and delegates to game-engine for action application"
  - "filterStateForPlayer immutably strips private player data before any network broadcast"
  - "generateRoomCode: stateless pure function accepting existing codes Set, throws on exhaustion"

requirements-completed: [ROOM-01, ROOM-02, NET-02]

# Metrics
duration: 8min
completed: 2026-02-28
---

# Phase 2 Plan 1: Server Scaffold and Room Infrastructure Summary

**Fastify+Socket.IO server package with CVCV room code generation, RoomSession lifecycle management, per-player GameState filtering, and updated game-engine public API exports**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-01T03:30:35Z
- **Completed:** 2026-03-01T03:38:47Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Updated game-engine `index.ts` to re-export `applyAction`, `createInitialGameState`, `isActionLegalInPhase`, and `generateBoard`
- Scaffolded `@catan/server` package with strict TypeScript, Vitest, and typed Socket.IO event interfaces
- Implemented `generateRoomCode` with CVCV pattern, uniqueness enforcement, and bad-words-next profanity filter
- Implemented `RoomSession` class with full room lifecycle: player management, game start, action application, host promotion, expiry
- Implemented `filterStateForPlayer` to strip opponent hand/devCards/vpDevCards before broadcast
- 19 tests passing across roomCode, stateFilter, and types import tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Update game-engine exports and scaffold server package** - `7604823` (feat)
2. **Task 2: Room infrastructure — code generator, session, store, state filter** - `c5345fd` (feat)

_Note: TDD tasks — tests written before implementation_

## Files Created/Modified
- `packages/game-engine/src/index.ts` — Added applyAction, createInitialGameState, isActionLegalInPhase, generateBoard exports
- `packages/server/package.json` — New package: Fastify, Socket.IO, bad-words-next, @catan/game-engine
- `packages/server/tsconfig.json` — Strict TS with game-engine project reference
- `packages/server/vitest.config.ts` — Vitest config for node environment
- `packages/server/src/types.ts` — ServerToClientEvents, ClientToServerEvents, SocketData, LobbyState, LobbyPlayer interfaces
- `packages/server/src/types.test.ts` — Compile-check + runtime import tests for types and game-engine exports
- `packages/server/src/game/roomCode.ts` — CVCV room code generator with profanity filtering
- `packages/server/src/game/roomCode.test.ts` — 5 tests: format, uniqueness, CVCV pattern, throw on exhaustion
- `packages/server/src/game/RoomSession.ts` — Room session class with full lifecycle
- `packages/server/src/game/roomStore.ts` — Singleton Map with getRoomCodes() and cleanExpiredRooms()
- `packages/server/src/game/stateFilter.ts` — filterStateForPlayer immutable state filter
- `packages/server/src/game/stateFilter.test.ts` — 8 tests: own hand unchanged, opponent data zeroed, no mutation

## Decisions Made
- Used `"*"` version for `@catan/game-engine` dependency (npm workspace syntax, not pnpm `workspace:*`)
- Installed `fastify-socket.io` with `--legacy-peer-deps` due to peer dependency declaring `fastify@4.x` while we use `fastify@5.x`
- Discovered actual Player type uses `knightCount`, `roadCount`, `settlementCount`, `cityCount` fields (plan context had outdated snapshot with `settlements`, `cities`, `roads`, `knightsPlayed`)
- GamePhase values are kebab-case (`'pre-roll'`, `'post-roll'`, etc.) not SCREAMING_SNAKE_CASE as shown in plan context

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed workspace dependency protocol**
- **Found during:** Task 1 (install)
- **Issue:** Plan specified `"@catan/game-engine": "workspace:*"` but npm workspaces don't support pnpm's `workspace:` protocol
- **Fix:** Changed to `"@catan/game-engine": "*"` — npm resolves this to the local workspace package
- **Files modified:** packages/server/package.json
- **Verification:** `npm install` succeeded, `npx tsc --noEmit` clean
- **Committed in:** 7604823 (Task 1 commit)

**2. [Rule 1 - Bug] Corrected Player and GameState field names in test file**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** Plan context showed outdated Player interface (with `knightsPlayed`, `settlements`, `cities`, `roads`, `longestRoadLength`) but actual `types.ts` uses `knightCount`, `roadCount`, `settlementCount`, `cityCount`; GamePhase uses kebab-case not SCREAMING_SNAKE_CASE
- **Fix:** Rewrote stateFilter.test.ts to use actual type definitions
- **Files modified:** packages/server/src/game/stateFilter.test.ts
- **Verification:** `npx tsc --noEmit` clean, 19 tests passing
- **Committed in:** c5345fd (Task 2 commit)

**3. [Rule 3 - Blocking] Corrected bad-words-next import path**
- **Found during:** Task 2 (test run)
- **Issue:** `import en from 'bad-words-next/lib/en.js'` failed — package exports use `'bad-words-next/lib/en'` (no `.js` extension in export map)
- **Fix:** Changed to `import en from 'bad-words-next/lib/en'`
- **Files modified:** packages/server/src/game/roomCode.ts
- **Verification:** Tests pass, profanity check functional
- **Committed in:** c5345fd (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 wrong protocol, 1 stale type snapshot, 1 blocking import path)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- `fastify-socket.io@5.x` declares `peer fastify@"4.x.x"` — installed with `--legacy-peer-deps`. Plans 02-02/02-03 should verify the plugin works at runtime with Fastify 5 or switch to direct socket.io integration without the plugin.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Server package scaffold ready for Plans 02-02 (HTTP routes) and 02-03 (Socket.IO handlers)
- Game-engine exports updated and built — `applyAction`, `createInitialGameState`, `generateBoard` all available
- RoomSession and roomStore ready to be imported by route/socket handler implementations
- Potential concern: fastify-socket.io peer dep mismatch with Fastify 5 — may need alternative integration approach in 02-02

---
*Phase: 02-server-and-lobby*
*Completed: 2026-02-28*
