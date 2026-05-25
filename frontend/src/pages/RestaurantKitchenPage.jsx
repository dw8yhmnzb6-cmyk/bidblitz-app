import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ChefHat, Clock, Loader2, RefreshCw } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const STATUS_NEXT = { new: "accepted", accepted: "preparing", preparing: "ready", ready: "served" };
const LIVE_EVENTS = new Set(["order_created", "order_status", "order_paid"]);

const buildWsUrl = (storeId, token) => {
  const base = API.endsWith("/") ? API.slice(0, -1) : API;
  const wsBase = base.startsWith("https://") ? base.replace("https://", "wss://") : base.replace("http://", "ws://");
  return `${wsBase}/api/restaurant/ws/${encodeURIComponent(storeId)}?token=${encodeURIComponent(token)}`;
};

async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.message || "Fehler");
  return data;
}

export default function RestaurantKitchenPage({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState("");
  const [orders, setOrders] = useState([]);
  const [liveState, setLiveState] = useState("offline");

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [ordersRes, tablesRes] = await Promise.all([api("/api/orders"), api("/api/tables")]);
      setStoreId(tablesRes.store?.store_id || ordersRes.orders?.[0]?.store_id || "");
      setOrders((ordersRes.orders || []).filter((order) => ["new", "accepted", "preparing", "ready"].includes(order.status)));
    } catch (error) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const timer = setInterval(() => load({ silent: true }), 45000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!storeId) return undefined;
    let closedByPage = false;
    let reconnectTimer;
    let socket;

    const connect = async () => {
      try {
        setLiveState("connecting");
        const tokenRes = await api("/api/auth/ws-token");
        socket = new window.WebSocket(buildWsUrl(storeId, tokenRes.token));
        socket.onopen = () => setLiveState("online");
        socket.onmessage = async (event) => {
          const message = JSON.parse(event.data || "{}");
          if (message.type === "connected" || message.type === "pong") {
            setLiveState("online");
            return;
          }
          if (message.type === "error") {
            setLiveState("error");
            return;
          }
          if (!LIVE_EVENTS.has(message.event_type)) return;
          if (message.event_type === "order_created") toast.success("Neue Küchenbestellung live eingegangen");
          await load({ silent: true });
        };
        socket.onerror = () => setLiveState("error");
        socket.onclose = () => {
          if (closedByPage) return;
          setLiveState("reconnecting");
          reconnectTimer = window.setTimeout(connect, 2500);
        };
      } catch {
        setLiveState("error");
        reconnectTimer = window.setTimeout(connect, 4000);
      }
    };

    connect();
    return () => {
      closedByPage = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [storeId]);

  const grouped = useMemo(() => ({
    new: orders.filter((order) => order.status === "new"),
    accepted: orders.filter((order) => order.status === "accepted"),
    preparing: orders.filter((order) => order.status === "preparing"),
    ready: orders.filter((order) => order.status === "ready"),
  }), [orders]);

  const advance = async (order) => {
    const next = STATUS_NEXT[order.status];
    if (!next) return;
    try {
      await api(`/api/orders/${order.order_id}/status`, { method: "PUT", body: { status: next } });
      await load({ silent: true });
      toast.success(`Küche → ${next}`);
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#06070B]"><Loader2 size={24} className="animate-spin text-white/45" /></div>;

  return (
    <div className="min-h-screen bg-[#06070B] text-white" data-testid="restaurant-kitchen-page">
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#06070B]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5" data-testid="restaurant-kitchen-back-button"><ArrowLeft size={18} /></button>
          <div className="flex-1">
            <h1 className="text-xl font-black">Kitchen Monitor</h1>
            <p className="text-sm text-white/45">Neu · Angenommen · In Arbeit · Fertig</p>
            <div className="mt-2 flex items-center gap-2" data-testid="restaurant-kitchen-live-status">
              <span className={`h-2.5 w-2.5 rounded-full ${liveState === "online" ? "bg-emerald-400" : liveState === "connecting" || liveState === "reconnecting" ? "bg-amber-400" : "bg-rose-400"}`} />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">Live {liveState === "online" ? "verbunden" : liveState === "connecting" ? "verbindet" : liveState === "reconnecting" ? "reconnect" : "offline"}</span>
            </div>
          </div>
          <button onClick={() => load()} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/75" data-testid="restaurant-kitchen-refresh-button"><RefreshCw size={14} className="mr-2 inline-block" />Refresh</button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {Object.entries(grouped).map(([status, items]) => (
          <section key={status} data-testid={`restaurant-kitchen-group-${status}`}>
            <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-white/40"><ChefHat size={14} /> {status}</div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((order) => (
                <button key={order.order_id} onClick={() => advance(order)} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 text-left" data-testid={`restaurant-kitchen-order-${order.order_id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">Tisch {order.table_number}</p>
                      <p className="mt-1 text-sm text-white/45 flex items-center gap-1"><Clock size={12} /> {new Date(order.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/15 px-3 py-1 text-xs font-bold text-cyan-100">{order.status}</span>
                  </div>
                  <div className="mt-4 space-y-1 text-sm text-white/75">
                    {(order.items || []).map((item, index) => <p key={`${order.order_id}-${index}`}>{item.quantity}× {item.name}</p>)}
                  </div>
                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-white/35">Tap → {STATUS_NEXT[order.status] || "fertig"}</p>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}