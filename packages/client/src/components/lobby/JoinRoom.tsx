import { useState } from 'react';
import { joinRoom } from '../../socket/client';
import { useGameStore } from '../../store/gameStore';

export default function JoinRoom() {
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const error = useGameStore((s) => s.error);

  const handleJoin = async () => {
    if (!code.trim() || !displayName.trim()) return;
    setLoading(true);
    useGameStore.setState({ error: null });
    try {
      await joinRoom(code.trim().toUpperCase(), displayName.trim());
    } catch (err) {
      useGameStore.setState({
        error: err instanceof Error ? err.message : 'Failed to join room',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg bg-gray-800 p-6 shadow-lg">
      <h2 className="mb-4 text-xl font-bold text-white">Join Room</h2>
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Room code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-center font-mono text-lg tracking-widest text-white placeholder-gray-400 focus:border-amber-500 focus:outline-none"
          maxLength={4}
        />
        <input
          type="text"
          placeholder="Your name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-amber-500 focus:outline-none"
          maxLength={20}
        />
        <button
          onClick={handleJoin}
          disabled={!code.trim() || !displayName.trim() || loading}
          className="w-full rounded bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Joining...' : 'Join Room'}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
