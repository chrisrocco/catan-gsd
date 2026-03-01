---
phase: 01-game-engine
plan: 05
subsystem: game-engine
tags: [typescript, vitest, trading, ports, bank, build-costs, resource-economy]

# Dependency graph
requires:
  - phase: 01-02
    provides: "generateBoard(), makeLcgRng(), Board/Vertex/Edge types from board module"
  - phase: 01-03
    provides: "createInitialGameState(), GameState, applyAction() dispatcher (created as prerequisite)"
provides:
  - "trading.ts: getBestTradeRate(), validateTrade(), applyTrade(), BUILD_COSTS, validateBuildCost()"
  - "fsm.ts: PHASE_LEGAL_ACTIONS, getLegalActions(), isActionLegalInPhase(), createInitialGameState() — FSM and initial state"
  - "actions.ts: applyAction() dispatcher wired to TRADE_BANK, PLACE_SETTLEMENT, PLACE_ROAD, UPGRADE_CITY"
  - "placement.ts: validateSettlementPlacement(), validateRoadPlacement(), validateCityPlacement(), applySettlement(), applyRoad(), applyCity()"
  - "robber.ts: applyMoveRobber(), applyStealResource(), applySkipSteal()"
affects:
  - "06-game-logic: imports BUILD_COSTS for build validation in dev card and building handlers"
  - "07-ui: imports getBestTradeRate for trade UI display"
  - "08-bot: imports validateTrade/getBestTradeRate for bot trade decision logic"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Port rate resolution: iterate player's settlement/city vertices, check port.type; specific resource port returns 2, generic 3:1 port returns 3, no port returns 4"
    - "Best rate wins: early-return on finding 2:1, no need to continue scanning vertices"
    - "Trade validation: self-trade rejected, amount must match best rate, player hand check, bank check"
    - "BUILD_COSTS as typed Record<'road'|'settlement'|'city'|'dev-card', Partial<ResourceHand>> — canonical cost reference"
    - "Immutable state updates: spread operators, no mutation of input state"
    - "FSM phase table: PHASE_LEGAL_ACTIONS drives both getLegalActions() and isActionLegalInPhase()"

key-files:
  created:
    - "packages/game-engine/src/engine/trading.ts: getBestTradeRate, validateTrade, applyTrade, BUILD_COSTS, validateBuildCost"
    - "packages/game-engine/src/engine/trading.test.ts: 23 tests covering all trade scenarios (BUILD_COSTS, port rates, trade validation, applyTrade)"
    - "packages/game-engine/src/engine/fsm.ts: PHASE_LEGAL_ACTIONS, getLegalActions, isActionLegalInPhase, createInitialGameState"
    - "packages/game-engine/src/engine/actions.ts: applyAction dispatcher with TRADE_BANK, placement, and city upgrade handlers"
    - "packages/game-engine/src/engine/placement.ts: settlement/road/city validation and apply functions"
    - "packages/game-engine/src/engine/placement.test.ts: 16 tests for settlement, road, city placement and turn-order enforcement"
    - "packages/game-engine/src/engine/robber.ts: applyMoveRobber, applyStealResource, applySkipSteal"
  modified:
    - "packages/game-engine/src/engine/fsm.ts: Fixed LEGAL_ACTIONS_BY_PHASE type cast (Object.fromEntries return type)"

key-decisions:
  - "Best trade rate resolution early-returns on finding 2:1 port — specific port can never be beaten so no need to continue scanning"
  - "BUILD_COSTS uses Partial<ResourceHand> not ResourceHand — city has no lumber/wool/brick, road has no grain/wool/ore; Partial avoids requiring all 5 resources in each cost object"
  - "applyTrade follows the same pattern as other apply functions: validate first, return error state if invalid, otherwise build new state immutably"
  - "FSM LEGAL_ACTIONS_BY_PHASE requires 'as unknown as' double cast because Object.fromEntries loses the specific key type information — the runtime value is correct, TypeScript just can't infer it"
  - "Prerequisites (fsm.ts, actions.ts, placement.ts, robber.ts) created as Rule 3 blocking deviation since trading tests import createInitialGameState from fsm.js"

patterns-established:
  - "Trading validation chain: self-trade → rate check → player resources → bank resources"
  - "Port detection: loop all vertices, skip if no building by player, skip if no port, check port.type against resource"
  - "Build cost validation: loop entries of cost object, check hand[res] >= amount"

requirements-completed:
  - "GAME-09"
  - "GAME-10"

# Metrics
duration: 4min
completed: 2026-03-01
---

# Phase 1 Plan 5: Trading Module Summary

**Bank/port trading with 4:1/3:1/2:1 rate resolution, trade validation, applyTrade execution, BUILD_COSTS constants, and validateBuildCost — the economic engine of Catan**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-01T01:21:47Z
- **Completed:** 2026-03-01T01:24:57Z
- **Tasks:** 1 (plus prerequisites)
- **Files modified:** 8

## Accomplishments

- Trading module fully implemented: port rate resolution, trade validation, bank trade execution with immutable state
- BUILD_COSTS constants match official Catan rules for all 4 build types (road, settlement, city, dev-card)
- validateBuildCost() reusable across placement, city upgrade, and dev card purchase handlers
- All prerequisite engine files created (fsm.ts, actions.ts, placement.ts, robber.ts) — 118 tests pass across 6 test files

## BUILD_COSTS Reference

```typescript
BUILD_COSTS = {
  road:       { brick: 1, lumber: 1 },
  settlement: { brick: 1, lumber: 1, grain: 1, wool: 1 },
  city:       { grain: 2, ore: 3 },
  'dev-card': { ore: 1, grain: 1, wool: 1 },
}
```

