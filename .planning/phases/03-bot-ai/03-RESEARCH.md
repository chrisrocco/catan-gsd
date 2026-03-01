# Phase 03: Bot AI - Research

**Researched:** 2026-02-28
**Domain:** Server-side heuristic game AI — pure TypeScript, no external AI/ML libraries
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Strategy depth**
- Single heuristic level — one bot personality with weighted-scoring evaluation
- Some randomness: top 2-3 scored options with weighted random selection to prevent scripted-feeling games
- Subtle weight variations per bot instance for variety (same core logic, slightly randomized priorities)
- Difficulty levels deferred to a future phase

**Settlement placement**
- Probability-first for initial placement: prioritize high pip count (6/8/5/9), then diversify resources as tiebreaker
- Port access as a bonus factor in vertex scoring (not a primary driver)
- Goal-directed mid-game expansion: bot identifies best unoccupied vertices and builds roads toward them
- Context-dependent city vs settlement priority: score both options (cities = 2 VP + double production, settlements = new hex access), pick whichever scores higher

**Robber targeting**
- Target the leader: move robber to the hex most productive for the highest-VP player
- Classic Catan strategy, straightforward to implement

**Trading behavior**
- Bank/port trades only — no player-to-player negotiation (matches BOT-04 scope)
- Need-based triggers: bot identifies what it needs to build next, trades excess resources toward that goal
- Proactive 7-card avoidance: trade down when holding 6+ cards and can't build
- Smart discarding on 7: keep resources needed for current build goal, discard the rest

**Bot turn mechanics**
- Instant execution — no artificial delays (Phase 4 can add visual delays later)
- Server-triggered: after any state change, server checks if activePlayer is a bot and immediately runs the bot's turn
- Bot logic lives in packages/server/ (server-side actors importing game-engine types)
- Headless test harness: ability to run 4 bots through a full game with no server/sockets for isolated testing and simulation

### Claude's Discretion
- Exact scoring formula weights and parameters
- Dev card play timing heuristics (when to play knight vs hold, monopoly resource choice)
- Road building card path selection
- Year of plenty resource selection logic
- Turn action ordering (when to trade before building, etc.)

### Deferred Ideas (OUT OF SCOPE)
- Player-to-player trade negotiation — future phase or Phase 5 polish
- Multiple difficulty levels (easy/medium/hard) — future enhancement
- Bot personality profiles (aggressive builder, port trader, dev card hoarder) — future enhancement
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BOT-01 | Bot takes turns automatically without human input and only submits legal moves | Server-triggered loop in `gameHandlers.ts` post-action; FSM `isActionLegalInPhase` + `applyAction` guard legality |
| BOT-02 | Bot initial settlement placement targets vertices adjacent to high-probability numbers with resource type diversity | Pip-count scoring from `hex.number`, resource diversity scoring across `vertex.adjacentHexKeys` |
| BOT-03 | Bot builds roads, settlements, and cities using heuristic scoring that prioritizes VP gain | `validateSettlementPlacement`/`validateRoadPlacement`/`validateCityPlacement` confirm legality; scoring function evaluates all legal build targets |
| BOT-04 | Bot executes bank and port trades when holding an excess of one resource and needing another | `getBestTradeRate` exposed from `trading.ts`; bot computes goal cost, detects excess, executes `TRADE_BANK` actions |
| BOT-05 | Bot moves robber to block the current leader or a high-production opponent hex | VP scoring per player from `GameState`; hex production score from pip counts; robber must move to different hex |
| BOT-06 | Bot buys dev cards when able and plays knight, monopoly, year of plenty, and road building cards using basic strategic criteria | `applyPlayDevCard` accepts `monopolyResource` and `yearOfPlentyResources` parameters; `PLAY_DEV_CARD` legal in `pre-roll` and `post-roll` |
</phase_requirements>

---

## Summary

This phase implements server-side bot players that play complete Catan games using weighted heuristic scoring. No external AI or ML libraries are needed — the bot is pure TypeScript logic operating on the existing `GameState` data structure. The game engine already provides all the primitives: `applyAction` for state mutation, `isActionLegalInPhase` for phase guards, and fully-traversable `Board.vertices`/`Board.edges` for finding legal moves.

