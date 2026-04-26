/**
 * Booking & Reservation System
 * Hotels, Restaurants, Ärzte, Handwerker buchen
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, Users, MapPin, Search, ArrowLeft, Check,
  Hotel, UtensilsCrossed, Stethoscope, Wrench, Scissors
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const SERVICE_TYPES = {
  hotel: { name: 'Hotels', icon: Hotel, color: 'blue' },
  restaurant: { name: 'Restaurants', icon: UtensilsCrossed, color: 'orange' },
  doctor: { name: 'Ärzte', icon: Stethoscope, color: 'green' },
  handyman: { name: 'Handwerker', icon: Wrench, color: 'purple' },
  salon: { name: 'Salons', icon: Scissors, color: 'pink' },
};

export default function BookingPage({ onNavigate }) {
  const [providers, setProviders] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [tab, setTab] = useState('browse'); // browse, my-bookings
  
  // Filters
  const [serviceType, setServiceType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadProviders();
    loadMyBookings();
  }, [serviceType]);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (serviceType) params.append('service_type', serviceType);
      
      const res = await fetch(`${API}/api/reservations/providers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMyBookings = async () => {
    try {
      const res = await fetch(`${API}/api/reservations/my-bookings`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMyBookings(data.bookings || []);
      }
    } catch (err) {}
  };

  const loadAvailability = async (providerId, date) => {
    try {
      const res = await fetch(`${API}/api/reservations/providers/${providerId}/availability?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableSlots(data.available_slots || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const selectProvider = (provider) => {
    setSelectedProvider(provider);
    loadAvailability(provider.provider_id, selectedDate);
  };

  const bookSlot = async () => {
    if (!selectedSlot) return;
    
    const bookingData = {
      provider_id: selectedProvider.provider_id,
      service_type: selectedProvider.service_type,
      booking_date: selectedDate,
      booking_time: selectedSlot,
      duration_minutes: 60,
      guest_count: 1,
      special_requests: '',
      contact_phone: '+49 123 456789', // Should come from user profile
      contact_email: 'user@example.com',
    };

    try {
      const res = await fetch(`${API}/api/reservations/book`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData),
      });
      
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setSelectedProvider(null);
        setSelectedSlot(null);
        loadMyBookings();
        setTab('my-bookings');
      } else {
        alert(data.detail || 'Fehler bei der Buchung');
      }
    } catch (err) {
      alert('Netzwerkfehler');
    }
  };

  // Provider Detail View
  if (selectedProvider) {
    return (
      <div className="min-h-screen bg-[#050505] text-white pb-24">
        <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedProvider(null)} className="p-2 hover:bg-white/5 rounded-xl">
                <ArrowLeft size={20} className="text-gray-400" />
              </button>
              <div className="flex-1">
                <h1 className="text-lg font-bold">{selectedProvider.business_name}</h1>
                <p className="text-xs text-gray-400">{SERVICE_TYPES[selectedProvider.service_type]?.name}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* Provider Info */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              {React.createElement(SERVICE_TYPES[selectedProvider.service_type]?.icon, { size: 24, className: 'text-cyan-400' })}
              <div className="flex-1">
                <h3 className="font-bold">{selectedProvider.business_name}</h3>
                <p className="text-sm text-gray-400">{selectedProvider.city}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-yellow-400">
                  ⭐ <span className="font-bold">{selectedProvider.rating?.toFixed(1) || 'N/A'}</span>
                </div>
                <p className="text-xs text-gray-500">{selectedProvider.total_bookings || 0} Buchungen</p>
              </div>
            </div>
            {selectedProvider.description && (
              <p className="text-sm text-gray-300 mt-2">{selectedProvider.description}</p>
            )}
          </div>

          {/* Date Selection */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Calendar size={18} className="text-cyan-400" />
              Datum wählen
            </label>
            <input
              type="date"
              value={selectedDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                loadAvailability(selectedProvider.provider_id, e.target.value);
                setSelectedSlot(null);
              }}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
            />
          </div>

          {/* Time Slots */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <Clock size={18} className="text-cyan-400" />
              Verfügbare Zeiten
            </h3>
            {availableSlots.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Keine verfügbaren Zeiten für dieses Datum</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className={`py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedSlot === slot
                        ? 'bg-cyan-500 text-black'
                        : 'bg-white/5 hover:bg-white/10 text-white'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Booking Summary */}
          {selectedSlot && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-cyan-500/10 to-blue-500/5 rounded-2xl p-4 border border-cyan-500/20"
            >
              <h3 className="font-bold mb-3">Buchungszusammenfassung</h3>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-400">Anbieter:</span>
                  <span className="font-medium">{selectedProvider.business_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Datum:</span>
                  <span className="font-medium">{new Date(selectedDate).toLocaleDateString('de-DE')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Uhrzeit:</span>
                  <span className="font-medium">{selectedSlot}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Dauer:</span>
                  <span className="font-medium">60 Minuten</span>
                </div>
              </div>
              <button
                onClick={bookSlot}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-bold text-black hover:shadow-lg transition-all"
              >
                Jetzt buchen
              </button>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => onNavigate('/')} className="p-2 hover:bg-white/5 rounded-xl">
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Buchungen & Reservierungen</h1>
              <p className="text-xs text-gray-400">Hotels, Restaurants, Ärzte & mehr</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setTab('browse')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === 'browse'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400'
              }`}
            >
              Durchsuchen
            </button>
            <button
              onClick={() => setTab('my-bookings')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === 'my-bookings'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400'
              }`}
            >
              Meine Buchungen ({myBookings.length})
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {tab === 'browse' ? (
          <>
            {/* Service Type Filter */}
            <div className="grid grid-cols-5 gap-2 mb-6">
              {Object.entries(SERVICE_TYPES).map(([key, type]) => (
                <button
                  key={key}
                  onClick={() => setServiceType(serviceType === key ? '' : key)}
                  className={`p-3 rounded-xl transition-all ${
                    serviceType === key
                      ? 'bg-cyan-500/20 border-cyan-500/30 border'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {React.createElement(type.icon, { size: 24, className: 'mx-auto mb-1 text-cyan-400' })}
                  <div className="text-xs font-medium">{type.name}</div>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Suche nach Name oder Stadt..."
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500"
              />
            </div>

            {/* Providers List */}
            {loading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Lade Anbieter...</p>
              </div>
            ) : providers.length === 0 ? (
              <div className="text-center py-12">
                <Search size={48} className="text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Keine Anbieter gefunden</p>
              </div>
            ) : (
              <div className="space-y-3">
                {providers
                  .filter(p => !searchQuery || p.business_name.toLowerCase().includes(searchQuery.toLowerCase()) || p.city.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((provider) => (
                    <div
                      key={provider.provider_id}
                      onClick={() => selectProvider(provider)}
                      className="bg-white/5 rounded-2xl p-4 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-3 bg-cyan-500/10 rounded-xl">
                          {React.createElement(SERVICE_TYPES[provider.service_type]?.icon, { size: 24, className: 'text-cyan-400' })}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-white mb-1">{provider.business_name}</h3>
                          <p className="text-sm text-gray-400 mb-2">{provider.description || SERVICE_TYPES[provider.service_type]?.name}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <MapPin size={12} />
                              {provider.city}, {provider.country_code}
                            </span>
                            {provider.rating > 0 && (
                              <span className="flex items-center gap-1 text-yellow-400">
                                ⭐ {provider.rating.toFixed(1)}
                              </span>
                            )}
                            <span>{provider.total_bookings || 0} Buchungen</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </>
        ) : (
          // My Bookings Tab
          <>
            {myBookings.length === 0 ? (
              <div className="text-center py-12">
                <Calendar size={48} className="text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Noch keine Buchungen</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myBookings.map((booking) => (
                  <div key={booking.booking_id} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-white mb-1">{booking.business_name}</h3>
                        <p className="text-sm text-gray-400">{SERVICE_TYPES[booking.service_type]?.name}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                        booking.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                        booking.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        booking.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {booking.status === 'confirmed' ? '✓ Bestätigt' :
                         booking.status === 'pending' ? '⏳ Ausstehend' :
                         booking.status === 'completed' ? '✓ Abgeschlossen' :
                         'Storniert'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Datum</p>
                        <p className="font-medium">{new Date(booking.booking_date).toLocaleDateString('de-DE')}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Uhrzeit</p>
                        <p className="font-medium">{booking.booking_time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
