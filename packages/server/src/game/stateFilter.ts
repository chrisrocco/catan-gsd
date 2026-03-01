import type { GameState } from '@catan/game-engine';

export function filterStateForPlayer(state: GameState, viewingPlayerId: string): GameState {
  const filteredPlayers = Object.fromEntries(
    Object.entries(state.players).map(([id, player]) => {
      if (id === viewingPlayerId) return [id, player];
      return [
        id,
        {
          ...player,
          hand: { lumber: 0, wool: 0, grain: 0, brick: 0, ore: 0 },
          unplayedDevCards: [],
          vpDevCards: 0,
        },
      ];
    }),
  );
  return { ...state, players: filteredPlayers as GameState['players'] };
}
