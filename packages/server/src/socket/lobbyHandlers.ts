import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData, LobbyState } from '../types.js';
import type { RoomSession } from '../game/RoomSession.js';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type TypedSocket = import('socket.io').Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  object,
  SocketData
>;

function buildLobbyState(session: RoomSession): LobbyState {
  return {
    code: session.code,
    players: session.players.map((p) => ({
      playerId: p.playerId,
      displayName: p.displayName,
      color: p.color,
      isHost: p.isHost,
      connected: p.connected,
    })),
    botCount: session.botCount,
    started: session.started,
  };
}

function broadcastLobbyState(io: TypedServer, session: RoomSession): void {
  io.to(session.code).emit('lobby:state', buildLobbyState(session));
}

import { roomStore } from '../game/roomStore.js';

export function registerLobbyHandlers(io: TypedServer, socket: TypedSocket): void {
  socket.on('join-room', (payload, callback) => {
    const { code, displayName } = payload;
    const session = roomStore.get(code);

    if (!session) {
      callback({ ok: false, error: 'Room not found' });
      return;
    }

    if (session.started) {
      callback({ ok: false, error: 'Game already started' });
      return;
    }

    if (session.players.length + session.botCount >= 4) {
      callback({ ok: false, error: 'Room is full' });
      return;
    }

    const playerId = crypto.randomUUID();
    const color = session.nextAvailableColor();
    const isHost = session.players.length === 0;

    session.addPlayer(socket.id, playerId, displayName, color, isHost);

    socket.data.roomCode = code;
    socket.data.playerId = playerId;
    socket.data.displayName = displayName;
    socket.data.isHost = isHost;

    void socket.join(code);

    callback({ ok: true, playerId });

    broadcastLobbyState(io, session);
  });

  socket.on('set-bot-count', (payload) => {
    if (!socket.data.isHost) {
      socket.emit('room:error', { message: 'Only the host can set bot count' });
      return;
    }

    const { count } = payload;
    const session = roomStore.get(socket.data.roomCode ?? '');
    if (!session) return;

    if (count < 0 || count > 3) {
      socket.emit('room:error', { message: 'Bot count must be between 0 and 3' });
      return;
    }

    if (session.players.length + count > 4) {
      socket.emit('room:error', { message: 'Too many players and bots' });
      return;
    }

    session.botCount = count;
    broadcastLobbyState(io, session);
  });

  socket.on('start-game', () => {
    if (!socket.data.isHost) {
      socket.emit('room:error', { message: 'Only the host can start the game' });
      return;
    }

    const session = roomStore.get(socket.data.roomCode ?? '');
    if (!session) return;

    const totalPlayers = session.players.length + session.botCount;
    if (totalPlayers < 2) {
      socket.emit('room:error', { message: 'Need at least 2 players to start' });
      return;
    }

    session.startGame();

    for (const player of session.players) {
      const filteredState = session.filterStateFor(player.playerId);
      io.to(player.socketId).emit('game:state', {
        state: filteredState,
        events: [],
      });
    }
  });

  socket.on('disconnecting', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const session = roomStore.get(roomCode);
    if (!session) return;

    const playerId = socket.data.playerId;
    if (!playerId) return;

    const wasHost = socket.data.isHost;
    session.removePlayer(playerId);

    if (session.players.length === 0 && !session.started) {
      roomStore.delete(roomCode);
      return;
    }

    if (wasHost) {
      const newHostId = session.promoteNextHost();
      if (newHostId) {
        // Update the new host's socket data
        const newHostPlayer = session.players.find((p) => p.playerId === newHostId);
        if (newHostPlayer) {
          const newHostSocket = io.sockets.sockets.get(newHostPlayer.socketId);
          if (newHostSocket) {
            newHostSocket.data.isHost = true;
          }
        }
      }
    }

    broadcastLobbyState(io, session);
  });
}
