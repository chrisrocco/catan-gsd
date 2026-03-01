/**
 * Bot scoring module — vertex desirability, VP computation, robber targeting, and trade decisions.
 * All functions are pure and operate on immutable GameState snapshots.
 */

import type { GameState, Action, ResourceType, ResourceHand } from '@catan/game-engine';
import { getBestTradeRate, BUILD_COSTS } from '@catan/game-engine';

// ============================================================
// Constants
// ============================================================

/** Pip counts per number token (probability weight) */
export const TOKEN_PIPS: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5,
  8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};

const ALL_RESOURCES: ResourceType[] = ['lumber', 'wool', 'grain', 'brick', 'ore'];

// ============================================================
// Vertex scoring
// ============================================================

/**
 * Score a vertex for settlement desirability.
 * Primary factor: sum of adjacent hex pip counts (x10).
 * Diversity bonus: distinct resource types touching vertex (x2).
 * Port bonus: small tiebreaker (+1).
 */
export function scoreVertex(state: GameState, vertexKey: string): number {
  const vertex = state.board.vertices[vertexKey];
  if (!vertex) return 0;

  let pipTotal = 0;
  const resourcesSeen = new Set<ResourceType>();

  for (const hexKey of vertex.adjacentHexKeys) {
    const hex = state.board.hexes[hexKey];
    if (!hex) continue;
    if (hex.resource === null) continue; // desert — skip
    if (hex.number === null) continue;   // desert or sea — skip

    pipTotal += TOKEN_PIPS[hex.number] ?? 0;
    resourcesSeen.add(hex.resource);
  }

  const diversityBonus = resourcesSeen.size * 2;
  const portBonus = vertex.port ? 1 : 0;

  return pipTotal * 10 + diversityBonus + portBonus;
}

// ============================================================
// Legal setup vertices
// ============================================================

/**
 * Returns all vertex keys that are legal for setup settlement placement.
 * A vertex is legal if:
 * - It has no building
 * - No adjacent vertex has a building (distance rule)
 * - It has at least one adjacent land hex (non-sea, non-null resource)
 */
export function legalSetupVertices(state: GameState): string[] {
  const vertices = state.board.vertices;
  return Object.keys(vertices).filter(vKey => {
    const v = vertices[vKey]!;

    // Must be unoccupied
    if (v.building !== null) return false;

    // Distance rule: no adjacent vertex may have a building
    for (const adjKey of v.adjacentVertexKeys) {
      if (vertices[adjKey]?.building !== null) return false;
    }

    // Must have at least one adjacent hex (land or desert — any non-sea hex)
    const hasAdjacentHex = v.adjacentHexKeys.some(hk => !!state.board.hexes[hk]);
    if (!hasAdjacentHex) return false;

    return true;
  });
}

// ============================================================
// Weighted top-N selection
// ============================================================

/**
 * Score all candidates, take top-N, then select one using score-weighted probability.
 * Lower threshold rand values select higher-scoring candidates.
 * Throws if no candidates provided.
 */
export function pickWeightedTop<T>(
  candidates: T[],
  scoreFn: (candidate: T) => number,
  rand: () => number,
  topN: number = 3,
): T {
  if (candidates.length === 0) {
    throw new Error('pickWeightedTop: no candidates provided');
  }

  // Score and sort descending
  const scored = candidates
    .map(c => ({ candidate: c, score: scoreFn(c) }))
    .sort((a, b) => b.score - a.score);

  // Take top N (or all if fewer)
  const topCandidates = scored.slice(0, topN);

  const totalScore = topCandidates.reduce((sum, s) => sum + Math.max(s.score, 0), 0);

  if (totalScore <= 0) {
    // All scores are zero or negative — pick uniformly
    const idx = Math.floor(rand() * topCandidates.length);
    return topCandidates[idx]!.candidate;
  }

  // Weighted random selection
  let threshold = rand() * totalScore;
  for (const { candidate, score } of topCandidates) {
    threshold -= Math.max(score, 0);
    if (threshold <= 0) return candidate;
  }

  // Fallback: last candidate
  return topCandidates[topCandidates.length - 1]!.candidate;
}

