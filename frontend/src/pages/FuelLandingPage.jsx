import React, { useEffect, useMemo, useState } from "react";
import { Fuel, MapPin, Search, ShieldCheck, WalletCards, Gift, Gauge, ChevronRight, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { getFuelStations, prepareFuelPump } from "../services/fuelApi";

const gold = "#F4B942";
const navy = "#07111F";

function PriceChip({ product }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-[11px] text-slate-400">{product.name}</div>
      <div className="text-base font-black text-white">{product.unit_price} {product.currency}/L</div>
    </div>
  );
}

function PumpBadge({ pump, onSelect }) {
  const free = pump.status === "free";
  const label = {
    free: "Frei",
    fueling: "Tankt",
    ready_to_pay: "Zahlungsbereit",
    out_of_order: "Außer Betrieb",
    offline: "Offline",
  }[pump.status] || "Unbekannt";

  return (
    <button
      disabled={!free}
      onClick={() => onSelect(pump)}
      data-testid={`fuel-pump-${pump.pump_id}`}
      className={`rounded-2xl border p-3 text-left transition ${free
        ? "border-emerald-400/40 bg-emerald-400/10 hover:bg-emerald-400/15"
        : "border-white/10 bg-white/5 opacity-60 cursor-not-allowed"}`}
    >
      <div className="text-xs text-slate-400">Zapfsäule</div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xl font-black text-white">{pump.number}</span>
        <span className={`text-[11px] font-bold ${free ? "text-emerald-300" : "text-slate-400"}`}>{label}</span>
      </div>
    </button>
  );
}

