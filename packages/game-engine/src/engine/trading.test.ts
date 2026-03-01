import { describe, it, expect } from 'vitest';
import { getBestTradeRate, validateTrade, applyTrade, BUILD_COSTS, validateBuildCost } from './trading.js';
import { createInitialGameState } from './fsm.js';
import { makeLcgRng } from '../board/generator.js';
import type { GameState, ResourceHand } from '../types.js';

function makeState() {
  return createInitialGameState(['p1', 'p2'], makeLcgRng(42));
}

function withHand(state: GameState, playerId: string, hand: Partial<ResourceHand>): GameState {
  const full: ResourceHand = { lumber: 0, wool: 0, grain: 0, brick: 0, ore: 0, ...hand };
  return { ...state, players: { ...state.players, [playerId]: { ...state.players[playerId]!, hand: full } } };
}

function withPort(state: GameState, playerId: string, portType: string): GameState {
  // Place settlement + port on first available vertex
  const vertex = Object.values(state.board.vertices)[0]!;
  return {
    ...state,
    board: {
      ...state.board,
      vertices: {
        ...state.board.vertices,
        [vertex.key]: {
          ...vertex,
          building: { playerId, type: 'settlement' },
          port: { type: portType as any },
        },
      },
    },
  };
}

describe('BUILD_COSTS', () => {
  it('road costs 1 brick + 1 lumber', () => {
    expect(BUILD_COSTS.road).toEqual({ brick: 1, lumber: 1 });
  });
  it('settlement costs 1 brick + 1 lumber + 1 grain + 1 wool', () => {
    expect(BUILD_COSTS.settlement).toEqual({ brick: 1, lumber: 1, grain: 1, wool: 1 });
  });
  it('city costs 2 grain + 3 ore', () => {
    expect(BUILD_COSTS.city).toEqual({ grain: 2, ore: 3 });
  });
  it('dev card costs 1 ore + 1 grain + 1 wool', () => {
    expect(BUILD_COSTS['dev-card']).toEqual({ ore: 1, grain: 1, wool: 1 });
  });
});

describe('validateBuildCost', () => {
  it('returns null when player has sufficient resources', () => {
    const hand: ResourceHand = { lumber: 2, wool: 2, grain: 2, brick: 2, ore: 2 };
    expect(validateBuildCost(hand, 'settlement')).toBeNull();
  });

  it('returns error when player lacks resource', () => {
    const hand: ResourceHand = { lumber: 0, wool: 1, grain: 1, brick: 1, ore: 1 };
    const error = validateBuildCost(hand, 'road');
    expect(error).toContain('lumber');
  });

  it('validates city cost (2 grain + 3 ore)', () => {
    const hand: ResourceHand = { lumber: 0, wool: 0, grain: 1, brick: 0, ore: 3 };
    expect(validateBuildCost(hand, 'city')).toContain('grain');
  });
});

describe('getBestTradeRate', () => {
  it('returns 4 with no ports', () => {
    const state = makeState();
    expect(getBestTradeRate(state, 'p1', 'lumber')).toBe(4);
  });

  it('returns 3 with generic 3:1 port', () => {
    const state = withPort(makeState(), 'p1', '3:1');
    expect(getBestTradeRate(state, 'p1', 'lumber')).toBe(3);
  });

  it('returns 2 with specific 2:1 port for matching resource', () => {
    const state = withPort(makeState(), 'p1', 'lumber');
    expect(getBestTradeRate(state, 'p1', 'lumber')).toBe(2);
  });

  it('returns 4 (not 2) for non-matching resource on specific port', () => {
    // Has lumber port but asking about wool → no benefit for wool
    const state = withPort(makeState(), 'p1', 'lumber');
    // No 3:1 port here, so should still be 4 for non-lumber resources
    expect(getBestTradeRate(state, 'p1', 'wool')).toBe(4);
  });

  it('uses best rate when player has both 3:1 and specific port', () => {
    const base = makeState();
    const vertices = Object.values(base.board.vertices);
    // Give two different vertices settlements + ports to p1
    const v1 = vertices[0]!;
    const v2 = vertices[1]!;
    const state: GameState = {
      ...base,
      board: {
        ...base.board,
        vertices: {
          ...base.board.vertices,
          [v1.key]: { ...v1, building: { playerId: 'p1', type: 'settlement' }, port: { type: '3:1' } },
          [v2.key]: { ...v2, building: { playerId: 'p1', type: 'settlement' }, port: { type: 'lumber' } },
        },
      },
    };
    expect(getBestTradeRate(state, 'p1', 'lumber')).toBe(2);
  });
});

