import { useState, useEffect, useCallback } from "react";
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

function Card({ title, children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 p-4 ${className}`}>
      {title && <h3 className="text-sm font-bold mb-2 text-white/90">{title}</h3>}
      {children}
    </div>
  );
}

function StockAdjustModal({ product, onClose, onAdjust }) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("adjustment");
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4">
      <Card title={`Bestand: ${product.name}`} className="w-full max-w-sm">
        <p className="text-[11px] text-white/60 mb-2">Aktuell: {product.stock} {product.unit}</p>
        <input type="number" step="0.01" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="Delta (z.B. -3 oder +10)"
          className="w-full px-3 py-2 mb-2 bg-white/5 border border-white/10 rounded-lg text-[12px]" data-testid="pos-adj-delta" />
        <select value={reason} onChange={(e) => setReason(e.target.value)}
          className="w-full px-3 py-2 mb-2 bg-white/5 border border-white/10 rounded-lg text-[12px]">
          <option value="adjustment">Korrektur</option>
          <option value="damage">Beschädigt</option>
          <option value="recount">Inventur</option>
          <option value="transfer">Umlagerung</option>
          <option value="return">Rückgabe</option>
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notiz"
          className="w-full px-3 py-2 mb-3 bg-white/5 border border-white/10 rounded-lg text-[12px]" />
        <div className="flex gap-2">
          <button onClick={() => onAdjust(product.product_id, parseFloat(delta || 0), reason, note)}
            className="flex-1 py-2 rounded-lg bg-[#00C2FF] text-black font-bold text-[12px]" data-testid="pos-adj-save">Übernehmen</button>
          <button onClick={onClose} className="px-3 py-2 rounded-lg bg-white/10 text-[11px]">Abbrechen</button>
        </div>
      </Card>
    </div>
  );
}

export default function POSInventoryTab({ storeId }) {
  const [products, setProducts] = useState([]);
  const [low, setLow] = useState([]);
  const [adjusting, setAdjusting] = useState(null);
  
  const load = useCallback(async () => {
    if (!storeId) return;
    const r = await apiCall(`/api/pos/products/search?store_id=${storeId}&limit=300`);
    setProducts(r.products || []);
    const l = await apiCall(`/api/pos/stock/low?store_id=${storeId}`);
    setLow(l.products || []);
  }, [storeId]);
  useEffect(() => { load(); }, [load]);

  const adjust = async (id, delta, reason, note) => {
    try {
      await apiCall(`/api/pos/products/${id}/stock-adjust`, { method: "POST", body: { product_id: id, delta, reason, note } });
      toast.success("Bestand aktualisiert");
      setAdjusting(null);
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3">
      {low.length > 0 && (
        <Card title={`⚠️ ${low.length} Produkte unter Mindestbestand`}>
          <div className="space-y-1.5">
            {low.map((p) => (
              <div key={p.product_id} className="flex justify-between items-center text-[11px]">
                <span>{p.name}</span>
                <span className="text-amber-400 font-bold">{p.stock} / {p.minimum_stock}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card title={`Produktbestand (${products.length})`}>
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.product_id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] truncate">{p.name}</p>
                <p className="text-[9px] text-white/40">{p.barcode || "—"}</p>
              </div>
              <span className="text-[12px] font-bold tabular-nums w-16 text-right">{p.stock} {p.unit}</span>
              <button onClick={() => setAdjusting(p)} className="ml-2 text-[10px] text-[#00C2FF]">±</button>
            </div>
          ))}
        </div>
      </Card>
      {adjusting && <StockAdjustModal product={adjusting} onClose={() => setAdjusting(null)} onAdjust={adjust} />}
    </div>
  );
}
