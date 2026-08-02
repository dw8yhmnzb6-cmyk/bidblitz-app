import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Loader2, UploadCloud, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { api } from "../services/api";
import { useFeatureFlags } from "../store/FeatureFlagContext";

const STEPS = [
  { key: "geschaeft", label: "1. Geschäft" },
  { key: "branche", label: "2. Branche" },
  { key: "produkte", label: "3. Produkte" },
  { key: "zahlungen", label: "4. Zahlungen" },
  { key: "geraete", label: "5. Geräte" },
  { key: "mitarbeiter", label: "6. Mitarbeiter" },
  { key: "fertig", label: "7. Fertig" },
];

const BUSINESS_TYPES = ["Einzelhandel", "Café / Eiscafé", "Restaurant", "Fast Food", "Telefonzubehör", "Supermarkt", "Friseur", "Dienstleistung", "Schwimmbad / Freizeit", "Sonstiges"];
const DEVICE_OPTIONS = ["smartphone", "tablet", "h10_android_pos", "desktop", "customer_display", "receipt_printer", "barcode_scanner", "cash_drawer"];
const PAYMENT_OPTIONS = [
  { key: "cash", label: "Bargeld", feature: "merchant.pos.payment.cash" },
  { key: "card", label: "Karte", feature: "merchant.pos.payment.card" },
  { key: "nfc", label: "NFC", feature: "merchant.pos.payment.card" },
  { key: "tap_to_pay", label: "Tap to Pay", feature: "merchant.pos.payment.tap_to_pay" },
  { key: "wallet", label: "BidBlitz Wallet", feature: "merchant.pos.payment.wallet" },
  { key: "qr", label: "QR-Code", feature: "merchant.pos.payment.qr" },
  { key: "voucher", label: "Gutschein", feature: "merchant.pos.payment.voucher" },
  { key: "invoice", label: "Rechnung", feature: "merchant.pos.payment.invoice" },
];

