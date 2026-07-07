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
import AppleGooglePayButton from "./AppleGooglePayButton";

const API_BASE = process.env.REACT_APP_BACKEND_URL;

const safeAmount = (value) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

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

  // Saved payment method state
  const [savedMethod, setSavedMethod] = useState(null);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [quickPaying, setQuickPaying] = useState(false);
  const [useNewMethod, setUseNewMethod] = useState(false);

  // Fetch saved method on open
  useEffect(() => {
    if (!isOpen) return;
    setLoadingSaved(true);
    apiCall("/api/stripe/saved-method")
      .then((d) => { if (d.has_saved_method) setSavedMethod(d); else setSavedMethod(null); })
      .catch(() => setSavedMethod(null))
      .finally(() => setLoadingSaved(false));
  }, [isOpen]);

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
      if (msg.startsWith("compliance.")) {
        const key = msg.split("|")[0];
        setError(t(key) || msg);
      } else {
        setError(msg);
      }
      setIsCreating(false);
    }
  };

  const handleQuickPay = async () => {
    const pkgId = selectedId;
    if (!pkgId) return;

    if (!online) { setError(t("error.offline")); return; }

    const preset = PRESETS.find((p) => p.id === pkgId);
    if (!preset) return;

    setQuickPaying(true);
    setError(null);

    try {
      const data = await apiCall("/api/stripe/quick-topup", {
        method: "POST",
        body: JSON.stringify({ amount: preset.amount }),
      });
      setCreditedAmount(data.amount);
      setStep("success");
      if (onSuccess) onSuccess({ amount: data.amount, paymentMethod: "saved_card" });
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("declined") || msg.includes("No saved")) {
        setSavedMethod(null);
        setUseNewMethod(true);
      }
      setError(msg);
    } finally {
      setQuickPaying(false);
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
    setQuickPaying(false);
    setUseNewMethod(false);
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
          className="relative w-full max-w-md bg-[#f8fafc] rounded-t-[32px] sm:rounded-[32px] border border-slate-200 overflow-hidden max-h-[90vh] overflow-y-auto shadow-[0_24px_64px_rgba(15,23,42,0.16)]"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 24px), 32px)" }}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-white/90">
            <h2 className="text-lg font-semibold font-outfit text-slate-900">
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
                className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center"
                whileTap={{ scale: 0.9 }}
              >
                <X size={16} className="text-slate-600" />
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
                  <p className="text-sm text-slate-500 mb-4">
                    {t("topup.current") || "Current balance"}: {formatCurrency(safeAmount(currentBalance), "EUR", false)}
                  </p>

                  {/* Package grid */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {PRESETS.map((preset) => (
                      <motion.button
                        key={preset.id}
                        data-testid={`topup-preset-${preset.id}`}
                        onClick={() => { setSelectedId(preset.id); setError(null); }}
                        className={`py-4 rounded-xl text-base font-bold transition-all ${
                          selectedId === preset.id
                            ? "bg-[#00C2FF] text-[#0A0A0A] scale-105"
                            : "bg-white text-slate-900 border border-slate-200 hover:border-[#00C2FF]/40"
                        }`}
                        whileTap={{ scale: 0.95 }}
                      >
                        €{preset.amount}
                      </motion.button>
                    ))}
                  </div>

                  {/* Summary */}
                  {selectedPreset && (
                    <motion.div
                      className="bg-white rounded-2xl p-4 mb-4 border border-slate-200 space-y-2 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                    >
                      <div className="flex justify-between text-sm">
                        <span className="text-[#666]">{t("topup.amount") || "Amount"}</span>
                        <span className="text-slate-900">&euro;{selectedPreset.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#666]">{t("topup.fee") || "Fee"}</span>
                        <span className="text-[#00D26A]">{t("topup.free") || "Free"}</span>
                      </div>
                      <div className="border-t border-white/5 pt-2 flex justify-between">
                        <span className="text-slate-900 font-medium">{t("topup.total") || "Total"}</span>
                        <span className="text-slate-900 font-bold">&euro;{selectedPreset.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <CreditCard size={12} className="text-slate-500" />
                        <span className="text-[10px] text-slate-500">Sicher mit Stripe</span>
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

                  {/* 1-Click Payment with saved card */}
                  {savedMethod && !useNewMethod && selectedPreset && (
                    <motion.div
                      data-testid="saved-card-section"
                      className="rounded-2xl p-4 mb-3 border"
                      style={{ background: "rgba(0,194,255,0.03)", borderColor: "rgba(0,194,255,0.1)" }}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: "rgba(0,194,255,0.08)", border: "1px solid rgba(0,194,255,0.12)" }}>
                          <CreditCard size={18} className="text-[#00C2FF]" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[12px] font-semibold text-slate-900">
                            {savedMethod.card_brand.charAt(0).toUpperCase() + savedMethod.card_brand.slice(1)} ****{savedMethod.card_last4}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {t("topup.expires") || "Expires"} {savedMethod.card_exp_month}/{savedMethod.card_exp_year}
                          </p>
                        </div>
                        <div className="px-2 py-0.5 rounded-full" style={{ background: "rgba(0,210,106,0.08)", border: "1px solid rgba(0,210,106,0.12)" }}>
                          <span className="text-[9px] text-[#00D26A] font-semibold uppercase">{t("topup.saved") || "Saved"}</span>
                        </div>
                      </div>

                      <motion.button
                        data-testid="quick-pay-btn"
                        onClick={handleQuickPay}
                        disabled={quickPaying}
                        className="w-full py-3 bg-[#00C2FF] text-[#0A0A0A] font-semibold rounded-full disabled:opacity-60 flex items-center justify-center gap-2"
                        whileTap={!quickPaying ? { scale: 0.98 } : {}}
                      >
                        {quickPaying ? (
                          <>
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                              <Loader2 size={15} />
                            </motion.div>
                            {t("topup.processing") || "Processing..."}
                          </>
                        ) : (
                          <>
                            <Check size={15} strokeWidth={2.5} />
                            {t("topup.confirm_pay") || "Confirm & Pay"} &euro;{selectedPreset.amount.toFixed(2)}
                          </>
                        )}
                      </motion.button>

                      <motion.button
                        data-testid="use-new-method-btn"
                        onClick={() => setUseNewMethod(true)}
                        className="w-full mt-2 py-2 text-[11px] text-slate-500 font-medium"
                        whileTap={{ scale: 0.98 }}
                      >
                        {t("topup.new_method") || "Choose new payment method"}
                      </motion.button>
                    </motion.div>
                  )}

                  {/* Standard Stripe checkout button (fallback or primary when no saved method) */}
                  {(!savedMethod || useNewMethod) && (
                  <motion.button
                    data-testid="topup-checkout-btn"
                    onClick={handleCheckout}
                    disabled={!selectedId || isCreating}
                    className="w-full py-4 bg-[#00C2FF] text-[#0A0A0A] font-bold text-base rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 mb-4"
                    whileTap={selectedId && !isCreating ? { scale: 0.98 } : {}}
                  >
                    {isCreating ? (
                      <>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                          <Loader2 size={18} />
                        </motion.div>
                        {t("topup.creating") || "Wird erstellt..."}
                      </>
                    ) : (
                      <>
                        <CreditCard size={18} />
                        {t("topup.pay_stripe") || "Mit Stripe bezahlen"}
                      </>
                    )}
                  </motion.button>
                  )}

                  {/* Save Card Button - when no card saved */}
                  {!savedMethod && !loadingSaved && (
                    <motion.button
                      data-testid="save-card-btn"
                      onClick={async () => {
                        try {
                          const res = await apiCall("/api/stripe/save-card", { method: "POST" });
                          if (res.checkout_url) window.location.href = res.checkout_url;
                        } catch (err) { console.error(err); }
                      }}
                      className="w-full py-3 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-2 mb-2"
                      style={{ background: "rgba(99,91,255,0.08)", border: "1px solid rgba(99,91,255,0.2)", color: "#635BFF" }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <CreditCard size={15} />
                      Karte speichern für 1-Click Zahlung
                    </motion.button>
                  )}

                  {/* Back to saved card link */}
                  {savedMethod && useNewMethod && (
                    <motion.button
                      data-testid="back-to-saved-btn"
                      onClick={() => setUseNewMethod(false)}
                      className="w-full mt-2 py-2 text-[11px] text-[#00C2FF] font-medium"
                      whileTap={{ scale: 0.98 }}
                    >
                      {t("topup.use_saved") || "Use saved card"} ({savedMethod.card_brand} ****{savedMethod.card_last4})
                    </motion.button>
                  )}

                  <div className="flex items-center justify-center gap-1.5 mt-3">
                    <Shield size={10} className="text-[#00D26A]/50" />
                    <span className="text-[10px] text-slate-500">Gesichert durch Stripe</span>
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
                  <p className="text-slate-900 font-medium">{t("topup.redirecting") || "Weiterleitung zu Stripe..."}</p>
                  <p className="text-sm text-slate-500 mt-1">{t("topup.redirect_msg") || "Du wirst zur sicheren Zahlung weitergeleitet"}</p>
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
                  <p className="text-slate-900 font-medium">{t("topup.verifying") || "Zahlung wird geprüft..."}</p>
                  <p className="text-sm text-slate-500 mt-1">{t("topup.verifying_msg") || "Bestätigung mit Stripe läuft"}</p>
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
                  <p className="text-slate-900 font-semibold text-lg mb-1">{t("topup.success_msg") || "Aufladung erfolgreich!"}</p>
                  <p className="text-3xl font-bold font-outfit text-[#00D26A] mb-2">
                    +&euro;{safeAmount(creditedAmount || pollResult.amount || 0).toFixed(2)}
                  </p>
                  {pollResult?.promotion && (
                    <motion.div
                      data-testid="topup-promo-badge"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-2"
                      style={{ background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.15)" }}
                    >
                      <span className="text-[11px] font-semibold text-[#FFB800]">
                        +&euro;{pollResult.promotion.bonus?.toFixed(2)} {t("promo.bonus")}
                      </span>
                      <span className="text-[9px] text-[#FFB800]/60">({pollResult.promotion.name})</span>
                    </motion.div>
                  )}
                  <p className="text-sm text-slate-500 mb-6">{t("topup.added") || "Dein Guthaben wurde via Stripe aufgeladen"}</p>
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
                  <p className="text-slate-900 font-semibold text-lg mb-1">{t("topup.failed_title") || "Zahlung fehlgeschlagen"}</p>
                  <p className="text-sm text-slate-500 mb-6">{error || t("topup.failed_msg") || "Die Zahlung konnte nicht bestätigt werden"}</p>
                  <div className="flex gap-3">
                    <motion.button
                      onClick={handleClose}
                      className="flex-1 py-3.5 bg-white text-slate-900 font-semibold rounded-full border border-slate-200"
                      whileTap={{ scale: 0.98 }}
                    >
                      {t("topup.cancel") || "Abbrechen"}
                    </motion.button>
                    <motion.button
                      onClick={() => { setStep("amount"); setError(null); }}
                      className="flex-1 py-3.5 bg-[#FF4757] text-white font-semibold rounded-full"
                      whileTap={{ scale: 0.98 }}
                    >
                      {t("topup.try_again") || "Erneut versuchen"}
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
