import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { AlertCircle, ArrowLeft, CheckCircle2, Copy, CreditCard, ExternalLink, Loader2, Mail, MessageCircle, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { useUser } from "../store";

export default function PublicInvoicePaymentPage({ token, onNavigate }) {
  const user = useUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stripeLoading, setStripeLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const result = await api.getPublicInvoicePaymentLink(token);
        if (!cancelled) {
          setData(result);
          setError("");
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Zahlungslink nicht gefunden");
      }
      if (!cancelled) setLoading(false);

      const sessionId = new URLSearchParams(window.location.search).get("session_id") || "";
      if (!sessionId) return;
      setPolling(true);
      for (let attempt = 1; attempt <= 6; attempt += 1) {
        try {
          const result = await api.getInvoicePaymentCheckoutStatus(token, sessionId);
          if (cancelled) return;
          if (result?.invoice) setData((prev) => ({ ...(prev || {}), ...result.invoice }));
          if (result?.payment_status === "paid") {
            toast.success("Rechnung erfolgreich bezahlt");
            setPolling(false);
            const next = new URL(window.location.href);
            next.searchParams.delete("session_id");
            window.history.replaceState({}, "", next.toString());
            return;
          }
        } catch {
          if (cancelled) return;
          if (attempt === 6) {
            setPolling(false);
            return;
          }
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        if (cancelled) return;
      }
      setPolling(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const total = useMemo(() => Number(data?.total || 0), [data]);
  const isPaid = data?.status === "paid";
  const paymentLink = data?.payment_link?.public_url || data?.payment_link_url || window.location.href;
  const shareLinks = data?.payment_link?.share_links || {};
  const balance = Number(user?.balance || 0);
  const insufficient = user?.isAuthenticated && balance < total;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(paymentLink);
      toast.success("Zahlungslink kopiert");
    } catch {
      setError("Link konnte nicht kopiert werden");
    }
  };

  const startStripe = async () => {
    setStripeLoading(true);
    setError("");
    try {
      const result = await api.checkoutInvoicePaymentLink(token, {
        method: "stripe",
        origin_url: window.location.origin,
        payer_email: data?.client_email || "",
      });
      window.location.href = result.checkout_url;
    } catch (e) {
      setError(e.message || "Stripe Checkout fehlgeschlagen");
    }
    setStripeLoading(false);
  };

  const payWithWallet = async () => {
    setWalletLoading(true);
    setError("");
    try {
      const result = await api.checkoutInvoicePaymentLink(token, {
        method: "wallet",
        origin_url: window.location.origin,
      });
      setData((prev) => ({ ...(prev || {}), ...(result.invoice || {}) }));
      toast.success("Mit Wallet bezahlt");
    } catch (e) {
      setError(e.message || "Wallet-Zahlung fehlgeschlagen");
    }
    setWalletLoading(false);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#05070B]" data-testid="public-invoice-payment-loading"><Loader2 size={26} className="animate-spin text-white/50" /></div>;
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05070B] p-4" data-testid="public-invoice-payment-error-state">
        <div className="w-full max-w-md rounded-[28px] border border-rose-400/25 bg-rose-500/10 p-6 text-center text-white/90">
          <AlertCircle size={30} className="mx-auto mb-3 text-rose-200" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070B] text-white p-4 sm:p-6" data-testid="public-invoice-payment-page">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => onNavigate("/")} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5" data-testid="public-invoice-payment-back-button"><ArrowLeft size={18} /></button>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">BidBlitz Smart Invoice</p>
            <h1 className="text-3xl font-black" data-testid="public-invoice-payment-title">Sicher bezahlen</h1>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5 sm:p-6" data-testid="public-invoice-payment-main-card">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/40">{data?.invoice_number}</p>
                <h2 className="mt-2 text-2xl font-black">{data?.client_name}</h2>
                <p className="mt-1 text-sm text-white/55">Empfänger: {data?.merchant_name || "BidBlitz Merchant"}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-4xl font-black text-[#FFCF8B]" data-testid="public-invoice-payment-total">€{total.toFixed(2)}</p>
                <p className="mt-1 text-sm text-white/45">Fällig {String(data?.due_at || "").slice(0, 10) || "—"}</p>
                {polling && <p className="mt-2 text-xs text-cyan-200" data-testid="public-invoice-payment-polling">Status wird aktualisiert …</p>}
              </div>
            </div>

            {isPaid ? (
              <div className="py-14 text-center" data-testid="public-invoice-payment-success-state">
                <CheckCircle2 size={48} className="mx-auto text-emerald-300" />
                <h3 className="mt-4 text-2xl font-black">Bereits bezahlt</h3>
                <p className="mt-2 text-sm text-white/55">Diese Rechnung ist abgeschlossen.</p>
              </div>
            ) : (
              <>
                <div className="mt-5 rounded-[24px] border border-white/10 bg-black/20 p-4" data-testid="public-invoice-payment-items">
                  {(data?.items || []).map((item, index) => (
                    <div key={`${item.description}-${index}`} className="flex items-center justify-between gap-3 border-b border-white/5 py-2 last:border-b-0">
                      <span className="text-sm text-white/75">{item.quantity} × {item.description}</span>
                      <span className="text-sm font-semibold text-white/90">€{Number(item.total || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2" data-testid="public-invoice-payment-methods">
                  <button onClick={startStripe} disabled={stripeLoading} className="rounded-[24px] border border-cyan-400/20 bg-cyan-400/12 p-4 text-left disabled:opacity-50" data-testid="public-invoice-payment-stripe-button">
                    <CreditCard size={18} className="text-cyan-100" />
                    <p className="mt-3 text-lg font-black">Karte / Apple Pay</p>
                    <p className="mt-1 text-sm text-white/55">Ohne Login, sichere Stripe Checkout-Seite.</p>
                    <div className="mt-4 text-xs font-bold text-cyan-100">{stripeLoading ? <Loader2 size={14} className="animate-spin" /> : "Jetzt starten"}</div>
                  </button>

                  <button onClick={payWithWallet} disabled={!user?.isAuthenticated || insufficient || walletLoading} className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/12 p-4 text-left disabled:opacity-40" data-testid="public-invoice-payment-wallet-button">
                    <Wallet size={18} className="text-emerald-100" />
                    <p className="mt-3 text-lg font-black">BidBlitz Wallet</p>
                    <p className="mt-1 text-sm text-white/55">{user?.isAuthenticated ? `Verfügbar: €${balance.toFixed(2)}` : "Bitte anmelden, um dein Wallet zu nutzen."}</p>
                    <div className="mt-4 text-xs font-bold text-emerald-100">{walletLoading ? <Loader2 size={14} className="animate-spin" /> : (user?.isAuthenticated ? "Mit Wallet bezahlen" : "Login erforderlich")}</div>
                  </button>
                </div>

                {error && <p className="mt-4 text-sm text-rose-200" data-testid="public-invoice-payment-error">{error}</p>}
                {!user?.isAuthenticated && <p className="mt-3 text-xs text-white/45">Wallet-Zahlung ist nur nach Login verfügbar. Kartenzahlung funktioniert ohne Login.</p>}
              </>
            )}
          </motion.section>

          <motion.aside initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="space-y-4">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5" data-testid="public-invoice-payment-qr-card">
              <div className="flex items-center gap-2 text-sm font-bold text-white"><ShieldCheck size={16} className="text-cyan-200" /> Sicherer Zahlungslink</div>
              <div className="mt-4 flex justify-center rounded-[24px] bg-white p-4">
                <QRCodeSVG value={paymentLink} size={190} includeMargin data-testid="public-invoice-payment-qr-code" />
              </div>
              <p className="mt-4 break-all text-xs text-white/50">{paymentLink}</p>
              <button onClick={copyLink} className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/80" data-testid="public-invoice-payment-copy-link"> <Copy size={14} className="mr-2 inline-block" /> Link kopieren</button>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5" data-testid="public-invoice-payment-share-card">
              <p className="text-sm font-bold text-white">Senden & teilen</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => window.open(shareLinks.whatsapp || `https://wa.me/?text=${encodeURIComponent(paymentLink)}`, "_blank", "noopener,noreferrer")} className="rounded-2xl border border-emerald-400/20 bg-emerald-400/12 px-3 py-3 text-xs font-bold text-emerald-100" data-testid="public-invoice-payment-share-whatsapp"><MessageCircle size={14} className="mb-1" /> WhatsApp</button>
                <button onClick={() => { window.location.href = shareLinks.email || `mailto:?body=${encodeURIComponent(paymentLink)}`; }} className="rounded-2xl border border-cyan-400/20 bg-cyan-400/12 px-3 py-3 text-xs font-bold text-cyan-100" data-testid="public-invoice-payment-share-email"><Mail size={14} className="mb-1" /> E-Mail</button>
                <button onClick={() => window.open(data?.payment_pdf_url ? `${process.env.REACT_APP_BACKEND_URL}${data.payment_pdf_url}` : paymentLink, "_blank", "noopener,noreferrer")} className="rounded-2xl border border-orange-400/20 bg-orange-400/12 px-3 py-3 text-xs font-bold text-orange-100" data-testid="public-invoice-payment-share-pdf"><ExternalLink size={14} className="mb-1" /> PDF</button>
                <button onClick={() => onNavigate("/login")} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-bold text-white/75" data-testid="public-invoice-payment-login-link"><Wallet size={14} className="mb-1" /> Wallet Login</button>
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}