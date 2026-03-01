import { useGameStore } from '../store/gameStore';
import CreateRoom from '../components/lobby/CreateRoom';
import JoinRoom from '../components/lobby/JoinRoom';
import WaitingRoom from '../components/lobby/WaitingRoom';

export default function LobbyPage() {
  const roomCode = useGameStore((s) => s.roomCode);

  if (roomCode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <WaitingRoom />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-4">
      <h1 className="mb-8 text-5xl font-bold text-amber-400">Catan</h1>
      <div className="grid w-full max-w-2xl gap-6 md:grid-cols-2">
        <CreateRoom />
        <JoinRoom />
      </div>
    </div>
  );
}
