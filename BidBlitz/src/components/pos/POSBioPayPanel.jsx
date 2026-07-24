import { useState } from "react";
import { Hand, Loader2, ScanLine, Smartphone, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../services/api";
import { scanNFC } from "../../utils/nfcService";

const lookupModes = [
  { id: "scan", label: "Scan", icon: ScanLine },
  { id: "nfc", label: "NFC", icon: Smartphone },
  { id: "customer_number", label: "Nummer", icon: UserRoundCheck },
];

export function POSBioPayPanel({ storeId, registerId }) {
  const [lookupMode, setLookupMode] = useState("scan");
  const [lookupValue, setLookupValue] = useState("");
  const [resolutionId, setResolutionId] = useState("");
  const [customer, setCustomer] = useState(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("PalmPay Zahlung");
  const [templateToken, setTemplateToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

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

  const executeBioPay = async () => {
    if (!customer || !resolutionId) {
      toast.error("Bitte zuerst Kunden sicher auflösen");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("Bitte Betrag eingeben");
      return;
    }
    if ((templateToken || "").trim().length < 8) {
      toast.error("Bitte gültigen PalmPay-Token eingeben");
      return;
    }
    setBusy(true);
    try {
      const data = await api.biopayPay({
        store_id: storeId,
        register_id: registerId,
        resolution_id: resolutionId,
        amount: Number(amount),
        description,
        template_token: templateToken.trim(),
        modality: "palm",
      });
      setResult(data);
      if (data.status === "approved") toast.success("PalmPay approved");
      else if (data.status === "awaiting_app_confirmation") toast.success("App confirmation required");
      else if (data.status === "approval_required") toast.success("Manager approval required");
      else toast.error("Payment declined");
    } catch (error) {
      setResult({ status: "declined", message: "Payment declined" });
      toast.error(error.message || "Payment declined");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="pos-biopay-panel">
      <div className="flex items-center gap-2">
        <Hand size={18} className="text-[#7df4d2]" />
        <div>
          <h3 className="text-sm font-bold">PalmPay / BioPay</h3>
          <p className="text-[11px] text-white/55">Biometrische Zahlung ohne Bildspeicherung — nur Template-Token.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2" data-testid="biopay-lookup-mode-switcher">
        {lookupModes.map((mode) => (
          <button key={mode.id} type="button" onClick={() => setLookupMode(mode.id)} data-testid={`biopay-lookup-mode-${mode.id}`} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${lookupMode === mode.id ? "border-[#7df4d2] bg-[#7df4d2]/15 text-[#7df4d2]" : "border-white/10 bg-white/5 text-white/70"}`}>
            <mode.icon size={13} /> {mode.label}
          </button>
        ))}
      </div>

      {lookupMode !== "nfc" ? <input value={lookupValue} onChange={(event) => setLookupValue(event.target.value.toUpperCase())} placeholder={lookupMode === "scan" ? "Scan eingeben" : "Kundennummer eingeben"} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm" data-testid="biopay-lookup-input" /> : null}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => (lookupMode === "nfc" ? startNfcLookup() : resolveCustomer())} className="rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white disabled:opacity-50" disabled={busy} data-testid="biopay-resolve-button">{busy ? <Loader2 size={16} className="mx-auto animate-spin" /> : lookupMode === "nfc" ? "NFC lesen" : "Kunde prüfen"}</button>
        <button type="button" onClick={() => { setLookupMode("customer_number"); setLookupValue(""); setCustomer(null); setResolutionId(""); }} className="rounded-xl border border-white/10 bg-black/20 py-2.5 text-sm font-bold text-white" data-testid="biopay-fallback-number-button">Fallback Nummer</button>
      </div>

      {customer ? <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3" data-testid="biopay-resolved-customer-card"><p className="text-sm font-bold text-white" data-testid="biopay-customer-masked-name">{customer.masked_name}</p><p className="mt-1 text-[11px] text-emerald-100/80" data-testid="biopay-customer-number">Kundennummer: {customer.customer_number}</p><p className="text-[11px] text-emerald-100/60" data-testid="biopay-verification-status">Status: {customer.verification_status}</p></div> : null}

      <input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" step="0.01" min="0" placeholder="Betrag €" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm" data-testid="biopay-amount-input" />
      <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Beschreibung" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm" data-testid="biopay-description-input" />
      <input value={templateToken} onChange={(event) => setTemplateToken(event.target.value.trim())} placeholder="PalmPay Template-Token" className="w-full rounded-xl border border-[#7df4d2]/25 bg-[#7df4d2]/5 px-3 py-2.5 text-sm" data-testid="biopay-template-token-input" />

      <button type="button" onClick={executeBioPay} className="w-full rounded-xl bg-[#7df4d2] py-3 text-sm font-black text-black disabled:opacity-50" disabled={busy} data-testid="biopay-confirm-button">{busy ? <Loader2 size={16} className="mx-auto animate-spin" /> : "PalmPay ausführen"}</button>

      {result ? <div className={`rounded-2xl border p-4 ${result.status === "approved" ? "border-emerald-400/20 bg-emerald-400/10" : result.status === "awaiting_app_confirmation" || result.status === "approval_required" ? "border-amber-400/20 bg-amber-400/10" : "border-red-400/20 bg-red-400/10"}`} data-testid="biopay-result-card"><p className="text-sm font-bold text-white" data-testid="biopay-result-status">{result.status === "approved" ? "PalmPay approved" : result.status === "awaiting_app_confirmation" ? "App confirmation required" : result.status === "approval_required" ? "Manager approval required" : "Payment declined"}</p><p className="mt-2 text-sm text-white/80" data-testid="biopay-result-message">{result.message || (result.status === "approved" ? "Payment approved" : "Payment declined")}</p>{result.biopay_session?.session_id ? <p className="mt-1 text-[11px] text-white/55">Session: {result.biopay_session.session_id}</p> : null}</div> : null}
    </div>
  );
}