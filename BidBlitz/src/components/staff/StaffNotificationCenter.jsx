/**
 * Staff Notification Inbox
 * Sliding panel for the Employee Mobile app
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, Check, Calendar, AlertTriangle, Info, Loader2, Trash2, CheckCheck } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const TYPE_META = {
  shift_reminder: { icon: Calendar, color: "#A855F7" },
  new_shift: { icon: Calendar, color: "#00C2FF" },
  leave_approved: { icon: Check, color: "#10B981" },
  leave_rejected: { icon: X, color: "#EF4444" },
  missed_clock_out: { icon: AlertTriangle, color: "#F59E0B" },
  warning_assigned: { icon: AlertTriangle, color: "#EF4444" },
  info: { icon: Info, color: "#06B6D4" },
};

export default function StaffNotificationCenter({ open, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/staff/notifications/list`, { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setItems(d.notifications || []);
        setUnread(d.unread_count || 0);
      }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const markAll = async () => {
    await fetch(`${API}/api/staff/notifications/mark-all-read`, { method: "POST", credentials: "include" });
    load();
  };

  const markOne = async (id) => {
    await fetch(`${API}/api/staff/notifications/${id}/read`, { method: "POST", credentials: "include" });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
  };

  const remove = async (id) => {
    await fetch(`${API}/api/staff/notifications/${id}`, { method: "DELETE", credentials: "include" });
    setItems((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
          data-testid="staff-notification-center"
        >
          <motion.div
            initial={{ y: 300 }}
            animate={{ y: 0 }}
            exit={{ y: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md max-h-[85vh] bg-[#0A0A0A] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-[#00C2FF]" />
                <h3 className="text-base font-bold">Benachrichtigungen</h3>
                {unread > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#00C2FF] text-black text-[10px] font-bold">
                    {unread}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button
                    onClick={markAll}
                    data-testid="staff-notif-mark-all-btn"
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 text-[10px] hover:bg-white/10"
                  >
                    <CheckCheck size={12} /> Alle gelesen
                  </button>
                )}
                <button
                  onClick={onClose}
                  data-testid="staff-notif-close-btn"
                  className="p-1.5 rounded-md hover:bg-white/5"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading ? (
                <div className="py-10 flex justify-center">
                  <Loader2 size={20} className="animate-spin text-white/40" />
                </div>
              ) : items.length === 0 ? (
                <div className="py-12 text-center" data-testid="staff-notif-empty">
                  <Bell size={32} className="text-white/20 mx-auto mb-2" />
                  <p className="text-sm text-white/50">Keine Benachrichtigungen</p>
                </div>
              ) : (
                items.map((n) => {
                  const meta = TYPE_META[n.type] || TYPE_META.info;
                  const I = meta.icon;
                  return (
                    <div
                      key={n.id}
                      data-testid={`staff-notif-item-${n.type}`}
                      onClick={() => !n.read && markOne(n.id)}
                      className={`flex items-start gap-3 p-3 rounded-xl transition-colors cursor-pointer ${
                        n.read
                          ? "bg-white/[0.02] border border-white/5"
                          : "bg-[#00C2FF]/[0.07] border border-[#00C2FF]/30"
                      }`}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${meta.color}22`, color: meta.color }}
                      >
                        <I size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${n.read ? "text-white/70" : "text-white"}`}>
                          {n.title}
                        </p>
                        {n.body && <p className="text-[11px] text-white/55 mt-0.5 line-clamp-2">{n.body}</p>}
                        <p className="text-[9px] text-white/30 mt-1 uppercase tracking-widest">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(n.id);
                        }}
                        className="p-1 rounded hover:bg-white/5 text-white/30"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
