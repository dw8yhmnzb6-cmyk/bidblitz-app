import { motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Shield } from "lucide-react";
import { useState } from "react";
import { useWallet } from "../store";
import { useGroupedTransactions } from "../hooks";
import { PremiumCard } from "../components/PremiumCard";
import { QuickAction } from "../components/QuickAction";
import { TransactionItem } from "../components/TransactionItem";
import { TopUpModal } from "../components/TopUpModal";
import { TransactionDetailModal } from "../components/TransactionDetailModal";
import { TransactionFilters, filterTransactions } from "../components/TransactionFilters";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 25 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
  }
};

export const WalletPage = ({ onNavigate }) => {
  const [showBalance, setShowBalance] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const { balance, currency, cardNumber, cardExpiry, cardHolder, addMoney, transactions } = useWallet();
  const groupedTransactions = useGroupedTransactions();

  const handleTopUpSuccess = (transaction) => {
    addMoney(transaction.amount, transaction.description || 'Top-up');
  };

  // Apply filters to grouped transactions
  const filteredGrouped = Object.entries(groupedTransactions).reduce((acc, [date, txns]) => {
    const filtered = filterTransactions(txns, typeFilter, statusFilter);
    if (filtered.length > 0) {
      acc[date] = filtered;
    }
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
      <motion.header 
        className="flex items-center justify-between mb-6 sm:mb-8"
        variants={itemVariants}
      >
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
        
        <motion.button
          data-testid="toggle-balance-btn"
          onClick={() => setShowBalance(!showBalance)}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#141414] border border-white/5 flex items-center justify-center"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
        >
          {showBalance ? (
            <Eye size={18} strokeWidth={1.5} className="text-[#888]" />
          ) : (
            <EyeOff size={18} strokeWidth={1.5} className="text-[#888]" />
          )}
        </motion.button>
      </motion.header>

      {/* Balance Display - Premium */}
      <motion.div 
        className="text-center mb-6 sm:mb-8 relative"
        variants={itemVariants}
      >
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
              {currency}
              <motion.span
                key={balance}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {balance.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
              </motion.span>
            </>
          ) : (
            <span className="text-[#444]">{currency}••••••</span>
          )}
        </motion.h2>
        
        {/* Balance glow */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-32 blur-3xl opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(ellipse, #00C2FF 0%, transparent 70%)" }}
        />
      </motion.div>

      {/* Premium Card */}
      <motion.div variants={itemVariants} className="mb-8 sm:mb-10">
        <PremiumCard
          cardNumber={cardNumber}
          expiry={cardExpiry}
          holder={cardHolder}
        />
      </motion.div>

      {/* Quick Actions */}
      <motion.div 
        className="flex justify-center gap-8 sm:gap-12 mb-8 sm:mb-10"
        variants={itemVariants}
      >
        <QuickAction id="add" icon="add" label="Add Money" onClick={() => setShowTopUp(true)} />
        <QuickAction id="send" icon="send" label="Send" />
        <QuickAction id="history" icon="history" label="History" />
      </motion.div>

      {/* Transaction Filters */}
      <motion.div variants={itemVariants} className="mb-4">
        <TransactionFilters
          activeTypeFilter={typeFilter}
          activeStatusFilter={statusFilter}
          onTypeFilterChange={setTypeFilter}
          onStatusFilterChange={setStatusFilter}
          showStatusFilter={typeFilter !== 'all'}
        />
      </motion.div>

      {/* Transactions */}
      <motion.section variants={itemVariants}>
        <div className="section-header">
          <h3 className="section-title">Transactions</h3>
          <motion.span 
            className="section-link"
            whileHover={{ x: 4 }}
          >
            See All
          </motion.span>
        </div>

        <div className="space-y-4 sm:space-y-5">
          {Object.keys(filteredGrouped).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#555] text-sm">No transactions found</p>
            </div>
          ) : (
            Object.entries(filteredGrouped).map(([date, txns], groupIndex) => (
              <motion.div 
                key={date}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: groupIndex * 0.1 }}
              >
                <p className="text-[10px] sm:text-xs text-[#555] uppercase tracking-widest mb-2 sm:mb-3 font-semibold">
                  {date}
                </p>
                <div 
                  className="rounded-xl sm:rounded-2xl px-4 sm:px-5 border border-white/5"
                  style={{
                    background: "linear-gradient(145deg, #111111 0%, #0D0D0D 100%)"
                  }}
                >
                  {txns.map((txn, index) => (
                    <TransactionItem
                      key={txn.id}
                      transaction={txn}
                      index={index}
                      onClick={setSelectedTransaction}
                    />
                  ))}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.section>

      {/* Top Up Modal */}
      <TopUpModal
        isOpen={showTopUp}
        onClose={() => setShowTopUp(false)}
        onSuccess={handleTopUpSuccess}
        currentBalance={balance}
      />

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        isOpen={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        transaction={selectedTransaction}
      />
    </motion.div>
  );
};

export default WalletPage;