// ============================================================
// VP computation
// ============================================================

/**
 * Compute visible VP for a player:
 * - Settlements: 1 VP
 * - Cities: 2 VP
 * - Longest road holder: +2
 * - Largest army holder: +2
 * - VP dev cards: +N
 */
export function computeVisibleVP(state: GameState, playerId: string): number {
  let vp = 0;

  for (const vertex of Object.values(state.board.vertices)) {
    if (vertex.building?.playerId !== playerId) continue;
    vp += vertex.building.type === 'city' ? 2 : 1;
  }

  if (state.longestRoadHolder === playerId) vp += 2;
  if (state.largestArmyHolder === playerId) vp += 2;

  const player = state.players[playerId];
  if (player) vp += player.vpDevCards;

  return vp;
}

// ============================================================
// Leader detection
// ============================================================

/**
 * Find the opponent with highest VP, excluding the querying bot.
 * Returns null if no opponents found.
 */
export function findLeader(state: GameState, excludePlayerId: string): string | null {
  let leaderId: string | null = null;
  let leaderVP = -1;

  for (const playerId of state.playerOrder) {
    if (playerId === excludePlayerId) continue;
    const vp = computeVisibleVP(state, playerId);
    if (vp > leaderVP) {
      leaderVP = vp;
      leaderId = playerId;
    }
  }

  return leaderId;
}

// ============================================================
// Robber targeting
// ============================================================

/**
 * Choose the best hex to place the robber.
 * Scoring:
 * - Base: pip count of hex
 * - +20 bonus if the current VP leader has a building on that hex
 * Constraints:
 * - Never select current robber hex
 * - Never select desert (resource === null)
 * - Avoid hexes where ONLY the bot has buildings (don't rob yourself)
 * Falls back to any valid non-robber, non-desert hex if scoring yields nothing.
 */
export function chooseBestRobberHex(state: GameState, botId: string): string {
  const leader = findLeader(state, botId);

  let bestKey: string | null = null;
  let bestScore = -Infinity;

  for (const hex of Object.values(state.board.hexes)) {
    // Skip current robber position and desert
    if (hex.key === state.robberHex) continue;
    if (hex.resource === null || hex.number === null) continue;

    const pips = TOKEN_PIPS[hex.number] ?? 0;
    const leaderBonus = leader && hex.vertexKeys.some(vk =>
      state.board.vertices[vk]?.building?.playerId === leader
    ) ? 20 : 0;

    // Check if only the bot has buildings here (avoid self-robbing)
    const buildingOwners = hex.vertexKeys
      .map(vk => state.board.vertices[vk]?.building?.playerId)
      .filter(Boolean) as string[];

    if (buildingOwners.length > 0 && buildingOwners.every(id => id === botId)) {
      continue; // Only bot's own buildings — skip
    }

    const score = pips + leaderBonus;
    if (score > bestScore) {
      bestScore = score;
      bestKey = hex.key;
    }
  }

  // Fallback: any non-robber, non-desert hex
  if (!bestKey) {
    const fallback = Object.values(state.board.hexes).find(
      h => h.key !== state.robberHex && h.resource !== null,
    );
    bestKey = fallback?.key ?? state.robberHex;
  }

  return bestKey;
}

// ============================================================
// Build goal computation
// ============================================================

/** What the bot should build next based on current state */
export type BuildGoal = 'city' | 'settlement' | 'road' | 'dev-card' | null;

/**
 * Determine what the bot should build next.
 * Priority order: city > settlement > road > dev-card
 */
