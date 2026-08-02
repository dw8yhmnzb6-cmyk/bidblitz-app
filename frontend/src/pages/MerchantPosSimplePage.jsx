import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Receipt, Search, ShoppingCart, Star, Store, User, Wifi, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { useFeatureFlags } from "../store/FeatureFlagContext";
import { useI18n, useUser } from "../store";
import { useNetwork } from "../store/NetworkContext";
import { api } from "../services/api";
import { tracker } from "../services/tracker";
import { PosCartPanel } from "../components/merchant-pos/PosCartPanel";
import { PosConnectionStatus } from "../components/merchant-pos/PosConnectionStatus";
import { getPosCopy } from "../components/merchant-pos/posCopy";
import { PosHelpTray } from "../components/merchant-pos/PosHelpTray";
import { PosPaymentSheet } from "../components/merchant-pos/PosPaymentSheet";
import { PosProductTile } from "../components/merchant-pos/PosProductTile";
import { PosRoleOverview } from "../components/merchant-pos/PosRoleOverview";
import { PosTrainingGuide, POS_TRAINING_STORAGE_KEY } from "../components/merchant-pos/PosTrainingGuide";

const METHOD_META = {
  cash: { label: "Bargeld", apiMethod: "cash", descriptionKey: "cashDescription" },
  card: { label: "Karte / NFC", apiMethod: "card_external", descriptionKey: "cardDescription" },
  tap_to_pay: { label: "Tap to Pay", apiMethod: "tap_to_pay", descriptionKey: "tapToPayDescription" },
  wallet: { label: "BidBlitz Wallet", apiMethod: "wallet_qr", descriptionKey: "walletDescription" },
  qr: { label: "QR-Code", apiMethod: "wallet_qr", descriptionKey: "qrDescription" },
  voucher: { label: "Gutschein", apiMethod: "cash", descriptionKey: "voucherDescription" },
  invoice: { label: "Rechnung", apiMethod: "cash", descriptionKey: "invoiceDescription" },
};

const PAYMENT_KEYS = ["cash", "card", "wallet", "qr", "voucher", "invoice", "tap_to_pay"];

const STATUS_MAP = {
  idle: "ready",
  pending: "review",
  paid: "success",
  cancelled: "failure",
  expired: "failure",
  refunded: "review",
};

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function buildCartSignature(cart) {
  return cart.map((item) => `${item.product_id}:${item.quantity}`).join("|");
}

function roleSummaryMetrics(copy, role, sales = []) {
  const total = round2(sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0));
  const lowStock = sales.filter((sale) => (sale.items || []).length >= 4).length;
  if (role === "manager") {
    return [
      { label: copy.managerMetricShifts, value: "1", icon: "shifts" },
      { label: copy.managerMetricRefunds, value: "0", icon: "refunds" },
      { label: copy.managerMetricDevice, value: "1", icon: "devices" },
      { label: copy.managerMetricStock, value: `${lowStock}`, icon: "stock" },
      { label: copy.managerMetricRevenue, value: `${total.toFixed(2)} €`, icon: "revenue" },
    ];
  }
  return [
    { label: copy.ownerMetricRevenue, value: `${total.toFixed(2)} €`, icon: "revenue" },
    { label: copy.ownerMetricSales, value: `${sales.length}`, icon: "sales" },
    { label: copy.ownerMetricPayouts, value: "0", icon: "payouts" },
    { label: copy.ownerMetricStock, value: `${lowStock}`, icon: "stock" },
    { label: copy.ownerMetricDevices, value: "1", icon: "devices" },
    { label: copy.ownerMetricTasks, value: "3", icon: "tasks" },
  ];
}

