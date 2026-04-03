/**
 * BidBlitz V2 - Top Up Modal (Stripe Checkout)
 * Amount → Redirect to Stripe → Return & verify → Wallet credited
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, CreditCard, Check, Loader2, AlertCircle, ExternalLink, Shield
} from "lucide-react";
import { formatCurrency } from "../models";
import { useI18n } from "../store";
import { useNetwork } from "../store/NetworkContext";

const API_BASE = process.env.REACT_APP_BACKEND_URL;

const PRESETS = [
  { id: "10", amount: 10 },
  { id: "25", amount: 25 },
  { id: "50", amount: 50 },
  { id: "100", amount: 100 },
  { id: "250", amount: 250 },
  { id: "500", amount: 500 },
];

async function apiCall(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

// ── Polling hook for stripe session status ──
function useStripeStatusPoll(sessionId, onCredited) {
  const [status, setStatus] = useState("checking"); // checking | paid | error
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 8;

    const poll = async () => {
      if (cancelled || attempts >= maxAttempts) {
        if (!cancelled) setStatus("error");
        return;
      }
      attempts++;
      try {
        const data = await apiCall(`/api/stripe/checkout/status/${sessionId}`);
        if (cancelled) return;
        setAmount(data.amount || 0);

        if (data.payment_status === "paid" || data.credited) {
          setStatus("paid");
          if (onCredited) onCredited(data.amount);
          return;
        }
        if (data.status === "expired") {
          setStatus("error");
          return;
        }
        // Still pending — poll again
        setTimeout(poll, 2500);
      } catch {
        if (!cancelled) setTimeout(poll, 3000);
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [sessionId, onCredited]);

  return { status, amount };
}

export const TopUpModal = ({ isOpen, onClose, onSuccess, currentBalance }) => {
  const [step, setStep] = useState("amount"); // amount | redirecting | verifying | success | error
  const [selectedId, setSelectedId] = useState(null);
  const [customAmount, setCustomAmount] = useState("");
  const [error, setError] = useState(null);
  const [stripeSessionId, setStripeSessionId] = useState(null);
  const [creditedAmount, setCreditedAmount] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const { t } = useI18n();
  const { online } = useNetwork();

  const handleCredited = useCallback((amt) => {
    setCreditedAmount(amt);
    setStep("success");
    if (onSuccess) onSuccess({ amount: amt, paymentMethod: "stripe" });
  }, [onSuccess]);

  const pollResult = useStripeStatusPoll(
    step === "verifying" ? stripeSessionId : null,
    handleCredited
  );

  // Check URL params on mount (return from Stripe)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("stripe_session_id");
    const cancelled = params.get("stripe_cancelled");

    if (sid) {
      setStripeSessionId(sid);
      setStep("verifying");
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    } else if (cancelled) {
      setStep("error");
      setError("Payment was cancelled");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleCheckout = async () => {
    const pkgId = selectedId;
    if (!pkgId) return;

    if (!online) {
      setError(t("error.offline"));
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const data = await apiCall("/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({
          package_id: pkgId,
          origin_url: window.location.origin,
        }),
      });

      if (data.checkout_url) {
        setStep("redirecting");
        setTimeout(() => {
          window.location.href = data.checkout_url;
        }, 800);
      }
    } catch (err) {
      const msg = err.message || "";
      // Map compliance errors to translated messages
      if (msg.startsWith("compliance.")) {
        const key = msg.split("|")[0];
        setError(t(key) || msg);
      } else {
        setError(msg);
      }
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setStep("amount");
    setSelectedId(null);
    setCustomAmount("");
    setError(null);
    setStripeSessionId(null);
    setCreditedAmount(0);
    setIsCreating(false);
    onClose();
  };

  const selectedPreset = PRESETS.find((p) => p.id === selectedId);

  if (!isOpen && !stripeSessionId) return null;
  // Force open if we're verifying a stripe return
  const shouldShow = isOpen || step === "verifying" || step === "success";
  if (!shouldShow) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={step === "redirecting" || step === "verifying" ? undefined : handleClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

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
              {step === "amount" && (t("topup.title") || "Add Money")}
              {step === "redirecting" && (t("topup.redirecting") || "Redirecting...")}
              {step === "verifying" && (t("topup.verifying") || "Verifying Payment")}
              {step === "success" && (t("topup.success") || "Success")}
              {step === "error" && (t("topup.failed") || "Failed")}
            </h2>
            {step !== "redirecting" && step !== "verifying" && (
              <motion.button
                data-testid="topup-close-btn"
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"
                whileTap={{ scale: 0.9 }}
              >
                <X size={16} className="text-white/60" />
              </motion.button>
            )}
          </div>

          <div className="p-4 sm:p-5">
            <AnimatePresence mode="wait">

              {/* ── Amount Selection ── */}
              {step === "amount" && (
                <motion.div
                  key="amount"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <p className="text-sm text-[#666] mb-4">
                    {t("topup.current") || "Current balance"}: {formatCurrency(currentBalance, "EUR", false)}
                  </p>

                  {/* Package grid */}
                  <div className="grid grid-cols-3 gap-2 mb-5">
                    {PRESETS.map((preset) => (
                      <motion.button
                        key={preset.id}
                        data-testid={`topup-preset-${preset.id}`}
                        onClick={() => { setSelectedId(preset.id); setError(null); }}
                        className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                          selectedId === preset.id
                            ? "bg-[#00C2FF] text-[#0A0A0A]"
                            : "bg-[#141414] text-white border border-white/5 hover:border-[#00C2FF]/30"
                        }`}
                        whileTap={{ scale: 0.95 }}
                      >
                        &euro;{preset.amount}
                      </motion.button>
                    ))}
                  </div>

                  {/* Summary */}
                  {selectedPreset && (
                    <motion.div
                      className="bg-[#141414] rounded-2xl p-4 mb-4 border border-white/5 space-y-2"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                    >
                      <div className="flex justify-between text-sm">
                        <span className="text-[#666]">{t("topup.amount") || "Amount"}</span>
                        <span className="text-white">&euro;{selectedPreset.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#666]">{t("topup.fee") || "Fee"}</span>
                        <span className="text-[#00D26A]">{t("topup.free") || "Free"}</span>
                      </div>
                      <div className="border-t border-white/5 pt-2 flex justify-between">
                        <span className="text-white font-medium">{t("topup.total") || "Total"}</span>
                        <span className="text-white font-bold">&euro;{selectedPreset.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <CreditCard size={12} className="text-[#444]" />
                        <span className="text-[10px] text-[#444]">Powered by Stripe (Test Mode)</span>
                      </div>
                    </motion.div>
                  )}

                  {error && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3"
                      style={{ background: "rgba(255,71,87,0.06)", border: "1px solid rgba(255,71,87,0.12)" }}>
                      <AlertCircle size={13} className="text-[#FF4757]" />
                      <p className="text-[11px] text-[#FF4757] font-medium">{error}</p>
                    </div>
                  )}

                  <motion.button
                    data-testid="topup-checkout-btn"
                    onClick={handleCheckout}
                    disabled={!selectedId || isCreating}
                    className="w-full py-3.5 bg-[#00C2FF] text-[#0A0A0A] font-semibold rounded-full disabled:opacity-40 flex items-center justify-center gap-2"
                    whileTap={selectedId && !isCreating ? { scale: 0.98 } : {}}
                  >
                    {isCreating ? (
                      <>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                          <Loader2 size={15} />
                        </motion.div>
                        {t("topup.creating") || "Creating checkout..."}
                      </>
                    ) : (
                      <>
                        <ExternalLink size={15} />
                        {t("topup.pay_stripe") || "Pay with Stripe"}
                      </>
                    )}
                  </motion.button>

                  <div className="flex items-center justify-center gap-1.5 mt-3">
                    <Shield size={10} className="text-[#00D26A]/50" />
                    <span className="text-[10px] text-[#222]">Secured by Stripe</span>
                  </div>
                </motion.div>
              )}

              {/* ── Redirecting to Stripe ── */}
              {step === "redirecting" && (
                <motion.div
                  key="redirecting"
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
                  <p className="text-white font-medium">{t("topup.redirecting") || "Redirecting to Stripe..."}</p>
                  <p className="text-sm text-[#666] mt-1">{t("topup.redirect_msg") || "You'll be redirected to secure payment"}</p>
                </motion.div>
              )}

              {/* ── Verifying Payment ── */}
              {step === "verifying" && (
                <motion.div
                  key="verifying"
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
                  <p className="text-white font-medium">{t("topup.verifying") || "Verifying payment..."}</p>
                  <p className="text-sm text-[#666] mt-1">{t("topup.verifying_msg") || "Confirming with Stripe"}</p>
                </motion.div>
              )}

              {/* ── Success ── */}
              {step === "success" && (
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
                  <p className="text-white font-semibold text-lg mb-1">{t("topup.success_msg") || "Top-up Successful!"}</p>
                  <p className="text-3xl font-bold font-outfit text-[#00D26A] mb-2">
                    +&euro;{(creditedAmount || pollResult.amount || 0).toFixed(2)}
                  </p>
                  <p className="text-sm text-[#666] mb-6">{t("topup.added") || "Added to your wallet via Stripe"}</p>
                  <motion.button
                    data-testid="topup-done-btn"
                    onClick={handleClose}
                    className="w-full py-3.5 bg-[#00D26A] text-white font-semibold rounded-full"
                    whileTap={{ scale: 0.98 }}
                  >
                    {t("topup.done") || "Done"}
                  </motion.button>
                </motion.div>
              )}

              {/* ── Error ── */}
              {step === "error" && (
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
                  <p className="text-white font-semibold text-lg mb-1">{t("topup.failed_title") || "Payment Failed"}</p>
                  <p className="text-sm text-[#666] mb-6">{error || t("topup.failed_msg") || "Payment could not be verified"}</p>
                  <div className="flex gap-3">
                    <motion.button
                      onClick={handleClose}
                      className="flex-1 py-3.5 bg-[#141414] text-white font-semibold rounded-full border border-white/10"
                      whileTap={{ scale: 0.98 }}
                    >
                      {t("topup.cancel") || "Cancel"}
                    </motion.button>
                    <motion.button
                      onClick={() => { setStep("amount"); setError(null); }}
                      className="flex-1 py-3.5 bg-[#FF4757] text-white font-semibold rounded-full"
                      whileTap={{ scale: 0.98 }}
                    >
                      {t("topup.try_again") || "Try Again"}
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
