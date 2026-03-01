import { describe, it, expect } from 'vitest';
import { distributeResources, rollTwoDice, applyRollDice, applyDiscard, handTotal } from './resources.js';
import { createInitialGameState } from './fsm.js';
import { applyAction } from './actions.js';
import { makeLcgRng } from '../board/generator.js';

function makeState(players = ['p1', 'p2', 'p3', 'p4']) {
  return createInitialGameState(players, makeLcgRng(42));
}

describe('rollTwoDice', () => {
  it('returns values in [1,6] for each die', () => {
    const rng = makeLcgRng(1);
    for (let i = 0; i < 100; i++) {
      const [d1, d2] = rollTwoDice(rng);
      expect(d1).toBeGreaterThanOrEqual(1);
      expect(d1).toBeLessThanOrEqual(6);
      expect(d2).toBeGreaterThanOrEqual(1);
      expect(d2).toBeLessThanOrEqual(6);
    }
  });
});

describe('distributeResources', () => {
  it('distributes 1 resource per settlement on matching hex', () => {
    const state = makeState();
    // Place a settlement on a vertex adjacent to a hex with number 5
    const targetHex = Object.values(state.board.hexes).find(h => h.number === 5 && h.resource !== null);
    if (!targetHex) return; // skip if board generation didn't produce this setup
    const vertexKey = targetHex.vertexKeys[0]!;

    const stateWithBuilding = {
      ...state,
      board: {
        ...state.board,
        vertices: {
          ...state.board.vertices,
          [vertexKey]: {
            ...state.board.vertices[vertexKey]!,
            building: { playerId: 'p1', type: 'settlement' as const },
          },
        },
      },
    };

    const { players } = distributeResources(stateWithBuilding, 5);
    const resource = targetHex.resource!;
    expect(players['p1']!.hand[resource]).toBe(1);
  });

  it('distributes 2 resources per city on matching hex', () => {
    const state = makeState();
    const targetHex = Object.values(state.board.hexes).find(h => h.number === 6 && h.resource !== null);
    if (!targetHex) return;
    const vertexKey = targetHex.vertexKeys[0]!;

    const stateWithCity = {
      ...state,
      board: {
        ...state.board,
        vertices: {
          ...state.board.vertices,
          [vertexKey]: {
            ...state.board.vertices[vertexKey]!,
            building: { playerId: 'p1', type: 'city' as const },
          },
        },
      },
    };

    const { players } = distributeResources(stateWithCity, 6);
    const resource = targetHex.resource!;
    expect(players['p1']!.hand[resource]).toBe(2);
  });

  it('skips robber hex — no resources from blocked hex', () => {
    const state = makeState();
    const targetHex = Object.values(state.board.hexes).find(h => h.number === 8 && h.resource !== null);
    if (!targetHex) return;
    const vertexKey = targetHex.vertexKeys[0]!;

    const stateWithRobberOnHex = {
      ...state,
      robberHex: targetHex.key,
      board: {
        ...state.board,
        vertices: {
          ...state.board.vertices,
          [vertexKey]: {
            ...state.board.vertices[vertexKey]!,
            building: { playerId: 'p1', type: 'settlement' as const },
          },
        },
      },
    };

    const { players } = distributeResources(stateWithRobberOnHex, 8);
    const resource = targetHex.resource!;
    expect(players['p1']!.hand[resource]).toBe(0);
  });

  it('bank depletion: no one gets resource if bank cannot cover', () => {
    const state = makeState();
    const targetHex = Object.values(state.board.hexes).find(h => h.number === 9 && h.resource !== null);
    if (!targetHex) return;
    const resource = targetHex.resource!;

    // Set bank to 0 for this resource
    const depletedState = {
      ...state,
      bank: { ...state.bank, [resource]: 0 },
      board: {
        ...state.board,
        vertices: {
          ...state.board.vertices,
          [targetHex.vertexKeys[0]!]: {
            ...state.board.vertices[targetHex.vertexKeys[0]!]!,
            building: { playerId: 'p1', type: 'settlement' as const },
          },
        },
      },
    };

    const { players } = distributeResources(depletedState, 9);
    expect(players['p1']!.hand[resource]).toBe(0);
  });
});

