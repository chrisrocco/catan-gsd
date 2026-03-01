import { useGameStore } from '../../store/gameStore';
import { PLAYER_COLORS } from '../../utils/colors';
import type { GamePhase } from '@catan/game-engine';

const PHASE_LABELS: Record<GamePhase, string> = {
  'setup-forward': 'Setup (Round 1)',
  'setup-reverse': 'Setup (Round 2)',
  'pre-roll': 'Roll Dice',
  'post-roll': 'Build & Trade',
  'robber-move': 'Move Robber',
  'robber-steal': 'Steal Card',
  discard: 'Discard Cards',
  'road-building': 'Place Roads',
  'year-of-plenty': 'Year of Plenty',
  'game-over': 'Game Over',
};

export default function TurnInfo() {
  const gameState = useGameStore((s) => s.gameState);
  const lobbyState = useGameStore((s) => s.lobbyState);

  if (!gameState) return null;

  const activePlayer = gameState.players[gameState.activePlayer];
  const phaseLabel = PHASE_LABELS[gameState.phase] ?? gameState.phase;

  const getDisplayName = (pid: string): string => {
    const lobbyPlayer = lobbyState?.players.find((p) => p.playerId === pid);
    if (lobbyPlayer) return lobbyPlayer.displayName;
    return pid.startsWith('bot-') ? `Bot ${pid.split('-')[1]}` : pid.slice(0, 6);
  };

  return (
    <div className="flex items-center gap-4">
      {/* Phase */}
      <span className="rounded bg-gray-700 px-2 py-1 text-sm font-semibold text-white">
        {phaseLabel}
      </span>

      {/* Active player */}
      {activePlayer && (
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: PLAYER_COLORS[activePlayer.color] ?? '#888' }}
          />
          <span>{getDisplayName(gameState.activePlayer)}&apos;s turn</span>
        </div>
      )}

      {/* Turn number */}
      <span className="text-xs text-gray-500">Turn {gameState.turnNumber}</span>
    </div>
  );
}
