import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Target, Clock, DollarSign, Zap, Cpu, Loader2,
  ToggleLeft, ToggleRight,
} from "lucide-react";
import { Skeleton, adminApi } from "./adminHelpers";

const STRATS = [
  { id: "standard", name: "Standard", color: "#00E89D" },
  { id: "sniper", name: "Sniper", color: "#FF6B6B" },
  { id: "pressure", name: "Pressure", color: "#FFB800" },
  { id: "marathon", name: "Marathon", color: "#00C2FF" },
  { id: "whale", name: "Whale", color: "#A855F7" },
];

const AGG = [
  { id: "low", name: "Niedrig", color: "#00E89D" },
  { id: "medium", name: "Mittel", color: "#FFB800" },
  { id: "high", name: "Hoch", color: "#FF6B6B" },
  { id: "extreme", name: "Extrem", color: "#A855F7" },
];

const BATTLE = [
  { id: "passive", name: "Passiv" },
  { id: "normal", name: "Normal" },
  { id: "aggressive", name: "Aggro" },
  { id: "berserker", name: "Berserker" },
];

export default function AdminAuctionsTab({
  t, loading, auctions, setAuctions, botSaving, setBotSaving, reload,
}) {
  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-[120px]" />)}</div>
      </motion.div>
    );
  }

  const activeCount = auctions.filter(a => a.status === "active").length;
  const endedAuctions = auctions.filter(a => a.status === "ended");

  return (
    <motion.div data-testid="admin-auctions-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Bot size={14} className="text-[#00E89D]" />
            <p className="text-[10px] text-[#444] uppercase tracking-[0.12em] font-semibold">
              {t("admin.auctions_title") || "Auction Bot Control"} ({activeCount} {t("admin.auctions_active") || "active"})
            </p>
          </div>
          <motion.button onClick={reload} whileTap={{ scale: 0.95 }}
            className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white/[0.03] text-[#555] border border-white/[0.05]">
            {t("admin.auctions_refresh") || "Refresh"}
          </motion.button>
        </div>

        {activeCount === 0 && (
          <p className="text-center py-10 text-[12px] text-[#333]">{t("admin.auctions_none") || "No active auctions"}</p>
        )}

        {auctions.filter(a => a.status === "active").map(auc => {
          const targetPrice = auc._bot_target_price || 0;
          const bidsNeeded = targetPrice > 0 ? Math.round(targetPrice / 0.01) : 0;
          const estimatedRevenue = bidsNeeded * 0.50;
          const progress = targetPrice > 0 ? Math.min(100, ((auc.current_price || 0) / targetPrice) * 100) : 0;

          const updateAuc = (patch) => setAuctions(prev => prev.map(a =>
            a.auction_id === auc.auction_id ? { ...a, ...patch } : a
          ));

          return (
            <motion.div key={auc.auction_id} data-testid={`auction-bot-${auc.auction_id}`}
              className="rounded-2xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.015)", border: `1px solid ${auc._bot_enabled ? "rgba(0,232,157,0.12)" : "rgba(255,255,255,0.035)"}` }}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="px-4 py-3 flex items-center gap-3">
                {auc.image_url && <img src={auc.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-white/[0.02]" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-white/90 truncate">{auc.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-[#00E89D] font-bold font-mono">{"\u20AC"}{(auc.current_price || 0).toFixed(2)}</span>
                    <span className="text-[8px] text-[#333]">{auc.total_bids || 0} {t("admin.auctions_bids") || "bids"}</span>
                    {auc.bot_bids_placed > 0 && <span className="text-[8px] text-[#A855F7] font-medium">{auc.bot_bids_placed} bot</span>}
                    <span className="text-[8px] text-[#444]">{Math.floor((auc.remaining_seconds || 0) / 60)}m {Math.floor((auc.remaining_seconds || 0) % 60)}s</span>
                  </div>
                </div>
                <motion.button data-testid={`bot-toggle-${auc.auction_id}`} whileTap={{ scale: 0.9 }}
                  onClick={() => updateAuc({ _bot_enabled: !auc._bot_enabled })}>
                  {auc._bot_enabled ? <ToggleRight size={28} className="text-[#00E89D]" /> : <ToggleLeft size={28} className="text-[#333]" />}
                </motion.button>
              </div>

              <AnimatePresence>
                {auc._bot_enabled && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="px-4 pb-3 space-y-2.5 border-t border-white/[0.03] pt-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="text-[9px] text-[#444] font-medium block mb-1">
                            <Target size={9} className="inline mr-1 text-[#FFB800]" />{t("admin.auctions_target") || "Target Price"} ({"\u20AC"})
                          </label>
                          <input data-testid={`bot-target-${auc.auction_id}`} type="number" step="0.5" min="0" max="10000"
                            value={auc._bot_target_price}
                            onChange={e => updateAuc({ _bot_target_price: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 rounded-xl text-[13px] text-white/90 font-bold font-mono outline-none bg-white/[0.03] border border-white/[0.06]" />
                        </div>
                        <div className="flex-1">
                          <label className="text-[9px] text-[#444] font-medium block mb-1">
                            <Clock size={9} className="inline mr-1 text-[#00C2FF]" />{t("admin.auctions_window") || "Start (Sek. vor Ende)"}
                          </label>
                          <input data-testid={`bot-window-${auc.auction_id}`} type="number" step="60" min="0" max="86400"
                            value={auc._bot_min_seconds}
                            onChange={e => updateAuc({ _bot_min_seconds: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 rounded-xl text-[13px] text-white/90 font-bold font-mono outline-none bg-white/[0.03] border border-white/[0.06]" />
                        </div>
                      </div>

                      {targetPrice > 0 && (
                        <div className="rounded-xl p-2.5 flex items-center justify-between" style={{ background: "rgba(0,232,157,0.03)", border: "1px solid rgba(0,232,157,0.08)" }}>
                          <div className="flex items-center gap-2">
                            <DollarSign size={12} className="text-[#00E89D]" />
                            <div>
                              <p className="text-[9px] text-[#444]">{t("admin.auctions_math") || "Revenue Calculation"}</p>
                              <p className="text-[8px] text-white/20 font-mono">{targetPrice.toFixed(2)} / 0.01 × 0.50</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[15px] font-bold font-outfit text-[#00E89D]">{"\u20AC"}{estimatedRevenue.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</p>
                            <p className="text-[8px] text-[#444]">{bidsNeeded.toLocaleString()} {t("admin.auctions_bids_needed") || "bids needed"}</p>
                          </div>
                        </div>
                      )}

                      {targetPrice > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] text-[#444]">{t("admin.auctions_progress") || "Progress"}</span>
                            <span className="text-[9px] text-white/40 font-mono">{(auc.current_price || 0).toFixed(2)} / {targetPrice.toFixed(2)} ({progress.toFixed(1)}%)</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                            <motion.div className="h-full rounded-full" style={{ background: progress >= 100 ? "#00D26A" : "#00E89D" }}
                              initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-white/[0.03]">
                        <label className="text-[9px] text-[#444] font-medium block mb-1.5">
                          <Cpu size={9} className="inline mr-1 text-[#A855F7]" />Bot-Strategie
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {STRATS.map(strat => (
                            <motion.button key={strat.id} whileTap={{ scale: 0.95 }}
                              onClick={() => updateAuc({ _bot_strategy: strat.id })}
                              className="px-2 py-1.5 rounded-lg text-[9px] font-medium"
                              style={{
                                background: auc._bot_strategy === strat.id ? `${strat.color}15` : "rgba(255,255,255,0.02)",
                                border: `1px solid ${auc._bot_strategy === strat.id ? `${strat.color}40` : "rgba(255,255,255,0.04)"}`,
                                color: auc._bot_strategy === strat.id ? strat.color : "#555",
                              }}>{strat.name}</motion.button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-[9px] text-[#444] font-medium block mb-1.5">
                          <Zap size={9} className="inline mr-1 text-[#FFB800]" />Aggressivität
                        </label>
                        <div className="grid grid-cols-4 gap-1">
                          {AGG.map(agg => (
                            <motion.button key={agg.id} whileTap={{ scale: 0.95 }}
                              onClick={() => updateAuc({ _bot_aggression: agg.id })}
                              className="px-1.5 py-1 rounded-lg text-[8px] font-medium"
                              style={{
                                background: auc._bot_aggression === agg.id ? `${agg.color}15` : "rgba(255,255,255,0.02)",
                                border: `1px solid ${auc._bot_aggression === agg.id ? `${agg.color}40` : "rgba(255,255,255,0.04)"}`,
                                color: auc._bot_aggression === agg.id ? agg.color : "#555",
                              }}>{agg.name}</motion.button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-[9px] text-[#444] font-medium block mb-1.5">
                          <Target size={9} className="inline mr-1 text-[#FF6B6B]" />Final Battle Modus
                        </label>
                        <div className="grid grid-cols-4 gap-1">
                          {BATTLE.map(fb => (
                            <motion.button key={fb.id} whileTap={{ scale: 0.95 }}
                              onClick={() => updateAuc({ _bot_final_battle: fb.id })}
                              className="px-1.5 py-1 rounded-lg text-[8px] font-medium"
                              style={{
                                background: auc._bot_final_battle === fb.id ? "rgba(255,107,107,0.15)" : "rgba(255,255,255,0.02)",
                                border: `1px solid ${auc._bot_final_battle === fb.id ? "rgba(255,107,107,0.4)" : "rgba(255,255,255,0.04)"}`,
                                color: auc._bot_final_battle === fb.id ? "#FF6B6B" : "#555",
                              }}>{fb.name}</motion.button>
                          ))}
                        </div>
                      </div>

                      <motion.button data-testid={`bot-save-${auc.auction_id}`} whileTap={{ scale: 0.96 }}
                        disabled={botSaving === auc.auction_id}
                        onClick={async () => {
                          setBotSaving(auc.auction_id);
                          try {
                            await adminApi("/api/auctions/admin/bot-config", {
                              method: "POST",
                              body: JSON.stringify({
                                auction_id: auc.auction_id,
                                bot_enabled: auc._bot_enabled,
                                bot_target_price: auc._bot_target_price,
                                bot_min_seconds: auc._bot_min_seconds,
                                bot_aggression: auc._bot_aggression || "medium",
                                bot_final_battle_mode: auc._bot_final_battle || "normal",
                                bot_react_to_users: true,
                                bot_max_bids_per_minute: auc._bot_aggression === "extreme" ? 20 : auc._bot_aggression === "high" ? 12 : auc._bot_aggression === "low" ? 3 : 6,
                                bot_min_delay_seconds: auc._bot_aggression === "extreme" ? 1 : auc._bot_aggression === "high" ? 2 : auc._bot_aggression === "low" ? 10 : 5,
                                bot_max_delay_seconds: auc._bot_aggression === "extreme" ? 4 : auc._bot_aggression === "high" ? 8 : auc._bot_aggression === "low" ? 30 : 15,
                              }),
                            });
                          } catch { /* noop */ }
                          setBotSaving(null);
                        }}
                        className="w-full py-2.5 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5"
                        style={{ background: "rgba(0,232,157,0.1)", color: "#00E89D", border: "1px solid rgba(0,232,157,0.15)" }}>
                        {botSaving === auc.auction_id ? <Loader2 size={12} className="animate-spin" /> : <><Zap size={11} /> {t("admin.auctions_save_bot") || "Bot speichern"}</>}
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {endedAuctions.length > 0 && (
          <div className="mt-4">
            <p className="text-[9px] text-[#333] uppercase tracking-[0.12em] font-semibold mb-2">
              {t("admin.auctions_ended") || "Ended"} ({endedAuctions.length})
            </p>
            <div className="space-y-1.5">
              {endedAuctions.slice(0, 10).map(auc => (
                <div key={auc.auction_id} className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.025)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/40 truncate">{auc.title}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[11px] font-mono text-white/30">{"\u20AC"}{(auc.current_price || 0).toFixed(2)}</span>
                    <span className="text-[9px] text-[#333]">{auc.total_bids || 0} bids</span>
                    {auc.bot_bids_placed > 0 && <span className="text-[8px] text-[#A855F7]/50">{auc.bot_bids_placed} bot</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
