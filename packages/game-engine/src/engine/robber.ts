import type { GameState, ActionResult, GameEvent, ResourceType } from '../types.js';

const ALL_RESOURCES: ResourceType[] = ['lumber', 'wool', 'grain', 'brick', 'ore'];

/** Apply MOVE_ROBBER action */
export function applyMoveRobber(
  state: GameState,
  action: { type: 'MOVE_ROBBER'; playerId: string; hexKey: string },
  rand: () => number = Math.random,
): ActionResult {
  const targetHex = state.board.hexes[action.hexKey];
  if (!targetHex) return { state, events: [], error: `Hex ${action.hexKey} does not exist` };
  if (targetHex.resource === undefined) return { state, events: [], error: `Hex ${action.hexKey} is not a land hex` };
  // Official rules: robber must move to a different hex
  if (action.hexKey === state.robberHex) {
    return { state, events: [], error: 'Robber must move to a different hex' };
  }

  // Find opponents with buildings on any vertex of the new robber hex
  const opponentIds = new Set<string>();
  for (const vKey of targetHex.vertexKeys) {
    const vertex = state.board.vertices[vKey];
    if (vertex?.building && vertex.building.playerId !== action.playerId) {
      opponentIds.add(vertex.building.playerId);
    }
  }

  const newPhase = opponentIds.size > 0 ? 'robber-steal' : 'post-roll';

  return {
    state: {
      ...state,
      robberHex: action.hexKey,
      phase: newPhase,
    },
    events: [],
  };
}

/** Apply STEAL_RESOURCE action */
export function applyStealResource(
  state: GameState,
  action: { type: 'STEAL_RESOURCE'; playerId: string; targetPlayerId: string },
  rand: () => number = Math.random,
): ActionResult {
  // Validate target has a building on the robber hex
  const robberHex = state.board.hexes[state.robberHex];
  if (!robberHex) return { state, events: [], error: 'Robber hex not found' };

  const targetOnHex = robberHex.vertexKeys.some(vKey => {
    const vertex = state.board.vertices[vKey];
    return vertex?.building?.playerId === action.targetPlayerId;
  });

  if (!targetOnHex) {
    return { state, events: [], error: `${action.targetPlayerId} has no settlement on the robber hex` };
  }

  const target = state.players[action.targetPlayerId];
  if (!target) return { state, events: [], error: `Player ${action.targetPlayerId} not found` };

  // Find all resources the target has
  const availableResources = ALL_RESOURCES.filter(r => (target.hand[r] ?? 0) > 0);
  if (availableResources.length === 0) {
    // Target has no cards — steal nothing, move to post-roll
    return {
      state: { ...state, phase: 'post-roll' },
      events: [],
    };
  }

  // Pick a random resource
  const stolen = availableResources[Math.floor(rand() * availableResources.length)] as ResourceType;

  const thief = state.players[action.playerId]!;

  const events: GameEvent[] = [{
    type: 'RESOURCE_STOLEN',
    fromPlayer: action.targetPlayerId,
    byPlayer: action.playerId,
    resource: stolen,
  }];

  return {
    state: {
      ...state,
      phase: 'post-roll',
      players: {
        ...state.players,
        [action.targetPlayerId]: {
          ...target,
          hand: { ...target.hand, [stolen]: (target.hand[stolen] ?? 0) - 1 },
        },
        [action.playerId]: {
          ...thief,
          hand: { ...thief.hand, [stolen]: (thief.hand[stolen] ?? 0) + 1 },
        },
      },
    },
    events,
  };
}

/** Apply SKIP_STEAL action — used when there's no one to steal from */
export function applySkipSteal(
  state: GameState,
  action: { type: 'SKIP_STEAL'; playerId: string },
): ActionResult {
  return {
    state: { ...state, phase: 'post-roll' },
    events: [],
  };
}
