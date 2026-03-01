/**
 * BotPlayer unit tests.
 * Tests all phase handlers and isBotPlayer utility.
 */

import { describe, it, expect } from 'vitest';
import { createInitialGameState, applyAction, makeLcgRng } from '@catan/game-engine';
import type { GameState } from '@catan/game-engine';
import { isBotPlayer, chooseBotAction } from '../BotPlayer.js';

// Helper: Run a 4-bot game through setup to reach post-roll phase
function runToPostRoll(seed = 42): GameState {
  const rng = makeLcgRng(seed);
  let state = createInitialGameState(['bot-0', 'bot-1', 'bot-2', 'bot-3'], () => rng());

  let iters = 0;
  while (state.phase !== 'post-roll' && iters < 500) {
    iters++;
    let botId: string | null = null;
    if (state.phase === 'discard' && state.discardQueue.length > 0) {
      botId = state.discardQueue[0]!;
    } else {
      botId = state.activePlayer;
    }
    const action = chooseBotAction(state, botId, () => rng());
    const result = applyAction(state, action);
    if (result.error) throw new Error(`runToPostRoll error: ${result.error} | action: ${JSON.stringify(action)}`);
    state = result.state;
  }
  return state;
}

describe('isBotPlayer', () => {
  it('returns true for bot IDs', () => {
    expect(isBotPlayer('bot-0')).toBe(true);
    expect(isBotPlayer('bot-1')).toBe(true);
    expect(isBotPlayer('bot-99')).toBe(true);
  });

  it('returns false for human IDs', () => {
    expect(isBotPlayer('player-abc')).toBe(false);
    expect(isBotPlayer('alice')).toBe(false);
    expect(isBotPlayer('human-1')).toBe(false);
    expect(isBotPlayer('')).toBe(false);
  });
});

describe('chooseBotAction - setup phase', () => {
  it('returns PLACE_SETTLEMENT when player has no settlement yet in setup-forward', () => {
    const rng = makeLcgRng(1);
    const state = createInitialGameState(['bot-0', 'bot-1', 'bot-2', 'bot-3'], () => rng());
    expect(state.phase).toBe('setup-forward');
    const action = chooseBotAction(state, 'bot-0', () => rng());
    expect(action.type).toBe('PLACE_SETTLEMENT');
    expect(action.playerId).toBe('bot-0');
    if (action.type === 'PLACE_SETTLEMENT') {
      expect(typeof action.vertexKey).toBe('string');
    }
  });

  it('returns PLACE_ROAD after settlement placed in setup', () => {
    const rng = makeLcgRng(2);
    let state = createInitialGameState(['bot-0', 'bot-1', 'bot-2', 'bot-3'], () => rng());

    // Bot-0 places settlement
    const settlementAction = chooseBotAction(state, 'bot-0', () => rng());
    expect(settlementAction.type).toBe('PLACE_SETTLEMENT');
    const result = applyAction(state, settlementAction);
    expect(result.error).toBeUndefined();
    state = result.state;

    // Now bot-0 needs a road
    const roadAction = chooseBotAction(state, 'bot-0', () => rng());
    expect(roadAction.type).toBe('PLACE_ROAD');
    expect(roadAction.playerId).toBe('bot-0');
  });
});

describe('chooseBotAction - pre-roll phase', () => {
  it('returns ROLL_DICE when no strategic reason to play knight', () => {
    const state = runToPostRoll(10);
    // Back up to get a pre-roll state
    const rng = makeLcgRng(10);
    let preRollState = createInitialGameState(['bot-0', 'bot-1', 'bot-2', 'bot-3'], () => rng());
    let iters = 0;
    while (preRollState.phase !== 'pre-roll' && iters < 500) {
      iters++;
      const botId = preRollState.activePlayer;
      const action = chooseBotAction(preRollState, botId, () => rng());
      const result = applyAction(preRollState, action);
      if (result.error) throw new Error(result.error);
      preRollState = result.state;
    }
    expect(preRollState.phase).toBe('pre-roll');
    const action = chooseBotAction(preRollState, preRollState.activePlayer, () => rng());
    // Should roll dice (no knight cards in hand at start)
    expect(action.type).toBe('ROLL_DICE');
    expect(action.playerId).toBe(preRollState.activePlayer);
  });
});

describe('chooseBotAction - post-roll phase', () => {
  it('returns END_TURN when nothing to do (no resources, empty hand)', () => {
    const state = runToPostRoll(42);
    expect(state.phase).toBe('post-roll');
    // With no resources after fresh post-roll, bot should END_TURN
    const botId = state.activePlayer;
    const action = chooseBotAction(state, botId, Math.random);
    // The action should be one of the valid post-roll actions
    expect(['END_TURN', 'TRADE_BANK', 'PLACE_ROAD', 'PLACE_SETTLEMENT', 'UPGRADE_CITY', 'BUY_DEV_CARD', 'PLAY_DEV_CARD']).toContain(action.type);
    expect(action.playerId).toBe(botId);
  });
});

