/**
 * Type smoke tests — these tests verify the shapes of the exported types
 * at the TypeScript level (compile-time) and runtime structure level.
 * If this file compiles without error, the types are correct.
 */
import { describe, it, expect } from 'vitest';
import type {
  ResourceType,
  DevCardType,
  GamePhase,
  PortType,
  BuildingType,
  PieceColor,
  Building,
  Road,
  Port,
  Hex,
  Vertex,
  Edge,
  Board,
  ResourceHand,
  Player,
  GameState,
  Action,
  GameEvent,
  ActionResult,
} from '../types.js';

describe('ResourceType', () => {
  it('includes all 5 resource types', () => {
    const resources: ResourceType[] = ['lumber', 'wool', 'grain', 'brick', 'ore'];
    expect(resources).toHaveLength(5);
  });
});

describe('DevCardType', () => {
  it('includes all 5 dev card types', () => {
    const cards: DevCardType[] = [
      'knight',
      'victory-point',
      'road-building',
      'year-of-plenty',
      'monopoly',
    ];
    expect(cards).toHaveLength(5);
  });
});

describe('GamePhase', () => {
  it('includes all 10 phases', () => {
    const phases: GamePhase[] = [
      'setup-forward',
      'setup-reverse',
      'pre-roll',
      'post-roll',
      'robber-move',
      'robber-steal',
      'discard',
      'road-building',
      'year-of-plenty',
      'game-over',
    ];
    expect(phases).toHaveLength(10);
  });
});

describe('Player', () => {
  it('has devCardBoughtThisTurn boolean field', () => {
    const player: Player = {
      id: 'p1',
      color: 'red',
      hand: { lumber: 0, wool: 0, grain: 0, brick: 0, ore: 0 },
      unplayedDevCards: [],
      vpDevCards: 0,
      knightCount: 0,
      devCardBoughtThisTurn: false,
      devCardsPlayedThisTurn: 0,
      roadCount: 0,
      settlementCount: 0,
      cityCount: 0,
    };
    expect(typeof player.devCardBoughtThisTurn).toBe('boolean');
  });
});

describe('Action discriminated union', () => {
  it('accepts ROLL_DICE action shape', () => {
    const action: Action = { type: 'ROLL_DICE', playerId: 'p1' };
    expect(action.type).toBe('ROLL_DICE');
  });

  it('accepts END_TURN action shape', () => {
    const action: Action = { type: 'END_TURN', playerId: 'p1' };
    expect(action.type).toBe('END_TURN');
  });

  it('accepts DISCARD_RESOURCES action shape', () => {
    const action: Action = {
      type: 'DISCARD_RESOURCES',
      playerId: 'p1',
      resources: { lumber: 2 },
    };
    expect(action.type).toBe('DISCARD_RESOURCES');
  });

  it('accepts PLAY_DEV_CARD with monopoly resource', () => {
    const action: Action = {
      type: 'PLAY_DEV_CARD',
      playerId: 'p1',
      card: 'monopoly',
      monopolyResource: 'ore',
    };
    expect(action.type).toBe('PLAY_DEV_CARD');
  });
});

describe('GameEvent discriminated union', () => {
  it('accepts DICE_ROLLED event shape', () => {
    const event: GameEvent = {
      type: 'DICE_ROLLED',
      roll: 7,
      individual: [3, 4],
    };
    expect(event.type).toBe('DICE_ROLLED');
  });

  it('accepts GAME_WON event shape', () => {
    const event: GameEvent = {
      type: 'GAME_WON',
      playerId: 'p1',
      finalVP: 10,
    };
    expect(event.type).toBe('GAME_WON');
  });
});

describe('ActionResult', () => {
  it('has state, events, and optional error', () => {
    // This is a compile-time check: if ActionResult type has the right shape,
    // this object literal will typecheck.
    const result: ActionResult = {
      state: {} as GameState,
      events: [],
    };
    expect(result.events).toHaveLength(0);
  });
});

describe('GameState', () => {
  it('has all required top-level fields', () => {
    // Structural check: build a partial GameState to verify field names exist on the type
    const partialState: Pick<
      GameState,
      | 'board'
      | 'players'
      | 'playerOrder'
      | 'activePlayer'
      | 'phase'
      | 'turnNumber'
      | 'deck'
      | 'discardPile'
      | 'bank'
      | 'robberHex'
      | 'longestRoadHolder'
      | 'longestRoadLength'
      | 'largestArmyHolder'
      | 'largestArmyCount'
      | 'discardQueue'
      | 'roadBuildingRoadsLeft'
      | 'yearOfPlentyResourcesLeft'
      | 'winner'
      | 'setupPlacementsDone'
    > = {
      board: { hexes: {}, vertices: {}, edges: {} },
      players: {},
      playerOrder: [],
      activePlayer: 'p1',
      phase: 'pre-roll',
      turnNumber: 1,
      deck: [],
      discardPile: [],
      bank: { lumber: 19, wool: 19, grain: 19, brick: 19, ore: 19 },
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
    };
    expect(partialState.phase).toBe('pre-roll');
  });
});
