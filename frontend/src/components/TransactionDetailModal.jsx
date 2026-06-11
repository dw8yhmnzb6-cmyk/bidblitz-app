/**
 * BidBlitz V2 - Transaction Detail Modal
 * Shows detailed transaction information with PDF receipt download
 */

import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Copy, 
  Check, 
  ArrowUpRight, 
  ArrowDownLeft,
  ExternalLink,
  Download,
  Printer,
  Loader2
} from "lucide-react";
import { useState } from "react";
import { 
  formatCurrency, 
  formatFullDateTime, 
  getStatusColor, 
  getStatusLabel,
  PaymentStatus 
} from "../models";

const API = process.env.REACT_APP_BACKEND_URL;

export const TransactionDetailModal = ({ isOpen, onClose, transaction }) => {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!isOpen || !transaction) return null;

  const isPositive = transaction.amount > 0;
  const statusColor = getStatusColor(transaction.status);

  const handleCopyReference = () => {
    navigator.clipboard.writeText(transaction.reference || transaction.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const txnId = transaction.id || transaction.reference;
      const res = await fetch(`${API}/api/payments/receipt/${txnId}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BidBlitz_Receipt_${txnId.slice(0, 12)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("PDF download error:", e);
    }
    setDownloading(false);
  };

  const handlePrint = () => {
    const content = `
      <html>
      <head><title>BidBlitz Receipt</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 40px; max-width: 400px; margin: 0 auto; }
        h1 { color: #00C2FF; text-align: center; font-size: 24px; margin-bottom: 8px; }
        .subtitle { text-align: center; color: #666; font-size: 12px; margin-bottom: 24px; }
        .amount { text-align: center; font-size: 32px; font-weight: bold; color: ${isPositive ? '#00D26A' : '#333'}; margin: 20px 0; }
        .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; font-size: 13px; }
        .label { color: #666; }
        .value { font-weight: 500; }
        .footer { text-align: center; margin-top: 32px; font-size: 11px; color: #999; }
      </style>
      </head>
      <body>
        <h1>BidBlitz</h1>
        <p class="subtitle">Payment Receipt</p>
        <p class="amount">${isPositive ? '+' : ''}€${Math.abs(transaction.amount).toFixed(2)}</p>
        <div class="row"><span class="label">Reference</span><span class="value">${transaction.reference || transaction.id}</span></div>
        <div class="row"><span class="label">Type</span><span class="value">${transaction.type?.replace(/_/g, ' ')}</span></div>
        <div class="row"><span class="label">Status</span><span class="value">${transaction.status}</span></div>
        <div class="row"><span class="label">Date</span><span class="value">${new Date(transaction.createdAt || transaction.date).toLocaleString()}</span></div>
        <div class="row"><span class="label">Merchant</span><span class="value">${transaction.merchantName || '-'}</span></div>
        <p class="footer">Thank you for using BidBlitz!<br>support@bidblitz.com</p>
      </body>
      </html>
    `;
    const win = window.open('', '_blank');
    win.document.write(content);
    win.document.close();
    win.print();
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
          className="relative w-full max-w-md bg-[#f8fafc] rounded-t-[32px] sm:rounded-[32px] border border-slate-200 overflow-hidden max-h-[90vh] overflow-y-auto shadow-[0_24px_64px_rgba(15,23,42,0.16)]"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white/92 flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 z-10">
            <h2 className="text-lg font-semibold font-outfit text-slate-900">
              Transaction Details
            </h2>
            <motion.button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X size={16} className="text-slate-600" />
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
                isPositive ? 'text-[#00D26A]' : 'text-slate-900'
              }`}>
                {formatCurrency(transaction.amount)}
              </p>
              
              <p className="text-slate-500 text-sm mt-1">
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
            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              {details.map((detail, index) => (
                <div key={index} className="flex justify-between items-center p-3.5">
                  <span className="text-sm text-slate-500">{detail.label}</span>
                  <span 
                    className="text-sm font-medium text-right max-w-[60%] truncate"
                    style={{ color: detail.color || '#fff' }}
                  >
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Action Buttons Row */}
            <div className="flex gap-2 mt-4">
              <motion.button
                data-testid="copy-ref-btn"
                onClick={handleCopyReference}
                className="flex-1 py-3 flex items-center justify-center gap-2 bg-white rounded-xl border border-slate-200 text-sm"
                whileTap={{ scale: 0.98 }}
              >
                {copied ? <Check size={14} className="text-[#00D26A]" /> : <Copy size={14} className="text-[#888]" />}
                <span className={copied ? "text-[#00D26A]" : "text-slate-900"}>{copied ? "Copied" : "Copy"}</span>
              </motion.button>

              <motion.button
                data-testid="download-pdf-btn"
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="flex-1 py-3 flex items-center justify-center gap-2 bg-white rounded-xl border border-slate-200 text-sm disabled:opacity-50"
                whileTap={{ scale: 0.98 }}
              >
                {downloading ? <Loader2 size={14} className="text-[#00C2FF] animate-spin" /> : <Download size={14} className="text-[#00C2FF]" />}
                <span className="text-slate-900">PDF</span>
              </motion.button>

              <motion.button
                data-testid="print-btn"
                onClick={handlePrint}
                className="flex-1 py-3 flex items-center justify-center gap-2 bg-white rounded-xl border border-slate-200 text-sm"
                whileTap={{ scale: 0.98 }}
              >
                <Printer size={14} className="text-[#FFB800]" />
                <span className="text-slate-900">Print</span>
              </motion.button>
            </div>

            {/* Main Action Buttons */}
            <div className="flex gap-3 mt-3">
              {transaction.status === PaymentStatus.FAILED && (
                <motion.button
                  className="flex-1 py-3 bg-[#FF4757] text-white font-semibold rounded-full text-sm"
                  whileTap={{ scale: 0.98 }}
                >
                  Retry Payment
                </motion.button>
              )}
              
              <motion.button
                onClick={onClose}
                className="flex-1 py-3 bg-[#00C2FF] text-[#0A0A0A] font-semibold rounded-full text-sm"
                whileTap={{ scale: 0.98 }}
              >
                Close
              </motion.button>
            </div>

            {/* Help Link */}
            <button className="w-full mt-3 py-2 text-sm text-[#00C2FF] flex items-center justify-center gap-1">
              Need help?
              <ExternalLink size={14} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TransactionDetailModal;
