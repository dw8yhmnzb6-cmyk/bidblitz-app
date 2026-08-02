import { useEffect, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { MetricCard } from "../components/merchant-settlement/MetricCard";
import { SectionCard } from "../components/merchant-settlement/SectionCard";

const money = (minor) => `${(Number(minor || 0) / 100).toFixed(2)} €`;

export default function MerchantSettlementDetailPage({ onBack, settlementId }) {
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!settlementId) return;
    api.getMerchantSettlementDetail(settlementId).then(setDetail).catch((error) => toast.error(error.message || "Settlement konnte nicht geladen werden."));
  }, [settlementId]);

  const finaliseSettlement = async () => {
    setBusy(true);
    try {
      const result = await api.finaliseMerchantSettlement(settlementId, { idempotency_key: `detail-finalise-${Date.now()}` });
      setDetail((current) => ({ ...(current || {}), ...(result?.settlement || {}) }));
      toast.success("Settlement finalisiert.");
    } catch (error) {
      toast.error(error.message || "Settlement konnte nicht finalisiert werden.");
    } finally {
      setBusy(false);
    }
  };

  if (!detail) return <div className="min-h-screen bg-[#030507]" data-testid="merchant-settlement-detail-loading" />;

  return (
    <div className="min-h-screen bg-[#030507] px-4 py-5 sm:px-5 lg:px-8" data-testid="merchant-settlement-detail-page">
      <div className="mx-auto max-w-6xl space-y-5 pb-24">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="merchant-settlement-detail-back-button"><ArrowLeft size={18} /></button>
            <div>
              <h1 className="text-3xl font-black text-white">{detail.settlement_id}</h1>
              <p className="text-sm text-white/60">{detail.period_start?.slice(0, 10)} bis {detail.period_end?.slice(0, 10)} · {detail.status}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {detail.status === "open" ? <button onClick={finaliseSettlement} disabled={busy} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#06B6D4] px-4 py-3 text-sm font-bold text-black disabled:opacity-50" data-testid="merchant-settlement-detail-finalise-button">Settlement finalisieren</button> : null}
            <button onClick={() => api.exportMerchantSettlementCsv(detail.settlement_id)} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white" data-testid="merchant-settlement-detail-export-button"><Download size={16} />CSV Export</button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Brutto" value={money(detail.gross_sales_minor)} testId="merchant-settlement-detail-gross" />
          <MetricCard label="Refunds" value={money(detail.refunds_minor)} tone="warning" testId="merchant-settlement-detail-refunds" />
          <MetricCard label="Gebühren" value={money((detail.payment_fees_minor || 0) + (detail.platform_fees_minor || 0))} tone="warning" testId="merchant-settlement-detail-fees" />
          <MetricCard label="Netto" value={money(detail.net_amount_minor)} tone="success" testId="merchant-settlement-detail-net" />
        </div>
        <SectionCard title="Settlement-Details" subtitle="Transaktionen, Gebühren, Reserve und Auszahlung" testId="merchant-settlement-detail-summary">
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Rabatte" value={money(detail.discounts_minor)} testId="merchant-settlement-detail-discounts" />
            <MetricCard label="Steuer" value={money(detail.tax_minor)} testId="merchant-settlement-detail-tax" />
            <MetricCard label="Reserve" value={money(detail.reserve_held_minor)} tone="warning" testId="merchant-settlement-detail-reserve" />
          </div>
          <div className="mt-4 grid gap-3">
            {(detail.included_transactions || []).map((sale, index) => (
              <div key={sale.sale_id} className="rounded-[20px] border border-white/10 bg-[#071019] p-4" data-testid={`merchant-settlement-detail-sale-${index + 1}`}>
                <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-base font-black text-white">{sale.receipt_id}</div><div className="mt-1 text-sm text-white/60">{sale.method} · {sale.created_at?.replace("T", " ").slice(0, 16)}</div></div><div className="text-right text-lg font-black text-white">{money(Math.round(Number(sale.total || 0) * 100))}</div></div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}