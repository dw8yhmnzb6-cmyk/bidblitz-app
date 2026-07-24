/**
 * BidBlitz Public Table Order — Gast scannt QR am Tisch und bestellt
 * Kein Login benötigt. Bestellung geht direkt an KDS + Kasse.
 */
import { useState, useEffect } from "react";
import { Loader2, Plus, Minus, ShoppingCart, Check } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export default function PublicTableOrderPage({ qrToken: propToken }) {
  const qrToken = propToken || window.location.pathname.split("/").pop();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState({}); // {product_id: qty}
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/api/pos/public/order/${qrToken}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.detail || "Fehler");
        setData(d);
      } catch (e) { toast.error(e.message); }
      setLoading(false);
    })();
  }, [qrToken]);

  const setQty = (pid, delta) => {
    setCart((c) => {
      const n = (c[pid] || 0) + delta;
      const next = { ...c };
      if (n <= 0) delete next[pid];
      else next[pid] = n;
      return next;
    });
  };

  const total = data?.products
    ? Object.entries(cart).reduce((sum, [pid, q]) => {
        const p = data.products.find((x) => x.product_id === pid);
        return sum + (p ? p.price * q : 0);
      }, 0)
    : 0;

  const submit = async () => {
    if (Object.keys(cart).length === 0) return toast.error("Warenkorb leer");
    try {
      const r = await fetch(`${API}/api/pos/public/order/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qr_token: qrToken,
          guest_name: name || null,
          items: Object.entries(cart).map(([pid, q]) => ({ product_id: pid, quantity: q })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Fehler");
      setSubmitted(d);
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-[#00C2FF]" /></div>;
  if (!data) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Tisch nicht gefunden.</div>;

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#060810] text-white flex flex-col items-center justify-center p-6" data-testid="order-success">
        <div className="w-20 h-20 rounded-full bg-[#10B981]/20 flex items-center justify-center mb-4">
          <Check size={40} className="text-[#10B981]" />
        </div>
        <h1 className="text-[24px] font-black mb-2">Bestellung aufgenommen!</h1>
        <p className="text-white/60 mb-6 text-center">Wir bringen es gleich an Tisch <strong className="text-[#00C2FF]">{data.table.number}</strong></p>
        <p className="text-[14px] text-white/40">Gesamt: <span className="text-[#00C2FF] font-bold text-[18px]">€{submitted.total}</span></p>
        <button onClick={() => { setSubmitted(null); setCart({}); }} className="mt-8 px-6 py-3 bg-white/5 rounded-xl text-[12px] font-bold" data-testid="order-again-btn">Weitere Bestellung</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060810] text-white pb-32" data-testid="public-order-page">
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-white/10 px-4 py-3">
        <h1 className="text-[18px] font-black">{data.store?.name || "Speisekarte"}</h1>
        <p className="text-[10px] text-white/40">Tisch {data.table.number} · {data.table.seats} Plätze</p>
      </div>

      <div className="p-4 space-y-2">
        {data.products.map((p) => (
          <div key={p.product_id} className="bg-white/[0.04] rounded-xl p-3 flex items-center gap-3" data-testid={`prod-${p.product_id}`}>
            <div className="flex-1">
              <p className="text-[14px] font-bold">{p.name}</p>
              <p className="text-[10px] text-white/40">{p.category}</p>
              <p className="text-[12px] text-[#00C2FF] font-bold">€{p.price?.toFixed(2)}</p>
            </div>
            {cart[p.product_id] ? (
              <div className="flex items-center gap-2">
                <button onClick={() => setQty(p.product_id, -1)} className="w-8 h-8 rounded-lg bg-white/5" data-testid={`minus-${p.product_id}`}><Minus size={14} /></button>
                <span className="w-6 text-center text-[14px] font-bold" data-testid={`qty-${p.product_id}`}>{cart[p.product_id]}</span>
                <button onClick={() => setQty(p.product_id, 1)} className="w-8 h-8 rounded-lg bg-[#00C2FF]/20 text-[#00C2FF]" data-testid={`plus-${p.product_id}`}><Plus size={14} /></button>
              </div>
            ) : (
              <button onClick={() => setQty(p.product_id, 1)} className="px-3 py-1.5 bg-[#00C2FF]/20 text-[#00C2FF] rounded-lg text-[11px] font-bold" data-testid={`add-${p.product_id}`}>+ Hinzufügen</button>
            )}
          </div>
        ))}
      </div>

      {Object.keys(cart).length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-[#00C2FF]/30 p-4">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Dein Name (optional)" data-testid="guest-name"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white outline-none mb-2" />
          <button onClick={submit} data-testid="submit-order-btn"
            className="w-full py-3 rounded-xl text-white font-bold flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#00C2FF,#0080FF)" }}>
            <ShoppingCart size={14} /> Bestellen für €{total.toFixed(2)}
          </button>
        </div>
      )}
    </div>
  );
}
