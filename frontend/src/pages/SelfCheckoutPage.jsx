/**
 * Self-Checkout — Customer-Page
 * Kunde scannt QR am Eingang, wählt Store, scannt Produkte, zahlt aus Wallet.
 * Route: /selfcheckout — Store-ID via navState.store_id oder ?store=...
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, ScanLine, Search, Trash2, Loader2, Check,
  ShoppingBag, Wallet, AlertTriangle, Plus, Minus, Receipt,
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

async function apiCall(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method, credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

export default function SelfCheckoutPage({ onBack, navState }) {
  const initialStoreId = useMemo(() => {
    if (navState?.store_id) return navState.store_id;
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      return u.searchParams.get("store") || u.searchParams.get("store_id") || "";
    }
    return "";
  }, [navState]);

  const [storeId, setStoreId] = useState(initialStoreId);
  const [storeInput, setStoreInput] = useState(initialStoreId);
  const [storeInfo, setStoreInfo] = useState(null);
  const [session, setSession] = useState(null);
  const [scan, setScan] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(null);
  const [error, setError] = useState("");
  const scanRef = useRef(null);

  useEffect(() => {
    if (!storeId) return;
    setError("");
    apiCall(`/api/pos/selfcheckout/store/${encodeURIComponent(storeId)}`)
      .then(setStoreInfo)
      .catch((e) => { setError(e.message); setStoreInfo(null); });
  }, [storeId]);

  useEffect(() => {
    if (!storeInfo?.self_checkout_enabled || session) return;
    apiCall("/api/pos/selfcheckout/session/start", {
      method: "POST", body: { store_id: storeId },
    }).then((d) => setSession(d.session)).catch((e) => setError(e.message));
  }, [storeInfo, storeId, session]);

  useEffect(() => {
    if (session && scanRef.current) scanRef.current.focus();
  }, [session]);

  const addByBarcode = async (code) => {
    if (!code || !session) return;
    try {
      const p = await apiCall(`/api/pos/selfcheckout/product/barcode/${encodeURIComponent(code)}?store_id=${storeId}`);
      const d = await apiCall("/api/pos/selfcheckout/session/add", {
        method: "POST", body: { session_id: session.session_id, product_id: p.product_id, quantity: 1 },
      });
      setSession(d.session);
      toast.success(`+ ${p.name}`);
      setScan("");
    } catch (e) { toast.error(e.message); }
  };

  const doSearch = async () => {
    if (!search || !storeId) return;
    try {
      const d = await apiCall(`/api/pos/selfcheckout/catalog/${encodeURIComponent(storeId)}?q=${encodeURIComponent(search)}&limit=20`);
      setResults(d.products || []);
    } catch (e) { toast.error(e.message); }
  };

  const addProduct = async (p) => {
    if (!session) return;
    try {
      const d = await apiCall("/api/pos/selfcheckout/session/add", {
        method: "POST", body: { session_id: session.session_id, product_id: p.product_id, quantity: 1 },
      });
      setSession(d.session);
      setResults([]); setSearch("");
    } catch (e) { toast.error(e.message); }
  };

  const updateQty = async (product_id, quantity) => {
    if (!session) return;
    try {
      const d = await apiCall("/api/pos/selfcheckout/session/update-qty", {
        method: "POST", body: { session_id: session.session_id, product_id, quantity },
      });
      setSession(d.session);
    } catch (e) { toast.error(e.message); }
  };

  const cancel = async () => {
    if (!session) return;
    if (!window.confirm("Self-Checkout abbrechen?")) return;
    try {
      await apiCall("/api/pos/selfcheckout/session/cancel", {
        method: "POST", body: { session_id: session.session_id },
      });
      setSession(null);
      setStoreId(""); setStoreInput("");
    } catch (e) { toast.error(e.message); }
  };

  const pay = async () => {
    if (!session || !session.items?.length) return;
    setPaying(true);
    try {
      const d = await apiCall("/api/pos/selfcheckout/session/pay", {
        method: "POST", body: { session_id: session.session_id },
      });
      setPaid(d);
      toast.success(d.message || "Bezahlt");
    } catch (e) { toast.error(e.message); }
    setPaying(false);
  };

  if (paid) return <SuccessView paid={paid} onDone={() => { setPaid(null); setSession(null); }} onBack={onBack} />;

  if (!storeId) {
    return (
      <div className="min-h-screen bg-[#060810] text-white p-5" data-testid="selfcheckout-enter">
        <Header onBack={onBack} title="Self-Checkout" />
        <div className="max-w-md mx-auto mt-12">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6 text-center">
            <ScanLine size={36} className="text-[#00C2FF] mx-auto mb-3" />
            <h2 className="text-xl font-black mb-2">Filiale eingeben</h2>
            <p className="text-[12px] text-white/60 mb-4">Scanne den QR-Code im Geschäft oder gib die Filial-ID ein.</p>
            <input
              value={storeInput}
              onChange={(e) => setStoreInput(e.target.value)}
              placeholder="z.B. STR-ABC123"
              className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-center text-[14px] font-mono"
              onKeyDown={(e) => { if (e.key === "Enter") setStoreId(storeInput.trim()); }}
              data-testid="selfcheckout-store-input"
            />
            <button
              onClick={() => setStoreId(storeInput.trim())}
              disabled={!storeInput.trim()}
              className="w-full mt-3 py-3 rounded-xl bg-[#00C2FF] text-black font-black disabled:opacity-50"
              data-testid="selfcheckout-enter-btn">
              Weiter
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) return (
    <div className="min-h-screen bg-[#060810] text-white p-5">
      <Header onBack={onBack} title="Self-Checkout" />
      <div className="max-w-md mx-auto mt-12 rounded-2xl bg-red-500/10 border border-red-500/20 p-6 text-center" data-testid="selfcheckout-error">
        <AlertTriangle size={36} className="text-red-400 mx-auto mb-3" />
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={() => { setStoreId(""); setStoreInput(""); setError(""); }}
          className="mt-4 px-4 py-2 rounded-lg bg-white/10 text-[12px]">Andere Filiale</button>
      </div>
    </div>
  );

  if (!storeInfo || !session) return (
    <div className="min-h-screen bg-[#060810] flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-[#00C2FF]" />
    </div>
  );

  if (!storeInfo.self_checkout_enabled) return (
    <div className="min-h-screen bg-[#060810] text-white p-5">
      <Header onBack={onBack} title="Self-Checkout" />
      <div className="max-w-md mx-auto mt-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-6 text-center" data-testid="selfcheckout-not-enabled">
        <AlertTriangle size={36} className="text-amber-400 mx-auto mb-3" />
        <p className="text-[14px] font-bold mb-2">Self-Checkout nicht verfügbar</p>
        <p className="text-[12px] text-white/60">Diese Filiale hat das Self-Checkout-Add-On nicht aktiviert. Bitte zur klassischen Kasse.</p>
      </div>
    </div>
  );

  const total = session.total || 0;

  return (
    <div className="min-h-screen bg-[#060810] text-white pb-32" data-testid="selfcheckout-active">
      <Header onBack={cancel} title={storeInfo.merchant?.business_name || "Self-Checkout"}
        subtitle={storeInfo.store?.name} />

      <div className="p-4 max-w-md mx-auto">
        <div className="flex items-center gap-2 bg-white/5 border-2 border-[#00C2FF]/40 rounded-xl px-3 py-3 mb-3">
          <ScanLine size={18} className="text-[#00C2FF]" />
          <input ref={scanRef} value={scan} onChange={(e) => setScan(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addByBarcode(scan); }}
            placeholder="Barcode scannen…"
            className="flex-1 bg-transparent text-white text-[14px] font-mono outline-none"
            data-testid="selfcheckout-scan" />
          {scan && <button onClick={() => addByBarcode(scan)} className="text-[#00C2FF] text-[11px] font-bold">SCAN</button>}
        </div>

        <div className="flex gap-2 mb-2">
          <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <Search size={13} className="text-white/40" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
              placeholder="Produkt suchen…"
              className="flex-1 bg-transparent text-white text-[12px] outline-none"
              data-testid="selfcheckout-search" />
          </div>
          <button onClick={doSearch} className="px-3 py-2 rounded-xl bg-white/10 text-[11px] font-bold">Suche</button>
        </div>
        {results.length > 0 && (
          <div className="rounded-xl bg-white/5 border border-white/10 mb-3 max-h-60 overflow-y-auto">
            {results.map((p) => (
              <button key={p.product_id} onClick={() => addProduct(p)}
                className="w-full flex justify-between items-center px-3 py-2 text-[12px] border-b border-white/5 last:border-0 hover:bg-white/5"
                data-testid={`selfcheckout-result-${p.product_id}`}>
                <span className="text-left flex-1 truncate">
                  {p.name}<span className="text-white/40 text-[10px] ml-1">· {p.unit || "Stk"}</span>
                </span>
                <span className="font-bold text-[#00C2FF]">€{p.price.toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 mb-3" data-testid="selfcheckout-cart">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-bold flex items-center gap-2"><ShoppingBag size={14} /> Warenkorb ({session.items.length})</h3>
            {session.items.length > 0 && (
              <button onClick={cancel} className="text-[10px] text-red-400">Abbrechen ×</button>
            )}
          </div>
          {session.items.length === 0 ? (
            <p className="text-[12px] text-white/40 text-center py-6">Scanne dein erstes Produkt</p>
          ) : (
            <div className="space-y-2">
              {session.items.map((it) => (
                <div key={it.product_id} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] truncate">{it.name}</p>
                    <p className="text-[10px] text-white/40">€{it.price.toFixed(2)} × {it.quantity} · MwSt {Math.round((it.tax_rate || 0) * 100)}%</p>
                  </div>
                  <button onClick={() => updateQty(it.product_id, Math.max(0, it.quantity - 1))}
                    className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center"
                    data-testid={`selfcheckout-minus-${it.product_id}`}>
                    <Minus size={11} />
                  </button>
                  <span className="w-7 text-center text-[13px] font-bold">{it.quantity}</span>
                  <button onClick={() => updateQty(it.product_id, it.quantity + 1)}
                    className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center"
                    data-testid={`selfcheckout-plus-${it.product_id}`}>
                    <Plus size={11} />
                  </button>
                  <button onClick={() => updateQty(it.product_id, 0)}
                    className="text-red-400 ml-1"
                    data-testid={`selfcheckout-remove-${it.product_id}`}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {session.items.length > 0 && (
        <motion.div className="fixed bottom-0 left-0 right-0 backdrop-blur-xl bg-[#060810]/95 border-t border-white/10 p-4"
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <div className="max-w-md mx-auto flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[10px] text-white/40 uppercase">Gesamt</p>
              <p className="text-2xl font-black text-[#00C2FF]" data-testid="selfcheckout-total">€{total.toFixed(2)}</p>
            </div>
            <button onClick={pay} disabled={paying}
              className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#00C2FF] to-[#00E89D] text-black font-black text-[14px] flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="selfcheckout-pay-btn">
              {paying ? <Loader2 size={14} className="animate-spin" /> : (<><Wallet size={14} /> Aus Wallet zahlen</>)}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Header({ onBack, title, subtitle }) {
  return (
    <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#060810]/90 border-b border-white/[0.06] flex items-center gap-3 px-4 py-3 pt-[max(env(safe-area-inset-top,0px),14px)]">
      <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"
        data-testid="selfcheckout-back">
        <ArrowLeft size={15} className="text-white/70" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold truncate">{title}</p>
        {subtitle && <p className="text-[10px] text-white/50 truncate">{subtitle}</p>}
      </div>
    </div>
  );
}

function SuccessView({ paid, onDone, onBack }) {
  return (
    <div className="min-h-screen bg-[#060810] text-white p-5 flex flex-col" data-testid="selfcheckout-success">
      <Header onBack={onBack} title="Bezahlt ✓" />
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-[#10B981] to-[#00E89D] mx-auto mb-4 flex items-center justify-center">
            <Check size={40} className="text-white" />
          </motion.div>
          <h2 className="text-3xl font-black text-[#00E89D] mb-2">€{paid.sale.total.toFixed(2)}</h2>
          <p className="text-[12px] text-white/60 mb-1">Beleg-Nr.</p>
          <p className="text-[14px] font-mono font-bold mb-4">{paid.sale.receipt_id}</p>
          <p className="text-[11px] text-white/40 mb-6">Wallet-Stand: €{paid.new_wallet_balance?.toFixed(2)}</p>
          <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
            <a href={`${API}/api/pos/receipts/${paid.sale.receipt_id}/pdf`} target="_blank" rel="noopener noreferrer"
              className="py-3 rounded-xl bg-white/10 text-[12px] font-bold flex items-center justify-center gap-1.5"
              data-testid="selfcheckout-pdf">
              <Receipt size={12} /> Beleg
            </a>
            <button onClick={onDone}
              className="py-3 rounded-xl bg-[#00C2FF] text-black text-[12px] font-bold"
              data-testid="selfcheckout-new">
              Neuer Einkauf
            </button>
          </div>
          <button onClick={onBack}
            className="mt-3 text-[11px] text-white/40">
            Zurück zur App
          </button>
        </div>
      </div>
    </div>
  );
}
