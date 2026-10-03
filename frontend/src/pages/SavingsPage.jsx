import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, PiggyBank, Plus, Loader2, Target, TrendingUp, Euro } from "lucide-react";
import { useI18n } from "../store/I18nContext";

const API = process.env.REACT_APP_BACKEND_URL;

const SavingsPage = ({ onBack }) => {
  const { t } = useI18n();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", target: "", monthly: "" });
  const [creating, setCreating] = useState(false);
  const [capabilities, setCapabilities] = useState({ planning_only: true, automatic_transfers_enabled: false });
  const goalAttemptKeyRef = useRef(null);

  useEffect(() => {
    loadGoals();
    fetch(`${API}/api/savings/capabilities`).then(r => r.json()).then(setCapabilities).catch(() => {});
  }, []);

  useEffect(() => {
    goalAttemptKeyRef.current = null;
  }, [form.name, form.target, form.monthly]);

  const loadGoals = async () => {
    try {
      const res = await fetch(`${API}/api/savings/goals`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setGoals(d.goals || []); }
    } catch {}
    setLoading(false);
  };

  const createGoal = async () => {
    if (!form.name || !form.target) return;
    if (!goalAttemptKeyRef.current) {
      goalAttemptKeyRef.current = typeof crypto?.randomUUID === "function"
        ? `savings-goal-${crypto.randomUUID()}`
        : `savings-goal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    const idempotencyKey = goalAttemptKeyRef.current;
    setCreating(true);
    try {
      const res = await fetch(`${API}/api/savings/goals`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          name: form.name,
          target_amount: parseFloat(form.target),
          monthly_amount: parseFloat(form.monthly) || 0,
          idempotency_key: idempotencyKey,
        }),
      });
      if (res.ok) {
        goalAttemptKeyRef.current = null;
        loadGoals();
        setShowCreate(false);
        setForm({ name: "", target: "", monthly: "" });
      } else if (res.status < 500 && res.status !== 409) {
        goalAttemptKeyRef.current = null;
      }
    } catch {}
    setCreating(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="savings-back">
            <ArrowLeft size={20} />
          </motion.button>
          <div>
            <h1 className="text-lg font-bold">Sparziele</h1>
            <p className="text-xs text-[#666]">Sparplanung · keine automatische Abbuchung</p>
          </div>
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00E89D] text-black text-sm font-medium" data-testid="create-goal-btn">
          <Plus size={16} /> Neues Ziel
        </motion.button>
      </div>

      {showCreate && (
        <div className="p-4 space-y-4">
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="z.B. Urlaub, Notgroschen..." className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none" />
          <input type="number" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
            placeholder="Zielbetrag (€)" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none" />
          <input type="number" value={form.monthly} onChange={e => setForm(f => ({ ...f, monthly: e.target.value }))}
            placeholder="Monatlicher Sparbetrag (€, optional)" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none" />
          <motion.button whileTap={{ scale: 0.97 }} onClick={createGoal} disabled={!form.name || !form.target || creating}
            className="w-full py-4 rounded-xl bg-[#00E89D] text-black font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {creating ? <Loader2 size={20} className="animate-spin" /> : <><Target size={20} /> Sparziel erstellen</>}
          </motion.button>
        </div>
      )}

      <div className="p-4 space-y-3">
        {capabilities.planning_only && (
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-100/70" data-testid="savings-planning-only">
            Sparziele sind reine Planung. BidBlitz verschiebt hier kein Wallet-Guthaben automatisch.
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#00E89D]" /></div>
        ) : goals.length === 0 && !showCreate ? (
          <div className="text-center py-20">
            <PiggyBank size={48} className="mx-auto text-[#333] mb-4" />
            <p className="text-white/70 font-semibold">Keine Sparziele</p>
            <p className="text-sm text-[#666] mt-2">Setze dir ein Ziel und plane deinen monatlichen Sparbetrag.</p>
          </div>
        ) : goals.map((g, i) => {
          const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
          return (
            <motion.div key={g.goal_id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-[#111118] rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">{g.name}</h3>
                <span className="text-xs text-[#00E89D] font-bold">{pct.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full mb-2 overflow-hidden">
                <div className="h-full rounded-full bg-[#00E89D] transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-[#888]">
                <span>€{(g.current_amount || 0).toFixed(2)} gespart</span>
                <span>Ziel: €{g.target_amount?.toFixed(2)}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default SavingsPage;