The central architectural decision is where bot logic lives and how it triggers. Bot logic belongs in `packages/server/` as a new module (e.g., `packages/server/src/bot/`), importing game-engine types but never touching socket code. The trigger point is `gameHandlers.ts` after a successful human or bot action: check `state.activePlayer.startsWith('bot-')` and if so, run the bot's full turn synchronously before broadcasting. This creates a natural recursive loop that handles multi-action turns (e.g., discard queues, road-building chains) without any async complexity.

The bot's decision logic follows a deterministic scoring function with seeded randomness for top-N selection. Each bot phase (setup placement, main turn, robber, discard) has a dedicated handler that enumerates legal actions, scores each, selects from the top 2-3 by weighted random, and submits via `applyPlayerAction`. The headless test harness runs a 4-bot game by calling this same logic in a tight loop against `applyAction` directly — no sockets needed.

**Primary recommendation:** Build `packages/server/src/bot/` with a `BotPlayer` module containing `chooseBotAction(state, botId): Action`. Wire it into `gameHandlers.ts` with a `runBotTurns(session, io)` helper that loops until the active player is human or the game ends. Use `makeLcgRng` (already in the codebase) for seeded randomness in tests.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.x | Bot logic language | Already in use across all packages |
| `@catan/game-engine` | workspace `*` | State types, `applyAction`, validation | The engine is the source of truth — bots submit actions through the same interface as humans |
| Vitest | 4.0.x | Unit and integration tests | Already the test runner in both packages |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `makeLcgRng` (internal) | n/a | Seeded RNG for deterministic bot decisions | Use in tests to make bot choices reproducible |
| `socket.io` | 4.8.x | Broadcasting bot-triggered state changes | Already wired; no new dependency needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure heuristic scoring | MCTS / minimax | Orders of magnitude more complex; overkill for Catan at this scope; latency risk in synchronous server loop |
| Inline bot trigger in gameHandlers | Separate BotRunner class | A standalone `runBotTurns` helper function is simpler and sufficient; a class adds no value here |
| Weight constants in source | External config file | Config files add deployment complexity; compile-time constants are fine for a single difficulty level |

**Installation:**
```bash
# No new packages needed — bot logic is pure TypeScript within existing workspace
```

---

## Architecture Patterns

### Recommended Project Structure
```
packages/server/src/
├── bot/
│   ├── BotPlayer.ts          # chooseBotAction(state, botId): Action — core scoring logic
│   ├── scoring.ts            # Vertex scoring, resource need detection, VP computation
│   ├── botRunner.ts          # runBotTurns(session, io) — trigger loop called from gameHandlers
│   └── __tests__/
│       ├── BotPlayer.test.ts # Unit tests: correct action types, legal moves
│       └── simulation.test.ts # Headless 4-bot full game test
├── socket/
│   └── gameHandlers.ts       # MODIFIED: call runBotTurns after successful action
└── game/
    └── RoomSession.ts        # UNCHANGED
```

### Pattern 1: Bot Trigger Loop in gameHandlers

**What:** After every successful action (human or bot), check if the new active player is a bot. If so, compute and apply bot actions until a human is active or the game ends.

**When to use:** Immediately after `session.applyPlayerAction(serverAction)` returns no error.

**Example:**
```typescript
// packages/server/src/socket/gameHandlers.ts
import { runBotTurns } from '../bot/botRunner.js';

socket.on('submit-action', (action) => {
  // ... existing validation and applyPlayerAction call ...
  const result = session.applyPlayerAction(serverAction);
  if (result.error) {
    socket.emit('action:error', { message: result.error });
    return;
  }

  // Broadcast human action result
  broadcastState(session, io, result.events);

  // Run bot turns if the next active player is a bot
  runBotTurns(session, io);
});
```

### Pattern 2: Bot Runner — Synchronous Loop

**What:** `runBotTurns` loops: pick action → apply → broadcast → repeat until active player is human or game over.

**When to use:** Called once after any state change; handles multi-step bot turns (discard chains, road-building cards) transparently.

