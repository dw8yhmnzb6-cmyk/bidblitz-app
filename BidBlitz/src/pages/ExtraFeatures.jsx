import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, Trophy, Crown, Medal, Globe, Moon, Sun, X } from "lucide-react";
import { useI18n } from "../store/I18nContext";

const API = process.env.REACT_APP_BACKEND_URL;

// ═══ GLOBAL SEARCH COMPONENT ═══
export const GlobalSearch = ({ onNavigate, onClose }) => {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/api/extras/search?q=${encodeURIComponent(query)}`, { credentials: "include" });
        if (r.ok) { const d = await r.json(); setResults(d.results || []); }
      } catch (error) {
        void error;
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] pt-safe" onClick={onClose}>
      <div className="max-w-md mx-auto px-4 pt-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={t("extras.search_placeholder")}
              className="w-full pl-10 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white text-sm outline-none focus:border-cyan-500/30" data-testid="global-search-input" />
          </div>
          <button onClick={onClose} className="p-2 text-gray-500" data-testid="global-search-close-button"><X size={20} /></button>
        </div>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {results.map((r, i) => (
            <motion.button key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              onClick={() => { onNavigate(r.route); onClose(); }}
              className="w-full p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-3 text-left hover:border-cyan-500/20 transition-all">
              <span className="text-lg">{r.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.title}</p>
                <p className="text-[10px] text-gray-500">{r.subtitle}</p>
              </div>
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">{r.type}</span>
            </motion.button>
          ))}
          {query.length >= 2 && results.length === 0 && (
            <p className="text-center text-gray-600 py-8">{t("common.no_results_for")} &quot;{query}&quot;</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ═══ LEADERBOARD PAGE ═══
export default function LeaderboardPage({ onBack }) {
  const { t } = useI18n();
  const [type, setType] = useState("balance");
  const [data, setData] = useState({ type: "", entries: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`${API}/api/extras/leaderboard?type=${type}`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error("leaderboard_failed");
        return r.json();
      })
      .then((d) => setData({ type: d.type || "", entries: d.entries || [] }))
      .catch(() => {
        setError(true);
        setData({ type: "", entries: [] });
      })
      .finally(() => setLoading(false));
  }, [type]);

  const rankIcon = (r) => r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : `#${r}`;
  const rankColor = (r) => r === 1 ? "#FFD700" : r === 2 ? "#C0C0C0" : r === 3 ? "#CD7F32" : "#6B7280";
  const topThree = data.entries?.slice(0, 3) || [];
  const restEntries = data.entries?.slice(3) || [];
  const typeMeta = {
    balance: { accent: "#FACC15", label: t("leaderboard.wallet_ranking"), hint: t("leaderboard.wallet_hint") },
    gaming: { accent: "#A855F7", label: t("leaderboard.top_gamer"), hint: t("leaderboard.gaming_hint") },
    rating: { accent: "#22C55E", label: t("leaderboard.top_rated"), hint: t("leaderboard.rating_hint") },
  }[type];

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-16" data-testid="leaderboard-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button data-testid="leaderboard-back-button" onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
          <h1 className="text-base font-bold flex items-center gap-2"><Trophy size={18} className="text-yellow-400" /> {t("leaderboard.title")}</h1>
        </div>
        <div className="flex gap-2 mt-3">
          {[
            { id: "balance", label: t("leaderboard.wallet_ranking") },
            { id: "gaming", label: t("leaderboard.top_gamer") },
            { id: "rating", label: t("leaderboard.top_rated") },
          ].map((tab) => (
            <button data-testid={`leaderboard-filter-${tab.id}`} key={tab.id} onClick={() => setType(tab.id)}
              className={`flex-1 py-2 rounded-xl text-[11px] font-bold ${type === tab.id ? "bg-yellow-500 text-black" : "bg-white/5 text-gray-400"}`}>{tab.label}</button>
          ))}
        </div>
      </div>
      <div className="px-4 pt-4 space-y-4" data-testid="leaderboard-content">
        <div
          data-testid="leaderboard-hero-card"
          className="rounded-[28px] border border-white/8 overflow-hidden"
          style={{ background: `radial-gradient(circle at top right, ${typeMeta.accent}22 0%, rgba(255,255,255,0.04) 35%, rgba(255,255,255,0.02) 100%)` }}
        >
          <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/45 font-bold">{t("leaderboard.live_ranking")}</p>
              <h2 data-testid="leaderboard-hero-title" className="text-lg font-black mt-1">{typeMeta.label}</h2>
              <p className="text-xs text-white/60 mt-1 max-w-[240px]">{typeMeta.hint}</p>
            </div>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${typeMeta.accent}22`, color: typeMeta.accent }}>
              <Crown size={20} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 px-3 pb-3">
            {[
              { id: "count", label: t("leaderboard.entries"), value: String(data.entries?.length || 0) },
              { id: "winner", label: t("leaderboard.rank_1"), value: topThree[0]?.name || "—" },
              { id: "mode", label: t("leaderboard.view"), value: typeMeta.label },
            ].map((item) => (
              <div key={item.id} data-testid={`leaderboard-stat-${item.id}`} className="rounded-2xl px-3 py-3 bg-black/20 border border-white/6 min-h-[74px]">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/40 font-bold">{item.label}</p>
                <p className="text-xs font-bold text-white mt-2 break-words">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {loading && (
          <div data-testid="leaderboard-loading-state" className="space-y-2">
            {[1,2,3,4,5].map((row) => (
              <div key={row} className="h-[68px] rounded-2xl bg-white/[0.03] border border-white/6 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div data-testid="leaderboard-error-state" className="rounded-3xl border border-red-500/20 bg-red-500/8 px-4 py-5 text-center">
            <p className="text-sm font-bold text-white">{t("leaderboard.load_failed")}</p>
            <p className="text-xs text-white/60 mt-1">{t("leaderboard.open_again")}</p>
          </div>
        )}

        {!loading && !error && topThree.length > 0 && (
          <div className="grid grid-cols-3 gap-2" data-testid="leaderboard-podium">
            {[topThree[1], topThree[0], topThree[2]].map((entry, index) => {
              if (!entry) {
                return <div key={`empty-${index}`} className="rounded-3xl bg-white/[0.02] border border-white/5 min-h-[148px]" />;
              }
              const realRank = entry.rank;
              const height = realRank === 1 ? "min-h-[176px]" : "min-h-[148px]";
              return (
                <div key={entry.rank} data-testid={`leaderboard-podium-rank-${entry.rank}`} className={`rounded-3xl border flex flex-col justify-end px-3 py-4 ${height}`} style={{ borderColor: `${rankColor(realRank)}33`, background: `${rankColor(realRank)}14` }}>
                  <div className="w-12 h-12 rounded-full mx-auto mb-3 bg-white/10 flex items-center justify-center text-sm font-black">{(entry.name || "?")[0]}</div>
                  <p className="text-center text-lg">{rankIcon(realRank)}</p>
                  <p className="text-xs font-bold text-center mt-2 truncate">{entry.name}</p>
                  {type !== "balance" && entry.value ? <p className="text-[11px] text-center text-white/65 mt-1 break-words">{entry.value}</p> : null}
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && restEntries.map((e, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
            data-testid={`leaderboard-entry-${e.rank}`}
            className="p-3 rounded-2xl flex items-center gap-3 bg-white/[0.02] border border-white/5">
            <span className="text-lg w-8 text-center" style={{ color: rankColor(e.rank) }}>{rankIcon(e.rank)}</span>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">{(e.name || "?")[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{e.name}</p>
              {e.premium && <span className="text-[8px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-bold">VIP</span>}
            </div>
            {type !== "balance" && e.value ? <p className="text-sm font-bold" style={{ color: "#fff" }}>{e.value}</p> : null}
          </motion.div>
        ))}

        {!loading && !error && data.entries?.length === 0 && (
          <div data-testid="leaderboard-empty-state" className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-8 text-center">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 bg-white/5 flex items-center justify-center"><Medal size={24} className="text-white/70" /></div>
            <p className="text-sm font-bold text-white">{t("leaderboard.no_entries")}</p>
            <p className="text-xs text-white/55 mt-1">{t("leaderboard.no_entries_hint")}</p>
          </div>
        )}

        {!loading && !error && data.entries?.length > 0 && (
          <div data-testid="leaderboard-footer-note" className="rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3">
            <p className="text-[11px] font-bold text-white/80">{t("leaderboard.live_updated")}</p>
            <p className="text-[11px] text-white/50 mt-1">{t("leaderboard.live_updated_hint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ ONBOARDING TOUR ═══
export const OnboardingTour = ({ onComplete }) => {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const steps = [
    { icon: "👋", title: t("onboarding.welcome_title"), desc: t("onboarding.welcome_desc"), bg: "from-cyan-500/20 to-blue-500/20" },
    { icon: "💰", title: t("onboarding.wallet_title"), desc: t("onboarding.wallet_desc"), bg: "from-green-500/20 to-emerald-500/20" },
    { icon: "💼", title: t("onboarding.earn_title"), desc: t("onboarding.earn_desc"), bg: "from-yellow-500/20 to-orange-500/20" },
    { icon: "🎮", title: t("onboarding.gaming_title"), desc: t("onboarding.gaming_desc"), bg: "from-purple-500/20 to-pink-500/20" },
  ];
  const s = steps[step];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-[#0A0A0F] z-[200] flex flex-col items-center justify-center px-8">
      <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-sm">
        <div className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${s.bg} flex items-center justify-center mx-auto mb-8`}>
          <span className="text-5xl">{s.icon}</span>
        </div>
        <h2 className="text-2xl font-black text-white mb-3">{s.title}</h2>
        <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
      </motion.div>
      <div className="flex gap-2 mt-8">
        {steps.map((_, i) => <div key={i} className={`w-2 h-2 rounded-full ${i === step ? "bg-cyan-500" : "bg-white/20"}`} />)}
      </div>
      <div className="mt-8 w-full max-w-sm">
        {step < steps.length - 1 ? (
          <button onClick={() => setStep(step + 1)} className="w-full py-4 bg-cyan-500 rounded-2xl font-bold text-black">{t("common.continue")}</button>
        ) : (
          <button onClick={onComplete} className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl font-bold text-black" data-testid="onboarding-done">{t("onboarding.lets_go")}</button>
        )}
        {step < steps.length - 1 && (
          <button onClick={onComplete} className="w-full py-3 text-gray-500 text-sm mt-2">{t("common.skip")}</button>
        )}
      </div>
    </motion.div>
  );
};
