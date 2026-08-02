import { useEffect, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { MetricCard } from "../components/merchant-settlement/MetricCard";
import { SectionCard } from "../components/merchant-settlement/SectionCard";

const money = (minor) => `${(Number(minor || 0) / 100).toFixed(2)} €`;

export default function MerchantPayoutsPage({ onBack }) {
  const [balance, setBalance] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [balanceRes, payoutsRes] = await Promise.all([api.getMerchantBalanceSummary(), api.getMerchantPayoutHistory()]);
      setBalance(balanceRes);
      setPayouts(payoutsRes.rows || []);
    } catch (error) {
      toast.error(error.message || "Auszahlungen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const requestPayout = async () => {
    try {
      await api.createMerchantPayout({ amount_minor: Math.round(Number(amount || 0) * 100), destination_type: "bank_account", destination_reference_masked: "DE••••••1234", settlement_ids: [] });
      setAmount("");
      toast.success("Auszahlung angefragt.");
      await load();
    } catch (error) {
      toast.error(error.message || "Auszahlung konnte nicht erstellt werden.");
    }
  };

  if (loading) return <div className="min-h-screen bg-[#030507]" data-testid="merchant-payouts-loading" />;
  if (!balance) return null;

  return (
    <div className="min-h-screen bg-[#030507] px-4 py-5 sm:px-5 lg:px-8" data-testid="merchant-payouts-page">
      <div className="mx-auto max-w-6xl space-y-5 pb-24">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="merchant-payouts-back-button"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-3xl font-black text-white">Auszahlungen</h1>
            <p className="text-sm text-white/60">Verfügbar, ausstehend, Reserve und Historie klar getrennt.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Verfügbar" value={money(balance.available_minor)} tone="success" testId="merchant-payouts-available" />
          <MetricCard label="Ausstehend" value={money(balance.pending_minor)} tone="warning" testId="merchant-payouts-pending" />
          <MetricCard label="Reserve" value={money(balance.reserved_minor)} tone="warning" testId="merchant-payouts-reserved" />
          <MetricCard label="In Bearbeitung" value={money(balance.payout_in_progress_minor)} testId="merchant-payouts-in-progress" />
        </div>

        <SectionCard title="Nächste Auszahlung" subtitle={`Geplant für ${balance.next_payout_date || "-"}`} testId="merchant-payouts-next-section">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Betrag in EUR" className="min-h-[52px] rounded-full border border-white/10 bg-[#071019] px-4 text-white outline-none placeholder:text-white/28" data-testid="merchant-payouts-amount-input" />
            <button onClick={requestPayout} disabled={!Number(amount)} className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#06B6D4] px-5 text-base font-black text-black disabled:opacity-50" data-testid="merchant-payouts-request-button"><Send size={16} />Auszahlung anfragen</button>
          </div>
          <div className="mt-3 text-sm text-white/60">Sofortauszahlung ist für dieses Händlerkonto noch nicht verfügbar.</div>
        </SectionCard>

        <SectionCard title="Auszahlungsverlauf" subtitle="Status, Ziel und enthaltene Settlements" testId="merchant-payouts-history-section">
          <div className="grid gap-3">
            {payouts.map((payout, index) => (
              <div key={payout.payout_id} className="rounded-[22px] border border-white/10 bg-[#071019] p-4" data-testid={`merchant-payouts-row-${index + 1}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-black text-white">{payout.payout_id}</div>
                    <div className="mt-1 text-sm text-white/58">{payout.status} · {payout.destination_reference_masked}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-white">{money(payout.amount_minor)}</div>
                    <div className="mt-1 text-xs text-white/52">{payout.provider || "manual_review"}</div>
                  </div>
                </div>
                <div className="mt-3 text-sm text-white/60">Settlements: {(payout.settlement_ids || []).join(", ") || "Automatisch"}</div>
                {payout.failure_reason ? <div className="mt-2 text-sm text-rose-200">Fehler: {payout.failure_reason}</div> : null}
              </div>
            ))}
            {!payouts.length ? <div className="rounded-[22px] border border-dashed border-white/10 bg-[#071019] p-4 text-sm text-white/60" data-testid="merchant-payouts-empty">Noch keine Auszahlungen vorhanden.</div> : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}