**Example:**
```typescript
// packages/server/src/bot/botRunner.ts
import type { Server } from 'socket.io';
import type { RoomSession } from '../game/RoomSession.js';
import { chooseBotAction } from './BotPlayer.js';
import { isBotPlayer } from './BotPlayer.js';

const MAX_BOT_ACTIONS_PER_TURN = 50; // safety limit — prevents infinite loops on logic bugs

export function runBotTurns(
  session: RoomSession,
  io: Server,
): void {
  if (!session.gameState) return;

  let safetyCounter = 0;
  while (
    session.gameState &&
    !session.gameState.winner &&
    isBotPlayer(session.gameState.activePlayer) &&
    safetyCounter < MAX_BOT_ACTIONS_PER_TURN
  ) {
    safetyCounter++;
    const action = chooseBotAction(session.gameState, session.gameState.activePlayer);
    const result = session.applyPlayerAction(action);

    if (result.error) {
      // Bot chose an illegal action — this is a bug; log and break to prevent hang
      console.error(`[Bot] Illegal action chosen: ${result.error}`, action);
      break;
    }

    broadcastState(session, io, result.events);
  }
}
```

### Pattern 3: chooseBotAction — Phase Dispatch

**What:** `chooseBotAction` reads the current phase and dispatches to a phase-specific handler.

**When to use:** The single entry point called from `botRunner.ts`.

**Example:**
```typescript
// packages/server/src/bot/BotPlayer.ts
import type { GameState, Action } from '@catan/game-engine';

export function isBotPlayer(playerId: string): boolean {
  return playerId.startsWith('bot-');
}

export function chooseBotAction(state: GameState, botId: string, rand = Math.random): Action {
  switch (state.phase) {
    case 'setup-forward':
    case 'setup-reverse':
      return chooseSetupAction(state, botId, rand);
    case 'pre-roll':
      return choosePreRollAction(state, botId, rand);
    case 'post-roll':
      return choosePostRollAction(state, botId, rand);
    case 'robber-move':
      return { type: 'MOVE_ROBBER', playerId: botId, hexKey: chooseBestRobberHex(state, botId) };
    case 'robber-steal':
      return chooseStealTarget(state, botId);
    case 'discard':
      return chooseDiscard(state, botId);
    case 'road-building':
      return chooseBestRoad(state, botId, rand);
    case 'year-of-plenty':
      return chooseYearOfPlenty(state, botId);
    case 'game-over':
      // Should never reach here; guard in runBotTurns checks winner
      throw new Error('chooseBotAction called in game-over phase');
    default:
      throw new Error(`Unknown phase: ${state.phase}`);
  }
}
```

### Pattern 4: Vertex Scoring for Settlement Placement

**What:** Score each unoccupied, distance-rule-legal vertex by pip count and resource diversity.

**Pip count formula:** Number token → pips: `6 - Math.abs(7 - token)` (gives: 2→1, 3→2, 4→3, 5→4, 6→5, 8→5, 9→4, 10→3, 11→2, 12→1, desert→0).

**Example:**
```typescript
// packages/server/src/bot/scoring.ts
import type { GameState, Vertex } from '@catan/game-engine';

const TOKEN_PIPS: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};

export function scoreVertex(state: GameState, vertexKey: string): number {
  const vertex = state.board.vertices[vertexKey];
  if (!vertex) return 0;

  let pipScore = 0;
  const resourcesSeen = new Set<string>();

  for (const hexKey of vertex.adjacentHexKeys) {
    const hex = state.board.hexes[hexKey];
    if (!hex || !hex.resource || !hex.number) continue;
    pipScore += TOKEN_PIPS[hex.number] ?? 0;
    resourcesSeen.add(hex.resource);
  }

  // Diversity bonus: +1 per distinct resource type (max 3 for a corner vertex)
  const diversityBonus = resourcesSeen.size;

  // Port bonus: small bonus if vertex has a port
  const portBonus = vertex.port ? 1 : 0;

  return pipScore * 10 + diversityBonus * 2 + portBonus;
}

/** Find all vertices legal for setup settlement placement (unoccupied + distance rule). */
export function legalSetupVertices(state: GameState): string[] {
  return Object.keys(state.board.vertices).filter((vKey) => {
    const v = state.board.vertices[vKey]!;
    if (v.building) return false;
    return !v.adjacentVertexKeys.some((adjKey) => state.board.vertices[adjKey]?.building);
  });
}

/** Pick top N vertices by score, return weighted-random selection. */
export function pickWeightedTop(
  candidates: string[],
  scoreFn: (key: string) => number,
  rand: () => number,
  topN = 3,
): string {
  const scored = candidates
    .map((k) => ({ key: k, score: scoreFn(k) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  if (scored.length === 0) throw new Error('No candidates to pick from');

  // Weighted random: higher scores get proportionally more weight
  const totalScore = scored.reduce((sum, s) => sum + Math.max(s.score, 1), 0);
  let threshold = rand() * totalScore;
  for (const s of scored) {
    threshold -= Math.max(s.score, 1);
    if (threshold <= 0) return s.key;
  }
  return scored[0]!.key;
}
```

