import { useEffect } from 'react';

/**
 * LEGACY redirect: The old mock /api/live-shopping/* page is replaced
 * by the new LiveKit-powered /livekit-stream page (real WebRTC streaming).
 * This component just navigates the user there.
 */
export default function LiveShoppingPage({ onBack }) {
  useEffect(() => {
    window.location.replace('/livekit-stream');
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center text-white" data-testid="live-shopping-redirect">
      <div className="text-center">
        <p className="text-sm text-gray-400">Weiterleitung zu Live-Shopping (LiveKit)…</p>
        <button
          onClick={() => window.location.replace('/livekit-stream')}
          className="mt-3 px-4 py-2 bg-rose-500 rounded-lg text-xs font-bold"
        >
          Jetzt öffnen
        </button>
      </div>
    </div>
  );
}
