import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, Bike, Car, Crown, Home, MapPin, Plane, Search, ShieldCheck, Star, Wallet, Zap } from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { useUser } from "../store/UserContext";
import { getMobilityPaymentOptions, getRecentMobilityLocations, getSavedMobilityLocations, mobilityReverse, mobilityRoute, mobilitySearch, saveMobilityLocation, addRecentMobilityLocation } from "../services/mobilityPlatformApi";

const TRANSPORT_META = {
  taxi: { icon: Car, color: "#00C2FF", detail: "Direkt, schnell und klassisch wie Uber/Bolt." },
  scooter: { icon: Zap, color: "#7CFF5B", detail: "Ideal für kurze City-Strecken und günstig." },
  bike: { icon: Bike, color: "#FACC15", detail: "Die günstigste und nachhaltigste Kurzstrecke." },
  car_rental: { icon: Car, color: "#A78BFA", detail: "Für eigene Flexibilität über mehrere Stunden." },
  airport_shuttle: { icon: Plane, color: "#FB7185", detail: "Perfekt für Flughafen und große Gepäckmengen." },
  vip: { icon: Crown, color: "#F59E0B", detail: "Premium-Fahrt mit VIP Chauffeur und maximalem Komfort." },
};

function formatPrice(value) {
  return `€${Number(value || 0).toFixed(2)}`;
}

function RecommendationChip({ label, reason, active }) {
  return (
    <div className={`px-3 py-2 rounded-2xl border text-xs ${active ? "bg-[#00C2FF]/14 border-[#00C2FF]/30 text-[#8EEBFF]" : "bg-white/[0.03] border-white/[0.06] text-white/55"}`}>
      <div className="font-semibold">{label}</div>
      <div className="text-[10px] mt-0.5 opacity-80">{reason}</div>
    </div>
  );
}

