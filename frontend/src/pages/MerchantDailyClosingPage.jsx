import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { MetricCard } from "../components/merchant-settlement/MetricCard";
import { SectionCard } from "../components/merchant-settlement/SectionCard";

const money = (minor) => `${(Number(minor || 0) / 100).toFixed(2)} €`;

export default function MerchantDailyClosingPage({ onBack }) {
  const [report, setReport] = useState(null);
  const [date, setDate] = useState("");
  const [countedCash, setCountedCash] = useState("");

  const load = async (targetDate = "") => {
    try {
      const result = await api.getMerchantDailyClosing(targetDate);
      setReport(result);
    } catch (error) {
      toast.error(error.message || "Tagesabschluss konnte nicht geladen werden.");
    }
  };

  useEffect(() => { load(); }, []);

  const finalise = async () => {
    try {
      const result = await api.createMerchantDailyClosing({ date: date || undefined, counted_cash_minor: Math.round(Number(countedCash || 0) * 100), branch_id: report?.branch || "", register_id: report?.register || "" });
      setReport(result.report);
      toast.success("Tagesabschluss erstellt.");
    } catch (error) {
      toast.error(error.message || "Tagesabschluss fehlgeschlagen.");
    }
  };

  if (!report) return <div className="min-h-screen bg-[#030507]" data-testid="merchant-daily-closing-loading" />;

  return (
    <div className="min-h-screen bg-[#030507] px-4 py-5 sm:px-5 lg:px-8" data-testid="merchant-daily-closing-page">
      <div className="mx-auto max-w-6xl space-y-5 pb-24">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="merchant-daily-closing-back-button"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-3xl font-black text-white">Tagesabschluss</h1>
            <p className="text-sm text-white/60">Kasse, Methoden, Differenzen und finalen Z-Report prüfen.</p>
          </div>
        </div>

        <SectionCard title="Datum & Kassenstand" subtitle={`Reportnummer ${report.report_number || "-"}`} testId="merchant-daily-closing-controls">
          <div className="grid gap-3 lg:grid-cols-3">
            <input type="date" value={date} onChange={(event) => { setDate(event.target.value); load(event.target.value); }} className="min-h-[52px] rounded-full border border-white/10 bg-[#071019] px-4 text-white outline-none" data-testid="merchant-daily-closing-date-input" />
            <input value={countedCash} onChange={(event) => setCountedCash(event.target.value)} placeholder="Gezähltes Bargeld in EUR" className="min-h-[52px] rounded-full border border-white/10 bg-[#071019] px-4 text-white outline-none placeholder:text-white/28" data-testid="merchant-daily-closing-counted-cash-input" />
            <button onClick={finalise} className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#06B6D4] px-5 text-base font-black text-black" data-testid="merchant-daily-closing-finalise-button"><CheckCircle2 size={16} />Tagesabschluss erstellen</button>
          </div>
        </SectionCard>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Brutto" value={money(report.gross_sales_minor)} testId="merchant-daily-closing-gross" />
          <MetricCard label="Netto" value={money(report.net_sales_minor)} tone="success" testId="merchant-daily-closing-net" />
          <MetricCard label="Erwartetes Bargeld" value={money(report.expected_cash_minor)} testId="merchant-daily-closing-expected-cash" />
          <MetricCard label="Differenz" value={money(report.cash_difference_minor)} tone={Number(report.cash_difference_minor || 0) === 0 ? "success" : "warning"} testId="merchant-daily-closing-difference" />
        </div>

        <SectionCard title="Zahlungsmethoden" subtitle={`${report.closed_shifts} geschlossene Schichten · ${report.open_shifts} offene Schichten`} testId="merchant-daily-closing-methods-section">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Bargeld", report.cash_sales_minor],
              ["Karte", report.card_sales_minor],
              ["Wallet", report.wallet_sales_minor],
              ["QR", report.qr_sales_minor],
              ["Gutscheine", report.vouchers_minor],
              ["Refunds", report.refunds_minor],
            ].map(([label, value], index) => <MetricCard key={label} label={label} value={money(value)} testId={`merchant-daily-closing-method-${index + 1}`} />)}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}