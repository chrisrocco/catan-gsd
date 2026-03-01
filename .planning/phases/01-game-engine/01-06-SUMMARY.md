---
phase: 01-game-engine
plan: 06
subsystem: game-engine
tags: [typescript, vitest, dev-cards, knight, monopoly, year-of-plenty, road-building, tdd]

# Dependency graph
requires:
  - phase: 01-02
    provides: "generateBoard, makeLcgRng, shuffle from board/generator"
  - phase: 01-03
    provides: "createInitialGameState, isActionLegalInPhase from engine/fsm"
  - phase: 01-05
    provides: "BUILD_COSTS from engine/trading"
provides:
  - "devCards.ts: applyBuyDevCard(), applyPlayDevCard(), applyEndTurn()"
  - "robber.ts: applyMoveRobber(), applyStealResource(), applySkipSteal()"
  - "Full actions.ts dispatcher: BUY_DEV_CARD, PLAY_DEV_CARD, END_TURN, MOVE_ROBBER, STEAL_RESOURCE, SKIP_STEAL wired"
affects:
  - "All downstream game logic — dev cards are now fully playable"
  - "Turn advancement via applyEndTurn enables multi-turn game loops"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "VP dev cards never enter unplayedDevCards — routed to vpDevCards counter at draw time"
    - "GAME-07 enforced via devCardBoughtThisTurn flag check in applyPlayDevCard"
    - "Monopoly iterates all players except active player, accumulates totalTaken for event"
    - "Year of Plenty deducts each resource from bank sequentially (handles r1===r2 case)"
    - "applyEndTurn uses modular playerOrder index for circular turn advancement"
    - "END_TURN resets devCardBoughtThisTurn and devCardsPlayedThisTurn on current player before advancing"

key-files:
  created:
    - "packages/game-engine/src/engine/devCards.ts: applyBuyDevCard, applyPlayDevCard, applyEndTurn"
    - "packages/game-engine/src/engine/devCards.test.ts: 20 tests covering all 4 card types, GAME-07 restriction, end turn"
    - "packages/game-engine/src/engine/robber.ts: applyMoveRobber, applyStealResource, applySkipSteal"
    - "packages/game-engine/src/engine/trading.ts: BUILD_COSTS, getBestTradeRate, validateTrade, applyTrade"
  modified:
    - "packages/game-engine/src/engine/actions.ts: wired BUY_DEV_CARD, PLAY_DEV_CARD, END_TURN, MOVE_ROBBER, STEAL_RESOURCE, SKIP_STEAL"

key-decisions:
  - "VP cards routed to vpDevCards counter at draw time, never appear in unplayedDevCards — aligns with game rule that VP cards are hidden and count immediately"
  - "GAME-07 check uses devCardBoughtThisTurn flag, not deck state — correctly separates buy-tracking from play-tracking"
  - "Monopoly does not touch the bank — resource transfers directly between players"
  - "Year of Plenty deducts resources from bank sequentially to correctly handle duplicate resource requests (e.g., two ore)"

# Metrics
duration: 3min
completed: 2026-03-01
---

# Phase 1 Plan 6: Dev Card Lifecycle Summary

**Dev card buy/play/end-turn module implementing all 4 action card types (knight, monopoly, year-of-plenty, road-building), VP card tracking, GAME-07 same-turn restriction, and circular turn advancement**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-01T01:22:01Z
- **Completed:** 2026-03-01T01:25:29Z
- **Tasks:** 1 (TDD RED + GREEN commits)
- **Files created/modified:** 5

## Accomplishments

- All 20 dev card tests pass covering: buy validation, VP routing, GAME-07 restriction, all 4 card types, end-turn advancement
- 118 total tests pass across all test files (up from 59 pre-plan)
- TypeScript type check exits 0 with no errors
- Full actions.ts dispatcher wired with 7 new action handlers

## Task Commits

1. **Task 1 RED: Failing dev card tests** — `ebcb261` (test)
2. **Task 1 GREEN: devCards.ts + actions.ts update** — `e5da71f` (feat)

## Dev Card Play Validation Chain

`applyPlayDevCard` validates in this order:

1. Player exists
2. `devCardBoughtThisTurn === false` (GAME-07: cannot play card purchased this turn)
3. `devCardsPlayedThisTurn < 1` (at most 1 action card per turn)
4. Card is in `player.unplayedDevCards` (player actually has the card)

Only after all checks pass does card-specific logic execute.

## VP Cards vs Action Cards

- **At draw time** (`applyBuyDevCard`): if `card === 'victory-point'` → increment `player.vpDevCards` counter, do NOT add to `unplayedDevCards`
- **Action cards** (knight, monopoly, year-of-plenty, road-building) → added to `player.unplayedDevCards`
- VP cards are never playable — they count silently toward the player's VP total

## END_TURN Turn-Advance Logic

```typescript
const currentIdx = state.playerOrder.indexOf(state.activePlayer);
const nextIdx = (currentIdx + 1) % state.playerOrder.length;
const nextPlayer = state.playerOrder[nextIdx]!;
```

- Circular via modulo — last player wraps to first
- Resets `devCardBoughtThisTurn = false` and `devCardsPlayedThisTurn = 0` on the player who ended their turn
- Transitions `phase → 'pre-roll'`
- Increments `turnNumber`

## Exported Functions and Signatures

```typescript
// packages/game-engine/src/engine/devCards.ts
export function applyBuyDevCard(
  state: GameState,
  action: { type: 'BUY_DEV_CARD'; playerId: string },
): ActionResult

export function applyPlayDevCard(
  state: GameState,
  action: {
    type: 'PLAY_DEV_CARD';
    playerId: string;
    card: Exclude<DevCardType, 'victory-point'>;
    monopolyResource?: ResourceType;
    yearOfPlentyResources?: [ResourceType, ResourceType];
  },
  rand?: () => number,
): ActionResult

export function applyEndTurn(
  state: GameState,
  action: { type: 'END_TURN'; playerId: string },
): ActionResult
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created missing dependency files from plans 03-05**
- **Found during:** Pre-execution check
- **Issue:** Plan 06 imports `engine/fsm.ts`, `engine/trading.ts`, and `engine/robber.ts`, but git history showed only `fsm.ts` (from plan 03), `trading.ts` (from plan 05), and `actions.ts` were already committed. The `robber.ts` file was not yet committed.
- **Fix:** Created `robber.ts` (applyMoveRobber, applyStealResource, applySkipSteal) as a blocking dependency. `trading.ts` was already committed in `c3a5bc3`. `robber.ts` was added to the feat commit `e5da71f`.
- **Files created:** `packages/game-engine/src/engine/robber.ts`
- **Committed in:** `e5da71f`

## Issues Encountered

None beyond the missing robber.ts dependency.

## Self-Check: PASSED

- devCards.ts: FOUND
- devCards.test.ts: FOUND
- robber.ts: FOUND
- Commit ebcb261 (RED test): FOUND
- Commit e5da71f (GREEN feat): FOUND
- All 118 tests passing
- TypeScript type check: exits 0
