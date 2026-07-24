/**
 * BidBlitz KDS — Kitchen Display für Tablets in der Küche
 * Auto-refresh alle 5 s. Tap auf Bestellung → Status weiter.
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_NEXT = { open: "in_progress", in_progress: "ready", ready: "served" };
const STATUS_LABEL = { open: "Neu", in_progress: "In Arbeit", ready: "Fertig", served: "Serviert" };
const STATUS_COLOR = { open: "#EF4444", in_progress: "#F59E0B", ready: "#10B981", served: "#6B7280" };

export default function KDSPage({ stationId: propStationId }) {
  const stationId = propStationId || window.location.pathname.split("/").pop();
  const [orders, setOrders] = useState([]);
  const [stationName, setStationName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/pos/kds/orders/${stationId}`, { credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Fehler");
      setOrders(d.orders || []);
      setStationName(d.station_name || "");
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  }, [stationId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const advance = async (oid, current) => {
    const next = STATUS_NEXT[current];
    if (!next) return;
    try {
      const r = await fetch(`${API}/api/pos/kds/orders/${oid}/status?status=${next}`, {
        method: "POST", credentials: "include",
      });
      if (!r.ok) throw new Error("Fehler");
      toast.success(`→ ${STATUS_LABEL[next]}`);
      load();
    } catch (e) { toast.error(e.message); }
  };

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-[#00C2FF]" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#060810] text-white" data-testid="kds-page">
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <ChefHat size={20} className="text-[#00C2FF]" />
          <div className="flex-1">
            <h1 className="text-[16px] font-bold">{stationName || "Kitchen Display"}</h1>
            <p className="text-[10px] text-white/40">{orders.length} offene Bestellungen · Auto-Refresh 5 s</p>
          </div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/40">
          <CheckCircle2 size={48} className="text-[#10B981] mb-4" />
          <p className="text-[14px]">Keine offenen Bestellungen</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-3" data-testid="kds-orders">
          <AnimatePresence>
            {orders.map((o) => (
              <motion.button
                key={o.kds_order_id}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={() => advance(o.kds_order_id, o.status)}
                data-testid={`kds-order-${o.kds_order_id}`}
                className="text-left bg-white/[0.05] border-2 rounded-2xl p-4 hover:bg-white/[0.08] transition"
                style={{ borderColor: STATUS_COLOR[o.status] }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-[10px] text-white/40">Tisch {o.table_number || "—"}</p>
                    <p className="text-[10px] text-white/40 flex items-center gap-1">
                      <Clock size={9} /> {o.created_at?.slice(11, 19)}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                    style={{ background: STATUS_COLOR[o.status], color: "white" }}>
                    {STATUS_LABEL[o.status]}
                  </span>
                </div>
                <div className="space-y-1">
                  {(o.items || []).map((it, i) => (
                    <div key={i} className="text-[12px] py-1 border-b border-white/5">
                      <span className="text-[#00C2FF] font-bold">{it.quantity}× </span>
                      <span className="text-white">{it.name}</span>
                      {it.notes && <p className="text-[9px] text-yellow-400 italic">→ {it.notes}</p>}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[9px] text-white/40 uppercase font-bold">
                  Tap → {STATUS_LABEL[STATUS_NEXT[o.status]] || "Fertig"}
                </p>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
