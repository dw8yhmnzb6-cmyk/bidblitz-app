/**
 * BidBlitz V2 - Admin Credit Management Page
 * Approve/Reject credit applications
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Check, X, Loader2, CreditCard, AlertCircle,
  Clock, CheckCircle, XCircle, Euro, User, Calendar
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const AdminCreditPage = ({ onBack }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [tab, setTab] = useState("pending");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/credit/admin/pending`, { credentials: "include" });
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = async (creditId, action) => {
    setDeciding(creditId);
    try {
      const res = await fetch(`${API}/api/credit/admin/decide`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credit_id: creditId, action, reason: rejectReason }),
      });
      if (res.ok) {
        setRejectReason("");
        load();
      } else {
        const d = await res.json();
        alert(d.detail || "Fehler");
      }
    } catch { alert("Fehler"); }
    setDeciding(null);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-[#00C2FF]" />
    </div>
  );

  const list = tab === "pending" ? (data?.pending || []) : tab === "active" ? (data?.active || []) : (data?.all || []);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="admin-credit-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
              className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="admin-credit-back">
              <ArrowLeft size={18} />
            </motion.button>
            <div>
              <h1 className="text-[15px] font-bold">Kreditverwaltung</h1>
              <p className="text-[10px] text-gray-500">Anträge genehmigen & verwalten</p>
            </div>
          </div>
          {data?.stats && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-yellow-500/10 text-[10px] text-yellow-400 font-semibold">
              <Clock size={10} /> {data.stats.pending_count} offen
            </div>
          )}
        </div>

        {/* Stats */}
        {data?.stats && (
          <div className="flex gap-2 mt-3">
            <div className="flex-1 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-center">
              <p className="text-lg font-bold text-yellow-400">{data.stats.pending_count}</p>
              <p className="text-[9px] text-gray-500">Offen</p>
            </div>
            <div className="flex-1 p-3 rounded-xl bg-green-500/5 border border-green-500/20 text-center">
              <p className="text-lg font-bold text-green-400">{data.stats.active_count}</p>
              <p className="text-[9px] text-gray-500">Aktiv</p>
            </div>
            <div className="flex-1 p-3 rounded-xl bg-[#00C2FF]/5 border border-[#00C2FF]/20 text-center">
              <p className="text-lg font-bold text-[#00C2FF]">€{(data.stats.total_active_debt || 0).toFixed(0)}</p>
              <p className="text-[9px] text-gray-500">Gesamtschuld</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mt-3">
          {[
            { id: "pending", label: "Offene Anträge", count: data?.stats?.pending_count },
            { id: "active", label: "Aktive Kredite", count: data?.stats?.active_count },
            { id: "all", label: "Alle" },
          ].map(t => (
            <motion.button key={t.id} whileTap={{ scale: 0.95 }} onClick={() => setTab(t.id)}
              className={`px-3 py-2 rounded-xl text-[11px] font-medium flex items-center gap-1 ${
                tab === t.id ? "bg-[#00C2FF] text-black" : "bg-white/5 text-[#888]"
              }`} data-testid={`credit-tab-${t.id}`}>
              {t.label} {t.count > 0 && <span className="px-1.5 py-0.5 rounded bg-black/20 text-[9px]">{t.count}</span>}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {list.length === 0 ? (
          <div className="text-center py-16">
            <CreditCard size={48} className="mx-auto text-[#333] mb-4" />
            <p className="text-white/70 font-semibold">Keine {tab === "pending" ? "offenen Anträge" : "Kredite"}</p>
          </div>
        ) : list.map((c, i) => (
          <motion.div key={c.credit_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className={`rounded-2xl border p-4 ${
              c.status === "pending" ? "bg-yellow-500/5 border-yellow-500/20" :
              c.status === "active" ? "bg-green-500/5 border-green-500/20" :
              c.status === "paid" ? "bg-[#00C2FF]/5 border-[#00C2FF]/20" :
              "bg-red-500/5 border-red-500/20"
            }`} data-testid={`credit-${c.credit_id}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <User size={14} className="text-gray-400" />
                <span className="text-xs font-semibold">{c.user_name || c.user_email || c.user_id?.slice(0, 8)}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                c.status === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                c.status === "active" ? "bg-green-500/20 text-green-400" :
                c.status === "paid" ? "bg-[#00C2FF]/20 text-[#00C2FF]" :
                "bg-red-500/20 text-red-400"
              }`}>{c.status}</span>
            </div>

            {/* Amount */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-xl font-bold">€{c.amount?.toFixed(2)}</p>
              <div className="text-right text-[10px] text-gray-500">
                <p>{c.term_months} Monate · {(c.interest_rate * 100).toFixed(1)}%</p>
                <p>Rate: €{c.monthly_rate?.toFixed(2)}/Monat</p>
              </div>
            </div>

            {c.status === "active" && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                  <span>Restschuld: €{c.remaining_amount?.toFixed(2)}</span>
                  <span>Gesamt: €{c.total_repayment?.toFixed(2)}</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${Math.max(2, 100 - (c.remaining_amount / c.total_repayment * 100))}%` }} />
                </div>
              </div>
            )}

            <p className="text-[9px] text-gray-600">
              {c.created_at ? new Date(c.created_at).toLocaleString("de-DE") : ""}
              {c.approved_at && ` · Genehmigt: ${new Date(c.approved_at).toLocaleString("de-DE")}`}
            </p>

            {/* Action Buttons */}
            {c.status === "pending" && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => decide(c.credit_id, "approve")}
                    disabled={deciding === c.credit_id}
                    className="flex-1 py-3 rounded-xl bg-green-500 text-black font-bold text-xs flex items-center justify-center gap-1 disabled:opacity-50"
                    data-testid={`approve-${c.credit_id}`}>
                    {deciding === c.credit_id ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle size={14} /> Genehmigen</>}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => {
                    const reason = prompt("Ablehnungsgrund (optional):");
                    if (reason !== null) { setRejectReason(reason); decide(c.credit_id, "reject"); }
                  }}
                    disabled={deciding === c.credit_id}
                    className="flex-1 py-3 rounded-xl bg-red-500/10 text-red-400 font-bold text-xs flex items-center justify-center gap-1 border border-red-500/20 disabled:opacity-50"
                    data-testid={`reject-${c.credit_id}`}>
                    <XCircle size={14} /> Ablehnen
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AdminCreditPage;
