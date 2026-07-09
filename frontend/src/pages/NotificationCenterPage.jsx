/**
 * BidBlitz V2 - Notification Center
 * Central hub for ALL notifications with badges, filters
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Bell, Check, CheckCheck, Trash2, Loader2,
  CreditCard, Gift, AlertTriangle, TrendingUp, Wallet, Star, Shield
} from "lucide-react";
import { useI18n } from "../store";

const API = process.env.REACT_APP_BACKEND_URL;

const TYPE_CONFIG = {
  credit_approved: { icon: CreditCard, color: "#22C55E", label: "Kredit" },
  credit_rejected: { icon: CreditCard, color: "#EF4444", label: "Kredit" },
  credit_payment: { icon: CreditCard, color: "#3B82F6", label: "Zahlung" },
  credit_payment_failed: { icon: AlertTriangle, color: "#EF4444", label: "Warnung" },
  credit: { icon: CreditCard, color: "#F59E0B", label: "Kredit" },
  admin_grant: { icon: Gift, color: "#A855F7", label: "Gutschrift" },
  coupon_redeemed: { icon: Gift, color: "#10B981", label: "Gutschein" },
  reward: { icon: Star, color: "#F59E0B", label: "Belohnung" },
  loyalty: { icon: TrendingUp, color: "#00C2FF", label: "Loyalty" },
  wallet: { icon: Wallet, color: "#00C2FF", label: "Wallet" },
  security: { icon: Shield, color: "#EF4444", label: "Sicherheit" },
};

const NotificationCenterPage = ({ onBack }) => {
  const { lang } = useI18n();
  const locale = lang === "sq-XK" ? "sq" : lang === "en-US" ? "en" : lang === "ar-AE" ? "ar" : lang;
  const L = {
    de: { title: "Benachrichtigungen", unread: "ungelesen", markAll: "Alle gelesen", all: "Alle", unreadTab: "Ungelesen", empty: "Keine Benachrichtigungen", info: "Info" },
    en: { title: "Notifications", unread: "unread", markAll: "Mark all read", all: "All", unreadTab: "Unread", empty: "No notifications", info: "Info" },
    sq: { title: "Njoftime", unread: "të palexuara", markAll: "Shënoji të gjitha si të lexuara", all: "Të gjitha", unreadTab: "Të palexuara", empty: "Nuk ka njoftime", info: "Info" },
    ar: { title: "الإشعارات", unread: "غير مقروءة", markAll: "تحديد الكل كمقروء", all: "الكل", unreadTab: "غير المقروءة", empty: "لا توجد إشعارات", info: "معلومة" },
  }[locale] || { title: "Notifications", unread: "unread", markAll: "Mark all read", all: "All", unreadTab: "Unread", empty: "No notifications", info: "Info" };
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/notifications?limit=100`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setNotifs(d.notifications || []);
        setUnread(d.unread_count || 0);
      }
      } catch (error) {
        return null;
      }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    await fetch(`${API}/api/notifications/read/${id}`, { method: "POST", credentials: "include" });
    setNotifs(p => p.map(n => n.id === id ? { ...n, read: true } : n));
    setUnread(p => Math.max(0, p - 1));
  };

  const markAllRead = async () => {
    await fetch(`${API}/api/notifications/read-all`, { method: "POST", credentials: "include" });
    setNotifs(p => p.map(n => ({ ...n, read: true })));
    setUnread(0);
  };

  const filtered = filter === "all" ? notifs : filter === "unread" ? notifs.filter(n => !n.read) : notifs.filter(n => n.type?.includes(filter));

  if (loading) return <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center"><Loader2 size={32} className="animate-spin text-[#00C2FF]" /></div>;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="notification-center">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10"><ArrowLeft size={18} /></motion.button>
            <div>
              <h1 className="text-[15px] font-bold">{L.title}</h1>
              <p className="text-[10px] text-gray-500">{unread} {L.unread}</p>
            </div>
          </div>
          {unread > 0 && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={markAllRead}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#00C2FF]/10 text-[10px] text-[#00C2FF] font-semibold" data-testid="mark-all-read">
              <CheckCheck size={12} /> {L.markAll}
            </motion.button>
          )}
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {[{ id: "all", label: L.all }, { id: "unread", label: L.unreadTab }, { id: "credit", label: TYPE_CONFIG.credit.label }, { id: "coupon", label: TYPE_CONFIG.coupon_redeemed.label }, { id: "grant", label: TYPE_CONFIG.admin_grant.label }].map(f => (
            <motion.button key={f.id} whileTap={{ scale: 0.95 }} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap ${filter === f.id ? "bg-[#00C2FF] text-black" : "bg-white/5 text-[#666]"}`}>
              {f.label}
            </motion.button>
          ))}
        </div>
      </div>
      <div className="p-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16"><Bell size={40} className="mx-auto text-[#333] mb-3" /><p className="text-sm text-gray-500">{L.empty}</p></div>
        ) : filtered.map((n, i) => {
          const cfg = TYPE_CONFIG[n.type] || { icon: Bell, color: "#666", label: L.info };
          const Icon = cfg.icon;
          return (
            <motion.div key={n.id || i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              onClick={() => !n.read && markRead(n.id)}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-colors ${n.read ? "bg-white/[0.01] border-white/[0.04]" : "bg-white/[0.03] border-white/[0.08]"}`}
              data-testid={`notif-${n.id}`}>
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${cfg.color}15` }}>
                  <Icon size={16} style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className={`text-xs font-semibold ${n.read ? "text-white/60" : "text-white"}`}>{n.title}</p>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-[#00C2FF] flex-shrink-0" />}
                  </div>
                  <p className={`text-[11px] leading-relaxed ${n.read ? "text-gray-600" : "text-gray-400"}`}>{n.message}</p>
                  <p className="text-[9px] text-gray-700 mt-1">{n.created_at ? new Date(n.created_at).toLocaleString("de-DE") : ""}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default NotificationCenterPage;
