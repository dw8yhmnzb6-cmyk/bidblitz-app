import React, { useMemo, useState } from "react";
import { ArrowLeft, Database, Fuel, ShieldCheck } from "lucide-react";
import { previewDkvRequestPlan } from "../services/fuelApi";

const datasets = [
  "invoice_data",
  "unsettled_data",
  "consumption_data",
  "online_authorization_data",
  "service_card_master_data",
  "toll_product_master_data",
];

export default function AdminFuelDkvPreviewPage({ onNavigate }) {
  const [customerId, setCustomerId] = useState("");
  const [dataset, setDataset] = useState("invoice_data");
  const [productionApproved, setProductionApproved] = useState(false);
  const [technicalUser, setTechnicalUser] = useState(false);
  const [limit, setLimit] = useState("25");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const enabledDatasets = useMemo(() => datasets, []);

  const preview = async () => {
    setError("");
    const response = await previewDkvRequestPlan({
      customer_id: customerId,
      dataset,
      enabled_datasets: enabledDatasets,
      production_access_approved: productionApproved,
      technical_user_configured: technicalUser,
      query: { limit: Number(limit) || 25 },
    });
    if (response.ok) setResult(response);
    else {
      setResult(null);
      setError(response.error);
    }
  };

  return (
    <div className="min-h-screen bg-[#06101D] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <button onClick={() => onNavigate?.("/admin/fuel/provider/dkv")} className="rounded-xl bg-white/5 p-2"><ArrowLeft size={20} /></button>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-slate-950"><Fuel size={22} /></div>
          <div><div className="font-black">DKV Enterprise API Preview</div><div className="text-xs text-slate-500">Kein echter API-Aufruf</div></div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
          <div className="flex gap-3"><ShieldCheck className="shrink-0" size={20} /><div><b>Preview only</b><div className="mt-1 text-amber-100/70">Wir bauen nur den Request-Plan. Es wird keine Verbindung zu DKV hergestellt und kein Produktionsendpoint aufgerufen.</div></div></div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-300">DKV Customer ID
            <input value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 p-3" placeholder="customer-id" />
          </label>
          <label className="text-sm text-slate-300">Dataset
            <select value={dataset} onChange={(e) => setDataset(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0A1525] p-3">
              {datasets.map((v) => <option key={v}>{v}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-300">Limit
            <input value={limit} onChange={(e) => setLimit(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 p-3" />
          </label>
          <div className="grid gap-3">
            <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4"><span className="text-sm">Production access approved</span><input type="checkbox" checked={productionApproved} onChange={(e) => setProductionApproved(e.target.checked)} /></label>
            <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4"><span className="text-sm">Technical user configured</span><input type="checkbox" checked={technicalUser} onChange={(e) => setTechnicalUser(e.target.checked)} /></label>
          </div>
        </section>

        <button onClick={preview} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-4 font-black text-slate-950"><Database size={20} /> DKV Request-Plan prüfen</button>

        {error && <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">{error}</div>}

        {result?.plan && (
          <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-xl font-black">Request-Plan</h2>
            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div>Customer: <b>{result.plan.customer_id}</b></div>
              <div>Dataset: <b>{result.plan.dataset}</b></div>
              <div>Method: <b>{result.plan.method}</b></div>
              <div>Content-Type: <b>{result.plan.content_type}</b></div>
              <div className="sm:col-span-2">Query: <code className="rounded bg-black/20 px-2 py-1">{JSON.stringify(result.plan.query)}</code></div>
            </div>
            <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
              execution_enabled = false · Kein DKV Call wurde ausgeführt.
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
