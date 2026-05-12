/**
 * Staff Mobile — Wallet (Bonus + Trinkgeld)
 * ==========================================
 * Übersichts-Card mit Balance, Bonus/Tips Aufschlüsselung,
 * letzte Bewegungen, Button "Wallet öffnen".
 */
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wallet, Euro, Gift, Coins, TrendingUp, ArrowDownLeft, Loader2, Clock, ChevronRight } from "lucide-react";
import { EmptyState } from "./StaffShifts";

const API = process.env.REACT_APP_BACKEND_URL;

export default function StaffWalletTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/api/staff/wallet/me/balance`, { credentials: "include" });
        if (r.ok) setData(await r.json());
      } catch (e) {}
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="py-20 flex justify-center"><Loader2 size={22} className="animate-spin text-[#10B981]" /></div>;
  }

  const events = data?.events || [];
  const bonus = events.filter((e) => e.type === "bonus" || e.kind === "bonus").reduce((a, e) => a + (e.amount_eur || e.amount || 0), 0);
  const tips = events.filter((e) => e.type === "tip" || e.kind === "tip").reduce((a, e) => a + (e.amount_eur || e.amount || 0), 0);
  const last = events[0];

  return (
    <div data-testid="staff-wallet-tab" className="px-5 pt-6 pb-2 space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-widest text-white/40">Wallet</p>
        <h2 className="text-2xl font-bold mt-1 font-outfit">Dein Guthaben</h2>
      </div>

      {/* Hero Balance */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-6 border border-[#10B981]/30"
        style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(6,182,212,0.10) 100%)" }}
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#10B981]/30 blur-3xl pointer-events-none" />
        <div className="relative">
          <p className="text-[10px] uppercase tracking-widest text-white/50">Gesamtguthaben</p>
          <p data-testid="staff-wallet-balance" className="text-4xl font-bold tabular-nums mt-1">
            <span className="text-white/50 text-2xl mr-1">€</span>
            {(data?.balance_eur ?? 0).toFixed(2)}
          </p>
          <p className="text-[11px] text-white/50 mt-1">{events.length} Buchung(en) im Verlauf</p>
        </div>
      </motion.div>

      {/* Split */}
      <div className="grid grid-cols-2 gap-3">
        <SplitCard testId="wallet-bonus" icon={Gift} color="#A855F7" label="Bonus" value={`€${bonus.toFixed(2)}`} />
        <SplitCard testId="wallet-tips"  icon={Coins} color="#F59E0B" label="Trinkgeld" value={`€${tips.toFixed(2)}`} />
      </div>

      {/* Last Payout / Movement */}
      {last && (
        <div data-testid="wallet-last-movement" className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Letzte Bewegung</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#00D4FF]/15 text-[#00D4FF]">
              <ArrowDownLeft size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{last.reason || last.note || "Buchung"}</p>
              <p className="text-[11px] text-white/40 flex items-center gap-1 mt-0.5">
                <Clock size={10} />
                {last.created_at ? new Date(last.created_at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }) : ""}
              </p>
            </div>
            <p className="text-sm font-bold text-[#10B981]">+€{(last.amount_eur ?? last.amount ?? 0).toFixed(2)}</p>
          </div>
        </div>
      )}

      {!last && (
        <EmptyState icon={Wallet} title="Noch keine Bewegungen" sub="Bonus und Trinkgeld erscheinen hier sobald gebucht." />
      )}

      {/* Recent list */}
      {events.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Verlauf</p>
          <div className="space-y-2">
            {events.slice(0, 8).map((e, i) => (
              <div key={e.id || i} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.04]">
                  {(e.type || e.kind) === "tip" ? <Coins size={14} className="text-[#F59E0B]" /> : <Gift size={14} className="text-[#A855F7]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{e.reason || e.note || (e.type || e.kind || "Buchung")}</p>
                  <p className="text-[10px] text-white/40">{e.created_at ? new Date(e.created_at).toLocaleDateString("de-DE") : ""}</p>
                </div>
                <p className="text-xs font-bold text-[#10B981]">+€{(e.amount_eur ?? e.amount ?? 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        data-testid="wallet-open-full"
        className="w-full py-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.10] text-sm font-semibold text-white/80 flex items-center justify-center gap-2 hover:bg-white/[0.07] transition-colors"
      >
        Wallet öffnen <ChevronRight size={14} />
      </button>
    </div>
  );
}

function SplitCard({ icon: Icon, color, label, value, testId }) {
  return (
    <div data-testid={testId} className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: `${color}1F`, color }}>
          <Icon size={14} />
        </div>
        <p className="text-[10px] uppercase tracking-widest text-white/40">{label}</p>
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}
