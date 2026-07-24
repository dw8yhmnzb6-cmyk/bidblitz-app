import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Loader2, Wallet, Shield, Clock, Zap,
  CreditCard, Smartphone, ArrowUpRight, QrCode
} from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { api } from "../services/api";

const panelBg = "rgba(8,12,20,0.7)";
const panelBorder = "1px solid rgba(255,255,255,0.04)";
const API = process.env.REACT_APP_BACKEND_URL;

const PaymentPage = ({ onBack, onNavigate }) => {
  const { t, lang } = useI18n();
  const locale = lang === "sq-XK" ? "sq" : lang === "en-US" ? "en" : lang === "ar-AE" ? "ar" : lang;
  const L = {
    de: { checkoutOnly: "Nur für Händler & Kasse", showOnlyAtCheckout: "Diesen Code nur an der Kasse zeigen", merchantScans: "Der Händler scannt deinen Code, gibt den Betrag ein und belastet deine Wallet direkt.", sendMoney: "Geld senden", notForCheckout: "Nicht für Kasse", topupWallet: "Wallet aufladen", onlineOrCheckout: "Online oder an Kasse", checkoutFlow: "Kassen-Flow", openPay: "1. Bezahlen öffnen", showCode: "2. Code zeigen", done: "3. Fertig", openPayDesc: "Du öffnest diesen Screen direkt aus dem Wallet.", showCodeDesc: "Der Händler scannt deinen Code an der Kasse.", doneDesc: "Die Bestätigung erscheint sofort. Für private Transfers bitte 'Geld senden' nutzen." },
    en: { checkoutOnly: "For merchant checkout only", showOnlyAtCheckout: "Show this code only at checkout", merchantScans: "The merchant scans your code, enters the amount and charges your wallet directly.", sendMoney: "Send money", notForCheckout: "Not for checkout", topupWallet: "Top up wallet", onlineOrCheckout: "Online or at checkout", checkoutFlow: "Checkout flow", openPay: "1. Open Pay", showCode: "2. Show code", done: "3. Done", openPayDesc: "Open this screen directly from the wallet.", showCodeDesc: "The merchant scans your code at checkout.", doneDesc: "Confirmation appears instantly. For private transfers, please use 'Send money'." },
    sq: { checkoutOnly: "Vetëm për tregtarin dhe arkën", showOnlyAtCheckout: "Shfaq këtë kod vetëm në arkë", merchantScans: "Tregtari skanon kodin tënd, vendos shumën dhe e ngarkon direkt nga wallet-i yt.", sendMoney: "Dërgo para", notForCheckout: "Jo për arkë", topupWallet: "Mbush wallet-in", onlineOrCheckout: "Online ose në arkë", checkoutFlow: "Rrjedha e arkës", openPay: "1. Hap Paguaj", showCode: "2. Shfaq kodin", done: "3. U krye", openPayDesc: "E hap këtë ekran direkt nga wallet-i.", showCodeDesc: "Tregtari skanon kodin tënd në arkë.", doneDesc: "Konfirmimi shfaqet menjëherë. Për transfere private, përdor 'Dërgo para'." },
    ar: { checkoutOnly: "للتاجر ونقطة الدفع فقط", showOnlyAtCheckout: "اعرض هذا الرمز عند نقطة الدفع فقط", merchantScans: "يقوم التاجر بمسح رمزك وإدخال المبلغ وخصمه مباشرة من محفظتك.", sendMoney: "إرسال المال", notForCheckout: "ليس لنقطة الدفع", topupWallet: "شحن المحفظة", onlineOrCheckout: "عبر الإنترنت أو عند نقطة الدفع", checkoutFlow: "مسار نقطة الدفع", openPay: "1. افتح الدفع", showCode: "2. اعرض الرمز", done: "3. تم", openPayDesc: "تفتح هذه الشاشة مباشرة من المحفظة.", showCodeDesc: "يقوم التاجر بمسح رمزك عند نقطة الدفع.", doneDesc: "يظهر التأكيد فورًا. للتحويلات الخاصة استخدم 'إرسال المال'." },
  }[locale];
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
    } catch (error) {
      void error;
    }
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
    } catch (error) {
      void error;
    }
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
    } catch (error) {
      void error;
    }
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
            <p className="text-[9px] text-white/35">{t("pay.subtitle") || "Show barcode to pay"}</p>
          </div>
          <Wallet size={18} className="text-[#00E0FF]/30" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">

        <motion.div className="rounded-2xl p-4 backdrop-blur-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,224,255,0.08)" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "rgba(0,224,255,0.08)", border: "1px solid rgba(0,224,255,0.12)" }}>
              <QrCode size={18} className="text-[#00E0FF]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#00E0FF]">{L.checkoutOnly}</p>
              <h2 className="mt-1 text-[20px] leading-tight font-bold text-white">{L.showOnlyAtCheckout}</h2>
              <p className="mt-2 text-[12px] leading-relaxed text-white/60">{L.merchantScans}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <motion.button data-testid="payment-send-action" onClick={() => onNavigate?.('/wallet?action=send')} whileTap={{ scale: 0.98 }} className="min-h-[48px] rounded-2xl px-4 py-3 text-left" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="block text-[13px] font-bold text-white">{L.sendMoney}</span>
              <span className="mt-1 block text-[10px] text-white/55">{L.notForCheckout}</span>
            </motion.button>
            <motion.button data-testid="payment-topup-action" onClick={() => onNavigate?.('/wallet?action=topup')} whileTap={{ scale: 0.98 }} className="min-h-[48px] rounded-2xl px-4 py-3 text-left" style={{ background: "rgba(0,224,255,0.08)", border: "1px solid rgba(0,224,255,0.14)" }}>
              <span className="block text-[13px] font-bold text-[#00E0FF]">{L.topupWallet}</span>
              <span className="mt-1 block text-[10px] text-[#00E0FF]/65">{L.onlineOrCheckout}</span>
            </motion.button>
          </div>
        </motion.div>

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

        {/* Payment Flow Info */}
        <motion.div className="rounded-2xl p-4 backdrop-blur-xl" style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-3">{L.checkoutFlow}</p>
          <div className="space-y-2">
            {[
              { icon: Zap, label: L.openPay, fee: "Wallet", color: "#00E89D", desc: L.openPayDesc },
              { icon: QrCode, label: L.showCode, fee: "QR / Barcode", color: "#00E0FF", desc: L.showCodeDesc },
              { icon: ArrowUpRight, label: L.done, fee: "Direkt", color: "#FFB800", desc: L.doneDesc },
            ].map((m, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.03)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${m.color}08` }}>
                  <m.icon size={14} style={{ color: m.color }} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-white/70">{m.label}</p>
                  <p className="text-[8px] text-white/30">{m.desc}</p>
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
