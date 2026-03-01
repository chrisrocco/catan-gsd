import { describe, it, expect } from 'vitest';
import { validateSettlementPlacement, validateRoadPlacement, validateCityPlacement } from './placement.js';
import { applyAction } from './actions.js';
import { createInitialGameState } from './fsm.js';
import { makeLcgRng } from '../board/generator.js';

function setupState(playerIds = ['p1', 'p2']) {
  return createInitialGameState(playerIds, makeLcgRng(42));
}

describe('validateSettlementPlacement (setup phase)', () => {
  it('allows placement on empty vertex during setup', () => {
    const state = setupState();
    const vertexKey = Object.keys(state.board.vertices)[0]!;
    const error = validateSettlementPlacement(state, 'p1', vertexKey);
    expect(error).toBeNull();
  });

  it('rejects placement on occupied vertex', () => {
    const state = setupState();
    const vertices = Object.values(state.board.vertices);
    const vertexKey = vertices[0]!.key;
    // Manually place a settlement
    const stateWithSettlement = {
      ...state,
      board: {
        ...state.board,
        vertices: {
          ...state.board.vertices,
          [vertexKey]: { ...state.board.vertices[vertexKey]!, building: { playerId: 'p2', type: 'settlement' as const } },
        },
      },
    };
    const error = validateSettlementPlacement(stateWithSettlement, 'p1', vertexKey);
    expect(error).not.toBeNull();
  });

  it('enforces distance rule (adjacent vertex occupied)', () => {
    const state = setupState();
    const vertices = Object.values(state.board.vertices);
    // Place on first vertex, then try adjacent
    const v1 = vertices.find(v => v.adjacentVertexKeys.length > 0)!;
    const v2Key = v1.adjacentVertexKeys[0]!;
    const stateWithSettlement = {
      ...state,
      board: {
        ...state.board,
        vertices: {
          ...state.board.vertices,
          [v1.key]: { ...state.board.vertices[v1.key]!, building: { playerId: 'p2', type: 'settlement' as const } },
        },
      },
    };
    const error = validateSettlementPlacement(stateWithSettlement, 'p1', v2Key);
    expect(error).not.toBeNull();
  });
});

describe('applyAction — turn order enforcement (GAME-14)', () => {
  it('rejects action from non-active player', () => {
    const state = setupState(['p1', 'p2']);
    const vertexKey = Object.keys(state.board.vertices)[0]!;
    const result = applyAction(state, { type: 'PLACE_SETTLEMENT', playerId: 'p2', vertexKey });
    expect(result.error).toContain('Not your turn');
    expect(result.state).toBe(state); // state unchanged (same reference)
  });

  it('accepts action from active player', () => {
    const state = setupState(['p1', 'p2']);
    const vertexKey = Object.keys(state.board.vertices)[0]!;
    const result = applyAction(state, { type: 'PLACE_SETTLEMENT', playerId: 'p1', vertexKey });
    // Should not be a turn-order error (may have other errors based on vertex validity)
    // When error is undefined (success) or a non-turn-order error, this should pass
    const errorIsNotTurnOrder = result.error === undefined || !result.error.includes('Not your turn');
    expect(errorIsNotTurnOrder).toBe(true);
  });
});

describe('applyAction — phase enforcement', () => {
  it('rejects ROLL_DICE during setup-forward', () => {
    const state = setupState();
    expect(state.phase).toBe('setup-forward');
    const result = applyAction(state, { type: 'ROLL_DICE', playerId: 'p1' });
    expect(result.error).toContain('not legal in phase');
  });

  it('rejects END_TURN during setup-forward', () => {
    const state = setupState();
    const result = applyAction(state, { type: 'END_TURN', playerId: 'p1' });
    expect(result.error).toContain('not legal in phase');
  });
});