### Pattern 5: Headless Full-Game Test Harness

**What:** Run a full 4-bot game using only game-engine functions — no server or sockets needed.

**When to use:** Primary verification for BOT-01 (game completes without illegal moves) and BOT-03 (bots reach 10 VP).

**Example:**
```typescript
// packages/server/src/bot/__tests__/simulation.test.ts
import { createInitialGameState, makeLcgRng } from '@catan/game-engine';
import { chooseBotAction, isBotPlayer } from '../BotPlayer.js';
import { applyAction } from '@catan/game-engine';

it('4-bot game runs to completion without illegal moves', () => {
  const rand = makeLcgRng(42);
  let state = createInitialGameState(['bot-0', 'bot-1', 'bot-2', 'bot-3'], () => rand());

  const MAX_ACTIONS = 5000; // prevent infinite loop on logic bugs
  let actionCount = 0;
  let errorCount = 0;

  while (!state.winner && actionCount < MAX_ACTIONS) {
    actionCount++;
    const botId = state.activePlayer;
    if (!isBotPlayer(botId)) break;

    const action = chooseBotAction(state, botId, () => rand());
    const result = applyAction(state, action);

    if (result.error) {
      errorCount++;
      // Log but don't hard-fail yet — count errors
      console.error(`Bot illegal action (${actionCount}): ${result.error}`);
      break; // break on first error to surface the bug
    }

    state = result.state;
  }

  expect(errorCount).toBe(0);
  expect(state.winner).toBeTruthy();
  expect(actionCount).toBeLessThan(MAX_ACTIONS);
});
```

### Anti-Patterns to Avoid

- **Async bot turns:** The bot trigger must be synchronous. Making `runBotTurns` async introduces race conditions where a second human action arrives before bot turns finish, corrupting state.
- **Bot calling applyAction directly without going through RoomSession.applyPlayerAction:** RoomSession owns `gameState` mutation. Bot actions must go through the same `session.applyPlayerAction()` path so `gameState` stays consistent.
- **Building a separate state copy for "lookahead":** The engine is immutable — `applyAction` never mutates. Speculative evaluation is safe: call `applyAction(currentState, hypotheticalAction)` on the snapshot, score the result, discard if not best. But for this phase's heuristic depth, direct scoring of current state is sufficient.
- **Not handling the discard phase for bots:** When a 7 is rolled, `discardQueue` may include bot IDs. The `discard` phase makes the discarding bot the `activePlayer`. The bot runner must handle this correctly — `chooseBotAction` for `discard` phase must call `DISCARD_RESOURCES`.
- **Forgetting SKIP_STEAL:** After `MOVE_ROBBER`, the phase may be `robber-steal` (if opponents present) or `post-roll` (if no opponents on hex). The bot should use `SKIP_STEAL` when the phase transitions there with no valid steal targets — but the engine handles the phase transition itself; the bot just needs to pick `STEAL_RESOURCE` with a valid target from the robber hex.
- **Playing dev card bought this turn:** The engine enforces `GAME-07` (cannot play card bought same turn). The bot must check `player.devCardBoughtThisTurn` before choosing `PLAY_DEV_CARD`.
- **Triggering DISCARD_RESOURCES for bots out of order:** When `discardQueue` has multiple bot entries, each `DISCARD_RESOURCES` action advances to the next entry. The bot runner's loop handles this automatically if it always checks `state.activePlayer` and `isBotPlayer`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Legality checking for bot actions | Custom bot-side validators | Use `applyAction` and check for `result.error` — the engine is the source of truth | Duplicating validation creates drift; engine already enforces all rules |
| Vertex adjacency graph | Re-compute from hex coords | `vertex.adjacentVertexKeys` and `vertex.adjacentEdgeKeys` already populated at board init | Topology is pre-computed and correct per Phase 1 |
| Road connectivity check | Graph traversal from scratch | `validateRoadPlacement` (exported from `placement.ts`) already checks connectivity | Contains opponent-blocking logic that's non-trivial |
| Port rate lookup | Scan vertices manually | `getBestTradeRate(state, playerId, resource)` in `trading.ts` already does this | Handles 2:1, 3:1, and 4:1 cases with early return optimization |
| Seeded RNG | Custom random | `makeLcgRng(seed)` already exported from `generator.ts` | Used by existing tests; consistent interface |

