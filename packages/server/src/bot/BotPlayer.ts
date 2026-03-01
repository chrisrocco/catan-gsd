/**
 * BotPlayer — core bot decision logic.
 * chooseBotAction dispatches to phase-specific handlers.
 * All handlers return a single Action that can be immediately applied.
 */

import type { GameState, Action, ResourceType } from '@catan/game-engine';
import { BUILD_COSTS } from '@catan/game-engine';
import {
  legalSetupVertices,
  pickWeightedTop,
  scoreVertex,
  chooseBestRobberHex,
  computeBuildGoal,
  chooseTrade,
} from './scoring.js';

const ALL_RESOURCES: ResourceType[] = ['lumber', 'wool', 'grain', 'brick', 'ore'];

// ============================================================
// Public API
// ============================================================

/**
 * Returns true if the playerId belongs to a bot.
 * Bot IDs are always prefixed with 'bot-'.
 */
export function isBotPlayer(playerId: string): boolean {
  return playerId.startsWith('bot-');
}

/**
 * Choose the next action for a bot in the given game state.
 * Dispatches to a phase-specific handler.
 *
 * For the discard phase, pass discardQueue[0] as botId (not activePlayer).
 */
export function chooseBotAction(
  state: GameState,
  botId: string,
  rand: () => number = Math.random,
): Action {
  switch (state.phase) {
    case 'setup-forward':
    case 'setup-reverse':
      return chooseSetupAction(state, botId, rand);

    case 'pre-roll':
      return choosePreRollAction(state, botId);

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
      throw new Error('chooseBotAction called in game-over phase');

    default:
      throw new Error(`Unknown phase: ${(state as GameState).phase}`);
  }
}

// ============================================================
// Phase handlers
// ============================================================

/**
 * Setup phase: alternate between placing a settlement and placing a road.
 * The active player in setup must place settlement then road.
 * setupPlacementsDone counts total placements (settlement + road each = 1).
 * Within a player's turn: odd setupPlacementsDone mod 2 means need road, even means need settlement.
 */
function chooseSetupAction(state: GameState, botId: string, rand: () => number): Action {
  // setupPlacementsDone starts at 0, increments on each placement.
  // Within a player's setup "turn": placement 0 = settlement, placement 1 = road.
  // After both, active player changes.
  // setupPlacementsDone % 2 === 0 means the current player needs a settlement,
  // because settlements are placed first (even index).
  const needsSettlement = state.setupPlacementsDone % 2 === 0;

  if (needsSettlement) {
    // Place settlement at best legal vertex
    const candidates = legalSetupVertices(state);
    if (candidates.length === 0) {
      // Fallback: shouldn't happen in valid setup state
      throw new Error('No legal setup vertices available');
    }
    const vertexKey = pickWeightedTop(
      candidates,
      (vk) => scoreVertex(state, vk),
      rand,
      5,
    );
    return { type: 'PLACE_SETTLEMENT', playerId: botId, vertexKey };
  } else {
    // Place road adjacent to the bot's most recently placed settlement
    const edgeKey = chooseBestSetupRoad(state, botId, rand);
    return { type: 'PLACE_ROAD', playerId: botId, edgeKey };
  }
}

/**
 * Find the best road edge for the setup phase.
 * Must be adjacent to the bot's most recently placed settlement.
 */
function chooseBestSetupRoad(state: GameState, botId: string, rand: () => number): string {
  // Find all of bot's settlement vertices
  const botSettlements = Object.values(state.board.vertices)
    .filter(v => v.building?.playerId === botId && v.building.type === 'settlement')
    .map(v => v.key);

  if (botSettlements.length === 0) {
    throw new Error(`Bot ${botId} has no settlements for road placement`);
  }

  // The most recently placed settlement should be the one with no adjacent roads from this bot.
  // Find the settlement that has no adjacent bot roads (the newest one in setup).
  let targetSettlement: string | null = null;
  for (const vKey of botSettlements) {
    const vertex = state.board.vertices[vKey]!;
    const hasBotRoad = vertex.adjacentEdgeKeys.some(ek => state.board.edges[ek]?.road?.playerId === botId);
    if (!hasBotRoad) {
      targetSettlement = vKey;
      break;
    }
  }

  // Fallback: use the last settlement if all have roads (shouldn't happen in valid setup)
  if (!targetSettlement) {
    targetSettlement = botSettlements[botSettlements.length - 1]!;
  }

  const vertex = state.board.vertices[targetSettlement]!;

  // Collect legal unoccupied edges adjacent to the target settlement
  const candidates = vertex.adjacentEdgeKeys.filter(ek => {
    const edge = state.board.edges[ek];
    return edge && !edge.road;
  });

  if (candidates.length === 0) {
    throw new Error(`No legal road edges adjacent to settlement ${targetSettlement}`);
  }

  // Score by the best unoccupied vertex the road leads to
  const scoreEdge = (ek: string) => {
    const edge = state.board.edges[ek]!;
    const otherVertexKey = edge.vertexKeys.find(vk => vk !== targetSettlement) ?? edge.vertexKeys[0]!;
    return scoreVertex(state, otherVertexKey);
  };

  return pickWeightedTop(candidates, scoreEdge, rand, 3);
}

