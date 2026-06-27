import { useState } from "react";
import { Gift, CreditCard, Check, Loader2, ScanLine, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { scanNFC } from "../../utils/nfcService";

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

export function POSVoucherSale({ storeId, registerId, onComplete }) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const sellVoucher = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      return toast.error("Bitte Betrag eingeben");
    }

    setLoading(true);
    try {
      const data = await apiCall("/api/pos/vouchers/sell", {
        method: "POST",
        body: {
          store_id: storeId,
          register_id: registerId,
          amount: parseFloat(amount),
          payment_method: paymentMethod,
          recipient_email: email || null,
          message: message || null,
        },
      });

      setResult(data.voucher);
      toast.success("Gutschein verkauft!");
      setTimeout(() => onComplete && onComplete(), 3000);
    } catch (e) {
      toast.error(e.message);
    }
    setLoading(false);
  };

  if (result) {
    return (
      <div className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl border border-green-500/20 text-center">
        <Check size={48} className="text-green-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold mb-2">Gutschein verkauft!</h3>
        <div className="bg-white/10 p-4 rounded-xl mb-3">
          <p className="text-2xl font-black text-[#00C2FF] mb-1">€{result.amount}</p>
          <p className="text-xs text-white/60 mb-2">Gutschein-Code:</p>
          <p className="text-lg font-mono font-bold tracking-wider">{result.code}</p>
        </div>
        <p className="text-xs text-white/40">Gültig bis: {new Date(result.valid_until).toLocaleDateString("de-DE")}</p>
        <button
          onClick={() => {
            setResult(null);
            setAmount("");
            setEmail("");
            setMessage("");
          }}
          className="mt-4 px-4 py-2 rounded-lg bg-white/10 text-sm"
        >
          Neuer Gutschein
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Gift size={20} className="text-[#FF4060]" />
        <h3 className="text-sm font-bold">Gutschein verkaufen</h3>
      </div>

      <input
        type="number"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Betrag € (max. 2000)"
        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-base"
        data-testid="voucher-amount"
      />

      <select
        value={paymentMethod}
        onChange={(e) => setPaymentMethod(e.target.value)}
        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm"
      >
        <option value="cash">Bar bezahlt</option>
        <option value="card_external">Karte bezahlt</option>
        <option value="wallet_qr">Wallet QR</option>
      </select>

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="E-Mail (optional)"
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs"
      />

      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Grußnachricht (optional)"
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs"
      />

      <button
        onClick={sellVoucher}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF4060] to-[#FF6B88] text-white font-bold disabled:opacity-50"
        data-testid="voucher-sell-btn"
      >
        {loading ? <Loader2 size={16} className="animate-spin inline" /> : `Verkaufen €${amount || "0.00"}`}
      </button>
    </div>
  );
}