**Key insight:** The game engine already exposes everything the bot needs. The bot's job is to enumerate legal targets and score them — not to re-implement game rules.

---

## Common Pitfalls

### Pitfall 1: Bot Hanging in a Phase With No Legal Actions

**What goes wrong:** Bot enters a phase but its scoring logic returns no candidates (e.g., all legal road positions are exhausted, no cards to discard, no valid steal target). The runner loop stalls.

**Why it happens:** Edge cases in scoring functions return empty candidate lists; `SKIP_STEAL` path not handled; discard returning wrong resource subset.

**How to avoid:**
- Every phase handler must have a guaranteed fallback action. For example, `SKIP_STEAL` is always legal in `robber-steal` if you have no valid targets (actually: `STEAL_RESOURCE` requires target on hex — bot must pick from the set of opponents on the robber hex; if set is empty, phase is already `post-roll`).
- Add the `MAX_BOT_ACTIONS_PER_TURN` safety counter in `runBotTurns` to break the loop and log a bug.
- Test with the headless harness and a safety limit.

**Warning signs:** Test hangs indefinitely; same action logged repeatedly.

### Pitfall 2: Setup Phase Turn Ordering Confusion

**What goes wrong:** Bot places settlement but then tries to place settlement again instead of road, or confuses `setup-forward` vs `setup-reverse` active player.

**Why it happens:** In `setup-forward`, after a settlement the same player places a road (same `activePlayer`). After the road, `activePlayer` advances. In `setup-reverse`, the order reverses.

**How to avoid:** The phase FSM already handles this via `setupPlacementsDone` counters. The bot just needs to check: in `setup-forward` or `setup-reverse` phase, if the active player has no settlement yet, place settlement; otherwise place road adjacent to own settlement. The bot does NOT track turn order — that's the engine's job.

**Warning signs:** Engine returns "Setup road must be adjacent to your settlement" error from bot.

### Pitfall 3: Discard Queue With Multiple Bots

**What goes wrong:** When a 7 is rolled, `discardQueue` may have multiple bot IDs. The `discard` phase sets `activePlayer` to `discardQueue[0]`. After bot discards, `activePlayer` becomes the next entry. The `runBotTurns` loop handles this correctly only if it re-checks `activePlayer` after each action.

**Why it happens:** The loop condition checks `isBotPlayer(state.activePlayer)` — this works correctly as long as state is updated between loop iterations from `session.applyPlayerAction`.

**How to avoid:** Always read `session.gameState.activePlayer` at the top of each loop iteration. Never cache `activePlayer` before the loop.

**Warning signs:** After a 7 roll, human player gets stuck waiting; game state has non-empty `discardQueue` but no discard is happening.

### Pitfall 4: Year of Plenty Phase Handling

**What goes wrong:** `year-of-plenty` phase has only one legal action in the FSM: `PLAY_DEV_CARD`. This is confusing — you play the card to initiate Year of Plenty, and then need to submit the resource selection. But looking at the engine: `PLAY_DEV_CARD` with `card: 'year-of-plenty'` and `yearOfPlentyResources` is a single action that completes the whole effect.

