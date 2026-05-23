import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ReceiptText, RefreshCw } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

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

const waitLabel = (value) => {
  if (!value) return "—";
  const diff = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return `${diff} Min`;
};

export default function RestaurantStaffDashboardPage({ onBack }) {
  const previousCalls = useRef(0);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState("");
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [serviceCalls, setServiceCalls] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [hardwareHealth, setHardwareHealth] = useState({ printers: [] });

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [tablesRes, ordersRes, serviceRes] = await Promise.all([
        api("/api/tables"),
        api("/api/orders"),
        api("/api/service-call"),
      ]);
      const resolvedStoreId = tablesRes.store?.store_id || tablesRes.tables?.[0]?.store_id || "";
      setTables(tablesRes.tables || []);
      setStoreId(resolvedStoreId);
      setOrders(ordersRes.orders || []);
      setServiceCalls(serviceRes.service_calls || []);
      if (resolvedStoreId) {
        const [stockRes, hardwareRes] = await Promise.all([
          api(`/api/pos/stock/low?store_id=${resolvedStoreId}`),
          api(`/api/pos/hardware/health?store_id=${resolvedStoreId}`),
        ]);
        setLowStock(stockRes.products || []);
        setHardwareHealth(hardwareRes || { printers: [] });
      }
      const openCalls = (serviceRes.service_calls || []).filter((item) => item.status === "open").length;
      if (previousCalls.current && openCalls > previousCalls.current) {
        toast.success("Neue Live-Meldung im Service-Dashboard");
      }
      previousCalls.current = openCalls;
    } catch (error) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const timer = setInterval(() => load({ silent: true }), 5000);
    return () => clearInterval(timer);
  }, []);

  const summary = useMemo(() => ({
    openOrders: orders.filter((order) => ["new", "accepted", "preparing", "ready", "served"].includes(order.status)).length,
    service: serviceCalls.filter((call) => call.type === "service" && call.status !== "done").length,
    bills: serviceCalls.filter((call) => call.type === "bill" && call.status !== "done").length,
    problems: serviceCalls.filter((call) => call.type === "problem" && call.status !== "done").length,
  }), [orders, serviceCalls]);

  const setOrderStatus = async (orderId, status) => {
    try {
      await api(`/api/orders/${orderId}/status`, { method: "PUT", body: { status } });
      await load({ silent: true });
      toast.success(`Bestellung → ${status}`);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const setCallStatus = async (callId, status) => {
    try {
      await api(`/api/service-call/${callId}/status`, { method: "PUT", body: { status } });
      await load({ silent: true });
      toast.success(`Service-Call → ${status}`);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const bringBill = async (tableId, serviceCallId) => {
    try {
      const result = await api(`/api/tables/${tableId}/bill-link`, { method: "POST" });
      if (result.payment_link) {
        await navigator.clipboard.writeText(result.payment_link);
      }
      if (serviceCallId) {
        await api(`/api/service-call/${serviceCallId}/status`, { method: "PUT", body: { status: "accepted" } });
      }
      await load({ silent: true });
      toast.success("Rechnungslink kopiert und Bon vorbereitet");
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#06070B]"><Loader2 size={24} className="animate-spin text-white/45" /></div>;

  return (
    <div className="min-h-screen bg-[#06070B] pb-20 text-white" data-testid="restaurant-staff-dashboard-page">
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#06070B]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5" data-testid="restaurant-staff-dashboard-back-button"><ArrowLeft size={18} /></button>
          <div className="flex-1">
            <h1 className="text-xl font-black">Staff Dashboard</h1>
            <p className="text-sm text-white/45">Offene Bestellungen, Service-Rufe, Rechnung anfordern</p>
          </div>
          <button onClick={() => load()} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/75" data-testid="restaurant-staff-dashboard-refresh-button"><RefreshCw size={14} className="mr-2 inline-block" />Refresh</button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-3 md:grid-cols-4">
          {[{ label: "Open Orders", value: summary.openOrders }, { label: "Service", value: summary.service }, { label: "Bills", value: summary.bills }, { label: "Probleme", value: summary.problems }].map((item) => (
            <div key={item.label} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4" data-testid={`restaurant-staff-metric-${item.label.toLowerCase()}`}>
              <p className="text-xs uppercase tracking-[0.18em] text-white/35">{item.label}</p>
              <p className="mt-3 text-3xl font-black">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5" data-testid="restaurant-staff-orders-section">
            <h2 className="text-lg font-black">Offene Bestellungen</h2>
            <div className="mt-4 space-y-3">
              {orders.filter((order) => ["new", "accepted", "preparing", "ready", "served"].includes(order.status)).map((order) => (
                <div key={order.order_id} className="rounded-[24px] border border-white/10 bg-black/20 p-4" data-testid={`restaurant-staff-order-card-${order.order_id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">Tisch {order.table_number}</p>
                      <p className="text-sm text-white/45">{order.order_id} · Wartezeit {waitLabel(order.created_at)}</p>
                    </div>
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/15 px-3 py-1 text-xs font-bold text-cyan-100">{order.status}</span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-white/70">
                    {(order.items || []).map((item, index) => <p key={`${order.order_id}-${index}`}>{item.quantity}× {item.name}</p>)}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {order.status === "new" && <button onClick={() => setOrderStatus(order.order_id, "accepted")} className="rounded-full border border-cyan-400/20 bg-cyan-400/15 px-3 py-2 text-xs font-bold text-cyan-100" data-testid={`restaurant-staff-order-accept-${order.order_id}`}>Annehmen</button>}
                    {order.status !== "closed" && order.status !== "paid" && <button onClick={() => setOrderStatus(order.order_id, "served")} className="rounded-full border border-emerald-400/20 bg-emerald-400/15 px-3 py-2 text-xs font-bold text-emerald-100" data-testid={`restaurant-staff-order-done-${order.order_id}`}>Erledigt</button>}
                    <button onClick={() => bringBill(order.table_id)} className="rounded-full border border-violet-400/20 bg-violet-400/15 px-3 py-2 text-xs font-bold text-violet-100" data-testid={`restaurant-staff-order-bill-${order.order_id}`}><ReceiptText size={14} className="mr-2 inline-block" />Rechnung bringen</button>
                    <button onClick={() => setOrderStatus(order.order_id, "closed")} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/75" data-testid={`restaurant-staff-order-close-${order.order_id}`}>Bestellung schließen</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5" data-testid="restaurant-staff-service-section">
            <h2 className="text-lg font-black">Aktive Service-Rufe</h2>
            <div className="mt-4 space-y-3">
              {serviceCalls.filter((call) => call.status !== "done").map((call) => (
                <div key={call.service_call_id} className="rounded-[24px] border border-white/10 bg-black/20 p-4" data-testid={`restaurant-staff-service-card-${call.service_call_id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">Tisch {call.table_number}</p>
                      <p className="text-sm text-white/45">{call.type} · Wartezeit {waitLabel(call.created_at)}</p>
                    </div>
                    <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-100">{call.status}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {call.status === "open" && <button onClick={() => setCallStatus(call.service_call_id, "accepted")} className="rounded-full border border-cyan-400/20 bg-cyan-400/15 px-3 py-2 text-xs font-bold text-cyan-100" data-testid={`restaurant-staff-service-accept-${call.service_call_id}`}>Annehmen</button>}
                    {call.type === "bill" && <button onClick={() => bringBill(call.table_id, call.service_call_id)} className="rounded-full border border-violet-400/20 bg-violet-400/15 px-3 py-2 text-xs font-bold text-violet-100" data-testid={`restaurant-staff-service-bill-${call.service_call_id}`}>Rechnung bringen</button>}
                    <button onClick={() => setCallStatus(call.service_call_id, "done")} className="rounded-full border border-emerald-400/20 bg-emerald-400/15 px-3 py-2 text-xs font-bold text-emerald-100" data-testid={`restaurant-staff-service-done-${call.service_call_id}`}>Erledigt</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5" data-testid="restaurant-staff-tables-section">
          <h2 className="text-lg font-black">Wartezeiten pro Tisch</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {tables.map((table) => (
              <div key={table.table_id} className="rounded-[24px] border border-white/10 bg-black/20 p-4" data-testid={`restaurant-staff-table-card-${table.table_id}`}>
                <p className="text-lg font-semibold">{table.table_name}</p>
                <p className="text-sm text-white/45">#{table.table_number} · {table.status}</p>
                <p className="mt-3 text-sm text-white/75">Wartezeit: {waitLabel(table.wait_started_at)}</p>
                <p className="mt-1 text-sm text-white/45">Orders {table.open_order_count} · Calls {table.open_service_call_count}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5" data-testid="restaurant-staff-low-stock-section">
            <h2 className="text-lg font-black">Warenwirtschaft / Low Stock</h2>
            <div className="mt-4 space-y-3">
              {lowStock.slice(0, 8).map((product) => (
                <div key={product.product_id} className="rounded-[24px] border border-white/10 bg-black/20 p-4" data-testid={`restaurant-staff-low-stock-${product.product_id}`}>
                  <p className="text-base font-semibold">{product.name}</p>
                  <p className="mt-1 text-sm text-white/45">Bestand {product.stock} · Minimum {product.minimum_stock}</p>
                </div>
              ))}
              {lowStock.length === 0 && <p className="text-sm text-white/45">Keine kritischen Lagerwarnungen.</p>}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5" data-testid="restaurant-staff-hardware-section">
            <h2 className="text-lg font-black">Hardware Health</h2>
            <p className="mt-1 text-sm text-white/45">Store {storeId || "—"}</p>
            <div className="mt-4 space-y-3">
              {(hardwareHealth.printers || []).map((printer) => (
                <div key={printer.printer_id || printer.role} className="rounded-[24px] border border-white/10 bg-black/20 p-4" data-testid={`restaurant-staff-printer-${printer.role || printer.printer_id}`}>
                  <p className="text-base font-semibold">{printer.name || printer.role}</p>
                  <p className="mt-1 text-sm text-white/45">{printer.type} · {printer.ip || printer.device || "file"}</p>
                </div>
              ))}
              {(hardwareHealth.printers || []).length === 0 && <p className="text-sm text-white/45">Noch kein echter Drucker gemappt — File-Fallback aktiv.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}