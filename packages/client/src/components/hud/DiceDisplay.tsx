import { useGameStore } from '../../store/gameStore';
import { submitAction } from '../../socket/client';

export default function DiceDisplay() {
  const lastDiceRoll = useGameStore((s) => s.lastDiceRoll);
  const gameState = useGameStore((s) => s.gameState);
  const playerId = useGameStore((s) => s.playerId);

  if (!gameState) return null;

  const isMyTurn = gameState.activePlayer === playerId;
  const canRoll = isMyTurn && gameState.phase === 'pre-roll';

  const handleRoll = () => {
    submitAction({ type: 'ROLL_DICE' });
  };

  return (
    <div className="flex items-center gap-3">
      {/* Dice faces */}
      {lastDiceRoll ? (
        <div
          key={gameState.turnNumber}
          className="flex gap-2 animate-[bounce_0.3s_ease-out]"
        >
          <DiceFace value={lastDiceRoll[0]} />
          <DiceFace value={lastDiceRoll[1]} />
          <span className="flex items-center text-lg font-bold text-white">
            = {lastDiceRoll[0] + lastDiceRoll[1]}
          </span>
        </div>
      ) : (
        <div className="flex gap-2 opacity-40">
          <DiceFace value={null} />
          <DiceFace value={null} />
        </div>
      )}

      {/* Roll button */}
      {canRoll && (
        <button
          onClick={handleRoll}
          className="rounded bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-500"
        >
          Roll Dice
        </button>
      )}
    </div>
  );
}

function DiceFace({ value }: { value: number | null }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-gray-500 bg-white shadow">
      {value != null ? (
        <span className="text-lg font-bold text-gray-800">{value}</span>
      ) : (
        <span className="text-lg text-gray-300">?</span>
      )}
    </div>
  );
}
