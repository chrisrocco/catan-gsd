import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { submitAction } from '../../socket/client';
import { RESOURCE_COLORS, RESOURCE_LABELS } from '../../utils/colors';
import type { ResourceType, ResourceHand } from '@catan/game-engine';

const RESOURCES: ResourceType[] = ['lumber', 'wool', 'grain', 'brick', 'ore'];

export default function DiscardDialog() {
  const gameState = useGameStore((s) => s.gameState);
  const playerId = useGameStore((s) => s.playerId);
  const [selected, setSelected] = useState<Record<ResourceType, number>>({
    lumber: 0,
    wool: 0,
    grain: 0,
    brick: 0,
    ore: 0,
  });

  if (!gameState || !playerId) return null;
  if (gameState.phase !== 'discard') return null;
  if (!gameState.discardQueue.includes(playerId)) return null;

  const player = gameState.players[playerId];
  if (!player) return null;

  const totalCards = Object.values(player.hand).reduce((sum, n) => sum + n, 0);
  const mustDiscard = Math.floor(totalCards / 2);
  const totalSelected = Object.values(selected).reduce((sum, n) => sum + n, 0);
  const remaining = mustDiscard - totalSelected;

  const handleIncrement = (resource: ResourceType) => {
    if (totalSelected >= mustDiscard) return;
    if (selected[resource] >= player.hand[resource]) return;
    setSelected({ ...selected, [resource]: selected[resource] + 1 });
  };

  const handleDecrement = (resource: ResourceType) => {
    if (selected[resource] <= 0) return;
    setSelected({ ...selected, [resource]: selected[resource] - 1 });
  };

  const handleConfirm = () => {
    const resources: Partial<ResourceHand> = {};
    for (const r of RESOURCES) {
      if (selected[r] > 0) {
        resources[r] = selected[r];
      }
    }
    submitAction({ type: 'DISCARD_RESOURCES', resources });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="w-96 rounded-lg bg-gray-800 p-6 shadow-xl ring-1 ring-red-500/50">
        <h3 className="mb-2 text-lg font-bold text-red-400">Discard Cards</h3>
        <p className="mb-4 text-sm text-gray-300">
          You have {totalCards} cards. Discard {mustDiscard}.
          {remaining > 0 && (
            <span className="ml-1 font-semibold text-amber-400">
              ({remaining} more)
            </span>
          )}
        </p>

        <div className="space-y-2">
          {RESOURCES.map((resource) => (
            <div key={resource} className="flex items-center gap-3">
              <div
                className="h-6 w-6 rounded"
                style={{ backgroundColor: RESOURCE_COLORS[resource] }}
              />
              <span className="w-16 text-sm text-white">
                {RESOURCE_LABELS[resource]}
              </span>
              <span className="w-8 text-center text-sm text-gray-400">
                {player.hand[resource]}
              </span>

              <button
                onClick={() => handleDecrement(resource)}
                disabled={selected[resource] <= 0}
                className="h-7 w-7 rounded bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-30"
              >
                -
              </button>
              <span className="w-6 text-center text-sm font-bold text-white">
                {selected[resource]}
              </span>
              <button
                onClick={() => handleIncrement(resource)}
                disabled={
                  selected[resource] >= player.hand[resource] ||
                  totalSelected >= mustDiscard
                }
                className="h-7 w-7 rounded bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-30"
              >
                +
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={handleConfirm}
          disabled={remaining !== 0}
          className="mt-4 w-full rounded bg-red-600 py-2 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Discard {mustDiscard} Cards
        </button>
      </div>
    </div>
  );
}
