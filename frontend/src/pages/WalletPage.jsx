import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Eye, EyeOff, Shield, Plus, ArrowUpRight,
  Clock, TrendingUp, TrendingDown, ChevronRight
} from "lucide-react";
import { useWallet } from "../store";
import { useGroupedTransactions, useWalletStats } from "../hooks";
import { PremiumCard } from "../components/PremiumCard";
import { TransactionItem } from "../components/TransactionItem";
import { TopUpModal } from "../components/TopUpModal";
import { TransactionDetailModal } from "../components/TransactionDetailModal";
import { TransactionFilters, filterTransactions } from "../components/TransactionFilters";
import ExportSection from "../components/ExportSection";
import { api } from "../services/api";
import { useI18n } from "../store";

const slide = { duration: 0.35, ease: [0.32, 0.72, 0, 1] };

// Skeleton shimmer for loading state
const Skeleton = ({ className }) => (
  <div className={`relative overflow-hidden rounded-xl ${className}`} style={{ background: "rgba(255,255,255,0.025)" }}>
    <motion.div
      className="absolute inset-0"
      style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)" }}
      animate={{ x: ["-100%", "100%"] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    />
  </div>
);

// Quick action button (inline for consistency)
const WalletAction = ({ icon: Icon, label, color, onClick, delay = 0, testId }) => (
  <motion.button
    data-testid={testId}
    className="flex flex-col items-center gap-2.5 group"
    onClick={onClick}
    whileTap={{ scale: 0.92 }}
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, ...slide }}
  >
    <div className="relative">
      <motion.div
        className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center relative overflow-hidden"
        style={{
          background: `linear-gradient(145deg, ${color}08, ${color}04)`,
          border: `1px solid ${color}15`,
        }}
        whileHover={{ scale: 1.08, borderColor: `${color}30` }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      >
        <Icon size={20} strokeWidth={1.8} style={{ color }} className="relative z-10" />
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: `radial-gradient(circle at 50% 50%, ${color}12, transparent 70%)` }}
        />
      </motion.div>
      {/* Glow on hover */}
      <motion.div
        className="absolute -inset-2 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
        style={{ background: color, filter: "blur(20px)", opacity: 0 }}
      />
    </div>
    <span className="text-[11px] text-[#555] group-hover:text-white/80 transition-colors duration-300 font-medium">
      {label}
    </span>
  </motion.button>
);

// Stats pill
const StatPill = ({ label, value, trend, delay = 0 }) => (
  <motion.div
    className="flex-1 rounded-2xl px-4 py-3"
    style={{
      background: "rgba(255,255,255,0.018)",
      border: "1px solid rgba(255,255,255,0.04)",
    }}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, ...slide }}
  >
    <p className="text-[9px] text-[#3A3A3A] uppercase tracking-[0.12em] font-semibold mb-1">{label}</p>
    <p className="text-[15px] font-semibold font-outfit text-white/90">{value}</p>
    {trend !== undefined && (
      <div className="flex items-center gap-1 mt-0.5">
        {trend >= 0 ? (
          <TrendingUp size={9} className="text-[#00D26A]" />
        ) : (
          <TrendingDown size={9} className="text-[#FF4757]" />
        )}
        <span className={`text-[9px] font-medium ${trend >= 0 ? "text-[#00D26A]" : "text-[#FF4757]"}`}>
          {trend >= 0 ? "+" : ""}{trend}%
        </span>
      </div>
    )}
  </motion.div>
);

