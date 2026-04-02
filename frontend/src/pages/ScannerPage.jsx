import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, QrCode, Check, AlertCircle } from "lucide-react";
import { walletData } from "../data/mockData";

const ScannerStates = {
  INPUT: "input",
  SCANNING: "scanning",
  SUCCESS: "success",
  ERROR: "error"
};

export const ScannerPage = ({ onNavigate }) => {
  const [scanState, setScanState] = useState(ScannerStates.INPUT);
  const [amount, setAmount] = useState("");

  const handleActivateScan = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    
    setScanState(ScannerStates.SCANNING);
    
    // Simulate scanning process
    setTimeout(() => {
      const paymentAmount = parseFloat(amount);
      if (paymentAmount <= walletData.balance) {
        setScanState(ScannerStates.SUCCESS);
      } else {
        setScanState(ScannerStates.ERROR);
      }
    }, 3000);
  };

  const handleReset = () => {
    setScanState(ScannerStates.INPUT);
    setAmount("");
  };

  return (
    <motion.div
      data-testid="scanner-page"
      className="min-h-screen bg-[#0A0A0A] flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <h1 className="text-xl font-semibold font-outfit text-white">
          {scanState === ScannerStates.INPUT ? "Payment" : "Scanning"}
        </h1>
        <motion.button
          data-testid="scanner-close-btn"
          className="w-10 h-10 rounded-full bg-[#141414] border border-white/5 flex items-center justify-center"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onNavigate("/")}
        >
          <X size={18} strokeWidth={1.5} className="text-white" />
        </motion.button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5">
        <AnimatePresence mode="wait">
          {/* Input State */}
          {scanState === ScannerStates.INPUT && (
            <motion.div
              key="input"
              className="w-full max-w-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center mb-8">
                <div className="w-20 h-20 rounded-full bg-[#00C2FF]/10 flex items-center justify-center mx-auto mb-4">
                  <QrCode size={40} strokeWidth={1.5} className="text-[#00C2FF]" />
                </div>
                <p className="text-[#A1A1AA] text-sm">Enter payment amount</p>
              </div>

              {/* Amount Input */}
              <div className="bg-[#141414] rounded-3xl p-6 border border-white/5 mb-6">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl text-[#A1A1AA] font-outfit">€</span>
                  <input
                    data-testid="amount-input"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-transparent text-5xl font-semibold font-outfit text-white text-center w-full outline-none placeholder:text-[#333]"
                    style={{ maxWidth: "200px" }}
                  />
                </div>
              </div>

              <motion.button
                data-testid="activate-scan-btn"
                className="w-full py-4 bg-[#00C2FF] text-[#0A0A0A] font-semibold rounded-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(0, 194, 255, 0.4)" }}
                whileTap={{ scale: 0.98 }}
                onClick={handleActivateScan}
                disabled={!amount || parseFloat(amount) <= 0}
              >
                <QrCode size={20} strokeWidth={2} />
                Activate Scan
              </motion.button>
            </motion.div>
          )}

          {/* Scanning State */}
          {scanState === ScannerStates.SCANNING && (
            <motion.div
              key="scanning"
              className="flex flex-col items-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              {/* Scanner Frame */}
              <div className="scanner-frame mb-8 relative">
                {/* Corner decorations */}
                <div className="scanner-corners" />
                <div className="absolute bottom-0 left-0 right-0 scanner-corners rotate-180" />
                
                {/* QR Code placeholder */}
                <div className="absolute inset-4 bg-[#141414] rounded-2xl flex items-center justify-center">
                  <div className="grid grid-cols-5 gap-1 p-4">
                    {[...Array(25)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-4 h-4 rounded-sm"
                        style={{
                          background: Math.random() > 0.5 ? "#333" : "#222"
                        }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          delay: i * 0.05
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Scanning laser line */}
                <motion.div
                  className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#00C2FF] to-transparent"
                  initial={{ top: 10 }}
                  animate={{ top: [10, 240, 10] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                  style={{
                    boxShadow: "0 0 10px #00C2FF, 0 0 20px #00C2FF"
                  }}
                />
              </div>

              <motion.p
                className="text-[#A1A1AA] text-center"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Waiting for customer scan...
              </motion.p>

              <p className="text-2xl font-semibold font-outfit text-[#00C2FF] mt-4">
                €{parseFloat(amount).toFixed(2)}
              </p>
            </motion.div>
          )}

          {/* Success State */}
          {scanState === ScannerStates.SUCCESS && (
            <motion.div
              key="success"
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-24 h-24 rounded-full bg-[#22C55E]/20 flex items-center justify-center mb-6"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <Check size={48} strokeWidth={2} className="text-[#22C55E]" />
                </motion.div>
              </motion.div>

              <h2 className="text-2xl font-semibold font-outfit text-white mb-2">
                Payment Successful
              </h2>
              <p className="text-[#A1A1AA] mb-4">Transaction completed</p>

              <p className="text-4xl font-semibold font-outfit text-[#22C55E] mb-8">
                €{parseFloat(amount).toFixed(2)}
              </p>

              <motion.button
                data-testid="done-btn"
                className="w-full max-w-xs py-4 bg-[#141414] text-white font-semibold rounded-full border border-white/10"
                whileHover={{ scale: 1.02, background: "#1A1A1A" }}
                whileTap={{ scale: 0.98 }}
                onClick={handleReset}
              >
                Done
              </motion.button>
            </motion.div>
          )}

          {/* Error State */}
          {scanState === ScannerStates.ERROR && (
            <motion.div
              key="error"
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-24 h-24 rounded-full bg-[#EF4444]/20 flex items-center justify-center mb-6"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <AlertCircle size={48} strokeWidth={2} className="text-[#EF4444]" />
                </motion.div>
              </motion.div>

              <h2 className="text-2xl font-semibold font-outfit text-white mb-2">
                Insufficient Balance
              </h2>
              <p className="text-[#A1A1AA] mb-4">
                Your balance (€{walletData.balance.toFixed(2)}) is not enough
              </p>

              <p className="text-4xl font-semibold font-outfit text-[#EF4444] mb-8">
                €{parseFloat(amount).toFixed(2)}
              </p>

              <motion.button
                data-testid="try-again-btn"
                className="w-full max-w-xs py-4 bg-[#EF4444] text-white font-semibold rounded-full"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleReset}
              >
                Try Again
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ScannerPage;
