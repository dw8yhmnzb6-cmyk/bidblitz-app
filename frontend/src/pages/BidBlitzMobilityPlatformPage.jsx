/* eslint-disable */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, Bike, Car, Crown, Crosshair, Home, Loader2, MapPin, Navigation, Plane, Search, ShieldCheck, Star, Trash2, Wallet, Zap } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useI18n } from "../store/I18nContext";
import { useUser } from "../store/UserContext";
import { isNFCAvailable, writeNFC } from "../utils/nfcService";
import { addRecentMobilityLocation, cancelMobilityBooking, createMobilityBooking, createMobilityCheckoutSession, deleteSavedMobilityLocation, getMobilityAiRecommendation, getMobilityBookingDetail, getMobilityCheckoutStatus, getMobilityNearby, getMobilityPaymentOptions, getMobilityPreferences, getMyMobilityBookings, getRecentMobilityLocations, getSavedMobilityLocations, mobilityReverse, mobilityRoute, mobilitySearch, saveMobilityLocation, saveMobilityPreferences } from "../services/mobilityPlatformApi";

const TRANSPORT_META = {
  taxi: { icon: Car, color: "#00C2FF", details: { de: "Direkt, schnell und klassisch wie Uber/Bolt.", en: "Direct, fast and classic like Uber/Bolt.", sq: "Direkt, e shpejtë dhe klasike si Uber/Bolt." } },
  scooter: { icon: Zap, color: "#7CFF5B", details: { de: "Ideal für kurze City-Strecken und günstig.", en: "Ideal for short city rides and affordable.", sq: "Ideale për udhëtime të shkurtra në qytet dhe me kosto të ulët." } },
  bike: { icon: Bike, color: "#FACC15", details: { de: "Die günstigste und nachhaltigste Kurzstrecke.", en: "The cheapest and most sustainable short trip.", sq: "Opsioni më i lirë dhe më i qëndrueshëm për distanca të shkurtra." } },
  car_rental: { icon: Car, color: "#A78BFA", details: { de: "Für eigene Flexibilität über mehrere Stunden.", en: "For full flexibility over several hours.", sq: "Për fleksibilitet të plotë për disa orë." } },
  airport_shuttle: { icon: Plane, color: "#FB7185", details: { de: "Perfekt für Flughafen und große Gepäckmengen.", en: "Perfect for airports and heavy luggage.", sq: "Perfekt për aeroport dhe bagazh të madh." } },
  vip: { icon: Crown, color: "#F59E0B", details: { de: "Premium-Fahrt mit VIP Chauffeur und maximalem Komfort.", en: "Premium ride with VIP chauffeur and maximum comfort.", sq: "Udhëtim premium me shofer VIP dhe rehati maksimale." } },
};

