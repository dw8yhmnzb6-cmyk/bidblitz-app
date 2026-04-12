/**
 * BidBlitz V2 - User Statistics Dashboard
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, Loader2, Euro, Coins, PieChart } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const UserStatsPage = ({ onBack }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/api/stats/overview?months=6`, { credentials: "include" });
        if (res.ok) setData(await res.json());
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center"><Loader2 size={32} className="animate-spin text-[#3B82F6]" /></div>;
  if (!data) return <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center text-gray-500">Fehler beim Laden</div>;

  const maxMonthly = Math.max(...data.monthly.map(m => Math.max(m.income, m.expense)), 1);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="user-stats-page">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10"><ArrowLeft size={18} /></motion.button>
          <div><h1 className="text-[15px] font-bold">Meine Statistiken</h1><p className="text-[10px] text-gray-500">Einnahmen, Ausgaben, Trends</p></div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-2xl bg-[#00C2FF]/5 border border-[#00C2FF]/20 text-center">
            <Euro size={16} className="mx-auto text-[#00C2FF] mb-1" />
            <p className="text-lg font-bold text-[#00C2FF]">€{(data.balance || 0).toFixed(0)}</p>
            <p className="text-[9px] text-gray-500">Guthaben</p>
          </div>
          <div className="p-3 rounded-2xl bg-[#F59E0B]/5 border border-[#F59E0B]/20 text-center">
            <Coins size={16} className="mx-auto text-[#F59E0B] mb-1" />
            <p className="text-lg font-bold text-[#F59E0B]">{data.coins || 0}</p>
            <p className="text-[9px] text-gray-500">Coins</p>
          </div>
          <div className="p-3 rounded-2xl bg-[#10B981]/5 border border-[#10B981]/20 text-center">
            <TrendingUp size={16} className="mx-auto text-[#10B981] mb-1" />
            <p className="text-lg font-bold text-[#10B981]">€{(data.total_cashback || 0).toFixed(2)}</p>
            <p className="text-[9px] text-gray-500">Cashback</p>
          </div>
        </div>

        {/* Monthly Chart */}
        <div className="bg-[#111118] rounded-2xl p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-[#3B82F6]" />
            <h3 className="text-sm font-bold">Einnahmen vs. Ausgaben (6 Monate)</h3>
          </div>
          <div className="flex items-end gap-1 h-32 mb-2">
            {data.monthly.map((m, i) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex gap-0.5 items-end" style={{ height: "100%" }}>
                  <div className="flex-1 rounded-t" style={{
                    height: `${Math.max(3, (m.income / maxMonthly) * 100)}%`,
                    background: "#10B981",
                  }} />
                  <div className="flex-1 rounded-t" style={{
                    height: `${Math.max(3, (m.expense / maxMonthly) * 100)}%`,
                    background: "#EF4444",
                  }} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            {data.monthly.map(m => (
              <span key={m.month} className="text-[8px] text-gray-600 flex-1 text-center">{m.label}</span>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 justify-center">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#10B981]" /><span className="text-[9px] text-gray-500">Einnahmen</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#EF4444]" /><span className="text-[9px] text-gray-500">Ausgaben</span></div>
          </div>
        </div>

        {/* Monthly Details */}
        <div className="space-y-2">
          {data.monthly.slice().reverse().map((m, i) => (
            <motion.div key={m.month} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-[#111118] rounded-xl p-3 border border-white/5 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">{m.label}</span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1"><TrendingUp size={10} className="text-green-400" /><span className="text-[10px] text-green-400">€{m.income.toFixed(0)}</span></div>
                <div className="flex items-center gap-1"><TrendingDown size={10} className="text-red-400" /><span className="text-[10px] text-red-400">€{m.expense.toFixed(0)}</span></div>
                <span className={`text-[10px] font-bold ${m.net >= 0 ? "text-green-400" : "text-red-400"}`}>{m.net >= 0 ? "+" : ""}€{m.net.toFixed(0)}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Top Categories */}
        {data.top_categories?.length > 0 && (
          <div className="bg-[#111118] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-3"><PieChart size={16} className="text-[#A855F7]" /><h3 className="text-sm font-bold">Top Kategorien</h3></div>
            <div className="space-y-2">
              {data.top_categories.map((c, i) => {
                const colors = ["#3B82F6", "#A855F7", "#F59E0B", "#EF4444", "#10B981", "#00C2FF", "#F97316", "#EC4899"];
                const max = data.top_categories[0]?.total || 1;
                return (
                  <div key={c.category} className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-500 w-16 truncate">{c.category}</span>
                    <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(c.total / max) * 100}%`, background: colors[i % colors.length] }} />
                    </div>
                    <span className="text-[10px] font-bold w-14 text-right">€{c.total.toFixed(0)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserStatsPage;
