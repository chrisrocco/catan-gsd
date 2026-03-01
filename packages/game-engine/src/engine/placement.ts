import type { GameState, ActionResult, GameEvent, ResourceHand, ResourceType } from '../types.js';

/** Returns an error message if the settlement cannot be placed, or null if valid */
export function validateSettlementPlacement(
  state: GameState,
  playerId: string,
  vertexKey: string,
): string | null {
  const vertex = state.board.vertices[vertexKey];
  if (!vertex) return `Vertex ${vertexKey} does not exist`;
  if (vertex.building) return `Vertex ${vertexKey} is already occupied`;

  // Distance rule: no adjacent vertex may have a building
  for (const adjVKey of vertex.adjacentVertexKeys) {
    if (state.board.vertices[adjVKey]?.building) {
      return `Too close to existing settlement at ${adjVKey}`;
    }
  }

  const isSetup = state.phase === 'setup-forward' || state.phase === 'setup-reverse';
  if (!isSetup) {
    // Normal play: must have a connected road
    const hasConnectedRoad = vertex.adjacentEdgeKeys.some(eKey => {
      const edge = state.board.edges[eKey];
      return edge?.road?.playerId === playerId;
    });
    if (!hasConnectedRoad) return 'Settlement must be connected to your road network';

    // Resource check: 1 brick + 1 lumber + 1 grain + 1 wool
    const hand = state.players[playerId]?.hand;
    if (!hand) return `Player ${playerId} not found`;
    if (hand.brick < 1 || hand.lumber < 1 || hand.grain < 1 || hand.wool < 1) {
      return 'Insufficient resources: need 1 brick, 1 lumber, 1 grain, 1 wool';
    }
  }

  return null;
}

/** Returns an error message if the road cannot be placed, or null if valid */
export function validateRoadPlacement(
  state: GameState,
  playerId: string,
  edgeKey: string,
): string | null {
  const edge = state.board.edges[edgeKey];
  if (!edge) return `Edge ${edgeKey} does not exist`;
  if (edge.road) return `Edge ${edgeKey} already has a road`;

  const isSetup = state.phase === 'setup-forward' || state.phase === 'setup-reverse';

  if (isSetup) {
    // During setup: road must be adjacent to a vertex with own settlement
    const hasAdjacentOwnSettlement = edge.vertexKeys.some(vKey => {
      const vertex = state.board.vertices[vKey];
      return vertex?.building?.playerId === playerId;
    });
    if (!hasAdjacentOwnSettlement) return 'Setup road must be adjacent to your settlement';
    return null;
  }

  // Normal play: must connect to own settlement/city or own road, and not blocked
  const connectsToOwnPiece = edge.vertexKeys.some(vKey => {
    const vertex = state.board.vertices[vKey];
    if (!vertex) return false;
    // Own building at this vertex
    if (vertex.building?.playerId === playerId) return true;
    // Own road adjacent to this vertex (but vertex not blocked by opponent)
    const opponentBlocked = vertex.building && vertex.building.playerId !== playerId;
    if (opponentBlocked) return false;
    return vertex.adjacentEdgeKeys.some(adjEKey => {
      if (adjEKey === edgeKey) return false;
      return state.board.edges[adjEKey]?.road?.playerId === playerId;
    });
  });

  if (!connectsToOwnPiece) return 'Road must connect to your existing road or settlement';

  // During road-building dev card phase, roads are free — skip resource check
  if (state.phase === 'road-building') {
    return null;
  }

  // Resource check: 1 brick + 1 lumber
  const hand = state.players[playerId]?.hand;
  if (!hand) return `Player ${playerId} not found`;
  if (hand.brick < 1 || hand.lumber < 1) {
    return 'Insufficient resources: need 1 brick, 1 lumber';
  }

  return null;
}

/** Returns an error message if the city upgrade cannot be placed, or null if valid */
export function validateCityPlacement(
  state: GameState,
  playerId: string,
  vertexKey: string,
): string | null {
  const vertex = state.board.vertices[vertexKey];
  if (!vertex) return `Vertex ${vertexKey} does not exist`;
  if (!vertex.building) return `No settlement at ${vertexKey} to upgrade`;
  if (vertex.building.playerId !== playerId) return "Cannot upgrade another player's settlement";
  if (vertex.building.type === 'city') return 'Already a city';

  const hand = state.players[playerId]?.hand;
  if (!hand) return `Player ${playerId} not found`;
  if (hand.grain < 2 || hand.ore < 3) {
    return 'Insufficient resources: need 2 grain, 3 ore';
  }

  return null;
}

