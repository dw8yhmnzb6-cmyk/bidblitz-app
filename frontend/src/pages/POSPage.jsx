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
  AlertTriangle, Edit3, Download, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

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
  { id: "reports", label: "Berichte", icon: BarChart3 },
  { id: "admin", label: "Admin", icon: ShieldCheck },
];

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
    <div className="min-h-screen bg-[#060810] text-white" data-testid="pos-page">
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
        {tab === "dashboard" && <DashboardTab merchant={merchant} stores={stores} registers={registers}
                                              storeId={storeId} registerId={registerId} shift={shift}
                                              onSetupStore={refresh} setTab={setTab} />}
        {tab === "checkout" && <CheckoutTab storeId={storeId} registerId={registerId} shift={shift}
                                            onShiftChange={async () => {
                                              const sh = await apiCall(`/api/pos/shift/current?register_id=${registerId}`);
                                              setShift(sh.shift);
                                            }} />}
        {tab === "products" && <ProductsTab storeId={storeId} />}
        {tab === "inventory" && <InventoryTab storeId={storeId} />}
        {tab === "movements" && <MovementsTab storeId={storeId} />}
        {tab === "suppliers" && <SuppliersTab />}
        {tab === "orders" && <PurchaseOrdersTab storeId={storeId} />}
        {tab === "receipts" && <ReceiptsTab storeId={storeId} />}
        {tab === "refunds" && <RefundsTab storeId={storeId} />}
        {tab === "reports" && <ReportsTab />}
        {tab === "admin" && <AdminTab />}
      </div>
    </div>
  );
}

