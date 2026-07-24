/**
 * Warnings List für Merchant Dashboard
 */
import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, MapPin, Clock, Coffee, Copy, ShieldAlert, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const TYPE_META = {
  no_clock_out: { icon: Clock, color: "#EF4444", label: "Nicht ausgecheckt" },
  duplicate_clock_in: { icon: Copy, color: "#F59E0B", label: "Doppelter Check-in" },
  missing_break: { icon: Coffee, color: "#F59E0B", label: "Pause fehlt" },
  overtime: { icon: AlertTriangle, color: "#EF4444", label: "Überstunden" },
  gps_out_of_range: { icon: MapPin, color: "#A855F7", label: "GPS außerhalb" },
  shift_no_checkin: { icon: ShieldAlert, color: "#EF4444", label: "Schicht ohne Check-in" },
};

export default function StaffWarningsList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/staff/warnings/list?resolved=false`, { credentials: "include" });
      if (res.ok) setItems((await res.json()).warnings || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const scan = async () => {
    setScanning(true);
    try {
      const res = await fetch(`${API}/api/staff/warnings/scan`, { method: "POST", credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        toast.success(`Scan abgeschlossen: ${d.created} neue Warnungen`);
        load();
      }
    } catch (e) { toast.error("Scan fehlgeschlagen"); }
    setScanning(false);
  };

  const resolve = async (id) => {
    try {
      const res = await fetch(`${API}/api/staff/warnings/${id}/resolve`, { method: "POST", credentials: "include" });
      if (res.ok) {
        toast.success("Warnung erledigt");
        setItems((prev) => prev.filter((i) => i.id !== id));
      }
    } catch (e) {}
  };

  return (
    <div data-testid="staff-warnings-list">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <ShieldAlert size={16} className="text-red-400" />
          Offene Warnungen
          <span className="text-[10px] text-white/40 font-normal">({items.length})</span>
        </h3>
        <button
          onClick={scan}
          disabled={scanning}
          data-testid="staff-warnings-scan-btn"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium hover:bg-white/10"
        >
          {scanning ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Jetzt prüfen
        </button>
      </div>

      {loading ? (
        <div className="py-6 flex justify-center"><Loader2 size={18} className="animate-spin text-white/40" /></div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center rounded-2xl bg-white/[0.02] border border-white/5">
          <CheckCircle size={28} className="text-green-400 mx-auto mb-2" />
          <p className="text-sm text-white/70">Alles im grünen Bereich</p>
          <p className="text-[10px] text-white/40 mt-1">Keine offenen Warnungen</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((w) => {
            const meta = TYPE_META[w.type] || { icon: AlertTriangle, color: "#F59E0B", label: w.type };
            const I = meta.icon;
            return (
              <li
                key={w.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10"
                data-testid={`staff-warning-item-${w.type}`}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${meta.color}22`, color: meta.color }}>
                  <I size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{meta.label}</p>
                  <p className="text-[11px] text-white/60 truncate">{w.message || ""}</p>
                </div>
                <button
                  onClick={() => resolve(w.id)}
                  className="px-2 py-1 rounded-md bg-green-500/10 text-green-400 text-[10px] font-medium hover:bg-green-500/20"
                >
                  Erledigt
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