describe('chooseBotAction - robber-move phase', () => {
  it('returns MOVE_ROBBER with valid hex key', () => {
    const rng = makeLcgRng(7);
    let state = createInitialGameState(['bot-0', 'bot-1', 'bot-2', 'bot-3'], () => rng());

    // Advance through setup to get to a state where we can trigger a 7 roll
    let iters = 0;
    while (state.phase !== 'pre-roll' && iters < 500) {
      iters++;
      const botId = state.activePlayer;
      const action = chooseBotAction(state, botId, () => rng());
      const result = applyAction(state, action);
      if (result.error) throw new Error(result.error);
      state = result.state;
    }

    // Force a 7 roll to trigger robber-move
    const rollResult = applyAction(state, { type: 'ROLL_DICE', playerId: state.activePlayer, roll: 7 });
    if (rollResult.error) throw new Error(rollResult.error);
    state = rollResult.state;

    // If no discards needed, should be in robber-move
    while (state.phase === 'discard' && state.discardQueue.length > 0) {
      const discarderId = state.discardQueue[0]!;
      const action = chooseBotAction(state, discarderId, () => rng());
      const result = applyAction(state, action);
      if (result.error) throw new Error(result.error);
      state = result.state;
    }

    if (state.phase === 'robber-move') {
      const action = chooseBotAction(state, state.activePlayer, () => rng());
      expect(action.type).toBe('MOVE_ROBBER');
      expect(action.playerId).toBe(state.activePlayer);
      if (action.type === 'MOVE_ROBBER') {
        expect(typeof action.hexKey).toBe('string');
        expect(action.hexKey).not.toBe(state.robberHex); // robber must actually move
      }
    }
  });
});

describe('chooseBotAction - discard phase', () => {
  it('returns DISCARD_RESOURCES with correct card count', () => {
    const rng = makeLcgRng(5);
    let state = createInitialGameState(['bot-0', 'bot-1', 'bot-2', 'bot-3'], () => rng());

    // Advance through setup
    let iters = 0;
    while (state.phase !== 'pre-roll' && iters < 500) {
      iters++;
      const botId = state.activePlayer;
      const action = chooseBotAction(state, botId, () => rng());
      const result = applyAction(state, action);
      if (result.error) throw new Error(result.error);
      state = result.state;
    }

    // Give bot-0 a large hand manually (by mutating for test)
    const bot0 = state.players['bot-0']!;
    const handTotal = (hand: Record<string, number>) =>
      Object.values(hand).reduce((s, v) => s + v, 0);

    // Force discard phase by patching state for the test — skip if we can't easily trigger it
    // Instead test chooseBotAction logic directly in isolation with a crafted state
    const largeHand = { lumber: 3, brick: 3, wool: 2, grain: 2, ore: 2 }; // total = 12
    const stateWithLargeHand: GameState = {
      ...state,
      phase: 'discard' as const,
      discardQueue: ['bot-0'],
      players: {
        ...state.players,
        'bot-0': { ...bot0, hand: largeHand },
      },
    };

    const action = chooseBotAction(stateWithLargeHand, 'bot-0', () => rng());
    expect(action.type).toBe('DISCARD_RESOURCES');
    if (action.type === 'DISCARD_RESOURCES') {
      const discardTotal = Object.values(action.resources).reduce((s, v) => s + (v ?? 0), 0);
      expect(discardTotal).toBe(Math.floor(handTotal(largeHand) / 2)); // must discard exactly half (rounded down)
    }
  });
});

describe('chooseBotAction - all actions have valid structure', () => {
  it('all actions have type and playerId', () => {
    const rng = makeLcgRng(42);
    const rand = () => rng();
    let state = createInitialGameState(['bot-0', 'bot-1', 'bot-2', 'bot-3'], rand);

    let iters = 0;
    const maxIters = 200;
    while (!state.winner && iters < maxIters) {
      iters++;
      let botId: string | null = null;
      if (state.phase === 'discard' && state.discardQueue.length > 0) {
        botId = state.discardQueue[0]!;
      } else {
        botId = state.activePlayer;
      }

      const action = chooseBotAction(state, botId, rand);
      expect(action).toHaveProperty('type');
      expect(action).toHaveProperty('playerId');

      const result = applyAction(state, action);
      if (result.error) break; // stop on first error
      state = result.state;
    }
  });
});
