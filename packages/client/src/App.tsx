import { useGameStore } from './store/gameStore';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';

export default function App() {
  const gameState = useGameStore((s) => s.gameState);

  if (gameState) {
    return <GamePage />;
  }

  return <LobbyPage />;
}
