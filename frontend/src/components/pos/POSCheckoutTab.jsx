import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ScanLine, Search, Trash2, Loader2, Check, QrCode, CreditCard, Smartphone, Banknote, Download } from "lucide-react";
import { toast } from "sonner";
import { printReceipt } from "../../utils/escposPrinter";

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

function Card({ title, children, testid }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4" data-testid={testid}>
      {title && <h3 className="text-sm font-bold mb-2 text-white/90">{title}</h3>}
      {children}
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
  const [printing, setPrinting] = useState(false);
  const print = async () => {
    setPrinting(true);
    try {
      const r = await apiCall(`/api/pos/receipts/${sale.receipt_id}`);
      await printReceipt(r.sale, r.merchant, r.store);
      toast.success("Beleg gedruckt");
    } catch (e) {
      toast.error("Druck fehlgeschlagen: " + e.message);
    }
    setPrinting(false);
  };
  const btSupported = "bluetooth" in navigator;
  return (
    <Card title="✓ Zahlung erfolgreich" testid="pos-sale-success">
      <div className="text-center py-3">
        <Check size={36} className="text-[#10B981] mx-auto mb-2" />
        <p className="text-2xl font-black mb-1">€{sale.total.toFixed(2)}</p>
        <p className="text-[11px] text-white/60">Beleg: {sale.receipt_id}</p>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <a href={`${API}/api/pos/receipts/${sale.receipt_id}/pdf`} target="_blank" rel="noopener noreferrer"
            className="py-2 rounded-lg bg-white/10 text-[11px] font-bold flex items-center justify-center gap-1">
            <Download size={12} /> PDF
          </a>
          <button onClick={print} disabled={!btSupported || printing}
            className="py-2 rounded-lg bg-white/10 text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-30"
            title={btSupported ? "ESC/POS Bluetooth-Drucker" : "Web Bluetooth nicht unterstützt"}
            data-testid="pos-print-bt">
            {printing ? <Loader2 size={12} className="animate-spin" /> : "🖨 BT"}
          </button>
          <button onClick={onClose} className="py-2 rounded-lg bg-[#00C2FF] text-black text-[11px] font-bold">
            Neu
          </button>
        </div>
      </div>
    </Card>
  );
}

export default function POSCheckoutTab({ storeId, registerId, shift, onShiftChange }) {
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

  useEffect(() => { if (shift && scanRef.current) scanRef.current.focus(); }, [shift]);

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

  const buildItems = () => cart.map((c) => ({
    product_id: c.product_id, quantity: c.quantity, discount_pct: c.discount_pct || 0,
  }));

  const pay = async () => {
    if (cart.length === 0) return toast.error("Cart leer");
    try {
      const c = await apiCall("/api/pos/cart/create", {
        method: "POST",
        body: { register_id: registerId, items: buildItems(), discount_pct: discountPct },
      });
      const cart_id = c.cart.cart_id;

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
      const nfcAvailable = "NDEFReader" in window;
      setActivePayment({
        ...sess.session,
        is_nfc: true,
        qr_code: sess.fallback_qr,
        amount: c.cart.total,
        nfc_supported: nfcAvailable,
      });

      if (nfcAvailable) {
        try {
          // eslint-disable-next-line no-undef
          const reader = new NDEFReader();
          await reader.scan();
          reader.onreading = (e) => {
            for (const rec of e.message.records) {
              const td = new TextDecoder();
              const text = td.decode(rec.data);
              if (text.includes("BIDBLITZ-USER:")) {
                const userId = text.split("BIDBLITZ-USER:")[1]?.trim();
                toast.success(`NFC-Karte: ${userId}`);
              }
            }
          };
        } catch (err) {
          console.warn("NFC reader failed:", err);
        }
      }

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
          {activePayment.is_nfc && (
            <p className="text-[10px] mb-1" style={{ color: activePayment.nfc_supported ? "#10B981" : "#F59E0B" }}>
              {activePayment.nfc_supported ? "📡 NFC-Reader aktiv (Android Chrome)" : "⚠️ Kein NFC — bitte QR-Fallback nutzen"}
            </p>
          )}
          <p className="text-[10px] text-white/40 mb-4">Status: {activePayment.status}</p>
          <button onClick={cancelActive} className="px-4 py-2 rounded-lg bg-white/10 text-[11px]" data-testid="pos-cancel-payment">
            Abbrechen
          </button>
        </div>
      </Card>
    );
  }

  if (activePayment && activePayment.status === "paid" && activePayment.sale) {
    return <SaleCompleteCard sale={activePayment.sale} onClose={() => setActivePayment(null)} />;
  }

  return (
    <div className="space-y-3">
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
