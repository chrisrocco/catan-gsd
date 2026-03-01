import type { GameState, ActionResult, GameEvent, ResourceType, ResourceHand } from '../types.js';

const ALL_RESOURCES: ResourceType[] = ['lumber', 'wool', 'grain', 'brick', 'ore'];

/** Roll two dice using the provided RNG. Returns [die1, die2]. */
export function rollTwoDice(rand: () => number = Math.random): [number, number] {
  const d1 = Math.floor(rand() * 6) + 1;
  const d2 = Math.floor(rand() * 6) + 1;
  return [d1, d2];
}

/** Total cards in a player's hand */
export function handTotal(hand: ResourceHand): number {
  return ALL_RESOURCES.reduce((sum, r) => sum + (hand[r] ?? 0), 0);
}

/**
 * Distribute resources for a dice roll.
 * Skips the robber hex. Desert (null number) never matches.
 * Bank depletion: if total owed for a resource type exceeds supply, no one gets it.
 */
export function distributeResources(
  state: GameState,
  roll: number,
): { players: GameState['players']; bank: ResourceHand; events: GameEvent[] } {
  // Calculate how many of each resource is owed to whom
  const owed: Record<string, Partial<ResourceHand>> = {};
  const totalOwed: ResourceHand = { lumber: 0, wool: 0, grain: 0, brick: 0, ore: 0 };

  for (const hex of Object.values(state.board.hexes)) {
    if (hex.number !== roll) continue;
    if (hex.key === state.robberHex) continue; // robber blocks production
    if (!hex.resource) continue;

    for (const vKey of hex.vertexKeys) {
      const vertex = state.board.vertices[vKey];
      if (!vertex?.building) continue;
      const { playerId, type } = vertex.building;
      const amount = type === 'city' ? 2 : 1;

      if (!owed[playerId]) owed[playerId] = {};
      owed[playerId]![hex.resource] = (owed[playerId]![hex.resource] ?? 0) + amount;
      totalOwed[hex.resource] = (totalOwed[hex.resource] ?? 0) + amount;
    }
  }

  // Check bank depletion — if bank cannot cover total, block that resource for all
  const newBank = { ...state.bank };
  const newPlayers = { ...state.players };
  const grants: Record<string, Partial<ResourceHand>> = {};

  for (const res of ALL_RESOURCES) {
    if (totalOwed[res] === 0) continue;
    if ((newBank[res] ?? 0) < totalOwed[res]) {
      // Bank cannot cover — no one gets this resource this roll (official rule)
      continue;
    }
    // Distribute
    newBank[res] = (newBank[res] ?? 0) - totalOwed[res];
    for (const [playerId, playerOwed] of Object.entries(owed)) {
      const amount = playerOwed[res] ?? 0;
      if (amount === 0) continue;
      const player = newPlayers[playerId]!;
      newPlayers[playerId] = {
        ...player,
        hand: { ...player.hand, [res]: (player.hand[res] ?? 0) + amount },
      };
      if (!grants[playerId]) grants[playerId] = {};
      grants[playerId]![res] = (grants[playerId]![res] ?? 0) + amount;
    }
  }

  const events: GameEvent[] = [];
  if (Object.keys(grants).length > 0) {
    events.push({ type: 'RESOURCES_DISTRIBUTED', grants });
  }

  return { players: newPlayers, bank: newBank, events };
}

/** Apply ROLL_DICE action */
export function applyRollDice(
  state: GameState,
  action: { type: 'ROLL_DICE'; playerId: string; roll?: number },
  rand: () => number = Math.random,
): ActionResult {
  let rollTotal: number;
  let individual: [number, number];

  if (action.roll !== undefined) {
    rollTotal = action.roll;
    // Split the injected roll into two dice for the event (arbitrary split)
    const d1 = Math.ceil(rollTotal / 2);
    const d2 = Math.floor(rollTotal / 2);
    individual = [d1, d2];
  } else {
    const [d1, d2] = rollTwoDice(rand);
    rollTotal = d1 + d2;
    individual = [d1, d2];
  }

  const events: GameEvent[] = [{ type: 'DICE_ROLLED', roll: rollTotal, individual }];

  if (rollTotal === 7) {
    // Determine who must discard (more than 7 cards)
    const discardQueue = Object.values(state.players)
      .filter(p => handTotal(p.hand) > 7)
      .map(p => p.id);

    const events7: GameEvent[] = [...events];
    if (discardQueue.length > 0) {
      events7.push({ type: 'ROBBER_ACTIVATED', playersDiscarding: discardQueue });
    }

    return {
      state: {
        ...state,
        phase: discardQueue.length > 0 ? 'discard' : 'robber-move',
        discardQueue,
      },
      events: events7,
    };
  }

  // Normal roll — distribute resources
  const { players, bank, events: distEvents } = distributeResources(state, rollTotal);

  return {
    state: {
      ...state,
      players,
      bank,
      phase: 'post-roll',
    },
    events: [...events, ...distEvents],
  };
}

/** Apply DISCARD_RESOURCES action */
export function applyDiscard(
  state: GameState,
  action: { type: 'DISCARD_RESOURCES'; playerId: string; resources: Partial<ResourceHand> },
): ActionResult {
  // Only the first player in discardQueue may discard
  if (state.discardQueue[0] !== action.playerId) {
    return { state, events: [], error: `${action.playerId} is not the next player to discard` };
  }

  const player = state.players[action.playerId];
  if (!player) return { state, events: [], error: `Player ${action.playerId} not found` };

  const total = handTotal(player.hand);
  const mustDiscard = Math.floor(total / 2);
  const discardCount = ALL_RESOURCES.reduce((sum, r) => sum + (action.resources[r] ?? 0), 0);

  if (discardCount !== mustDiscard) {
    return {
      state,
      events: [],
      error: `Must discard exactly ${mustDiscard} cards (have ${total}), got ${discardCount}`,
    };
  }

  // Validate player has the cards they claim to discard
  const newHand = { ...player.hand };
  const newBank = { ...state.bank };
  for (const res of ALL_RESOURCES) {
    const amount = action.resources[res] ?? 0;
    if ((newHand[res] ?? 0) < amount) {
      return { state, events: [], error: `Insufficient ${res} to discard` };
    }
    newHand[res] = (newHand[res] ?? 0) - amount;
    newBank[res] = (newBank[res] ?? 0) + amount;
  }

  const newDiscardQueue = state.discardQueue.slice(1);
  const newPhase = newDiscardQueue.length === 0 ? 'robber-move' : 'discard';

  return {
    state: {
      ...state,
      players: { ...state.players, [action.playerId]: { ...player, hand: newHand } },
      bank: newBank,
      discardQueue: newDiscardQueue,
      phase: newPhase,
    },
    events: [],
  };
}
