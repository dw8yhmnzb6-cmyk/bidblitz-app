/**
 * BidBlitz V2 - Budget Planner Page
 * Monthly spending tracker with categories, limits, and trends
 */
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Loader2, Plus, PieChart, TrendingUp, AlertTriangle,
  Target, X, Check, ChevronLeft, ChevronRight
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const CAT_ICONS = {
  food: "Essen", transport: "Transport", shopping: "Shopping",
  entertainment: "Unterhaltung", bills: "Rechnungen", health: "Gesundheit",
  education: "Bildung", other: "Sonstiges",
};

const BudgetPlannerPage = ({ onBack }) => {
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState("");
  const [editLimit, setEditLimit] = useState(null);
  const [limitValue, setLimitValue] = useState("");
  const [addExpense, setAddExpense] = useState(null);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNote, setExpenseNote] = useState("");

  const load = useCallback(async () => {
    try {
      const [ov, tr] = await Promise.all([
        fetch(`${API}/api/budget/overview${month ? `?month=${month}` : ""}`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API}/api/budget/trends`, { credentials: "include" }).then(r => r.json()),
      ]);
      setOverview(ov);
      setTrends(tr.trends || []);
    } catch {}
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const saveLimit = async (catId) => {
    if (!limitValue) return;
    try {
      await fetch(`${API}/api/budget/limits`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: catId, monthly_limit: parseFloat(limitValue) }),
      });
      setEditLimit(null);
      setLimitValue("");
      load();
    } catch {}
  };

  const saveExpense = async (catId) => {
    if (!expenseAmount) return;
    try {
      await fetch(`${API}/api/budget/expense`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: catId, amount: parseFloat(expenseAmount), note: expenseNote }),
      });
      setAddExpense(null);
      setExpenseAmount("");
      setExpenseNote("");
      load();
    } catch {}
  };

  const changeMonth = (dir) => {
    const current = month ? new Date(month + "-01") : new Date();
    current.setMonth(current.getMonth() + dir);
    setMonth(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`);
  };

  const maxTrend = Math.max(...trends.map(t => t.total), 1);

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-[#3B82F6]" />
    </div>
  );

  const monthLabel = overview?.month
    ? new Date(overview.month + "-01").toLocaleDateString("de-DE", { month: "long", year: "numeric" })
    : "Aktueller Monat";

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="budget-planner-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
              className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="budget-back">
              <ArrowLeft size={18} />
            </motion.button>
            <div>
              <h1 className="text-[15px] font-bold">Budgetplaner</h1>
              <p className="text-[10px] text-gray-500">Ausgaben im Blick</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => changeMonth(-1)}
              className="p-1.5 rounded-lg bg-white/5"><ChevronLeft size={14} /></motion.button>
            <span className="text-xs font-medium px-2 min-w-[100px] text-center">{monthLabel}</span>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => changeMonth(1)}
              className="p-1.5 rounded-lg bg-white/5"><ChevronRight size={14} /></motion.button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Summary Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#3B82F6]/10 to-[#8B5CF6]/5 border border-[#3B82F6]/20">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Gesamtausgaben</p>
            {overview?.total_limit > 0 && (
              <p className="text-[10px] text-gray-500">
                Budget: €{overview.total_limit.toFixed(0)}
              </p>
            )}
          </div>
          <p className="text-3xl font-black">€{(overview?.total_spent || 0).toFixed(2)}</p>
          {overview?.total_limit > 0 && (
            <div className="mt-2">
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (overview.total_spent / overview.total_limit) * 100)}%`,
                    background: overview.total_spent > overview.total_limit ? "#EF4444" : "#3B82F6",
                  }} />
              </div>
            </div>
          )}
        </div>

        {/* Category Grid */}
        <div className="space-y-2">
          {overview?.categories?.map((cat, i) => (
            <motion.div key={cat.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-[#111118] rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: cat.color }} />
                  <span className="text-sm font-semibold">{CAT_ICONS[cat.id] || cat.name}</span>
                  {cat.over_budget && <AlertTriangle size={12} className="text-red-400" />}
                </div>
                <span className="text-sm font-bold" style={{ color: cat.over_budget ? "#EF4444" : "white" }}>
                  €{cat.spent.toFixed(2)}
                </span>
              </div>
              {cat.limit > 0 && (
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${Math.min(100, cat.percentage)}%`,
                    background: cat.over_budget ? "#EF4444" : cat.color,
                  }} />
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-500">
                  {cat.limit > 0 ? `${cat.percentage.toFixed(0)}% von €${cat.limit.toFixed(0)}` : "Kein Limit"}
                </p>
                <div className="flex gap-1">
                  <motion.button whileTap={{ scale: 0.9 }}
                    onClick={() => { setEditLimit(cat.id); setLimitValue(cat.limit > 0 ? String(cat.limit) : ""); }}
                    className="px-2 py-1 rounded-lg bg-white/5 text-[10px] text-gray-400"
                    data-testid={`set-limit-${cat.id}`}>
                    <Target size={10} className="inline mr-0.5" /> Limit
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.9 }}
                    onClick={() => setAddExpense(cat.id)}
                    className="px-2 py-1 rounded-lg bg-white/5 text-[10px] text-gray-400"
                    data-testid={`add-expense-${cat.id}`}>
                    <Plus size={10} className="inline mr-0.5" /> Ausgabe
                  </motion.button>
                </div>
              </div>

              {/* Inline limit editor */}
              {editLimit === cat.id && (
                <div className="flex gap-2 mt-3">
                  <input type="number" value={limitValue} onChange={e => setLimitValue(e.target.value)}
                    placeholder="Limit €" autoFocus
                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs outline-none" />
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => saveLimit(cat.id)}
                    className="px-3 py-2 rounded-lg bg-[#3B82F6] text-black text-xs font-bold"><Check size={12} /></motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditLimit(null)}
                    className="px-3 py-2 rounded-lg bg-white/5 text-xs"><X size={12} /></motion.button>
                </div>
              )}

              {/* Inline expense adder */}
              {addExpense === cat.id && (
                <div className="mt-3 space-y-2">
                  <input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)}
                    placeholder="Betrag €" autoFocus
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs outline-none" />
                  <input type="text" value={expenseNote} onChange={e => setExpenseNote(e.target.value)}
                    placeholder="Notiz (optional)"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs outline-none" />
                  <div className="flex gap-2">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => saveExpense(cat.id)}
                      className="flex-1 py-2 rounded-lg bg-[#3B82F6] text-black text-xs font-bold"><Check size={12} className="inline mr-1" /> Speichern</motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setAddExpense(null)}
                      className="px-3 py-2 rounded-lg bg-white/5 text-xs"><X size={12} /></motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Trend Chart */}
        {trends.length > 0 && (
          <div className="bg-[#111118] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-[#3B82F6]" />
              <h3 className="text-sm font-bold">Ausgaben-Trend (6 Monate)</h3>
            </div>
            <div className="flex items-end gap-2 h-24">
              {trends.map((t, i) => (
                <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-lg transition-all"
                    style={{
                      height: `${Math.max(4, (t.total / maxTrend) * 100)}%`,
                      background: i === trends.length - 1 ? "#3B82F6" : "rgba(59,130,246,0.2)",
                    }} />
                  <span className="text-[8px] text-gray-500">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetPlannerPage;
