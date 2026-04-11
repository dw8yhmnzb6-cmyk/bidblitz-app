import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Gavel, Play, Pause, Square, Clock, Plus,
  Trash2, Settings, BarChart3, TrendingUp, Users, RefreshCw,
  Calendar, Bot, Zap, Package, ChevronRight, Check, X,
  Timer, DollarSign, Target, Layers, AlertCircle, Activity,
  Sliders, Power, Eye, Edit3, Save
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "../store";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  return r.json();
}

const AuctionAdminPage = ({ onBack }) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [auctions, setAuctions] = useState([]);
  const [stats, setStats] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [config, setConfig] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showBotModal, setShowBotModal] = useState(null); // auction object or null
  const [botConfig, setBotConfig] = useState({ enabled: true, target: 0, minSeconds: 60 });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [auctionsRes, statsRes, catalogRes, configRes] = await Promise.all([
        api("/api/auctions/admin/list"),
        api("/api/auctions/admin/stats/overview"),
        api("/api/auctions/admin/catalog"),
        api("/api/auctions/admin/automation/config"),
      ]);
      
      setAuctions(auctionsRes.auctions || []);
      setStats(statsRes);
      setCatalog(catalogRes.catalog || []);
      setConfig(configRes);
    } catch (err) {
      toast.error("Fehler beim Laden");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ─── Bot Actions ───
  const openBotConfig = (auction) => {
    setBotConfig({
      enabled: auction.bot_enabled || false,
      target: auction.bot_target_price || Math.round(auction.retail_price * 0.15),
      minSeconds: auction.bot_min_seconds || 60,
    });
    setShowBotModal(auction);
  };

  const saveBotConfig = async () => {
    if (!showBotModal) return;
    const res = await api("/api/auctions/admin/bot-config", {
      method: "POST",
      body: JSON.stringify({
        auction_id: showBotModal.auction_id,
        bot_enabled: botConfig.enabled,
        bot_target_price: botConfig.target,
        bot_min_seconds: botConfig.minSeconds,
      }),
    });
    if (res.ok) {
      toast.success(`Bot-Konfiguration gespeichert. Geschätzter Umsatz: €${res.estimated_revenue}`);
      setShowBotModal(null);
      loadData();
    } else {
      toast.error(res.detail || "Fehler");
    }
  };

  const toggleBotQuick = async (auction) => {
    const res = await api("/api/auctions/admin/bot-config", {
      method: "POST",
      body: JSON.stringify({
        auction_id: auction.auction_id,
        bot_enabled: !auction.bot_enabled,
        bot_target_price: auction.bot_target_price || Math.round(auction.retail_price * 0.15),
        bot_min_seconds: auction.bot_min_seconds || 60,
      }),
    });
    if (res.ok) {
      toast.success(res.bot_enabled ? "Bot aktiviert" : "Bot deaktiviert");
      loadData();
    }
  };

  // ─── Auction Actions ───
  const handlePause = async (auctionId) => {
    const res = await api(`/api/auctions/admin/auction/${auctionId}/pause`, { method: "POST" });
    if (res.ok) {
      toast.success("Auktion pausiert");
      loadData();
    } else {
      toast.error(res.detail || "Fehler");
    }
  };

  const handleResume = async (auctionId) => {
    const res = await api(`/api/auctions/admin/auction/${auctionId}/resume`, { method: "POST" });
    if (res.ok) {
      toast.success("Auktion fortgesetzt");
      loadData();
    } else {
      toast.error(res.detail || "Fehler");
    }
  };

  const handleEnd = async (auctionId) => {
    if (!confirm("Auktion wirklich beenden?")) return;
    const res = await api(`/api/auctions/admin/auction/${auctionId}/end`, { method: "POST" });
    if (res.ok) {
      toast.success(`Beendet. Gewinner: ${res.winner_name || "Keiner"}, Preis: €${res.final_price?.toFixed(2)}`);
      loadData();
    } else {
      toast.error(res.detail || "Fehler");
    }
  };

  const handleDelete = async (auctionId) => {
    if (!confirm("Auktion löschen? (Nur ohne echte Gebote)")) return;
    const res = await api(`/api/auctions/admin/auction/${auctionId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Gelöscht");
      loadData();
    } else {
      toast.error(res.detail || "Fehler");
    }
  };

  const handleSchedule = async (productIndex, options = {}) => {
    const res = await api("/api/auctions/admin/auction/schedule", {
      method: "POST",
      body: JSON.stringify({
        product_index: productIndex,
        duration_hours: options.duration || 48,
        bot_enabled: true,
        featured: false,
      }),
    });
    if (res.ok) {
      toast.success(`"${res.auction.title}" gestartet mit Bot-Ziel €${res.auction.bot_target_price}`);
      setShowScheduleModal(false);
      loadData();
    } else {
      toast.error(res.detail || "Fehler");
    }
  };

  const handleRefreshAll = async () => {
    if (!confirm("Alle aktiven Auktionen beenden und neue starten?")) return;
    const res = await api("/api/auctions/admin/refresh", { method: "POST" });
    if (res.refreshed) {
      toast.success(`${res.refreshed} neue Auktionen gestartet`);
      loadData();
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return "Beendet";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const activeAuctions = auctions.filter(a => a.status === "active");
  const botEnabledAuctions = auctions.filter(a => a.bot_enabled && a.status === "active");

  return (
    <div className="min-h-screen bg-[#030303] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 px-4 pt-4 pb-3" style={{ background: "linear-gradient(to bottom, #030303 80%, transparent)" }}>
        <div className="flex items-center gap-3">
          <motion.button onClick={onBack} className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5" whileTap={{ scale: 0.95 }}>
            <ArrowLeft size={20} />
          </motion.button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Auktions-Admin</h1>
            <p className="text-xs text-white/40">Steuerung & Bot-System</p>
          </div>
          <motion.button onClick={loadData} className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5" whileTap={{ scale: 0.95 }}>
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </motion.button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="px-4 mb-4">
          <div className="grid grid-cols-4 gap-2">
            <MiniStat icon={<Gavel size={14} />} value={stats.auctions?.active || 0} label="Aktiv" color="#00D26A" />
            <MiniStat icon={<Bot size={14} />} value={botEnabledAuctions.length} label="Mit Bot" color="#A855F7" />
            <MiniStat icon={<Users size={14} />} value={stats.bids?.real_users || 0} label="Echte Gebote" color="#00C2FF" />
            <MiniStat icon={<DollarSign size={14} />} value={`€${stats.revenue?.total_credit_purchases || 0}`} label="Umsatz" color="#FFB800" />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: "overview", label: "Übersicht", icon: <BarChart3 size={14} /> },
            { id: "bots", label: "Bot-System", icon: <Bot size={14} /> },
            { id: "active", label: `Aktiv (${activeAuctions.length})`, icon: <Play size={14} /> },
            { id: "catalog", label: "Katalog", icon: <Package size={14} /> },
          ].map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id ? "bg-white/10 text-white" : "bg-white/[0.03] text-white/50"
              }`}
              whileTap={{ scale: 0.97 }}
            >
              {tab.icon}
              {tab.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4">
        
        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Quick Actions */}
            <Card title="Schnellaktionen" icon={<Zap size={16} className="text-yellow-400" />}>
              <div className="grid grid-cols-2 gap-2">
                <ActionBtn icon={<Plus size={16} />} label="Neue Auktion" onClick={() => setShowScheduleModal(true)} color="#00D26A" />
                <ActionBtn icon={<RefreshCw size={16} />} label="Alle neu starten" onClick={handleRefreshAll} color="#00C2FF" />
              </div>
            </Card>

            {/* Bot Overview */}
            <Card title="Bot-Status" icon={<Bot size={16} className="text-purple-400" />}>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Bots aktiv auf</span>
                  <span className="font-semibold text-purple-400">{botEnabledAuctions.length} Auktionen</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Bot-Gebote heute</span>
                  <span className="font-semibold">{stats?.bids?.bots || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Bot vs. Echte Ratio</span>
                  <span className="font-semibold">
                    {stats?.bids?.real_users > 0 
                      ? `1:${(stats.bids.bots / stats.bids.real_users).toFixed(1)}`
                      : "N/A"}
                  </span>
                </div>
              </div>
            </Card>

            {/* Active Auctions Preview */}
            <Card title="Aktive Auktionen" icon={<Play size={16} className="text-green-400" />}>
              {activeAuctions.length === 0 ? (
                <p className="text-white/40 text-sm py-4 text-center">Keine aktiven Auktionen</p>
              ) : (
                <div className="space-y-2">
                  {activeAuctions.slice(0, 5).map((a) => (
                    <AuctionMiniRow key={a.auction_id} auction={a} formatTime={formatTime} onBotClick={() => openBotConfig(a)} />
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ═══ BOT SYSTEM TAB ═══ */}
        {activeTab === "bots" && (
          <div className="space-y-4">
            {/* Bot Stats Card */}
            <Card title="Bot-Statistiken" icon={<Activity size={16} className="text-purple-400" />}>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 rounded-xl bg-purple-500/10">
                  <p className="text-2xl font-bold text-purple-400">{stats?.bids?.bots || 0}</p>
                  <p className="text-xs text-white/40">Bot-Gebote gesamt</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-green-500/10">
                  <p className="text-2xl font-bold text-green-400">{botEnabledAuctions.length}</p>
                  <p className="text-xs text-white/40">Aktive Bot-Auktionen</p>
                </div>
              </div>
              
              <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <p className="text-xs text-white/40 mb-2">Wie der Bot funktioniert:</p>
                <ul className="text-xs text-white/60 space-y-1">
                  <li>• Bot bietet nur wenn <span className="text-purple-400">bot_enabled=true</span></li>
                  <li>• Bot stoppt bei <span className="text-yellow-400">Zielpreis</span></li>
                  <li>• Bot wartet bis <span className="text-blue-400">min_seconds</span> verbleiben</li>
                  <li>• Bot-Namen sind zufällig (Max_B, Sophie_K, etc.)</li>
                </ul>
              </div>
            </Card>

            {/* Bot-Enabled Auctions */}
            <Card title="Auktionen mit Bot" icon={<Bot size={16} className="text-purple-400" />}>
              {activeAuctions.length === 0 ? (
                <p className="text-white/40 text-sm py-4 text-center">Keine aktiven Auktionen</p>
              ) : (
                <div className="space-y-2">
                  {activeAuctions.map((a) => (
                    <BotAuctionRow 
                      key={a.auction_id} 
                      auction={a} 
                      formatTime={formatTime}
                      onToggle={() => toggleBotQuick(a)}
                      onConfigure={() => openBotConfig(a)}
                    />
                  ))}
                </div>
              )}
            </Card>

            {/* Global Bot Settings */}
            <Card title="Globale Bot-Einstellungen" icon={<Settings size={16} className="text-white/40" />}>
              <div className="space-y-3">
                <SettingRow label="Standard Bot aktiv" value={config?.bot_default_enabled ? "Ja" : "Nein"} />
                <SettingRow label="Standard Zielpreis" value={`${config?.bot_default_target_percent || 15}% vom UVP`} />
                <SettingRow label="Mindestzeit vor Bid" value="60 Sekunden" />
                <SettingRow label="Bid-Wahrscheinlichkeit" value="30-40%" />
              </div>
            </Card>
          </div>
        )}

        {/* ═══ ACTIVE AUCTIONS TAB ═══ */}
        {activeTab === "active" && (
          <div className="space-y-3">
            {activeAuctions.length === 0 ? (
              <EmptyState icon={<Play size={32} />} text="Keine aktiven Auktionen" />
            ) : (
              activeAuctions.map((a) => (
                <AuctionFullCard 
                  key={a.auction_id} 
                  auction={a}
                  formatTime={formatTime}
                  onPause={handlePause}
                  onResume={handleResume}
                  onEnd={handleEnd}
                  onDelete={handleDelete}
                  onBotConfig={() => openBotConfig(a)}
                />
              ))
            )}
          </div>
        )}

        {/* ═══ CATALOG TAB ═══ */}
        {activeTab === "catalog" && (
          <div className="space-y-2">
            <p className="text-xs text-white/40 mb-3">{catalog.length} Produkte im Katalog. Klicke um Auktion zu starten.</p>
            {catalog.map((product, idx) => (
              <motion.div
                key={idx}
                className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-white/5 to-white/[0.02] flex items-center justify-center">
                  <Package size={20} className="text-white/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{product.title}</p>
                  <p className="text-xs text-white/40">UVP €{product.retail_price} • Bot-Ziel ~€{Math.round(product.retail_price * 0.15)}</p>
                </div>
                <motion.button
                  onClick={() => handleSchedule(idx)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/15 text-green-400"
                  whileTap={{ scale: 0.95 }}
                >
                  Starten
                </motion.button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ SCHEDULE MODAL ═══ */}
      <AnimatePresence>
        {showScheduleModal && (
          <Modal onClose={() => setShowScheduleModal(false)} title="Neue Auktion starten">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {catalog.map((product, idx) => (
                <motion.button
                  key={idx}
                  onClick={() => handleSchedule(idx)}
                  className="w-full rounded-xl p-3 flex items-center gap-3 text-left bg-white/[0.02] border border-white/5"
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{product.title}</p>
                    <p className="text-xs text-white/40">€{product.retail_price} • Bot-Ziel €{Math.round(product.retail_price * 0.15)}</p>
                  </div>
                  <ChevronRight size={18} className="text-white/30" />
                </motion.button>
              ))}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ═══ BOT CONFIG MODAL - 3-PHASE SYSTEM ═══ */}
      <AnimatePresence>
        {showBotModal && (
          <Modal onClose={() => setShowBotModal(null)} title="Bot-Konfiguration (3-Phasen)">
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <p className="text-sm font-semibold">{showBotModal.title}</p>
                <p className="text-xs text-white/40">UVP: €{showBotModal.retail_price} • Aktuell: €{showBotModal.current_price?.toFixed(2)}</p>
              </div>

              {/* Bot Enable Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <Power size={18} className={botConfig.enabled ? "text-green-400" : "text-white/30"} />
                  <span className="text-sm font-medium">Bot aktiv</span>
                </div>
                <motion.button
                  onClick={() => setBotConfig(c => ({ ...c, enabled: !c.enabled }))}
                  className={`w-12 h-7 rounded-full flex items-center px-1 transition-colors ${
                    botConfig.enabled ? "bg-green-500" : "bg-white/10"
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div 
                    className="w-5 h-5 rounded-full bg-white"
                    animate={{ x: botConfig.enabled ? 20 : 0 }}
                  />
                </motion.button>
              </div>

              {/* 3-Phase Explanation */}
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-blue-300 font-semibold mb-2">3-PHASEN BOT-STRATEGIE:</p>
                <div className="space-y-1 text-xs text-blue-200/70">
                  <p>1. START: Bot bietet bis €{botConfig.initialTarget || 5} (Aktivität starten)</p>
                  <p>2. PAUSE: Bot stoppt, echte Kunden bieten</p>
                  <p>3. FINAL: Letzte 5 Min → Bot bis €{botConfig.target?.toFixed(2) || "?"}</p>
                </div>
              </div>

              {/* Phase 1: Initial Target (€3-5) */}
              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-green-300">Phase 1: Start-Ziel</span>
                  <span className="text-sm font-bold text-green-400">€{botConfig.initialTarget || 5}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={botConfig.initialTarget || 5}
                  onChange={(e) => setBotConfig(c => ({ ...c, initialTarget: parseFloat(e.target.value) }))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-green-400"
                />
                <p className="text-xs text-green-300/50 mt-1">Bot bietet bis dieser Preis erreicht ist</p>
              </div>

              {/* Phase 3: Final Target Price */}
              <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-yellow-300">Phase 3: End-Ziel</span>
                  <span className="text-sm font-bold text-yellow-400">€{botConfig.target?.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max={Math.min(showBotModal.retail_price * 0.5, 500)}
                  step="0.5"
                  value={botConfig.target}
                  onChange={(e) => setBotConfig(c => ({ ...c, target: parseFloat(e.target.value) }))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                />
                <div className="flex justify-between text-xs text-yellow-300/50 mt-1">
                  <span>€5</span>
                  <span>~{((botConfig.target / showBotModal.retail_price) * 100).toFixed(0)}% vom UVP</span>
                  <span>€{Math.min(showBotModal.retail_price * 0.5, 500).toFixed(0)}</span>
                </div>
              </div>

              {/* Final Phase Duration */}
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-purple-300">Final-Phase startet bei</span>
                  <span className="text-sm font-bold text-purple-400">{Math.floor((botConfig.minSeconds || 300) / 60)} Min verbleibend</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="600"
                  step="30"
                  value={botConfig.minSeconds || 300}
                  onChange={(e) => setBotConfig(c => ({ ...c, minSeconds: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-400"
                />
                <div className="flex justify-between text-xs text-purple-300/50 mt-1">
                  <span>1 Min</span>
                  <span>10 Min</span>
                </div>
              </div>

              {/* Estimated Revenue */}
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={16} className="text-cyan-400" />
                  <span className="text-sm text-cyan-300">Geschätzter Umsatz</span>
                </div>
                <p className="text-xl font-bold text-cyan-400">
                  €{(Math.round(botConfig.target / 0.01) * 0.50).toFixed(2)}
                </p>
                <p className="text-xs text-cyan-300/60">
                  ~{Math.round(botConfig.target / 0.01)} Gebote × €0.50 pro Gebot
                </p>
              </div>

              {/* Save Button */}
              <motion.button
                onClick={saveBotConfig}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold flex items-center justify-center gap-2"
                whileTap={{ scale: 0.98 }}
              >
                <Save size={18} />
                Speichern
              </motion.button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

// ═══ SUB-COMPONENTS ═══

const MiniStat = ({ icon, value, label, color }) => (
  <div className="rounded-xl p-2 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
    <div className="flex items-center justify-center gap-1 mb-0.5" style={{ color }}>{icon}</div>
    <p className="text-lg font-bold" style={{ color }}>{value}</p>
    <p className="text-[10px] text-white/40">{label}</p>
  </div>
);

const Card = ({ title, icon, children }) => (
  <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">{icon}{title}</h3>
    {children}
  </div>
);

const ActionBtn = ({ icon, label, onClick, color }) => (
  <motion.button
    onClick={onClick}
    className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
    style={{ background: `${color}15`, color }}
    whileTap={{ scale: 0.97 }}
  >
    {icon}{label}
  </motion.button>
);

const AuctionMiniRow = ({ auction, formatTime, onBotClick }) => (
  <div className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{auction.title}</p>
      <p className="text-xs text-white/40">€{auction.current_price?.toFixed(2)} • {auction.total_bids} Gebote</p>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-xs text-yellow-400 font-mono">{formatTime(auction.remaining_seconds)}</span>
      <motion.button 
        onClick={onBotClick} 
        className={`p-1.5 rounded-lg ${auction.bot_enabled ? "bg-purple-500/20" : "bg-white/5"}`}
        whileTap={{ scale: 0.9 }}
      >
        <Bot size={14} className={auction.bot_enabled ? "text-purple-400" : "text-white/30"} />
      </motion.button>
    </div>
  </div>
);

const BotAuctionRow = ({ auction, formatTime, onToggle, onConfigure }) => (
  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${auction.bot_enabled ? "bg-green-400" : "bg-white/20"}`} />
        <p className="text-sm font-medium truncate">{auction.title}</p>
      </div>
      <div className="flex items-center gap-3 text-xs text-white/40">
        <span>Ziel: €{auction.bot_target_price?.toFixed(2) || "N/A"}</span>
        <span>Bot-Bids: {auction.bot_bids_placed || 0}</span>
        <span className="text-yellow-400">{formatTime(auction.remaining_seconds)}</span>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <motion.button
        onClick={onToggle}
        className={`p-2 rounded-lg ${auction.bot_enabled ? "bg-green-500/20 text-green-400" : "bg-white/5 text-white/30"}`}
        whileTap={{ scale: 0.9 }}
        title={auction.bot_enabled ? "Bot deaktivieren" : "Bot aktivieren"}
      >
        <Power size={16} />
      </motion.button>
      <motion.button
        onClick={onConfigure}
        className="p-2 rounded-lg bg-purple-500/20 text-purple-400"
        whileTap={{ scale: 0.9 }}
        title="Bot konfigurieren"
      >
        <Sliders size={16} />
      </motion.button>
    </div>
  </div>
);

const AuctionFullCard = ({ auction, formatTime, onPause, onResume, onEnd, onDelete, onBotConfig }) => (
  <motion.div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }} layout>
    <div className="flex items-start gap-3 mb-3">
      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] flex items-center justify-center flex-shrink-0">
        <Gavel size={24} className="text-white/40" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
            auction.status === "active" ? "bg-green-500/20 text-green-400" :
            auction.status === "paused" ? "bg-yellow-500/20 text-yellow-400" : "bg-white/10 text-white/40"
          }`}>
            {auction.status.toUpperCase()}
          </span>
          {auction.bot_enabled && (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400 flex items-center gap-1">
              <Bot size={10} /> BOT
            </span>
          )}
        </div>
        <p className="text-sm font-semibold truncate">{auction.title}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
          <span>€{auction.current_price?.toFixed(2)}</span>
          <span>{auction.total_bids} Gebote</span>
          {auction.status === "active" && <span className="text-yellow-400 font-mono">{formatTime(auction.remaining_seconds)}</span>}
        </div>
      </div>
    </div>

    {/* Bot Info */}
    {auction.bot_enabled && (
      <div className="mb-3 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs">
        <div className="flex justify-between">
          <span className="text-purple-300">Bot-Ziel: €{auction.bot_target_price?.toFixed(2)}</span>
          <span className="text-purple-300">Bot-Bids: {auction.bot_bids_placed || 0}</span>
        </div>
      </div>
    )}

    {/* Actions */}
    <div className="flex items-center gap-2 pt-3 border-t border-white/5">
      {auction.status === "active" && (
        <motion.button onClick={() => onPause(auction.auction_id)} className="flex-1 py-2 rounded-lg bg-yellow-500/10 text-yellow-400 text-xs font-medium" whileTap={{ scale: 0.97 }}>
          <Pause size={12} className="inline mr-1" /> Pause
        </motion.button>
      )}
      {auction.status === "paused" && (
        <motion.button onClick={() => onResume(auction.auction_id)} className="flex-1 py-2 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium" whileTap={{ scale: 0.97 }}>
          <Play size={12} className="inline mr-1" /> Weiter
        </motion.button>
      )}
      <motion.button onClick={onBotConfig} className="flex-1 py-2 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium" whileTap={{ scale: 0.97 }}>
        <Bot size={12} className="inline mr-1" /> Bot
      </motion.button>
      <motion.button onClick={() => onEnd(auction.auction_id)} className="py-2 px-3 rounded-lg bg-red-500/10 text-red-400 text-xs" whileTap={{ scale: 0.97 }}>
        <Square size={12} />
      </motion.button>
      <motion.button onClick={() => onDelete(auction.auction_id)} className="py-2 px-3 rounded-lg bg-white/5 text-white/40 text-xs" whileTap={{ scale: 0.97 }}>
        <Trash2 size={12} />
      </motion.button>
    </div>
  </motion.div>
);

const EmptyState = ({ icon, text }) => (
  <div className="flex flex-col items-center justify-center py-16 text-white/20">
    {icon}
    <p className="mt-3 text-sm">{text}</p>
  </div>
);

const SettingRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
    <span className="text-sm text-white/60">{label}</span>
    <span className="text-sm font-medium">{value}</span>
  </div>
);

const Modal = ({ onClose, title, children }) => (
  <motion.div
    className="fixed inset-0 z-50 flex items-end justify-center"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <div className="absolute inset-0 bg-black/70" onClick={onClose} />
    <motion.div
      className="relative w-full max-w-lg rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto"
      style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)" }}
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <motion.button onClick={onClose} className="p-2 rounded-lg bg-white/5" whileTap={{ scale: 0.9 }}>
          <X size={18} />
        </motion.button>
      </div>
      {children}
    </motion.div>
  </motion.div>
);

export default AuctionAdminPage;
