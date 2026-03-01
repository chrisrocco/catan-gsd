import { describe, it, expect } from 'vitest';
import { applyBuyDevCard, applyPlayDevCard, applyEndTurn } from './devCards.js';
import { createInitialGameState } from './fsm.js';
import { makeLcgRng } from '../board/generator.js';
import type { GameState, DevCardType, ResourceHand } from '../types.js';

function makeState() {
  return createInitialGameState(['p1', 'p2', 'p3'], makeLcgRng(42));
}

function withHand(state: GameState, playerId: string, hand: Partial<ResourceHand>): GameState {
  const full: ResourceHand = { lumber: 0, wool: 0, grain: 0, brick: 0, ore: 0, ...hand };
  return { ...state, players: { ...state.players, [playerId]: { ...state.players[playerId]!, hand: full } } };
}

function withCard(state: GameState, playerId: string, card: Exclude<DevCardType, 'victory-point'>): GameState {
  const player = state.players[playerId]!;
  return { ...state, players: { ...state.players, [playerId]: { ...player, unplayedDevCards: [...player.unplayedDevCards, card], devCardBoughtThisTurn: false } } };
}

describe('applyBuyDevCard', () => {
  it('draws a card and deducts resources', () => {
    const state = withHand({ ...makeState(), phase: 'post-roll' }, 'p1', { ore: 1, grain: 1, wool: 1 });
    const result = applyBuyDevCard(state, { type: 'BUY_DEV_CARD', playerId: 'p1' });
    expect(result.error).toBeUndefined();
    expect(result.state.players['p1']!.hand.ore).toBe(0);
    expect(result.state.deck.length).toBe(state.deck.length - 1);
  });

  it('sets devCardBoughtThisTurn = true', () => {
    const state = withHand({ ...makeState(), phase: 'post-roll' }, 'p1', { ore: 1, grain: 1, wool: 1 });
    const result = applyBuyDevCard(state, { type: 'BUY_DEV_CARD', playerId: 'p1' });
    expect(result.state.players['p1']!.devCardBoughtThisTurn).toBe(true);
  });

  it('adds VP card to vpDevCards (not unplayedDevCards)', () => {
    const vpState = {
      ...withHand({ ...makeState(), phase: 'post-roll' }, 'p1', { ore: 1, grain: 1, wool: 1 }),
      deck: ['victory-point' as DevCardType, ...makeState().deck.slice(1)],
    };
    const result = applyBuyDevCard(vpState, { type: 'BUY_DEV_CARD', playerId: 'p1' });
    expect(result.error).toBeUndefined();
    expect(result.state.players['p1']!.vpDevCards).toBe(1);
    expect(result.state.players['p1']!.unplayedDevCards).not.toContain('victory-point');
  });

  it('adds action card to unplayedDevCards', () => {
    const state = {
      ...withHand({ ...makeState(), phase: 'post-roll' }, 'p1', { ore: 1, grain: 1, wool: 1 }),
      deck: ['knight' as DevCardType, ...makeState().deck.slice(1)],
    };
    const result = applyBuyDevCard(state, { type: 'BUY_DEV_CARD', playerId: 'p1' });
    expect(result.state.players['p1']!.unplayedDevCards).toContain('knight');
  });

  it('rejects if deck is empty', () => {
    const state = { ...withHand(makeState(), 'p1', { ore: 1, grain: 1, wool: 1 }), deck: [] };
    const result = applyBuyDevCard(state, { type: 'BUY_DEV_CARD', playerId: 'p1' });
    expect(result.error).toContain('empty');
  });

  it('rejects if insufficient resources', () => {
    const state = withHand(makeState(), 'p1', { ore: 0, grain: 1, wool: 1 });
    const result = applyBuyDevCard(state, { type: 'BUY_DEV_CARD', playerId: 'p1' });
    expect(result.error).toContain('ore');
  });

  it('emits DEV_CARD_DRAWN event', () => {
    const state = withHand({ ...makeState(), phase: 'post-roll' }, 'p1', { ore: 1, grain: 1, wool: 1 });
    const result = applyBuyDevCard(state, { type: 'BUY_DEV_CARD', playerId: 'p1' });
    expect(result.events.find(e => e.type === 'DEV_CARD_DRAWN')).toBeDefined();
  });
});

describe('applyPlayDevCard — GAME-07 (same-turn restriction)', () => {
  it('rejects playing a card bought this turn', () => {
    const base = withCard(makeState(), 'p1', 'knight');
    const state = { ...base, players: { ...base.players, p1: { ...base.players['p1']!, devCardBoughtThisTurn: true } } };
    const result = applyPlayDevCard(state, { type: 'PLAY_DEV_CARD', playerId: 'p1', card: 'knight' });
    expect(result.error).toContain('bought this turn');
  });

  it('rejects playing a second card in the same turn', () => {
    const base = withCard(makeState(), 'p1', 'knight');
    const state = { ...base, players: { ...base.players, p1: { ...base.players['p1']!, devCardsPlayedThisTurn: 1 } } };
    const result = applyPlayDevCard(state, { type: 'PLAY_DEV_CARD', playerId: 'p1', card: 'knight' });
    expect(result.error).toContain('Already played');
  });
});

