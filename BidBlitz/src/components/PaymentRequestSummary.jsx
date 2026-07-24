/**
 * BidBlitz V2 - Payment Request Summary Component
 * Shows payment request details before scanning
 */

import { motion } from "framer-motion";
import { QrCode, Clock, Store, FileText } from "lucide-react";
import { formatCurrency } from "../models";

export const PaymentRequestSummary = ({ 
  amount, 
  merchantName, 
  description,
  reference,
  expiresIn,
  onEdit,
  onConfirm,
}) => {
  return (
    <motion.div
      className="bg-[#141414] rounded-2xl border border-white/5 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-gradient-to-r from-[#00C2FF]/10 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00C2FF]/20 flex items-center justify-center">
            <QrCode size={20} className="text-[#00C2FF]" />
          </div>
          <div>
            <p className="text-xs text-[#888]">Payment Request</p>
            <p className="text-sm font-mono text-[#00C2FF]">{reference}</p>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="p-4 space-y-3">
        {/* Amount */}
        <div className="text-center py-2">
          <p className="text-xs text-[#666] mb-1">Amount to collect</p>
          <p className="text-3xl font-bold font-outfit text-white">
            {formatCurrency(amount, 'EUR', false)}
          </p>
        </div>

        {/* Merchant */}
        <div className="flex items-center gap-3 p-3 bg-[#0A0A0A] rounded-xl">
          <Store size={18} className="text-[#888]" />
          <div className="flex-1">
            <p className="text-xs text-[#666]">Merchant</p>
            <p className="text-sm text-white">{merchantName}</p>
          </div>
        </div>

        {/* Description (if provided) */}
        {description && (
          <div className="flex items-start gap-3 p-3 bg-[#0A0A0A] rounded-xl">
            <FileText size={18} className="text-[#888] mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-[#666]">Description</p>
              <p className="text-sm text-white">{description}</p>
            </div>
          </div>
        )}

        {/* Expiry */}
        {expiresIn && (
          <div className="flex items-center justify-center gap-2 text-xs text-[#666]">
            <Clock size={12} />
            <span>Expires in {expiresIn}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 pt-0 flex gap-3">
        {onEdit && (
          <motion.button
            onClick={onEdit}
            className="flex-1 py-3 bg-[#1A1A1A] text-white font-medium rounded-xl border border-white/5 text-sm"
            whileTap={{ scale: 0.98 }}
          >
            Edit
          </motion.button>
        )}
        <motion.button
          onClick={onConfirm}
          className="flex-1 py-3 bg-[#00C2FF] text-[#0A0A0A] font-semibold rounded-xl text-sm"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Show QR Code
        </motion.button>
      </div>
    </motion.div>
  );
};

export default PaymentRequestSummary;
