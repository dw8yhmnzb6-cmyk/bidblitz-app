import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Wifi, Shield, XCircle, Loader2, Smartphone, Clock, ChevronDown, Settings } from "lucide-react";
import { useWallet } from "../store";

const API = process.env.REACT_APP_BACKEND_URL;

/* NFC Contactless Waves SVG — like the real ))) symbol */
const NFCWaves = ({ size = 28, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
    <path d="M7 17.5c3-3 3-8 0-11" opacity="0.5" />
    <path d="M11 19.5c5-5 5-14 0-19" opacity="0.7" />
    <path d="M15 17.5c3-3 3-8 0-11" opacity="0.9" />
  </svg>
);

/* Animated phone-to-terminal icon like Apple Pay center */
const PhoneNFCIcon = () => (
  <div className="relative w-20 h-20 mx-auto" data-testid="nfc-phone-icon">
    {/* Pulsing outer ring */}
    <motion.div
      animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      className="absolute inset-0 rounded-full"
      style={{ border: "2px solid #38BDF8" }}
    />
    {/* Inner ring */}
    <motion.div
      animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.1, 0.6] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      className="absolute inset-2 rounded-full"
      style={{ border: "2px solid #38BDF8" }}
    />
    {/* Phone icon center */}
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-10 h-14 rounded-xl border-2 border-sky-400/80 relative flex items-center justify-center bg-sky-400/5">
        <div className="w-4 h-0.5 rounded-full bg-sky-400/40 absolute bottom-1.5" />
        <Smartphone size={18} className="text-sky-400/70" />
      </div>
    </div>
  </div>
);

