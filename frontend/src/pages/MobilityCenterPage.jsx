import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Bike, Car, Crown, MapPinned, Route, Sparkles, Ticket, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";

import { bookBestMobilityRoute, getFrequentMobilityRoutes, getMobilityCompareSummary, getMobilityPaymentOptions, getMyMobilityBookings, getSavedMobilityLocations, saveFrequentMobilityRoute } from "../services/mobilityPlatformApi";

const moduleCards = [
  { id: "mobility-map", label: "Mobility Map", route: "/mobility-map", icon: MapPinned, tone: "#00C2FF", desc: "Vergleiche Taxi, E-Scooter, E-Bike, Carsharing, EV und Car Rental auf einer Karte." },
  { id: "taxi", label: "Taxi & Ride", route: "/taxi", icon: Car, tone: "#38BDF8", desc: "Sofortfahrten, Fahreransicht und Reservierungen bündeln." },
  { id: "scooter", label: "E-Scooter", route: "/mobility-map?mode=scooter", icon: Zap, tone: "#84CC16", desc: "Kurzstrecken, QR-Rides und direkte Micro-Mobility-Buchungen." },
  { id: "ebike", label: "E-Bike", route: "/mobility-map?mode=bike", icon: Bike, tone: "#FACC15", desc: "Leise City-Strecken mit Eco-Fokus und schnellem Rebook." },
  { id: "ev", label: "EV Charging", route: "/ev", icon: Crown, tone: "#F97316", desc: "Laden, Sessions tracken und Stationen verwalten." },
  { id: "carsharing", label: "Carsharing", route: "/mobility-map?mode=car_sharing", icon: Car, tone: "#14B8A6", desc: "Flexible Minuten- oder Stundenfahrten direkt aus dem Hub." },
  { id: "car-rental", label: "Car Rental", route: "/car-rental", icon: Car, tone: "#A78BFA", desc: "Mietwagen, Vendor-Dashboards und Buchungsdetails." },
  { id: "bookings", label: "Meine Fahrten", route: "/mobility-map", icon: Route, tone: "#FACC15", desc: "Aktive Buchungen, Tracking und Favoriten im selben Flow." },
];

const compareMeta = {
  taxi: { label: "Taxi", tone: "#38BDF8" },
  scooter: { label: "E-Scooter", tone: "#84CC16" },
  bike: { label: "E-Bike", tone: "#FACC15" },
  ev: { label: "EV Drive", tone: "#F97316" },
  car_sharing: { label: "Carsharing", tone: "#14B8A6" },
  car_rental: { label: "Car Rental", tone: "#A78BFA" },
};

function formatMoney(value) {
  return `€${Math.abs(Number(value || 0)).toFixed(2)}`;
}

function buildComparePresets(bookings, savedLocations) {
  const presets = [];
  const latestBooking = bookings.find((item) => item.pickup?.lat && item.dropoff?.lat);
  if (latestBooking) {
    presets.push({
      id: `booking-${latestBooking.booking_id}`,
      label: latestBooking.transport_label || "Letzte Fahrt",
      pickup: latestBooking.pickup,
      dropoff: latestBooking.dropoff,
      hint: "Basierend auf deiner letzten Buchung",
    });
  }

  const home = savedLocations.find((item) => item.kind === "home");
  const work = savedLocations.find((item) => item.kind === "work");
  if (home && work) {
    presets.push({
      id: "home-work",
      label: "Home → Work",
      pickup: { address: home.address, lat: home.lat, lng: home.lng },
      dropoff: { address: work.address, lat: work.lat, lng: work.lng },
      hint: "Ideal für tägliche Pendelwege",
    });
    presets.push({
      id: "work-home",
      label: "Work → Home",
      pickup: { address: work.address, lat: work.lat, lng: work.lng },
      dropoff: { address: home.address, lat: home.lat, lng: home.lng },
      hint: "Schneller Feierabend-Vergleich",
    });
  }

  return presets.slice(0, 3);
}

