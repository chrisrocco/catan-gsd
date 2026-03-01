import { useGameStore } from '../../store/gameStore';
import { RESOURCE_COLORS, RESOURCE_SHORT } from '../../utils/colors';
import type { ResourceType, DevCardType } from '@catan/game-engine';

const RESOURCES: ResourceType[] = ['lumber', 'wool', 'grain', 'brick', 'ore'];

const DEV_CARD_LABELS: Record<string, string> = {
  knight: 'Knight',
  'road-building': 'Road Builder',
  'year-of-plenty': 'Year of Plenty',
  monopoly: 'Monopoly',
};

export default function PlayerHand() {
  const gameState = useGameStore((s) => s.gameState);
  const playerId = useGameStore((s) => s.playerId);

  if (!gameState || !playerId) return null;

  const player = gameState.players[playerId];
  if (!player) return null;

  // Group dev cards by type
  const devCardCounts = player.unplayedDevCards.reduce(
    (acc, card) => {
      acc[card] = (acc[card] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="flex items-center gap-4 rounded-t-lg bg-gray-900/90 px-4 py-3">
      {/* Resources */}
      <div className="flex gap-2">
        {RESOURCES.map((resource) => (
          <div
            key={resource}
            className="flex flex-col items-center rounded px-2 py-1"
            style={{ backgroundColor: RESOURCE_COLORS[resource] + '33' }}
          >
            <div
              className="h-6 w-6 rounded"
              style={{ backgroundColor: RESOURCE_COLORS[resource] }}
            >
              <span className="flex h-full items-center justify-center text-xs font-bold text-white">
                {RESOURCE_SHORT[resource]}
              </span>
            </div>
            <span className="mt-0.5 text-sm font-bold text-white">
              {player.hand[resource]}
            </span>
          </div>
        ))}
      </div>

      {/* Separator */}
      {Object.keys(devCardCounts).length > 0 && (
        <div className="h-8 w-px bg-gray-600" />
      )}

      {/* Dev cards */}
      <div className="flex gap-2">
        {Object.entries(devCardCounts).map(([card, count]) => (
          <div
            key={card}
            className="rounded bg-purple-900/50 px-2 py-1 text-xs text-purple-300"
          >
            {DEV_CARD_LABELS[card] ?? card}
            {count > 1 && <span className="ml-1 font-bold">x{count}</span>}
          </div>
        ))}
      </div>

      {/* VP dev cards (hidden count for self only) */}
      {player.vpDevCards > 0 && (
        <div className="rounded bg-yellow-900/50 px-2 py-1 text-xs text-yellow-300">
          VP Cards: {player.vpDevCards}
        </div>
      )}
    </div>
  );
}
