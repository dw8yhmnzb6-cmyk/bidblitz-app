import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, X } from "lucide-react";
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
        if (r.ok) { const d = await r.json(); setResults((d.results || []).filter(result => !/^\/leaderboard(?:[/?#]|$)/.test(result.route || ""))); }
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
