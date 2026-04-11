import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Coins, Gift, Trophy, Star, Medal, Crown, Gem,
  TrendingUp, Wallet, Car, Bike, UtensilsCrossed, Store,
  ShoppingBag, Gavel, Cpu, CreditCard, ChevronRight, Loader2, History
} from "lucide-react";
import { useI18n } from "../store/I18nContext";

const API = process.env.REACT_APP_BACKEND_URL || "";

const glass = "backdrop-blur-xl";
const panelBg = "rgba(8,12,20,0.7)";
const panelBorder = "1px solid rgba(255,255,255,0.04)";

const LEVEL_ICONS = {
  bronze: Medal,
  silver: Medal,
  gold: Crown,
  platinum: Gem,
  vip: Star,
};

const LEVEL_COLORS = {
  bronze: "#CD7F32",
  silver: "#C0C0C0",
  gold: "#FFD700",
  platinum: "#E5E4E2",
  vip: "#8B00FF",
};

const SOURCE_ICONS = {
  taxi_payment: Car,
  scooter_payment: Bike,
  food_payment: UtensilsCrossed,
  merchant_payment: Store,
  marketplace_payment: ShoppingBag,
  auction_payment: Gavel,
  mining_payment: Cpu,
  subscription_payment: CreditCard,
};

const SOURCE_NAMES = {
  taxi_payment: "Taxi",
  scooter_payment: "Scooter",
  food_payment: "Food",
  merchant_payment: "Händler",
  marketplace_payment: "Marketplace",
  auction_payment: "Auktion",
  mining_payment: "Mining",
  subscription_payment: "Abo",
};

