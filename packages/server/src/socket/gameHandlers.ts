import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '../types.js';
import type { RoomSession } from '../game/RoomSession.js';
import { roomStore } from '../game/roomStore.js';
import { runBotTurns } from '../bot/botRunner.js';
import { isBotPlayer, chooseBotAction } from '../bot/BotPlayer.js';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type TypedSocket = import('socket.io').Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  object,
  SocketData
>;

/**
 * Check if the active player is disconnected and start a turn timeout if so.
 * When timeout fires, auto-ends the turn (or auto-discards if in discard phase).
 */
function checkDisconnectedTurn(session: RoomSession, io: TypedServer): void {
  if (!session.gameState || session.gameState.winner) return;

  const activeId = session.gameState.activePlayer;

  // Skip if it's a bot's turn (botRunner handles bots)
  if (isBotPlayer(activeId)) return;

  // Check if active player is disconnected or bot-takeover
  const activePlayer = session.players.find((p) => p.playerId === activeId);
  const isDisconnected = !activePlayer?.connected || session.isBotTakeover(activeId);
  if (!isDisconnected) return;

  // Don't start a new timeout if one is already running for this player
  if (session.turnTimeoutPlayerId === activeId) return;

  // Notify all players about timeout
  io.to(session.code).emit('turn:timeout', { playerId: activeId, remainingSeconds: 30 });

  session.startTurnTimeout(activeId, () => {
    if (!session.gameState || session.gameState.winner) return;

    // For discard phase: use bot logic to auto-discard
    if (session.gameState.phase === 'discard') {
      const action = chooseBotAction(session.gameState, activeId);
      session.applyPlayerAction(action);
    } else {
      // Auto-end turn
      session.applyPlayerAction({ type: 'END_TURN', playerId: activeId });
    }

    // Broadcast updated state
    for (const player of session.players) {
      if (!player.connected) continue;
      const filtered = session.filterStateFor(player.playerId);
      io.to(player.socketId).emit('game:state', { state: filtered, events: [] });
    }

    // Chain: check again in case next player is also disconnected, or bots need to act
    runBotTurns(session, io);
    checkDisconnectedTurn(session, io);
  });
}

export function registerGameHandlers(io: TypedServer, socket: TypedSocket): void {
  socket.on('submit-action', (action) => {
    const roomCode = socket.data.roomCode;
    const playerId = socket.data.playerId;
    if (!roomCode || !playerId) return;

    const session = roomStore.get(roomCode);
    if (!session?.started || !session.gameState) return;

    // Inject the server-known playerId into the action to prevent spoofing.
    // The client sends the action type and parameters, but the server
    // overwrites playerId with the authenticated socket's playerId.
    const serverAction = { ...action, playerId };

    const result = session.applyPlayerAction(serverAction);

    if (result.error) {
      // NET-01: Invalid action — error to submitter only
      socket.emit('action:error', { message: result.error });
      return;
    }

    // NET-02: Valid action — broadcast filtered state to each player
    for (const player of session.players) {
      if (!player.connected) continue; // skip disconnected / bot players
      const filtered = session.filterStateFor(player.playerId);
      io.to(player.socketId).emit('game:state', {
        state: filtered,
        events: result.events,
      });
    }

    // Trigger bot turns if next player is a bot (or bots need to discard)
    runBotTurns(session, io);

    // Check if the next active player is disconnected and needs a turn timeout
    checkDisconnectedTurn(session, io);
  });
}