export function POSWalletTopUp({ storeId, registerId, onComplete }) {
  const [customerNumber, setCustomerNumber] = useState("");
  const [lookupValue, setLookupValue] = useState("");
  const [lookupMode, setLookupMode] = useState("barcode");
  const [resolvedCustomer, setResolvedCustomer] = useState(null);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [result, setResult] = useState(null);

  const resolveCustomer = async (mode = lookupMode, value = lookupValue) => {
    const finalValue = (value || "").trim();
    if (!finalValue) {
      return toast.error(mode === "user_number" ? "Bitte Kundennummer eingeben" : mode === "barcode" ? "Bitte Barcode scannen oder eingeben" : "Bitte NFC zuerst auslesen");
    }
    setResolving(true);
    try {
      const data = await apiCall("/api/pos/vouchers/resolve-customer", {
        method: "POST",
        body: { lookup_type: mode, value: finalValue },
      });
      setResolvedCustomer(data.customer);
      setCustomerNumber(data.customer.user_number || "");
      toast.success(`Kunde erkannt: ${data.customer.user_number}`);
    } catch (e) {
      setResolvedCustomer(null);
      toast.error(e.message);
    }
    setResolving(false);
  };

  const startNfcLookup = async () => {
    setResolving(true);
    try {
      const res = await scanNFC({ timeout: 12000 });
      if (!res.ok) throw new Error(res.error || "NFC konnte nicht gelesen werden");
      const candidate = `${res.payload || ""} ${res.uid || ""}`.trim();
      setLookupMode("nfc");
      setLookupValue(candidate);
      await resolveCustomer("nfc", candidate);
    } catch (e) {
      toast.error(e.message);
    }
    setResolving(false);
  };

  const topUp = async () => {
    if (!customerNumber || !amount || parseFloat(amount) <= 0) {
      return toast.error("Kundennummer und Betrag erforderlich");
    }

    setLoading(true);
    try {
      const data = await apiCall("/api/pos/vouchers/topup", {
        method: "POST",
        body: {
          store_id: storeId,
          register_id: registerId,
          customer_user_number: (resolvedCustomer?.user_number || customerNumber).trim().toUpperCase(),
          amount: parseFloat(amount),
          payment_method: paymentMethod,
        },
      });

      setResult(data.customer);
      toast.success(data.message);
      setTimeout(() => onComplete && onComplete(), 3000);
    } catch (e) {
      toast.error(e.message);
    }
    setLoading(false);
  };

  if (result) {
    return (
      <div className="p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl border border-blue-500/20 text-center">
        <Check size={48} className="text-blue-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold mb-2">Wallet aufgeladen!</h3>
          <p className="text-sm text-white/60 mb-1">{result.user_number}</p>
          <p className="text-[11px] text-white/40 mb-3">{result.email}</p>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-white/5 p-3 rounded-lg">
            <p className="text-[10px] text-white/40">Vorher</p>
            <p className="text-lg font-bold">€{result.old_balance.toFixed(2)}</p>
          </div>
          <div className="bg-white/5 p-3 rounded-lg">
            <p className="text-[10px] text-white/40">Jetzt</p>
            <p className="text-lg font-bold text-[#00C2FF]">€{result.new_balance.toFixed(2)}</p>
          </div>
        </div>
        <button
          onClick={() => {
            setResult(null);
            setCustomerNumber("");
            setLookupValue("");
            setResolvedCustomer(null);
            setAmount("");
          }}
          className="mt-4 px-4 py-2 rounded-lg bg-white/10 text-sm"
        >
          Neue Aufladung
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard size={20} className="text-[#00C2FF]" />
        <h3 className="text-sm font-bold">Wallet aufladen</h3>
      </div>

      <div className="grid grid-cols-3 gap-2" data-testid="topup-lookup-mode-switcher">
        {[
          { id: "barcode", label: "Scan", icon: ScanLine },
          { id: "nfc", label: "NFC", icon: Smartphone },
          { id: "user_number", label: "Nummer", icon: CreditCard },
        ].map((mode) => (
          <button
            key={mode.id}
            onClick={() => setLookupMode(mode.id)}
            className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-bold ${lookupMode === mode.id ? "border-[#00C2FF] bg-[#00C2FF]/15 text-[#00C2FF]" : "border-white/10 bg-white/5 text-white/70"}`}
            data-testid={`topup-lookup-mode-${mode.id}`}
          >
            <mode.icon size={13} /> {mode.label}
          </button>
        ))}
      </div>

      {lookupMode !== "nfc" && (
        <input
          type="text"
          value={lookupValue}
          onChange={(e) => setLookupValue(e.target.value.toUpperCase())}
          placeholder={lookupMode === "barcode" ? "Barcode scannen oder eingeben" : "Kundennummer eingeben"}
          className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm"
          data-testid="topup-lookup-input"
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => lookupMode === "nfc" ? startNfcLookup() : resolveCustomer()}
          disabled={resolving}
          className="py-2.5 rounded-xl bg-white/10 text-white text-sm font-bold disabled:opacity-50"
          data-testid="topup-resolve-btn"
        >
          {resolving ? <Loader2 size={16} className="animate-spin inline" /> : lookupMode === "barcode" ? "Scan prüfen" : lookupMode === "nfc" ? "NFC lesen" : "Kundennummer prüfen"}
        </button>
        <button
          onClick={() => {
            setLookupMode("user_number");
            setResolvedCustomer(null);
            setCustomerNumber("");
          }}
          className="py-2.5 rounded-xl border border-white/10 bg-black/20 text-white text-sm font-bold"
          data-testid="topup-fallback-number-btn"
        >
          Fallback Kundennummer
        </button>
      </div>

      {resolvedCustomer && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3" data-testid="topup-resolved-customer-card">
          <p className="text-sm font-bold text-white">{resolvedCustomer.name || resolvedCustomer.email}</p>
          <p className="mt-1 text-[11px] text-emerald-100/80">Kundennummer: {resolvedCustomer.user_number}</p>
          <p className="text-[11px] text-emerald-100/60">Status: {resolvedCustomer.kyc_status || "not_started"}</p>
        </div>
      )}

      <input
        type="text"
        value={customerNumber}
        onChange={(e) => setCustomerNumber(e.target.value.toUpperCase())}
        placeholder="Kundennummer (Fallback)"
        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm"
        data-testid="topup-customer-number"
      />

      <p className="text-[11px] text-white/45" data-testid="topup-customer-number-hint">
        Erst Scan/NFC versuchen. Wenn das nicht funktioniert, Kundennummer als Fallback verwenden.
      </p>

      <input
        type="number"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Betrag € (max. 500)"
        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-base"
        data-testid="topup-amount"
      />

      <select
        value={paymentMethod}
        onChange={(e) => setPaymentMethod(e.target.value)}
        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm"
      >
        <option value="cash">Bar bezahlt</option>
        <option value="card_external">Karte bezahlt</option>
      </select>

      <button
        onClick={topUp}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00C2FF] to-[#00E89D] text-black font-bold disabled:opacity-50"
        data-testid="topup-btn"
      >
        {loading ? <Loader2 size={16} className="animate-spin inline" /> : `Aufladen €${amount || "0.00"}`}
      </button>
    </div>
  );
}
