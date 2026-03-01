---
phase: 03-bot-ai
plan: 02
subsystem: bot-ai
tags: [vitest, tdd, typescript, game-engine, simulation]

requires:
  - phase: 03-01
    provides: "Bot scoring module: scoreVertex, legalSetupVertices, pickWeightedTop, computeBuildGoal, chooseTrade, chooseBestRobberHex"
  - phase: 02-server-and-lobby
    provides: "RoomSession.applyPlayerAction, filterStateFor, Socket.IO server integration"
  - phase: 01-game-engine
    provides: "applyAction, createInitialGameState, GameState types, all action handlers"

provides:
  - "chooseBotAction — phase-dispatched bot decision logic covering all 10 game phases"
  - "isBotPlayer — bot ID detection (bot-* prefix)"
  - "runBotTurns — server bot turn loop with discard-phase awareness and safety limit"
  - "gameHandlers.ts wired to trigger bot turns after every human action"
  - "Headless 4-bot simulation: game completes with winner in ~500 actions, zero illegal moves"
  - "Win condition: applyEndTurn now checks for >= 10 VP and emits GAME_WON + sets game-over phase"

affects: [04-ui, 03-03]

tech-stack:
  added: []
  patterns:
    - "Phase-dispatch pattern: chooseBotAction switch on state.phase routes to single-action handlers"
    - "getBotToAct helper handles discard-phase bot identification (discardQueue[0] vs activePlayer)"
    - "Safety counter pattern: MAX_BOT_ACTIONS_PER_TURN=50 prevents infinite loops"
    - "TDD Red-Green: test files committed before implementation for both tasks"

key-files:
  created:
    - packages/server/src/bot/BotPlayer.ts
    - packages/server/src/bot/botRunner.ts
    - packages/server/src/bot/__tests__/BotPlayer.test.ts
    - packages/server/src/bot/__tests__/simulation.test.ts
  modified:
    - packages/server/src/socket/gameHandlers.ts
    - packages/server/src/bot/scoring.ts
    - packages/game-engine/src/engine/devCards.ts
    - packages/game-engine/src/engine/placement.ts

key-decisions:
  - "Post-roll returns ONE action per call — runBotTurns loop calls again after each action is applied"
  - "Setup road targets most recently placed settlement (the one with no adjacent bot roads)"
  - "choosePostRollAction priority: dev cards > city > settlement > trade > road > dev-card > END_TURN"
  - "Win detection added to applyEndTurn: checks VP before advancing to next player"
  - "validateRoadPlacement skips resource check when phase=road-building (was blocking free roads)"
  - "chooseTrade checks bank availability before proposing a trade"

patterns-established:
  - "Bot actions are atomic: one action per chooseBotAction call, runner loops"
  - "Discard phase bypasses activePlayer check — getBotToAct always checks discardQueue first"
  - "Win condition checked at END_TURN time (not mid-turn)"

requirements-completed: [BOT-01, BOT-02, BOT-03, BOT-04, BOT-05, BOT-06]

duration: 9min
completed: 2026-02-28
---

# Phase 03 Plan 02: Bot AI Decision Engine and Simulation Summary

**Phase-dispatched bot AI with chooseBotAction covering all 10 game phases, runBotTurns server loop, and a 4-bot headless simulation proving complete legal games in ~500 actions with winner declared.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-01T05:22:13Z
- **Completed:** 2026-03-01T05:31:10Z
- **Tasks:** 2
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- Implemented `BotPlayer.ts` with `chooseBotAction` dispatching to 8 phase-specific handlers and `isBotPlayer` utility
- Implemented `botRunner.ts` with `runBotTurns` loop handling discard-phase bots and safety limit of 50 actions/turn
- Wired `runBotTurns` into `gameHandlers.ts` so bots act automatically after every human action
- Fixed 3 engine bugs discovered during simulation testing (Rule 1/2 deviations)
- Full test suite: 373 tests pass (298 game-engine + 75 server including 35 new bot tests)

## Task Commits

1. **Task 1 RED: BotPlayer failing tests** - `9972ba4` (test)
2. **Task 1 GREEN: BotPlayer implementation** - `253eae1` (feat)
3. **Task 2 RED: Simulation failing tests** - `bf17037` (test)
4. **Task 2 GREEN: botRunner + gameHandlers + engine fixes** - `6c1d4be` (feat)

## Files Created/Modified

- `packages/server/src/bot/BotPlayer.ts` - chooseBotAction phase dispatcher, isBotPlayer, all phase handlers
- `packages/server/src/bot/botRunner.ts` - runBotTurns loop with discard-phase awareness
- `packages/server/src/bot/__tests__/BotPlayer.test.ts` - 9 unit tests across all phases
- `packages/server/src/bot/__tests__/simulation.test.ts` - 3 headless 4-bot game tests
- `packages/server/src/socket/gameHandlers.ts` - Added runBotTurns call after human action broadcast
- `packages/server/src/bot/scoring.ts` - Fixed chooseTrade to check bank availability
- `packages/game-engine/src/engine/devCards.ts` - Added win condition check in applyEndTurn
- `packages/game-engine/src/engine/placement.ts` - Fixed validateRoadPlacement during road-building phase

