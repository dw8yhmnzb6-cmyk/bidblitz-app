import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Wifi, Shield, CreditCard, History, XCircle, Loader2, Smartphone } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function BlitzPayPage({ onBack }) {
  const [tokenData, setTokenData] = useState(null);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState("pay");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [showNFC, setShowNFC] = useState(false);
  const [pin, setPin] = useState("");

  useEffect(() => {
    fetch(`${API}/api/blitzpay/my-token`, { credentials: "include" }).then(r => r.json()).then(d => setTokenData(d)).catch(() => {});
    fetch(`${API}/api/blitzpay/history`, { credentials: "include" }).then(r => r.json()).then(d => setHistory(d.transactions || [])).catch(() => {});
  }, []);

  const generateToken = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/blitzpay/generate-token`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const d = await r.json();
      if (r.ok) { setTokenData({ has_token: true, token: d.nfc_token, total_payments: 0, total_spent: 0 }); setMsg(d.message); setShowNFC(true); }
      else setMsg(d.detail || "Fehler");
    } catch { setMsg("Netzwerkfehler"); }
    setLoading(false);
    setTimeout(() => setMsg(""), 4000);
  };

  const deactivate = async () => {
    if (!window.confirm("NFC-Token wirklich deaktivieren?")) return;
    try {
      const r = await fetch(`${API}/api/blitzpay/deactivate`, { method: "POST", credentials: "include" });
      const d = await r.json();
      if (r.ok) { setTokenData({ has_token: false }); setMsg(d.message); }
    } catch {}
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="blitzpay-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
          <div className="flex-1">
            <h1 className="text-base font-bold flex items-center gap-2"><Wifi size={18} className="text-cyan-400" /> BlitzPay NFC</h1>
            <p className="text-[10px] text-cyan-400">Kontaktlos bezahlen</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {[{ id: "pay", label: "Bezahlen" }, { id: "history", label: "Verlauf" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold ${tab === t.id ? "bg-cyan-500 text-black" : "bg-white/5 text-gray-400"}`}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {tab === "pay" && (
          <div className="space-y-4">
            {/* NFC Card Visualization */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-3xl p-6"
              style={{ background: "linear-gradient(135deg, #0891B2 0%, #0E7490 30%, #155E75 100%)" }}
            >
              {/* Animated NFC waves */}
              <div className="absolute -right-4 -top-4 opacity-20">
                <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.1, 0.3] }} transition={{ duration: 2, repeat: Infinity }}
                  className="w-32 h-32 rounded-full border-2 border-white" />
                <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.05, 0.2] }} transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                  className="w-40 h-40 rounded-full border border-white absolute -top-4 -left-4" />
              </div>

              <div className="flex items-center gap-2 mb-6">
                <Wifi size={20} className="text-white/80" />
                <span className="text-xs font-bold text-white/60 tracking-widest">BLITZPAY NFC</span>
              </div>

              {tokenData?.has_token ? (
                <>
                  <p className="text-2xl font-mono font-bold text-white tracking-[0.15em] mb-1">{tokenData.token}</p>
                  <p className="text-[10px] text-white/40">Halte dein Handy ans Terminal</p>
                  <div className="flex items-center justify-between mt-6">
                    <div>
                      <p className="text-[9px] text-white/40">Zahlungen</p>
                      <p className="text-lg font-bold">{tokenData.total_payments}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-white/40">Gesamt ausgegeben</p>
                      <p className="text-lg font-bold">€{tokenData.total_spent?.toFixed(2)}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <Smartphone size={40} className="mx-auto mb-3 text-white/40" />
                  <p className="text-sm text-white/60">Kein NFC-Token aktiv</p>
                  <p className="text-[10px] text-white/30">Generiere einen Token um kontaktlos zu bezahlen</p>
                </div>
              )}
            </motion.div>

            {/* NFC Animation when active */}
            {tokenData?.has_token && showNFC && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-8 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 text-center"
              >
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute inset-0 rounded-full border-2 border-cyan-500/30" />
                  <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.7, 0.1, 0.7] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                    className="absolute inset-2 rounded-full border-2 border-cyan-500/50" />
                  <div className="absolute inset-4 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <Wifi size={32} className="text-cyan-400" />
                  </div>
                </div>
                <p className="text-cyan-400 font-bold text-sm animate-pulse">Bereit zum Bezahlen</p>
                <p className="text-[10px] text-gray-500 mt-1">Halte dein Handy ans Kassenterminal</p>
              </motion.div>
            )}

            {/* Actions */}
            {!tokenData?.has_token ? (
              <div className="space-y-3">
                <input value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN setzen (optional)" type="password"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-cyan-500/30" />
                <button onClick={generateToken} disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-xl font-bold text-black disabled:opacity-50" data-testid="nfc-generate-btn">
                  {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : "NFC-Token generieren"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button onClick={() => setShowNFC(!showNFC)}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-xl font-bold text-black">
                  {showNFC ? "NFC-Modus schließen" : "NFC-Zahlung aktivieren"}
                </button>
                <button onClick={deactivate}
                  className="w-full py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 font-medium text-sm flex items-center justify-center gap-2">
                  <XCircle size={16} /> Token deaktivieren (bei Verlust)
                </button>
              </div>
            )}

            {/* How it works */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <p className="text-xs font-bold text-gray-400 mb-3">So funktioniert BlitzPay NFC:</p>
              <div className="space-y-3">
                {[
                  { step: "1", title: "Token generieren", desc: "Einmalig in der App erstellen" },
                  { step: "2", title: "Handy ans Terminal", desc: "NFC-fähiges Gerät an die Kasse halten" },
                  { step: "3", title: "Sofort bezahlt", desc: "Betrag wird vom Wallet abgezogen" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs font-bold text-cyan-400 shrink-0">{s.step}</div>
                    <div>
                      <p className="text-xs font-bold">{s.title}</p>
                      <p className="text-[10px] text-gray-500">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Info */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/5 border border-green-500/10">
              <Shield size={18} className="text-green-400 shrink-0" />
              <div>
                <p className="text-[11px] font-bold text-green-400">Sicher & verschlüsselt</p>
                <p className="text-[9px] text-gray-500">256-bit Verschlüsselung · Sofort deaktivierbar · PIN-Schutz optional</p>
              </div>
            </div>
          </div>
        )}

        {/* HISTORY */}
        {tab === "history" && (
          <div className="space-y-2">
            {history.length === 0 && <p className="text-center text-gray-600 py-8">Noch keine NFC-Zahlungen</p>}
            {history.map((tx, i) => (
              <motion.div key={tx.tx_id || i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center"><Wifi size={16} className="text-cyan-400" /></div>
                  <div>
                    <p className="text-sm font-bold">{tx.description || "NFC-Zahlung"}</p>
                    <p className="text-[10px] text-gray-500">{new Date(tx.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-red-400">-€{tx.amount?.toFixed(2)}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