export default function MerchantSetupPage({ onBack, onNavigate }) {
  const { isEnabled } = useFeatureFlags();
  const [merchant, setMerchant] = useState(null);
  const [store, setStore] = useState(null);
  const [register, setRegister] = useState(null);
  const [staff, setStaff] = useState([]);
  const [products, setProducts] = useState([]);
  const [presets, setPresets] = useState([]);
  const [state, setState] = useState({
    current_step: "geschaeft",
    completed_steps: [],
    business_info: { business_name: "", legal_business_name: "", country: "DE", city: "", address: "", telephone: "", email: "", tax_number: "", currency: "EUR", preferred_language: "de", logo: "" },
    business_type: "Café / Eiscafé",
    product_setup: { mode: "later", recent_products: [] },
    payment_methods: {},
    devices: {},
    staff_setup: { invites: [] },
    activation_status: "incomplete",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quickProduct, setQuickProduct] = useState({ name: "", price: "" });
  const [staffInvite, setStaffInvite] = useState({ name: "", email: "", role: "Kassierer" });
  const saveTimer = useRef(null);

  const currentIndex = Math.max(0, STEPS.findIndex((step) => step.key === state.current_step));

  const load = async () => {
    setLoading(true);
    try {
      const [merchantResp, presetsResp] = await Promise.allSettled([api.getMyPosMerchant(), api.getMerchantSetupPresets()]);
      if (merchantResp.status === "fulfilled") {
        setMerchant(merchantResp.value.merchant || merchantResp.value);
        try {
          const setup = await api.getMerchantSetupState();
          setMerchant(setup.merchant || merchantResp.value.merchant || merchantResp.value);
          setStore(setup.stores?.[0] || null);
          setRegister(setup.registers?.[0] || null);
          setStaff(setup.staff || []);
          setProducts(setup.products || []);
          setState((current) => ({ ...current, ...(setup.progress || {}) }));
          if (setup.should_open_pos) onNavigate?.("/merchant/pos");
        } catch {
          /* first-time merchant */
        }
      }
      if (presetsResp.status === "fulfilled") setPresets(presetsResp.value.presets || []);
    } catch (error) {
      toast.error(error.message || "Merchant Setup konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const persistState = async (nextState) => {
    if (!merchant?.merchant_id) return;
    setSaving(true);
    try {
      await api.saveMerchantSetupState(nextState);
    } catch (error) {
      toast.error(error.message || "Setup konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!merchant?.merchant_id || loading) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { persistState(state); }, 700);
    return () => clearTimeout(saveTimer.current);
  }, [state, merchant?.merchant_id, loading]);

  const technicallyAvailable = useMemo(() => {
    const map = {};
    for (const item of PAYMENT_OPTIONS) map[item.key] = isEnabled(item.feature, merchant || { role: "merchant" }, { platform: "web", country: state.business_info.country || "DE" });
    return map;
  }, [isEnabled, merchant, state.business_info.country]);

  const ensureMerchantScaffold = async () => {
    if (merchant?.merchant_id) return { merchant, store, register };
    const businessName = state.business_info.business_name?.trim();
    if (!businessName) throw new Error("Bitte zuerst den Geschäftsnamen eintragen.");
    const merchantResp = await api.registerPosMerchant({
      business_name: businessName,
      business_type: (state.business_type || "Sonstiges").toLowerCase().replace(/[^a-z]/g, "_") || "other",
      tax_id: state.business_info.tax_number || undefined,
      contact_email: state.business_info.email || undefined,
      contact_phone: state.business_info.telephone || undefined,
      country: state.business_info.country || "DE",
    });
    const nextMerchant = merchantResp.merchant || merchantResp;
    const storeResp = await api.createPosStore({ name: businessName, address: state.business_info.address || "", city: state.business_info.city || "", country: state.business_info.country || "DE" });
    const nextStore = storeResp.store || storeResp;
    const registerResp = await api.createPosRegister({ store_id: nextStore.store_id, name: "Hauptkasse", location: "Front" });
    const nextRegister = registerResp.register || registerResp;
    setMerchant(nextMerchant);
    setStore(nextStore);
    setRegister(nextRegister);
    return { merchant: nextMerchant, store: nextStore, register: nextRegister };
  };

  const goNext = async () => {
    try {
      const currentStep = STEPS[currentIndex];
      let completedSteps = Array.from(new Set([...(state.completed_steps || []), currentStep.key]));
      let nextIndex = Math.min(STEPS.length - 1, currentIndex + 1);
      if (currentStep.key === "geschaeft") await ensureMerchantScaffold();
      if (currentStep.key === "branche") await api.applyMerchantSetupPreset({ business_type: state.business_type });
      const nextState = {
        ...state,
        current_step: STEPS[nextIndex].key,
        completed_steps: completedSteps,
        onboarding_percentage: Math.round((completedSteps.length / STEPS.length) * 100),
        activation_status: STEPS[nextIndex].key === "fertig" ? "ready" : "incomplete",
      };
      setState(nextState);
      await persistState(nextState);
    } catch (error) {
      toast.error(error.message || "Schritt konnte nicht abgeschlossen werden.");
    }
  };

  const goBack = async () => {
    const nextIndex = Math.max(0, currentIndex - 1);
    const nextState = { ...state, current_step: STEPS[nextIndex].key };
    setState(nextState);
    await persistState(nextState);
  };

  const addQuickProduct = async () => {
    try {
      const scaffold = await ensureMerchantScaffold();
      const created = await api.createPosProduct({ store_id: scaffold.store.store_id, name: quickProduct.name, price: Number(quickProduct.price), category: state.business_type || "Allgemein", tax_rate: 0.19, track_stock: false, stock: 0 });
      setProducts((current) => [created.product || created, ...current]);
      setQuickProduct({ name: "", price: "" });
      setState((current) => ({ ...current, product_setup: { ...current.product_setup, mode: "manual", recent_products: [quickProduct.name, ...(current.product_setup?.recent_products || [])].slice(0, 8) } }));
      toast.success("Produkt hinzugefügt.");
    } catch (error) {
      toast.error(error.message || "Produkt konnte nicht angelegt werden.");
    }
  };

  const importCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const scaffold = await ensureMerchantScaffold();
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean).slice(1);
      for (const line of lines.slice(0, 50)) {
        const [name, category, price, taxRate] = line.split(",");
        if (!name || !price) continue;
        await api.createPosProduct({ store_id: scaffold.store.store_id, name: name.trim(), category: (category || state.business_type || "Allgemein").trim(), price: Number(price), tax_rate: Number(taxRate || 0.19), track_stock: false, stock: 0 });
      }
      toast.success("CSV importiert.");
      await load();
    } catch (error) {
      toast.error(error.message || "CSV konnte nicht importiert werden.");
    }
  };

  const savePaymentToggle = (key, enabled) => setState((current) => ({ ...current, payment_methods: { ...(current.payment_methods || {}), [key]: enabled ? "enabled" : "disabled" } }));

  const runHardwareTest = async (deviceKey) => {
    try {
      const result = await api.testMerchantHardware({ device_key: deviceKey, device_type: deviceKey, test_action: "ping" });
      setState((current) => ({ ...current, devices: { ...(current.devices || {}), [deviceKey]: result.result } }));
      toast.message(result.result.message);
    } catch (error) {
      toast.error(error.message || "Hardware-Test fehlgeschlagen.");
    }
  };

  const inviteStaff = async () => {
    try {
      const scaffold = await ensureMerchantScaffold();
      await api.invitePosStaff({ store_id: scaffold.store.store_id, user_email: staffInvite.email, role: staffInvite.role === "Kassierer" ? "cashier" : staffInvite.role === "Manager" ? "store_manager" : "merchant_admin" });
      setStaffInvite({ name: "", email: "", role: "Kassierer" });
      toast.success("Mitarbeiter eingeladen.");
      await load();
    } catch (error) {
      toast.error(error.message || "Einladung fehlgeschlagen.");
    }
  };

  const completeTestSale = async () => {
    try {
      await api.createMerchantOnboardingTestSale({ product_name: products[0]?.name || "Testprodukt", amount: products[0]?.price || 1.5, payment_method: "testzahlung" });
      toast.success("TESTZAHLUNG gespeichert.");
      await load();
      onNavigate?.("/merchant/pos");
    } catch (error) {
      toast.error(error.message || "Testverkauf fehlgeschlagen.");
    }
  };

  if (loading) return <div className="min-h-screen bg-[#030507]" data-testid="merchant-setup-loading" />;

  return (
    <div className="min-h-screen bg-[#030507] px-4 py-5 sm:px-5 lg:px-8" data-testid="merchant-setup-page">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="merchant-setup-back-button"><ArrowLeft size={18} /></button>
            <div>
              <h1 className="text-3xl font-black text-white">Merchant Setup</h1>
              <p className="text-sm text-white/62">Ein neuer Händler soll die Kasse ohne Technikkenntnisse einrichten können.</p>
            </div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white" data-testid="merchant-setup-progress-chip">{saving ? "Speichert…" : "Automatisch gespeichert"}</div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-5" data-testid="merchant-setup-progress-bar">
          <div className="grid gap-3 md:grid-cols-7">
            {STEPS.map((step, index) => (
              <button key={step.key} onClick={() => setState((current) => ({ ...current, current_step: step.key }))} className={`rounded-[20px] border px-3 py-3 text-left text-sm font-bold ${step.key === state.current_step ? "border-cyan-400/30 bg-cyan-400/12 text-cyan-100" : state.completed_steps?.includes(step.key) ? "border-emerald-400/30 bg-emerald-400/12 text-emerald-100" : "border-white/10 bg-[#071019] text-white/60"}`} data-testid={`merchant-setup-step-${index + 1}`}>{step.label}</button>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.22)]" data-testid={`merchant-setup-panel-${state.current_step}`}>
          {state.current_step === "geschaeft" ? <BusinessStep state={state} setState={setState} /> : null}
          {state.current_step === "branche" ? <IndustryStep state={state} setState={setState} presets={presets} /> : null}
          {state.current_step === "produkte" ? <ProductsStep state={state} setState={setState} quickProduct={quickProduct} setQuickProduct={setQuickProduct} addQuickProduct={addQuickProduct} importCsv={importCsv} products={products} /> : null}
          {state.current_step === "zahlungen" ? <PaymentsStep state={state} technicallyAvailable={technicallyAvailable} onToggle={savePaymentToggle} /> : null}
          {state.current_step === "geraete" ? <DevicesStep state={state} runHardwareTest={runHardwareTest} /> : null}
          {state.current_step === "mitarbeiter" ? <StaffStep staffInvite={staffInvite} setStaffInvite={setStaffInvite} inviteStaff={inviteStaff} staff={staff} /> : null}
          {state.current_step === "fertig" ? <FinishStep state={state} products={products} staff={staff} onNavigate={onNavigate} completeTestSale={completeTestSale} /> : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button onClick={goBack} disabled={currentIndex === 0} variant="outline" className="border-white/10 bg-white/5 text-white" data-testid="merchant-setup-prev-button"><ChevronLeft size={16} className="mr-2" />Zurück</Button>
            {state.current_step !== "fertig" ? <Button onClick={goNext} className="min-w-[180px] bg-[#06B6D4] text-black" data-testid="merchant-setup-next-button">Weiter<ChevronRight size={16} className="ml-2" /></Button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function BusinessStep({ state, setState }) {
  const info = state.business_info || {};
  return <div className="space-y-4" data-testid="merchant-setup-business-step"><h2 className="text-2xl font-black text-white">Geschäft</h2><div className="grid gap-3 md:grid-cols-2">{[
    ["business_name", "Business name"], ["legal_business_name", "Legal business name"], ["country", "Country"], ["city", "City"], ["address", "Address"], ["telephone", "Telephone"], ["email", "Email"], ["currency", "Currency"], ["preferred_language", "Preferred language"], ["tax_number", "Tax number (optional in Testphase)"], ["logo", "Logo URL (optional)"],
  ].map(([key, label]) => <label key={key} className="block text-sm text-white/68"><span className="mb-2 block">{label}</span><input value={info[key] || ""} onChange={(event) => setState((current) => ({ ...current, business_info: { ...current.business_info, [key]: event.target.value } }))} className="h-12 w-full rounded-2xl border border-white/10 bg-[#071019] px-4 text-white outline-none" data-testid={`merchant-setup-input-${key}`} /></label>)}</div><details className="rounded-[20px] border border-white/10 bg-[#071019] p-4 text-sm text-white/62"><summary className="cursor-pointer font-bold text-white">Weitere Angaben</summary><div className="mt-3">Lange Pflichtformulare sind absichtlich entfernt. Erweiterte Felder können später in Einstellungen ergänzt werden.</div></details></div>;
}

function IndustryStep({ state, setState, presets }) {
  return <div className="space-y-4" data-testid="merchant-setup-industry-step"><h2 className="text-2xl font-black text-white">Branche</h2><div className="grid gap-3 sm:grid-cols-2">{BUSINESS_TYPES.map((type, index) => <button key={type} onClick={() => setState((current) => ({ ...current, business_type: type }))} className={`rounded-[22px] border p-4 text-left ${state.business_type === type ? "border-cyan-400/30 bg-cyan-400/12 text-cyan-100" : "border-white/10 bg-[#071019] text-white"}`} data-testid={`merchant-setup-business-type-${index + 1}`}><div className="font-black">{type}</div><div className="mt-2 text-xs opacity-70">{presets.find((preset) => preset.label === type)?.key || "minimal_v1"}</div></button>)}</div></div>;
}

function ProductsStep({ state, setState, quickProduct, setQuickProduct, addQuickProduct, importCsv, products }) {
  return <div className="space-y-4" data-testid="merchant-setup-products-step"><h2 className="text-2xl font-black text-white">Produkte</h2><div className="grid gap-3 lg:grid-cols-3"><button onClick={() => setState((current) => ({ ...current, product_setup: { ...current.product_setup, mode: "manual" } }))} className={`rounded-[22px] border p-4 text-left ${state.product_setup?.mode === "manual" ? "border-cyan-400/30 bg-cyan-400/12 text-cyan-100" : "border-white/10 bg-[#071019] text-white"}`} data-testid="merchant-setup-manual-products-option">Produkte manuell hinzufügen</button><label className="rounded-[22px] border border-white/10 bg-[#071019] p-4 text-left text-white" data-testid="merchant-setup-csv-option"><div className="font-black">CSV-Datei importieren</div><input type="file" accept=".csv" className="mt-3 block w-full text-xs" onChange={importCsv} /></label><button onClick={() => setState((current) => ({ ...current, product_setup: { ...current.product_setup, mode: "later" } }))} className={`rounded-[22px] border p-4 text-left ${state.product_setup?.mode === "later" ? "border-cyan-400/30 bg-cyan-400/12 text-cyan-100" : "border-white/10 bg-[#071019] text-white"}`} data-testid="merchant-setup-later-option">Später einrichten</button></div><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_auto]"><input value={quickProduct.name} onChange={(event) => setQuickProduct((current) => ({ ...current, name: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-[#071019] px-4 text-white outline-none" placeholder="Produktname" data-testid="merchant-setup-quick-product-name" /><input value={quickProduct.price} onChange={(event) => setQuickProduct((current) => ({ ...current, price: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-[#071019] px-4 text-white outline-none" placeholder="Preis" data-testid="merchant-setup-quick-product-price" /><Button onClick={addQuickProduct} className="h-12 bg-[#06B6D4] text-black" data-testid="merchant-setup-add-product-button">Schnell speichern</Button></div><div className="grid gap-3 md:grid-cols-2">{products.slice(0, 8).map((product, index) => <div key={product.product_id || `${product.name}-${index}`} className="rounded-[20px] border border-white/10 bg-[#071019] p-4" data-testid={`merchant-setup-product-row-${index + 1}`}><div className="font-black text-white">{product.name}</div><div className="mt-1 text-sm text-white/58">{product.category || "Allgemein"}</div><div className="mt-2 text-sm text-[#82E7FF]">{Number(product.price || 0).toFixed(2)} €</div></div>)}</div></div>;
}

function PaymentsStep({ state, technicallyAvailable, onToggle }) {
  return <div className="space-y-4" data-testid="merchant-setup-payments-step"><h2 className="text-2xl font-black text-white">Zahlungen</h2><div className="grid gap-3 md:grid-cols-2">{PAYMENT_OPTIONS.map((item, index) => { const enabled = state.payment_methods?.[item.key] === "enabled"; const available = technicallyAvailable[item.key]; return <div key={item.key} className="flex items-center justify-between rounded-[22px] border border-white/10 bg-[#071019] p-4" data-testid={`merchant-setup-payment-method-${index + 1}`}><div><div className="font-black text-white">{item.label}</div><div className="mt-1 text-xs text-white/54">{available ? "Verfügbar" : "Noch nicht aktiviert"}</div></div><button onClick={() => available && onToggle(item.key, !enabled)} disabled={!available} className={`rounded-full px-4 py-2 text-xs font-bold ${enabled ? "bg-emerald-400 text-black" : "bg-white/10 text-white/72"}`} data-testid={`merchant-setup-payment-toggle-${index + 1}`}>{enabled ? "An" : available ? "Aus" : "Noch nicht aktiviert"}</button></div>; })}</div></div>;
}

function DevicesStep({ state, runHardwareTest }) {
  return <div className="space-y-4" data-testid="merchant-setup-devices-step"><h2 className="text-2xl font-black text-white">Geräte</h2><div className="grid gap-3 md:grid-cols-2">{DEVICE_OPTIONS.map((device, index) => <div key={device} className="rounded-[22px] border border-white/10 bg-[#071019] p-4" data-testid={`merchant-setup-device-${index + 1}`}><div className="flex items-center justify-between gap-3"><div><div className="font-black text-white">{device}</div><div className="mt-1 text-xs text-white/54">{state.devices?.[device]?.status || "optional"}</div></div><Button onClick={() => runHardwareTest(device)} variant="outline" className="border-white/10 bg-white/5 text-white" data-testid={`merchant-setup-device-test-${index + 1}`}><Wifi size={14} className="mr-2" />Test connection</Button></div><div className="mt-2 text-xs text-white/54">{state.devices?.[device]?.message || "Nicht verbunden bis ein echter Test erfolgreich war."}</div></div>)}</div></div>;
}

function StaffStep({ staffInvite, setStaffInvite, inviteStaff, staff }) {
  return <div className="space-y-4" data-testid="merchant-setup-staff-step"><h2 className="text-2xl font-black text-white">Mitarbeiter</h2><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto]"><input value={staffInvite.name} onChange={(event) => setStaffInvite((current) => ({ ...current, name: event.target.value }))} placeholder="Name" className="h-12 rounded-2xl border border-white/10 bg-[#071019] px-4 text-white outline-none" data-testid="merchant-setup-staff-name" /><input value={staffInvite.email} onChange={(event) => setStaffInvite((current) => ({ ...current, email: event.target.value }))} placeholder="E-Mail oder Telefon" className="h-12 rounded-2xl border border-white/10 bg-[#071019] px-4 text-white outline-none" data-testid="merchant-setup-staff-email" /><select value={staffInvite.role} onChange={(event) => setStaffInvite((current) => ({ ...current, role: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-[#071019] px-4 text-white outline-none" data-testid="merchant-setup-staff-role"><option>Kassierer</option><option>Manager</option><option>Eigentümer</option></select><Button onClick={inviteStaff} className="h-12 bg-[#06B6D4] text-black" data-testid="merchant-setup-invite-staff-button">Einladen</Button></div><div className="grid gap-3 md:grid-cols-2">{staff.map((member, index) => <div key={member.user_id || member.user_email || index} className="rounded-[20px] border border-white/10 bg-[#071019] p-4" data-testid={`merchant-setup-staff-row-${index + 1}`}><div className="font-black text-white">{member.user_email || member.email}</div><div className="mt-1 text-xs text-white/54">{member.role}</div></div>)}</div><div className="rounded-[20px] border border-white/10 bg-[#071019] p-4 text-sm text-white/62">Kassierer sehen nur Verkauf, Zahlung, Beleg und eigene Schicht. Keine Auszahlungen, Finanzberichte, Eigentümer-Einstellungen oder Feature Control.</div></div>;
}

function FinishStep({ state, products, staff, onNavigate, completeTestSale }) {
  const checks = [
    { label: "Geschäft eingerichtet", done: Boolean(state.business_info?.business_name) },
    { label: "Produkte vorhanden", done: products.length > 0 },
    { label: "Zahlungsmethoden gewählt", done: Object.values(state.payment_methods || {}).includes("enabled") },
    { label: "Gerät vorbereitet", done: Object.keys(state.devices || {}).length > 0 },
    { label: "Mitarbeiter eingeladen", done: staff.length > 0 },
    { label: "Testverkauf abgeschlossen", done: Boolean(state.test_sale_completed) },
  ];
  return <div className="space-y-5" data-testid="merchant-setup-finish-step"><div><h2 className="text-3xl font-black text-white">Deine BidBlitz-Kasse ist bereit.</h2><p className="mt-2 text-sm text-white/62">Zum Abschluss führen wir noch eine Testzahlung durch, die keine echten Wallet-Salden verändert.</p></div><div className="grid gap-3 md:grid-cols-2">{checks.map((item, index) => <div key={item.label} className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-[#071019] p-4" data-testid={`merchant-setup-check-${index + 1}`}><CheckCircle2 size={18} className={item.done ? "text-emerald-300" : "text-white/28"} /><div className="text-white">{item.label}</div></div>)}</div><div className="rounded-[24px] border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100" data-testid="merchant-setup-test-sale-banner">TESTZAHLUNG – KEIN ECHTES GELD</div><div className="flex flex-wrap gap-3"><Button onClick={completeTestSale} className="bg-[#06B6D4] text-black" data-testid="merchant-setup-complete-test-sale-button">Testzahlung ausführen</Button><Button onClick={() => onNavigate?.("/merchant/pos")} variant="outline" className="border-white/10 bg-white/5 text-white" data-testid="merchant-setup-open-pos-button">Kasse öffnen</Button><Button onClick={() => onNavigate?.("/merchant/pos")} variant="outline" className="border-white/10 bg-white/5 text-white" data-testid="merchant-setup-add-products-button">Weitere Produkte hinzufügen</Button><Button onClick={() => onNavigate?.("/merchant")} variant="outline" className="border-white/10 bg-white/5 text-white" data-testid="merchant-setup-settings-button">Einstellungen öffnen</Button></div></div>;
}