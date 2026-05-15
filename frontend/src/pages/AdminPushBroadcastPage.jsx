/**
 * Admin Push Notifications Broadcast Page
 * Sende Push an alle User oder spezifische Gruppen
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft, Bell, Send, Users, Crown, Car, Store,
  Loader2, Check, Clock,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || "Fehler");
  return d;
}

const TARGET_OPTIONS = [
  { value: "all", label: "Alle User", icon: Users, color: "#3B82F6" },
  { value: "premium", label: "Premium User", icon: Crown, color: "#FFD700" },
  { value: "merchants", label: "Händler", icon: Store, color: "#10B981" },
  { value: "drivers", label: "Fahrer", icon: Car, color: "#8B5CF6" },
];

export default function AdminPushBroadcastPage({ onBack }) {
  const [form, setForm] = useState({
    title: "",
    body: "",
    target: "all",
  });
  const [loading, setLoading] = useState(false);
  const [broadcasts, setBroadcasts] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    loadBroadcasts();
  }, []);

  const loadBroadcasts = async () => {
    setHistoryLoading(true);
    try {
      const res = await api("/api/push-notifications/admin/broadcasts");
      setBroadcasts(res.broadcasts || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const sendBroadcast = async () => {
    if (!form.title || !form.body) {
      toast.error("Titel und Nachricht sind erforderlich");
      return;
    }

    setLoading(true);
    try {
      const res = await api("/api/push-notifications/admin/broadcast", {
        method: "POST",
        body: JSON.stringify(form),
      });

      toast.success(
        `Broadcast gesendet: ${res.devices} Devices, ${res.target_users} User`
      );

      setForm({ title: "", body: "", target: "all" });
      loadBroadcasts();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedTarget = TARGET_OPTIONS.find((t) => t.value === form.target);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Push Notifications</h1>
            <p className="text-xs text-gray-600">Broadcast an alle User</p>
          </div>
          <Bell size={24} className="text-purple-600" />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Send Form */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 space-y-4">
          <h2 className="font-bold text-lg">Neue Notification senden</h2>

          {/* Title */}
          <input
            type="text"
            placeholder="Titel"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg font-medium"
            maxLength={50}
          />

          {/* Body */}
          <textarea
            placeholder="Nachricht"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none"
            rows={4}
            maxLength={200}
          />

          {/* Target Selection */}
          <div>
            <p className="text-sm font-medium mb-2">Zielgruppe:</p>
            <div className="grid grid-cols-2 gap-2">
              {TARGET_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = form.target === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setForm({ ...form, target: option.value })}
                    className={`p-3 rounded-lg border-2 transition flex items-center gap-2 ${
                      isSelected
                        ? "border-purple-600 bg-purple-50"
                        : "border-gray-300 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <Icon
                      size={20}
                      style={{
                        color: isSelected ? option.color : "#9CA3AF",
                      }}
                    />
                    <span
                      className={`text-sm font-medium ${
                        isSelected ? "text-purple-900" : "text-gray-700"
                      }`}
                    >
                      {option.label}
                    </span>
                    {isSelected && (
                      <Check size={16} className="ml-auto text-purple-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Send Button */}
          <button
            onClick={sendBroadcast}
            disabled={loading || !form.title || !form.body}
            className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
            Broadcast senden
          </button>
        </div>

        {/* Broadcast History */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <h2 className="font-bold text-lg mb-3">Broadcast-Historie</h2>

          {historyLoading && (
            <div className="text-center py-8">
              <Loader2 size={32} className="animate-spin text-purple-600 mx-auto" />
            </div>
          )}

          {!historyLoading && broadcasts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Bell size={48} className="mx-auto mb-2 opacity-50" />
              <p>Noch keine Broadcasts gesendet</p>
            </div>
          )}

          <div className="space-y-3">
            {broadcasts.map((broadcast) => {
              const target = TARGET_OPTIONS.find(
                (t) => t.value === broadcast.target
              );
              const Icon = target?.icon || Users;

              return (
                <motion.div
                  key={broadcast.broadcast_id}
                  className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="p-2 rounded-lg"
                      style={{
                        backgroundColor: `${target?.color || "#3B82F6"}20`,
                      }}
                    >
                      <Icon
                        size={20}
                        style={{ color: target?.color || "#3B82F6" }}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm">{broadcast.title}</p>
                      <p className="text-sm text-gray-700 mt-1">
                        {broadcast.body}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(broadcast.sent_at).toLocaleString("de-DE")}
                        </span>
                        <span>•</span>
                        <span>
                          {broadcast.devices_count} Devices
                        </span>
                        <span>•</span>
                        <span className="capitalize">{target?.label}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