export const WalletPage = ({ onNavigate }) => {
  // Auto-open TopUp modal if returning from Stripe
  const hasStripeParam = typeof window !== "undefined" &&
    (window.location.search.includes("stripe_session_id") || window.location.search.includes("stripe_cancelled"));

  const [showBalance, setShowBalance] = useState(true);
  const [showTopUp, setShowTopUp] = useState(hasStripeParam);
  const [selectedTx, setSelectedTx] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  const { balance, currency, cardNumber, cardExpiry, cardHolder, refreshWallet, transactions } = useWallet();
  const groupedTransactions = useGroupedTransactions();
  const stats = useWalletStats();
  const { t } = useI18n();

  const userExports = [
    { key: "transactions", label: t("export.transactions"), action: (f) => api.exportUserTransactions(f) },
    { key: "topups", label: t("export.topups"), action: (f) => api.exportUserTopups(f) },
    { key: "payments-sent", label: t("export.sent"), action: (f) => api.exportUserPayments({ ...f, direction: "sent" }) },
    { key: "payments-received", label: t("export.received"), action: (f) => api.exportUserPayments({ ...f, direction: "received" }) },
  ];

  // Simulate loading
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const handleTopUpSuccess = async () => {
    // Stripe already credited via backend — just refresh wallet data
    await refreshWallet();
  };

  const filteredGrouped = Object.entries(groupedTransactions).reduce((acc, [date, txns]) => {
    const filtered = filterTransactions(txns, typeFilter, statusFilter);
    if (filtered.length > 0) acc[date] = filtered;
    return acc;
  }, {});

  return (
    <motion.div
      data-testid="wallet-page"
      className="min-h-screen relative overflow-hidden"
      style={{ background: "#030303" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Ambient glow */}
      <motion.div
        className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ filter: "blur(140px)", background: "rgba(0,194,255,0.045)" }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 relative z-10">
        <div className="flex items-center gap-3">
          <motion.button
            data-testid="wallet-back-btn"
            className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
            whileTap={{ scale: 0.88 }}
            onClick={() => onNavigate("/")}
          >
            <ArrowLeft size={15} strokeWidth={1.5} className="text-white/50" />
          </motion.button>
          <motion.h1
            className="text-[15px] font-semibold font-outfit text-white tracking-tight"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
          >
            {t("wallet.title")}
          </motion.h1>
        </div>
        <motion.button
          data-testid="toggle-balance-btn"
          onClick={() => setShowBalance(!showBalance)}
          className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
          whileTap={{ scale: 0.88 }}
        >
          {showBalance
            ? <Eye size={15} strokeWidth={1.5} className="text-[#444]" />
            : <EyeOff size={15} strokeWidth={1.5} className="text-[#444]" />}
        </motion.button>
      </div>

      {/* Content */}
      <div className="px-5 pb-8 relative z-10">

        {/* ── Balance Hero ── */}
        <motion.div
          className="text-center pt-4 pb-6 relative"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, ...slide }}
        >
          <div className="flex items-center justify-center gap-1.5 mb-3">
            <Shield size={11} className="text-[#00C2FF]/60" />
            <p className="text-[10px] text-[#3A3A3A] font-semibold tracking-[0.14em] uppercase">{t("wallet.available")}</p>
          </div>

          <AnimatePresence mode="wait">
            {isLoading ? (
              <Skeleton className="h-[56px] w-48 mx-auto mb-2" />
            ) : (
              <motion.div
                key={showBalance ? "visible" : "hidden"}
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                transition={{ duration: 0.2 }}
              >
                {showBalance ? (
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-[28px] text-[#2A2A2A] font-outfit font-light">{currency}</span>
                    <motion.span
                      className="text-[52px] font-bold font-outfit text-white tracking-[-0.03em] leading-none"
                      key={balance}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    >
                      {balance.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                    </motion.span>
                  </div>
                ) : (
                  <p className="text-[52px] font-bold font-outfit text-[#1A1A1A] tracking-[-0.03em] leading-none">
                    {currency}
                    <span className="text-[#1A1A1A]">{"••••••"}</span>
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Monthly change */}
          {showBalance && !isLoading && (
            <motion.div
              className="flex items-center justify-center gap-1.5 mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {parseFloat(stats.percentageChange) >= 0 ? (
                <TrendingUp size={11} className="text-[#00D26A]" />
              ) : (
                <TrendingDown size={11} className="text-[#FF4757]" />
              )}
              <span className={`text-[11px] font-medium ${parseFloat(stats.percentageChange) >= 0 ? "text-[#00D26A]" : "text-[#FF4757]"}`}>
                {parseFloat(stats.percentageChange) >= 0 ? "+" : ""}{stats.percentageChange}% {t("home.month")}
              </span>
            </motion.div>
          )}

          {/* Balance glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-40 pointer-events-none"
            style={{ filter: "blur(80px)", background: "radial-gradient(ellipse, rgba(0,194,255,0.06), transparent 70%)" }}
          />
        </motion.div>

        {/* ── Quick Stats ── */}
        {showBalance && !isLoading && (
          <div className="flex gap-2.5 mb-6">
            <StatPill
              label="Spent"
              value={`${currency}${stats.totalSpent.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`}
              delay={0.12}
            />
            <StatPill
              label="Income"
              value={`${currency}${stats.totalIncome.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`}
              trend={parseFloat(stats.percentageChange)}
              delay={0.16}
            />
          </div>
        )}

        {/* ── Premium Card ── */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, ...slide }}
        >
          {isLoading ? (
            <Skeleton className="w-full" style={{ aspectRatio: "1.586/1" }} />
          ) : (
            <PremiumCard cardNumber={cardNumber} expiry={cardExpiry} holder={cardHolder} />
          )}
        </motion.div>

        {/* ── Quick Actions ── */}
        <motion.div
          className="flex justify-center gap-10 mb-7"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, ...slide }}
        >
          <WalletAction
            testId="quick-action-add"
            icon={Plus}
            label="Add Money"
            color="#00C2FF"
            onClick={() => setShowTopUp(true)}
            delay={0.22}
          />
          <WalletAction
            testId="quick-action-send"
            icon={ArrowUpRight}
            label="Send"
            color="#A855F7"
            delay={0.26}
          />
          <WalletAction
            testId="quick-action-history"
            icon={Clock}
            label="History"
            color="#00D26A"
            delay={0.30}
          />
        </motion.div>

        {/* ── Filters ── */}
        <motion.div
          className="mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.32 }}
        >
          <TransactionFilters
            activeTypeFilter={typeFilter}
            activeStatusFilter={statusFilter}
            onTypeFilterChange={setTypeFilter}
            onStatusFilterChange={setStatusFilter}
            showStatusFilter={typeFilter !== "all"}
          />
        </motion.div>

        {/* ── Export Section ── */}
        <motion.div
          className="mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.34 }}
        >
          <ExportSection
            title={t("export.user_reports")}
            exports={userExports}
            t={t}
            testIdPrefix="wallet-export"
          />
        </motion.div>

        {/* ── Transactions ── */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.36 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-semibold font-outfit text-white">Transactions</h3>
            <motion.span
              className="text-[11px] text-[#00C2FF] font-medium cursor-pointer flex items-center gap-0.5"
              whileHover={{ x: 3 }}
            >
              See All <ChevronRight size={12} strokeWidth={2} />
            </motion.span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-[60px] w-full" />
              ))}
            </div>
          ) : Object.keys(filteredGrouped).length === 0 ? (
            /* ── Empty State ── */
            <motion.div
              className="py-12 text-center rounded-2xl"
              style={{ background: "rgba(255,255,255,0.012)", border: "1px solid rgba(255,255,255,0.03)" }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/[0.03] flex items-center justify-center">
                <Clock size={20} className="text-[#2A2A2A]" />
              </div>
              <p className="text-[13px] text-[#333] font-medium mb-1">No transactions yet</p>
              <p className="text-[11px] text-[#222]">Your payment history will appear here</p>
            </motion.div>
          ) : (
            <div className="space-y-5">
              {Object.entries(filteredGrouped).map(([date, txns], gi) => (
                <motion.div
                  key={date}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.38 + gi * 0.06, ...slide }}
                >
                  <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] mb-2.5 font-semibold pl-1">{date}</p>
                  <div
                    className="rounded-2xl overflow-hidden"
                    style={{
                      background: "rgba(255,255,255,0.015)",
                      border: "1px solid rgba(255,255,255,0.035)",
                    }}
                  >
                    {txns.map((txn, i) => (
                      <TransactionItem
                        key={txn.id}
                        transaction={txn}
                        index={i}
                        isLast={i === txns.length - 1}
                        onClick={setSelectedTx}
                      />
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>
      </div>

      {/* Modals */}
      <TopUpModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} onSuccess={handleTopUpSuccess} currentBalance={balance} />
      <TransactionDetailModal isOpen={!!selectedTx} onClose={() => setSelectedTx(null)} transaction={selectedTx} />
    </motion.div>
  );
};

export default WalletPage;
