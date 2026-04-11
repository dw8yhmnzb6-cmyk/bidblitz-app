/**
 * BidBlitz V2 - Vendor Damages Page
 */

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, AlertTriangle, Loader2, Check, Clock, Wrench } from "lucide-react";
import { getVendorDamages, updateDamageReport } from "../api";

const SEV_CFG = {
  minor: { label: "Gering", color: "#FFB800" },
  moderate: { label: "Mittel", color: "#FF8C00" },
  major: { label: "Schwer", color: "#FF4757" },
  total_loss: { label: "Totalschaden", color: "#FF0000" },
};

export default function VendorDamagesPage({ onBack }) {
  const [damages, setDamages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(null);

  useEffect(() => { load(); }, [filter]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getVendorDamages(filter);
      setDamages(data.damages || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const markResolved = async (damageId) => {
    try {
      await updateDamageReport(damageId, { resolved: true, resolution_notes: "Behoben" });
      load();
    } catch (err) { alert(err.message); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("de-DE") : "";

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 p-4">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
            className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="vendor-damages-back">
            <ArrowLeft size={20} />
          </motion.button>
          <div>
            <h1 className="text-lg font-bold">Schadensberichte</h1>
            <p className="text-xs text-[#666]">{damages.length} Berichte</p>
          </div>
        </div>
        <div className="flex gap-2 px-4 pb-3">
          {[{ id: null, label: "Alle" }, { id: false, label: "Offen" }, { id: true, label: "Behoben" }].map(t => (
            <motion.button key={String(t.id)} whileTap={{ scale: 0.95 }}
              onClick={() => setFilter(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium ${filter === t.id ? "bg-[#00C2FF] text-black" : "bg-white/5 text-[#888]"}`}>
              {t.label}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#00C2FF]" /></div>
        ) : damages.length === 0 ? (
          <div className="text-center py-20">
            <AlertTriangle size={48} className="mx-auto text-[#333] mb-4" />
            <p className="text-white/70">Keine Schadensberichte</p>
          </div>
        ) : damages.map((d, idx) => {
          const sev = SEV_CFG[d.severity] || SEV_CFG.minor;
          return (
            <motion.div key={d.damage_id} initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
              className="bg-[#111118] rounded-2xl p-4 border border-white/5"
              data-testid={`damage-${d.damage_id}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-sm">{d.description}</h3>
                  <p className="text-xs text-[#666]">{d.location_on_vehicle} · {fmtDate(d.created_at)}</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-medium"
                  style={{ background: `${sev.color}15`, color: sev.color }}>{sev.label}</span>
              </div>
              {d.estimated_cost && (
                <p className="text-sm text-[#888] mb-2">Geschätzte Kosten: <span className="text-white font-medium">€{d.estimated_cost}</span></p>
              )}
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <span className={`text-xs font-medium ${d.resolved ? "text-green-400" : "text-yellow-400"}`}>
                  {d.resolved ? "Behoben" : "Offen"}
                </span>
                {!d.resolved && (
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => markResolved(d.damage_id)}
                    className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium flex items-center gap-1"
                    data-testid={`resolve-damage-${d.damage_id}`}>
                    <Check size={12} /> Behoben
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
