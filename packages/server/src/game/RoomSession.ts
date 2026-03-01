import type { GameState, Action, ActionResult, PieceColor } from '@catan/game-engine';
import { applyAction, createInitialGameState } from '@catan/game-engine';
import { filterStateForPlayer } from './stateFilter.js';

export interface RoomPlayer {
  socketId: string;
  playerId: string;
  displayName: string;
  color: PieceColor;
  isHost: boolean;
  connected: boolean;
}

const COLORS: PieceColor[] = ['red', 'blue', 'white', 'orange'];
const MAX_PLAYERS = 4;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export class RoomSession {
  readonly code: string;
  players: RoomPlayer[] = [];
  botCount = 0;
  gameState: GameState | null = null;
  started = false;
  lastActivity: number = Date.now();

  constructor(code: string) {
    this.code = code;
  }

  /** Add a player to the room. Throws if room is full. */
  addPlayer(
    socketId: string,
    playerId: string,
    displayName: string,
    color: PieceColor,
    isHost: boolean,
  ): RoomPlayer {
    if (this.players.length + this.botCount >= MAX_PLAYERS) {
      throw new Error('Room is full');
    }
    const player: RoomPlayer = { socketId, playerId, displayName, color, isHost, connected: true };
    this.players.push(player);
    this.touch();
    return player;
  }

  /** Remove a player by playerId. */
  removePlayer(playerId: string): void {
    this.players = this.players.filter((p) => p.playerId !== playerId);
    this.touch();
  }

  /**
   * Apply a game action. Guards on gameState being initialized.
   * Updates gameState on success.
   */
  applyPlayerAction(action: Action): ActionResult {
    if (!this.gameState) {
      return {
        state: {} as GameState,
        events: [],
        error: 'Game has not started',
      };
    }
    const result = applyAction(this.gameState, action);
    if (!result.error) {
      this.gameState = result.state;
      this.touch();
    }
    return result;
  }

  /** Return a filtered GameState for the given player (hides opponent private info). */
  filterStateFor(playerId: string): GameState {
    if (!this.gameState) {
      throw new Error('Game has not started');
    }
    return filterStateForPlayer(this.gameState, playerId);
  }

  /**
   * Start the game by initializing game state with all player IDs
   * (human players + bot placeholders).
   */
  startGame(): void {
    const humanIds = this.players.map((p) => p.playerId);
    const botIds = Array.from({ length: this.botCount }, (_, i) => `bot-${i}`);
    const allPlayerIds = [...humanIds, ...botIds];
    this.gameState = createInitialGameState(allPlayerIds);
    this.started = true;
    this.touch();
  }

  /**
   * Promote the first connected non-host player to host.
   * Returns the new host's playerId, or null if no eligible player exists.
   */
  promoteNextHost(): string | null {
    const nextHost = this.players.find((p) => p.connected && !p.isHost);
    if (!nextHost) return null;
    // Demote all existing hosts
    for (const p of this.players) {
      p.isHost = false;
    }
    nextHost.isHost = true;
    return nextHost.playerId;
  }

  /** Update lastActivity timestamp. */
  touch(): void {
    this.lastActivity = Date.now();
  }

  /** Returns true if the session has been inactive for more than 2 hours. */
  get isExpired(): boolean {
    return Date.now() - this.lastActivity > SESSION_TTL_MS;
  }

  /** Return the next available color not yet taken by a player. */
  nextAvailableColor(): PieceColor {
    const taken = new Set(this.players.map((p) => p.color));
    const available = COLORS.find((c) => !taken.has(c));
    return available ?? 'red';
  }
}