describe('validateTrade', () => {
  it('rejects trading resource for itself', () => {
    const state = withHand(makeState(), 'p1', { lumber: 4 });
    expect(validateTrade(state, 'p1', 'lumber', 'lumber', 4)).toContain('Cannot trade');
  });

  it('rejects wrong amount (less than rate)', () => {
    const state = withHand(makeState(), 'p1', { lumber: 4 });
    expect(validateTrade(state, 'p1', 'lumber', 'ore', 3)).toContain('Must trade at your best rate');
  });

  it('rejects if player lacks resources', () => {
    const state = withHand(makeState(), 'p1', { lumber: 2 });
    expect(validateTrade(state, 'p1', 'lumber', 'ore', 4)).toContain('Insufficient lumber');
  });

  it('rejects if bank lacks receive resource', () => {
    const state = { ...withHand(makeState(), 'p1', { lumber: 4 }), bank: { lumber: 19, wool: 19, grain: 19, brick: 19, ore: 0 } };
    expect(validateTrade(state, 'p1', 'lumber', 'ore', 4)).toContain('Bank has no ore');
  });

  it('accepts valid 4:1 bank trade', () => {
    const state = withHand(makeState(), 'p1', { lumber: 4 });
    expect(validateTrade(state, 'p1', 'lumber', 'ore', 4)).toBeNull();
  });

  it('accepts valid 3:1 port trade', () => {
    const state = withPort(withHand(makeState(), 'p1', { lumber: 3 }), 'p1', '3:1');
    expect(validateTrade(state, 'p1', 'lumber', 'ore', 3)).toBeNull();
  });

  it('accepts valid 2:1 port trade', () => {
    const state = withPort(withHand(makeState(), 'p1', { lumber: 2 }), 'p1', 'lumber');
    expect(validateTrade(state, 'p1', 'lumber', 'ore', 2)).toBeNull();
  });
});

describe('applyTrade', () => {
  it('executes trade: deducts given resource, adds received resource', () => {
    const state = withHand(makeState(), 'p1', { lumber: 4 });
    const result = applyTrade({ ...state, phase: 'post-roll' }, { type: 'TRADE_BANK', playerId: 'p1', give: 'lumber', receive: 'ore', amount: 4 });
    expect(result.error).toBeUndefined();
    expect(result.state.players['p1']!.hand.lumber).toBe(0);
    expect(result.state.players['p1']!.hand.ore).toBe(1);
  });

  it('updates bank correctly after trade', () => {
    const state = withHand(makeState(), 'p1', { lumber: 4 });
    const result = applyTrade({ ...state, phase: 'post-roll' }, { type: 'TRADE_BANK', playerId: 'p1', give: 'lumber', receive: 'ore', amount: 4 });
    expect(result.state.bank.lumber).toBe(23); // 19 + 4
    expect(result.state.bank.ore).toBe(18); // 19 - 1
  });

  it('emits TRADE_COMPLETED event', () => {
    const state = withHand(makeState(), 'p1', { lumber: 4 });
    const result = applyTrade({ ...state, phase: 'post-roll' }, { type: 'TRADE_BANK', playerId: 'p1', give: 'lumber', receive: 'ore', amount: 4 });
    expect(result.events.find(e => e.type === 'TRADE_COMPLETED')).toBeDefined();
  });

  it('does not mutate input state', () => {
    const state = withHand(makeState(), 'p1', { lumber: 4 });
    const before = JSON.stringify(state);
    applyTrade({ ...state, phase: 'post-roll' }, { type: 'TRADE_BANK', playerId: 'p1', give: 'lumber', receive: 'ore', amount: 4 });
    expect(JSON.stringify(state)).toBe(before);
  });
});