**Correction from code inspection:** Actually the FSM shows `year-of-plenty` phase only allows `PLAY_DEV_CARD`. But looking at `applyPlayDevCard`, playing `year-of-plenty` returns the resources immediately and sets phase back to `post-roll`. The bot plays the card with resources in one action. The `year-of-plenty` FSM phase is what the game is in WHILE the player is CHOOSING resources during Year of Plenty — but wait, the implementation shows it transitions from wherever `PLAY_DEV_CARD` is legal. Re-reading: `PLAY_DEV_CARD` is legal in `pre-roll` and `post-roll`, not `year-of-plenty`. The `year-of-plenty` FSM entry shows it only allows `PLAY_DEV_CARD` — this looks like it could be a bug or the phase is used differently. **Action:** Verify via the test harness whether `year-of-plenty` phase is ever entered as a game phase or if the card resolution is instantaneous.

**How to avoid:** In the `chooseBotAction` dispatch for `year-of-plenty` phase, submit `PLAY_DEV_CARD` with `card: 'year-of-plenty'` and the desired `yearOfPlentyResources`. This matches the FSM (PLAY_DEV_CARD is legal in year-of-plenty phase).

**Warning signs:** Engine returns "Action PLAY_DEV_CARD is not legal in phase year-of-plenty."

### Pitfall 5: Road Building Card — 2 Separate Road Placement Actions

**What goes wrong:** Bot plays road-building card (which sets `phase: 'road-building'`, `roadBuildingRoadsLeft: 2`), then needs to place exactly 2 roads via `PLACE_ROAD` actions. The bot runner loop handles this naturally — first iteration places road 1 (roadBuildingRoadsLeft → 1), second places road 2 (roadBuildingRoadsLeft → 0, phase → post-roll).

**Why it happens:** Bot incorrectly tries to place roads in post-roll phase, or miscounts. The runner loop handles it correctly if `chooseBotAction` for `road-building` phase always picks a `PLACE_ROAD` action.

**How to avoid:** `road-building` phase is in the FSM dispatch. `chooseBotAction` for this phase picks the best unoccupied edge reachable from the bot's road network. If only 1 valid road exists (fully surrounded board late-game), the engine will error on the second placement — but in practice road-building card is rarely played when no roads can be built.

### Pitfall 6: Broadcasting Bot Actions

**What goes wrong:** Bot action state is broadcast inside `runBotTurns`, but `runBotTurns` needs access to `io` (the Socket.IO server). Passing `io` through multiple layers feels awkward.

**How to avoid:** Pass `io` to `runBotTurns` directly. Extract a `broadcastState(session, io, events)` helper used both in `gameHandlers.ts` and `botRunner.ts`. Keep the broadcast logic DRY.

---

## Code Examples

### Computing VP for a Player (for robber targeting, BOT-05)

```typescript
// packages/server/src/bot/scoring.ts
import type { GameState } from '@catan/game-engine';

/** Compute visible VP for a player (excludes hidden VP dev cards for opponents). */
export function computeVisibleVP(state: GameState, playerId: string): number {
  const player = state.players[playerId];
  if (!player) return 0;

  let vp = 0;
  // Settlements and cities on the board
  for (const vertex of Object.values(state.board.vertices)) {
    if (vertex.building?.playerId !== playerId) continue;
    vp += vertex.building.type === 'city' ? 2 : 1;
  }
  // Longest road / largest army bonuses
  if (state.longestRoadHolder === playerId) vp += 2;
  if (state.largestArmyHolder === playerId) vp += 2;
  // VP dev cards (bots have full state access — this is server-side)
  vp += player.vpDevCards;
  return vp;
}

/** Find the highest-VP opponent. */
export function findLeader(state: GameState, excludePlayerId: string): string | null {
  let maxVP = -1;
  let leader: string | null = null;
  for (const pid of state.playerOrder) {
    if (pid === excludePlayerId) continue;
    const vp = computeVisibleVP(state, pid);
    if (vp > maxVP) { maxVP = vp; leader = pid; }
  }
  return leader;
}
```

