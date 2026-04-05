import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Loader2, Wallet, Shield, Clock, Zap,
  CreditCard, Smartphone, ChevronRight
} from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { api } from "../services/api";

const panelBg = "rgba(8,12,20,0.7)";
const panelBorder = "1px solid rgba(255,255,255,0.04)";
const API = process.env.REACT_APP_BACKEND_URL;

const PaymentPage = ({ onBack }) => {
  const { t } = useI18n();
  const [barcode, setBarcode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [feeInfo, setFeeInfo] = useState(null);
  const timerRef = useRef(null);

  const loadBarcode = useCallback(async () => {
    try {
      const res = await api.getMyBarcode();
      setBarcode(res);
      setSecondsLeft(res.seconds_remaining || 0);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadBarcode(); api.getFeeInfo().then(setFeeInfo).catch(() => {}); }, [loadBarcode]);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft > 0) {
      timerRef.current = setInterval(() => {
        setSecondsLeft(p => {
          if (p <= 1) { clearInterval(timerRef.current); loadBarcode(); return 0; }
          return p - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [secondsLeft, loadBarcode]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await api.refreshBarcode();
      setBarcode(p => ({ ...p, ...res }));
      setSecondsLeft(res.seconds_remaining || 0);
    } catch {}
    setRefreshing(false);
  };

  const openBuyCredits = async (pkgId) => {
    try {
      const origin = window.location.origin;
      const res = await fetch(`${API}/api/stripe/checkout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package_id: pkgId, origin_url: origin }),
      });
      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch {}
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#040610" }}><Loader2 size={24} className="text-white/20 animate-spin" /></div>;

  const pct = barcode ? Math.max(0, (secondsLeft / 120) * 100) : 0;

  return (
    <motion.div data-testid="payment-page" className="min-h-screen pb-24" style={{ background: "#040610" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl" style={{ background: "rgba(4,6,16,0.85)", borderBottom: panelBorder }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <motion.button data-testid="payment-back" onClick={onBack} whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
            <ArrowLeft size={15} className="text-white/40" />
          </motion.button>
          <div className="flex-1">
            <h1 className="text-[15px] font-bold text-white/90 font-outfit">{t("pay.title") || "Pay"}</h1>
            <p className="text-[9px] text-white/25">{t("pay.subtitle") || "Show barcode to pay"}</p>
          </div>
          <Wallet size={18} className="text-[#00E0FF]/30" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">

        {/* Balance */}
        <motion.div className="rounded-2xl p-4 backdrop-blur-xl text-center" style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[9px] text-[#555] uppercase tracking-widest font-semibold">{t("pay.wallet_balance") || "Wallet Balance"}</p>
          <p className="text-[32px] font-black text-[#00E0FF] font-mono mt-1">{(barcode?.balance || 0).toFixed(2)}</p>
          <p className="text-[9px] text-white/20">EUR</p>
        </motion.div>

        {/* Barcode */}
        {barcode && (
          <motion.div className="rounded-2xl p-5 backdrop-blur-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,224,255,0.08)" }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            {/* Barcode display */}
            <div className="text-center mb-3">
              <p className="text-[9px] text-white/25 mb-2">{t("pay.your_code") || "Your Payment Code"}</p>
              <div data-testid="barcode-display" className="bg-white rounded-xl p-4 mx-auto max-w-[200px]">
                {/* Barcode visual representation */}
                <div className="flex items-center justify-center gap-[2px] mb-2">
                  {barcode.barcode.split("").map((c, i) => (
                    <div key={i} className="bg-black" style={{ width: (c.charCodeAt(0) % 3) + 1, height: 48 }} />
                  ))}
                </div>
                <p className="text-[14px] font-mono font-black text-black tracking-widest">{barcode.barcode}</p>
              </div>
            </div>

            {/* Timer */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Clock size={11} className="text-white/20" />
                <span className="text-[10px] text-white/30">{t("pay.expires_in") || "Expires in"}</span>
              </div>
              <span className={`text-[12px] font-bold font-mono ${secondsLeft < 30 ? "text-[#FF6B6B]" : "text-[#00E89D]"}`}>
                {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, "0")}
              </span>
            </div>
            <div className="h-1 rounded-full bg-white/[0.03] overflow-hidden">
              <motion.div className="h-full rounded-full" style={{ background: secondsLeft < 30 ? "#FF6B6B" : "#00E89D" }}
                animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
            </div>

            {/* Refresh button */}
            <motion.button data-testid="refresh-barcode-btn" onClick={refresh} disabled={refreshing} whileTap={{ scale: 0.95 }}
              className="w-full mt-3 py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5"
              style={{ background: "rgba(0,224,255,0.06)", border: "1px solid rgba(0,224,255,0.1)", color: "#00E0FF" }}>
              {refreshing ? <Loader2 size={12} className="animate-spin" /> : <><RefreshCw size={11} /> {t("pay.refresh") || "Refresh Code"}</>}
            </motion.button>
          </motion.div>
        )}

        {/* Buy Credits */}
        <motion.div className="rounded-2xl p-4 backdrop-blur-xl" style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold">{t("pay.topup") || "Top Up Wallet"}</p>
            <CreditCard size={14} className="text-white/15" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[10, 25, 50, 100, 250, 500].map(amt => (
              <motion.button key={amt} data-testid={`topup-${amt}`} onClick={() => openBuyCredits(String(amt))} whileTap={{ scale: 0.95 }}
                className="py-3 rounded-xl text-center" style={{ background: "rgba(0,232,157,0.04)", border: "1px solid rgba(0,232,157,0.08)" }}>
                <p className="text-[14px] font-black text-[#00E89D] font-mono">{amt}</p>
                <p className="text-[7px] text-white/15">EUR</p>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Payment Methods Info */}
        <motion.div className="rounded-2xl p-4 backdrop-blur-xl" style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-3">{t("pay.methods") || "Payment Methods"}</p>
          <div className="space-y-2">
            {[
              { icon: Smartphone, label: "NFC Wallet", fee: "0.3%", color: "#00E89D", desc: t("pay.nfc_wallet_desc") || "Tap & pay with wallet — lowest fees" },
              { icon: Zap, label: "QR / Barcode", fee: "0.5%", color: "#00E0FF", desc: t("pay.barcode_desc") || "Show code to merchant" },
              { icon: CreditCard, label: "NFC Card", fee: "2.5%", color: "#FFB800", desc: t("pay.nfc_card_desc") || "Tap card at terminal" },
            ].map((m, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.03)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${m.color}08` }}>
                  <m.icon size={14} style={{ color: m.color }} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-white/70">{m.label}</p>
                  <p className="text-[8px] text-white/20">{m.desc}</p>
                </div>
                <span className="text-[10px] font-bold font-mono" style={{ color: m.color }}>{m.fee}</span>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
};

export default PaymentPage;
