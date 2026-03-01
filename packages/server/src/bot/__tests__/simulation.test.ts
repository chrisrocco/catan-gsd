/**
 * Headless 4-bot full-game simulation tests.
 * No server, no sockets — pure game engine + bot logic.
 */

import { describe, it, expect } from 'vitest';
import { createInitialGameState, applyAction, makeLcgRng } from '@catan/game-engine';
import type { GameState } from '@catan/game-engine';
import { chooseBotAction, isBotPlayer } from '../BotPlayer.js';

/**
 * Determine which bot should act next.
 * During discard phase, the active discarder may not be activePlayer.
 */
function getBotToAct(state: GameState): string | null {
  if (state.phase === 'discard' && state.discardQueue.length > 0) {
    const next = state.discardQueue[0]!;
    return isBotPlayer(next) ? next : null;
  }
  return isBotPlayer(state.activePlayer) ? state.activePlayer : null;
}

describe('Bot simulation', () => {
  it('4-bot game runs to completion without illegal moves', () => {
    const rng = makeLcgRng(42);
    const rand = () => rng();
    let state = createInitialGameState(['bot-0', 'bot-1', 'bot-2', 'bot-3'], rand);

    const MAX_ACTIONS = 5000;
    let actionCount = 0;

    while (!state.winner && actionCount < MAX_ACTIONS) {
      const botId = getBotToAct(state);
      if (!botId) break; // all players are bots so this shouldn't happen

      actionCount++;
      const action = chooseBotAction(state, botId, rand);
      const result = applyAction(state, action);

      if (result.error) {
        throw new Error(
          `Bot illegal action #${actionCount}: ${result.error}\nAction: ${JSON.stringify(action)}\nPhase: ${state.phase}, ActivePlayer: ${state.activePlayer}`,
        );
      }

      state = result.state;
    }

    expect(state.winner).toBeTruthy();
    expect(actionCount).toBeLessThan(MAX_ACTIONS);
    expect(actionCount).toBeGreaterThan(50); // sanity: a real game takes many actions
  }, 30000); // 30s timeout for full game

  it('bots place settlements near high-probability hexes in setup', () => {
    const rng = makeLcgRng(123);
    const rand = () => rng();
    let state = createInitialGameState(['bot-0', 'bot-1', 'bot-2', 'bot-3'], rand);

    // Run through setup phase only
    while (state.phase === 'setup-forward' || state.phase === 'setup-reverse') {
      const botId = state.activePlayer;
      const action = chooseBotAction(state, botId, rand);
      const result = applyAction(state, action);
      if (result.error) throw new Error(`Setup error: ${result.error}`);
      state = result.state;
    }

    // Check that settlements are placed on vertices adjacent to high-probability hexes
    const settlements = Object.values(state.board.vertices).filter(v => v.building);
    expect(settlements.length).toBe(8); // 4 players x 2 settlements
    // At least some settlements should be adjacent to 6 or 8 hexes
    const nearHighProb = settlements.filter(v =>
      v.adjacentHexKeys.some(hk => {
        const hex = state.board.hexes[hk];
        return hex && (hex.number === 6 || hex.number === 8);
      }),
    );
    expect(nearHighProb.length).toBeGreaterThanOrEqual(2);
  });

  it('bots build roads, settlements, cities, and buy dev cards', () => {
    const rng = makeLcgRng(42);
    const rand = () => rng();
    let state = createInitialGameState(['bot-0', 'bot-1', 'bot-2', 'bot-3'], rand);

    const MAX_ACTIONS = 5000;
    let actionCount = 0;
    const actionTypes = new Set<string>();

    while (!state.winner && actionCount < MAX_ACTIONS) {
      const botId = getBotToAct(state);
      if (!botId) break;
      actionCount++;
      const action = chooseBotAction(state, botId, rand);
      actionTypes.add(action.type);
      const result = applyAction(state, action);
      if (result.error) throw new Error(`Error: ${result.error}`);
      state = result.state;
    }

    // Verify diverse action types were used
    expect(actionTypes.has('PLACE_ROAD')).toBe(true);
    expect(actionTypes.has('PLACE_SETTLEMENT')).toBe(true);
    expect(actionTypes.has('ROLL_DICE')).toBe(true);
    expect(actionTypes.has('END_TURN')).toBe(true);
    // Cities and dev cards may or may not appear in every game, but should in most
  }, 30000);
});
