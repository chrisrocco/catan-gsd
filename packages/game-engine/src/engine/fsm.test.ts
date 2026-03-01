import { describe, it, expect } from 'vitest';
import { getLegalActions, isActionLegalInPhase, createInitialGameState, PHASE_LEGAL_ACTIONS } from './fsm.js';
import { makeLcgRng } from '../board/generator.js';

describe('PHASE_LEGAL_ACTIONS', () => {
  it('setup-forward only allows PLACE_SETTLEMENT and PLACE_ROAD', () => {
    const legal = PHASE_LEGAL_ACTIONS['setup-forward'];
    expect(legal).toContain('PLACE_SETTLEMENT');
    expect(legal).toContain('PLACE_ROAD');
    expect(legal).not.toContain('ROLL_DICE');
    expect(legal).not.toContain('END_TURN');
  });

  it('pre-roll does NOT allow PLACE_SETTLEMENT or END_TURN', () => {
    expect(PHASE_LEGAL_ACTIONS['pre-roll']).not.toContain('PLACE_SETTLEMENT');
    expect(PHASE_LEGAL_ACTIONS['pre-roll']).not.toContain('END_TURN');
  });

  it('post-roll does NOT allow ROLL_DICE', () => {
    expect(PHASE_LEGAL_ACTIONS['post-roll']).not.toContain('ROLL_DICE');
  });

  it('robber-move only allows MOVE_ROBBER', () => {
    expect(PHASE_LEGAL_ACTIONS['robber-move']).toEqual(['MOVE_ROBBER']);
  });

  it('discard only allows DISCARD_RESOURCES', () => {
    expect(PHASE_LEGAL_ACTIONS['discard']).toEqual(['DISCARD_RESOURCES']);
  });

  it('game-over allows no actions', () => {
    expect(PHASE_LEGAL_ACTIONS['game-over']).toHaveLength(0);
  });
});

describe('getLegalActions', () => {
  const rng = makeLcgRng(1);
  const state = createInitialGameState(['p1', 'p2', 'p3', 'p4'], rng);

  it('returns setup-forward legal actions at game start', () => {
    const legal = getLegalActions(state);
    expect(legal).toContain('PLACE_SETTLEMENT');
    expect(legal).toContain('PLACE_ROAD');
    expect(legal).not.toContain('ROLL_DICE');
  });
});

describe('createInitialGameState', () => {
  const rng = makeLcgRng(42);
  const state = createInitialGameState(['alice', 'bob', 'carol', 'dave'], rng);

  it('creates 4 players', () => {
    expect(Object.keys(state.players)).toHaveLength(4);
  });

  it('starts in setup-forward phase', () => {
    expect(state.phase).toBe('setup-forward');
  });

  it('activePlayer is first in playerOrder', () => {
    expect(state.activePlayer).toBe(state.playerOrder[0]);
  });

  it('all players start with zero resources', () => {
    for (const player of Object.values(state.players)) {
      expect(Object.values(player.hand).every(v => v === 0)).toBe(true);
    }
  });

  it('bank starts with 19 of each resource', () => {
    expect(state.bank).toEqual({ lumber: 19, wool: 19, grain: 19, brick: 19, ore: 19 });
  });

  it('deck has 25 cards', () => {
    expect(state.deck).toHaveLength(25);
  });

  it('robber starts on desert hex', () => {
    const desertHex = Object.values(state.board.hexes).find(h => h.resource === null);
    expect(state.robberHex).toBe(desertHex?.key);
  });

  it('winner is null', () => {
    expect(state.winner).toBeNull();
  });

  it('throws for < 2 players', () => {
    expect(() => createInitialGameState(['solo'])).toThrow();
  });

  it('throws for > 4 players', () => {
    expect(() => createInitialGameState(['a','b','c','d','e'])).toThrow();
  });

  it('is deterministic with same seed', () => {
    const s1 = createInitialGameState(['a','b'], makeLcgRng(7));
    const s2 = createInitialGameState(['a','b'], makeLcgRng(7));
    expect(s1.robberHex).toBe(s2.robberHex);
    expect(s1.deck).toEqual(s2.deck);
  });
});
