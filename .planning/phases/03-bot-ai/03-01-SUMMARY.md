---
phase: 03-bot-ai
plan: 01
subsystem: bot-ai
tags: [game-engine, scoring, vitest, tdd, typescript]

requires:
  - phase: 02-server-and-lobby
    provides: "Server action dispatch, filtered state broadcast, game action handler"
  - phase: 01-game-engine
    provides: "applyAction dispatcher, GameState types, createInitialGameState, trading module"

provides:
  - "ROLL_DICE and DISCARD_RESOURCES wired into applyAction dispatcher"
  - "getBestTradeRate, BUILD_COSTS, validateBuildCost, makeLcgRng exported from @catan/game-engine"
  - "Bot scoring module: scoreVertex, computeVisibleVP, chooseBestRobberHex, findLeader, legalSetupVertices, pickWeightedTop, computeBuildGoal, chooseTrade"
  - "32 unit tests covering action dispatch and all scoring functions"

affects: [03-bot-ai, 04-ui]

tech-stack:
  added: []
  patterns:
    - "Discard phase bypass: DISCARD_RESOURCES skips turn-order check, validated by discardQueue[0] instead"
    - "TOKEN_PIPS record maps number tokens to pip counts for vertex scoring"
    - "Score-weighted top-N selection for bot randomization with bias toward strong moves"
    - "computeVisibleVP counts board buildings + special awards + vpDevCards"

key-files:
  created:
    - packages/game-engine/src/__tests__/actions-wiring.test.ts
    - packages/server/src/bot/scoring.ts
    - packages/server/src/bot/__tests__/scoring.test.ts
  modified:
    - packages/game-engine/src/engine/actions.ts
    - packages/game-engine/src/index.ts

key-decisions:
  - "Discard phase turn-order bypass: add early-return in applyAction for discard phase rather than modifying GameState to track roller ID"
  - "DISCARD_RESOURCES case still present in switch after bypass to satisfy TypeScript exhaustiveness"
  - "legalSetupVertices excludes vertices with no adjacent board hexes to prevent sea placements"
  - "chooseBestRobberHex skips hexes where only the bot has buildings to avoid self-robbing"
  - "7-card avoidance in chooseTrade activates at >= 6 cards (leaves 1 card buffer before discard threshold)"

patterns-established:
  - "Bot scoring: pip sum * 10 + diversity bonus + port bonus"
  - "Weighted top-N: score all, sort desc, take N, weighted random select"

requirements-completed: [BOT-02, BOT-05]

duration: 4min
completed: 2026-02-28
---

# Phase 03 Plan 01: Actions Wiring and Bot Scoring Summary

**ROLL_DICE/DISCARD_RESOURCES wired into applyAction dispatcher, bot utility re-exports added to game-engine, and bot scoring module with vertex desirability, VP computation, robber targeting, and trade decisions.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-01T05:16:01Z
- **Completed:** 2026-03-01T05:19:37Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- Wired all 12 action types through `applyAction` — ROLL_DICE and DISCARD_RESOURCES now dispatch correctly
- Added early-return bypass for discard phase allowing any `discardQueue` member to discard (not just `activePlayer`)
- Exported `getBestTradeRate`, `BUILD_COSTS`, `validateBuildCost`, and `makeLcgRng` from `@catan/game-engine`
- Created `packages/server/src/bot/scoring.ts` with 8 scoring functions needed by all bot decision logic
- 32 new unit tests (9 for action wiring, 23 for scoring) — all pass alongside existing 289 tests

## Task Commits

1. **Task 1: Wire ROLL_DICE/DISCARD_RESOURCES and export bot utilities** - `59abf30` (feat)
2. **Task 2: Create bot scoring module** - `3a77d12` (feat)

## Files Created/Modified

- `packages/game-engine/src/engine/actions.ts` - Import applyRollDice/applyDiscard from resources.ts, add ROLL_DICE/DISCARD_RESOURCES cases, add discard-phase early-return bypass
- `packages/game-engine/src/index.ts` - Export getBestTradeRate, BUILD_COSTS, validateBuildCost from trading.ts; export makeLcgRng from generator.ts
- `packages/game-engine/src/__tests__/actions-wiring.test.ts` - 9 tests for ROLL_DICE dispatch, DISCARD_RESOURCES bypass, and re-export verification
- `packages/server/src/bot/scoring.ts` - Bot scoring module: TOKEN_PIPS, scoreVertex, legalSetupVertices, pickWeightedTop, computeVisibleVP, findLeader, chooseBestRobberHex, computeBuildGoal, chooseTrade
- `packages/server/src/bot/__tests__/scoring.test.ts` - 23 unit tests covering all scoring functions

## Decisions Made

- **Discard phase turn-order bypass:** The plan considered several approaches (setting `activePlayer` to `discardQueue[0]`, storing rollerId in GameState). The least-invasive fix was an early-return in `applyAction` before the turn-order check: when `state.phase === 'discard' && action.type === 'DISCARD_RESOURCES'`, delegate directly to `applyDiscard` which validates via `discardQueue[0]`. This avoids mutating GameState schema.
- **`legalSetupVertices` includes desert-adjacent vertices:** Desert has `resource: null` but `number: null` too — vertices adjacent to desert but also adjacent to production hexes are valid setup spots. The filter only requires at least one adjacent hex to exist in the board (not necessarily a resource hex), which is correct.
- **`chooseTrade` 7-card avoidance at >= 6:** Avoidance activates one card before the discard threshold (7), giving the bot a buffer to trade proactively.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The server package's vitest config resolves `@catan/game-engine` from `dist/` (not source). After adding new exports to `index.ts`, the game-engine package needed a `npm run build` to regenerate `dist/`. This is expected behavior for the workspace setup. (Note: dist/ is gitignored; the build was only needed for the server package's test run.)

## Next Phase Readiness

- All bot utility imports resolved — `scoring.ts` can import from `@catan/game-engine` successfully
- `scoreVertex`, `computeVisibleVP`, `chooseBestRobberHex`, `pickWeightedTop`, `computeBuildGoal`, `chooseTrade` ready for the decision engine (03-02)
- `legalSetupVertices` ready for setup-phase bot logic (03-02)
- Zero regressions: 298 game-engine tests pass, 23 scoring tests pass

---
*Phase: 03-bot-ai*
*Completed: 2026-02-28*
