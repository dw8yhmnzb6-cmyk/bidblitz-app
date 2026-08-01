import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, CircleSlash2, Loader2, RotateCcw } from "lucide-react";
import { api } from "../services/api";

export default function BidBlitzPayResultPage({ variant = "success", paymentId = "", onNavigate }) {
  const [loading, setLoading] = useState(Boolean(paymentId));
  const [payment, setPayment] = useState(null);

  useEffect(() => {
    if (!paymentId) {
      setLoading(false);
      return;
    }
    let alive = true;
    api.getBidBlitzPayPayment(paymentId)
      .then((data) => {
        if (alive) setPayment(data.payment);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [paymentId]);

  const isSuccess = variant === "success";
  const icon = isSuccess ? CheckCircle2 : CircleSlash2;
  const Icon = icon;
  const tone = isSuccess ? "#00E89D" : "#FF6B6B";

  return (
    <div className="min-h-screen bg-[#050816] px-4 py-10 text-white" data-testid={`bidblitz-pay-${variant}-page`}>
      <div className="mx-auto max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-8 text-center"
        >
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full" style={{ background: `${tone}18` }}>
            <Icon size={36} style={{ color: tone }} />
          </div>
          <h1 className="text-3xl font-black" data-testid={`bidblitz-pay-${variant}-title`}>
            {isSuccess ? "Zahlung erfolgreich" : "Zahlung abgebrochen"}
          </h1>
          <p className="mt-3 text-sm text-white/60" data-testid={`bidblitz-pay-${variant}-subtitle`}>
            {isSuccess
              ? "Die BidBlitz-Pay-Freigabe wurde abgeschlossen und der Status ist synchronisiert."
              : "Die BidBlitz-Pay-Freigabe wurde nicht abgeschlossen. Du kannst den Checkout jederzeit erneut starten."}
          </p>

          {loading ? (
            <div className="mt-6 flex items-center justify-center"><Loader2 className="animate-spin text-[#00E89D]" size={24} /></div>
          ) : payment ? (
            <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5 text-left" data-testid={`bidblitz-pay-${variant}-summary`}>
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Transaktionsübersicht</p>
              <dl className="mt-4 space-y-2 text-sm text-white/70">
                <div className="flex justify-between gap-3"><dt>Payment-ID</dt><dd className="font-mono text-xs">{payment.payment_id}</dd></div>
                <div className="flex justify-between gap-3"><dt>Status</dt><dd className="font-semibold">{payment.status}</dd></div>
                <div className="flex justify-between gap-3"><dt>Betrag</dt><dd className="font-semibold">{payment.amount.toFixed(2)} {payment.currency}</dd></div>
                {payment.order_id ? <div className="flex justify-between gap-3"><dt>Bestellung</dt><dd>{payment.order_id}</dd></div> : null}
              </dl>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate("/pay/docs")}
              className="rounded-full bg-[linear-gradient(135deg,#00E0FF,#00E89D)] px-5 py-3 text-sm font-black text-[#050816]"
              data-testid={`bidblitz-pay-${variant}-docs-button`}
            >
              Zur Doku
            </button>
            <button
              type="button"
              onClick={() => onNavigate("/bidblitz-pay/sandbox")}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm text-white/70"
              data-testid={`bidblitz-pay-${variant}-retry-button`}
            >
              <RotateCcw size={14} /> Sandbox öffnen
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}