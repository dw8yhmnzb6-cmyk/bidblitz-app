import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Loader2, Euro, Calendar, Check, AlertCircle } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const BNPLPage = ({ onBack }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    try {
      const res = await fetch(`${API}/api/bnpl/orders`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setOrders(d.orders || []); }
    } catch {}
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="bnpl-back">
            <ArrowLeft size={20} />
          </motion.button>
          <div>
            <h1 className="text-lg font-bold">Später zahlen</h1>
            <p className="text-xs text-[#666]">Buy now, pay later</p>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="p-4">
        <div className="rounded-2xl p-5 mb-4" style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.08), rgba(0,232,157,0.04))", border: "1px solid rgba(0,212,255,0.15)" }}>
          <h2 className="text-base font-bold mb-2">So funktioniert's</h2>
          <div className="space-y-3">
            {[
              { step: "1", text: "Kaufe jetzt und teile den Betrag in 3 Raten" },
              { step: "2", text: "Erste Rate wird sofort abgebucht" },
              { step: "3", text: "Restliche Raten alle 30 Tage, 0% Zinsen" },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#00D4FF]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-[#00D4FF]">{s.step}</span>
                </div>
                <p className="text-sm text-white/70">{s.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Active Orders */}
        <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-3">Aktive Ratenzahlungen</h3>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-[#00D4FF]" /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <Clock size={48} className="mx-auto text-[#333] mb-4" />
            <p className="text-white/70 font-semibold">Keine Ratenzahlungen</p>
            <p className="text-sm text-[#666] mt-2">Wähle "Später zahlen" beim nächsten Einkauf!</p>
          </div>
        ) : orders.map((o, i) => (
          <motion.div key={o.order_id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#111118] rounded-2xl p-4 border border-white/5 mb-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">{o.title}</h3>
              <span className="text-xs text-[#00D4FF] font-bold">€{o.total?.toFixed(2)}</span>
            </div>
            <div className="flex gap-1 mb-2">
              {[1, 2, 3].map(r => (
                <div key={r} className={`flex-1 h-1.5 rounded-full ${r <= (o.paid_installments || 0) ? "bg-[#00D4FF]" : "bg-white/10"}`} />
              ))}
            </div>
            <p className="text-xs text-[#888]">Rate {o.paid_installments || 0}/3 · Nächste: {o.next_date || "—"}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default BNPLPage;