## Decisions Made

- **Atomic actions:** `chooseBotAction` returns exactly one action per call. The `runBotTurns` loop calls it repeatedly until no bot needs to act. This enables each action to be broadcast individually and avoids nested state management.
- **Setup road targeting:** The most recently placed settlement is identified as the settlement with no adjacent bot roads (in setup, each settlement is immediately followed by a road from that same vertex).
- **Post-roll priority:** city upgrade > settlement build > trade > road > dev card > END_TURN. Trading placed before road building to ensure resource optimization before spending.
- **Discard-phase bot identification:** `getBotToAct` checks `discardQueue[0]` when `phase === 'discard'`, because `activePlayer` remains the roller and may be a human player.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added win condition check in applyEndTurn**
- **Found during:** Task 2 (simulation test - 4-bot game never declared winner)
- **Issue:** `applyEndTurn` advanced to next player without checking if current player reached 10 VP. Bots accumulating 15+ VP without game ending.
- **Fix:** Added `computeVP` helper and win check at top of `applyEndTurn`. Emits `GAME_WON` event and sets `phase: 'game-over'`, `winner: playerId`.
- **Files modified:** `packages/game-engine/src/engine/devCards.ts`
- **Verification:** Simulation test passes with winner declared in 522 actions at 10 VP
- **Committed in:** `6c1d4be` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed validateRoadPlacement skipping resource check during road-building phase**
- **Found during:** Task 2 (simulation test - "Insufficient resources: need 1 brick, 1 lumber" during road-building phase)
- **Issue:** `validateRoadPlacement` always checked brick/lumber regardless of phase. `applyRoad` correctly skips deduction in road-building phase, but validation rejected the action first.
- **Fix:** Added `if (state.phase === 'road-building') return null;` before resource check in validator.
- **Files modified:** `packages/game-engine/src/engine/placement.ts`
- **Verification:** Road-building dev card actions accepted without resource cost, 298 engine tests still pass
- **Committed in:** `6c1d4be` (Task 2 commit)

**3. [Rule 1 - Bug] Fixed chooseTrade bank availability check**
- **Found during:** Task 2 (simulation test - "Bank has no wool remaining" on TRADE_BANK action)
- **Issue:** `chooseTrade` in scoring.ts selected a receive resource without checking bank stock. When bank was depleted of a resource, trade failed.
- **Fix:** Added `(state.bank[neededRes] ?? 0) > 0` check before proposing goal-based trades, and filtered `receiveEntry` by bank availability in 7-card avoidance.
- **Files modified:** `packages/server/src/bot/scoring.ts`
- **Verification:** Simulation runs past 1000 actions without bank trade errors
- **Committed in:** `6c1d4be` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 missing critical, 2 bugs)
**Impact on plan:** All three fixes were necessary for correct bot gameplay. Fixes 1 and 2 were latent engine bugs not caught by unit tests (no win condition test existed, road-building validation untested). Fix 3 was a bot logic gap. No scope creep — all fixes directly enabled the simulation to complete correctly.

## Issues Encountered

- The game engine had no win condition detection — `applyEndTurn` never set `winner` or transitioned to `game-over`. Only discovered when the simulation ran 5000 actions without a winner despite bots accumulating 16 VP.
- Road validation checked resources even during the free road-building dev card phase, causing immediate failure on any road-building card play.

## Next Phase Readiness

- All bot requirements (BOT-01 through BOT-06) satisfied and proven by simulation
- `chooseBotAction` and `runBotTurns` ready for use in the UI phase (04)
- `isBotPlayer` available for server-side UI filtering (hide bot actions from spectators)
- Win condition now triggers `game-over` phase — UI phase can show win screen on `state.winner !== null`
- 373 tests passing — full regression coverage maintained

## Self-Check: PASSED

- FOUND: packages/server/src/bot/BotPlayer.ts
- FOUND: packages/server/src/bot/botRunner.ts
- FOUND: packages/server/src/bot/__tests__/BotPlayer.test.ts
- FOUND: packages/server/src/bot/__tests__/simulation.test.ts
- FOUND: .planning/phases/03-bot-ai/03-02-SUMMARY.md
- FOUND: commit 9972ba4 (test RED)
- FOUND: commit 253eae1 (feat GREEN BotPlayer)
- FOUND: commit bf17037 (test RED simulation)
- FOUND: commit 6c1d4be (feat GREEN botRunner+fixes)

---
*Phase: 03-bot-ai*
*Completed: 2026-02-28*
