/**
 * QrOrderPage — Customer table-order page (taxi.eu/Uber-style fullscreen sheet).
 * URL: /order/qr/:token
 *
 * Flow:
 *   1. Resolve token → show merchant + table.
 *   2. Load menu, tabs (Food / Drinks).
 *   3. Tap items to add to cart (price calc client-side, server reprices).
 *   4. Bottom CTA → POST /api/qr/order → success screen.
 *
 * Auth gate: if not logged in, redirects to /login?return=<current path>.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const API = process.env.REACT_APP_BACKEND_URL;
const credJson = { credentials: "include", headers: { "Content-Type": "application/json" } };
const cred = { credentials: "include" };

async function readJson(res) { try { return await res.json(); } catch { return null; } }

export default function QrOrderPage() {
  const { token: initialToken } = useParams();
  const navigate = useNavigate();

  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState(true);
  const [resolveError, setResolveError] = useState(null);
  const [resolved, setResolved] = useState(null); // {merchant_id, table_id, table_label, settings, next_token}
  const [menu, setMenu] = useState({ items: [], name: "", logo_url: null });
  const [cart, setCart] = useState({}); // {item_id: {item, qty}}
  const [scope, setScope] = useState("food");
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const [successOrder, setSuccessOrder] = useState(null);

  // 1. Resolve token
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setResolveError(null);
      try {
        const res = await fetch(`${API}/api/qr/resolve/${token}`, cred);
        if (res.status === 401) {
          navigate(`/login?return=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        const data = await readJson(res);
        if (!res.ok || !data?.ok) {
          setResolveError(data?.detail || "QR-Code konnte nicht aufgelöst werden");
        } else if (!cancelled) {
          setResolved(data);
          // Token sliding-window: replace URL token with the fresh one
          if (data.next_token && data.next_token !== token) setToken(data.next_token);
          // Default scope from merchant settings
          const scopes = data?.settings?.scopes || ["food"];
          setScope(scopes[0]);
          // Load menu
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

  // Compute totals
  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const total = useMemo(
    () => cartItems.reduce((s, c) => s + c.item.price * c.qty, 0),
    [cartItems],
  );
  const itemsByScope = useMemo(() => {
    const list = menu.items || [];
    if (!resolved?.settings?.scopes?.length) return list;
    // Heuristic: items with category containing 'Getränk|Drink|Bar' map to drinks scope
    return list.filter((it) => {
      const cat = (it.category || "").toLowerCase();
      const isDrink = /getr|drink|bar|wein|bier|cocktail/.test(cat);
      return scope === "drinks" ? isDrink : !isDrink;
    });
  }, [menu, scope, resolved]);

  const setQty = (item, qty) => {
    setCart((prev) => {
      const next = { ...prev };
      const key = item.item_id || item.id || item.name;
      if (qty <= 0) delete next[key];
      else next[key] = { item, qty };
      return next;
    });
  };
  const inc = (item) => setQty(item, (cart[item.item_id || item.id || item.name]?.qty || 0) + 1);
  const dec = (item) => setQty(item, Math.max(0, (cart[item.item_id || item.id || item.name]?.qty || 0) - 1));

  const submit = async () => {
    if (!resolved || cartItems.length === 0) return;
    setSubmitting(true);
    setOrderError(null);
    const payload = {
      token,
      scope,
      items: cartItems.map(({ item, qty }) => ({
        item_id: String(item.item_id || item.id || item.name),
        name: item.name,
        price: item.price,
        qty,
      })),
    };
    try {
      const res = await fetch(`${API}/api/qr/order`, {
        ...credJson, method: "POST", body: JSON.stringify(payload),
      });
      const data = await readJson(res);
      if (res.status === 401) {
        navigate(`/login?return=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (!res.ok || !data?.ok) {
        setOrderError(data?.detail || "Bestellung fehlgeschlagen");
      } else {
        setSuccessOrder(data);
      }
    } catch (e) {
      setOrderError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center" data-testid="qr-loading">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">QR-Code wird geprüft...</p>
        </div>
      </div>
    );
  }

  if (resolveError) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
        <div className="max-w-sm text-center" data-testid="qr-error">
          <div className="text-5xl mb-3">⚠️</div>
          <h1 className="text-lg font-bold mb-2">QR-Code ungültig</h1>
          <p className="text-sm text-gray-400 mb-6">{resolveError}</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-cyan-500 rounded-xl text-black font-semibold"
          >
            Zur Startseite
          </button>
        </div>
      </div>
    );
  }

  if (successOrder) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-sm w-full text-center bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-8"
          data-testid="qr-success"
        >
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-emerald-400 mb-2">
            {successOrder.status === "accepted" ? "Bestellung aufgegeben!" : "Bestellung wartet auf Bestätigung"}
          </h1>
          <p className="text-sm text-gray-400 mb-4">{successOrder.message}</p>
          <p className="text-xs text-gray-500 mb-1">Auftragsnummer</p>
          <p className="font-mono font-bold text-cyan-400 mb-6">{successOrder.order_id}</p>
          <p className="text-2xl font-bold text-white mb-6">€{successOrder.total.toFixed(2)}</p>
          <button
            onClick={() => { setSuccessOrder(null); setCart({}); }}
            className="w-full py-3 bg-cyan-500 rounded-xl text-black font-bold"
            data-testid="qr-order-again"
          >
            Weitere Bestellung
          </button>
        </motion.div>
      </div>
    );
  }

  const scopes = resolved?.settings?.scopes || ["food"];
  const hasDrinks = scopes.includes("drinks");

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32" data-testid="qr-order-page">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5 px-4 py-4">
        <div className="flex items-center gap-3">
          {menu.logo_url && (
            <img src={menu.logo_url} alt={menu.name} className="w-10 h-10 rounded-lg object-cover" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{menu.name || "Speisekarte"}</p>
            <p className="text-xs text-cyan-400 truncate" data-testid="qr-table-label">
              📍 {resolved?.table_label}
            </p>
          </div>
        </div>
        {hasDrinks && scopes.length > 1 && (
          <div className="flex gap-2 mt-3">
            {scopes.map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold ${
                  scope === s ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "bg-white/5 text-gray-400"
                }`}
                data-testid={`qr-scope-${s}`}
              >
                {s === "food" ? "🍽️ Speisen" : "🥤 Getränke"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Menu list */}
      <div className="px-4 py-4 space-y-2">
        {itemsByScope.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-8">
            Keine Artikel in dieser Kategorie
          </p>
        )}
        {itemsByScope.map((it) => {
          const key = String(it.item_id || it.id || it.name);
          const qty = cart[key]?.qty || 0;
          return (
            <div
              key={key}
              className="flex items-center gap-3 px-3 py-3 bg-[#111] border border-white/5 rounded-2xl"
              data-testid={`qr-item-${key}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{it.name}</p>
                {it.category && (
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">{it.category}</p>
                )}
                <p className="text-sm text-cyan-400 font-bold mt-0.5">€{Number(it.price).toFixed(2)}</p>
              </div>
              {qty === 0 ? (
                <button
                  onClick={() => inc(it)}
                  className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-xl text-sm font-semibold"
                  data-testid={`qr-add-${key}`}
                >
                  +
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-cyan-500/10 rounded-xl px-2 py-1">
                  <button onClick={() => dec(it)} className="w-7 h-7 rounded-full bg-white/10 text-white" data-testid={`qr-dec-${key}`}>−</button>
                  <span className="text-sm font-bold text-cyan-400 min-w-[18px] text-center" data-testid={`qr-qty-${key}`}>{qty}</span>
                  <button onClick={() => inc(it)} className="w-7 h-7 rounded-full bg-cyan-500 text-black" data-testid={`qr-inc-${key}`}>+</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom CTA */}
      <AnimatePresence>
        {cartItems.length > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed inset-x-0 bottom-0 z-40 bg-[#0A0A0F] border-t border-white/10 px-4 pt-3 pb-6 shadow-[0_-12px_40px_rgba(0,0,0,0.6)]"
            data-testid="qr-cart-cta"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">
                {cartItems.reduce((s, c) => s + c.qty, 0)} Artikel · Bezahlung via Wallet
              </span>
              <span className="text-lg font-bold text-cyan-400" data-testid="qr-cart-total">
                €{total.toFixed(2)}
              </span>
            </div>
            <button
              onClick={submit}
              disabled={submitting}
              className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 rounded-2xl font-bold text-black text-base disabled:opacity-50 shadow-[0_4px_24px_rgba(0,194,255,0.35)]"
              data-testid="qr-submit-btn"
            >
              {submitting ? "Wird gesendet..." : "Bestellung abschicken"}
            </button>
            {orderError && (
              <p className="text-xs text-red-400 mt-2 text-center" data-testid="qr-order-error">
                {orderError}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
