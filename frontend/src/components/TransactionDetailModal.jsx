/**
 * BidBlitz V2 - Transaction Detail Modal
 * Shows detailed transaction information
 */

import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Copy, 
  Check, 
  ArrowUpRight, 
  ArrowDownLeft,
  ExternalLink,
  Share2
} from "lucide-react";
import { useState } from "react";
import { 
  formatCurrency, 
  formatFullDateTime, 
  getStatusColor, 
  getStatusLabel,
  PaymentStatus 
} from "../models";

export const TransactionDetailModal = ({ isOpen, onClose, transaction }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !transaction) return null;

  const isPositive = transaction.amount > 0;
  const statusColor = getStatusColor(transaction.status);

  const handleCopyReference = () => {
    navigator.clipboard.writeText(transaction.reference || transaction.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const details = [
    { label: 'Reference', value: transaction.reference || transaction.id },
    { label: 'Type', value: transaction.type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) },
    { label: 'Status', value: getStatusLabel(transaction.status), color: statusColor },
    { label: 'Date', value: formatFullDateTime(transaction.createdAt || transaction.date) },
    { label: 'Payment Method', value: transaction.paymentMethod?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Wallet' },
    ...(transaction.completedAt ? [{ label: 'Completed', value: formatFullDateTime(transaction.completedAt) }] : []),
    ...(transaction.failureReason ? [{ label: 'Failure Reason', value: transaction.failureReason, color: '#FF4757' }] : []),
  ];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-md bg-[#0A0A0A] rounded-t-3xl sm:rounded-3xl border border-white/10 overflow-hidden max-h-[90vh] overflow-y-auto"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="sticky top-0 bg-[#0A0A0A] flex items-center justify-between p-4 sm:p-5 border-b border-white/5 z-10">
            <h2 className="text-lg font-semibold font-outfit text-white">
              Transaction Details
            </h2>
            <motion.button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X size={16} className="text-white/60" />
            </motion.button>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-5">
            {/* Amount Header */}
            <div className="text-center mb-6">
              <div className={`w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center ${
                isPositive ? 'bg-[#00D26A]/10' : 'bg-[#FF4757]/10'
              }`}>
                {isPositive ? (
                  <ArrowDownLeft size={24} className="text-[#00D26A]" />
                ) : (
                  <ArrowUpRight size={24} className="text-[#FF4757]" />
                )}
              </div>
              
              <p className={`text-3xl font-bold font-outfit ${
                isPositive ? 'text-[#00D26A]' : 'text-white'
              }`}>
                {formatCurrency(transaction.amount)}
              </p>
              
              <p className="text-[#888] text-sm mt-1">
                {transaction.merchantName || transaction.description}
              </p>

              {/* Status Badge */}
              <div 
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mt-3 text-xs font-medium"
                style={{ 
                  backgroundColor: `${statusColor}15`,
                  color: statusColor,
                  border: `1px solid ${statusColor}30`
                }}
              >
                <span 
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: statusColor }}
                />
                {getStatusLabel(transaction.status)}
              </div>
            </div>

            {/* Details List */}
            <div className="bg-[#141414] rounded-2xl border border-white/5 divide-y divide-white/5">
              {details.map((detail, index) => (
                <div key={index} className="flex justify-between items-center p-3.5">
                  <span className="text-sm text-[#666]">{detail.label}</span>
                  <span 
                    className="text-sm font-medium text-right max-w-[60%] truncate"
                    style={{ color: detail.color || '#fff' }}
                  >
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Copy Reference Button */}
            <motion.button
              onClick={handleCopyReference}
              className="w-full mt-4 py-3 flex items-center justify-center gap-2 bg-[#141414] rounded-xl border border-white/5 text-sm"
              whileHover={{ backgroundColor: '#1A1A1A' }}
              whileTap={{ scale: 0.98 }}
            >
              {copied ? (
                <>
                  <Check size={16} className="text-[#00D26A]" />
                  <span className="text-[#00D26A]">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={16} className="text-[#888]" />
                  <span className="text-white">Copy Reference</span>
                </>
              )}
            </motion.button>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-4">
              {transaction.status === PaymentStatus.FAILED && (
                <motion.button
                  className="flex-1 py-3 bg-[#FF4757] text-white font-semibold rounded-full text-sm"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Retry Payment
                </motion.button>
              )}
              
              <motion.button
                onClick={onClose}
                className="flex-1 py-3 bg-[#00C2FF] text-[#0A0A0A] font-semibold rounded-full text-sm"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Close
              </motion.button>
            </div>

            {/* Help Link */}
            <button className="w-full mt-4 py-2 text-sm text-[#00C2FF] flex items-center justify-center gap-1">
              Need help with this transaction?
              <ExternalLink size={14} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TransactionDetailModal;
