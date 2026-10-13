import React, { useEffect, useState } from "react";
import { Building2, Fuel, Gauge, WalletCards, AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { getFuelOperatorOverview } from "../services/fuelApi";

function Metric({ label, value, hint, icon: Icon }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        <Icon size={20} className="text-amber-300" />
      </div>
      <div className="mt-3 text-3xl font-black text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export default function FuelOperatorDashboardPage({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const result = await getFuelOperatorOverview();
      if (mounted) {
        setData(result.ok ? result : null);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const metrics = data?.metrics || {};

  return (
    <div className="min-h-screen bg-[#07111F] text-white">
      <header className="border-b border-white/10 bg-[#07111F]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4">
          <button onClick={() => onNavigate?.("/fuel")} className="rounded-xl bg-white/5 p-2 hover:bg-white/10">
            <ArrowLeft size={20} />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-slate-950">
            <Fuel size={22} />
          </div>
          <div>
            <div className="font-black">BidBlitz Fuel Operator</div>
            <div className="text-xs text-slate-500">DEV Simulator · kein echtes Settlement</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-bold">Sicherer Entwicklungsmodus</div>
              <p className="mt-1 text-amber-100/70">
                Alle Werte sind synthetisch. Es werden keine echten Betreiber ausgezahlt und keine Kundengelder verarbeitet.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">Operator Dashboard</p>
            <h1 className="mt-2 text-3xl font-black">{data?.operator?.name || "Fuel Operator"}</h1>
          </div>
          <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
            DEV ONLINE
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Stationen" value={loading ? "…" : metrics.stations ?? 0} hint="Simulator" icon={Building2} />
          <Metric label="Online" value={loading ? "…" : metrics.online_stations ?? 0} hint="mind. eine Pumpe erreichbar" icon={CheckCircle2} />
          <Metric label="Tankvorgänge heute" value={metrics.transactions_today ?? 0} hint="echte Zahlungen deaktiviert" icon={Gauge} />
          <Metric label="Operator Netto heute" value={`${metrics.operator_net_today || "0.00"} ${metrics.currency || "EUR"}`} hint="nur Reporting-Modell" icon={WalletCards} />
        </div>

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">Netzwerk</p>
              <h2 className="mt-2 text-2xl font-black">Stationen</h2>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-3xl border border-white/10">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-white/10 bg-white/[0.05] px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
              <div>Station</div>
              <div>Freie Pumpen</div>
              <div>Status</div>
            </div>
            {(data?.stations || []).map((station) => (
              <div key={station.station_id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-white/5 px-4 py-4 last:border-0">
                <div>
                  <div className="font-bold">{station.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{station.station_id}</div>
                </div>
                <div className="text-sm font-bold text-slate-300">
                  {station.available_pumps}/{station.pump_count}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${station.status === "online" ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"}`}>
                  {station.status === "online" ? "Online" : "Offline"}
                </span>
              </div>
            ))}
            {!loading && !(data?.stations || []).length && (
              <div className="p-6 text-sm text-slate-500">Keine Stationen vorhanden.</div>
            )}
          </div>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <h3 className="font-black">Settlement-Modell</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Betreiber bleibt Merchant/Supplier of Record. Der PSP verteilt Betreiberanteil, Paymentkosten und BidBlitz-Provision nach Vertragsregel.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <h3 className="font-black">Nächster Freigabeschritt</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Erst nach Vertrag, KYC/PSP-Onboarding, Sandbox-Tests und Zertifizierung darf ein Betreiber auf LIVE gesetzt werden.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
