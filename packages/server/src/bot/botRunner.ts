/**
 * botRunner — server integration loop for bot turns.
 * Loops bot actions until a human player is active or the game ends.
 */

import type { Server } from 'socket.io';
import type { GameState } from '@catan/game-engine';
import type { RoomSession } from '../game/RoomSession.js';
import { chooseBotAction, isBotPlayer } from './BotPlayer.js';

const MAX_BOT_ACTIONS_PER_TURN = 50;

/**
 * Determine which bot should act next.
 * During discard phase, the active discarder may not be activePlayer.
 * Returns the bot's playerId, or null if no bot needs to act.
 */
function getBotToAct(state: GameState): string | null {
  // During discard phase, bots in discardQueue need to act even if activePlayer is human
  if (state.phase === 'discard' && state.discardQueue.length > 0) {
    const nextDiscarder = state.discardQueue[0]!;
    return isBotPlayer(nextDiscarder) ? nextDiscarder : null;
  }
  return isBotPlayer(state.activePlayer) ? state.activePlayer : null;
}

/**
 * Run bot turns until a human player is active or the game ends.
 * Broadcasts filtered state to all connected human players after each bot action.
 *
 * Safety: breaks after MAX_BOT_ACTIONS_PER_TURN to prevent infinite loops.
 * Also breaks on illegal bot actions (indicating a bug in bot logic).
 */
export function runBotTurns(session: RoomSession, io: Server): void {
  if (!session.gameState) return;

  let safetyCounter = 0;

  while (
    session.gameState &&
    !session.gameState.winner &&
    getBotToAct(session.gameState) !== null &&
    safetyCounter < MAX_BOT_ACTIONS_PER_TURN
  ) {
    safetyCounter++;
    const state = session.gameState;
    const botId = getBotToAct(state)!;

    const action = chooseBotAction(state, botId);
    const result = session.applyPlayerAction(action);

    if (result.error) {
      console.error(`[Bot] Illegal action from ${botId}: ${result.error}`, JSON.stringify(action));
      break;
    }

    // Broadcast updated state to all connected human players
    for (const player of session.players) {
      if (!player.connected) continue;
      const filtered = session.filterStateFor(player.playerId);
      io.to(player.socketId).emit('game:state', {
        state: filtered,
        events: result.events,
      });
    }
  }

  if (safetyCounter >= MAX_BOT_ACTIONS_PER_TURN) {
    console.warn(`[Bot] Safety limit reached (${MAX_BOT_ACTIONS_PER_TURN} actions) — possible infinite loop`);
  }
}
