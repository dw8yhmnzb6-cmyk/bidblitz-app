/**
 * GebrauchtwagenPage - Mobile.de/AutoScout24-Style
 * NEU + GEBRAUCHT | Multi-Country | Dealer-Badges | Premium-Listings
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, Star, Car, Fuel, Gauge, Calendar, Eye, MapPin, Phone, Send, CheckCircle, Crown, Filter, X, ChevronDown, Shield, Award, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CityAutocomplete } from "../components/search";

const API = process.env.REACT_APP_BACKEND_URL;

const COUNTRIES = [
  { code: "DE", flag: "🇩🇪", name: "Deutschland" },
  { code: "XK", flag: "🇽🇰", name: "Kosovo" },
  { code: "AE", flag: "🇦🇪", name: "VAE (Dubai)" },
];

const BRANDS = ["Alle", "Audi", "BMW", "Mercedes", "VW", "Tesla", "Porsche", "Fiat", "Renault"];
const FUEL_TYPES = ["Alle", "Benzin", "Diesel", "Elektro", "Hybrid"];

export default function GebrauchtwagenPage({ onBack }) {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  
  // NEUE Filter
  const [carType, setCarType] = useState("all"); // all | new | used
  const [cityFilter, setCityFilter] = useState("");
  const [country, setCountry] = useState("DE");
  const [brand, setBrand] = useState("Alle");
  const [fuelType, setFuelType] = useState("Alle");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { load(); }, [carType, country]);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (carType !== "all") params.set("type", carType);
      if (country !== "ALL") params.set("country", country);
      const r = await fetch(`${API}/api/gebrauchtwagen/listings?${params}`);
      const d = await r.json();
      setCars(d.cars || []);
    } catch {}
    setLoading(false);
  };

  const contact = async () => {
    if (!selected) return;
    try {
      await fetch(`${API}/api/gebrauchtwagen/contact`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: selected.car_id, message: msg }),
      });
      setSent(true);
      toast.success("Nachricht gesendet!");
      setTimeout(() => { setSent(false); }, 2000);
    } catch {}
  };

  // Filter Logic
  const filtered = cars.filter(c => {
    if (search && !c.title?.toLowerCase().includes(search.toLowerCase()) && !c.brand?.toLowerCase().includes(search.toLowerCase())) return false;
    if (brand !== "Alle" && c.brand !== brand) return false;
    if (fuelType !== "Alle" && c.fuel !== fuelType) return false;
    if (cityFilter && !c.city?.toLowerCase().includes(cityFilter.toLowerCase())) return false;
    return true;
  });

  // ═══════════════════════════════════════════════════════════════════
  // DETAIL VIEW (Mobile.de-Style mit TÜV-Checkliste)
  // ═══════════════════════════════════════════════════════════════════

  if (selected) {
    const c = selected;
    const isDealer = c.seller_type === "dealer";
    const isPremium = c.featured;
    
    return (
      <div className="min-h-screen pb-24 bg-[#030303]">
        {/* Image Header */}
        <div className="relative">
          <img src={c.image} alt={c.title} className="w-full h-56 object-cover"/>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"/>
          <button onClick={() => setSelected(null)} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
            <ArrowLeft size={20} className="text-white"/>
          </button>
          {isPremium && (
            <div className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center gap-1">
              <Crown size={14} className="text-black"/>
              <span className="text-xs font-bold text-black">TOP</span>
            </div>
          )}
          <div className="absolute bottom-4 left-4 right-4">
            <h1 className="text-white text-lg font-bold mb-1">{c.title}</h1>
            {c.is_new && <span className="px-2 py-0.5 rounded bg-green-500 text-black text-[10px] font-bold">NEUWAGEN</span>}
          </div>
        </div>

        {/* Price & Dealer Badge */}
        <div className="px-4 py-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-2xl font-bold text-[#00C2FF]">{c.price?.toLocaleString("de-DE")} €</div>
            {isDealer && (
              <div className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center gap-1.5">
                <Award size={14} className="text-blue-400"/>
                <span className="text-xs font-medium text-blue-400">Händler verifiziert</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span className="flex items-center gap-1">
              {COUNTRIES.find(co => co.code === c.country)?.flag} {COUNTRIES.find(co => co.code === c.country)?.name}
            </span>
            <span>•</span>
            <span>{c.city}</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="px-4 py-4 border-b border-white/5">
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: Calendar, label: "Baujahr", value: c.year },
              { icon: Gauge, label: "Km-Stand", value: `${(c.mileage / 1000).toFixed(0)}T km` },
              { icon: Fuel, label: "Kraftstoff", value: c.fuel },
              { icon: Car, label: "Leistung", value: `${c.power_hp} PS` },
            ].map((item, i) => (
              <div key={i} className="rounded-xl p-3 bg-white/5 text-center">
                <item.icon size={16} className="mx-auto mb-1 text-[#00C2FF]"/>
                <div className="text-[10px] text-white/40 mb-0.5">{item.label}</div>
                <div className="text-xs font-semibold text-white">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Fahrzeuginfos (Mobile.de-Style) */}
        <div className="px-4 py-4 border-b border-white/5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Shield size={16} className="text-green-400"/>
            Fahrzeuginfos
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-white/60">Getriebe</span>
              <span className="text-white font-medium">{c.transmission}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-white/60">Farbe</span>
              <span className="text-white font-medium">{c.color}</span>
            </div>
            {c.tuev_date && (
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/60">TÜV</span>
                <span className="text-green-400 font-medium flex items-center gap-1">
                  <CheckCircle size={14}/>
                  {c.tuev_date}
                </span>
              </div>
            )}
            <div className="flex justify-between py-2">
              <span className="text-white/60">Fahrzeughalter</span>
              <span className="text-white font-medium">{c.owners || "1 (Erstbesitz)"}</span>
            </div>
          </div>
        </div>

        {/* Beschreibung */}
        <div className="px-4 py-4 border-b border-white/5">
          <h3 className="text-sm font-bold text-white mb-2">Beschreibung</h3>
          <p className="text-sm text-white/70 leading-relaxed">{c.description}</p>
        </div>

        {/* Ausstattung (Checkliste) */}
        <div className="px-4 py-4 border-b border-white/5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-yellow-400"/>
            Ausstattung
          </h3>
          <div className="flex flex-wrap gap-2">
            {c.features?.map((f, i) => (
              <span key={i} className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white/90 flex items-center gap-1">
                <CheckCircle size={12} className="text-green-400"/>
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Händler Info */}
        <div className="px-4 py-4 border-b border-white/5">
          <h3 className="text-sm font-bold text-white mb-3">Anbieter</h3>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xl font-bold text-white">
              {c.seller.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{c.seller}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Star size={12} className="text-yellow-400 fill-yellow-400"/>
                <span className="text-xs text-white/60">4.8 (234 Bewertungen)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Kontakt */}
        <div className="px-4 py-4">
          <h3 className="text-sm font-semibold text-white mb-3">Verkäufer kontaktieren</h3>
          <textarea
            value={msg}
            onChange={e => setMsg(e.target.value)}
            placeholder="Ihre Nachricht..."
            className="w-full px-3 py-3 rounded-xl text-sm resize-none bg-white/5 border border-white/10 text-white mb-3"
            rows={3}
          />
          <button onClick={contact} className="w-full py-3 rounded-xl bg-[#00C2FF] text-black font-semibold text-sm flex items-center justify-center gap-2">
            {sent ? <><CheckCircle size={16}/>Gesendet!</> : <><Send size={16}/>Nachricht senden</>}
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // BROWSE VIEW (Mobile.de-Style mit Filtern)
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen pb-24 bg-[#030303]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#030303] border-b border-white/5">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="w-10 h-10 rounded-full bg-[#111] flex items-center justify-center">
              <ArrowLeft size={20} className="text-white"/>
            </button>
            <h1 className="text-lg font-bold text-white">Fahrzeugmarkt</h1>
          </div>

          {/* NEU/GEBRAUCHT Toggle */}
          <div className="flex gap-2 mb-3">
            {[
              { id: "all", label: "Alle", icon: Car },
              { id: "new", label: "Neuwagen", icon: Sparkles },
              { id: "used", label: "Gebraucht", icon: Car },
            ].map(type => (
              <button
                key={type.id}
                onClick={() => setCarType(type.id)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  carType === type.id
                    ? 'bg-gradient-to-r from-[#00C2FF] to-[#0090FF] text-black'
                    : 'bg-white/5 text-white'
                }`}
              >
                <type.icon size={14}/>
                {type.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"/>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Marke, Modell suchen..."
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white"
            />
          </div>

          {/* City filter */}
          <div className="mb-3">
            <CityAutocomplete
              value={cityFilter || ""}
              onChange={setCityFilter}
              onSelect={(c) => setCityFilter(c.name)}
              placeholder="Standort (optional)"
              testId="gw-city"
            />
          </div>

          {/* Country & Filter */}
          <div className="flex gap-2">
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-white"
            >
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </select>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white flex items-center gap-2"
            >
              <Filter size={14}/>
              Filter
            </button>
          </div>

          {/* Advanced Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="pt-3 space-y-2">
                  <select value={brand} onChange={e => setBrand(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-xs bg-white/5 border border-white/10 text-white">
                    {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <select value={fuelType} onChange={e => setFuelType(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-xs bg-white/5 border border-white/10 text-white">
                    {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Results Info */}
      <div className="px-4 py-3 border-b border-white/5">
        <p className="text-sm text-white/60">
          {filtered.length} Fahrzeuge gefunden
          {carType === "new" && " (Neuwagen)"}
          {carType === "used" && " (Gebraucht)"}
        </p>
      </div>

      {/* Cars List */}
      <div className="px-4 py-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#00C2FF] border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10">
            <Car size={48} className="mx-auto text-white/20 mb-3"/>
            <p className="text-white/40">Keine Fahrzeuge gefunden</p>
          </div>
        ) : (
          filtered.map(c => {
            const isDealer = c.seller_type === "dealer";
            const isPremium = c.featured;
            
            return (
              <motion.div
                key={c.car_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl overflow-hidden cursor-pointer bg-white/5 border border-white/5 hover:border-[#00C2FF]/30 transition-all"
                onClick={() => setSelected(c)}
              >
                {/* Image with Badges */}
                <div className="relative">
                  <img src={c.image} alt={c.title} className="w-full h-40 object-cover" loading="lazy"/>
                  {isPremium && (
                    <span className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 text-[10px] font-bold text-black flex items-center gap-1">
                      <Crown size={10}/>TOP
                    </span>
                  )}
                  {c.is_new && (
                    <span className="absolute top-3 right-3 px-2 py-1 rounded bg-green-500 text-black text-[10px] font-bold">
                      NEU
                    </span>
                  )}
                  {isDealer && (
                    <span className="absolute bottom-3 right-3 px-2 py-1 rounded-lg bg-blue-500/90 backdrop-blur text-white text-[10px] font-medium flex items-center gap-1">
                      <Award size={10}/>Händler
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-white mb-1">{c.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-white/60 mb-2">
                    <span>{c.year}</span>
                    <span>•</span>
                    <span>{(c.mileage / 1000).toFixed(0)}T km</span>
                    <span>•</span>
                    <span>{c.fuel}</span>
                    <span>•</span>
                    <span>{c.power_hp} PS</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-base font-bold text-[#00C2FF]">{c.price?.toLocaleString("de-DE")} €</span>
                      <p className="text-[10px] text-white/40 mt-0.5 flex items-center gap-1">
                        <MapPin size={10}/>{c.city}
                      </p>
                    </div>
                    <span className="text-xs text-white/40 flex items-center gap-1">
                      <Eye size={12}/>{c.views}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
