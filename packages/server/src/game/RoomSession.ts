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
  sessionToken?: string;
}

const COLORS: PieceColor[] = ['red', 'blue', 'white', 'orange'];
const MAX_PLAYERS = 4;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
export const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes
export const TURN_TIMEOUT_MS = 30 * 1000; // 30 seconds

export class RoomSession {
  readonly code: string;
  players: RoomPlayer[] = [];
  botCount = 0;
  gameState: GameState | null = null;
  started = false;
  lastActivity: number = Date.now();

  /** Timers for grace period (disconnect → bot takeover). */
  private disconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  /** PlayerIds that have been taken over by bots after grace period expiry. */
  private botTakeovers: Set<string> = new Set();

  /** Turn timeout timer for disconnected active player. */
  turnTimer: NodeJS.Timeout | null = null;
  turnTimeoutPlayerId: string | null = null;

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

  /** Store a session token for a player. */
  setPlayerToken(playerId: string, token: string): void {
    const player = this.players.find((p) => p.playerId === playerId);
    if (player) {
      player.sessionToken = token;
    }
  }

  /** Find a player by their session token. Returns the player or null. */
  findPlayerByToken(token: string): RoomPlayer | null {
    return this.players.find((p) => p.sessionToken === token) ?? null;
  }

  /**
   * Mark a player as disconnected (in-game). Does NOT remove them.
   * Starts a grace period timer that converts to bot on expiry.
   * @param onExpire Optional callback invoked after bot conversion (e.g., trigger bot turns).
   */
  markDisconnected(playerId: string, onExpire?: () => void): void {
    const player = this.players.find((p) => p.playerId === playerId);
    if (!player) return;
    player.connected = false;

    // Start grace period timer
    const timer = setTimeout(() => {
      this.convertToBot(playerId);
      this.disconnectTimers.delete(playerId);
      onExpire?.();
    }, GRACE_PERIOD_MS);

    // Clear any existing timer for this player
    const existing = this.disconnectTimers.get(playerId);
    if (existing) clearTimeout(existing);

    this.disconnectTimers.set(playerId, timer);
    this.touch();
  }

  /**
   * Reconnect a player with a new socket ID.
   * Cancels grace period timer and turn timeout if applicable.
   * Returns the reconnected player, or null if not found.
   */
  reconnectPlayer(playerId: string, newSocketId: string): RoomPlayer | null {
    const player = this.players.find((p) => p.playerId === playerId);
    if (!player) return null;

    player.socketId = newSocketId;
    player.connected = true;

    // Cancel grace period timer
    const timer = this.disconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(playerId);
    }

    // Cancel turn timeout if this player was being timed out
    if (this.turnTimeoutPlayerId === playerId) {
      this.clearTurnTimeout();
    }

    this.touch();
    return player;
  }

  /**
   * Convert a disconnected player's slot to bot control.
   * The player is removed from the human players list and their ID
   * is added to botTakeovers so the bot runner will act for them.
   */
  convertToBot(playerId: string): void {
    this.players = this.players.filter((p) => p.playerId !== playerId);
    this.botTakeovers.add(playerId);
    this.touch();
  }

  /** Check if a playerId has been taken over by a bot. */
  isBotTakeover(playerId: string): boolean {
    return this.botTakeovers.has(playerId);
  }

  /** Start a turn timeout for a disconnected active player. */
  startTurnTimeout(playerId: string, callback: () => void, ms = TURN_TIMEOUT_MS): void {
    this.clearTurnTimeout();
    this.turnTimeoutPlayerId = playerId;
    this.turnTimer = setTimeout(() => {
      this.turnTimer = null;
      this.turnTimeoutPlayerId = null;
      callback();
    }, ms);
  }

  /** Clear any pending turn timeout. */
  clearTurnTimeout(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    this.turnTimeoutPlayerId = null;
  }

  /** Clear all timers — for use in tests. */
  clearAllTimers(): void {
    for (const timer of this.disconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.disconnectTimers.clear();
    this.clearTurnTimeout();
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
