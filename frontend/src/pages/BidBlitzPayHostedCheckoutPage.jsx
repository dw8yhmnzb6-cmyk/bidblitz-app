import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Smartphone, Wallet, XCircle, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { useUser } from "../store";

const statusTone = {
  pending: "#FFB800",
  paid: "#00E89D",
  cancelled: "#FF6B6B",
  refunded: "#00C2FF",
  partially_refunded: "#00C2FF",
};

export default function BidBlitzPayHostedCheckoutPage({ paymentId, onNavigate }) {
  const user = useUser();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getBidBlitzPayPayment(paymentId);
      setPayment(data.payment);
    } catch (err) {
      setError(err.message || "BidBlitz-Pay-Zahlung konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [paymentId]);

  useEffect(() => {
    if (!payment || loading) return;
    if (payment.status === "paid") {
      const next = payment.success_url || `/bidblitz-pay/success?payment_id=${encodeURIComponent(payment.payment_id)}`;
      const timer = window.setTimeout(() => {
        if (next.startsWith("http")) {
          window.location.href = next;
          return;
        }
        onNavigate(next);
      }, 1200);
      return () => window.clearTimeout(timer);
    }
    if (payment.status === "cancelled") {
      const next = payment.cancel_url || `/bidblitz-pay/cancel?payment_id=${encodeURIComponent(payment.payment_id)}`;
      const timer = window.setTimeout(() => {
        if (next.startsWith("http")) {
          window.location.href = next;
          return;
        }
        onNavigate(next);
      }, 1200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [payment, loading, onNavigate]);

  const modeLabel = useMemo(() => (payment?.test_mode ? "Sandbox / MOCKED" : "Live"), [payment]);

  const handleApprove = async () => {
    if (!payment) return;
    setBusy(true);
    setError("");
    try {
      const data = await api.confirmBidBlitzPayMock(payment.payment_id, { approval_method: "wallet_release" });
      setPayment(data.payment);
      toast.success("Wallet-Freigabe simuliert.");
    } catch (err) {
      setError(err.message || "Freigabe fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!payment) return;
    setBusy(true);
    setError("");
    try {
      const data = await api.cancelBidBlitzPayPayment(payment.payment_id);
      setPayment(data.payment);
      toast.success("Zahlung abgebrochen.");
    } catch (err) {
      setError(err.message || "Abbruch fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const openApp = () => {
    if (!payment?.app_redirect_url) return;
    window.location.href = payment.app_redirect_url;
    toast.message("BidBlitz-Pay-App wird geöffnet. Fallback bleibt im Wallet.");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050816]" data-testid="bidblitz-pay-hosted-loading">
        <Loader2 className="animate-spin text-[#00E89D]" size={28} />
      </div>
    );
  }

  if (error && !payment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050816] px-4" data-testid="bidblitz-pay-hosted-error">
        <div className="max-w-md w-full rounded-3xl border border-red-500/20 bg-red-500/5 p-6 text-center text-white/80">
          <XCircle className="mx-auto mb-3 text-red-400" size={34} />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const tone = statusTone[payment?.status] || "#FFB800";

  return (
    <div className="min-h-screen bg-[#050816] px-4 py-10 text-white" data-testid="bidblitz-pay-hosted-page">
      <div className="mx-auto max-w-xl space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6"
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#00E0FF,#00E89D)]">
              <Wallet className="text-[#050816]" size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.25em] text-white/45">BidBlitz Pay</p>
              <h1 className="truncate text-2xl font-black" data-testid="bidblitz-pay-hosted-title">Wallet-/App-Freigabe</h1>
            </div>
            <span
              className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ background: `${tone}18`, color: tone }}
              data-testid="bidblitz-pay-hosted-status-badge"
            >
              {payment.status}
            </span>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-center">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Zu zahlender Betrag</p>
            <p className="mt-2 text-5xl font-black" data-testid="bidblitz-pay-hosted-amount">
              {payment.amount.toFixed(2)} <span className="text-2xl text-white/45">{payment.currency}</span>
            </p>
            <p className="mt-3 text-sm text-white/60" data-testid="bidblitz-pay-hosted-description">{payment.description || "BidBlitz-Pay-Checkout"}</p>
            {payment.order_id ? <p className="mt-1 text-xs text-white/35">Bestellung: {payment.order_id}</p> : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={openApp}
              className="rounded-2xl border border-[#00C2FF]/30 bg-[#00C2FF]/10 px-4 py-4 text-left transition hover:bg-[#00C2FF]/15"
              data-testid="bidblitz-pay-open-app-button"
            >
              <div className="mb-2 flex items-center gap-2 text-[#00C2FF]"><Smartphone size={16} /> In BidBlitz-Pay-App öffnen</div>
              <p className="text-sm text-white/60">Deep-Link vorbereitet. Fallback bleibt auf dieser Seite.</p>
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={busy || payment.status !== "pending" || !user.isAuthenticated}
              className="rounded-2xl border border-[#00E89D]/30 bg-[#00E89D]/10 px-4 py-4 text-left transition hover:bg-[#00E89D]/15 disabled:opacity-50"
              data-testid="bidblitz-pay-wallet-approve-button"
            >
              <div className="mb-2 flex items-center gap-2 text-[#00E89D]"><ShieldCheck size={16} /> Im Wallet freigeben</div>
              <p className="text-sm text-white/60">Sandbox-Freigabe aus dem Wallet/App-Kontext.</p>
            </button>
          </div>

          {!user.isAuthenticated && payment.status === "pending" ? (
            <div className="mt-4 rounded-2xl border border-[#FFB800]/20 bg-[#FFB800]/8 p-3 text-sm text-white/70" data-testid="bidblitz-pay-hosted-login-note">
              Bitte zuerst einloggen, damit die Wallet-Freigabe verfügbar ist.
            </div>
          ) : null}

          {error ? <p className="mt-4 text-sm text-red-400" data-testid="bidblitz-pay-hosted-error-text">{error}</p> : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy || payment.status !== "pending"}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/65 disabled:opacity-50"
              data-testid="bidblitz-pay-cancel-button"
            >
              Zahlung abbrechen
            </button>
            {payment.redirect_url ? (
              <a
                href={payment.redirect_url}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/65"
                data-testid="bidblitz-pay-redirect-link"
              >
                Redirect-URL <ExternalLink size={14} />
              </a>
            ) : null}
          </div>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5" data-testid="bidblitz-pay-hosted-meta-card">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Checkout-Status</p>
            <dl className="mt-4 space-y-2 text-sm text-white/70">
              <div className="flex justify-between gap-3"><dt>Modus</dt><dd className="font-semibold">{modeLabel}</dd></div>
              <div className="flex justify-between gap-3"><dt>Provider-Status</dt><dd className="font-semibold">{payment.provider_status}</dd></div>
              <div className="flex justify-between gap-3"><dt>Payment-ID</dt><dd className="font-mono text-xs">{payment.payment_id}</dd></div>
            </dl>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5" data-testid="bidblitz-pay-hosted-mock-note">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Sandbox-Hinweis</p>
            <div className="mt-4 flex items-start gap-3 text-sm text-white/70">
              <CheckCircle2 className="mt-0.5 text-[#00E89D]" size={18} />
              <p>Diese Wallet-/App-Freigabe ist aktuell <strong>MOCKED</strong>. Echte Zugangsdaten können später nur per Environment-Variablen ergänzt werden.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}