## Port Rate Resolution Algorithm

```typescript
getBestTradeRate(state, playerId, resource):
  bestRate = 4
  for each vertex where player has settlement/city:
    if vertex.port.type === resource → return 2  // specific port: immediate return
    if vertex.port.type === '3:1' → bestRate = 3  // generic port: record rate
  return bestRate  // 2, 3, or 4
```

## Exported Functions and Signatures

```typescript
// trading.ts
getBestTradeRate(state: GameState, playerId: string, resource: ResourceType): 2 | 3 | 4
validateTrade(state: GameState, playerId: string, give: ResourceType, receive: ResourceType, amount: number): string | null
applyTrade(state: GameState, action: { type: 'TRADE_BANK'; playerId: string; give: ResourceType; receive: ResourceType; amount: number }): ActionResult
BUILD_COSTS: Record<'road' | 'settlement' | 'city' | 'dev-card', Partial<ResourceHand>>
validateBuildCost(hand: ResourceHand, buildType: keyof typeof BUILD_COSTS): string | null

// fsm.ts
PHASE_LEGAL_ACTIONS: Record<GamePhase, ActionType[]>
getLegalActions(state: GameState): ActionType[]
isActionLegalInPhase(phase: GamePhase, actionType: ActionType): boolean
createInitialGameState(playerIds: string[], rand?: () => number): GameState

// actions.ts
applyAction(state: GameState, action: Action): ActionResult
```

## Task Commits

1. **Task 1: Trading with prerequisites** - `c3a5bc3` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `packages/game-engine/src/engine/trading.ts` - Port rate resolution, trade validation, BUILD_COSTS, applyTrade
- `packages/game-engine/src/engine/trading.test.ts` - 23 tests: BUILD_COSTS, getBestTradeRate, validateTrade, applyTrade
- `packages/game-engine/src/engine/fsm.ts` - Game phase FSM: PHASE_LEGAL_ACTIONS, createInitialGameState
- `packages/game-engine/src/engine/actions.ts` - Central dispatcher: TRADE_BANK, PLACE_SETTLEMENT, PLACE_ROAD, UPGRADE_CITY
- `packages/game-engine/src/engine/placement.ts` - Settlement/road/city placement validation and application
- `packages/game-engine/src/engine/placement.test.ts` - 16 tests: placement validation, turn-order enforcement
- `packages/game-engine/src/engine/robber.ts` - MOVE_ROBBER, STEAL_RESOURCE, SKIP_STEAL handlers

## Decisions Made

- BUILD_COSTS uses `Partial<ResourceHand>` not `ResourceHand` — city has no lumber/wool/brick; Partial avoids requiring all 5 resources in each cost entry
- Port rate resolution early-returns on 2:1 — no port can beat 2:1, so scanning can stop immediately
- LEGAL_ACTIONS_BY_PHASE uses double cast `as unknown as` to satisfy TypeScript — Object.fromEntries loses specific key types but runtime value is correct
- applyTrade validates before executing, returns original state unchanged on error (consistent pattern across all apply functions)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created prerequisite engine files not yet on disk**
- **Found during:** Task 1 setup (testing imports)
- **Issue:** The trading test imports `createInitialGameState` from `./fsm.js`, but plans 03 and 04 had not yet been executed — `fsm.ts`, `actions.ts`, `placement.ts`, and `robber.ts` did not exist
- **Fix:** Created all prerequisite engine files from plans 03 and 04 so the trading module's tests could import their dependencies
- **Files modified:** `fsm.ts`, `actions.ts`, `placement.ts`, `placement.test.ts`, `robber.ts`
- **Verification:** All 118 tests passing (up from 41 before the prerequisites)
- **Committed in:** `c3a5bc3`

**2. [Rule 1 - Bug] Fixed LEGAL_ACTIONS_BY_PHASE TypeScript type error**
- **Found during:** TypeScript compilation check
- **Issue:** `Object.fromEntries().map()` returns `{[k: string]: Set<...>}` which doesn't satisfy `Record<GamePhase, ReadonlySet<...>>` even though runtime value is correct
- **Fix:** Added `as unknown as` double cast to satisfy TypeScript type checker
- **Files modified:** `packages/game-engine/src/engine/fsm.ts`
- **Verification:** `tsc --noEmit` exits 0
- **Committed in:** `c3a5bc3`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both necessary — prerequisites were blocking, type error blocked compilation. No scope creep.

## Issues Encountered

- `devCards.test.ts` was pre-created by scaffolding alongside `devCards.ts` (plan 06's content), and already passing — no action needed
- Vitest's `.not.toContain(undefined)` throws if the target is undefined — placement.test.ts had this issue and linter fixed it to use `result.error ?? ''`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Trading module fully functional and tested
- BUILD_COSTS available for import by placement, city upgrade, and dev card purchase in plan 06
- getBestTradeRate, validateTrade, applyTrade ready for bot strategy (plan 09+)
- All engine prerequisite modules now exist: fsm.ts, actions.ts, placement.ts, robber.ts, trading.ts

---
*Phase: 01-game-engine*
*Completed: 2026-03-01*

## Self-Check: PASSED

- FOUND: `packages/game-engine/src/engine/trading.ts`
- FOUND: `packages/game-engine/src/engine/trading.test.ts`
- FOUND: `packages/game-engine/src/engine/fsm.ts`
- FOUND: `packages/game-engine/src/engine/actions.ts`
- FOUND: `.planning/phases/01-game-engine/01-05-SUMMARY.md`
- FOUND: commit `c3a5bc3` (feat(01-05): implement trading module)
- All 118 tests passing
