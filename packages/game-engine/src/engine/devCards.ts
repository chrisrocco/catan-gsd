import type { GameState, ActionResult, GameEvent, ResourceType, DevCardType } from '../types.js';
import { BUILD_COSTS } from './trading.js';

const ALL_RESOURCES: ResourceType[] = ['lumber', 'wool', 'grain', 'brick', 'ore'];

/** Apply BUY_DEV_CARD action */
export function applyBuyDevCard(
  state: GameState,
  action: { type: 'BUY_DEV_CARD'; playerId: string },
): ActionResult {
  const player = state.players[action.playerId];
  if (!player) return { state, events: [], error: `Player ${action.playerId} not found` };

  if (state.deck.length === 0) return { state, events: [], error: 'Dev card deck is empty' };

  // Validate resources: 1 ore + 1 grain + 1 wool
  const cost = BUILD_COSTS['dev-card'];
  for (const [res, amount] of Object.entries(cost) as [ResourceType, number][]) {
    if ((player.hand[res] ?? 0) < amount) {
      return { state, events: [], error: `Insufficient ${res}: need ${amount} for dev card` };
    }
  }

  // Draw top card
  const [card, ...remainingDeck] = state.deck;
  if (!card) return { state, events: [], error: 'Deck is empty' };

  // Deduct resources
  const newHand = { ...player.hand };
  const newBank = { ...state.bank };
  for (const [res, amount] of Object.entries(cost) as [ResourceType, number][]) {
    newHand[res] = (newHand[res] ?? 0) - amount;
    newBank[res] = (newBank[res] ?? 0) + amount;
  }

  // VP cards are tracked separately (never played)
  const newVpDevCards = card === 'victory-point' ? player.vpDevCards + 1 : player.vpDevCards;
  const newUnplayed = card === 'victory-point'
    ? player.unplayedDevCards
    : [...player.unplayedDevCards, card];

  const events: GameEvent[] = [{ type: 'DEV_CARD_DRAWN', playerId: action.playerId, card }];

  return {
    state: {
      ...state,
      deck: remainingDeck,
      bank: newBank,
      players: {
        ...state.players,
        [action.playerId]: {
          ...player,
          hand: newHand,
          unplayedDevCards: newUnplayed,
          vpDevCards: newVpDevCards,
          devCardBoughtThisTurn: true,
        },
      },
    },
    events,
  };
}

