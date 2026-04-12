/**
 * BidBlitz V2 - Vendor Payouts Page
 */

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CreditCard, Loader2, Euro, Clock, Check, AlertCircle, Plus } from "lucide-react";
import { getVendorPayouts, requestPayout, getVendorDashboard } from "../api";
import { useI18n } from "../../../store/I18nContext";

const STATUS_CFG = {
  pending: { label: "Ausstehend", color: "#FFB800" },
  processing: { label: "In Bearbeitung", color: "#00C2FF" },
  completed: { label: "Ausgezahlt", color: "#00D26A" },
  failed: { label: "Fehlgeschlagen", color: "#FF4757" },
};

export default function VendorPayoutsPage({ onBack }) {
  const { t } = useI18n();
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [showRequest, setShowRequest] = useState(false);
  const [amount, setAmount] = useState("");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [payoutsData, dashData] = await Promise.all([
        getVendorPayouts(),
        getVendorDashboard()
      ]);
      setPayouts(payoutsData.payouts || []);
      setBalance(dashData.pending_payout || 0);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleRequest = async () => {
    setRequesting(true);
    try {
      await requestPayout(parseFloat(amount));
      setShowRequest(false);
      setAmount("");
      load();
    } catch (err) { alert(err.message); }
    setRequesting(false);
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("de-DE") : "";

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
              className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="vendor-payouts-back">
              <ArrowLeft size={20} />
            </motion.button>
            <div>
              <h1 className="text-lg font-bold">Auszahlungen</h1>
              <p className="text-xs text-[#666]">Verfügbar: €{balance.toFixed(2)}</p>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowRequest(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00C2FF] text-black text-sm font-medium"
            data-testid="request-payout-btn">
            <Euro size={16} /> Auszahlen
          </motion.button>
        </div>
      </div>

      {/* Balance Card */}
      <div className="p-4">
        <div className="bg-gradient-to-br from-[#00C2FF]/15 to-[#00C2FF]/5 rounded-2xl p-5 border border-[#00C2FF]/20 mb-4">
          <p className="text-sm text-[#888] mb-1">Verfügbares Guthaben</p>
          <p className="text-3xl font-bold text-[#00C2FF]">€{balance.toFixed(2)}</p>
        </div>
      </div>

      <div className="px-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#00C2FF]" /></div>
        ) : payouts.length === 0 ? (
          <div className="text-center py-16">
            <CreditCard size={48} className="mx-auto text-[#333] mb-4" />
            <p className="text-white/70">Keine Auszahlungen</p>
          </div>
        ) : payouts.map((p, idx) => {
          const st = STATUS_CFG[p.status] || STATUS_CFG.pending;
          return (
            <motion.div key={p.payout_id} initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
              className="bg-[#111118] rounded-2xl p-4 border border-white/5 flex items-center justify-between"
              data-testid={`payout-${p.payout_id}`}>
              <div>
                <p className="font-semibold">€{p.amount?.toFixed(2)}</p>
                <p className="text-xs text-[#666]">{fmtDate(p.created_at)}</p>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-xs font-medium"
                style={{ background: `${st.color}15`, color: st.color }}>{st.label}</span>
            </motion.div>
          );
        })}
      </div>

      {/* Request Payout Modal */}
      {showRequest && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowRequest(false)}>
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }}
            onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-[#111118] rounded-t-3xl p-6">
            <h3 className="text-lg font-bold mb-4">Auszahlung anfordern</h3>
            <p className="text-sm text-[#888] mb-4">Verfügbar: <span className="text-[#00C2FF] font-bold">€{balance.toFixed(2)}</span></p>
            <div className="mb-6">
              <label className="text-xs text-[#666] mb-1 block">Betrag (€)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                max={balance} step="0.01" placeholder="0.00"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-lg font-bold outline-none"
                data-testid="payout-amount-input" />
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleRequest}
              disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > balance || requesting}
              className="w-full py-4 rounded-xl bg-[#00C2FF] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="confirm-payout-btn">
              {requesting ? <Loader2 size={20} className="animate-spin" /> : <><Euro size={20} /> Auszahlung anfordern</>}
            </motion.button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