### Choosing Best Robber Hex (for BOT-05)

```typescript
// packages/server/src/bot/scoring.ts
export function chooseBestRobberHex(state: GameState, botId: string): string {
  const leader = findLeader(state, botId);
  let bestHex = '';
  let bestScore = -1;

  for (const [hexKey, hex] of Object.entries(state.board.hexes)) {
    if (hexKey === state.robberHex) continue; // robber must move
    if (!hex.resource || !hex.number) continue; // skip desert

    const pips = TOKEN_PIPS[hex.number] ?? 0;
    if (pips === 0) continue;

    // Does leader have a settlement on this hex?
    const leaderPresence = leader
      ? hex.vertexKeys.some((vk) => state.board.vertices[vk]?.building?.playerId === leader)
      : false;

    // Score: leader presence is heavily weighted
    const score = pips + (leaderPresence ? 20 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestHex = hexKey;
    }
  }

  // Fallback: any non-current, non-desert hex
  if (!bestHex) {
    bestHex = Object.keys(state.board.hexes).find(
      (k) => k !== state.robberHex && state.board.hexes[k]?.resource !== null
    ) ?? state.robberHex; // last resort: same hex (engine will error, but shouldn't happen)
  }

  return bestHex;
}
```

### Need-Based Trade Logic (for BOT-04)

```typescript
// packages/server/src/bot/scoring.ts
import type { Action, ResourceType } from '@catan/game-engine';
import { getBestTradeRate } from '@catan/game-engine'; // needs to be re-exported

/** What should the bot build next? Returns the cheapest achievable build goal. */
type BuildGoal = 'road' | 'settlement' | 'city' | 'dev-card';

export function chooseTrade(
  state: GameState,
  botId: string
): Action | null {
  const player = state.players[botId];
  if (!player) return null;

  const hand = player.hand;
  const totalCards = Object.values(hand).reduce((a, b) => a + b, 0);

  // Proactive 7-card avoidance: trade most-excess if holding 6+ and can't build
  if (totalCards >= 6) {
    // Find most-excess resource and trade it for something needed
    const sorted = (Object.entries(hand) as [ResourceType, number][])
      .sort(([, a], [, b]) => b - a);
    const [giveRes, giveAmt] = sorted[0]!;
    const rate = getBestTradeRate(state, botId, giveRes);
    if (giveAmt >= rate) {
      // Trade for a resource we have least of
      const receiveRes = sorted[sorted.length - 1]![0];
      if (receiveRes !== giveRes && state.bank[receiveRes] > 0) {
        return { type: 'TRADE_BANK', playerId: botId, give: giveRes, receive: receiveRes, amount: rate };
      }
    }
  }

  // Goal-based trading: determine what to build and trade toward it
  // (simplified: check if one trade gets us to a build)
  // ... (detailed implementation per plan task)

  return null;
}
```

### Choosing Discard Resources (for BOT-01 discard phase)

```typescript
// packages/server/src/bot/BotPlayer.ts
function chooseDiscard(state: GameState, botId: string): Action {
  const player = state.players[botId]!;
  const totalCards = Object.values(player.hand).reduce((a, b) => a + b, 0);
  const discardCount = Math.floor(totalCards / 2); // official rule: discard half rounded down

  // Keep resources needed for build goals; discard excess starting with least useful
  const hand = { ...player.hand };
  const discards: Partial<typeof hand> = { lumber: 0, wool: 0, grain: 0, brick: 0, ore: 0 };
  let remaining = discardCount;

  // Simple strategy: discard most-held resources first
  const resources = (Object.entries(hand) as [ResourceType, number][])
    .sort(([, a], [, b]) => b - a);

  for (const [res, count] of resources) {
    if (remaining <= 0) break;
    const toDiscard = Math.min(count, remaining);
    discards[res] = toDiscard;
    remaining -= toDiscard;
  }

  return { type: 'DISCARD_RESOURCES', playerId: botId, resources: discards };
}
```

### isBotPlayer Helper