export default function BlitzPayPage({ onBack }) {
  const wallet = useWallet();
  const [tokenData, setTokenData] = useState(null);
  const [history, setHistory] = useState([]);
  const [view, setView] = useState("main"); // main | history | settings
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [nfcActive, setNfcActive] = useState(false);
  const [pin, setPin] = useState("");
  const [selectedCard, setSelectedCard] = useState(0);

  const loadData = useCallback(() => {
    fetch(`${API}/api/blitzpay/my-token`, { credentials: "include" }).then(r => r.json()).then(d => {
      setTokenData(d);
      if (d.has_token) setNfcActive(true);
    }).catch(() => {});
    fetch(`${API}/api/blitzpay/history`, { credentials: "include" }).then(r => r.json()).then(d => setHistory(d.transactions || [])).catch(() => {});
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const generateToken = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/blitzpay/generate-token`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const d = await r.json();
      if (r.ok) {
        setTokenData({ has_token: true, token: d.nfc_token, total_payments: 0, total_spent: 0 });
        setNfcActive(true);
        setMsg(d.message);
        setView("main");
      } else setMsg(d.detail || "Fehler");
    } catch { setMsg("Netzwerkfehler"); }
    setLoading(false);
    setTimeout(() => setMsg(""), 4000);
  };

  const deactivate = async () => {
    if (!window.confirm("NFC-Token wirklich deaktivieren?")) return;
    try {
      const r = await fetch(`${API}/api/blitzpay/deactivate`, { method: "POST", credentials: "include" });
      const d = await r.json();
      if (r.ok) { setTokenData({ has_token: false }); setNfcActive(false); setMsg(d.message); }
    } catch {}
    setTimeout(() => setMsg(""), 3000);
  };

  const lastFour = wallet.cardNumber ? wallet.cardNumber.replace(/\s/g, "").slice(-4) : "0000";
  const balance = wallet.balance ?? 0;

  // Card designs for the carousel
  const cards = [
    {
      id: "blitzpay",
      name: "BidBlitz",
      type: "BLITZPAY",
      last4: lastFour,
      gradient: "linear-gradient(135deg, #0F766E 0%, #0EA5E9 40%, #BAE6FD 100%)",
      textColor: "#fff",
      active: true,
    },
    {
      id: "wallet",
      name: "BidBlitz Wallet",
      type: "DEBIT",
      last4: lastFour,
      gradient: "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)",
      textColor: "#C7D2FE",
      active: false,
    },
  ];

  const activeCard = cards[selectedCard] || cards[0];

  // ─── HISTORY VIEW ───
  if (view === "history") {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="blitzpay-history">
        <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("main")} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center" data-testid="history-back-btn">
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-base font-semibold">Zahlungsverlauf</h1>
          </div>
        </div>
        <div className="px-4 space-y-2 pt-2">
          {history.length === 0 && (
            <div className="text-center py-16">
              <Clock size={40} className="mx-auto mb-3 text-gray-600" />
              <p className="text-gray-500 text-sm">Noch keine NFC-Zahlungen</p>
            </div>
          )}
          {history.map((tx, i) => (
            <motion.div key={tx.tx_id || i}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
              data-testid={`history-item-${i}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/10 flex items-center justify-center">
                  <Wifi size={18} className="text-sky-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{tx.description || "NFC Kontaktlos"}</p>
                  <p className="text-[11px] text-gray-500">{new Date(tx.created_at).toLocaleString("de-DE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
              <p className="text-sm font-bold text-red-400">-{tx.amount?.toFixed(2)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // ─── SETTINGS VIEW (generate / deactivate) ───
  if (view === "settings") {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="blitzpay-settings">
        <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("main")} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center" data-testid="settings-back-btn">
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-base font-semibold">NFC-Einstellungen</h1>
          </div>
        </div>
        <div className="px-4 pt-6 space-y-5">
          {tokenData?.has_token ? (
            <>
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Aktiver Token</span>
                  <span className="text-sm font-mono font-bold text-sky-400">{tokenData.token}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Zahlungen</span>
                  <span className="text-sm font-bold">{tokenData.total_payments}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Ausgegeben</span>
                  <span className="text-sm font-bold">{tokenData.total_spent?.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-500/5 border border-green-500/10">
                <Shield size={20} className="text-green-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-green-400">256-bit verschluesselt</p>
                  <p className="text-[10px] text-gray-500">Sofort deaktivierbar bei Verlust</p>
                </div>
              </div>
              <button onClick={deactivate}
                className="w-full py-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 font-semibold text-sm flex items-center justify-center gap-2"
                data-testid="nfc-deactivate-btn">
                <XCircle size={18} /> Token deaktivieren
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-6">
                <Smartphone size={48} className="mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400 text-sm font-medium">Kein NFC-Token aktiv</p>
                <p className="text-[11px] text-gray-600 mt-1">Erstelle einen Token um kontaktlos zu bezahlen</p>
              </div>
              <input value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN setzen (optional)" type="password"
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-sm outline-none focus:border-sky-500/40 placeholder:text-gray-600"
                data-testid="nfc-pin-input" />
              <button onClick={generateToken} disabled={loading}
                className="w-full py-4 bg-sky-500 rounded-2xl font-bold text-white disabled:opacity-50 text-sm"
                data-testid="nfc-generate-btn">
                {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : "NFC-Token generieren"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── MAIN NFC TAP VIEW (Apple Pay Style) ───
  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-[#0A0A0F] text-gray-900 dark:text-white pb-24 flex flex-col" data-testid="blitzpay-page">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center" data-testid="blitzpay-back-btn">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setView("history")} className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center" data-testid="blitzpay-history-btn">
            <Clock size={17} />
          </button>
          <button onClick={() => setView("settings")} className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center" data-testid="blitzpay-settings-btn">
            <Settings size={17} />
          </button>
        </div>
      </div>

      {/* Spacer to push content to center-top */}
      <div className="flex-1 flex flex-col items-center justify-start px-5 pt-4">

        {/* ─── CREDIT CARD ─── */}
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[380px] aspect-[1.6/1] rounded-2xl p-5 relative overflow-hidden shadow-2xl"
          style={{ background: activeCard.gradient }}
          data-testid="nfc-card"
        >
          {/* Decorative polygonal shapes like NLB card */}
          <div className="absolute inset-0 opacity-15">
            <svg viewBox="0 0 400 250" className="w-full h-full">
              <polygon points="0,0 200,0 150,120 0,80" fill="white" opacity="0.3" />
              <polygon points="150,0 400,0 400,100 200,130" fill="white" opacity="0.15" />
              <polygon points="0,80 150,120 100,250 0,250" fill="white" opacity="0.2" />
              <polygon points="200,130 400,100 400,250 100,250" fill="white" opacity="0.08" />
            </svg>
          </div>

          {/* Card content */}
          <div className="relative z-10 h-full flex flex-col justify-between">
            {/* Top: brand + NFC waves */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <span className="text-white font-black text-xs">BB</span>
                </div>
                <span className="text-white font-bold text-sm tracking-wide">{activeCard.name}</span>
              </div>
              {/* NFC contactless symbol ))) */}
              <div className="mt-1">
                <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
                  <path d="M18 4C22.4183 4 26 7.58172 26 12C26 16.4183 22.4183 20 18 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
                  <path d="M18 8C20.2091 8 22 9.79086 22 12C22 14.2091 20.2091 16 18 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
                  <path d="M18 11C18.5523 11 19 11.4477 19 12C19 12.5523 18.5523 13 18 13" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
                </svg>
              </div>
            </div>

            {/* Bottom: card number + type */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-white/50 text-[10px] font-medium tracking-wider mb-0.5">GUTHABEN</p>
                <p className="text-white font-bold text-lg">{balance.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-white/40 text-[10px] tracking-[0.2em]">.... {lastFour}</p>
                <p className="text-white font-black text-xl tracking-wider mt-0.5">{activeCard.type}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ─── NFC TAP ZONE ─── */}
        <AnimatePresence mode="wait">
          {nfcActive && tokenData?.has_token ? (
            <motion.div
              key="nfc-active"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="mt-10 text-center"
              data-testid="nfc-tap-zone"
            >
              <PhoneNFCIcon />
              <motion.p
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                className="mt-5 text-lg font-medium text-gray-600 dark:text-gray-300"
              >
                An das Lesegeraet halten
              </motion.p>
              <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1.5">
                {tokenData.total_payments > 0
                  ? `${tokenData.total_payments} Zahlungen · ${tokenData.total_spent?.toFixed(2)} ausgegeben`
                  : "Bereit fuer kontaktlose Zahlung"
                }
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="nfc-inactive"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="mt-10 text-center"
              data-testid="nfc-setup-zone"
            >
              <div className="w-20 h-20 mx-auto rounded-full bg-gray-200/50 dark:bg-white/5 flex items-center justify-center">
                <Smartphone size={32} className="text-gray-400 dark:text-gray-600" />
              </div>
              <p className="mt-4 text-base font-medium text-gray-500 dark:text-gray-400">NFC nicht aktiviert</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1">Gehe zu Einstellungen um einen Token zu erstellen</p>
              <button
                onClick={() => setView("settings")}
                className="mt-5 px-8 py-3 bg-sky-500 text-white font-semibold text-sm rounded-full shadow-lg shadow-sky-500/20"
                data-testid="nfc-activate-btn"
              >
                NFC aktivieren
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── CARD CAROUSEL BOTTOM ─── */}
      <div className="px-5 pb-4">
        <div className="flex gap-3 justify-center">
          {cards.map((c, i) => (
            <motion.button
              key={c.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCard(i)}
              className={`relative h-12 rounded-xl overflow-hidden transition-all duration-300 ${
                i === selectedCard ? "w-20 ring-2 ring-sky-400/60 shadow-lg" : "w-16 opacity-50"
              }`}
              style={{ background: c.gradient }}
              data-testid={`card-select-${c.id}`}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white/80 text-[8px] font-bold tracking-wider">{c.type}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ─── MESSAGE TOAST ─── */}
      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-24 left-4 right-4 p-3.5 bg-sky-500/90 backdrop-blur-xl rounded-2xl text-white text-sm text-center font-medium z-50 shadow-xl"
            data-testid="nfc-toast"
          >
            {msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
