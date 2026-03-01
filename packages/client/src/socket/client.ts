import { io, type Socket } from 'socket.io-client';
import type { GameState, GameEvent, Action, PieceColor } from '@catan/game-engine';
import { useGameStore, type LobbyState } from '../store/gameStore';

// Socket event types (mirroring server types)
interface ServerToClientEvents {
  'lobby:state': (payload: LobbyState) => void;
  'game:state': (payload: { state: GameState; events: GameEvent[] }) => void;
  'action:error': (payload: { message: string }) => void;
  'room:error': (payload: { message: string }) => void;
}

interface ClientToServerEvents {
  'join-room': (
    payload: { code: string; displayName: string },
    callback: (response: { ok: boolean; playerId?: string; error?: string }) => void,
  ) => void;
  'set-bot-count': (payload: { count: number }) => void;
  'start-game': () => void;
  'submit-action': (payload: Action) => void;
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

function getSocket(): TypedSocket {
  if (!socket) {
    socket = io('/', {
      autoConnect: false,
      transports: ['websocket'],
    }) as TypedSocket;

    const store = useGameStore.getState;

    socket.on('connect', () => {
      useGameStore.setState({ connected: true });
    });

    socket.on('disconnect', () => {
      useGameStore.setState({ connected: false });
    });

    socket.on('lobby:state', (data) => {
      useGameStore.setState({ lobbyState: data });
    });

    socket.on('game:state', (data) => {
      store().updateGameState(data.state, data.events);
    });

    socket.on('action:error', (data) => {
      useGameStore.setState({ error: data.message });
    });

    socket.on('room:error', (data) => {
      useGameStore.setState({ error: data.message });
    });
  }
  return socket;
}

export async function createRoom(): Promise<string> {
  const response = await fetch('/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: 'host' }),
  });
  if (!response.ok) {
    throw new Error('Failed to create room');
  }
  const data = (await response.json()) as { code: string; playerId: string };
  return data.code;
}

export function joinRoom(code: string, displayName: string): Promise<string> {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }

  return new Promise((resolve, reject) => {
    s.emit('join-room', { code, displayName }, (response) => {
      if (response.ok && response.playerId) {
        useGameStore.setState({
          playerId: response.playerId,
          roomCode: code,
        });
        resolve(response.playerId);
      } else {
        reject(new Error(response.error ?? 'Failed to join room'));
      }
    });
  });
}

export function setBotCount(count: number): void {
  const s = getSocket();
  s.emit('set-bot-count', { count });
}

export function startGame(): void {
  const s = getSocket();
  s.emit('start-game');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function submitAction(action: Record<string, any>): void {
  const s = getSocket();
  // Server injects playerId — send with empty string
  s.emit('submit-action', { ...action, playerId: '' } as Action);
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