describe('applyPlayDevCard — knight', () => {
  it('transitions to robber-move phase', () => {
    const state = withCard({ ...makeState(), phase: 'pre-roll' }, 'p1', 'knight');
    const result = applyPlayDevCard(state, { type: 'PLAY_DEV_CARD', playerId: 'p1', card: 'knight' });
    expect(result.error).toBeUndefined();
    expect(result.state.phase).toBe('robber-move');
  });

  it('increments knightCount', () => {
    const state = withCard({ ...makeState(), phase: 'pre-roll' }, 'p1', 'knight');
    const result = applyPlayDevCard(state, { type: 'PLAY_DEV_CARD', playerId: 'p1', card: 'knight' });
    expect(result.state.players['p1']!.knightCount).toBe(1);
  });

  it('removes knight from unplayedDevCards', () => {
    const state = withCard({ ...makeState(), phase: 'pre-roll' }, 'p1', 'knight');
    const result = applyPlayDevCard(state, { type: 'PLAY_DEV_CARD', playerId: 'p1', card: 'knight' });
    expect(result.state.players['p1']!.unplayedDevCards).not.toContain('knight');
  });
});

describe('applyPlayDevCard — monopoly', () => {
  it('takes all of specified resource from all opponents', () => {
    const base = withCard(makeState(), 'p1', 'monopoly');
    const state = {
      ...base,
      players: {
        ...base.players,
        p2: { ...base.players['p2']!, hand: { lumber: 3, wool: 0, grain: 0, brick: 0, ore: 0 } },
        p3: { ...base.players['p3']!, hand: { lumber: 2, wool: 0, grain: 0, brick: 0, ore: 0 } },
      },
    };
    const result = applyPlayDevCard(state, { type: 'PLAY_DEV_CARD', playerId: 'p1', card: 'monopoly', monopolyResource: 'lumber' });
    expect(result.error).toBeUndefined();
    expect(result.state.players['p1']!.hand.lumber).toBe(5);
    expect(result.state.players['p2']!.hand.lumber).toBe(0);
    expect(result.state.players['p3']!.hand.lumber).toBe(0);
  });

  it('emits MONOPOLY_COLLECTED event with correct total', () => {
    const base = withCard(makeState(), 'p1', 'monopoly');
    const state = {
      ...base,
      players: { ...base.players, p2: { ...base.players['p2']!, hand: { lumber: 4, wool: 0, grain: 0, brick: 0, ore: 0 } } },
    };
    const result = applyPlayDevCard(state, { type: 'PLAY_DEV_CARD', playerId: 'p1', card: 'monopoly', monopolyResource: 'lumber' });
    const event = result.events.find(e => e.type === 'MONOPOLY_COLLECTED') as { type: 'MONOPOLY_COLLECTED'; totalTaken: number } | undefined;
    expect(event?.totalTaken).toBe(4);
  });
});

describe('applyPlayDevCard — year of plenty', () => {
  it('grants 2 chosen resources from bank', () => {
    const state = withCard(makeState(), 'p1', 'year-of-plenty');
    const result = applyPlayDevCard(state, { type: 'PLAY_DEV_CARD', playerId: 'p1', card: 'year-of-plenty', yearOfPlentyResources: ['ore', 'grain'] });
    expect(result.error).toBeUndefined();
    expect(result.state.players['p1']!.hand.ore).toBe(1);
    expect(result.state.players['p1']!.hand.grain).toBe(1);
    expect(result.state.bank.ore).toBe(18);
    expect(result.state.bank.grain).toBe(18);
  });
});

describe('applyPlayDevCard — road building', () => {
  it('transitions to road-building phase with 2 roads left', () => {
    const state = withCard({ ...makeState(), phase: 'post-roll' }, 'p1', 'road-building');
    const result = applyPlayDevCard(state, { type: 'PLAY_DEV_CARD', playerId: 'p1', card: 'road-building' });
    expect(result.error).toBeUndefined();
    expect(result.state.phase).toBe('road-building');
    expect(result.state.roadBuildingRoadsLeft).toBe(2);
  });
});

describe('applyEndTurn', () => {
  it('advances to next player in order', () => {
    const state = { ...makeState(), phase: 'post-roll' as const, activePlayer: 'p1', playerOrder: ['p1','p2','p3'] };
    const result = applyEndTurn(state, { type: 'END_TURN', playerId: 'p1' });
    expect(result.state.activePlayer).toBe('p2');
    expect(result.state.phase).toBe('pre-roll');
  });

  it('wraps around to first player after last player', () => {
    const state = { ...makeState(), phase: 'post-roll' as const, activePlayer: 'p3', playerOrder: ['p1','p2','p3'] };
    const result = applyEndTurn(state, { type: 'END_TURN', playerId: 'p3' });
    expect(result.state.activePlayer).toBe('p1');
  });

  it('resets devCardBoughtThisTurn and devCardsPlayedThisTurn', () => {
    const base = makeState();
    const state = {
      ...base,
      phase: 'post-roll' as const,
      players: { ...base.players, p1: { ...base.players['p1']!, devCardBoughtThisTurn: true, devCardsPlayedThisTurn: 1 } },
    };
    const result = applyEndTurn(state, { type: 'END_TURN', playerId: 'p1' });
    expect(result.state.players['p1']!.devCardBoughtThisTurn).toBe(false);
    expect(result.state.players['p1']!.devCardsPlayedThisTurn).toBe(0);
  });

  it('increments turnNumber', () => {
    const state = { ...makeState(), phase: 'post-roll' as const };
    const result = applyEndTurn(state, { type: 'END_TURN', playerId: 'p1' });
    expect(result.state.turnNumber).toBe(state.turnNumber + 1);
  });
});
