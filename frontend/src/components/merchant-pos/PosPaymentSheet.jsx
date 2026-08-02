import { AlertTriangle, CheckCircle2, CreditCard, Mail, Printer, QrCode, Receipt, Smartphone, Wallet, XCircle } from "lucide-react";
import { Button } from "../ui/button";

const STATE_STYLES = {
  ready: "text-white",
  awaiting: "text-cyan-100",
  processing: "text-white",
  success: "text-emerald-100",
  failure: "text-rose-100",
  connection_lost: "text-amber-100",
  review: "text-amber-100",
};

const ICONS = {
  cash: Receipt,
  card: CreditCard,
  tap_to_pay: Smartphone,
  wallet: Wallet,
  qr: QrCode,
  voucher: Receipt,
  invoice: Receipt,
};

function ReceiptAction({ icon: Icon, label, onClick, testId }) {
  return <button onClick={onClick} className="flex min-h-12 items-center gap-3 rounded-[20px] border border-white/10 bg-[#071019] px-4 py-3 text-sm font-bold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" data-testid={testId}><Icon size={16} aria-hidden="true" />{label}</button>;
}

export const PosPaymentSheet = ({ copy, methods, paymentState, busy, onClose, onMethodSelect, onRetry, onUseOtherMethod, onCancel, onCheckStatus, onNewSale, onReceiptAction }) => (
  <div className="fixed inset-0 z-[80] bg-black/70 p-4" data-testid="merchant-pos-payment-sheet">
    <div className="mx-auto flex min-h-full max-w-2xl items-end justify-center sm:items-center">
      <div className="w-full rounded-[32px] border border-white/10 bg-[#030507] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-white">{copy.pay}</h2>
            <p className="mt-2 text-sm text-white/62">{copy.choosePayment}</p>
          </div>
          <Button onClick={onClose} variant="outline" className="min-h-12 border-white/10 bg-white/5 text-white" data-testid="merchant-pos-payment-close-button">{copy.cancel}</Button>
        </div>

        {paymentState?.stage === "success" ? (
          <div className="mt-5 rounded-[28px] border border-emerald-400/20 bg-emerald-400/10 p-5" data-testid="merchant-pos-payment-success-state">
            <div className="flex items-center gap-3 text-emerald-100"><CheckCircle2 size={28} aria-hidden="true" /><div className="text-2xl font-black">{copy.success}</div></div>
            <p className="mt-3 text-sm text-emerald-50/90">{copy.thankYou}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Meta label={copy.amount} value={`${Number(paymentState.amount || 0).toFixed(2)} €`} testId="merchant-pos-success-amount" />
              <Meta label={copy.paymentMethod} value={paymentState.methodLabel} testId="merchant-pos-success-method" />
              <Meta label={copy.receiptNumber} value={paymentState.receiptId || "-"} testId="merchant-pos-success-receipt" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ReceiptAction icon={Printer} label={copy.print} onClick={() => onReceiptAction("print")} testId="merchant-pos-success-print-button" />
              <ReceiptAction icon={Mail} label={copy.email} onClick={() => onReceiptAction("email")} testId="merchant-pos-success-email-button" />
              <ReceiptAction icon={QrCode} label={copy.qrReceipt} onClick={() => onReceiptAction("qr")} testId="merchant-pos-success-qr-button" />
              <ReceiptAction icon={Receipt} label={copy.noReceipt} onClick={() => onReceiptAction("none")} testId="merchant-pos-success-no-receipt-button" />
            </div>
            <div className="mt-5">
              <Button onClick={onNewSale} className="min-h-14 w-full rounded-full bg-[#06B6D4] text-lg font-black text-black" data-testid="merchant-pos-success-new-sale-button">{copy.newSale}</Button>
            </div>
          </div>
        ) : paymentState?.stage === "failure" ? (
          <div className="mt-5 rounded-[28px] border border-rose-400/20 bg-rose-400/10 p-5" data-testid="merchant-pos-payment-failure-state">
            <div className="flex items-center gap-3 text-rose-100"><XCircle size={28} aria-hidden="true" /><div className="text-2xl font-black">{copy.failedTitle}</div></div>
            <p className="mt-3 text-sm text-rose-50/90">{copy.failedText}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Button onClick={onRetry} className="min-h-12 bg-[#06B6D4] text-black" data-testid="merchant-pos-failure-retry-button">{copy.retry}</Button>
              <Button onClick={onUseOtherMethod} variant="outline" className="min-h-12 border-white/10 bg-white/5 text-white" data-testid="merchant-pos-failure-other-method-button">{copy.otherMethod}</Button>
              <Button onClick={onCancel} variant="outline" className="min-h-12 border-white/10 bg-white/5 text-white" data-testid="merchant-pos-failure-cancel-button">{copy.cancel}</Button>
            </div>
          </div>
        ) : paymentState?.stage === "review" ? (
          <div className="mt-5 rounded-[28px] border border-amber-400/20 bg-amber-400/10 p-5" data-testid="merchant-pos-payment-review-state">
            <div className="flex items-center gap-3 text-amber-100"><AlertTriangle size={28} aria-hidden="true" /><div className="text-2xl font-black">{copy.reviewing}</div></div>
            <p className="mt-3 text-sm text-amber-50/90">{copy.doNotRepay}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Button onClick={onCheckStatus} className="min-h-12 bg-[#06B6D4] text-black" data-testid="merchant-pos-review-check-status-button">{copy.checkStatus}</Button>
              <Button onClick={onClose} variant="outline" className="min-h-12 border-white/10 bg-white/5 text-white" data-testid="merchant-pos-review-call-manager-button">{copy.callManager}</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2" data-testid="merchant-pos-payment-methods-grid">
              {methods.map((method, index) => {
                const Icon = ICONS[method.key] || Receipt;
                return (
                  <button
                    key={method.key}
                    onClick={() => method.enabled && onMethodSelect(method)}
                    disabled={!method.enabled || busy}
                    className={`rounded-[24px] border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${method.enabled ? "border-white/10 bg-[#071019] text-white hover:border-cyan-400/30" : "cursor-not-allowed border-white/10 bg-[#0A1118] text-white/46"}`}
                    data-testid={`merchant-pos-payment-method-${index + 1}`}
                    aria-disabled={!method.enabled}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border ${method.enabled ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/5 text-white/40"}`}><Icon size={18} aria-hidden="true" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-black">{method.label}</div>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${method.enabled ? "bg-emerald-400/12 text-emerald-100" : "bg-white/5 text-white/52"}`}>{method.enabled ? copy.active : copy.unavailable}</span>
                        </div>
                        <p className="mt-2 text-sm text-white/58">{method.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 rounded-[22px] border border-white/10 bg-white/5 p-4" data-testid="merchant-pos-payment-state-panel" role="status" aria-live="assertive" aria-label={copy.statusAnnouncement}>
              <div className={`text-lg font-black ${STATE_STYLES[paymentState?.stage || "ready"] || "text-white"}`}>{paymentState?.headline || copy.choosePayment}</div>
              <div className="mt-2 break-words text-sm text-white/62">{paymentState?.description || copy.holdCard}</div>
            </div>
          </>
        )}
      </div>
    </div>
  </div>
);

function Meta({ label, value, testId }) {
  return <div className="rounded-[20px] border border-white/10 bg-[#071019] p-4" data-testid={testId}><div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#82E7FF]">{label}</div><div className="mt-2 text-lg font-black text-white">{value}</div></div>;
}