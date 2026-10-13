import React, { useState } from "react";
import { Calculator, ShieldCheck } from "lucide-react";
import { previewFuelCommercialOffer } from "../services/fuelCommercialPreviewApi";

const defaults = {
  monthly_turnover: "100000",
  price_per_liter: "2.20",
  percent_rate: "0.2",
  cent_per_liter: "0.5",
  average_ticket: "50",
  psp_percent: "1.5",
  psp_fixed: "0.25",
  fee_basis: "gross",
  vat_percent: "19",
  payment_fee_owner: "operator",
};
const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const integer = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

function Field({ name, label, form, setForm, step = "0.01" }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-300">{label}</span>
      <input
        aria-label={label}
        type="number"
        min="0"
        step={step}
        value={form[name]}
        onChange={(event) => setForm((old) => ({ ...old, [name]: event.target.value }))}
        className="w-full rounded-xl border border-white/10 bg-[#0A1829] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-300"
      />
    </label>
  );
}
function Amount({ title, commission, net, negative }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0A1829] p-4">
      <div className="text-sm font-semibold text-slate-300">{title}</div>
      <div className="mt-2 text-2xl font-black text-white">{euro.format(Number(commission))}</div>
      <div className="mt-1 text-xs text-slate-500">Provisionsumsatz vor Kosten</div>
      <div className={"mt-3 font-bold " + (negative ? "text-red-300" : "text-emerald-300")}>
        {euro.format(Number(net))}
      </div>
      <div className="text-xs text-slate-500">Nach zugeordneten PSP-Kosten; kein Reingewinn</div>
    </div>
  );
}

export default function FuelCommercialPreviewPanel() {
  const [form, setForm] = useState(defaults);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    const reply = await previewFuelCommercialOffer(form);
    if (reply.ok) setResult(reply);
    else setError(reply.error || "Berechnung fehlgeschlagen");
    setLoading(false);
  }

  return (
    <section className="mt-10 rounded-3xl border border-amber-300/20 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calculator size={20} className="text-amber-300" />
          <h2 className="text-xl font-black">Tankstellen-Provisionsrechner</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
          <ShieldCheck size={14} /> NUR ANGEBOT · KEINE ZAHLUNG
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-400">
        Prozent und Cent pro Liter als alternative Vertragsmodelle vergleichen. Alle Werte sind unverbindliche Annahmen.
      </p>
      <form onSubmit={submit} className="mt-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field name="monthly_turnover" label="Monatlicher Brutto-Tankumsatz (€)" form={form} setForm={setForm} />
          <Field name="price_per_liter" label="Bruttopreis pro Liter (€)" form={form} setForm={setForm} step="0.001" />
          <Field name="percent_rate" label="Provision auf Umsatz (%)" form={form} setForm={setForm} step="0.05" />
          <Field name="cent_per_liter" label="Provision je Liter (Cent)" form={form} setForm={setForm} step="0.1" />
          <Field name="average_ticket" label="Durchschnittlicher Tankbeleg (€)" form={form} setForm={setForm} />
          <Field name="psp_percent" label="Angenommene Kartengebühr (%)" form={form} setForm={setForm} />
          <Field name="psp_fixed" label="Fixkosten pro Zahlung (€)" form={form} setForm={setForm} />
          <Field name="vat_percent" label="Umsatzsteuerannahme (%)" form={form} setForm={setForm} />
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-300">Prozent-Berechnungsbasis</span>
            <select aria-label="Prozent-Berechnungsbasis" value={form.fee_basis} onChange={(e) => setForm((s) => ({ ...s, fee_basis: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#0A1829] px-3 py-2.5 text-sm text-white">
              <option value="gross">Bruttoumsatz</option>
              <option value="net">Nettoumsatz (ohne angenommene USt.)</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-300">Wer trägt Kartengebühren?</span>
            <select aria-label="Kartengebühren-Träger" value={form.payment_fee_owner} onChange={(e) => setForm((s) => ({ ...s, payment_fee_owner: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#0A1829] px-3 py-2.5 text-sm text-white">
              <option value="operator">Tankstellenpartner</option>
              <option value="bidblitz">BidBlitz</option>
              <option value="shared">50/50 geteilt</option>
            </select>
          </label>
        </div>
        <button type="submit" disabled={loading} className="mt-5 rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-amber-300 disabled:opacity-50">
          {loading ? "Berechne…" : "Provisionsmodelle vergleichen"}
        </button>
      </form>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
      {result && (
        <div className="mt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Amount title={form.percent_rate + " % vom " + (result.percentage_basis === "gross" ? "Brutto-" : "Netto-") + "Umsatz"} commission={result.percentage_model.commission_before_cost} net={result.percentage_model.after_allocated_psp_cost} negative={Number(result.percentage_model.after_allocated_psp_cost) < 0} />
            <Amount title={form.cent_per_liter + " Cent/Liter"} commission={result.per_liter_model.commission_before_cost} net={result.per_liter_model.after_allocated_psp_cost} negative={Number(result.per_liter_model.after_allocated_psp_cost) < 0} />
          </div>
          <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
            <div>Volumen: <b>{integer.format(Number(result.estimated_liters))} L</b></div>
            <div>Tankvorgänge: <b>{integer.format(result.estimated_transactions)}</b></div>
            <div>Angenommene PSP-Kosten gesamt: <b>{euro.format(Number(result.estimated_psp_cost))}</b></div>
            <div>Davon BidBlitz: <b>{euro.format(Number(result.bidblitz_psp_cost))}</b></div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Gleichstand bei rund {result.break_even_percentage_rate} % oder {result.break_even_cents_per_liter} Cent/Liter.
            Nicht enthalten: weitere Betriebskosten, Unternehmenssteuern und die vertraglich tatsächlich geltenden PSP-Gebühren.
            Es wird keine Buchung, Auszahlung oder Freigabe durchgeführt.
          </p>
        </div>
      )}
    </section>
  );
}
