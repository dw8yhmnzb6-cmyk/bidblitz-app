import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, Heart, MapPin, Bed, Maximize2, Building2, Home, Users, Briefcase, Phone, Mail, Star, Eye, Filter, X, ChevronDown } from "lucide-react";
import { CityAutocomplete } from "../components/search";

const API = process.env.REACT_APP_BACKEND_URL;

const TYPE_LABELS = { miete: "Miete", kauf: "Kauf" };
const PROPERTY_LABELS = { wohnung: "Wohnung", haus: "Haus", wg: "WG", gewerbe: "Gewerbe", ferienhaus: "Ferienhaus" };
const PROPERTY_ICONS = { wohnung: Building2, haus: Home, wg: Users, gewerbe: Briefcase, ferienhaus: Home };

export default function RealEstatePage({ onBack }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [propFilter, setPropFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [favorites, setFavorites] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [contactMsg, setContactMsg] = useState("");
  const [contactSent, setContactSent] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadListings();
    loadFavorites();
    loadStats();
  }, [typeFilter, propFilter]);

  const loadListings = async () => {
    try {
      let url = `${API}/api/real-estate/listings?`;
      if (typeFilter) url += `type=${typeFilter}&`;
      if (propFilter) url += `property_type=${propFilter}&`;
      const res = await fetch(url, { credentials: "include" });
      const d = await res.json();
      setListings(d.listings || []);
    } catch { }
    setLoading(false);
  };

  const loadFavorites = async () => {
    try {
      const res = await fetch(`${API}/api/real-estate/favorites`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setFavorites(new Set((d.favorites || []).map(f => f.listing_id)));
      }
    } catch { }
  };

  const loadStats = async () => {
    try {
      const res = await fetch(`${API}/api/real-estate/stats`);
      if (res.ok) setStats(await res.json());
    } catch { }
  };

  const toggleFav = async (id) => {
    try {
      await fetch(`${API}/api/real-estate/favorite`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: id }),
      });
      setFavorites(prev => {
        const n = new Set(prev);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
      });
    } catch { }
  };

  const sendContact = async () => {
    if (!selected) return;
    try {
      await fetch(`${API}/api/real-estate/contact`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: selected.listing_id, message: contactMsg }),
      });
      setContactSent(true);
      setTimeout(() => setContactSent(false), 3000);
    } catch { }
  };

  const filtered = listings.filter(l =>
    !search || l.title?.toLowerCase().includes(search.toLowerCase()) ||
    l.city?.toLowerCase().includes(search.toLowerCase()) ||
    l.district?.toLowerCase().includes(search.toLowerCase())
  );

  const formatPrice = (l) => {
    if (l.price_unit === "monat") return `${l.price.toLocaleString("de-DE")} €/Monat`;
    return `${l.price.toLocaleString("de-DE")} €`;
  };

  if (selected) {
    const l = selected;
    const Icon = PROPERTY_ICONS[l.property_type] || Building2;
    return (
      <div className="min-h-screen pb-24" style={{ background: "var(--bg-primary, #030303)" }}>
        <div className="relative">
          <img src={l.images?.[0]} alt={l.title} className="w-full h-64 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <button onClick={() => setSelected(null)} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center" data-testid="re-detail-back">
            <ArrowLeft size={20} className="text-white" />
          </button>
          <button onClick={() => toggleFav(l.listing_id)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center" data-testid="re-detail-fav">
            <Heart size={20} className={favorites.has(l.listing_id) ? "text-red-500 fill-red-500" : "text-white"} />
          </button>
          <div className="absolute bottom-4 left-4 right-4">
            <span className="px-2 py-1 rounded text-xs font-bold" style={{ background: l.type === "kauf" ? "#10B981" : "#3B82F6", color: "white" }}>
              {TYPE_LABELS[l.type] || l.type}
            </span>
            <h1 className="text-white text-xl font-bold mt-2">{l.title}</h1>
            <div className="flex items-center gap-1 text-white/70 text-sm mt-1">
              <MapPin size={14} /> {l.address}
            </div>
          </div>
        </div>

        <div className="px-4 py-5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold" style={{ color: "#00C2FF" }}>{formatPrice(l)}</div>
            <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary, #888)" }}>
              <Eye size={14} /> {l.views} Aufrufe
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: Bed, label: `${l.rooms} Zimmer` },
              { icon: Maximize2, label: `${l.area_sqm} m²` },
              { icon: Building2, label: `${l.floor}. OG` },
              { icon: Icon, label: PROPERTY_LABELS[l.property_type] || l.property_type },
            ].map((item, i) => (
              <div key={i} className="rounded-xl p-3 text-center" style={{ background: "var(--bg-card, #111)" }}>
                <item.icon size={18} className="mx-auto mb-1" style={{ color: "#00C2FF" }} />
                <div className="text-xs" style={{ color: "var(--text-primary, #fff)" }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary, #fff)" }}>Beschreibung</h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary, #aaa)" }}>{l.description}</p>
          </div>

          {l.features?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary, #fff)" }}>Ausstattung</h3>
              <div className="flex flex-wrap gap-2">
                {l.features.map((f, i) => (
                  <span key={i} className="px-3 py-1 rounded-full text-xs" style={{ background: "rgba(0,194,255,0.1)", color: "#00C2FF" }}>{f}</span>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl p-4" style={{ background: "var(--bg-card, #111)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary, #fff)" }}>Details</h3>
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              {[
                ["Energieklasse", l.energy_class],
                ["Baujahr", l.year_built],
                ["Etage", `${l.floor}/${l.total_floors}`],
                ["Verfügbar ab", l.available_from],
              ].map(([label, val], i) => (
                <div key={i}>
                  <span style={{ color: "var(--text-secondary, #888)" }}>{label}: </span>
                  <span style={{ color: "var(--text-primary, #fff)" }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ background: "var(--bg-card, #111)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary, #fff)" }}>Kontakt aufnehmen</h3>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(0,194,255,0.15)" }}>
                <Phone size={18} style={{ color: "#00C2FF" }} />
              </div>
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--text-primary, #fff)" }}>{l.contact_name}</div>
                <div className="text-xs" style={{ color: "var(--text-secondary, #888)" }}>{l.contact_phone}</div>
              </div>
            </div>
            <textarea
              value={contactMsg}
              onChange={e => setContactMsg(e.target.value)}
              placeholder="Ihre Nachricht an den Anbieter..."
              className="w-full rounded-lg p-3 text-sm mb-3 resize-none"
              style={{ background: "var(--bg-primary, #030303)", color: "var(--text-primary, #fff)", border: "1px solid rgba(255,255,255,0.1)" }}
              rows={3}
              data-testid="re-contact-message"
            />
            <button
              onClick={sendContact}
              className="w-full py-3 rounded-xl font-semibold text-sm text-black"
              style={{ background: "#00C2FF" }}
              data-testid="re-contact-send"
            >
              {contactSent ? "Anfrage gesendet!" : "Anfrage senden"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--bg-primary, #030303)" }}>
      <div className="sticky top-0 z-30 px-4 pt-4 pb-3" style={{ background: "var(--bg-primary, #030303)" }}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--bg-card, #111)" }} data-testid="re-back">
            <ArrowLeft size={20} style={{ color: "var(--text-primary, #fff)" }} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold" style={{ color: "var(--text-primary, #fff)" }}>Immobilien</h1>
            {stats && <p className="text-xs" style={{ color: "var(--text-secondary, #888)" }}>{stats.total} Inserate in {stats.cities} Städten</p>}
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: showFilters ? "#00C2FF" : "var(--bg-card, #111)" }} data-testid="re-filter-btn">
            <Filter size={18} style={{ color: showFilters ? "#000" : "var(--text-primary, #fff)" }} />
          </button>
        </div>

        <div className="relative">
          <CityAutocomplete
            value={search}
            onChange={setSearch}
            onSelect={(c) => setSearch(c.name)}
            placeholder="Stadt, Stadtteil suchen..."
            testId="re-city"
          />
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-3">
              <div className="flex gap-2 flex-wrap">
                {["", "miete", "kauf"].map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)} className="px-3 py-1.5 rounded-full text-xs font-medium transition-all" data-testid={`re-type-${t || "all"}`}
                    style={{ background: typeFilter === t ? "#00C2FF" : "var(--bg-card, #111)", color: typeFilter === t ? "#000" : "var(--text-secondary, #aaa)" }}>
                    {t ? TYPE_LABELS[t] : "Alle"}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap mt-2">
                {["", "wohnung", "haus", "wg", "gewerbe", "ferienhaus"].map(p => (
                  <button key={p} onClick={() => setPropFilter(p)} className="px-3 py-1.5 rounded-full text-xs font-medium transition-all" data-testid={`re-prop-${p || "all"}`}
                    style={{ background: propFilter === p ? "#00C2FF" : "var(--bg-card, #111)", color: propFilter === p ? "#000" : "var(--text-secondary, #aaa)" }}>
                    {p ? PROPERTY_LABELS[p] : "Alle Typen"}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="px-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#00C2FF", borderTopColor: "transparent" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Building2 size={48} className="mx-auto mb-3" style={{ color: "var(--text-secondary, #444)" }} />
            <p style={{ color: "var(--text-secondary, #888)" }}>Keine Inserate gefunden</p>
          </div>
        ) : (
          filtered.map(l => (
            <motion.div
              key={l.listing_id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl overflow-hidden cursor-pointer"
              style={{ background: "var(--bg-card, #111)", border: "1px solid rgba(255,255,255,0.05)" }}
              onClick={() => setSelected(l)}
              data-testid={`re-listing-${l.listing_id}`}
            >
              <div className="relative">
                <img src={l.images?.[0]} alt={l.title} className="w-full h-44 object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <button onClick={e => { e.stopPropagation(); toggleFav(l.listing_id); }} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center" data-testid={`re-fav-${l.listing_id}`}>
                  <Heart size={16} className={favorites.has(l.listing_id) ? "text-red-500 fill-red-500" : "text-white"} />
                </button>
                {l.featured && (
                  <span className="absolute top-3 left-3 px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500 text-black flex items-center gap-1">
                    <Star size={10} /> TOP
                  </span>
                )}
                <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded text-xs font-bold" style={{ background: l.type === "kauf" ? "#10B981" : "#3B82F6", color: "white" }}>
                  {TYPE_LABELS[l.type] || l.type}
                </span>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold mb-1 line-clamp-1" style={{ color: "var(--text-primary, #fff)" }}>{l.title}</h3>
                <div className="flex items-center gap-1 text-xs mb-2" style={{ color: "var(--text-secondary, #888)" }}>
                  <MapPin size={12} /> {l.city} · {l.district}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold" style={{ color: "#00C2FF" }}>{formatPrice(l)}</span>
                  <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary, #888)" }}>
                    <span className="flex items-center gap-1"><Bed size={12} />{l.rooms}</span>
                    <span className="flex items-center gap-1"><Maximize2 size={12} />{l.area_sqm}m²</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
