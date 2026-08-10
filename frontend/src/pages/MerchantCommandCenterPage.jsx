import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, BarChart3, CreditCard, Download, Search, Store, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { MetricCard } from "../components/merchant-settlement/MetricCard";
import { SectionCard } from "../components/merchant-settlement/SectionCard";

const money = (minor) => `${(Number(minor || 0) / 100).toFixed(2)} €`;

export default function MerchantCommandCenterPage({ onBack, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [settlementBusy, setSettlementBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.getMerchantCommandCenter();
      setData(result);
    } catch (error) {
      toast.error(error.message || "Übersicht konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createSettlement = async () => {
    setSettlementBusy(true);
    try {
      const result = await api.calculateMerchantSettlement({ period_type: "daily", idempotency_key: `ui-calc-${Date.now()}` });
      toast.success("Settlement berechnet.");
      await load();
      if (result?.settlement?.settlement_id) {
        onNavigate?.(`/merchant/settlements/${result.settlement.settlement_id}`);
      }
    } catch (error) {
      toast.error(error.message || "Settlement konnte nicht berechnet werden.");
    } finally {
      setSettlementBusy(false);
    }
  };

  const finaliseOpenSettlement = async () => {
    const openSettlement = (data?.settlements || []).find((item) => item.status === "open");
    if (!openSettlement) {
      toast.message("Kein offenes Settlement vorhanden.");
      return;
    }
    setSettlementBusy(true);
    try {
      await api.finaliseMerchantSettlement(openSettlement.settlement_id, { idempotency_key: `ui-finalise-${Date.now()}` });
      toast.success("Settlement finalisiert.");
      await load();
    } catch (error) {
      toast.error(error.message || "Settlement konnte nicht finalisiert werden.");
    } finally {
      setSettlementBusy(false);
    }
  };

  const exportFinance = async (kind) => {
    try {
      await api.exportMerchantFinanceCsv(kind);
      toast.success(`${kind} exportiert.`);
    } catch (error) {
      toast.error(error.message || "Export konnte nicht erstellt werden.");
    }
  };

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !data) return [];
    const rows = [
      ...(data.top_products || []).map((item) => ({ kind: "Produkt", label: item.name, meta: `${item.quantity} verkauft` })),
      ...(data.branch_comparison || []).map((item) => ({ kind: "Filiale", label: item.name, meta: money(item.amount_minor) })),
      ...(data.registers || []).map((item) => ({ kind: "Kasse", label: item.name || item.register_id, meta: item.status || "-" })),
      ...(data.staff || []).map((item) => ({ kind: "Mitarbeiter", label: item.user_email || item.user_id, meta: item.role || item.staff_role || "-" })),
      ...(data.settlements || []).map((item) => ({ kind: "Settlement", label: item.settlement_id, meta: money(item.net_amount_minor) })),
    ];
    return rows.filter((row) => `${row.kind} ${row.label} ${row.meta}`.toLowerCase().includes(q)).slice(0, 10);
  }, [data, query]);

  if (loading) return <div className="min-h-screen bg-[#030507]" data-testid="merchant-command-center-loading" />;
  if (!data) return null;

  return (
    <div className="min-h-screen bg-[#030507] px-4 py-5 sm:px-5 lg:px-8" data-testid="merchant-command-center-page">
      <div className="mx-auto max-w-7xl space-y-5 pb-24">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="merchant-command-center-back-button"><ArrowLeft size={18} /></button>
            <div>
              <h1 className="text-3xl font-black text-white">POS Leitstand</h1>
              <p className="text-sm text-white/60">Geschäft, Auszahlungen, Settlements und operative Risiken auf einen Blick.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onNavigate?.("/merchant/pos/daily-closing")} className="min-h-12 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white" data-testid="merchant-command-center-daily-closing-button">Tagesabschluss</button>
            <button onClick={() => onNavigate?.("/merchant/payouts")} className="min-h-12 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white" data-testid="merchant-command-center-payouts-button">Auszahlungen</button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Umsatz heute" value={money(data.top_cards.today_revenue_minor)} testId="merchant-command-center-card-revenue" />
          <MetricCard label="Gewinn heute" value={money(data.top_cards.today_profit_minor)} tone="success" testId="merchant-command-center-card-profit" />
          <MetricCard label="Transaktionen" value={`${data.top_cards.transactions}`} testId="merchant-command-center-card-transactions" />
          <MetricCard label="Kunden" value={`${data.top_cards.customers}`} testId="merchant-command-center-card-customers" />
          <MetricCard label="Offene Auszahlung" value={money(data.top_cards.open_payout_minor)} tone="warning" testId="merchant-command-center-card-open-payout" />
          <MetricCard label="Niedriger Lagerbestand" value={`${data.top_cards.low_stock}`} tone={data.top_cards.low_stock ? "warning" : "default"} testId="merchant-command-center-card-low-stock" />
          <MetricCard label="Offline Geräte" value={`${data.top_cards.offline_devices}`} tone={data.top_cards.offline_devices ? "danger" : "default"} testId="merchant-command-center-card-offline-devices" />
          <MetricCard label="Offene Aufgaben" value={`${data.top_cards.open_tasks}`} tone={data.top_cards.open_tasks ? "warning" : "default"} testId="merchant-command-center-card-open-tasks" />
          <MetricCard label="Offene Disputes" value={`${data.top_cards.open_disputes || 0}`} tone={(data.top_cards.open_disputes || 0) ? "warning" : "default"} testId="merchant-command-center-card-open-disputes" />
        </div>

        <div className={`rounded-[28px] border p-4 ${data.live_status.all_systems_operational ? "border-emerald-400/20 bg-emerald-400/10" : "border-rose-400/20 bg-rose-400/10"}`} data-testid="merchant-command-center-live-status">
          <div className="text-lg font-black text-white">{data.live_status.all_systems_operational ? "🟢 Alle Systeme stabil" : "🔴 Aufmerksamkeit erforderlich"}</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5 text-sm text-white/75">
            <div>Offline POS: {data.live_status.offline_pos}</div>
            <div>Drucker offline: {data.live_status.offline_printer}</div>
            <div>Scanner offline: {data.live_status.offline_scanner}</div>
            <div>Auszahlungs-Verzögerung: {data.live_status.payout_delay}</div>
            <div>Lagerwarnungen: {data.live_status.inventory_warning}</div>
          </div>
        </div>

        <SectionCard title="Suche" subtitle="Produkte, Belege, Filialen, Mitarbeiter und Settlements finden" testId="merchant-command-center-search-section">
          <label className="flex min-h-[52px] items-center gap-3 rounded-full border border-white/10 bg-[#071019] px-4 py-3 text-white">
            <Search size={16} className="text-white/42" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Produkt, Beleg, Mitarbeiter, Filiale, Kasse, Settlement suchen" className="w-full bg-transparent outline-none placeholder:text-white/28" data-testid="merchant-command-center-search-input" />
          </label>
          {query ? (
            <div className="mt-4 grid gap-2">
              {searchResults.map((row, index) => <div key={`${row.kind}-${row.label}-${index}`} className="rounded-[18px] border border-white/10 bg-[#071019] p-3 text-sm text-white" data-testid={`merchant-command-center-search-result-${index + 1}`}><span className="font-black">{row.kind}</span> · {row.label} <span className="text-white/58">{row.meta}</span></div>)}
              {!searchResults.length ? <div className="rounded-[18px] border border-dashed border-white/10 bg-[#071019] p-3 text-sm text-white/60" data-testid="merchant-command-center-search-empty">Kein Treffer gefunden.</div> : null}
            </div>
          ) : null}
        </SectionCard>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <div className="space-y-5">
            <SectionCard title="Filialen & Kassen" subtitle="Live-Status je Filiale und Kasse" testId="merchant-command-center-branches-section">
              <div className="grid gap-3 lg:grid-cols-2">
                {(data.branch_comparison || []).map((branch, index) => (
                  <div key={branch.branch_id || index} className="rounded-[22px] border border-white/10 bg-[#071019] p-4" data-testid={`merchant-command-center-branch-card-${index + 1}`}>
                    <div className="flex items-center justify-between gap-3"><div className="text-lg font-black text-white">{branch.name || branch.branch_id}</div><div className="text-sm text-white/55">{branch.status || "online"}</div></div>
                    <div className="mt-3 grid gap-2 text-sm text-white/70">
                      <div>Umsatz heute: {money(branch.amount_minor)}</div>
                      <div>Aktive Kassierer: {(data.staff || []).filter((item) => item.store_id === branch.branch_id).length}</div>
                      <div>Kassen: {(data.registers || []).filter((item) => item.store_id === branch.branch_id).length}</div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Verkäufe & Verteilung" subtitle="Zahlungsmethoden, Top-Produkte und Kategorien" testId="merchant-command-center-sales-section">
              <div className="grid gap-4 lg:grid-cols-3">
                <MiniList title="Zahlungsmethoden" icon={CreditCard} rows={(data.payment_methods || []).map((item) => ({ label: item.method, value: money(item.amount_minor) }))} testId="merchant-command-center-payment-methods" />
                <MiniList title="Top Produkte" icon={BarChart3} rows={(data.top_products || []).map((item) => ({ label: item.name, value: `${item.quantity}` }))} testId="merchant-command-center-top-products" />
                <MiniList title="Top Kategorien" icon={Store} rows={(data.top_categories || []).map((item) => ({ label: item.name, value: `${item.quantity}` }))} testId="merchant-command-center-top-categories" />
              </div>
            </SectionCard>

            <SectionCard title="Mitarbeiter & Geräte" subtitle="Wer arbeitet gerade und welche Geräte brauchen Aufmerksamkeit" testId="merchant-command-center-ops-section">
              <div className="grid gap-4 lg:grid-cols-2">
                <MiniList title="Live Personal" icon={Users} rows={(data.staff || []).slice(0, 8).map((item) => ({ label: item.user_email || item.user_id, value: item.role || item.staff_role || "Kassierer" }))} testId="merchant-command-center-live-staff" />
                <MiniList title="Gerätezentrum" icon={AlertTriangle} rows={(data.devices || []).slice(0, 8).map((item) => ({ label: item.label || item.serial || item.device_id || "Gerät", value: item.status || "unbekannt" }))} testId="merchant-command-center-device-center" />
              </div>
            </SectionCard>
          </div>

          <div className="space-y-5">
            <SectionCard title="Auszahlungsübersicht" subtitle={`Nächste Auszahlung: ${data.balances.next_payout_date || "-"}`} actions={<button onClick={() => onNavigate?.("/merchant/payouts")} className="min-h-12 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white" data-testid="merchant-command-center-open-payout-center">Öffnen</button>} testId="merchant-command-center-payout-section">
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="Verfügbar" value={money(data.balances.available_minor)} tone="success" testId="merchant-command-center-balance-available" />
                <MetricCard label="Ausstehend" value={money(data.balances.pending_minor)} tone="warning" testId="merchant-command-center-balance-pending" />
                <MetricCard label="Reserve" value={money(data.balances.reserved_minor)} tone="warning" testId="merchant-command-center-balance-reserved" />
                <MetricCard label="In Auszahlung" value={money(data.balances.payout_in_progress_minor)} testId="merchant-command-center-balance-in-progress" />
              </div>
            </SectionCard>

            <SectionCard title="Aufgaben & Alerts" subtitle="Automatisch erzeugte Aufgaben aus Betrieb und Finanzen" testId="merchant-command-center-tasks-section">
              <div className="grid gap-3">
                {(data.tasks || []).map((task, index) => <div key={`${task.title}-${index}`} className="rounded-[20px] border border-white/10 bg-[#071019] p-4" data-testid={`merchant-command-center-task-${index + 1}`}><div className="text-base font-black text-white">{task.title}</div><div className="mt-1 text-sm text-white/60">{task.description}</div></div>)}
                {!data.tasks?.length ? <div className="rounded-[20px] border border-dashed border-white/10 bg-[#071019] p-4 text-sm text-white/60" data-testid="merchant-command-center-tasks-empty">Keine offenen Aufgaben.</div> : null}
              </div>
            </SectionCard>

            <SectionCard title="Settlements & Berichte" subtitle="Berechnen, finalisieren und exportieren" actions={<div className="flex flex-wrap gap-2"><button onClick={createSettlement} disabled={settlementBusy} className="min-h-12 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white disabled:opacity-50" data-testid="merchant-command-center-create-settlement-button">Settlement berechnen</button><button onClick={finaliseOpenSettlement} disabled={settlementBusy} className="min-h-12 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white disabled:opacity-50" data-testid="merchant-command-center-finalise-settlement-button">Offenes finalisieren</button><button onClick={() => data.settlements?.[0] && onNavigate?.(`/merchant/settlements/${data.settlements[0].settlement_id}`)} className="min-h-12 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white" data-testid="merchant-command-center-open-settlement-button">Letztes Settlement</button></div>} testId="merchant-command-center-settlements-section">
              <div className="grid gap-3">
                {(data.settlements || []).slice(0, 5).map((item, index) => (
                  <button key={item.settlement_id} onClick={() => onNavigate?.(`/merchant/settlements/${item.settlement_id}`)} className="flex items-center justify-between rounded-[20px] border border-white/10 bg-[#071019] p-4 text-left text-white" data-testid={`merchant-command-center-settlement-row-${index + 1}`}>
                    <div><div className="font-black">{item.settlement_id}</div><div className="mt-1 text-sm text-white/60">{item.status} · {item.period_start?.slice(0, 10)} bis {item.period_end?.slice(0, 10)}</div></div>
                    <div className="text-right"><div className="text-lg font-black">{money(item.net_amount_minor)}</div><div className="mt-1 text-xs text-white/52">Gebühren {money(item.payment_fees_minor + item.platform_fees_minor)}</div></div>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => onNavigate?.("/merchant/pos/daily-closing")} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white" data-testid="merchant-command-center-daily-report-button"><Download size={16} />Tagesabschluss</button>
              </div>
            </SectionCard>

            <SectionCard title="Reserve & Risiko" subtitle="Rolling Reserve, Freigaben und Chargebacks sichtbar getrennt" testId="merchant-command-center-risk-section">
              <div className="grid gap-4 lg:grid-cols-2">
                <MiniList title="Aktive Reserve-Regel" icon={Wallet} rows={data.active_reserve_rule ? [{ label: data.active_reserve_rule.reason || "Rolling Reserve", value: data.active_reserve_rule.percentage_basis_points ? `${(Number(data.active_reserve_rule.percentage_basis_points || 0) / 100).toFixed(2)} %` : `${money(data.active_reserve_rule.fixed_minor || 0)}` }, { label: "Hold Days", value: `${data.active_reserve_rule.hold_days || 30}` }] : []} testId="merchant-command-center-active-reserve-rule" />
                <MiniList title="Letzte Reserve-Holds" icon={AlertTriangle} rows={(data.reserves || []).slice(0, 4).map((item) => ({ label: item.reason || "Reserve Hold", value: `${money(item.amount_minor)} · ${item.status}` }))} testId="merchant-command-center-reserve-holds" />
              </div>
              <div className="mt-4 grid gap-3">
                {(data.disputes || []).slice(0, 3).map((item, index) => <div key={item.dispute_id} className="rounded-[20px] border border-white/10 bg-[#071019] p-4 text-white" data-testid={`merchant-command-center-dispute-row-${index + 1}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-black">{item.dispute_id}</div><div className="mt-1 text-sm text-white/60">{item.reason} · {item.lifecycle_stage}</div></div><div className="text-right"><div className="text-lg font-black">{money(item.amount_minor)}</div><div className="mt-1 text-xs text-white/52">{item.status}</div></div></div></div>)}
                {!data.disputes?.length ? <div className="rounded-[20px] border border-dashed border-white/10 bg-[#071019] p-4 text-sm text-white/60" data-testid="merchant-command-center-disputes-empty">Keine aktiven Disputes.</div> : null}
              </div>
            </SectionCard>

            <SectionCard title="Adjustments & Exporte" subtitle="Freigaben, Korrekturen und saubere Finanz-Exporte" testId="merchant-command-center-adjustments-section">
              <div className="grid gap-3">
                {(data.adjustments || []).slice(0, 4).map((item, index) => <div key={item.adjustment_id} className="rounded-[20px] border border-white/10 bg-[#071019] p-4 text-white" data-testid={`merchant-command-center-adjustment-row-${index + 1}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-black">{item.adjustment_id}</div><div className="mt-1 text-sm text-white/60">{item.reason} · {item.adjustment_type}</div></div><div className="text-right"><div className="text-lg font-black">{item.direction === "debit" ? "-" : "+"}{money(item.amount_minor)}</div><div className="mt-1 text-xs text-white/52">{item.status}</div></div></div></div>)}
                {!data.adjustments?.length ? <div className="rounded-[20px] border border-dashed border-white/10 bg-[#071019] p-4 text-sm text-white/60" data-testid="merchant-command-center-adjustments-empty">Noch keine Adjustments vorhanden.</div> : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => exportFinance("settlements")} className="min-h-12 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white" data-testid="merchant-command-center-export-settlements">Settlements exportieren</button>
                <button onClick={() => exportFinance("payouts")} className="min-h-12 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white" data-testid="merchant-command-center-export-payouts">Payouts exportieren</button>
                <button onClick={() => exportFinance("reserves")} className="min-h-12 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white" data-testid="merchant-command-center-export-reserves">Reserven exportieren</button>
                <button onClick={() => exportFinance("adjustments")} className="min-h-12 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white" data-testid="merchant-command-center-export-adjustments">Adjustments exportieren</button>
                <button onClick={() => exportFinance("disputes")} className="min-h-12 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white" data-testid="merchant-command-center-export-disputes">Disputes exportieren</button>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniList({ title, icon: Icon, rows, testId }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[#071019] p-4" data-testid={testId}>
      <div className="flex items-center gap-3 text-white"><Icon size={16} /><div className="text-lg font-black">{title}</div></div>
      <div className="mt-3 grid gap-2">
        {rows.length ? rows.slice(0, 8).map((row, index) => <div key={`${row.label}-${index}`} className="flex items-center justify-between gap-3 text-sm text-white/75" data-testid={`${testId}-row-${index + 1}`}><span className="truncate">{row.label}</span><span className="font-bold text-white">{row.value}</span></div>) : <div className="text-sm text-white/50">Keine Daten</div>}
      </div>
    </div>
  );
}