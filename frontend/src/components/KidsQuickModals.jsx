/**
 * BidBlitz V2 - Kids Quick Actions Modals
 * Handles: Screen Time, Battery, Points, Reports, Analytics, Badges, Challenges, etc.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Smartphone, Battery, Star, FileText, TrendingUp, Gift,
  Trophy, UserPlus, PieChart, Bookmark, Award, Target, Gamepad2,
  Clock, Lock, Unlock, Check, AlertCircle, Loader2, ChevronRight,
  Plus, Minus, Calendar, BarChart3, Users, MessageSquare, Heart
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN TIME MODAL
// ═══════════════════════════════════════════════════════════════════════════════

export const ScreenTimeModal = ({ isOpen, onClose, child }) => {
  const [limits, setLimits] = useState({
    daily_limit_minutes: 120,
    bedtime_start: "21:00",
    bedtime_end: "07:00",
    weekend_bonus_minutes: 60,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);

  const saveLimits = async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/kids/screen-time/${child.child_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(limits),
      });
      setSuccess("Limits gespeichert!");
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalWrapper title="Bildschirmzeit" icon={Smartphone} color="purple" onClose={onClose}>
      <div className="space-y-4">
        {/* Daily Limit */}
        <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
          <p className="text-[12px] text-purple-400 font-semibold mb-2">Tägliches Limit</p>
          <div className="flex items-center justify-between">
            <motion.button
              onClick={() => setLimits({ ...limits, daily_limit_minutes: Math.max(30, limits.daily_limit_minutes - 30) })}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <Minus size={18} className="text-white" />
            </motion.button>
            <div className="text-center">
              <p className="text-3xl font-bold text-white">{Math.floor(limits.daily_limit_minutes / 60)}h {limits.daily_limit_minutes % 60}m</p>
              <p className="text-[10px] text-gray-500">pro Tag</p>
            </div>
            <motion.button
              onClick={() => setLimits({ ...limits, daily_limit_minutes: Math.min(480, limits.daily_limit_minutes + 30) })}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <Plus size={18} className="text-white" />
            </motion.button>
          </div>
        </div>

        {/* Bedtime */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
          <p className="text-[12px] text-gray-400 font-semibold mb-3">Schlafenszeit</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-gray-500 mb-1">Von</p>
              <input
                type="time"
                value={limits.bedtime_start}
                onChange={(e) => setLimits({ ...limits, bedtime_start: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-[14px]"
              />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 mb-1">Bis</p>
              <input
                type="time"
                value={limits.bedtime_end}
                onChange={(e) => setLimits({ ...limits, bedtime_end: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-[14px]"
              />
            </div>
          </div>
        </div>

        {/* Weekend Bonus */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
          <p className="text-[12px] text-gray-400 font-semibold mb-2">Wochenend-Bonus</p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="180"
              step="30"
              value={limits.weekend_bonus_minutes}
              onChange={(e) => setLimits({ ...limits, weekend_bonus_minutes: parseInt(e.target.value) })}
              className="flex-1"
            />
            <span className="text-white font-semibold w-16 text-right">+{limits.weekend_bonus_minutes}m</span>
          </div>
        </div>

        {success && (
          <div className="p-3 rounded-xl bg-green-500/20 text-green-400 text-sm text-center">
            {success}
          </div>
        )}

        <motion.button
          onClick={saveLimits}
          disabled={loading}
          className="w-full py-3 bg-purple-500 text-white font-bold rounded-xl flex items-center justify-center gap-2"
          whileTap={{ scale: 0.98 }}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          Speichern
        </motion.button>
      </div>
    </ModalWrapper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// BATTERY STATUS MODAL
// ═══════════════════════════════════════════════════════════════════════════════

export const BatteryModal = ({ isOpen, onClose, child }) => {
  const batteryLevel = child?.battery_level || 0;
  const isLow = batteryLevel < 20;

  if (!isOpen) return null;

  return (
    <ModalWrapper title="Akku-Status" icon={Battery} color="red" onClose={onClose}>
      <div className="text-center py-6">
        <div className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center ${
          isLow ? "bg-red-500/20" : "bg-green-500/20"
        }`}>
          <Battery size={48} className={isLow ? "text-red-400" : "text-green-400"} />
        </div>
        <p className={`text-5xl font-bold ${isLow ? "text-red-400" : "text-green-400"}`}>
          {batteryLevel}%
        </p>
        <p className="text-gray-500 mt-2">
          {isLow ? "Akku niedrig!" : "Akku OK"}
        </p>
        
        {isLow && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 text-sm">
              Das Gerät von {child?.name} hat wenig Akku. Erinnere sie/ihn ans Laden!
            </p>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// POINTS SYSTEM MODAL
// ═══════════════════════════════════════════════════════════════════════════════

export const PointsModal = ({ isOpen, onClose, child }) => {
  const [points, setPoints] = useState(0);
  const [pointsHistory, setPointsHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && child) {
      loadPoints();
    }
  }, [isOpen, child]);

  const loadPoints = async () => {
    try {
      const res = await fetch(`${API_URL}/api/kids/points/${child.child_id}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPoints(data.points || 0);
        setPointsHistory(data.history || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const awardPoints = async (amount) => {
    try {
      await fetch(`${API_URL}/api/kids/points/${child.child_id}/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount, reason: "Bonus von Eltern" }),
      });
      loadPoints();
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalWrapper title="Punkte" icon={Star} color="yellow" onClose={onClose}>
      <div className="space-y-4">
        {/* Current Points */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/10 border border-yellow-500/30 text-center">
          <Star size={40} className="text-yellow-400 mx-auto mb-2" />
          <p className="text-4xl font-bold text-yellow-400">{points}</p>
          <p className="text-gray-400 text-sm">Punkte</p>
        </div>

        {/* Quick Award */}
        <div className="flex gap-2">
          {[10, 25, 50, 100].map((amt) => (
            <motion.button
              key={amt}
              onClick={() => awardPoints(amt)}
              className="flex-1 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-sm font-semibold"
              whileTap={{ scale: 0.95 }}
            >
              +{amt}
            </motion.button>
          ))}
        </div>

        {/* History */}
        <div>
          <p className="text-[11px] text-gray-500 uppercase mb-2">Letzte Aktivitäten</p>
          {loading ? (
            <Loader2 size={20} className="text-yellow-400 animate-spin mx-auto" />
          ) : pointsHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Noch keine Punkte</p>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {pointsHistory.slice(0, 10).map((h, i) => (
                <div key={i} className="p-2 rounded-lg bg-white/[0.02] flex items-center justify-between">
                  <span className="text-[12px] text-gray-400">{h.reason}</span>
                  <span className={`text-[12px] font-semibold ${h.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                    {h.amount > 0 ? "+" : ""}{h.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS MODAL
// ═══════════════════════════════════════════════════════════════════════════════

export const ReportsModal = ({ isOpen, onClose, child }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && child) {
      loadReport();
    }
  }, [isOpen, child]);

  const loadReport = async () => {
    try {
      const res = await fetch(`${API_URL}/api/kids/reports/${child.child_id}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalWrapper title="Wochenbericht" icon={FileText} color="indigo" onClose={onClose}>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="text-indigo-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Ausgaben" value={`€${report?.spending || 0}`} color="red" />
            <StatCard label="Taschengeld" value={`€${report?.allowance || 0}`} color="green" />
            <StatCard label="Aufgaben" value={report?.tasks_completed || 0} color="yellow" />
            <StatCard label="Punkte" value={report?.points_earned || 0} color="purple" />
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-[11px] text-gray-500 uppercase mb-2">Aktivitäten diese Woche</p>
            <p className="text-gray-400 text-sm">
              {report?.summary || "Keine Aktivitäten in dieser Woche."}
            </p>
          </div>
        </div>
      )}
    </ModalWrapper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SPENDING ANALYTICS MODAL
// ═══════════════════════════════════════════════════════════════════════════════

export const SpendingModal = ({ isOpen, onClose, child }) => {
  const [spending, setSpending] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && child) {
      loadSpending();
    }
  }, [isOpen, child]);

  const loadSpending = async () => {
    try {
      const res = await fetch(`${API_URL}/api/kids/spending/${child.child_id}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSpending(data.transactions || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalWrapper title="Ausgaben" icon={TrendingUp} color="orange" onClose={onClose}>
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-center">
          <p className="text-[11px] text-orange-400/70 uppercase">Diese Woche</p>
          <p className="text-3xl font-bold text-orange-400">€{total.toFixed(2)}</p>
        </div>

        {loading ? (
          <Loader2 size={20} className="text-orange-400 animate-spin mx-auto" />
        ) : spending.length === 0 ? (
          <p className="text-gray-500 text-center py-6">Keine Ausgaben</p>
        ) : (
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {spending.map((tx, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/[0.02] flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-white">{tx.description || "Zahlung"}</p>
                  <p className="text-[10px] text-gray-500">{new Date(tx.created_at).toLocaleDateString("de-DE")}</p>
                </div>
                <p className="text-red-400 font-semibold">-€{tx.amount?.toFixed(2)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalWrapper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// BADGES MODAL
// ═══════════════════════════════════════════════════════════════════════════════

export const BadgesModal = ({ isOpen, onClose, child }) => {
  const ALL_BADGES = [
    { id: "first_task", icon: "🎯", name: "Erste Aufgabe", desc: "Erste Aufgabe erledigt" },
    { id: "saver", icon: "💰", name: "Sparer", desc: "€10 gespart" },
    { id: "helper", icon: "🤝", name: "Helfer", desc: "5 Aufgaben erledigt" },
    { id: "star", icon: "⭐", name: "Star", desc: "100 Punkte gesammelt" },
    { id: "champion", icon: "🏆", name: "Champion", desc: "Wochenziel erreicht" },
    { id: "explorer", icon: "🗺️", name: "Entdecker", desc: "Neue Zone besucht" },
  ];

  const [earnedBadges, setEarnedBadges] = useState(["first_task", "helper"]);

  if (!isOpen) return null;

  return (
    <ModalWrapper title="Abzeichen" icon={Award} color="purple" onClose={onClose}>
      <div className="grid grid-cols-3 gap-3">
        {ALL_BADGES.map((badge) => {
          const earned = earnedBadges.includes(badge.id);
          return (
            <div
              key={badge.id}
              className={`p-3 rounded-xl text-center ${
                earned ? "bg-purple-500/10 border border-purple-500/20" : "bg-white/[0.02] border border-white/5 opacity-50"
              }`}
            >
              <div className="text-3xl mb-1">{badge.icon}</div>
              <p className={`text-[11px] font-semibold ${earned ? "text-white" : "text-gray-500"}`}>{badge.name}</p>
              {earned && <Check size={12} className="text-purple-400 mx-auto mt-1" />}
            </div>
          );
        })}
      </div>
    </ModalWrapper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CHALLENGES MODAL
// ═══════════════════════════════════════════════════════════════════════════════

export const ChallengesModal = ({ isOpen, onClose, child }) => {
  const [challenges, setChallenges] = useState([
    { id: 1, name: "Zimmer aufräumen", reward: 20, progress: 0, goal: 3, active: true },
    { id: 2, name: "Hausaufgaben pünktlich", reward: 50, progress: 4, goal: 5, active: true },
    { id: 3, name: "Ohne Bildschirm", reward: 30, progress: 1, goal: 2, active: false },
  ]);

  if (!isOpen) return null;

  return (
    <ModalWrapper title="Challenges" icon={Target} color="green" onClose={onClose}>
      <div className="space-y-3">
        {challenges.map((ch) => (
          <div
            key={ch.id}
            className={`p-4 rounded-xl border ${
              ch.active ? "bg-green-500/5 border-green-500/20" : "bg-white/[0.02] border-white/5 opacity-60"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[14px] font-semibold text-white">{ch.name}</p>
              <span className="text-yellow-400 text-sm font-bold">+{ch.reward} P</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${(ch.progress / ch.goal) * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-1">{ch.progress}/{ch.goal} erledigt</p>
          </div>
        ))}
        
        <motion.button
          className="w-full py-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 font-semibold text-[13px] flex items-center justify-center gap-2"
          whileTap={{ scale: 0.98 }}
        >
          <Plus size={16} /> Neue Challenge
        </motion.button>
      </div>
    </ModalWrapper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CO-PARENTS MODAL
// ═══════════════════════════════════════════════════════════════════════════════

export const CoParentsModal = ({ isOpen, onClose, child }) => {
  const [coParents, setCoParents] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");

  const sendInvite = () => {
    if (inviteEmail) {
      alert(`Einladung an ${inviteEmail} gesendet!`);
      setInviteEmail("");
    }
  };

  if (!isOpen) return null;

  return (
    <ModalWrapper title="Co-Eltern" icon={UserPlus} color="violet" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-[12px] text-gray-400">
          Lade andere Elternteile ein, um gemeinsam {child?.name}s Konto zu verwalten.
        </p>

        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="E-Mail eingeben"
            className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-[13px] placeholder-gray-600"
          />
          <motion.button
            onClick={sendInvite}
            className="px-4 py-2.5 bg-violet-500 text-white rounded-xl font-semibold text-[13px]"
            whileTap={{ scale: 0.95 }}
          >
            Einladen
          </motion.button>
        </div>

        {coParents.length === 0 ? (
          <div className="py-8 text-center">
            <Users size={32} className="text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500">Noch keine Co-Eltern</p>
          </div>
        ) : (
          <div className="space-y-2">
            {coParents.map((cp, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/[0.02] flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                  <Users size={18} className="text-violet-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] text-white">{cp.name}</p>
                  <p className="text-[10px] text-gray-500">{cp.email}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalWrapper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// BOARD / NOTES MODAL
// ═══════════════════════════════════════════════════════════════════════════════

export const BoardModal = ({ isOpen, onClose, child }) => {
  const [notes, setNotes] = useState([
    { id: 1, text: "Zahnarzt am Freitag!", color: "yellow" },
    { id: 2, text: "Mathe-Test nächste Woche", color: "red" },
  ]);
  const [newNote, setNewNote] = useState("");

  const addNote = () => {
    if (newNote) {
      setNotes([...notes, { id: Date.now(), text: newNote, color: "blue" }]);
      setNewNote("");
    }
  };

  if (!isOpen) return null;

  return (
    <ModalWrapper title="Pinnwand" icon={Bookmark} color="pink" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Neue Notiz..."
            className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-[13px] placeholder-gray-600"
          />
          <motion.button
            onClick={addNote}
            className="px-4 py-2.5 bg-pink-500 text-white rounded-xl"
            whileTap={{ scale: 0.95 }}
          >
            <Plus size={18} />
          </motion.button>
        </div>

        <div className="space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`p-3 rounded-xl border-l-4 bg-white/[0.02] ${
                note.color === "yellow" ? "border-yellow-500" :
                note.color === "red" ? "border-red-500" : "border-blue-500"
              }`}
            >
              <p className="text-[13px] text-white">{note.text}</p>
            </div>
          ))}
        </div>
      </div>
    </ModalWrapper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS MODAL
// ═══════════════════════════════════════════════════════════════════════════════

export const AnalyticsModal = ({ isOpen, onClose, child }) => {
  if (!isOpen) return null;

  return (
    <ModalWrapper title="Analytics" icon={PieChart} color="cyan" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Bildschirmzeit" value="2h 15m" color="purple" />
          <StatCard label="Aufgaben/Woche" value="8" color="yellow" />
          <StatCard label="Durchschnitt" value="€3.50" color="green" />
          <StatCard label="Punkte/Monat" value="+250" color="orange" />
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
          <p className="text-[11px] text-gray-500 uppercase mb-3">Trend (letzte 7 Tage)</p>
          <div className="flex items-end justify-between h-20">
            {[40, 65, 30, 80, 55, 70, 90].map((h, i) => (
              <div
                key={i}
                className="w-6 bg-cyan-500/30 rounded-t"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[9px] text-gray-500">
            <span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span>
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const ModalWrapper = ({ title, icon: Icon, color, onClose, children }) => {
  const colors = {
    purple: "from-purple-500/20 to-purple-900/10 border-purple-500/30 text-purple-400",
    red: "from-red-500/20 to-red-900/10 border-red-500/30 text-red-400",
    yellow: "from-yellow-500/20 to-yellow-900/10 border-yellow-500/30 text-yellow-400",
    orange: "from-orange-500/20 to-orange-900/10 border-orange-500/30 text-orange-400",
    indigo: "from-indigo-500/20 to-indigo-900/10 border-indigo-500/30 text-indigo-400",
    green: "from-green-500/20 to-green-900/10 border-green-500/30 text-green-400",
    violet: "from-violet-500/20 to-violet-900/10 border-violet-500/30 text-violet-400",
    pink: "from-pink-500/20 to-pink-900/10 border-pink-500/30 text-pink-400",
    cyan: "from-cyan-500/20 to-cyan-900/10 border-cyan-500/30 text-cyan-400",
  };

  const colorClass = colors[color] || colors.purple;

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.9)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-lg bg-[#0A0A0F] rounded-t-3xl max-h-[85vh] overflow-hidden"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`bg-gradient-to-b ${colorClass.split(" ").slice(0, 2).join(" ")} px-4 pt-4 pb-3 border-b ${colorClass.split(" ")[2]}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon size={24} className={colorClass.split(" ")[3]} />
              <h2 className="text-[17px] font-bold text-white">{title}</h2>
            </div>
            <motion.button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <X size={16} className="text-gray-400" />
            </motion.button>
          </div>
        </div>
        <div className="p-4 overflow-y-auto max-h-[70vh]">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
};

const StatCard = ({ label, value, color }) => {
  const colors = {
    red: "bg-red-500/10 border-red-500/20 text-red-400",
    green: "bg-green-500/10 border-green-500/20 text-green-400",
    yellow: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
    purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    orange: "bg-orange-500/10 border-orange-500/20 text-orange-400",
  };

  return (
    <div className={`p-3 rounded-xl border ${colors[color]}`}>
      <p className="text-[10px] text-gray-500 uppercase">{label}</p>
      <p className={`text-xl font-bold ${colors[color].split(" ")[2]}`}>{value}</p>
    </div>
  );
};

export default {
  ScreenTimeModal,
  BatteryModal,
  PointsModal,
  ReportsModal,
  SpendingModal,
  BadgesModal,
  ChallengesModal,
  CoParentsModal,
  BoardModal,
  AnalyticsModal,
};
