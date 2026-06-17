import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Check, Copy, CreditCard, ExternalLink, FileText, Loader2, QrCode, ShieldCheck, AlertCircle, Wallet, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "../store";
import { api } from "../services/api";

const API = process.env.REACT_APP_BACKEND_URL;

export default function InvoicePayPage({ scanCode, onNavigate }) {
  const user = useUser();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  const paymentToken = invoice?.payment_link?.token || invoice?.payment_link_token || "";
  const paymentLinkUrl = invoice?.payment_link?.public_url || invoice?.payment_link_url || invoice?.public_pay_url || "";
  const shareLinks = invoice?.payment_link?.share_links || {};

  useEffect(() => {
    fetch(`${API}/api/invoicing/public/${scanCode}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.invoice_id || d.scan_code) setInvoice(d);
        else setError(d.detail || "Rechnung nicht gefunden");
      })
      .catch(() => setError("Netzwerkfehler"))
      .finally(() => setLoading(false));
  }, [scanCode]);

  useEffect(() => {
    const sid = new URLSearchParams(window.location.search).get("session_id") || "";
    if (!sid || !paymentToken) return undefined;
    let cancelled = false;
    const run = async () => {
      setPolling(true);
      for (let attempt = 1; attempt <= 6; attempt += 1) {
        try {
          const result = await api.getInvoicePaymentCheckoutStatus(paymentToken, sid);
          if (cancelled) return;
          if (result?.invoice) setInvoice((prev) => ({ ...(prev || {}), ...result.invoice }));
          if (result?.payment_status === "paid") {
            setPaid(true);
            setPolling(false);
            toast.success("Zahlung erfolgreich bestätigt");
            const next = new URL(window.location.href);
            next.searchParams.delete("session_id");
            window.history.replaceState({}, "", next.toString());
            return;
          }
          if (result?.status === "expired" || result?.status === "cancelled") {
            setPolling(false);
            setError("Checkout ist abgelaufen oder abgebrochen");
            return;
          }
        } catch (e) {
          if (cancelled) return;
          if (attempt === 6) {
            setPolling(false);
            setError(e.message || "Zahlungsstatus konnte nicht geladen werden");
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
  }, [paymentToken]);

  const summaryItems = useMemo(() => invoice?.items || [], [invoice]);

  const doLogin = async () => {
    if (!email || !pw) { setError("Bitte E-Mail und Passwort eingeben"); return; }
    setAuthLoading(true);
    setError("");
    try {
      const r = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Login fehlgeschlagen");
      window.location.reload();
    } catch (e) {
      setError(e.message);
    }
    setAuthLoading(false);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(paymentLinkUrl);
      toast.success("Zahlungslink kopiert");
    } catch {
      setError("Link konnte nicht kopiert werden");
    }
  };

  const startStripeCheckout = async () => {
    if (!paymentToken) return;
    setStripeLoading(true);
    setError("");
    try {
      const result = await api.checkoutInvoicePaymentLink(paymentToken, {
        method: "stripe",
        origin_url: window.location.origin,
        payer_email: invoice?.client_email || email,
      });
      if (result?.checkout_url) {
        window.location.href = result.checkout_url;
      }
    } catch (e) {
      setError(e.message);
    }
    setStripeLoading(false);
  };

  const payInvoice = async () => {
    if (!paymentToken) return;
    setWalletLoading(true);
    setPaying(true);
    setError("");
    try {
      const result = await api.checkoutInvoicePaymentLink(paymentToken, {
        method: "wallet",
        origin_url: window.location.origin,
      });
      setInvoice(result.invoice);
      setPaid(true);
      toast.success("Rechnung mit Wallet bezahlt");
    } catch (e) {
      setError(e.message);
    }
    setPaying(false);
    setWalletLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#020408" }}>
        <Loader2 size={28} className="animate-spin text-[#00E89D]" />
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#020408" }}>
        <div className="max-w-sm w-full rounded-2xl p-6 text-center" style={{ background: "rgba(255,71,87,0.05)", border: "1px solid rgba(255,71,87,0.2)" }} data-testid="invoice-pay-error">
          <AlertCircle size={40} className="mx-auto mb-3 text-[#FF4757]" />
          <p className="text-sm text-white/80">{error}</p>
        </div>
      </div>
    );
  }

  const balance = parseFloat(user.balance || 0);
  const total = parseFloat(invoice?.total || 0);
  const insufficient = user.isAuthenticated && balance < total;
  const isAlreadyPaid = invoice?.status === "paid" || paid;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#020408" }} data-testid="invoice-pay-page">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-3xl overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(255,107,107,0.05) 0%, rgba(8,12,20,0.95) 100%)", border: "1px solid rgba(255,107,107,0.15)" }}>
        <div className="px-6 pt-6 pb-4 flex items-center gap-2">
          <button onClick={() => onNavigate("/scan")} className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center" data-testid="invoice-pay-back">
            <ArrowLeft size={14} className="text-white/70" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF6B6B] to-[#FF8E53] flex items-center justify-center">
            <FileText size={14} className="text-[#020408]" />
          </div>
          <span className="text-sm font-black text-white/90">Rechnung bezahlen</span>
          <ShieldCheck size={12} className="ml-auto text-[#FF8E53]/60" />
        </div>

        {isAlreadyPaid ? (
          <div className="px-6 py-12 text-center" data-testid="invoice-pay-success">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00E89D]/15 flex items-center justify-center">
              <Check size={28} className="text-[#00E89D]" />
            </motion.div>
            <h2 className="text-xl font-bold text-white/90 mb-1">Rechnung bezahlt</h2>
            <p className="text-xs text-white/45">{invoice?.invoice_number}</p>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 text-center border-y border-white/[0.04]" data-testid="invoice-pay-summary">
              <p className="text-[10px] uppercase tracking-wider text-white/35 font-bold mb-1">{invoice?.invoice_number || "Rechnung"}</p>
              <p className="text-4xl font-black text-white/95 font-outfit">{total.toFixed(2)} <span className="text-2xl text-white/40">EUR</span></p>
              <p className="text-xs text-white/50 mt-1.5">{invoice?.client_name || "BidBlitz Rechnung"}</p>
              <p className="text-[10px] text-white/30 font-mono mt-1">{invoice?.scan_code}</p>
              {polling && <p className="mt-2 text-[11px] text-cyan-200" data-testid="invoice-pay-status-polling">Zahlung wird geprüft …</p>}
            </div>

            <div className="px-6 py-5 space-y-3">
              <div className="grid grid-cols-2 gap-2" data-testid="invoice-pay-share-actions">
                <button onClick={copyLink} className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-white/80" data-testid="invoice-pay-copy-link-button">
                  <Copy size={14} className="mr-2 inline-block" /> Link kopieren
                </button>
                <button onClick={() => window.open(shareLinks.whatsapp || `https://wa.me/?text=${encodeURIComponent(paymentLinkUrl)}`, "_blank", "noopener,noreferrer")} className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[11px] font-bold text-emerald-100" data-testid="invoice-pay-whatsapp-button">
                  <MessageCircle size={14} className="mr-2 inline-block" /> WhatsApp
                </button>
                <button onClick={() => window.location.href = shareLinks.email || `mailto:?body=${encodeURIComponent(paymentLinkUrl)}`} className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-[11px] font-bold text-cyan-100" data-testid="invoice-pay-email-button">
                  <Mail size={14} className="mr-2 inline-block" /> E-Mail
                </button>
                <button onClick={() => window.open(invoice?.payment_pdf_url ? `${API}${invoice.payment_pdf_url}` : paymentLinkUrl, "_blank", "noopener,noreferrer")} className="rounded-xl border border-orange-400/20 bg-orange-400/10 px-3 py-2 text-[11px] font-bold text-orange-100" data-testid="invoice-pay-pdf-button">
                  <ExternalLink size={14} className="mr-2 inline-block" /> PDF / QR
                </button>
              </div>

              {paymentLinkUrl && (
                <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }} data-testid="invoice-pay-qr-box">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/35 font-bold"><QrCode size={12} className="mr-1 inline-block" />QR & Payment Link</p>
                      <p className="mt-1 text-[11px] text-white/55">Scannen oder direkt öffnen</p>
                    </div>
                    <QRCodeSVG value={paymentLinkUrl} size={86} includeMargin data-testid="invoice-pay-qr-code" />
                  </div>
                </div>
              )}

              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="space-y-2" data-testid="invoice-pay-items">
                  {summaryItems.map((item, idx) => (
                    <div key={`${item.description}-${idx}`} className="flex justify-between gap-3 text-sm">
                      <span className="text-white/75">{item.quantity}× {item.description}</span>
                      <span className="text-white/45">€{Number(item.total || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {!user.isAuthenticated ? (
                <div className="space-y-3" data-testid="invoice-pay-login-box">
                  <p className="text-[11px] text-white/60 text-center mb-2">Stripe funktioniert ohne Login. Für Wallet bitte anmelden.</p>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={startStripeCheckout} disabled={stripeLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00C2FF] to-[#7EE8FA] text-[#020408] font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50" data-testid="invoice-pay-stripe-button-public">
                    {stripeLoading ? <Loader2 size={14} className="animate-spin" /> : <><CreditCard size={14} /> Mit Karte / Apple Pay bezahlen</>}
                  </motion.button>
                  <input type="email" placeholder="E-Mail" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-sm text-white/90 outline-none" data-testid="invoice-pay-email" />
                  <input type="password" placeholder="Passwort" value={pw} onChange={e => setPw(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-sm text-white/90 outline-none" data-testid="invoice-pay-password" />
                  {error && <p className="text-[11px] text-red-400 text-center">{error}</p>}
                  <motion.button whileTap={{ scale: 0.97 }} onClick={doLogin} disabled={authLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] text-[#020408] font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50" data-testid="invoice-pay-login-btn">
                    {authLoading ? <Loader2 size={14} className="animate-spin" /> : "Anmelden & bezahlen"}
                  </motion.button>
                </div>
              ) : (
                <div className="space-y-3" data-testid="invoice-pay-wallet-box">
                  <motion.button whileTap={{ scale: 0.97 }} onClick={startStripeCheckout} disabled={stripeLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00C2FF] to-[#7EE8FA] text-[#020408] font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50" data-testid="invoice-pay-stripe-button-authenticated">
                    {stripeLoading ? <Loader2 size={14} className="animate-spin" /> : <><CreditCard size={14} /> Mit Karte / Apple Pay bezahlen</>}
                  </motion.button>
                  <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: "rgba(0,232,157,0.04)", border: "1px solid rgba(0,232,157,0.1)" }}>
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider font-bold"><Wallet size={12} className="mr-1 inline-block" />Dein Wallet</p>
                      <p className="text-lg font-black text-[#00E89D]">€{balance.toFixed(2)}</p>
                    </div>
                    {insufficient ? (
                      <span className="text-[10px] px-2 py-1 rounded bg-red-500/15 text-red-400 font-bold">Unzureichend</span>
                    ) : (
                      <span className="text-[10px] px-2 py-1 rounded bg-[#00E89D]/15 text-[#00E89D] font-bold">Nach Zahlung: €{(balance - total).toFixed(2)}</span>
                    )}
                  </div>
                  {error && <p className="text-[11px] text-red-400 text-center">{error}</p>}
                  <motion.button whileTap={{ scale: 0.97 }} onClick={payInvoice} disabled={walletLoading || insufficient} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] text-[#020408] font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40" data-testid="invoice-pay-confirm-btn">
                    {walletLoading ? <Loader2 size={14} className="animate-spin" /> : `Mit Wallet ${total.toFixed(2)} EUR bezahlen`}
                  </motion.button>
                  {insufficient && <p className="text-[10px] text-white/40 text-center">Lade dein Wallet auf, um fortzufahren</p>}
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}