export default function MobilityCenterPage({ onBack, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [savedLocations, setSavedLocations] = useState([]);
  const [paymentOptions, setPaymentOptions] = useState({ wallet_balance: 0, methods: [] });
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareSummary, setCompareSummary] = useState(null);
  const [frequentRoutes, setFrequentRoutes] = useState([]);
  const [bookingBestRouteId, setBookingBestRouteId] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [bookingData, locationData, paymentData] = await Promise.all([
        getMyMobilityBookings(),
        getSavedMobilityLocations(),
        getMobilityPaymentOptions(),
      ]);
      setBookings(bookingData || []);
      setSavedLocations(locationData || []);
      setPaymentOptions(paymentData || { wallet_balance: 0, methods: [] });
      setFrequentRoutes(await getFrequentMobilityRoutes());
      setLoading(false);
    };
    load();
  }, []);

  const comparePresets = useMemo(() => buildComparePresets(bookings, savedLocations), [bookings, savedLocations]);
  const activeBookings = useMemo(() => bookings.filter((item) => ["payment_pending", "confirmed", "in_progress"].includes(item.status)), [bookings]);
  const leadActiveBooking = activeBookings[0] || null;

  useEffect(() => {
    if (!comparePresets.length) return;
    setSelectedPresetId((prev) => prev || comparePresets[0].id);
  }, [comparePresets]);

  useEffect(() => {
    const preset = comparePresets.find((item) => item.id === selectedPresetId);
    if (!preset?.pickup?.lat || !preset?.dropoff?.lat) return;
    let active = true;
    const loadCompare = async () => {
      setCompareLoading(true);
      const result = await getMobilityCompareSummary({
        pickup: preset.pickup,
        dropoff: preset.dropoff,
        focus_modes: ["taxi", "scooter", "bike", "ev", "car_sharing", "car_rental"],
      });
      if (!active) return;
      setCompareSummary(result.ok ? result : null);
      setCompareLoading(false);
    };
    loadCompare();
    return () => {
      active = false;
    };
  }, [comparePresets, selectedPresetId]);

  const stats = useMemo(() => ({
    activeBookings: bookings.filter((item) => ["pending", "confirmed", "in_progress"].includes(item.status)).length,
    savedPlaces: savedLocations.length,
    paymentMethods: (paymentOptions.methods || []).length,
  }), [bookings, paymentOptions.methods, savedLocations.length]);

  const selectedPreset = comparePresets.find((item) => item.id === selectedPresetId) || null;

  const handleSaveCurrentRoute = async () => {
    if (!selectedPreset) return;
    const result = await saveFrequentMobilityRoute({
      label: `${selectedPreset.pickup?.address || 'Start'} → ${selectedPreset.dropoff?.address || 'Ziel'}`,
      pickup: selectedPreset.pickup,
      dropoff: selectedPreset.dropoff,
      preferred_transport_type: compareSummary?.best?.balance?.type || "taxi",
      payment_method: "wallet",
    });
    if (!result.ok) return toast.error(result.error || "Route konnte nicht gespeichert werden");
    toast.success("Route als Frequent Route gespeichert");
    setFrequentRoutes(await getFrequentMobilityRoutes());
  };

  const handleBookBestRoute = async (route) => {
    setBookingBestRouteId(route.route_id);
    const result = await bookBestMobilityRoute({
      route_id: route.route_id,
      transport_type: route.transport_type || compareSummary?.best?.balance?.type || "taxi",
      payment_method: route.payment_method || "wallet",
    });
    setBookingBestRouteId("");
    if (!result.ok) return toast.error(result.error || "Best Route konnte nicht gebucht werden");
    toast.success("Frequent Route erneut gebucht");
    onNavigate(`/mobility-booking/${result.booking.booking_id}`);
  };

  return (
    <div className="min-h-screen bg-[#050911] text-white pb-24" data-testid="mobility-center-page">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 h-72 w-72 rounded-full bg-[#00C2FF]/12 blur-[110px]" />
        <div className="absolute right-0 top-52 h-80 w-80 rounded-full bg-[#F97316]/12 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-[max(env(safe-area-inset-top,0px),18px)] space-y-6">
        <motion.header className="rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:p-7 backdrop-blur-xl" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={onBack} data-testid="mobility-center-back-button" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">
            <ArrowLeft className="h-4 w-4" /> Zurück
          </button>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#00C2FF]/10 px-3 py-1 text-xs font-semibold text-[#8EEBFF]" data-testid="mobility-center-badge">
            <Sparkles className="h-4 w-4" /> Mobility Center V1
          </div>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight" data-testid="mobility-center-title">Alles für Rides, EV, E‑Bike, Carsharing und Tracking in einem Hub.</h1>
              <p className="mt-4 text-sm sm:text-base text-white/70" data-testid="mobility-center-subtitle">Das Mobility Center bündelt Taxi, E‑Scooter, E‑Bike, Carsharing, EV und Car Rental — inklusive klarem 6‑Wege Preis-/Zeitvergleich, Buchungen und Tracking.</p>
            </div>
            <div className="grid w-full max-w-md grid-cols-2 gap-3">
              {[
                { id: "active-bookings", label: "Aktive Fahrten", value: stats.activeBookings, icon: Route },
                { id: "saved-places", label: "Gespeicherte Orte", value: stats.savedPlaces, icon: Ticket },
                { id: "wallet-balance", label: "Wallet", value: `€${Number(paymentOptions.wallet_balance || 0).toFixed(2)}`, icon: Wallet },
                { id: "payment-methods", label: "Methoden", value: stats.paymentMethods, icon: Bike },
              ].map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4" data-testid={`mobility-stat-${item.id}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/55">{item.label}</span>
                    <item.icon className="h-4 w-4 text-white/60" />
                  </div>
                  <p className="mt-3 text-2xl font-black">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {moduleCards.map((card, index) => (
            <motion.button key={card.id} onClick={() => onNavigate(card.route)} data-testid={`mobility-center-card-${card.id}`} className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 text-left" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${card.tone}18`, color: card.tone }}>
                <card.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-base md:text-lg font-bold">{card.label}</h2>
              <p className="mt-2 text-sm text-white/65">{card.desc}</p>
            </motion.button>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <motion.div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:p-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Klarer 6-Wege Vergleich</p>
                <h2 className="mt-2 text-base md:text-lg font-bold" data-testid="mobility-center-compare-title">Taxi, E-Scooter, E-Bike, EV Drive, Carsharing und Car Rental direkt gegenübergestellt</h2>
                <p className="mt-2 text-sm text-white/65" data-testid="mobility-center-compare-subtitle">Ich nutze automatisch deine letzte Fahrt oder Home/Work, damit du sofort Preis, ETA und die beste Option über alle Kernmodi siehst.</p>
              </div>
              <button onClick={() => onNavigate('/mobility-map')} data-testid="mobility-center-compare-open-map-button" className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/75">Auf Karte öffnen</button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2" data-testid="mobility-center-compare-preset-list">
              {comparePresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedPresetId(preset.id)}
                  data-testid={`mobility-center-compare-preset-${preset.id}`}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold ${selectedPresetId === preset.id ? 'border-[#8EEBFF]/50 bg-[#00C2FF]/14 text-[#8EEBFF]' : 'border-white/10 bg-black/20 text-white/70'}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {selectedPreset ? <button onClick={handleSaveCurrentRoute} data-testid="mobility-center-save-frequent-route-button" className="mt-4 rounded-full border border-white/10 px-3 py-2 text-xs text-white/80">Als Frequent Route speichern</button> : null}

            {selectedPreset && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4" data-testid="mobility-center-compare-route-card">
                <p className="text-xs text-white/55">{selectedPreset.hint}</p>
                <p className="mt-2 text-sm font-semibold">{selectedPreset.pickup?.address || 'Start'} → {selectedPreset.dropoff?.address || 'Ziel'}</p>
                {compareSummary?.route && (
                  <p className="mt-2 text-xs text-white/55" data-testid="mobility-center-compare-route-summary">{compareSummary.route.distance_km?.toFixed(1)} km · Basis {compareSummary.route.duration_min} Min</p>
                )}
              </div>
            )}

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {compareLoading && <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-white/55" data-testid="mobility-center-compare-loading">Vergleich wird berechnet…</div>}
              {!compareLoading && (compareSummary?.cards || []).map((card) => (
                <div key={card.type} className="rounded-2xl border border-white/10 bg-black/20 p-4" data-testid={`mobility-center-compare-card-${card.type}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold" style={{ color: compareMeta[card.type]?.tone || '#fff' }}>{compareMeta[card.type]?.label || card.label}</p>
                      <p className="mt-1 text-xs text-white/55">{card.duration_min} Min · {card.distance_km.toFixed(1)} km</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black">€{Number(card.price_eur || 0).toFixed(2)}</p>
                      <p className="text-[11px] text-white/45">Eco {card.eco_score}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(card.tags || []).slice(0, 2).map((tag) => (
                      <span key={`${card.type}-${tag}`} className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold text-white/80">{tag}</span>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/60">
                    <div className="rounded-xl bg-white/5 px-3 py-2">vs Taxi {card.price_delta_vs_taxi > 0 ? '+' : '-'}{formatMoney(card.price_delta_vs_taxi)}</div>
                    <div className="rounded-xl bg-white/5 px-3 py-2">ETA {card.time_delta_vs_taxi > 0 ? '+' : ''}{card.time_delta_vs_taxi} Min</div>
                  </div>
                </div>
              ))}
              {!compareLoading && comparePresets.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 p-5 text-sm text-white/55" data-testid="mobility-center-compare-empty">Sobald du eine Mobility-Fahrt oder Home/Work gespeichert hast, erscheint hier automatisch dein 4-Wege Vergleich.</div>}
            </div>
          </motion.div>

          <motion.div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:p-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <p className="text-xs uppercase tracking-[0.22em] text-white/45">Smart entscheiden</p>
            <h2 className="mt-2 text-base md:text-lg font-bold">Was der Vergleich sofort zeigt</h2>
            <div className="mt-5 grid gap-3">
              {[
                { id: 'cheapest', label: 'Günstigste', value: compareSummary?.best?.cheapest?.label || '—', desc: compareSummary?.best?.cheapest?.reason || 'Preisleader wird automatisch markiert.' },
                { id: 'fastest', label: 'Schnellste', value: compareSummary?.best?.fastest?.label || '—', desc: compareSummary?.best?.fastest?.reason || 'Die schnellste ETA ist sofort sichtbar.' },
                { id: 'eco', label: 'Eco', value: compareSummary?.best?.eco?.label || '—', desc: compareSummary?.best?.eco?.reason || 'Für nachhaltige Wege priorisiert.' },
                { id: 'balance', label: 'Balance', value: compareSummary?.best?.balance?.label || '—', desc: compareSummary?.best?.balance?.reason || 'Beste Mischung aus Preis und Zeit.' },
              ].map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4" data-testid={`mobility-center-best-${item.id}`}>
                  <p className="text-xs text-white/50">{item.label}</p>
                  <p className="mt-2 text-lg font-black">{item.value}</p>
                  <p className="mt-1 text-xs text-white/55">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <motion.div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:p-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Neueste Mobility-Buchungen</p>
                <h2 className="mt-2 text-base md:text-lg font-bold">Tracking, Status und schneller Wiedereinstieg</h2>
              </div>
              <button onClick={() => onNavigate('/mobility-map')} data-testid="mobility-center-open-map-button" className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/75">Zur Karte</button>
            </div>

            {leadActiveBooking ? (
              <div className="mt-5 rounded-[1.75rem] border border-[#8EEBFF]/20 bg-[#00C2FF]/10 p-4" data-testid="mobility-center-active-tracking-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#8EEBFF]">Live Tracking</p>
                    <h3 className="mt-2 text-lg font-bold">{leadActiveBooking.transport_label || leadActiveBooking.transport_type || 'Aktive Fahrt'}</h3>
                    <p className="mt-2 text-sm text-white/75">{leadActiveBooking.pickup?.address || 'Pickup'} → {leadActiveBooking.dropoff?.address || 'Dropoff'}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-white/10 px-3 py-1.5 font-semibold text-white" data-testid="mobility-center-active-booking-status">{leadActiveBooking.status || 'confirmed'}</span>
                      <span className="rounded-full bg-white/10 px-3 py-1.5 font-semibold text-white" data-testid="mobility-center-active-booking-price">€{Number(leadActiveBooking.price_eur || 0).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => onNavigate(`/mobility-booking/${leadActiveBooking.booking_id}`)} data-testid="mobility-center-open-active-tracking-button" className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#0b1220]">Tracking öffnen</button>
                    <button onClick={() => onNavigate('/mobility-map')} data-testid="mobility-center-open-active-map-button" className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/85">Auf Karte</button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              {loading && <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-white/55" data-testid="mobility-center-loading">Mobility Center lädt…</div>}
              {!loading && bookings.slice(0, 4).map((booking) => (
                <button key={booking.booking_id} onClick={() => onNavigate(`/mobility-booking/${booking.booking_id}`)} data-testid={`mobility-booking-${booking.booking_id}`} className="w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">{booking.transport_label || booking.transport_type || 'Mobility Ride'}</p>
                      <p className="mt-1 text-xs text-white/55">{booking.pickup?.address || 'Pickup'} → {booking.dropoff?.address || 'Dropoff'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#8EEBFF]">€{Number(booking.price_eur || 0).toFixed(2)}</p>
                      <p className="text-[11px] text-white/55">{booking.status || 'pending'}</p>
                    </div>
                  </div>
                </button>
              ))}
              {!loading && bookings.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 p-5 text-sm text-white/55" data-testid="mobility-center-empty-bookings">Noch keine Mobility-Buchung vorhanden. Starte direkt auf der Mobility Map oder im Taxi/Scooter-Modul.</div>}
            </div>
          </motion.div>

          <motion.div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:p-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">Schnellzugriffe</p>
                <h2 className="mt-2 text-base md:text-lg font-bold">Favoriten, Wallet und alle Kernmodi sofort erreichbar</h2>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4" data-testid="mobility-center-saved-locations-card">
                <p className="text-sm font-semibold">Gespeicherte Orte</p>
                <p className="mt-2 text-3xl font-black">{savedLocations.length}</p>
                <p className="mt-1 text-xs text-white/55">Home, Work und häufige Ziele können direkt in der Mobility Map genutzt werden.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4" data-testid="mobility-center-payments-card">
                <p className="text-sm font-semibold">Zahlungsmethoden</p>
                <p className="mt-2 text-3xl font-black">{(paymentOptions.methods || []).length}</p>
                <p className="mt-1 text-xs text-white/55">Wallet, Cash, Karten und Checkout-Methoden stehen gesammelt bereit.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => onNavigate('/ev')} data-testid="mobility-center-ev-button" className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left text-sm font-semibold">EV Charging</button>
                <button onClick={() => onNavigate('/mobility-map?mode=scooter')} data-testid="mobility-center-scooter-button" className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left text-sm font-semibold">E-Scooter</button>
                <button onClick={() => onNavigate('/mobility-map?mode=bike')} data-testid="mobility-center-ebike-button" className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left text-sm font-semibold">E-Bike</button>
                <button onClick={() => onNavigate('/mobility-map?mode=car_sharing')} data-testid="mobility-center-carsharing-button" className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left text-sm font-semibold">Carsharing</button>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:p-6" data-testid="mobility-center-frequent-routes-section">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/45">Best Route Flow</p>
            <h2 className="mt-2 text-base md:text-lg font-bold">Frequent Routes automatisch erkannt und mit einem Tap wieder buchbar</h2>
            <p className="mt-2 text-sm text-white/65">Wiederkehrende Strecken werden gesammelt und direkt per Rebook-CTA neu gebucht.</p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {frequentRoutes.map((route) => (
              <div key={route.route_id} className="rounded-2xl border border-white/10 bg-black/20 p-4" data-testid={`mobility-frequent-route-${route.route_id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">{route.label}</p>
                    <p className="mt-1 text-xs text-white/55">{route.transport_label} · {route.usage_count}× genutzt</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">€{Number(route.avg_price_eur || 0).toFixed(2)}</p>
                    <p className="text-[11px] text-white/55">Ø {route.avg_duration_min} Min</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => handleBookBestRoute(route)} disabled={bookingBestRouteId === route.route_id} data-testid={`mobility-frequent-route-book-${route.route_id}`} className="rounded-full bg-[#00C2FF]/15 px-3 py-2 text-xs font-semibold text-[#8EEBFF] disabled:opacity-50">{bookingBestRouteId === route.route_id ? 'Bucht…' : 'Mit 1 Tap buchen'}</button>
                  <button onClick={() => onNavigate('/mobility-map')} data-testid={`mobility-frequent-route-open-map-${route.route_id}`} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/70">Best Route ansehen</button>
                </div>
              </div>
            ))}
            {frequentRoutes.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 p-5 text-sm text-white/55" data-testid="mobility-frequent-routes-empty">Nach ein paar wiederkehrenden Fahrten erscheinen hier automatisch deine Frequent Routes.</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}