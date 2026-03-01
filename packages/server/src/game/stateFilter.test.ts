import { describe, it, expect } from 'vitest';
import { filterStateForPlayer } from './stateFilter.js';
import type { GameState, Player, ResourceHand } from '@catan/game-engine';

const makeHand = (amounts: Partial<ResourceHand> = {}): ResourceHand => ({
  lumber: 0,
  wool: 0,
  grain: 0,
  brick: 0,
  ore: 0,
  ...amounts,
});

const makePlayer = (overrides: Partial<Player> = {}): Player => ({
  id: 'p1',
  color: 'red',
  hand: makeHand({ lumber: 3, wool: 2 }),
  unplayedDevCards: ['knight', 'monopoly'],
  vpDevCards: 2,
  knightCount: 1,
  roadCount: 5,
  settlementCount: 2,
  cityCount: 0,
  devCardBoughtThisTurn: false,
  devCardsPlayedThisTurn: 0,
  ...overrides,
});

const makeGameState = (players: Record<string, Player>): GameState => ({
  players,
  board: {} as GameState['board'],
  activePlayer: 'p1',
  phase: 'pre-roll',
  playerOrder: ['p1', 'p2'],
  turnNumber: 1,
  deck: [],
  discardPile: [],
  robberHex: '0,0,0',
  longestRoadHolder: null,
  longestRoadLength: 0,
  largestArmyHolder: null,
  largestArmyCount: 0,
  discardQueue: [],
  roadBuildingRoadsLeft: 0,
  yearOfPlentyResourcesLeft: 0,
  winner: null,
  setupPlacementsDone: 0,
  bank: makeHand({ lumber: 19, wool: 19, grain: 19, brick: 19, ore: 19 }),
});

describe('filterStateForPlayer', () => {
  it('returns own hand unchanged', () => {
    const p1 = makePlayer({ id: 'p1', hand: makeHand({ lumber: 3, wool: 2 }) });
    const p2 = makePlayer({ id: 'p2', color: 'blue', hand: makeHand({ ore: 5 }) });
    const state = makeGameState({ p1, p2 });

    const filtered = filterStateForPlayer(state, 'p1');
    expect(filtered.players['p1']!.hand).toEqual({ lumber: 3, wool: 2, grain: 0, brick: 0, ore: 0 });
  });

  it('zeroes opponent hand resources', () => {
    const p1 = makePlayer({ id: 'p1' });
    const p2 = makePlayer({ id: 'p2', color: 'blue', hand: makeHand({ ore: 5, grain: 3 }) });
    const state = makeGameState({ p1, p2 });

    const filtered = filterStateForPlayer(state, 'p1');
    expect(filtered.players['p2']!.hand).toEqual({ lumber: 0, wool: 0, grain: 0, brick: 0, ore: 0 });
  });

  it('empties opponent unplayedDevCards array', () => {
    const p1 = makePlayer({ id: 'p1' });
    const p2 = makePlayer({ id: 'p2', color: 'blue', unplayedDevCards: ['knight', 'monopoly', 'road-building'] });
    const state = makeGameState({ p1, p2 });

    const filtered = filterStateForPlayer(state, 'p1');
    expect(filtered.players['p2']!.unplayedDevCards).toEqual([]);
  });

  it('zeroes opponent vpDevCards count', () => {
    const p1 = makePlayer({ id: 'p1' });
    const p2 = makePlayer({ id: 'p2', color: 'blue', vpDevCards: 3 });
    const state = makeGameState({ p1, p2 });

    const filtered = filterStateForPlayer(state, 'p1');
    expect(filtered.players['p2']!.vpDevCards).toBe(0);
  });

  it('preserves own unplayedDevCards', () => {
    const p1 = makePlayer({ id: 'p1', unplayedDevCards: ['knight', 'year-of-plenty'] });
    const p2 = makePlayer({ id: 'p2', color: 'blue' });
    const state = makeGameState({ p1, p2 });

    const filtered = filterStateForPlayer(state, 'p1');
    expect(filtered.players['p1']!.unplayedDevCards).toEqual(['knight', 'year-of-plenty']);
  });

  it('preserves own vpDevCards count', () => {
    const p1 = makePlayer({ id: 'p1', vpDevCards: 2 });
    const p2 = makePlayer({ id: 'p2', color: 'blue' });
    const state = makeGameState({ p1, p2 });

    const filtered = filterStateForPlayer(state, 'p1');
    expect(filtered.players['p1']!.vpDevCards).toBe(2);
  });

  it('preserves non-private opponent fields (color, knightCount, roadCount, etc.)', () => {
    const p1 = makePlayer({ id: 'p1' });
    const p2 = makePlayer({
      id: 'p2',
      color: 'blue',
      knightCount: 3,
      settlementCount: 2,
      cityCount: 1,
      roadCount: 5,
    });
    const state = makeGameState({ p1, p2 });

    const filtered = filterStateForPlayer(state, 'p1');
    const filteredP2 = filtered.players['p2']!;
    expect(filteredP2.color).toBe('blue');
    expect(filteredP2.knightCount).toBe(3);
    expect(filteredP2.settlementCount).toBe(2);
    expect(filteredP2.cityCount).toBe(1);
    expect(filteredP2.roadCount).toBe(5);
  });

  it('does not mutate the original state', () => {
    const p1 = makePlayer({ id: 'p1' });
    const p2 = makePlayer({ id: 'p2', color: 'blue', hand: makeHand({ ore: 5 }) });
    const state = makeGameState({ p1, p2 });

    filterStateForPlayer(state, 'p1');
    expect(state.players['p2']!.hand.ore).toBe(5);
  });
});
