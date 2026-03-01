import type { GameState, GameEvent, Action, PieceColor } from '@catan/game-engine';

export interface LobbyPlayer {
  playerId: string;
  displayName: string;
  color: PieceColor;
  isHost: boolean;
  connected: boolean;
}

export interface LobbyState {
  code: string;
  players: LobbyPlayer[];
  botCount: number;
  started: boolean;
}

export interface ServerToClientEvents {
  'lobby:state': (payload: LobbyState) => void;
  'game:state': (payload: { state: GameState; events: GameEvent[] }) => void;
  'action:error': (payload: { message: string }) => void;
  'room:error': (payload: { message: string }) => void;
  'player:disconnected': (payload: { playerId: string }) => void;
  'player:reconnected': (payload: { playerId: string }) => void;
  'turn:timeout': (payload: { playerId: string; remainingSeconds: number }) => void;
}

export interface ClientToServerEvents {
  'join-room': (
    payload: { code: string; displayName: string },
    callback: (response: { ok: boolean; playerId?: string; sessionToken?: string; error?: string }) => void,
  ) => void;
  'rejoin-room': (
    payload: { code: string; sessionToken: string },
    callback: (response: { ok: boolean; playerId?: string; error?: string }) => void,
  ) => void;
  'set-bot-count': (payload: { count: number }) => void;
  'start-game': () => void;
  'submit-action': (payload: Action) => void;
}

export interface SocketData {
  roomCode: string | null;
  playerId: string | null;
  displayName: string;
  isHost: boolean;
  sessionToken: string | null;
}
