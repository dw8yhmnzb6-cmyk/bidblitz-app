import { Copy, ExternalLink, FileCode2, KeyRound, Webhook } from "lucide-react";
import { motion } from "framer-motion";

const API = process.env.REACT_APP_BACKEND_URL;

function CopyBlock({ title, code, testId }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-testid={testId}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">{title}</p>
        <button onClick={() => navigator.clipboard.writeText(code)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-[10px] text-white/65" data-testid={`${testId}-copy`}>
          <Copy size={11} /> Copy
        </button>
      </div>
      <pre className="text-[11px] leading-relaxed text-[#8EF0FF] font-mono whitespace-pre-wrap break-all">{code}</pre>
    </div>
  );
}

export default function PayDeveloperDocsPage() {
  const sdkSnippet = `<script src="${API}/api/pay.js"></script>
<div id="bidblitz-pay"></div>
<script>
  BidBlitzPay.mount("#bidblitz-pay", {
    publicKey: "pk_live_xxx",
    amount: 49.90,
    currency: "EUR",
    orderId: "BID-TAX-1001",
    description: "Rechnung #1001",
    successUrl: window.location.origin + "/thanks",
    cancelUrl: window.location.origin + "/cancel",
    webhookUrl: window.location.origin + "/api/bidblitz-webhook",
    onSuccess: (data) => console.log("paid", data),
    onCancel: (data) => console.log("cancelled", data)
  });
</script>`;

  const sessionExample = `POST ${API}/api/pay/session
{
  "public_key": "pk_live_xxx",
  "amount": 49.90,
  "currency": "EUR",
  "order_id": "BID-TAX-1001",
  "description": "Rechnung #1001",
  "success_url": "https://bid-tax.com/thanks",
  "cancel_url": "https://bid-tax.com/cancel",
  "webhook_url": "https://bid-tax.com/api/bidblitz-webhook",
  "customer_email": "kunde@example.com",
  "metadata": { "source": "bid-tax.com" }
}`;

  const webhookExample = `Header: X-BidBlitz-Signature

Payload:
{
  "event": "session.paid",
  "session_id": "cs_xxx",
  "amount": 49.90,
  "currency": "EUR",
  "order_id": "BID-TAX-1001",
  "transaction_id": "tx_xxx",
  "paid_at": "2026-05-20T12:00:00Z",
  "customer_email": "kunde@example.com"
}`;

  return (
    <div className="min-h-screen bg-[#050816] text-white px-4 py-8" data-testid="pay-developer-docs-page">
      <div className="max-w-5xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-[#00E89D]/15 bg-[radial-gradient(circle_at_top_left,rgba(0,224,255,0.10),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.02))] p-6">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E89D]/10 border border-[#00E89D]/20 text-[#00E89D] text-[11px] font-semibold"><FileCode2 size={12} /> BidBlitz Pay API / SDK</span>
            <a href={`${API}/api/pay.js`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-white/70 text-[11px]" data-testid="pay-docs-sdk-link"><ExternalLink size={12} /> pay.js öffnen</a>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black mb-2">BidBlitz Pay für externe Websites</h1>
          <p className="text-sm text-white/60 max-w-3xl">Für `bid-tax.com`: eingebetteter Checkout, Public API, API-Key-Flow und Webhooks.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-testid="pay-docs-step-keys"><div className="w-10 h-10 rounded-xl bg-[#00E89D]/12 flex items-center justify-center mb-3"><KeyRound size={18} className="text-[#00E89D]" /></div><p className="font-semibold mb-1">1. API Keys</p><p className="text-[12px] text-white/55">`pk_live_xxx` im Frontend, `sk_live_xxx` nur serverseitig.</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-testid="pay-docs-step-checkout"><div className="w-10 h-10 rounded-xl bg-[#00C2FF]/12 flex items-center justify-center mb-3"><FileCode2 size={18} className="text-[#00C2FF]" /></div><p className="font-semibold mb-1">2. Session / Embed</p><p className="text-[12px] text-white/55">Erstelle eine Session und öffne den Checkout mit `BidBlitzPay.mount(...)`.</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-testid="pay-docs-step-webhook"><div className="w-10 h-10 rounded-xl bg-[#FFB800]/12 flex items-center justify-center mb-3"><Webhook size={18} className="text-[#FFB800]" /></div><p className="font-semibold mb-1">3. Webhook</p><p className="text-[12px] text-white/55">Nach erfolgreicher Zahlung sendet BidBlitz Pay ein signiertes `session.paid` Event.</p></div>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-[#00C2FF]/15 bg-[linear-gradient(135deg,rgba(0,194,255,0.08),rgba(255,255,255,0.02))] p-6" data-testid="pay-docs-sandbox-card">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00C2FF]/10 border border-[#00C2FF]/20 text-[#8EF0FF] text-[11px] font-semibold">Sandbox / Redirect / Webhook</span>
            <a href="/bidblitz-pay/sandbox" className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-white/70 text-[11px]" data-testid="pay-docs-sandbox-link"><ExternalLink size={12} /> Sandbox öffnen</a>
          </div>
          <h2 className="text-2xl font-black mb-2">Neue BidBlitz-Pay-Gateway-Struktur</h2>
          <p className="text-sm text-white/60 max-w-3xl">Mock-/Sandbox-First mit Environment-Variablen für API-URL, API-Key, Merchant-ID und Webhook-Secret. Enthält Zahlung starten, Redirect, Wallet-/App-Freigabe, Status, Success/Cancel, Refund-Struktur, Idempotency und Audit-Logs.</p>
        </motion.div>

        <CopyBlock title="Frontend Embed" code={sdkSnippet} testId="pay-docs-sdk-snippet" />
        <CopyBlock title="Session API Beispiel" code={sessionExample} testId="pay-docs-session-snippet" />
        <CopyBlock title="Webhook Payload / Signatur" code={webhookExample} testId="pay-docs-webhook-snippet" />
      </div>
    </div>
  );
}