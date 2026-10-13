import React, { useEffect, useState } from "react";
import { ArrowLeft, AlertTriangle, CheckCircle2, Fuel, ShieldCheck } from "lucide-react";
import { getFuelReconciliationCase, updateFuelReconciliationCase } from "../services/fuelApi";

export default function AdminFuelReconciliationDetailPage({ caseId, onNavigate }) {
  const [item, setItem] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    const result = await getFuelReconciliationCase(caseId);
    if (result.ok) {
      setItem(result.case);
      setNote(result.case?.note || "");
    } else setMessage(result.error);
  };

  useEffect(() => { load(); }, [caseId]);

  const act = async (action) => {
    setBusy(true);
    setMessage("");
    const result = await updateFuelReconciliationCase(caseId, action, note);
    if (result.ok) {
      setItem(result.case);
      setMessage("Status gespeichert. Es wurde keine finanzielle Korrektur ausgeführt.");
    } else setMessage(result.error);
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-[#06101D] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <button onClick={() => onNavigate?.("/admin/fuel")} className="rounded-xl bg-white/5 p-2"><ArrowLeft size={20} /></button>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-slate-950"><Fuel size={22} /></div>
          <div><div className="font-black">Fuel Reconciliation Case</div><div className="text-xs text-slate-500">{caseId}</div></div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
          <div className="flex gap-3"><ShieldCheck className="shrink-0" size={20} /><div><b>Manuelle Prüfung</b><div className="mt-1 text-amber-100/70">Statusänderungen lösen niemals automatisch Zahlungen, Refunds oder PSP-Korrekturen aus.</div></div></div>
        </div>

        {item && (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="text-xs text-slate-500">Transaction</div>
                <div className="mt-1 font-black">{item.transaction_id}</div>
                <div className="mt-4 text-xs text-slate-500">Station</div>
                <div className="mt-1 font-bold">{item.station_id}</div>
                <div className="mt-4 text-xs text-slate-500">Provider</div>
                <div className="mt-1 font-bold">{item.provider}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="text-xs text-slate-500">Status</div>
                <div className="mt-1 text-2xl font-black uppercase">{item.status}</div>
                <div className="mt-4 text-xs text-slate-500">Severity</div>
                <div className={"mt-1 text-xl font-black " + (item.severity === "high" ? "text-red-300" : "text-amber-200")}>{item.severity}</div>
                <div className="mt-4 text-xs text-slate-500">Differenz</div>
                <div className="mt-1 text-2xl font-black">{item.difference} EUR</div>
              </div>
            </section>

            <section className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                ["POS / Forecourt", item.pos_amount],
                ["PSP", item.psp_amount],
                ["BidBlitz", item.bidblitz_amount],
              ].map(([label, value]) => (
                <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="mt-2 text-2xl font-black">{value} EUR</div>
                </div>
              ))}
            </section>

            <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <label className="text-sm text-slate-300">Prüfnotiz
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 p-3 outline-none" placeholder="Warum wurde der Fall geprüft / gelöst?" />
              </label>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <button disabled={busy || item.status !== "open"} onClick={() => act("reviewing")} className="rounded-2xl border border-amber-300/30 px-4 py-3 font-bold text-amber-200 disabled:opacity-40">In Prüfung</button>
                <button disabled={busy || !["open","reviewing"].includes(item.status)} onClick={() => act("resolved")} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 font-black text-slate-950 disabled:opacity-40"><CheckCircle2 size={18} /> Gelöst</button>
                <button disabled={busy || !["open","reviewing"].includes(item.status)} onClick={() => act("ignored")} className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-3 font-bold disabled:opacity-40"><AlertTriangle size={18} /> Ignorieren</button>
              </div>
            </section>
          </>
        )}

        {message && <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">{message}</div>}
      </main>
    </div>
  );
}