const LoyaltyPage = ({ onBack, onNavigate }) => {
  const { t } = useI18n();
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState(null);
  const [stats, setStats] = useState(null);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, historyRes, statsRes, levelsRes] = await Promise.all([
        fetch(`${API}/api/loyalty/status`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API}/api/loyalty/history?limit=30`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API}/api/loyalty/stats`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API}/api/loyalty/levels`).then(r => r.json()),
      ]);
      setStatus(statusRes);
      setHistory(historyRes);
      setStats(statsRes);
      setLevels(levelsRes.levels || []);
    } catch (err) {
      console.error("Loyalty fetch error:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#040610" }}>
        <Loader2 size={24} className="text-white/20 animate-spin" />
      </div>
    );
  }

  const LevelIcon = LEVEL_ICONS[status?.level] || Medal;
  const levelColor = LEVEL_COLORS[status?.level] || "#CD7F32";
  const progress = status?.progress || {};

  return (
    <motion.div
      data-testid="loyalty-page"
      className="min-h-screen pb-24"
      style={{ background: "#040610" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-30 backdrop-blur-xl"
        style={{ background: "rgba(4,6,16,0.85)", borderBottom: panelBorder }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <motion.button
            data-testid="loyalty-back"
            onClick={onBack}
            whileTap={{ scale: 0.9 }}
            className="w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center"
          >
            <ArrowLeft size={15} className="text-white/40" />
          </motion.button>
          <div className="flex-1">
            <h1 className="text-[15px] font-bold text-white/90 font-outfit">
              {t("loyalty.title") || "Coins & Cashback"}
            </h1>
            <p className="text-[9px] text-white/25">
              {t("loyalty.subtitle") || "Verdiene mit jeder Transaktion"}
            </p>
          </div>
          <div
            className="px-3 py-1.5 rounded-full flex items-center gap-1.5"
            style={{ background: `${levelColor}15`, border: `1px solid ${levelColor}30` }}
          >
            <LevelIcon size={12} style={{ color: levelColor }} />
            <span className="text-[10px] font-bold" style={{ color: levelColor }}>
              {status?.level_name || "Bronze"}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {/* Coins Balance Card */}
        <motion.div
          className={`rounded-2xl p-5 ${glass}`}
          style={{
            background: "linear-gradient(135deg, rgba(255,215,0,0.08) 0%, rgba(8,12,20,0.9) 100%)",
            border: "1px solid rgba(255,215,0,0.15)",
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] text-white/40 uppercase tracking-widest font-semibold mb-1">
                {t("loyalty.coins_balance") || "Coins Balance"}
              </p>
              <div className="flex items-baseline gap-2">
                <Coins size={24} className="text-[#FFD700]" />
                <span className="text-[36px] font-black text-[#FFD700] font-mono">
                  {status?.coins_balance?.toLocaleString() || 0}
                </span>
              </div>
              <p className="text-[10px] text-white/30 mt-1">
                {t("loyalty.total_earned") || "Total verdient"}: {status?.total_coins_earned?.toLocaleString() || 0}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-white/40 uppercase tracking-widest font-semibold mb-1">
                {t("loyalty.cashback") || "Cashback"}
              </p>
              <p className="text-[28px] font-black text-[#00E89D] font-mono">
                €{(status?.total_cashback_earned || 0).toFixed(2)}
              </p>
              <p className="text-[10px] text-white/30 mt-1">
                {t("loyalty.credited_to_wallet") || "Im Wallet gutgeschrieben"}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Level Progress Card */}
        <motion.div
          className={`rounded-2xl p-4 ${glass}`}
          style={{ background: panelBg, border: panelBorder }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${levelColor}15`, border: `1px solid ${levelColor}25` }}
              >
                <LevelIcon size={20} style={{ color: levelColor }} />
              </div>
              <div>
                <p className="text-[12px] font-bold text-white/80">{status?.level_name}</p>
                <p className="text-[9px] text-white/30">
                  {status?.coin_multiplier}x Coins • +{((status?.cashback_bonus || 0) * 100).toFixed(0)}% Cashback
                </p>
              </div>
            </div>
            {!progress.is_max_level && (
              <div className="text-right">
                <p className="text-[9px] text-white/40">{t("loyalty.next_level") || "Nächstes Level"}</p>
                <p className="text-[11px] font-bold" style={{ color: LEVEL_COLORS[progress.next_level] }}>
                  {progress.next_level?.charAt(0).toUpperCase() + progress.next_level?.slice(1)}
                </p>
              </div>
            )}
          </div>

          {!progress.is_max_level && (
            <>
              <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden mb-2">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${levelColor}, ${LEVEL_COLORS[progress.next_level]})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.progress}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
              <div className="flex justify-between text-[8px] text-white/30">
                <span>{progress.progress?.toFixed(0)}%</span>
                <span>{progress.next_level}</span>
              </div>

              {/* Requirements */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                {progress.requirements && Object.entries(progress.requirements).map(([key, req]) => (
                  <div
                    key={key}
                    className="p-2 rounded-lg text-center"
                    style={{ background: "rgba(255,255,255,0.02)", border: panelBorder }}
                  >
                    <p className="text-[8px] text-white/30 capitalize">{key === "spend" ? "Ausgaben" : key === "transactions" ? "Transaktionen" : "Coins"}</p>
                    <p className="text-[10px] font-bold text-white/60">
                      {typeof req.current === "number" ? (key === "spend" ? `€${req.current.toFixed(0)}` : req.current) : req.current}
                    </p>
                    <p className="text-[8px] text-white/20">
                      / {key === "spend" ? `€${req.required}` : req.required}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {progress.is_max_level && (
            <div className="text-center py-3">
              <Star size={24} className="text-[#8B00FF] mx-auto mb-2" />
              <p className="text-[11px] text-white/60">{t("loyalty.max_level") || "Du hast das höchste Level erreicht!"}</p>
            </div>
          )}
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2">
          {["overview", "history", "levels"].map((tab) => (
            <motion.button
              key={tab}
              onClick={() => setActiveTab(tab)}
              whileTap={{ scale: 0.95 }}
              className={`flex-1 py-2 rounded-xl text-[10px] font-bold ${
                activeTab === tab
                  ? "bg-white/10 text-white/80 border border-white/10"
                  : "bg-white/[0.02] text-white/30 border border-white/[0.03]"
              }`}
            >
              {tab === "overview" && (t("loyalty.overview") || "Übersicht")}
              {tab === "history" && (t("loyalty.history") || "Verlauf")}
              {tab === "levels" && (t("loyalty.levels") || "Level")}
            </motion.button>
          ))}
        </div>

        {/* Overview Tab */}
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {/* Stats by Module */}
              <div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }}>
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-3">
                  {t("loyalty.coins_by_module") || "Coins nach Modul"}
                </p>
                <div className="space-y-2">
                  {stats?.by_module && Object.entries(stats.by_module).length > 0 ? (
                    Object.entries(stats.by_module).map(([source, data]) => {
                      const Icon = SOURCE_ICONS[source] || Store;
                      return (
                        <div
                          key={source}
                          className="flex items-center gap-3 p-3 rounded-xl"
                          style={{ background: "rgba(255,255,255,0.02)", border: panelBorder }}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: "rgba(255,215,0,0.08)" }}
                          >
                            <Icon size={14} className="text-[#FFD700]" />
                          </div>
                          <div className="flex-1">
                            <p className="text-[11px] font-semibold text-white/70">
                              {SOURCE_NAMES[source] || source}
                            </p>
                            <p className="text-[9px] text-white/30">
                              {data.transactions} Transaktionen • €{data.spent?.toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[12px] font-bold text-[#FFD700]">+{data.coins}</p>
                            {data.cashback > 0 && (
                              <p className="text-[9px] text-[#00E89D]">+€{data.cashback?.toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6">
                      <Coins size={24} className="text-white/10 mx-auto mb-2" />
                      <p className="text-[10px] text-white/20">
                        {t("loyalty.no_coins_yet") || "Noch keine Coins verdient"}
                      </p>
                      <p className="text-[9px] text-white/10 mt-1">
                        {t("loyalty.use_more") || "Nutze BidBlitz mehr und verdiene Coins!"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Info Card */}
              <div
                className={`rounded-2xl p-4 ${glass}`}
                style={{ background: "rgba(0,224,255,0.03)", border: "1px solid rgba(0,224,255,0.1)" }}
              >
                <div className="flex items-start gap-3">
                  <TrendingUp size={20} className="text-[#00E0FF] mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-[#00E0FF]">
                      {t("loyalty.earn_more") || "Verdiene mehr Coins!"}
                    </p>
                    <p className="text-[9px] text-white/40 mt-1">
                      {t("loyalty.earn_info") || "Je mehr du BidBlitz nutzt, desto mehr Coins und Cashback erhältst du. Steige im Level auf für noch bessere Belohnungen!"}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }}>
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-3">
                  {t("loyalty.recent_rewards") || "Letzte Belohnungen"}
                </p>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {history?.coins?.length > 0 ? (
                    history.coins.map((tx, idx) => {
                      const Icon = SOURCE_ICONS[tx.source_type] || Gift;
                      return (
                        <div
                          key={tx.id || idx}
                          className="flex items-center gap-3 p-3 rounded-xl"
                          style={{ background: "rgba(255,255,255,0.02)", border: panelBorder }}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: "rgba(255,215,0,0.08)" }}
                          >
                            <Icon size={14} className="text-[#FFD700]" />
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] font-semibold text-white/70">
                              {SOURCE_NAMES[tx.source_type] || tx.source_type}
                            </p>
                            <p className="text-[8px] text-white/25">
                              €{tx.amount_spent?.toFixed(2)} • {tx.level_at_time} Level
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] font-bold text-[#FFD700]">+{tx.coins_amount}</p>
                            <p className="text-[8px] text-white/20">{tx.created_at?.slice(0, 10)}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6">
                      <History size={24} className="text-white/10 mx-auto mb-2" />
                      <p className="text-[10px] text-white/20">{t("loyalty.no_history") || "Noch kein Verlauf"}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Level Events */}
              {history?.level_events?.length > 0 && (
                <div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }}>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-3">
                    {t("loyalty.level_history") || "Level-Verlauf"}
                  </p>
                  <div className="space-y-2">
                    {history.level_events.map((ev, idx) => (
                      <div
                        key={ev.id || idx}
                        className="flex items-center gap-3 p-3 rounded-xl"
                        style={{
                          background: `${LEVEL_COLORS[ev.new_level]}08`,
                          border: `1px solid ${LEVEL_COLORS[ev.new_level]}20`,
                        }}
                      >
                        <Trophy size={16} style={{ color: LEVEL_COLORS[ev.new_level] }} />
                        <div className="flex-1">
                          <p className="text-[10px] font-bold" style={{ color: LEVEL_COLORS[ev.new_level] }}>
                            Level Up: {ev.new_level?.charAt(0).toUpperCase() + ev.new_level?.slice(1)}
                          </p>
                          <p className="text-[8px] text-white/30">
                            {ev.old_level} → {ev.new_level}
                          </p>
                        </div>
                        <p className="text-[8px] text-white/20">{ev.created_at?.slice(0, 10)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Levels Tab */}
          {activeTab === "levels" && (
            <motion.div
              key="levels"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }}>
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-3">
                  {t("loyalty.all_levels") || "Alle Level"}
                </p>
                <div className="space-y-2">
                  {levels.map((lvl) => {
                    const isCurrentLevel = lvl.id === status?.level;
                    const Icon = LEVEL_ICONS[lvl.id] || Medal;
                    const color = LEVEL_COLORS[lvl.id] || "#CD7F32";
                    return (
                      <div
                        key={lvl.id}
                        className={`p-4 rounded-xl ${isCurrentLevel ? "ring-2" : ""}`}
                        style={{
                          background: isCurrentLevel ? `${color}10` : "rgba(255,255,255,0.02)",
                          border: `1px solid ${isCurrentLevel ? `${color}40` : "rgba(255,255,255,0.04)"}`,
                          ringColor: color,
                        }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: `${color}15` }}
                          >
                            <Icon size={20} style={{ color }} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-[13px] font-bold" style={{ color: isCurrentLevel ? color : "rgba(255,255,255,0.7)" }}>
                                {lvl.name}
                              </p>
                              {isCurrentLevel && (
                                <span
                                  className="px-2 py-0.5 rounded-full text-[8px] font-bold"
                                  style={{ background: `${color}20`, color }}
                                >
                                  AKTUELL
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                            <p className="text-[8px] text-white/30">Coin Multiplier</p>
                            <p className="text-[14px] font-bold text-[#FFD700]">{lvl.coin_multiplier}x</p>
                          </div>
                          <div className="p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                            <p className="text-[8px] text-white/30">Cashback Bonus</p>
                            <p className="text-[14px] font-bold text-[#00E89D]">+{(lvl.cashback_bonus * 100).toFixed(0)}%</p>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-white/5">
                          <p className="text-[8px] text-white/30 mb-1">{t("loyalty.requirements") || "Voraussetzungen"}</p>
                          <div className="flex gap-4 text-[9px] text-white/40">
                            <span>€{lvl.min_spend} Ausgaben</span>
                            <span>{lvl.min_transactions} Transaktionen</span>
                            <span>{lvl.min_coins} Coins</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center py-3">
          <p className="text-[9px] text-white/10">BidBlitz Loyalty System</p>
        </div>
      </div>
    </motion.div>
  );
};

export default LoyaltyPage;
