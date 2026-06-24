import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Gavel, Clock, TrendingUp, Plus, Users, Loader2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function LiveAuctionsPage({ onBack, onNavigate, routeParams = {} }) {
  const [auctions, setAuctions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [bidAmount, setBidAmount] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const [now, setNow] = useState(Date.now());

  const loadAuctions = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/live-auctions/active`, { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setAuctions(d.auctions || []);
      }
    } catch (error) {
      void error;
    }
  }, []);

  useEffect(() => { loadAuctions(); timerRef.current = setInterval(() => { setNow(Date.now()); loadAuctions(); }, 5000); return () => clearInterval(timerRef.current); }, [loadAuctions]);

  useEffect(() => {
    const openAuction = async () => {
      if (!routeParams?.auction_id || selected?.auction_id === routeParams.auction_id) return;
      const cached = auctions.find((item) => item.auction_id === routeParams.auction_id);
      if (cached) {
        setSelected(cached);
        setBidAmount(String((cached.current_price + 1).toFixed(2)));
        return;
      }
      try {
        const r = await fetch(`${API}/api/live-auctions/auction/${routeParams.auction_id}`, { credentials: "include" });
        if (r.ok) {
          const data = await r.json();
          setSelected(data);
          setBidAmount(String(((data.current_price || data.start_price || 0) + 1).toFixed(2)));
        }
      } catch (error) {
        void error;
      }
    };
    openAuction();
  }, [auctions, routeParams?.auction_id, selected?.auction_id]);

  const closeSelected = () => {
    setSelected(null);
    if (routeParams?.auction_id && onNavigate) {
      onNavigate("/live-auctions");
    }
  };

  const bid = async () => {
    if (!selected || !bidAmount) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/live-auctions/bid`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auction_id: selected.auction_id, amount: parseFloat(bidAmount) }) });
      const d = await r.json();
      if (r.ok) { setMsg("Gebot abgegeben!"); setBidAmount(""); loadAuctions(); }
      else setMsg(d.detail || "Fehler");
    } catch { setMsg("Netzwerkfehler"); }
    setLoading(false);
    setTimeout(() => setMsg(""), 3000);
  };

  const remaining = (endsAt) => {
    const diff = new Date(endsAt).getTime() - now;
    if (diff <= 0) return "BEENDET";
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
  };

  const isHot = (endsAt) => (new Date(endsAt).getTime() - now) < 60000;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="live-auctions-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
        <div className="flex-1"><h1 className="text-base font-bold flex items-center gap-2"><Gavel size={18} className="text-red-400" />Live Auktionen</h1><p className="text-[10px] text-red-400">{auctions.length} aktiv</p></div>
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      </div>

      <div className="px-4 pt-4 space-y-3">
        {auctions.map((a, i) => {
          const hot = isHot(a.ends_at);
          return (
            <motion.div key={a.auction_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              onClick={() => { setSelected(a); setBidAmount(String((a.current_price + 1).toFixed(2))); }}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${hot ? "bg-red-500/5 border-red-500/20 animate-pulse" : "bg-white/[0.03] border-white/5 hover:border-red-500/20"}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold flex-1 truncate">{a.title}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${hot ? "bg-red-500 text-white" : "bg-white/10 text-gray-400"}`}>
                  <Clock size={10} className="inline mr-0.5" />{remaining(a.ends_at)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-500">Aktuelles Gebot</p>
                  <p className="text-xl font-black text-red-400">€{a.current_price?.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500">{a.bid_count} Gebote</p>
                  <p className="text-[10px] text-gray-400">{a.category}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
        {auctions.length === 0 && <p className="text-center text-gray-500 py-8">Keine aktiven Auktionen</p>}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end" onClick={closeSelected}>
            <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} className="w-full bg-[#111] rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold">{selected.title}</h2>
                <span className={`text-sm px-3 py-1 rounded-full font-mono font-bold ${isHot(selected.ends_at) ? "bg-red-500 text-white animate-pulse" : "bg-white/10 text-gray-400"}`}>{remaining(selected.ends_at)}</span>
              </div>
              <p className="text-4xl font-black text-red-400 mb-1">€{selected.current_price?.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mb-4">{selected.bid_count} Gebote · Start: €{selected.start_price?.toFixed(2)} · {selected.category}</p>
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                  <input value={bidAmount} onChange={e => setBidAmount(e.target.value)} type="number"
                    className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-lg font-bold outline-none focus:border-red-500/30" />
                </div>
                <button onClick={bid} disabled={loading} className="px-8 py-3 bg-red-500 rounded-xl font-bold text-white disabled:opacity-50" data-testid="bid-btn">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : "BIETEN"}
                </button>
              </div>
              <p className="text-[9px] text-gray-600 text-center">10% Plattform-Gebühr · Wallet-Zahlung · Timer verlängert sich bei Last-Second-Geboten</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm text-center font-medium z-50">{msg}</div>}
    </div>
  );
}
