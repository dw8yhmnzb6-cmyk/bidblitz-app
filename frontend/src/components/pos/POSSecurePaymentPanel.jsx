import { useState } from "react";
import { CheckCircle2, CreditCard, Loader2, ScanLine, ShieldAlert, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../services/api";
import { scanNFC } from "../../utils/nfcService";

const lookupModes = [
  { id: "scan", label: "Scan", icon: ScanLine },
  { id: "nfc", label: "NFC", icon: Smartphone },
  { id: "customer_number", label: "Nummer", icon: Wallet },
];

export function POSSecurePaymentPanel({ storeId, registerId }) {
  const [lookupMode, setLookupMode] = useState("scan");
  const [lookupValue, setLookupValue] = useState("");
  const [resolutionId, setResolutionId] = useState("");
  const [customer, setCustomer] = useState(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("POS Zahlung");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState(null);
  const [resultState, setResultState] = useState(null);

  const resetFlow = () => {
    setLookupMode("scan");
    setLookupValue("");
    setResolutionId("");
    setCustomer(null);
    setAmount("");
    setDescription("POS Zahlung");
    setPin("");
    setPayment(null);
    setResultState(null);
  };

  const resolveCustomer = async (mode = lookupMode, value = lookupValue) => {
    const finalValue = (value || "").trim();
    if (!finalValue) {
      toast.error(mode === "customer_number" ? "Bitte Kundennummer eingeben" : mode === "scan" ? "Bitte Scan eingeben" : "Bitte NFC lesen");
      return;
    }
    setBusy(true);
    try {
      const data = await api.posResolveCustomer({ store_id: storeId, register_id: registerId, lookup_type: mode, value: finalValue });
      setCustomer(data.customer);
      setResolutionId(data.resolution_id);
      toast.success(`Kunde erkannt: ${data.customer.customer_number}`);
    } catch (error) {
      setCustomer(null);
      setResolutionId("");
      toast.error(error.message || "Kunde konnte nicht aufgelöst werden");
    } finally {
      setBusy(false);
    }
  };

  const startNfcLookup = async () => {
    setBusy(true);
    try {
      const res = await scanNFC({ timeout: 12000 });
      if (!res.ok) throw new Error(res.error || "NFC konnte nicht gelesen werden");
      const candidate = `${res.payload || ""} ${res.uid || ""}`.trim();
      setLookupMode("nfc");
      setLookupValue(candidate);
      await resolveCustomer("nfc", candidate);
    } catch (error) {
      toast.error(error.message || "NFC fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const preparePayment = async () => {
    if (!customer || !resolutionId) {
      toast.error("Bitte zuerst einen Kunden sicher auflösen");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("Bitte Betrag eingeben");
      return;
    }
    setBusy(true);
    try {
      const data = await api.posPreparePaymentSecure({
        store_id: storeId,
        register_id: registerId,
        resolution_id: resolutionId,
        amount: Number(amount),
        description,
        payment_method: "wallet",
        lookup_type: lookupMode,
      });
      if (data.status === "approval_required") {
        setResultState({ status: "approval_required", message: data.message, approvalId: data.approval?.approval_id || "" });
      } else {
        setPayment(data.payment);
        setResultState(null);
      }
    } catch (error) {
      toast.error(error.message || "Zahlung konnte nicht vorbereitet werden");
    } finally {
      setBusy(false);
    }
  };

  const confirmPin = async () => {
    if (!payment?.payment_id) {
      toast.error("Keine vorbereitete Zahlung vorhanden");
      return;
    }
    if (pin.length !== 4) {
      toast.error("Bitte 4-stellige PIN eingeben");
      return;
    }
    setBusy(true);
    try {
      const data = await api.posConfirmPaymentPin({ payment_id: payment.payment_id, pin });
      setResultState(data);
      if (data.status === "approved") toast.success("Payment approved");
      else if (data.status === "awaiting_app_confirmation") toast.success("App confirmation required");
      else toast.error("Payment declined");
    } catch (error) {
      setResultState({ status: "declined", message: "Payment declined" });
      toast.error(error.message || "Payment declined");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="pos-secure-payment-panel">
      <div className="flex items-center gap-2">
        <ShieldAlert size={18} className="text-[#ffb36f]" />
        <div>
          <h3 className="text-sm font-bold">Secure Payment</h3>
          <p className="text-[11px] text-white/55">PIN, Scan/NFC/Nummer und keine Balance-Anzeige.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2" data-testid="secure-payment-lookup-mode-switcher">
        {lookupModes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => setLookupMode(mode.id)}
            data-testid={`secure-payment-lookup-mode-${mode.id}`}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${lookupMode === mode.id ? "border-[#ffb36f] bg-[#ffb36f]/15 text-[#ffb36f]" : "border-white/10 bg-white/5 text-white/70"}`}
          >
            <mode.icon size={13} /> {mode.label}
          </button>
        ))}
      </div>

      {lookupMode !== "nfc" ? (
        <input
          value={lookupValue}
          onChange={(event) => setLookupValue(event.target.value.toUpperCase())}
          placeholder={lookupMode === "scan" ? "Scan eingeben" : "Kundennummer eingeben"}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm"
          data-testid="secure-payment-lookup-input"
        />
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => (lookupMode === "nfc" ? startNfcLookup() : resolveCustomer())} className="rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white disabled:opacity-50" disabled={busy} data-testid="secure-payment-resolve-button">
          {busy ? <Loader2 size={16} className="mx-auto animate-spin" /> : lookupMode === "nfc" ? "NFC lesen" : "Kunde prüfen"}
        </button>
        <button type="button" onClick={() => { setLookupMode("customer_number"); setLookupValue(""); setCustomer(null); setResolutionId(""); }} className="rounded-xl border border-white/10 bg-black/20 py-2.5 text-sm font-bold text-white" data-testid="secure-payment-fallback-number-button">Fallback Nummer</button>
      </div>

      {customer ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3" data-testid="secure-payment-resolved-customer-card">
          <p className="text-sm font-bold text-white" data-testid="secure-payment-customer-masked-name">{customer.masked_name}</p>
          <p className="mt-1 text-[11px] text-emerald-100/80" data-testid="secure-payment-customer-number">Kundennummer: {customer.customer_number}</p>
          <p className="text-[11px] text-emerald-100/60" data-testid="secure-payment-verification-status">Status: {customer.verification_status}</p>
        </div>
      ) : null}

      <input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" step="0.01" min="0" placeholder="Betrag €" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm" data-testid="secure-payment-amount-input" />
      <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Beschreibung" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm" data-testid="secure-payment-description-input" />

      <button type="button" onClick={preparePayment} className="w-full rounded-xl bg-[#ffb36f] py-3 text-sm font-black text-black disabled:opacity-50" disabled={busy} data-testid="secure-payment-prepare-button">
        {busy ? <Loader2 size={16} className="mx-auto animate-spin" /> : `Confirm payment €${amount || "0.00"}`}
      </button>

      {payment ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4" data-testid="secure-payment-pin-card">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">4-digit PIN input</p>
          <p className="mt-2 text-sm font-semibold text-white">{payment.requires_app_confirmation ? "PIN + App confirmation erforderlich" : "Nur PIN erforderlich"}</p>
          <input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="••••" className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center text-lg tracking-[0.5em]" data-testid="secure-payment-pin-input" />
          <button type="button" onClick={confirmPin} className="mt-3 w-full rounded-xl bg-[#00C2FF] py-3 text-sm font-black text-black disabled:opacity-50" disabled={busy} data-testid="secure-payment-confirm-button">
            {busy ? <Loader2 size={16} className="mx-auto animate-spin" /> : <span className="inline-flex items-center gap-2"><CreditCard size={14} /> Confirm payment</span>}
          </button>
        </div>
      ) : null}

      {resultState ? (
        <div className={`rounded-2xl border p-4 ${resultState.status === "approved" ? "border-emerald-400/20 bg-emerald-400/10" : resultState.status === "approval_required" || resultState.status === "awaiting_app_confirmation" ? "border-amber-400/20 bg-amber-400/10" : "border-red-400/20 bg-red-400/10"}`} data-testid="secure-payment-result-card">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className={resultState.status === "approved" ? "text-emerald-300" : "text-amber-300"} />
            <p className="text-sm font-bold text-white" data-testid="secure-payment-result-status">{resultState.status === "approved" ? "Success" : resultState.status === "awaiting_app_confirmation" ? "App confirmation required" : resultState.status === "approval_required" ? "Manager approval required" : "Declined"}</p>
          </div>
          <p className="mt-2 text-sm text-white/80" data-testid="secure-payment-result-message">{resultState.status === "approved" ? "Payment approved" : resultState.status === "awaiting_app_confirmation" ? "App confirmation required" : resultState.status === "approval_required" ? resultState.message || "Manager approval required" : "Payment declined"}</p>
          {resultState.approvalId ? <p className="mt-1 text-[11px] text-white/55">Approval: {resultState.approvalId}</p> : null}
          <button type="button" onClick={resetFlow} className="mt-3 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/80" data-testid="secure-payment-reset-button">Neue Zahlung</button>
        </div>
      ) : null}
    </div>
  );
}