import React, { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Fuel, ShieldCheck, XCircle } from "lucide-react";
import { getFuelAdminContract, getFuelProviderContractTemplate, getFuelProviderOnboardingDetail } from "../services/fuelApi";

function Flag({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <span className="text-sm text-slate-300">{label}</span>
      <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold " + (
        value ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"
      )}>
        {value ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
        {value ? "JA" : "NEIN"}
      </span>
    </div>
  );
}

export default function AdminFuelProviderDetailPage({ providerName, onNavigate }) {
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [storedContract, setStoredContract] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [result, contractResult, storedResult] = await Promise.all([
        getFuelProviderOnboardingDetail(providerName),
        getFuelProviderContractTemplate(providerName),
        getFuelAdminContract(providerName),
      ]);
      if (!mounted) return;
      if (result.ok) setProvider(result.provider);
      else setError(result.error);
      if (contractResult.ok) setContract(contractResult.contract);
      if (storedResult.ok) setStoredContract(storedResult.contract || null);
    })();
    return () => { mounted = false; };
  }, [providerName]);

  return (
    <div className="min-h-screen bg-[#06101D] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <button onClick={() => onNavigate?.("/admin/fuel")} className="rounded-xl bg-white/5 p-2 hover:bg-white/10">
            <ArrowLeft size={20} />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-slate-950"><Fuel size={22} /></div>
          <div>
            <div className="font-black">Fuel Provider Detail</div>
            <div className="text-xs text-slate-500">DEV Onboarding Matrix</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {provider && (
          <>
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">Provider</p>
                <h1 className="mt-2 text-4xl font-black uppercase">{provider.provider}</h1>
                <p className="mt-2 text-sm text-slate-400">{provider.notes}</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300">{provider.stage}</div>
            </div>

            <section className="mt-8 grid gap-3 md:grid-cols-2">
              <Flag label="API bestätigt" value={provider.api_confirmed} />
              <Flag label="Tankstellensuche bestätigt" value={provider.station_discovery_confirmed} />
              <Flag label="Fueling bestätigt" value={provider.fueling_confirmed} />
              <Flag label="Payment bestätigt" value={provider.payment_confirmed} />
              <Flag label="Revenue Share bestätigt" value={provider.revenue_share_confirmed} />
              <Flag label="Split Settlement bestätigt" value={provider.split_settlement_confirmed} />
              <Flag label="Sandbox bestätigt" value={provider.sandbox_confirmed} />
              <Flag label="Vertrag unterschrieben" value={provider.contract_signed} />
              <Flag label="Credentials konfiguriert" value={provider.credentials_configured} />
            </section>

            <section className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <h2 className="font-black">Discovery Status</h2>
                <div className={"mt-3 text-2xl font-black " + (provider.can_enable_discovery ? "text-emerald-300" : "text-red-300")}>
                  {provider.can_enable_discovery ? "READY" : "BLOCKED"}
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <h2 className="font-black">Fueling Status</h2>
                <div className={"mt-3 text-2xl font-black " + (provider.can_enable_fueling ? "text-emerald-300" : "text-red-300")}>
                  {provider.can_enable_fueling ? "READY" : "BLOCKED"}
                </div>
              </div>
            </section>

            {storedContract && (
              <section className="mt-8 rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
                <h2 className="text-xl font-black text-emerald-300">Gespeicherte Vertragskonfiguration</h2>
                <p className="mt-1 text-xs text-emerald-100/60">Admin-DB-Konfiguration; Secrets werden hier nicht gespeichert.</p>
                <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div>Status: <b>{storedContract.state}</b></div>
                  <div>Referenz: <b>{storedContract.contract_reference || "—"}</b></div>
                  <div>Revenue Model: <b>{storedContract.commercial?.revenue_model}</b></div>
                  <div>Provision %: <b>{storedContract.commercial?.percentage}</b></div>
                  <div>Payment Fee Owner: <b>{storedContract.commercial?.payment_fee_owner}</b></div>
                  <div>Merchant of Record: <b>{storedContract.commercial?.merchant_of_record}</b></div>
                  <div>Discovery Ready: <b>{storedContract.discovery_ready ? "JA" : "NEIN"}</b></div>
                  <div>Fueling Ready: <b>{storedContract.fueling_ready ? "JA" : "NEIN"}</b></div>
                </div>
              </section>
            )}

            {contract && (
              <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <h2 className="text-xl font-black">Vertrags-Template</h2>
                <p className="mt-1 text-xs text-slate-500">Nur Vorlage – keine Kondition gilt als vereinbart.</p>
                <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div>Status: <b>{contract.state}</b></div>
                  <div>Revenue Model: <b>{contract.commercial?.revenue_model}</b></div>
                  <div>Payment Fee Owner: <b>{contract.commercial?.payment_fee_owner}</b></div>
                  <div>Merchant of Record: <b>{contract.commercial?.merchant_of_record}</b></div>
                  <div>Supplier of Record: <b>{contract.commercial?.supplier_of_record}</b></div>
                  <div>Währung: <b>{contract.commercial?.currency}</b></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(contract.territories || []).length ? contract.territories.map((country) => <span key={country} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300">{country}</span>) : <span className="text-xs text-slate-500">Noch keine Vertragsgebiete hinterlegt.</span>}
                </div>
              </section>
            )}

            <div className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 shrink-0 text-amber-300" />
                <div>
                  <h3 className="font-black">Fail-Closed</h3>
                  <p className="mt-1 text-sm text-amber-100/70">Solange Vertrag, Credentials und bestätigte Funktionen fehlen, bleibt dieser Provider für echte Tankvorgänge gesperrt.</p>
                </div>
              </div>
            </div>
          </>
        )}

        {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">{error}</div>}
      </main>
    </div>
  );
}
