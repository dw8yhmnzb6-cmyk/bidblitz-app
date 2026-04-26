/**
 * BidBlitz V2 - Ultra Premium Mining Dashboard
 * Inspired by GoMining-style professional crypto mining UI
 * Dark theme with purple/cyan accents, glassmorphism effects
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Cpu, Server, Zap, Flame, Atom, ChevronRight,
  ArrowUpRight, ArrowDownLeft, Send, Gift, Copy, Check,
  Loader2, TrendingUp, Clock, Shield, Star, Wallet, RefreshCw,
  ChevronUp, DollarSign, BarChart3, Users, ShoppingBag,
  CreditCard, Rocket, Lock, Tag, X, Percent, Share2,
  Menu, Settings, Bell, Home, Award, Package, Store, 
  Trophy, HelpCircle, BookOpen, MessageCircle, ChevronDown,
  Activity, Sparkles, Crown, Target, Coins, PiggyBank
} from "lucide-react";
import { useUser, useI18n } from "../store";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;
const sl = { duration: 0.25, ease: [0.32, 0.72, 0, 1] };

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  const text = await r.text();
  let d = {};
  try { d = JSON.parse(text); } catch { }
  if (!r.ok) throw new Error(d.detail || d.message || "Request failed");
  return d;
}

// ══════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ══════════════════════════════════════════════════════════════════════════════

const COLORS = {
  bg: "#030308",
  card: "rgba(15,15,25,0.95)",
  cardBorder: "rgba(255,255,255,0.04)",
  purple: "#8B5CF6",
  purpleGlow: "rgba(139,92,246,0.15)",
  cyan: "#00E5FF",
  cyanGlow: "rgba(0,229,255,0.15)",
  green: "#10B981",
  gold: "#F59E0B",
  text: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.5)",
  textDim: "rgba(255,255,255,0.25)",
};

const TIER_DATA = {
  starter: { icon: Cpu, color: "#10B981", glow: "rgba(16,185,129,0.2)", name: "Starter" },
  pro: { icon: Server, color: "#00E5FF", glow: "rgba(0,229,255,0.2)", name: "Pro" },
  elite: { icon: Zap, color: "#8B5CF6", glow: "rgba(139,92,246,0.2)", name: "Elite" },
  titan: { icon: Flame, color: "#F97316", glow: "rgba(249,115,22,0.2)", name: "Titan" },
  quantum: { icon: Atom, color: "#FFD700", glow: "rgba(255,215,0,0.2)", name: "Quantum" },
};

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

// Glassmorphism Card
function GlassCard({ children, className = "", glow = null, onClick = null }) {
  return (
    <motion.div
      onClick={onClick}
      className={`relative rounded-2xl overflow-hidden ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        background: "linear-gradient(135deg, rgba(20,20,35,0.9) 0%, rgba(10,10,20,0.95) 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: glow ? `0 0 40px ${glow}` : "0 4px 20px rgba(0,0,0,0.3)",
      }}
      whileHover={onClick ? { scale: 1.01, borderColor: "rgba(255,255,255,0.1)" } : {}}
      whileTap={onClick ? { scale: 0.99 } : {}}
    >
      {children}
    </motion.div>
  );
}

// Stat Display
function StatBox({ icon: Icon, label, value, subValue, color = COLORS.cyan }) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 mx-auto mb-2 rounded-xl flex items-center justify-center" 
           style={{ background: `${color}15` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
      <p className="text-[10px] text-white/40 uppercase tracking-wide">{label}</p>
      {subValue && <p className="text-[9px] text-white/25 mt-0.5">{subValue}</p>}
    </div>
  );
}

// Action Button (Circle)
function QuickAction({ icon: Icon, label, color, onClick, badge = null }) {
  return (
    <motion.button
      onClick={onClick}
      className="flex flex-col items-center gap-2"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
           style={{ background: `linear-gradient(135deg, ${color}30, ${color}10)`, border: `1px solid ${color}30` }}>
        <Icon size={24} style={{ color }} />
        {badge && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">{badge}</span>
          </div>
        )}
      </div>
      <span className="text-[11px] text-white/60 font-medium">{label}</span>
    </motion.button>
  );
}

// Mining Package Card
function PackageCard({ pkg, selected, onSelect, isMonthly }) {
  const tierInfo = TIER_DATA[pkg.tier] || TIER_DATA.starter;
  const TierIcon = tierInfo.icon;
  const price = isMonthly ? (pkg.price * 0.7) : pkg.price;
  const discount = isMonthly ? 30 : 0;
  
  return (
    <motion.button
      onClick={() => onSelect(pkg)}
      className="w-full text-left rounded-2xl p-4 transition-all"
      style={{
        background: selected ? `linear-gradient(135deg, ${tierInfo.color}15, ${tierInfo.color}05)` : "rgba(20,20,30,0.5)",
        border: selected ? `2px solid ${tierInfo.color}` : "1px solid rgba(255,255,255,0.05)",
      }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center"
             style={{ background: tierInfo.glow }}>
          <TierIcon size={28} style={{ color: tierInfo.color }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">{pkg.hashrate} TH</span>
            {discount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                -{discount}%
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/40">{pkg.efficiency} W/TH · {pkg.daily_blz?.toFixed(4)} BLZ/Tag</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold" style={{ color: tierInfo.color }}>€{price.toFixed(0)}</p>
          <p className="text-[10px] text-white/30">{pkg.roi_percent}% ROI</p>
        </div>
      </div>
    </motion.button>
  );
}

// Miner Card for "My Miners"
function MinerCard({ miner, onClick }) {
  const tierInfo = TIER_DATA[miner.tier] || TIER_DATA.starter;
  const TierIcon = tierInfo.icon;
  
  return (
    <GlassCard className="p-4" onClick={onClick}>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
             style={{ background: tierInfo.glow }}>
          <TierIcon size={24} style={{ color: tierInfo.color }} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-white">{miner.name || `${tierInfo.name} Miner`}</p>
          <p className="text-[11px] text-white/40">{miner.hashrate} TH/s · {miner.efficiency} W/TH</p>
        </div>
        <div className="text-right">
          <p className="font-bold" style={{ color: COLORS.green }}>+{miner.total_earned?.toFixed(4) || 0}</p>
          <p className="text-[10px] text-white/30">BLZ verdient</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px]">
        <span className="text-white/40">Seit {new Date(miner.created_at).toLocaleDateString('de-DE')}</span>
        <span className="flex items-center gap-1 text-green-400">
          <Activity size={12} /> Aktiv
        </span>
      </div>
    </GlassCard>
  );
}

// Side Navigation Menu
function SideMenu({ isOpen, onClose, onNavigate, activeTab }) {
  const menuItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard' },
    { id: 'miners', icon: Cpu, label: 'Meine Miner' },
    { id: 'shop', icon: Store, label: 'Shop' },
    { id: 'marketplace', icon: ShoppingBag, label: 'Marktplatz' },
    { id: 'earn', icon: PiggyBank, label: 'Simple Earn' },
    { id: 'referral', icon: Users, label: 'Empfehlungen' },
    { id: 'launchpad', icon: Rocket, label: 'Launchpad' },
    { id: 'leaderboard', icon: Trophy, label: 'Bestenliste' },
    { id: 'wallet', icon: Wallet, label: 'Wallet' },
    { id: 'support', icon: MessageCircle, label: 'Support' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Menu Panel */}
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 bottom-0 z-50 w-72"
            style={{ background: "linear-gradient(180deg, #0f0f1a 0%, #080810 100%)" }}
          >
            {/* Header */}
            <div className="p-5 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                  <Sparkles size={24} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-white">BidBlitz Mining</p>
                  <p className="text-[11px] text-white/40">Premium Cloud Mining</p>
                </div>
              </div>
            </div>
            
            {/* Menu Items */}
            <div className="p-3 space-y-1">
              {menuItems.map((item) => (
                <motion.button
                  key={item.id}
                  onClick={() => { onNavigate(item.id); onClose(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                  style={{
                    background: activeTab === item.id ? "rgba(139,92,246,0.15)" : "transparent",
                    color: activeTab === item.id ? COLORS.purple : "rgba(255,255,255,0.6)",
                  }}
                  whileHover={{ background: "rgba(255,255,255,0.05)", x: 4 }}
                >
                  <item.icon size={20} />
                  <span className="text-sm font-medium">{item.label}</span>
                  <ChevronRight size={16} className="ml-auto opacity-30" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Reward History Chart (simplified)
function RewardChart({ data }) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  return (
    <div className="h-32 flex items-end gap-1 px-2">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${(d.value / maxValue) * 100}%` }}
            transition={{ delay: i * 0.05, duration: 0.5 }}
            className="w-full rounded-t-sm"
            style={{
              background: `linear-gradient(180deg, ${COLORS.purple} 0%, ${COLORS.purple}50 100%)`,
              minHeight: 4,
            }}
          />
          <span className="text-[8px] text-white/30">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function MiningPagePro({ onBack }) {
  const { t } = useI18n();
  const user = useUser();
  
  // State
  const [tab, setTab] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [packages, setPackages] = useState([]);
  const [miners, setMiners] = useState([]);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [isMonthly, setIsMonthly] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [simpleEarnEnabled, setSimpleEarnEnabled] = useState(false);
  
  // Crypto prices (simulated)
  const [prices] = useState({
    BTC: { price: 67234.50, change: 2.4 },
    BLZ: { price: 0.0834, change: 5.7 },
    ETH: { price: 3456.78, change: -1.2 },
  });

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashRes, pkgRes, minerRes] = await Promise.all([
        api("/api/mining/dashboard"),
        api("/api/mining/packages"),
        api("/api/mining/my-miners"),
      ]);
      setDashboard(dashRes);
      setPackages(pkgRes.packages || []);
      setMiners(minerRes.miners || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyMiner = async () => {
    if (!selectedPkg) return;
    setPurchasing(true);
    try {
      const price = isMonthly ? (selectedPkg.price * 0.7) : selectedPkg.price;
      await api("/api/mining/buy-miner", {
        method: "POST",
        body: JSON.stringify({ package_id: selectedPkg.id, payment_type: isMonthly ? "monthly" : "once" }),
      });
      toast.success(`${selectedPkg.tier.toUpperCase()} Miner gekauft!`);
      loadData();
      setSelectedPkg(null);
      setTab('miners');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPurchasing(false);
    }
  };

  // Chart data
  const chartData = Array.from({ length: 7 }, (_, i) => ({
    label: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][i],
    value: Math.random() * 0.01 + 0.005,
  }));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.bg }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: COLORS.purple }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ background: COLORS.bg }}>
      {/* Side Menu */}
      <SideMenu 
        isOpen={menuOpen} 
        onClose={() => setMenuOpen(false)} 
        onNavigate={setTab}
        activeTab={tab}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl" style={{ background: "rgba(3,3,8,0.9)" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <button onClick={() => setMenuOpen(true)} className="p-2 -ml-2">
            <Menu size={22} className="text-white/60" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-purple-400" />
            <span className="font-bold">BidBlitz Mining</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 relative">
              <Bell size={20} className="text-white/60" />
              <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
            </button>
            <button className="p-2" onClick={onBack}>
              <X size={20} className="text-white/60" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pb-24">
        <AnimatePresence mode="wait">
          {/* ═══════════════════ DASHBOARD TAB ═══════════════════ */}
          {tab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 space-y-6"
            >
              {/* Main Stats Card */}
              <GlassCard className="p-5" glow={COLORS.purpleGlow}>
                <div className="text-center mb-6">
                  <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Gesamte Rechenleistung</p>
                  <p className="text-5xl font-black" style={{ 
                    background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.cyan})`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent"
                  }}>
                    {dashboard?.total_hashrate?.toFixed(3) || "0.000"} <span className="text-2xl">TH</span>
                  </p>
                  <div className="flex items-center justify-center gap-4 mt-2">
                    <span className="text-[11px] text-white/40">
                      <Zap size={12} className="inline mr-1" style={{ color: COLORS.green }} />
                      {dashboard?.average_efficiency || 15} W/TH
                    </span>
                    <span className="text-[11px] text-green-400">
                      <TrendingUp size={12} className="inline mr-1" />
                      +{dashboard?.daily_earnings?.toFixed(4) || 0} BLZ/Tag
                    </span>
                  </div>
                </div>
                
                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
                  <StatBox icon={Coins} label="Gesamt verdient" value={`${dashboard?.total_earned?.toFixed(4) || 0}`} subValue="BLZ" color={COLORS.green} />
                  <StatBox icon={Cpu} label="Aktive Miner" value={miners.length} color={COLORS.cyan} />
                  <StatBox icon={BarChart3} label="ROI" value={`${dashboard?.average_roi || 0}%`} color={COLORS.purple} />
                </div>
              </GlassCard>

              {/* Quick Actions */}
              <div className="flex justify-around py-2">
                <QuickAction icon={Cpu} label="Miner erstellen" color={COLORS.purple} onClick={() => setTab('shop')} />
                <QuickAction icon={Coins} label="Krypto kaufen" color={COLORS.cyan} onClick={() => {}} />
                <QuickAction icon={PiggyBank} label="Simple Earn" color={COLORS.green} onClick={() => setTab('earn')} badge={simpleEarnEnabled ? null : "!"} />
                <QuickAction icon={Gift} label="Belohnungen" color={COLORS.gold} onClick={() => setTab('rewards')} />
              </div>

              {/* Price Ticker */}
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {Object.entries(prices).map(([symbol, data]) => (
                  <GlassCard key={symbol} className="flex-shrink-0 px-4 py-3 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                        <span className="text-xs font-bold">{symbol}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">${data.price.toLocaleString()}</p>
                        <p className={`text-[10px] ${data.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {data.change >= 0 ? '+' : ''}{data.change}%
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>

              {/* Aktionen Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Aktionen</h3>
                  <button className="text-[11px] text-purple-400 flex items-center gap-1">
                    Alle <ChevronRight size={14} />
                  </button>
                </div>
                <div className="space-y-3">
                  <GlassCard className="p-4" onClick={() => setTab('referral')}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-cyan-500/30 flex items-center justify-center">
                        <Users size={24} className="text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">Empfehlungsprogramm</p>
                        <p className="text-[11px] text-white/40">Verdiene 5% von Käufen deiner Freunde</p>
                      </div>
                      <ChevronRight size={18} className="text-white/20" />
                    </div>
                  </GlassCard>
                  
                  <GlassCard className="p-4" onClick={() => setTab('leaderboard')}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/30 to-orange-500/30 flex items-center justify-center">
                        <Trophy size={24} className="text-yellow-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">Mining Wettbewerb</p>
                        <p className="text-[11px] text-white/40">Top Miner gewinnen BLZ Preise</p>
                      </div>
                      <ChevronRight size={18} className="text-white/20" />
                    </div>
                  </GlassCard>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════ SHOP TAB ═══════════════════ */}
          {tab === 'shop' && (
            <motion.div
              key="shop"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 space-y-4"
            >
              <div className="text-center py-4">
                <h2 className="text-2xl font-bold mb-1">Miner erstellen</h2>
                <p className="text-sm text-white/40">Wähle dein Mining-Paket</p>
              </div>

              {/* Payment Toggle */}
              <div className="flex items-center justify-center gap-2 p-1 bg-white/5 rounded-xl">
                <button
                  onClick={() => setIsMonthly(false)}
                  className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: !isMonthly ? "linear-gradient(135deg, #8B5CF6, #7C3AED)" : "transparent",
                    color: !isMonthly ? "#fff" : "rgba(255,255,255,0.5)",
                  }}
                >
                  Einmalig
                </button>
                <button
                  onClick={() => setIsMonthly(true)}
                  className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all relative"
                  style={{
                    background: isMonthly ? "linear-gradient(135deg, #8B5CF6, #7C3AED)" : "transparent",
                    color: isMonthly ? "#fff" : "rgba(255,255,255,0.5)",
                  }}
                >
                  Monatlich
                  <span className="absolute -top-2 -right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-500 text-black">
                    -30%
                  </span>
                </button>
              </div>

              {/* Packages */}
              <div className="space-y-3">
                {packages.map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    selected={selectedPkg?.id === pkg.id}
                    onSelect={setSelectedPkg}
                    isMonthly={isMonthly}
                  />
                ))}
              </div>

              {/* Buy Button */}
              {selectedPkg && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="fixed bottom-20 left-4 right-4"
                >
                  <button
                    onClick={handleBuyMiner}
                    disabled={purchasing}
                    className="w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2"
                    style={{
                      background: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
                    }}
                  >
                    {purchasing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Jetzt kaufen · €{isMonthly ? (selectedPkg.price * 0.7).toFixed(0) : selectedPkg.price}
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ═══════════════════ MY MINERS TAB ═══════════════════ */}
          {tab === 'miners' && (
            <motion.div
              key="miners"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 space-y-4"
            >
              {/* Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {['Übersicht', 'Belohnungen', 'Verkauf'].map((label, i) => (
                  <button
                    key={label}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                      i === 0 ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-white/50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Stats Summary */}
              <GlassCard className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-white/40 uppercase">Gesamt Belohnung</p>
                    <p className="text-xl font-bold text-green-400">{dashboard?.total_earned?.toFixed(4) || 0} BLZ</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase">Aktive Miner</p>
                    <p className="text-xl font-bold">{miners.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase">Leistung</p>
                    <p className="text-xl font-bold" style={{ color: COLORS.cyan }}>{dashboard?.total_hashrate?.toFixed(3) || 0} TH/s</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase">Mittlerer Wirkungsgrad</p>
                    <p className="text-xl font-bold">{dashboard?.average_efficiency || 15} W/TH</p>
                  </div>
                </div>
              </GlassCard>

              {/* Reward Chart */}
              <GlassCard className="p-4">
                <p className="text-sm font-semibold mb-3">Belohnungsverlauf (7 Tage)</p>
                <RewardChart data={chartData} />
              </GlassCard>

              {/* Miners List */}
              <div className="space-y-3">
                {miners.length === 0 ? (
                  <div className="text-center py-12">
                    <Cpu size={48} className="mx-auto mb-4 text-white/10" />
                    <p className="text-white/40">Noch keine Miner</p>
                    <button 
                      onClick={() => setTab('shop')}
                      className="mt-4 px-6 py-2 rounded-xl bg-purple-500/20 text-purple-400 text-sm font-medium"
                    >
                      Ersten Miner kaufen
                    </button>
                  </div>
                ) : (
                  miners.map((miner) => (
                    <MinerCard key={miner.miner_id} miner={miner} onClick={() => {}} />
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* ═══════════════════ SIMPLE EARN TAB ═══════════════════ */}
          {tab === 'earn' && (
            <motion.div
              key="earn"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 space-y-4"
            >
              {/* Hero Card */}
              <GlassCard className="p-5 text-center" glow={COLORS.cyanGlow}>
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-green-500/30 flex items-center justify-center">
                  <PiggyBank size={32} className="text-cyan-400" />
                </div>
                <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Bis zu</p>
                <p className="text-4xl font-black text-cyan-400">14.38% <span className="text-lg">p.a.</span></p>
                <p className="text-sm text-white/50 mt-2">Verdiene passiv mit deinen Krypto-Assets</p>
              </GlassCard>

              {/* Benefits */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: RefreshCw, label: "Auto-Rewards", desc: "Täglich automatisch" },
                  { icon: Lock, label: "Keine Sperrfrist", desc: "Jederzeit abheben" },
                  { icon: Shield, label: "Sicher", desc: "Verschlüsselt" },
                  { icon: Coins, label: "Flexible Assets", desc: "BTC, ETH, BLZ" },
                ].map((item, i) => (
                  <GlassCard key={i} className="p-4">
                    <item.icon size={20} className="text-cyan-400 mb-2" />
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="text-[10px] text-white/40">{item.desc}</p>
                  </GlassCard>
                ))}
              </div>

              {/* Enable Toggle */}
              <GlassCard className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Simple Earn aktivieren</p>
                    <p className="text-[11px] text-white/40">Starte sofort mit dem Verdienen</p>
                  </div>
                  <button
                    onClick={() => setSimpleEarnEnabled(!simpleEarnEnabled)}
                    className="w-14 h-8 rounded-full p-1 transition-all"
                    style={{
                      background: simpleEarnEnabled 
                        ? "linear-gradient(135deg, #00E5FF, #10B981)" 
                        : "rgba(255,255,255,0.1)"
                    }}
                  >
                    <motion.div
                      className="w-6 h-6 rounded-full bg-white shadow-lg"
                      animate={{ x: simpleEarnEnabled ? 24 : 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              </GlassCard>

              {simpleEarnEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 text-center"
                >
                  <Check size={32} className="mx-auto mb-2 text-green-400" />
                  <p className="font-semibold text-green-400">Simple Earn ist aktiv!</p>
                  <p className="text-[11px] text-white/40 mt-1">Deine Rewards werden täglich gutgeschrieben.</p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ═══════════════════ REFERRAL TAB ═══════════════════ */}
          {tab === 'referral' && (
            <motion.div
              key="referral"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 space-y-4"
            >
              <GlassCard className="p-5 text-center" glow={COLORS.purpleGlow}>
                <Users size={40} className="mx-auto mb-3 text-purple-400" />
                <h2 className="text-xl font-bold mb-1">Empfehlungsprogramm</h2>
                <p className="text-sm text-white/40 mb-4">Verdiene 5% von allen Käufen deiner Freunde</p>
                
                <div className="bg-white/5 rounded-xl p-3 mb-4">
                  <p className="text-[10px] text-white/40 uppercase mb-1">Dein Empfehlungscode</p>
                  <div className="flex items-center justify-center gap-2">
                    <code className="text-lg font-mono font-bold text-purple-400">
                      {dashboard?.referral_code || "BIDBLITZ123"}
                    </code>
                    <button className="p-2 rounded-lg bg-purple-500/20">
                      <Copy size={16} className="text-purple-400" />
                    </button>
                  </div>
                </div>
                
                <button className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                        style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)" }}>
                  <Share2 size={18} />
                  Link teilen
                </button>
              </GlassCard>

              <div className="grid grid-cols-2 gap-3">
                <GlassCard className="p-4 text-center">
                  <p className="text-2xl font-bold text-purple-400">{dashboard?.referral_count || 0}</p>
                  <p className="text-[11px] text-white/40">Eingeladen</p>
                </GlassCard>
                <GlassCard className="p-4 text-center">
                  <p className="text-2xl font-bold text-green-400">€{dashboard?.referral_earnings?.toFixed(2) || 0}</p>
                  <p className="text-[11px] text-white/40">Verdient</p>
                </GlassCard>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl border-t border-white/5"
           style={{ background: "rgba(3,3,8,0.95)" }}>
        <div className="flex justify-around py-2">
          {[
            { id: 'dashboard', icon: Home, label: 'Home' },
            { id: 'miners', icon: Cpu, label: 'Miner' },
            { id: 'shop', icon: Store, label: 'Shop' },
            { id: 'earn', icon: PiggyBank, label: 'Earn' },
            { id: 'wallet', icon: Wallet, label: 'Wallet' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className="flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all"
              style={{
                color: tab === item.id ? COLORS.purple : "rgba(255,255,255,0.4)",
              }}
            >
              <item.icon size={22} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
