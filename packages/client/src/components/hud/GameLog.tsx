import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { GameEvent } from '@catan/game-engine';

function formatEvent(event: GameEvent, getPlayerName: (id: string) => string): string {
  switch (event.type) {
    case 'DICE_ROLLED':
      return `Rolled ${event.roll} (${event.individual[0]}+${event.individual[1]})`;
    case 'RESOURCES_DISTRIBUTED':
      return 'Resources distributed';
    case 'ROBBER_ACTIVATED':
      return `Robber! ${event.playersDiscarding.length} player(s) must discard`;
    case 'RESOURCE_STOLEN':
      return `${getPlayerName(event.byPlayer)} stole from ${getPlayerName(event.fromPlayer)}`;
    case 'SETTLEMENT_PLACED':
      return `${getPlayerName(event.playerId)} placed a settlement`;
    case 'CITY_PLACED':
      return `${getPlayerName(event.playerId)} upgraded to city`;
    case 'ROAD_PLACED':
      return `${getPlayerName(event.playerId)} built a road`;
    case 'TRADE_COMPLETED':
      return `${getPlayerName(event.playerId)} traded ${event.gaveAmount} ${event.gave} for ${event.receivedAmount} ${event.received}`;
    case 'LONGEST_ROAD_AWARDED':
      return `${getPlayerName(event.playerId)} took Longest Road (${event.length})`;
    case 'LARGEST_ARMY_AWARDED':
      return `${getPlayerName(event.playerId)} took Largest Army (${event.count})`;
    case 'GAME_WON':
      return `${getPlayerName(event.playerId)} wins with ${event.finalVP} VP!`;
    case 'DEV_CARD_DRAWN':
      return `${getPlayerName(event.playerId)} bought a dev card`;
    case 'MONOPOLY_COLLECTED':
      return `${getPlayerName(event.playerId)} monopolized ${event.resource} (took ${event.totalTaken})`;
    case 'YEAR_OF_PLENTY_GRANTED':
      return `${getPlayerName(event.playerId)} took ${event.resources.join(' + ')}`;
    default:
      return (event as { type: string }).type;
  }
}

export default function GameLog() {
  const [collapsed, setCollapsed] = useState(false);
  const gameLog = useGameStore((s) => s.gameLog);
  const lobbyState = useGameStore((s) => s.lobbyState);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [gameLog.length]);

  const getPlayerName = (pid: string): string => {
    const lobbyPlayer = lobbyState?.players.find((p) => p.playerId === pid);
    if (lobbyPlayer) return lobbyPlayer.displayName;
    return pid.startsWith('bot-') ? `Bot ${pid.split('-')[1]}` : pid.slice(0, 6);
  };

  const recentLog = gameLog.slice(-50);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex h-full w-8 items-center justify-center bg-gray-800/90 text-xs text-gray-400 hover:bg-gray-700"
        style={{ writingMode: 'vertical-rl' }}
      >
        Log
      </button>
    );
  }

  return (
    <div className="flex h-full w-60 flex-col bg-gray-800/90">
      <div className="flex items-center justify-between border-b border-gray-700 px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Game Log
        </h3>
        <button
          onClick={() => setCollapsed(true)}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          Hide
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
        {recentLog.map((event, i) => (
          <p key={i} className="mb-1 text-xs text-gray-400">
            {formatEvent(event, getPlayerName)}
          </p>
        ))}
        {recentLog.length === 0 && (
          <p className="text-xs text-gray-600">No events yet...</p>
        )}
      </div>
    </div>
  );
}