/** Apply PLAY_DEV_CARD action */
export function applyPlayDevCard(
  state: GameState,
  action: {
    type: 'PLAY_DEV_CARD';
    playerId: string;
    card: Exclude<DevCardType, 'victory-point'>;
    monopolyResource?: ResourceType;
    yearOfPlentyResources?: [ResourceType, ResourceType];
  },
  rand: () => number = Math.random,
): ActionResult {
  const player = state.players[action.playerId];
  if (!player) return { state, events: [], error: `Player ${action.playerId} not found` };

  // GAME-07: Cannot play card bought this turn
  if (player.devCardBoughtThisTurn) {
    return { state, events: [], error: 'Cannot play a dev card bought this turn' };
  }

  // One action card per turn max
  if (player.devCardsPlayedThisTurn >= 1) {
    return { state, events: [], error: 'Already played a dev card this turn' };
  }

  // Must have the card
  const cardIndex = player.unplayedDevCards.indexOf(action.card);
  if (cardIndex === -1) {
    return { state, events: [], error: `You do not have a ${action.card} card` };
  }

  // Remove card from hand, add to discard pile
  const newUnplayed = [
    ...player.unplayedDevCards.slice(0, cardIndex),
    ...player.unplayedDevCards.slice(cardIndex + 1),
  ];

  const basePlayerState = {
    ...player,
    unplayedDevCards: newUnplayed,
    devCardsPlayedThisTurn: player.devCardsPlayedThisTurn + 1,
  };

  let newState: GameState = {
    ...state,
    discardPile: [...state.discardPile, action.card],
    players: { ...state.players, [action.playerId]: basePlayerState },
  };

  switch (action.card) {
    case 'knight': {
      newState = {
        ...newState,
        phase: 'robber-move',
        players: {
          ...newState.players,
          [action.playerId]: {
            ...basePlayerState,
            knightCount: player.knightCount + 1,
          },
        },
      };
      return { state: newState, events: [] };
    }

    case 'monopoly': {
      if (!action.monopolyResource) {
        return { state, events: [], error: 'Monopoly requires monopolyResource to be specified' };
      }
      const res = action.monopolyResource;
      let totalTaken = 0;
      const newPlayers = { ...newState.players };
      const newBank = { ...state.bank };

      for (const [pid, p] of Object.entries(newState.players)) {
        if (pid === action.playerId) continue;
        const amount = p.hand[res] ?? 0;
        if (amount > 0) {
          totalTaken += amount;
          newPlayers[pid] = { ...p, hand: { ...p.hand, [res]: 0 } };
        }
      }

      newPlayers[action.playerId] = {
        ...basePlayerState,
        hand: {
          ...basePlayerState.hand,
          [res]: (basePlayerState.hand[res] ?? 0) + totalTaken,
        },
      };

      const event: GameEvent = { type: 'MONOPOLY_COLLECTED', playerId: action.playerId, resource: res, totalTaken };
      return { state: { ...newState, players: newPlayers, bank: newBank }, events: [event] };
    }

    case 'year-of-plenty': {
      if (!action.yearOfPlentyResources) {
        return { state, events: [], error: 'Year of Plenty requires yearOfPlentyResources to be specified' };
      }
      const [r1, r2] = action.yearOfPlentyResources;
      const newBank = { ...state.bank };

      if ((newBank[r1] ?? 0) < 1) return { state, events: [], error: `Bank has no ${r1}` };
      newBank[r1] = (newBank[r1] ?? 0) - 1;

      // r2 may equal r1 — check after first deduction
      if ((newBank[r2] ?? 0) < 1) return { state, events: [], error: `Bank has no ${r2}` };
      newBank[r2] = (newBank[r2] ?? 0) - 1;

      const newHand = { ...basePlayerState.hand };
      newHand[r1] = (newHand[r1] ?? 0) + 1;
      newHand[r2] = (newHand[r2] ?? 0) + 1;

      const event: GameEvent = {
        type: 'YEAR_OF_PLENTY_GRANTED',
        playerId: action.playerId,
        resources: action.yearOfPlentyResources,
      };

      return {
        state: {
          ...newState,
          bank: newBank,
          players: {
            ...newState.players,
            [action.playerId]: { ...basePlayerState, hand: newHand },
          },
        },
        events: [event],
      };
    }

    case 'road-building': {
      return {
        state: {
          ...newState,
          phase: 'road-building',
          roadBuildingRoadsLeft: 2,
        },
        events: [],
      };
    }

    default:
      return { state, events: [], error: `Unknown dev card type: ${action.card}` };
  }
}

/** Compute total visible VP for a player (settlements, cities, special awards, VP dev cards). */
function computeVP(state: GameState, playerId: string): number {
  let vp = 0;
  for (const vertex of Object.values(state.board.vertices)) {
    if (vertex.building?.playerId === playerId) {
      vp += vertex.building.type === 'city' ? 2 : 1;
    }
  }
  if (state.longestRoadHolder === playerId) vp += 2;
  if (state.largestArmyHolder === playerId) vp += 2;
  const player = state.players[playerId];
  if (player) vp += player.vpDevCards;
  return vp;
}

/** Apply END_TURN action — advances to next player, resets per-turn state, checks for winner */
export function applyEndTurn(
  state: GameState,
  action: { type: 'END_TURN'; playerId: string },
): ActionResult {
  // Check win condition for current player before advancing turn
  const currentVP = computeVP(state, state.activePlayer);
  const events: GameEvent[] = [];

  if (currentVP >= 10) {
    // Current player wins!
    events.push({ type: 'GAME_WON', playerId: state.activePlayer, finalVP: currentVP });
    return {
      state: {
        ...state,
        winner: state.activePlayer,
        phase: 'game-over',
      },
      events,
    };
  }

  const currentIdx = state.playerOrder.indexOf(state.activePlayer);
  const nextIdx = (currentIdx + 1) % state.playerOrder.length;
  const nextPlayer = state.playerOrder[nextIdx]!;

  // Reset devCard flags for the player who just ended their turn
  const currentPlayer = state.players[state.activePlayer]!;
  const resetPlayer = {
    ...currentPlayer,
    devCardBoughtThisTurn: false,
    devCardsPlayedThisTurn: 0,
  };

  return {
    state: {
      ...state,
      phase: 'pre-roll',
      activePlayer: nextPlayer,
      turnNumber: state.turnNumber + 1,
      players: {
        ...state.players,
        [state.activePlayer]: resetPlayer,
      },
    },
    events,
  };
}
