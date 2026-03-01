import type { GameState, Action, ActionResult } from '../types.js';
import { isActionLegalInPhase } from './fsm.js';
import { applySettlement, applyRoad, applyCity } from './placement.js';
import { applyTrade } from './trading.js';
import { applyBuyDevCard, applyPlayDevCard, applyEndTurn } from './devCards.js';
import { applyMoveRobber, applyStealResource, applySkipSteal } from './robber.js';
import { applyRollDice, applyDiscard } from './resources.js';

/**
 * Central action dispatcher. Validates turn order and phase legality before dispatching.
 * Returns new state or error — never mutates input state.
 * Additional action handlers (resources, robber, dev cards) are wired in as each module is created.
 */
export function applyAction(state: GameState, action: Action): ActionResult {
  // Discard phase: any player in discardQueue may discard, not just activePlayer.
  // applyDiscard validates the player is first in queue — bypass turn-order check here.
  if (state.phase === 'discard' && action.type === 'DISCARD_RESOURCES') {
    return applyDiscard(state, action);
  }

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
    case 'BUY_DEV_CARD':
      return applyBuyDevCard(state, action);
    case 'PLAY_DEV_CARD':
      return applyPlayDevCard(state, action);
    case 'END_TURN':
      return applyEndTurn(state, action);
    case 'MOVE_ROBBER':
      return applyMoveRobber(state, action);
    case 'STEAL_RESOURCE':
      return applyStealResource(state, action);
    case 'SKIP_STEAL':
      return applySkipSteal(state, action);
    case 'ROLL_DICE':
      return applyRollDice(state, action);
    case 'DISCARD_RESOURCES':
      return applyDiscard(state, action);
    default:
      return {
        state,
        events: [],
        error: `Action handler for ${(action as Action).type} not yet implemented`,
      };
  }
}
