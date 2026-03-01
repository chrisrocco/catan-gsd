import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { submitAction } from '../../socket/client';
import { RESOURCE_COLORS } from '../../utils/colors';
import type { ResourceType } from '@catan/game-engine';

const RESOURCES: ResourceType[] = ['lumber', 'wool', 'grain', 'brick', 'ore'];

export default function TradePanel({ onClose }: { onClose: () => void }) {
  const gameState = useGameStore((s) => s.gameState);
  const playerId = useGameStore((s) => s.playerId);
  const [give, setGive] = useState<ResourceType | null>(null);
  const [receive, setReceive] = useState<ResourceType | null>(null);

  const tradeRates = useMemo(() => {
    if (!gameState || !playerId) return {} as Record<ResourceType, number>;
    const player = gameState.players[playerId];
    if (!player) return {} as Record<ResourceType, number>;

    const rates: Record<string, number> = {};

    // Check ports the player has access to
    const has3to1 = Object.values(gameState.board.vertices).some(
      (v) => v.building?.playerId === playerId && v.port?.type === '3:1',
    );

    for (const resource of RESOURCES) {
      // Check for specific 2:1 port
      const has2to1 = Object.values(gameState.board.vertices).some(
        (v) => v.building?.playerId === playerId && v.port?.type === resource,
      );

      if (has2to1) {
        rates[resource] = 2;
      } else if (has3to1) {
        rates[resource] = 3;
      } else {
        rates[resource] = 4;
      }
    }
    return rates as Record<ResourceType, number>;
  }, [gameState, playerId]);

  if (!gameState || !playerId) return null;

  const player = gameState.players[playerId];
  if (!player) return null;

  const rate = give ? tradeRates[give] ?? 4 : 4;
  const canTrade = give && receive && give !== receive && player.hand[give] >= rate;

  const handleTrade = () => {
    if (!give || !receive) return;
    submitAction({ type: 'TRADE_BANK', give, receive, amount: rate });
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50">
      <div className="w-80 rounded-lg bg-gray-800 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Bank Trade</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            Close
          </button>
        </div>

        {/* Give */}
        <div className="mb-4">
          <p className="mb-2 text-sm text-gray-400">
            Give ({give ? `${rate}:1` : '?:1'})
          </p>
          <div className="flex gap-2">
            {RESOURCES.map((r) => (
              <button
                key={r}
                onClick={() => setGive(r)}
                className={`flex flex-col items-center rounded px-2 py-1 transition ${
                  give === r ? 'ring-2 ring-white' : 'opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: RESOURCE_COLORS[r] + '55' }}
              >
                <div
                  className="h-6 w-6 rounded"
                  style={{ backgroundColor: RESOURCE_COLORS[r] }}
                />
                <span className="mt-0.5 text-xs text-white">
                  {player.hand[r]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Receive */}
        <div className="mb-4">
          <p className="mb-2 text-sm text-gray-400">Receive</p>
          <div className="flex gap-2">
            {RESOURCES.filter((r) => r !== give).map((r) => (
              <button
                key={r}
                onClick={() => setReceive(r)}
                className={`flex flex-col items-center rounded px-2 py-1 transition ${
                  receive === r ? 'ring-2 ring-white' : 'opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: RESOURCE_COLORS[r] + '55' }}
              >
                <div
                  className="h-6 w-6 rounded"
                  style={{ backgroundColor: RESOURCE_COLORS[r] }}
                />
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleTrade}
          disabled={!canTrade}
          className="w-full rounded bg-amber-600 py-2 font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Trade {give ? rate : '?'} {give ?? '...'} for 1 {receive ?? '...'}
        </button>
      </div>
    </div>
  );
}
