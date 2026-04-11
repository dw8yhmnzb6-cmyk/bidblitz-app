/**
 * BidBlitz V2 - Car Detail Page
 * View car details and start booking
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Car, Fuel, Settings2, Users, MapPin, Calendar, Star,
  Check, ChevronRight, Loader2, Shield, Clock, FileText, Plus, Minus,
  CreditCard, AlertCircle, X, DoorOpen, Gauge
} from "lucide-react";
import { getCarDetail, calculateCarPrice, checkCarAvailability, createBooking, payBooking, getCarReviews } from "../api";

const FUEL_LABELS = {
  petrol: "Benzin",
  diesel: "Diesel",
  electric: "Elektro",
  hybrid: "Hybrid",
  lpg: "Autogas",
};

const GEARBOX_LABELS = {
  manual: "Schaltgetriebe",
  automatic: "Automatik",
  semi_automatic: "Halbautomatik",
};

export default function CarDetailPage({ carId, onBack, onNavigate }) {
  const [car, setCar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [pricing, setPricing] = useState(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [availability, setAvailability] = useState(null);
  
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  
  const [activeImage, setActiveImage] = useState(0);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    loadCar();
    loadReviews();
  }, [carId]);

  useEffect(() => {
    if (startDate && endDate && car) {
      loadPricing();
      checkAvailability();
    }
  }, [startDate, endDate, selectedExtras, car]);

  const loadCar = async () => {
    setLoading(true);
    try {
      const data = await getCarDetail(carId);
      setCar(data);
    } catch (err) {
      setError("Fahrzeug nicht gefunden");
    }
    setLoading(false);
  };

  const loadReviews = async () => {
    try {
      const data = await getCarReviews(carId);
      setReviews(data.reviews || []);
    } catch (err) { console.error(err); }
  };

  const loadPricing = async () => {
    if (!startDate || !endDate) return;
    setLoadingPrice(true);
    try {
      const data = await calculateCarPrice(carId, startDate, endDate, selectedExtras);
      setPricing(data);
    } catch (err) {
      console.error("Error calculating price:", err);
    }
    setLoadingPrice(false);
  };

  const checkAvailability = async () => {
    if (!startDate || !endDate) return;
    try {
      const data = await checkCarAvailability(carId, startDate, endDate);
      setAvailability(data.available);
    } catch (err) {
      console.error("Error checking availability:", err);
    }
  };

  const toggleExtra = (extraId) => {
    setSelectedExtras(prev => 
      prev.includes(extraId) 
        ? prev.filter(id => id !== extraId)
        : [...prev, extraId]
    );
  };

  const handleBooking = async () => {
    setBookingLoading(true);
    setBookingError(null);
    
    try {
      const bookingData = {
        car_id: carId,
        start_date: startDate,
        end_date: endDate,
        extras: selectedExtras,
      };
      
      const result = await createBooking(bookingData);
      
      if (result.ok && result.booking) {
        // Pay for booking
        const payResult = await payBooking(result.booking.booking_id);
        
        if (payResult.ok) {
          setBookingSuccess(result.booking);
          setShowBookingModal(false);
        } else {
          setBookingError(payResult.detail || "Zahlung fehlgeschlagen");
        }
      } else {
        setBookingError(result.detail || "Buchung fehlgeschlagen");
      }
    } catch (err) {
      setBookingError(err.message || "Ein Fehler ist aufgetreten");
    }
    
    setBookingLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00C2FF]" />
      </div>
    );
  }

  if (error || !car) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center p-4">
        <Car size={48} className="text-[#333] mb-4" />
        <p className="text-white/70">{error || "Fahrzeug nicht gefunden"}</p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="mt-4 px-6 py-2 rounded-xl bg-[#00C2FF] text-black font-medium"
        >
          Zurück
        </motion.button>
      </div>
    );
  }

  const allImages = [car.main_image, ...(car.gallery_images || [])].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-32">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 p-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            className="p-2 rounded-xl bg-white/5 border border-white/10"
          >
            <ArrowLeft size={20} />
          </motion.button>
          <div className="flex-1">
            <h1 className="text-lg font-bold truncate">{car.title}</h1>
            <p className="text-xs text-[#666]">{car.brand} {car.model}</p>
          </div>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="relative">
        <div className="h-56 bg-gradient-to-br from-[#1a1a25] to-[#0f0f15]">
          {allImages.length > 0 ? (
            <img
              src={allImages[activeImage]}
              alt={car.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Car size={80} className="text-[#333]" />
            </div>
          )}
        </div>
        
        {/* Image Dots */}
        {allImages.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {allImages.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImage(idx)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  idx === activeImage ? "bg-[#00C2FF]" : "bg-white/30"
                }`}
              />
            ))}
          </div>
        )}

        {/* Price Badge */}
        <div className="absolute top-3 right-3 bg-[#00C2FF] text-black px-4 py-2 rounded-xl">
          <span className="text-2xl font-bold">€{car.price_per_day}</span>
          <span className="text-sm">/Tag</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Quick Info */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <Fuel size={18} className="mx-auto text-[#00C2FF] mb-1" />
            <p className="text-[10px] text-[#666]">{FUEL_LABELS[car.fuel_type]}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <Settings2 size={18} className="mx-auto text-[#00C2FF] mb-1" />
            <p className="text-[10px] text-[#666]">{GEARBOX_LABELS[car.gearbox]}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <Users size={18} className="mx-auto text-[#00C2FF] mb-1" />
            <p className="text-[10px] text-[#666]">{car.seats} Sitze</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <DoorOpen size={18} className="mx-auto text-[#00C2FF] mb-1" />
            <p className="text-[10px] text-[#666]">{car.doors} Türen</p>
          </div>
        </div>

        {/* Vendor Info */}
        {car.vendor && (
          <div className="bg-white/5 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00C2FF]/20 flex items-center justify-center">
                <Car size={20} className="text-[#00C2FF]" />
              </div>
              <div>
                <p className="font-medium text-sm">{car.vendor.company_name}</p>
                <div className="flex items-center gap-2 text-xs text-[#666]">
                  <MapPin size={10} />
                  {car.vendor.city}
                  {car.vendor.rating > 0 && (
                    <>
                      <span>·</span>
                      <Star size={10} className="text-yellow-400 fill-yellow-400" />
                      {car.vendor.rating.toFixed(1)}
                    </>
                  )}
                </div>
              </div>
            </div>
            <ChevronRight size={18} className="text-[#666]" />
          </div>
        )}

        {/* Description */}
        {car.description && (
          <div className="bg-white/5 rounded-xl p-4">
            <h3 className="font-semibold mb-2 text-sm">Beschreibung</h3>
            <p className="text-sm text-[#888] leading-relaxed">{car.description}</p>
          </div>
        )}

        {/* Features */}
        {car.features && car.features.length > 0 && (
          <div className="bg-white/5 rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm">Ausstattung</h3>
            <div className="flex flex-wrap gap-2">
              {car.features.map((feature, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-lg bg-[#00C2FF]/10 text-[#00C2FF] text-xs"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Pricing Info */}
        <div className="bg-white/5 rounded-xl p-4">
          <h3 className="font-semibold mb-3 text-sm">Preise</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#888]">Pro Tag</span>
              <span className="font-medium">€{car.price_per_day}</span>
            </div>
            {car.price_per_week && (
              <div className="flex justify-between">
                <span className="text-[#888]">Pro Woche</span>
                <span className="font-medium">€{car.price_per_week}</span>
              </div>
            )}
            {car.price_per_month && (
              <div className="flex justify-between">
                <span className="text-[#888]">Pro Monat</span>
                <span className="font-medium">€{car.price_per_month}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-white/10">
              <span className="text-[#888]">Kaution</span>
              <span className="font-medium">€{car.deposit_amount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#888]">Selbstbeteiligung</span>
              <span className="font-medium">€{car.deductible}</span>
            </div>
          </div>
        </div>

        {/* Requirements */}
        <div className="bg-white/5 rounded-xl p-4">
          <h3 className="font-semibold mb-3 text-sm">Anforderungen</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-[#00C2FF]" />
              <span className="text-[#888]">Mindestalter:</span>
              <span>{car.min_driver_age} Jahre</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-[#00C2FF]" />
              <span className="text-[#888]">Führerschein seit:</span>
              <span>{car.min_license_years} Jahr(e)</span>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        {reviews.length > 0 && (
          <div className="bg-white/5 rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm flex items-center gap-2">
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              Bewertungen ({reviews.length})
            </h3>
            <div className="space-y-3">
              {reviews.slice(0, 5).map(r => (
                <div key={r.review_id} className="border-b border-white/5 pb-3 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{r.customer_name}</span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={12} className={s <= r.rating ? "text-yellow-400 fill-yellow-400" : "text-[#333]"} />
                      ))}
                    </div>
                  </div>
                  {r.comment && <p className="text-xs text-[#888] leading-relaxed">{r.comment}</p>}
                  <p className="text-[10px] text-[#555] mt-1">{new Date(r.created_at).toLocaleDateString("de-DE")}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Booking Section */}
        <div className="bg-gradient-to-br from-[#00C2FF]/10 to-[#00C2FF]/5 rounded-2xl p-4 border border-[#00C2FF]/20">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Calendar size={18} className="text-[#00C2FF]" />
            Jetzt buchen
          </h3>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs text-[#666] mb-1 block">Abholung</label>
              <input
                type="date"
                value={startDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-sm outline-none focus:border-[#00C2FF]/50"
              />
            </div>
            <div>
              <label className="text-xs text-[#666] mb-1 block">Rückgabe</label>
              <input
                type="date"
                value={endDate}
                min={startDate || new Date().toISOString().split("T")[0]}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-sm outline-none focus:border-[#00C2FF]/50"
              />
            </div>
          </div>

          {/* Extras */}
          {car.extras && car.extras.length > 0 && (
            <div className="mb-4">
              <label className="text-xs text-[#666] mb-2 block">Zusatzoptionen</label>
              <div className="space-y-2">
                {car.extras.filter(e => e.is_active).map(extra => (
                  <motion.button
                    key={extra.extra_id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleExtra(extra.extra_id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                      selectedExtras.includes(extra.extra_id)
                        ? "bg-[#00C2FF]/20 border-[#00C2FF]/50"
                        : "bg-black/20 border-white/10"
                    } border`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
                        selectedExtras.includes(extra.extra_id)
                          ? "bg-[#00C2FF]"
                          : "bg-white/10"
                      }`}>
                        {selectedExtras.includes(extra.extra_id) && (
                          <Check size={14} className="text-black" />
                        )}
                      </div>
                      <span className="text-sm">{extra.name}</span>
                    </div>
                    <span className="text-sm font-medium text-[#00C2FF]">
                      +€{extra.price_per_day}/Tag
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Availability */}
          {startDate && endDate && availability !== null && (
            <div className={`p-3 rounded-xl mb-4 flex items-center gap-2 text-sm ${
              availability
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}>
              {availability ? (
                <>
                  <Check size={16} />
                  Fahrzeug ist im gewählten Zeitraum verfügbar
                </>
              ) : (
                <>
                  <AlertCircle size={16} />
                  Fahrzeug ist im gewählten Zeitraum nicht verfügbar
                </>
              )}
            </div>
          )}

          {/* Price Summary */}
          {pricing && (
            <div className="bg-black/30 rounded-xl p-4 mb-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#888]">{pricing.days} Tag(e) × €{car.price_per_day}</span>
                  <span>€{pricing.base_price}</span>
                </div>
                {pricing.extras_total > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#888]">Extras</span>
                    <span>€{pricing.extras_total}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#888]">MwSt. (19%)</span>
                  <span>€{pricing.tax_amount}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-white/10">
                  <span className="text-[#888]">Kaution (rückerstattbar)</span>
                  <span>€{pricing.deposit}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-white/10 text-lg font-bold">
                  <span>Gesamt</span>
                  <span className="text-[#00C2FF]">€{(pricing.total + pricing.deposit).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Book Button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowBookingModal(true)}
            disabled={!startDate || !endDate || !availability || loadingPrice}
            className="w-full py-4 rounded-xl bg-[#00C2FF] text-black font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loadingPrice ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <CreditCard size={20} />
                {pricing ? `€${(pricing.total + pricing.deposit).toFixed(2)} Jetzt buchen` : "Daten auswählen"}
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Booking Confirmation Modal */}
      <AnimatePresence>
        {showBookingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center"
            onClick={() => !bookingLoading && setShowBookingModal(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-[#111118] rounded-t-3xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Buchung bestätigen</h3>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => !bookingLoading && setShowBookingModal(false)}
                  className="p-2 rounded-xl bg-white/5"
                >
                  <X size={20} />
                </motion.button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
                  <Car size={32} className="text-[#00C2FF]" />
                  <div>
                    <p className="font-semibold">{car.title}</p>
                    <p className="text-sm text-[#666]">{startDate} - {endDate}</p>
                  </div>
                </div>

                {bookingError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                    {bookingError}
                  </div>
                )}

                <div className="p-4 bg-white/5 rounded-xl space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#888]">Mietpreis</span>
                    <span>€{pricing?.total || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#888]">Kaution</span>
                    <span>€{pricing?.deposit || 0}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/10 font-bold text-lg">
                    <span>Zu zahlen</span>
                    <span className="text-[#00C2FF]">€{((pricing?.total || 0) + (pricing?.deposit || 0)).toFixed(2)}</span>
                  </div>
                </div>

                <p className="text-xs text-[#666] text-center">
                  Der Betrag wird von deinem BidBlitz Wallet abgebucht
                </p>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleBooking}
                disabled={bookingLoading}
                className="w-full py-4 rounded-xl bg-[#00C2FF] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {bookingLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <CreditCard size={20} />
                    Jetzt bezahlen
                  </>
                )}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {bookingSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-[#111118] rounded-2xl p-6 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Buchung erfolgreich!</h3>
              <p className="text-sm text-[#888] mb-6">
                Deine Buchung wurde bestätigt. Du erhältst eine Bestätigung per E-Mail.
              </p>
              <p className="text-xs text-[#666] mb-4">
                Buchungsnummer: <span className="font-mono text-[#00C2FF]">{bookingSuccess.booking_id}</span>
              </p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => onNavigate("/car-rental/my-bookings")}
                className="w-full py-3 rounded-xl bg-[#00C2FF] text-black font-semibold"
              >
                Meine Buchungen
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