export function computeBuildGoal(state: GameState, botId: string): BuildGoal {
  const player = state.players[botId];
  if (!player) return null;

  const hand = player.hand;

  // Can build a city? (must have existing settlement to upgrade)
  if (player.settlementCount > 0) {
    const hasSettlement = Object.values(state.board.vertices).some(
      v => v.building?.playerId === botId && v.building.type === 'settlement',
    );
    if (hasSettlement) {
      // Check if approaching city resources (grain + ore)
      const cityProgress = Math.min(
        (hand.grain ?? 0) / 2,
        (hand.ore ?? 0) / 3,
      );
      if (cityProgress > 0) return 'city';
    }
  }

  // Can build a settlement? (need reachable vertex via roads)
  if (player.settlementCount < 5) {
    const legalVerts = legalSetupVertices(state);
    const hasReachableVertex = legalVerts.some(vKey => {
      const v = state.board.vertices[vKey]!;
      return v.adjacentEdgeKeys.some(ek => state.board.edges[ek]?.road?.playerId === botId);
    });
    if (hasReachableVertex && (hand.brick ?? 0) > 0 && (hand.lumber ?? 0) > 0) {
      return 'settlement';
    }
  }

  // Build a road to expand reach
  if ((hand.brick ?? 0) > 0 && (hand.lumber ?? 0) > 0) {
    return 'road';
  }

  // Buy a dev card (if deck not empty and can afford)
  if (state.deck.length > 0) {
    const canAfford = Object.entries(BUILD_COSTS['dev-card']).every(
      ([res, amt]) => (hand[res as ResourceType] ?? 0) >= (amt ?? 0),
    );
    if (canAfford) return 'dev-card';
  }

  return null;
}

// ============================================================
// Trade decision
// ============================================================

function handTotal(hand: ResourceHand): number {
  return ALL_RESOURCES.reduce((sum, r) => sum + (hand[r] ?? 0), 0);
}

/**
 * Decide whether to execute a bank/port trade.
 * Returns a TRADE_BANK action or null.
 *
 * Strategy:
 * 1. If can make a useful trade toward the build goal — do it.
 * 2. Proactive 7-card avoidance: if total cards >= 6 and no goal, trade most-excess for least-held.
 */
export function chooseTrade(state: GameState, botId: string): Action | null {
  const player = state.players[botId];
  if (!player) return null;

  const hand = player.hand;
  const total = handTotal(hand);
  if (total === 0) return null;

  const goal = computeBuildGoal(state, botId);

  if (goal !== null) {
    const cost = BUILD_COSTS[goal];
    // Determine needed resources (those below the required amount)
    const needed = (Object.entries(cost) as [ResourceType, number][]).filter(
      ([res, amt]) => (hand[res] ?? 0) < amt,
    );

    if (needed.length > 0) {
      const [neededRes] = needed[0]!;

      // Find best resource to give
      for (const giveRes of ALL_RESOURCES) {
        if (giveRes === neededRes) continue;
        const rate = getBestTradeRate(state, botId, giveRes);
        if ((hand[giveRes] ?? 0) >= rate) {
          return {
            type: 'TRADE_BANK',
            playerId: botId,
            give: giveRes,
            receive: neededRes,
            amount: rate,
          };
        }
      }
    }
  }

  // 7-card avoidance: if holding >= 6 cards and bank rate available
  if (total >= 6) {
    // Find most-excess resource
    const sorted = ALL_RESOURCES
      .map(r => ({ resource: r, count: hand[r] ?? 0 }))
      .sort((a, b) => b.count - a.count);

    const giveEntry = sorted.find(entry => {
      const rate = getBestTradeRate(state, botId, entry.resource);
      return entry.count >= rate;
    });

    if (giveEntry) {
      // Find least-held resource to receive
      const receiveEntry = ALL_RESOURCES
        .map(r => ({ resource: r, count: hand[r] ?? 0 }))
        .filter(e => e.resource !== giveEntry.resource)
        .sort((a, b) => a.count - b.count)[0];

      if (receiveEntry) {
        const rate = getBestTradeRate(state, botId, giveEntry.resource);
        return {
          type: 'TRADE_BANK',
          playerId: botId,
          give: giveEntry.resource,
          receive: receiveEntry.resource,
          amount: rate,
        };
      }
    }
  }

  return null;
}
