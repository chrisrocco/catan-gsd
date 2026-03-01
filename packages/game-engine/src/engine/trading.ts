import type { GameState, ActionResult, GameEvent, ResourceType, ResourceHand } from '../types.js';

const ALL_RESOURCES: ResourceType[] = ['lumber', 'wool', 'grain', 'brick', 'ore'];

// Official Catan build costs
export const BUILD_COSTS: Record<'road' | 'settlement' | 'city' | 'dev-card', Partial<ResourceHand>> = {
  road:       { brick: 1, lumber: 1 },
  settlement: { brick: 1, lumber: 1, grain: 1, wool: 1 },
  city:       { grain: 2, ore: 3 },
  'dev-card': { ore: 1, grain: 1, wool: 1 },
};

/**
 * Validate a player has sufficient resources for a build action.
 * Returns error string or null if sufficient.
 */
export function validateBuildCost(
  hand: ResourceHand,
  buildType: keyof typeof BUILD_COSTS,
): string | null {
  const cost = BUILD_COSTS[buildType];
  for (const [res, amount] of Object.entries(cost) as [ResourceType, number][]) {
    if ((hand[res] ?? 0) < amount) {
      return `Insufficient resources for ${buildType}: need ${amount} ${res}, have ${hand[res] ?? 0}`;
    }
  }
  return null;
}

/**
 * Get the best available trade rate for a resource for a given player.
 * Checks all vertices where the player has a settlement or city for port presence.
 * Returns 2 (specific 2:1 port), 3 (generic 3:1 port), or 4 (bank rate).
 */
export function getBestTradeRate(state: GameState, playerId: string, resource: ResourceType): 2 | 3 | 4 {
  let bestRate: 2 | 3 | 4 = 4;

  for (const vertex of Object.values(state.board.vertices)) {
    if (vertex.building?.playerId !== playerId) continue;
    if (!vertex.port) continue;

    const portType = vertex.port.type;
    if (portType === resource) {
      return 2; // Specific 2:1 port — can't get better
    }
    if (portType === '3:1' && bestRate > 3) {
      bestRate = 3;
    }
  }

  return bestRate;
}

/**
 * Validate a bank/port trade.
 * Returns error string or null if valid.
 */
export function validateTrade(
  state: GameState,
  playerId: string,
  give: ResourceType,
  receive: ResourceType,
  amount: number,
): string | null {
  if (give === receive) return 'Cannot trade a resource for itself';

  const player = state.players[playerId];
  if (!player) return `Player ${playerId} not found`;

  const bestRate = getBestTradeRate(state, playerId, give);
  if (amount !== bestRate) {
    return `Must trade at your best rate: ${bestRate}:1 for ${give} (provided amount: ${amount})`;
  }

  if ((player.hand[give] ?? 0) < amount) {
    return `Insufficient ${give}: need ${amount}, have ${player.hand[give] ?? 0}`;
  }

  if ((state.bank[receive] ?? 0) < 1) {
    return `Bank has no ${receive} remaining`;
  }

  return null;
}

/**
 * Apply TRADE_BANK action — executes bank or port trade.
 * Wire into actions.ts dispatcher.
 */
export function applyTrade(
  state: GameState,
  action: { type: 'TRADE_BANK'; playerId: string; give: ResourceType; receive: ResourceType; amount: number },
): ActionResult {
  const error = validateTrade(state, action.playerId, action.give, action.receive, action.amount);
  if (error) return { state, events: [], error };

  const player = state.players[action.playerId]!;
  const newHand = { ...player.hand };
  const newBank = { ...state.bank };

  newHand[action.give] = (newHand[action.give] ?? 0) - action.amount;
  newBank[action.give] = (newBank[action.give] ?? 0) + action.amount;
  newHand[action.receive] = (newHand[action.receive] ?? 0) + 1;
  newBank[action.receive] = (newBank[action.receive] ?? 0) - 1;

  const event: GameEvent = {
    type: 'TRADE_COMPLETED',
    playerId: action.playerId,
    gave: action.give,
    gaveAmount: action.amount,
    received: action.receive,
    receivedAmount: 1,
  };

  return {
    state: {
      ...state,
      players: { ...state.players, [action.playerId]: { ...player, hand: newHand } },
      bank: newBank,
    },
    events: [event],
  };
}
