import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Zap, Check, X, Loader2, ShieldCheck, ArrowRight, AlertCircle } from "lucide-react";
import { useUser } from "../store";

const API = process.env.REACT_APP_BACKEND_URL;

export default function PayCheckoutPage({ sessionId, onNavigate }) {
  const user = useUser();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/pay/session/${sessionId}`)
      .then(r => r.json())
      .then(d => {
        if (d.session_id) setSession(d);
        else setError(d.detail || "Session nicht gefunden");
      })
      .catch(() => setError("Netzwerkfehler"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const doLogin = async () => {
    if (!email || !pw) { setError("Bitte E-Mail und Passwort eingeben"); return; }
    setAuthLoading(true); setError("");
    try {
      const r = await fetch(`${API}/api/auth/login`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Login fehlgeschlagen");
      window.location.reload();
    } catch (e) { setError(e.message); }
    setAuthLoading(false);
  };

  const confirmPay = async () => {
    setPaying(true); setError("");
    try {
      const r = await fetch(`${API}/api/pay/session/${sessionId}/confirm`, {
        method: "POST", credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Zahlung fehlgeschlagen");
      setPaid(true);
      setTimeout(() => {
        if (session?.success_url) window.top.location.href = session.success_url;
      }, 1500);
    } catch (e) { setError(e.message); }
    setPaying(false);
  };

  const cancelPay = async () => {
    try {
      const r = await fetch(`${API}/api/pay/session/${sessionId}/cancel`, {
        method: "POST", credentials: "include",
      });
      const d = await r.json();
      if (d.cancel_url) window.top.location.href = d.cancel_url;
      else if (onNavigate) onNavigate("/");
    } catch { /* noop */ }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#020408" }}>
      <Loader2 size={28} className="animate-spin text-[#00E89D]" />
    </div>
  );

  if (error && !session) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#020408" }}>
      <div className="max-w-sm w-full rounded-2xl p-6 text-center" style={{ background: "rgba(255,71,87,0.05)", border: "1px solid rgba(255,71,87,0.2)" }}>
        <AlertCircle size={40} className="mx-auto mb-3 text-[#FF4757]" />
        <p className="text-sm text-white/80">{error}</p>
      </div>
    </div>
  );

  const s = session;
  const balance = parseFloat(user.balance || 0);
  const insufficient = user.isAuthenticated && balance < s.amount;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#020408" }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(0,232,157,0.04) 0%, rgba(8,12,20,0.95) 100%)", border: "1px solid rgba(0,232,157,0.15)" }}
        data-testid="pay-checkout">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00E0FF] to-[#00E89D] flex items-center justify-center">
            <Zap size={14} className="text-[#020408]" />
          </div>
          <span className="text-sm font-black text-white/90">BidBlitz Pay</span>
          <ShieldCheck size={12} className="ml-auto text-[#00E89D]/60" />
          <span className="text-[9px] text-[#00E89D]/60 uppercase tracking-wider font-bold">Gesicherte Verbindung</span>
        </div>

        {/* Success */}
        {paid ? (
          <div className="px-6 py-12 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00E89D]/15 flex items-center justify-center">
              <Check size={28} className="text-[#00E89D]" />
            </motion.div>
            <h2 className="text-xl font-bold text-white/90 mb-1">Zahlung erfolgreich</h2>
            <p className="text-xs text-white/45">Du wirst weitergeleitet...</p>
          </div>
        ) : (
          <>
            {/* Amount */}
            <div className="px-6 py-5 text-center border-y border-white/[0.04]">
              <p className="text-[10px] uppercase tracking-wider text-white/35 font-bold mb-1">Zu zahlen an {s.merchant_name || "Händler"}</p>
              <p className="text-4xl font-black text-white/95 font-outfit">
                {s.amount.toFixed(2)} <span className="text-2xl text-white/40">{s.currency}</span>
              </p>
              {s.description && <p className="text-xs text-white/50 mt-1.5">{s.description}</p>}
              {s.order_id && <p className="text-[10px] text-white/30 font-mono mt-1">Bestellung: {s.order_id}</p>}
            </div>

            {/* Auth or Confirm */}
            <div className="px-6 py-5">
              {!user.isAuthenticated ? (
                <div className="space-y-3">
                  <p className="text-[11px] text-white/60 text-center mb-2">Melde dich an, um mit BidBlitz Wallet zu bezahlen</p>
                  <input type="email" placeholder="E-Mail" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-sm text-white/90 outline-none"
                    data-testid="pay-email" />
                  <input type="password" placeholder="Passwort" value={pw} onChange={e => setPw(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-sm text-white/90 outline-none"
                    data-testid="pay-password" />
                  {error && <p className="text-[11px] text-red-400 text-center">{error}</p>}
                  <motion.button whileTap={{ scale: 0.97 }} onClick={doLogin} disabled={authLoading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00E0FF] to-[#00E89D] text-[#020408] font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    data-testid="pay-login-btn">
                    {authLoading ? <Loader2 size={14} className="animate-spin" /> : <>Anmelden & Bezahlen <ArrowRight size={14} /></>}
                  </motion.button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: "rgba(0,232,157,0.04)", border: "1px solid rgba(0,232,157,0.1)" }}>
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Dein Wallet</p>
                      <p className="text-lg font-black text-[#00E89D]">€{balance.toFixed(2)}</p>
                    </div>
                    {insufficient ? (
                      <span className="text-[10px] px-2 py-1 rounded bg-red-500/15 text-red-400 font-bold">Unzureichend</span>
                    ) : (
                      <span className="text-[10px] px-2 py-1 rounded bg-[#00E89D]/15 text-[#00E89D] font-bold">Nach Zahlung: €{(balance - s.amount).toFixed(2)}</span>
                    )}
                  </div>
                  {error && <p className="text-[11px] text-red-400 text-center">{error}</p>}
                  <motion.button whileTap={{ scale: 0.97 }} onClick={confirmPay} disabled={paying || insufficient}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#00E0FF] to-[#00E89D] text-[#020408] font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                    data-testid="pay-confirm-btn">
                    {paying ? <Loader2 size={14} className="animate-spin" /> : <>Jetzt {s.amount.toFixed(2)} {s.currency} bezahlen</>}
                  </motion.button>
                  {insufficient && <p className="text-[10px] text-white/40 text-center">Lade dein Wallet auf, um fortzufahren</p>}
                </div>
              )}
              <button onClick={cancelPay} className="w-full mt-2 py-2 text-[11px] text-white/35 flex items-center justify-center gap-1" data-testid="pay-cancel-btn">
                <X size={11} /> Abbrechen
              </button>
            </div>
          </>
        )}

        <div className="px-6 py-3 text-center border-t border-white/[0.03]">
          <p className="text-[9px] text-white/20 flex items-center justify-center gap-1">
            <ShieldCheck size={9} /> Powered by BidBlitz · Sichere Wallet-Zahlung
          </p>
        </div>
      </motion.div>
    </div>
  );
}