describe('applyRollDice', () => {
  it('transitions to post-roll on non-7 roll', () => {
    const state = { ...makeState(), phase: 'pre-roll' as const };
    const result = applyRollDice(state, { type: 'ROLL_DICE', playerId: 'p1', roll: 6 });
    expect(result.state.phase).toBe('post-roll');
    expect(result.error).toBeUndefined();
  });

  it('transitions to discard phase when a player has >7 cards and 7 is rolled', () => {
    const state = makeState();
    // Give p1 more than 7 cards
    const richState = {
      ...state,
      phase: 'pre-roll' as const,
      players: {
        ...state.players,
        p1: { ...state.players['p1']!, hand: { lumber: 3, wool: 3, grain: 2, brick: 0, ore: 0 } },
      },
    };
    const result = applyRollDice(richState, { type: 'ROLL_DICE', playerId: 'p1', roll: 7 });
    expect(result.state.phase).toBe('discard');
    expect(result.state.discardQueue).toContain('p1');
  });

  it('transitions to robber-move when 7 rolled with no discards needed', () => {
    const state = { ...makeState(), phase: 'pre-roll' as const };
    const result = applyRollDice(state, { type: 'ROLL_DICE', playerId: 'p1', roll: 7 });
    expect(result.state.phase).toBe('robber-move');
    expect(result.state.discardQueue).toHaveLength(0);
  });

  it('emits DICE_ROLLED event', () => {
    const state = { ...makeState(), phase: 'pre-roll' as const };
    const result = applyRollDice(state, { type: 'ROLL_DICE', playerId: 'p1', roll: 4 });
    const diceEvent = result.events.find(e => e.type === 'DICE_ROLLED');
    expect(diceEvent).toBeDefined();
    expect((diceEvent as { type: 'DICE_ROLLED'; roll: number }).roll).toBe(4);
  });
});

describe('applyDiscard', () => {
  function stateWithDiscard(playerId: string, hand: Partial<Record<string, number>>) {
    const base = makeState();
    const fullHand = { lumber: 0, wool: 0, grain: 0, brick: 0, ore: 0, ...hand };
    return {
      ...base,
      phase: 'discard' as const,
      discardQueue: [playerId],
      players: { ...base.players, [playerId]: { ...base.players[playerId]!, hand: fullHand } },
    };
  }

  it('accepts valid discard (exactly half rounded down)', () => {
    // 8 cards → must discard 4
    const state = stateWithDiscard('p1', { lumber: 4, wool: 4 });
    const result = applyDiscard(state, { type: 'DISCARD_RESOURCES', playerId: 'p1', resources: { lumber: 2, wool: 2 } });
    expect(result.error).toBeUndefined();
    expect(result.state.players['p1']!.hand.lumber).toBe(2);
  });

  it('rejects discard with wrong count', () => {
    const state = stateWithDiscard('p1', { lumber: 4, wool: 4 });
    const result = applyDiscard(state, { type: 'DISCARD_RESOURCES', playerId: 'p1', resources: { lumber: 1 } });
    expect(result.error).toContain('Must discard exactly 4');
  });

  it('removes player from discardQueue after discarding', () => {
    const state = stateWithDiscard('p1', { lumber: 4, wool: 4 });
    const result = applyDiscard(state, { type: 'DISCARD_RESOURCES', playerId: 'p1', resources: { lumber: 2, wool: 2 } });
    expect(result.state.discardQueue).not.toContain('p1');
  });

  it('transitions to robber-move when discardQueue empties', () => {
    const state = stateWithDiscard('p1', { lumber: 4, wool: 4 });
    const result = applyDiscard(state, { type: 'DISCARD_RESOURCES', playerId: 'p1', resources: { lumber: 2, wool: 2 } });
    expect(result.state.phase).toBe('robber-move');
  });

  it('stays in discard phase when queue has more players', () => {
    const base = makeState();
    const state = {
      ...base,
      phase: 'discard' as const,
      discardQueue: ['p1', 'p2'],
      players: {
        ...base.players,
        p1: { ...base.players['p1']!, hand: { lumber: 4, wool: 4, grain: 0, brick: 0, ore: 0 } },
        p2: { ...base.players['p2']!, hand: { lumber: 4, wool: 4, grain: 0, brick: 0, ore: 0 } },
      },
    };
    const result = applyDiscard(state, { type: 'DISCARD_RESOURCES', playerId: 'p1', resources: { lumber: 2, wool: 2 } });
    expect(result.state.phase).toBe('discard');
    expect(result.state.discardQueue).toEqual(['p2']);
  });

  it('rejects discard from wrong player (not first in queue)', () => {
    const state = stateWithDiscard('p1', { lumber: 4, wool: 4 });
    const result = applyDiscard({ ...state, discardQueue: ['p2', 'p1'] }, { type: 'DISCARD_RESOURCES', playerId: 'p1', resources: { lumber: 2, wool: 2 } });
    expect(result.error).toContain('not the next player to discard');
  });
});

import { applyMoveRobber, applyStealResource, applySkipSteal } from './robber.js';

