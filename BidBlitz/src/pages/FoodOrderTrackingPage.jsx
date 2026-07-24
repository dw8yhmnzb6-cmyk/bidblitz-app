import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom icons
const restaurantIcon = new L.Icon({
  iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%2310B981' stroke='white' stroke-width='2'/%3E%3Ctext x='16' y='22' font-size='16' text-anchor='middle' fill='white'%3E🍴%3C/text%3E%3C/svg%3E",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const driverIcon = new L.Icon({
  iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='18' fill='%2300E0FF' stroke='white' stroke-width='3'/%3E%3Ctext x='20' y='26' font-size='18' text-anchor='middle' fill='white'%3E🚗%3C/text%3E%3C/svg%3E",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

const destinationIcon = new L.Icon({
  iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%23FFD166' stroke='white' stroke-width='2'/%3E%3Ctext x='16' y='22' font-size='16' text-anchor='middle' fill='white'%3E📍%3C/text%3E%3C/svg%3E",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

// Map auto-fit bounds component
function MapBounds({ markers }) {
  const map = useMap();
  
  useEffect(() => {
    if (markers && markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [map, markers]);
  
  return null;
}

export default function OrderTrackingPage({ orderId, onBack }) {
  const [loading, setLoading] = useState(true);
  const [trackingData, setTrackingData] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState(5);
  const [tipMessage, setTipMessage] = useState("");
  const intervalRef = useRef(null);

  // Fetch tracking data
  const fetchTracking = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/food/orders/${orderId}/track`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setTrackingData(data);
        setCountdown(data.countdown_seconds);
        setLoading(false);
      } else {
        toast.error("Bestellung nicht gefunden");
        onBack();
      }
    } catch (err) {
      toast.error("Fehler beim Laden");
      setLoading(false);
    }
  };

  // Auto-refresh every 10 seconds (Lieferando-Style: häufiger für Live-Updates)
  useEffect(() => {
    fetchTracking();
    intervalRef.current = setInterval(fetchTracking, 10000);
    return () => clearInterval(intervalRef.current);
  }, [orderId]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => Math.max(0, c - 1)), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleStartChat = async (type) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/food/orders/${orderId}/start-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        const data = await res.json();
        // Open chat page with chat_id
        window.location.href = `/chat?id=${data.chat_id}`;
      }
    } catch (err) {
      toast.error("Chat konnte nicht geöffnet werden");
    }
  };

  const handleAddTip = async () => {
    if (tipAmount < 1 || tipAmount > 50) {
      toast.error("Trinkgeld muss zwischen €1 und €50 liegen");
      return;
    }
    
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/food/orders/${orderId}/tip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ order_id: orderId, amount: tipAmount, message: tipMessage }),
      });
      if (res.ok) {
        toast.success(`€${tipAmount} Trinkgeld hinzugefügt!`);
        setShowTipModal(false);
        fetchTracking();
      } else {
        const err = await res.json();
        toast.error(err.detail || "Fehler beim Hinzufügen");
      }
    } catch (err) {
      toast.error("Fehler beim Hinzufügen");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-[#00E0FF] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm">Lade Tracking-Daten...</p>
        </div>
      </div>
    );
  }

  if (!trackingData) return null;

  const { status_info, driver, driver_location, restaurant, delivery_address, can_tip } = trackingData;

  // Countdown minutes/seconds
  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  // Progress percentage (assume max 60 min)
  const progressPct = Math.max(0, Math.min(100, ((3600 - countdown) / 3600) * 100));

  // Map markers
  const markers = [];
  if (restaurant?.location) {
    markers.push({ ...restaurant.location, type: "restaurant" });
  }
  if (driver_location) {
    markers.push({ lat: driver_location.lat, lng: driver_location.lng, type: "driver" });
  }
  if (delivery_address?.location) {
    markers.push({ ...delivery_address.location, type: "destination" });
  }

  const mapCenter = markers[0] || { lat: 51.1657, lng: 10.4515 }; // Germany default

  return (
    <div className="min-h-screen bg-[#030303] text-white font-outfit relative pb-32">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-xl transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-base font-bold">Bestellung #{trackingData.order_id.slice(0, 8)}</h1>
          <button
            onClick={fetchTracking}
            className="p-2 hover:bg-white/5 rounded-xl transition"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="relative h-[300px] w-full">
        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={13}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
          />
          
          {restaurant?.location && (
            <Marker position={[restaurant.location.lat, restaurant.location.lng]} icon={restaurantIcon}>
              <Popup>{restaurant.name}</Popup>
            </Marker>
          )}
          
          {driver_location && (
            <Marker position={[driver_location.lat, driver_location.lng]} icon={driverIcon}>
              <Popup>Dein Fahrer</Popup>
            </Marker>
          )}
          
          {delivery_address?.location && (
            <Marker position={[delivery_address.location.lat, delivery_address.location.lng]} icon={destinationIcon}>
              <Popup>Deine Adresse</Popup>
            </Marker>
          )}
          
          <MapBounds markers={markers} />
        </MapContainer>
      </div>

      {/* Circular Countdown (Lieferando-Style) */}
      <div className="max-w-md mx-auto px-4 -mt-24 relative z-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative w-[320px] h-[320px] mx-auto"
        >
          {/* White Background Circle */}
          <div className="absolute inset-0 rounded-full bg-white/95 shadow-2xl backdrop-blur-lg" />

          {/* Progress Ring (Striped Pattern wie Lieferando) */}
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            {/* Background Circle */}
            <circle
              cx="160"
              cy="160"
              r="140"
              fill="none"
              stroke="rgba(0,0,0,0.05)"
              strokeWidth="16"
            />
            {/* Animated Progress Ring mit Streifen-Pattern */}
            <defs>
              <pattern id="stripes" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="4" height="8" fill="#10B981" />
                <rect x="4" width="4" height="8" fill="#059669" />
              </pattern>
            </defs>
            <motion.circle
              cx="160"
              cy="160"
              r="140"
              fill="none"
              stroke="url(#stripes)"
              strokeWidth="20"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 140}
              initial={{ strokeDashoffset: 2 * Math.PI * 140 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 140 * (1 - progressPct / 100) }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>

          {/* Center Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.div
              key={countdown}
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-8xl font-black text-black mb-1"
              style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
            >
              {minutes}
            </motion.div>
            <div className="text-xl font-medium text-black/60">Minuten</div>
            <div className="text-sm font-medium text-black/40 mt-2">verbleibende Zeit</div>
            <div className="text-xs font-medium text-black/30 mt-1">bis zur Lieferung</div>
          </div>
        </motion.div>

        {/* Chat Buttons (Lieferando-Style: prominent) */}
        <div className="flex gap-3 justify-center mt-8">
          {driver && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleStartChat("driver")}
              className="p-4 bg-black rounded-full transition shadow-lg border border-black/20 hover:bg-black/90"
              data-testid="chat-driver-btn"
            >
              <span className="text-3xl">💬</span>
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleStartChat("support")}
            className="p-4 bg-black rounded-full transition shadow-lg border border-black/20 hover:bg-black/90"
            data-testid="chat-support-btn"
          >
            <span className="text-3xl">💬</span>
          </motion.button>
        </div>
      </div>

      {/* Order Status (Lieferando-Style prominent Banner) */}
      <div className="max-w-md mx-auto px-4 mt-8">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-2 border-emerald-500/30 rounded-2xl p-6 text-center"
        >
          <div className="text-5xl mb-3">{status_info.icon}</div>
          <h3 className="text-xl font-bold text-white mb-1">{status_info.label}</h3>
          <p className="text-sm text-white/70">{status_info.description}</p>

          {restaurant && (
            <div className="mt-5 pt-5 border-t border-white/10">
              <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Restaurant</p>
              <p className="text-lg font-bold text-white">{restaurant.name}</p>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Geschätzte Lieferzeit</p>
            <p className="text-2xl font-black text-emerald-400">{trackingData.estimated_delivery_time}</p>
          </div>
        </motion.div>

        {/* Driver Info */}
        {driver && (
          <div className="mt-4 bg-[#0a0a0a] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00E0FF] to-[#0088CC] flex items-center justify-center text-xl">
                {driver.photo_url ? (
                  <img src={driver.photo_url} alt={driver.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  "👤"
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-bold">{driver.name}</h4>
                {driver.vehicle && <p className="text-xs text-white/60">{driver.vehicle}</p>}
              </div>
              <button
                onClick={() => handleStartChat("driver")}
                className="px-4 py-2 bg-[#00E0FF]/10 hover:bg-[#00E0FF]/20 border border-[#00E0FF]/20 rounded-xl text-sm font-semibold text-[#00E0FF] transition"
              >
                Chat
              </button>
            </div>
          </div>
        )}

        {/* Tip Button */}
        {can_tip && (
          <motion.button
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={() => setShowTipModal(true)}
            className="mt-4 w-full bg-gradient-to-r from-[#FFD166] to-[#FF9800] text-black font-bold py-4 rounded-2xl hover:scale-105 transition"
          >
            💰 Trinkgeld hinzufügen
          </motion.button>
        )}
      </div>

      {/* Tip Modal */}
      <AnimatePresence>
        {showTipModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowTipModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 max-w-sm w-full"
            >
              <h3 className="text-xl font-bold mb-4">Trinkgeld hinzufügen</h3>
              
              <div className="space-y-4">
                {/* Quick amounts */}
                <div className="grid grid-cols-4 gap-2">
                  {[2, 5, 10, 15].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setTipAmount(amt)}
                      className={`py-3 rounded-xl font-semibold transition ${
                        tipAmount === amt
                          ? "bg-[#FFD166] text-black"
                          : "bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      €{amt}
                    </button>
                  ))}
                </div>

                {/* Custom amount */}
                <div>
                  <label className="text-xs text-white/60 mb-2 block">Eigener Betrag</label>
                  <input
                    type="number"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(parseFloat(e.target.value) || 0)}
                    min="1"
                    max="50"
                    step="0.5"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FFD166]"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="text-xs text-white/60 mb-2 block">Nachricht (optional)</label>
                  <textarea
                    value={tipMessage}
                    onChange={(e) => setTipMessage(e.target.value)}
                    maxLength={200}
                    rows={3}
                    placeholder="Danke für die schnelle Lieferung!"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#FFD166] resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowTipModal(false)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-semibold transition"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleAddTip}
                    className="flex-1 py-3 bg-[#FFD166] hover:bg-[#FFD166]/90 text-black rounded-xl font-bold transition"
                  >
                    €{tipAmount.toFixed(2)} senden
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Promo Banner (fixed at bottom) */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-[#FF6B00] to-[#FF9800] p-4 border-t border-white/10">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="flex-1">
            <p className="text-white font-bold text-sm">Jetzt gibt's mehr für weniger</p>
            <p className="text-white/80 text-xs">0 € Liefergebühr. Mindestbestellwert gilt.</p>
          </div>
          <div className="text-4xl">🍔</div>
        </div>
      </div>
    </div>
  );
}
