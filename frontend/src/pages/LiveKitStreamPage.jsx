import { useState, useEffect } from 'react';
import { ArrowLeft, Radio, Play, Plus, Eye, Loader2, Video } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function LiveKitStreamPage({ onBack }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [tokenInfo, setTokenInfo] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/livekit/rooms`, { headers });
      if (res.ok) {
        const d = await res.json();
        setRooms(d.rooms || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async () => {
    if (!roomName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/livekit/rooms`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ room_name: roomName, is_live_shopping: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Fehler beim Erstellen');
      await loadRooms();
      setCreateOpen(false);
      setRoomName('');
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const joinRoom = async (room, asHost = false) => {
    setError('');
    try {
      const res = await fetch(`${API}/api/livekit/token`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          room_name: room.room_name,
          identity: localStorage.getItem('user_id') || `viewer_${Date.now()}`,
          is_publisher: asHost,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Token-Fehler');
      setTokenInfo({ ...data, room_name: room.room_name, asHost });
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="livekit-stream-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="livekit-back">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold flex items-center gap-2">
              <Radio size={18} className="text-rose-400" /> LiveKit Live-Shopping
            </h1>
            <p className="text-[10px] text-rose-400">WebRTC Streaming · Host & Viewer</p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            data-testid="livekit-create-btn"
            className="px-3 py-2 bg-rose-500 rounded-lg text-xs font-bold flex items-center gap-1"
          >
            <Plus size={14} /> Neuer Stream
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400" data-testid="livekit-error">
          {error}
        </div>
      )}

      <div className="px-4 pt-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-16 text-gray-400" data-testid="livekit-empty">
            <Video className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Noch keine Live-Streams aktiv.</p>
            <p className="text-xs mt-1">Erstelle den ersten Stream!</p>
          </div>
        ) : (
          rooms.map((room) => (
            <div
              key={room.room_name}
              data-testid={`livekit-room-${room.room_name}`}
              className="p-4 rounded-2xl bg-white/[0.03] border border-white/5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${room.status === 'live' ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
                  <span className="text-[10px] font-bold text-red-400">
                    {room.status === 'live' ? 'LIVE' : 'OFFLINE'}
                  </span>
                  {room.viewers !== undefined && (
                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Eye size={10} /> {room.viewers}
                    </span>
                  )}
                </div>
                {room.is_live_shopping && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-400">
                    SHOPPING
                  </span>
                )}
              </div>
              <p className="text-sm font-bold mb-1">{room.room_name}</p>
              <p className="text-[10px] text-gray-500 mb-3">Host: {room.creator_id || 'unbekannt'}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => joinRoom(room, false)}
                  data-testid={`livekit-join-${room.room_name}`}
                  className="py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                >
                  <Play size={12} /> Zuschauen
                </button>
                <button
                  onClick={() => joinRoom(room, true)}
                  data-testid={`livekit-host-${room.room_name}`}
                  className="py-2 bg-rose-500 hover:bg-rose-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                >
                  <Video size={12} /> Streamen
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {createOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Neuen Stream erstellen</h3>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Stream-Name (z.B. friday-flash-sale)"
              data-testid="livekit-room-name-input"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setCreateOpen(false)}
                className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg"
              >
                Abbrechen
              </button>
              <button
                onClick={createRoom}
                disabled={creating || !roomName.trim()}
                data-testid="livekit-create-confirm"
                className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 rounded-lg font-bold flex items-center justify-center gap-2"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {tokenInfo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold mb-3">
              {tokenInfo.asHost ? '🎥 Host-Zugang' : '👀 Viewer-Zugang'}: {tokenInfo.room_name}
            </h3>
            <div className="bg-black/40 rounded-lg p-3 mb-4 text-xs font-mono break-all max-h-40 overflow-auto" data-testid="livekit-token">
              <div className="text-gray-400 mb-1">Token:</div>
              <div className="text-green-400">{tokenInfo.token}</div>
              {tokenInfo.url && (
                <>
                  <div className="text-gray-400 mt-2 mb-1">URL:</div>
                  <div className="text-blue-400">{tokenInfo.url}</div>
                </>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Token in LiveKit Client SDK einfügen, um Stream beizutreten. Native iOS/Android via Capacitor LiveKit-Plugin.
            </p>
            <button
              onClick={() => setTokenInfo(null)}
              className="w-full py-2 bg-rose-500 hover:bg-rose-600 rounded-lg font-bold"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