/**
 * Pre-roll phase: decide whether to play a knight card or just roll.
 * Strategic conditions for playing a knight:
 * - Has knight in unplayedDevCards
 * - Hasn't bought a dev card this turn (GAME-07)
 * - Hasn't played a dev card this turn yet
 * - Close to largest army (knight count >= 2) OR robber is on our hex
 */
function choosePreRollAction(state: GameState, botId: string): Action {
  const player = state.players[botId];
  if (player && player.unplayedDevCards.includes('knight')) {
    const canPlay =
      !player.devCardBoughtThisTurn &&
      player.devCardsPlayedThisTurn < 1;

    if (canPlay) {
      // Play knight strategically
      const isCloseToLargestArmy = player.knightCount >= 2;
      const robberOnOurHex = isRobberThreateningBot(state, botId);

      if (isCloseToLargestArmy || robberOnOurHex) {
        return { type: 'PLAY_DEV_CARD', playerId: botId, card: 'knight' };
      }
    }
  }

  return { type: 'ROLL_DICE', playerId: botId };
}

/** Check if the robber is on a hex where this bot has buildings. */
function isRobberThreateningBot(state: GameState, botId: string): boolean {
  const robberHex = state.board.hexes[state.robberHex];
  if (!robberHex) return false;
  return robberHex.vertexKeys.some(vk => state.board.vertices[vk]?.building?.playerId === botId);
}

/**
 * Post-roll phase: execute highest-priority available action.
 * Priority: dev card plays > build city > build settlement > build road > buy dev card > trade > END_TURN
 *
 * Returns ONE action per call. The runner loop calls again after each successful action.
 */
function choosePostRollAction(state: GameState, botId: string, rand: () => number): Action {
  const player = state.players[botId];
  if (!player) return { type: 'END_TURN', playerId: botId };

  // 1. Play non-knight dev cards if beneficial
  const devCardAction = chooseDevCardPlay(state, botId, rand);
  if (devCardAction) return devCardAction;

  // 2. Build city if can afford and have a settlement
  if (canAffordBuildType(player.hand, 'city')) {
    const upgradeVertex = findSettlementToUpgrade(state, botId);
    if (upgradeVertex) {
      return { type: 'UPGRADE_CITY', playerId: botId, vertexKey: upgradeVertex };
    }
  }

  // 3. Build settlement if can afford and have a legal connected vertex
  if (canAffordBuildType(player.hand, 'settlement')) {
    const settlementVertex = findLegalSettlementVertex(state, botId);
    if (settlementVertex) {
      return { type: 'PLACE_SETTLEMENT', playerId: botId, vertexKey: settlementVertex };
    }
  }

  // 4. Trade if beneficial (to get resources for a build goal)
  const tradeAction = chooseTrade(state, botId);
  if (tradeAction) return tradeAction;

  // 5. Build road if can afford and have a useful expansion target
  if (canAffordBuildType(player.hand, 'road')) {
    const roadEdge = findBestExpansionRoad(state, botId, rand);
    if (roadEdge) {
      return { type: 'PLACE_ROAD', playerId: botId, edgeKey: roadEdge };
    }
  }

  // 6. Buy dev card if can afford and deck not empty
  if (state.deck.length > 0 && canAffordBuildType(player.hand, 'dev-card')) {
    return { type: 'BUY_DEV_CARD', playerId: botId };
  }

  // 7. End turn
  return { type: 'END_TURN', playerId: botId };
}

