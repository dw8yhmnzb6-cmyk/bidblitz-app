/**
 * QrOrderPage — Visual menu for QR table ordering.
 * Mr-Yum-style: Hero, search, category tabs, photo grid, detail bottom-sheet,
 * modifier engine, allergen filter, multi-language (DE/EN/TR).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, ChevronLeft, ChevronRight, Flame, Star, Leaf, AlertTriangle,
  ShoppingBag, Plus, Minus, Globe, Receipt, Clock, ChefHat, CheckCircle,
  Users, Sparkles, History,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const credJson = { credentials: "include", headers: { "Content-Type": "application/json" } };
const cred = { credentials: "include" };

const T = {
  de: {
    menu: "Speisekarte", search: "Suchen...", food: "Speisen", drinks: "Getränke",
    all: "Alle", popular: "Beliebt", filters: "Filter", allergens: "Allergene",
    vegan: "Vegan", vegetarian: "Vegetarisch", spicy: "Scharf", new_: "Neu", healthy: "Gesund",
    add: "Hinzufügen", required: "Pflicht", optional: "Optional",
    note: "Sonderwünsche", note_ph: "z.B. ohne Zwiebeln, gut durch...", note_max: "max 200 Zeichen",
    submit: "Bestellung abschicken", submitting: "Wird gesendet...",
    cart_items: "Artikel", pay_wallet: "Bezahlung via Wallet", total: "Gesamt",
    success: "Bestellung aufgegeben!", pending: "Wartet auf Bestätigung",
    order_id: "Auftragsnummer", new_order: "Weitere Bestellung",
    loading: "QR-Code wird geprüft...", invalid: "QR-Code ungültig",
    err_no_drivers: "Bestellung konnte nicht aufgegeben werden",
    home: "Zur Startseite", calories: "kcal",
    contains: "Enthält:", min_select: "Mindestens", max_select: "Maximal",
    cart_empty: "Wähle deine Lieblings-Gerichte", choose_size: "Wähle Größe",
    sold_out: "Nicht verfügbar",
    popular_section: "Beliebt im Restaurant", suggest: "Häufig dazu bestellt", add_to_cart: "Hinzufügen",
    tip: "Trinkgeld", tip_desc: "Möchten Sie dem Service ein Trinkgeld geben?",
    tip_none: "Kein Trinkgeld", tip_custom: "Eigener Betrag", tip_thanks: "Vielen Dank für Ihr Trinkgeld!",
    history: "Bestellverlauf", today_total: "Heute am Tisch", no_history: "Noch keine Bestellungen heute",
    status_submitted: "Eingegangen", status_accepted: "Bestätigt", status_preparing: "In Zubereitung",
    status_ready: "Bereit zur Abholung", status_completed: "Abgeschlossen", status_rejected: "Abgelehnt",
    split_bill: "Rechnung teilen", split_persons: "Personen", split_each: "Pro Person",
    skip: "Überspringen", view_orders: "Meine Bestellungen",
  },
  en: {
    menu: "Menu", search: "Search...", food: "Food", drinks: "Drinks",
    all: "All", popular: "Popular", filters: "Filters", allergens: "Allergens",
    vegan: "Vegan", vegetarian: "Vegetarian", spicy: "Spicy", new_: "New", healthy: "Healthy",
    add: "Add", required: "Required", optional: "Optional",
    note: "Special requests", note_ph: "e.g. no onions, well-done...", note_max: "max 200 chars",
    submit: "Place order", submitting: "Sending...",
    cart_items: "items", pay_wallet: "Pay with Wallet", total: "Total",
    success: "Order placed!", pending: "Awaiting confirmation",
    order_id: "Order ID", new_order: "Another order",
    loading: "Checking QR code...", invalid: "Invalid QR code",
    err_no_drivers: "Order could not be placed", home: "Home", calories: "kcal",
    contains: "Contains:", min_select: "At least", max_select: "At most",
    cart_empty: "Pick your favourites", choose_size: "Choose size",
    sold_out: "Sold out",
    popular_section: "Popular here", suggest: "Frequently added together", add_to_cart: "Add",
    tip: "Tip", tip_desc: "Would you like to leave a tip?",
    tip_none: "No tip", tip_custom: "Custom amount", tip_thanks: "Thanks for the tip!",
    history: "Order history", today_total: "Today at this table", no_history: "No orders yet today",
    status_submitted: "Received", status_accepted: "Accepted", status_preparing: "Preparing",
    status_ready: "Ready", status_completed: "Completed", status_rejected: "Rejected",
    split_bill: "Split bill", split_persons: "People", split_each: "Per person",
    skip: "Skip", view_orders: "My orders",
  },
  tr: {
    menu: "Menü", search: "Ara...", food: "Yemekler", drinks: "İçecekler",
    all: "Hepsi", popular: "Popüler", filters: "Filtreler", allergens: "Alerjenler",
    vegan: "Vegan", vegetarian: "Vejetaryen", spicy: "Acı", new_: "Yeni", healthy: "Sağlıklı",
    add: "Ekle", required: "Zorunlu", optional: "İsteğe bağlı",
    note: "Özel istekler", note_ph: "ör. soğansız, iyi pişmiş...", note_max: "maks 200 karakter",
    submit: "Sipariş ver", submitting: "Gönderiliyor...",
    cart_items: "ürün", pay_wallet: "Cüzdanla öde", total: "Toplam",
    success: "Sipariş alındı!", pending: "Onay bekliyor",
    order_id: "Sipariş No", new_order: "Yeni sipariş",
    loading: "QR kod kontrol ediliyor...", invalid: "Geçersiz QR",
    err_no_drivers: "Sipariş gönderilemedi", home: "Ana sayfa", calories: "kcal",
    contains: "İçerir:", min_select: "En az", max_select: "En fazla",
    cart_empty: "Favorilerini seç", choose_size: "Boyut seç",
    sold_out: "Tükendi",
    popular_section: "Burada popüler", suggest: "Sıkça birlikte sipariş edilir", add_to_cart: "Ekle",
    tip: "Bahşiş", tip_desc: "Servise bahşiş vermek ister misiniz?",
    tip_none: "Bahşiş yok", tip_custom: "Özel tutar", tip_thanks: "Bahşiş için teşekkürler!",
    history: "Sipariş geçmişi", today_total: "Bugün masada", no_history: "Bugün henüz sipariş yok",
    status_submitted: "Alındı", status_accepted: "Onaylandı", status_preparing: "Hazırlanıyor",
    status_ready: "Hazır", status_completed: "Tamamlandı", status_rejected: "Reddedildi",
    split_bill: "Hesabı böl", split_persons: "Kişi", split_each: "Kişi başı",
    skip: "Atla", view_orders: "Siparişlerim",
  },
};

const ALLERGEN_LABELS = {
  gluten: "🌾 Gluten", milk: "🥛 Milch", egg: "🥚 Ei", nuts: "🥜 Nüsse",
  soy: "🌱 Soja", fish: "🐟 Fisch", shellfish: "🦐 Krustentiere",
  sesame: "🌰 Sesam", sulfites: "🍷 Sulfite", celery: "🌿 Sellerie",
};

const TAG_META = {
  vegan:      { color: "#22c55e", icon: <Leaf size={10} />, key: "vegan" },
  vegetarian: { color: "#84cc16", icon: <Leaf size={10} />, key: "vegetarian" },
  spicy:      { color: "#ef4444", icon: <Flame size={10} />, key: "spicy" },
  popular:    { color: "#f59e0b", icon: <Star size={10} />, key: "popular" },
  new:        { color: "#06b6d4", icon: null, key: "new_" },
  healthy:    { color: "#10b981", icon: <Leaf size={10} />, key: "healthy" },
};

async function readJson(res) { try { return await res.json(); } catch { return null; } }
const buildImg = (u) => (!u ? null : (u.startsWith("/") ? `${API}${u}` : u));
const fmt = (n, cur = "EUR") => new Intl.NumberFormat("de-DE", { style: "currency", currency: cur }).format(n);
const i18nField = (item, base, lang) => (item?.[`${base}_i18n`]?.[lang]) || item?.[base] || "";

export default function QrOrderPage({ token: tokenProp, onNavigate, onAuthRequired, onLogin } = {}) {
  const initialToken = tokenProp || (typeof window !== "undefined"
    ? window.location.pathname.split("/order/qr/")[1]?.split(/[/?#]/)[0]
    : "");
  const navigate = (path) => {
    if (path && path.startsWith("/login")) {
      if (typeof onLogin === "function") return onLogin();
      if (typeof onAuthRequired === "function") return onAuthRequired();
    }
    if (typeof onNavigate === "function") onNavigate(path);
    else if (typeof window !== "undefined") {
      window.history.pushState({}, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState(true);
  const [resolveError, setResolveError] = useState(null);
  const [resolved, setResolved] = useState(null);
  const [menu, setMenu] = useState({ items: [], name: "", hero_image_url: null, categories: { food: [], drinks: [] }, currency: "EUR" });
  const [cart, setCart] = useState([]);     // [{key, item_id, name, price, qty, modifiers, note, image_url}]
  const [scope, setScope] = useState("food");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [allergenFilter, setAllergenFilter] = useState([]);  // exclude
  const [tagFilter, setTagFilter] = useState(null);          // single positive
  const [lang, setLang] = useState(() => (typeof navigator !== "undefined" && navigator.language?.startsWith("en")) ? "en" : "de");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [detail, setDetail] = useState(null);  // active item for bottom-sheet
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const [successOrder, setSuccessOrder] = useState(null);
  // New: live status polling for successful order
  const [liveOrder, setLiveOrder] = useState(null);
  // New: open-tab history per table
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState({ orders: [], total_spent: 0 });
  // New: popular + upsell
  const [popular, setPopular] = useState([]);
  const [upsell, setUpsell] = useState([]);
  // New: tip + split
  const [tipDone, setTipDone] = useState(false);

  const t = T[lang] || T.de;

  // 1. Resolve token + load menu
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setResolveError(null);
      try {
        const res = await fetch(`${API}/api/qr/resolve/${token}`, cred);
        const data = await readJson(res);
        if (!res.ok || !data?.ok) {
          setResolveError(data?.detail || t.invalid);
        } else if (!cancelled) {
          setResolved(data);
          if (data.next_token && data.next_token !== token) setToken(data.next_token);
          const scopes = data?.settings?.scopes || ["food"];
          setScope(scopes[0]);
          const mRes = await fetch(`${API}/api/qr/menu/${data.merchant_id}`);
          const mData = await readJson(mRes);
          if (!cancelled && mRes.ok && mData) setMenu(mData);
        }
      } catch (e) {
        if (!cancelled) setResolveError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, []);

  // 2. Load popular items for hero suggestion
  useEffect(() => {
    if (!resolved?.merchant_id) return;
    fetch(`${API}/api/qr/popular/${resolved.merchant_id}`).then(readJson).then((d) => {
      if (d?.items) setPopular(d.items);
    });
  }, [resolved]);

  // 3. Load upsell when cart changes
  useEffect(() => {
    if (!resolved?.merchant_id || cart.length === 0) { setUpsell([]); return; }
    const ids = [...new Set(cart.map((c) => c.item_id))];
    const ctrl = new AbortController();
    fetch(`${API}/api/qr/upsell`, {
      ...credJson, method: "POST", signal: ctrl.signal,
      body: JSON.stringify({ merchant_id: resolved.merchant_id, item_ids: ids, limit: 3 }),
    }).then(readJson).then((d) => {
      if (d?.items) setUpsell(d.items);
    }).catch(() => {});
    return () => ctrl.abort();
    // eslint-disable-next-line
  }, [cart.length, resolved?.merchant_id]);

  // 4. Live status polling for placed order
  useEffect(() => {
    if (!successOrder?.order_id) return;
    setLiveOrder({ status: successOrder.status, order_id: successOrder.order_id, total: successOrder.total });
    const poll = async () => {
      try {
        const r = await fetch(`${API}/api/qr/order-status/${successOrder.order_id}`, cred);
        const d = await readJson(r);
        if (r.ok && d?.order_id) setLiveOrder((p) => ({ ...(p || {}), ...d }));
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 5000);
    return () => clearInterval(iv);
  }, [successOrder?.order_id]);

  // 5. Load table history
  const loadHistory = useCallback(async () => {
    if (!resolved?.merchant_id || !resolved?.table_id) return;
    const r = await fetch(`${API}/api/qr/table-history/${resolved.merchant_id}/${resolved.table_id}`, cred);
    const d = await readJson(r);
    if (r.ok && d) setHistory(d);
  }, [resolved]);
  useEffect(() => { if (historyOpen) loadHistory(); }, [historyOpen, loadHistory]);

  // Filter & sort items
  const visibleItems = useMemo(() => {
    let list = (menu.items || []).filter((it) => it.scope === scope);
    if (category !== "all") list = list.filter((it) => it.category === category);
    if (tagFilter === "popular") list = list.filter((it) => it.is_popular);
    else if (tagFilter) list = list.filter((it) => (it.tags || []).includes(tagFilter));
    if (allergenFilter.length) {
      list = list.filter((it) => !(it.allergens || []).some((a) => allergenFilter.includes(a)));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((it) =>
        (i18nField(it, "name", lang) + " " + i18nField(it, "description", lang) + " " + (it.category || ""))
          .toLowerCase().includes(q)
      );
    }
    return list;
  }, [menu, scope, category, tagFilter, allergenFilter, search, lang]);

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const cartTotal = cart.reduce((s, c) => s + (c.price + (c.modPrice || 0)) * c.qty, 0);

  const addToCart = (item, mods, note, qty) => {
    const key = `${item.item_id}|${mods.map(m => m.group_id + ":" + m.option_id).sort().join(",")}|${note || ""}`;
    const modPrice = mods.reduce((s, m) => s + (m.price_delta || 0), 0);
    setCart((prev) => {
      const exist = prev.find((c) => c.key === key);
      if (exist) {
        return prev.map((c) => c.key === key ? { ...c, qty: c.qty + qty } : c);
      }
      return [...prev, {
        key, item_id: item.item_id, name: item.name,
        price: item.price, modPrice,
        modifiers: mods, note: note || "", qty,
        image_url: item.image_url,
      }];
    });
  };

  // Quick add (no modifiers) — for popular & upsell tiles
  const quickAdd = (item) => {
    const fullItem = (menu.items || []).find((it) => it.item_id === item.item_id) || item;
    // If item has required modifiers, open detail-sheet instead
    const hasRequired = (fullItem.modifier_groups || []).some((g) => g.required || (g.min_select || 0) > 0);
    if (hasRequired) {
      setDetail(fullItem);
      return;
    }
    addToCart(fullItem, [], "", 1);
  };

  const updateCartQty = (key, delta) => {
    setCart((prev) => prev.flatMap((c) => {
      if (c.key !== key) return [c];
      const nq = c.qty + delta;
      return nq > 0 ? [{ ...c, qty: nq }] : [];
    }));
  };

  const submit = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    setOrderError(null);
    try {
      const res = await fetch(`${API}/api/qr/order`, {
        ...credJson, method: "POST",
        body: JSON.stringify({
          token, scope, language: lang,
          items: cart.map((c) => ({
            item_id: c.item_id, name: c.name, price: c.price, qty: c.qty,
            note: c.note || null,
            modifiers: c.modifiers.map((m) => ({ group_id: m.group_id, option_id: m.option_id })),
          })),
        }),
      });
      const data = await readJson(res);
      if (res.status === 401) return navigate("/login");
      if (!res.ok || !data?.ok) {
        setOrderError(data?.detail || t.err_no_drivers);
      } else {
        setSuccessOrder(data);
        setCart([]);
        setTipDone(false);
        loadHistory();
      }
    } catch (e) {
      setOrderError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render gates ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center" data-testid="qr-loading">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-400">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (resolveError) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
        <div className="max-w-sm text-center" data-testid="qr-error">
          <div className="text-5xl mb-3">⚠️</div>
          <h1 className="text-lg font-bold mb-2">{t.invalid}</h1>
          <p className="text-sm text-gray-400 mb-6">{resolveError}</p>
          <button onClick={() => navigate("/")} className="px-6 py-3 bg-cyan-500 rounded-xl text-black font-semibold">{t.home}</button>
        </div>
      </div>
    );
  }

  const sendTip = async (amount) => {
    if (!successOrder?.order_id) return;
    try {
      const r = await fetch(`${API}/api/qr/order/tip`, {
        ...credJson, method: "POST",
        body: JSON.stringify({ order_id: successOrder.order_id, amount }),
      });
      const d = await readJson(r);
      if (r.ok) {
        setTipDone(true);
        setLiveOrder((p) => ({ ...(p || {}), tip: d.tip }));
      }
    } catch {}
  };

  if (successOrder) {
    return (
      <SuccessScreen
        order={successOrder}
        live={liveOrder}
        t={t}
        currency={menu.currency}
        tipDone={tipDone}
        onTip={sendTip}
        onNew={() => { setSuccessOrder(null); setLiveOrder(null); setTipDone(false); }}
      />
    );
  }

  // ─── Main render ───────────────────────────────────────────────────────
  const scopes = resolved?.settings?.scopes || ["food"];
  const cats = ["all", ...(menu.categories?.[scope] || [])];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-32" data-testid="qr-order-page">
      {/* Hero header with image */}
      <div className="relative h-44 overflow-hidden">
        {menu.hero_image_url && (
          <img src={menu.hero_image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-[#0a0a0a]" />
        <div className="relative h-full flex flex-col justify-end p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-cyan-400 font-semibold tracking-wider" data-testid="qr-table-label">
              📍 {resolved?.table_label}
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setHistoryOpen(true)}
                className="px-2.5 py-1.5 bg-white/10 backdrop-blur rounded-lg text-xs font-bold flex items-center gap-1"
                data-testid="qr-history-toggle">
                <History size={11}/> {t.history}
              </button>
              <button onClick={() => setShowLangMenu((p) => !p)}
                className="px-2.5 py-1.5 bg-white/10 backdrop-blur rounded-lg text-xs font-bold flex items-center gap-1"
                data-testid="qr-lang-toggle">
                <Globe size={11} /> {lang.toUpperCase()}
              </button>
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight">{menu.name}</h1>
        </div>
        {showLangMenu && (
          <div className="absolute top-12 right-4 bg-[#181818] border border-white/10 rounded-xl p-1 z-30 shadow-2xl">
            {["de","en","tr"].map((l) => (
              <button key={l} onClick={() => { setLang(l); setShowLangMenu(false); }}
                className={`block w-20 px-3 py-2 text-xs text-left rounded-lg ${lang===l?"bg-cyan-500/20 text-cyan-300":"text-white/70"}`}
                data-testid={`qr-lang-${l}`}>{l.toUpperCase()}</button>
            ))}
          </div>
        )}
      </div>

      {/* Sticky controls */}
      <div className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input value={search} onChange={(e)=>setSearch(e.target.value)}
            placeholder={t.search}
            className="w-full pl-9 pr-9 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-cyan-500/50"
            data-testid="qr-search-input" />
          {search && (
            <button onClick={()=>setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40">
              <X size={14}/>
            </button>
          )}
        </div>
        {/* Scope tabs */}
        {scopes.length > 1 && (
          <div className="flex gap-2">
            {scopes.map((s) => (
              <button key={s} onClick={() => { setScope(s); setCategory("all"); }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold ${
                  scope === s ? "bg-cyan-500 text-black" : "bg-white/5 text-white/60"
                }`}
                data-testid={`qr-scope-${s}`}>
                {s === "food" ? t.food : t.drinks}
              </button>
            ))}
          </div>
        )}
        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 hide-scrollbar">
          {cats.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                category === c ? "bg-white text-black" : "bg-white/5 text-white/70 border border-white/10"
              }`}
              data-testid={`qr-cat-${c}`}>
              {c === "all" ? t.all : c}
            </button>
          ))}
        </div>
        {/* Tag + allergen quick filters */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 hide-scrollbar">
          <FilterChip active={tagFilter === "popular"} onClick={() => setTagFilter(tagFilter === "popular" ? null : "popular")} icon={<Star size={10}/>} label={t.popular} testid="qr-tag-popular" />
          <FilterChip active={tagFilter === "vegan"} onClick={() => setTagFilter(tagFilter === "vegan" ? null : "vegan")} icon={<Leaf size={10}/>} label={t.vegan} testid="qr-tag-vegan" />
          <FilterChip active={tagFilter === "vegetarian"} onClick={() => setTagFilter(tagFilter === "vegetarian" ? null : "vegetarian")} icon={<Leaf size={10}/>} label={t.vegetarian} testid="qr-tag-vegetarian" />
          <FilterChip active={tagFilter === "spicy"} onClick={() => setTagFilter(tagFilter === "spicy" ? null : "spicy")} icon={<Flame size={10}/>} label={t.spicy} testid="qr-tag-spicy" />
          <AllergenFilterButton allergens={allergenFilter} setAllergens={setAllergenFilter} t={t} />
        </div>
      </div>

      {/* Grid */}
      <div className="px-3 py-4">
        {/* Popular suggestion carousel */}
        {popular.length > 0 && category === "all" && !search && !tagFilter && (
          <div className="mb-4" data-testid="qr-popular-section">
            <p className="text-[11px] uppercase tracking-wider text-amber-300/80 mb-2 px-1 flex items-center gap-1">
              <Sparkles size={11}/> {t.popular_section}
            </p>
            <div className="flex gap-2 overflow-x-auto -mx-3 px-3 pb-1 hide-scrollbar">
              {popular.slice(0,6).map((p) => {
                const full = (menu.items || []).find((it) => it.item_id === p.item_id);
                if (!full) return null;
                const img = buildImg(p.image_url || full.image_url);
                return (
                  <button key={p.item_id} onClick={() => setDetail(full)}
                    data-testid={`qr-popular-${p.item_id}`}
                    className="shrink-0 w-32 bg-[#141414] rounded-2xl overflow-hidden border border-amber-500/20 text-left">
                    <div className="relative h-20 bg-white/5">
                      {img && <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover"/>}
                      <span className="absolute top-1 right-1 px-1 py-0.5 bg-amber-500 text-black rounded-md text-[8px] font-black flex items-center gap-0.5">
                        <Star size={7}/> {p.order_count}×
                      </span>
                    </div>
                    <div className="p-1.5">
                      <p className="text-[11px] font-bold leading-tight line-clamp-1">{i18nField(full,"name",lang)}</p>
                      <p className="text-[11px] font-black text-cyan-400 mt-0.5">{fmt(full.price, menu.currency)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {visibleItems.length === 0 ? (
          <div className="text-center py-16 opacity-60">
            <p className="text-3xl mb-2">🍽️</p>
            <p className="text-sm">{t.cart_empty}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {visibleItems.map((it) => (
              <MenuCard key={it.item_id} item={it} lang={lang} t={t} currency={menu.currency}
                onTap={() => setDetail(it)} />
            ))}
          </div>
        )}
      </div>

      {/* Cart CTA + Upsell */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
            className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/10"
            data-testid="qr-cart-cta">
            {/* Upsell strip */}
            {upsell.length > 0 && (
              <div className="px-4 pt-2 pb-1" data-testid="qr-upsell-section">
                <p className="text-[10px] uppercase tracking-wider text-cyan-300/70 mb-1.5 flex items-center gap-1">
                  <Sparkles size={9}/> {t.suggest}
                </p>
                <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1.5 hide-scrollbar">
                  {upsell.map((u) => (
                    <button key={u.item_id} onClick={() => quickAdd(u)}
                      data-testid={`qr-upsell-${u.item_id}`}
                      className="shrink-0 flex items-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/30 rounded-xl px-2 py-1.5 max-w-[200px]">
                      {u.image_url && (
                        <img src={buildImg(u.image_url)} alt="" className="w-7 h-7 rounded-md object-cover shrink-0"/>
                      )}
                      <div className="text-left min-w-0">
                        <p className="text-[11px] font-bold truncate">{u.name}</p>
                        <p className="text-[10px] text-cyan-300 font-bold">+ {fmt(u.price || 0, menu.currency)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="px-4 pt-3 pb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/60">
                  {cartCount} {t.cart_items} · {t.pay_wallet}
                </span>
                <span className="text-lg font-black text-cyan-400" data-testid="qr-cart-total">
                  {fmt(cartTotal, menu.currency)}
                </span>
              </div>
              <button onClick={submit} disabled={submitting}
                className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 rounded-2xl font-black text-black text-base disabled:opacity-50 shadow-[0_8px_32px_rgba(0,194,255,0.4)] flex items-center justify-center gap-2"
                data-testid="qr-submit-btn">
                <ShoppingBag size={16}/>
                {submitting ? t.submitting : t.submit}
              </button>
              {orderError && <p className="text-xs text-red-400 mt-2 text-center" data-testid="qr-order-error">{orderError}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History sheet */}
      <AnimatePresence>
        {historyOpen && (
          <HistorySheet history={history} t={t} currency={menu.currency} lang={lang} onClose={() => setHistoryOpen(false)} />
        )}
      </AnimatePresence>

      {/* Detail bottom-sheet */}
      <AnimatePresence>
        {detail && (
          <DetailSheet item={detail} lang={lang} t={t} currency={menu.currency}
            onClose={() => setDetail(null)}
            onAdd={(mods, note, qty) => { addToCart(detail, mods, note, qty); setDetail(null); }} />
        )}
      </AnimatePresence>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function FilterChip({ active, onClick, icon, label, testid }) {
  return (
    <button onClick={onClick} data-testid={testid}
      className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap ${
        active ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "bg-white/5 text-white/60 border border-white/10"
      }`}>
      {icon}{label}
    </button>
  );
}

function AllergenFilterButton({ allergens, setAllergens, t }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} data-testid="qr-allergen-filter"
        className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1 ${
          allergens.length ? "bg-red-500/15 text-red-300 border border-red-500/30" : "bg-white/5 text-white/60 border border-white/10"
        }`}>
        <AlertTriangle size={10}/> {t.allergens}{allergens.length ? ` (${allergens.length})` : ""}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-50 bg-black/70 flex items-end" onClick={() => setOpen(false)}>
            <motion.div initial={{y:300}} animate={{y:0}} exit={{y:300}}
              onClick={(e)=>e.stopPropagation()}
              className="w-full bg-[#141414] rounded-t-3xl p-5 max-h-[70vh] overflow-y-auto">
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4"/>
              <h2 className="text-base font-bold mb-1">{t.allergens}</h2>
              <p className="text-xs text-white/40 mb-4">Artikel mit diesen Zutaten ausblenden</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(ALLERGEN_LABELS).map(([k,label]) => (
                  <button key={k} onClick={() => setAllergens((p) => p.includes(k)?p.filter(x=>x!==k):[...p,k])}
                    data-testid={`qr-allergen-${k}`}
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold text-left ${
                      allergens.includes(k) ? "bg-red-500/15 border border-red-500/40 text-red-200" : "bg-white/5 border border-white/10 text-white/70"
                    }`}>{label}</button>
                ))}
              </div>
              <button onClick={() => setOpen(false)} className="w-full mt-4 py-3 bg-cyan-500 rounded-xl text-black font-bold">OK</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MenuCard({ item, lang, t, currency, onTap }) {
  const name = i18nField(item, "name", lang);
  const desc = i18nField(item, "description", lang);
  const img = buildImg(item.image_url);
  const tags = (item.tags || []).slice(0, 2);

  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onTap}
      data-testid={`qr-item-${item.item_id}`}
      className="text-left bg-[#141414] rounded-2xl overflow-hidden border border-white/5 flex flex-col">
      <div className="relative aspect-square bg-white/5">
        {img ? (
          <img src={img} alt={name} loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { e.target.style.display = "none"; }} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-30">🍽️</div>
        )}
        {item.is_popular && (
          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-amber-500 text-black rounded-md text-[9px] font-black flex items-center gap-0.5">
            <Star size={8}/> {t.popular}
          </div>
        )}
        <div className="absolute top-1.5 right-1.5 flex gap-1">
          {tags.map((tg) => {
            const m = TAG_META[tg];
            if (!m) return null;
            return (
              <span key={tg} title={t[m.key] || tg}
                className="w-5 h-5 rounded-full flex items-center justify-center text-white"
                style={{ background: m.color }}>{m.icon}</span>
            );
          })}
        </div>
      </div>
      <div className="p-2.5 flex-1 flex flex-col">
        <p className="text-sm font-bold leading-tight line-clamp-1">{name}</p>
        {desc && <p className="text-[10px] text-white/40 line-clamp-2 mt-0.5">{desc}</p>}
        <div className="flex items-center justify-between mt-2">
          <span className="text-base font-black text-cyan-400">{fmt(item.price, currency)}</span>
          <span className="w-7 h-7 rounded-full bg-cyan-500 text-black flex items-center justify-center" data-testid={`qr-add-${item.item_id}`}>
            <Plus size={14} strokeWidth={3}/>
          </span>
        </div>
      </div>
    </motion.button>
  );
}

function DetailSheet({ item, lang, t, currency, onClose, onAdd }) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState(() => {
    // Pre-populate defaults
    const init = [];
    for (const g of (item.modifier_groups || [])) {
      for (const o of (g.options || [])) {
        if (o.default) init.push({ group_id: g.group_id, option_id: o.option_id, name: o.name, price_delta: o.price_delta || 0 });
      }
    }
    return init;
  });

  const name = i18nField(item, "name", lang);
  const desc = i18nField(item, "description", lang);
  const img = buildImg(item.image_url);

  const toggleOption = (group, option) => {
    setSelected((prev) => {
      const inGroup = prev.filter((s) => s.group_id === group.group_id);
      const exists = inGroup.find((s) => s.option_id === option.option_id);
      if (group.max_select === 1) {
        // Radio
        return [...prev.filter((s) => s.group_id !== group.group_id),
          { group_id: group.group_id, option_id: option.option_id, name: option.name, price_delta: option.price_delta || 0 }];
      }
      // Checkbox
      if (exists) return prev.filter((s) => !(s.group_id === group.group_id && s.option_id === option.option_id));
      if (inGroup.length >= group.max_select) return prev;  // ignore if exceeds
      return [...prev, { group_id: group.group_id, option_id: option.option_id, name: option.name, price_delta: option.price_delta || 0 }];
    });
  };

  // Validate required
  const errors = useMemo(() => {
    const errs = [];
    for (const g of (item.modifier_groups || [])) {
      const cnt = selected.filter((s) => s.group_id === g.group_id).length;
      const mn = g.min_select || (g.required ? 1 : 0);
      if (cnt < mn) errs.push(g.name);
    }
    return errs;
  }, [item, selected]);

  const modExtra = selected.reduce((s, o) => s + (o.price_delta || 0), 0);
  const unitTotal = item.price + modExtra;
  const lineTotal = unitTotal * qty;

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end" onClick={onClose}>
      <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}}
        transition={{ type: "spring", damping: 28 }}
        onClick={(e)=>e.stopPropagation()}
        data-testid="qr-detail-sheet"
        className="w-full bg-[#0e0e0e] rounded-t-3xl max-h-[92vh] overflow-y-auto pb-32">
        {/* Hero image */}
        <div className="relative aspect-[16/10] bg-white/5">
          {img ? (
            <img src={img} alt={name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-7xl opacity-30">🍽️</div>
          )}
          <button onClick={onClose} data-testid="qr-detail-close"
            className="absolute top-3 right-3 w-9 h-9 bg-black/60 backdrop-blur rounded-full flex items-center justify-center">
            <X size={18}/>
          </button>
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0e0e0e] to-transparent"/>
        </div>

        <div className="px-5 pt-2">
          <h2 className="text-xl font-black">{name}</h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {(item.tags || []).map((tg) => {
              const m = TAG_META[tg]; if (!m) return null;
              return (
                <span key={tg} className="px-2 py-0.5 text-[10px] font-bold rounded-full text-white" style={{background:m.color}}>
                  {t[m.key] || tg}
                </span>
              );
            })}
            {typeof item.calories === "number" && (
              <span className="text-[11px] text-white/40">· {item.calories} {t.calories}</span>
            )}
          </div>
          {desc && <p className="text-sm text-white/70 mt-3 leading-relaxed">{desc}</p>}

          {(item.allergens || []).length > 0 && (
            <div className="mt-3 p-2.5 bg-red-500/5 border border-red-500/20 rounded-lg">
              <p className="text-[10px] text-red-300 uppercase tracking-wider font-bold mb-1">{t.contains}</p>
              <p className="text-xs text-red-200">{item.allergens.map((a) => ALLERGEN_LABELS[a] || a).join(" · ")}</p>
            </div>
          )}

          {/* Modifier groups */}
          {(item.modifier_groups || []).map((g) => {
            const inGroup = selected.filter((s) => s.group_id === g.group_id);
            const isMissing = (g.required || g.min_select) && inGroup.length < (g.min_select || 1);
            return (
              <div key={g.group_id} className="mt-5" data-testid={`qr-mod-group-${g.group_id}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold">{g.name}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    g.required ? "bg-red-500/15 text-red-300" : "bg-white/5 text-white/40"
                  }`}>{g.required ? t.required : t.optional}{g.max_select > 1 ? ` · max ${g.max_select}` : ""}</span>
                </div>
                <div className="space-y-1.5">
                  {(g.options || []).map((o) => {
                    const isSel = selected.some((s) => s.group_id === g.group_id && s.option_id === o.option_id);
                    return (
                      <button key={o.option_id} onClick={() => toggleOption(g, o)}
                        data-testid={`qr-opt-${g.group_id}-${o.option_id}`}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border ${
                          isSel ? "bg-cyan-500/10 border-cyan-500/40" : "bg-white/[0.03] border-white/10"
                        }`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-${g.max_select===1?"full":"md"} border-2 flex items-center justify-center ${
                            isSel ? "border-cyan-400 bg-cyan-400" : "border-white/30"
                          }`}>
                            {isSel && <span className="w-1.5 h-1.5 bg-black rounded-full"/>}
                          </span>
                          <span className="text-sm">{o.name}</span>
                        </div>
                        <span className={`text-xs font-bold ${o.price_delta > 0 ? "text-amber-400" : o.price_delta < 0 ? "text-emerald-400" : "text-white/30"}`}>
                          {o.price_delta > 0 ? "+" : ""}{o.price_delta !== 0 ? fmt(o.price_delta, currency) : "—"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {isMissing && <p className="text-[10px] text-red-400 mt-1">⚠️ {t.required}</p>}
              </div>
            );
          })}

          {/* Note */}
          <div className="mt-5">
            <p className="text-sm font-bold mb-2">{t.note}</p>
            <textarea value={note} onChange={(e)=>setNote(e.target.value.slice(0,200))}
              data-testid="qr-detail-note"
              placeholder={t.note_ph}
              rows={2}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-cyan-500/50 resize-none"/>
            <p className="text-[10px] text-white/30 text-right mt-1">{note.length}/200</p>
          </div>
        </div>

        {/* Bottom action */}
        <div className="fixed inset-x-0 bottom-0 bg-[#0e0e0e] border-t border-white/10 px-5 pt-3 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white/5 rounded-2xl border border-white/10">
              <button onClick={() => setQty(Math.max(1, qty-1))} className="w-10 h-11 flex items-center justify-center" data-testid="qr-detail-dec">
                <Minus size={14}/>
              </button>
              <span className="w-7 text-center text-sm font-black" data-testid="qr-detail-qty">{qty}</span>
              <button onClick={() => setQty(Math.min(99, qty+1))} className="w-10 h-11 flex items-center justify-center" data-testid="qr-detail-inc">
                <Plus size={14}/>
              </button>
            </div>
            <button onClick={() => onAdd(selected, note, qty)} disabled={errors.length > 0}
              data-testid="qr-detail-add"
              className="flex-1 h-11 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-white/10 disabled:text-white/30 text-black font-black flex items-center justify-between px-5">
              <span>{t.add}</span>
              <span>{fmt(lineTotal, currency)}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── SuccessScreen with live status + tip + split-bill ───────────────────

const STATUS_STEPS = [
  { id: "submitted", icon: <CheckCircle size={14}/>, key: "status_submitted" },
  { id: "accepted",  icon: <ChefHat size={14}/>,     key: "status_accepted" },
  { id: "preparing", icon: <Clock size={14}/>,       key: "status_preparing" },
  { id: "ready",     icon: <Sparkles size={14}/>,    key: "status_ready" },
  { id: "completed", icon: <CheckCircle size={14}/>, key: "status_completed" },
];

function SuccessScreen({ order, live, t, currency, tipDone, onTip, onNew }) {
  const [splitN, setSplitN] = useState(1);
  const [customTip, setCustomTip] = useState("");
  const status = live?.status || order.status;
  const total = (live?.total ?? order.total) || 0;
  const tip = live?.tip || 0;

  const stepIndex = STATUS_STEPS.findIndex((s) => s.id === status);
  const isFinal = status === "completed" || status === "rejected";

  const tipPresets = [
    { label: "5%", v: total * 0.05 },
    { label: "10%", v: total * 0.10 },
    { label: "15%", v: total * 0.15 },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 pb-32" data-testid="qr-success">
      <div className="max-w-md mx-auto">
        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="bg-emerald-500/8 border border-emerald-500/25 rounded-3xl p-6 text-center mt-2">
          <div className="text-5xl mb-3">{status === "rejected" ? "❌" : "✅"}</div>
          <h1 className="text-lg font-black mb-1">
            {status === "rejected" ? t.status_rejected : (status === "accepted" || status === "submitted" ? t.success : t[STATUS_STEPS.find(s=>s.id===status)?.key || "success"])}
          </h1>
          <p className="text-[11px] text-white/40 font-mono mt-1" data-testid="qr-success-order-id">{order.order_id}</p>
          <p className="text-3xl font-black text-cyan-400 mt-3">{fmt(total, currency)}</p>
          {tip > 0 && (
            <p className="text-[11px] text-emerald-400 mt-1" data-testid="qr-tip-applied">
              + {fmt(tip, currency)} {t.tip}
            </p>
          )}
        </motion.div>

        {/* Live status timeline */}
        {!isFinal && status !== "rejected" && (
          <div className="mt-5 bg-[#101010] border border-white/5 rounded-2xl p-4" data-testid="qr-status-tracker">
            <p className="text-[11px] uppercase tracking-wider text-white/40 mb-3">Live-Status</p>
            <div className="flex items-center justify-between">
              {STATUS_STEPS.slice(0, 4).map((s, i) => {
                const active = i <= stepIndex;
                return (
                  <React.Fragment key={s.id}>
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${active ? "bg-cyan-500 text-black" : "bg-white/5 text-white/30"}`}>
                        {s.icon}
                      </div>
                      <p className={`text-[9px] ${active ? "text-cyan-300" : "text-white/30"} text-center max-w-[60px]`}>
                        {t[s.key]}
                      </p>
                    </div>
                    {i < 3 && (
                      <div className={`flex-1 h-0.5 ${i < stepIndex ? "bg-cyan-500" : "bg-white/5"}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* Tip selector */}
        {status !== "rejected" && !tipDone && (
          <div className="mt-4 bg-[#101010] border border-white/5 rounded-2xl p-4" data-testid="qr-tip-section">
            <p className="text-base font-bold mb-1">💝 {t.tip}</p>
            <p className="text-xs text-white/50 mb-3">{t.tip_desc}</p>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {tipPresets.map((p) => (
                <button key={p.label} onClick={() => onTip(round2(p.v))}
                  data-testid={`qr-tip-${p.label.replace("%","")}`}
                  className="py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs font-bold">
                  {p.label}<br/><span className="text-[10px] opacity-70">{fmt(p.v, currency)}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="number" min="0" step="0.5" value={customTip}
                onChange={(e) => setCustomTip(e.target.value)}
                placeholder={t.tip_custom}
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm outline-none"
                data-testid="qr-tip-custom"/>
              <button onClick={() => customTip && onTip(parseFloat(customTip))}
                className="px-4 py-2 bg-cyan-500 text-black rounded-xl text-sm font-bold"
                data-testid="qr-tip-custom-send">
                {t.add}
              </button>
            </div>
            <button onClick={() => onTip(0)} className="w-full mt-2 py-2 text-xs text-white/40" data-testid="qr-tip-skip">
              {t.skip} · {t.tip_none}
            </button>
          </div>
        )}
        {tipDone && (
          <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-emerald-300">💚 {t.tip_thanks}</p>
          </div>
        )}

        {/* Split bill */}
        {status !== "rejected" && (
          <div className="mt-4 bg-[#101010] border border-white/5 rounded-2xl p-4" data-testid="qr-split-section">
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-bold flex items-center gap-2">
                <Users size={15}/> {t.split_bill}
              </p>
              <div className="flex items-center gap-2 bg-white/5 rounded-xl">
                <button onClick={() => setSplitN(Math.max(1, splitN-1))} className="w-8 h-8" data-testid="qr-split-dec">−</button>
                <span className="text-sm font-bold w-6 text-center" data-testid="qr-split-count">{splitN}</span>
                <button onClick={() => setSplitN(Math.min(20, splitN+1))} className="w-8 h-8" data-testid="qr-split-inc">+</button>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-xs text-white/50">{t.split_each} ({splitN} {t.split_persons}):</span>
              <span className="text-xl font-black text-cyan-400" data-testid="qr-split-each">
                {fmt((total + tip) / splitN, currency)}
              </span>
            </div>
          </div>
        )}

        <button onClick={onNew}
          className="w-full mt-5 py-3.5 bg-cyan-500 hover:bg-cyan-400 rounded-2xl text-black font-black shadow-[0_8px_32px_rgba(0,194,255,0.4)]"
          data-testid="qr-order-again">
          {t.new_order}
        </button>
      </div>
    </div>
  );
}

function round2(n) { return Math.round(n * 100) / 100; }

// ─── HistorySheet: open-tab orders for this table today ──────────────────

function HistorySheet({ history, t, currency, lang, onClose }) {
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      className="fixed inset-0 z-50 bg-black/80 flex items-end" onClick={onClose}>
      <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}}
        onClick={(e)=>e.stopPropagation()}
        data-testid="qr-history-sheet"
        className="w-full bg-[#0e0e0e] rounded-t-3xl max-h-[85vh] overflow-y-auto p-5">
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3"/>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Receipt size={16}/> {t.history}
          </h2>
          <button onClick={onClose} className="text-white/40"><X size={18}/></button>
        </div>
        <p className="text-xs text-white/50 mb-4">
          {t.today_total}: <span className="text-cyan-400 font-bold" data-testid="qr-history-total">{fmt(history.total_spent || 0, currency)}</span>
        </p>
        {(!history.orders || history.orders.length === 0) ? (
          <p className="text-center text-sm text-white/40 py-10">{t.no_history}</p>
        ) : (
          <div className="space-y-2">
            {history.orders.map((o) => (
              <div key={o.order_id} className="bg-[#141414] border border-white/5 rounded-xl p-3" data-testid={`qr-history-order-${o.order_id}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] text-white/40">{o.order_id}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    o.status === "completed" ? "bg-emerald-500/15 text-emerald-300" :
                    o.status === "accepted" ? "bg-cyan-500/15 text-cyan-300" :
                    o.status === "pending" ? "bg-amber-500/15 text-amber-300" :
                    "bg-red-500/15 text-red-300"
                  }`}>{t[`status_${o.status}`] || o.status}</span>
                </div>
                <div className="text-xs text-white/70">
                  {(o.items || []).map((it, idx) => (
                    <div key={idx} className="flex justify-between py-0.5">
                      <span>{it.qty}× {it.name}</span>
                      <span className="text-white/40 tabular-nums">{fmt(it.line_total, currency)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 pt-2 border-t border-white/5">
                  <span className="text-xs text-white/40">{new Date(o.created_at).toLocaleTimeString(lang, {hour:"2-digit", minute:"2-digit"})}</span>
                  <span className="text-sm font-black text-cyan-400">{fmt(o.total, currency)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
