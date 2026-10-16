import React from "react";
import { ArrowLeft, ShieldCheck, PlugZap, Clock3 } from "lucide-react";

export default function ProviderUnavailablePage({
  title,
  description,
  onBack,
  providerLabel = "verifizierter Finanz-/Custody-Provider",
}) {
  return (
    <div className="min-h-screen bg-[#07090F] text-white pb-24" data-testid="provider-unavailable-page">
      <div className="sticky top-0 z-30 border-b border-white/5 bg-[#07090F]/95 px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5"
            data-testid="provider-unavailable-back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-black">{title}</h1>
            <p className="text-[10px] text-amber-300">Noch nicht für echte Transaktionen aktiviert</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="rounded-[28px] border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-white/[0.02] p-6">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300">
            <PlugZap size={28} />
          </div>
          <h2 className="text-xl font-black">Live-Provider wird noch verbunden</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            {description || `Dieses Produkt wird erst freigeschaltet, wenn ein ${providerLabel} technisch und regulatorisch live verbunden ist.`}
          </p>

          <div className="mt-6 space-y-3">
            <div className="flex items-start gap-3 rounded-2xl bg-white/5 p-4">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-400" />
              <div>
                <p className="text-sm font-bold">Keine Fake-Transaktionen</p>
                <p className="mt-1 text-xs text-white/45">Bis zur Live-Anbindung werden weder Wallet-Guthaben noch Krypto-Bestände bewegt.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-white/5 p-4">
              <Clock3 size={18} className="mt-0.5 shrink-0 text-cyan-400" />
              <div>
                <p className="text-sm font-bold">Vorbereitet für Live-Betrieb</p>
                <p className="mt-1 text-xs text-white/45">Die Funktion kann nach Provider-, Compliance- und Settlement-Integration freigeschaltet werden.</p>
              </div>
            </div>
          </div>

          <button
            onClick={onBack}
            className="mt-6 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-black"
          >
            Zurück zu BidBlitz
          </button>
        </div>
      </div>
    </div>
  );
}
