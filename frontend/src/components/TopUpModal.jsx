/**
 * BidBlitz V2 - Top Up Modal Component
 * Handles wallet top-up flow with payment method selection
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  CreditCard, 
  Smartphone, 
  Building, 
  Check, 
  Loader2,
  AlertCircle,
  ChevronRight
} from "lucide-react";
import { walletService } from "../services";
import { PaymentMethod, PaymentStatus, formatCurrency } from "../models";

const iconMap = {
  'credit-card': CreditCard,
  'apple': () => <span className="text-lg">🍎</span>,
  'smartphone': Smartphone,
  'building': Building,
};

export const TopUpModal = ({ isOpen, onClose, onSuccess, currentBalance }) => {
  const [step, setStep] = useState('amount'); // amount | method | processing | success | error
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState(PaymentMethod.CARD);
  const [error, setError] = useState(null);
  const [transaction, setTransaction] = useState(null);

  const presets = walletService.getTopUpPresets();
  const paymentMethods = walletService.getAvailablePaymentMethods();

  const handleAmountSelect = (preset) => {
    setAmount(preset.toString());
    setError(null);
  };

  const handleContinue = () => {
    const validation = walletService.validateTopUpAmount(parseFloat(amount));
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    setStep('method');
  };

  const handleMethodSelect = (methodId) => {
    const method = paymentMethods.find(m => m.id === methodId);
    if (method && method.enabled) {
      setSelectedMethod(methodId);
    }
  };

  const handleConfirm = async () => {
    setStep('processing');
    setError(null);

    try {
      // Create top-up request
      const requestResult = await walletService.createTopUpRequest({
        userId: 'current_user',
        amount: parseFloat(amount),
        paymentMethod: selectedMethod,
      });

      if (!requestResult.success) {
        setError(requestResult.error);
        setStep('error');
        return;
      }

      // Process top-up
      const processResult = await walletService.processTopUp(requestResult.request);

      if (processResult.success) {
        setTransaction(processResult.transaction);
        setStep('success');
        if (onSuccess) {
          onSuccess(processResult.transaction);
        }
      } else {
        setError(processResult.error);
        setStep('error');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setStep('error');
    }
  };

  const handleClose = () => {
    setStep('amount');
    setAmount('');
    setSelectedMethod(PaymentMethod.CARD);
    setError(null);
    setTransaction(null);
    onClose();
  };

  const fees = walletService.calculateFees(parseFloat(amount) || 0, selectedMethod);

  if (!isOpen) return null;

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
          onClick={handleClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-md bg-[#0A0A0A] rounded-t-3xl sm:rounded-3xl border border-white/10 overflow-hidden"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/5">
            <h2 className="text-lg font-semibold font-outfit text-white">
              {step === 'amount' && 'Add Money'}
              {step === 'method' && 'Payment Method'}
              {step === 'processing' && 'Processing'}
              {step === 'success' && 'Success'}
              {step === 'error' && 'Failed'}
            </h2>
            <motion.button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X size={16} className="text-white/60" />
            </motion.button>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-5">
            <AnimatePresence mode="wait">
              {/* Amount Step */}
              {step === 'amount' && (
                <motion.div
                  key="amount"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <p className="text-sm text-[#666] mb-4">
                    Current balance: {formatCurrency(currentBalance, 'EUR', false)}
                  </p>

                  {/* Amount Input */}
                  <div className="bg-[#141414] rounded-2xl p-4 mb-4 border border-white/5">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-2xl text-[#555] font-outfit">€</span>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => {
                          setAmount(e.target.value);
                          setError(null);
                        }}
                        placeholder="0.00"
                        className="bg-transparent text-4xl font-bold font-outfit text-white text-center w-full outline-none placeholder:text-[#333]"
                        style={{ maxWidth: "160px" }}
                        autoFocus
                      />
                    </div>
                    {error && (
                      <p className="text-[#FF4757] text-xs text-center mt-2">{error}</p>
                    )}
                  </div>

                  {/* Presets */}
                  <div className="grid grid-cols-3 gap-2 mb-6">
                    {presets.map((preset) => (
                      <motion.button
                        key={preset}
                        onClick={() => handleAmountSelect(preset)}
                        className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          amount === preset.toString()
                            ? 'bg-[#00C2FF] text-[#0A0A0A]'
                            : 'bg-[#141414] text-white border border-white/5 hover:border-[#00C2FF]/30'
                        }`}
                        whileTap={{ scale: 0.95 }}
                      >
                        €{preset}
                      </motion.button>
                    ))}
                  </div>

                  <motion.button
                    onClick={handleContinue}
                    disabled={!amount || parseFloat(amount) <= 0}
                    className="w-full py-3.5 bg-[#00C2FF] text-[#0A0A0A] font-semibold rounded-full disabled:opacity-40"
                    whileHover={{ scale: amount ? 1.02 : 1 }}
                    whileTap={{ scale: amount ? 0.98 : 1 }}
                  >
                    Continue
                  </motion.button>
                </motion.div>
              )}

              {/* Payment Method Step */}
              {step === 'method' && (
                <motion.div
                  key="method"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <div className="bg-[#141414] rounded-2xl p-4 mb-4 border border-white/5">
                    <p className="text-xs text-[#666] mb-1">Amount to add</p>
                    <p className="text-2xl font-bold font-outfit text-white">
                      {formatCurrency(parseFloat(amount), 'EUR', false)}
                    </p>
                  </div>

                  <p className="text-sm text-[#666] mb-3">Select payment method</p>

                  <div className="space-y-2 mb-6">
                    {paymentMethods.map((method) => {
                      const Icon = iconMap[method.icon] || CreditCard;
                      return (
                        <motion.button
                          key={method.id}
                          onClick={() => handleMethodSelect(method.id)}
                          disabled={!method.enabled}
                          className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                            selectedMethod === method.id
                              ? 'bg-[#00C2FF]/10 border-[#00C2FF]/30'
                              : method.enabled
                              ? 'bg-[#141414] border-white/5 hover:border-white/10'
                              : 'bg-[#141414]/50 border-white/5 opacity-50'
                          }`}
                          whileTap={method.enabled ? { scale: 0.98 } : {}}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            selectedMethod === method.id ? 'bg-[#00C2FF]/20' : 'bg-white/5'
                          }`}>
                            <Icon size={20} className={selectedMethod === method.id ? 'text-[#00C2FF]' : 'text-white/60'} />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-white">{method.label}</p>
                            {method.comingSoon && (
                              <p className="text-xs text-[#666]">Coming soon</p>
                            )}
                          </div>
                          {selectedMethod === method.id && (
                            <Check size={18} className="text-[#00C2FF]" />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Summary */}
                  <div className="bg-[#141414] rounded-2xl p-4 mb-4 border border-white/5 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#666]">Amount</span>
                      <span className="text-white">{formatCurrency(fees.amount, 'EUR', false)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#666]">Fee</span>
                      <span className="text-[#00D26A]">Free</span>
                    </div>
                    <div className="border-t border-white/5 pt-2 flex justify-between">
                      <span className="text-white font-medium">Total</span>
                      <span className="text-white font-bold">{formatCurrency(fees.total, 'EUR', false)}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <motion.button
                      onClick={() => setStep('amount')}
                      className="flex-1 py-3.5 bg-[#141414] text-white font-semibold rounded-full border border-white/10"
                      whileTap={{ scale: 0.98 }}
                    >
                      Back
                    </motion.button>
                    <motion.button
                      onClick={handleConfirm}
                      className="flex-1 py-3.5 bg-[#00C2FF] text-[#0A0A0A] font-semibold rounded-full"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Confirm
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* Processing Step */}
              {step === 'processing' && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-8 text-center"
                >
                  <motion.div
                    className="w-16 h-16 rounded-full bg-[#00C2FF]/10 flex items-center justify-center mx-auto mb-4"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 size={28} className="text-[#00C2FF]" />
                  </motion.div>
                  <p className="text-white font-medium">Processing payment...</p>
                  <p className="text-sm text-[#666] mt-1">Please wait</p>
                </motion.div>
              )}

              {/* Success Step */}
              {step === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-6 text-center"
                >
                  <motion.div
                    className="w-16 h-16 rounded-full bg-[#00D26A]/10 flex items-center justify-center mx-auto mb-4"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.1 }}
                  >
                    <Check size={28} className="text-[#00D26A]" />
                  </motion.div>
                  <p className="text-white font-semibold text-lg mb-1">Top-up Successful!</p>
                  <p className="text-3xl font-bold font-outfit text-[#00D26A] mb-2">
                    +{formatCurrency(parseFloat(amount), 'EUR', false)}
                  </p>
                  <p className="text-sm text-[#666] mb-6">
                    Added to your wallet
                  </p>
                  <motion.button
                    onClick={handleClose}
                    className="w-full py-3.5 bg-[#00D26A] text-white font-semibold rounded-full"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Done
                  </motion.button>
                </motion.div>
              )}

              {/* Error Step */}
              {step === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-6 text-center"
                >
                  <motion.div
                    className="w-16 h-16 rounded-full bg-[#FF4757]/10 flex items-center justify-center mx-auto mb-4"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.1 }}
                  >
                    <AlertCircle size={28} className="text-[#FF4757]" />
                  </motion.div>
                  <p className="text-white font-semibold text-lg mb-1">Payment Failed</p>
                  <p className="text-sm text-[#666] mb-6">{error}</p>
                  <div className="flex gap-3">
                    <motion.button
                      onClick={handleClose}
                      className="flex-1 py-3.5 bg-[#141414] text-white font-semibold rounded-full border border-white/10"
                      whileTap={{ scale: 0.98 }}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      onClick={() => setStep('method')}
                      className="flex-1 py-3.5 bg-[#FF4757] text-white font-semibold rounded-full"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Try Again
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TopUpModal;
