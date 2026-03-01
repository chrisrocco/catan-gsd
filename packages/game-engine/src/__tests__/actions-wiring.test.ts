import { describe, it, expect } from 'vitest';
import { applyAction, createInitialGameState } from '../index.js';
import { getBestTradeRate, BUILD_COSTS, validateBuildCost } from '../index.js';
import { makeLcgRng } from '../index.js';
import type { GameState } from '../types.js';

/** Build a state set up at a given phase with the active player having specific resources */
function makePreRollState(): GameState {
  const rand = makeLcgRng(42);
  const state = createInitialGameState(['alice', 'bob'], rand);
  // Fast-forward to pre-roll: set phase manually (setup already complete simulation)
  return {
    ...state,
    phase: 'pre-roll',
    activePlayer: 'alice',
    players: {
      ...state.players,
      alice: { ...state.players['alice']!, hand: { lumber: 0, wool: 0, grain: 0, brick: 0, ore: 0 } },
    },
  };
}

describe('ROLL_DICE wiring via applyAction', () => {
  it('dispatches ROLL_DICE with non-7 roll and transitions to post-roll', () => {
    const state = makePreRollState();
    const result = applyAction(state, { type: 'ROLL_DICE', playerId: 'alice', roll: 6 });

    expect(result.error).toBeUndefined();
    expect(result.state.phase).toBe('post-roll');
    expect(result.events.some(e => e.type === 'DICE_ROLLED')).toBe(true);
  });

  it('dispatches ROLL_DICE with roll of 7 and transitions to robber-move (no discards)', () => {
    const state = makePreRollState();
    // All players have 0 cards, so no discards needed
    const result = applyAction(state, { type: 'ROLL_DICE', playerId: 'alice', roll: 7 });

    expect(result.error).toBeUndefined();
    expect(result.state.phase).toBe('robber-move');
  });

  it('dispatches ROLL_DICE with roll of 7 and transitions to discard when players have >7 cards', () => {
    const state = makePreRollState();
    const richState: GameState = {
      ...state,
      players: {
        ...state.players,
        bob: { ...state.players['bob']!, hand: { lumber: 4, wool: 4, grain: 0, brick: 0, ore: 0 } },
      },
    };

    const result = applyAction(richState, { type: 'ROLL_DICE', playerId: 'alice', roll: 7 });

    expect(result.error).toBeUndefined();
    expect(result.state.phase).toBe('discard');
    expect(result.state.discardQueue).toContain('bob');
  });
});

describe('DISCARD_RESOURCES wiring via applyAction', () => {
  it('dispatches DISCARD_RESOURCES for a player in discardQueue (bypasses active player check)', () => {
    const rand = makeLcgRng(42);
    const base = createInitialGameState(['alice', 'bob'], rand);
    // Simulate post-roll-7 state where bob must discard
    const state: GameState = {
      ...base,
      phase: 'discard',
      activePlayer: 'alice', // alice is the roller, but bob must discard
      discardQueue: ['bob'],
      players: {
        ...base.players,
        bob: {
          ...base.players['bob']!,
          hand: { lumber: 4, wool: 4, grain: 0, brick: 0, ore: 0 },
        },
      },
    };

    const result = applyAction(state, {
      type: 'DISCARD_RESOURCES',
      playerId: 'bob',
      resources: { lumber: 2, wool: 2 },
    });

    expect(result.error).toBeUndefined();
    expect(result.state.discardQueue).toHaveLength(0);
    expect(result.state.players['bob']!.hand.lumber).toBe(2);
  });

  it('returns error when wrong player tries to discard', () => {
    const rand = makeLcgRng(42);
    const base = createInitialGameState(['alice', 'bob'], rand);
    const state: GameState = {
      ...base,
      phase: 'discard',
      activePlayer: 'alice',
      discardQueue: ['bob'],
      players: {
        ...base.players,
        alice: { ...base.players['alice']!, hand: { lumber: 4, wool: 4, grain: 0, brick: 0, ore: 0 } },
        bob: { ...base.players['bob']!, hand: { lumber: 4, wool: 4, grain: 0, brick: 0, ore: 0 } },
      },
    };

    // alice tries to discard but bob is first in queue
    const result = applyAction(state, {
      type: 'DISCARD_RESOURCES',
      playerId: 'alice',
      resources: { lumber: 2, wool: 2 },
    });

    expect(result.error).toBeDefined();
  });
});

describe('Game engine exports for bot utilities', () => {
  it('getBestTradeRate is importable from @catan/game-engine', () => {
    expect(typeof getBestTradeRate).toBe('function');
  });

  it('BUILD_COSTS is importable from @catan/game-engine', () => {
    expect(BUILD_COSTS).toBeDefined();
    expect(BUILD_COSTS['road']).toEqual({ brick: 1, lumber: 1 });
    expect(BUILD_COSTS['city']).toEqual({ grain: 2, ore: 3 });
  });

  it('validateBuildCost is importable from @catan/game-engine', () => {
    expect(typeof validateBuildCost).toBe('function');
    const hand = { lumber: 0, wool: 0, grain: 0, brick: 0, ore: 0 };
    expect(validateBuildCost(hand, 'road')).not.toBeNull(); // Should fail — no resources
  });

  it('makeLcgRng is importable from @catan/game-engine', () => {
    expect(typeof makeLcgRng).toBe('function');
    const rng = makeLcgRng(1);
    const val = rng();
    expect(typeof val).toBe('number');
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThan(1);
  });
});
