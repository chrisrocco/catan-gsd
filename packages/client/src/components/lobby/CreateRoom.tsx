import { useState } from 'react';
import { createRoom, joinRoom } from '../../socket/client';
import { useGameStore } from '../../store/gameStore';

export default function CreateRoom() {
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const error = useGameStore((s) => s.error);

  const handleCreate = async () => {
    if (!displayName.trim()) return;
    setLoading(true);
    useGameStore.setState({ error: null });
    try {
      const code = await createRoom();
      await joinRoom(code, displayName.trim());
      useGameStore.setState({ isHost: true });
    } catch (err) {
      useGameStore.setState({
        error: err instanceof Error ? err.message : 'Failed to create room',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg bg-gray-800 p-6 shadow-lg">
      <h2 className="mb-4 text-xl font-bold text-white">Create Room</h2>
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Your name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-amber-500 focus:outline-none"
          maxLength={20}
        />
        <button
          onClick={handleCreate}
          disabled={!displayName.trim() || loading}
          className="w-full rounded bg-amber-600 px-4 py-2 font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Room'}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
