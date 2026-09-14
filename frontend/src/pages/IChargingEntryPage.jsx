import React from "react";

export default function IChargingEntryPage({ onLogin, onRegister, onNavigate }) {
  return (
    <div className="min-h-screen bg-[#050505] text-white px-5 py-8" data-testid="icharging-entry-page">
      <div className="mx-auto max-w-lg space-y-6">
        <button onClick={() => onNavigate?.("/")} className="text-sm text-gray-400 hover:text-white">← Zurück zu BidBlitz</button>
        <div className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/15 via-[#111] to-fuchsia-500/10 p-6 shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">iCharging · Mobility by BidBlitz</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Elektrisch durch deine Stadt.</h1>
          <p className="mt-3 text-sm leading-6 text-gray-300">Ein Konto für BidBlitz, iCharging, Wallet und Bezahlung. Melde dich an oder erstelle kostenlos dein BidBlitz-Konto, um ein Fahrzeug zu mieten.</p>
          <div className="mt-6 grid gap-3">
            <button onClick={onLogin} className="w-full rounded-2xl bg-cyan-400 px-4 py-3.5 font-bold text-black transition hover:bg-cyan-300" data-testid="icharging-login">Mit BidBlitz anmelden</button>
            <button onClick={onRegister} className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 font-bold text-white transition hover:bg-white/10" data-testid="icharging-register">BidBlitz-Konto erstellen</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center text-xs text-gray-400"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">🛴<br/>Scooter</div><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">🔋<br/>E-Roller</div><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">🚲<br/>E-Bike</div></div>
        <p className="text-center text-[11px] leading-5 text-gray-500">iCharging ist eine Mobilitätsmarke von BidBlitz. Deine Anmeldung, dein Wallet und deine Belege bleiben zentral in BidBlitz.</p>
      </div>
    </div>
  );
}
