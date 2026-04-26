import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import MiniLeafletMap from "../components/MiniLeafletMap";
import {
  ChevronLeft, Shield, Eye, CreditCard, Zap,
  Check, Star, Crown, Loader2, Users, PlusCircle,
  TrendingDown, Wallet, Clock, BarChart3, Lock,
  Send, Settings, ChevronRight, RefreshCw, Unlock,
  Filter, ShoppingBag, ArrowUpRight, ArrowDownLeft, Bell, Key,
  MapPin, Map, CheckSquare, Smartphone, Battery, Award,
  FileText, TrendingUp, Gift, Trophy, UserPlus, PieChart,
  Bookmark, Target, Gamepad2, X
} from "lucide-react";
import { useI18n, useUser } from "../store";
import { api } from "../services/api";
import ChildWalletModal from "../components/ChildWalletModal";
import KidsNotifications from "../components/KidsNotifications";
import KidsGPSModal from "../components/KidsGPSModal";
import {
  ScreenTimeModal, BatteryModal, PointsModal, ReportsModal,
  SpendingModal, BadgesModal, ChallengesModal, CoParentsModal,
  BoardModal, AnalyticsModal
} from "../components/KidsQuickModals";

const slide = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };

const BENEFITS = [
  { icon: Shield, key: "parental_control", descKey: "parental_control_desc" },
  { icon: Eye, key: "spending_limits", descKey: "spending_limits_desc" },
  { icon: CreditCard, key: "txn_tracking", descKey: "txn_tracking_desc" },
  { icon: Zap, key: "safe_payments", descKey: "safe_payments_desc" },
];

// Quick Actions für das Kids Dashboard
const QUICK_ACTIONS = [
  { icon: MapPin, key: "gps", label: "GPS", color: "#3B82F6", bgColor: "rgba(59,130,246,0.15)" },
  { icon: Map, key: "zones", label: "Zonen", color: "#10B981", bgColor: "rgba(16,185,129,0.15)" },
  { icon: CheckSquare, key: "tasks", label: "Aufgaben", color: "#F59E0B", bgColor: "rgba(245,158,11,0.15)" },
  { icon: Smartphone, key: "screen", label: "Bildschirm", color: "#8B5CF6", bgColor: "rgba(139,92,246,0.15)" },
  { icon: Battery, key: "battery", label: "Akku", color: "#EF4444", bgColor: "rgba(239,68,68,0.15)" },
  { icon: Star, key: "points", label: "Punkte", color: "#F59E0B", bgColor: "rgba(245,158,11,0.15)" },
  { icon: FileText, key: "report", label: "Bericht", color: "#6366F1", bgColor: "rgba(99,102,241,0.15)" },
  { icon: TrendingUp, key: "spending", label: "Ausgaben", color: "#F97316", bgColor: "rgba(249,115,22,0.15)" },
  { icon: Wallet, key: "allowance", label: "Taschengeld", color: "#14B8A6", bgColor: "rgba(20,184,166,0.15)" },
  { icon: Gift, key: "shop", label: "Shop", color: "#EC4899", bgColor: "rgba(236,72,153,0.15)" },
  { icon: Trophy, key: "ranking", label: "Rangliste", color: "#EAB308", bgColor: "rgba(234,179,8,0.15)" },
  { icon: UserPlus, key: "coparents", label: "Co-Eltern", color: "#A855F7", bgColor: "rgba(168,85,247,0.15)" },
  { icon: PieChart, key: "analytics", label: "Analytics", color: "#06B6D4", bgColor: "rgba(6,182,212,0.15)" },
  { icon: Bookmark, key: "board", label: "Pinnwand", color: "#F472B6", bgColor: "rgba(244,114,182,0.15)" },
  { icon: Award, key: "badges", label: "Abzeichen", color: "#8B5CF6", bgColor: "rgba(139,92,246,0.15)" },
  { icon: Target, key: "challenges", label: "Challenges", color: "#22C55E", bgColor: "rgba(34,197,94,0.15)" },
  { icon: Lock, key: "apps", label: "App-Kontrolle", color: "#EF4444", bgColor: "rgba(239,68,68,0.15)" },
  { icon: Bell, key: "sos", label: "SOS", color: "#DC2626", bgColor: "rgba(220,38,38,0.2)" },
];

