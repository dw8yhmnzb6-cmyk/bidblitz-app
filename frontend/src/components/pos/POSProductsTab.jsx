import { useState, useEffect, useCallback } from "react";
import { Plus, Edit3 } from "lucide-react";
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

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      {title && <h3 className="text-sm font-bold mb-2 text-white/90">{title}</h3>}
      {children}
    </div>
  );
}

function ProductForm({ storeId, editing, onSaved, onCancel }) {
  const [f, setF] = useState(editing || {
    name: "", barcode: "", sku: "", price: 0, purchase_price: 0, tax_rate: 0.19,
    stock: 0, minimum_stock: 0, unit: "Stk", category: "", track_stock: true,
  });
  const save = async () => {
    if (!f.name) return toast.error("Name fehlt");
    try {
      if (editing) {
        await apiCall("/api/pos/products/update", { method: "POST", body: { product_id: editing.product_id, ...f } });
      } else {
        await apiCall("/api/pos/products/create", { method: "POST", body: { store_id: storeId, ...f } });
      }
      toast.success("Gespeichert");
      onSaved();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Card title={editing ? "Produkt bearbeiten" : "Neues Produkt"}>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name *"
          className="col-span-2 px-2 py-2 bg-white/5 border border-white/10 rounded text-[12px]" data-testid="pos-prod-name" />
        <input value={f.barcode || ""} onChange={(e) => setF({ ...f, barcode: e.target.value })} placeholder="Barcode/EAN"
          className="px-2 py-2 bg-white/5 border border-white/10 rounded" data-testid="pos-prod-barcode" />
        <input value={f.sku || ""} onChange={(e) => setF({ ...f, sku: e.target.value })} placeholder="SKU"
          className="px-2 py-2 bg-white/5 border border-white/10 rounded" />
        <input type="number" step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: parseFloat(e.target.value) || 0 })} placeholder="Preis €"
          className="px-2 py-2 bg-white/5 border border-white/10 rounded" data-testid="pos-prod-price" />
        <input type="number" step="0.01" value={f.purchase_price} onChange={(e) => setF({ ...f, purchase_price: parseFloat(e.target.value) || 0 })} placeholder="EK €"
          className="px-2 py-2 bg-white/5 border border-white/10 rounded" />
        <input type="number" step="0.01" value={f.tax_rate} onChange={(e) => setF({ ...f, tax_rate: parseFloat(e.target.value) || 0.19 })} placeholder="MwSt (0.19)"
          className="px-2 py-2 bg-white/5 border border-white/10 rounded" />
        <input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="Einheit"
          className="px-2 py-2 bg-white/5 border border-white/10 rounded" />
        <input type="number" value={f.stock} onChange={(e) => setF({ ...f, stock: parseFloat(e.target.value) || 0 })} placeholder="Bestand"
          className="px-2 py-2 bg-white/5 border border-white/10 rounded" data-testid="pos-prod-stock" />
        <input type="number" value={f.minimum_stock} onChange={(e) => setF({ ...f, minimum_stock: parseFloat(e.target.value) || 0 })} placeholder="Mindestbestand"
          className="px-2 py-2 bg-white/5 border border-white/10 rounded" />
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={save} className="flex-1 py-2 rounded-lg bg-[#00C2FF] text-black font-bold text-[12px]" data-testid="pos-prod-save">Speichern</button>
        <button onClick={onCancel} className="px-3 py-2 rounded-lg bg-white/10 text-[11px]">Abbrechen</button>
      </div>
    </Card>
  );
}

export default function POSProductsTab({ storeId }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!storeId) return;
    const r = await apiCall(`/api/pos/products/search?store_id=${storeId}&q=${encodeURIComponent(search)}&limit=200`);
    setItems(r.products || []);
  }, [storeId, search]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suchen..."
          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[12px]" data-testid="pos-prod-search" />
        <button onClick={() => setShowCreate(true)} className="px-3 py-2 rounded-xl bg-[#00C2FF] text-black flex items-center gap-1 text-[11px] font-bold"
          data-testid="pos-prod-new">
          <Plus size={13} /> Neu
        </button>
      </div>
      {showCreate && <ProductForm storeId={storeId} onSaved={() => { setShowCreate(false); load(); }} onCancel={() => setShowCreate(false)} />}
      {editing && <ProductForm storeId={storeId} editing={editing} onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />}

      <div className="space-y-2">
        {items.map((p) => (
          <Card key={p.product_id}>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold truncate">{p.name}</p>
                <p className="text-[10px] text-white/50">{p.barcode || "—"} · {p.sku || ""} · {p.stock} {p.unit}</p>
              </div>
              <span className="text-sm font-black text-[#00C2FF]">€{p.price.toFixed(2)}</span>
              <button onClick={() => setEditing(p)} className="text-white/60 hover:text-white"><Edit3 size={13} /></button>
            </div>
          </Card>
        ))}
        {items.length === 0 && <p className="text-[11px] text-white/40 text-center py-4">Keine Produkte</p>}
      </div>
    </div>
  );
}
