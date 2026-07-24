import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ArrowUpRight, ArrowDownLeft, Plus,
  CreditCard, Clock, Filter, TrendingUp, Wallet, RefreshCw
} from "lucide-react";
import { useI18n, useUser } from "../store";
import { api } from "../services/api";
import ErrorState from "../components/ErrorState";

const slide = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };

const FILTERS = ["all", "topup", "payment", "send", "receive"];

const TYPE_CONFIG = {
  topup: { icon: Plus, color: "#00D26A", bgColor: "rgba(0,210,106,0.08)", borderColor: "rgba(0,210,106,0.15)" },
  payment: { icon: CreditCard, color: "#00C2FF", bgColor: "rgba(0,194,255,0.08)", borderColor: "rgba(0,194,255,0.15)" },
  send: { icon: ArrowUpRight, color: "#FF6B6B", bgColor: "rgba(255,107,107,0.08)", borderColor: "rgba(255,107,107,0.15)" },
  receive: { icon: ArrowDownLeft, color: "#A855F7", bgColor: "rgba(168,85,247,0.08)", borderColor: "rgba(168,85,247,0.15)" },
  payout: { icon: Wallet, color: "#FFB800", bgColor: "rgba(255,184,0,0.08)", borderColor: "rgba(255,184,0,0.15)" },
};

const getConfig = (type) => TYPE_CONFIG[type] || TYPE_CONFIG.payment;

function formatTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString();
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return "TODAY";
  if (isYesterday) return "YESTERDAY";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase();
}

// Group transactions by date
function groupByDate(txns) {
  const groups = {};
  for (const tx of txns) {
    const key = formatDate(tx.created_at);
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }
  return Object.entries(groups);
}