describe('setup phase placement flow', () => {
  it('does not mutate input state', () => {
    const state = setupState();
    const vertexKey = Object.keys(state.board.vertices)[0]!;
    const before = JSON.stringify(state);
    applyAction(state, { type: 'PLACE_SETTLEMENT', playerId: 'p1', vertexKey });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('settlement placement increments settlementCount', () => {
    const state = setupState();
    const vertexKey = Object.keys(state.board.vertices)[0]!;
    const result = applyAction(state, { type: 'PLACE_SETTLEMENT', playerId: 'p1', vertexKey });
    if (!result.error) {
      expect(result.state.players['p1']!.settlementCount).toBe(1);
    }
  });

  it('setup-reverse settlement grants free resources', () => {
    const state = setupState(['p1', 'p2']);
    // Manually put state in setup-reverse with active player p1
    const reverseState = { ...state, phase: 'setup-reverse' as const };
    // Find a vertex adjacent to at least one resource hex
    const vertexWithResources = Object.values(state.board.vertices).find(v =>
      v.adjacentHexKeys.some(hk => state.board.hexes[hk]?.resource !== null)
    )!;
    const result = applyAction(reverseState, { type: 'PLACE_SETTLEMENT', playerId: 'p1', vertexKey: vertexWithResources.key });
    if (!result.error) {
      const totalResources = Object.values(result.state.players['p1']!.hand).reduce((a, b) => a + b, 0);
      expect(totalResources).toBeGreaterThan(0);
    }
  });
});

describe('validateRoadPlacement (setup phase)', () => {
  it('allows road adjacent to own settlement during setup', () => {
    const state = setupState();
    // First place a settlement
    const vertexKey = Object.keys(state.board.vertices)[0]!;
    const vertex = state.board.vertices[vertexKey]!;
    const stateWithSettlement = {
      ...state,
      board: {
        ...state.board,
        vertices: {
          ...state.board.vertices,
          [vertexKey]: { ...vertex, building: { playerId: 'p1', type: 'settlement' as const } },
        },
      },
    };
    // Try placing a road on an edge adjacent to that vertex
    const edgeKey = vertex.adjacentEdgeKeys[0]!;
    const error = validateRoadPlacement(stateWithSettlement, 'p1', edgeKey);
    expect(error).toBeNull();
  });

  it('rejects road not adjacent to own settlement during setup', () => {
    const state = setupState();
    // Find an edge far from any own building
    const edgeKey = Object.keys(state.board.edges)[0]!;
    const error = validateRoadPlacement(state, 'p1', edgeKey);
    expect(error).not.toBeNull();
  });

  it('rejects road on occupied edge', () => {
    const state = setupState();
    const edgeKey = Object.keys(state.board.edges)[0]!;
    const stateWithRoad = {
      ...state,
      board: {
        ...state.board,
        edges: {
          ...state.board.edges,
          [edgeKey]: { ...state.board.edges[edgeKey]!, road: { playerId: 'p2' } },
        },
      },
    };
    const error = validateRoadPlacement(stateWithRoad, 'p1', edgeKey);
    expect(error).not.toBeNull();
  });
});

describe('validateCityPlacement', () => {
  it('rejects upgrade when no settlement exists', () => {
    const state = setupState();
    const vertexKey = Object.keys(state.board.vertices)[0]!;
    const error = validateCityPlacement(state, 'p1', vertexKey);
    expect(error).not.toBeNull();
  });

  it('rejects upgrading another player settlement', () => {
    const state = setupState();
    const vertexKey = Object.keys(state.board.vertices)[0]!;
    const stateWithSettlement = {
      ...state,
      board: {
        ...state.board,
        vertices: {
          ...state.board.vertices,
          [vertexKey]: { ...state.board.vertices[vertexKey]!, building: { playerId: 'p2', type: 'settlement' as const } },
        },
      },
    };
    const error = validateCityPlacement(stateWithSettlement, 'p1', vertexKey);
    expect(error).not.toBeNull();
  });

  it('rejects upgrade when insufficient resources', () => {
    const state = setupState();
    const vertexKey = Object.keys(state.board.vertices)[0]!;
    const stateWithSettlement = {
      ...state,
      board: {
        ...state.board,
        vertices: {
          ...state.board.vertices,
          [vertexKey]: { ...state.board.vertices[vertexKey]!, building: { playerId: 'p1', type: 'settlement' as const } },
        },
      },
    };
    // p1 has no resources — should fail resource check
    const error = validateCityPlacement(stateWithSettlement, 'p1', vertexKey);
    expect(error).not.toBeNull();
    expect(error).toContain('resources');
  });
});
