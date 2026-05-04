import { useState, useEffect } from 'react';
import { ArrowLeft, Radio, Play, Plus, Eye, Loader2, Video, Mic, MicOff, VideoOff, PhoneOff } from 'lucide-react';
import { useLiveKitRoom } from '../hooks/useLiveKitRoom';
import { ParticipantTile } from '../components/livekit/ParticipantTile';

const API = process.env.REACT_APP_BACKEND_URL;

export default function LiveKitStreamPage({ onBack }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [activeRoomLabel, setActiveRoomLabel] = useState('');

  const {
    status: lkStatus,
    error: lkError,
    participants,
    cameraOn,
    micOn,
    connect,
    disconnect,
    toggleCamera,
    toggleMic,
  } = useLiveKitRoom();

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  };

  const loadRooms = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/livekit/rooms`, { headers, credentials: 'include' });
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

  // Initial load
  useEffect(() => {
    loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const safeJson = async (res) => {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return { detail: text || `HTTP ${res.status}` };
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
        credentials: 'include',
        body: JSON.stringify({ room_name: roomName, is_live_shopping: true }),
      });
      const data = await safeJson(res);
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

  const joinRoom = async (room, asPublisher = false) => {
    setError('');
    try {
      const res = await fetch(`${API}/api/livekit/token`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          room_name: room.room_name,
          identity: localStorage.getItem('user_id') || `viewer_${Date.now()}`,
          is_publisher: asPublisher,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.detail || 'Token-Fehler');

      const url = data.url || data.server_url;
      const token = data.token || data.participant_token;

      if (!url || url.includes('localhost')) {
        setError('LiveKit-Server nicht konfiguriert. Bitte LIVEKIT_URL in backend/.env setzen.');
        return;
      }

      setActiveRoomLabel(`${room.room_name} (${asPublisher ? 'Host' : 'Viewer'})`);
      await connect({ url, token, asPublisher });
    } catch (e) {
      setError(e.message);
    }
  };

  const leaveRoom = async () => {
    await disconnect();
    setActiveRoomLabel('');
  };

  // Connected state — show video grid
  if (lkStatus === 'connected' || lkStatus === 'reconnecting') {
    return (
      <div className="min-h-screen bg-black text-white" data-testid="livekit-active-room">
        <div className="sticky top-0 z-20 bg-black/90 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold flex items-center gap-2">
              <Radio size={18} className="text-rose-400 animate-pulse" />
              {activeRoomLabel}
            </h1>
            <p className="text-[10px] text-gray-400">{participants.length} Teilnehmer · {lkStatus}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMic}
              data-testid="livekit-toggle-mic"
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                micOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {micOn ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
            <button
              onClick={toggleCamera}
              data-testid="livekit-toggle-camera"
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                cameraOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
            </button>
            <button
              onClick={leaveRoom}
              data-testid="livekit-leave-btn"
              className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center"
            >
              <PhoneOff size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {participants.map((p) => (
            <ParticipantTile
              key={p.identity}
              participant={p.participant}
              isLocal={p.isLocal}
              label={p.identity}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="livekit-stream-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"
            data-testid="livekit-back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold flex items-center gap-2">
              <Radio size={18} className="text-rose-400" /> LiveKit Live-Shopping
            </h1>
            <p className="text-[10px] text-rose-400">WebRTC · Host & Viewer · Capacitor-ready</p>
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

      {(error || lkError) && (
        <div className="mx-4 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400" data-testid="livekit-error">
          {error || lkError}
        </div>
      )}

      <div className="px-4 pt-4 space-y-3" data-testid="livekit-list">
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
                  <span className={`w-2 h-2 rounded-full ${room.status === 'active' ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
                  <span className="text-[10px] font-bold text-red-400">
                    {room.status === 'active' ? 'LIVE' : 'OFFLINE'}
                  </span>
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
    </div>
  );
}
