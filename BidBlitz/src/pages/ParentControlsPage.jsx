/**
 * BidBlitz V2 - Eltern-Kontrollen für Kids-Modus
 * Parent-controls: Module erlauben/sperren, Zeitlimits, Bettzeit, Aktivitätsreport
 */
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Lock, Unlock, Moon, Clock, Shield, BarChart3,
  Check, X, Loader2, Save, RotateCcw, AlertCircle, Sparkles
} from "lucide-react";
import { ParentDashboardOverview } from "../components/kids/ParentDashboardOverview";

const API = process.env.REACT_APP_BACKEND_URL;

const ParentControlsPage = ({ onBack, childId, childName }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(null);
  const [child, setChild] = useState(null);
  const [children, setChildren] = useState([]);
  const [currentChildId, setCurrentChildId] = useState(childId || "");
  const [activity, setActivity] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [tab, setTab] = useState("overview");
  const [error, setError] = useState("");
  const [successFlash, setSuccessFlash] = useState(false);

  useEffect(() => {
    if (childId) setCurrentChildId(childId);
  }, [childId]);

  const loadChildren = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/kids/children`, { credentials: "include" });
      const d = await res.json();
      const kids = d.children || [];
      setChildren(kids);
      if (!currentChildId && kids.length > 0) setCurrentChildId(kids[0].child_id);
    } catch {}
  }, [currentChildId]);

  const load = useCallback(async () => {
    if (!currentChildId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/kids/controls/${currentChildId}/settings`, {
        credentials: "include",
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || "Fehler beim Laden");
      setSettings(d.settings);
      setChild(d.child);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [currentChildId]);

  const loadDashboard = useCallback(async () => {
    if (!currentChildId) return;
    try {
      const res = await fetch(`${API}/api/kids/controls/${currentChildId}/dashboard`, {
        credentials: "include",
      });
      if (res.ok) setDashboard(await res.json());
    } catch {}
  }, [currentChildId]);

  const loadActivity = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/kids/controls/${currentChildId}/activity?days=7`, {
        credentials: "include",
      });
      if (res.ok) setActivity(await res.json());
    } catch {}
  }, [currentChildId]);

  useEffect(() => { loadChildren(); }, [loadChildren]);
  useEffect(() => { load(); loadDashboard(); }, [load, loadDashboard]);
  useEffect(() => { if (tab === "activity") loadActivity(); }, [tab, loadActivity]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const body = {
        modules: settings.modules || {},
        bedtime_enabled: !!settings.bedtime_enabled,
        bedtime_start: settings.bedtime_start || "21:00",
        bedtime_end: settings.bedtime_end || "07:00",
        weekend_extra_minutes: settings.weekend_extra_minutes || 0,
        lock_all: !!settings.lock_all,
        notes: settings.notes || "",
      };
      const res = await fetch(`${API}/api/kids/controls/${currentChildId}/settings`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || "Speichern fehlgeschlagen");
      setSettings(d.settings);
      loadDashboard();
      setSuccessFlash(true);
      setTimeout(() => setSuccessFlash(false), 1500);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  const masterLock = async (lock) => {
    try {
      const res = await fetch(`${API}/api/kids/controls/${currentChildId}/master-lock`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lock }),
      });
      if (res.ok) {
        setSettings((s) => ({ ...s, lock_all: lock }));
        loadDashboard();
        setSuccessFlash(true);
        setTimeout(() => setSuccessFlash(false), 1500);
      }
    } catch {}
  };

  const toggleModule = (key) => {
    const current = settings.modules?.[key] || { allowed: true, daily_minutes: 0 };
    const next = { ...current, allowed: !current.allowed };
    if (!next.allowed) next.daily_minutes = 0;
    setSettings((s) => ({ ...s, modules: { ...(s.modules || {}), [key]: next } }));
  };

  const setMinutes = (key, minutes) => {
    const current = settings.modules?.[key] || { allowed: true, daily_minutes: 0 };
    setSettings((s) => ({
      ...s,
      modules: { ...(s.modules || {}), [key]: { ...current, daily_minutes: parseInt(minutes) || 0, allowed: true } },
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  if (!currentChildId) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex flex-col items-center justify-center p-6" data-testid="parent-controls-empty-state">
        <Shield className="mb-3 text-white/20" size={32} />
        <p className="text-[14px] font-bold">Noch kein Kind ausgewählt</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 rounded-xl bg-white/10 text-[12px]" data-testid="parent-controls-empty-back">Zurück</button>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center" data-testid="parent-controls-loading-state">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  const modulesList = MODULES_META;
  const childDisplay = child?.name || children.find((c) => c.child_id === currentChildId)?.name || childName || "Kind";

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="parent-controls-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
            data-testid="parent-controls-back"
            className="p-2 rounded-xl bg-white/5 border border-white/10">
            <ArrowLeft size={18} />
          </motion.button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Shield size={16} className="text-[#00D26A]" />
              <h1 className="text-[15px] font-bold truncate">Eltern-Kontrollen</h1>
            </div>
            <p className="text-[10px] text-gray-500 truncate">
              für {childDisplay} · {child?.age ? `${child.age} Jahre` : "Kind"}
            </p>
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={save} disabled={saving}
            data-testid="parent-controls-save"
            className={`px-3 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-50 ${successFlash ? 'bg-[#00D26A] text-black' : 'bg-gradient-to-r from-[#00C2FF] to-[#A855F7] text-white'}`}>
            {saving ? <Loader2 className="animate-spin" size={12} /> : successFlash ? <Check size={12} /> : <Save size={12} />}
            {successFlash ? "OK" : "Speichern"}
          </motion.button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mt-3 -mb-1">
          {[
            { k: "overview", label: "Übersicht", icon: Sparkles },
            { k: "modules", label: "Module", icon: Shield },
            { k: "time", label: "Zeit", icon: Clock },
            { k: "activity", label: "Report", icon: BarChart3 },
          ].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              data-testid={`tab-${t.k}`}
              className={`flex-1 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${tab === t.k ? 'bg-white/10 text-white' : 'bg-white/[0.03] text-gray-500'}`}>
              <t.icon size={12} /> {t.label}
            </button>
          ))}
        </div>
        {children.length > 1 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1" data-testid="parent-controls-child-switcher">
            {children.map((kid) => (
              <button key={kid.child_id} onClick={() => setCurrentChildId(kid.child_id)} data-testid={`parent-controls-child-${kid.child_id}`}
                className={`px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap ${currentChildId === kid.child_id ? 'bg-white/10 text-white border border-white/10' : 'bg-white/[0.03] text-gray-500 border border-transparent'}`}>
                {kid.avatar || "🦁"} {kid.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Master Lock Banner */}
      <div className="p-4 pb-2">
        <motion.button whileTap={{ scale: 0.99 }}
          data-testid="master-lock-toggle"
          onClick={() => masterLock(!settings.lock_all)}
          className={`w-full p-4 rounded-2xl flex items-center gap-3 border transition-colors ${settings.lock_all
            ? 'bg-red-500/10 border-red-500/30 text-red-300'
            : 'bg-[#00D26A]/10 border-[#00D26A]/30 text-[#00D26A]'}`}>
          {settings.lock_all ? <Lock size={22} /> : <Unlock size={22} />}
          <div className="flex-1 text-left">
            <p className="font-bold text-[14px]">
              {settings.lock_all ? "Komplett gesperrt" : "Alles freigegeben"}
            </p>
            <p className="text-[10px] opacity-70">
              {settings.lock_all
                ? "Kind kann gerade nichts nutzen · Tippen zum Entsperren"
                : "Tippen um sofort alles zu sperren"}
            </p>
          </div>
        </motion.button>
        {error && (
          <div className="mt-2 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-[12px] text-red-300">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {tab === "overview" && (
        <ParentDashboardOverview dashboard={dashboard} onOpenActivity={() => setTab("activity")} onOpenTime={() => setTab("time")} />
      )}

      {/* ───── TAB: Modules ───── */}
      {tab === "modules" && (
        <div className="p-4 pt-2 space-y-2" data-testid="modules-list">
          <p className="text-[11px] text-gray-500 mb-2">Was darf {childDisplay} in BidBlitz nutzen?</p>
          {modulesList.map(m => {
            const rule = settings.modules?.[m.key] || { allowed: m.default_allowed, daily_minutes: m.default_minutes };
            const tooYoung = child?.age && child.age < m.age_min;
            return (
              <div key={m.key}
                data-testid={`module-${m.key}`}
                className={`rounded-2xl border p-3 transition-colors ${rule.allowed ? 'bg-white/5 border-white/10' : 'bg-white/[0.02] border-white/5 opacity-70'}`}>
                <div className="flex items-center gap-3">
                  <div className="text-[22px]">{m.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold truncate">{m.label}</p>
                    {tooYoung && (
                      <p className="text-[9px] text-orange-400">Nicht für {child.age}-Jährige (ab {m.age_min})</p>
                    )}
                  </div>
                  <button onClick={() => toggleModule(m.key)}
                    data-testid={`toggle-${m.key}`}
                    aria-label={rule.allowed ? "Sperren" : "Erlauben"}
                    className={`w-12 h-7 rounded-full relative transition-colors ${rule.allowed ? 'bg-[#00D26A]' : 'bg-gray-700'}`}>
                    <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${rule.allowed ? 'left-[22px]' : 'left-0.5'}`}/>
                  </button>
                </div>

                {rule.allowed && (
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wide flex-1">
                      Tages-Limit
                    </label>
                    <div className="flex items-center gap-1.5 bg-black/30 rounded-lg px-2 py-1">
                      <input
                        type="number"
                        min="0"
                        max="600"
                        value={rule.daily_minutes || 0}
                        onChange={(e) => setMinutes(m.key, e.target.value)}
                        data-testid={`minutes-${m.key}`}
                        className="w-14 bg-transparent outline-none text-[13px] font-bold text-white text-right tabular-nums"
                      />
                      <span className="text-[10px] text-gray-500">min{rule.daily_minutes === 0 ? " (unbegrenzt)" : ""}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ───── TAB: Time ───── */}
      {tab === "time" && (
        <div className="p-4 pt-2 space-y-3" data-testid="time-settings">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Moon size={18} className="text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-bold">Bettzeit-Modus</p>
                <p className="text-[10px] text-gray-500">Komplett gesperrt während dieser Zeiten</p>
              </div>
              <button onClick={() => setSettings(s => ({ ...s, bedtime_enabled: !s.bedtime_enabled }))}
                data-testid="bedtime-toggle"
                className={`w-12 h-7 rounded-full relative transition-colors ${settings.bedtime_enabled ? 'bg-[#A855F7]' : 'bg-gray-700'}`}>
                <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${settings.bedtime_enabled ? 'left-[22px]' : 'left-0.5'}`}/>
              </button>
            </div>
            {settings.bedtime_enabled && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-black/30 rounded-xl p-3">
                  <label className="text-[9px] uppercase text-gray-500 font-bold tracking-wider">Von</label>
                  <input type="time"
                    data-testid="bedtime-start"
                    value={settings.bedtime_start || "21:00"}
                    onChange={(e) => setSettings(s => ({ ...s, bedtime_start: e.target.value }))}
                    className="w-full bg-transparent outline-none text-[16px] font-bold mt-0.5 [color-scheme:dark]"/>
                </div>
                <div className="bg-black/30 rounded-xl p-3">
                  <label className="text-[9px] uppercase text-gray-500 font-bold tracking-wider">Bis</label>
                  <input type="time"
                    data-testid="bedtime-end"
                    value={settings.bedtime_end || "07:00"}
                    onChange={(e) => setSettings(s => ({ ...s, bedtime_end: e.target.value }))}
                    className="w-full bg-transparent outline-none text-[16px] font-bold mt-0.5 [color-scheme:dark]"/>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#FFB800]/20 flex items-center justify-center">
                <Sparkles size={18} className="text-[#FFB800]" />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-bold">Wochenend-Bonus</p>
                <p className="text-[10px] text-gray-500">Extra-Minuten Sa & So zusätzlich zum Tageslimit</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input type="range" min="0" max="120" step="15"
                data-testid="weekend-bonus"
                value={settings.weekend_extra_minutes || 0}
                onChange={(e) => setSettings(s => ({ ...s, weekend_extra_minutes: parseInt(e.target.value) }))}
                className="flex-1 accent-[#FFB800]"/>
              <span className="text-[13px] font-bold text-[#FFB800] tabular-nums w-16 text-right">
                +{settings.weekend_extra_minutes || 0} min
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ───── TAB: Activity Report ───── */}
      {tab === "activity" && (
        <div className="p-4 pt-2 space-y-3" data-testid="activity-report">
          {!activity && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-500" size={18} /></div>}
          {activity && (
            <>
              <div className="bg-gradient-to-br from-[#00C2FF]/10 to-[#A855F7]/10 border border-white/10 rounded-2xl p-4 text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Gesamt letzte 7 Tage</p>
                <p className="text-[32px] font-black text-white tabular-nums my-1">
                  {Math.floor(activity.total_minutes / 60)}<span className="text-[16px] text-gray-500"> h </span>
                  {activity.total_minutes % 60}<span className="text-[16px] text-gray-500"> min</span>
                </p>
                <p className="text-[11px] text-gray-400">von {childDisplay}</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Nach Modul</p>
                {Object.keys(activity.per_module || {}).length === 0 ? (
                  <p className="text-[12px] text-gray-500 text-center py-4">Noch keine Nutzung aufgezeichnet</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(activity.per_module || {})
                      .sort((a, b) => b[1] - a[1])
                      .map(([key, mins]) => {
                        const meta = MODULES_META.find(m => m.key === key);
                        const maxMins = Math.max(...Object.values(activity.per_module || {}));
                        const pct = maxMins > 0 ? (mins / maxMins) * 100 : 0;
                        return (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-[16px] w-6">{meta?.icon || "•"}</span>
                            <div className="flex-1">
                              <div className="flex justify-between text-[11px] mb-1">
                                <span className="text-white">{meta?.label || key}</span>
                                <span className="text-gray-400 tabular-nums">
                                  {Math.floor(mins / 60) > 0 && `${Math.floor(mins / 60)}h `}{mins % 60}m
                                </span>
                              </div>
                              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-[#00C2FF] to-[#A855F7]"
                                  style={{ width: `${pct}%` }}/>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              <button
                data-testid="reset-usage"
                onClick={async () => {
                  await fetch(`${API}/api/kids/controls/${currentChildId}/reset-usage`, {
                    method: "POST", credentials: "include"
                  });
                  loadActivity();
                  loadDashboard();
                }}
                className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-[12px] text-gray-400 flex items-center justify-center gap-2">
                <RotateCcw size={14} /> Heutige Nutzung zurücksetzen
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Module metadata (keeps UI labels/icons in sync with backend AVAILABLE_MODULES).
const MODULES_META = [
  { key: "arcade",      label: "Mini-Spiele",       icon: "🎮", default_allowed: true,  default_minutes: 60,  age_min: 6 },
  { key: "streaming",   label: "Streaming & Videos",icon: "📺", default_allowed: true,  default_minutes: 90,  age_min: 6 },
  { key: "learn",       label: "Lern-Kurse",        icon: "📚", default_allowed: true,  default_minutes: 120, age_min: 6 },
  { key: "quests",      label: "Tägliche Quests",   icon: "⭐", default_allowed: true,  default_minutes: 30,  age_min: 6 },
  { key: "food",        label: "Food Delivery",     icon: "🍕", default_allowed: true,  default_minutes: 15,  age_min: 8 },
  { key: "chatbot",     label: "AI-Chatbot",        icon: "🤖", default_allowed: true,  default_minutes: 20,  age_min: 8 },
  { key: "shopping",    label: "Shopping",          icon: "🛒", default_allowed: false, default_minutes: 0,   age_min: 10 },
  { key: "wallet_spend",label: "Geld ausgeben",     icon: "💳", default_allowed: false, default_minutes: 0,   age_min: 8 },
  { key: "auctions",    label: "Auktionen",         icon: "🔨", default_allowed: false, default_minutes: 0,   age_min: 12 },
  { key: "social",      label: "Social Feed",       icon: "💬", default_allowed: false, default_minutes: 0,   age_min: 13 },
  { key: "nft",         label: "NFT-Shop",          icon: "🎨", default_allowed: false, default_minutes: 0,   age_min: 13 },
  { key: "taxi",        label: "Taxi bestellen",    icon: "🚕", default_allowed: false, default_minutes: 0,   age_min: 16 },
  { key: "dating",      label: "Dating",            icon: "❤️", default_allowed: false, default_minutes: 0,   age_min: 18 },
];

export default ParentControlsPage;