const MOBILITY_COPY = {
  de: { title: "Alles auf einer Karte", pickup: "Abholort suchen oder per GPS setzen", dropoff: "Wohin möchtest du fahren?", current: "Mein Standort", mapSets: "Karte setzt", start: "Start", destination: "Ziel", compare: "Preise vergleichen", home: "Zuhause", work: "Arbeit", saveStart: "Start merken", saveDestination: "Ziel merken", aiRules: "Smartes Regelwerk aktiv", aiRulesText: "Nach Zielwahl erscheinen Preis, Fahrzeit und Empfehlung direkt wie bei Uber/Bolt.", aiPrefs: "AI Präferenzen", checkout: "Checkout-Methode", favorites: "Favoriten", recents: "Zuletzt genutzt", noFavorites: "Noch keine Favoriten gespeichert.", noRecents: "Noch keine letzten Ziele vorhanden.", bookings: "Letzte Mobility-Buchungen", directWallet: "Direkt mit Wallet buchen", directCash: "Cash-Fahrt direkt reservieren", booking: "Bucht...", bookNow: "Jetzt buchen", empty: "Gib Start und Ziel ein oder tippe auf die Karte. Danach erscheint hier sofort der Preisvergleich für Taxi, Scooter, Bike, Mietwagen, Shuttle und VIP.", recentLabel: "Letztes Ziel", used: "genutzt", recommended: "Empfohlen", bestChoice: "Beste Wahl", alternative: "Alternative", nearby: "Live in der Nähe", nearbyFallback: "Verfügbar auf der Karte", qrTitle: "QR Checkout", qrText: "Scanne den QR-Code auf einem zweiten Gerät oder öffne den Link direkt.", close: "Schließen", openStripe: "Stripe Checkout öffnen", liveTaxi: "Taxi live", rentalCars: "Mietwagen", paymentTitle: "Zahlungsmethoden", paymentText: "Wallet, NFC, QR, Apple Pay, Google Pay, Credit Card und Cash sind eingebunden.", price: "Preis", time: "Zeit", distance: "Distanz" },
  en: { title: "Everything on one map", pickup: "Search pickup or set via GPS", dropoff: "Where do you want to go?", current: "My location", mapSets: "Map sets", start: "pickup", destination: "destination", compare: "Compare prices", home: "Home", work: "Work", saveStart: "Save pickup", saveDestination: "Save destination", aiRules: "Smart routing active", aiRulesText: "After choosing a destination, price, ETA and recommendation appear instantly like Uber/Bolt.", aiPrefs: "AI preferences", checkout: "Checkout method", favorites: "Favorites", recents: "Recent places", noFavorites: "No favorites saved yet.", noRecents: "No recent places yet.", bookings: "Recent mobility bookings", directWallet: "Book directly with wallet", directCash: "Reserve as cash ride", booking: "Booking...", bookNow: "Book now", empty: "Set pickup and destination or tap the map. Then the instant comparison for taxi, scooter, bike, rental car, shuttle and VIP appears here.", recentLabel: "Recent destination", used: "times used", recommended: "Recommended", bestChoice: "Best choice", alternative: "Alternative", nearby: "Live nearby", nearbyFallback: "Available on the map", qrTitle: "QR checkout", qrText: "Scan the QR code on another device or open the link directly.", close: "Close", openStripe: "Open Stripe checkout", liveTaxi: "taxis live", rentalCars: "rental cars", paymentTitle: "Payment methods", paymentText: "Wallet, NFC, QR, Apple Pay, Google Pay, Credit Card and Cash are integrated.", price: "Price", time: "Time", distance: "Distance" },
  sq: { title: "Gjithçka në një hartë", pickup: "Kërko nisjen ose vendose me GPS", dropoff: "Ku dëshiron të shkosh?", current: "Vendndodhja ime", mapSets: "Harta vendos", start: "nisjen", destination: "destinacionin", compare: "Krahaso çmimet", home: "Shtëpia", work: "Puna", saveStart: "Ruaj nisjen", saveDestination: "Ruaj destinacionin", aiRules: "Rregullat smart aktive", aiRulesText: "Pas zgjedhjes së destinacionit, çmimi, ETA dhe rekomandimi shfaqen menjëherë si Uber/Bolt.", aiPrefs: "Preferencat AI", checkout: "Metoda e pagesës", favorites: "Të preferuarat", recents: "Adresat e fundit", noFavorites: "Ende nuk ka të preferuara.", noRecents: "Ende nuk ka adresa të fundit.", bookings: "Rezervimet e fundit mobility", directWallet: "Rezervo direkt me wallet", directCash: "Rezervo si udhëtim me cash", booking: "Po rezervohet...", bookNow: "Rezervo tani", empty: "Vendos nisjen dhe destinacionin ose prek hartën. Pastaj këtu shfaqet menjëherë krahasimi për taxi, scooter, bike, veturë me qira, shuttle dhe VIP.", recentLabel: "Destinacion i fundit", used: "herë përdorur", recommended: "Rekomanduar", bestChoice: "Zgjedhja më e mirë", alternative: "Alternativa", nearby: "Live afër", nearbyFallback: "I disponueshëm në hartë", qrTitle: "QR checkout", qrText: "Skano kodin QR në një pajisje tjetër ose hape linkun direkt.", close: "Mbyll", openStripe: "Hap Stripe checkout", liveTaxi: "taksi live", rentalCars: "vetura me qira", paymentTitle: "Metodat e pagesës", paymentText: "Wallet, NFC, QR, Apple Pay, Google Pay, Credit Card dhe Cash janë të integruara.", price: "Çmimi", time: "Koha", distance: "Distanca" },
};

function formatPrice(value) {
  return `€${Number(value || 0).toFixed(2)}`;
}

function buildDirectBookingPayload(transportType, transportLabel, priceEur, durationMin, distanceKm, pickupAddress, pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng, priority, luggage, childSeat, aiRecommendationJson, paymentMethod = "wallet") {
  return {
    transport_type: transportType,
    transport_label: transportLabel,
    price_eur: priceEur,
    duration_min: durationMin,
    distance_km: distanceKm,
    payment_method: paymentMethod,
    pickup: { address: pickupAddress, lat: pickupLat, lng: pickupLng },
    dropoff: { address: dropoffAddress, lat: dropoffLat, lng: dropoffLng },
    preferences: { priority, luggage, childSeat },
    ai_recommendation: aiRecommendationJson ? JSON.parse(aiRecommendationJson) : null,
  };
}

async function createDirectBookingFromValues(transportType, transportLabel, priceEur, durationMin, distanceKm, pickupAddress, pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng, priority, luggage, childSeat, aiRecommendationJson, paymentMethod = "wallet") {
  return await createMobilityBooking(buildDirectBookingPayload(transportType, transportLabel, priceEur, durationMin, distanceKm, pickupAddress, pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng, priority, luggage, childSeat, aiRecommendationJson, paymentMethod));
}

