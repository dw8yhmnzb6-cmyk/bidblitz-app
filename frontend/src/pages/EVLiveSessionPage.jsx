/**
 * EVLiveSessionPage — live charging telemetry while OCPP MeterValues stream in.
 * Polls /api/ev/session/:id every 3s. Stop button posts /api/ev/stop.
 */
import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export default function EVLiveSessionPage({ sessionId, onNavigate }) {
  const [session, setSession] = useState(null);
  const [stopping, setStopping] = useState(false);
  const pollRef = useRef(null);

  const refresh = async () => {
    try {
      const res = await fetch(`${API}/api/ev/session/${sessionId}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setSession(data);
      if (["completed", "cancelled", "failed", "settle_failed"].includes(data.status)) {
        clearInterval(pollRef.current);
      }
    } catch {}
  };

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, 3000);
    return () => clearInterval(pollRef.current);
  }, [sessionId]);

  const stop = async () => {
    setStopping(true);
    try {
      const res = await fetch(`${API}/api/ev/stop/${sessionId}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Stop fehlgeschlagen");
      toast.success("Stop-Befehl an Station gesendet");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setStopping(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
        <p className="text-gray-400">Lade Session…</p>
      </div>
    );
  }

  const status = session.status;
  const kwh = Number(session.kwh_charged || 0);
  const cost = Number(session.current_cost || session.final_cost || 0);
  const powerKw = Number(session.current_power_w || 0) / 1000;
  const isLive = ["active", "starting", "stopping"].includes(status);
  const isDone = ["completed", "cancelled", "failed", "settle_failed"].includes(status);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="px-5 pt-12 pb-32">
        <button onClick={() => onNavigate("/")} className="text-gray-400 text-sm">← Schließen</button>
        <h1 className="text-2xl font-bold mt-3" data-testid="ev-session-status">
          {{
            authorized: "Autorisiert…",
            starting: "Start läuft",
            active: "Lädt jetzt",
            stopping: "Wird gestoppt",
            completed: "Abgeschlossen",
            cancelled: "Abgebrochen",
            failed: "Fehlgeschlagen",
            settle_failed: "Abrechnung fehlgeschlagen",
          }[status] || status}
        </h1>
        <p className="text-sm text-gray-400 mt-1">{session.charge_point_id} · Stecker {session.connector_id}</p>

        {/* Big circle */}
        <div className="mt-8 flex items-center justify-center">
          <motion.div
            animate={{ scale: isLive ? [1, 1.04, 1] : 1 }}
            transition={{ duration: 2, repeat: isLive ? Infinity : 0 }}
            className={`w-56 h-56 rounded-full flex flex-col items-center justify-center border-2 ${
              isLive ? "border-cyan-400 bg-cyan-500/10 shadow-[0_0_60px_rgba(0,194,255,0.3)]" : isDone ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/10"
            }`}
          >
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">geladen</p>
            <p className="text-5xl font-bold" data-testid="ev-live-kwh">{kwh.toFixed(2)}</p>
            <p className="text-sm text-gray-400 mt-1">kWh</p>
          </motion.div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-8">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
            <p className="text-[10px] text-gray-500 uppercase mb-1">Leistung</p>
            <p className="text-base font-bold">{powerKw > 0 ? powerKw.toFixed(1) : "—"} kW</p>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
            <p className="text-[10px] text-gray-500 uppercase mb-1">Kosten</p>
            <p className="text-base font-bold text-cyan-400" data-testid="ev-live-cost">€{cost.toFixed(2)}</p>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
            <p className="text-[10px] text-gray-500 uppercase mb-1">Reservierung</p>
            <p className="text-base font-bold">€{Number(session.reserved_amount || 0).toFixed(0)}</p>
          </div>
        </div>

        {isDone && (
          <div className="mt-6 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/30">
            <p className="text-xs text-emerald-300 uppercase tracking-wider font-semibold mb-1">Endabrechnung</p>
            <p className="text-2xl font-bold">€{Number(session.final_cost || 0).toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">
              {kwh.toFixed(2)} kWh · {Math.round(session.duration_min || 0)} Min · Ref. {session.settlement_ref}
            </p>
          </div>
        )}
      </div>

      {isLive && (
        <div className="fixed bottom-0 left-0 right-0 p-5 bg-[#0A0A0F]/95 backdrop-blur-md border-t border-white/10">
          <button
            onClick={stop}
            disabled={stopping}
            className="w-full py-4 rounded-2xl bg-red-500 text-white font-bold text-lg disabled:opacity-50"
            data-testid="ev-stop-btn"
          >
            {stopping ? "Wird gestoppt…" : "Ladevorgang beenden"}
          </button>
        </div>
      )}
    </div>
  );
}
