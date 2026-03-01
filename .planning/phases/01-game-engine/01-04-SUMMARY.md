---
phase: 01-game-engine
plan: 04
subsystem: game-engine
tags: [typescript, vitest, dice, resources, robber, bank-depletion, discard-queue, tdd]

# Dependency graph
requires:
  - phase: 01-01
    provides: "GameState, ResourceHand, GameEvent, ActionResult, GamePhase types from types.ts"
  - phase: 01-02
    provides: "Board, Hex, Vertex topology — vertexKeys, adjacentHexKeys for resource lookup"
  - phase: 01-03
    provides: "createInitialGameState(), applyAction() dispatcher, PHASE_LEGAL_ACTIONS FSM"
provides:
  - "resources.ts: rollTwoDice(), handTotal(), distributeResources(), applyRollDice(), applyDiscard()"
  - "robber.ts: applyMoveRobber(), applyStealResource(), applySkipSteal()"
  - "resources.test.ts: 22 tests covering dice, distribution, discard queue, and robber steal mechanics"
affects:
  - "06-trading: applyRollDice wired into applyAction dispatcher"
  - "07-rendering: DICE_ROLLED, RESOURCES_DISTRIBUTED, RESOURCE_STOLEN events for UI display"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injectable RNG: all random operations accept rand: () => number = Math.random for deterministic tests"
    - "Bank depletion rule: if totalOwed[res] > bank[res], no player gets that resource this roll"
    - "discardQueue array: ordered list of playerIds who must discard; shift after each discard"
    - "Phase transition via discardQueue.length: empty queue -> robber-move, non-empty -> stay in discard"
    - "applyStealResource validates target on robber hex before stealing; empty hand handled gracefully"

key-files:
  created:
    - "packages/game-engine/src/engine/resources.ts: rollTwoDice, handTotal, distributeResources, applyRollDice, applyDiscard"
    - "packages/game-engine/src/engine/robber.ts: applyMoveRobber, applyStealResource, applySkipSteal"
    - "packages/game-engine/src/engine/resources.test.ts: 22 tests for full dice/resource/robber flow"
  modified: []

key-decisions:
  - "Bank depletion blocks all players for that resource — if bank has 1 grain but two players are owed grain, neither gets any (official Catan rule)"
  - "discardQueue built from players with handTotal > 7 at time of 7-roll; order follows Object.values(players) iteration"
  - "rollTwoDice uses injectable rand parameter — enables deterministic test control without mocking Math.random"
  - "applyRollDice accepts optional action.roll for test injection — arbitrary split (ceil/floor) for the two dice display values"
  - "applyMoveRobber rejects same-hex placement — official rules require robber to move to a different hex"
  - "applyStealResource validates target has building on robber hex before attempting steal"

patterns-established:
  - "Injectable RNG: rand: () => number = Math.random default on all stochastic functions"
  - "handTotal() helper: reusable across resources.ts and any future hand-size checks"
  - "Phase transition pattern: compute next phase from state shape, not external flags"

requirements-completed:
  - "GAME-03"
  - "GAME-04"
  - "GAME-05"

# Metrics
duration: N/A (resumed after rate limit)
completed: 2026-02-28
---

# Phase 1 Plan 4: Dice Rolling, Resource Distribution, and Robber Mechanics Summary

**Dice rolling with injectable RNG, bank-depletion-enforced resource distribution, 7-roll discard queue, and robber move/steal with phase transitions to post-roll**

## Performance

- **Duration:** N/A (plan was interrupted by rate limit; resumed and completed 2026-02-28)
- **Started:** 2026-03-01T01:26:36Z
- **Completed:** 2026-02-28T17:34:32Z
- **Tasks:** 2 (each with TDD RED + GREEN commits)
- **Files modified:** 2 created (resources.ts, robber.ts) + 1 test file

## Accomplishments
- rollTwoDice uses injectable RNG — all 100 samples stay in [1,6] range confirmed by test
- distributeResources: settlements receive 1 resource, cities receive 2 from each adjacent matching hex
- Bank depletion enforced: totalOwed > bank supply blocks that resource for all players that roll
- Robber hex skipped during distribution — no resources from hex under the robber
- 7-roll flow: builds discardQueue from players with > 7 cards, transitions to discard or robber-move
- applyDiscard validates exact count (Math.floor(total/2)), blocks wrong-player discard, advances queue
- applyMoveRobber rejects same-hex placement, transitions to robber-steal or post-roll based on opponents present
- applyStealResource picks random resource from non-empty target hand, emits RESOURCE_STOLEN event
- Empty-hand steal handled gracefully — transitions to post-roll without error

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for dice/resources/robber** - `64b9b4d` (test)
2. **Task 1 GREEN: resources.ts implementation** - `2d8f249` (feat)
3. **Task 2 GREEN: robber.ts** - already committed in `c3a5bc3` (feat, from prior session)

_Note: robber.ts was pre-implemented and committed in a prior session as part of 01-05 plan execution. resources.ts was implemented (code-complete) before the rate limit hit, committed GREEN in this resume session._

## Files Created/Modified
- `packages/game-engine/src/engine/resources.ts` - rollTwoDice, handTotal, distributeResources, applyRollDice, applyDiscard
- `packages/game-engine/src/engine/robber.ts` - applyMoveRobber, applyStealResource, applySkipSteal
- `packages/game-engine/src/engine/resources.test.ts` - 22 tests: dice range, settlement/city amounts, robber hex block, bank depletion, roll transitions, discard validation, robber move/steal

## Decisions Made
- Bank depletion blocks all — if bank cannot cover total owed for a resource, no one receives it that roll (official Catan rule, not partial distribution).
- discardQueue is ordered by Object.values(players) iteration order; this is stable for tests using known player IDs.
- Injectable RNG pattern via `rand: () => number = Math.random` applies to both rollTwoDice and applyStealResource, enabling full deterministic test control.
- applyRollDice accepts optional `action.roll` for test injection — the two individual dice are split ceil/floor from the total (arbitrary but stable for event emission).
- Robber must move to a different hex (same-hex rejected with error) per official rules.

## Deviations from Plan

None - plan executed exactly as written. robber.ts was pre-implemented from an earlier session; resources.ts implemented to spec.

## Issues Encountered
- Plan execution was interrupted by a rate limit after the GREEN code was written but before committing. resources.ts was code-complete and all 22 tests passed when resumed; the GREEN feat commit was created in the resume session.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full dice-to-resource flow is operational and tested: ROLL_DICE → distribute (or 7-flow) → discard → MOVE_ROBBER → STEAL_RESOURCE/SKIP_STEAL → post-roll
- All 140 game-engine tests pass (7 test files)
- applyRollDice and applyDiscard are wired into actions.ts dispatcher
- applyMoveRobber, applyStealResource, applySkipSteal are wired into actions.ts dispatcher
- Ready for plan 01-06: dev card lifecycle (knight, road-building, monopoly, year-of-plenty, VP)

---
*Phase: 01-game-engine*
*Completed: 2026-02-28*
