import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '../types.js';
import { roomStore } from '../game/roomStore.js';
import { runBotTurns } from '../bot/botRunner.js';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type TypedSocket = import('socket.io').Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  object,
  SocketData
>;

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
  });
}
