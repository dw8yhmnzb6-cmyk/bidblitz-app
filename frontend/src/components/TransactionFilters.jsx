/**
 * BidBlitz V2 - Transaction Filters Component
 * Filter transactions by type and status
 */

import { motion } from "framer-motion";
import { PaymentType, PaymentStatus } from "../models";

const typeFilters = [
  { id: 'all', label: 'All' },
  { id: 'payment', label: 'Payments' },
  { id: 'topup', label: 'Top-ups' },
  { id: 'transfer', label: 'Transfers' },
];

const statusFilters = [
  { id: 'all', label: 'All' },
  { id: PaymentStatus.SUCCESS, label: 'Completed' },
  { id: PaymentStatus.PENDING, label: 'Pending' },
  { id: PaymentStatus.FAILED, label: 'Failed' },
];

export const TransactionFilters = ({ 
  activeTypeFilter, 
  activeStatusFilter,
  onTypeFilterChange,
  onStatusFilterChange,
  showStatusFilter = false,
}) => {
  return (
    <div className="space-y-3">
      {/* Type Filters */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {typeFilters.map((filter) => (
          <motion.button
            key={filter.id}
            onClick={() => onTypeFilterChange(filter.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activeTypeFilter === filter.id
                ? 'bg-[#00C2FF] text-[#0A0A0A]'
                : 'bg-[#141414] text-[#888] border border-white/5 hover:border-white/10'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            {filter.label}
          </motion.button>
        ))}
      </div>

      {/* Status Filters (optional) */}
      {showStatusFilter && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {statusFilters.map((filter) => (
            <motion.button
              key={filter.id}
              onClick={() => onStatusFilterChange(filter.id)}
              className={`px-3 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${
                activeStatusFilter === filter.id
                  ? 'bg-white/10 text-white'
                  : 'bg-transparent text-[#666] hover:text-[#888]'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              {filter.label}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Filter transactions based on type and status
 */
export const filterTransactions = (transactions, typeFilter, statusFilter) => {
  return transactions.filter((txn) => {
    // Type filter
    if (typeFilter !== 'all') {
      if (typeFilter === 'payment' && !['payment', 'wallet_payment', 'merchant_payment'].includes(txn.type) && txn.category !== 'payment') {
        return false;
      }
      if (typeFilter === 'topup' && !['topup', 'card_topup', 'bank_topup'].includes(txn.type) && txn.category !== 'topup' && txn.category !== 'income') {
        return false;
      }
      if (typeFilter === 'transfer' && !['transfer', 'peer_transfer', 'send', 'receive'].includes(txn.type) && txn.category !== 'transfer') {
        return false;
      }
    }

    // Status filter
    if (statusFilter !== 'all' && txn.status !== statusFilter) {
      return false;
    }

    return true;
  });
};

export default TransactionFilters;
