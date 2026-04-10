import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Shield, Eye, CreditCard, Zap,
  Check, Star, Crown, Loader2, Users, PlusCircle,
  TrendingDown, Wallet, Clock, BarChart3, Lock,
  Send, Settings, ChevronRight, RefreshCw, Unlock,
  Filter, ShoppingBag, ArrowUpRight, ArrowDownLeft, Bell, Key
} from "lucide-react";
import { useI18n, useUser } from "../store";
import { api } from "../services/api";
import ChildWalletModal from "../components/ChildWalletModal";
import KidsNotifications from "../components/KidsNotifications";

const slide = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };

const BENEFITS = [
  { icon: Shield, key: "parental_control" },
  { icon: Eye, key: "spending_limits" },
  { icon: CreditCard, key: "txn_tracking" },
  { icon: Zap, key: "safe_payments" },
];

// ── Kids Dashboard (post-subscription) ──
const KidsDashboard = ({ onBack, t, subStatus }) => {
  const user = useUser();
  const [children, setChildren] = useState([]);
  const [childWallets, setChildWallets] = useState({});
  const [globalActivity, setGlobalActivity] = useState([]);
  const [activityFilter, setActivityFilter] = useState('all');
  const [showAddChild, setShowAddChild] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showLimits, setShowLimits] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSetPin, setShowSetPin] = useState(null);
  const [pinValue, setPinValue] = useState('');
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [newChildName, setNewChildName] = useState("");
  const [newChildLimit, setNewChildLimit] = useState(15);
  const [newChildYear, setNewChildYear] = useState("");
  const [newChildEmoji, setNewChildEmoji] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [walletChild, setWalletChild] = useState(null);
  const [sendMoneyChild, setSendMoneyChild] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const CHILD_EMOJIS = ["👦", "👧", "🧒", "👶", "🐻", "🦊", "🐰", "🐱", "🦁", "🐶"];

  // Load children and their wallet data
  const loadChildren = useCallback(async () => {
    try {
      const d = await api.listChildren();
      const childList = d.children || [];
      setChildren(childList);
      
      // Load wallet data for each child
      const walletPromises = childList.map(async (child) => {
        try {
          const wallet = await api.getChildWallet(child.child_id);
          return { childId: child.child_id, wallet };
        } catch {
          return { childId: child.child_id, wallet: null };
        }
      });
      
      const walletResults = await Promise.all(walletPromises);
      const walletsMap = {};
      walletResults.forEach(r => {
        if (r.wallet) walletsMap[r.childId] = r.wallet;
      });
      setChildWallets(walletsMap);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load global activity
  const loadGlobalActivity = useCallback(async () => {
    try {
      const activities = [];
      for (const child of children) {
        try {
          const data = await api.getChildActivity(child.child_id, 14);
          if (data.transactions) {
            data.transactions.forEach(tx => {
              activities.push({ ...tx, childName: child.name, childAvatar: child.avatar, childColor: child.color });
            });
          }
        } catch {
          // skip
        }
      }
      // Sort by date
      activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setGlobalActivity(activities);
    } catch {
      // silent
    }
  }, [children]);

  useEffect(() => {
    loadChildren();
    // Load notification count
    loadNotificationCount();
  }, [loadChildren]);

  const loadNotificationCount = async () => {
    try {
      const data = await api.getKidsNotifications(1, true);
      setUnreadNotifications(data.unread_count || 0);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    if (children.length > 0 && showActivity) {
      loadGlobalActivity();
    }
  }, [children, showActivity, loadGlobalActivity]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadChildren();
    loadNotificationCount();
  };

  const handleSetPin = async (childId) => {
    if (pinValue.length < 4) {
      setError('PIN muss mindestens 4 Ziffern haben');
      return;
    }
    try {
      await api.setChildPin(childId, pinValue);
      setSuccess('PIN gesetzt! Teile deinem Kind die Kind-ID und den PIN mit.');
      setPinValue('');
      setShowSetPin(null);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setNewChildName("");
    setNewChildLimit(15);
    setNewChildYear("");
    setNewChildEmoji("");
    setError(null);
  };

  const addChild = async () => {
    const name = newChildName.trim();
    if (!name) {
      setError(t("kids.error_name_required") || "Name ist erforderlich");
      return;
    }
    if (saving) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const payload = { name, weekly_limit: newChildLimit };
      if (newChildYear) payload.birth_year = parseInt(newChildYear);
      if (newChildEmoji) payload.avatar_emoji = newChildEmoji;
      
      const child = await api.createChild(payload);
      setChildren(prev => [...prev, child]);
      resetForm();
      setShowAddChild(false);
      setSuccess(`${name} wurde hinzugefügt!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || "Fehler beim Erstellen");
    } finally {
      setSaving(false);
    }
  };

  const handleFreezeToggle = async (childId, e) => {
    e.stopPropagation();
    try {
      const result = await api.freezeChild(childId);
      setChildren(prev => prev.map(c => 
        c.child_id === childId ? { ...c, is_frozen: result.is_frozen } : c
      ));
      setSuccess(result.message);
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 2000);
    }
  };

  const removeChild = async (childId) => {
    setChildren(prev => prev.filter(c => c.child_id !== childId));
    try {
      await api.deleteChild(childId);
    } catch {
      // silent
    }
  };

  // Calculate totals
  const totalBalance = children.reduce((s, c) => s + (childWallets[c.child_id]?.balance || c.balance || 0), 0);
  const totalChildren = children.length;
  const activeChildren = children.filter(c => !c.is_frozen).length;
  const blockedChildren = children.filter(c => c.is_frozen).length;
  const totalWeeklyLimit = children.reduce((s, c) => s + (c.weekly_limit || 0), 0);
  const totalWeekSpent = children.reduce((s, c) => s + (childWallets[c.child_id]?.week_spent || c.spent || 0), 0);

  const expiresAt = subStatus?.expires_at;
  const trialDaysLeft = subStatus?.status === "trial" && expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt) - new Date()) / 86400000)) : null;

  // Filter activity
  const filteredActivity = activityFilter === 'all' 
    ? globalActivity 
    : globalActivity.filter(tx => tx.child_id === activityFilter);

  return (
    <motion.div data-testid="kids-dashboard" className="min-h-screen relative" style={{ background: "#030303" }}
      initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={slide}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 relative z-10">
        <motion.button data-testid="kids-dashboard-back" className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
          whileTap={{ scale: 0.88 }} onClick={onBack}>
          <ChevronLeft size={15} strokeWidth={1.5} className="text-white/50" />
        </motion.button>
        <h1 className="text-[15px] font-semibold font-outfit text-white tracking-tight">BidBlitz Kids</h1>
        <div className="ml-auto flex items-center gap-2">
          {/* Notifications Button */}
          <motion.button 
            onClick={() => setShowNotifications(true)}
            className="w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center relative"
            whileTap={{ scale: 0.9 }}
          >
            <Bell size={14} className="text-white/40" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#00C2FF] text-black text-[9px] font-bold flex items-center justify-center">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </motion.button>
          <motion.button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
          >
            <RefreshCw size={14} className={`text-white/40 ${refreshing ? 'animate-spin' : ''}`} />
          </motion.button>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#FFD700]/10">
            <Crown size={12} className="text-[#FFD700]" />
            <span data-testid="kids-sub-status" className="text-[10px] text-[#FFD700] font-semibold uppercase tracking-wider">
              {subStatus?.status === "trial" ? `Trial (${trialDaysLeft}d)` : "Aktiv"}
            </span>
          </div>
        </div>
      </div>

      <div className="px-5 pb-28 space-y-4">
        {/* Success/Error messages */}
        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-2">
              <Check size={16} className="text-green-400" />
              <span className="text-green-400 text-[12px] font-medium">{success}</span>
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
              <span className="text-red-400 text-[12px] font-medium">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={22} className="text-[#00C2FF] animate-spin" />
          </div>
        ) : (<>
        
        {/* 1. FAMILY OVERVIEW */}
        <motion.div 
          className="rounded-2xl p-5 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(0,194,255,0.08), rgba(168,85,247,0.08))", border: "1px solid rgba(0,194,255,0.15)" }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
        >
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full" style={{ background: "rgba(0,194,255,0.1)", filter: "blur(40px)" }} />
          <div className="relative z-10">
            <p className="text-[10px] text-[#666] font-medium uppercase tracking-wider mb-1">Familien-Guthaben</p>
            <p className="text-[32px] font-bold text-white font-outfit">€{totalBalance.toFixed(2)}</p>
            
            {/* Stats row */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5">
              <div className="flex items-center gap-1.5">
                <Users size={14} className="text-[#00C2FF]" />
                <span className="text-[12px] text-white/70">{totalChildren} Kinder</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-[12px] text-white/70">{activeChildren} aktiv</span>
              </div>
              {blockedChildren > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-[12px] text-white/70">{blockedChildren} gesperrt</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* 2. QUICK ACTIONS */}
        <motion.div 
          className="grid grid-cols-4 gap-2"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
        >
          <motion.button
            onClick={() => children.length > 0 ? setSendMoneyChild(children[0]) : setShowAddChild(true)}
            className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-[#00C2FF]/10 border border-[#00C2FF]/20"
            whileTap={{ scale: 0.95 }}
          >
            <Send size={18} className="text-[#00C2FF]" />
            <span className="text-[9px] text-[#00C2FF] font-semibold">Senden</span>
          </motion.button>
          <motion.button
            onClick={() => setShowAddChild(true)}
            className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-[#A855F7]/10 border border-[#A855F7]/20"
            whileTap={{ scale: 0.95 }}
          >
            <PlusCircle size={18} className="text-[#A855F7]" />
            <span className="text-[9px] text-[#A855F7] font-semibold">Kind +</span>
          </motion.button>
          <motion.button
            onClick={() => setShowActivity(!showActivity)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border ${showActivity ? 'bg-[#FFB800]/20 border-[#FFB800]/30' : 'bg-[#FFB800]/10 border-[#FFB800]/20'}`}
            whileTap={{ scale: 0.95 }}
          >
            <Clock size={18} className="text-[#FFB800]" />
            <span className="text-[9px] text-[#FFB800] font-semibold">Aktivität</span>
          </motion.button>
          <motion.button
            onClick={() => setShowLimits(!showLimits)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border ${showLimits ? 'bg-[#00D26A]/20 border-[#00D26A]/30' : 'bg-[#00D26A]/10 border-[#00D26A]/20'}`}
            whileTap={{ scale: 0.95 }}
          >
            <Settings size={18} className="text-[#00D26A]" />
            <span className="text-[9px] text-[#00D26A] font-semibold">Limits</span>
          </motion.button>
        </motion.div>

        {/* 5. LIMIT SUMMARY (Collapsible) */}
        <AnimatePresence>
          {showLimits && children.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl p-4" style={{ background: "rgba(0,210,106,0.04)", border: "1px solid rgba(0,210,106,0.12)" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] text-[#00D26A] font-semibold uppercase tracking-wider">Limit-Übersicht</p>
                  <p className="text-[10px] text-[#444]">Gesamt: €{totalWeekSpent.toFixed(2)} / €{totalWeeklyLimit.toFixed(2)}</p>
                </div>
                <div className="space-y-2">
                  {children.map(child => {
                    const wallet = childWallets[child.child_id];
                    const dailyLimit = wallet?.daily_limit || 20;
                    const todaySpent = wallet?.today_spent || 0;
                    const remainingToday = Math.max(0, dailyLimit - todaySpent);
                    const pctToday = dailyLimit > 0 ? Math.min(100, (todaySpent / dailyLimit) * 100) : 0;
                    
                    return (
                      <div key={child.child_id} className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.02]">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px]"
                          style={{ background: `${child.color}20`, border: `1px solid ${child.color}40` }}>
                          {child.avatar || child.name?.[0]}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] text-white font-medium">{child.name}</span>
                            <span className="text-[10px] text-[#00D26A]">€{remainingToday.toFixed(2)} übrig</span>
                          </div>
                          <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full bg-[#00D26A]" style={{ width: `${pctToday}%` }} />
                          </div>
                          <p className="text-[9px] text-[#444] mt-0.5">Heute: €{todaySpent.toFixed(2)} / €{dailyLimit}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 4. GLOBAL ACTIVITY VIEW (Collapsible) */}
        <AnimatePresence>
          {showActivity && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl p-4" style={{ background: "rgba(255,184,0,0.04)", border: "1px solid rgba(255,184,0,0.12)" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] text-[#FFB800] font-semibold uppercase tracking-wider">Aktivitäten</p>
                  {/* Filter */}
                  <div className="flex items-center gap-1">
                    <Filter size={12} className="text-[#444]" />
                    <select
                      value={activityFilter}
                      onChange={(e) => setActivityFilter(e.target.value)}
                      className="text-[10px] bg-transparent text-white/70 outline-none cursor-pointer"
                    >
                      <option value="all">Alle Kinder</option>
                      {children.map(c => (
                        <option key={c.child_id} value={c.child_id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {filteredActivity.length === 0 ? (
                  <p className="text-[11px] text-[#444] text-center py-4">Keine Aktivitäten in den letzten 14 Tagen</p>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {filteredActivity.slice(0, 20).map((tx, i) => (
                      <div key={tx.id || i} className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.02]">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.amount > 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                          {tx.amount > 0 ? <ArrowDownLeft size={14} className="text-green-400" /> : <ArrowUpRight size={14} className="text-red-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-white font-medium truncate">{tx.merchant_name || tx.description}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[9px] text-[#444]">
                            <span style={{ color: tx.childColor }}>{tx.childName}</span>
                            <span>•</span>
                            <span>{new Date(tx.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                        <span className={`text-[12px] font-bold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {tx.amount > 0 ? '+' : ''}€{Math.abs(tx.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3. CHILD LIST (Improved) */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2.5 pl-1">Kinder</p>

          {children.length === 0 && !showAddChild && (
            <motion.div className="rounded-2xl p-6 text-center" style={{ background: "rgba(255,255,255,0.01)", border: "1px dashed rgba(255,255,255,0.06)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Users size={28} className="text-[#222] mx-auto mb-2" />
              <p className="text-[12px] text-[#444] font-medium mb-1">Noch keine Kinder hinzugefügt</p>
              <p className="text-[10px] text-[#333]">Füge dein erstes Kind hinzu</p>
            </motion.div>
          )}

          <div className="space-y-2.5">
            {children.map((child) => {
              const wallet = childWallets[child.child_id];
              const balance = wallet?.balance || child.balance || 0;
              const todaySpent = wallet?.today_spent || 0;
              const weekSpent = wallet?.week_spent || child.spent || 0;
              const weeklyLimit = child.weekly_limit || 50;
              const pct = weeklyLimit > 0 ? Math.min(100, (weekSpent / weeklyLimit) * 100) : 0;
              const danger = pct > 80;
              const isFrozen = child.is_frozen || false;
              
              return (
                <motion.div 
                  key={child.child_id} 
                  data-testid={`child-card-${child.child_id}`}
                  className={`rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform ${isFrozen ? 'opacity-70' : ''}`}
                  style={{
                    background: isFrozen ? "rgba(255,71,87,0.03)" : "rgba(255,255,255,0.015)",
                    border: `1px solid ${isFrozen ? "rgba(255,71,87,0.15)" : "rgba(255,255,255,0.035)"}`,
                  }}
                  onClick={() => setWalletChild(child)}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Header Row - Clickable to open details */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-[16px] font-bold text-white relative"
                      style={{ background: `${child.color}20`, border: `2px solid ${child.color}50` }}>
                      {child.avatar || child.name?.[0]}
                      {isFrozen && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                          <Lock size={10} className="text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-semibold text-white">{child.name}</p>
                        {isFrozen ? (
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">GESPERRT</span>
                        ) : (
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-bold">AKTIV</span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#555]">Heute: €{todaySpent.toFixed(2)} ausgegeben</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[18px] font-bold text-[#00C2FF]">€{balance.toFixed(2)}</p>
                      <p className="text-[9px] text-[#444]">Guthaben</p>
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] text-[#444]">Wochenlimit</span>
                      <span className="text-[9px] text-[#444]">€{weekSpent.toFixed(2)} / €{weeklyLimit}</span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <motion.div 
                        className="h-full rounded-full" 
                        style={{ background: danger ? "#FF4757" : child.color }}
                        initial={{ width: 0 }} 
                        animate={{ width: `${pct}%` }} 
                        transition={{ duration: 0.8, ease: "easeOut" }} 
                      />
                    </div>
                  </div>
                  
                  {/* Quick Action Buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    <motion.button
                      className="py-2.5 rounded-xl text-[10px] font-semibold bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20 flex items-center justify-center gap-1"
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => { e.stopPropagation(); setWalletChild(child); }}
                    >
                      <Send size={11} /> Senden
                    </motion.button>
                    <motion.button
                      className="py-2.5 rounded-xl text-[10px] font-semibold bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/20 flex items-center justify-center gap-1"
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => { e.stopPropagation(); setWalletChild(child); }}
                    >
                      <Eye size={11} /> Details
                    </motion.button>
                    <motion.button
                      className="py-2.5 rounded-xl text-[10px] font-semibold bg-[#FFB800]/10 text-[#FFB800] border border-[#FFB800]/20 flex items-center justify-center gap-1"
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => { e.stopPropagation(); setShowSetPin(child); }}
                    >
                      <Key size={11} /> PIN
                    </motion.button>
                    <motion.button
                      className={`py-2.5 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 ${
                        isFrozen 
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => handleFreezeToggle(child.child_id, e)}
                    >
                      {isFrozen ? <Unlock size={11} /> : <Lock size={11} />}
                      {isFrozen ? 'Aktiv' : 'Sperren'}
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Add child form */}
          <AnimatePresence>
            {showAddChild ? (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-2.5 rounded-2xl p-4 space-y-3"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,194,255,0.15)" }}>
                
                <div className="flex items-center gap-2 mb-1">
                  <PlusCircle size={16} className="text-[#00C2FF]" />
                  <span className="text-[13px] font-semibold text-white">Neues Kind hinzufügen</span>
                </div>
                
                {error && (
                  <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px]">
                    {error}
                  </div>
                )}
                
                <div>
                  <label className="text-[10px] text-[#444] font-medium mb-1 block">Name</label>
                  <input data-testid="add-child-name" value={newChildName} onChange={e => setNewChildName(e.target.value)}
                    placeholder="Name des Kindes"
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] text-white/90 placeholder-[#333] font-medium outline-none"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
                    onKeyDown={e => e.key === "Enter" && addChild()} />
                </div>
                
                <div>
                  <label className="text-[10px] text-[#444] font-medium mb-1.5 block">Avatar</label>
                  <div className="flex flex-wrap gap-2">
                    {CHILD_EMOJIS.map((emoji) => (
                      <button key={emoji} type="button"
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                          newChildEmoji === emoji ? 'bg-[#00C2FF]/20 border-[#00C2FF]/40 scale-110' : 'bg-white/[0.02] border-white/[0.05]'
                        } border`}
                        onClick={() => setNewChildEmoji(newChildEmoji === emoji ? "" : emoji)}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="text-[10px] text-[#444] font-medium mb-1 block">Geburtsjahr (optional)</label>
                  <select value={newChildYear} onChange={e => setNewChildYear(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] text-white/90 font-medium outline-none appearance-none cursor-pointer"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <option value="">Jahr auswählen</option>
                    {Array.from({ length: 18 }, (_, i) => 2024 - i).map(year => (
                      <option key={year} value={year}>{year} ({2024 - year} Jahre)</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] text-[#444] font-medium">Wochenlimit</label>
                    <span className="text-[12px] font-bold text-[#00C2FF]">€{newChildLimit}</span>
                  </div>
                  <input type="range" min={5} max={100} step={5} value={newChildLimit}
                    onChange={e => setNewChildLimit(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#00C2FF]"
                    style={{ background: "rgba(255,255,255,0.06)" }} />
                  <div className="flex justify-between text-[9px] text-[#333] mt-1">
                    <span>€5</span>
                    <span>€100</span>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-1">
                  <motion.button data-testid="add-child-confirm" onClick={addChild} disabled={saving || !newChildName.trim()}
                    className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold bg-[#00C2FF] text-black flex items-center justify-center gap-1.5 disabled:opacity-40"
                    whileTap={{ scale: 0.97 }}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Kind speichern
                  </motion.button>
                  <motion.button onClick={() => { setShowAddChild(false); resetForm(); }}
                    className="px-4 py-2.5 rounded-xl text-[12px] font-medium text-[#666] bg-white/[0.03] border border-white/[0.06]"
                    whileTap={{ scale: 0.97 }}>Abbrechen</motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.button data-testid="add-child-btn" onClick={() => setShowAddChild(true)}
                className="w-full mt-2.5 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-[12px] font-semibold text-[#00C2FF] bg-[#00C2FF]/5 border border-[#00C2FF]/15"
                whileTap={{ scale: 0.98 }}>
                <PlusCircle size={16} /> Kind hinzufügen
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
        </>)}
      </div>

      {/* Child Wallet Modal */}
      <AnimatePresence>
        {walletChild && (
          <ChildWalletModal
            child={walletChild}
            onClose={() => setWalletChild(null)}
            onUpdate={loadChildren}
          />
        )}
      </AnimatePresence>

      {/* Notifications Modal */}
      <AnimatePresence>
        {showNotifications && (
          <KidsNotifications 
            onClose={() => { setShowNotifications(false); loadNotificationCount(); }} 
          />
        )}
      </AnimatePresence>

      {/* Set PIN Modal */}
      <AnimatePresence>
        {showSetPin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setShowSetPin(null); setPinValue(''); }} />
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-[#0A0A0A] rounded-2xl border border-white/10 p-5"
            >
              <h3 className="text-lg font-bold text-white mb-2">Kind-PIN setzen</h3>
              <p className="text-xs text-gray-400 mb-4">
                Setze einen 4-6 stelligen PIN für <strong className="text-white">{showSetPin.name}</strong>, 
                damit dein Kind sich in der Kids-App anmelden kann.
              </p>
              
              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-2 block">PIN (4-6 Ziffern)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pinValue}
                  onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                  placeholder="****"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center text-2xl tracking-[0.5em] placeholder-gray-600 outline-none focus:border-[#00C2FF]/50"
                />
              </div>
              
              <div className="p-3 rounded-xl bg-[#00C2FF]/5 border border-[#00C2FF]/10 mb-4">
                <p className="text-[11px] text-gray-400">
                  <strong className="text-white">Kind-ID:</strong> 
                  <span className="font-mono ml-1 text-[#00C2FF]">{showSetPin.child_id}</span>
                </p>
                <p className="text-[10px] text-gray-500 mt-1">
                  Teile diese ID und den PIN mit deinem Kind für die Kids-App.
                </p>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowSetPin(null); setPinValue(''); }}
                  className="flex-1 py-3 bg-white/5 rounded-xl text-sm text-gray-400 font-medium"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => handleSetPin(showSetPin.child_id)}
                  disabled={pinValue.length < 4}
                  className="flex-1 py-3 bg-[#00C2FF] rounded-xl text-sm font-bold text-black disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <Key size={14} /> PIN setzen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const KidsPaywall = ({ onBack, onSubscribed }) => {
  const { t } = useI18n();
  const user = useUser();
  const [plan, setPlan] = useState("yearly");
  const [loading, setLoading] = useState(false);
  const [subStatus, setSubStatus] = useState(null);
  const [trialLoading, setTrialLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [showDashboard, setShowDashboard] = useState(false);

  useEffect(() => {
    api.getKidsSubscription().then(d => {
      setSubStatus(d);
      if (d.status === "active" || d.status === "trial") {
        setShowDashboard(true);
      }
    }).catch(() => {}).finally(() => setCheckingStatus(false));
  }, []);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const origin = window.location.origin;
      const data = await api.createKidsCheckout({ plan, origin_url: origin });
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (e) {
      setLoading(false);
    }
  };

  const handleTrial = async () => {
    setTrialLoading(true);
    try {
      const data = await api.startKidsTrial();
      setSubStatus({ status: "trial", plan: "trial", trial_available: false, expires_at: data.expires_at, started_at: new Date().toISOString() });
      setShowDashboard(true);
    } catch {
      setTrialLoading(false);
    }
  };

  // Handle Stripe checkout return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kidsResult = params.get("kids_sub");
    const sessionId = params.get("session_id");
    if (kidsResult === "success" && sessionId) {
      window.history.replaceState({}, "", window.location.pathname);
      api.verifyKidsCheckout(sessionId).then(d => {
        if (d.status === "active") {
          setSubStatus({ status: "active", plan: d.plan, trial_available: false, expires_at: d.expires_at });
          setShowDashboard(true);
        }
      }).catch(() => {});
    }
  }, []);

  if (checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#030303" }}>
        <Loader2 size={24} className="text-[#00C2FF] animate-spin" />
      </div>
    );
  }

  if (showDashboard) {
    return <KidsDashboard onBack={onBack} t={t} subStatus={subStatus} />;
  }

  return (
    <motion.div
      data-testid="kids-paywall"
      className="min-h-screen relative"
      style={{ background: "#030303" }}
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={slide}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 relative z-10">
        <motion.button
          data-testid="kids-paywall-back"
          className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
          whileTap={{ scale: 0.88 }}
          onClick={onBack}
        >
          <ChevronLeft size={15} strokeWidth={1.5} className="text-white/50" />
        </motion.button>
        <h1 className="text-[15px] font-semibold font-outfit text-white tracking-tight">{t("kids.title")}</h1>
      </div>

      <div className="px-5 pb-8 relative z-10 space-y-5">
        {/* Hero */}
        <motion.div
          className="rounded-2xl p-5 relative overflow-hidden text-center"
          style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.06), rgba(0,194,255,0.06))", border: "1px solid rgba(168,85,247,0.1)" }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, ...slide }}
        >
          <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full pointer-events-none" style={{ background: "rgba(168,85,247,0.12)", filter: "blur(35px)" }} />
          <motion.div
            className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Users size={26} strokeWidth={1.5} className="text-purple-400" />
          </motion.div>
          <h2 className="text-[18px] font-bold text-white font-outfit mb-1">{t("kids.hero_title")}</h2>
          <p className="text-[12px] text-[#555] font-medium">{t("kids.hero_desc")}</p>
        </motion.div>

        {/* Expired notice */}
        {subStatus?.status === "expired" && (
          <motion.div data-testid="kids-expired-notice"
            className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ background: "rgba(255,71,87,0.06)", border: "1px solid rgba(255,71,87,0.12)" }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <Clock size={16} className="text-[#FF4757] flex-shrink-0" />
            <p className="text-[12px] text-[#FF4757] font-medium">{t("kids.expired_notice")}</p>
          </motion.div>
        )}

        {/* Benefits */}
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, ...slide }}
        >
          <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2 pl-1">{t("kids.benefits_title")}</p>
          {BENEFITS.map((b, i) => (
            <motion.div
              key={b.key}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.14 + i * 0.04, ...slide }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.12)" }}>
                <b.icon size={14} strokeWidth={1.5} className="text-purple-400" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-white/85">{t(`kids.benefit_${b.key}`)}</p>
              </div>
              <Check size={14} className="text-[#00D26A] ml-auto flex-shrink-0" />
            </motion.div>
          ))}
        </motion.div>

        {/* Plan selector */}
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, ...slide }}
        >
          <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2 pl-1">{t("kids.choose_plan")}</p>

          {/* Yearly */}
          <motion.button
            data-testid="kids-plan-yearly"
            className="w-full rounded-xl p-4 text-left relative overflow-hidden"
            style={{
              background: plan === "yearly" ? "rgba(168,85,247,0.06)" : "rgba(255,255,255,0.015)",
              border: `1px solid ${plan === "yearly" ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.035)"}`,
            }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setPlan("yearly")}
          >
            {plan === "yearly" && (
              <motion.div
                className="absolute top-0 right-0 px-2.5 py-0.5 rounded-bl-lg text-[9px] font-bold"
                style={{ background: "rgba(168,85,247,0.2)", color: "#A855F7" }}
                layoutId="bestValue"
              >
                {t("kids.best_value")}
              </motion.div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Crown size={14} className="text-purple-400" />
                  <p className="text-[13px] font-semibold text-white">{t("kids.yearly")}</p>
                </div>
                <p className="text-[10px] text-[#555] font-medium mt-0.5">{t("kids.yearly_save")}</p>
              </div>
              <div className="text-right">
                <p className="text-[18px] font-bold font-outfit" style={{ color: plan === "yearly" ? "#A855F7" : "rgba(255,255,255,0.7)" }}>49.99</p>
                <p className="text-[10px] text-[#444] font-medium">EUR / {t("kids.year")}</p>
              </div>
            </div>
          </motion.button>

          {/* Monthly */}
          <motion.button
            data-testid="kids-plan-monthly"
            className="w-full rounded-xl p-4 text-left"
            style={{
              background: plan === "monthly" ? "rgba(0,194,255,0.04)" : "rgba(255,255,255,0.015)",
              border: `1px solid ${plan === "monthly" ? "rgba(0,194,255,0.15)" : "rgba(255,255,255,0.035)"}`,
            }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setPlan("monthly")}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Star size={14} className="text-[#00C2FF]" />
                  <p className="text-[13px] font-semibold text-white">{t("kids.monthly")}</p>
                </div>
                <p className="text-[10px] text-[#555] font-medium mt-0.5">{t("kids.monthly_flex")}</p>
              </div>
              <div className="text-right">
                <p className="text-[18px] font-bold font-outfit" style={{ color: plan === "monthly" ? "#00C2FF" : "rgba(255,255,255,0.7)" }}>4.99</p>
                <p className="text-[10px] text-[#444] font-medium">EUR / {t("kids.month")}</p>
              </div>
            </div>
          </motion.button>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          className="space-y-3 pt-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, ...slide }}
        >
          {subStatus?.trial_available && (
            <motion.button
              data-testid="kids-start-trial"
              className="w-full py-3 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2"
              style={{ background: "rgba(0,210,106,0.08)", border: "1px solid rgba(0,210,106,0.15)", color: "#00D26A" }}
              whileTap={{ scale: 0.97 }}
              onClick={handleTrial}
              disabled={trialLoading}
            >
              {trialLoading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              {t("kids.start_trial")}
            </motion.button>
          )}

          <motion.button
            data-testid="kids-subscribe-btn"
            className="w-full py-3.5 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #A855F7, #7C3AED)",
              color: "#fff",
              boxShadow: "0 4px 24px rgba(168,85,247,0.3)",
            }}
            whileTap={{ scale: 0.97 }}
            onClick={handleCheckout}
            disabled={loading}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : null}
            {t("kids.subscribe_now")} — EUR {plan === "yearly" ? "49.99" : "4.99"}
          </motion.button>

          <p className="text-[10px] text-[#333] text-center font-medium">{t("kids.cancel_anytime")}</p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default KidsPaywall;