export default function FuelLandingPage({ onNavigate }) {
  const [stations, setStations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedPump, setSelectedPump] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const data = await getFuelStations("DE");
      if (!mounted) return;
      setStations(data.stations || []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter((s) => s.name.toLowerCase().includes(q));
  }, [stations, query]);

  const openStation = (station) => {
    setSelected(station);
    setSelectedPump(null);
    setMessage("");
  };

  const prepare = async () => {
    if (!selected || !selectedPump) return;
    const result = await prepareFuelPump(selected.station_id, selectedPump.pump_id);
    if (result.ok) {
      setMessage("DEV-Simulator bereit. BidBlitz Pay bleibt bis zur PSP- und Partnerfreigabe absichtlich gesperrt.");
    } else {
      setMessage(result.error || "Zapfsäule ist nicht verfügbar.");
    }
  };

  return (
    <div className="min-h-screen text-white" style={{ background: navy }}>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07111F]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <button onClick={() => onNavigate?.("/")} className="flex items-center gap-2" data-testid="fuel-brand-home">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-slate-950"><Fuel size={22} /></div>
            <div className="text-left">
              <div className="text-lg font-black tracking-tight">BidBlitz <span style={{ color: gold }}>FUEL</span></div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Fuel Network</div>
            </div>
          </button>
          <div className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="#stations" className="hover:text-white">Tankstellen</a>
            <a href="#how" className="hover:text-white">So funktioniert's</a>
            <a href="#business" className="hover:text-white">Für Betreiber</a>
          </div>
          <button onClick={() => onNavigate?.("/pay")} className="rounded-xl border border-amber-300/40 px-4 py-2 text-sm font-bold text-amber-200 hover:bg-amber-300/10">
            BidBlitz Pay
          </button>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-14 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs font-bold text-amber-200">
              <ShieldCheck size={15} /> DEV SAFE MODE · KEINE ECHTEN ZAHLUNGEN
            </div>
            <h1 className="max-w-3xl text-5xl font-black leading-[1.02] tracking-tight md:text-7xl">
              Tanken. Bezahlen. <span style={{ color: gold }}>Sparen.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Eine Oberfläche für Tankstellen, Preise, Zapfsäulen, BidBlitz Pay, digitale Belege und Cashback — vorbereitet für mehrere Fuel-Netzwerke.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#stations" className="rounded-2xl bg-amber-400 px-6 py-3 font-black text-slate-950 hover:bg-amber-300">Tankstelle finden</a>
              <button onClick={() => onNavigate?.("/pay")} className="rounded-2xl border border-white/15 px-6 py-3 font-bold text-white hover:bg-white/5">BidBlitz Pay öffnen</button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              [Search, "Preise vergleichen", "Einheitliches Stations- und Preisformat"],
              [WalletCards, "BidBlitz Pay", "Payment bleibt zentral und provider-neutral"],
              [Gift, "Cashback", "Provisionen flexibel nach Vertrag"],
              [Gauge, "Multi-Network", "PACE, Shell, DKV, HUTH, Hectronic, DFS u. a."],
            ].map(([Icon, title, desc]) => (
              <div key={title} className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
                <Icon size={24} style={{ color: gold }} />
                <h3 className="mt-4 font-black">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="stations" className="border-y border-white/10 bg-white/[0.025]">
          <div className="mx-auto max-w-7xl px-4 py-12">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">Fuel Simulator</p>
                <h2 className="mt-2 text-3xl font-black">Tankstellen & Zapfsäulen</h2>
                <p className="mt-2 text-sm text-slate-400">Nur synthetische DEV-Daten. Keine externen Anbieter werden aufgerufen.</p>
              </div>
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-3.5 text-slate-500" size={18} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tankstelle suchen..."
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 outline-none placeholder:text-slate-600 focus:border-amber-300/50"
                  data-testid="fuel-station-search"
                />
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {loading && <div className="rounded-3xl border border-white/10 p-6 text-slate-400">Stationen werden geladen…</div>}
              {!loading && filtered.map((station) => (
                <button
                  key={station.station_id}
                  onClick={() => openStation(station)}
                  className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-left transition hover:border-amber-300/30 hover:bg-white/[0.06]"
                  data-testid={`fuel-station-${station.station_id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-amber-300"><MapPin size={17} /><span className="text-xs font-bold">{station.country}</span></div>
                      <h3 className="mt-2 text-xl font-black">{station.name}</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {station.capabilities?.mobile_payment && <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">Mobiles Bezahlen vorbereitet</span>}
                        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-slate-400">{station.pumps?.length || 0} Zapfsäulen</span>
                      </div>
                    </div>
                    <ChevronRight className="text-slate-500" />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {(station.products || []).map((p) => <PriceChip key={p.code} product={p} />)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-7xl px-4 py-14">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">Ablauf</p>
          <h2 className="mt-2 text-3xl font-black">So funktioniert BidBlitz Fuel</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {[
              ["1", "Station finden", "Netzwerkübergreifend suchen und Preise vergleichen."],
              ["2", "Zapfsäule wählen", "Nur verfügbare und vertraglich freigegebene Pumpen."],
              ["3", "BidBlitz Pay", "Vorautorisierung und Split Settlement über freigegebenen PSP."],
              ["4", "Beleg & Cashback", "Beleg vom Betreiber, Provision separat für BidBlitz."],
            ].map(([n, title, desc]) => (
              <div key={n} className="rounded-3xl border border-white/10 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 font-black text-slate-950">{n}</div>
                <h3 className="mt-4 font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="business" className="border-t border-white/10 bg-gradient-to-r from-amber-400/10 to-transparent">
          <div className="mx-auto max-w-7xl px-4 py-12">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">Für Betreiber</p>
                <h2 className="mt-2 text-3xl font-black">Teil des BidBlitz Fuel Network werden</h2>
                <p className="mt-3 max-w-3xl text-slate-300">POS/Forecourt anbinden, direkte Betreiber-Auszahlung über PSP, BidBlitz erhält nur die vertraglich vereinbarte Plattformprovision.</p>
              </div>
              <button className="rounded-2xl bg-white px-6 py-3 font-black text-slate-950">Partner werden</button>
            </div>
          </div>
        </section>
      </main>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm md:items-center md:p-6">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0A1525] p-5 shadow-2xl md:rounded-3xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Simulator Station</p>
                <h3 className="mt-1 text-2xl font-black">{selected.name}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-xl bg-white/5 p-2 hover:bg-white/10"><X size={20} /></button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(selected.products || []).map((p) => <PriceChip key={p.code} product={p} />)}
            </div>

            <h4 className="mt-6 font-black">Zapfsäule auswählen</h4>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(selected.pumps || []).map((pump) => (
                <PumpBadge key={pump.pump_id} pump={pump} onSelect={setSelectedPump} />
              ))}
            </div>

            {selectedPump && (
              <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
                <div className="flex items-center gap-2 font-bold text-emerald-300"><CheckCircle2 size={18} /> Zapfsäule {selectedPump.number} ausgewählt</div>
                <p className="mt-1 text-sm text-emerald-100/70">Im nächsten Schritt würde BidBlitz Pay die sichere Vorautorisierung übernehmen.</p>
              </div>
            )}

            {message && (
              <div className="mt-4 flex gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
                <AlertTriangle size={18} className="shrink-0" /> {message}
              </div>
            )}

            <button
              disabled={!selectedPump}
              onClick={prepare}
              className="mt-5 w-full rounded-2xl bg-amber-400 py-4 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
              data-testid="fuel-prepare-payment"
            >
              Mit BidBlitz Pay fortfahren
            </button>
            <p className="mt-3 text-center text-[11px] text-slate-500">DEV: Es wird weder eine Karte autorisiert noch eine Zapfsäule freigegeben.</p>
          </div>
        </div>
      )}
    </div>
  );
}
