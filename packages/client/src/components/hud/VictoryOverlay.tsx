import { useGameStore } from '../../store/gameStore';
import { PLAYER_COLORS } from '../../utils/colors';
import { disconnectSocket } from '../../socket/client';

export default function VictoryOverlay() {
  const gameState = useGameStore((s) => s.gameState);
  const playerId = useGameStore((s) => s.playerId);
  const lobbyState = useGameStore((s) => s.lobbyState);
  const reset = useGameStore((s) => s.reset);

  if (!gameState || !gameState.winner || gameState.phase !== 'game-over') return null;

  const winner = gameState.players[gameState.winner];
  const isLocalWinner = gameState.winner === playerId;

  const getDisplayName = (pid: string): string => {
    const lobbyPlayer = lobbyState?.players.find((p) => p.playerId === pid);
    if (lobbyPlayer) return lobbyPlayer.displayName;
    return pid.startsWith('bot-') ? `Bot ${pid.split('-')[1]}` : pid.slice(0, 6);
  };

  const calculateVP = (pid: string) => {
    const player = gameState.players[pid];
    if (!player) return 0;
    let vp = player.settlementCount + player.cityCount * 2;
    if (gameState.longestRoadHolder === pid) vp += 2;
    if (gameState.largestArmyHolder === pid) vp += 2;
    vp += player.vpDevCards;
    return vp;
  };

  const handleBackToLobby = () => {
    disconnectSocket();
    reset();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="max-w-md rounded-xl bg-gray-800 p-8 text-center shadow-2xl ring-2 ring-amber-500/50">
        {/* Winner announcement */}
        <div className="mb-6">
          <p className="text-sm uppercase tracking-wider text-amber-400">
            {isLocalWinner ? 'You Win!' : 'Game Over'}
          </p>
          <div className="mt-2 flex items-center justify-center gap-3">
            {winner && (
              <div
                className="h-6 w-6 rounded-full ring-2 ring-white"
                style={{ backgroundColor: PLAYER_COLORS[winner.color] ?? '#888' }}
              />
            )}
            <h2 className="text-3xl font-bold text-white">
              {getDisplayName(gameState.winner)}
            </h2>
          </div>
          <p className="mt-1 text-lg text-amber-300">
            {calculateVP(gameState.winner)} Victory Points
          </p>
        </div>

        {/* All player scores */}
        <div className="mb-6 rounded-lg bg-gray-700/50 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Final Scores
          </h3>
          <div className="space-y-2">
            {gameState.playerOrder.map((pid) => {
              const player = gameState.players[pid];
              if (!player) return null;
              const vp = calculateVP(pid);
              const isWinner = pid === gameState.winner;

              return (
                <div
                  key={pid}
                  className={`flex items-center gap-2 rounded px-3 py-1.5 ${
                    isWinner ? 'bg-amber-900/30' : ''
                  }`}
                >
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: PLAYER_COLORS[player.color] ?? '#888' }}
                  />
                  <span className={`flex-1 text-left text-sm ${isWinner ? 'font-bold text-white' : 'text-gray-300'}`}>
                    {getDisplayName(pid)}
                  </span>
                  <span className={`font-bold ${isWinner ? 'text-amber-400' : 'text-gray-400'}`}>
                    {vp} VP
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleBackToLobby}
          className="w-full rounded bg-amber-600 py-3 text-lg font-bold text-white transition hover:bg-amber-500"
        >
          Back to Lobby
        </button>
      </div>
    </div>
  );
}
