import { useEffect, useState } from "react";
import { ArrowLeft, RotateCcw, Shield } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { SectionCard } from "../components/merchant-settlement/SectionCard";

const money = (minor) => `${(Number(minor || 0) / 100).toFixed(2)} €`;

export default function AdminMerchantSettlementsPage({ onBack }) {
  const [data, setData] = useState({ settlements: [], payouts: [], balances: [] });

  const load = async () => {
    try {
      const result = await api.getAdminMerchantSettlements();
      setData(result);
    } catch (error) {
      toast.error(error.message || "Admin Settlement Center konnte nicht geladen werden.");
    }
  };

  useEffect(() => { load(); }, []);

  const actionPayout = async (payoutId, action) => {
    try {
      await api.adminMerchantPayoutAction(payoutId, { action, failure_reason: action === "failed" ? "Admin markiert fehlgeschlagen" : "" });
      await load();
    } catch (error) {
      toast.error(error.message || "Payout-Aktion fehlgeschlagen.");
    }
  };

  return (
    <div className="min-h-screen bg-[#030507] px-4 py-5 sm:px-5 lg:px-8" data-testid="admin-merchant-settlements-page">
      <div className="mx-auto max-w-7xl space-y-5 pb-24">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="admin-merchant-settlements-back-button"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-3xl font-black text-white">Admin Settlement Center</h1>
            <p className="text-sm text-white/60">Settlements, Balances, Reserves und Auszahlungen mit Audit-Sicht.</p>
          </div>
        </div>
        <SectionCard title="Settlements" testId="admin-merchant-settlements-list">
          <div className="grid gap-3">
            {data.settlements.map((settlement, index) => <div key={settlement.settlement_id} className="rounded-[20px] border border-white/10 bg-[#071019] p-4 text-white" data-testid={`admin-merchant-settlement-row-${index + 1}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-black">{settlement.settlement_id}</div><div className="mt-1 text-sm text-white/60">{settlement.merchant_id} · {settlement.status}</div></div><div className="text-right"><div className="text-lg font-black">{money(settlement.net_amount_minor)}</div><div className="mt-1 text-xs text-white/52">Reserve {money(settlement.reserve_held_minor)}</div></div></div></div>)}
            {!data.settlements.length ? <div className="rounded-[20px] border border-dashed border-white/10 bg-[#071019] p-4 text-sm text-white/60" data-testid="admin-merchant-settlement-empty">Noch keine Settlements vorhanden.</div> : null}
          </div>
        </SectionCard>
        <SectionCard title="Payouts" testId="admin-merchant-payouts-list">
          <div className="grid gap-3">
            {data.payouts.map((payout, index) => <div key={payout.payout_id} className="rounded-[20px] border border-white/10 bg-[#071019] p-4 text-white" data-testid={`admin-merchant-payout-row-${index + 1}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-black">{payout.payout_id}</div><div className="mt-1 text-sm text-white/60">{payout.merchant_id} · {payout.status}</div></div><div className="text-right"><div className="text-lg font-black">{money(payout.amount_minor)}</div><div className="mt-3 flex flex-wrap gap-2 justify-end"><button onClick={() => actionPayout(payout.payout_id, "approve")} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white" data-testid={`admin-merchant-payout-approve-${index + 1}`}><Shield size={14} />Freigeben</button><button onClick={() => actionPayout(payout.payout_id, "paid")} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#06B6D4] px-3 py-2 text-sm font-bold text-black" data-testid={`admin-merchant-payout-paid-${index + 1}`}>Als bezahlt markieren</button><button onClick={() => actionPayout(payout.payout_id, "failed")} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white" data-testid={`admin-merchant-payout-failed-${index + 1}`}><RotateCcw size={14} />Fehlgeschlagen</button></div></div></div></div>)}
            {!data.payouts.length ? <div className="rounded-[20px] border border-dashed border-white/10 bg-[#071019] p-4 text-sm text-white/60" data-testid="admin-merchant-payout-empty">Noch keine Auszahlungen vorhanden.</div> : null}
          </div>
        </SectionCard>
        <SectionCard title="Balances" testId="admin-merchant-balances-list">
          <div className="grid gap-3">
            {data.balances.map((balance, index) => <div key={`${balance.merchant_id}-${index}`} className="rounded-[20px] border border-white/10 bg-[#071019] p-4 text-white" data-testid={`admin-merchant-balance-row-${index + 1}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-black">{balance.merchant_id}</div><div className="mt-1 text-sm text-white/60">Pending {money(balance.pending_minor)} · Reserve {money(balance.reserved_minor)}</div></div><div className="text-right"><div className="text-lg font-black">{money(balance.available_minor)}</div><div className="mt-1 text-xs text-white/52">Verfügbar</div></div></div></div>)}
            {!data.balances.length ? <div className="rounded-[20px] border border-dashed border-white/10 bg-[#071019] p-4 text-sm text-white/60" data-testid="admin-merchant-balance-empty">Noch keine Balance-Daten vorhanden.</div> : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}