function MobilityDetailSheet({ option, onClose, paymentOptions }) {
  if (!option) return null;
  const meta = TRANSPORT_META[option.type] || TRANSPORT_META.taxi;
  const Icon = meta.icon;
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-sm flex items-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div onClick={(e) => e.stopPropagation()} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 280 }} className="w-full rounded-t-[30px] border-t border-white/10 bg-[#0B0E16] p-5 pb-8">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${meta.color}18`, color: meta.color }}><Icon size={24} /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">BidBlitz Mobility</p>
              <h3 className="text-xl font-bold text-white mt-1">{option.label}</h3>
              <p className="text-sm text-white/55 mt-1">{meta.detail}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-3"><p className="text-[10px] text-white/35 uppercase tracking-[0.15em]">Preis</p><p className="text-lg font-bold text-white mt-1">{formatPrice(option.price_eur)}</p></div>
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-3"><p className="text-[10px] text-white/35 uppercase tracking-[0.15em]">Zeit</p><p className="text-lg font-bold text-white mt-1">{option.duration_min} Min</p></div>
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-3"><p className="text-[10px] text-white/35 uppercase tracking-[0.15em]">Distanz</p><p className="text-lg font-bold text-white mt-1">{option.distance_km.toFixed(1)} km</p></div>
          </div>

          <div className="mt-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Zahlungsmethoden</p>
                <p className="text-sm text-white/70 mt-1">Wallet, NFC, QR, Apple Pay und Google Pay sind eingebunden.</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#00C2FF]/10 border border-[#00C2FF]/20 text-[#8EEBFF] text-xs font-semibold">
                <Wallet size={14} /> {formatPrice(paymentOptions.wallet_balance)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {(paymentOptions.methods || []).map((method) => (
                <span key={method.id} className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-white/70">{method.label}</span>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function BidBlitzMobilityPlatformPage({ onNavigate }) {
  const { t, lang } = useI18n();
  const { user } = useUser();
  const [pickup, setPickup] = useState({ address: "", lat: null, lng: null });
  const [dropoff, setDropoff] = useState({ address: "", lat: null, lng: null });
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [options, setOptions] = useState([]);
  const [recommendations, setRecommendations] = useState(null);
  const [selectedType, setSelectedType] = useState("balance");
  const [detailOption, setDetailOption] = useState(null);
  const [savedLocations, setSavedLocations] = useState([]);
  const [recentLocations, setRecentLocations] = useState([]);
  const [paymentOptions, setPaymentOptions] = useState({ wallet_balance: 0, methods: [] });
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeSummary, setRouteSummary] = useState(null);
  const [mapState, setMapState] = useState({ map: null, markers: {}, polyline: null });

  useEffect(() => {
    (async () => {
      const [saved, recents, payments] = await Promise.all([
        getSavedMobilityLocations(),
        getRecentMobilityLocations(),
        getMobilityPaymentOptions(),
      ]);
      setSavedLocations(saved);
      setRecentLocations(recents);
      setPaymentOptions(payments);
    })();
  }, []);

  useEffect(() => {
    const map = L.map("bidblitz-mobility-map", { zoomControl: false, attributionControl: true }).setView([42.6489, 21.1743], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap" }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    map.on("click", async (e) => {
      const info = await mobilityReverse(e.latlng.lat, e.latlng.lng, lang || "de");
      if (!pickup.address) {
        setPickup({ address: info?.address || `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`, lat: e.latlng.lat, lng: e.latlng.lng });
      } else {
        setDropoff({ address: info?.address || `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`, lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });
    setMapState((prev) => ({ ...prev, map }));
    return () => map.remove();
  }, [lang]);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const address = await mobilityReverse(lat, lng, lang || "de");
      setPickup({ address: address?.address || "Aktueller Standort", lat, lng });
      mapState.map?.setView([lat, lng], 15);
    });
  }, [lang, mapState.map]);

  useEffect(() => {
    if (!mapState.map) return;
    const map = mapState.map;
    const nextMarkers = { ...mapState.markers };
    if (pickup.lat && pickup.lng) {
      if (nextMarkers.pickup) nextMarkers.pickup.setLatLng([pickup.lat, pickup.lng]);
      else nextMarkers.pickup = L.marker([pickup.lat, pickup.lng]).addTo(map).bindPopup("Pickup");
    }
    if (dropoff.lat && dropoff.lng) {
      if (nextMarkers.dropoff) nextMarkers.dropoff.setLatLng([dropoff.lat, dropoff.lng]);
      else nextMarkers.dropoff = L.marker([dropoff.lat, dropoff.lng]).addTo(map).bindPopup("Ziel");
    }
    setMapState((prev) => ({ ...prev, markers: nextMarkers }));
  }, [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng, mapState.map]);

  const recommendationMode = useMemo(() => {
    if (!recommendations) return null;
    return recommendations[selectedType] || recommendations.balance;
  }, [recommendations, selectedType]);

  const selectedOption = useMemo(() => {
    if (!options.length || !recommendationMode) return null;
    return options.find((item) => item.type === recommendationMode.type) || options[0];
  }, [options, recommendationMode]);

  const triggerSearch = async (kind, value) => {
    const prox = pickup.lat && pickup.lng ? { lat: pickup.lat, lng: pickup.lng } : undefined;
    const data = await mobilitySearch(value, { ...prox, lang: lang || "de" });
    if (kind === "pickup") setPickupSuggestions(data);
    else setDropoffSuggestions(data);
  };

  const calculate = async () => {
    if (!pickup.lat || !dropoff.lat) return;
    setLoadingRoute(true);
    const result = await mobilityRoute({
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      dropoff_lat: dropoff.lat,
      dropoff_lng: dropoff.lng,
      pickup_address: pickup.address,
      dropoff_address: dropoff.address,
    });
    setLoadingRoute(false);
    if (!result.ok) return;
    setOptions(result.options || []);
    setRecommendations(result.recommendations);
    setRouteSummary({ distance_km: result.distance_km, duration_min: result.duration_min });
    await addRecentMobilityLocation({ label: "pickup", address: pickup.address, lat: pickup.lat, lng: pickup.lng, kind: "recent" });
    await addRecentMobilityLocation({ label: "dropoff", address: dropoff.address, lat: dropoff.lat, lng: dropoff.lng, kind: "recent" });
    const latLngs = (result.geometry || []).map(([lng, lat]) => [lat, lng]);
    if (mapState.polyline) mapState.map.removeLayer(mapState.polyline);
    const polyline = L.polyline(latLngs, { color: "#00C2FF", weight: 5, opacity: 0.9 }).addTo(mapState.map);
    mapState.map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
    setMapState((prev) => ({ ...prev, polyline }));
  };

  const saveQuickLocation = async (label) => {
    const target = label === "home" ? pickup : dropoff;
    if (!target?.address || !target?.lat) return;
    await saveMobilityLocation({ label, address: target.address, lat: target.lat, lng: target.lng, kind: label });
    setSavedLocations(await getSavedMobilityLocations());
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-white pb-24" data-testid="bidblitz-mobility-platform-page">
      <div className="sticky top-0 z-30 bg-[#070A12]/92 backdrop-blur-xl border-b border-white/6 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate?.("/more")} className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center" data-testid="mobility-platform-back-btn"><ArrowLeft size={18} className="text-white/70" /></button>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#00C2FF]/75">BidBlitz Mobility</p>
            <h1 className="text-lg font-bold">Alles auf einer Karte</h1>
          </div>
        </div>
        <div className="px-3 py-2 rounded-2xl bg-[#00C2FF]/10 border border-[#00C2FF]/20 text-[#8EEBFF] text-xs font-semibold flex items-center gap-2"><Wallet size={14} /> {formatPrice(paymentOptions.wallet_balance)}</div>
      </div>

      <div className="relative">
        <div id="bidblitz-mobility-map" className="h-[46vh] w-full" data-testid="mobility-platform-map" />
        <div className="absolute inset-x-0 top-4 px-4 z-[500] pointer-events-none">
          <div className="rounded-2xl bg-[#070A12]/90 border border-white/8 backdrop-blur-xl p-3 pointer-events-auto shadow-[0_12px_48px_rgba(0,0,0,0.45)]">
            <div className="space-y-2">
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#00C2FF]" />
                <input value={pickup.address} onChange={(e) => { setPickup((prev) => ({ ...prev, address: e.target.value })); triggerSearch("pickup", e.target.value); }} placeholder="Start suchen oder GPS nutzen" className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/[0.05] border border-white/[0.06] text-sm outline-none focus:border-[#00C2FF]/40" data-testid="mobility-pickup-input" />
              </div>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#F97316]" />
                <input value={dropoff.address} onChange={(e) => { setDropoff((prev) => ({ ...prev, address: e.target.value })); triggerSearch("dropoff", e.target.value); }} placeholder="Ziel eingeben (2–3 Buchstaben reichen)" className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/[0.05] border border-white/[0.06] text-sm outline-none focus:border-[#F97316]/40" data-testid="mobility-dropoff-input" />
              </div>
            </div>

            {(pickupSuggestions.length > 0 || dropoffSuggestions.length > 0) && (
              <div className="mt-2 rounded-2xl overflow-hidden border border-white/6">
                {(dropoff.address ? dropoffSuggestions : pickupSuggestions).slice(0, 6).map((item, idx) => (
                  <button key={`${item.id}-${idx}`} onClick={() => {
                    if (dropoff.address) setDropoff({ address: item.address, lat: item.lat, lng: item.lng });
                    else setPickup({ address: item.address, lat: item.lat, lng: item.lng });
                    setPickupSuggestions([]); setDropoffSuggestions([]);
                  }} className="w-full px-4 py-3 bg-[#0D111B] hover:bg-white/[0.04] border-b border-white/6 text-left last:border-b-0" data-testid={`mobility-search-result-${idx}`}>
                    <div className="text-sm font-medium text-white">{item.name}</div>
                    <div className="text-xs text-white/45 mt-0.5 truncate">{item.address}</div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-3 flex-wrap">
              <button onClick={() => navigator.geolocation?.getCurrentPosition(async (pos) => {
                const lat = pos.coords.latitude; const lng = pos.coords.longitude;
                const info = await mobilityReverse(lat, lng, lang || "de");
                setPickup({ address: info?.address || "Aktueller Standort", lat, lng });
                mapState.map?.setView([lat, lng], 15);
              })} className="px-3 py-2 rounded-2xl bg-[#00C2FF]/12 border border-[#00C2FF]/20 text-[#8EEBFF] text-xs font-semibold" data-testid="mobility-use-current-location-btn">Use Current Location</button>
              <button onClick={calculate} disabled={!pickup.lat || !dropoff.lat || loadingRoute} className="px-3 py-2 rounded-2xl bg-[#F97316] text-white text-xs font-semibold disabled:opacity-40" data-testid="mobility-calculate-route-btn">{loadingRoute ? "Berechnet..." : "Preise vergleichen"}</button>
              <button onClick={() => saveQuickLocation("home")} className="px-3 py-2 rounded-2xl bg-white/[0.05] border border-white/[0.06] text-white/75 text-xs font-semibold" data-testid="mobility-save-home-btn"><Home size={14} className="inline mr-1" /> Zuhause</button>
              <button onClick={() => saveQuickLocation("work")} className="px-3 py-2 rounded-2xl bg-white/[0.05] border border-white/[0.06] text-white/75 text-xs font-semibold" data-testid="mobility-save-work-btn"><ShieldCheck size={14} className="inline mr-1" /> Arbeit</button>
            </div>
          </div>
        </div>
      </div>

      <div className="-mt-6 relative z-20 px-4">
        <div className="rounded-t-[30px] bg-[#0B0E16] border border-white/8 p-4 shadow-[0_-16px_40px_rgba(0,0,0,0.25)]" data-testid="mobility-bottom-sheet">
          <div className="w-12 h-1 rounded-full bg-white/10 mx-auto mb-4" />
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">AI Route Recommendations</p>
              <h2 className="text-lg font-bold mt-1">Smartes Regelwerk aktiv</h2>
              <p className="text-xs text-white/45 mt-1">Später erweiterbar mit GPT-5.2, Gemini-3-Flash und Claude Sonnet 4.5 über Universal Key.</p>
            </div>
            {routeSummary && <div className="text-right text-xs text-white/60"><div>{routeSummary.distance_km.toFixed(1)} km</div><div>{routeSummary.duration_min} Min</div></div>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {recommendations && [
              { key: "cheapest", label: "Günstigste" },
              { key: "fastest", label: "Schnellste" },
              { key: "balance", label: "Beste Balance" },
              { key: "eco", label: "Eco" },
            ].map((item) => (
              <button key={item.key} onClick={() => setSelectedType(item.key)} className="text-left">
                <RecommendationChip label={item.label} reason={recommendations[item.key]?.reason} active={selectedType === item.key} />
              </button>
            ))}
          </div>

          <div className="space-y-3 mt-4" data-testid="mobility-options-list">
            {options.map((option) => {
              const meta = TRANSPORT_META[option.type] || TRANSPORT_META.taxi;
              const Icon = meta.icon;
              const isSelected = selectedOption?.type === option.type;
              return (
                <button key={option.type} onClick={() => setDetailOption(option)} className={`w-full rounded-2xl border p-4 text-left transition-all ${isSelected ? "border-[#00C2FF]/30 bg-[#00C2FF]/8" : "border-white/[0.06] bg-white/[0.03]"}`} data-testid={`mobility-option-${option.type}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${meta.color}18`, color: meta.color }}><Icon size={20} /></div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">{option.label}</span>
                          {isSelected && <span className="px-2 py-0.5 rounded-full bg-[#00C2FF]/15 text-[#8EEBFF] text-[10px] font-semibold">Empfohlen</span>}
                        </div>
                        <p className="text-xs text-white/45 mt-1">{option.duration_min} Min · {option.distance_km.toFixed(1)} km · Eco {option.eco_score}</p>
                        <p className="text-[11px] text-white/32 mt-1">{meta.detail}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-bold text-white">{formatPrice(option.price_eur)}</div>
                      <div className="text-[10px] text-white/35 mt-1">Wallet · NFC · QR</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4" data-testid="mobility-saved-locations-card">
              <div className="flex items-center gap-2 mb-3"><Star size={14} className="text-[#FACC15]" /><p className="text-xs font-semibold">Favoriten</p></div>
              <div className="space-y-2">
                {savedLocations.slice(0, 4).map((item) => (
                  <button key={`${item.label}-${item.address}`} onClick={() => setDropoff({ address: item.address, lat: item.lat, lng: item.lng })} className="w-full text-left rounded-xl bg-white/[0.04] px-3 py-2">
                    <div className="text-xs font-semibold text-white">{item.label}</div>
                    <div className="text-[10px] text-white/35 truncate mt-0.5">{item.address}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4" data-testid="mobility-recent-locations-card">
              <div className="flex items-center gap-2 mb-3"><MapPin size={14} className="text-[#00C2FF]" /><p className="text-xs font-semibold">Recent</p></div>
              <div className="space-y-2">
                {recentLocations.slice(0, 4).map((item, idx) => (
                  <button key={`${item.address}-${idx}`} onClick={() => setDropoff({ address: item.address, lat: item.lat, lng: item.lng })} className="w-full text-left rounded-xl bg-white/[0.04] px-3 py-2">
                    <div className="text-[11px] font-semibold text-white">{item.label || "Letztes Ziel"}</div>
                    <div className="text-[10px] text-white/35 truncate mt-0.5">{item.address}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <MobilityDetailSheet option={detailOption} onClose={() => setDetailOption(null)} paymentOptions={paymentOptions} />
    </div>
  );
}