describe('applyMoveRobber', () => {
  it('moves robber to target hex', () => {
    const state = makeState();
    // Find a land hex that is not the current robber hex
    const targetHex = Object.values(state.board.hexes).find(h => h.key !== state.robberHex && h.resource !== null);
    if (!targetHex) return;
    const result = applyMoveRobber({ ...state, phase: 'robber-move' as const }, { type: 'MOVE_ROBBER', playerId: 'p1', hexKey: targetHex.key });
    expect(result.error).toBeUndefined();
    expect(result.state.robberHex).toBe(targetHex.key);
  });

  it('rejects moving robber to same hex', () => {
    const state = makeState();
    const result = applyMoveRobber({ ...state, phase: 'robber-move' as const }, { type: 'MOVE_ROBBER', playerId: 'p1', hexKey: state.robberHex });
    expect(result.error).toContain('different hex');
  });

  it('transitions to robber-steal if opponent has building on hex', () => {
    const state = makeState();
    const targetHex = Object.values(state.board.hexes).find(h => h.key !== state.robberHex && h.resource !== null)!;
    // Place opponent settlement on a vertex of this hex
    const vKey = targetHex.vertexKeys[0]!;
    const stateWithBuilding = {
      ...state,
      phase: 'robber-move' as const,
      board: {
        ...state.board,
        vertices: { ...state.board.vertices, [vKey]: { ...state.board.vertices[vKey]!, building: { playerId: 'p2', type: 'settlement' as const } } },
      },
    };
    const result = applyMoveRobber(stateWithBuilding, { type: 'MOVE_ROBBER', playerId: 'p1', hexKey: targetHex.key });
    expect(result.state.phase).toBe('robber-steal');
  });

  it('transitions to post-roll if no opponents on hex', () => {
    const state = makeState();
    const targetHex = Object.values(state.board.hexes).find(h => h.key !== state.robberHex && h.resource !== null)!;
    const result = applyMoveRobber({ ...state, phase: 'robber-move' as const }, { type: 'MOVE_ROBBER', playerId: 'p1', hexKey: targetHex.key });
    expect(result.state.phase).toBe('post-roll');
  });
});

describe('applyStealResource', () => {
  it('steals a resource from target player', () => {
    const base = makeState();
    const targetHex = Object.values(base.board.hexes).find(h => h.key !== base.robberHex && h.resource !== null)!;
    const vKey = targetHex.vertexKeys[0]!;
    const state = {
      ...base,
      phase: 'robber-steal' as const,
      robberHex: targetHex.key,
      board: {
        ...base.board,
        vertices: { ...base.board.vertices, [vKey]: { ...base.board.vertices[vKey]!, building: { playerId: 'p2', type: 'settlement' as const } } },
      },
      players: { ...base.players, p2: { ...base.players['p2']!, hand: { lumber: 3, wool: 0, grain: 0, brick: 0, ore: 0 } } },
    };
    const result = applyStealResource(state, { type: 'STEAL_RESOURCE', playerId: 'p1', targetPlayerId: 'p2' });
    expect(result.error).toBeUndefined();
    expect(result.state.players['p2']!.hand.lumber).toBe(2);
    expect(result.state.players['p1']!.hand.lumber).toBe(1);
    expect(result.state.phase).toBe('post-roll');
  });

  it('emits RESOURCE_STOLEN event', () => {
    const base = makeState();
    const targetHex = Object.values(base.board.hexes).find(h => h.key !== base.robberHex && h.resource !== null)!;
    const vKey = targetHex.vertexKeys[0]!;
    const state = {
      ...base,
      phase: 'robber-steal' as const,
      robberHex: targetHex.key,
      board: {
        ...base.board,
        vertices: { ...base.board.vertices, [vKey]: { ...base.board.vertices[vKey]!, building: { playerId: 'p2', type: 'settlement' as const } } },
      },
      players: { ...base.players, p2: { ...base.players['p2']!, hand: { lumber: 1, wool: 0, grain: 0, brick: 0, ore: 0 } } },
    };
    const result = applyStealResource(state, { type: 'STEAL_RESOURCE', playerId: 'p1', targetPlayerId: 'p2' });
    const stealEvent = result.events.find(e => e.type === 'RESOURCE_STOLEN');
    expect(stealEvent).toBeDefined();
  });

  it('skips steal gracefully when target has no cards', () => {
    const base = makeState();
    const targetHex = Object.values(base.board.hexes).find(h => h.key !== base.robberHex && h.resource !== null)!;
    const vKey = targetHex.vertexKeys[0]!;
    const state = {
      ...base,
      phase: 'robber-steal' as const,
      robberHex: targetHex.key,
      board: {
        ...base.board,
        vertices: { ...base.board.vertices, [vKey]: { ...base.board.vertices[vKey]!, building: { playerId: 'p2', type: 'settlement' as const } } },
      },
    };
    const result = applyStealResource(state, { type: 'STEAL_RESOURCE', playerId: 'p1', targetPlayerId: 'p2' });
    expect(result.error).toBeUndefined();
    expect(result.state.phase).toBe('post-roll');
  });
});
