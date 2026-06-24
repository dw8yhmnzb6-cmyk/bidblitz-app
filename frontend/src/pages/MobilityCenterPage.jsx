import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Bike, Car, Crown, MapPinned, Route, Sparkles, Ticket, Wallet, Zap } from "lucide-react";

import { getMobilityPaymentOptions, getMyMobilityBookings, getSavedMobilityLocations } from "../services/mobilityPlatformApi";

const moduleCards = [
  { id: "mobility-map", label: "Mobility Map", route: "/mobility-map", icon: MapPinned, tone: "#00C2FF", desc: "Vergleiche Taxi, Scooter, Bike, Shuttle und VIP auf einer Karte." },
  { id: "taxi", label: "Taxi & Ride", route: "/taxi", icon: Car, tone: "#38BDF8", desc: "Sofortfahrten, Fahreransicht und Reservierungen bündeln." },
  { id: "scooter", label: "Scooter & Bike", route: "/scooter", icon: Zap, tone: "#84CC16", desc: "Kurzstrecken, QR-Rides und stationenbasierte Micro-Mobility." },
  { id: "ev", label: "EV Charging", route: "/ev", icon: Crown, tone: "#F97316", desc: "Laden, Sessions tracken und Stationen verwalten." },
  { id: "car-rental", label: "Car Rental", route: "/car-rental", icon: Car, tone: "#A78BFA", desc: "Mietwagen, Vendor-Dashboards und Buchungsdetails." },
  { id: "bookings", label: "Meine Fahrten", route: "/mobility-map", icon: Route, tone: "#FACC15", desc: "Aktive Buchungen, Tracking und Favoriten im selben Flow." },
];

export default function MobilityCenterPage({ onBack, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [savedLocations, setSavedLocations] = useState([]);
  const [paymentOptions, setPaymentOptions] = useState({ wallet_balance: 0, methods: [] });

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
      setLoading(false);
    };
    load();
  }, []);

  const stats = useMemo(() => ({
    activeBookings: bookings.filter((item) => ["pending", "confirmed", "in_progress"].includes(item.status)).length,
    savedPlaces: savedLocations.length,
    paymentMethods: (paymentOptions.methods || []).length,
  }), [bookings, paymentOptions.methods, savedLocations.length]);

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
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight" data-testid="mobility-center-title">Alles für Rides, EV, Scooter und Tracking in einem Hub.</h1>
              <p className="mt-4 text-sm sm:text-base text-white/70" data-testid="mobility-center-subtitle">Das Mobility Center bündelt die bestehenden Taxi-, Scooter-, EV- und Car-Rental-Module und gibt dir einen schnellen Einstieg in Preisvergleich, Buchungen und Tracking.</p>
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

        <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <motion.div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:p-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Neueste Mobility-Buchungen</p>
                <h2 className="mt-2 text-base md:text-lg font-bold">Tracking, Status und schneller Wiedereinstieg</h2>
              </div>
              <button onClick={() => onNavigate('/mobility-map')} data-testid="mobility-center-open-map-button" className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/75">Zur Karte</button>
            </div>

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
              <h2 className="mt-2 text-base md:text-lg font-bold">Favoriten, Wallet und EV sofort erreichbar</h2>
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
                <button onClick={() => onNavigate('/scooter')} data-testid="mobility-center-scooter-button" className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left text-sm font-semibold">Scooter</button>
              </div>
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}