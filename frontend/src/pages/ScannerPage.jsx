import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ScanBarcode, CheckCircle2, XCircle, Loader2,
  Euro, Smartphone, QrCode, Zap, ShieldCheck, Receipt, Heart
} from "lucide-react";
import { useUser, useI18n, useWallet } from "../store";
import { useNetwork } from "../store/NetworkContext";
import { api } from "../services/api";
import ErrorState from "../components/ErrorState";
import TipModal from "../components/TipModal";

const Step = { AMOUNT: 0, SCANNING: 1, PROCESSING: 2, SUCCESS: 3, ERROR: 4 };

const QUICK_AMOUNTS = [5, 10, 15, 25, 50, 100];
const BARCODE_RE = /^BLZ-[A-F0-9]{12}(-[A-F0-9]{8})?$/;

const generateIdempotencyKey = () => `idem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const ScannerPage = ({ onNavigate }) => {
  const user = useUser();
  const wallet = useWallet();
  const { t } = useI18n();
  const { online } = useNetwork();

  const [step, setStep] = useState(Step.AMOUNT);
  const [amount, setAmount] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(null);
  const barcodeRef = useRef(null);
  const [showTip, setShowTip] = useState(false);

  const numAmount = parseFloat(amount) || 0;
  const isValidAmount = numAmount >= 0.5 && numAmount <= 2500;

  // Focus barcode input when scanning step opens
  useEffect(() => {
    if (step === Step.SCANNING && barcodeRef.current) {
      setTimeout(() => barcodeRef.current?.focus(), 300);
    }
  }, [step]);

  const handleStartScan = () => {
    if (!isValidAmount) return;
    if (!online) { setError(t("error.offline")); setStep(Step.ERROR); return; }
    setBarcodeInput("");
    setIdempotencyKey(generateIdempotencyKey());
    setStep(Step.SCANNING);
  };

  const handleBarcodeSubmit = useCallback(async () => {
    if (processing) return; // Prevent double-submit
    const code = barcodeInput.trim().toUpperCase();
    if (!code || code.length < 6) return;
    if (!online) { setError(t("error.offline")); setStep(Step.ERROR); return; }

    // Client-side barcode format validation
    if (!BARCODE_RE.test(code)) {
      setError(t("scan.invalid_barcode_format") || "Invalid barcode format. Expected: BLZ-XXXXXXXXXXXX");
      setStep(Step.ERROR);
      return;
    }

    setStep(Step.PROCESSING);
    setProcessing(true);

    try {
      const res = await api.merchantScanPayment({
        customer_barcode: code,
        amount: numAmount,
        description: `Barcode payment EUR ${numAmount.toFixed(2)}`,
        idempotency_key: idempotencyKey,
      });

      if (res.success) {
        setResult(res);
        setStep(Step.SUCCESS);
        wallet.refreshWallet();
      } else {
        setError(res.detail || t("scan.error"));
        setStep(Step.ERROR);
      }
    } catch (e) {
      const msg = e?.message || "";
      if (msg.startsWith("compliance.")) {
        setError(t(msg.split("|")[0]) || t("scan.error"));
      } else if (msg.includes("insufficient") || msg === "scan.insufficient") {
        setError(t("scan.insufficient") || "Insufficient balance");
      } else if (msg.includes("not found") || msg === "scan.barcode_not_found") {
        setError(t("scan.barcode_not_found") || "Barcode not found");
      } else if (msg === "scan.invalid_barcode_format") {
        setError(t("scan.invalid_barcode_format") || "Invalid barcode format");
      } else {
        setError(msg || t("scan.error"));
      }
      setStep(Step.ERROR);
    } finally {
      setProcessing(false);
    }
  }, [barcodeInput, numAmount, online, t, wallet, processing, idempotencyKey]);

  // Auto-submit when barcode is typed/scanned (13+ chars or Enter)
  const handleBarcodeKeyDown = (e) => {
    if (e.key === "Enter" && barcodeInput.trim().length >= 6) {
      handleBarcodeSubmit();
    }
  };

  const handleReset = () => {
    setStep(Step.AMOUNT);
    setAmount("");
    setBarcodeInput("");
    setResult(null);
    setError("");
    setIdempotencyKey(null);
  };

  const handleNewPayment = () => {
    setStep(Step.AMOUNT);
    setBarcodeInput("");
    setResult(null);
    setError("");
    setIdempotencyKey(null);
  };

  // ─────── Render ───────

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-outfit relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-gradient-radial from-[#00C2FF]/[0.04] to-transparent rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-5 pb-3">
        <motion.button
          data-testid="scanner-back-btn"
          onClick={() => onNavigate("/more")}
          className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
          whileTap={{ scale: 0.9 }}
        >
          <ArrowLeft size={16} className="text-white/70" />
        </motion.button>
        <h1 className="text-base font-semibold">{t("scan.title") || "Barcode Payment"}</h1>
        <div className="w-9" />
      </div>

      <div className="px-5 pb-8 relative z-10">
        <AnimatePresence mode="wait">

          {/* ── Step 0: Amount Entry ── */}
          {step === Step.AMOUNT && (
            <motion.div
              key="amount"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="space-y-5"
            >
              {/* Amount display */}
              <div className="text-center pt-6 pb-4">
                <p className="text-xs text-[#555] uppercase tracking-widest mb-3">{t("scan.enter_amount") || "Payment Amount"}</p>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-3xl text-[#555] font-light">&euro;</span>
                  <input
                    data-testid="scan-amount-input"
                    type="number"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-transparent text-5xl font-bold text-white text-center outline-none w-48 placeholder:text-[#222] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    autoFocus
                  />
                </div>
                {amount && !isValidAmount && (
                  <p className="text-[11px] text-red-400 mt-2">{t("scan.amount_range") || "EUR 0.50 – 2,500.00"}</p>
                )}
              </div>

              {/* Quick amounts */}
              <div className="grid grid-cols-3 gap-2">
                {QUICK_AMOUNTS.map((qa) => (
                  <motion.button
                    key={qa}
                    data-testid={`quick-amount-${qa}`}
                    onClick={() => setAmount(String(qa))}
                    className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                      parseFloat(amount) === qa
                        ? "bg-[#00C2FF]/15 text-[#00C2FF] border border-[#00C2FF]/30"
                        : "bg-white/[0.03] border border-white/[0.05] text-[#888] hover:text-white"
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    &euro;{qa}
                  </motion.button>
                ))}
              </div>

              {/* Scan button */}
              <motion.button
                data-testid="start-scan-btn"
                onClick={handleStartScan}
                disabled={!isValidAmount}
                className={`w-full py-4 rounded-2xl font-semibold flex items-center justify-center gap-2.5 transition-all ${
                  isValidAmount
                    ? "bg-gradient-to-r from-[#00C2FF] to-[#0090FF] text-white shadow-lg shadow-[#00C2FF]/20"
                    : "bg-white/[0.04] text-[#444] cursor-not-allowed"
                }`}
                whileTap={isValidAmount ? { scale: 0.98 } : {}}
              >
                <ScanBarcode size={18} />
                {t("scan.activate_scanner") || "Activate Scanner"}
              </motion.button>

              {/* Info hint */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <Smartphone size={16} className="text-[#00C2FF]/60 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-[#555] leading-relaxed">
                  {t("scan.hint") || "Enter the amount and scan the customer's barcode from their BidBlitz Wallet to process payment instantly."}
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Step 1: Scanning ── */}
          {step === Step.SCANNING && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="space-y-5"
            >
              {/* Amount badge */}
              <div className="text-center pt-4">
                <div className="inline-flex items-center gap-1.5 bg-[#00C2FF]/10 border border-[#00C2FF]/20 rounded-full px-4 py-1.5">
                  <Euro size={14} className="text-[#00C2FF]" />
                  <span className="text-[#00C2FF] font-bold text-lg">{numAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Scanner animation */}
              <div className="relative mx-auto w-64 h-64 rounded-2xl border-2 border-dashed border-[#00C2FF]/30 flex flex-col items-center justify-center overflow-hidden">
                {/* Animated scan line */}
                <motion.div
                  className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#00C2FF] to-transparent"
                  animate={{ y: [-120, 120] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                <QrCode size={48} className="text-[#00C2FF]/30 mb-4" />
                <p className="text-xs text-[#555] text-center px-4">
                  {t("scan.waiting") || "Scan customer barcode or enter manually"}
                </p>
              </div>

              {/* Barcode input */}
              <div className="space-y-3">
                <div className="relative">
                  <ScanBarcode size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
                  <input
                    ref={barcodeRef}
                    data-testid="barcode-input"
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value.toUpperCase())}
                    onKeyDown={handleBarcodeKeyDown}
                    placeholder={t("scan.barcode_placeholder") || "BLZ-XXXXXXXXXXXX"}
                    className="w-full py-3.5 pl-11 pr-4 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm font-mono placeholder:text-[#333] outline-none focus:border-[#00C2FF]/30 transition-colors"
                    autoComplete="off"
                  />
                </div>

                <motion.button
                  data-testid="confirm-barcode-btn"
                  onClick={handleBarcodeSubmit}
                  disabled={barcodeInput.trim().length < 6 || processing}
                  className={`w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                    barcodeInput.trim().length >= 6 && !processing
                      ? "bg-[#00D26A] text-white"
                      : "bg-white/[0.04] text-[#444] cursor-not-allowed"
                  }`}
                  whileTap={barcodeInput.trim().length >= 6 && !processing ? { scale: 0.98 } : {}}
                >
                  <Zap size={16} />
                  {t("scan.charge") || "Charge Customer"}
                </motion.button>

                <motion.button
                  onClick={() => setStep(Step.AMOUNT)}
                  className="w-full py-2.5 text-sm text-[#555] hover:text-white transition-colors"
                  whileTap={{ scale: 0.98 }}
                >
                  {t("scan.change_amount") || "Change Amount"}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Processing ── */}
          {step === Step.PROCESSING && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center pt-24 pb-12"
            >
              <motion.div
                className="w-20 h-20 rounded-full bg-[#00C2FF]/10 border border-[#00C2FF]/20 flex items-center justify-center mb-6"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 size={32} className="text-[#00C2FF]" />
              </motion.div>
              <p className="text-white font-semibold text-base mb-1">{t("scan.processing") || "Processing Payment..."}</p>
              <p className="text-[11px] text-[#555]">{t("scan.verifying_balance") || "Verifying balance and charging wallet"}</p>
            </motion.div>
          )}

          {/* ── Step 3: Success ── */}
          {step === Step.SUCCESS && result && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center pt-12 pb-8"
            >
              <motion.div
                className="w-20 h-20 rounded-full bg-[#00D26A]/15 border border-[#00D26A]/30 flex items-center justify-center mb-5"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 250, damping: 18, delay: 0.1 }}
              >
                <CheckCircle2 size={36} className="text-[#00D26A]" />
              </motion.div>

              <motion.p
                className="text-lg font-semibold text-white mb-1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {t("scan.payment_success") || "Payment Successful"}
              </motion.p>

              <motion.p
                className="text-4xl font-bold text-[#00D26A] mb-1.5"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                &euro;{result.amount.toFixed(2)}
              </motion.p>

              <motion.p
                className="text-xs text-[#555] mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {t("scan.charged_from") || "Charged from"} {result.customer_name}
              </motion.p>

              {/* Receipt card */}
              <motion.div
                className="w-full bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 space-y-2.5 mb-6"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Receipt size={14} className="text-[#00C2FF]/60" />
                  <span className="text-xs text-[#555] uppercase tracking-wider">{t("scan.receipt") || "Receipt"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#555]">{t("scan.amount_label") || "Amount"}</span>
                  <span className="text-white font-medium">&euro;{result.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#555]">{t("scan.fee_label") || "Fee"}</span>
                  <span className="text-[#FFB800]">&euro;{result.fee.toFixed(2)}</span>
                </div>
                <div className="border-t border-white/[0.05] pt-2 flex justify-between text-sm">
                  <span className="text-[#555]">{t("scan.net_received") || "Net Received"}</span>
                  <span className="text-[#00D26A] font-semibold">&euro;{result.net_to_merchant.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#555]">{t("scan.reference") || "Reference"}</span>
                  <span className="text-white/50 font-mono text-xs">{result.reference}</span>
                </div>
                {result.promotion && (
                  <div data-testid="scan-promo-badge" className="flex justify-between text-sm pt-1.5 border-t border-white/[0.05]">
                    <span className="text-[#FFB800]">{t("promo.cashback")}</span>
                    <span className="text-[#FFB800] font-semibold">+&euro;{result.promotion.cashback?.toFixed(2)} ({result.promotion.name})</span>
                  </div>
                )}
              </motion.div>

              <div className="w-full flex gap-3">
                <motion.button
                  data-testid="scan-done-btn"
                  onClick={() => onNavigate("/more")}
                  className="flex-1 py-3.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white font-medium text-sm"
                  whileTap={{ scale: 0.97 }}
                >
                  {t("scan.done") || "Done"}
                </motion.button>
                <motion.button
                  data-testid="scan-tip-btn"
                  onClick={() => setShowTip(true)}
                  className="py-3.5 px-4 bg-[#F59E0B]/15 border border-[#F59E0B]/25 rounded-xl text-[#F59E0B] font-medium text-sm flex items-center gap-1.5"
                  whileTap={{ scale: 0.97 }}
                >
                  <Heart size={14} /> Trinkgeld
                </motion.button>
                <motion.button
                  data-testid="scan-new-payment-btn"
                  onClick={handleNewPayment}
                  className="flex-1 py-3.5 bg-[#00C2FF]/15 border border-[#00C2FF]/25 rounded-xl text-[#00C2FF] font-medium text-sm"
                  whileTap={{ scale: 0.97 }}
                >
                  {t("scan.new_payment") || "New Payment"}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Step 4: Error ── */}
          {step === Step.ERROR && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center pt-16 pb-8"
            >
              <motion.div
                className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" }}
              >
                <XCircle size={36} className="text-red-400" />
              </motion.div>

              <p className="text-lg font-semibold text-white mb-2">{t("scan.payment_failed") || "Payment Failed"}</p>
              <p className="text-sm text-[#555] text-center max-w-[280px] mb-8">{error}</p>

              <div className="w-full flex gap-3">
                <motion.button
                  data-testid="scan-cancel-btn"
                  onClick={handleReset}
                  className="flex-1 py-3.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white font-medium text-sm"
                  whileTap={{ scale: 0.97 }}
                >
                  {t("scan.cancel") || "Cancel"}
                </motion.button>
                <motion.button
                  data-testid="scan-retry-btn"
                  onClick={() => setStep(Step.SCANNING)}
                  className="flex-1 py-3.5 bg-red-500/15 border border-red-500/25 rounded-xl text-red-400 font-medium text-sm"
                  whileTap={{ scale: 0.97 }}
                >
                  {t("scan.try_again") || "Try Again"}
                </motion.button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Security footer */}
      {step === Step.AMOUNT && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center">
          <div className="flex items-center gap-1.5 text-[#333]">
            <ShieldCheck size={12} />
            <span className="text-[10px]">{t("scan.secured") || "End-to-end encrypted"}</span>
          </div>
        </div>
      )}

      {/* POS Tip Modal */}
      {result && (
        <TipModal
          isOpen={showTip}
          onClose={() => setShowTip(false)}
          billAmount={result.amount || 0}
          posCustomerId={result.customer_id || ""}
          transactionId={result.transaction_id || ""}
          onTipSent={() => wallet.refreshWallet()}
        />
      )}
    </div>
  );
};

export default ScannerPage;
