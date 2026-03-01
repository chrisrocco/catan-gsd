/**
 * Compile-time import tests for server types and game-engine exports.
 * These tests verify that the types are correctly importable.
 */
import { describe, it, expect } from 'vitest';
import type { ServerToClientEvents, ClientToServerEvents, SocketData, LobbyState, LobbyPlayer } from './types.js';
import type { applyAction } from '@catan/game-engine';
import type { createInitialGameState } from '@catan/game-engine';

describe('Server types are importable', () => {
  it('LobbyState has required fields', () => {
    const state: LobbyState = {
      code: 'ABCD',
      players: [],
      botCount: 0,
      started: false,
    };
    expect(state.code).toBe('ABCD');
  });

  it('LobbyPlayer has required fields', () => {
    const player: LobbyPlayer = {
      playerId: 'p1',
      displayName: 'Alice',
      color: 'red',
      isHost: true,
      connected: true,
    };
    expect(player.playerId).toBe('p1');
  });

  it('SocketData has required fields', () => {
    const data: SocketData = {
      roomCode: null,
      playerId: null,
      displayName: '',
      isHost: false,
    };
    expect(data.roomCode).toBeNull();
  });
});

describe('Game engine exports are importable', () => {
  it('applyAction is importable at runtime', async () => {
    const { applyAction } = await import('@catan/game-engine');
    expect(typeof applyAction).toBe('function');
  });

  it('createInitialGameState is importable at runtime', async () => {
    const { createInitialGameState } = await import('@catan/game-engine');
    expect(typeof createInitialGameState).toBe('function');
  });

  it('generateBoard is importable at runtime', async () => {
    const { generateBoard } = await import('@catan/game-engine');
    expect(typeof generateBoard).toBe('function');
  });
});
