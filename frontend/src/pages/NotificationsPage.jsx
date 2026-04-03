import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, ChevronLeft, Check, Gift, AlertCircle, Megaphone, Info, Loader2 } from "lucide-react";
import { api } from "../services/api";
import { useI18n } from "../store";
import ErrorState from "../components/ErrorState";

const slide = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };

const typeIcons = {
  reward: Gift,
  campaign: Megaphone,
  alert: AlertCircle,
  onboarding: Info,
  system: Bell,
};

const typeColors = {
  reward: "#00D26A",
  campaign: "#00C2FF",
  alert: "#FF4B4B",
  onboarding: "#FFB800",
  system: "#888",
};

const NotificationsPage = ({ onBack }) => {
  const { t } = useI18n();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotifications = async () => {
    setError(null);
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (e) { setError(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  return (
    <motion.div
      data-testid="notifications-page"
      className="min-h-screen"
      style={{ background: "#030303" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    >
      <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3">
        <div className="flex items-center gap-3">
          <motion.button
            data-testid="notifications-back-btn"
            className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
            whileTap={{ scale: 0.88 }} onClick={onBack}
          >
            <ChevronLeft size={15} strokeWidth={1.5} className="text-white/50" />
          </motion.button>
          <h1 className="text-[15px] font-semibold font-outfit text-white tracking-tight">
            {t("notif.title")}
          </h1>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(0,194,255,0.15)", color: "#00C2FF" }}>
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <motion.button
            data-testid="mark-all-read-btn"
            className="text-[11px] font-medium text-[#00C2FF]"
            whileTap={{ scale: 0.95 }} onClick={markAllRead}
          >
            {t("notif.mark_all_read")}
          </motion.button>
        )}
      </div>

      <div className="px-5 pb-8">
        {error && !loading ? (
          <ErrorState error={error} onRetry={fetchNotifications} />
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-[#00C2FF]" />
          </div>
        ) : notifications.length === 0 ? (
          <motion.div
            className="text-center py-16"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          >
            <Bell size={32} className="mx-auto mb-3 text-[#222]" />
            <p className="text-[13px] text-[#444] font-medium">{t("notif.empty")}</p>
            <p className="text-[11px] text-[#333] mt-1">{t("notif.empty_hint")}</p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif, i) => {
              const Icon = typeIcons[notif.type] || Bell;
              const color = typeColors[notif.type] || "#888";
              return (
                <motion.div
                  key={i}
                  data-testid={`notification-item-${i}`}
                  className="rounded-xl p-3.5 flex items-start gap-3"
                  style={{
                    background: notif.read ? "rgba(255,255,255,0.012)" : "rgba(0,194,255,0.03)",
                    border: `1px solid ${notif.read ? "rgba(255,255,255,0.03)" : "rgba(0,194,255,0.08)"}`,
                  }}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, ...slide }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}12`, border: `1px solid ${color}18` }}>
                    <Icon size={15} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[12px] font-semibold text-white/90 truncate">{notif.title}</p>
                      {!notif.read && <div className="w-1.5 h-1.5 rounded-full bg-[#00C2FF] flex-shrink-0" />}
                    </div>
                    <p className="text-[11px] text-[#666] leading-relaxed">{notif.message}</p>
                    <p className="text-[9px] text-[#333] mt-1 font-medium">
                      {notif.created_at ? new Date(notif.created_at).toLocaleDateString() : ""}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default NotificationsPage;
