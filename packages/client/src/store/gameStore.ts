import { create } from 'zustand';
import type { GameState, GameEvent, PieceColor } from '@catan/game-engine';

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

export type PendingAction = 'settlement' | 'road' | 'city' | 'robber' | null;

interface GameStore {
  // Connection
  connected: boolean;
  playerId: string | null;
  roomCode: string | null;
  isHost: boolean;

  // Reconnection
  isReconnecting: boolean;
  disconnectedPlayers: Set<string>;

  // Lobby
  lobbyState: LobbyState | null;

  // Game
  gameState: GameState | null;
  lastEvents: GameEvent[];
  gameLog: GameEvent[];
  lastDiceRoll: [number, number] | null;
  error: string | null;

  // Interaction
  pendingAction: PendingAction;
  showTradePanel: boolean;

  // Actions
  setConnected: (connected: boolean) => void;
  setPlayerId: (id: string) => void;
  setRoomCode: (code: string) => void;
  setIsHost: (isHost: boolean) => void;
  setIsReconnecting: (val: boolean) => void;
  addDisconnectedPlayer: (playerId: string) => void;
  removeDisconnectedPlayer: (playerId: string) => void;
  setLobbyState: (state: LobbyState) => void;
  updateGameState: (state: GameState, events: GameEvent[]) => void;
  setError: (error: string | null) => void;
  setPendingAction: (action: PendingAction) => void;
  clearPendingAction: () => void;
  setShowTradePanel: (show: boolean) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  // Initial state
  connected: false,
  playerId: null,
  roomCode: null,
  isHost: false,
  isReconnecting: false,
  disconnectedPlayers: new Set<string>(),
  lobbyState: null,
  gameState: null,
  lastEvents: [],
  gameLog: [],
  lastDiceRoll: null,
  error: null,
  pendingAction: null,
  showTradePanel: false,

  // Actions
  setConnected: (connected) => set({ connected }),
  setPlayerId: (id) => set({ playerId: id }),
  setRoomCode: (code) => set({ roomCode: code }),
  setIsHost: (isHost) => set({ isHost }),
  setIsReconnecting: (val) => set({ isReconnecting: val }),

  addDisconnectedPlayer: (playerId) =>
    set((prev) => {
      const next = new Set(prev.disconnectedPlayers);
      next.add(playerId);
      return { disconnectedPlayers: next };
    }),

  removeDisconnectedPlayer: (playerId) =>
    set((prev) => {
      const next = new Set(prev.disconnectedPlayers);
      next.delete(playerId);
      return { disconnectedPlayers: next };
    }),

  setLobbyState: (state) => set({ lobbyState: state }),

  updateGameState: (state, events) =>
    set((prev) => {
      const diceEvent = events.find(
        (e): e is GameEvent & { type: 'DICE_ROLLED' } => e.type === 'DICE_ROLLED',
      );
      return {
        gameState: state,
        lastEvents: events,
        gameLog: [...prev.gameLog, ...events],
        lastDiceRoll: diceEvent ? diceEvent.individual : prev.lastDiceRoll,
      };
    }),

  setError: (error) => set({ error }),
  setPendingAction: (action) => set({ pendingAction: action }),
  clearPendingAction: () => set({ pendingAction: null }),
  setShowTradePanel: (show) => set({ showTradePanel: show }),

  reset: () =>
    set({
      connected: false,
      playerId: null,
      roomCode: null,
      isHost: false,
      isReconnecting: false,
      disconnectedPlayers: new Set<string>(),
      lobbyState: null,
      gameState: null,
      lastEvents: [],
      gameLog: [],
      lastDiceRoll: null,
      error: null,
      pendingAction: null,
      showTradePanel: false,
    }),
}));
