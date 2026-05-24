import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Bell, Loader2, Minus, Plus, ReceiptText, ShoppingCart } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.message || "Fehler");
  return data;
}

export default function RestaurantTableGuestPage({ tableId: propTableId }) {
  const tableId = propTableId || window.location.pathname.split("/").pop();
  const [data, setData] = useState(null);
  const [cart, setCart] = useState({});
  const [guestName, setGuestName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const [paymentLink, setPaymentLink] = useState("");
  const [paying, setPaying] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await api(`/api/tables/${tableId}/menu`);
      setData(result);
    } catch (error) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [tableId]);

  const groupedProducts = useMemo(() => {
    const groups = {};
    (data?.products || []).forEach((product) => {
      const key = product.category || "Speisekarte";
      if (!groups[key]) groups[key] = [];
      groups[key].push(product);
    });
    return groups;
  }, [data]);

  const total = useMemo(() => Object.entries(cart).reduce((sum, [productId, quantity]) => {
    const product = (data?.products || []).find((item) => item.product_id === productId);
    return sum + ((product?.price || 0) * quantity);
  }, 0), [cart, data]);

  const changeQty = (productId, delta) => {
    setCart((prev) => {
      const next = { ...prev };
      const value = (next[productId] || 0) + delta;
      if (value <= 0) delete next[productId];
      else next[productId] = value;
      return next;
    });
  };

  const placeOrder = async () => {
    const items = Object.entries(cart).map(([product_id, quantity]) => ({ product_id, quantity }));
    if (items.length === 0) {
      toast.error("Bitte zuerst etwas auswählen");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api("/api/orders", { method: "POST", body: { table_id: tableId, guest_name: guestName || null, items } });
      setSuccessOrder(result.order);
      setCart({});
      toast.success("Bestellung an Küche und Service gesendet");
    } catch (error) {
      toast.error(error.message);
    }
    setSubmitting(false);
  };

  const createCall = async (type) => {
    try {
      await api("/api/service-call", { method: "POST", body: { table_id: tableId, type } });
      toast.success(type === "bill" ? "Rechnung angefordert" : "Service gerufen");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const requestPaymentLink = async () => {
    setPaying(true);
    try {
      const result = await api(`/api/tables/${tableId}/bill-link/public`, { method: "POST" });
      setPaymentLink(result.payment_link || "");
      toast.success("Zahlungslink bereit");
    } catch (error) {
      toast.error(error.message);
    }
    setPaying(false);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#06070B]"><Loader2 size={24} className="animate-spin text-white/45" /></div>;
  if (!data) return <div className="flex min-h-screen items-center justify-center bg-[#06070B] text-white">Tisch nicht gefunden.</div>;

  return (
    <div
      className="min-h-screen bg-[#06070B] text-white overflow-x-hidden"
      style={{ paddingBottom: Object.keys(cart).length > 0 ? "calc(10rem + env(safe-area-inset-bottom, 0px))" : "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
      data-testid="restaurant-table-guest-page"
    >
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#06070B]/90 px-4 py-4 backdrop-blur-xl" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))" }}>
        <h1 className="text-2xl font-black">{data.store?.name || "Speisekarte"}</h1>
        <p className="mt-1 text-sm text-white/45" data-testid="restaurant-table-guest-table-label">{data.table?.table_name} · Tisch {data.table?.table_number} · {data.table?.area}</p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button onClick={() => createCall("service")} className="rounded-2xl border border-cyan-400/20 bg-cyan-400/15 px-4 py-3 text-sm font-bold text-cyan-100" data-testid="restaurant-table-service-button">
            <Bell size={16} className="mr-2 inline-block" /> Service rufen
          </button>
          <button onClick={() => createCall("bill")} className="rounded-2xl border border-violet-400/20 bg-violet-400/15 px-4 py-3 text-sm font-bold text-violet-100" data-testid="restaurant-table-bill-button">
            <ReceiptText size={16} className="mr-2 inline-block" /> Rechnung anfordern
          </button>
        </div>
        <button onClick={requestPaymentLink} disabled={paying} className="mt-2 w-full rounded-2xl border border-emerald-400/20 bg-emerald-400/15 px-4 py-3 text-sm font-bold text-emerald-100" data-testid="restaurant-table-pay-now-button">
          {paying ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Direkt bezahlen"}
        </button>
      </div>

      {paymentLink && (
        <div className="mx-4 mt-4 rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-4" data-testid="restaurant-table-payment-link-card">
          <p className="text-lg font-black text-emerald-100">Smartphone Payment</p>
          <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl bg-white p-4 text-black">
            <QRCodeSVG value={paymentLink} size={160} includeMargin />
            <p className="break-all text-center text-xs">{paymentLink}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => window.open(paymentLink, "_blank", "noopener,noreferrer")} className="rounded-2xl bg-black px-4 py-3 text-sm font-bold text-white" data-testid="restaurant-table-open-payment-link">Zahlungsseite öffnen</button>
            <button onClick={() => navigator.clipboard.writeText(paymentLink).then(() => toast.success("Zahlungslink kopiert"))} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white" data-testid="restaurant-table-copy-payment-link">Link kopieren</button>
          </div>
        </div>
      )}

      {successOrder && (
        <div className="mx-4 mt-4 rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-4" data-testid="restaurant-table-order-success">
          <p className="text-lg font-black text-emerald-100">Bestellung gesendet</p>
          <p className="mt-1 text-sm text-emerald-50/80">Order-ID {successOrder.order_id} · Gesamt €{Number(successOrder.total_price || successOrder.total || 0).toFixed(2)}</p>
        </div>
      )}

      <div className="space-y-5 px-4 py-5" data-testid="restaurant-table-scroll-content">
        {Object.entries(groupedProducts).map(([category, products]) => (
          <section key={category} data-testid={`restaurant-table-category-${category}`}>
            <h2 className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-white/40">{category}</h2>
            <div className="space-y-3">
              {products.map((product, index) => (
                <motion.div key={product.product_id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4" data-testid={`restaurant-table-product-${product.product_id}`}>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <p className="text-lg font-semibold">{product.name}</p>
                      <p className="mt-1 text-sm text-white/45">{product.description || product.category}</p>
                      <p className="mt-2 text-sm font-black text-[#FFCF8B]">€{Number(product.price || 0).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => changeQty(product.product_id, -1)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5" data-testid={`restaurant-table-minus-${product.product_id}`}><Minus size={14} /></button>
                      <span className="w-6 text-center text-lg font-black" data-testid={`restaurant-table-qty-${product.product_id}`}>{cart[product.product_id] || 0}</span>
                      <button onClick={() => changeQty(product.product_id, 1)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/15 text-cyan-100" data-testid={`restaurant-table-plus-${product.product_id}`}><Plus size={14} /></button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {Object.keys(cart).length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-cyan-400/20 bg-[#06070B]/95 p-4 backdrop-blur-xl" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
          <input value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="Name optional" className="mb-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none" data-testid="restaurant-table-guest-name-input" />
          <button onClick={placeOrder} disabled={submitting} className="w-full rounded-2xl bg-gradient-to-r from-[#00C2FF] to-[#FFA24C] px-4 py-4 text-sm font-black text-[#05070B]" data-testid="restaurant-table-submit-order-button">
            {submitting ? <Loader2 size={16} className="mx-auto animate-spin" /> : <><ShoppingCart size={16} className="mr-2 inline-block" /> Bestellung senden · €{total.toFixed(2)}</>}
          </button>
        </div>
      )}
    </div>
  );
}