// ───────────────────────── Onboarding (no merchant yet)
function MerchantOnboarding({ onBack, onDone }) {
  const [form, setForm] = useState({ business_name: "", business_type: "retail", country: "DE", contact_phone: "" });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.business_name) return toast.error("Name fehlt");
    setSaving(true);
    try {
      await apiCall("/api/pos/merchants/register", { method: "POST", body: form });
      toast.success("POS-Profil angelegt — wartet auf BidBlitz Freischaltung");
      onDone();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };
  return (
    <div className="min-h-screen bg-[#060810] text-white p-5">
      <button onClick={onBack} className="mb-4 flex items-center gap-2 text-white/70 text-sm">
        <ArrowLeft size={16} /> Zurück
      </button>
      <h1 className="text-2xl font-black mb-1">BidBlitz POS aktivieren</h1>
      <p className="text-white/60 text-sm mb-6">Lege dein Händler-Profil an, damit du Produkte verwalten und Zahlungen annehmen kannst.</p>
      <div className="space-y-3 max-w-md">
        <Field label="Firmenname *">
          <input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })}
            className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white" data-testid="pos-onb-name" />
        </Field>
        <Field label="Branche">
          <select value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })}
            className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white">
            <option value="retail">Einzelhandel</option>
            <option value="supermarket">Supermarkt</option>
            <option value="restaurant">Restaurant</option>
            <option value="kiosk">Kiosk</option>
            <option value="other">Sonstige</option>
          </select>
        </Field>
        <Field label="Telefon">
          <input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white" />
        </Field>
        <button onClick={submit} disabled={saving}
          className="w-full py-3.5 rounded-xl bg-[#00C2FF] text-black font-black disabled:opacity-50"
          data-testid="pos-onb-submit">
          {saving ? <Loader2 size={16} className="animate-spin inline" /> : "POS-Profil anlegen"}
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── Dashboard
function DashboardTab({ merchant, stores, registers, storeId, registerId, shift, onSetupStore, setTab }) {
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
        <Stat label="Settlement" value={`€${(merchant.settlement_balance ?? 0).toFixed(2)}`} color="#A855F7" />
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

// ───────────────────────── Checkout
function CheckoutTab({ storeId, registerId, shift, onShiftChange }) {
  const [cart, setCart] = useState([]);
  const [scan, setScan] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [openingCash, setOpeningCash] = useState("");
  const [openingShift, setOpeningShift] = useState(false);
  const [closingCash, setClosingCash] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("wallet_qr");
  const [activePayment, setActivePayment] = useState(null);
  const [customerBarcode, setCustomerBarcode] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [cardRef, setCardRef] = useState("");
  const [discountPct, setDiscountPct] = useState(0);
  const scanRef = useRef(null);
  const pollRef = useRef(null);

  const totals = useMemo(() => {
    const sub = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const disc = sub * (discountPct / 100);
    return { subtotal: sub, discount: disc, total: sub - disc };
  }, [cart, discountPct]);

  // Auto-focus scanner input
  useEffect(() => { if (shift && scanRef.current) scanRef.current.focus(); }, [shift]);

  // ─── Shift open/close
  const openShift = async () => {
    if (!registerId) return toast.error("Keine Kasse");
    setOpeningShift(true);
    try {
      await apiCall("/api/pos/shift/open", {
        method: "POST",
        body: { register_id: registerId, opening_cash: parseFloat(openingCash || 0) },
      });
      toast.success("Schicht eröffnet");
      onShiftChange();
    } catch (e) { toast.error(e.message); }
    setOpeningShift(false);
  };

  const closeShift = async () => {
    if (!shift) return;
    if (!window.confirm("Schicht wirklich schließen?")) return;
    try {
      const r = await apiCall("/api/pos/shift/close", {
        method: "POST",
        body: { shift_id: shift.shift_id, closing_cash: parseFloat(closingCash || 0) },
      });
      toast.success(`Schicht geschlossen (Diff: €${r.difference?.toFixed(2)})`);
      setClosingCash("");
      onShiftChange();
    } catch (e) { toast.error(e.message); }
  };

  // ─── Scan / search
  const handleScan = async (code) => {
    if (!code) return;
    try {
      const p = await apiCall(`/api/pos/products/barcode/${encodeURIComponent(code)}?store_id=${storeId}`);
      addToCart(p);
      setScan("");
    } catch (e) {
      toast.error(`Barcode ${code}: ${e.message}`);
    }
  };

  const doSearch = async () => {
    if (!search) return;
    const r = await apiCall(`/api/pos/products/search?store_id=${storeId}&q=${encodeURIComponent(search)}`);
    setResults(r.products || []);
  };

  const addToCart = (p) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product_id === p.product_id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, {
        product_id: p.product_id,
        name: p.name,
        price: p.price,
        tax_rate: p.tax_rate,
        quantity: 1,
        discount_pct: 0,
        stock: p.stock,
      }];
    });
    setResults([]);
    setSearch("");
  };

  const updateQty = (idx, delta) => {
    setCart((prev) => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it).filter((it) => it.quantity > 0));
  };
  const removeItem = (idx) => setCart((prev) => prev.filter((_, i) => i !== idx));
  const setLineDiscount = (idx, pct) => setCart((prev) => prev.map((it, i) => i === idx ? { ...it, discount_pct: pct } : it));

  // ─── Payment
  const buildItems = () => cart.map((c) => ({
    product_id: c.product_id, quantity: c.quantity, discount_pct: c.discount_pct || 0,
  }));

  const pay = async () => {
    if (cart.length === 0) return toast.error("Cart leer");
    try {
      // 1. Create cart
      const c = await apiCall("/api/pos/cart/create", {
        method: "POST",
        body: { register_id: registerId, items: buildItems(), discount_pct: discountPct },
      });
      const cart_id = c.cart.cart_id;

      // 2. Create payment
      const body = { cart_id, method: paymentMethod };
      if (paymentMethod === "cash") body.cash_received = parseFloat(cashReceived || totals.total);
      if (paymentMethod === "card_external") body.card_reference = cardRef || `CARD-${Date.now()}`;
      if (paymentMethod === "barcode" && customerBarcode) body.customer_barcode = customerBarcode;

      const p = await apiCall("/api/pos/payment/create", { method: "POST", body });

      if (p.sale) {
        toast.success(`Bezahlt — Beleg ${p.sale.receipt_id}`);
        setCart([]); setDiscountPct(0); setCashReceived(""); setCustomerBarcode(""); setCardRef("");
        setActivePayment({ ...p.payment, sale: p.sale });
        return;
      }
      // Pending — start polling
      setActivePayment(p.payment);
      startPolling(p.payment.payment_id);
    } catch (e) { toast.error(e.message); }
  };

  const startPolling = (pid) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await apiCall(`/api/pos/payment/status/${pid}`);
        if (status.status === "paid") {
          clearInterval(pollRef.current);
          toast.success("Zahlung bestätigt!");
          setCart([]); setDiscountPct(0); setActivePayment(status);
          // Fetch sale via receipts list shortly
        } else if (["expired", "cancelled", "failed"].includes(status.status)) {
          clearInterval(pollRef.current);
          toast.error(`Zahlung ${status.status}`);
          setActivePayment(null);
        }
      } catch {}
    }, 2500);
  };
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const cancelActive = () => {
    setActivePayment(null);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  // NFC fallback
  const startNFC = async () => {
    if (cart.length === 0) return toast.error("Cart leer");
    try {
      const c = await apiCall("/api/pos/cart/create", {
        method: "POST",
        body: { register_id: registerId, items: buildItems(), discount_pct: discountPct },
      });
      const sess = await apiCall("/api/pos/nfc/session/create", {
        method: "POST",
        body: { register_id: registerId, cart_id: c.cart.cart_id, amount: c.cart.total },
      });
      setActivePayment({
        ...sess.session,
        is_nfc: true,
        qr_code: sess.fallback_qr,
        amount: c.cart.total,
      });
      // Poll session
      pollRef.current = setInterval(async () => {
        const s = await apiCall(`/api/pos/nfc/session/${sess.session.session_id}`);
        if (s.status === "paid") {
          clearInterval(pollRef.current);
          toast.success("NFC Zahlung bestätigt");
          setCart([]); setActivePayment(s);
        } else if (["expired", "failed"].includes(s.status)) {
          clearInterval(pollRef.current);
          toast.error(`NFC ${s.status}`);
          setActivePayment(null);
        }
      }, 2500);
    } catch (e) { toast.error(e.message); }
  };

  // ─── Render: no shift
  if (!shift) {
    return (
      <Card title="Schicht eröffnen" testid="pos-open-shift-card">
        <p className="text-[11px] text-white/60 mb-2">Bevor du verkaufen kannst, eröffne die Schicht.</p>
        <input type="number" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} placeholder="Anfangsbestand Kasse (€)"
          className="w-full px-3 py-2.5 mb-2 bg-white/5 border border-white/10 rounded-xl text-[13px]" data-testid="pos-opening-cash" />
        <button onClick={openShift} disabled={openingShift}
          className="w-full py-3 rounded-xl bg-[#00C2FF] text-black font-black disabled:opacity-50"
          data-testid="pos-open-shift">
          {openingShift ? <Loader2 size={14} className="animate-spin inline" /> : "Schicht öffnen"}
        </button>
      </Card>
    );
  }

  // Render: payment in progress
  if (activePayment && ["pending"].includes(activePayment.status)) {
    return (
      <Card title={activePayment.is_nfc ? "NFC Zahlung" : "QR / Barcode Zahlung"} testid="pos-active-payment">
        <div className="text-center p-4">
          <p className="text-[12px] text-white/60 mb-2">Betrag</p>
          <p className="text-3xl font-black text-[#00C2FF] mb-4">€{Number(activePayment.amount ?? totals.total).toFixed(2)}</p>
          <div className="bg-white p-6 rounded-2xl inline-block mb-3">
            <div className="font-mono text-[10px] text-black break-all max-w-[220px]">{activePayment.qr_code || activePayment.barcode || activePayment.payment_id}</div>
          </div>
          <p className="text-[11px] text-white/60 mb-1">Kunde scannt mit BidBlitz App</p>
          <p className="text-[10px] text-white/40 mb-4">Status: {activePayment.status}</p>
          <button onClick={cancelActive} className="px-4 py-2 rounded-lg bg-white/10 text-[11px]" data-testid="pos-cancel-payment">
            Abbrechen
          </button>
        </div>
      </Card>
    );
  }

  // Sale completed flash card
  if (activePayment && activePayment.status === "paid" && activePayment.sale) {
    return <SaleCompleteCard sale={activePayment.sale} onClose={() => setActivePayment(null)} />;
  }

  return (
    <div className="space-y-3">
      {/* Scan input */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-white/5 border-2 border-[#00C2FF]/40 rounded-xl px-3 py-2">
          <ScanLine size={16} className="text-[#00C2FF]" />
          <input ref={scanRef} value={scan} onChange={(e) => setScan(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { handleScan(scan); } }}
            placeholder="Barcode scannen oder eingeben..."
            className="flex-1 bg-transparent text-white text-[13px] font-mono outline-none" data-testid="pos-scan" />
          {scan && <button onClick={() => handleScan(scan)} className="text-[#00C2FF] text-[10px] font-bold">SCAN</button>}
        </div>
        <button onClick={closeShift} className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold">
          Schicht ×
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
          placeholder="Produktname, SKU oder Barcode..."
          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[12px]" data-testid="pos-search" />
        <button onClick={doSearch} className="px-3 py-2 rounded-xl bg-white/10 text-[11px]"><Search size={13} /></button>
      </div>
      {results.length > 0 && (
        <div className="rounded-xl bg-white/5 border border-white/10 max-h-40 overflow-y-auto">
          {results.map((p) => (
            <button key={p.product_id} onClick={() => addToCart(p)}
              className="w-full flex justify-between items-center px-3 py-2 text-[12px] border-b border-white/5 last:border-0 hover:bg-white/5">
              <span>{p.name} <span className="text-white/40 text-[10px]">· {p.stock} {p.unit}</span></span>
              <span className="font-bold text-[#00C2FF]">€{p.price.toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Cart */}
      <Card title={`Warenkorb (${cart.length})`}>
        {cart.length === 0 ? (
          <p className="text-[11px] text-white/40 py-4 text-center">Noch keine Artikel — scannen oder suchen</p>
        ) : (
          <div className="space-y-2">
            {cart.map((it, i) => (
              <div key={i} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] truncate">{it.name}</p>
                  <p className="text-[9px] text-white/40">€{it.price.toFixed(2)} × {it.quantity} · MwSt {(it.tax_rate * 100).toFixed(0)}%</p>
                </div>
                <button onClick={() => updateQty(i, -1)} className="w-7 h-7 rounded-lg bg-white/5">−</button>
                <span className="w-7 text-center text-[12px] font-bold">{it.quantity}</span>
                <button onClick={() => updateQty(i, +1)} className="w-7 h-7 rounded-lg bg-white/5">+</button>
                <input type="number" min="0" max="100" value={it.discount_pct} onChange={(e) => setLineDiscount(i, parseFloat(e.target.value) || 0)}
                  className="w-12 px-1 py-1 bg-white/5 rounded text-[10px] text-center" placeholder="0%" />
                <button onClick={() => removeItem(i)} className="text-red-400"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Totals + payment */}
      {cart.length > 0 && (
        <Card title="Zahlung">
          <div className="space-y-1 mb-3 text-[12px]">
            <div className="flex justify-between"><span>Zwischensumme</span><span>€{totals.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-white/60">
              <span>Rabatt %</span>
              <input type="number" min="0" max="100" value={discountPct} onChange={(e) => setDiscountPct(parseFloat(e.target.value) || 0)}
                className="w-16 px-1 py-0.5 bg-white/5 rounded text-right text-[11px]" />
            </div>
            <div className="flex justify-between text-amber-400"><span>Rabatt</span><span>−€{totals.discount.toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-white/10 pt-1.5 mt-1.5">
              <span className="font-bold">Gesamt</span>
              <span className="text-xl font-black text-[#00C2FF]" data-testid="pos-total">€{totals.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <PayBtn icon={QrCode} label="QR Wallet" active={paymentMethod === "wallet_qr"} onClick={() => setPaymentMethod("wallet_qr")} testid="pos-pay-qr" />
            <PayBtn icon={Smartphone} label="Kunden-Barcode" active={paymentMethod === "barcode"} onClick={() => setPaymentMethod("barcode")} testid="pos-pay-barcode" />
            <PayBtn icon={Banknote} label="Bar" active={paymentMethod === "cash"} onClick={() => setPaymentMethod("cash")} testid="pos-pay-cash" />
            <PayBtn icon={CreditCard} label="Karte ext." active={paymentMethod === "card_external"} onClick={() => setPaymentMethod("card_external")} testid="pos-pay-card" />
          </div>

          {paymentMethod === "barcode" && (
            <input value={customerBarcode} onChange={(e) => setCustomerBarcode(e.target.value)} placeholder="Kunden-Barcode scannen"
              className="w-full px-3 py-2 mb-2 bg-white/5 border border-white/10 rounded-lg text-[12px]" data-testid="pos-customer-barcode" />
          )}
          {paymentMethod === "cash" && (
            <input type="number" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder={`Erhalten (€${totals.total.toFixed(2)})`}
              className="w-full px-3 py-2 mb-2 bg-white/5 border border-white/10 rounded-lg text-[12px]" data-testid="pos-cash-received" />
          )}
          {paymentMethod === "card_external" && (
            <input value={cardRef} onChange={(e) => setCardRef(e.target.value)} placeholder="Karten-Terminal Referenz"
              className="w-full px-3 py-2 mb-2 bg-white/5 border border-white/10 rounded-lg text-[12px]" data-testid="pos-card-ref" />
          )}

          <div className="grid grid-cols-2 gap-2">
            <button onClick={pay} className="py-3 rounded-xl bg-[#00C2FF] text-black font-black text-[13px]" data-testid="pos-pay-btn">
              Bezahlen €{totals.total.toFixed(2)}
            </button>
            <button onClick={startNFC} className="py-3 rounded-xl bg-white/10 text-white font-bold text-[12px] flex items-center justify-center gap-1.5"
              data-testid="pos-nfc-btn">
              <Smartphone size={13} /> NFC starten
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

function PayBtn({ icon: Icon, label, active, onClick, testid }) {
  return (
    <button onClick={onClick} data-testid={testid}
      className="py-2.5 rounded-xl border flex flex-col items-center gap-1"
      style={{
        background: active ? "rgba(0,194,255,0.12)" : "rgba(255,255,255,0.03)",
        borderColor: active ? "#00C2FF" : "rgba(255,255,255,0.08)",
        color: active ? "#00C2FF" : "white",
      }}>
      <Icon size={14} />
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

function SaleCompleteCard({ sale, onClose }) {
  return (
    <Card title="✓ Zahlung erfolgreich" testid="pos-sale-success">
      <div className="text-center py-3">
        <Check size={36} className="text-[#10B981] mx-auto mb-2" />
        <p className="text-2xl font-black mb-1">€{sale.total.toFixed(2)}</p>
        <p className="text-[11px] text-white/60">Beleg: {sale.receipt_id}</p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <a href={`${API}/api/pos/receipts/${sale.receipt_id}/pdf`} target="_blank" rel="noopener noreferrer"
            className="py-2 rounded-lg bg-white/10 text-[11px] font-bold flex items-center justify-center gap-1">
            <Download size={12} /> PDF
          </a>
          <button onClick={onClose} className="py-2 rounded-lg bg-[#00C2FF] text-black text-[11px] font-bold">
            Neu starten
          </button>
        </div>
      </div>
    </Card>
  );
}

// ───────────────────────── Products
function ProductsTab({ storeId }) {
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

// ───────────────────────── Inventory
function InventoryTab({ storeId }) {
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
        : { payment_id: sale.payment_id, items: sale.items.map((it) => ({ product_id: it.product_id, quantity: it.quantity, refund_amount: it.line_total })), reason: "Item-Refund", restock: true };
      const url = full ? "/api/pos/payment/refund" : "/api/pos/refund/items";
      await apiCall(url, { method: "POST", body });
      toast.success("Erstattung gebucht");
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
