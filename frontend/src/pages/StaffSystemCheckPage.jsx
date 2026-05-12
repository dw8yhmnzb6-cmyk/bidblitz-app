/**
 * BidBlitz Staff — System Check Page
 * Route: /staff/system-check (internal QA/Health)
 */
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2, Database, Shield, Flag, Link2, Activity, RefreshCw } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function StaffSystemCheckPage({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, h] = await Promise.all([
        fetch(`${API}/api/staff/system-status`).then((r) => r.json()),
        fetch(`${API}/api/staff/health`).then((r) => r.json()),
      ]);
      setData(s);
      setHealth(h);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const Pill = ({ ok, label }) => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
      ok ? "bg-green-500/10 border-green-500/30 text-green-300"
         : "bg-red-500/10 border-red-500/30 text-red-300"
    }`}>
      {ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
      <span className="font-medium">{label}</span>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#00C2FF]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white px-4 py-6 pb-32" data-testid="staff-system-check-page">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold font-outfit">System Check</h1>
            <p className="text-xs text-white/50">BidBlitz Staff Module v{data?.version}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              data-testid="system-check-refresh-btn"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 hover:bg-white/10 text-xs"
            >
              <RefreshCw size={12} /> Aktualisieren
            </button>
            {onBack && (
              <button onClick={onBack} className="text-xs text-white/50 hover:text-white">Zurück</button>
            )}
          </div>
        </div>

        {/* Status Pills */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 mb-4"
        >
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
            <Activity size={14} className="text-[#00C2FF]" /> Status
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Pill ok={data?.mongo_ok} label="MongoDB" />
            <Pill ok={data?.auth_ok} label="Auth System" />
            <Pill ok={health?.status === "ok"} label="API Health" />
            <Pill ok={!!data?.version} label={`v${data?.version}`} />
          </div>
        </motion.div>

        {/* Collections */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 mb-4">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
            <Database size={14} className="text-[#A855F7]" /> Datenbestand
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {Object.entries(data?.collections || {}).map(([k, v]) => (
              <div key={k} className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5">
                <p className="text-[10px] text-white/40 uppercase">{k}</p>
                <p className="text-base font-bold mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Feature Flags */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 mb-4">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
            <Flag size={14} className="text-[#F59E0B]" /> Feature Flags
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(data?.feature_flags || {}).map(([k, v]) => (
              <Pill key={k} ok={!!v} label={k} />
            ))}
          </div>
        </div>

        {/* Integrations */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
            <Link2 size={14} className="text-[#10B981]" /> Externe Integrations
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(data?.integrations || {}).map(([k, v]) => (
              <Pill key={k} ok={!!v} label={k} />
            ))}
          </div>
          <p className="text-[10px] text-white/40 mt-3 flex items-start gap-1.5">
            <Shield size={10} className="mt-0.5 flex-shrink-0" />
            Stripe, SMS, Push und LiveKit Keys sind aktuell Platzhalter. Echte Integration über `.env` (siehe `/app/memory/staff_module_readme.md`).
          </p>
        </div>

        <p className="text-center text-[10px] text-white/30 mt-6">
          Letzte Prüfung: {data?.checked_at ? new Date(data.checked_at).toLocaleString() : "—"}
        </p>
      </div>
    </div>
  );
}
