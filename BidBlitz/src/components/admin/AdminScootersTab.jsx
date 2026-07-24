import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Plus, Check, X, Loader2, Activity, AlertCircle, Euro, Settings,
} from "lucide-react";
import { Skeleton, StatCard, adminApi } from "./adminHelpers";

export default function AdminScootersTab({
  loading, scooterFleet, scooterStats,
  showAdd, setShowAdd,
  newScooter, setNewScooter,
  saving, setSaving,
  reload, setError,
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        <StatCard icon={Zap} label="Gesamt" value={scooterStats?.total || 0} color="#00C2FF" delay={0} />
        <StatCard icon={Check} label="Verfügbar" value={scooterStats?.available || 0} color="#00D26A" delay={0.05} />
        <StatCard icon={Activity} label="In Benutzung" value={scooterStats?.in_use || 0} color="#FFB800" delay={0.1} />
        <StatCard icon={AlertCircle} label="Wartung" value={scooterStats?.maintenance || 0} color="#FF4757" delay={0.15} />
      </div>

      <motion.button data-testid="add-scooter-btn" whileTap={{ scale: 0.97 }}
        onClick={() => setShowAdd(!showAdd)}
        className="w-full py-3 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2"
        style={{ background: "rgba(0,194,255,0.08)", color: "#00C2FF", border: "1px solid rgba(0,194,255,0.15)" }}>
        <Plus size={16} /> Neuen Scooter hinzufügen
      </motion.button>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden rounded-2xl p-4 space-y-3"
            style={{ background: "rgba(0,194,255,0.02)", border: "1px solid rgba(0,194,255,0.08)" }}>
            <div className="grid grid-cols-2 gap-3">
              <ScooterField label="Geräte-ID *" testId="scooter-device-id" value={newScooter.device_id}
                onChange={v => setNewScooter({ ...newScooter, device_id: v })} placeholder="z.B. DEV-12345" />
              <ScooterField label="QR-Code" testId="scooter-qr-code" value={newScooter.qr_code}
                onChange={v => setNewScooter({ ...newScooter, qr_code: v })} placeholder="QR-Code ID" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[#444] font-medium block mb-1">Modell</label>
                <select data-testid="scooter-model" value={newScooter.model}
                  onChange={e => setNewScooter({ ...newScooter, model: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-[12px] text-white/90 font-medium outline-none bg-white/[0.03] border border-white/[0.05] cursor-pointer">
                  <option value="Ninebot Max G30">Ninebot Max G30</option>
                  <option value="Xiaomi Pro 2">Xiaomi Pro 2</option>
                  <option value="Segway E45">Segway E45</option>
                  <option value="Bird One">Bird One</option>
                  <option value="Lime S">Lime S</option>
                </select>
              </div>
              <ScooterField label="Batterie %" testId="scooter-battery" type="number" value={newScooter.battery}
                onChange={v => setNewScooter({ ...newScooter, battery: parseInt(v) || 100 })} min="0" max="100" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ScooterField label="Breitengrad (Lat)" testId="scooter-lat" type="number" step="0.0001"
                value={newScooter.lat} onChange={v => setNewScooter({ ...newScooter, lat: parseFloat(v) || 52.52 })} mono />
              <ScooterField label="Längengrad (Lng)" testId="scooter-lng" type="number" step="0.0001"
                value={newScooter.lng} onChange={v => setNewScooter({ ...newScooter, lng: parseFloat(v) || 13.405 })} mono />
            </div>
            <div className="flex gap-2 pt-2">
              <motion.button data-testid="scooter-submit" whileTap={{ scale: 0.97 }}
                disabled={saving || !newScooter.device_id}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await adminApi("/api/scooter/admin/add", { method: "POST", body: JSON.stringify(newScooter) });
                    setNewScooter({ device_id: "", qr_code: "", model: "Ninebot Max G30", lat: 52.52, lng: 13.405, battery: 100 });
                    setShowAdd(false);
                    reload();
                  } catch (e) { setError(e); }
                  setSaving(false);
                }}
                className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold bg-[#00D26A]/10 text-[#00D26A] border border-[#00D26A]/15 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} /> Scooter hinzufügen</>}
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowAdd(false)}
                className="px-4 py-2.5 rounded-xl text-[12px] font-medium text-[#444] bg-white/[0.02] border border-white/[0.04]">
                Abbrechen
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : scooterFleet.length === 0 ? (
        <div className="text-center py-10">
          <Zap size={40} className="mx-auto text-[#333] mb-3" />
          <p className="text-[#444] text-[13px]">Keine Scooter in der Flotte</p>
          <p className="text-[#333] text-[11px] mt-1">Füge deinen ersten Scooter hinzu</p>
        </div>
      ) : (
        <div className="space-y-2">
          {scooterFleet.map((scooter, idx) => {
            const statusColor = scooter.status === "available" ? "#00D26A"
              : scooter.status === "in_use" ? "#FFB800"
              : scooter.status === "offline" ? "#FF4757" : "#666";
            const batteryColor = scooter.battery >= 50 ? "#00D26A" : scooter.battery >= 20 ? "#FFB800" : "#FF4757";

            return (
              <motion.div key={scooter.scooter_id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                className="rounded-2xl p-4 relative overflow-hidden"
                style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap size={14} className="text-[#00C2FF]" />
                      <span className="text-[13px] font-bold text-white/90">{scooter.scooter_id}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase"
                        style={{ background: `${statusColor}15`, color: statusColor }}>
                        {scooter.status === "available" ? "Verfügbar"
                          : scooter.status === "in_use" ? "In Benutzung"
                          : scooter.status === "offline" ? "Offline" : scooter.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#444]">{scooter.model || scooter.name || "E-Scooter"}</p>
                    <div className="flex items-center gap-4 mt-2 text-[10px] text-[#555]">
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ background: batteryColor }} />
                        {scooter.battery}% Batterie
                      </span>
                      {scooter.total_rides > 0 && <span>{scooter.total_rides} Fahrten</span>}
                      {scooter.total_revenue > 0 && <span className="text-[#00D26A]">€{scooter.total_revenue.toFixed(2)}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <motion.button data-testid={`scooter-edit-${scooter.scooter_id}`} whileTap={{ scale: 0.9 }}
                      onClick={async () => {
                        const newStatus = scooter.status === "available" ? "maintenance" : "available";
                        try { await adminApi(`/api/scooter/admin/${scooter.scooter_id}`, { method: "PUT", body: JSON.stringify({ status: newStatus }) }); reload(); }
                        catch { /* noop */ }
                      }}
                      className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[#666] hover:text-[#00C2FF]">
                      <Settings size={14} />
                    </motion.button>
                    <motion.button data-testid={`scooter-delete-${scooter.scooter_id}`} whileTap={{ scale: 0.9 }}
                      onClick={async () => {
                        if (window.confirm(`Scooter ${scooter.scooter_id} wirklich löschen?`)) {
                          try { await adminApi(`/api/scooter/admin/${scooter.scooter_id}`, { method: "DELETE" }); reload(); }
                          catch { /* noop */ }
                        }
                      }}
                      className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[#666] hover:text-[#FF4757]">
                      <X size={14} />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {scooterStats && scooterStats.total_revenue > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(0,210,106,0.02)", border: "1px solid rgba(0,210,106,0.08)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Euro size={16} className="text-[#00D26A]" />
              <span className="text-[12px] text-[#444]">Gesamtumsatz Scooter</span>
            </div>
            <span className="text-[18px] font-bold font-outfit text-[#00D26A]">€{scooterStats.total_revenue.toFixed(2)}</span>
          </div>
          <p className="text-[10px] text-[#555] mt-1">{scooterStats.total_rides || 0} Fahrten insgesamt</p>
        </div>
      )}
    </motion.div>
  );
}

const ScooterField = ({ label, testId, value, onChange, placeholder, type = "text", min, max, step, mono }) => (
  <div>
    <label className="text-[10px] text-[#444] font-medium block mb-1">{label}</label>
    <input data-testid={testId} type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} min={min} max={max} step={step}
      className={`w-full px-3 py-2 rounded-xl text-[12px] text-white/90 placeholder-[#333] font-medium outline-none bg-white/[0.03] border border-white/[0.05] ${mono ? "font-mono" : ""}`} />
  </div>
);
