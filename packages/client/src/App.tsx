import { useEffect, useState } from 'react';
import { useGameStore } from './store/gameStore';
import { attemptAutoRejoin } from './socket/client';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';

export default function App() {
  const gameState = useGameStore((s) => s.gameState);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // On mount, attempt to rejoin an existing game session
    attemptAutoRejoin().finally(() => {
      setInitializing(false);
    });
  }, []);

  if (initializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (gameState) {
    return <GamePage />;
  }

  return <LobbyPage />;
}
