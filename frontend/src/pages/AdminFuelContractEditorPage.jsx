import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Fuel, Save, ShieldCheck } from "lucide-react";
import { getFuelAdminContract, getFuelProviderContractTemplate, saveFuelAdminContract } from "../services/fuelApi";

const rightLabels = {
  api: "API-Rechte",
  station_discovery: "Tankstellensuche",
  fueling: "Fueling",
  white_label: "White Label",
  payment: "Payment",
  split_settlement: "Split Settlement",
  receipt_responsibility_confirmed: "Belegverantwortung bestätigt",
};

export default function AdminFuelContractEditorPage({ providerName, onNavigate }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [stored, template] = await Promise.all([
        getFuelAdminContract(providerName),
        getFuelProviderContractTemplate(providerName),
      ]);
      if (!mounted) return;
      const source = stored.ok && stored.contract ? stored.contract : template.contract;
      setForm({
        state: source?.state || "draft",
        territories: (source?.territories || []).join(","),
        rights: {
          api: !!source?.rights?.api,
          station_discovery: !!source?.rights?.station_discovery,
          fueling: !!source?.rights?.fueling,
          white_label: !!source?.rights?.white_label,
          payment: !!source?.rights?.payment,
          split_settlement: !!source?.rights?.split_settlement,
          receipt_responsibility_confirmed: !!source?.rights?.receipt_responsibility_confirmed,
        },
        commercial: {
          revenue_model: source?.commercial?.revenue_model || "none",
          percentage: source?.commercial?.percentage || "0",
          per_liter: source?.commercial?.per_liter || "0",
          per_transaction: source?.commercial?.per_transaction || "0",
          monthly_fee: source?.commercial?.monthly_fee || "0",
          payment_fee_owner: source?.commercial?.payment_fee_owner || "operator",
          merchant_of_record: source?.commercial?.merchant_of_record || "operator",
          supplier_of_record: source?.commercial?.supplier_of_record || "operator",
          currency: source?.commercial?.currency || "EUR",
        },
        contract_reference: source?.contract_reference || "",
        effective_from: source?.effective_from || "",
        effective_until: source?.effective_until || "",
      });
    })();
    return () => { mounted = false; };
  }, [providerName]);

  const parsedTerritories = useMemo(() => (form?.territories || "")
    .split(",")
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean), [form?.territories]);

  const save = async () => {
    setSaving(true);
    setMessage("");
    const payload = {
      ...form,
      territories: parsedTerritories,
    };
    const result = await saveFuelAdminContract(providerName, payload);
    setSaving(false);
    setMessage(result.ok ? "Vertragskonfiguration gespeichert. LIVE bleibt weiterhin separat gesperrt." : result.error);
  };

  if (!form) return <div className="min-h-screen bg-[#06101D] p-8 text-slate-400">Vertragseditor wird geladen…</div>;

  return (
    <div className="min-h-screen bg-[#06101D] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <button onClick={() => onNavigate?.("/admin/fuel/provider/" + providerName)} className="rounded-xl bg-white/5 p-2"><ArrowLeft size={20} /></button>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-slate-950"><Fuel size={22} /></div>
          <div><div className="font-black">Fuel Vertragseditor</div><div className="text-xs uppercase text-slate-500">{providerName}</div></div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
          <div className="flex gap-3"><ShieldCheck className="shrink-0" size={20} /><div><b>Admin-Konfiguration, keine Live-Freigabe.</b><div className="mt-1 text-amber-100/70">API-Keys und Secrets werden hier bewusst nicht gespeichert.</div></div></div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-300">Status
            <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0A1525] p-3">
              {["draft","under_review","signed","suspended","terminated"].map((v) => <option key={v}>{v}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-300">Vertragsreferenz
            <input value={form.contract_reference} onChange={(e) => setForm({ ...form, contract_reference: e.target.value })} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 p-3" placeholder="z. B. DKV-2026-001" />
          </label>
          <label className="text-sm text-slate-300 md:col-span-2">Gebiete (ISO-Ländercodes, Komma)
            <input value={form.territories} onChange={(e) => setForm({ ...form, territories: e.target.value })} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 p-3" placeholder="DE, AT, NL" />
          </label>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-black">Vertragsrechte</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {Object.entries(rightLabels).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <span className="text-sm">{label}</span>
                <input type="checkbox" checked={!!form.rights[key]} onChange={(e) => setForm({ ...form, rights: { ...form.rights, [key]: e.target.checked } })} />
              </label>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-black">Kommerzielle Konditionen</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-300">Revenue Model
              <select value={form.commercial.revenue_model} onChange={(e) => setForm({ ...form, commercial: { ...form.commercial, revenue_model: e.target.value } })} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0A1525] p-3">
                {["none","percentage","per_liter","per_transaction","monthly","hybrid"].map((v) => <option key={v}>{v}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate-300">Provision %
              <input value={form.commercial.percentage} onChange={(e) => setForm({ ...form, commercial: { ...form.commercial, percentage: e.target.value } })} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 p-3" />
            </label>
            <label className="text-sm text-slate-300">Pro Liter
              <input value={form.commercial.per_liter} onChange={(e) => setForm({ ...form, commercial: { ...form.commercial, per_liter: e.target.value } })} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 p-3" />
            </label>
            <label className="text-sm text-slate-300">Pro Transaktion
              <input value={form.commercial.per_transaction} onChange={(e) => setForm({ ...form, commercial: { ...form.commercial, per_transaction: e.target.value } })} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 p-3" />
            </label>
            <label className="text-sm text-slate-300">Monatliche Gebühr
              <input value={form.commercial.monthly_fee} onChange={(e) => setForm({ ...form, commercial: { ...form.commercial, monthly_fee: e.target.value } })} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 p-3" />
            </label>
            <label className="text-sm text-slate-300">Payment Fee Owner
              <select value={form.commercial.payment_fee_owner} onChange={(e) => setForm({ ...form, commercial: { ...form.commercial, payment_fee_owner: e.target.value } })} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0A1525] p-3">
                {["operator","bidblitz","shared"].map((v) => <option key={v}>{v}</option>)}
              </select>
            </label>
          </div>
        </section>

        {message && <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">{message}</div>}
        <button disabled={saving} onClick={save} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-4 font-black text-slate-950 disabled:opacity-50"><Save size={20} />{saving ? "Speichert…" : "Vertragskonfiguration speichern"}</button>
      </main>
    </div>
  );
}
