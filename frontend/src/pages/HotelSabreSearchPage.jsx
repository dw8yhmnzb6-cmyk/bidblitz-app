/**
 * Hotel Sabre Search Page — Kettenhotels suchen & buchen
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft, Search, MapPin, Star, Users, Calendar,
  Loader2, Check, Hotel,
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
  const [view, setView] = useState("search"); // search | bookings
  const [searchForm, setSearchForm] = useState({
    city: "",
    check_in: "",
    check_out: "",
    guests: 1,
    min_stars: null,
  });
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    guest_name: "",
    guest_email: "",
  });

  const searchHotels = async () => {
    if (!searchForm.city || !searchForm.check_in || !searchForm.check_out) {
      toast.error("Bitte alle Felder ausfüllen");
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
    if (!bookingForm.guest_name || !bookingForm.guest_email) {
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
    } catch (err) {
      toast.error(err.message);
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
            onClick={() => setView("search")}
            className={`flex-1 py-3 text-sm font-medium transition ${
              view === "search" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600"
            }`}
          >
            Suchen
          </button>
          <button
            onClick={() => setView("bookings")}
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
        {/* Search Form */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 space-y-3">
          <input
            type="text"
            placeholder="Stadt"
            value={searchForm.city}
            onChange={(e) => setSearchForm({ ...searchForm, city: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={searchForm.check_in}
              onChange={(e) => setSearchForm({ ...searchForm, check_in: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              type="date"
              value={searchForm.check_out}
              onChange={(e) => setSearchForm({ ...searchForm, check_out: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-3">
            <input
              type="number"
              min="1"
              value={searchForm.guests}
              onChange={(e) => setSearchForm({ ...searchForm, guests: parseInt(e.target.value) })}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="Gäste"
            />
            <select
              value={searchForm.min_stars || ""}
              onChange={(e) => setSearchForm({ ...searchForm, min_stars: e.target.value ? parseInt(e.target.value) : null })}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Alle Sterne</option>
              <option value="3">3+ Sterne</option>
              <option value="4">4+ Sterne</option>
              <option value="5">5 Sterne</option>
            </select>
          </div>
          <button
            onClick={searchHotels}
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
            Suchen
          </button>
        </div>

        {/* Results */}
        <div className="mt-4 space-y-3">
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
          <div className="text-center text-gray-500 py-12 text-sm">
            Meine Buchungen werden hier angezeigt.
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {selectedHotel && selectedRoom && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div
            className="bg-white rounded-xl p-6 w-full max-w-md"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
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
            />
            <input
              type="email"
              placeholder="E-Mail"
              value={bookingForm.guest_email}
              onChange={(e) => setBookingForm({ ...bookingForm, guest_email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedHotel(null);
                  setSelectedRoom(null);
                }}
                className="flex-1 py-2 bg-gray-200 rounded-lg"
              >
                Abbrechen
              </button>
              <button
                onClick={bookRoom}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
