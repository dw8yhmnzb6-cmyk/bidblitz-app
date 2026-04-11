/**
 * BidBlitz V2 - Vendor Invoices Page
 */

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, Loader2, Euro, Check, Clock, AlertCircle } from "lucide-react";
import { getVendorInvoices, markInvoicePaid } from "../api";

const STATUS_CFG = {
  draft: { label: "Entwurf", color: "#888" },
  sent: { label: "Gesendet", color: "#FFB800" },
  paid: { label: "Bezahlt", color: "#00D26A" },
  overdue: { label: "Überfällig", color: "#FF4757" },
  cancelled: { label: "Storniert", color: "#666" },
};

export default function VendorInvoicesPage({ onBack }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(null);

  useEffect(() => { load(); }, [filter]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getVendorInvoices(filter);
      setInvoices(data.invoices || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleMarkPaid = async (invoiceId) => {
    try {
      await markInvoicePaid(invoiceId);
      load();
    } catch (err) { alert(err.message); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("de-DE") : "";

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 p-4">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
            className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="vendor-invoices-back">
            <ArrowLeft size={20} />
          </motion.button>
          <div>
            <h1 className="text-lg font-bold">Rechnungen</h1>
            <p className="text-xs text-[#666]">{invoices.length} Rechnungen</p>
          </div>
        </div>
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {[{ id: null, label: "Alle" }, { id: "sent", label: "Offen" }, { id: "paid", label: "Bezahlt" }].map(t => (
            <motion.button key={t.id || "all"} whileTap={{ scale: 0.95 }}
              onClick={() => setFilter(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${filter === t.id ? "bg-[#00C2FF] text-black" : "bg-white/5 text-[#888]"}`}>
              {t.label}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#00C2FF]" /></div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-20">
            <FileText size={48} className="mx-auto text-[#333] mb-4" />
            <p className="text-white/70">Keine Rechnungen</p>
          </div>
        ) : invoices.map((inv, idx) => {
          const st = STATUS_CFG[inv.status] || STATUS_CFG.draft;
          return (
            <motion.div key={inv.invoice_id} initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
              className="bg-[#111118] rounded-2xl p-4 border border-white/5"
              data-testid={`invoice-${inv.invoice_id}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-sm">{inv.invoice_number || `#${inv.invoice_id?.slice(0,8)}`}</h3>
                  <p className="text-xs text-[#666]">Erstellt: {fmtDate(inv.created_at)}</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-medium"
                  style={{ background: `${st.color}15`, color: st.color }}>{st.label}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <span className="text-xl font-bold text-[#00C2FF]">€{inv.total?.toFixed(2)}</span>
                {inv.status === "sent" && (
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleMarkPaid(inv.invoice_id)}
                    className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium flex items-center gap-1"
                    data-testid={`mark-paid-${inv.invoice_id}`}>
                    <Check size={12} /> Bezahlt
                  </motion.button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
