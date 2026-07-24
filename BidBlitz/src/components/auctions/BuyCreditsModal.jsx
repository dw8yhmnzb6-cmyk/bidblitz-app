import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, X, Zap, Loader2, Coins, Check, CreditCard, Wallet,
  Gift, AlertTriangle, Shield, Lock,
} from "lucide-react";
import { useI18n } from "../../store";
import { api } from "../../services/api";
import { glass, panelBorder, PKGS, accentCyan, accentGreen } from "./atoms";

/**
 * BuyCreditsModal — 3-step flow: select package → confirm + pay method → success.
 * Supports wallet / saved card / Stripe Checkout redirect.
 * Emits onPurchased(result) with latest balance + credits.
 */
export default function BuyCreditsModal({ open, onClose, onPurchased, balance: propBalance }) {
  const { t } = useI18n();
  const [step, setStep] = useState("select");
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [payMethod, setPayMethod] = useState("wallet");
  const [savedCard, setSavedCard] = useState(null);
  const [, setLoadingCard] = useState(false);
  const [msg, setMsg] = useState(null);
  const [isFirstPurchase, setIsFirstPurchase] = useState(false);
  const [liveBalance, setLiveBalance] = useState(propBalance);

  useEffect(() => {
    if (!open) { setStep("select"); setSelectedPkg(null); setMsg(null); return; }
    setLoadingCard(true);
    setLiveBalance(propBalance);
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/wallet/balance`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.balance !== undefined) setLiveBalance(d.balance); })
      .catch(() => {});
    api.getAuctionSavedMethod()
      .then(d => { if (d.has_saved_method) { setSavedCard(d); setPayMethod("card"); } else { setSavedCard(null); setPayMethod("wallet"); } })
      .catch(() => setSavedCard(null))
      .finally(() => setLoadingCard(false));
    api.checkFirstPurchase().then(d => setIsFirstPurchase(d.is_first_purchase)).catch(() => {});
  }, [open, propBalance]);

  const balance = liveBalance;
  const selectPkg = (p) => { setSelectedPkg(p); setMsg(null); setStep("confirm"); };

  const confirmPay = async () => {
    if (!selectedPkg) return;
    setStep("processing");
    setMsg(null);
    try {
      let r;
      if (payMethod === "card" && savedCard) {
        r = await api.buyBidCreditsDirect({ package_id: selectedPkg.id });
      } else if (payMethod === "stripe") {
        r = await api.buyBidCreditsStripe({ package_id: selectedPkg.id });
        if (r.checkout_url) { window.location.href = r.checkout_url; return; }
      } else {
        if (balance < selectedPkg.price) { setMsg({ ok: false, text: t("checkout.insufficient_wallet") }); setStep("confirm"); return; }
        r = await api.buyBidCredits({ package_id: selectedPkg.id });
      }
      setStep("success");
      setTimeout(() => { onPurchased(r); onClose(); setStep("select"); setSelectedPkg(null); setMsg(null); }, 1200);
    } catch (e) {
      setMsg({ ok: false, text: e.message });
      setStep("confirm");
      if (e.message?.includes("declined") || e.message?.includes("No saved")) {
        setSavedCard(null); setPayMethod("wallet");
      }
    }
  };

  if (!open) return null;

  return (
    <motion.div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={step === "processing" ? undefined : onClose} />
      <motion.div className={`relative w-full max-w-md mx-4 mb-4 sm:mb-0 rounded-2xl overflow-hidden ${glass}`}
        style={{ background: "rgba(8,12,20,0.95)", border: panelBorder }}
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", damping: 22 }}>

        <AnimatePresence mode="wait">
          {step === "select" && (
            <motion.div key="select" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-2">
                <h3 className="text-[14px] font-bold text-white/90 font-outfit">{t("auction.buy_credits")}</h3>
                <motion.button data-testid="credits-modal-close" onClick={onClose} whileTap={{ scale: 0.9 }} className="w-8 h-8 rounded-full bg-white/[0.03] flex items-center justify-center"><X size={13} className="text-white/40" /></motion.button>
              </div>
              <p className="px-5 text-[10px] text-[#444] mb-3">{t("auction.wallet_balance")}: <span className="text-white/60 font-semibold">{balance.toFixed(2)}</span></p>
              {isFirstPurchase && (
                <motion.div className="mx-5 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: "rgba(0,232,157,0.04)", border: "1px solid rgba(0,232,157,0.1)" }}
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                  <Gift size={12} className="text-[#00E89D]" />
                  <span className="text-[9px] font-bold text-[#00E89D]">{t("lowcredits.bonus_credits")}</span>
                </motion.div>
              )}
              <div className="grid grid-cols-2 gap-2 px-5 pb-5">
                {PKGS.map(p => (
                  <motion.button key={p.id} data-testid={`credit-pkg-${p.id}`} onClick={() => selectPkg(p)}
                    className={`relative rounded-xl p-3 text-left ${glass}`}
                    style={{ background: p.best ? "rgba(0,224,255,0.02)" : "rgba(255,255,255,0.015)", border: p.best ? "1px solid rgba(0,224,255,0.08)" : panelBorder }}
                    whileTap={{ scale: 0.97 }} whileHover={{ borderColor: "rgba(0,224,255,0.12)" }}>
                    <div className="flex items-center gap-1.5 mb-1"><Coins size={11} className="text-[#FFD166]" /><span className="text-[15px] font-bold text-white/90">{p.credits}</span></div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[#555] font-medium">{p.price.toFixed(2)}</span>
                      <span className="text-[8px] text-[#444]">{p.ppc.toFixed(2)}{t("discount.per_credit")}</span>
                    </div>
                    {p.discount && (
                      <span className={`absolute top-1.5 right-1.5 text-[7px] font-bold px-1.5 py-0.5 rounded-full ${p.best ? "bg-[#00E0FF]/10 text-[#00E0FF] border border-[#00E0FF]/15" : "bg-[#00E89D]/8 text-[#00E89D] border border-[#00E89D]/15"}`}>
                        {p.best ? t("discount.best_value") : `-${p.discount}%`}
                      </span>
                    )}
                    {isFirstPurchase && <span className="absolute bottom-1.5 right-1.5 text-[7px] font-bold text-[#00E89D]/60">+5</span>}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {step === "confirm" && selectedPkg && (
            <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <div className="flex items-center gap-2 px-5 pt-5 pb-3">
                <motion.button data-testid="checkout-back-btn" onClick={() => { setStep("select"); setMsg(null); }} whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 rounded-full bg-white/[0.03] flex items-center justify-center"><ArrowLeft size={13} className="text-white/40" /></motion.button>
                <h3 className="text-[14px] font-bold text-white/90 font-outfit">{t("checkout.confirm_title")}</h3>
              </div>

              <div className="mx-5 mb-4 rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.015)", border: panelBorder }}>
                <p className="text-[9px] text-[#555] uppercase tracking-widest font-semibold mb-2.5">{t("checkout.summary")}</p>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,209,102,0.06)", border: "1px solid rgba(255,209,102,0.1)" }}>
                      <Coins size={13} className="text-[#FFD166]" />
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-white/85">{selectedPkg.credits}x {t("checkout.credits")}{isFirstPurchase ? " + 5 Bonus" : ""}</p>
                      {selectedPkg.discount && <span className="text-[8px] text-[#00E89D] font-bold">-{selectedPkg.discount}% {t("discount.cheaper")}</span>}
                    </div>
                  </div>
                  <p className="text-[14px] font-bold text-white/90 font-mono">{selectedPkg.price.toFixed(2)}</p>
                </div>
                <div className="border-t border-white/[0.04] pt-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-white/60">{t("checkout.total")}</span>
                  <span className="text-[16px] font-black text-[#00E0FF] font-mono" style={{ textShadow: "0 0 8px rgba(0,224,255,0.12)" }}>{selectedPkg.price.toFixed(2)}</span>
                </div>
              </div>

              <div className="mx-5 mb-4">
                <p className="text-[9px] text-[#555] uppercase tracking-widest font-semibold mb-2">{t("checkout.select_method")}</p>
                <div className="space-y-2">
                  {savedCard && (
                    <motion.button data-testid="pay-method-card" onClick={() => setPayMethod("card")}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${payMethod === "card" ? "bg-[#00E0FF]/[0.04] border border-[#00E0FF]/15" : "bg-white/[0.01] border border-white/[0.04]"}`}
                      whileTap={{ scale: 0.98 }}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${payMethod === "card" ? "bg-[#00E0FF]/8 border border-[#00E0FF]/12" : "bg-white/[0.02] border border-white/[0.04]"}`}>
                        <CreditCard size={14} className={payMethod === "card" ? "text-[#00E0FF]" : "text-white/20"} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className={`text-[11px] font-semibold ${payMethod === "card" ? "text-white/85" : "text-white/40"}`}>{savedCard.card_brand.charAt(0).toUpperCase() + savedCard.card_brand.slice(1)} ****{savedCard.card_last4}</p>
                        <p className="text-[9px] text-[#444]">{t("checkout.card_charged")}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${payMethod === "card" ? "border-[#00E0FF]" : "border-white/10"}`}>
                        {payMethod === "card" && <div className="w-2 h-2 rounded-full bg-[#00E0FF]" />}
                      </div>
                    </motion.button>
                  )}

                  <motion.button data-testid="pay-method-wallet" onClick={() => setPayMethod("wallet")}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${payMethod === "wallet" ? "bg-[#00E89D]/[0.04] border border-[#00E89D]/15" : "bg-white/[0.01] border border-white/[0.04]"}`}
                    whileTap={{ scale: 0.98 }}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${payMethod === "wallet" ? "bg-[#00E89D]/8 border border-[#00E89D]/12" : "bg-white/[0.02] border border-white/[0.04]"}`}>
                      <Wallet size={14} className={payMethod === "wallet" ? "text-[#00E89D]" : "text-white/20"} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={`text-[11px] font-semibold ${payMethod === "wallet" ? "text-white/85" : "text-white/40"}`}>{t("checkout.wallet")}</p>
                      <p className="text-[9px] text-[#444]">€{balance.toFixed(2)} — {balance >= selectedPkg.price ? t("checkout.wallet_deducted") : t("checkout.insufficient_wallet")}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${payMethod === "wallet" ? "border-[#00E89D]" : "border-white/10"}`}>
                      {payMethod === "wallet" && <div className="w-2 h-2 rounded-full bg-[#00E89D]" />}
                    </div>
                  </motion.button>

                  <motion.button data-testid="pay-method-stripe" onClick={() => setPayMethod("stripe")}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${payMethod === "stripe" ? "bg-[#635BFF]/[0.06] border border-[#635BFF]/20" : "bg-white/[0.01] border border-white/[0.04]"}`}
                    whileTap={{ scale: 0.98 }}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${payMethod === "stripe" ? "bg-[#635BFF]/10 border border-[#635BFF]/15" : "bg-white/[0.02] border border-white/[0.04]"}`}>
                      <CreditCard size={14} className={payMethod === "stripe" ? "text-[#635BFF]" : "text-white/20"} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={`text-[11px] font-semibold ${payMethod === "stripe" ? "text-white/85" : "text-white/40"}`}>Kreditkarte / Debitkarte</p>
                      <p className="text-[9px] text-[#444]">Sicher via Stripe bezahlen</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${payMethod === "stripe" ? "border-[#635BFF]" : "border-white/10"}`}>
                      {payMethod === "stripe" && <div className="w-2 h-2 rounded-full bg-[#635BFF]" />}
                    </div>
                  </motion.button>
                </div>
              </div>

              <AnimatePresence>{msg && !msg.ok && (
                <motion.div className="mx-5 mb-3 px-3 py-2 rounded-xl flex items-center gap-2" style={{ background: "rgba(255,64,96,0.05)", border: "1px solid rgba(255,64,96,0.1)" }}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <AlertTriangle size={11} className="text-[#FF4060] flex-shrink-0" />
                  <p className="text-[10px] text-[#FF4060] font-medium">{msg.text}</p>
                </motion.div>
              )}</AnimatePresence>

              <div className="px-5 pb-4">
                <motion.button data-testid="checkout-pay-btn" onClick={confirmPay}
                  disabled={payMethod === "wallet" && balance < selectedPkg.price}
                  className="w-full py-3.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 disabled:opacity-30"
                  style={{
                    background: payMethod === "stripe" ? "rgba(99,91,255,0.1)" : payMethod === "card" ? "rgba(0,224,255,0.1)" : "rgba(0,232,157,0.1)",
                    border: `1px solid ${payMethod === "stripe" ? "rgba(99,91,255,0.25)" : payMethod === "card" ? "rgba(0,224,255,0.2)" : "rgba(0,232,157,0.2)"}`,
                    color: payMethod === "stripe" ? "#635BFF" : payMethod === "card" ? accentCyan : accentGreen,
                  }}
                  whileTap={{ scale: 0.97 }}>
                  <Zap size={14} />
                  {t("checkout.pay_now")} {selectedPkg.price.toFixed(2)}
                </motion.button>

                <div className="flex items-center justify-center gap-1.5 mt-3">
                  <Shield size={10} className="text-[#00E89D]/40" />
                  <span className="text-[9px] text-[#333] font-medium">{t("checkout.secure")}</span>
                  <span className="text-[7px] text-[#222]">|</span>
                  <Lock size={9} className="text-[#333]/40" />
                  <span className="text-[9px] text-[#333] font-medium">Stripe</span>
                </div>
              </div>
            </motion.div>
          )}

          {step === "processing" && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 text-center">
              <motion.div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ background: "rgba(0,224,255,0.06)", border: "1px solid rgba(0,224,255,0.1)" }}
                animate={{ boxShadow: ["0 0 0px rgba(0,224,255,0)", "0 0 25px rgba(0,224,255,0.1)", "0 0 0px rgba(0,224,255,0)"] }}
                transition={{ duration: 1.5, repeat: Infinity }}>
                <Loader2 size={22} className="text-[#00E0FF] animate-spin" />
              </motion.div>
              <p className="text-[13px] text-white/70 font-semibold">{t("checkout.processing")}</p>
            </motion.div>
          )}

          {step === "success" && selectedPkg && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-8 text-center">
              <motion.div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
                style={{ background: "rgba(0,232,157,0.08)", border: "1px solid rgba(0,232,157,0.15)" }}
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}>
                <Check size={22} className="text-[#00E89D]" />
              </motion.div>
              <p className="text-[14px] font-bold text-white/90 mb-1">{t("checkout.success")}</p>
              <p className="text-[22px] font-black text-[#00E89D] font-mono mb-1">+{selectedPkg.credits}</p>
              <p className="text-[10px] text-[#444]">{t("checkout.added_credits")}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
