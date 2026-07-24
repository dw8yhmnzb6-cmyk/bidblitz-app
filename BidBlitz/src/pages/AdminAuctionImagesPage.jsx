/**
 * BidBlitz V2 - Admin: AI Auction Image Manager
 * Lets admin see all auctions and regenerate any product image with 1 tap.
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw, Loader2, Check, AlertCircle, Image as ImageIcon, Search } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const AdminAuctionImagesPage = ({ onBack }) => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState({});
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [flash, setFlash] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/auction-images/list`, { credentials: "include" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || "Fehler");
      setAuctions(d.auctions || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const regen = async (a) => {
    setRegenerating((r) => ({ ...r, [a.auction_id]: true }));
    try {
      const res = await fetch(`${API}/api/admin/auction-images/regenerate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auction_id: a.auction_id, title: a.title, force: true }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || "Generate fehlgeschlagen");
      // Update locally
      setAuctions((list) => list.map((x) => x.auction_id === a.auction_id
        ? { ...x, image_url: d.image_url + `?t=${Date.now()}` } : x));
      setFlash((f) => ({ ...f, [a.auction_id]: "ok" }));
      setTimeout(() => setFlash((f) => { const n = { ...f }; delete n[a.auction_id]; return n; }), 2500);
    } catch (e) {
      setFlash((f) => ({ ...f, [a.auction_id]: "err:" + e.message }));
      setTimeout(() => setFlash((f) => { const n = { ...f }; delete n[a.auction_id]; return n; }), 4000);
    }
    setRegenerating((r) => { const n = { ...r }; delete n[a.auction_id]; return n; });
  };

  const filtered = auctions.filter((a) => !search || (a.title || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="admin-auction-images-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center gap-3">
          <motion.button data-testid="admin-images-back" whileTap={{ scale: 0.9 }} onClick={onBack}
            className="p-2 rounded-xl bg-white/5 border border-white/10">
            <ArrowLeft size={18} />
          </motion.button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <ImageIcon size={16} className="text-[#A855F7]" />
              <h1 className="text-[15px] font-bold">Auktions-Bilder (AI)</h1>
            </div>
            <p className="text-[10px] text-gray-500">{auctions.length} Produkte · Powered by Gemini Nano Banana</p>
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={load}
            data-testid="admin-images-refresh"
            className="p-2 rounded-xl bg-white/5 border border-white/10">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </motion.button>
        </div>

        {/* Search */}
        <div className="mt-3 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3">
          <Search size={14} className="text-gray-500" />
          <input
            data-testid="admin-images-search"
            placeholder="Nach Produktname suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[13px] py-2 placeholder-gray-600"
          />
        </div>
      </div>

      {error && (
        <div className="m-4 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-[12px] text-red-300">
          <AlertCircle size={14} className="mt-0.5" /><span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-gray-500" size={22} />
        </div>
      )}

      {/* Grid of products */}
      <div className="p-4 grid grid-cols-2 gap-2">
        {filtered.map((a) => {
          const isReg = !!regenerating[a.auction_id];
          const fl = flash[a.auction_id];
          const imgUrl = a.image_url
            ? (a.image_url.startsWith("http") ? a.image_url : a.image_url)
            : null;
          return (
            <div key={a.auction_id}
              data-testid={`auction-card-${a.auction_id}`}
              className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="aspect-[3/2] bg-black/40 relative">
                {imgUrl ? (
                  <img src={imgUrl} alt={a.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.opacity = "0.3"; }}/>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600">
                    <ImageIcon size={28} />
                  </div>
                )}
                {fl === "ok" && (
                  <div className="absolute inset-0 bg-[#00D26A]/30 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-[#00D26A] rounded-full p-2"><Check size={18} className="text-black" /></div>
                  </div>
                )}
                {fl?.startsWith("err") && (
                  <div className="absolute inset-x-0 bottom-0 bg-red-500/80 text-white text-[9px] p-1.5 text-center">
                    {fl.slice(4)}
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-[11px] font-bold text-white truncate" title={a.title}>{a.title}</p>
                <p className="text-[9px] text-gray-500 mt-0.5">€{a.current_price?.toFixed?.(2) || a.starting_price?.toFixed?.(2) || "—"}</p>
                <motion.button whileTap={{ scale: 0.96 }}
                  data-testid={`regen-btn-${a.auction_id}`}
                  onClick={() => regen(a)}
                  disabled={isReg}
                  className="w-full mt-2 py-2 rounded-lg bg-gradient-to-r from-[#A855F7] to-[#06B6D4] text-white text-[11px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {isReg ? <><Loader2 className="animate-spin" size={11} /> Generiere…</>
                         : <><RefreshCw size={11} /> Neu generieren</>}
                </motion.button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500 text-[12px]">
          Keine Treffer.
        </div>
      )}
    </div>
  );
};

export default AdminAuctionImagesPage;
