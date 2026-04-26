/**
 * SmartRecommendations - Personalized AI-driven suggestions on Home page
 */
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Sparkles, RefreshCw, ChevronRight, Loader2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const CATEGORY_ICONS = {
  lottery: "🎰",
  auction: "🔨",
  restaurant: "🍽️",
  hotel: "🏨",
  taxi: "🚕",
  telemedizin: "🩺",
  handwerker: "🔧",
  freelancer: "💼",
  streaming: "📺",
  mining: "⛏️",
  premium: "👑",
  ad_campaign: "📢",
  general: "✨",
};

const CATEGORY_NAV = {
  lottery: "/lottery",
  auction: "/auctions",
  restaurant: "/directory",
  hotel: "/directory",
  taxi: "/taxi",
  telemedizin: "/telemedizin",
  handwerker: "/handwerker",
  freelancer: "/freelancer",
  streaming: "/streaming",
  mining: "/mining",
  premium: "/premium",
  ad_campaign: "/ads",
};

export default function SmartRecommendations({ onNavigate }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const r = await fetch(`${API}/api/ai/recommendations?limit=4`, { credentials: "include" });
      const j = await r.json();
      if (r.ok && Array.isArray(j.items)) {
        setItems(j.items);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const click = (item) => {
    const path = CATEGORY_NAV[item.category] || "/more";
    if (onNavigate) onNavigate(path);
  };

  if (loading) {
    return (
      <div data-testid="recommendations-loading" className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-4 flex items-center justify-center min-h-[120px]">
        <Loader2 size={18} className="animate-spin text-purple-400" />
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <div data-testid="recommendations-section" className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-purple-400" />
          <h2 className="text-[12px] font-black text-white uppercase tracking-wider">
            Für dich empfohlen
          </h2>
        </div>
        <button
          data-testid="recommendations-refresh"
          onClick={() => load(true)}
          disabled={refreshing}
          className="w-7 h-7 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
          aria-label="Empfehlungen aktualisieren"
        >
          <RefreshCw size={11} className={`text-white/60 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="space-y-2">
        {items.map((it, i) => (
          <motion.button
            key={i}
            data-testid={`recommendation-${i}`}
            onClick={() => click(it)}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="w-full text-left rounded-2xl p-3.5 flex items-start gap-3"
            style={{
              background: "linear-gradient(135deg, rgba(168,85,247,0.08), rgba(236,72,153,0.04))",
              border: "1px solid rgba(168,85,247,0.18)",
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center text-[20px] flex-shrink-0">
              {CATEGORY_ICONS[it.category] || CATEGORY_ICONS.general}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-white leading-tight line-clamp-1">
                {it.title}
              </p>
              <p className="text-[11px] text-white/60 leading-snug mt-0.5 line-clamp-2">
                {it.description}
              </p>
              <p className="text-[10px] text-purple-300/80 mt-1.5 italic line-clamp-1">
                {it.reason}
              </p>
            </div>
            <div className="flex-shrink-0 self-center">
              <div className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-1"
                   style={{ background: "linear-gradient(135deg,#A855F7,#EC4899)" }}>
                {it.cta}
                <ChevronRight size={10} />
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
