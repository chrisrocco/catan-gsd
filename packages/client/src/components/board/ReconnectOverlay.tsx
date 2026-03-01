import { useGameStore } from '../../store/gameStore';

export default function ReconnectOverlay() {
  const isReconnecting = useGameStore((s) => s.isReconnecting);

  if (!isReconnecting) return null;

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div className="flex flex-col items-center gap-3">
        {/* CSS spinner */}
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-gray-400 border-t-amber-400"
        />
        <p className="text-lg font-medium text-white">Reconnecting...</p>
      </div>
    </div>
  );
}
