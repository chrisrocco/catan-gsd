import type { GameState, GamePhase, Action, Player, ResourceHand, DevCardType, PieceColor } from '../types.js';
import { generateBoard, shuffle } from '../board/generator.js';

// Re-export makeLcgRng for convenience (imported by tests)
export { makeLcgRng } from '../board/generator.js';

export type ActionType = Action['type'];

// Legal action types per game phase
export const PHASE_LEGAL_ACTIONS: Record<GamePhase, ActionType[]> = {
  'setup-forward':  ['PLACE_SETTLEMENT', 'PLACE_ROAD'],
  'setup-reverse':  ['PLACE_SETTLEMENT', 'PLACE_ROAD'],
  'pre-roll':       ['ROLL_DICE', 'PLAY_DEV_CARD'],
  'post-roll':      ['PLACE_SETTLEMENT', 'PLACE_ROAD', 'UPGRADE_CITY', 'BUY_DEV_CARD', 'PLAY_DEV_CARD', 'TRADE_BANK', 'END_TURN'],
  'robber-move':    ['MOVE_ROBBER'],
  'robber-steal':   ['STEAL_RESOURCE', 'SKIP_STEAL'],
  'discard':        ['DISCARD_RESOURCES'],
  'road-building':  ['PLACE_ROAD'],
  'year-of-plenty': ['PLAY_DEV_CARD'],
  'game-over':      [],
};

// Also export as LEGAL_ACTIONS_BY_PHASE (Set-based variant) for downstream use
export const LEGAL_ACTIONS_BY_PHASE: Record<GamePhase, ReadonlySet<ActionType>> = Object.fromEntries(
  Object.entries(PHASE_LEGAL_ACTIONS).map(([phase, actions]) => [phase, new Set(actions)])
) as Record<GamePhase, ReadonlySet<ActionType>>;

/** Returns the set of legal action types for the current game state */
export function getLegalActions(state: GameState): ActionType[] {
  return PHASE_LEGAL_ACTIONS[state.phase] ?? [];
}

/** Check if a given action type is legal in the current phase */
export function isActionLegalInPhase(phase: GamePhase, actionType: ActionType): boolean {
  return (PHASE_LEGAL_ACTIONS[phase] ?? []).includes(actionType);
}

const PLAYER_COLORS: PieceColor[] = ['red', 'blue', 'white', 'orange'];

// Fixed dev card deck composition per official Catan rules
const DEV_CARD_DECK: DevCardType[] = [
  ...Array<DevCardType>(14).fill('knight'),
  ...Array<DevCardType>(5).fill('victory-point'),
  ...Array<DevCardType>(2).fill('road-building'),
  ...Array<DevCardType>(2).fill('year-of-plenty'),
  ...Array<DevCardType>(2).fill('monopoly'),
];

function createEmptyHand(): ResourceHand {
  return { lumber: 0, wool: 0, grain: 0, brick: 0, ore: 0 };
}

function createPlayer(id: string, color: PieceColor): Player {
  return {
    id,
    color,
    hand: createEmptyHand(),
    unplayedDevCards: [],
    vpDevCards: 0,
    knightCount: 0,
    devCardBoughtThisTurn: false,
    devCardsPlayedThisTurn: 0,
    roadCount: 0,
    settlementCount: 0,
    cityCount: 0,
  };
}

/**
 * Create the initial game state for a new game.
 * @param playerIds Array of 2-4 player IDs (in desired initial turn order)
 * @param rand Injectable RNG for test determinism
 */
export function createInitialGameState(playerIds: string[], rand: () => number = Math.random): GameState {
  if (playerIds.length < 2 || playerIds.length > 4) {
    throw new Error(`Player count must be 2-4, got ${playerIds.length}`);
  }

  const board = generateBoard(rand);

  // Find desert hex for initial robber placement
  const desertHex = Object.values(board.hexes).find(h => h.resource === null);
  if (!desertHex) throw new Error('Board has no desert hex');

  const playerOrder = [...playerIds];

  // Build players record
  const players: Record<string, Player> = {};
  playerIds.forEach((id, i) => {
    players[id] = createPlayer(id, PLAYER_COLORS[i] ?? 'red');
  });

  // Shuffle dev card deck
  const deck = shuffle([...DEV_CARD_DECK], rand);

  const bank: ResourceHand = { lumber: 19, wool: 19, grain: 19, brick: 19, ore: 19 };

  return {
    board,
    players,
    playerOrder,
    activePlayer: playerOrder[0]!,
    phase: 'setup-forward',
    turnNumber: 0,
    deck,
    discardPile: [],
    bank,
    robberHex: desertHex.key,
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
}
