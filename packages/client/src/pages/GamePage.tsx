import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import HexBoard from '../components/board/HexBoard';
import TurnInfo from '../components/hud/TurnInfo';
import Scoreboard from '../components/hud/Scoreboard';
import DiceDisplay from '../components/hud/DiceDisplay';
import ActionBar from '../components/hud/ActionBar';
import PlayerHand from '../components/hud/PlayerHand';
import GameLog from '../components/hud/GameLog';
import BuildCosts from '../components/hud/BuildCosts';
import DiscardDialog from '../components/hud/DiscardDialog';
import VictoryOverlay from '../components/hud/VictoryOverlay';
import TradePanel from '../components/hud/TradePanel';
import ReconnectOverlay from '../components/board/ReconnectOverlay';

export default function GamePage() {
  const gameState = useGameStore((s) => s.gameState);
  const error = useGameStore((s) => s.error);
  const showTradePanel = useGameStore((s) => s.showTradePanel);
  const setShowTradePanel = useGameStore((s) => s.setShowTradePanel);

  // Clear error after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => useGameStore.setState({ error: null }), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (!gameState) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <p className="text-gray-400">Loading game state...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-900">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2">
        <TurnInfo />
        <div className="flex items-center gap-3">
          <DiceDisplay />
          <BuildCosts />
        </div>
      </div>

      {/* Main area */}
      <div className="flex min-h-0 flex-1">
        {/* Board center */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden p-2">
          <HexBoard />
          <ReconnectOverlay />
        </div>

        {/* Right sidebar: Scoreboard + Log */}
        <div className="flex w-60 flex-col border-l border-gray-700">
          <div className="border-b border-gray-700 p-2">
            <Scoreboard />
          </div>
          <div className="min-h-0 flex-1">
            <GameLog />
          </div>
        </div>
      </div>

      {/* Bottom: Action bar + Player hand */}
      <div className="border-t border-gray-700">
        <ActionBar />
        <PlayerHand />
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg bg-red-900 px-4 py-2 text-sm text-red-200 shadow-lg">
          {error}
        </div>
      )}

      {/* Overlays */}
      <DiscardDialog />
      <VictoryOverlay />
      {showTradePanel && <TradePanel onClose={() => setShowTradePanel(false)} />}
    </div>
  );
}