export default function MerchantPosSimplePage({ onBack, onNavigate }) {
  const user = useUser();
  const { isEnabled } = useFeatureFlags();
  const { lang } = useI18n();
  const { online } = useNetwork();
  const copy = getPosCopy(lang);
  const [setup, setSetup] = useState(null);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [categories, setCategories] = useState(["Alle"]);
  const [selectedCategory, setSelectedCategory] = useState("Alle");
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentState, setPaymentState] = useState({ stage: "ready", headline: copy.choosePayment, description: copy.holdCard });
  const [activePayment, setActivePayment] = useState(null);
  const [cartSession, setCartSession] = useState(null);
  const [favourites, setFavourites] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bidblitz-pos-favourites") || "[]"); } catch { return []; }
  });
  const [recentItems, setRecentItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bidblitz-pos-recent-items") || "[]"); } catch { return []; }
  });
  const [showTraining, setShowTraining] = useState(() => !localStorage.getItem(POS_TRAINING_STORAGE_KEY));
  const searchRef = useRef(null);

  const role = useMemo(() => {
    if (user?.role === "admin" || user?.role === "merchant") return "owner";
    if (user?.role === "manager" || user?.role === "store_manager") return "manager";
    return "cashier";
  }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const setupData = await api.getMerchantSetupState();
      setSetup(setupData);
      const primaryStore = setupData.stores?.[0];
      const primaryRegister = setupData.registers?.[0];
      if (!primaryStore || !primaryRegister) {
        toast.error("Filiale oder Kasse fehlt. Bitte Setup abschließen.");
        onNavigate?.("/merchant/setup");
        return;
      }

      const [shiftRes, productData, salesRes] = await Promise.all([
        api.getCurrentPosShift(primaryRegister.register_id),
        api.searchPosProducts({ storeId: primaryStore.store_id, q: "", limit: 160 }),
        api.getPosSales(primaryStore.store_id, 20),
      ]);

      if (!shiftRes.shift) {
        await api.openPosShift({ register_id: primaryRegister.register_id, opening_cash: 0 });
      }

      const items = productData.products || productData.items || [];
      setProducts(items);
      setSales(salesRes.sales || []);
      setCategories(["Alle", ...Array.from(new Set(items.map((item) => item.category).filter(Boolean)))]);
      tracker.pageView("merchant_pos_home");
    } catch (error) {
      toast.error(error.message || "POS konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    localStorage.setItem("bidblitz-pos-favourites", JSON.stringify(favourites));
  }, [favourites]);
  useEffect(() => {
    localStorage.setItem("bidblitz-pos-recent-items", JSON.stringify(recentItems));
  }, [recentItems]);

  useEffect(() => {
    const payload = {
      merchant_name: setup?.merchant?.business_name || "BidBlitz Merchant",
      logo: setup?.progress?.business_info?.logo || "",
      items: cart.map((item) => ({ name: item.name, quantity: item.quantity, total: round2(item.line_total || item.price * item.quantity) })),
      subtotal: round2(cart.reduce((sum, item) => sum + Number(item.line_total || item.price * item.quantity), 0)),
      discount: 0,
      tax: totals.tax,
      total: totals.total,
      payment_instruction: paymentState.description || copy.customerReady,
      payment_method: activePayment?.methodLabel || "-",
      receipt_id: paymentState.receiptId || "-",
      status: paymentState.stage === "success" ? "success" : paymentState.stage === "failure" ? "failed" : "idle",
    };
    localStorage.setItem("bidblitz-pos-customer-display", JSON.stringify(payload));
  }, [activePayment?.methodLabel, cart, copy.customerReady, paymentState.description, paymentState.receiptId, paymentState.stage, setup]);

  const roleNav = useMemo(() => {
    if (role === "owner") return [copy.products, copy.cart, copy.sales, copy.hardware];
    if (role === "manager") return [copy.products, copy.cart, copy.sales, copy.help];
    return [copy.products, copy.cart, copy.pay, copy.help];
  }, [copy, role]);

  const topActions = useMemo(() => {
    if (role === "cashier") {
      return [
        { key: "display", label: copy.customerDisplay, path: "/merchant/pos/customer-display" },
      ];
    }
    if (role === "manager") {
      return [
        { key: "display", label: copy.customerDisplay, path: "/merchant/pos/customer-display" },
        { key: "sales", label: copy.sales, path: "/merchant/pos/sales" },
        { key: "hardware", label: copy.hardware, path: "/merchant/pos/hardware" },
      ];
    }
    return [
      { key: "display", label: copy.customerDisplay, path: "/merchant/pos/customer-display" },
      { key: "sales", label: copy.sales, path: "/merchant/pos/sales" },
      { key: "hardware", label: copy.hardware, path: "/merchant/pos/hardware" },
    ];
  }, [copy, role]);

  const visibleMethods = useMemo(() => {
    const paymentMethods = setup?.progress?.payment_methods || {};
    return PAYMENT_KEYS.map((key) => {
      const meta = METHOD_META[key];
      const featureKey = `merchant.pos.payment.${key === "card" ? "card" : key}`;
      const enabledByFeature = meta ? isEnabled(featureKey, user, { platform: "web", country: setup?.progress?.business_info?.country || "DE" }) : true;
      const enabledBySetup = paymentMethods[key] === "enabled" || paymentMethods[key] === true;
      const certified = key !== "tap_to_pay";
      const enabled = Boolean(enabledByFeature && enabledBySetup && certified);
      return { key, label: meta.label, apiMethod: meta.apiMethod, description: copy[meta.descriptionKey], enabled };
    });
  }, [copy, isEnabled, setup, user]);

  const featuredProducts = useMemo(() => {
    const favouritesList = products.filter((item) => favourites.includes(item.product_id));
    const recentList = recentItems.map((id) => products.find((item) => item.product_id === id)).filter(Boolean);
    return { favourites: favouritesList.slice(0, 6), recent: recentList.slice(0, 6) };
  }, [favourites, products, recentItems]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bc = barcode.trim().toLowerCase();
    return products.filter((item) => {
      const categoryMatch = selectedCategory === "Alle" || item.category === selectedCategory;
      const haystack = [item.name, item.barcode, item.sku, item.category, item.alternative_name, item.alt_name].filter(Boolean).join(" ").toLowerCase();
      const qMatch = !q || haystack.includes(q);
      const bcMatch = !bc || `${item.barcode || ""}`.toLowerCase().includes(bc);
      return categoryMatch && qMatch && bcMatch;
    });
  }, [barcode, products, search, selectedCategory]);

  const totals = useMemo(() => {
    const subtotal = round2(cart.reduce((sum, item) => sum + Number(item.line_total || item.price * item.quantity), 0));
    const discount = 0;
    const tax = round2(cart.reduce((sum, item) => sum + Number(item.tax_amount || 0), 0));
    return { subtotal, discount, tax, total: round2(subtotal - discount) };
  }, [cart]);

  const connectionLabel = useMemo(() => {
    if (!online) return copy.offline;
    const devices = setup?.progress?.devices || {};
    if (devices.h10_android_pos?.status === "not_connected") return copy.terminalDisconnected;
    if (devices.receipt_printer?.status === "not_connected") return copy.printerDisconnected;
    return copy.online;
  }, [copy.offline, copy.online, copy.printerDisconnected, copy.terminalDisconnected, online, setup?.progress?.devices]);

  const roleMetrics = useMemo(() => roleSummaryMetrics(copy, role, sales), [copy, role, sales]);
  const roleActions = useMemo(() => role === "manager"
    ? [
      { label: copy.actionOpenPos, path: "/merchant/pos" },
      { label: copy.actionFindSale, path: "/merchant/pos/sales", icon: "receipt" },
      { label: copy.actionReviewRefunds, path: "/merchant/pos/sales", icon: "receipt" },
      { label: copy.actionReviewShift, path: "/merchant/pos/hardware" },
    ]
    : [
      { label: copy.actionOpenPos, path: "/merchant/pos" },
      { label: copy.actionAddProduct, path: "/merchant/setup" },
      { label: copy.actionInviteStaff, path: "/merchant/setup", icon: "invite" },
      { label: copy.actionViewReport, path: "/merchant/pos/sales", icon: "report" },
    ], [copy, role]);

  const lockCart = ["processing", "awaiting", "review"].includes(paymentState.stage);
  const cartCount = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const updateRecent = (productId) => setRecentItems((current) => [productId, ...current.filter((item) => item !== productId)].slice(0, 12));

  const addToCart = (product) => {
    if (lockCart) return;
    tracker.featureClick("pos_product_added");
    updateRecent(product.product_id);
    setCartSession(null);
    setCart((current) => {
      const existing = current.find((item) => item.product_id === product.product_id);
      if (existing) {
        return current.map((item) => item.product_id === product.product_id ? { ...item, quantity: item.quantity + 1, line_total: round2((item.quantity + 1) * item.price), tax_amount: round2((item.quantity + 1) * item.price * Number(item.tax_rate || 0)) } : item);
      }
      return [...current, { product_id: product.product_id, name: product.name, category: product.category, price: Number(product.price || 0), quantity: 1, tax_rate: Number(product.tax_rate || 0), line_total: Number(product.price || 0), tax_amount: round2(Number(product.price || 0) * Number(product.tax_rate || 0)), image_url: product.image_url }];
    });
  };

  const changeQuantity = (productId, delta) => {
    if (lockCart) return;
    setCartSession(null);
    setCart((current) => current.map((item) => item.product_id === productId ? { ...item, quantity: Math.max(1, item.quantity + delta), line_total: round2(Math.max(1, item.quantity + delta) * item.price), tax_amount: round2(Math.max(1, item.quantity + delta) * item.price * Number(item.tax_rate || 0)) } : item));
  };

  const removeItem = (productId) => {
    if (lockCart) return;
    setCartSession(null);
    setCart((current) => current.filter((item) => item.product_id !== productId));
  };

  const toggleFavourite = (productId) => setFavourites((current) => current.includes(productId) ? current.filter((item) => item !== productId) : [...current, productId]);

  const ensureCartSession = async () => {
    const signature = buildCartSignature(cart);
    if (cartSession?.cartId && cartSession.signature === signature) {
      return cartSession.cartId;
    }
    const registerId = setup?.registers?.[0]?.register_id;
    const response = await api.createPosCart({ register_id: registerId, items: cart.map((item) => ({ product_id: item.product_id, quantity: item.quantity })), discount_pct: 0, customer_note: "" });
    const cartId = response.cart?.cart_id || response.cart_id;
    setCartSession({ cartId, signature });
    tracker.ctaClick("checkout_started", "merchant_pos");
    return cartId;
  };

  const broadcastState = (stage, headline, description, extra = {}) => {
    setPaymentState({ stage, headline, description, ...extra });
  };

  const startCheckout = () => {
    if (!cart.length) return;
    setPaymentOpen(true);
    broadcastState("ready", copy.choosePayment, copy.holdCard);
  };

  const handleMethodSelect = async (method) => {
    if (!method.enabled || submitting || !cart.length) return;
    setSubmitting(true);
    tracker.ctaClick(`payment_method_${method.key}`, "merchant_pos");
    try {
      const cartId = await ensureCartSession();
      const body = { cart_id: cartId, method: method.apiMethod };
      if (method.apiMethod === "cash") body.cash_received = totals.total;
      if (method.apiMethod === "card_external") body.card_reference = `CARD-${Date.now()}`;
      broadcastState(method.apiMethod === "card_external" ? "processing" : "awaiting", method.apiMethod === "card_external" ? copy.processing : copy.choosePayment, method.description);
      const response = await api.createPosPayment(body);

      if (response.payment) {
        setActivePayment({ paymentId: response.payment.payment_id, methodKey: method.key, methodLabel: method.label });
      }

      if (response.sale || response.payment?.status === "paid") {
        tracker.ctaClick("payment_succeeded", "merchant_pos");
        broadcastState("success", copy.success, copy.thankYou, { amount: totals.total, methodLabel: method.label, receiptId: response.sale?.receipt_id || "-" });
        setActivePayment((current) => ({ ...current, methodLabel: method.label, paymentId: response.payment?.payment_id, receiptId: response.sale?.receipt_id }));
        return;
      }

      if (response.awaiting_customer) {
        broadcastState("awaiting", copy.holdCard, response.payment?.qr_code || method.description);
        return;
      }

      if (response.status === "approval_required") {
        broadcastState("review", copy.reviewing, response.message || copy.doNotRepay, { paymentId: response.approval?.approval_id });
        return;
      }

      broadcastState("review", copy.reviewing, copy.doNotRepay);
    } catch (error) {
      tracker.ctaClick("payment_failed", "merchant_pos");
      broadcastState(error.code === "timeout" || error.code === "network" ? "review" : "failure", error.code === "timeout" || error.code === "network" ? copy.reviewing : copy.failedTitle, error.code === "timeout" || error.code === "network" ? copy.doNotRepay : copy.failedText);
      toast.error(error.message || "Checkout fehlgeschlagen.");
    } finally {
      setSubmitting(false);
    }
  };

  const refreshPaymentStatus = async () => {
    if (!activePayment?.paymentId) {
      broadcastState("review", copy.reviewing, copy.doNotRepay);
      return;
    }
    try {
      const result = await api.getPosPaymentStatus(activePayment.paymentId);
      const stage = STATUS_MAP[result.status] || "review";
      if (stage === "success") {
        const receiptId = sales.find((sale) => sale.payment_id === result.payment_id)?.receipt_id || activePayment.receiptId || "-";
        broadcastState("success", copy.success, copy.thankYou, { amount: Number(result.amount || totals.total), methodLabel: activePayment.methodLabel, receiptId });
      } else if (stage === "failure") {
        broadcastState("failure", copy.failedTitle, copy.failedText);
      } else {
        broadcastState("review", copy.reviewing, copy.doNotRepay);
      }
      toast.success(copy.statusRefreshed);
    } catch (error) {
      toast.error(error.message || "Status konnte nicht geprüft werden.");
    }
  };

  const resetSale = async () => {
    setPaymentOpen(false);
    setActivePayment(null);
    setPaymentState({ stage: "ready", headline: copy.choosePayment, description: copy.holdCard });
    setCart([]);
    setCartSession(null);
    setBarcode("");
    await load();
  };

  const handleReceiptAction = async (type) => {
    const receiptId = paymentState.receiptId || activePayment?.receiptId;
    if (type === "print" && receiptId) {
      try {
        await api.printPosReceipt({ receipt_id: receiptId, printer_id: "default", copies: 1 });
        toast.success("Beleg wird gedruckt.");
      } catch (error) {
        toast.error(error.message || "Druck fehlgeschlagen.");
      }
      return;
    }
    if (type === "qr") {
      toast.success(`QR-Beleg: ${receiptId || "-"}`);
      return;
    }
    if (type === "email") {
      toast.message(copy.mockedEmail);
      return;
    }
    toast.success("Belegausgabe gespeichert.");
  };

  if (loading) return <div className="min-h-screen bg-[#030507]" data-testid="merchant-pos-loading" />;
  if (!setup) return null;

  return (
    <div className="min-h-screen bg-[#030507] px-3 py-4 sm:px-4 lg:px-6" data-testid="merchant-pos-page">
      <div className="mx-auto max-w-7xl space-y-4 pb-32 md:pb-6">
        <PosTrainingGuide copy={copy} visible={showTraining} onComplete={() => { localStorage.setItem(POS_TRAINING_STORAGE_KEY, "1"); setShowTraining(false); }} onSkip={() => setShowTraining(false)} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="merchant-pos-back-button"><ArrowLeft size={18} /></button>
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-black text-white">{role === "cashier" ? copy.cashierTitle : role === "manager" ? copy.managerTitle : copy.ownerTitle}</h1>
              <p className="text-sm text-white/62">{role === "cashier" ? copy.cashierSubtitle : role === "manager" ? copy.managerSubtitle : copy.ownerSubtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PosConnectionStatus label={connectionLabel} />
            {topActions.map((action) => (
              <Button
                key={action.key}
                onClick={() => action.key === "display" ? window.open(action.path, "_blank", "noopener,noreferrer") : onNavigate?.(action.path)}
                variant="outline"
                className="min-h-12 border-white/10 bg-white/5 text-white"
                data-testid={`merchant-pos-top-action-${action.key}`}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>

        {setup?.progress?.activation_status !== "ready" ? (
          <div className="rounded-[24px] border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100" data-testid="merchant-pos-setup-warning">
            Merchant Setup ist noch nicht vollständig. Die Kasse bleibt nutzbar, aber fehlende Zahlungsarten oder Geräte solltest du unter /merchant/setup ergänzen.
          </div>
        ) : null}

        <div className="grid gap-3 rounded-[28px] border border-white/10 bg-white/5 p-4 sm:grid-cols-4" data-testid="merchant-pos-info-strip">
          <InfoChip icon={Store} label={copy.branch} value={setup.stores?.[0]?.name || "-"} testId="merchant-pos-branch-chip" />
          <InfoChip icon={Receipt} label={copy.register} value={setup.registers?.[0]?.name || "-"} testId="merchant-pos-register-chip" />
          <InfoChip icon={User} label={copy.employee} value={user?.name || user?.email || "-"} testId="merchant-pos-employee-chip" />
          <InfoChip icon={Wifi} label={copy.connection} value={connectionLabel} testId="merchant-pos-connection-chip" />
        </div>

        <div className="flex flex-wrap gap-2" data-testid="merchant-pos-role-navigation">
          {roleNav.map((item, index) => <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/72" data-testid={`merchant-pos-role-nav-${index + 1}`}>{item}</span>)}
        </div>

        <PosRoleOverview copy={copy} role={role} metrics={roleMetrics} actions={roleActions} onNavigate={onNavigate} />

        <PosHelpTray copy={copy} />

        <div className="grid gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <section className="space-y-4" data-testid="merchant-pos-catalogue-section">
            <div className="grid gap-3 rounded-[28px] border border-white/10 bg-white/5 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <label className="flex min-h-[52px] items-center gap-3 rounded-full border border-white/10 bg-[#071019] px-4 py-3 text-white">
                <Search size={16} className="text-white/44" />
                <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.searchPlaceholder} className="w-full bg-transparent outline-none placeholder:text-white/28" data-testid="merchant-pos-search-input" />
              </label>
              <input value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder={copy.barcodePlaceholder} className="min-h-[52px] rounded-full border border-white/10 bg-[#071019] px-4 text-white outline-none placeholder:text-white/28" data-testid="merchant-pos-barcode-input" />
            </div>

            <div className="space-y-3 rounded-[28px] border border-white/10 bg-white/5 p-4">
              <SectionHeader icon={Zap} title={copy.categories} testId="merchant-pos-category-header" />
              <div className="flex flex-wrap gap-2" data-testid="merchant-pos-categories-bar">
                {categories.map((category, index) => (
                  <button key={category} onClick={() => setSelectedCategory(category)} className={`min-h-12 rounded-full border px-4 py-3 text-sm font-bold ${selectedCategory === category ? "border-cyan-400/30 bg-cyan-400/12 text-cyan-100" : "border-white/10 bg-white/5 text-white/72"}`} data-testid={`merchant-pos-category-${index + 1}`}>{category}</button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <QuickStrip title={copy.favourites} icon={Star} items={featuredProducts.favourites} fallback="Noch keine Favoriten markiert." onPrimary={(product) => addToCart(product)} onSecondary={(product) => toggleFavourite(product.product_id)} secondaryLabel="Favorit entfernen" testId="merchant-pos-favourites-strip" />
              <QuickStrip title={copy.recent} icon={ShoppingCart} items={featuredProducts.recent} fallback="Zuletzt verkaufte Produkte erscheinen hier." onPrimary={(product) => addToCart(product)} onSecondary={(product) => toggleFavourite(product.product_id)} secondaryLabel="Favorit umschalten" testId="merchant-pos-recent-strip" />
            </div>

            {filteredProducts.length ? (
              <div className="grid gap-3 grid-cols-2 xl:grid-cols-3" data-testid="merchant-pos-product-grid">
                {filteredProducts.map((product, index) => (
                  <PosProductTile key={product.product_id} product={product} copy={copy} onClick={() => addToCart(product)} disabled={lockCart} testId={`merchant-pos-product-tile-${index + 1}`} />
                ))}
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-white/10 bg-[#071019] p-5 text-center" data-testid="merchant-pos-products-empty-state">
                <div className="text-lg font-black text-white">{copy.noProducts}</div>
                <div className="mt-2 text-sm text-white/58">{copy.hardwareHint}</div>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <Button onClick={() => setBarcode("")} variant="outline" className="min-h-12 border-white/10 bg-white/5 text-white" data-testid="merchant-pos-empty-rescan-button">{copy.scanAgain}</Button>
                  <Button onClick={() => searchRef.current?.focus()} variant="outline" className="min-h-12 border-white/10 bg-white/5 text-white" data-testid="merchant-pos-empty-search-button">{copy.searchManually}</Button>
                  {role !== "cashier" ? <Button onClick={() => onNavigate?.("/merchant/setup")} className="min-h-12 bg-[#06B6D4] text-black" data-testid="merchant-pos-empty-add-product-button">{copy.addProduct}</Button> : null}
                </div>
              </div>
            )}
          </section>

          <aside className="hidden md:block" data-testid="merchant-pos-cart-desktop-panel">
            <PosCartPanel copy={copy} cart={cart} totals={totals} locked={lockCart} onDecrease={(id) => changeQuantity(id, -1)} onIncrease={(id) => changeQuantity(id, 1)} onRemove={removeItem} onPay={startCheckout} />
          </aside>
        </div>

        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.25rem)] z-[120] px-3 md:hidden" data-testid="merchant-pos-mobile-sticky-bar">
          <div className="rounded-[24px] border border-white/10 bg-[#071019]/95 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-white/72">{cartCount} Artikel</div>
                <div className="truncate text-xl font-black text-white" data-testid="merchant-pos-mobile-total">{totals.total.toFixed(2)} €</div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => setCartSheetOpen(true)} variant="outline" className="min-h-14 border-white/10 bg-white/5 px-4 text-white" data-testid="merchant-pos-mobile-cart-button">{copy.viewCart}</Button>
                <Button onClick={startCheckout} disabled={!cart.length || lockCart} className="min-h-14 bg-[#06B6D4] px-5 text-black" data-testid="merchant-pos-mobile-pay-button">{copy.pay}</Button>
              </div>
            </div>
          </div>
        </div>

        {cartSheetOpen ? <div className="fixed inset-0 z-[75] bg-black/70 p-4 md:hidden" data-testid="merchant-pos-cart-mobile-sheet"><div className="mx-auto flex min-h-full max-w-xl items-end"><PosCartPanel copy={copy} cart={cart} totals={totals} locked={lockCart} onDecrease={(id) => changeQuantity(id, -1)} onIncrease={(id) => changeQuantity(id, 1)} onRemove={removeItem} onPay={startCheckout} onClose={() => setCartSheetOpen(false)} mobile testId="merchant-pos-cart-mobile-panel" /></div></div> : null}

        {paymentOpen ? <PosPaymentSheet copy={copy} methods={visibleMethods} paymentState={paymentState} busy={submitting} onClose={() => { if (!lockCart) setPaymentOpen(false); }} onMethodSelect={handleMethodSelect} onRetry={() => { tracker.ctaClick("payment_retried", "merchant_pos"); handleMethodSelect(visibleMethods.find((method) => method.key === activePayment?.methodKey) || visibleMethods[0]); }} onUseOtherMethod={() => broadcastState("ready", copy.choosePayment, copy.holdCard)} onCancel={() => { setPaymentOpen(false); setActivePayment(null); broadcastState("ready", copy.choosePayment, copy.holdCard); }} onCheckStatus={refreshPaymentStatus} onNewSale={resetSale} onReceiptAction={handleReceiptAction} /> : null}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, testId }) {
  return <div className="flex items-center gap-3" data-testid={testId}><div className="flex h-10 w-10 items-center justify-center rounded-[18px] border border-cyan-400/20 bg-cyan-400/10 text-cyan-100"><Icon size={16} /></div><div className="text-lg font-black text-white">{title}</div></div>;
}

function InfoChip({ icon: Icon, label, value, testId }) {
  return <div className="rounded-[22px] border border-white/10 bg-[#071019] p-4" data-testid={testId}><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-cyan-400/20 bg-cyan-400/10 text-cyan-100"><Icon size={18} /></div><div><div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#82E7FF]">{label}</div><div className="mt-1 text-base font-black text-white">{value}</div></div></div></div>;
}

function QuickStrip({ title, icon: Icon, items, fallback, onPrimary, onSecondary, secondaryLabel, testId }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-4" data-testid={testId}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[18px] border border-cyan-400/20 bg-cyan-400/10 text-cyan-100"><Icon size={16} /></div>
        <div className="text-lg font-black text-white">{title}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.length ? items.map((item, index) => (
          <div key={item.product_id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#071019] px-3 py-2 text-sm text-white" data-testid={`${testId}-item-${index + 1}`}>
            <button onClick={() => onPrimary(item)} className="font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">{item.name}</button>
            <button onClick={() => onSecondary(item)} aria-label={secondaryLabel} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/72 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" data-testid={`${testId}-toggle-${index + 1}`}><Star size={12} /></button>
          </div>
        )) : <div className="text-sm text-white/58" data-testid={`${testId}-empty`}>{fallback}</div>}
      </div>
    </div>
  );
}