import { useGameStore } from '../../store/gameStore';
import { setBotCount, startGame } from '../../socket/client';
import { PLAYER_COLORS } from '../../utils/colors';

export default function WaitingRoom() {
  const lobbyState = useGameStore((s) => s.lobbyState);
  const isHost = useGameStore((s) => s.isHost);
  const roomCode = useGameStore((s) => s.roomCode);

  if (!lobbyState) return null;

  const totalPlayers = lobbyState.players.length + lobbyState.botCount;
  const canStart = isHost && totalPlayers >= 2;
  const maxBots = 4 - lobbyState.players.length;

  return (
    <div className="mx-auto max-w-md rounded-lg bg-gray-800 p-6 shadow-lg">
      <h2 className="mb-2 text-xl font-bold text-white">Waiting Room</h2>

      {/* Room code */}
      <div className="mb-6 rounded bg-gray-700 p-4 text-center">
        <p className="text-sm text-gray-400">Room Code</p>
        <p className="font-mono text-3xl font-bold tracking-widest text-amber-400">
          {roomCode}
        </p>
        <p className="mt-1 text-xs text-gray-500">Share this code with friends</p>
      </div>

      {/* Player list */}
      <div className="mb-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-400">Players</h3>
        <div className="space-y-2">
          {lobbyState.players.map((player) => (
            <div
              key={player.playerId}
              className="flex items-center gap-3 rounded bg-gray-700 px-3 py-2"
            >
              <div
                className="h-4 w-4 rounded-full border border-gray-500"
                style={{ backgroundColor: PLAYER_COLORS[player.color] ?? '#888' }}
              />
              <span className="text-white">{player.displayName}</span>
              {player.isHost && (
                <span className="ml-auto rounded bg-amber-600/30 px-2 py-0.5 text-xs text-amber-400">
                  Host
                </span>
              )}
            </div>
          ))}
          {lobbyState.botCount > 0 &&
            Array.from({ length: lobbyState.botCount }, (_, i) => (
              <div
                key={`bot-${i}`}
                className="flex items-center gap-3 rounded bg-gray-700/50 px-3 py-2"
              >
                <div className="h-4 w-4 rounded-full border border-gray-600 bg-gray-500" />
                <span className="text-gray-400">Bot {i + 1}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Bot count slider (host only) */}
      {isHost && (
        <div className="mb-4">
          <label className="mb-1 block text-sm text-gray-400">
            Bots: {lobbyState.botCount}
          </label>
          <input
            type="range"
            min={0}
            max={maxBots}
            value={lobbyState.botCount}
            onChange={(e) => setBotCount(Number(e.target.value))}
            className="w-full accent-amber-500"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>0</span>
            <span>{maxBots}</span>
          </div>
        </div>
      )}

      {/* Player count */}
      <p className="mb-4 text-center text-sm text-gray-400">
        {totalPlayers}/4 players
      </p>

      {/* Start button (host only) */}
      {isHost && (
        <button
          onClick={startGame}
          disabled={!canStart}
          className="w-full rounded bg-emerald-600 px-4 py-3 text-lg font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Start Game
        </button>
      )}

      {!isHost && (
        <p className="text-center text-sm text-gray-400">
          Waiting for host to start the game...
        </p>
      )}
    </div>
  );
}