```typescript
// packages/server/src/bot/BotPlayer.ts
export function isBotPlayer(playerId: string): boolean {
  return playerId.startsWith('bot-');
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Minimax/MCTS for board game AI | Heuristic scoring with weighted random top-N for simple board games | Established pattern | Heuristic is sufficient for enjoyable solo Catan play; far simpler to implement and debug |
| Polling-based bot trigger | Event-driven trigger after state change | Established pattern | No polling overhead; bot reacts immediately after human action |
| Bot logic in separate process | Bot logic server-side in same process | Context decision | Simpler deployment; no IPC; synchronous state access |

**Deprecated/outdated:**
- setTimeout-based "thinking delay" for bots: Deferred to Phase 4 UX polish (UX-03 in requirements). Phase 3 bots execute instantly.

---

## Open Questions

1. **`year-of-plenty` FSM phase behavior**
   - What we know: FSM maps `year-of-plenty` phase → `['PLAY_DEV_CARD']`. The `applyPlayDevCard` handler for `year-of-plenty` resolves resources immediately and returns to `post-roll`.
   - What's unclear: Is `year-of-plenty` ever entered as a game phase, or does playing the card in `post-roll` complete in one shot? Looking at the FSM: `PLAY_DEV_CARD` is legal in `post-roll`. The `year-of-plenty` FSM entry suggests a two-step flow: play the card → enter `year-of-plenty` phase → submit resources. But the implementation in `applyPlayDevCard` takes `yearOfPlentyResources` in the same action as `card: 'year-of-plenty'` and returns immediately to `post-roll`.
   - Recommendation: Inspect whether `applyPlayDevCard` ever sets `phase: 'year-of-plenty'`. If not, the FSM entry may be dead code or a planned future two-step flow. The bot handler for `year-of-plenty` phase should still exist for safety, submitting `PLAY_DEV_CARD` with resources.

2. **`getBestTradeRate` export from game-engine**
   - What we know: `getBestTradeRate` exists in `trading.ts` but is NOT exported from `packages/game-engine/src/index.ts` (only `applyAction`, `createInitialGameState`, `isActionLegalInPhase`, `generateBoard` are exported).
   - What's unclear: Does the bot need to duplicate this logic or should we add the export?
   - Recommendation: Export `getBestTradeRate` and `BUILD_COSTS` from `game-engine/src/index.ts` in Wave 0 of this phase. Bot code should not duplicate engine logic.

3. **Road path selection for goal-directed expansion (BOT-03)**
   - What we know: The bot should build roads toward the best unoccupied target vertex. This requires BFS/shortest-path from the bot's current road network to candidate vertices.
   - What's unclear: How complex does the path selection need to be? A simple BFS from own-road endpoints to the best unoccupied vertex is sufficient.
   - Recommendation: Implement BFS over `edge.vertexKeys` and `vertex.adjacentEdgeKeys` to find the next road step toward the target vertex. This is the most algorithmically complex part of the phase.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `packages/game-engine/src/` — types.ts, engine/actions.ts, engine/fsm.ts, engine/placement.ts, engine/trading.ts, engine/devCards.ts, engine/robber.ts, board/generator.ts, board/topology.ts
- Direct code inspection: `packages/server/src/socket/gameHandlers.ts`, `game/RoomSession.ts`
- Direct code inspection: `.planning/phases/03-bot-ai/03-CONTEXT.md` — all decisions treated as locked

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — BOT-01 through BOT-06 requirement text
- `.planning/STATE.md` — accumulated decisions and patterns from Phases 1 and 2

### Tertiary (LOW confidence)
- General heuristic Catan AI patterns (training knowledge) — used only for scoring formula structure; all game rule claims are verified against actual engine code

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all dependencies already in workspace
- Architecture patterns: HIGH — derived from direct code inspection of existing server patterns
- Pitfalls: HIGH — derived from actual FSM and engine code; not speculation
- Scoring formulas: MEDIUM — weights and parameters are Claude's discretion (per CONTEXT.md); exact values will be tuned in implementation
- `year-of-plenty` phase flow: MEDIUM — ambiguous from code inspection alone; needs runtime verification

**Research date:** 2026-02-28
**Valid until:** 2026-04-28 (stable domain — no external libraries to version-drift)