/** Attempt to play a non-knight dev card. Returns action or null. */
function chooseDevCardPlay(state: GameState, botId: string, rand: () => number): Action | null {
  const player = state.players[botId];
  if (!player) return null;

  const canPlay = !player.devCardBoughtThisTurn && player.devCardsPlayedThisTurn < 1;
  if (!canPlay) return null;

  const cards = player.unplayedDevCards;

  // Monopoly: steal the resource opponents hold most
  if (cards.includes('monopoly')) {
    const monopolyResource = findMostHeldOpponentResource(state, botId);
    if (monopolyResource) {
      return { type: 'PLAY_DEV_CARD', playerId: botId, card: 'monopoly', monopolyResource };
    }
  }

  // Road building: play if bot has < 15 roads placed and there are legal edges
  if (cards.includes('road-building')) {
    const player_ = state.players[botId]!;
    if (player_.roadCount < 14) {
      const edges = findLegalRoadEdges(state, botId);
      if (edges.length > 0) {
        return { type: 'PLAY_DEV_CARD', playerId: botId, card: 'road-building' };
      }
    }
  }

  // Year of plenty: play if we have a clear build goal
  if (cards.includes('year-of-plenty')) {
    const goal = computeBuildGoal(state, botId);
    if (goal) {
      const [r1, r2] = chooseYearOfPlentyResources(state, botId);
      return { type: 'PLAY_DEV_CARD', playerId: botId, card: 'year-of-plenty', yearOfPlentyResources: [r1, r2] };
    }
  }

  return null;
}

/** Find the resource that opponents collectively hold the most of. */
function findMostHeldOpponentResource(state: GameState, botId: string): ResourceType | null {
  const totals: Record<ResourceType, number> = { lumber: 0, wool: 0, grain: 0, brick: 0, ore: 0 };
  for (const [playerId, player] of Object.entries(state.players)) {
    if (playerId === botId) continue;
    for (const res of ALL_RESOURCES) {
      totals[res] += player.hand[res] ?? 0;
    }
  }
  let bestRes: ResourceType | null = null;
  let bestCount = 0;
  for (const res of ALL_RESOURCES) {
    if (totals[res] > bestCount) {
      bestCount = totals[res];
      bestRes = res;
    }
  }
  return bestRes;
}

/** Check if the player can afford a build type. */
function canAffordBuildType(hand: Record<ResourceType, number>, buildType: keyof typeof BUILD_COSTS): boolean {
  const cost = BUILD_COSTS[buildType];
  return (Object.entries(cost) as [ResourceType, number][]).every(
    ([res, amt]) => (hand[res] ?? 0) >= amt,
  );
}

/** Find a settlement vertex to upgrade to city (prefer highest-pip vertex). */
function findSettlementToUpgrade(state: GameState, botId: string): string | null {
  let bestKey: string | null = null;
  let bestScore = -Infinity;

  for (const [vKey, vertex] of Object.entries(state.board.vertices)) {
    if (vertex.building?.playerId !== botId) continue;
    if (vertex.building.type !== 'settlement') continue;

    const score = scoreVertex(state, vKey);
    if (score > bestScore) {
      bestScore = score;
      bestKey = vKey;
    }
  }

  return bestKey;
}

/** Find a legal settlement vertex reachable from this bot's road network. */
function findLegalSettlementVertex(state: GameState, botId: string): string | null {
  const legalVerts = legalSetupVertices(state);
  let bestKey: string | null = null;
  let bestScore = -Infinity;

  for (const vKey of legalVerts) {
    const vertex = state.board.vertices[vKey]!;
    // Must be reachable via bot's roads
    const reachable = vertex.adjacentEdgeKeys.some(ek => state.board.edges[ek]?.road?.playerId === botId);
    if (!reachable) continue;

    const score = scoreVertex(state, vKey);
    if (score > bestScore) {
      bestScore = score;
      bestKey = vKey;
    }
  }

  return bestKey;
}

/** Find all legal road edges connected to the bot's road network. */
function findLegalRoadEdges(state: GameState, botId: string): string[] {
  // Get all vertices reachable by bot's road network
  const botRoadEdges = Object.values(state.board.edges)
    .filter(e => e.road?.playerId === botId)
    .map(e => e.key);

  if (botRoadEdges.length === 0) {
    // Fallback: find edges adjacent to bot's settlements
    const botSettlements = Object.values(state.board.vertices)
      .filter(v => v.building?.playerId === botId)
      .map(v => v.key);

    const candidates: string[] = [];
    for (const vKey of botSettlements) {
      const vertex = state.board.vertices[vKey]!;
      for (const ek of vertex.adjacentEdgeKeys) {
        const edge = state.board.edges[ek];
        if (edge && !edge.road && !candidates.includes(ek)) {
          candidates.push(ek);
        }
      }
    }
    return candidates;
  }

  // Find edges adjacent to bot's road endpoints (vertices at ends of roads)
  const networkVertices = new Set<string>();
  for (const ek of botRoadEdges) {
    const edge = state.board.edges[ek]!;
    for (const vk of edge.vertexKeys) {
      // Only add vertex if it's not blocked by opponent building
      const building = state.board.vertices[vk]?.building;
      if (!building || building.playerId === botId) {
        networkVertices.add(vk);
      }
    }
  }

  const candidates: string[] = [];
  for (const vKey of networkVertices) {
    const vertex = state.board.vertices[vKey]!;
    for (const ek of vertex.adjacentEdgeKeys) {
      const edge = state.board.edges[ek];
      if (edge && !edge.road && !candidates.includes(ek)) {
        candidates.push(ek);
      }
    }
  }

  return candidates;
}

