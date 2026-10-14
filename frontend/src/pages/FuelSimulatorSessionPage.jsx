import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Fuel, ShieldCheck, CreditCard, Play, CheckCircle2, ReceiptText, AlertTriangle } from "lucide-react";
import { advanceFuelSimulatorSession, getFuelSimulatorReceipt, getFuelSimulatorSession } from "../services/fuelApi";

const stepOrder = ["pump_selected", "payment_authorized", "fueling", "amount_confirmed", "capture_pending", "paid", "closed"];

export default function FuelSimulatorSessionPage({ sessionId, onNavigate }) {
  const [session, setSession] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reload = async () => {
    const result = await getFuelSimulatorSession(sessionId);
    if (result.ok) setSession(result);
    else setError(result.error);
  };

  useEffect(() => { reload(); }, [sessionId]);
  const stateIndex = useMemo(() => stepOrder.indexOf(session?.state), [session?.state]);

  const act = async (action, options) => {
    setBusy(true); setError("");
    const result = await advanceFuelSimulatorSession(sessionId, action, options);
    if (result.ok) {
      setSession(result);
      if (result.state === "closed") {
        const r = await getFuelSimulatorReceipt(sessionId);
        if (r.ok) setReceipt(r);
      }
    } else setError(result.error);
    setBusy(false);
  };

  const nextAction = session?.state === "pump_selected"
    ? ["authorize", "Demo-Autorisierung ausführen", CreditCard]
    : session?.state === "payment_authorized"
      ? ["start", "Demo-Tankvorgang starten", Play]
      : session?.state === "fueling"
        ? ["complete", "31,7 L Demo-Tankvorgang abschließen", CheckCircle2]
        : null;

  return (
    <div className="min-h-screen bg-[#06101D] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <button onClick={() => onNavigate?.("/fuel")} className="rounded-xl bg-white/5 p-2 hover:bg-white/10"><ArrowLeft size={20} /></button>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-slate-950"><Fuel size={22} /></div>
          <div><div className="font-black">BidBlitz Fuel Simulator</div><div className="text-xs text-slate-500">{sessionId}</div></div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-3xl border border-amber-300/25 bg-amber-300/10 p-4">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-amber-300" size={20} /><div><div className="font-bold text-amber-100">Nur Simulation</div><p className="mt-1 text-sm text-amber-100/70">Keine Karte wird autorisiert, kein echtes Geld bewegt und keine echte Zapfsäule freigegeben.</p></div></div>
        </div>

        {session && (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:col-span-2">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Tankvorgang</p>
                <h1 className="mt-2 text-3xl font-black">{session.station_name}</h1>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div><div className="text-xs text-slate-500">Zapfsäule</div><div className="mt-1 text-xl font-black">{session.pump_number}</div></div>
                  <div><div className="text-xs text-slate-500">Kraftstoff</div><div className="mt-1 text-xl font-black">{session.fuel_name}</div></div>
                  <div><div className="text-xs text-slate-500">Preis</div><div className="mt-1 text-xl font-black">{session.unit_price} {session.currency}/L</div></div>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="text-xs text-slate-500">Status</div>
                <div className="mt-2 break-words text-lg font-black uppercase text-emerald-300">{session.state}</div>
                <div className="mt-4 text-xs text-slate-500">Real Payment</div><div className="mt-1 font-bold text-red-300">NEIN</div>
              </div>
            </section>

            <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="font-black">Session-Verlauf</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {stepOrder.map((step, index) => <span key={step} className={"rounded-full px-3 py-1.5 text-xs font-bold " + (index <= stateIndex ? "bg-emerald-400/10 text-emerald-300" : "bg-white/5 text-slate-600")}>{step}</span>)}
              </div>
            </section>

            {nextAction && <button disabled={busy} onClick={() => act(nextAction[0], nextAction[0] === "complete" ? { demoLiters: "31.700" } : {})} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-4 font-black text-slate-950 disabled:opacity-50">{React.createElement(nextAction[2], { size: 20 })}{busy ? "Wird simuliert…" : nextAction[1]}</button>}

            {session.state === "closed" && <section className="mt-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5"><div className="flex items-center gap-2 text-emerald-300"><CheckCircle2 size={22} /><h2 className="text-xl font-black">Demo-Tankvorgang abgeschlossen</h2></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div><div className="text-xs text-emerald-100/60">Liter</div><div className="text-2xl font-black">{session.liters}</div></div><div><div className="text-xs text-emerald-100/60">Betrag</div><div className="text-2xl font-black">{session.gross_amount} {session.currency}</div></div><div><div className="text-xs text-emerald-100/60">Beleg</div><div className="text-sm font-bold">{session.receipt_id || "wird erstellt"}</div></div></div></section>}

            {receipt?.receipt && <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5"><div className="flex items-center gap-2"><ReceiptText className="text-amber-300" /><h2 className="text-xl font-black">Simulierter Betreiber-Beleg</h2></div><p className="mt-1 text-xs text-slate-500">Kein fiskalischer Beleg. Ausstellerrolle bleibt Betreiber.</p><div className="mt-5 grid gap-2 text-sm sm:grid-cols-2"><div>Betreiber: <b>{receipt.receipt.operator_name}</b></div><div>Station: <b>{receipt.receipt.station_name}</b></div><div>Zapfsäule: <b>{receipt.receipt.pump_number}</b></div><div>Kraftstoff: <b>{receipt.receipt.fuel_name}</b></div><div>Liter: <b>{receipt.receipt.liters}</b></div><div>Gesamt: <b>{receipt.receipt.gross_amount} {receipt.receipt.currency}</b></div></div></section>}
          </>
        )}

        {error && <div className="mt-6 flex gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"><AlertTriangle size={18} className="shrink-0" /> {error}</div>}
      </main>
    </div>
  );
}
