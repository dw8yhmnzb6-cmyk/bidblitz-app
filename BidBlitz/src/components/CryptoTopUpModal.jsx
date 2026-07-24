import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bitcoin, ArrowRight, Loader2, Shield, Zap, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const QUICK_AMOUNTS = [10, 25, 50, 100, 250, 500];

/**
 * Coinbase Commerce Crypto Top-Up Modal
 * User enters EUR amount → redirects to Coinbase hosted checkout
 * → user pays with BTC/ETH/USDC → webhook credits wallet.
 */
export const CryptoTopUpModal = ({ isOpen, onClose }) => {
  const [amount, setAmount] = useState("50");
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    fetch(`${API}/api/coinbase/status`)
      .then((r) => r.json())
      .then((d) => setConfigured(!!d.configured))
      .catch(() => setConfigured(false));
  }, [isOpen]);

  const handleCheckout = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error("Bitte gültigen Betrag eingeben");
      return;
    }
    if (amt < 2) {
      toast.error("Mindestbetrag: 2,00 €");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/coinbase/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: amt, description: "BidBlitz Wallet Aufladung" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Checkout fehlgeschlagen");
      if (data.hosted_url) {
        toast.success("Weiterleitung zu Coinbase…", { duration: 2000 });
        window.location.href = data.hosted_url;
      }
    } catch (err) {
      toast.error(err.message || "Konnte Krypto-Zahlung nicht starten");
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          data-testid="crypto-topup-modal"
          className="fixed inset-0 z-[80]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="absolute inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:max-w-[420px]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
          >
            <div className="bg-[#0A0A0A] rounded-t-[32px] sm:rounded-[32px] overflow-hidden border border-white/[0.08]">
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg,#F7931A,#FFB800)" }}
                  >
                    <Bitcoin size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-white">Mit Krypto aufladen</h2>
                    <p className="text-[11px] text-white/50">BTC • ETH • USDC • DAI</p>
                  </div>
                </div>
                <motion.button
                  data-testid="crypto-close-btn"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={15} className="text-white/60" />
                </motion.button>
              </div>

              {/* Not configured warning */}
              {!configured && (
                <div className="mx-5 mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-[12px] text-red-300 font-medium">
                    Coinbase Commerce ist noch nicht aktiviert. Der Admin muss erst die API Keys
                    konfigurieren.
                  </p>
                </div>
              )}

              {/* Amount */}
              <div className="px-5 pb-5">
                <p className="text-[11px] text-white/50 uppercase tracking-wider font-semibold mb-2">
                  Betrag in EUR
                </p>
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-4">
                  <div className="flex items-baseline gap-2 justify-center">
                    <span className="text-[28px] text-white/40 font-light">€</span>
                    <input
                      data-testid="crypto-amount-input"
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      min="2"
                      step="1"
                      className="w-40 bg-transparent text-center text-[44px] font-bold font-outfit text-white outline-none tabular-nums"
                      style={{ WebkitTextFillColor: "#fff" }}
                    />
                  </div>
                </div>

                {/* Quick amounts */}
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {QUICK_AMOUNTS.map((a) => (
                    <motion.button
                      key={a}
                      data-testid={`crypto-quick-${a}`}
                      onClick={() => setAmount(String(a))}
                      className={`py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
                        parseFloat(amount) === a
                          ? "bg-[#00C2FF]/15 border border-[#00C2FF]/40 text-[#00C2FF]"
                          : "bg-white/[0.03] border border-white/[0.06] text-white/70"
                      }`}
                      whileTap={{ scale: 0.95 }}
                    >
                      €{a}
                    </motion.button>
                  ))}
                </div>

                {/* Benefits */}
                <div className="space-y-2 mb-5">
                  {[
                    { icon: Zap, text: "Schnelle Bestätigung (~10 Min)" },
                    { icon: Shield, text: "Keine Chargebacks, irreversibel" },
                    { icon: CheckCircle2, text: "Nur 1 % Fee (statt 2,9 % bei Karten)" },
                  ].map((b, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-[12px] text-white/60">
                      <b.icon size={13} className="text-[#00D26A]" />
                      {b.text}
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <motion.button
                  data-testid="crypto-checkout-btn"
                  onClick={handleCheckout}
                  disabled={loading || !configured}
                  className="w-full py-[14px] rounded-2xl font-semibold text-[14px] flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{
                    background: "linear-gradient(135deg,#F7931A,#FFB800)",
                    color: "#000",
                    boxShadow: "0 8px 32px rgba(247,147,26,0.3)",
                  }}
                  whileTap={loading ? {} : { scale: 0.97 }}
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      Mit Krypto bezahlen <ArrowRight size={16} />
                    </>
                  )}
                </motion.button>

                <p className="text-[10px] text-white/30 text-center mt-3">
                  Powered by Coinbase Commerce • Zahlungen sind final
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CryptoTopUpModal;