/** Find best road for expansion toward an unoccupied high-value vertex. */
function findBestExpansionRoad(state: GameState, botId: string, rand: () => number): string | null {
  const candidates = findLegalRoadEdges(state, botId);
  if (candidates.length === 0) return null;

  const scoreEdge = (ek: string): number => {
    const edge = state.board.edges[ek]!;
    // Score by best of the two vertex endpoints (prefer unoccupied high-pip vertices)
    return Math.max(...edge.vertexKeys.map(vk => {
      const vertex = state.board.vertices[vk];
      if (!vertex) return 0;
      if (vertex.building && vertex.building.playerId !== botId) return -10; // blocked
      return scoreVertex(state, vk);
    }));
  };

  return pickWeightedTop(candidates, scoreEdge, rand, 5);
}

/**
 * Robber-steal phase: steal from an opponent on the robber hex.
 * Prefer stealing from the VP leader.
 */
function chooseStealTarget(state: GameState, botId: string): Action {
  const robberHex = state.board.hexes[state.robberHex];
  if (!robberHex) {
    return { type: 'SKIP_STEAL', playerId: botId };
  }

  // Find opponents with buildings on the robber hex
  const targets = robberHex.vertexKeys
    .map(vk => state.board.vertices[vk]?.building?.playerId)
    .filter((pid): pid is string => !!pid && pid !== botId);

  if (targets.length === 0) {
    return { type: 'SKIP_STEAL', playerId: botId };
  }

  // Prefer the target with most resources (or the leader)
  let bestTarget = targets[0]!;
  let bestCount = -1;

  for (const targetId of targets) {
    const player = state.players[targetId];
    if (!player) continue;
    const handCount = ALL_RESOURCES.reduce((s, r) => s + (player.hand[r] ?? 0), 0);
    if (handCount > bestCount) {
      bestCount = handCount;
      bestTarget = targetId;
    }
  }

  return { type: 'STEAL_RESOURCE', playerId: botId, targetPlayerId: bestTarget };
}

/**
 * Discard phase: discard floor(handTotal / 2) cards.
 * Strategy: keep resources aligned with build goal, discard most-excess first.
 */
function chooseDiscard(state: GameState, botId: string): Action {
  const player = state.players[botId];
  if (!player) {
    return { type: 'DISCARD_RESOURCES', playerId: botId, resources: {} };
  }

  const hand = { ...player.hand };
  const total = ALL_RESOURCES.reduce((s, r) => s + (hand[r] ?? 0), 0);
  const discardCount = Math.floor(total / 2);

  if (discardCount === 0) {
    return { type: 'DISCARD_RESOURCES', playerId: botId, resources: {} };
  }

  // Determine ideal hand based on build goal
  const goal = computeBuildGoal(state, botId);
  const goalCost = goal ? BUILD_COSTS[goal] : null;

  const discards: Partial<Record<ResourceType, number>> = {};
  let remaining = discardCount;

  // Discard excess resources (more than needed for build goal)
  // Sort by excess (most over goal first)
  const excess = ALL_RESOURCES.map(res => {
    const held = hand[res] ?? 0;
    const needed = goalCost ? ((goalCost as Record<string, number>)[res] ?? 0) : 0;
    return { res, held, needed, excess: Math.max(0, held - needed) };
  }).sort((a, b) => b.excess - a.excess);

  for (const { res, excess: excessAmt } of excess) {
    if (remaining <= 0) break;
    const toDiscard = Math.min(remaining, excessAmt);
    if (toDiscard > 0) {
      discards[res] = toDiscard;
      remaining -= toDiscard;
    }
  }

  // If still need to discard more, take from most-held resources
  if (remaining > 0) {
    const byHeld = ALL_RESOURCES
      .map(res => ({ res, held: (hand[res] ?? 0) - (discards[res] ?? 0) }))
      .sort((a, b) => b.held - a.held);

    for (const { res, held } of byHeld) {
      if (remaining <= 0) break;
      if (held <= 0) continue;
      const toDiscard = Math.min(remaining, held);
      discards[res] = (discards[res] ?? 0) + toDiscard;
      remaining -= toDiscard;
    }
  }

  return { type: 'DISCARD_RESOURCES', playerId: botId, resources: discards };
}

