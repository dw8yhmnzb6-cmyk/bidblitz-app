import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Heart, Eye, Play, ArrowLeft, Send, X, Plus, Users, Video } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function LivePage({ onNavigate }) {
  const [view, setView] = useState('list');
  const [streams, setStreams] = useState([]);
  const [active, setActive] = useState(null);
  const [reactions, setReactions] = useState(0);
  const [creating, setCreating] = useState(false);
  const [newStream, setNewStream] = useState({ title: '', description: '', category: 'marketplace', product_ids: [] });

  useEffect(() => { loadActive(); const iv = setInterval(loadActive, 8000); return () => clearInterval(iv); /* eslint-disable-next-line */ }, []);

  const loadActive = async () => {
    try {
      const r = await fetch(`${API}/api/live/active`);
      if (r.ok) setStreams((await r.json()).streams || []);
    } catch {}
  };

  const joinStream = async (s) => {
    try {
      const r = await fetch(`${API}/api/live/join/${s.stream_id}`, { method: 'POST', credentials: 'include' });
      if (r.ok) { setActive(await r.json()); setView('watch'); }
    } catch {}
  };

  const leaveStream = async () => {
    if (!active) return;
    try { await fetch(`${API}/api/live/leave/${active.stream_id}`, { method: 'POST', credentials: 'include' }); } catch {}
    setActive(null); setView('list');
  };

  const sendReaction = async () => {
    if (!active) return;
    setReactions((p) => p + 1);
    try { await fetch(`${API}/api/live/${active.stream_id}/react`, { method: 'POST', credentials: 'include' }); } catch {}
  };

  const createAndStart = async () => {
    if (!newStream.title || newStream.title.length < 3) return;
    setCreating(true);
    try {
      const r = await fetch(`${API}/api/live/create`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStream),
      });
      if (!r.ok) throw new Error('create failed');
      const s = await r.json();
      const r2 = await fetch(`${API}/api/live/start/${s.stream_id}`, { method: 'POST', credentials: 'include' });
      if (r2.ok) {
        const started = await r2.json();
        setActive({ ...s, ...started, is_host: true });
        setView('host');
      }
    } catch {}
    setCreating(false);
  };

  const endStream = async () => {
    if (!active) return;
    try { await fetch(`${API}/api/live/end/${active.stream_id}`, { method: 'POST', credentials: 'include' }); } catch {}
    setActive(null); setView('list'); loadActive();
  };

  return (
    <div className="min-h-screen bg-black text-white" data-testid="live-page">
      <AnimatePresence mode="wait">
        {view === 'list' && (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-xl border-b border-white/5">
              <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
                <button data-testid="live-back-btn" onClick={() => onNavigate && onNavigate('/more')} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
                  <ArrowLeft size={16} />
                </button>
                <h1 className="text-lg font-bold flex items-center gap-2">
                  <Radio size={16} className="text-red-500 animate-pulse" /> Live
                </h1>
                <button data-testid="live-create-btn" onClick={() => setView('create')} className="ml-auto px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold flex items-center gap-1">
                  <Plus size={12} /> Streamen
                </button>
              </div>
            </div>

            <div className="max-w-md mx-auto px-4 py-6">
              {streams.length === 0 ? (
                <div className="py-16 text-center">
                  <Video size={40} className="mx-auto mb-4 text-white/10" />
                  <p className="text-sm text-white/40">Aktuell keine Live-Streams</p>
                  <p className="text-xs text-white/20 mt-1">Sei der Erste und starte einen Stream!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {streams.map((s) => (
                    <motion.button key={s.stream_id} data-testid={`live-card-${s.stream_id}`}
                      onClick={() => joinStream(s)}
                      className="relative rounded-2xl overflow-hidden bg-[#111] border border-white/10 text-left aspect-[3/4]"
                      whileTap={{ scale: 0.96 }}>
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-600/30 to-pink-600/30" />
                      {s.cover_image && <img src={s.cover_image} alt={s.title} className="absolute inset-0 w-full h-full object-cover" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />

                      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-[9px] font-black">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        LIVE
                      </div>
                      <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 text-[10px] font-bold">
                        <Eye size={9} /> {s.viewer_count}
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-sm font-bold line-clamp-2">{s.title}</p>
                        <p className="text-[10px] text-white/50 mt-1">@{s.host_handle || s.host_name}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {view === 'watch' && active && (
          <motion.div key="watch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative min-h-screen">
            {/* Video placeholder — real provider plugs here */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-black to-pink-900">
              {active.cover_image && <img src={active.cover_image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Video size={64} className="mx-auto mb-4 text-white/20 animate-pulse" />
                  <p className="text-xs text-white/30">Video-Stream wird geladen...</p>
                  <p className="text-[9px] text-white/15 mt-1">Room: {active.stream_id.slice(0, 8)}</p>
                </div>
              </div>
            </div>

            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center gap-3 z-10">
              <button data-testid="live-leave-btn" onClick={leaveStream} className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-md">
                <X size={18} />
              </button>
              <div className="flex-1">
                <p className="text-sm font-bold line-clamp-1">{active.title}</p>
                <p className="text-[10px] text-white/50">@{active.host_handle || active.host_name}</p>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500 text-[10px] font-black">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />LIVE
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur-md text-[10px] font-bold">
                <Eye size={10} /> {active.viewer_count}
              </div>
            </div>

            {/* Reactions rise animation */}
            <div className="absolute bottom-32 right-4 pointer-events-none z-10">
              <AnimatePresence>
                {Array.from({ length: Math.min(reactions, 12) }).map((_, i) => (
                  <motion.div key={`r-${reactions}-${i}`} initial={{ y: 0, opacity: 1, scale: 1 }}
                    animate={{ y: -120, opacity: 0, scale: 1.5 }} transition={{ duration: 2 }} className="absolute right-0 text-2xl">
                    ❤️
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Bottom controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/70 to-transparent z-10">
              <div className="flex items-center gap-2">
                <input data-testid="live-chat-input" placeholder="Kommentar..." className="flex-1 px-4 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-sm outline-none" />
                <button data-testid="live-react-btn" onClick={sendReaction} className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                  <Heart size={18} className="text-red-400" fill="#f87171" />
                </button>
                <button className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                  <Send size={16} className="text-white/60" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'host' && active && (
          <motion.div key="host" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative min-h-screen">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-black to-blue-900 flex items-center justify-center">
              <div className="text-center">
                <Radio size={64} className="mx-auto mb-4 text-red-500 animate-pulse" />
                <p className="text-lg font-black">Du streamst jetzt LIVE</p>
                <p className="text-xs text-white/40 mt-2">Kamera wird per Provider-SDK eingebunden (Agora/Mux/LiveKit)</p>
                <p className="text-[9px] text-white/20 mt-1 font-mono">Room-Key: {active.room_key}</p>
              </div>
            </div>
            <div className="absolute top-4 left-4 flex items-center gap-1 px-3 py-1 rounded-full bg-red-500 text-xs font-black z-10">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />LIVE
            </div>
            <div className="absolute top-4 right-4 flex items-center gap-1 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-xs font-bold z-10">
              <Users size={12} /> {active.viewer_count || 0}
            </div>
            <button data-testid="live-host-end-btn" onClick={endStream} className="absolute bottom-8 left-4 right-4 max-w-md mx-auto py-3 rounded-xl bg-red-500 font-bold z-10">
              Stream beenden
            </button>
          </motion.div>
        )}

        {view === 'create' && (
          <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-xl border-b border-white/5">
              <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
                <button data-testid="live-create-back" onClick={() => setView('list')} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
                  <ArrowLeft size={16} />
                </button>
                <h1 className="text-lg font-bold">Stream starten</h1>
              </div>
            </div>

            <div className="max-w-md mx-auto px-4 py-6 space-y-4">
              <div>
                <label className="text-xs text-white/40 uppercase tracking-widest font-bold">Titel</label>
                <input data-testid="live-title-input" value={newStream.title} onChange={(e) => setNewStream({ ...newStream, title: e.target.value })}
                  placeholder="z.B. Flash Deal: Sneaker Drop"
                  className="mt-2 w-full px-3 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-red-500/30" />
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase tracking-widest font-bold">Beschreibung</label>
                <textarea data-testid="live-desc-input" value={newStream.description} onChange={(e) => setNewStream({ ...newStream, description: e.target.value })}
                  placeholder="Was zeigst du?" rows={3}
                  className="mt-2 w-full px-3 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-red-500/30 resize-none" />
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase tracking-widest font-bold">Kategorie</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {['marketplace', 'auction', 'general'].map((c) => (
                    <button key={c} data-testid={`live-cat-${c}`} onClick={() => setNewStream({ ...newStream, category: c })}
                      className={`py-2 rounded-lg text-xs font-bold ${newStream.category === c ? 'bg-red-500 text-white' : 'bg-white/5 text-white/60'}`}>
                      {c === 'marketplace' ? 'Marketplace' : c === 'auction' ? 'Auktion' : 'Allgemein'}
                    </button>
                  ))}
                </div>
              </div>
              <button data-testid="live-create-start-btn" onClick={createAndStart} disabled={!newStream.title || creating}
                className="w-full py-4 rounded-xl bg-red-500 font-bold flex items-center justify-center gap-2 disabled:opacity-30">
                {creating ? <Radio size={18} className="animate-pulse" /> : <Play size={18} />}
                {creating ? 'Starte...' : 'Jetzt LIVE gehen'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