// ── Kids Dashboard (post-subscription) ──
const KidsDashboard = ({ onBack, t, subStatus }) => {
  const user = useUser();
  const [children, setChildren] = useState([]);
  const [childWallets, setChildWallets] = useState({});
  const [childLocations, setChildLocations] = useState({});
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
  const [activeTab, setActiveTab] = useState('wallet'); // wallet | tracking
  const [activeFeature, setActiveFeature] = useState(null);
  const [tasksChild, setTasksChild] = useState(null); // Für Aufgaben-Modal
  const [childTasks, setChildTasks] = useState([]); // Aufgaben für das aktuell ausgewählte Kind
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskReward, setNewTaskReward] = useState(0.50);

  // Feature Modals State
  const [gpsChild, setGpsChild] = useState(null);
  const [screenTimeChild, setScreenTimeChild] = useState(null);
  const [batteryChild, setBatteryChild] = useState(null);
  const [pointsChild, setPointsChild] = useState(null);
  const [reportsChild, setReportsChild] = useState(null);
  const [spendingChild, setSpendingChild] = useState(null);
  const [badgesChild, setBadgesChild] = useState(null);
  const [challengesChild, setChallengesChild] = useState(null);
  const [coParentsChild, setCoParentsChild] = useState(null);
  const [boardChild, setBoardChild] = useState(null);
  const [analyticsChild, setAnalyticsChild] = useState(null);
  const [zonesChild, setZonesChild] = useState(null);
  const [appControlChild, setAppControlChild] = useState(null);
  const [appControlData, setAppControlData] = useState([]);
  const [appControlLoading, setAppControlLoading] = useState(false);
  const [deviceChild, setDeviceChild] = useState(null);
  const [deviceData, setDeviceData] = useState(null);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [showSOS, setShowSOS] = useState(false);

  // Load tasks when tasksChild changes
  useEffect(() => {
    if (tasksChild) {
      api.getChildTasks(tasksChild.child_id)
        .then(data => setChildTasks(data.tasks || []))
        .catch(() => setChildTasks([]));
    }
  }, [tasksChild]);

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
      
      // Load GPS locations for each child
      const gpsPromises = childList.map(async (child) => {
        try {
          const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/kids/gps/location/${child.child_id}`, { credentials: "include" });
          if (res.ok) {
            const loc = await res.json();
            return { childId: child.child_id, location: loc };
          }
          return { childId: child.child_id, location: null };
        } catch {
          return { childId: child.child_id, location: null };
        }
      });
      const gpsResults = await Promise.all(gpsPromises);
      const locMap = {};
      gpsResults.forEach(r => {
        if (r.location && (r.location.lat || r.location.address)) locMap[r.childId] = r.location;
      });
      setChildLocations(locMap);
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

  // Real-time polling for alerts every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadNotificationCount();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

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

  // App Control
  const loadAppControl = async (child) => {
    setAppControlChild(child);
    setAppControlLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/kids/apps/${child.child_id}`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setAppControlData(d.apps || []); }
    } catch {}
    setAppControlLoading(false);
  };

  const toggleAppBlock = async (appId, blocked) => {
    if (!appControlChild) return;
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/kids/apps/rule`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ child_id: appControlChild.child_id, app_id: appId, blocked }),
      });
      setAppControlData(prev => prev.map(a => a.app_id === appId ? { ...a, blocked } : a));
    } catch {}
  };

  const setAppTimeLimit = async (appId, minutes) => {
    if (!appControlChild) return;
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/kids/apps/rule`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ child_id: appControlChild.child_id, app_id: appId, blocked: false, daily_limit_minutes: minutes }),
      });
      setAppControlData(prev => prev.map(a => a.app_id === appId ? { ...a, daily_limit_minutes: minutes } : a));
    } catch {}
  };

  // Device Status
  const loadDeviceStatus = async (child) => {
    setDeviceChild(child);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/kids/device/${child.child_id}`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setDeviceData(d); }
    } catch {}
  };

  // SOS
  const loadSOS = async () => {
    setShowSOS(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/kids/alerts/sos`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setSosAlerts(d.alerts || []); }
    } catch {}
  };

  const resolveSOS = async (sosId) => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/kids/sos/${sosId}/resolve`, { method: "POST", credentials: "include" });
      setSosAlerts(prev => prev.map(a => a.sos_id === sosId ? { ...a, status: "resolved" } : a));
    } catch {}
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
      
      {/* Success/Error Messages - Fixed at top */}
      <AnimatePresence>
        {(success || error) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-4 right-4 z-50"
          >
            {success && (
              <div className="px-4 py-3 rounded-xl bg-green-500/20 border border-green-500/30 backdrop-blur-xl flex items-center gap-2">
                <Check size={16} className="text-green-400" />
                <span className="text-green-400 text-[12px] font-medium">{success}</span>
              </div>
            )}
            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30 backdrop-blur-xl flex items-center gap-2">
                <span className="text-red-400 text-[12px] font-medium">{error}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 pb-28 pt-[max(env(safe-area-inset-top,0px),16px)]">
        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 size={28} className="text-[#00C2FF] animate-spin" />
          </div>
        ) : (<>
        
        {/* ═══════════════════════════════════════════════════════════════
            1. FAMILY WALLET HEADER - Blue Gradient Card
        ═══════════════════════════════════════════════════════════════ */}
        <motion.div 
          className="rounded-3xl p-5 relative overflow-hidden mb-4"
          style={{ 
            background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)",
          }}
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.04 }}
        >
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20" style={{ background: "white", filter: "blur(40px)" }} />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-10" style={{ background: "white", filter: "blur(50px)" }} />
          
          <div className="relative z-10">
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-white/80" />
                <span className="text-white/90 text-[13px] font-medium">Familien-Geldbörse</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-white/20 text-white text-[11px] font-semibold">
                  {totalChildren} Kind{totalChildren !== 1 ? 'er' : ''}
                </span>
                <motion.button 
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
                  whileTap={{ scale: 0.9 }}
                >
                  <RefreshCw size={14} className={`text-white ${refreshing ? 'animate-spin' : ''}`} />
                </motion.button>
              </div>
            </div>
            
            {/* Balance */}
            <p className="text-[42px] font-bold text-white font-outfit leading-none">€{totalBalance.toFixed(2)}</p>
            <p className="text-white/60 text-[12px] mt-1">Gesamtguthaben der Kinder</p>
            
            {/* Tab Buttons */}
            <div className="flex gap-2 mt-4">
              <motion.button
                onClick={() => setActiveTab('wallet')}
                className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-[13px] font-semibold transition-all ${
                  activeTab === 'wallet' 
                    ? 'bg-white/30 text-white' 
                    : 'bg-white/10 text-white/70'
                }`}
                whileTap={{ scale: 0.97 }}
              >
                <Wallet size={16} />
                Geldbörse
              </motion.button>
              <motion.button
                onClick={() => setActiveTab('tracking')}
                className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-[13px] font-semibold transition-all ${
                  activeTab === 'tracking' 
                    ? 'bg-white/30 text-white' 
                    : 'bg-white/10 text-white/70'
                }`}
                whileTap={{ scale: 0.97 }}
              >
                <MapPin size={16} />
                Tracking
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════════
            2. SCHNELLAKTIONEN - 16 Feature Grid
        ═══════════════════════════════════════════════════════════════ */}
        <motion.div 
          className="mb-4"
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.08 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-white/40" />
            <p className="text-[11px] text-white/50 font-semibold uppercase tracking-wider">Schnellaktionen</p>
          </div>
          
          <div className="grid grid-cols-5 gap-2">
            {QUICK_ACTIONS.map((action, idx) => (
              <motion.button
                key={action.key}
                data-testid={`quick-action-${action.key}`}
                onClick={() => {
                  if (children.length === 0) {
                    setError('Bitte zuerst ein Kind hinzufügen');
                    setTimeout(() => setError(null), 2000);
                    return;
                  }
                  const firstChild = children[0];
                  switch (action.key) {
                    case 'gps':
                      setGpsChild(firstChild);
                      break;
                    case 'zones':
                      setGpsChild(firstChild); // Opens GPS modal with zones tab
                      break;
                    case 'tasks':
                      setTasksChild(firstChild);
                      break;
                    case 'screen':
                      setScreenTimeChild(firstChild);
                      break;
                    case 'battery':
                      loadDeviceStatus(firstChild);
                      break;
                    case 'points':
                      setPointsChild(firstChild);
                      break;
                    case 'report':
                      setReportsChild(firstChild);
                      break;
                    case 'spending':
                      setSpendingChild(firstChild);
                      break;
                    case 'allowance':
                      setWalletChild(firstChild);
                      break;
                    case 'shop':
                      setSuccess('Kids Shop - Demnächst verfügbar!');
                      setTimeout(() => setSuccess(null), 2000);
                      break;
                    case 'ranking':
                      setSuccess('Rangliste - Demnächst verfügbar!');
                      setTimeout(() => setSuccess(null), 2000);
                      break;
                    case 'coparents':
                      setCoParentsChild(firstChild);
                      break;
                    case 'analytics':
                      setAnalyticsChild(firstChild);
                      break;
                    case 'board':
                      setBoardChild(firstChild);
                      break;
                    case 'badges':
                      setBadgesChild(firstChild);
                      break;
                    case 'challenges':
                      setChallengesChild(firstChild);
                      break;
                    case 'apps':
                      loadAppControl(firstChild);
                      break;
                    case 'sos':
                      loadSOS();
                      break;
                    default:
                      setActiveFeature(action.key);
                  }
                }}
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl transition-all active:scale-95"
                style={{ 
                  background: action.bgColor,
                  border: `1px solid ${action.color}30`
                }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + idx * 0.02 }}
                whileTap={{ scale: 0.92 }}
              >
                <action.icon size={20} style={{ color: action.color }} />
                <span className="text-[9px] font-semibold text-white/80 text-center leading-tight">{action.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════════
            3. MEINE KINDER - Child List
        ═══════════════════════════════════════════════════════════════ */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.12 }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] text-white font-semibold">Meine Kinder</p>
            <motion.button 
              onClick={() => setShowAddChild(true)}
              className="flex items-center gap-1 text-[#00C2FF] text-[11px] font-semibold"
              whileTap={{ scale: 0.95 }}
            >
              <PlusCircle size={14} />
              Kind hinzufügen
            </motion.button>
          </div>

          {children.length === 0 && !showAddChild && (
            <motion.div 
              className="rounded-2xl p-8 text-center" 
              style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)" }}
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
            >
              <Users size={36} className="text-[#333] mx-auto mb-3" />
              <p className="text-[13px] text-white/60 font-medium mb-1">Noch keine Kinder hinzugefügt</p>
              <p className="text-[11px] text-white/30">Tippe oben auf "Kind hinzufügen"</p>
            </motion.div>
          )}

          <div className="space-y-3">
            {children.map((child, idx) => {
              const wallet = childWallets[child.child_id];
              const balance = wallet?.balance || child.balance || 0;
              const todaySpent = wallet?.today_spent || 0;
              const weekSpent = wallet?.week_spent || child.spent || 0;
              const weeklyLimit = child.weekly_limit || 50;
              const pct = weeklyLimit > 0 ? Math.min(100, (weekSpent / weeklyLimit) * 100) : 0;
              const isFrozen = child.is_frozen || false;
              
              return (
                <motion.div 
                  key={child.child_id} 
                  data-testid={`child-card-${child.child_id}`}
                  className={`rounded-2xl p-4 ${isFrozen ? 'opacity-60' : ''}`}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${isFrozen ? "rgba(255,71,87,0.2)" : "rgba(255,255,255,0.05)"}`,
                  }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + idx * 0.05 }}
                >
                  {/* Child Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center text-[18px] font-bold relative"
                      style={{ background: `${child.color}20`, border: `2px solid ${child.color}60` }}
                    >
                      {child.avatar || child.name?.[0]}
                      {isFrozen && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                          <Lock size={10} className="text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[15px] font-semibold text-white">{child.name}</p>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                          isFrozen 
                            ? 'bg-red-500/20 text-red-400' 
                            : 'bg-green-500/20 text-green-400'
                        }`}>
                          {isFrozen ? 'GESPERRT' : 'AKTIV'}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/40">Heute: €{todaySpent.toFixed(2)} ausgegeben</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[22px] font-bold text-[#00C2FF]">€{balance.toFixed(2)}</p>
                      <p className="text-[9px] text-white/30">Guthaben</p>
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-white/40">Wochenlimit</span>
                      <span className="text-[10px] text-white/40">€{weekSpent.toFixed(2)} / €{weeklyLimit}</span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <motion.div 
                        className="h-full rounded-full" 
                        style={{ background: pct > 80 ? "#EF4444" : child.color }}
                        initial={{ width: 0 }} 
                        animate={{ width: `${pct}%` }} 
                        transition={{ duration: 0.8, ease: "easeOut" }} 
                      />
                    </div>
                  </div>
                  
                  {/* GPS Location Badge */}
                  {(() => {
                    const loc = childLocations[child.child_id];
                    if (!loc) return null;
                    const hasCoords = loc.lat && loc.lng;
                    const addr = loc.address || (hasCoords ? `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}` : null);
                    if (!addr && !hasCoords) return null;
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-3 rounded-xl overflow-hidden"
                        style={{ border: "1px solid rgba(59,130,246,0.2)" }}
                        data-testid={`child-gps-${child.child_id}`}
                      >
                        {hasCoords && (
                          <MiniLeafletMap
                            lat={loc.lat}
                            lng={loc.lng}
                            zoom={14}
                            height={80}
                            pins={[{ lat: loc.lat, lng: loc.lng, color: "#3B82F6" }]}
                            testId={`child-gps-mini-${child.child_id}`}
                          />
                        )}
                        <div
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                          style={{ background: "rgba(59,130,246,0.08)" }}
                          onClick={(e) => { e.stopPropagation(); setGpsChild(child); }}
                        >
                          <MapPin size={13} className="text-blue-400 shrink-0" />
                          <span className="text-[10px] text-blue-300 truncate flex-1">{addr}</span>
                          {loc.battery_level != null && (
                            <span className="text-[9px] text-white/40 flex items-center gap-0.5">
                              <Battery size={10} /> {loc.battery_level}%
                            </span>
                          )}
                          <ChevronRight size={12} className="text-blue-400/50" />
                        </div>
                      </motion.div>
                    );
                  })()}
                  
                  {/* Quick Action Buttons for Child — compact mobile */}
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { icon: Send, label: "Senden", bg: "rgba(0,194,255,0.1)", color: "#00C2FF", border: "rgba(0,194,255,0.2)", action: () => setWalletChild(child) },
                      { icon: Shield, label: "Kontrollen", bg: "rgba(0,210,106,0.1)", color: "#00D26A", border: "rgba(0,210,106,0.25)", action: (e) => { e?.stopPropagation(); onNavigate && onNavigate("/parent-controls", { childId: child.child_id, childName: child.name }); }, testId: `parent-controls-btn-${child.child_id}` },
                      { icon: CheckSquare, label: "Aufgaben", bg: "rgba(245,158,11,0.1)", color: "#F59E0B", border: "rgba(245,158,11,0.2)", action: (e) => { e?.stopPropagation(); setTasksChild(child); }, testId: `tasks-btn-${child.child_id}` },
                      { icon: Key, label: "PIN", bg: "rgba(168,85,247,0.1)", color: "#A855F7", border: "rgba(168,85,247,0.2)", action: () => setShowSetPin(child) },
                      { icon: isFrozen ? Unlock : Lock, label: isFrozen ? "Aktiv" : "Sperren", bg: isFrozen ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: isFrozen ? "#22C55E" : "#EF4444", border: isFrozen ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)", action: () => handleFreezeToggle(child.child_id, { stopPropagation: () => {} }) },
                    ].map((btn, bi) => (
                      <motion.button
                        key={bi}
                        data-testid={btn.testId}
                        className="flex-1 min-w-0 py-1.5 rounded-lg text-[9px] font-semibold flex items-center justify-center gap-0.5"
                        style={{ background: btn.bg, color: btn.color, border: `1px solid ${btn.border}` }}
                        whileTap={{ scale: 0.95 }}
                        onClick={btn.action}
                      >
                        <btn.icon size={10} />
                        <span className="hidden xs:inline">{btn.label}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Add child form */}
          <AnimatePresence>
            {showAddChild && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: "auto", opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-3 rounded-2xl p-4 space-y-3"
                style={{ background: "rgba(0,194,255,0.03)", border: "1px solid rgba(0,194,255,0.15)" }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <PlusCircle size={16} className="text-[#00C2FF]" />
                  <span className="text-[13px] font-semibold text-white">Neues Kind hinzufügen</span>
                </div>
                
                <div>
                  <label className="text-[10px] text-white/40 font-medium mb-1 block">Name</label>
                  <input 
                    data-testid="add-child-name" 
                    value={newChildName} 
                    onChange={e => setNewChildName(e.target.value)}
                    placeholder="Name des Kindes"
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] text-white/90 placeholder-white/20 font-medium outline-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    onKeyDown={e => e.key === "Enter" && addChild()} 
                  />
                </div>
                
                <div>
                  <label className="text-[10px] text-white/40 font-medium mb-1.5 block">Avatar</label>
                  <div className="flex flex-wrap gap-2">
                    {CHILD_EMOJIS.map((emoji) => (
                      <button 
                        key={emoji} 
                        type="button"
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                          newChildEmoji === emoji ? 'bg-[#00C2FF]/20 border-[#00C2FF]/40 scale-110' : 'bg-white/[0.02] border-white/[0.05]'
                        } border`}
                        onClick={() => setNewChildEmoji(newChildEmoji === emoji ? "" : emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] text-white/40 font-medium">Wochenlimit</label>
                    <span className="text-[12px] font-bold text-[#00C2FF]">€{newChildLimit}</span>
                  </div>
                  <input 
                    type="range" 
                    min={5} 
                    max={100} 
                    step={5} 
                    value={newChildLimit}
                    onChange={e => setNewChildLimit(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#00C2FF]"
                    style={{ background: "rgba(255,255,255,0.06)" }} 
                  />
                </div>
                
                <div className="flex gap-2 pt-1">
                  <motion.button 
                    data-testid="add-child-confirm" 
                    onClick={addChild} 
                    disabled={saving || !newChildName.trim()}
                    className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold bg-[#00C2FF] text-black flex items-center justify-center gap-1.5 disabled:opacity-40"
                    whileTap={{ scale: 0.97 }}
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Kind speichern
                  </motion.button>
                  <motion.button 
                    onClick={() => { setShowAddChild(false); resetForm(); }}
                    className="px-4 py-2.5 rounded-xl text-[12px] font-medium text-white/50 bg-white/[0.03] border border-white/[0.06]"
                    whileTap={{ scale: 0.97 }}
                  >
                    Abbrechen
                  </motion.button>
                </div>
              </motion.div>
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
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
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

      {/* ══════════════════════════════════════════════════════════════════════════
          AUFGABEN MODAL
      ══════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {tasksChild && (
          <motion.div
            data-testid="tasks-modal"
            className="fixed inset-0 flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.9)", zIndex: 9999 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setTasksChild(null)}
          >
            <motion.div
              className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-3xl p-5"
              style={{ background: "#0A0A12" }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                    style={{ background: `${tasksChild.color}20`, border: `2px solid ${tasksChild.color}60` }}
                  >
                    {tasksChild.avatar || tasksChild.name?.[0]}
                  </div>
                  <div>
                    <h2 className="text-[16px] font-bold text-white">Aufgaben für {tasksChild.name}</h2>
                    <p className="text-[11px] text-gray-400">Erstelle Aufgaben mit Belohnungen</p>
                  </div>
                </div>
                <button onClick={() => setTasksChild(null)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                  <X size={16} className="text-gray-400" />
                </button>
              </div>

              {/* Neue Aufgabe erstellen */}
              <div className="p-4 rounded-2xl mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-3">Neue Aufgabe</p>
                <input
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  placeholder="z.B. Zimmer aufräumen"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-[13px] placeholder-gray-600 outline-none focus:border-[#F59E0B]/50 mb-3"
                />
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[12px] text-gray-400">Belohnung:</span>
                  <div className="flex gap-2">
                    {[0.50, 1.00, 2.00, 5.00].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setNewTaskReward(amt)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                          newTaskReward === amt 
                            ? 'bg-[#F59E0B] text-black' 
                            : 'bg-white/5 text-gray-400 border border-white/10'
                        }`}
                      >
                        €{amt.toFixed(2)}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!newTaskName.trim()) return;
                    try {
                      // Speichere Aufgabe in DB
                      await api.createChildTask(tasksChild.child_id, newTaskName, newTaskReward);
                      setSuccess(`Aufgabe "${newTaskName}" erstellt!`);
                      setNewTaskName('');
                      setNewTaskReward(0.50);
                      // Lade Aufgaben neu
                      const tasks = await api.getChildTasks(tasksChild.child_id);
                      setChildTasks(tasks.tasks || []);
                    } catch (err) {
                      setError(err.message || 'Fehler beim Erstellen');
                    }
                    setTimeout(() => { setSuccess(null); setError(null); }, 2000);
                  }}
                  disabled={!newTaskName.trim()}
                  className="w-full py-3 bg-[#F59E0B] rounded-xl text-sm font-bold text-black disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <PlusCircle size={16} /> Aufgabe hinzufügen
                </button>
              </div>

              {/* Aktive Aufgaben */}
              <div className="space-y-2">
                <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-2">Aktive Aufgaben</p>
                {childTasks.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)" }}>
                    <CheckSquare size={28} className="text-gray-700 mx-auto mb-2" />
                    <p className="text-[12px] text-gray-500">Noch keine Aufgaben</p>
                  </div>
                ) : (
                  childTasks.map(task => (
                    <div 
                      key={task.task_id}
                      className="p-3 rounded-xl flex items-center justify-between"
                      style={{ 
                        background: task.completed ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.03)", 
                        border: task.completed ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(255,255,255,0.06)" 
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          task.completed ? 'bg-green-500' : 'bg-white/10'
                        }`}>
                          {task.completed ? <Check size={14} className="text-white" /> : <CheckSquare size={14} className="text-gray-500" />}
                        </div>
                        <div>
                          <p className={`text-[13px] font-medium ${task.completed ? 'text-green-400 line-through' : 'text-white'}`}>{task.name}</p>
                          <p className="text-[10px] text-gray-500">Belohnung: €{(task.reward || 0).toFixed(2)}</p>
                        </div>
                      </div>
                      {!task.completed && (
                        <button
                          onClick={async () => {
                            try {
                              await api.completeChildTask(tasksChild.child_id, task.task_id);
                              setSuccess(`${task.name} erledigt! +€${task.reward.toFixed(2)}`);
                              const tasks = await api.getChildTasks(tasksChild.child_id);
                              setChildTasks(tasks.tasks || []);
                              // Refresh child wallets
                              loadChildren();
                            } catch (err) {
                              setError(err.message);
                            }
                            setTimeout(() => { setSuccess(null); setError(null); }, 2000);
                          }}
                          className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-[10px] font-semibold"
                        >
                          Erledigt ✓
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ══════════════════════════════════════════════════════════════════════════
          FEATURE MODALS - GPS, Screen Time, Battery, Points, etc.
      ══════════════════════════════════════════════════════════════════════════ */}
      
      {/* GPS Modal */}
      <AnimatePresence>
        {gpsChild && (
          <KidsGPSModal
            isOpen={!!gpsChild}
            onClose={() => setGpsChild(null)}
            child={gpsChild}
            allChildren={children}
          />
        )}
      </AnimatePresence>

      {/* Screen Time Modal */}
      <AnimatePresence>
        {screenTimeChild && (
          <ScreenTimeModal
            isOpen={!!screenTimeChild}
            onClose={() => setScreenTimeChild(null)}
            child={screenTimeChild}
          />
        )}
      </AnimatePresence>

      {/* Battery Modal */}
      <AnimatePresence>
        {batteryChild && (
          <BatteryModal
            isOpen={!!batteryChild}
            onClose={() => setBatteryChild(null)}
            child={batteryChild}
          />
        )}
      </AnimatePresence>

      {/* Points Modal */}
      <AnimatePresence>
        {pointsChild && (
          <PointsModal
            isOpen={!!pointsChild}
            onClose={() => setPointsChild(null)}
            child={pointsChild}
          />
        )}
      </AnimatePresence>

      {/* Reports Modal */}
      <AnimatePresence>
        {reportsChild && (
          <ReportsModal
            isOpen={!!reportsChild}
            onClose={() => setReportsChild(null)}
            child={reportsChild}
          />
        )}
      </AnimatePresence>

      {/* Spending Modal */}
      <AnimatePresence>
        {spendingChild && (
          <SpendingModal
            isOpen={!!spendingChild}
            onClose={() => setSpendingChild(null)}
            child={spendingChild}
          />
        )}
      </AnimatePresence>

      {/* Badges Modal */}
      <AnimatePresence>
        {badgesChild && (
          <BadgesModal
            isOpen={!!badgesChild}
            onClose={() => setBadgesChild(null)}
            child={badgesChild}
          />
        )}
      </AnimatePresence>

      {/* Challenges Modal */}
      <AnimatePresence>
        {challengesChild && (
          <ChallengesModal
            isOpen={!!challengesChild}
            onClose={() => setChallengesChild(null)}
            child={challengesChild}
          />
        )}
      </AnimatePresence>

      {/* Co-Parents Modal */}
      <AnimatePresence>
        {coParentsChild && (
          <CoParentsModal
            isOpen={!!coParentsChild}
            onClose={() => setCoParentsChild(null)}
            child={coParentsChild}
          />
        )}
      </AnimatePresence>

      {/* Board Modal */}
      <AnimatePresence>
        {boardChild && (
          <BoardModal
            isOpen={!!boardChild}
            onClose={() => setBoardChild(null)}
            child={boardChild}
          />
        )}
      </AnimatePresence>

      {/* Analytics Modal */}
      <AnimatePresence>
        {analyticsChild && (
          <AnalyticsModal
            isOpen={!!analyticsChild}
            onClose={() => setAnalyticsChild(null)}
            child={analyticsChild}
          />
        )}

        {/* App Control Modal */}
        {appControlChild && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setAppControlChild(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-[#111118] rounded-t-3xl border-t border-white/10 max-h-[85vh] flex flex-col">
              <div className="p-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-base font-bold text-white">App-Kontrolle</h3>
                  <p className="text-[10px] text-gray-500">{appControlChild.name} — {appControlData.length} Apps</p>
                </div>
                <button onClick={() => setAppControlChild(null)} className="p-2 rounded-xl bg-white/5" data-testid="close-app-control">
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-2">
                {appControlLoading ? (
                  <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-[#EF4444]" /></div>
                ) : appControlData.map(app => (
                  <div key={app.app_id} className={`p-3 rounded-xl border flex items-center justify-between ${app.blocked ? "bg-red-500/5 border-red-500/20" : "bg-white/[0.02] border-white/5"}`}
                    data-testid={`app-row-${app.app_id}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                        {app.category === "social" ? <Users size={14} className="text-blue-400" /> :
                         app.category === "games" ? <Gamepad2 size={14} className="text-purple-400" /> :
                         app.category === "education" ? <Award size={14} className="text-green-400" /> :
                         <Smartphone size={14} className="text-gray-400" />}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">{app.name}</p>
                        <p className="text-[9px] text-gray-500">
                          {app.blocked ? "Gesperrt" : app.daily_limit_minutes ? `${app.daily_limit_minutes} Min/Tag` : "Unbegrenzt"}
                          {app.usage_today > 0 && ` · ${app.usage_today} Min genutzt`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={app.daily_limit_minutes || ""}
                        onChange={e => setAppTimeLimit(app.app_id, e.target.value ? parseInt(e.target.value) : null)}
                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[9px] text-white outline-none"
                        data-testid={`app-limit-${app.app_id}`}>
                        <option value="">Unbegrenzt</option>
                        <option value="15">15 Min</option>
                        <option value="30">30 Min</option>
                        <option value="60">1 Std</option>
                        <option value="120">2 Std</option>
                      </select>
                      <motion.button whileTap={{ scale: 0.9 }}
                        onClick={() => toggleAppBlock(app.app_id, !app.blocked)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${app.blocked ? "bg-red-500/20" : "bg-white/5"}`}
                        data-testid={`app-block-${app.app_id}`}>
                        {app.blocked ? <Lock size={14} className="text-red-400" /> : <Unlock size={14} className="text-green-400" />}
                      </motion.button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Device Status Modal */}
        {deviceChild && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setDeviceChild(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-[#111118] rounded-3xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-bold text-white">Gerätestatus</h3>
                <button onClick={() => setDeviceChild(null)} className="p-1.5 rounded-lg bg-white/5"><X size={14} className="text-gray-400" /></button>
              </div>
              <p className="text-xs text-gray-500 mb-4">{deviceChild.name}</p>
              {!deviceData?.connected ? (
                <div className="text-center py-6">
                  <Smartphone size={40} className="mx-auto text-gray-600 mb-3" />
                  <p className="text-sm text-white/70 font-semibold">Kein Gerät verbunden</p>
                  <p className="text-[10px] text-gray-500 mt-1">Das Kinder-Gerät hat sich noch nicht synchronisiert.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Battery */}
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">Akku</span>
                      <span className={`text-sm font-bold ${deviceData.battery_percent > 50 ? "text-green-400" : deviceData.battery_percent > 20 ? "text-yellow-400" : "text-red-400"}`}>
                        {deviceData.battery_percent}%
                      </span>
                    </div>
                    <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${deviceData.battery_percent}%`,
                        background: deviceData.battery_percent > 50 ? "#22C55E" : deviceData.battery_percent > 20 ? "#F59E0B" : "#EF4444",
                      }} />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">{deviceData.is_charging ? "Lädt gerade" : "Lädt nicht"}</p>
                  </div>
                  {/* Device Info */}
                  {[
                    { label: "Gerätename", value: deviceData.device_name },
                    { label: "Modell", value: deviceData.device_model },
                    { label: "Betriebssystem", value: deviceData.os_version },
                    { label: "Letzte Sync", value: deviceData.last_sync ? new Date(deviceData.last_sync).toLocaleString("de-DE") : null },
                  ].filter(x => x.value).map(item => (
                    <div key={item.label} className="flex items-center justify-between py-2 border-b border-white/5">
                      <span className="text-[11px] text-gray-500">{item.label}</span>
                      <span className="text-[11px] text-white font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* SOS Alerts Modal */}
        {showSOS && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowSOS(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-[#111118] rounded-t-3xl border-t border-white/10 max-h-[70vh] flex flex-col">
              <div className="p-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                    <Bell size={16} className="text-red-400" />
                  </div>
                  <h3 className="text-base font-bold text-white">SOS-Alarme</h3>
                </div>
                <button onClick={() => setShowSOS(false)} className="p-2 rounded-xl bg-white/5"><X size={16} className="text-gray-400" /></button>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-3">
                {sosAlerts.length === 0 ? (
                  <div className="text-center py-10">
                    <Check size={40} className="mx-auto text-green-400 mb-3" />
                    <p className="text-sm text-white/70 font-semibold">Keine SOS-Alarme</p>
                    <p className="text-[10px] text-gray-500 mt-1">Alles sicher.</p>
                  </div>
                ) : sosAlerts.map(sos => (
                  <div key={sos.sos_id} className={`p-4 rounded-2xl border ${sos.status === "active" ? "bg-red-500/5 border-red-500/20" : "bg-white/[0.02] border-white/5"}`}
                    data-testid={`sos-${sos.sos_id}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${sos.status === "active" ? "bg-red-500 animate-pulse" : "bg-green-500"}`} />
                        <span className="text-xs font-semibold">{sos.child_name}</span>
                      </div>
                      <span className="text-[9px] text-gray-500">{sos.created_at?.slice(0, 16).replace("T", " ")}</span>
                    </div>
                    <p className="text-xs text-white/70 mb-2">{sos.message}</p>
                    {sos.address && <p className="text-[10px] text-gray-500 mb-2"><MapPin size={10} className="inline mr-1" />{sos.address}</p>}
                    {sos.status === "active" && (
                      <motion.button whileTap={{ scale: 0.95 }} onClick={() => resolveSOS(sos.sos_id)}
                        className="w-full py-2 rounded-xl bg-green-500/10 text-green-400 text-xs font-semibold flex items-center justify-center gap-1"
                        data-testid={`resolve-sos-${sos.sos_id}`}>
                        <Check size={14} /> Als gelöst markieren
                      </motion.button>
                    )}
                  </div>
                ))}
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
      // Stripe failed - show wallet option
      toast.error("Stripe nicht verfuegbar. Nutze Wallet-Zahlung.");
      setLoading(false);
    }
  };

  const handleWalletPayment = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/kids/pay-with-wallet`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || "Zahlung fehlgeschlagen");
        setLoading(false);
        return;
      }
      toast.success(data.message || "Kids Abo aktiviert!");
      setSubStatus({ status: "active", plan: data.plan, trial_available: false, expires_at: data.expires_at });
      setShowDashboard(true);
    } catch (e) {
      toast.error("Fehler bei der Wallet-Zahlung");
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
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
              style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.14 + i * 0.04, ...slide }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.12)" }}>
                <b.icon size={16} strokeWidth={1.5} className="text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-white/90 mb-0.5">{t(`kids.benefit_${b.key}`)}</p>
                <p className="text-[10px] text-white/40 leading-relaxed">{t(`kids.benefit_${b.descKey}`)}</p>
              </div>
              <Check size={16} className="text-[#00D26A] flex-shrink-0" />
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
            {loading ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
            Stripe — EUR {plan === "yearly" ? "49.99" : "4.99"}
          </motion.button>

          <motion.button
            data-testid="kids-wallet-pay-btn"
            className="w-full py-3.5 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #00C2FF, #0088CC)",
              color: "#fff",
              boxShadow: "0 4px 24px rgba(0,194,255,0.3)",
            }}
            whileTap={{ scale: 0.97 }}
            onClick={handleWalletPayment}
            disabled={loading}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />}
            Wallet-Zahlung — EUR {plan === "yearly" ? "49.99" : "4.99"}
          </motion.button>

          <p className="text-[10px] text-[#333] text-center font-medium">{t("kids.cancel_anytime")}</p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default KidsPaywall;
