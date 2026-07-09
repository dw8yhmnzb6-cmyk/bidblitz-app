/**
 * BidBlitz POS / Warenwirtschaftssystem — komplett
 * Production-ready POS-Hub mit allen Modulen:
 *   Checkout · Produkte · Bestand · Bewegungen · Lieferanten · Bestellungen ·
 *   Belege · Erstattungen · Berichte · Dashboard · Admin
 *
 * One file, in-memory state, pulls from /api/pos/*.  No fake data.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, ScanLine, Plus, Search, Trash2, Loader2, Check, X,
  Package, Warehouse, Truck, FileText, RotateCcw, BarChart3, Home,
  ShieldCheck, Banknote, QrCode, CreditCard, Smartphone, Store,
  AlertTriangle, Edit3, Download, RefreshCw, MessageCircle, Send, Check as CheckIcon,
  Sparkles, Users,
} from "lucide-react";
import { toast } from "sonner";
import { printReceipt, isBluetoothSupported } from "../utils/escposPrinter";
import POSAdvancedTab from "./POSAdvancedTab";
import POSProTab from "./POSProTab";
import POSComplianceTab from "./POSComplianceTab";
import POSRestaurantTab from "./POSRestaurantTab";
import POSDashboardTab from "../components/pos/POSDashboardTab";
import POSCheckoutTab from "../components/pos/POSCheckoutTab";
import POSProductsTab from "../components/pos/POSProductsTab";
import POSInventoryTab from "../components/pos/POSInventoryTab";
import { POSMerchantFeatures, POSAdminFeatures } from "../components/pos/POSFeaturesComponents";
import { 
  VoidReceiptModal, 
  ReturnModal, 
  WeightedProductScanner, 
  SupervisorConsole 
} from "../components/pos/POSRetailEnterpriseComponents";
import { POSHardwareModal } from "../components/pos/POSHardwareModal";
import { AgeVerificationModal } from "../components/pos/AgeVerificationModal";

const API = process.env.REACT_APP_BACKEND_URL;

// ───────────────────────── HTTP helper
async function apiCall(path, { method = "GET", body, raw = false } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

// ───────────────────────── Tab definitions
const TABS = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "checkout", label: "Kasse", icon: ScanLine },
  { id: "products", label: "Produkte", icon: Package },
  { id: "inventory", label: "Bestand", icon: Warehouse },
  { id: "movements", label: "Bewegungen", icon: RefreshCw },
  { id: "suppliers", label: "Lieferanten", icon: Truck },
  { id: "orders", label: "Bestellungen", icon: FileText },
  { id: "receipts", label: "Belege", icon: FileText },
  { id: "refunds", label: "Erstattungen", icon: RotateCcw },
  { id: "approvals", label: "Freigaben", icon: ShieldCheck },
  { id: "chat", label: "Team-Chat", icon: MessageCircle },
  { id: "retail", label: "Retail Pro", icon: Store },
  { id: "restaurant", label: "Restaurant", icon: Users },
  { id: "supervisor", label: "Supervisor", icon: ShieldCheck },
  { id: "reports", label: "Berichte", icon: BarChart3 },
  { id: "advanced", label: "Mega-Tools", icon: Sparkles },
  { id: "pro", label: "Pro / Compliance", icon: Sparkles },
  { id: "compliance", label: "Compliance", icon: ShieldCheck },
  { id: "addons", label: "Add-Ons", icon: Sparkles },
  { id: "admin", label: "Admin", icon: ShieldCheck },
];

function ApprovalsTab({ storeId }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4" data-testid="pos-approvals-tab">
      <h3 className="text-sm font-semibold text-white">Freigaben</h3>
      <p className="mt-2 text-xs text-white/70">
        Freigaben für Store {storeId || "—"} laufen aktuell über Supervisor- und Admin-Tools.
      </p>
    </div>
  );
}

function ChatTab({ storeId }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4" data-testid="pos-chat-tab">
      <h3 className="text-sm font-semibold text-white">Team-Chat</h3>
      <p className="mt-2 text-xs text-white/70">
        Der Team-Chat für Store {storeId || "—"} ist im aktuellen Build als kompakter Hinweis eingebunden.
      </p>
    </div>
  );
}

// ───────────────────────── Main shell
export default function POSPage({ onBack }) {
  const [tab, setTab] = useState("dashboard");
  const [merchant, setMerchant] = useState(null);
  const [stores, setStores] = useState([]);
  const [registers, setRegisters] = useState([]);
  const [storeId, setStoreId] = useState("");
  const [registerId, setRegisterId] = useState("");
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);

  // bootstrap
  const refresh = useCallback(async () => {
    try {
      const m = await apiCall("/api/pos/merchants/me");
      setMerchant(m.merchant);
      if (m.merchant) {
        const s = await apiCall("/api/pos/stores");
        setStores(s.stores || []);
        if (s.stores?.length) {
          const sid = s.stores[0].store_id;
          setStoreId(sid);
          const r = await apiCall("/api/pos/registers");
          setRegisters(r.registers || []);
          const firstReg = r.registers?.find((reg) => reg.store_id === sid);
          if (firstReg) {
            setRegisterId(firstReg.register_id);
            const sh = await apiCall(`/api/pos/shift/current?register_id=${firstReg.register_id}`);
            setShift(sh.shift);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060810] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#00C2FF]" />
      </div>
    );
  }

  if (!merchant) {
    return <MerchantOnboarding onBack={onBack} onDone={refresh} />;
  }

  return (
    <div className="min-h-screen bg-[#060810] text-white" data-testid="pos-page" data-cookie-banner-suppress="true">
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#060810]/90 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 py-3 pt-[max(env(safe-area-inset-top,0px),14px)]">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="pos-back">
            <ArrowLeft size={15} className="text-white/70" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold truncate">{merchant.business_name}</p>
            <p className="text-[10px] text-white/50">
              {merchant.status === "approved" ? "✓ Aktiviert" : merchant.status === "pending" ? "⏳ Wartet auf Freischaltung" : merchant.status}
              {" · "}Gebühr {(merchant.fee_rate * 100).toFixed(2)}%
            </p>
          </div>
          {storeId && (
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg text-[11px] px-2 py-1.5 outline-none">
              {stores.map((s) => <option key={s.store_id} value={s.store_id}>{s.name}</option>)}
            </select>
          )}
          {storeId && (
            <select value={registerId} onChange={(e) => setRegisterId(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg text-[11px] px-2 py-1.5 outline-none">
              {registers.filter((r) => r.store_id === storeId).map((r) => (
                <option key={r.register_id} value={r.register_id}>{r.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto px-3 pb-2 hide-scrollbar">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap"
              style={{
                background: tab === t.id ? "rgba(0,194,255,0.15)" : "rgba(255,255,255,0.04)",
                color: tab === t.id ? "#00C2FF" : "rgba(255,255,255,0.6)",
                border: tab === t.id ? "1px solid rgba(0,194,255,0.3)" : "1px solid transparent",
              }}
              data-testid={`pos-tab-${t.id}`}>
              <t.icon size={12} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 pb-24">
        {tab === "dashboard" && <POSDashboardTab merchant={merchant} stores={stores} registers={registers}
                                              storeId={storeId} registerId={registerId} shift={shift}
                                              onSetupStore={refresh} setTab={setTab} />}
        {tab === "checkout" && <POSCheckoutTab storeId={storeId} registerId={registerId} shift={shift}
                                            onShiftChange={async () => {
                                              const sh = await apiCall(`/api/pos/shift/current?register_id=${registerId}`);
                                              setShift(sh.shift);
                                            }} />}
        {tab === "products" && <POSProductsTab storeId={storeId} />}
        {tab === "inventory" && <POSInventoryTab storeId={storeId} />}
        {tab === "movements" && <MovementsTab storeId={storeId} />}
        {tab === "suppliers" && <SuppliersTab />}
        {tab === "orders" && <PurchaseOrdersTab storeId={storeId} />}
        {tab === "receipts" && <ReceiptsTab storeId={storeId} />}
        {tab === "refunds" && <RefundsTab storeId={storeId} />}
        {tab === "approvals" && <ApprovalsTab storeId={storeId} />}
        {tab === "chat" && <ChatTab storeId={storeId} />}
        {tab === "reports" && <ReportsTab />}
        {tab === "advanced" && <POSAdvancedTab storeId={storeId} registerId={registerId} />}
        {tab === "pro" && <POSProTab storeId={storeId} registerId={registerId} />}
        {tab === "compliance" && <POSComplianceTab storeId={storeId} />}
        {tab === "addons" && <POSMerchantFeatures />}
        {tab === "admin" && <AdminTab />}
        {tab === "retail" && <RetailTab storeId={storeId} />}
        {tab === "supervisor" && <SupervisorTab storeId={storeId} />}
        {tab === "restaurant" && <POSRestaurantTab storeId={storeId} />}
      </div>
    </div>
  );
}

// ───────────────────────── Onboarding Wizard (Profil → Filiale → Kasse → Produkt)
function MerchantOnboarding({ onBack, onDone }) {
  const [step, setStep] = useState(1);
  const [merchant, setMerchant] = useState(null);
  const [store, setStore] = useState(null);
  const [register, setRegister] = useState(null);
  const [saving, setSaving] = useState(false);

  // Step 1: Profile
  const [m, setM] = useState({ business_name: "", business_type: "retail", country: "DE", contact_phone: "" });
  // Step 2: Store
  const [s, setS] = useState({ name: "", city: "", address: "" });
  // Step 3: Register
  const [r, setR] = useState({ name: "Kasse 1", location: "" });
  // Step 4: Product
  const [p, setP] = useState({ name: "", barcode: "", price: 0, tax_rate: 0.19, stock: 0, unit: "Stk" });

  const submitMerchant = async () => {
    if (!m.business_name) return toast.error("Firmenname fehlt");
    setSaving(true);
    try {
      const res = await apiCall("/api/pos/merchants/register", { method: "POST", body: m });
      setMerchant(res.merchant);
      toast.success("Profil angelegt");
      setStep(2);
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  const submitStore = async () => {
    if (!s.name) return toast.error("Filialname fehlt");
    setSaving(true);
    try {
      const res = await apiCall("/api/pos/stores/create", { method: "POST", body: { ...s, country: m.country } });
      setStore(res.store);
      toast.success("Filiale erstellt");
      setStep(3);
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  const submitRegister = async () => {
    setSaving(true);
    try {
      const res = await apiCall("/api/pos/registers/create", { method: "POST", body: { store_id: store.store_id, ...r } });
      setRegister(res.register);
      toast.success("Kasse angelegt");
      setStep(4);
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  const submitProduct = async () => {
    if (!p.name) return finish();
    setSaving(true);
    try {
      await apiCall("/api/pos/products/create", { method: "POST", body: { store_id: store.store_id, ...p, track_stock: true } });
      toast.success("Produkt angelegt");
      finish();
    } catch (e) { toast.error(e.message); setSaving(false); }
  };

  const finish = () => {
    toast.success("Setup abgeschlossen!");
    onDone();
  };

  const StepBar = (
    <div className="flex items-center gap-1 mb-5">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className="flex-1 h-1.5 rounded-full"
          style={{ background: step >= n ? "#00C2FF" : "rgba(255,255,255,0.1)" }} />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#060810] text-white p-5">
      <button onClick={onBack} className="mb-4 flex items-center gap-2 text-white/70 text-sm" data-testid="pos-onb-back">
        <ArrowLeft size={16} /> Zurück
      </button>
      <h1 className="text-2xl font-black mb-1">BidBlitz POS Setup</h1>
      <p className="text-white/60 text-sm mb-5">Schritt {step} von 4</p>
      {StepBar}

      {step === 1 && (
        <div className="space-y-3 max-w-md">
          <h2 className="text-lg font-bold">1. Dein Geschäftsprofil</h2>
          <Field label="Firmenname *">
            <input value={m.business_name} onChange={(e) => setM({ ...m, business_name: e.target.value })}
              className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white" data-testid="pos-onb-name" />
          </Field>
          <Field label="Branche">
            <select value={m.business_type} onChange={(e) => setM({ ...m, business_type: e.target.value })}
              className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white">
              <option value="retail">Einzelhandel</option>
              <option value="supermarket">Supermarkt</option>
              <option value="restaurant">Restaurant</option>
              <option value="kiosk">Kiosk</option>
              <option value="other">Sonstige</option>
            </select>
          </Field>
          <Field label="Telefon">
            <input value={m.contact_phone} onChange={(e) => setM({ ...m, contact_phone: e.target.value })}
              className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white" />
          </Field>
          <button onClick={submitMerchant} disabled={saving}
            className="w-full py-3.5 rounded-xl bg-[#00C2FF] text-black font-black disabled:opacity-50 mt-2"
            data-testid="pos-onb-submit-1">
            {saving ? <Loader2 size={16} className="animate-spin inline" /> : "Weiter →"}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3 max-w-md">
          <h2 className="text-lg font-bold">2. Erste Filiale</h2>
          <Field label="Filialname *">
            <input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })}
              className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white" data-testid="pos-onb-store" />
          </Field>
          <Field label="Stadt">
            <input value={s.city} onChange={(e) => setS({ ...s, city: e.target.value })}
              className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white" />
          </Field>
          <Field label="Adresse">
            <input value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })}
              className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white" />
          </Field>
          <button onClick={submitStore} disabled={saving}
            className="w-full py-3.5 rounded-xl bg-[#00C2FF] text-black font-black disabled:opacity-50 mt-2"
            data-testid="pos-onb-submit-2">
            {saving ? <Loader2 size={16} className="animate-spin inline" /> : "Weiter →"}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3 max-w-md">
          <h2 className="text-lg font-bold">3. Erste Kasse</h2>
          <Field label="Kassenname">
            <input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })}
              className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white" data-testid="pos-onb-register" />
          </Field>
          <Field label="Standort (optional)">
            <input value={r.location} onChange={(e) => setR({ ...r, location: e.target.value })} placeholder="z.B. Eingang links"
              className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white" />
          </Field>
          <button onClick={submitRegister} disabled={saving}
            className="w-full py-3.5 rounded-xl bg-[#00C2FF] text-black font-black disabled:opacity-50 mt-2"
            data-testid="pos-onb-submit-3">
            {saving ? <Loader2 size={16} className="animate-spin inline" /> : "Weiter →"}
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3 max-w-md">
          <h2 className="text-lg font-bold">4. Erstes Produkt (optional)</h2>
          <p className="text-[11px] text-white/50">Du kannst diesen Schritt überspringen und Produkte später anlegen.</p>
          <Field label="Produktname">
            <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })}
              className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white" data-testid="pos-onb-product" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Barcode">
              <input value={p.barcode} onChange={(e) => setP({ ...p, barcode: e.target.value })}
                className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white" />
            </Field>
            <Field label="Preis €">
              <input type="number" step="0.01" value={p.price} onChange={(e) => setP({ ...p, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white" />
            </Field>
            <Field label="Bestand">
              <input type="number" value={p.stock} onChange={(e) => setP({ ...p, stock: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white" />
            </Field>
            <Field label="Einheit">
              <input value={p.unit} onChange={(e) => setP({ ...p, unit: e.target.value })}
                className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button onClick={finish} disabled={saving}
              className="py-3 rounded-xl bg-white/10 text-white font-bold" data-testid="pos-onb-skip">
              Überspringen
            </button>
            <button onClick={submitProduct} disabled={saving}
              className="py-3 rounded-xl bg-[#00C2FF] text-black font-black disabled:opacity-50"
              data-testid="pos-onb-submit-4">
              {saving ? <Loader2 size={16} className="animate-spin inline" /> : "Anlegen ✓"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Movements
function MovementsTab({ storeId }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!storeId) return;
    apiCall(`/api/pos/stock/movements?store_id=${storeId}&limit=200`).then((d) => setItems(d.movements || [])).catch(() => {});
  }, [storeId]);
  const colorMap = { sale: "#EF4444", purchase: "#10B981", return: "#10B981", adjustment: "#F59E0B", damage: "#EF4444", transfer: "#A855F7", recount: "#F59E0B" };
  return (
    <Card title={`Lagerbewegungen (${items.length})`}>
      {items.map((m) => (
        <div key={m.movement_id} className="py-2 border-b border-white/5 last:border-0 flex items-center gap-2 text-[11px]">
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase" style={{ background: colorMap[m.type] + "22", color: colorMap[m.type] || "white" }}>{m.type}</span>
          <span className="flex-1 truncate">{m.product_name}</span>
          <span className="font-bold tabular-nums" style={{ color: m.quantity > 0 ? "#10B981" : "#EF4444" }}>{m.quantity > 0 ? "+" : ""}{m.quantity}</span>
          <span className="text-white/40 text-[9px]">{new Date(m.created_at).toLocaleDateString()}</span>
        </div>
      ))}
      {items.length === 0 && <p className="text-[11px] text-white/40 text-center py-4">Keine Bewegungen</p>}
    </Card>
  );
}

// ───────────────────────── Suppliers
function SuppliersTab() {
  const [items, setItems] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [f, setF] = useState({ name: "", contact_person: "", email: "", phone: "" });
  const load = async () => {
    const d = await apiCall("/api/pos/suppliers");
    setItems(d.suppliers || []);
  };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!f.name) return toast.error("Name fehlt");
    try {
      await apiCall("/api/pos/suppliers/create", { method: "POST", body: f });
      toast.success("Lieferant angelegt");
      setShowNew(false); setF({ name: "", contact_person: "", email: "", phone: "" });
      load();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="space-y-3">
      <button onClick={() => setShowNew(!showNew)} className="px-3 py-2 rounded-xl bg-[#00C2FF] text-black flex items-center gap-1 text-[11px] font-bold"
        data-testid="pos-sup-new">
        <Plus size={13} /> Neuer Lieferant
      </button>
      {showNew && (
        <Card title="Neuer Lieferant">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Firmenname *"
            className="w-full px-3 py-2 mb-2 bg-white/5 border border-white/10 rounded text-[12px]" data-testid="pos-sup-name" />
          <input value={f.contact_person} onChange={(e) => setF({ ...f, contact_person: e.target.value })} placeholder="Ansprechpartner"
            className="w-full px-3 py-2 mb-2 bg-white/5 border border-white/10 rounded text-[12px]" />
          <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="Email"
            className="w-full px-3 py-2 mb-2 bg-white/5 border border-white/10 rounded text-[12px]" />
          <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Telefon"
            className="w-full px-3 py-2 mb-2 bg-white/5 border border-white/10 rounded text-[12px]" />
          <button onClick={create} className="px-3 py-2 rounded-lg bg-[#00C2FF] text-black font-bold text-[11px]" data-testid="pos-sup-save">Anlegen</button>
        </Card>
      )}
      {items.map((s) => (
        <Card key={s.supplier_id}>
          <p className="text-[12px] font-bold">{s.name}</p>
          <p className="text-[10px] text-white/50">{s.contact_person} · {s.email} · {s.phone}</p>
        </Card>
      ))}
      {items.length === 0 && !showNew && <p className="text-[11px] text-white/40 text-center py-4">Keine Lieferanten</p>}
    </div>
  );
}

// ───────────────────────── Purchase Orders
function PurchaseOrdersTab({ storeId }) {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState([{ product_id: "", quantity: 1, purchase_price: 0 }]);

  const load = useCallback(async () => {
    const o = await apiCall("/api/pos/purchase-orders");
    setOrders(o.purchase_orders || []);
    const s = await apiCall("/api/pos/suppliers");
    setSuppliers(s.suppliers || []);
    if (storeId) {
      const p = await apiCall(`/api/pos/products/search?store_id=${storeId}&limit=300`);
      setProducts(p.products || []);
    }
  }, [storeId]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!supplierId) return toast.error("Lieferant fehlt");
    const valid = lines.filter((l) => l.product_id && l.quantity > 0 && l.purchase_price >= 0);
    if (valid.length === 0) return toast.error("Mind. 1 Position");
    try {
      await apiCall("/api/pos/purchase-orders/create", {
        method: "POST",
        body: { supplier_id: supplierId, store_id: storeId, items: valid },
      });
      toast.success("Bestellung erstellt");
      setShowNew(false); setLines([{ product_id: "", quantity: 1, purchase_price: 0 }]);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const receive = async (po_id) => {
    if (!window.confirm("Wareneingang bestätigen? Bestand wird automatisch erhöht.")) return;
    try {
      await apiCall(`/api/pos/purchase-orders/${po_id}/receive`, { method: "POST" });
      toast.success("Wareneingang gebucht");
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3">
      <button onClick={() => setShowNew(!showNew)} className="px-3 py-2 rounded-xl bg-[#00C2FF] text-black flex items-center gap-1 text-[11px] font-bold"
        data-testid="pos-po-new">
        <Plus size={13} /> Neue Bestellung
      </button>
      {showNew && (
        <Card title="Neue Bestellung">
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
            className="w-full px-3 py-2 mb-2 bg-white/5 border border-white/10 rounded text-[12px]" data-testid="pos-po-supplier">
            <option value="">Lieferant wählen...</option>
            {suppliers.map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.name}</option>)}
          </select>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-1 mb-2 text-[11px]">
              <select value={l.product_id} onChange={(e) => {
                const next = [...lines]; next[i].product_id = e.target.value;
                const p = products.find((x) => x.product_id === e.target.value);
                if (p) next[i].purchase_price = p.purchase_price || 0;
                setLines(next);
              }}
                className="col-span-7 px-2 py-1.5 bg-white/5 border border-white/10 rounded">
                <option value="">Produkt...</option>
                {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}
              </select>
              <input type="number" value={l.quantity} onChange={(e) => { const next = [...lines]; next[i].quantity = parseFloat(e.target.value) || 0; setLines(next); }}
                placeholder="Menge" className="col-span-2 px-2 py-1.5 bg-white/5 border border-white/10 rounded" />
              <input type="number" step="0.01" value={l.purchase_price} onChange={(e) => { const next = [...lines]; next[i].purchase_price = parseFloat(e.target.value) || 0; setLines(next); }}
                placeholder="EK €" className="col-span-2 px-2 py-1.5 bg-white/5 border border-white/10 rounded" />
              <button onClick={() => setLines((prev) => prev.filter((_, x) => x !== i))} className="col-span-1 text-red-400"><X size={12} /></button>
            </div>
          ))}
          <button onClick={() => setLines([...lines, { product_id: "", quantity: 1, purchase_price: 0 }])}
            className="mb-2 text-[10px] text-[#00C2FF]">+ Position</button>
          <button onClick={create} className="w-full py-2 rounded-lg bg-[#00C2FF] text-black font-bold text-[12px]" data-testid="pos-po-save">
            Bestellung anlegen
          </button>
        </Card>
      )}
      {orders.map((o) => (
        <Card key={o.po_id}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-bold">{o.supplier_name}</p>
              <p className="text-[9px] text-white/50">{o.po_id} · {o.items?.length} Pos · €{o.total_cost?.toFixed(2)}</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: { draft: "#666", ordered: "#3B82F6", received: "#10B981", cancelled: "#EF4444" }[o.status] + "33", color: { draft: "#999", ordered: "#3B82F6", received: "#10B981", cancelled: "#EF4444" }[o.status] }}>
              {o.status}
            </span>
          </div>
          {o.status !== "received" && o.status !== "cancelled" && (
            <button onClick={() => receive(o.po_id)} className="mt-2 px-3 py-1 rounded bg-[#10B981] text-white text-[10px] font-bold" data-testid={`pos-po-receive-${o.po_id}`}>
              Wareneingang →
            </button>
          )}
        </Card>
      ))}
    </div>
  );
}

// ───────────────────────── Receipts
function ReceiptsTab({ storeId }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!storeId) return;
    apiCall(`/api/pos/sales?store_id=${storeId}&limit=100`).then((d) => setItems(d.sales || [])).catch(() => {});
  }, [storeId]);
  return (
    <div className="space-y-3">
      {selected && <ReceiptDetail sale={selected} onClose={() => setSelected(null)} />}
      <Card title={`Belege (${items.length})`}>
        {items.map((s) => (
          <div key={s.sale_id} onClick={() => setSelected(s)} className="py-2 border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/5 px-1">
            <div className="flex justify-between text-[12px]">
              <span>{s.receipt_id}</span>
              <span className="font-bold text-[#00C2FF]">€{s.total.toFixed(2)}</span>
            </div>
            <p className="text-[9px] text-white/40">{new Date(s.created_at).toLocaleString()} · {s.method}</p>
          </div>
        ))}
        {items.length === 0 && <p className="text-[11px] text-white/40 text-center py-4">Keine Belege</p>}
      </Card>
    </div>
  );
}

function ReceiptDetail({ sale, onClose }) {
  return (
    <Card title={`Beleg ${sale.receipt_id}`} testid="pos-receipt-detail">
      <div className="text-[11px] space-y-1">
        <p>Datum: {new Date(sale.created_at).toLocaleString()}</p>
        <p>Methode: {sale.method}</p>
        <div className="border-t border-white/10 my-2 pt-2 space-y-0.5">
          {sale.items.map((it, i) => (
            <div key={i} className="flex justify-between"><span>{it.quantity}× {it.name}</span><span>€{it.line_total.toFixed(2)}</span></div>
          ))}
        </div>
        <div className="border-t border-white/10 pt-2 space-y-0.5">
          <div className="flex justify-between"><span>Netto</span><span>€{sale.net_total.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>MwSt</span><span>€{sale.tax_total.toFixed(2)}</span></div>
          <div className="flex justify-between font-bold"><span>Gesamt</span><span>€{sale.total.toFixed(2)}</span></div>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <a href={`${API}/api/pos/receipts/${sale.receipt_id}/pdf`} target="_blank" rel="noopener noreferrer"
          className="flex-1 py-2 rounded-lg bg-[#00C2FF] text-black font-bold text-[11px] text-center" data-testid="pos-receipt-pdf">
          PDF herunterladen
        </a>
        <button onClick={onClose} className="px-3 py-2 rounded-lg bg-white/10 text-[11px]">Schließen</button>
      </div>
    </Card>
  );
}

// ───────────────────────── Refunds
function RefundsTab({ storeId }) {
  const [sales, setSales] = useState([]);
  const [refunding, setRefunding] = useState(null);
  useEffect(() => {
    if (!storeId) return;
    apiCall(`/api/pos/sales?store_id=${storeId}&limit=100`).then((d) => setSales((d.sales || []).filter((s) => s.method))).catch(() => {});
  }, [storeId]);

  const doRefund = async (sale, full) => {
    try {
      const body = full
        ? { payment_id: sale.payment_id, reason: "Voller Refund" }
        : { payment_id: sale.payment_id, reason: "Item-Refund", items: sale.items.map((it) => ({ product_id: it.product_id, quantity: it.quantity, refund_amount: it.line_total })), restock: true };
      const res = await apiCall("/api/pos/refund-requests/create", { method: "POST", body });
      if (res.auto_approved) {
        toast.success("Erstattung gebucht");
      } else {
        toast.success("Anfrage gesendet — Manager muss freigeben");
      }
      setRefunding(null);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3">
      <Card title={`Verkäufe — Erstattung wählen`}>
        {sales.map((s) => (
          <div key={s.sale_id} className="py-2 border-b border-white/5 last:border-0">
            <div className="flex justify-between items-center text-[12px]">
              <div>
                <p>{s.receipt_id}</p>
                <p className="text-[9px] text-white/40">{new Date(s.created_at).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-[#00C2FF]">€{s.total.toFixed(2)}</p>
                <button onClick={() => setRefunding(s)} className="mt-1 text-[10px] text-amber-400" data-testid={`pos-refund-${s.sale_id}`}>Erstatten →</button>
              </div>
            </div>
          </div>
        ))}
        {sales.length === 0 && <p className="text-[11px] text-white/40 text-center py-4">Keine Verkäufe</p>}
      </Card>
      {refunding && (
        <Card title={`Erstattung ${refunding.receipt_id}`}>
          <p className="text-[11px] mb-3">Voller Betrag: €{refunding.total.toFixed(2)} via {refunding.method}</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => doRefund(refunding, true)} className="py-2 rounded-lg bg-red-500/20 text-red-400 text-[11px] font-bold" data-testid="pos-refund-full">
              Voller Refund
            </button>
            <button onClick={() => doRefund(refunding, false)} className="py-2 rounded-lg bg-amber-500/20 text-amber-400 text-[11px] font-bold" data-testid="pos-refund-items">
              Items + Restock
            </button>
          </div>
          <button onClick={() => setRefunding(null)} className="mt-2 w-full py-2 rounded-lg bg-white/10 text-[11px]">Abbrechen</button>
        </Card>
      )}
    </div>
  );
}

// ───────────────────────── Reports
function ReportsTab() {
  const [period, setPeriod] = useState("today");
  const [sales, setSales] = useState(null);
  const [tax, setTax] = useState(null);
  const [inv, setInv] = useState(null);
  const [refunds, setRefunds] = useState(null);
  useEffect(() => {
    apiCall(`/api/pos/reports/sales?period=${period}`).then(setSales).catch(() => {});
    apiCall(`/api/pos/reports/tax?period=${period}`).then(setTax).catch(() => {});
    apiCall(`/api/pos/reports/refunds?period=${period}`).then(setRefunds).catch(() => {});
    apiCall(`/api/pos/reports/inventory`).then(setInv).catch(() => {});
  }, [period]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto">
        {["today", "7d", "30d", "90d"].map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap"
            style={{
              background: period === p ? "rgba(0,194,255,0.15)" : "rgba(255,255,255,0.04)",
              color: period === p ? "#00C2FF" : "rgba(255,255,255,0.6)",
            }}>{p}</button>
        ))}
        <a href={`${API}/api/pos/reports/sales/export.csv?period=${period}`} target="_blank" rel="noopener noreferrer"
          className="ml-auto px-3 py-1.5 rounded-full bg-white/10 text-[11px] font-bold flex items-center gap-1" data-testid="pos-export-csv">
          <Download size={12} /> CSV
        </a>
      </div>
      <Card title="Umsatz">
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          <div><p className="text-white/50 text-[10px]">Verkäufe</p><p className="text-base font-black">{sales?.sales_count ?? "—"}</p></div>
          <div><p className="text-white/50 text-[10px]">Umsatz</p><p className="text-base font-black text-[#00C2FF]">€{(sales?.revenue ?? 0).toFixed(2)}</p></div>
          <div><p className="text-white/50 text-[10px]">Gebühren</p><p className="text-base font-black text-amber-400">€{(sales?.fees_paid ?? 0).toFixed(2)}</p></div>
          <div><p className="text-white/50 text-[10px]">Netto</p><p className="text-base font-black text-[#10B981]">€{(sales?.net ?? 0).toFixed(2)}</p></div>
        </div>
      </Card>
      <Card title="Top Produkte">
        {(sales?.top_products || []).slice(0, 10).map((p) => (
          <div key={p.product_id} className="flex justify-between text-[11px] py-1 border-b border-white/5 last:border-0">
            <span className="truncate flex-1">{p.name}</span>
            <span className="text-white/60 mx-2">{p.qty}×</span>
            <span className="font-bold text-[#00C2FF]">€{p.revenue.toFixed(2)}</span>
          </div>
        ))}
      </Card>
      <Card title="Steuer">
        {(tax?.by_rate || []).map((r) => (
          <div key={r.rate} className="flex justify-between text-[11px] py-1">
            <span>MwSt {r.rate}</span>
            <span>Netto €{r.net.toFixed(2)} · Steuer €{r.tax.toFixed(2)}</span>
          </div>
        ))}
        <div className="border-t border-white/10 mt-1 pt-1 text-[11px] font-bold flex justify-between">
          <span>Gesamtsteuer</span><span>€{(tax?.total_tax ?? 0).toFixed(2)}</span>
        </div>
      </Card>
      <Card title="Inventarwert">
        <div className="text-[12px] space-y-1">
          <div className="flex justify-between"><span>Produkte</span><span className="font-bold">{inv?.products_total ?? "—"}</span></div>
          <div className="flex justify-between"><span>Wert (EK)</span><span className="font-bold">€{(inv?.stock_value_cost ?? 0).toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Wert (VK)</span><span className="font-bold">€{(inv?.stock_value_retail ?? 0).toFixed(2)}</span></div>
          <div className="flex justify-between text-[#10B981]"><span>Marge</span><span className="font-bold">€{(inv?.potential_margin ?? 0).toFixed(2)}</span></div>
          <div className="flex justify-between text-amber-400"><span>Niedriger Bestand</span><span className="font-bold">{inv?.low_stock_count ?? 0}</span></div>
        </div>
      </Card>
      <Card title="Erstattungen">
        <div className="flex justify-between text-[12px]">
          <span>{refunds?.count ?? 0} Erstattungen</span>
          <span className="font-bold text-amber-400">€{(refunds?.total ?? 0).toFixed(2)}</span>
        </div>
      </Card>
    </div>
  );
}

// ───────────────────────── Admin
function AdminTab() {
  const [overview, setOverview] = useState(null);
  const [merchants, setMerchants] = useState([]);
  const [failed, setFailed] = useState([]);
  const [error, setError] = useState("");
  const [auditQuery, setAuditQuery] = useState("");
  const [auditAction, setAuditAction] = useState("");
  const [auditDays, setAuditDays] = useState(7);
  const [auditLog, setAuditLog] = useState([]);
  const [auditTop, setAuditTop] = useState([]);
  const [auditActions, setAuditActions] = useState([]);
  const load = useCallback(async () => {
    try {
      const o = await apiCall("/api/pos/admin/overview");
      setOverview(o);
      const m = await apiCall("/api/pos/admin/merchants");
      setMerchants(m.merchants || []);
      const f = await apiCall("/api/pos/admin/failed-payments");
      setFailed(f.failed || []);
      setError("");
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Audit log search
  useEffect(() => {
    const params = new URLSearchParams({ limit: 200 });
    apiCall(`/api/pos/audit-log?${params.toString()}`)
      .then((d) => {
        let entries = d.log || d.entries || [];
        if (auditQuery) {
          const qLow = auditQuery.toLowerCase();
          entries = entries.filter((l) =>
            (l.action || "").toLowerCase().includes(qLow) ||
            (l.actor_id || "").toLowerCase().includes(qLow) ||
            JSON.stringify(l.ref || {}).toLowerCase().includes(qLow)
          );
        }
        if (auditAction) entries = entries.filter((l) => l.action === auditAction);
        if (auditDays) {
          const cutoff = Date.now() - auditDays * 24 * 60 * 60 * 1000;
          entries = entries.filter((l) => new Date(l.ts).getTime() >= cutoff);
        }
        setAuditLog(entries);
        const counts = {};
        entries.forEach((l) => { counts[l.action] = (counts[l.action] || 0) + 1; });
        const top = Object.entries(counts).map(([action, count]) => ({ action, count })).sort((a, b) => b.count - a.count);
        setAuditTop(top);
        setAuditActions(top.map((t) => t.action));
      })
      .catch(() => {});
  }, [auditQuery, auditAction, auditDays]);

  if (error) return <Card title="Admin"><p className="text-[11px] text-red-400">{error}</p></Card>;

  const approve = async (id) => { await apiCall(`/api/pos/admin/merchants/${id}/approve`, { method: "POST" }); toast.success("Freigeschaltet"); load(); };
  const suspend = async (id) => { if (!window.confirm("Wirklich sperren?")) return; await apiCall(`/api/pos/admin/merchants/${id}/suspend`, { method: "POST" }); toast.success("Gesperrt"); load(); };
  const setFee = async (id) => {
    const v = parseFloat(prompt("Neue Fee Rate (z.B. 0.015 = 1.5%):", "0.015"));
    if (!v && v !== 0) return;
    await apiCall(`/api/pos/admin/merchants/${id}/fee`, { method: "POST", body: { fee_rate: v } });
    toast.success("Fee aktualisiert"); load();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Merchants" value={overview?.merchants ?? 0} color="#00C2FF" />
        <Stat label="Pending" value={overview?.merchants_pending ?? 0} color="#F59E0B" />
        <Stat label="Approved" value={overview?.merchants_approved ?? 0} color="#10B981" />
        <Stat label="Heute Volumen" value={`€${(overview?.volume_today ?? 0).toFixed(2)}`} color="#A855F7" />
      </div>
      <Card title="Merchants">
        {merchants.map((m) => (
          <div key={m.merchant_id} className="py-2 border-b border-white/5 last:border-0 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] truncate">{m.business_name}</p>
              <p className="text-[9px] text-white/40">{m.merchant_id} · {m.status} · Fee {(m.fee_rate * 100).toFixed(2)}%</p>
            </div>
            {m.status === "pending" && <button onClick={() => approve(m.merchant_id)} className="text-[10px] text-[#10B981]" data-testid={`pos-admin-approve-${m.merchant_id}`}>✓ Freischalten</button>}
            <button onClick={() => setFee(m.merchant_id)} className="text-[10px] text-[#00C2FF]">Fee</button>
            {m.status !== "suspended" && <button onClick={() => suspend(m.merchant_id)} className="text-[10px] text-red-400">Sperren</button>}
          </div>
        ))}
        {merchants.length === 0 && <p className="text-[11px] text-white/40 text-center py-3">Keine Merchants</p>}
      </Card>
      <Card title={`Fehlgeschlagene Zahlungen (${failed.length})`}>
        {failed.slice(0, 20).map((p) => (
          <div key={p.payment_id} className="py-1.5 border-b border-white/5 last:border-0 text-[11px] flex justify-between">
            <span>{p.payment_id}</span>
            <span className="text-red-400">{p.status}</span>
          </div>
        ))}
        {failed.length === 0 && <p className="text-[11px] text-white/40 text-center py-3">Keine Fehler</p>}
      </Card>

      <Card title="Add-Ons / Feature-Verwaltung" testid="pos-admin-features-card">
        <p className="text-[11px] text-white/60 mb-3">Pro Merchant Features (Tisch-Reservierung, QR-Bestellung, etc.) freischalten oder sperren.</p>
        <POSAdminFeatures />
      </Card>

      <Card title="Audit-Log Suche" testid="pos-audit-search">
        <div className="grid grid-cols-12 gap-2 mb-3">
          <input value={auditQuery} onChange={(e) => setAuditQuery(e.target.value)} placeholder="Such-Text (action, actor)"
            className="col-span-7 px-2 py-2 bg-white/5 border border-white/10 rounded text-[11px]" data-testid="pos-audit-q" />
          <select value={auditAction} onChange={(e) => setAuditAction(e.target.value)}
            className="col-span-3 px-2 py-2 bg-white/5 border border-white/10 rounded text-[11px]">
            <option value="">Alle Actions</option>
            {auditActions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={auditDays} onChange={(e) => setAuditDays(parseInt(e.target.value))}
            className="col-span-2 px-2 py-2 bg-white/5 border border-white/10 rounded text-[11px]">
            <option value="1">1 Tag</option>
            <option value="7">7 Tage</option>
            <option value="30">30 Tage</option>
            <option value="90">90 Tage</option>
            <option value="365">1 Jahr</option>
          </select>
        </div>
        {auditTop.length > 0 && (
          <div className="flex gap-1 overflow-x-auto mb-2 pb-1">
            {auditTop.slice(0, 8).map((t) => (
              <button key={t.action} onClick={() => setAuditAction(t.action)}
                className="px-2 py-0.5 rounded-full text-[9px] whitespace-nowrap bg-white/5 hover:bg-white/10">
                {t.action} ({t.count})
              </button>
            ))}
          </div>
        )}
        <div className="max-h-64 overflow-y-auto">
          {auditLog.map((l, i) => (
            <div key={l.audit_id || `${l.ts}-${i}`} className="py-1.5 border-b border-white/5 last:border-0 text-[10px]">
              <div className="flex justify-between">
                <span className="font-bold text-[#00C2FF]">{l.action}</span>
                <span className="text-white/40">{l.ts ? new Date(l.ts).toLocaleString() : "—"}</span>
              </div>
              <p className="text-white/60 truncate">{l.actor_id || "—"} · {JSON.stringify(l.ref || {})}</p>
            </div>
          ))}
          {auditLog.length === 0 && <p className="text-[11px] text-white/40 text-center py-3">Keine Treffer</p>}
        </div>
      </Card>
    </div>
  );
}

// ───────────────────────── tiny shared UI
function Card({ title, children, testid, className = "" }) {
  return (
    <div className={`rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3.5 ${className}`} data-testid={testid}>
      {title && <p className="text-[11px] font-bold text-white/80 mb-2 uppercase tracking-wide">{title}</p>}
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// RETAIL PRO TAB (Storno, Rückgabe, Gewichtsartikel)
// ═══════════════════════════════════════════════════════════════════════
function RetailTab({ storeId }) {
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [hardwareModalOpen, setHardwareModalOpen] = useState(false);
  const [ageModalOpen, setAgeModalOpen] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const handleVoid = (result) => {
    setLastResult(result);
    toast.success(`Bon storniert: ${result.void_receipt_id}`);
  };

  const handleReturn = (result) => {
    setLastResult(result);
    toast.success(`Rückgabe: €${result.total.toFixed(2)} ${result.return_type === 'voucher' ? '(Gutschein)' : ''}`);
  };

  return (
    <div className="space-y-6">
      <Card title="🏪 Retail Enterprise Features (REWE/Lidl-Niveau)">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => setVoidModalOpen(true)}
            data-testid="pos-retail-void-btn"
            className="p-4 bg-red-600/10 border border-red-600/20 rounded-lg hover:bg-red-600/20 text-left"
          >
            <div className="text-2xl mb-2">❌</div>
            <div className="font-semibold text-sm">Bon stornieren</div>
            <div className="text-xs text-white/60">Rechtskonforme Stornierung</div>
          </button>
          <button
            onClick={() => setReturnModalOpen(true)}
            data-testid="pos-retail-return-btn"
            className="p-4 bg-orange-600/10 border border-orange-600/20 rounded-lg hover:bg-orange-600/20 text-left"
          >
            <div className="text-2xl mb-2">📦</div>
            <div className="font-semibold text-sm">Rückgabe / Umtausch</div>
            <div className="text-xs text-white/60">Geld, Gutschein, Umtausch</div>
          </button>
          <button
            onClick={() => setAgeModalOpen(true)}
            data-testid="pos-retail-age-btn"
            className="p-4 bg-amber-600/10 border border-amber-600/20 rounded-lg hover:bg-amber-600/20 text-left"
          >
            <div className="text-2xl mb-2">🔞</div>
            <div className="font-semibold text-sm">Altersverifikation</div>
            <div className="text-xs text-white/60">FSK 16/18 Prüfung</div>
          </button>
          <button
            onClick={() => setHardwareModalOpen(true)}
            data-testid="pos-retail-hardware-btn"
            className="p-4 bg-purple-600/10 border border-purple-600/20 rounded-lg hover:bg-purple-600/20 text-left"
          >
            <div className="text-2xl mb-2">🖨️</div>
            <div className="font-semibold text-sm">Hardware-Test</div>
            <div className="text-xs text-white/60">Drucker, Scanner, Waage</div>
          </button>
        </div>

        <WeightedProductScanner
          storeId={storeId}
          onAdd={(item) => {
            toast.success(`Gewichtsartikel hinzugefügt: ${item.name}`);
          }}
        />

        {lastResult && (
          <Card title="Letztes Ergebnis" className="mt-4">
            <pre className="text-xs text-white/60 overflow-auto">{JSON.stringify(lastResult, null, 2)}</pre>
          </Card>
        )}
      </Card>

      <VoidReceiptModal isOpen={voidModalOpen} onClose={() => setVoidModalOpen(false)} onVoid={handleVoid} />
      <ReturnModal isOpen={returnModalOpen} onClose={() => setReturnModalOpen(false)} onReturn={handleReturn} />
      <POSHardwareModal isOpen={hardwareModalOpen} onClose={() => setHardwareModalOpen(false)} storeId={storeId} />
      <AgeVerificationModal
        isOpen={ageModalOpen}
        onClose={() => setAgeModalOpen(false)}
        productId="generic"
        requiredAge={18}
        onVerified={(d) => {
          setLastResult(d);
          toast.success('Altersfreigabe bestätigt');
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SUPERVISOR TAB (Multi-Station Self-Checkout Überwachung)
// ═══════════════════════════════════════════════════════════════════════
function SupervisorTab({ storeId }) {
  return (
    <div className="space-y-6">
      <Card title="👁️ Supervisor Console — Self-Checkout Überwachung">
        <SupervisorConsole storeId={storeId} />
      </Card>
    </div>
  );
}
function Stat({ label, value, color, testid }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3" data-testid={testid}>
      <p className="text-[10px] text-white/50 mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-black tabular-nums" style={{ color: color || "white" }}>{value}</p>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div>
      <label className="text-[10px] text-white/60 mb-1 block uppercase">{label}</label>
      {children}
    </div>
  );
}