function makeFavoriteLabel(address, fallback = "Favorit") {
  const first = String(address || "").split(",")[0]?.trim();
  return first?.length ? first.slice(0, 36) : fallback;
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

function MobilityDetailSheet({ option, onClose, paymentOptions, ui, lang }) {
  if (!option) return null;
  const meta = TRANSPORT_META[option.type] || TRANSPORT_META.taxi;
  const Icon = meta.icon;
  const detailText = meta.details?.[lang] || meta.details?.de;
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-sm flex items-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div onClick={(e) => e.stopPropagation()} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 280 }} className="w-full rounded-t-[30px] border-t border-white/10 bg-[#0B0E16] p-5 pb-8">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${meta.color}18`, color: meta.color }}><Icon size={24} /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">BidBlitz Mobility</p>
              <h3 className="text-xl font-bold text-white mt-1">{option.label}</h3>
              <p className="text-sm text-white/55 mt-1">{detailText}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-3"><p className="text-[10px] text-white/35 uppercase tracking-[0.15em]">{ui.price}</p><p className="text-lg font-bold text-white mt-1">{formatPrice(option.price_eur)}</p></div>
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-3"><p className="text-[10px] text-white/35 uppercase tracking-[0.15em]">{ui.time}</p><p className="text-lg font-bold text-white mt-1">{option.duration_min} Min</p></div>
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-3"><p className="text-[10px] text-white/35 uppercase tracking-[0.15em]">{ui.distance}</p><p className="text-lg font-bold text-white mt-1">{option.distance_km.toFixed(1)} km</p></div>
          </div>

          <div className="mt-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">{ui.paymentTitle}</p>
                <p className="text-sm text-white/70 mt-1">{ui.paymentText}</p>
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
  const ui = MOBILITY_COPY[lang] || MOBILITY_COPY.de;
  const [pickup, setPickup] = useState({ address: "", lat: null, lng: null });
  const [dropoff, setDropoff] = useState({ address: "", lat: null, lng: null });
  const [activeField, setActiveField] = useState("dropoff");
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [preferences, setPreferences] = useState({ priority: "balance", luggage: false, childSeat: false });
  const [options, setOptions] = useState([]);
  const [recommendations, setRecommendations] = useState(null);
  const [selectedType, setSelectedType] = useState("balance");
  const [detailOption, setDetailOption] = useState(null);
  const [savedLocations, setSavedLocations] = useState([]);
  const [recentLocations, setRecentLocations] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [paymentOptions, setPaymentOptions] = useState({ wallet_balance: 0, methods: [] });
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("wallet");
  const [nfcStatus, setNfcStatus] = useState(null);
  const [qrCheckout, setQrCheckout] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [loadingAiRecommendation, setLoadingAiRecommendation] = useState(false);
  const [bookingTransportType, setBookingTransportType] = useState("");
  const [routeSummary, setRouteSummary] = useState(null);
  const [nearbyCounts, setNearbyCounts] = useState({ taxi: 0, scooter: 0, car_rental: 0 });
  const [availableModes, setAvailableModes] = useState([]);
  const [selectedNearby, setSelectedNearby] = useState(null);
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [routeSnapshot, setRouteSnapshot] = useState(null);
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
      const [saved, recents, payments, myBookings, storedPreferences] = await Promise.all([
        getSavedMobilityLocations(),
        getRecentMobilityLocations(),
        getMobilityPaymentOptions(),
        getMyMobilityBookings(),
        getMobilityPreferences(),
      ]);
      setSavedLocations(saved);
      setRecentLocations(recents);
      setPaymentOptions(payments);
      setSelectedPaymentMethod((payments?.methods || []).some((item) => item.id === "wallet") ? "wallet" : payments?.methods?.[0]?.id || "wallet");
      setBookings(myBookings);
      setPreferences(storedPreferences);
      setSelectedType(storedPreferences?.priority || "balance");
    })();
  }, []);

  const refreshBootstrapData = useCallback(async () => {
    const [payments, myBookings] = await Promise.all([
      getMobilityPaymentOptions(),
      getMyMobilityBookings(),
    ]);
    setPaymentOptions(payments);
    setBookings(myBookings);
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

  const requestAiRecommendation = useCallback(async (routeData, pickupValue = pickup, dropoffValue = dropoff, nextPreferences = preferences) => {
    if (!routeData?.options?.length) return;
    setLoadingAiRecommendation(true);
    const ai = await getMobilityAiRecommendation({
      pickup_address: pickupValue.address,
      dropoff_address: dropoffValue.address,
      distance_km: routeData.distance_km,
      duration_min: routeData.duration_min,
      options: routeData.options || [],
      recommendations: routeData.recommendations || {},
      preferences: nextPreferences,
    });
    setAiRecommendation(ai);
    setLoadingAiRecommendation(false);
  }, [dropoff, pickup, preferences]);

  const calculateRoute = useCallback(async (pickupValue = pickup, dropoffValue = dropoff) => {
    if (!pickupValue?.lat || !dropoffValue?.lat) return;
    setLoadingRoute(true);
    setLoadingAiRecommendation(true);
    setAiRecommendation(null);
    const result = await mobilityRoute({
      pickup_lat: pickupValue.lat,
      pickup_lng: pickupValue.lng,
      dropoff_lat: dropoffValue.lat,
      dropoff_lng: dropoffValue.lng,
      pickup_address: pickupValue.address,
      dropoff_address: dropoffValue.address,
    });
    setLoadingRoute(false);
    if (!result.ok) {
      setLoadingAiRecommendation(false);
      return;
    }
    setOptions(result.options || []);
    setRecommendations(result.recommendations);
    setRouteSummary({ distance_km: result.distance_km, duration_min: result.duration_min });
    setRouteSnapshot({
      distance_km: result.distance_km,
      duration_min: result.duration_min,
      options: result.options || [],
      recommendations: result.recommendations || {},
    });
    await addRecentMobilityLocation({ label: "pickup", address: pickupValue.address, lat: pickupValue.lat, lng: pickupValue.lng, kind: "recent" });
    await addRecentMobilityLocation({ label: "dropoff", address: dropoffValue.address, lat: dropoffValue.lat, lng: dropoffValue.lng, kind: "recent" });
    setRecentLocations(await getRecentMobilityLocations());
    const latLngs = (result.geometry || []).map(([lng, lat]) => [lat, lng]);
    if (routeLayerRef.current) mapRef.current?.removeLayer(routeLayerRef.current);
    const polyline = L.polyline(latLngs, { color: "#0F766E", weight: 6, opacity: 0.9 }).addTo(mapRef.current);
    mapRef.current?.fitBounds(polyline.getBounds(), { padding: [40, 40] });
    routeLayerRef.current = polyline;

    await requestAiRecommendation({
      distance_km: result.distance_km,
      duration_min: result.duration_min,
      options: result.options || [],
      recommendations: result.recommendations || {},
    }, pickupValue, dropoffValue, preferences);
  }, [pickup, dropoff, preferences, requestAiRecommendation]);

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

  const saveQuickLocation = async (kind = "favorite", targetKey = null) => {
    const effectiveTarget = targetKey || (searchTarget === "pickup" ? "pickup" : "dropoff");
    const target = effectiveTarget === "pickup" ? pickup : dropoff;
    if (!target?.address || !target?.lat) return;
    const label = kind === "home" ? "Zuhause" : kind === "work" ? "Arbeit" : makeFavoriteLabel(target.address, effectiveTarget === "pickup" ? "Start" : "Ziel");
    const result = await saveMobilityLocation({
      favorite_id: kind === "home" ? "home" : kind === "work" ? "work" : undefined,
      label,
      address: target.address,
      lat: target.lat,
      lng: target.lng,
      kind,
    });
    if (!result?.ok) return toast.error(result?.error || "Favorit konnte nicht gespeichert werden");
    setSavedLocations(await getSavedMobilityLocations());
    toast.success(`${label} gespeichert`);
  };

  const removeFavorite = async (favoriteId) => {
    const result = await deleteSavedMobilityLocation(favoriteId);
    if (!result?.ok) return toast.error(result?.error || "Favorit konnte nicht gelöscht werden");
    setSavedLocations(await getSavedMobilityLocations());
    toast.success("Favorit gelöscht");
  };

  const updatePreferences = async (changes) => {
    const nextPreferences = { ...preferences, ...changes };
    setPreferences(nextPreferences);
    await saveMobilityPreferences(nextPreferences);
    if (["cheapest", "fastest", "balance", "eco"].includes(nextPreferences.priority)) {
      setSelectedType(nextPreferences.priority);
    }
    if (routeSnapshot?.options?.length) {
      await requestAiRecommendation(routeSnapshot, pickup, dropoff, nextPreferences);
    }
  };

  const bookTransport = async (option) => {
    if (!pickup.lat || !dropoff.lat) return toast.error("Bitte zuerst Start und Ziel festlegen");
    const transportType = option.type;
    const transportLabel = option.label;
    const priceEur = option.price_eur;
    const durationMin = option.duration_min;
    const distanceKm = option.distance_km;
    const pickupValue = { ...pickup };
    const dropoffValue = { ...dropoff };
    const preferenceValue = { ...preferences };
    setBookingTransportType(option.type);
    if (!["wallet", "cash"].includes(selectedPaymentMethod)) {
      const session = await createMobilityCheckoutSession({
        transport_type: transportType,
        payment_method: selectedPaymentMethod,
        origin_url: window.location.origin,
        pickup: pickupValue,
        dropoff: dropoffValue,
        preferences: preferenceValue,
        ai_recommendation: aiRecommendation ? { ...aiRecommendation } : null,
      });
      setBookingTransportType("");
      if (!session.ok) return toast.error(session.error || "Checkout konnte nicht gestartet werden");
      if (selectedPaymentMethod === "qr") {
        setQrCheckout(session);
        return;
      }
      if (selectedPaymentMethod === "nfc") {
        const nfcResult = await writeNFC([{ recordType: "url", data: session.checkout_url }]);
        if (!nfcResult.ok) {
          toast.message("NFC nicht verfügbar — Stripe Checkout wird stattdessen geöffnet");
        }
      }
      window.location.href = session.checkout_url;
      return;
    }
    const result = await createDirectBookingFromValues(
      transportType,
      transportLabel,
      priceEur,
      durationMin,
      distanceKm,
      pickupValue.address,
      pickupValue.lat,
      pickupValue.lng,
      dropoffValue.address,
      dropoffValue.lat,
      dropoffValue.lng,
      preferenceValue.priority,
      preferenceValue.luggage,
      preferenceValue.childSeat,
      aiRecommendation ? JSON.stringify(aiRecommendation) : "",
      selectedPaymentMethod,
    );
    setBookingTransportType("");
    if (!result.ok) return toast.error(result.error || "Buchung fehlgeschlagen");
    toast.success(selectedPaymentMethod === "cash" ? `${transportLabel} als Cash-Fahrt reserviert` : `${transportLabel} gebucht`);
    setDetailOption(null);
    await refreshBootstrapData();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("mobility_session_id");
    const bookingId = params.get("mobility_booking_id");
    if (!sessionId || !bookingId) return;
    let active = true;
    (async () => {
      const status = await getMobilityCheckoutStatus(sessionId);
      if (!active || !status.ok) return;
      if (status.payment_status === "paid") {
        toast.success("Stripe-Zahlung bestätigt");
        await refreshBootstrapData();
        onNavigate?.(`/mobility-booking/${bookingId}`);
      }
    })();
    return () => { active = false; };
  }, [onNavigate, refreshBootstrapData]);

  useEffect(() => {
    if (selectedPaymentMethod !== "nfc") return;
    (async () => {
      const status = await isNFCAvailable();
      setNfcStatus(status);
    })();
  }, [selectedPaymentMethod]);

  return (
    <div className="min-h-screen bg-[#f2eadc] text-[#18202a] pb-28" data-testid="bidblitz-mobility-platform-page">
      <div className="sticky top-0 z-30 bg-[#f2eadc]/92 backdrop-blur-xl border-b border-[#18202a]/8 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate?.("/more")} className="w-10 h-10 rounded-full bg-white/70 border border-[#18202a]/10 flex items-center justify-center" data-testid="mobility-platform-back-btn"><ArrowLeft size={18} className="text-[#18202a]/70" /></button>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#0F766E]">BidBlitz Mobility</p>
            <h1 className="text-lg font-bold">{ui.title}</h1>
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
                <span className="px-3 py-1.5 rounded-full bg-[#0F766E]/10 text-[#0F766E] text-[11px] font-semibold" data-testid="mobility-live-count-taxi">{nearbyCounts.taxi || 0} {ui.liveTaxi}</span>
                <span className="px-3 py-1.5 rounded-full bg-[#7CFF5B]/16 text-[#256C1B] text-[11px] font-semibold" data-testid="mobility-live-count-scooter">{nearbyCounts.scooter || 0} Scooter</span>
                <span className="px-3 py-1.5 rounded-full bg-[#F59E0B]/16 text-[#92400E] text-[11px] font-semibold" data-testid="mobility-live-count-cars">{nearbyCounts.car_rental || 0} {ui.rentalCars}</span>
              </div>
              {loadingNearby && <Loader2 size={16} className="animate-spin text-[#0F766E]" />}
            </div>
            <div className="space-y-2">
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0F766E]" />
                <input value={pickup.address} onFocus={() => { setSearchTarget("pickup"); setActiveField("pickup"); }} onChange={(e) => { setPickup((prev) => ({ ...prev, address: e.target.value })); triggerSearch("pickup", e.target.value); }} placeholder={ui.pickup} className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-[#18202a]/10 text-sm outline-none focus:border-[#0F766E]/40" data-testid="mobility-pickup-input" />
              </div>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#F97316]" />
                <input value={dropoff.address} onFocus={() => { setSearchTarget("dropoff"); setActiveField("dropoff"); }} onChange={(e) => { setDropoff((prev) => ({ ...prev, address: e.target.value })); triggerSearch("dropoff", e.target.value); }} placeholder={ui.dropoff} className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-[#18202a]/10 text-sm outline-none focus:border-[#F97316]/40" data-testid="mobility-dropoff-input" />
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
              <button onClick={useCurrentLocation} className="px-3 py-2 rounded-2xl bg-[#0F766E]/12 border border-[#0F766E]/20 text-[#0F766E] text-xs font-semibold inline-flex items-center gap-1.5" data-testid="mobility-use-current-location-btn"><Navigation size={14} /> {ui.current}</button>
              <button onClick={() => setActiveField(activeField === "pickup" ? "dropoff" : "pickup")} className="px-3 py-2 rounded-2xl bg-[#F97316]/10 border border-[#F97316]/20 text-[#C2410C] text-xs font-semibold inline-flex items-center gap-1.5" data-testid="mobility-map-tap-target-btn"><Crosshair size={14} /> {ui.mapSets}: {activeField === "pickup" ? ui.start : ui.destination}</button>
              <button onClick={() => calculateRoute()} disabled={!pickup.lat || !dropoff.lat || loadingRoute} className="px-3 py-2 rounded-2xl bg-[#F97316] text-white text-xs font-semibold disabled:opacity-40" data-testid="mobility-calculate-route-btn">{loadingRoute ? "..." : ui.compare}</button>
              <button onClick={() => saveQuickLocation("home", "dropoff")} className="px-3 py-2 rounded-2xl bg-white border border-[#18202a]/10 text-[#18202a]/75 text-xs font-semibold" data-testid="mobility-save-home-btn"><Home size={14} className="inline mr-1" /> {ui.home}</button>
              <button onClick={() => saveQuickLocation("work", "dropoff")} className="px-3 py-2 rounded-2xl bg-white border border-[#18202a]/10 text-[#18202a]/75 text-xs font-semibold" data-testid="mobility-save-work-btn"><ShieldCheck size={14} className="inline mr-1" /> {ui.work}</button>
              <button onClick={() => saveQuickLocation("favorite", "pickup")} className="px-3 py-2 rounded-2xl bg-white border border-[#18202a]/10 text-[#18202a]/75 text-xs font-semibold" data-testid="mobility-save-pickup-favorite-btn"><Star size={14} className="inline mr-1" /> {ui.saveStart}</button>
              <button onClick={() => saveQuickLocation("favorite", "dropoff")} className="px-3 py-2 rounded-2xl bg-white border border-[#18202a]/10 text-[#18202a]/75 text-xs font-semibold" data-testid="mobility-save-dropoff-favorite-btn"><Star size={14} className="inline mr-1" /> {ui.saveDestination}</button>
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
              <h2 className="text-lg font-bold mt-1">{ui.aiRules}</h2>
              <p className="text-xs text-[#18202a]/55 mt-1">{ui.aiRulesText}</p>
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

          <div className="mt-4 rounded-2xl bg-white border border-[#18202a]/8 p-4" data-testid="mobility-preferences-panel">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#18202a]/40">{ui.aiPrefs}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                { key: "cheapest", label: "Günstig" },
                { key: "fastest", label: "Schnell" },
                { key: "balance", label: "Balance" },
                { key: "eco", label: "Eco" },
              ].map((item) => (
                <button key={item.key} onClick={() => updatePreferences({ priority: item.key })} className={`px-3 py-2 rounded-full text-xs font-semibold border ${preferences.priority === item.key ? "bg-[#0F766E] text-white border-[#0F766E]" : "bg-[#f8f3e9] text-[#18202a]/80 border-[#18202a]/10"}`} data-testid={`mobility-pref-priority-${item.key}`}>{item.label}</button>
              ))}
              <button onClick={() => updatePreferences({ luggage: !preferences.luggage })} className={`px-3 py-2 rounded-full text-xs font-semibold border ${preferences.luggage ? "bg-[#F97316] text-white border-[#F97316]" : "bg-[#f8f3e9] text-[#18202a]/80 border-[#18202a]/10"}`} data-testid="mobility-pref-luggage-toggle">Gepäck</button>
              <button onClick={() => updatePreferences({ childSeat: !preferences.childSeat })} className={`px-3 py-2 rounded-full text-xs font-semibold border ${preferences.childSeat ? "bg-[#7C3AED] text-white border-[#7C3AED]" : "bg-[#f8f3e9] text-[#18202a]/80 border-[#18202a]/10"}`} data-testid="mobility-pref-child-seat-toggle">Kind</button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-white border border-[#18202a]/8 p-4" data-testid="mobility-payment-method-panel">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#18202a]/40">{ui.checkout}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {paymentOptions.methods.map((method) => (
                <button key={method.id} onClick={() => setSelectedPaymentMethod(method.id)} className={`px-3 py-2 rounded-full text-xs font-semibold border ${selectedPaymentMethod === method.id ? "bg-[#18202a] text-white border-[#18202a]" : "bg-[#f8f3e9] text-[#18202a]/80 border-[#18202a]/10"}`} data-testid={`mobility-payment-method-${method.id}`}>{method.label}</button>
              ))}
            </div>
          </div>

          {selectedPaymentMethod === "nfc" && (
            <div className="mt-4 rounded-2xl bg-white border border-[#18202a]/8 p-4" data-testid="mobility-nfc-diagnostics-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#18202a]/40">NFC Bridge</p>
                  <h3 className="text-base font-bold mt-1">Gerätediagnose & Handoff</h3>
                  <p className="text-sm text-[#18202a]/62 mt-2">Status: {nfcStatus?.available ? `bereit (${nfcStatus.mode})` : (nfcStatus?.reason || "wird geprüft")}</p>
                </div>
                <button onClick={() => onNavigate?.("/nfc")} className="px-4 py-2 rounded-full bg-[#18202a] text-white text-xs font-semibold" data-testid="mobility-open-nfc-lab-btn">NFC Lab öffnen</button>
              </div>
            </div>
          )}

          <div className="mt-4" data-testid="mobility-ai-recommendation-block">
            {loadingAiRecommendation ? (
              <div className="rounded-2xl border border-[#0F766E]/16 bg-[#0F766E]/8 p-4" data-testid="mobility-ai-recommendation-loading">
                <div className="flex items-center gap-2 text-[#0F766E] text-sm font-semibold"><Loader2 size={15} className="animate-spin" /> AI analysiert Preis, Zeit und Eco-Wert…</div>
              </div>
            ) : aiRecommendation?.headline ? (
              <div className="rounded-2xl border border-[#0F766E]/18 bg-[#0F766E]/8 p-4" data-testid="mobility-ai-recommendation-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#0F766E]">AI Route Insight</p>
                    <h3 className="text-base font-bold mt-1 text-[#18202a]">{aiRecommendation.headline}</h3>
                    <p className="text-sm text-[#18202a]/70 mt-2">{aiRecommendation.summary}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-semibold text-[#0F766E]" data-testid="mobility-ai-provider-badge">{aiRecommendation.provider || "rule"}</div>
                    <div className="text-[10px] text-[#18202a]/55">{aiRecommendation.confidence || 0}%</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {aiRecommendation.best_option_type ? <span className="px-3 py-1.5 rounded-full bg-white text-[11px] font-semibold text-[#18202a]" data-testid="mobility-ai-best-option">{ui.bestChoice}: {options.find((item) => item.type === aiRecommendation.best_option_type)?.label || aiRecommendation.best_option_type}</span> : null}
                  {aiRecommendation.secondary_option_type ? <span className="px-3 py-1.5 rounded-full bg-white text-[11px] font-semibold text-[#18202a]">{ui.alternative}: {options.find((item) => item.type === aiRecommendation.secondary_option_type)?.label || aiRecommendation.secondary_option_type}</span> : null}
                </div>
                {!!aiRecommendation.watchouts?.length && (
                  <div className="mt-3 space-y-1" data-testid="mobility-ai-watchouts-list">
                    {aiRecommendation.watchouts.slice(0, 2).map((item, idx) => (
                      <div key={`${item}-${idx}`} className="text-[11px] text-[#18202a]/62">• {item}</div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="space-y-3 mt-4" data-testid="mobility-options-list">
            {options.map((option) => {
              const meta = TRANSPORT_META[option.type] || TRANSPORT_META.taxi;
              const Icon = meta.icon;
              const isSelected = selectedOption?.type === option.type;
              return (
                <div key={option.type} className={`w-full rounded-2xl border p-4 text-left transition-all ${isSelected || aiRecommendation?.best_option_type === option.type ? "border-[#00C2FF]/30 bg-[#00C2FF]/8" : "border-white/[0.06] bg-white/[0.03]"}`} data-testid={`mobility-option-${option.type}`}>
                  <button onClick={() => setDetailOption(option)} className="w-full text-left" data-testid={`mobility-option-detail-${option.type}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${meta.color}18`, color: meta.color }}><Icon size={20} /></div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[#18202a]">{option.label}</span>
                          {isSelected && <span className="px-2 py-0.5 rounded-full bg-[#0F766E]/15 text-[#0F766E] text-[10px] font-semibold">{ui.recommended}</span>}
                        </div>
                        <p className="text-xs text-[#18202a]/55 mt-1">{option.duration_min} Min · {option.distance_km.toFixed(1)} km · Eco {option.eco_score}</p>
                        <p className="text-[11px] text-[#18202a]/42 mt-1">{meta.details?.[lang] || meta.details?.de}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-bold text-[#18202a]">{formatPrice(option.price_eur)}</div>
                      <div className="text-[10px] text-[#18202a]/45 mt-1">{(option.payment_methods || []).map((id) => paymentOptions.methods.find((item) => item.id === id)?.label || id).slice(0, 3).join(" · ")}</div>
                    </div>
                  </div>
                  </button>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-[#18202a]/55">{selectedPaymentMethod === "wallet" ? ui.directWallet : selectedPaymentMethod === "cash" ? ui.directCash : `Checkout: ${paymentOptions.methods.find((item) => item.id === selectedPaymentMethod)?.label || selectedPaymentMethod}`}</div>
                    <button onClick={() => bookTransport(option)} className="px-4 py-2 rounded-full bg-[#18202a] text-white text-xs font-semibold disabled:opacity-40" disabled={bookingTransportType === option.type} data-testid={`mobility-book-option-${option.type}`}>{bookingTransportType === option.type ? ui.booking : ui.bookNow}</button>
                  </div>
                </div>
              );
            })}
            {!options.length && (
              <div className="rounded-2xl border border-dashed border-[#18202a]/14 bg-white/70 p-4 text-sm text-[#18202a]/65" data-testid="mobility-empty-comparison-state">
                {ui.empty}
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white border border-[#18202a]/8 p-4" data-testid="mobility-saved-locations-card">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2"><Star size={14} className="text-[#FACC15]" /><p className="text-xs font-semibold">{ui.favorites}</p></div>
                <span className="text-[10px] text-[#18202a]/45">{savedLocations.length}</span>
              </div>
              <div className="space-y-2">
                {savedLocations.slice(0, 6).map((item) => (
                  <div key={item.favorite_id || `${item.label}-${item.address}`} className="flex items-start gap-2 rounded-xl bg-[#f8f3e9] px-2 py-2">
                    <button onClick={() => applyLocation(searchTarget === "pickup" ? "pickup" : "dropoff", item)} className="flex-1 min-w-0 text-left px-1" data-testid={`mobility-saved-location-${item.favorite_id || item.label}`}>
                      <div className="text-xs font-semibold text-[#18202a]">{item.label}</div>
                      <div className="text-[10px] text-[#18202a]/45 truncate mt-0.5">{item.address}</div>
                    </button>
                    <button onClick={() => removeFavorite(item.favorite_id)} className="w-8 h-8 rounded-full bg-white border border-[#18202a]/10 flex items-center justify-center text-[#18202a]/55 shrink-0" data-testid={`mobility-delete-saved-location-${item.favorite_id || item.label}`}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {!savedLocations.length && <div className="text-[11px] text-[#18202a]/45">{ui.noFavorites}</div>}
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-[#18202a]/8 p-4" data-testid="mobility-recent-locations-card">
              <div className="flex items-center justify-between gap-3 mb-3"><div className="flex items-center gap-2"><MapPin size={14} className="text-[#00C2FF]" /><p className="text-xs font-semibold">{ui.recents}</p></div><span className="text-[10px] text-[#18202a]/45">{recentLocations.length}</span></div>
              <div className="space-y-2">
                {recentLocations.slice(0, 4).map((item, idx) => (
                  <button key={`${item.address}-${idx}`} onClick={() => applyLocation(searchTarget === "pickup" ? "pickup" : "dropoff", item)} className="w-full text-left rounded-xl bg-[#f8f3e9] px-3 py-2" data-testid={`mobility-recent-location-${idx}`}>
                    <div className="text-[11px] font-semibold text-[#18202a]">{item.label || ui.recentLabel}</div>
                    <div className="text-[10px] text-[#18202a]/45 truncate mt-0.5">{item.address}</div>
                    <div className="text-[10px] text-[#18202a]/35 mt-1">{item.use_count ? `${item.use_count}× ${ui.used}` : "Neu"}</div>
                  </button>
                ))}
                {!recentLocations.length && <div className="text-[11px] text-[#18202a]/45">{ui.noRecents}</div>}
              </div>
            </div>
          </div>

          {!!bookings.length && (
            <div className="mt-4 rounded-2xl bg-white border border-[#18202a]/8 p-4" data-testid="mobility-recent-bookings-card">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-xs font-semibold">{ui.bookings}</p>
                <span className="text-[10px] text-[#18202a]/45">Wallet: {formatPrice(paymentOptions.wallet_balance)}</span>
              </div>
              <div className="space-y-2">
                {bookings.slice(0, 3).map((item) => (
                  <button key={item.booking_id} className="w-full text-left rounded-xl bg-[#f8f3e9] px-3 py-2" data-testid={`mobility-booking-${item.booking_id}`} onClick={() => onNavigate?.(`/mobility-booking/${item.booking_id}`)}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold text-[#18202a]">{item.transport_label}</div>
                        <div className="text-[10px] text-[#18202a]/45 mt-0.5 truncate">{item.pickup?.address} → {item.dropoff?.address}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-semibold text-[#18202a]">{formatPrice(item.price_eur)}</div>
                        <div className="text-[10px] text-[#18202a]/45">{item.status}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {qrCheckout && (
            <div className="mt-4 rounded-2xl bg-white border border-[#18202a]/8 p-4" data-testid="mobility-qr-checkout-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#18202a]/40">{ui.qrTitle}</p>
                  <h3 className="text-base font-bold mt-1">{ui.qrTitle}</h3>
                  <p className="text-sm text-[#18202a]/62 mt-2">{ui.qrText}</p>
                </div>
                <button onClick={() => setQrCheckout(null)} className="px-3 py-2 rounded-full bg-[#f8f3e9] text-xs font-semibold border border-[#18202a]/10" data-testid="mobility-qr-close-button">{ui.close}</button>
              </div>
              <div className="mt-4 flex flex-col items-center gap-3">
                <QRCodeSVG value={qrCheckout.checkout_url} size={180} includeMargin data-testid="mobility-qr-code" />
                <a href={qrCheckout.checkout_url} className="px-4 py-2 rounded-full bg-[#18202a] text-white text-xs font-semibold" data-testid="mobility-qr-open-link">{ui.openStripe}</a>
              </div>
            </div>
          )}

          {selectedNearby && (
            <div className="mt-4 rounded-2xl bg-[#0F766E]/8 border border-[#0F766E]/20 p-4" data-testid="mobility-selected-nearby-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#0F766E]">{ui.nearby}</p>
                  <h3 className="text-base font-bold mt-1 text-[#18202a]">{selectedNearby.label}</h3>
                  <p className="text-xs text-[#18202a]/60 mt-1">{selectedNearby.subtitle || ui.nearbyFallback}</p>
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

      <MobilityDetailSheet option={detailOption} onClose={() => setDetailOption(null)} paymentOptions={paymentOptions} ui={ui} lang={lang} />
    </div>
  );
}