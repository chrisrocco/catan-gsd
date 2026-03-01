import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoomSession, GRACE_PERIOD_MS, TURN_TIMEOUT_MS } from './RoomSession.js';

describe('RoomSession reconnection lifecycle', () => {
  let session: RoomSession;

  beforeEach(() => {
    vi.useFakeTimers();
    session = new RoomSession('TEST01');
    session.addPlayer('socket-1', 'player-1', 'Alice', 'red', true);
    session.addPlayer('socket-2', 'player-2', 'Bob', 'blue', false);
  });

  afterEach(() => {
    session.clearAllTimers();
    vi.useRealTimers();
  });

  describe('setPlayerToken / findPlayerByToken', () => {
    it('stores a token and retrieves the player', () => {
      session.setPlayerToken('player-1', 'token-abc');
      const found = session.findPlayerByToken('token-abc');
      expect(found).not.toBeNull();
      expect(found!.playerId).toBe('player-1');
    });

    it('returns null for unknown token', () => {
      session.setPlayerToken('player-1', 'token-abc');
      expect(session.findPlayerByToken('wrong-token')).toBeNull();
    });

    it('returns null when no tokens set', () => {
      expect(session.findPlayerByToken('any-token')).toBeNull();
    });
  });

  describe('markDisconnected', () => {
    it('sets connected to false without removing the player', () => {
      session.markDisconnected('player-1');
      expect(session.players).toHaveLength(2);
      const p1 = session.players.find((p) => p.playerId === 'player-1');
      expect(p1!.connected).toBe(false);
    });

    it('does nothing for unknown playerId', () => {
      session.markDisconnected('unknown');
      expect(session.players).toHaveLength(2);
    });
  });

  describe('reconnectPlayer', () => {
    it('restores connected=true and updates socketId', () => {
      session.markDisconnected('player-1');
      const result = session.reconnectPlayer('player-1', 'new-socket-1');
      expect(result).not.toBeNull();
      expect(result!.connected).toBe(true);
      expect(result!.socketId).toBe('new-socket-1');
    });

    it('returns null for unknown playerId', () => {
      expect(session.reconnectPlayer('unknown', 'socket-x')).toBeNull();
    });

    it('cancels grace period timer', () => {
      const onExpire = vi.fn();
      session.markDisconnected('player-1', onExpire);
      session.reconnectPlayer('player-1', 'new-socket-1');

      // Advance past grace period — callback should NOT fire
      vi.advanceTimersByTime(GRACE_PERIOD_MS + 1000);
      expect(onExpire).not.toHaveBeenCalled();
    });
  });

  describe('grace period → convertToBot', () => {
    it('converts player to bot after grace period expires', () => {
      const onExpire = vi.fn();
      session.markDisconnected('player-1', onExpire);

      // Before grace period
      vi.advanceTimersByTime(GRACE_PERIOD_MS - 1000);
      expect(session.players).toHaveLength(2);
      expect(session.isBotTakeover('player-1')).toBe(false);

      // After grace period
      vi.advanceTimersByTime(2000);
      expect(session.players).toHaveLength(1);
      expect(session.players[0]!.playerId).toBe('player-2');
      expect(session.isBotTakeover('player-1')).toBe(true);
      expect(onExpire).toHaveBeenCalledOnce();
    });

    it('reconnecting before grace period prevents bot conversion', () => {
      session.markDisconnected('player-1');

      vi.advanceTimersByTime(GRACE_PERIOD_MS / 2);
      session.reconnectPlayer('player-1', 'new-socket-1');

      vi.advanceTimersByTime(GRACE_PERIOD_MS);
      expect(session.players).toHaveLength(2);
      expect(session.isBotTakeover('player-1')).toBe(false);
    });
  });

  describe('convertToBot', () => {
    it('removes player from players array and adds to botTakeovers', () => {
      session.convertToBot('player-1');
      expect(session.players).toHaveLength(1);
      expect(session.isBotTakeover('player-1')).toBe(true);
    });

    it('isBotTakeover returns false for non-converted players', () => {
      expect(session.isBotTakeover('player-2')).toBe(false);
    });
  });

  describe('turn timeout', () => {
    it('fires callback after timeout period', () => {
      const cb = vi.fn();
      session.startTurnTimeout('player-1', cb);

      vi.advanceTimersByTime(TURN_TIMEOUT_MS - 100);
      expect(cb).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);
      expect(cb).toHaveBeenCalledOnce();
    });

    it('clearTurnTimeout cancels the timer', () => {
      const cb = vi.fn();
      session.startTurnTimeout('player-1', cb);
      session.clearTurnTimeout();

      vi.advanceTimersByTime(TURN_TIMEOUT_MS + 1000);
      expect(cb).not.toHaveBeenCalled();
    });

    it('reconnectPlayer cancels turn timeout if player is the one being timed out', () => {
      const cb = vi.fn();
      session.markDisconnected('player-1');
      session.startTurnTimeout('player-1', cb);

      session.reconnectPlayer('player-1', 'new-socket-1');

      vi.advanceTimersByTime(TURN_TIMEOUT_MS + 1000);
      expect(cb).not.toHaveBeenCalled();
      expect(session.turnTimeoutPlayerId).toBeNull();
    });

    it('reconnectPlayer does NOT cancel turn timeout for a different player', () => {
      const cb = vi.fn();
      session.markDisconnected('player-1');
      session.markDisconnected('player-2');
      session.startTurnTimeout('player-2', cb);

      session.reconnectPlayer('player-1', 'new-socket-1');

      vi.advanceTimersByTime(TURN_TIMEOUT_MS + 1000);
      expect(cb).toHaveBeenCalledOnce();
    });
  });

  describe('clearAllTimers', () => {
    it('clears both disconnect and turn timers', () => {
      const disconnectCb = vi.fn();
      const turnCb = vi.fn();
      session.markDisconnected('player-1', disconnectCb);
      session.startTurnTimeout('player-1', turnCb);

      session.clearAllTimers();

      vi.advanceTimersByTime(GRACE_PERIOD_MS + TURN_TIMEOUT_MS);
      expect(disconnectCb).not.toHaveBeenCalled();
      expect(turnCb).not.toHaveBeenCalled();
    });
  });
});
