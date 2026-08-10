import { useEffect, useState } from "react";
import { ArrowLeft, RotateCcw, Shield } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { SectionCard } from "../components/merchant-settlement/SectionCard";

const money = (minor) => `${(Number(minor || 0) / 100).toFixed(2)} €`;

export default function AdminMerchantSettlementsPage({ onBack }) {
  const [data, setData] = useState({ settlements: [], payouts: [], balances: [] });
  const [reserveForm, setReserveForm] = useState({ merchant_id: "", percentage_basis_points: "1000", fixed_minor: "0", reason: "Rolling Reserve 10 %", hold_days: "30" });
  const [adjustmentForm, setAdjustmentForm] = useState({ merchant_id: "", amount_minor: "0", direction: "credit", reason: "", evidence: "", adjustment_type: "correction", second_admin_id: "" });
  const [disputeForm, setDisputeForm] = useState({ merchant_id: "", sale_id: "", amount_minor: "0", reason: "", evidence: "" });

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

  const createReserve = async () => {
    try {
      await api.adminApplyMerchantReserve({ ...reserveForm, percentage_basis_points: Number(reserveForm.percentage_basis_points || 0), fixed_minor: Number(reserveForm.fixed_minor || 0), hold_days: Number(reserveForm.hold_days || 30) });
      toast.success("Reserve-Regel gespeichert.");
      await load();
    } catch (error) {
      toast.error(error.message || "Reserve-Regel konnte nicht gespeichert werden.");
    }
  };

  const createAdjustment = async () => {
    try {
      await api.adminCreateMerchantAdjustment({ ...adjustmentForm, amount_minor: Number(adjustmentForm.amount_minor || 0), idempotency_key: `adj-${Date.now()}` });
      toast.success("Adjustment zur Freigabe angelegt.");
      setAdjustmentForm((current) => ({ ...current, reason: "", evidence: "", amount_minor: "0", second_admin_id: "" }));
      await load();
    } catch (error) {
      toast.error(error.message || "Adjustment konnte nicht angelegt werden.");
    }
  };

  const reviewAdjustment = async (adjustmentId, action) => {
    try {
      await api.adminReviewMerchantAdjustment(adjustmentId, { action, note: action === "approve" ? "Freigegeben im Admin Settlement Center" : "Abgelehnt im Admin Settlement Center" });
      toast.success(action === "approve" ? "Adjustment freigegeben." : "Adjustment abgelehnt.");
      await load();
    } catch (error) {
      toast.error(error.message || "Adjustment-Aktion fehlgeschlagen.");
    }
  };

  const createDispute = async () => {
    try {
      await api.adminCreateMerchantDispute({ ...disputeForm, amount_minor: Number(disputeForm.amount_minor || 0), idempotency_key: `dsp-${Date.now()}` });
      toast.success("Dispute erfasst.");
      setDisputeForm((current) => ({ ...current, sale_id: "", amount_minor: "0", reason: "", evidence: "" }));
      await load();
    } catch (error) {
      toast.error(error.message || "Dispute konnte nicht erfasst werden.");
    }
  };

  const reviewDispute = async (disputeId, action) => {
    try {
      await api.adminReviewMerchantDispute(disputeId, { action, note: `Status gesetzt auf ${action}` });
      toast.success("Dispute aktualisiert.");
      await load();
    } catch (error) {
      toast.error(error.message || "Dispute-Aktion fehlgeschlagen.");
    }
  };

  const exportKind = async (kind) => {
    try {
      await api.exportAdminMerchantFinanceCsv(kind);
      toast.success(`${kind} exportiert.`);
    } catch (error) {
      toast.error(error.message || "Export fehlgeschlagen.");
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
        <SectionCard title="Finance V2 Steuerung" subtitle="Reserve, Adjustments, Disputes und Exporte zentral steuern" testId="admin-merchant-finance-v2-panel">
          <div className="grid gap-5 xl:grid-cols-3">
            <div className="rounded-[20px] border border-white/10 bg-[#071019] p-4 text-white" data-testid="admin-merchant-reserve-form">
              <div className="text-lg font-black">Reserve-Regel</div>
              <div className="mt-3 grid gap-3">
                <input value={reserveForm.merchant_id} onChange={(event) => setReserveForm((current) => ({ ...current, merchant_id: event.target.value }))} placeholder="merchant_id" className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none" data-testid="admin-merchant-reserve-merchant-input" />
                <input value={reserveForm.percentage_basis_points} onChange={(event) => setReserveForm((current) => ({ ...current, percentage_basis_points: event.target.value }))} placeholder="bps" className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none" data-testid="admin-merchant-reserve-bps-input" />
                <input value={reserveForm.reason} onChange={(event) => setReserveForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Grund" className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none" data-testid="admin-merchant-reserve-reason-input" />
                <input value={reserveForm.hold_days} onChange={(event) => setReserveForm((current) => ({ ...current, hold_days: event.target.value }))} placeholder="Hold Days" className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none" data-testid="admin-merchant-reserve-hold-days-input" />
                <button onClick={createReserve} className="min-h-12 rounded-full bg-[#06B6D4] px-4 py-3 text-sm font-black text-black" data-testid="admin-merchant-reserve-submit-button">Reserve speichern</button>
              </div>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-[#071019] p-4 text-white" data-testid="admin-merchant-adjustment-form">
              <div className="text-lg font-black">Adjustment</div>
              <div className="mt-3 grid gap-3">
                <input value={adjustmentForm.merchant_id} onChange={(event) => setAdjustmentForm((current) => ({ ...current, merchant_id: event.target.value }))} placeholder="merchant_id" className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none" data-testid="admin-merchant-adjustment-merchant-input" />
                <input value={adjustmentForm.amount_minor} onChange={(event) => setAdjustmentForm((current) => ({ ...current, amount_minor: event.target.value }))} placeholder="amount_minor" className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none" data-testid="admin-merchant-adjustment-amount-input" />
                <select value={adjustmentForm.direction} onChange={(event) => setAdjustmentForm((current) => ({ ...current, direction: event.target.value }))} className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none" data-testid="admin-merchant-adjustment-direction-select"><option value="credit">credit</option><option value="debit">debit</option></select>
                <input value={adjustmentForm.reason} onChange={(event) => setAdjustmentForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Grund" className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none" data-testid="admin-merchant-adjustment-reason-input" />
                <input value={adjustmentForm.evidence} onChange={(event) => setAdjustmentForm((current) => ({ ...current, evidence: event.target.value }))} placeholder="Evidence" className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none" data-testid="admin-merchant-adjustment-evidence-input" />
                <button onClick={createAdjustment} className="min-h-12 rounded-full bg-[#06B6D4] px-4 py-3 text-sm font-black text-black" data-testid="admin-merchant-adjustment-submit-button">Adjustment anlegen</button>
              </div>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-[#071019] p-4 text-white" data-testid="admin-merchant-dispute-form">
              <div className="text-lg font-black">Dispute / Chargeback</div>
              <div className="mt-3 grid gap-3">
                <input value={disputeForm.merchant_id} onChange={(event) => setDisputeForm((current) => ({ ...current, merchant_id: event.target.value }))} placeholder="merchant_id" className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none" data-testid="admin-merchant-dispute-merchant-input" />
                <input value={disputeForm.sale_id} onChange={(event) => setDisputeForm((current) => ({ ...current, sale_id: event.target.value }))} placeholder="sale_id (optional)" className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none" data-testid="admin-merchant-dispute-sale-input" />
                <input value={disputeForm.amount_minor} onChange={(event) => setDisputeForm((current) => ({ ...current, amount_minor: event.target.value }))} placeholder="amount_minor" className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none" data-testid="admin-merchant-dispute-amount-input" />
                <input value={disputeForm.reason} onChange={(event) => setDisputeForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Grund" className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none" data-testid="admin-merchant-dispute-reason-input" />
                <input value={disputeForm.evidence} onChange={(event) => setDisputeForm((current) => ({ ...current, evidence: event.target.value }))} placeholder="Evidence" className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none" data-testid="admin-merchant-dispute-evidence-input" />
                <button onClick={createDispute} className="min-h-12 rounded-full bg-[#06B6D4] px-4 py-3 text-sm font-black text-black" data-testid="admin-merchant-dispute-submit-button">Dispute erfassen</button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => exportKind("settlements")} className="min-h-12 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white" data-testid="admin-merchant-export-settlements">Settlements Export</button>
            <button onClick={() => exportKind("payouts")} className="min-h-12 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white" data-testid="admin-merchant-export-payouts">Payouts Export</button>
            <button onClick={() => exportKind("reserves")} className="min-h-12 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white" data-testid="admin-merchant-export-reserves">Reserven Export</button>
            <button onClick={() => exportKind("adjustments")} className="min-h-12 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white" data-testid="admin-merchant-export-adjustments">Adjustments Export</button>
            <button onClick={() => exportKind("disputes")} className="min-h-12 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white" data-testid="admin-merchant-export-disputes">Disputes Export</button>
          </div>
        </SectionCard>
        <SectionCard title="Payouts" testId="admin-merchant-payouts-list">
          <div className="grid gap-3">
            {data.payouts.map((payout, index) => <div key={payout.payout_id} className="rounded-[20px] border border-white/10 bg-[#071019] p-4 text-white" data-testid={`admin-merchant-payout-row-${index + 1}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-black">{payout.payout_id}</div><div className="mt-1 text-sm text-white/60">{payout.merchant_id} · {payout.status}</div></div><div className="text-right"><div className="text-lg font-black">{money(payout.amount_minor)}</div><div className="mt-3 flex flex-wrap gap-2 justify-end"><button onClick={() => actionPayout(payout.payout_id, "approve")} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white" data-testid={`admin-merchant-payout-approve-${index + 1}`}><Shield size={14} />Freigeben</button><button onClick={() => actionPayout(payout.payout_id, "paid")} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#06B6D4] px-3 py-2 text-sm font-bold text-black" data-testid={`admin-merchant-payout-paid-${index + 1}`}>Als bezahlt markieren</button><button onClick={() => actionPayout(payout.payout_id, "failed")} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white" data-testid={`admin-merchant-payout-failed-${index + 1}`}><RotateCcw size={14} />Fehlgeschlagen</button></div></div></div></div>)}
            {!data.payouts.length ? <div className="rounded-[20px] border border-dashed border-white/10 bg-[#071019] p-4 text-sm text-white/60" data-testid="admin-merchant-payout-empty">Noch keine Auszahlungen vorhanden.</div> : null}
          </div>
        </SectionCard>
        <SectionCard title="Adjustments" testId="admin-merchant-adjustments-list">
          <div className="grid gap-3">
            {(data.adjustments || []).map((adjustment, index) => <div key={adjustment.adjustment_id} className="rounded-[20px] border border-white/10 bg-[#071019] p-4 text-white" data-testid={`admin-merchant-adjustment-row-${index + 1}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-black">{adjustment.adjustment_id}</div><div className="mt-1 text-sm text-white/60">{adjustment.merchant_id} · {adjustment.status}</div><div className="mt-1 text-xs text-white/52">{adjustment.reason}</div></div><div className="text-right"><div className="text-lg font-black">{adjustment.direction === "debit" ? "-" : "+"}{money(adjustment.amount_minor)}</div>{adjustment.status === "pending_approval" ? <div className="mt-3 flex flex-wrap gap-2 justify-end"><button onClick={() => reviewAdjustment(adjustment.adjustment_id, "approve")} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#06B6D4] px-3 py-2 text-sm font-bold text-black" data-testid={`admin-merchant-adjustment-approve-${index + 1}`}>Freigeben</button><button onClick={() => reviewAdjustment(adjustment.adjustment_id, "reject")} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white" data-testid={`admin-merchant-adjustment-reject-${index + 1}`}>Ablehnen</button></div> : null}</div></div></div>)}
            {!data.adjustments?.length ? <div className="rounded-[20px] border border-dashed border-white/10 bg-[#071019] p-4 text-sm text-white/60" data-testid="admin-merchant-adjustment-empty">Noch keine Adjustments vorhanden.</div> : null}
          </div>
        </SectionCard>
        <SectionCard title="Reserven" testId="admin-merchant-reserves-list">
          <div className="grid gap-3">
            {(data.reserves || []).map((reserve, index) => <div key={reserve.reserve_id} className="rounded-[20px] border border-white/10 bg-[#071019] p-4 text-white" data-testid={`admin-merchant-reserve-row-${index + 1}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-black">{reserve.reserve_id}</div><div className="mt-1 text-sm text-white/60">{reserve.merchant_id} · {reserve.mode} · {reserve.status}</div><div className="mt-1 text-xs text-white/52">{reserve.reason}</div></div><div className="text-right"><div className="text-lg font-black">{money(reserve.amount_minor)}</div><div className="mt-1 text-xs text-white/52">Release {reserve.expected_release_date || "-"}</div></div></div></div>)}
            {!data.reserves?.length ? <div className="rounded-[20px] border border-dashed border-white/10 bg-[#071019] p-4 text-sm text-white/60" data-testid="admin-merchant-reserve-empty">Noch keine Reserven vorhanden.</div> : null}
          </div>
        </SectionCard>
        <SectionCard title="Disputes / Chargebacks" testId="admin-merchant-disputes-list">
          <div className="grid gap-3">
            {(data.disputes || []).map((dispute, index) => <div key={dispute.dispute_id} className="rounded-[20px] border border-white/10 bg-[#071019] p-4 text-white" data-testid={`admin-merchant-dispute-row-${index + 1}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-black">{dispute.dispute_id}</div><div className="mt-1 text-sm text-white/60">{dispute.merchant_id} · {dispute.status} · {dispute.lifecycle_stage}</div><div className="mt-1 text-xs text-white/52">{dispute.reason}</div></div><div className="text-right"><div className="text-lg font-black">{money(dispute.amount_minor)}</div><div className="mt-3 flex flex-wrap gap-2 justify-end"><button onClick={() => reviewDispute(dispute.dispute_id, "under_review")} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white" data-testid={`admin-merchant-dispute-review-${index + 1}`}>Review</button><button onClick={() => reviewDispute(dispute.dispute_id, "merchant_won")} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#06B6D4] px-3 py-2 text-sm font-bold text-black" data-testid={`admin-merchant-dispute-win-${index + 1}`}>Gewonnen</button><button onClick={() => reviewDispute(dispute.dispute_id, "merchant_lost")} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white" data-testid={`admin-merchant-dispute-lost-${index + 1}`}>Verloren</button></div></div></div></div>)}
            {!data.disputes?.length ? <div className="rounded-[20px] border border-dashed border-white/10 bg-[#071019] p-4 text-sm text-white/60" data-testid="admin-merchant-dispute-empty">Noch keine Disputes vorhanden.</div> : null}
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