import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { submitAction } from '../../socket/client';
import type { ResourceType, DevCardType } from '@catan/game-engine';

const BUILD_COSTS: Record<string, Partial<Record<ResourceType, number>>> = {
  road: { brick: 1, lumber: 1 },
  settlement: { brick: 1, lumber: 1, grain: 1, wool: 1 },
  city: { grain: 2, ore: 3 },
  'dev-card': { ore: 1, grain: 1, wool: 1 },
};

function canAfford(
  hand: Record<ResourceType, number>,
  cost: Partial<Record<ResourceType, number>>,
): boolean {
  for (const [resource, amount] of Object.entries(cost)) {
    if ((hand[resource as ResourceType] ?? 0) < (amount ?? 0)) return false;
  }
  return true;
}

const PLAYABLE_DEV_CARDS = ['knight', 'road-building', 'year-of-plenty', 'monopoly'] as const;
const DEV_CARD_LABELS: Record<string, string> = {
  knight: 'Knight',
  'road-building': 'Road Builder',
  'year-of-plenty': 'Year of Plenty',
  monopoly: 'Monopoly',
};

const RESOURCES: ResourceType[] = ['lumber', 'wool', 'grain', 'brick', 'ore'];

export default function ActionBar() {
  const gameState = useGameStore((s) => s.gameState);
  const playerId = useGameStore((s) => s.playerId);
  const pendingAction = useGameStore((s) => s.pendingAction);
  const setPendingAction = useGameStore((s) => s.setPendingAction);
  const clearPendingAction = useGameStore((s) => s.clearPendingAction);

  const setShowTradePanel = useGameStore((s) => s.setShowTradePanel);

  const [showDevCards, setShowDevCards] = useState(false);
  const [monopolyPicking, setMonopolyPicking] = useState(false);
  const [yopPicking, setYopPicking] = useState(false);
  const [yopResources, setYopResources] = useState<ResourceType[]>([]);

  if (!gameState || !playerId) return null;

  const isMyTurn = gameState.activePlayer === playerId;
  const player = gameState.players[playerId];
  if (!player) return null;

  const { phase } = gameState;

  // Robber steal phase
  if (isMyTurn && phase === 'robber-steal') {
    // Find opponents with buildings on robber hex
    const robberHex = gameState.board.hexes[gameState.robberHex];
    const targets = new Set<string>();
    if (robberHex) {
      for (const vKey of robberHex.vertexKeys) {
        const vertex = gameState.board.vertices[vKey];
        if (vertex?.building && vertex.building.playerId !== playerId) {
          targets.add(vertex.building.playerId);
        }
      }
    }

    return (
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="text-sm text-gray-400">Steal from:</span>
        {targets.size > 0 ? (
          Array.from(targets).map((targetId) => {
            const target = gameState.players[targetId];
            return (
              <button
                key={targetId}
                onClick={() => submitAction({ type: 'STEAL_RESOURCE', targetPlayerId: targetId })}
                className="rounded bg-red-600 px-3 py-1 text-sm font-semibold text-white hover:bg-red-500"
              >
                {targetId.startsWith('bot-') ? `Bot ${targetId.split('-')[1]}` : targetId.slice(0, 6)}
              </button>
            );
          })
        ) : (
          <button
            onClick={() => submitAction({ type: 'SKIP_STEAL' })}
            className="rounded bg-gray-600 px-3 py-1 text-sm text-white hover:bg-gray-500"
          >
            No targets - Skip
          </button>
        )}
      </div>
    );
  }

  // Year of plenty resource picking
  if (yopPicking) {
    return (
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="text-sm text-gray-400">Pick {2 - yopResources.length} resource(s):</span>
        {RESOURCES.map((r) => (
          <button
            key={r}
            onClick={() => {
              const next = [...yopResources, r];
              if (next.length >= 2) {
                submitAction({
                  type: 'PLAY_DEV_CARD',
                  card: 'year-of-plenty',
                  yearOfPlentyResources: next.slice(0, 2) as [ResourceType, ResourceType],
                });
                setYopPicking(false);
                setYopResources([]);
              } else {
                setYopResources(next);
              }
            }}
            className="rounded bg-emerald-700 px-2 py-1 text-xs text-white capitalize hover:bg-emerald-600"
          >
            {r}
          </button>
        ))}
        <button
          onClick={() => { setYopPicking(false); setYopResources([]); }}
          className="rounded bg-gray-600 px-2 py-1 text-xs text-white hover:bg-gray-500"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Monopoly resource picking
  if (monopolyPicking) {
    return (
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="text-sm text-gray-400">Pick resource to monopolize:</span>
        {RESOURCES.map((r) => (
          <button
            key={r}
            onClick={() => {
              submitAction({
                type: 'PLAY_DEV_CARD',
                card: 'monopoly',
                monopolyResource: r,
              });
              setMonopolyPicking(false);
            }}
            className="rounded bg-purple-700 px-2 py-1 text-xs text-white capitalize hover:bg-purple-600"
          >
            {r}
          </button>
        ))}
        <button
          onClick={() => setMonopolyPicking(false)}
          className="rounded bg-gray-600 px-2 py-1 text-xs text-white hover:bg-gray-500"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Not my turn
  if (!isMyTurn) {
    return (
      <div className="px-4 py-2">
        <span className="text-sm text-gray-500">Waiting for other player...</span>
      </div>
    );
  }

  // Setup phases
  if (phase === 'setup-forward' || phase === 'setup-reverse') {
    const isPlacingSettlement = gameState.setupPlacementsDone % 2 === 0;
    return (
      <div className="px-4 py-2">
        <span className="text-sm text-gray-300">
          {isPlacingSettlement ? 'Click a highlighted vertex to place your settlement' : 'Click a highlighted edge to place your road'}
        </span>
      </div>
    );
  }

  // Road building phase
  if (phase === 'road-building') {
    return (
      <div className="px-4 py-2">
        <span className="text-sm text-gray-300">
          Place road ({gameState.roadBuildingRoadsLeft} remaining) — click a highlighted edge
        </span>
      </div>
    );
  }

  // Pending action cancel
  if (pendingAction) {
    return (
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="text-sm text-gray-300">
          Click a highlighted spot to place {pendingAction}
        </span>
        <button
          onClick={clearPendingAction}
          className="rounded bg-gray-600 px-2 py-1 text-xs text-white hover:bg-gray-500"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Main action bar
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2">
      {/* Pre-roll: just show Roll button (handled by DiceDisplay) */}
      {phase === 'pre-roll' && (
        <>
          {/* Dev card play before roll */}
          {player.unplayedDevCards.length > 0 && player.devCardsPlayedThisTurn === 0 && (
            <DevCardMenu
              cards={player.unplayedDevCards}
              onPlay={(card) => {
                if (card === 'monopoly') {
                  setMonopolyPicking(true);
                } else if (card === 'year-of-plenty') {
                  setYopPicking(true);
                } else {
                  submitAction({ type: 'PLAY_DEV_CARD', card });
                }
              }}
            />
          )}
        </>
      )}

      {phase === 'post-roll' && (
        <>
          <button
            onClick={() => setPendingAction('settlement')}
            disabled={!canAfford(player.hand, BUILD_COSTS.settlement!)}
            className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Settlement
          </button>
          <button
            onClick={() => setPendingAction('road')}
            disabled={!canAfford(player.hand, BUILD_COSTS.road!)}
            className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Road
          </button>
          <button
            onClick={() => setPendingAction('city')}
            disabled={!canAfford(player.hand, BUILD_COSTS.city!) || player.settlementCount === 0}
            className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            City
          </button>
          <button
            onClick={() => submitAction({ type: 'BUY_DEV_CARD' })}
            disabled={!canAfford(player.hand, BUILD_COSTS['dev-card']!)}
            className="rounded bg-purple-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Dev Card
          </button>

          <button
            onClick={() => setShowTradePanel(true)}
            className="rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-600"
          >
            Trade
          </button>

          {player.unplayedDevCards.length > 0 && player.devCardsPlayedThisTurn === 0 && (
            <DevCardMenu
              cards={player.unplayedDevCards}
              onPlay={(card) => {
                if (card === 'monopoly') {
                  setMonopolyPicking(true);
                } else if (card === 'year-of-plenty') {
                  setYopPicking(true);
                } else {
                  submitAction({ type: 'PLAY_DEV_CARD', card });
                }
              }}
            />
          )}

          <div className="flex-1" />

          <button
            onClick={() => submitAction({ type: 'END_TURN' })}
            className="rounded bg-gray-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-500"
          >
            End Turn
          </button>
        </>
      )}
    </div>
  );
}

function DevCardMenu({
  cards,
  onPlay,
}: {
  cards: DevCardType[];
  onPlay: (card: Exclude<DevCardType, 'victory-point'>) => void;
}) {
  const [open, setOpen] = useState(false);

  const playableCards = cards.filter(
    (c): c is Exclude<DevCardType, 'victory-point'> => c !== 'victory-point',
  );

  if (playableCards.length === 0) return null;

  // Deduplicate
  const uniqueCards = [...new Set(playableCards)];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded bg-purple-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-purple-600"
      >
        Play Card
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-1 rounded bg-gray-800 py-1 shadow-lg ring-1 ring-gray-600">
          {uniqueCards.map((card) => (
            <button
              key={card}
              onClick={() => {
                onPlay(card);
                setOpen(false);
              }}
              className="block w-full px-4 py-1.5 text-left text-sm text-white hover:bg-gray-700"
            >
              {DEV_CARD_LABELS[card] ?? card}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
