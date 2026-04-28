import { useState, useEffect } from "react";
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

function Card({ title, children, testid, className = "" }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 p-4 ${className}`} data-testid={testid}>
      {title && <h3 className="text-sm font-bold mb-2 text-white/90">{title}</h3>}
      {children}
    </div>
  );
}

function Stat({ label, value, color, testid }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4" data-testid={testid}>
      <p className="text-[11px] text-white/60 mb-1">{label}</p>
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
    </div>
  );
}

function CreateStorePrompt({ onCreated }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const create = async () => {
    if (!name) return toast.error("Name fehlt");
    try {
      await apiCall("/api/pos/stores/create", { method: "POST", body: { name, city, country: "DE" } });
      toast.success("Filiale angelegt");
      onCreated();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Card title="Erste Filiale anlegen">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Filialname"
        className="w-full px-3 py-2 mb-2 bg-white/5 border border-white/10 rounded-lg text-[12px]" data-testid="pos-store-name" />
      <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Stadt"
        className="w-full px-3 py-2 mb-2 bg-white/5 border border-white/10 rounded-lg text-[12px]" />
      <button onClick={create} className="px-3 py-2 rounded-lg bg-[#00C2FF] text-black text-[11px] font-bold" data-testid="pos-store-create">
        Filiale anlegen
      </button>
    </Card>
  );
}

function CreateRegisterPrompt({ storeId, onCreated }) {
  const [name, setName] = useState("Kasse 1");
  const create = async () => {
    try {
      await apiCall("/api/pos/registers/create", { method: "POST", body: { store_id: storeId, name } });
      toast.success("Kasse angelegt");
      onCreated();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Card title="Erste Kasse anlegen">
      <input value={name} onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 mb-2 bg-white/5 border border-white/10 rounded-lg text-[12px]" data-testid="pos-reg-name" />
      <button onClick={create} className="px-3 py-2 rounded-lg bg-[#00C2FF] text-black text-[11px] font-bold" data-testid="pos-reg-create">
        Kasse anlegen
      </button>
    </Card>
  );
}

export default function POSDashboardTab({ merchant, stores, registers, storeId, registerId, shift, onSetupStore, setTab }) {
  const [summary, setSummary] = useState(null);
  const [low, setLow] = useState([]);
  
  useEffect(() => {
    apiCall("/api/pos/dashboard/summary?period=today").then(setSummary).catch(() => {});
    apiCall("/api/pos/stock/low").then((d) => setLow(d.products || [])).catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      {stores.length === 0 && <CreateStorePrompt onCreated={onSetupStore} />}
      {stores.length > 0 && registers.filter((r) => r.store_id === storeId).length === 0 && (
        <CreateRegisterPrompt storeId={storeId} onCreated={onSetupStore} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Heute Umsatz" value={`€${(summary?.totals?.sales_total ?? 0).toFixed(2)}`} color="#00C2FF" testid="pos-stat-revenue" />
        <Stat label="Verkäufe" value={summary?.totals?.sales_count ?? 0} color="#10B981" testid="pos-stat-count" />
        <Stat label="Erstattungen" value={`€${(summary?.totals?.refund_total ?? 0).toFixed(2)}`} color="#F59E0B" />
        <Stat label="Settlement" value={`€${(merchant?.settlement_balance ?? 0).toFixed(2)}`} color="#A855F7" />
      </div>

      <Card title="Aktuelle Schicht" testid="pos-shift-card">
        {shift ? (
          <div className="text-[12px] space-y-1">
            <p>Eröffnet: {new Date(shift.opened_at).toLocaleString()}</p>
            <p>Kasse: {registerId} — Verkäufe: {shift.sales_count} (€{shift.sales_total?.toFixed(2)})</p>
            <button onClick={() => setTab("checkout")} className="mt-2 px-3 py-1.5 rounded-lg bg-[#00C2FF] text-black text-[11px] font-bold">
              Zur Kasse →
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-white/50">Keine offene Schicht. Wechsle zur Kasse, um eine zu öffnen.</p>
        )}
      </Card>

      {low.length > 0 && (
        <Card title={`⚠️ Niedrige Bestände (${low.length})`}>
          <div className="space-y-1.5">
            {low.slice(0, 5).map((p) => (
              <div key={p.product_id} className="flex justify-between text-[11px] py-1 border-b border-white/5">
                <span>{p.name}</span>
                <span className="text-amber-400">{p.stock} / {p.minimum_stock}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Zahlungsmethoden heute">
        {summary?.by_method?.length ? summary.by_method.map((m) => (
          <div key={m.method} className="flex justify-between text-[12px] py-1">
            <span className="capitalize">{m.method.replace("_", " ")}</span>
            <span className="font-bold">€{m.amount.toFixed(2)}</span>
          </div>
        )) : <p className="text-[11px] text-white/40">Noch keine Daten</p>}
      </Card>
    </div>
  );
}