/** Deduct resources from player and add to bank — returns error or updated state slices */
function deductResources(
  state: GameState,
  playerId: string,
  cost: Partial<ResourceHand>,
): { players: typeof state.players; bank: ResourceHand } | string {
  const player = state.players[playerId];
  if (!player) return `Player ${playerId} not found`;

  const newHand = { ...player.hand };
  const newBank = { ...state.bank };

  for (const [res, amount] of Object.entries(cost) as [ResourceType, number][]) {
    if ((newHand[res] ?? 0) < amount) return `Insufficient ${res}`;
    newHand[res] = (newHand[res] ?? 0) - amount;
    newBank[res] = (newBank[res] ?? 0) + amount;
  }

  return {
    players: {
      ...state.players,
      [playerId]: { ...player, hand: newHand },
    },
    bank: newBank,
  };
}

/** Grant free resources from adjacent hexes (used in setup-reverse) */
function grantSetupResources(
  state: GameState,
  playerId: string,
  vertexKey: string,
): { players: typeof state.players; bank: ResourceHand } {
  const vertex = state.board.vertices[vertexKey];
  const newHand = { ...state.players[playerId]!.hand };
  const newBank = { ...state.bank };

  if (vertex) {
    for (const hexKey of vertex.adjacentHexKeys) {
      const hex = state.board.hexes[hexKey];
      if (hex?.resource && newBank[hex.resource] > 0) {
        newHand[hex.resource] = (newHand[hex.resource] ?? 0) + 1;
        newBank[hex.resource] = (newBank[hex.resource] ?? 0) - 1;
      }
    }
  }

  return {
    players: {
      ...state.players,
      [playerId]: { ...state.players[playerId]!, hand: newHand },
    },
    bank: newBank,
  };
}

/** Apply PLACE_SETTLEMENT action — handles setup and normal play */
export function applySettlement(
  state: GameState,
  action: { type: 'PLACE_SETTLEMENT'; playerId: string; vertexKey: string },
): ActionResult {
  const error = validateSettlementPlacement(state, action.playerId, action.vertexKey);
  if (error) return { state, events: [], error };

  const isSetup = state.phase === 'setup-forward' || state.phase === 'setup-reverse';
  const player = state.players[action.playerId]!;

  // Place settlement on board
  const newVertices = {
    ...state.board.vertices,
    [action.vertexKey]: {
      ...state.board.vertices[action.vertexKey]!,
      building: { playerId: action.playerId, type: 'settlement' as const },
    },
  };

  let newPlayers = {
    ...state.players,
    [action.playerId]: { ...player, settlementCount: player.settlementCount + 1 },
  };
  let newBank = state.bank;

  // Deduct resources in normal play
  if (!isSetup) {
    const result = deductResources(state, action.playerId, { brick: 1, lumber: 1, grain: 1, wool: 1 });
    if (typeof result === 'string') return { state, events: [], error: result };
    newPlayers = {
      ...newPlayers,
      [action.playerId]: { ...newPlayers[action.playerId]!, hand: result.players[action.playerId]!.hand },
    };
    newBank = result.bank;
  }

  // Grant free resources in setup-reverse
  if (state.phase === 'setup-reverse') {
    const granted = grantSetupResources(
      { ...state, board: { ...state.board, vertices: newVertices }, players: newPlayers, bank: newBank },
      action.playerId,
      action.vertexKey,
    );
    newPlayers = granted.players;
    newBank = granted.bank;
  }

  const events: GameEvent[] = [{ type: 'SETTLEMENT_PLACED', playerId: action.playerId, vertexKey: action.vertexKey }];

  const newState: GameState = {
    ...state,
    board: { ...state.board, vertices: newVertices },
    players: newPlayers,
    bank: newBank,
    setupPlacementsDone: isSetup ? state.setupPlacementsDone + 1 : state.setupPlacementsDone,
  };

  return { state: newState, events };
}

