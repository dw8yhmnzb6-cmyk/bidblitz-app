import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock3, ExternalLink, RefreshCcw, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";

const initialForm = {
  amount: "24.90",
  currency: "EUR",
  order_id: `SANDBOX-${Date.now().toString().slice(-6)}`,
  description: "BidBlitz-Pay Sandbox Checkout",
  customer_email: "",
  success_url: "/bidblitz-pay/success",
  cancel_url: "/bidblitz-pay/cancel",
  webhook_url: "",
  metadata: '{"source":"bidblitz-sandbox"}',
};

export default function BidBlitzPaySandboxPage({ onNavigate }) {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [payment, setPayment] = useState(null);
  const [refundBusy, setRefundBusy] = useState(false);
  const [error, setError] = useState("");

  const loadConfig = async () => {
    try {
      const data = await api.getBidBlitzPayConfig();
      setConfig(data);
    } catch (err) {
      setError(err.message || "Config konnte nicht geladen werden.");
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const refreshStatus = async (paymentId = payment?.payment_id) => {
    if (!paymentId) return;
    setStatusBusy(true);
    try {
      const data = await api.getBidBlitzPayPayment(paymentId);
      setPayment(data.payment);
    } catch (err) {
      setError(err.message || "Status konnte nicht geladen werden.");
    } finally {
      setStatusBusy(false);
    }
  };

  const handleCreate = async () => {
    setBusy(true);
    setError("");
    try {
      let parsedMetadata = {};
      try {
        parsedMetadata = JSON.parse(form.metadata || "{}");
      } catch (parseErr) {
        setError("Metadata JSON ist ungültig. Bitte korrigieren.");
        setBusy(false);
        return;
      }
      const body = {
        amount: Number(form.amount),
        currency: form.currency,
        order_id: form.order_id,
        description: form.description,
        customer_email: form.customer_email,
        success_url: form.success_url,
        cancel_url: form.cancel_url,
        webhook_url: form.webhook_url,
        metadata: parsedMetadata,
        idempotency_key: `sandbox-${form.order_id}`,
      };
      const data = await api.createBidBlitzPayPayment(body, `sandbox-${form.order_id}`);
      setPayment(data.payment);
      toast.success(data.reused ? "Vorhandene Sandbox-Zahlung wiederverwendet." : "Sandbox-Zahlung erstellt.");
    } catch (err) {
      setError(err.message || "Zahlung konnte nicht erstellt werden.");
    } finally {
      setBusy(false);
    }
  };

  const handleOpenCheckout = () => {
    if (!payment?.payment_id) return;
    onNavigate(`/bidblitz-pay/checkout/${payment.payment_id}`);
  };

  const handleRefund = async () => {
    if (!payment?.payment_id) return;
    setRefundBusy(true);
    setError("");
    try {
      const data = await api.createBidBlitzPayRefund(payment.payment_id, { reason: "Sandbox-Testrefund" }, `refund-${payment.payment_id}`);
      setPayment(data.payment);
      toast.success("Refund-Struktur erfolgreich getestet.");
    } catch (err) {
      setError(err.message || "Refund fehlgeschlagen.");
    } finally {
      setRefundBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050816] px-4 py-10 text-white" data-testid="bidblitz-pay-sandbox-page">
      <div className="mx-auto max-w-6xl space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(0,224,255,0.14),transparent_25%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#00E89D]/30 bg-[#00E89D]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#00E89D]">
              <Wallet size={14} /> BidBlitz Pay Sandbox
            </span>
            {config ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/65" data-testid="bidblitz-pay-sandbox-config-badge">
                <ShieldCheck size={14} /> {config.mode === "mock" ? "Sandbox / MOCKED aktiv" : "Live-Konfiguration aktiv"}
              </span>
            ) : null}
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-black sm:text-5xl" data-testid="bidblitz-pay-sandbox-title">Komplette Redirect-, Wallet- und Webhook-Struktur im Sandbox-Modus</h1>
          <p className="mt-4 max-w-3xl text-sm text-white/65">Zahlung starten, Redirect erhalten, Wallet-/App-Freigabe simulieren, Status prüfen und Refund-Struktur testen — ohne den bestehenden Checkout anzufassen.</p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6" data-testid="bidblitz-pay-sandbox-form-card">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Zahlung starten</p>
                <h2 className="text-2xl font-black">Sandbox-Checkout erzeugen</h2>
              </div>
              <button type="button" onClick={loadConfig} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/65" data-testid="bidblitz-pay-sandbox-refresh-config-button">
                <RefreshCcw size={14} /> Config prüfen
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Betrag" testId="bidblitz-pay-sandbox-amount-input"><input value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} className="input" data-testid="bidblitz-pay-sandbox-amount-input" /></Field>
              <Field label="Währung" testId="bidblitz-pay-sandbox-currency-input"><input value={form.currency} onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))} className="input" data-testid="bidblitz-pay-sandbox-currency-input" /></Field>
              <Field label="Order-ID" testId="bidblitz-pay-sandbox-order-id-input"><input value={form.order_id} onChange={(e) => setForm((prev) => ({ ...prev, order_id: e.target.value }))} className="input" data-testid="bidblitz-pay-sandbox-order-id-input" /></Field>
              <Field label="Kunden-E-Mail" testId="bidblitz-pay-sandbox-customer-email-input"><input value={form.customer_email} onChange={(e) => setForm((prev) => ({ ...prev, customer_email: e.target.value }))} className="input" data-testid="bidblitz-pay-sandbox-customer-email-input" /></Field>
            </div>
            <Field label="Beschreibung"><input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} className="input mt-2" data-testid="bidblitz-pay-sandbox-description-input" /></Field>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Success-URL"><input value={form.success_url} onChange={(e) => setForm((prev) => ({ ...prev, success_url: e.target.value }))} className="input" data-testid="bidblitz-pay-sandbox-success-url-input" /></Field>
              <Field label="Cancel-URL"><input value={form.cancel_url} onChange={(e) => setForm((prev) => ({ ...prev, cancel_url: e.target.value }))} className="input" data-testid="bidblitz-pay-sandbox-cancel-url-input" /></Field>
            </div>
            <Field label="Webhook-URL (optional)"><input value={form.webhook_url} onChange={(e) => setForm((prev) => ({ ...prev, webhook_url: e.target.value }))} className="input mt-2" data-testid="bidblitz-pay-sandbox-webhook-url-input" /></Field>
            <Field label="Metadata JSON"><textarea value={form.metadata} onChange={(e) => setForm((prev) => ({ ...prev, metadata: e.target.value }))} rows={4} className="input mt-2 resize-none" data-testid="bidblitz-pay-sandbox-metadata-input" /></Field>
            {error ? <p className="mt-4 text-sm text-red-400" data-testid="bidblitz-pay-sandbox-error-text">{error}</p> : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={handleCreate} disabled={busy} className="rounded-full bg-[linear-gradient(135deg,#00E0FF,#00E89D)] px-5 py-3 text-sm font-black text-[#050816] disabled:opacity-50" data-testid="bidblitz-pay-sandbox-create-button">
                {busy ? "Erstelle..." : "Zahlung starten"}
              </button>
              {payment ? <button type="button" onClick={handleOpenCheckout} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm text-white/70" data-testid="bidblitz-pay-sandbox-open-checkout-button">Checkout öffnen <ExternalLink size={14} /></button> : null}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6" data-testid="bidblitz-pay-sandbox-status-card">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Status & Refund</p>
                <h2 className="text-2xl font-black">Aktuelle Zahlung</h2>
              </div>
              <button type="button" onClick={() => refreshStatus()} disabled={!payment?.payment_id || statusBusy} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/65 disabled:opacity-40" data-testid="bidblitz-pay-sandbox-refresh-status-button">
                <Clock3 size={14} /> Status prüfen
              </button>
            </div>

            {!payment ? (
              <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm text-white/45" data-testid="bidblitz-pay-sandbox-empty-state">
                Noch keine Sandbox-Zahlung erzeugt.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-black/20 p-5" data-testid="bidblitz-pay-sandbox-payment-summary">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/40">Payment-ID</p>
                      <p className="mt-1 font-mono text-xs text-white/75">{payment.payment_id}</p>
                    </div>
                    <span className="rounded-full bg-[#00E89D]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#00E89D]" data-testid="bidblitz-pay-sandbox-mode-badge">{payment.test_mode ? "MOCKED" : payment.mode}</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-white/70">
                    <InfoLine label="Status" value={payment.status} testId="bidblitz-pay-sandbox-status-value" />
                    <InfoLine label="Provider-Status" value={payment.provider_status} testId="bidblitz-pay-sandbox-provider-status-value" />
                    <InfoLine label="Betrag" value={`${payment.amount.toFixed(2)} ${payment.currency}`} testId="bidblitz-pay-sandbox-amount-value" />
                    <InfoLine label="Order-ID" value={payment.order_id || "—"} testId="bidblitz-pay-sandbox-order-id-value" />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <ActionCard title="Redirect" description="Hosted Checkout / App-/Wallet-Freigabe öffnen" icon={ExternalLink} testId="bidblitz-pay-sandbox-redirect-card" />
                  <ActionCard title="Webhook" description="Provider- und Merchant-Webhook-Struktur aktiv" icon={CheckCircle2} testId="bidblitz-pay-sandbox-webhook-card" />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={handleOpenCheckout} className="rounded-full bg-[linear-gradient(135deg,#00E0FF,#00E89D)] px-5 py-3 text-sm font-black text-[#050816]" data-testid="bidblitz-pay-sandbox-open-hosted-checkout-button">Hosted Checkout</button>
                  <button type="button" onClick={handleRefund} disabled={refundBusy || !["paid", "partially_refunded", "refunded"].includes(payment.status)} className="rounded-full border border-white/10 px-5 py-3 text-sm text-white/70 disabled:opacity-40" data-testid="bidblitz-pay-sandbox-refund-button">{refundBusy ? "Refund..." : "Refund-Struktur testen"}</button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
      <style>{`.input{width:100%;border-radius:18px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);padding:.9rem 1rem;color:white;outline:none}.input::placeholder{color:rgba(255,255,255,.24)}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="mt-4 block text-sm text-white/65">
      <span className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-white/38">{label}</span>
      {children}
    </label>
  );
}

function InfoLine({ label, value, testId }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-1 font-semibold" data-testid={testId}>{value}</p>
    </div>
  );
}

function ActionCard({ title, description, icon: Icon, testId }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4" data-testid={testId}>
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10"><Icon size={18} className="text-[#00E89D]" /></div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-white/50">{description}</p>
    </div>
  );
}