const ActivityItem = ({ tx, t }) => {
  const cfg = getConfig(tx.type);
  const Icon = cfg.icon;
  const isPositive = tx.type === "topup" || tx.type === "receive";

  return (
    <motion.div
      data-testid={`activity-item-${tx.transaction_id || tx.type}`}
      className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.03] last:border-b-0"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={slide}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: cfg.bgColor, border: `1px solid ${cfg.borderColor}` }}
      >
        <Icon size={15} strokeWidth={1.5} style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-white/85 truncate">
            {t(`activity.type_${tx.type}`) || tx.type}
          </p>
          <span
            className="text-[13px] font-semibold font-outfit flex-shrink-0 ml-2"
            style={{ color: isPositive ? "#00D26A" : "#FF6B6B" }}
          >
            {isPositive ? "+" : "-"}{tx.currency || "EUR"} {Number(tx.amount || 0).toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-[10px] text-[#444] font-medium truncate">
            {tx.recipient_email || tx.sender_email || tx.description || t(`activity.type_${tx.type}`)}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <Clock size={9} className="text-[#333]" />
            <span className="text-[10px] text-[#333] font-medium">{formatTime(tx.created_at)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Quick stats bar
const StatsBar = ({ transactions, t }) => {
  const stats = useMemo(() => {
    let income = 0, spent = 0, count = 0;
    for (const tx of transactions) {
      const amt = Number(tx.amount || 0);
      if (tx.type === "topup" || tx.type === "receive") income += amt;
      else spent += amt;
      count++;
    }
    return { income, spent, count };
  }, [transactions]);

  return (
    <motion.div
      data-testid="activity-stats"
      className="grid grid-cols-3 gap-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08, ...slide }}
    >
      {[
        { label: t("activity.total_in"), value: `+${stats.income.toFixed(2)}`, color: "#00D26A" },
        { label: t("activity.total_out"), value: `-${stats.spent.toFixed(2)}`, color: "#FF6B6B" },
        { label: t("activity.total_txns"), value: stats.count, color: "#00C2FF" },
      ].map((s, i) => (
        <div
          key={i}
          className="rounded-xl px-3 py-2.5 text-center"
          style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}
        >
          <p className="text-[10px] text-[#444] font-medium mb-0.5">{s.label}</p>
          <p className="text-[14px] font-semibold font-outfit" style={{ color: s.color }}>{s.value}</p>
        </div>
      ))}
    </motion.div>
  );
};

export const ActivityPage = ({ onBack }) => {
  const { t } = useI18n();
  const user = useUser();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: 100 };
      if (filter !== "all") params.type = filter;
      const data = await api.getTransactions(params);
      setTransactions(data.transactions || []);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filter]);

  const grouped = useMemo(() => groupByDate(transactions), [transactions]);

  if (error) {
    return (
      <motion.div className="min-h-screen" style={{ background: "#030303" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3">
          <motion.button className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center" whileTap={{ scale: 0.88 }} onClick={onBack}>
            <ChevronLeft size={15} strokeWidth={1.5} className="text-white/50" />
          </motion.button>
          <h1 className="text-[15px] font-semibold font-outfit text-white tracking-tight">{t("activity.title")}</h1>
        </div>
        <div className="px-5"><ErrorState error={error} onRetry={fetchData} /></div>
      </motion.div>
    );
  }

  return (
    <motion.div
      data-testid="activity-page"
      className="min-h-screen relative"
      style={{ background: "#030303" }}
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={slide}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 relative z-10">
        <div className="flex items-center gap-3">
          <motion.button
            data-testid="activity-back-btn"
            className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
            whileTap={{ scale: 0.88 }}
            onClick={onBack}
          >
            <ChevronLeft size={15} strokeWidth={1.5} className="text-white/50" />
          </motion.button>
          <h1 className="text-[15px] font-semibold font-outfit text-white tracking-tight">{t("activity.title")}</h1>
        </div>
        <motion.button
          data-testid="activity-refresh-btn"
          className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
          whileTap={{ scale: 0.88 }}
          onClick={fetchData}
        >
          <RefreshCw size={13} strokeWidth={1.5} className="text-white/40" />
        </motion.button>
      </div>

      <div className="px-5 pb-8 relative z-10 space-y-4">
        {/* Stats */}
        {!loading && transactions.length > 0 && <StatsBar transactions={transactions} t={t} />}

        {/* Filter chips */}
        <motion.div
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, ...slide }}
        >
          {FILTERS.map((f) => {
            const active = filter === f;
            const cfg = f === "all" ? { color: "#00C2FF" } : getConfig(f);
            return (
              <motion.button
                key={f}
                data-testid={`activity-filter-${f}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all flex-shrink-0"
                style={{
                  background: active ? `${cfg.color}15` : "rgba(255,255,255,0.025)",
                  border: `1px solid ${active ? `${cfg.color}30` : "rgba(255,255,255,0.04)"}`,
                  color: active ? cfg.color : "rgba(255,255,255,0.5)",
                }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? <Filter size={10} /> : null}
                {t(`activity.filter_${f}`)}
              </motion.button>
            );
          })}
        </motion.div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-[60px] rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.02)" }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && transactions.length === 0 && (
          <motion.div
            data-testid="activity-empty"
            className="text-center py-14"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(0,194,255,0.05)", border: "1px solid rgba(0,194,255,0.1)" }}>
              <TrendingUp size={22} className="text-[#00C2FF]/40" />
            </div>
            <p className="text-[14px] text-white/60 font-medium font-outfit mb-1">{t("activity.empty")}</p>
            <p className="text-[11px] text-[#333] font-medium">{t("activity.empty_hint")}</p>
          </motion.div>
        )}

        {/* Grouped transactions */}
        {!loading && grouped.map(([dateLabel, txns], gi) => (
          <motion.div
            key={dateLabel}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 + gi * 0.04, ...slide }}
          >
            <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2 pl-1">{dateLabel}</p>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}
            >
              {txns.map((tx, i) => (
                <ActivityItem key={tx.transaction_id || i} tx={tx} t={t} />
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default ActivityPage;