/** Apply PLACE_ROAD action — handles setup and normal play */
export function applyRoad(
  state: GameState,
  action: { type: 'PLACE_ROAD'; playerId: string; edgeKey: string },
): ActionResult {
  const error = validateRoadPlacement(state, action.playerId, action.edgeKey);
  if (error) return { state, events: [], error };

  const isSetup = state.phase === 'setup-forward' || state.phase === 'setup-reverse';
  const isRoadBuilding = state.phase === 'road-building';
  const player = state.players[action.playerId]!;

  const newEdges = {
    ...state.board.edges,
    [action.edgeKey]: {
      ...state.board.edges[action.edgeKey]!,
      road: { playerId: action.playerId },
    },
  };

  let newPlayers = {
    ...state.players,
    [action.playerId]: { ...player, roadCount: player.roadCount + 1 },
  };
  let newBank = state.bank;

  // Deduct resources in normal play (not setup, not road-building dev card)
  if (!isSetup && !isRoadBuilding) {
    const result = deductResources(state, action.playerId, { brick: 1, lumber: 1 });
    if (typeof result === 'string') return { state, events: [], error: result };
    newPlayers = {
      ...newPlayers,
      [action.playerId]: { ...newPlayers[action.playerId]!, hand: result.players[action.playerId]!.hand },
    };
    newBank = result.bank;
  }

  const events: GameEvent[] = [{ type: 'ROAD_PLACED', playerId: action.playerId, edgeKey: action.edgeKey }];

  // Advance setup turn order or decrement road-building counter
  let newPhase = state.phase;
  let newActive = state.activePlayer;
  let newSetupDone = state.setupPlacementsDone;
  let newRoadBuildingLeft = state.roadBuildingRoadsLeft;

  if (isSetup) {
    newSetupDone = state.setupPlacementsDone + 1;
    const totalPlayers = state.playerOrder.length;
    const totalSetupActions = totalPlayers * 4; // 4 actions per player (2 settlements + 2 roads)
    const forwardActions = totalPlayers * 2; // first half: forward

    if (newSetupDone >= totalSetupActions) {
      // Setup complete — transition to pre-roll with first player
      newPhase = 'pre-roll';
      newActive = state.playerOrder[0]!;
    } else if (newSetupDone === forwardActions) {
      // Transition from forward to reverse
      newPhase = 'setup-reverse';
      newActive = state.playerOrder[totalPlayers - 1]!;
    } else if (newSetupDone < forwardActions) {
      // Still in setup-forward — advance to next player after every 2nd action
      if (newSetupDone % 2 === 0) {
        const currentIdx = state.playerOrder.indexOf(state.activePlayer);
        newActive = state.playerOrder[currentIdx + 1] ?? state.playerOrder[0]!;
      }
    } else {
      // In setup-reverse — advance backward after every 2nd action
      if (newSetupDone % 2 === 0) {
        const currentIdx = state.playerOrder.indexOf(state.activePlayer);
        if (currentIdx > 0) {
          newActive = state.playerOrder[currentIdx - 1]!;
        }
      }
    }
  } else if (isRoadBuilding) {
    newRoadBuildingLeft = state.roadBuildingRoadsLeft - 1;
    if (newRoadBuildingLeft <= 0) {
      newPhase = 'post-roll';
      newRoadBuildingLeft = 0;
    }
  }

  const newState: GameState = {
    ...state,
    board: { ...state.board, edges: newEdges },
    players: newPlayers,
    bank: newBank,
    phase: newPhase,
    activePlayer: newActive,
    setupPlacementsDone: newSetupDone,
    roadBuildingRoadsLeft: newRoadBuildingLeft,
  };

  return { state: newState, events };
}

/** Apply UPGRADE_CITY action */
export function applyCity(
  state: GameState,
  action: { type: 'UPGRADE_CITY'; playerId: string; vertexKey: string },
): ActionResult {
  const error = validateCityPlacement(state, action.playerId, action.vertexKey);
  if (error) return { state, events: [], error };

  const player = state.players[action.playerId]!;

  const result = deductResources(state, action.playerId, { grain: 2, ore: 3 });
  if (typeof result === 'string') return { state, events: [], error: result };

  const newVertices = {
    ...state.board.vertices,
    [action.vertexKey]: {
      ...state.board.vertices[action.vertexKey]!,
      building: { playerId: action.playerId, type: 'city' as const },
    },
  };

  const events: GameEvent[] = [{ type: 'CITY_PLACED', playerId: action.playerId, vertexKey: action.vertexKey }];

  return {
    state: {
      ...state,
      board: { ...state.board, vertices: newVertices },
      players: {
        ...result.players,
        [action.playerId]: {
          ...result.players[action.playerId]!,
          settlementCount: player.settlementCount - 1,
          cityCount: player.cityCount + 1,
        },
      },
      bank: result.bank,
    },
    events,
  };
}
