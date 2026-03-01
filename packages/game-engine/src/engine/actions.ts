import type { GameState, Action, ActionResult } from '../types.js';
import { isActionLegalInPhase } from './fsm.js';
import { applySettlement, applyRoad, applyCity } from './placement.js';
import { applyTrade } from './trading.js';

/**
 * Central action dispatcher. Validates turn order and phase legality before dispatching.
 * Returns new state or error — never mutates input state.
 * Additional action handlers (resources, robber, dev cards) are wired in as each module is created.
 */
export function applyAction(state: GameState, action: Action): ActionResult {
  // GAME-14: Turn order enforcement — only active player may act
  if (action.playerId !== state.activePlayer) {
    return {
      state,
      events: [],
      error: `Not your turn: active player is ${state.activePlayer}`,
    };
  }

  // FSM phase check — action type must be legal in current phase
  if (!isActionLegalInPhase(state.phase, action.type)) {
    return {
      state,
      events: [],
      error: `Action ${action.type} is not legal in phase ${state.phase}`,
    };
  }

  // Dispatch to handler
  switch (action.type) {
    case 'PLACE_SETTLEMENT':
      return applySettlement(state, action);
    case 'PLACE_ROAD':
      return applyRoad(state, action);
    case 'UPGRADE_CITY':
      return applyCity(state, action);
    case 'TRADE_BANK':
      return applyTrade(state, action);
    default:
      return {
        state,
        events: [],
        error: `Action handler for ${action.type} not yet implemented`,
      };
  }
}
