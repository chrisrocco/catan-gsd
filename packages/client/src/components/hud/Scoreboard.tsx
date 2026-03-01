import { useGameStore } from '../../store/gameStore';
import { PLAYER_COLORS } from '../../utils/colors';

export default function Scoreboard() {
  const gameState = useGameStore((s) => s.gameState);
  const playerId = useGameStore((s) => s.playerId);
  const lobbyState = useGameStore((s) => s.lobbyState);
  const disconnectedPlayers = useGameStore((s) => s.disconnectedPlayers);

  if (!gameState) return null;

  const getDisplayName = (pid: string): string => {
    const lobbyPlayer = lobbyState?.players.find((p) => p.playerId === pid);
    if (lobbyPlayer) return lobbyPlayer.displayName;
    // Bot players won't be in lobby state
    return pid.startsWith('bot-') ? `Bot ${pid.split('-')[1]}` : pid.slice(0, 6);
  };

  const calculateVP = (pid: string) => {
    const player = gameState.players[pid];
    if (!player) return 0;
    let vp = player.settlementCount + player.cityCount * 2;
    if (gameState.longestRoadHolder === pid) vp += 2;
    if (gameState.largestArmyHolder === pid) vp += 2;
    // VP dev cards visible only for local player
    if (pid === playerId) vp += player.vpDevCards;
    return vp;
  };

  return (
    <div className="rounded-lg bg-gray-800/90 p-3 shadow-lg">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Scoreboard
      </h3>
      <div className="space-y-1">
        {gameState.playerOrder.map((pid) => {
          const player = gameState.players[pid];
          if (!player) return null;
          const isActive = gameState.activePlayer === pid;
          const isLocal = pid === playerId;
          const isDisconnected = disconnectedPlayers.has(pid);
          const vp = calculateVP(pid);

          return (
            <div
              key={pid}
              className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                isActive ? 'bg-gray-700 ring-1 ring-amber-500/50' : ''
              } ${isLocal ? 'font-semibold' : ''}`}
            >
              {/* Color dot */}
              <div
                className="h-3 w-3 flex-shrink-0 rounded-full border border-gray-500"
                style={{ backgroundColor: PLAYER_COLORS[player.color] ?? '#888' }}
              />

              {/* Name */}
              <span className={`flex-1 truncate ${isLocal ? 'text-white' : 'text-gray-300'} ${isDisconnected ? 'opacity-50' : ''}`}>
                {getDisplayName(pid)}
                {isDisconnected && (
                  <span className="ml-1 text-xs text-red-400">(disconnected)</span>
                )}
              </span>

              {/* Awards */}
              {gameState.longestRoadHolder === pid && (
                <span className="text-xs" title="Longest Road">
                  LR
                </span>
              )}
              {gameState.largestArmyHolder === pid && (
                <span className="text-xs" title="Largest Army">
                  LA
                </span>
              )}

              {/* Pieces */}
              <span className="text-xs text-gray-500" title="Settlements/Cities/Roads">
                {player.settlementCount}s {player.cityCount}c {player.roadCount}r
              </span>

              {/* VP */}
              <span className="w-6 text-right font-bold text-amber-400">{vp}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