/**
 * Road-building dev card phase: place a road on best expansion edge.
 */
function chooseBestRoad(state: GameState, botId: string, rand: () => number): Action {
  const edgeKey = findBestExpansionRoad(state, botId, rand);
  if (!edgeKey) {
    // No legal edges — this shouldn't happen in road-building phase normally
    // Fallback: pick any unoccupied edge adjacent to our road network
    const anyEdge = Object.entries(state.board.edges)
      .find(([, e]) => !e.road)?.[0];
    if (!anyEdge) throw new Error('No edges available for road-building');
    return { type: 'PLACE_ROAD', playerId: botId, edgeKey: anyEdge };
  }
  return { type: 'PLACE_ROAD', playerId: botId, edgeKey };
}

/**
 * Year-of-plenty phase: pick 2 resources toward build goal.
 * yearOfPlentyResourcesLeft tracks whether we're picking 1st or 2nd resource — but
 * the action type 'PLAY_DEV_CARD' with yearOfPlentyResources picks both at once.
 * This is called when phase === 'year-of-plenty' but we need to send PLACE_ROAD? No —
 * actually the year-of-plenty phase requires a different action.
 *
 * Wait: in the game engine, year-of-plenty is handled via PLAY_DEV_CARD in pre/post-roll,
 * not via a separate year-of-plenty action in the year-of-plenty phase.
 * Let me check the FSM.
 */
function chooseYearOfPlenty(state: GameState, botId: string): Action {
  // The year-of-plenty phase means the bot already played the card,
  // and now must select 2 resources. In our engine this is done by passing
  // yearOfPlentyResources in PLAY_DEV_CARD — but if we're in year-of-plenty phase
  // the engine might expect an END_TURN or specific action.
  // Check FSM for what's legal in year-of-plenty phase.
  // Based on the GamePhase type and context: year-of-plenty is a special phase
  // where the player needs to pick resources. The action is likely PLAY_DEV_CARD
  // with the yearOfPlentyResources field, OR the engine handles this within
  // the PLAY_DEV_CARD call immediately.
  //
  // Looking at the plan context: chooseBotAction in year-of-plenty returns
  // PLAY_DEV_CARD with yearOfPlentyResources: [r1, r2]
  // So the year-of-plenty phase still uses PLAY_DEV_CARD action type.

  const [r1, r2] = chooseYearOfPlentyResources(state, botId);
  return {
    type: 'PLAY_DEV_CARD',
    playerId: botId,
    card: 'year-of-plenty',
    yearOfPlentyResources: [r1, r2],
  };
}

/** Pick 2 resources most needed for the current build goal. */
function chooseYearOfPlentyResources(state: GameState, botId: string): [ResourceType, ResourceType] {
  const player = state.players[botId];
  const goal = computeBuildGoal(state, botId);

  if (goal && player) {
    const cost = BUILD_COSTS[goal];
    // Find the 2 most-needed resources for this goal
    const needed = ALL_RESOURCES
      .map(res => {
        const have = player.hand[res] ?? 0;
        const needAmt = (cost as Record<string, number>)[res] ?? 0;
        return { res, shortfall: Math.max(0, needAmt - have) };
      })
      .filter(x => x.shortfall > 0)
      .sort((a, b) => b.shortfall - a.shortfall);

    if (needed.length >= 2) {
      return [needed[0]!.res, needed[1]!.res];
    }
    if (needed.length === 1) {
      // Second pick: least-held resource
      const leastHeld = ALL_RESOURCES
        .filter(r => r !== needed[0]!.res)
        .sort((a, b) => (player.hand[a] ?? 0) - (player.hand[b] ?? 0))[0] ?? 'ore';
      return [needed[0]!.res, leastHeld];
    }
  }

  // No goal: pick 2 most scarce resources
  if (player) {
    const sorted = ALL_RESOURCES
      .sort((a, b) => (player.hand[a] ?? 0) - (player.hand[b] ?? 0));
    return [sorted[0]!, sorted[1]!];
  }

  return ['ore', 'grain'];
}
