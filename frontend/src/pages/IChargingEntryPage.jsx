import React from "react";

const cities = [
  { name: "Prishtina", country: "Kosovo", tag: "Pilotstadt" },
  { name: "Ferizaj", country: "Kosovo", tag: "In Vorbereitung" },
  { name: "Prizren", country: "Kosovo", tag: "In Vorbereitung" },
  { name: "Peja", country: "Kosovo", tag: "In Vorbereitung" },
  { name: "Gjilan", country: "Kosovo", tag: "In Vorbereitung" },
  { name: "Tirana", country: "Albanien", tag: "Expansion" },
  { name: "Podgorica", country: "Montenegro", tag: "Expansion" },
  { name: "Wien", country: "Österreich", tag: "Expansion" },
  { name: "Paris", country: "Frankreich", tag: "Expansion" },
  { name: "Dubai", country: "VAE", tag: "Expansion" },
  { name: "Abu Dhabi", country: "VAE", tag: "Expansion" },
];

const vehicleTypes = [
  ["🛴", "E-Scooter", "Für kurze Wege und den schnellen Stadtverkehr"],
  ["🔋", "E-Roller", "Komfortabel, leise und alltagstauglich"],
  ["🚲", "E-Bike", "Mehr Reichweite mit weniger Aufwand"],
];

export default function IChargingEntryPage({ onLogin, onRegister, onNavigate }) {
  return (
    <div className="min-h-screen bg-[#050505] px-5 py-6 text-white" data-testid="icharging-entry-page">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center justify-between">
          <button onClick={() => onNavigate?.("/")} className="text-sm text-gray-400 transition hover:text-white">← BidBlitz</button>
          <div className="flex gap-2 text-[10px] font-semibold tracking-widest text-gray-500" aria-label="Verfügbare Sprachen">
            <span className="rounded-full bg-white/10 px-2 py-1 text-cyan-300">DE</span><span>SQ</span><span>EN</span><span>FR</span><span>AR</span>
          </div>
        </header>

        <section className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-500/20 via-[#111827] to-fuchsia-500/20 p-7 shadow-2xl md:p-10" data-testid="icharging-hero">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">iCharging · Bezahlung mit BidBlitz</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">Elektrisch durch deine Stadt.</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-gray-300 md:text-lg">iCharging betreibt moderne E-Scooter, E-Roller und E-Bikes. Du findest, öffnest und beendest deine Fahrt über unsere Mobilitätsplattform.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button onClick={onLogin} className="rounded-2xl bg-cyan-400 px-5 py-3.5 font-bold text-black transition hover:bg-cyan-300" data-testid="icharging-login">Mit BidBlitz anmelden</button>
              <button onClick={onRegister} className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3.5 font-bold transition hover:bg-white/10" data-testid="icharging-register">BidBlitz-Konto erstellen</button>
            </div>
            <p className="mt-4 text-xs text-gray-500">Sicherer Zugang, Wallet und Bezahlung über BidBlitz. Die Vermietung bleibt bei iCharging.</p>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3" data-testid="icharging-vehicles">
          {vehicleTypes.map(([icon, title, copy]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-3xl">{icon}</div><h2 className="mt-3 font-bold">{title}</h2><p className="mt-1 text-sm leading-5 text-gray-400">{copy}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0b1018] p-6" data-testid="icharging-cities">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-widest text-fuchsia-300">Städte & Regionen</p><h2 className="mt-2 text-2xl font-black">Start in Kosovo. Ausbau in Europa und den VAE.</h2></div><span className="text-xs text-gray-500">11 geplante Standorte</span></div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {cities.map((city) => <div key={city.name} className="rounded-xl border border-white/8 bg-white/[0.03] p-3"><p className="font-semibold">{city.name}</p><p className="text-xs text-gray-500">{city.country}</p><p className="mt-2 text-[10px] uppercase tracking-wide text-cyan-300">{city.tag}</p></div>)}
          </div>
        </section>

        <footer className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center text-xs leading-5 text-gray-500">iCharging ist ein eigenständiger Mobilitätsanbieter und verantwortlich für Fahrzeuge, Vermietung, Preise und Betrieb. BidBlitz stellt ausschließlich Anmeldung, Wallet und Bezahlung bereit.</footer>
      </div>
    </div>
  );
}
