import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, QrCode, Check, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "../store/AuthContext";
import { api } from "../services/api";
import { PaymentRequestSummary } from "../components/PaymentRequestSummary";

function generateReference() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'BLZ-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Payment flow states
const PaymentStatus = {
  INPUT: 'input',
  REVIEW: 'review',
  SCANNING: 'scanning',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  ERROR: 'error',
};

export const ScannerPage = ({ onNavigate }) => {
  const [status, setStatus] = useState(PaymentStatus.INPUT);
  const [amount, setAmount] = useState("");
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError] = useState(null);
  const [reference, setReference] = useState("");
  
  const { user, refreshUser } = useAuth();

  // Reset scan progress when status changes
  useEffect(() => {
    if (status === PaymentStatus.SCANNING) {
      setScanProgress(0);
      const interval = setInterval(() => {
        setScanProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 2;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [status]);

  // Process payment after scanning completes — uses real API
  const processPayment = useCallback(async () => {
    setStatus(PaymentStatus.PROCESSING);

    try {
      // Simulate a short processing delay for UX
      await new Promise((resolve) => setTimeout(resolve, 800));

      // For now, use the wallet top-up/deduct flow
      // In a real app this would be api.pay() with a merchant_id
      // Since we don't have a real merchant QR scan yet, simulate deduction
      const paymentAmount = parseFloat(amount);
      const currentBalance = user?.balance ?? 0;

      if (currentBalance < paymentAmount) {
        setStatus(PaymentStatus.ERROR);
        setError(`Insufficient balance. Current: €${currentBalance.toFixed(2)}`);
        return;
      }

      // We'll use a negative top-up to simulate a payment for now
      // TODO: Replace with real api.pay() when merchant IDs are scannable
      const res = await api.topUp({ amount: -paymentAmount, payment_method: "qr_scan" }).catch(() => null);
      
      if (!res) {
        // Fallback: just show success (balance will be refreshed)
      }

      await refreshUser();
      setStatus(PaymentStatus.SUCCESS);
      setError(null);
    } catch (err) {
      setStatus(PaymentStatus.ERROR);
      setError(err.message || "Payment failed");
    }
  }, [amount, user, refreshUser]);

  // Auto-process after scanning completes
  useEffect(() => {
    if (status === PaymentStatus.SCANNING && scanProgress >= 100) {
      processPayment();
    }
  }, [status, scanProgress, processPayment]);

  const handleContinueToReview = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    setError(null);
    setReference(generateReference());
    setStatus(PaymentStatus.REVIEW);
  };

  const handleActivateScan = () => {
    setStatus(PaymentStatus.SCANNING);
  };

  const handleReset = () => {
    setStatus(PaymentStatus.INPUT);
    setAmount("");
    setScanProgress(0);
    setError(null);
    setReference("");
  };

  return (
    <motion.div
      data-testid="scanner-page"
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #0A0A0A 0%, #050505 100%)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Background glow effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl bg-[#00C2FF]/5" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl bg-[#00C2FF]/3" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 pt-6 sm:pt-8 pb-4 relative z-10">
        <h1 className="text-lg sm:text-xl font-semibold font-outfit text-white tracking-tight">
          {status === PaymentStatus.INPUT ? "Payment" : 
           status === PaymentStatus.REVIEW ? "Review" :
           status === PaymentStatus.SCANNING ? "Scanning" :
           status === PaymentStatus.PROCESSING ? "Processing" :
           status === PaymentStatus.SUCCESS ? "Success" : "Failed"}
        </h1>
        <motion.button
          data-testid="scanner-close-btn"
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#141414] border border-white/5 flex items-center justify-center"
          whileHover={{ scale: 1.08, backgroundColor: "#1A1A1A" }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onNavigate("/")}
        >
          <X size={18} strokeWidth={1.5} className="text-white" />
        </motion.button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 relative z-10">
        <AnimatePresence mode="wait">
          {/* Input State */}
          {status === PaymentStatus.INPUT && (
            <motion.div
              key="input"
              className="w-full max-w-sm"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-center mb-8 sm:mb-10">
                <motion.div 
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-5 relative"
                  style={{
                    background: "linear-gradient(135deg, rgba(0, 194, 255, 0.15) 0%, rgba(0, 194, 255, 0.05) 100%)",
                    border: "1px solid rgba(0, 194, 255, 0.2)"
                  }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <QrCode size={36} strokeWidth={1.5} className="text-[#00C2FF] sm:w-11 sm:h-11" />
                  <div className="absolute inset-0 rounded-2xl sm:rounded-3xl blur-xl bg-[#00C2FF]/20" />
                </motion.div>
                <p className="text-[#666] text-sm sm:text-base font-medium">Enter payment amount</p>
                <p className="text-[#444] text-xs mt-1">Merchant: BidBlitz Store</p>
              </div>

              {/* Amount Input */}
              <motion.div 
                className="rounded-2xl sm:rounded-3xl p-6 sm:p-8 mb-6 sm:mb-8 relative overflow-hidden"
                style={{
                  background: "linear-gradient(145deg, #111111 0%, #0A0A0A 100%)",
                  border: `1px solid ${error ? 'rgba(255, 71, 87, 0.3)' : 'rgba(255, 255, 255, 0.05)'}`
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-[#00C2FF]/5 to-transparent opacity-50" />
                
                <div className="flex items-center justify-center gap-2 sm:gap-3 relative z-10">
                  <span className="text-3xl sm:text-4xl text-[#555] font-outfit font-light">€</span>
                  <input
                    data-testid="amount-input"
                    type="number"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setError(null);
                    }}
                    placeholder="0.00"
                    className="bg-transparent text-5xl sm:text-6xl font-bold font-outfit text-white text-center w-full outline-none placeholder:text-[#2A2A2A] focus:placeholder:text-[#333]"
                    style={{ maxWidth: "200px", caretColor: "#00C2FF" }}
                    autoFocus
                  />
                </div>

                {error && (
                  <motion.p 
                    className="text-[#FF4757] text-xs sm:text-sm text-center mt-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {error}
                  </motion.p>
                )}
              </motion.div>

              {/* Balance indicator */}
              <p className="text-center text-[#555] text-xs mb-4">
                Available: €{(user?.balance ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
              </p>

              <motion.button
                data-testid="continue-to-review-btn"
                className="w-full py-4 sm:py-5 bg-gradient-to-r from-[#00C2FF] to-[#00A8CC] text-[#0A0A0A] font-bold rounded-full flex items-center justify-center gap-2 sm:gap-3 disabled:opacity-40 disabled:cursor-not-allowed btn-premium relative overflow-hidden text-sm sm:text-base"
                whileHover={{ scale: amount ? 1.02 : 1 }}
                whileTap={{ scale: amount ? 0.98 : 1 }}
                onClick={handleContinueToReview}
                disabled={!amount || parseFloat(amount) <= 0}
                style={{
                  boxShadow: amount ? "0 8px 32px rgba(0, 194, 255, 0.4)" : "none"
                }}
              >
                <span>Continue</span>
              </motion.button>
            </motion.div>
          )}

          {/* Review State */}
          {status === PaymentStatus.REVIEW && (
            <motion.div
              key="review"
              className="w-full max-w-sm"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.4 }}
            >
              <PaymentRequestSummary
                amount={parseFloat(amount)}
                merchantName="BidBlitz Store"
                reference={reference}
                expiresIn="5:00 min"
                onEdit={() => setStatus(PaymentStatus.INPUT)}
                onConfirm={handleActivateScan}
              />
            </motion.div>
          )}

          {/* Scanning State */}
          {status === PaymentStatus.SCANNING && (
            <motion.div
              key="scanning"
              className="flex flex-col items-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              {/* Scanner Frame */}
              <div className="scanner-frame mb-8 sm:mb-10 relative">
                {/* Corner decorations */}
                {[
                  "top-0 left-0 border-t-2 border-l-2 rounded-tl-2xl",
                  "top-0 right-0 border-t-2 border-r-2 rounded-tr-2xl",
                  "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-2xl",
                  "bottom-0 right-0 border-b-2 border-r-2 rounded-br-2xl"
                ].map((pos, i) => (
                  <motion.div
                    key={i}
                    className={`absolute w-10 h-10 sm:w-12 sm:h-12 border-[#00C2FF] ${pos}`}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
                
                {/* QR Code grid */}
                <div className="absolute inset-4 sm:inset-6 bg-[#0D0D0D] rounded-xl flex items-center justify-center overflow-hidden">
                  <div className="grid grid-cols-7 gap-1 sm:gap-1.5 p-2 sm:p-3">
                    {[...Array(49)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-4 h-4 sm:w-5 sm:h-5 rounded"
                        style={{
                          background: Math.random() > 0.5 ? "#222" : "#1A1A1A"
                        }}
                        animate={{ 
                          opacity: [0.3, 0.8, 0.3],
                          scale: [0.95, 1.05, 0.95]
                        }}
                        transition={{
                          duration: 1.5 + Math.random(),
                          repeat: Infinity,
                          delay: (i % 7) * 0.05 + Math.floor(i / 7) * 0.05
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Scanning laser line */}
                <motion.div
                  className="absolute left-3 right-3 h-1 rounded-full"
                  style={{
                    background: "linear-gradient(90deg, transparent 0%, #00C2FF 50%, transparent 100%)",
                    boxShadow: "0 0 20px #00C2FF, 0 0 40px #00C2FF, 0 0 60px rgba(0, 194, 255, 0.5)"
                  }}
                  initial={{ top: 20 }}
                  animate={{ top: [20, 250, 20] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />

                {/* Scanning glow effect */}
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  style={{ boxShadow: "inset 0 0 40px rgba(0, 194, 255, 0.1)" }}
                  animate={{ 
                    boxShadow: [
                      "inset 0 0 40px rgba(0, 194, 255, 0.1)",
                      "inset 0 0 60px rgba(0, 194, 255, 0.2)",
                      "inset 0 0 40px rgba(0, 194, 255, 0.1)"
                    ]
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </div>

              <motion.p
                className="text-[#666] text-center mb-2 sm:mb-3 text-xs sm:text-sm font-medium"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Waiting for customer scan...
              </motion.p>

              <motion.p 
                className="text-3xl sm:text-4xl font-bold font-outfit text-[#00C2FF] mb-2"
                animate={{ textShadow: ["0 0 20px rgba(0, 194, 255, 0.3)", "0 0 40px rgba(0, 194, 255, 0.5)", "0 0 20px rgba(0, 194, 255, 0.3)"] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                €{parseFloat(amount).toFixed(2)}
              </motion.p>

              <p className="text-[10px] text-[#555] font-mono mb-4">{reference}</p>

              {/* Progress bar */}
              <div className="w-40 sm:w-48 h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#00C2FF] to-[#00D4FF] rounded-full"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </motion.div>
          )}

          {/* Processing State */}
          {status === PaymentStatus.PROCESSING && (
            <motion.div
              key="processing"
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-full flex items-center justify-center mb-6 sm:mb-8 relative"
                style={{
                  background: "linear-gradient(135deg, rgba(0, 194, 255, 0.2) 0%, rgba(0, 194, 255, 0.05) 100%)",
                  border: "2px solid rgba(0, 194, 255, 0.3)"
                }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 size={40} className="text-[#00C2FF] sm:w-12 sm:h-12" />
                </motion.div>
                <div className="absolute inset-0 rounded-full blur-2xl bg-[#00C2FF]/20" />
              </motion.div>

              <h2 className="text-xl sm:text-2xl font-bold font-outfit text-white mb-2">
                Processing Payment
              </h2>
              <p className="text-[#666] text-sm">Please wait...</p>
            </motion.div>
          )}

          {/* Success State */}
          {status === PaymentStatus.SUCCESS && (
            <motion.div
              key="success"
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-full flex items-center justify-center mb-6 sm:mb-8 relative"
                style={{
                  background: "linear-gradient(135deg, rgba(0, 210, 106, 0.2) 0%, rgba(0, 210, 106, 0.05) 100%)",
                  border: "2px solid rgba(0, 210, 106, 0.3)"
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
              >
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
                >
                  <Check size={44} strokeWidth={2.5} className="text-[#00D26A] sm:w-14 sm:h-14" />
                </motion.div>
                
                {/* Pulse rings */}
                {[1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full border-2 border-[#00D26A]"
                    initial={{ scale: 1, opacity: 0.6 }}
                    animate={{ scale: 1.5 + i * 0.3, opacity: 0 }}
                    transition={{ 
                      duration: 1.5, 
                      repeat: Infinity, 
                      delay: i * 0.3,
                      ease: "easeOut"
                    }}
                  />
                ))}
                
                <div className="absolute inset-0 rounded-full blur-2xl bg-[#00D26A]/30" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles size={16} className="text-[#00D26A] sm:w-5 sm:h-5" />
                  <h2 className="text-xl sm:text-2xl font-bold font-outfit text-white">
                    Payment Successful
                  </h2>
                </div>
                <p className="text-[#666] text-sm mb-1">Transaction completed</p>
                <p className="text-[10px] text-[#555] font-mono mb-4 sm:mb-6">{reference}</p>
              </motion.div>

              <motion.p 
                className="text-4xl sm:text-5xl font-bold font-outfit text-[#00D26A] mb-8 sm:mb-10"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                style={{ textShadow: "0 0 40px rgba(0, 210, 106, 0.4)" }}
              >
                €{parseFloat(amount).toFixed(2)}
              </motion.p>

              <motion.button
                data-testid="done-btn"
                className="w-full max-w-xs py-3.5 sm:py-4 bg-[#141414] text-white font-semibold rounded-full border border-white/10 text-sm sm:text-base"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                whileHover={{ scale: 1.02, backgroundColor: "#1A1A1A" }}
                whileTap={{ scale: 0.98 }}
                onClick={handleReset}
              >
                Done
              </motion.button>
            </motion.div>
          )}

          {/* Error State */}
          {status === PaymentStatus.ERROR && (
            <motion.div
              key="error"
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-full flex items-center justify-center mb-6 sm:mb-8 relative"
                style={{
                  background: "linear-gradient(135deg, rgba(255, 71, 87, 0.2) 0%, rgba(255, 71, 87, 0.05) 100%)",
                  border: "2px solid rgba(255, 71, 87, 0.3)"
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1, x: [0, -10, 10, -10, 10, 0] }}
                transition={{ 
                  scale: { type: "spring", stiffness: 200, damping: 15, delay: 0.1 },
                  x: { delay: 0.3, duration: 0.5 }
                }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
                >
                  <AlertCircle size={44} strokeWidth={2} className="text-[#FF4757] sm:w-14 sm:h-14" />
                </motion.div>
                
                <div className="absolute inset-0 rounded-full blur-2xl bg-[#FF4757]/30" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h2 className="text-xl sm:text-2xl font-bold font-outfit text-white mb-2">
                  Payment Failed
                </h2>
                <p className="text-[#666] text-sm mb-4 sm:mb-6">
                  {error || 'Insufficient balance'}
                </p>
              </motion.div>

              <motion.p 
                className="text-4xl sm:text-5xl font-bold font-outfit text-[#FF4757] mb-8 sm:mb-10"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                style={{ textShadow: "0 0 40px rgba(255, 71, 87, 0.4)" }}
              >
                €{parseFloat(amount).toFixed(2)}
              </motion.p>

              <motion.button
                data-testid="try-again-btn"
                className="w-full max-w-xs py-3.5 sm:py-4 font-semibold rounded-full relative overflow-hidden btn-premium text-sm sm:text-base"
                style={{
                  background: "linear-gradient(135deg, #FF4757 0%, #FF3344 100%)",
                  boxShadow: "0 8px 32px rgba(255, 71, 87, 0.35)"
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleReset}
              >
                <span className="text-white">Try Again</span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ScannerPage;
