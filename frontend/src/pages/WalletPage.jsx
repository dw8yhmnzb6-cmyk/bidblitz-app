import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { walletData, transactions, formatDate } from "../data/mockData";
import { PremiumCard } from "../components/PremiumCard";
import { QuickAction } from "../components/QuickAction";
import { TransactionItem } from "../components/TransactionItem";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

// Group transactions by date
const groupTransactionsByDate = (txns) => {
  const groups = {};
  txns.forEach((txn) => {
    const dateKey = formatDate(txn.date);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(txn);
  });
  return groups;
};

export const WalletPage = ({ onNavigate }) => {
  const groupedTransactions = groupTransactionsByDate(transactions);

  return (
    <motion.div
      data-testid="wallet-page"
      className="px-5 pt-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header */}
      <motion.header 
        className="flex items-center gap-4 mb-6"
        variants={itemVariants}
      >
        <motion.button
          data-testid="wallet-back-btn"
          className="w-10 h-10 rounded-full bg-[#141414] border border-white/5 flex items-center justify-center"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onNavigate("/")}
        >
          <ArrowLeft size={18} strokeWidth={1.5} className="text-white" />
        </motion.button>
        <h1 className="text-xl font-semibold font-outfit text-white">Wallet</h1>
      </motion.header>

      {/* Balance Display */}
      <motion.div 
        className="text-center mb-6"
        variants={itemVariants}
      >
        <p className="text-[#A1A1AA] text-sm mb-1">Available Balance</p>
        <motion.h2
          className="amount-display"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
        >
          {walletData.currency}{walletData.balance.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
        </motion.h2>
      </motion.div>

      {/* Premium Card */}
      <motion.div variants={itemVariants} className="mb-8">
        <PremiumCard
          cardNumber={walletData.cardNumber}
          expiry={walletData.cardExpiry}
          holder={walletData.cardHolder}
        />
      </motion.div>

      {/* Quick Actions */}
      <motion.div 
        className="flex justify-center gap-10 mb-8"
        variants={itemVariants}
      >
        <QuickAction id="add" icon="add" label="Add Money" />
        <QuickAction id="send" icon="send" label="Send" />
        <QuickAction id="history" icon="history" label="History" />
      </motion.div>

      {/* Transactions */}
      <motion.section variants={itemVariants}>
        <div className="section-header">
          <h3 className="section-title">Transactions</h3>
          <span className="section-link">See All</span>
        </div>

        <div className="space-y-4">
          {Object.entries(groupedTransactions).map(([date, txns]) => (
            <div key={date}>
              <p className="text-xs text-[#A1A1AA] uppercase tracking-wider mb-2 font-medium">
                {date}
              </p>
              <div className="bg-[#141414] rounded-2xl px-4 border border-white/5">
                {txns.map((txn, index) => (
                  <TransactionItem
                    key={txn.id}
                    transaction={txn}
                    index={index}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
};

export default WalletPage;
