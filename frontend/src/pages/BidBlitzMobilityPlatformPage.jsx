import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, Bike, Car, Crown, Crosshair, Home, Loader2, MapPin, Navigation, Plane, Search, ShieldCheck, Star, Wallet, Zap } from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { useUser } from "../store/UserContext";
import { getMobilityNearby, getMobilityPaymentOptions, getRecentMobilityLocations, getSavedMobilityLocations, mobilityReverse, mobilityRoute, mobilitySearch, saveMobilityLocation, addRecentMobilityLocation } from "../services/mobilityPlatformApi";

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

function makeServiceIcon(type) {
  const meta = TRANSPORT_META[type] || TRANSPORT_META.taxi;
  const glyph = {
    taxi: "🚕",
    scooter: "🛴",
    bike: "🚲",
    car_rental: "🚗",
    airport_shuttle: "✈️",
    vip: "👑",
  }[type] || "📍";
  return L.divIcon({
    className: "",
    html: `<div style="width:38px;height:38px;border-radius:19px;background:${meta.color};display:flex;align-items:center;justify-content:center;border:3px solid rgba(255,255,255,0.92);box-shadow:0 10px 22px rgba(15,23,42,0.24);font-size:16px;">${glyph}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

function makeStopIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:22px;height:22px;border-radius:11px;background:${color};border:4px solid white;box-shadow:0 8px 20px rgba(15,23,42,0.2);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
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
  const [activeField, setActiveField] = useState("dropoff");
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
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [routeSummary, setRouteSummary] = useState(null);
  const [nearbyCounts, setNearbyCounts] = useState({ taxi: 0, scooter: 0, car_rental: 0 });
  const [availableModes, setAvailableModes] = useState([]);
  const [selectedNearby, setSelectedNearby] = useState(null);
  const [searchTarget, setSearchTarget] = useState("dropoff");
  const mapRef = useRef(null);
  const routeLayerRef = useRef(null);
  const nearbyLayerRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropoffMarkerRef = useRef(null);
  const pickupInitializedRef = useRef(false);
  const activeFieldRef = useRef(activeField);
  const pickupStateRef = useRef(pickup);
  const dropoffStateRef = useRef(dropoff);
  const langRef = useRef(lang);
  const loadNearbyRef = useRef(null);
  const calculateRouteRef = useRef(null);

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

  const loadNearby = useCallback(async (lat, lng) => {
    if (!lat || !lng) return;
    setLoadingNearby(true);
    const data = await getMobilityNearby({ lat, lng, radius: 6 });
    setLoadingNearby(false);
    setNearbyCounts(data?.counts || { taxi: 0, scooter: 0, car_rental: 0 });
    setAvailableModes(data?.available_modes || []);
    const map = mapRef.current;
    const layer = nearbyLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    (data?.markers || []).forEach((item) => {
      const marker = L.marker([item.lat, item.lng], { icon: makeServiceIcon(item.type) }).addTo(layer);
      marker.on("click", () => setSelectedNearby(item));
      marker.bindPopup(`<strong>${item.label}</strong><br/>${item.subtitle || ""}<br/>${item.distance_km || 0} km`);
    });
  }, []);

  const calculateRoute = useCallback(async (pickupValue = pickup, dropoffValue = dropoff) => {
    if (!pickupValue?.lat || !dropoffValue?.lat) return;
    setLoadingRoute(true);
    const result = await mobilityRoute({
      pickup_lat: pickupValue.lat,
      pickup_lng: pickupValue.lng,
      dropoff_lat: dropoffValue.lat,
      dropoff_lng: dropoffValue.lng,
      pickup_address: pickupValue.address,
      dropoff_address: dropoffValue.address,
    });
    setLoadingRoute(false);
    if (!result.ok) return;
    setOptions(result.options || []);
    setRecommendations(result.recommendations);
    setRouteSummary({ distance_km: result.distance_km, duration_min: result.duration_min });
    await addRecentMobilityLocation({ label: "pickup", address: pickupValue.address, lat: pickupValue.lat, lng: pickupValue.lng, kind: "recent" });
    await addRecentMobilityLocation({ label: "dropoff", address: dropoffValue.address, lat: dropoffValue.lat, lng: dropoffValue.lng, kind: "recent" });
    const latLngs = (result.geometry || []).map(([lng, lat]) => [lat, lng]);
    if (routeLayerRef.current) mapRef.current?.removeLayer(routeLayerRef.current);
    const polyline = L.polyline(latLngs, { color: "#0F766E", weight: 6, opacity: 0.9 }).addTo(mapRef.current);
    mapRef.current?.fitBounds(polyline.getBounds(), { padding: [40, 40] });
    routeLayerRef.current = polyline;
  }, [pickup, dropoff]);

  useEffect(() => { activeFieldRef.current = activeField; }, [activeField]);
  useEffect(() => { pickupStateRef.current = pickup; }, [pickup]);
  useEffect(() => { dropoffStateRef.current = dropoff; }, [dropoff]);
  useEffect(() => { langRef.current = lang; }, [lang]);
  useEffect(() => { loadNearbyRef.current = loadNearby; }, [loadNearby]);
  useEffect(() => { calculateRouteRef.current = calculateRoute; }, [calculateRoute]);

  const hydratePickupFallback = useCallback(async (lat, lng, fallbackLabel = "Kartenzentrum") => {
    if (pickupInitializedRef.current) return;
    pickupInitializedRef.current = true;
    const info = await mobilityReverse(lat, lng, lang || "de");
    const payload = { address: info?.address || fallbackLabel, lat, lng };
    setPickup(payload);
    mapRef.current?.setView([lat, lng], 14);
    loadNearby(lat, lng);
  }, [lang, loadNearby]);

  useEffect(() => {
    const map = L.map("bidblitz-mobility-map", { zoomControl: false, attributionControl: true, preferCanvas: true }).setView([42.6489, 21.1743], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap" }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    nearbyLayerRef.current = L.layerGroup().addTo(map);
    map.on("click", async (e) => {
      const info = await mobilityReverse(e.latlng.lat, e.latlng.lng, langRef.current || "de");
      const payload = { address: info?.address || `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`, lat: e.latlng.lat, lng: e.latlng.lng };
      if (activeFieldRef.current === "pickup") {
        setPickup(payload);
        await loadNearbyRef.current?.(payload.lat, payload.lng);
        const currentDropoff = dropoffStateRef.current;
        if (currentDropoff?.lat && currentDropoff?.lng) {
          await calculateRouteRef.current?.(payload, currentDropoff);
        }
      } else {
        setDropoff(payload);
        const currentPickup = pickupStateRef.current;
        if (currentPickup?.lat && currentPickup?.lng) {
          await calculateRouteRef.current?.(currentPickup, payload);
        }
      }
    });
    mapRef.current = map;
    setTimeout(() => {
      if (!pickupInitializedRef.current) {
        const center = map.getCenter();
        hydratePickupFallback(center.lat, center.lng);
      }
    }, 900);
    return () => map.remove();
  }, [hydratePickupFallback]);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const address = await mobilityReverse(lat, lng, lang || "de");
      const payload = { address: address?.address || "Aktueller Standort", lat, lng };
      setPickup(payload);
      mapRef.current?.setView([lat, lng], 15);
      loadNearby(lat, lng);
      if (dropoff.lat && dropoff.lng) calculateRoute(payload, dropoff);
      pickupInitializedRef.current = true;
    }, async () => {
      if (!pickupInitializedRef.current && mapRef.current) {
        const center = mapRef.current.getCenter();
        await hydratePickupFallback(center.lat, center.lng);
      }
    });
  }, [calculateRoute, dropoff, hydratePickupFallback, lang, loadNearby]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pickup.lat && pickup.lng) {
      if (pickupMarkerRef.current) pickupMarkerRef.current.setLatLng([pickup.lat, pickup.lng]);
      else pickupMarkerRef.current = L.marker([pickup.lat, pickup.lng], { icon: makeStopIcon("#00C2FF") }).addTo(map).bindPopup("Start");
    }
    if (dropoff.lat && dropoff.lng) {
      if (dropoffMarkerRef.current) dropoffMarkerRef.current.setLatLng([dropoff.lat, dropoff.lng]);
      else dropoffMarkerRef.current = L.marker([dropoff.lat, dropoff.lng], { icon: makeStopIcon("#F97316") }).addTo(map).bindPopup("Ziel");
    }
  }, [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng]);

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

  const useCurrentLocation = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const info = await mobilityReverse(lat, lng, lang || "de");
      const payload = { address: info?.address || "Aktueller Standort", lat, lng };
      pickupInitializedRef.current = true;
      setPickup(payload);
      mapRef.current?.setView([lat, lng], 15);
      loadNearby(lat, lng);
      if (dropoff.lat && dropoff.lng) calculateRoute(payload, dropoff);
    });
  }, [calculateRoute, dropoff, lang, loadNearby]);

  const applyLocation = async (kind, item) => {
    const payload = { address: item.address, lat: item.lat, lng: item.lng };
    if (kind === "pickup") {
      setPickup(payload);
      loadNearby(payload.lat, payload.lng);
      if (dropoff.lat && dropoff.lng) calculateRoute(payload, dropoff);
    } else {
      setDropoff(payload);
      if (pickup.lat && pickup.lng) calculateRoute(pickup, payload);
    }
    setPickupSuggestions([]);
    setDropoffSuggestions([]);
    setSearchTarget(kind === "pickup" ? "dropoff" : kind);
    setActiveField(kind === "pickup" ? "dropoff" : kind);
    mapRef.current?.setView([item.lat, item.lng], 15);
  };

  const saveQuickLocation = async (label) => {
    const target = label === "home" ? pickup : dropoff;
    if (!target?.address || !target?.lat) return;
    await saveMobilityLocation({ label, address: target.address, lat: target.lat, lng: target.lng, kind: label });
    setSavedLocations(await getSavedMobilityLocations());
  };

  return (
    <div className="min-h-screen bg-[#f2eadc] text-[#18202a] pb-28" data-testid="bidblitz-mobility-platform-page">
      <div className="sticky top-0 z-30 bg-[#f2eadc]/92 backdrop-blur-xl border-b border-[#18202a]/8 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate?.("/more")} className="w-10 h-10 rounded-full bg-white/70 border border-[#18202a]/10 flex items-center justify-center" data-testid="mobility-platform-back-btn"><ArrowLeft size={18} className="text-[#18202a]/70" /></button>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#0F766E]">BidBlitz Mobility</p>
            <h1 className="text-lg font-bold">Alles auf einer Karte</h1>
          </div>
        </div>
        <div className="px-3 py-2 rounded-2xl bg-[#0F766E]/10 border border-[#0F766E]/20 text-[#0F766E] text-xs font-semibold flex items-center gap-2" data-testid="mobility-wallet-balance"><Wallet size={14} /> {formatPrice(paymentOptions.wallet_balance)}</div>
      </div>

      <div className="relative">
        <div id="bidblitz-mobility-map" className="h-[46vh] w-full" data-testid="mobility-platform-map" />
        <div className="absolute inset-x-0 top-4 px-4 z-[500] pointer-events-none">
          <div className="rounded-[28px] bg-[#fffaf1]/90 border border-[#18202a]/8 backdrop-blur-xl p-3 pointer-events-auto shadow-[0_16px_48px_rgba(15,23,42,0.14)]">
            <div className="flex items-center justify-between gap-2 mb-2" data-testid="mobility-live-stats-row">
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1.5 rounded-full bg-[#0F766E]/10 text-[#0F766E] text-[11px] font-semibold" data-testid="mobility-live-count-taxi">{nearbyCounts.taxi || 0} Taxi live</span>
                <span className="px-3 py-1.5 rounded-full bg-[#7CFF5B]/16 text-[#256C1B] text-[11px] font-semibold" data-testid="mobility-live-count-scooter">{nearbyCounts.scooter || 0} Scooter</span>
                <span className="px-3 py-1.5 rounded-full bg-[#F59E0B]/16 text-[#92400E] text-[11px] font-semibold" data-testid="mobility-live-count-cars">{nearbyCounts.car_rental || 0} Mietwagen</span>
              </div>
              {loadingNearby && <Loader2 size={16} className="animate-spin text-[#0F766E]" />}
            </div>
            <div className="space-y-2">
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0F766E]" />
                <input value={pickup.address} onFocus={() => { setSearchTarget("pickup"); setActiveField("pickup"); }} onChange={(e) => { setPickup((prev) => ({ ...prev, address: e.target.value })); triggerSearch("pickup", e.target.value); }} placeholder="Abholort suchen oder per GPS setzen" className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-[#18202a]/10 text-sm outline-none focus:border-[#0F766E]/40" data-testid="mobility-pickup-input" />
              </div>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#F97316]" />
                <input value={dropoff.address} onFocus={() => { setSearchTarget("dropoff"); setActiveField("dropoff"); }} onChange={(e) => { setDropoff((prev) => ({ ...prev, address: e.target.value })); triggerSearch("dropoff", e.target.value); }} placeholder="Wohin möchtest du fahren?" className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-[#18202a]/10 text-sm outline-none focus:border-[#F97316]/40" data-testid="mobility-dropoff-input" />
              </div>
            </div>

            {(pickupSuggestions.length > 0 || dropoffSuggestions.length > 0) && (
              <div className="mt-2 rounded-2xl overflow-hidden border border-[#18202a]/8 bg-white" data-testid="mobility-search-results-panel">
                {(searchTarget === "dropoff" ? dropoffSuggestions : pickupSuggestions).slice(0, 6).map((item, idx) => (
                  <button key={`${item.id}-${idx}`} onClick={() => {
                    applyLocation(searchTarget, item);
                  }} className="w-full px-4 py-3 bg-white hover:bg-[#f7f2e7] border-b border-[#18202a]/8 text-left last:border-b-0" data-testid={`mobility-search-result-${idx}`}>
                    <div className="text-sm font-medium text-[#18202a]">{item.name}</div>
                    <div className="text-xs text-[#18202a]/55 mt-0.5 truncate">{item.address}</div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-3 flex-wrap">
              <button onClick={useCurrentLocation} className="px-3 py-2 rounded-2xl bg-[#0F766E]/12 border border-[#0F766E]/20 text-[#0F766E] text-xs font-semibold inline-flex items-center gap-1.5" data-testid="mobility-use-current-location-btn"><Navigation size={14} /> Mein Standort</button>
              <button onClick={() => setActiveField(activeField === "pickup" ? "dropoff" : "pickup")} className="px-3 py-2 rounded-2xl bg-[#F97316]/10 border border-[#F97316]/20 text-[#C2410C] text-xs font-semibold inline-flex items-center gap-1.5" data-testid="mobility-map-tap-target-btn"><Crosshair size={14} /> Karte setzt: {activeField === "pickup" ? "Start" : "Ziel"}</button>
              <button onClick={() => calculateRoute()} disabled={!pickup.lat || !dropoff.lat || loadingRoute} className="px-3 py-2 rounded-2xl bg-[#F97316] text-white text-xs font-semibold disabled:opacity-40" data-testid="mobility-calculate-route-btn">{loadingRoute ? "Berechnet..." : "Preise vergleichen"}</button>
              <button onClick={() => saveQuickLocation("home")} className="px-3 py-2 rounded-2xl bg-white border border-[#18202a]/10 text-[#18202a]/75 text-xs font-semibold" data-testid="mobility-save-home-btn"><Home size={14} className="inline mr-1" /> Zuhause</button>
              <button onClick={() => saveQuickLocation("work")} className="px-3 py-2 rounded-2xl bg-white border border-[#18202a]/10 text-[#18202a]/75 text-xs font-semibold" data-testid="mobility-save-work-btn"><ShieldCheck size={14} className="inline mr-1" /> Arbeit</button>
            </div>
          </div>
        </div>
      </div>

      <div className="-mt-6 relative z-20 px-4">
        <div className="rounded-t-[30px] bg-[#fffaf1] border border-[#18202a]/8 p-4 shadow-[0_-16px_40px_rgba(15,23,42,0.12)]" data-testid="mobility-bottom-sheet">
          <div className="w-12 h-1 rounded-full bg-[#18202a]/10 mx-auto mb-4" />
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#18202a]/35">AI Route Recommendations</p>
              <h2 className="text-lg font-bold mt-1">Smartes Regelwerk aktiv</h2>
              <p className="text-xs text-[#18202a]/55 mt-1">Nach Zielwahl erscheinen Preis, Fahrzeit und Empfehlung direkt wie bei Uber/Bolt.</p>
            </div>
            {routeSummary && <div className="text-right text-xs text-[#18202a]/70" data-testid="mobility-route-summary"><div>{routeSummary.distance_km.toFixed(1)} km</div><div>{routeSummary.duration_min} Min</div></div>}
          </div>

          <div className="flex flex-wrap gap-2 mb-4" data-testid="mobility-available-modes-row">
            {(availableModes.length ? availableModes : Object.keys(TRANSPORT_META).map((type) => ({ type, label: TRANSPORT_META[type].label || type, live: true }))).map((item) => {
              const meta = TRANSPORT_META[item.type] || TRANSPORT_META.taxi;
              return <span key={item.type} className="px-3 py-1.5 rounded-full text-[11px] font-semibold border" style={{ borderColor: `${meta.color}44`, background: `${meta.color}18`, color: meta.color }} data-testid={`mobility-mode-pill-${item.type}`}>{item.label}{item.count ? ` · ${item.count}` : ""}</span>;
            })}
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
                          <span className="text-sm font-bold text-[#18202a]">{option.label}</span>
                          {isSelected && <span className="px-2 py-0.5 rounded-full bg-[#0F766E]/15 text-[#0F766E] text-[10px] font-semibold">Empfohlen</span>}
                        </div>
                        <p className="text-xs text-[#18202a]/55 mt-1">{option.duration_min} Min · {option.distance_km.toFixed(1)} km · Eco {option.eco_score}</p>
                        <p className="text-[11px] text-[#18202a]/42 mt-1">{meta.detail}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-bold text-[#18202a]">{formatPrice(option.price_eur)}</div>
                      <div className="text-[10px] text-[#18202a]/45 mt-1">Wallet · NFC · QR</div>
                    </div>
                  </div>
                </button>
              );
            })}
            {!options.length && (
              <div className="rounded-2xl border border-dashed border-[#18202a]/14 bg-white/70 p-4 text-sm text-[#18202a]/65" data-testid="mobility-empty-comparison-state">
                Gib Start und Ziel ein oder tippe auf die Karte. Danach erscheint hier sofort der Preisvergleich für Taxi, Scooter, Bike, Mietwagen, Shuttle und VIP.
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white border border-[#18202a]/8 p-4" data-testid="mobility-saved-locations-card">
              <div className="flex items-center gap-2 mb-3"><Star size={14} className="text-[#FACC15]" /><p className="text-xs font-semibold">Favoriten</p></div>
              <div className="space-y-2">
                {savedLocations.slice(0, 4).map((item) => (
                  <button key={`${item.label}-${item.address}`} onClick={() => applyLocation("dropoff", item)} className="w-full text-left rounded-xl bg-[#f8f3e9] px-3 py-2" data-testid={`mobility-saved-location-${item.label}`}>
                    <div className="text-xs font-semibold text-[#18202a]">{item.label}</div>
                    <div className="text-[10px] text-[#18202a]/45 truncate mt-0.5">{item.address}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-[#18202a]/8 p-4" data-testid="mobility-recent-locations-card">
              <div className="flex items-center gap-2 mb-3"><MapPin size={14} className="text-[#00C2FF]" /><p className="text-xs font-semibold">Recent</p></div>
              <div className="space-y-2">
                {recentLocations.slice(0, 4).map((item, idx) => (
                  <button key={`${item.address}-${idx}`} onClick={() => applyLocation("dropoff", item)} className="w-full text-left rounded-xl bg-[#f8f3e9] px-3 py-2" data-testid={`mobility-recent-location-${idx}`}>
                    <div className="text-[11px] font-semibold text-[#18202a]">{item.label || "Letztes Ziel"}</div>
                    <div className="text-[10px] text-[#18202a]/45 truncate mt-0.5">{item.address}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selectedNearby && (
            <div className="mt-4 rounded-2xl bg-[#0F766E]/8 border border-[#0F766E]/20 p-4" data-testid="mobility-selected-nearby-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#0F766E]">Live in der Nähe</p>
                  <h3 className="text-base font-bold mt-1 text-[#18202a]">{selectedNearby.label}</h3>
                  <p className="text-xs text-[#18202a]/60 mt-1">{selectedNearby.subtitle || "Verfügbar auf der Karte"}</p>
                </div>
                <div className="text-right text-xs text-[#18202a]/65">
                  {selectedNearby.distance_km ? <div>{selectedNearby.distance_km} km</div> : null}
                  {selectedNearby.price_hint ? <div>{formatPrice(selectedNearby.price_hint)}</div> : null}
                  {selectedNearby.eta_minutes ? <div>{selectedNearby.eta_minutes} Min</div> : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <MobilityDetailSheet option={detailOption} onClose={() => setDetailOption(null)} paymentOptions={paymentOptions} />
    </div>
  );
}