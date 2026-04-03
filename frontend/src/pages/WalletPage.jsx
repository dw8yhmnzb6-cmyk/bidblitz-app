import { motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Shield, RefreshCw } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../store/AuthContext";
import { api } from "../services/api";
import { PremiumCard } from "../components/PremiumCard";
import { QuickAction } from "../components/QuickAction";
import { TransactionItem } from "../components/TransactionItem";
import { TopUpModal } from "../components/TopUpModal";
import { TransactionDetailModal } from "../components/TransactionDetailModal";
import { TransactionFilters, filterTransactions } from "../components/TransactionFilters";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 25 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } },
};

function groupByDate(transactions) {
  const groups = {};
  for (const txn of transactions) {
    const d = new Date(txn.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let label;
    if (d.toDateString() === today.toDateString()) label = "Today";
    else if (d.toDateString() === yesterday.toDateString()) label = "Yesterday";
    else label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    if (!groups[label]) groups[label] = [];
    groups[label].push(txn);
  }
  return groups;
}

export const WalletPage = ({ onNavigate }) => {
  const { user, refreshUser } = useAuth();
  const [showBalance, setShowBalance] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchWallet = useCallback(async () => {
    try {
      const data = await api.getWallet();
      setWalletData(data);
    } catch {
      // fallback to user data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const balance = walletData?.balance ?? user?.balance ?? 0;
  const currency = walletData?.currency ?? "EUR";
  const cardNumber = walletData?.card_number ?? user?.card_number ?? "";
  const cardExpiry = walletData?.card_expiry ?? user?.card_expiry ?? "";
  const cardHolder = walletData?.card_holder ?? user?.name ?? "";
  const transactions = walletData?.transactions ?? [];

  const handleTopUpSuccess = async (txn) => {
    try {
      const result = await api.topUp({
        amount: txn.amount,
        payment_method: txn.paymentMethod || "bank_transfer",
      });
      if (result.success) {
        await fetchWallet();
        await refreshUser();
      }
      return result;
    } catch (err) {
      throw err;
    }
  };

  // Group + filter transactions
  const grouped = groupByDate(transactions);
  const filteredGrouped = Object.entries(grouped).reduce((acc, [date, txns]) => {
    const filtered = filterTransactions(txns, typeFilter, statusFilter);
    if (filtered.length > 0) acc[date] = filtered;
    return acc;
  }, {});

  return (
    <motion.div
      data-testid="wallet-page"
      className="px-4 sm:px-6 pt-6 sm:pt-8"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header */}
      <motion.header className="flex items-center justify-between mb-6 sm:mb-8" variants={itemVariants}>
        <div className="flex items-center gap-3 sm:gap-4">
          <motion.button
            data-testid="wallet-back-btn"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#141414] border border-white/5 flex items-center justify-center"
            whileHover={{ scale: 1.08, backgroundColor: "#1A1A1A" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate("/")}
            style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
          >
            <ArrowLeft size={18} strokeWidth={1.5} className="text-white" />
          </motion.button>
          <h1 className="text-lg sm:text-xl font-semibold font-outfit text-white tracking-tight">Wallet</h1>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            data-testid="refresh-wallet-btn"
            onClick={() => { setLoading(true); fetchWallet(); }}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#141414] border border-white/5 flex items-center justify-center"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
          >
            <RefreshCw size={16} strokeWidth={1.5} className={`text-[#888] ${loading ? "animate-spin" : ""}`} />
          </motion.button>
          <motion.button
            data-testid="toggle-balance-btn"
            onClick={() => setShowBalance(!showBalance)}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#141414] border border-white/5 flex items-center justify-center"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
          >
            {showBalance ? <Eye size={18} strokeWidth={1.5} className="text-[#888]" /> : <EyeOff size={18} strokeWidth={1.5} className="text-[#888]" />}
          </motion.button>
        </div>
      </motion.header>

      {/* Balance */}
      <motion.div className="text-center mb-6 sm:mb-8 relative" variants={itemVariants}>
        <div className="flex items-center justify-center gap-2 mb-2">
          <p className="text-[#666] text-xs sm:text-sm font-medium">Available Balance</p>
          <Shield size={12} className="text-[#00C2FF]" />
        </div>
        <motion.h2
          className="text-4xl sm:text-5xl md:text-6xl font-bold font-outfit text-white tracking-tight"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
        >
          {showBalance ? (
            <>
              {currency === "EUR" ? "\u20AC" : currency}
              <motion.span key={balance} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                {balance.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
              </motion.span>
            </>
          ) : (
            <span className="text-[#444]">{currency === "EUR" ? "\u20AC" : currency}••••••</span>
          )}
        </motion.h2>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-32 blur-3xl opacity-20 pointer-events-none" style={{ background: "radial-gradient(ellipse, #00C2FF 0%, transparent 70%)" }} />
      </motion.div>

      {/* Card */}
      <motion.div variants={itemVariants} className="mb-8 sm:mb-10">
        <PremiumCard cardNumber={cardNumber} expiry={cardExpiry} holder={cardHolder} />
      </motion.div>

      {/* Quick Actions */}
      <motion.div className="flex justify-center gap-8 sm:gap-12 mb-8 sm:mb-10" variants={itemVariants}>
        <QuickAction id="add" icon="add" label="Add Money" onClick={() => setShowTopUp(true)} />
        <QuickAction id="send" icon="send" label="Send" />
        <QuickAction id="history" icon="history" label="History" />
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="mb-4">
        <TransactionFilters
          activeTypeFilter={typeFilter}
          activeStatusFilter={statusFilter}
          onTypeFilterChange={setTypeFilter}
          onStatusFilterChange={setStatusFilter}
          showStatusFilter={typeFilter !== "all"}
        />
      </motion.div>

      {/* Transactions */}
      <motion.section variants={itemVariants}>
        <div className="section-header">
          <h3 className="section-title">Transactions</h3>
          <motion.span className="section-link" whileHover={{ x: 4 }}>See All</motion.span>
        </div>
        <div className="space-y-4 sm:space-y-5">
          {Object.keys(filteredGrouped).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#555] text-sm">{loading ? "Loading..." : "No transactions yet"}</p>
            </div>
          ) : (
            Object.entries(filteredGrouped).map(([date, txns], gi) => (
              <motion.div key={date} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.1 }}>
                <p className="text-[10px] sm:text-xs text-[#555] uppercase tracking-widest mb-2 sm:mb-3 font-semibold">{date}</p>
                <div className="rounded-xl sm:rounded-2xl px-4 sm:px-5 border border-white/5" style={{ background: "linear-gradient(145deg, #111111 0%, #0D0D0D 100%)" }}>
                  {txns.map((txn, i) => (
                    <TransactionItem key={txn.id} transaction={txn} index={i} onClick={setSelectedTransaction} />
                  ))}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.section>

      {/* Modals */}
      <TopUpModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} onSuccess={handleTopUpSuccess} currentBalance={balance} />
      <TransactionDetailModal isOpen={!!selectedTransaction} onClose={() => setSelectedTransaction(null)} transaction={selectedTransaction} />
    </motion.div>
  );
};

export default WalletPage;
