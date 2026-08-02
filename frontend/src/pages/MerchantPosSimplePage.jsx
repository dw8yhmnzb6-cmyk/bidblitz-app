import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CreditCard, QrCode, Receipt, Search, Smartphone, Wallet, User, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { useFeatureFlags } from "../store/FeatureFlagContext";
import { useUser } from "../store";
import { api } from "../services/api";

const METHOD_META = {
  cash: { label: "Bar", icon: Receipt, apiMethod: "cash" },
  card: { label: "Karte / NFC", icon: CreditCard, apiMethod: "card_external" },
  tap_to_pay: { label: "Tap to Pay", icon: Smartphone, apiMethod: "tap_to_pay" },
  wallet: { label: "BidBlitz Wallet", icon: Wallet, apiMethod: "wallet_qr" },
  qr: { label: "QR-Code", icon: QrCode, apiMethod: "wallet_qr" },
  voucher: { label: "Gutschein", icon: Receipt, apiMethod: "cash" },
  invoice: { label: "Rechnung", icon: Receipt, apiMethod: "cash" },
};

export default function MerchantPosSimplePage({ onBack, onNavigate }) {
  const user = useUser();
  const { isEnabled } = useFeatureFlags();
  const [setup, setSetup] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(["Alle"]);
  const [selectedCategory, setSelectedCategory] = useState("Alle");
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [cart, setCart] = useState([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentState, setPaymentState] = useState(null);
  const [loading, setLoading] = useState(true);

  const roleNav = useMemo(() => {
    const role = user?.role || "cashier";
    if (role === "admin" || role === "merchant") return ["Übersicht", "Kasse", "Verkäufe", "Produkte", "Lager", "Mitarbeiter", "Filialen", "Kunden", "Auszahlungen", "Berichte", "Einstellungen"];
    if (role === "manager") return ["Kasse", "Verkäufe", "Produkte", "Lager", "Mitarbeiter", "Berichte", "Mehr"];
    return ["Kasse", "Verkäufe", "Produkte", "Mehr"];
  }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const setupData = await api.getMerchantSetupState();
      setSetup(setupData);
      if (!setupData.progress || setupData.progress.activation_status !== "ready") {
        onNavigate?.("/merchant/setup");
        return;
      }
      const primaryStore = setupData.stores?.[0];
      const primaryRegister = setupData.registers?.[0];
      if (!primaryStore || !primaryRegister) {
        toast.error("Store oder Kasse fehlt. Bitte Setup abschließen.");
        onNavigate?.("/merchant/setup");
        return;
      }
      const shift = await api.getCurrentPosShift(primaryRegister.register_id);
      if (!shift.shift) await api.openPosShift({ register_id: primaryRegister.register_id, opening_cash: 0 });
      const productData = await api.searchPosProducts({ storeId: primaryStore.store_id, q: "", limit: 120 });
      const items = productData.products || productData.items || [];
      setProducts(items);
      setCategories(["Alle", ...Array.from(new Set(items.map((item) => item.category).filter(Boolean)))]);
    } catch (error) {
      toast.error(error.message || "POS konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const payload = {
      merchant_name: setup?.merchant?.business_name || "BidBlitz Merchant",
      logo: setup?.progress?.business_info?.logo || "",
      items: cart.map((item) => ({ name: item.name, quantity: item.quantity, total: round2(item.price * item.quantity) })),
      total: round2(cart.reduce((sum, item) => sum + item.price * item.quantity, 0)),
      payment_instruction: paymentState?.instruction || "Bitte Karte oder Smartphone an das Gerät halten.",
      status: paymentState?.status || "idle",
    };
    localStorage.setItem("bidblitz-pos-customer-display", JSON.stringify(payload));
  }, [cart, paymentState, setup]);

  const filteredProducts = useMemo(() => products.filter((item) => {
    const categoryMatch = selectedCategory === "Alle" || item.category === selectedCategory;
    const text = `${item.name} ${item.barcode || ""}`.toLowerCase();
    const searchMatch = !search || text.includes(search.toLowerCase());
    const barcodeMatch = !barcode || String(item.barcode || "").includes(barcode.trim());
    return categoryMatch && searchMatch && barcodeMatch;
  }), [products, selectedCategory, search, barcode]);

  const totals = useMemo(() => {
    const subtotal = round2(cart.reduce((sum, item) => sum + item.price * item.quantity, 0));
    const discount = isEnabled("merchant.pos.discounts", user, { platform: "web" }) ? 0 : 0;
    const tax = round2(subtotal * 0.19);
    const total = round2(subtotal - discount + tax);
    return { subtotal, discount, tax, total };
  }, [cart, isEnabled, user]);

  const enabledMethods = useMemo(() => {
    const paymentMethods = setup?.progress?.payment_methods || {};
    return PAYMENT_KEYS.filter((key) => {
      const featureMeta = METHOD_META[key];
      const technical = featureMeta ? isEnabled(`merchant.pos.payment.${key === "card" ? "card" : key}`, user, { platform: "web", country: setup?.progress?.business_info?.country || "DE" }) : true;
      const configured = paymentMethods[key] === "enabled" || paymentMethods[key] === true;
      return technical && configured;
    });
  }, [isEnabled, setup, user]);

  const addToCart = (product) => setCart((current) => {
    const exists = current.find((item) => item.product_id === product.product_id);
    if (exists) return current.map((item) => item.product_id === product.product_id ? { ...item, quantity: item.quantity + 1 } : item);
    return [...current, { product_id: product.product_id, name: product.name, category: product.category, price: Number(product.price), quantity: 1, tax_rate: Number(product.tax_rate || 0.19), image_url: product.image_url }];
  });

  const setQuantity = (productId, delta) => setCart((current) => current.map((item) => item.product_id === productId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  const removeItem = (productId) => setCart((current) => current.filter((item) => item.product_id !== productId));

  const checkout = async (methodKey) => {
    if (!cart.length || !setup?.registers?.[0]) return;
    const methodMeta = METHOD_META[methodKey];
    if (methodKey === "tap_to_pay") {
      setPaymentState({ status: "unavailable", instruction: "Tap to Pay ist für diesen Händler noch nicht aktiviert." });
      return;
    }
    try {
      setPaymentState({ status: "processing", instruction: "Zahlung wird verarbeitet…" });
      const cartResp = await api.createPosCart({ register_id: setup.registers[0].register_id, items: cart.map((item) => ({ product_id: item.product_id, quantity: item.quantity })), discount_pct: 0, customer_note: "" });
      const cartId = cartResp.cart?.cart_id || cartResp.cart_id;
      const paymentBody = { cart_id: cartId, method: methodMeta.apiMethod };
      if (methodMeta.apiMethod === "cash") paymentBody.cash_received = totals.total;
      if (methodMeta.apiMethod === "card_external") paymentBody.card_reference = `CARD-${Date.now()}`;
      const paymentResp = await api.createPosPayment(paymentBody);
      const sale = paymentResp.sale;
      if (paymentResp.awaiting_customer && paymentResp.payment?.qr_code) {
        setPaymentState({ status: "awaiting", instruction: paymentResp.payment.qr_code, payment: paymentResp.payment });
        return;
      }
      if (sale || paymentResp.payment?.status === "paid") {
        setPaymentState({ status: "success", instruction: "Zahlung erfolgreich. Vielen Dank!", payment: paymentResp.payment, sale });
        setTimeout(() => {
          setCart([]);
          setPaymentOpen(false);
          setPaymentState(null);
        }, 2000);
      }
    } catch (error) {
      setPaymentState({ status: "failed", instruction: error.message || "Zahlung fehlgeschlagen." });
      toast.error(error.message || "Checkout fehlgeschlagen.");
    }
  };

  if (loading) return <div className="min-h-screen bg-[#030507]" data-testid="merchant-pos-loading" />;
  if (!setup) return null;

  return (
    <div className="min-h-screen bg-[#030507] px-3 py-4 sm:px-4 lg:px-6" data-testid="merchant-pos-page">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="merchant-pos-back-button"><ArrowLeft size={18} /></button>
            <div>
              <h1 className="text-3xl font-black text-white">Kasse</h1>
              <p className="text-sm text-white/62">Ein neuer Mitarbeiter soll diesen Checkout in weniger als 5 Minuten verstehen.</p>
            </div>
          </div>
          <Button onClick={() => window.open("/merchant/pos/customer-display", "_blank", "noopener,noreferrer")} variant="outline" className="border-white/10 bg-white/5 text-white" data-testid="merchant-pos-customer-display-button">Customer Display</Button>
        </div>

        <div className="flex flex-wrap gap-2" data-testid="merchant-pos-role-navigation">
          {roleNav.map((item, index) => <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/72" data-testid={`merchant-pos-role-nav-${index + 1}`}>{item}</span>)}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <section className="space-y-4" data-testid="merchant-pos-catalogue-section">
            <div className="grid gap-3 rounded-[28px] border border-white/10 bg-white/5 p-4 sm:grid-cols-3">
              <InfoChip icon={Store} label="Filiale" value={setup.stores?.[0]?.name || "-"} testId="merchant-pos-branch-chip" />
              <InfoChip icon={Receipt} label="Kasse" value={setup.registers?.[0]?.name || "-"} testId="merchant-pos-register-chip" />
              <InfoChip icon={User} label="Mitarbeiter" value={user?.name || user?.email || "-"} testId="merchant-pos-employee-chip" />
            </div>
            <div className="grid gap-3 rounded-[28px] border border-white/10 bg-white/5 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <label className="flex items-center gap-3 rounded-full border border-white/10 bg-[#071019] px-4 py-3 text-white"><Search size={16} className="text-white/44" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Produkt suchen" className="w-full bg-transparent outline-none" data-testid="merchant-pos-search-input" /></label>
              <input value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Barcode" className="h-[52px] rounded-full border border-white/10 bg-[#071019] px-4 text-white outline-none" data-testid="merchant-pos-barcode-input" />
            </div>
            <div className="flex flex-wrap gap-2" data-testid="merchant-pos-categories-bar">{categories.map((category, index) => <button key={category} onClick={() => setSelectedCategory(category)} className={`min-h-12 rounded-full border px-4 py-3 text-sm font-bold ${selectedCategory === category ? "border-cyan-400/30 bg-cyan-400/12 text-cyan-100" : "border-white/10 bg-white/5 text-white/72"}`} data-testid={`merchant-pos-category-${index + 1}`}>{category}</button>)}</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="merchant-pos-product-grid">
              {filteredProducts.map((product, index) => (
                <button key={product.product_id} onClick={() => addToCart(product)} className="min-h-[96px] rounded-[24px] border border-white/10 bg-[#071019] p-4 text-left text-white transition hover:border-cyan-400/20" data-testid={`merchant-pos-product-tile-${index + 1}`}>
                  <div className="flex items-start justify-between gap-3"><div><div className="text-base font-black leading-tight">{product.name}</div><div className="mt-2 text-sm text-white/54">{product.category || "Allgemein"}</div></div><div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-black">{Number(product.price || 0).toFixed(2)} €</div></div>
                  {Number(product.stock || 0) > 0 && Number(product.stock || 0) <= Number(product.minimum_stock || 0) ? <div className="mt-3 text-xs text-amber-200">Wenig Bestand</div> : null}
                </button>
              ))}
            </div>
          </section>

          <aside className="rounded-[28px] border border-white/10 bg-white/5 p-4" data-testid="merchant-pos-cart-section">
            <h2 className="text-2xl font-black text-white">Warenkorb</h2>
            <div className="mt-4 space-y-3">{cart.map((item, index) => <div key={item.product_id} className="rounded-[20px] border border-white/10 bg-[#071019] p-4" data-testid={`merchant-pos-cart-item-${index + 1}`}><div className="flex items-start justify-between gap-3"><div><div className="font-black text-white">{item.name}</div><div className="mt-1 text-sm text-white/54">{Number(item.price).toFixed(2)} € pro Stück</div></div><button onClick={() => removeItem(item.product_id)} className="text-xs font-bold text-rose-200" data-testid={`merchant-pos-cart-remove-${index + 1}`}>Entfernen</button></div><div className="mt-3 flex items-center justify-between"><div className="flex items-center gap-2"><button onClick={() => setQuantity(item.product_id, -1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid={`merchant-pos-cart-decrease-${index + 1}`}>-</button><div className="w-10 text-center font-black text-white">{item.quantity}</div><button onClick={() => setQuantity(item.product_id, 1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid={`merchant-pos-cart-increase-${index + 1}`}>+</button></div><div className="font-black text-white">{round2(item.price * item.quantity).toFixed(2)} €</div></div></div>)}</div>
            <div className="mt-5 space-y-2 rounded-[22px] border border-white/10 bg-[#071019] p-4 text-sm text-white/68">
              <TotalsRow label="Subtotal" value={totals.subtotal} testId="merchant-pos-subtotal" />
              <TotalsRow label="Rabatt" value={totals.discount} testId="merchant-pos-discount" />
              <TotalsRow label="Steuer" value={totals.tax} testId="merchant-pos-tax" />
              <TotalsRow label="Total" value={totals.total} bold testId="merchant-pos-total" />
            </div>
            <div className="sticky bottom-0 mt-4 bg-[linear-gradient(180deg,rgba(3,5,7,0),rgba(3,5,7,0.9)_24%,rgba(3,5,7,1))] pb-[env(safe-area-inset-bottom)] pt-4">
              <Button onClick={() => setPaymentOpen(true)} disabled={!cart.length} className="h-14 w-full rounded-full bg-[#06B6D4] text-lg font-black text-black" data-testid="merchant-pos-pay-button">BEZAHLEN</Button>
            </div>
          </aside>
        </div>

        {paymentOpen ? <div className="fixed inset-0 z-[70] bg-black/70 p-4" data-testid="merchant-pos-payment-modal"><div className="mx-auto flex min-h-full max-w-xl items-end justify-center sm:items-center"><div className="w-full rounded-[30px] border border-white/10 bg-[#030507] p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-2xl font-black text-white">Bezahlen</h2><p className="text-sm text-white/62">Nur aktivierte Zahlungsmethoden werden angezeigt.</p></div><button onClick={() => { setPaymentOpen(false); setPaymentState(null); }} className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-white" data-testid="merchant-pos-payment-close-button">Schließen</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{enabledMethods.map((method, index) => { const meta = METHOD_META[method]; const Icon = meta.icon; return <button key={method} onClick={() => checkout(method)} className="min-h-[96px] rounded-[24px] border border-white/10 bg-[#071019] p-4 text-left text-white" data-testid={`merchant-pos-payment-method-${index + 1}`}><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-cyan-400/20 bg-cyan-400/10 text-cyan-100"><Icon size={18} /></div><div><div className="font-black">{meta.label}</div><div className="text-xs text-white/54">{method === "tap_to_pay" ? "Noch nicht aktiviert" : "Aktiv"}</div></div></div></button>; })}</div>{paymentState ? <div className="mt-5 rounded-[22px] border border-white/10 bg-white/5 p-4 text-center" data-testid="merchant-pos-payment-state"><div className={`text-lg font-black ${paymentState.status === "success" ? "text-emerald-200" : paymentState.status === "failed" ? "text-rose-200" : "text-white"}`}>{paymentState.status === "success" ? "Zahlung erfolgreich." : paymentState.status === "processing" ? "Verarbeitung…" : paymentState.status === "awaiting" ? "Bitte QR-Code scannen" : paymentState.status === "unavailable" ? "Nicht verfügbar" : "Fehler"}</div><div className="mt-2 text-sm text-white/62 break-words">{paymentState.instruction}</div>{paymentState.status === "success" ? <div className="mt-4 text-5xl">✅</div> : null}</div> : null}</div></div></div> : null}
      </div>
    </div>
  );
}

const PAYMENT_KEYS = ["card", "tap_to_pay", "wallet", "qr", "cash", "voucher", "invoice"];

function round2(value) { return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100; }
function InfoChip({ icon: Icon, label, value, testId }) { return <div className="rounded-[22px] border border-white/10 bg-[#071019] p-4" data-testid={testId}><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-cyan-400/20 bg-cyan-400/10 text-cyan-100"><Icon size={18} /></div><div><div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#82E7FF]">{label}</div><div className="mt-1 text-base font-black text-white">{value}</div></div></div></div>; }
function TotalsRow({ label, value, bold, testId }) { return <div className={`flex items-center justify-between ${bold ? "pt-2 text-base font-black text-white" : ""}`} data-testid={testId}><span>{label}</span><span>{Number(value || 0).toFixed(2)} €</span></div>; }