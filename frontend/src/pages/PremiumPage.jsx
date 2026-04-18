/**
 * PremiumPage - BidBlitz Premium Abo kaufen / verwalten
 * Backend: /api/premium/status, /api/premium/purchase, /api/premium/cancel (revenue2.py)
 */
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Crown, Check, Loader2, Sparkles, Zap, Shield,
  TrendingUp, Gift, Award
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const BENEFITS = [
  { icon: Zap, color: "#FFD700", title: "2× Mining Rate", desc: "Doppelte BLZ pro Tap & Session" },
  { icon: Shield, color: "#00D26A", title: "0 € Gebühren", desc: "Keine Gebühren auf Auktions-Deals" },
  { icon: Gift, color: "#EC4899", title: "50 BLZ Bonus", desc: "Jeden Monat automatisch aufs Wallet" },
  { icon: TrendingUp, color: "#00C2FF", title: "5 % Cashback", desc: "Auf alle Marketplace-Käufe zurück" },
  { icon: Award, color: "#A855F7", title: "Premium Badge", desc: "Exklusives Profil-Abzeichen" },
  { icon: Sparkles, color: "#F59E0B", title: "Priority Support", desc: "Direkter Draht zum Team" },
];

export default function PremiumPage({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [method, setMethod] = useState("eur");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/premium/status`, { credentials: "include" });
      const j = await r.json();
      setData(j);
    } catch {
      toast.error("Fehler beim Laden");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const purchase = async () => {
    setPurchasing(true);
    try {
      const r = await fetch(`${API}/api/premium/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ payment_method: method }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "Fehler");
      toast.success(`Premium aktiviert bis ${new Date(j.expires_at).toLocaleDateString("de-DE")} — +${j.bonus_blz} BLZ!`);
      await load();
    } catch (e) {
      toast.error(e.message || "Kauf fehlgeschlagen");
    }
    setPurchasing(false);
  };

  const cancel = async () => {
    if (!window.confirm("Premium wirklich kündigen? (läuft bis Enddatum weiter)")) return;
    try {
      const r = await fetch(`${API}/api/premium/cancel`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error();
      toast.success("Kündigung bestätigt");
      await load();
    } catch { toast.error("Fehler bei Kündigung"); }
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <Loader2 size={22} className="animate-spin text-white/40" />
      </div>
    );
  }

  const isActive = data.active;
  const sub = data.subscription;

  return (
    <div data-testid="premium-page" className="min-h-screen pb-24"
      style={{ background: "radial-gradient(circle at 50% 0%, rgba(255,184,0,0.18), transparent 50%), #050505" }}>
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#050505]/90 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3">
          <motion.button onClick={onBack} data-testid="premium-back"
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
            whileTap={{ scale: 0.92 }}>
            <ArrowLeft size={15} className="text-white/70" />
          </motion.button>
          <h1 className="text-[14px] font-bold text-white">BidBlitz Premium</h1>
          <div className="w-9" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        <motion.div
          className="rounded-3xl p-6 text-center relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#FFD700 0%,#FFB800 40%,#FF8C42 100%)" }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        >
          <Crown size={48} className="mx-auto text-black mb-2" strokeWidth={2.5} />
          <p className="text-[10px] font-black text-black/70 uppercase tracking-[0.2em]">
            {isActive ? "Du bist Premium" : "Upgrade"}
          </p>
          <p className="text-[32px] font-black text-black leading-none mt-1 font-outfit">
            {isActive ? "Aktiv ✓" : "Premium"}
          </p>
          {isActive && sub?.expires_at && (
            <p className="text-[12px] text-black/80 mt-2">
              Gültig bis {new Date(sub.expires_at).toLocaleDateString("de-DE")}
            </p>
          )}
          {!isActive && (
            <p className="text-[13px] text-black/80 mt-2 font-semibold">
              Ab {data.price_eur} € / Monat oder {data.price_blz} BLZ
            </p>
          )}
        </motion.div>

        <div className="grid grid-cols-2 gap-2">
          {BENEFITS.map((b, i) => {
            const Icon = b.icon;
            return (
              <motion.div
                key={i}
                className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                data-testid={`premium-benefit-${i}`}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2"
                  style={{ background: `${b.color}20`, border: `1px solid ${b.color}40` }}>
                  <Icon size={15} color={b.color} />
                </div>
                <p className="text-[12px] font-bold text-white leading-tight">{b.title}</p>
                <p className="text-[10px] text-white/55 mt-0.5 leading-tight">{b.desc}</p>
              </motion.div>
            );
          })}
        </div>

        {!isActive && (
          <>
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
              <p className="text-[11px] font-bold text-white/60 uppercase tracking-wider mb-3">
                Zahlungsmethode
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "eur", label: `${data.price_eur} €`, sub: "Wallet EUR" },
                  { id: "blz", label: `${data.price_blz} BLZ`, sub: "Mine-Credits" },
                ].map((m) => (
                  <motion.button
                    key={m.id}
                    data-testid={`premium-method-${m.id}`}
                    onClick={() => setMethod(m.id)}
                    className="py-3 rounded-xl border transition-all"
                    style={{
                      background: method === m.id ? "rgba(255,184,0,0.15)" : "rgba(255,255,255,0.02)",
                      borderColor: method === m.id ? "#FFB800" : "rgba(255,255,255,0.08)",
                    }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <p className={`text-[15px] font-black ${method === m.id ? "text-[#FFB800]" : "text-white"}`}>
                      {m.label}
                    </p>
                    <p className="text-[9px] text-white/50 mt-0.5">{m.sub}</p>
                    {method === m.id && (
                      <Check size={12} className="inline-block text-[#FFB800] mt-1" />
                    )}
                  </motion.button>
                ))}
              </div>
            </div>

            <motion.button
              data-testid="premium-purchase-btn"
              onClick={purchase}
              disabled={purchasing}
              className="w-full py-4 rounded-2xl font-black text-[14px] text-black flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#FFD700,#FFB800)" }}
              whileTap={{ scale: 0.97 }}
            >
              {purchasing ? <Loader2 size={16} className="animate-spin" /> : <Crown size={16} />}
              {purchasing ? "Wird aktiviert..." : "Jetzt Premium holen"}
            </motion.button>

            <p className="text-[10px] text-white/40 text-center px-4">
              30 Tage Laufzeit · Jederzeit kündbar · Keine automatische Verlängerung
            </p>
          </>
        )}

        {isActive && (
          <>
            <motion.button
              data-testid="premium-renew-btn"
              onClick={purchase}
              disabled={purchasing}
              className="w-full py-4 rounded-2xl font-black text-[14px] text-black flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#FFD700,#FFB800)" }}
              whileTap={{ scale: 0.97 }}
            >
              {purchasing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {purchasing ? "..." : "Um 30 Tage verlängern"}
            </motion.button>
            <button
              data-testid="premium-cancel-btn"
              onClick={cancel}
              className="w-full py-3 rounded-xl text-[12px] text-white/50 hover:text-white/80 transition-colors"
            >
              Auto-Verlängerung kündigen
            </button>
          </>
        )}
      </div>
    </div>
  );
}
