/**
 * BidBlitz POS — Self-Checkout Page
 * Customer scans products, pays from own wallet, no cashier needed.
 * URL: /pos/self/:storeId
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, ScanLine, Trash2, Loader2, Check, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

async function apiCall(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

export default function SelfCheckoutPage({ storeId, onBack }) {
  const [storeInfo, setStoreInfo] = useState(null);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);   // [{product_id, name, price, qty, tax_rate, barcode}]
  const [scan, setScan] = useState("");
  const [paying, setPaying] = useState(false);
  const [completed, setCompleted] = useState(null);
  const scanRef = useRef(null);

  useEffect(() => {
    apiCall(`/api/pos/self/store/${storeId}`)
      .then(setStoreInfo)
      .catch((e) => setError(e.message));
  }, [storeId]);

  useEffect(() => { if (storeInfo) scanRef.current?.focus(); }, [storeInfo]);

  const handleScan = async (code) => {
    if (!code) return;
    try {
      const p = await apiCall(`/api/pos/self/scan/${storeId}/${encodeURIComponent(code)}`);
      if (!p.stock_ok) {
        toast.error(`${p.name} ist ausverkauft`);
        return;
      }
      setItems((prev) => {
        const idx = prev.findIndex((it) => it.product_id === p.product_id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
          return next;
        }
        return [...prev, { product_id: p.product_id, name: p.name, price: p.price, tax_rate: p.tax_rate, qty: 1, barcode: p.barcode }];
      });
      setScan("");
      toast.success(p.name);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const updateQty = (idx, delta) =>
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, qty: Math.max(1, it.qty + delta) } : it)).filter((it) => it.qty > 0),
    );
  const remove = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const total = items.reduce((s, it) => s + it.price * it.qty, 0);

  const pay = async () => {
    if (items.length === 0) return toast.error("Cart leer");
    setPaying(true);
    try {
      const cart = await apiCall("/api/pos/self/cart/create", {
        method: "POST",
        body: { store_id: storeId, items: items.map((it) => ({ product_id: it.product_id, quantity: it.qty })) },
      });
      const res = await apiCall("/api/pos/self/pay", {
        method: "POST",
        body: { cart_id: cart.cart.cart_id },
      });
      setCompleted(res.sale);
      setItems([]);
      toast.success("Zahlung erfolgreich!");
    } catch (e) {
      toast.error(e.message);
    }
    setPaying(false);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#060810] text-white flex flex-col items-center justify-center p-6">
        <ShoppingBag size={36} className="text-red-400 mb-3" />
        <p className="text-sm text-red-400 mb-4">{error}</p>
        <button onClick={onBack} className="px-4 py-2 rounded-xl bg-white/10 text-sm">Zurück</button>
      </div>
    );
  }

  if (!storeInfo) {
    return (
      <div className="min-h-screen bg-[#060810] text-white flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#00C2FF]" />
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-[#060810] text-white flex flex-col items-center justify-center p-6">
        <Check size={56} className="text-[#10B981] mb-3" />
        <h1 className="text-3xl font-black mb-1">Vielen Dank!</h1>
        <p className="text-sm text-white/60 mb-6">Beleg: {completed.receipt_id}</p>
        <p className="text-4xl font-black text-[#00C2FF] mb-6">€{completed.total.toFixed(2)}</p>
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
          <a href={`${API}/api/pos/receipts/${completed.receipt_id}/pdf`} target="_blank" rel="noopener noreferrer"
            className="py-3 rounded-xl bg-white/10 text-center font-bold text-sm">PDF Beleg</a>
          <button onClick={() => setCompleted(null)} className="py-3 rounded-xl bg-[#00C2FF] text-black font-bold text-sm">
            Neuer Einkauf
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060810] text-white" data-testid="self-checkout">
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#060810]/90 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 py-3 pt-[max(env(safe-area-inset-top,0px),14px)]">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
            <ArrowLeft size={15} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold truncate">{storeInfo.merchant_name}</p>
            <p className="text-[10px] text-white/50">Self-Checkout · {storeInfo.store_name} · {storeInfo.city}</p>
          </div>
          <span className="px-2 py-1 rounded-full bg-[#10B981]/15 text-[#10B981] text-[10px] font-bold">SELF</span>
        </div>
      </div>

      <div className="p-4 pb-32 space-y-3">
        {/* Scanner */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-white/5 border-2 border-[#00C2FF]/40 rounded-xl px-3 py-2.5">
            <ScanLine size={18} className="text-[#00C2FF]" />
            <input ref={scanRef} value={scan} onChange={(e) => setScan(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleScan(scan); }}
              placeholder="Barcode scannen oder eingeben..."
              className="flex-1 bg-transparent text-white text-base font-mono outline-none"
              data-testid="self-scan" />
            {scan && <button onClick={() => handleScan(scan)} className="text-[#00C2FF] text-xs font-bold">SCAN</button>}
          </div>
        </div>

        {/* Items */}
        {items.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <ShoppingBag size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Scanne den ersten Artikel</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0" data-testid={`self-item-${i}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] truncate">{it.name}</p>
                  <p className="text-[10px] text-white/50">€{it.price.toFixed(2)} × {it.qty}</p>
                </div>
                <button onClick={() => updateQty(i, -1)} className="w-8 h-8 rounded-lg bg-white/10 text-lg">−</button>
                <span className="w-7 text-center font-bold">{it.qty}</span>
                <button onClick={() => updateQty(i, +1)} className="w-8 h-8 rounded-lg bg-white/10 text-lg">+</button>
                <button onClick={() => remove(i)} className="text-red-400"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky bottom pay bar */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 backdrop-blur-xl bg-[#060810]/95 border-t border-white/[0.06] p-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-white/60">{items.reduce((s, it) => s + it.qty, 0)} Artikel</span>
            <span className="text-2xl font-black text-[#00C2FF]" data-testid="self-total">€{total.toFixed(2)}</span>
          </div>
          <button onClick={pay} disabled={paying}
            className="w-full py-4 rounded-xl bg-[#00C2FF] text-black font-black text-base disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="self-pay">
            {paying ? <Loader2 size={18} className="animate-spin" /> : `Mit BidBlitz Wallet zahlen — €${total.toFixed(2)}`}
          </button>
        </div>
      )}
    </div>
  );
}
