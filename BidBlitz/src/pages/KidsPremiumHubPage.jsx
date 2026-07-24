/**
 * KidsPremiumHubPage — Eltern-Übersicht für alle neuen Premium-Kids-Features
 * Routes:
 *   - Aufgaben (Chores)
 *   - AI Tutor "Buddy"
 *   - Geschenk-QR
 *   - Badges & Achievements
 *   - Käufe genehmigen
 *   - Taschengeld-Automation
 *   - Spenden
 *   - AI Familien-Tipps
 *   - Schul-/Schlafmodus
 *   - Geschwister-Transfer
 *   - Finanzkurse
 *   - Mini-Games
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ListChecks, Sparkles, Gift, Trophy, ShoppingBag, Calendar,
  Heart, Brain, Moon, ArrowLeftRight, BookOpen, Gamepad2, Loader2, Plus,
  Check, X, QrCode, ChevronRight, Star,
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const FEATURES = [
  { id: "chores", icon: ListChecks, label: "Aufgaben", color: "#00D26A", desc: "BLZ verdienen" },
  { id: "tutor", icon: Sparkles, label: "AI Buddy", color: "#A855F7", desc: "Lernhelfer" },
  { id: "gift", icon: Gift, label: "Geschenk-QR", color: "#EC4899", desc: "Verwandte schenken" },
  { id: "badges", icon: Trophy, label: "Badges", color: "#FFD700", desc: "Auszeichnungen" },
  { id: "approval", icon: ShoppingBag, label: "Genehmigung", color: "#FF8C42", desc: "Käufe prüfen" },
  { id: "allowance", icon: Calendar, label: "Taschengeld", color: "#00C2FF", desc: "Auto-Zahlung" },
  { id: "donate", icon: Heart, label: "Spenden", color: "#FF4060", desc: "Gutes tun" },
  { id: "insights", icon: Brain, label: "Familien-AI", color: "#3B82F6", desc: "Eltern-Tipps" },
  { id: "school", icon: Moon, label: "Schul-Modus", color: "#8B5CF6", desc: "Auto-Sperre" },
  { id: "courses", icon: BookOpen, label: "Finanzkurse", color: "#10B981", desc: "Geld lernen" },
  { id: "games", icon: Gamepad2, label: "Mini-Games", color: "#F59E0B", desc: "Spielen + BLZ" },
];

export default function KidsPremiumHubPage({ onBack, childId }) {
  const [child, setChild] = useState(null);
  const [activeFeature, setActiveFeature] = useState(null);

  useEffect(() => {
    if (!childId) return;
    fetch(`${API}/api/kids/children`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        const c = (d.children || []).find(x => x.child_id === childId);
        if (c) setChild(c);
      })
      .catch(() => {});
  }, [childId]);

  if (!childId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4">
        <div className="text-center">
          <p className="text-white/60 text-[14px] mb-4">Bitte zuerst ein Kind auswählen</p>
          <button onClick={onBack} className="px-4 py-2 rounded-xl bg-white/10 text-white text-[12px]">Zurück</button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="kids-premium-hub" className="min-h-screen pb-24"
         style={{ background: "radial-gradient(circle at 50% 0%, rgba(168,85,247,0.18), transparent 50%), #050505" }}>
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#050505]/90 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3">
          <motion.button onClick={onBack} data-testid="kids-hub-back"
            whileTap={{ scale: 0.92 }}
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <ArrowLeft size={15} className="text-white/70" />
          </motion.button>
          <h1 className="text-[14px] font-bold text-white">Kids Premium</h1>
          <div className="w-9" />
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Child info */}
        {child && (
          <div className="rounded-2xl p-4 flex items-center gap-3"
               style={{ background: `linear-gradient(135deg, ${child.color || '#00C2FF'}22, ${child.color || '#00C2FF'}08)`,
                        border: `1px solid ${child.color || '#00C2FF'}33` }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[22px] font-black"
                 style={{ background: child.color || '#00C2FF', color: "#000" }}>
              {child.avatar || child.name?.[0]}
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-black text-white">{child.name}</p>
              <p className="text-[10px] text-white/50">11 neue Features verfügbar</p>
            </div>
          </div>
        )}

        {/* Feature Grid */}
        <div className="grid grid-cols-3 gap-2">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.button
                key={f.id}
                data-testid={`kids-feature-${f.id}`}
                onClick={() => setActiveFeature(f.id)}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1.5 p-2"
                style={{
                  background: `linear-gradient(135deg, ${f.color}18, ${f.color}06)`,
                  border: `1px solid ${f.color}28`,
                }}
              >
                <Icon size={20} style={{ color: f.color }} />
                <p className="text-[10px] font-bold text-white text-center leading-tight">{f.label}</p>
                <p className="text-[8px] text-white/50 text-center leading-tight">{f.desc}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Feature Sheet */}
      <AnimatePresence>
        {activeFeature && (
          <FeatureSheet
            feature={activeFeature}
            childId={childId}
            child={child}
            onClose={() => setActiveFeature(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// FEATURE BOTTOM SHEET (renders the right detail content per feature)
// ─────────────────────────────────────────────────────────────────────
function FeatureSheet({ feature, childId, child, onClose }) {
  const cfg = FEATURES.find(f => f.id === feature);
  const Icon = cfg?.icon || Sparkles;

  return (
    <motion.div
      data-testid={`feature-sheet-${feature}`}
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full sm:max-w-md max-h-[90vh] bg-[#0a0a0a] border-t sm:border border-white/[0.08] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden"
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0"
             style={{ background: `linear-gradient(135deg, ${cfg?.color}18, transparent)` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center"
                 style={{ background: `${cfg?.color}22` }}>
              <Icon size={16} style={{ color: cfg?.color }} />
            </div>
            <h2 className="text-[14px] font-black text-white">{cfg?.label}</h2>
          </div>
          <button onClick={onClose} data-testid="feature-sheet-close"
                  className="w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center">
            <X size={16} className="text-white/70" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {feature === "chores" && <ChoresPanel childId={childId} />}
          {feature === "tutor" && <TutorPanel childId={childId} childName={child?.name} />}
          {feature === "gift" && <GiftPanel childId={childId} child={child} />}
          {feature === "badges" && <BadgesPanel childId={childId} />}
          {feature === "approval" && <ApprovalPanel childId={childId} />}
          {feature === "allowance" && <AllowancePanel childId={childId} />}
          {feature === "donate" && <DonatePanel childId={childId} child={child} />}
          {feature === "insights" && <InsightsPanel childId={childId} />}
          {feature === "school" && <SchoolModePanel childId={childId} />}
          {feature === "courses" && <CoursesPanel childId={childId} />}
          {feature === "games" && <GamesPanel childId={childId} />}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Reusable: simple fetch hook ───
function useApi(url, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    fetch(`${API}${url}`, { credentials: "include" })
      .then(r => r.json()).then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, reload };
}

const Loading = () => (
  <div className="py-8 flex justify-center"><Loader2 size={20} className="animate-spin text-white/40" /></div>
);

// ─── 1) CHORES ───
function ChoresPanel({ childId }) {
  const { data, loading, reload } = useApi(`/api/kids-premium/chores/${childId}`, [childId]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [reward, setReward] = useState(15);

  const create = async () => {
    if (!title.trim()) return;
    try {
      const r = await fetch(`${API}/api/kids-premium/chores`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ child_id: childId, title: title.trim(), reward_blz: Number(reward) || 10 }),
      });
      if (!r.ok) throw new Error();
      toast.success("Aufgabe angelegt");
      setTitle(""); setReward(15); setShowForm(false); reload();
    } catch { toast.error("Fehler"); }
  };

  const decide = async (chore_id, action) => {
    try {
      await fetch(`${API}/api/kids-premium/chores/${chore_id}/${action}`, { method: "POST", credentials: "include" });
      toast.success(action === "approve" ? "Genehmigt + BLZ gutgeschrieben" : "Abgelehnt");
      reload();
    } catch { toast.error("Fehler"); }
  };

  if (loading) return <Loading />;
  const chores = data?.chores || [];
  return (
    <div className="space-y-3">
      <button data-testid="add-chore-btn" onClick={() => setShowForm(!showForm)}
              className="w-full py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[12px] font-bold flex items-center justify-center gap-2">
        <Plus size={14} /> Neue Aufgabe
      </button>
      {showForm && (
        <div className="rounded-xl p-3 bg-white/[0.04] border border-white/[0.06] space-y-2">
          <input data-testid="chore-title" value={title} onChange={(e) => setTitle(e.target.value)}
                 placeholder="z.B. Zimmer aufräumen"
                 className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-2 text-[12px] text-white placeholder-white/40" />
          <div className="flex gap-2">
            <input type="number" data-testid="chore-reward" value={reward} onChange={(e) => setReward(e.target.value)}
                   className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-2 text-[12px] text-white" />
            <span className="self-center text-[11px] text-white/50">BLZ</span>
          </div>
          <button onClick={create} data-testid="chore-save"
                  className="w-full py-2 rounded-lg bg-emerald-500 text-black text-[12px] font-bold">Speichern</button>
        </div>
      )}
      {chores.length === 0 ? (
        <p className="text-center text-[12px] text-white/50 py-6">Noch keine Aufgaben</p>
      ) : (
        chores.map(c => (
          <div key={c.chore_id} data-testid={`chore-${c.chore_id}`}
               className="rounded-xl p-3 bg-white/[0.04] border border-white/[0.06]">
            <div className="flex items-start gap-2.5">
              <span className="text-[20px]">{c.icon || "🧹"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-white">{c.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                        style={{ background: c.status === "approved" ? "#10B98122" : c.status === "submitted" ? "#FFB80022" : "#FFFFFF11",
                                 color: c.status === "approved" ? "#10B981" : c.status === "submitted" ? "#FFB800" : "#fff" }}>
                    {c.status === "approved" ? "Genehmigt" : c.status === "submitted" ? "Wartet" : c.status === "rejected" ? "Abgelehnt" : "Offen"}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold">+{c.reward_blz} BLZ</span>
                </div>
              </div>
              {c.status === "submitted" && (
                <div className="flex gap-1 flex-shrink-0">
                  <button data-testid={`approve-${c.chore_id}`} onClick={() => decide(c.chore_id, "approve")}
                          className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center"><Check size={13} className="text-black" /></button>
                  <button data-testid={`reject-${c.chore_id}`} onClick={() => decide(c.chore_id, "reject")}
                          className="w-7 h-7 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center"><X size={13} className="text-red-300" /></button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── 2) AI TUTOR ───
function TutorPanel({ childId, childName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  const send = async () => {
    if (!input.trim() || busy) return;
    const msg = input.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", content: msg }]);
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/kids-premium/tutor/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ child_id: childId, message: msg, session_id: sessionId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error();
      setSessionId(j.session_id);
      setMessages(m => [...m, { role: "assistant", content: j.reply }]);
    } catch { toast.error("Buddy gerade nicht erreichbar"); }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl p-3 bg-purple-500/10 border border-purple-500/30">
        <p className="text-[11px] text-purple-200 leading-relaxed">
          <Sparkles size={11} className="inline mr-1" />
          <strong>Buddy</strong> ist {childName}s freundlicher Lernhelfer. Er erklärt Geld, Mathe und mehr — kindgerecht und sicher.
        </p>
      </div>
      <div className="space-y-2 min-h-[200px] max-h-[300px] overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-center text-[11px] text-white/40 py-8">Stell Buddy eine Frage!</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-[12px] ${m.role === "user" ? "ml-auto bg-purple-500 text-white" : "mr-auto bg-white/[0.06] text-white border border-white/[0.06]"}`}>
            {m.content}
          </div>
        ))}
        {busy && <div className="flex gap-2 items-center text-[11px] text-white/40"><Loader2 size={12} className="animate-spin" /> denkt...</div>}
      </div>
      <div className="flex gap-2">
        <input data-testid="tutor-input" value={input} onChange={(e) => setInput(e.target.value)}
               onKeyDown={(e) => e.key === "Enter" && send()}
               placeholder="Was ist Sparen?"
               className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[12px] text-white placeholder-white/40" />
        <button data-testid="tutor-send" onClick={send} disabled={busy || !input.trim()}
                className="px-4 rounded-xl bg-purple-500 text-white text-[12px] font-bold disabled:opacity-40">Senden</button>
      </div>
    </div>
  );
}

// ─── 3) GIFT QR ───
function GiftPanel({ childId, child }) {
  const { data, loading } = useApi(`/api/kids-premium/gift/qr/${childId}`, [childId]);
  const { data: gifts } = useApi(`/api/kids-premium/gift/list/${childId}`, [childId]);
  if (loading) return <Loading />;
  return (
    <div className="space-y-3">
      <div className="rounded-2xl p-4 bg-white text-black text-center">
        <QrCode size={120} className="mx-auto" />
        <p className="text-[13px] font-bold mt-2">Geschenk-Code für {child?.name}</p>
        <p className="text-[10px] text-black/60 mt-1 break-all">{data?.qr_url}</p>
      </div>
      <button data-testid="copy-gift-link" onClick={() => { navigator.clipboard.writeText(data?.qr_url || ""); toast.success("Link kopiert"); }}
              className="w-full py-2.5 rounded-xl bg-pink-500/10 border border-pink-500/30 text-pink-300 text-[12px] font-bold">
        Link kopieren & teilen
      </button>
      {gifts?.gifts?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Erhalten ({gifts.total_eur.toFixed(2)}€)</p>
          {gifts.gifts.slice(0, 5).map((g, i) => (
            <div key={i} className="rounded-lg px-3 py-2 bg-white/[0.04] flex items-center justify-between">
              <p className="text-[11px] text-white">{g.sender_name}</p>
              <p className="text-[11px] font-bold text-pink-300">+{g.amount_eur.toFixed(2)}€</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 4) BADGES ───
function BadgesPanel({ childId }) {
  const { data, loading } = useApi(`/api/kids-premium/badges/${childId}`, [childId]);
  if (loading) return <Loading />;
  const all = data?.all || [];
  return (
    <div className="space-y-3">
      <p className="text-center text-[13px] font-bold text-amber-300">{data?.earned_count} / {data?.total} Badges</p>
      <div className="grid grid-cols-3 gap-2">
        {all.map(b => (
          <div key={b.id} data-testid={`badge-${b.id}`}
               className={`aspect-square rounded-xl p-2 flex flex-col items-center justify-center text-center ${b.earned ? "" : "opacity-40 grayscale"}`}
               style={{ background: b.earned ? "linear-gradient(135deg, rgba(255,215,0,0.18), rgba(255,140,0,0.08))" : "rgba(255,255,255,0.03)",
                        border: b.earned ? "1px solid rgba(255,215,0,0.4)" : "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-[24px]">{b.icon}</span>
            <p className="text-[9px] font-bold text-white mt-1 leading-tight">{b.title}</p>
            <p className="text-[8px] text-white/50 mt-0.5">{b.current}/{b.threshold}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 5) APPROVAL ───
function ApprovalPanel({ childId }) {
  const { data, loading, reload } = useApi(`/api/kids-premium/approval/${childId}`, [childId]);
  const decide = async (id, decision) => {
    try {
      await fetch(`${API}/api/kids-premium/approval/${id}/decide?decision=${decision}`, { method: "POST", credentials: "include" });
      toast.success(decision === "approve" ? "Genehmigt" : "Abgelehnt");
      reload();
    } catch { toast.error("Fehler"); }
  };
  if (loading) return <Loading />;
  const items = data?.approvals || [];
  if (items.length === 0) return <p className="text-center text-[12px] text-white/50 py-8">Keine Käufe zu prüfen</p>;
  return (
    <div className="space-y-2">
      {items.map(a => (
        <div key={a.approval_id} className="rounded-xl p-3 bg-white/[0.04] border border-white/[0.06]">
          <p className="text-[13px] font-bold text-white">{a.item_name}</p>
          <p className="text-[11px] text-orange-300 font-bold mt-0.5">{a.amount_eur.toFixed(2)}€</p>
          {a.note && <p className="text-[10px] text-white/50 mt-1 italic">"{a.note}"</p>}
          {a.status === "pending" ? (
            <div className="flex gap-2 mt-2">
              <button data-testid={`approve-${a.approval_id}`} onClick={() => decide(a.approval_id, "approve")}
                      className="flex-1 py-1.5 rounded-lg bg-emerald-500 text-black text-[11px] font-bold">Genehmigen</button>
              <button onClick={() => decide(a.approval_id, "reject")}
                      className="flex-1 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-[11px] font-bold">Ablehnen</button>
            </div>
          ) : (
            <p className="text-[10px] text-white/40 mt-1 capitalize">{a.status}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── 6) ALLOWANCE ───
function AllowancePanel({ childId }) {
  const { data, loading, reload } = useApi(`/api/kids-premium/allowance/${childId}`, [childId]);
  const [amount, setAmount] = useState(5);
  const [freq, setFreq] = useState("weekly");

  useEffect(() => {
    if (data?.config) {
      setAmount(data.config.amount_eur || 5);
      setFreq(data.config.frequency || "weekly");
    }
  }, [data]);

  const save = async () => {
    try {
      await fetch(`${API}/api/kids-premium/allowance/configure`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ child_id: childId, amount_eur: Number(amount), frequency: freq }),
      });
      toast.success("Gespeichert");
      reload();
    } catch { toast.error("Fehler"); }
  };
  if (loading) return <Loading />;
  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-bold text-white/50 uppercase mb-1.5 block">Betrag (€)</label>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.5" min="0.5"
               className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-white/50 uppercase mb-1.5 block">Häufigkeit</label>
        <div className="grid grid-cols-3 gap-1.5">
          {[["weekly","Wöchentlich"],["biweekly","Alle 2 Wochen"],["monthly","Monatlich"]].map(([id, lbl]) => (
            <button key={id} onClick={() => setFreq(id)}
                    className={`py-2 rounded-lg text-[11px] font-bold ${freq === id ? "bg-cyan-500 text-black" : "bg-white/[0.04] text-white/70 border border-white/[0.06]"}`}>
              {lbl}
            </button>
          ))}
        </div>
      </div>
      <button data-testid="allowance-save" onClick={save}
              className="w-full py-2.5 rounded-xl bg-cyan-500 text-black text-[12px] font-bold">Speichern</button>
      {data?.history?.length > 0 && (
        <div className="space-y-1 mt-3">
          <p className="text-[10px] font-bold text-white/50 uppercase">Letzte Auszahlungen</p>
          {data.history.slice(0, 5).map((h, i) => (
            <div key={i} className="flex justify-between text-[11px] text-white/70 px-1">
              <span>{new Date(h.paid_at).toLocaleDateString("de-DE")}</span>
              <span className="text-emerald-300">+{h.amount_eur.toFixed(2)}€</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 7) DONATE ───
function DonatePanel({ childId, child }) {
  const { data: chData } = useApi(`/api/kids-premium/charities`, []);
  const { data: donList, reload } = useApi(`/api/kids-premium/donations/${childId}`, [childId]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState(2);

  const donate = async () => {
    if (!selected) return;
    try {
      const r = await fetch(`${API}/api/kids-premium/donate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ child_id: childId, charity_id: selected, amount_eur: Number(amount) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail);
      toast.success(`Spende an ${j.charity}!`);
      setSelected(null); reload();
    } catch (e) { toast.error(e.message || "Fehler"); }
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-white/60">Guthaben: <span className="font-bold text-white">{(child?.balance || 0).toFixed(2)}€</span></p>
      {(chData?.charities || []).map(c => (
        <button key={c.id} onClick={() => setSelected(c.id)}
                data-testid={`charity-${c.id}`}
                className={`w-full text-left rounded-xl p-3 flex items-center gap-3 ${selected === c.id ? "bg-pink-500/20 border-pink-500/50" : "bg-white/[0.04] border-white/[0.06]"} border`}>
          <span className="text-[24px]">{c.icon}</span>
          <div className="flex-1">
            <p className="text-[12px] font-bold text-white">{c.name}</p>
            <p className="text-[10px] text-white/50">{c.desc}</p>
          </div>
          {selected === c.id && <Check size={16} className="text-pink-300" />}
        </button>
      ))}
      {selected && (
        <div className="space-y-2">
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="0.5" max="100" step="0.5"
                 className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white" />
          <button onClick={donate} data-testid="donate-confirm"
                  className="w-full py-2.5 rounded-xl bg-pink-500 text-white text-[12px] font-bold">Spenden ({Number(amount).toFixed(2)}€)</button>
        </div>
      )}
      {donList?.count > 0 && (
        <p className="text-center text-[10px] text-white/50 mt-2">Bisher gespendet: <span className="text-pink-300 font-bold">{donList.total_eur.toFixed(2)}€</span></p>
      )}
    </div>
  );
}

// ─── 8) INSIGHTS ───
function InsightsPanel({ childId }) {
  const { data, loading } = useApi(`/api/kids-premium/insights/${childId}`, [childId]);
  if (loading) return <Loading />;
  const tips = data?.insights || [];
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-blue-300 mb-2 flex items-center gap-1.5">
        <Sparkles size={12} /> KI-generierte Tipps
      </p>
      {tips.length === 0 ? (
        <p className="text-center text-[12px] text-white/50 py-6">Noch keine Tipps verfügbar</p>
      ) : tips.map((t, i) => (
        <div key={i} data-testid={`insight-${i}`}
             className="rounded-xl p-3 bg-blue-500/8 border border-blue-500/20">
          <div className="flex gap-2">
            <Star size={12} className="text-blue-300 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-white leading-relaxed">{t}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 9) SCHOOL MODE ───
function SchoolModePanel({ childId }) {
  const { data, loading, reload } = useApi(`/api/kids-premium/school-mode/${childId}`, [childId]);
  const [enabled, setEnabled] = useState(true);
  const [schoolStart, setSchoolStart] = useState("08:00");
  const [schoolEnd, setSchoolEnd] = useState("13:00");
  const [sleepStart, setSleepStart] = useState("21:00");
  const [sleepEnd, setSleepEnd] = useState("07:00");

  useEffect(() => {
    if (data?.config) {
      setEnabled(data.config.enabled);
      setSchoolStart(data.config.school_start);
      setSchoolEnd(data.config.school_end);
      setSleepStart(data.config.sleep_start);
      setSleepEnd(data.config.sleep_end);
    }
  }, [data]);

  const save = async () => {
    try {
      await fetch(`${API}/api/kids-premium/school-mode`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ child_id: childId, enabled, school_start: schoolStart, school_end: schoolEnd, sleep_start: sleepStart, sleep_end: sleepEnd }),
      });
      toast.success("Gespeichert");
      reload();
    } catch { toast.error("Fehler"); }
  };
  if (loading) return <Loading />;
  return (
    <div className="space-y-3">
      <label className="flex items-center justify-between rounded-xl p-3 bg-white/[0.04] border border-white/[0.06]">
        <span className="text-[12px] font-bold text-white">Aktiviert</span>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-5 h-5 accent-purple-500" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-bold text-white/50 mb-1">Schule Start</p>
          <input type="time" value={schoolStart} onChange={(e) => setSchoolStart(e.target.value)}
                 className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-[12px] text-white" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-white/50 mb-1">Schule Ende</p>
          <input type="time" value={schoolEnd} onChange={(e) => setSchoolEnd(e.target.value)}
                 className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-[12px] text-white" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-white/50 mb-1">Schlaf Start</p>
          <input type="time" value={sleepStart} onChange={(e) => setSleepStart(e.target.value)}
                 className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-[12px] text-white" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-white/50 mb-1">Schlaf Ende</p>
          <input type="time" value={sleepEnd} onChange={(e) => setSleepEnd(e.target.value)}
                 className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-[12px] text-white" />
        </div>
      </div>
      {data?.is_locked && (
        <div className="rounded-xl p-2.5 bg-purple-500/10 border border-purple-500/30 text-center">
          <p className="text-[11px] text-purple-300 font-bold">🔒 Aktuell gesperrt: {data.reason}</p>
        </div>
      )}
      <button onClick={save} data-testid="school-mode-save"
              className="w-full py-2.5 rounded-xl bg-purple-500 text-white text-[12px] font-bold">Speichern</button>
    </div>
  );
}

// ─── 10) COURSES ───
function CoursesPanel({ childId }) {
  const { data: list } = useApi(`/api/kids-premium/courses`, []);
  const { data: prog, reload } = useApi(`/api/kids-premium/courses/progress/${childId}`, [childId]);
  const [active, setActive] = useState(null);
  const completedIds = prog?.completed_ids || [];

  const complete = async (id) => {
    try {
      const r = await fetch(`${API}/api/kids-premium/courses/complete`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ child_id: childId, course_id: id }),
      });
      const j = await r.json();
      if (j.reward_blz) toast.success(`+${j.reward_blz} BLZ!`);
      setActive(null); reload();
    } catch { toast.error("Fehler"); }
  };

  if (active) {
    return (
      <div className="space-y-3">
        <button onClick={() => setActive(null)} className="text-[11px] text-white/60 flex items-center gap-1"><ArrowLeft size={11} /> Zurück</button>
        <h3 className="text-[16px] font-black text-white">{active.icon} {active.title}</h3>
        {active.lessons.map((l, i) => (
          <div key={i} className="rounded-xl p-3 bg-white/[0.04] border border-white/[0.06]">
            <p className="text-[12px] font-bold text-emerald-300 mb-1">Lektion {i + 1}: {l.title}</p>
            <p className="text-[12px] text-white leading-relaxed">{l.text}</p>
          </div>
        ))}
        <button onClick={() => complete(active.id)} data-testid="course-complete"
                className="w-full py-2.5 rounded-xl bg-emerald-500 text-black text-[12px] font-bold">
          Kurs abschließen +{active.reward_blz} BLZ
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {(list?.courses || []).map(c => (
        <button key={c.id} onClick={async () => {
          const r = await fetch(`${API}/api/kids-premium/courses/${c.id}`, { credentials: "include" });
          setActive(await r.json());
        }} data-testid={`course-${c.id}`}
                className="w-full rounded-xl p-3 bg-white/[0.04] border border-white/[0.06] flex items-center gap-3 text-left">
          <span className="text-[28px]">{c.icon}</span>
          <div className="flex-1">
            <p className="text-[13px] font-bold text-white">{c.title}</p>
            <p className="text-[10px] text-white/50">{c.duration_min} Min · +{c.reward_blz} BLZ</p>
          </div>
          {completedIds.includes(c.id) ? <Check size={16} className="text-emerald-400" /> : <ChevronRight size={14} className="text-white/40" />}
        </button>
      ))}
      {prog && (
        <p className="text-center text-[10px] text-white/50 mt-2">
          Verdient: <span className="text-emerald-300 font-bold">{prog.total_blz_earned} BLZ</span>
        </p>
      )}
    </div>
  );
}

// ─── 11) GAMES ───
function GamesPanel({ childId }) {
  const { data: list } = useApi(`/api/kids-premium/games`, []);
  const { data: hi } = useApi(`/api/kids-premium/games/highscores/${childId}`, [childId]);
  const play = async (game) => {
    // Simulated quick play (real game UI would be a separate component)
    const score = Math.floor(Math.random() * 100);
    try {
      const r = await fetch(`${API}/api/kids-premium/games/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ child_id: childId, game_id: game.id, score }),
      });
      const j = await r.json();
      if (j.rewarded) toast.success(`Score ${score}! +${j.reward_blz} BLZ`);
      else toast.info(`Score ${score} (Heute schon belohnt)`);
    } catch { toast.error("Fehler"); }
  };
  return (
    <div className="space-y-2">
      {(list?.games || []).map(g => (
        <div key={g.id} data-testid={`game-${g.id}`}
             className="rounded-xl p-3 bg-white/[0.04] border border-white/[0.06] flex items-center gap-3">
          <span className="text-[28px]">{g.icon}</span>
          <div className="flex-1">
            <p className="text-[13px] font-bold text-white">{g.title}</p>
            <p className="text-[10px] text-white/50">{g.desc}</p>
            {hi?.highscores?.[g.id] > 0 && (
              <p className="text-[10px] text-amber-300 mt-0.5">Highscore: {hi.highscores[g.id]}</p>
            )}
          </div>
          <button onClick={() => play(g)} className="px-3 py-2 rounded-lg bg-amber-500 text-black text-[11px] font-bold">Spielen</button>
        </div>
      ))}
    </div>
  );
}
