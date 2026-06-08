/**
 * Hotel Sabre Search Page — Kettenhotels suchen & buchen
 */
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft, Search, MapPin, Star, Users, Calendar,
  Loader2, Check, Hotel, Clock3,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || "Fehler");
  return d;
}

export default function HotelSabreSearchPage({ onBack }) {
  const defaultDates = useMemo(() => {
    const now = new Date();
    const checkIn = new Date(now);
    checkIn.setDate(checkIn.getDate() + 1);
    const checkOut = new Date(now);
    checkOut.setDate(checkOut.getDate() + 2);
    const toIso = (date) => date.toISOString().slice(0, 10);
    return { check_in: toIso(checkIn), check_out: toIso(checkOut) };
  }, []);

  const [view, setView] = useState("search"); // search | bookings
  const [searchForm, setSearchForm] = useState({
    city: "",
    check_in: defaultDates.check_in,
    check_out: defaultDates.check_out,
    guests: 1,
    min_stars: null,
  });
  const [hotels, setHotels] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [searchTouched, setSearchTouched] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    guest_name: "",
    guest_email: "",
  });

  const isSearchReady = Boolean(searchForm.city && searchForm.check_in && searchForm.check_out);
  const isBookingReady = Boolean(bookingForm.guest_name.trim() && bookingForm.guest_email.trim());
  const stayNights = useMemo(() => {
    if (!searchForm.check_in || !searchForm.check_out) return 0;
    const start = new Date(searchForm.check_in);
    const end = new Date(searchForm.check_out);
    return Math.max(0, Math.round((end - start) / 86400000));
  }, [searchForm.check_in, searchForm.check_out]);

  const loadBookings = async () => {
    setBookingsLoading(true);
    try {
      const res = await api("/api/hotels/sabre/bookings");
      setBookings(res.bookings || []);
    } catch (err) {
      toast.error(err.message || "Buchungen konnten nicht geladen werden");
    } finally {
      setBookingsLoading(false);
    }
  };

  const handleViewChange = async (nextView) => {
    setView(nextView);
    if (nextView === "bookings") {
      await loadBookings();
    }
  };

  const searchHotels = async () => {
    setSearchTouched(true);
    if (!isSearchReady) {
      return;
    }
    if (stayNights <= 0) {
      toast.error("Check-out muss nach Check-in liegen");
      return;
    }
    
    setLoading(true);
    try {
      const res = await api("/api/hotels/sabre/search", {
        method: "POST",
        body: JSON.stringify(searchForm),
      });
      setHotels(res.hotels || []);
      toast.success(`${res.count} Hotels gefunden`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const bookRoom = async () => {
    if (!selectedHotel || !selectedRoom) return;
    if (!isBookingReady) {
      toast.error("Bitte Name und E-Mail eingeben");
      return;
    }

    try {
      const res = await api("/api/hotels/sabre/book", {
        method: "POST",
        body: JSON.stringify({
          hotel_id: selectedHotel.id,
          room_type: selectedRoom.type,
          check_in: searchForm.check_in,
          check_out: searchForm.check_out,
          guests: searchForm.guests,
          ...bookingForm,
        }),
      });
      toast.success(`Gebucht: ${res.booking.booking_id}`);
      setSelectedHotel(null);
      setSelectedRoom(null);
      setBookingForm({ guest_name: "", guest_email: "" });
      await handleViewChange("bookings");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const cancelBooking = async (bookingId) => {
    try {
      const res = await api(`/api/hotels/sabre/bookings/${bookingId}/cancel`, { method: "POST" });
      toast.success(`Buchung storniert • Erstattung ${res.refund_percent}%`);
      loadBookings();
    } catch (err) {
      toast.error(err.message || "Stornierung fehlgeschlagen");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Sabre Hotels</h1>
            <p className="text-xs text-gray-600">Kettenhotels weltweit</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-gray-200">
          <button
            onClick={() => handleViewChange("search")}
            className={`flex-1 py-3 text-sm font-medium transition ${
              view === "search" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600"
            }`}
          >
            Suchen
          </button>
          <button
            onClick={() => handleViewChange("bookings")}
            className={`flex-1 py-3 text-sm font-medium transition ${
              view === "bookings" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600"
            }`}
          >
            Meine Buchungen
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {view === "search" && (
          <>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 space-y-4" data-testid="sabre-search-form">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-[0.18em] mb-2">Ziel</p>
            <input
              type="text"
              placeholder="Berlin, München, Hamburg ..."
              value={searchForm.city}
              onChange={(e) => setSearchForm({ ...searchForm, city: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              data-testid="sabre-city-input"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Check-in</p>
              <input
                type="date"
                value={searchForm.check_in}
                onChange={(e) => setSearchForm({ ...searchForm, check_in: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm"
                data-testid="sabre-checkin-input"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Check-out</p>
              <input
                type="date"
                value={searchForm.check_out}
                onChange={(e) => setSearchForm({ ...searchForm, check_out: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm"
                data-testid="sabre-checkout-input"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Gäste</p>
              <input
                type="number"
                min="1"
                value={searchForm.guests}
                onChange={(e) => setSearchForm({ ...searchForm, guests: Math.max(1, parseInt(e.target.value || "1", 10)) })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                placeholder="Gäste"
                data-testid="sabre-guests-input"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Kategorie</p>
              <select
                value={searchForm.min_stars || ""}
                onChange={(e) => setSearchForm({ ...searchForm, min_stars: e.target.value ? parseInt(e.target.value, 10) : null })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                data-testid="sabre-stars-select"
              >
                <option value="">Alle Sterne</option>
                <option value="3">3+ Sterne</option>
                <option value="4">4+ Sterne</option>
                <option value="5">5 Sterne</option>
              </select>
            </div>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-800 flex items-center gap-2" data-testid="sabre-search-summary">
            <Clock3 size={14} />
            Aufenthalt: {stayNights > 0 ? `${stayNights} Nacht${stayNights > 1 ? "e" : ""}` : "Bitte gültige Daten wählen"}
          </div>
          {searchTouched && !isSearchReady && (
            <p className="text-xs text-red-500" data-testid="sabre-search-validation">Bitte Stadt, Check-in und Check-out ausfüllen.</p>
          )}
          <button
            onClick={searchHotels}
            disabled={loading || !isSearchReady}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="sabre-search-button"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
            Suchen
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {!loading && searchTouched && hotels.length === 0 && isSearchReady && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 text-center text-sm text-gray-500" data-testid="sabre-empty-state">
              Keine Hotels gefunden. Bitte anderes Ziel oder andere Sterne auswählen.
            </div>
          )}
          <AnimatePresence>
            {hotels.map((hotel) => (
              <motion.div
                key={hotel.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <Hotel size={24} className="text-blue-600 mt-1" />
                  <div className="flex-1">
                    <h3 className="font-bold">{hotel.name}</h3>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <MapPin size={14} />
                      {hotel.city}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      {[...Array(hotel.stars)].map((_, i) => (
                        <Star key={i} size={14} fill="#FFD700" color="#FFD700" />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Rooms */}
                <div className="space-y-2">
                  {hotel.available_rooms.map((room) => (
                    <div
                      key={room.type}
                      className="bg-gray-50 rounded-lg p-3 flex justify-between items-center"
                    >
                      <div>
                        <p className="font-medium text-sm">{room.name}</p>
                        <p className="text-xs text-gray-600">
                          {room.size_sqm}m² • {room.capacity} Gäste • {room.available_count} verfügbar
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-600">€{room.total_price}</p>
                        <p className="text-xs text-gray-500">{hotel.nights} Nächte</p>
                        <button
                          onClick={() => {
                            setSelectedHotel(hotel);
                            setSelectedRoom(room);
                          }}
                          className="mt-1 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                          data-testid={`sabre-book-room-${hotel.id}-${room.type}`}
                        >
                          Buchen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
          </>
        )}
        {view === "bookings" && (
          <div className="space-y-3" data-testid="sabre-bookings-panel">
            {bookingsLoading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={28} className="animate-spin text-blue-600" />
              </div>
            )}
            {!bookingsLoading && bookings.length === 0 && (
              <div className="text-center text-gray-500 py-12 text-sm bg-white rounded-xl border border-gray-200">
                Noch keine Sabre-Buchungen vorhanden.
              </div>
            )}
            {!bookingsLoading && bookings.map((booking) => (
              <div key={booking.booking_id} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm" data-testid={`sabre-booking-${booking.booking_id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{booking.hotel_name}</h3>
                    <p className="text-sm text-gray-500">{booking.hotel_city} • {booking.room_type}</p>
                    <p className="text-xs text-gray-500 mt-1">{booking.check_in} → {booking.check_out}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${booking.status === "cancelled" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                    {booking.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-gray-500">Gesamtpreis</span>
                  <span className="font-bold text-blue-600">€{booking.total_price}</span>
                </div>
                {booking.status !== "cancelled" && (
                  <button
                    onClick={() => cancelBooking(booking.booking_id)}
                    className="mt-3 w-full py-2.5 rounded-lg border border-red-200 text-red-600 font-medium hover:bg-red-50"
                    data-testid={`sabre-cancel-booking-${booking.booking_id}`}
                  >
                    Buchung stornieren
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {selectedHotel && selectedRoom && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="sabre-booking-modal-backdrop">
          <motion.div
            className="bg-white rounded-xl p-6 w-full max-w-md"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            data-testid="sabre-booking-modal"
          >
            <h3 className="text-lg font-bold mb-4">Buchung abschließen</h3>
            <p className="text-sm text-gray-600 mb-4">
              {selectedHotel.name} • {selectedRoom.name}
            </p>
            <input
              type="text"
              placeholder="Name"
              value={bookingForm.guest_name}
              onChange={(e) => setBookingForm({ ...bookingForm, guest_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"
              data-testid="sabre-booking-name-input"
            />
            <input
              type="email"
              placeholder="E-Mail"
              value={bookingForm.guest_email}
              onChange={(e) => setBookingForm({ ...bookingForm, guest_email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              data-testid="sabre-booking-email-input"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedHotel(null);
                  setSelectedRoom(null);
                }}
                className="flex-1 py-2 bg-gray-200 rounded-lg"
                data-testid="sabre-booking-cancel-button"
              >
                Abbrechen
              </button>
              <button
                onClick={bookRoom}
                disabled={!isBookingReady}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                data-testid="sabre-confirm-booking-button"
              >
                Jetzt buchen
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
