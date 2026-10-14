import React, { useEffect, useState } from "react";
import { Activity, AlertTriangle, Building2, Fuel, Gauge, Network, ShieldCheck, WalletCards, ArrowLeft } from "lucide-react";
import { getFuelAdminOverview, getFuelAdminSessions, getFuelPaymentReleaseGates, getFuelPersistenceStatus, getFuelProviderOnboarding, getFuelReconciliationCases } from "../services/fuelApi";
import FuelCommercialPreviewPanel from "../components/FuelCommercialPreviewPanel";

function Card({ label, value, icon: Icon, hint }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center justify-between text-slate-400">
        <span className="text-sm">{label}</span><Icon size={20} className="text-amber-300" />
      </div>
      <div className="mt-3 text-3xl font-black text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export default function AdminFuelControlCenterPage({ onNavigate }) {
  const [data, setData] = useState(null);
  const [onboarding, setOnboarding] = useState([]);
  const [paymentGates, setPaymentGates] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [persistence, setPersistence] = useState(null);
  const [reconciliation, setReconciliation] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [result, onboardingResult, gateResult, sessionResult, persistenceResult, reconciliationResult] = await Promise.all([
        getFuelAdminOverview(),
        getFuelProviderOnboarding(),
        getFuelPaymentReleaseGates(),
        getFuelAdminSessions({ limit: 25 }),
        getFuelPersistenceStatus(),
        getFuelReconciliationCases(50),
      ]);
      if (mounted) {
        setData(result.ok ? result : null);
        setOnboarding(onboardingResult.ok ? onboardingResult.providers || [] : []);
        setPaymentGates(gateResult.ok ? gateResult : null);
        setSessions(sessionResult.ok ? sessionResult.sessions || [] : []);
        setPersistence(persistenceResult.ok ? persistenceResult : null);
        setReconciliation(reconciliationResult.ok ? reconciliationResult.cases || [] : []);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const m = data?.metrics || {};

  return (
    <div className="min-h-screen bg-[#06101D] text-white">
      <header className="border-b border-white/10 bg-[#06101D]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4">
          <button onClick={() => onNavigate?.("/admin")} className="rounded-xl bg-white/5 p-2 hover:bg-white/10">
            <ArrowLeft size={20} />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-slate-950">
            <Fuel size={22} />
          </div>
          <div>
            <div className="font-black">Fuel Control Center</div>
            <div className="text-xs text-slate-500">BidBlitz Fuel Network · DEV SAFE MODE</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">Network Operations</p>
            <h1 className="mt-2 text-4xl font-black">Fuel Network Übersicht</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Simulator, Provider-Onboarding, Pumpenstatus und Incidents zentral überwachen. Keine echten Zahlungen oder Auszahlungen in diesem Branch.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
            <ShieldCheck size={15} /> DEV FAIL-CLOSED
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card label="Stationen" value={loading ? "…" : m.stations ?? 0} icon={Building2} />
          <Card label="Zapfsäulen" value={loading ? "…" : m.pumps ?? 0} icon={Gauge} hint={String(m.free_pumps ?? 0) + " frei"} />
          <Card label="Live Sessions" value={m.live_sessions ?? 0} icon={Activity} hint="echte Fuel-Sessions noch gesperrt" />
          <Card label="Offene Incidents" value={m.open_incidents ?? 0} icon={AlertTriangle} />
        </div>

        <FuelCommercialPreviewPanel />

        <section className="mt-10">
          <div className="flex items-center gap-2">
            <Network size={20} className="text-amber-300" />
            <h2 className="text-2xl font-black">Provider Status</h2>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {(data?.providers || []).map((provider) => (
              <div key={provider.provider} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-black uppercase">{provider.provider}</div>
                    <div className="mt-1 text-xs text-slate-500">{provider.status}</div>
                  </div>
                  <span className={"rounded-full px-2.5 py-1 text-xs font-bold " + (
                    provider.status === "active_dev"
                      ? "bg-emerald-400/10 text-emerald-300"
                      : "bg-amber-300/10 text-amber-200"
                  )}>
                    {provider.status === "active_dev" ? "DEV AKTIV" : "ONBOARDING"}
                  </span>
                </div>
                {provider.provider === "dkv" && (
                  <div className="mt-5 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                    <div>Enterprise API: <b>{provider.enterprise_api}</b></div>
                    <div>Multi-Customer: <b>{provider.multi_customer_platform}</b></div>
                    <div>Sandbox: <b>{provider.public_sandbox}</b></div>
                    <div>Pay-at-Pump: <b>{provider.pay_at_pump_api}</b></div>
                    <div>Revenue Share: <b>{provider.revenue_share}</b></div>
                    <div>Split Settlement: <b>{provider.split_settlement}</b></div>
                    <div>API Preis: <b>{provider.monthly_api_price_eur} €/Monat</b></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-center gap-2">
            <Network size={20} className="text-amber-300" />
            <h2 className="text-2xl font-black">Provider Onboarding Matrix</h2>
          </div>
          <div className="mt-4 overflow-hidden rounded-3xl border border-white/10">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-white/10 bg-white/[0.05] px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
              <div>Provider</div><div>Stage</div><div>Discovery</div><div>Fueling</div>
            </div>
            {onboarding.map((provider) => (
              <button key={provider.provider} onClick={() => onNavigate?.("/admin/fuel/provider/" + provider.provider)} className="grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-white/5 px-4 py-4 text-left last:border-0 hover:bg-white/[0.03]">
                <div>
                  <div className="font-bold uppercase">{provider.provider}</div>
                  <div className="mt-1 max-w-xl text-xs text-slate-500">{provider.notes}</div>
                </div>
                <div className="text-xs font-bold text-slate-300">{provider.stage}</div>
                <div className={provider.can_enable_discovery ? "text-emerald-300" : "text-amber-200"}>{provider.can_enable_discovery ? "READY" : "BLOCKED"}</div>
                <div className={provider.can_enable_fueling ? "text-emerald-300" : "text-red-300"}>{provider.can_enable_fueling ? "READY" : "BLOCKED"}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-2"><WalletCards className="text-amber-300" /><h2 className="text-xl font-black">Fuel Payment Release Gates</h2></div>
          <p className="mt-2 text-sm text-slate-400">LIVE bleibt gesperrt, bis alle Freigaben bestätigt sind.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(paymentGates?.missing || []).map((gate) => <span key={gate} className="rounded-full bg-red-400/10 px-3 py-1.5 text-xs font-bold text-red-300">{gate}</span>)}
            {paymentGates?.live_ready && <span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">LIVE READY</span>}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-300" />
            <h2 className="text-2xl font-black">Incidents</h2>
          </div>
          <div className="mt-4 overflow-hidden rounded-3xl border border-white/10">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-white/10 bg-white/[0.05] px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
              <div>Station / Pumpe</div><div>Grund</div><div>Aktion</div>
            </div>
            {(data?.incidents || []).map((incident) => (
              <div key={incident.incident_id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-white/5 px-4 py-4 last:border-0">
                <div>
                  <div className="font-bold">{incident.station_name}</div>
                  <div className="mt-1 text-xs text-slate-500">{incident.pump_id}</div>
                </div>
                <div className={"rounded-full px-2.5 py-1 text-xs font-bold " + (
                  incident.severity === "high" ? "bg-red-400/10 text-red-300" : "bg-amber-300/10 text-amber-200"
                )}>
                  {incident.reason}
                </div>
                <div className="text-right text-xs text-slate-400">Payment für Pumpe aus</div>
              </div>
            ))}
            {!loading && !(data?.incidents || []).length && <div className="p-6 text-sm text-slate-500">Keine offenen Incidents.</div>}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-300" />
            <h2 className="text-2xl font-black">Payment Reconciliation Inbox</h2>
          </div>
          <p className="mt-2 text-sm text-slate-500">Abweichungen zwischen POS/Forecourt, PSP und BidBlitz werden hier zur manuellen Prüfung gesammelt.</p>
          <div className="mt-4 overflow-hidden rounded-3xl border border-white/10">
            <div className="grid grid-cols-[1.1fr_1fr_auto_auto] gap-3 border-b border-white/10 bg-white/[0.05] px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
              <div>Case / Transaction</div><div>Station</div><div>Differenz</div><div>Status</div>
            </div>
            {reconciliation.map((item) => (
              <button key={item.case_id} onClick={() => onNavigate?.("/admin/fuel/reconciliation/" + item.case_id)} className="grid w-full grid-cols-[1.1fr_1fr_auto_auto] items-center gap-3 border-b border-white/5 px-4 py-4 text-left last:border-0 hover:bg-white/[0.03]">
                <div className="min-w-0"><div className="truncate font-bold">{item.case_id}</div><div className="mt-1 truncate text-xs text-slate-500">{item.transaction_id}</div></div>
                <div className="truncate text-sm text-slate-300">{item.station_id}</div>
                <div className={item.severity === "high" ? "font-black text-red-300" : "font-black text-amber-200"}>{item.difference} EUR</div>
                <div className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-bold text-slate-300">{item.status}</div>
              </button>
            ))}
            {!loading && !reconciliation.length && <div className="p-6 text-sm text-slate-500">Keine offenen Reconciliation-Fälle.</div>}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-center gap-2">
            <Activity size={20} className="text-amber-300" />
            <h2 className="text-2xl font-black">Persistierte Fuel Sessions</h2>
          </div>
          <p className="mt-2 text-sm text-slate-500">Persistenz: <b className={persistence?.enabled ? "text-emerald-300" : "text-amber-200"}>{persistence?.enabled ? "AKTIV" : "AUS"}</b> · bestehende BidBlitz MongoDB · Collection fuel_sessions</p>
          <div className="mt-4 overflow-hidden rounded-3xl border border-white/10">
            <div className="grid grid-cols-[1.2fr_1fr_auto_auto] gap-3 border-b border-white/10 bg-white/[0.05] px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
              <div>Session</div><div>Station</div><div>Status</div><div>Version</div>
            </div>
            {sessions.map((session) => (
              <div key={session.session_id} className="grid grid-cols-[1.2fr_1fr_auto_auto] items-center gap-3 border-b border-white/5 px-4 py-4 last:border-0">
                <div className="min-w-0"><div className="truncate font-bold">{session.session_id}</div><div className="mt-1 truncate text-xs text-slate-500">{session.provider}</div></div>
                <div className="truncate text-sm text-slate-300">{session.station_id}</div>
                <div className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-bold text-slate-300">{session.state}</div>
                <div className="text-xs text-slate-500">v{session.version}</div>
              </div>
            ))}
            {!loading && !sessions.length && <div className="p-6 text-sm text-slate-500">Noch keine persistierten Fuel-Sessions vorhanden.</div>}
          </div>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <WalletCards className="text-amber-300" />
            <h3 className="mt-4 font-black">Payment</h3>
            <p className="mt-2 text-sm text-slate-400">BidBlitz Pay/PSP bleibt bis zu Partner-, PSP- und Vertragsfreigaben deaktiviert.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <Network className="text-amber-300" />
            <h3 className="mt-4 font-black">Multi-Network</h3>
            <p className="mt-2 text-sm text-slate-400">Jeder Provider wird separat onboarded und nur mit bestätigten Fähigkeiten freigeschaltet.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <ShieldCheck className="text-amber-300" />
            <h3 className="mt-4 font-black">Fail Closed</h3>
            <p className="mt-2 text-sm text-slate-400">Unklare Payment- oder Pumpenzustände werden nicht automatisch erneut ausgeführt.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
