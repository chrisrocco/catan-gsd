import { useGameStore } from '../store/gameStore';

export default function GamePage() {
  const gameState = useGameStore((s) => s.gameState);

  if (!gameState) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <p className="text-gray-400">Loading game state...</p>
      </div>
    );
  }

  return (
    <div className="grid h-screen grid-rows-[auto_1fr_auto] bg-gray-900">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2">
        <span className="text-sm text-gray-400">
          Turn {gameState.turnNumber} &middot; Phase: {gameState.phase}
        </span>
      </div>

      {/* Main area - board will go here */}
      <div className="flex items-center justify-center">
        <p className="text-gray-500">Board rendering coming in Plan 04-02...</p>
      </div>

      {/* Bottom panel - HUD will go here */}
      <div className="border-t border-gray-700 px-4 py-2">
        <p className="text-sm text-gray-500">HUD panels coming in Plan 04-03...</p>
      </div>
    </div>
  );
}
