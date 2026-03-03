// BidBlitz Hotel Detail & Booking Page
// Airbnb-style listing detail with booking functionality

import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { 
  ArrowLeft, Heart, Share2, MapPin, Star, Users, Calendar,
  Wifi, Car, Waves, Dumbbell, Coffee, ChevronLeft, ChevronRight,
  Check, Sparkles, Shield, Clock, MessageCircle, X, Minus, Plus
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function HotelDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [geniusLevel, setGeniusLevel] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  
  // Booking form
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [guests, setGuests] = useState(2);
  const [booking, setBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);

  useEffect(() => {
    fetchListing();
    fetchGeniusLevel();
    checkFavorite();
  }, [id]);

  const fetchListing = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/hotels-airbnb/listings/${id}`);
      setListing(res.data);
    } catch (err) {
      toast.error("Unterkunft nicht gefunden");
      navigate("/hotels");
    } finally {
      setLoading(false);
    }
  };

  const fetchGeniusLevel = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    
    try {
      const res = await axios.get(`${API}/api/hotels-airbnb/user/level`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGeniusLevel(res.data);
    } catch (err) {}
  };

  const checkFavorite = () => {
    const favorites = JSON.parse(localStorage.getItem("hotel_favorites") || "[]");
    setIsFavorite(favorites.includes(id));
  };

  const toggleFavorite = () => {
    const favorites = JSON.parse(localStorage.getItem("hotel_favorites") || "[]");
    const newFavorites = isFavorite 
      ? favorites.filter(f => f !== id)
      : [...favorites, id];
    localStorage.setItem("hotel_favorites", JSON.stringify(newFavorites));
    setIsFavorite(!isFavorite);
  };

  const calculatePrice = () => {
    if (!checkin || !checkout || !listing) return null;
    
    const checkinDate = new Date(checkin);
    const checkoutDate = new Date(checkout);
    const nights = Math.ceil((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));
    
    if (nights <= 0) return null;
    
    const pricePerNight = listing.price_per_night_cents / 100;
    const subtotal = pricePerNight * nights;
    const discountPct = geniusLevel ? parseInt(geniusLevel.discount) : 10;
    const discount = subtotal * (discountPct / 100);
    const total = subtotal - discount;
    
    return {
      nights,
      pricePerNight,
      subtotal,
      discountPct,
      discount,
      total
    };
  };

  const handleBooking = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Bitte einloggen um zu buchen");
      navigate("/login");
      return;
    }

    const price = calculatePrice();
    if (!price || price.nights <= 0) {
      toast.error("Bitte gültige Daten wählen");
      return;
    }

    setBooking(true);
    try {
      const res = await axios.post(`${API}/api/hotels-airbnb/bookings`, {
        listing_id: id,
        checkin,
        checkout,
        guests
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setBookingResult(res.data);
      toast.success("Buchung erfolgreich!");
      
      if (res.data.level_up?.happened) {
        toast.success(res.data.level_up.message, { duration: 5000 });
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Buchung fehlgeschlagen");
    } finally {
      setBooking(false);
    }
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: listing?.title, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link kopiert!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!listing) return null;

  const pricePerNight = listing.price_per_night_cents / 100;
  const price = calculatePrice();

  // Amenity icons mapping
  const amenityIcons = {
    "WiFi": Wifi,
    "Pool": Waves,
    "Gym": Dumbbell,
    "Parkplatz": Car,
    "Frühstück": Coffee,
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={share} className="p-2 hover:bg-slate-100 rounded-full">
              <Share2 className="w-5 h-5 text-slate-600" />
            </button>
            <button onClick={toggleFavorite} className="p-2 hover:bg-slate-100 rounded-full">
              <Heart className={`w-5 h-5 ${isFavorite ? "fill-rose-500 text-rose-500" : "text-slate-600"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="relative h-72 md:h-96 bg-slate-200">
        <img 
          src={listing.photos?.[currentImageIndex] || "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200"}
          alt={listing.title}
          className="w-full h-full object-cover"
        />
        
        {listing.photos?.length > 1 && (
          <>
            <button 
              onClick={() => setCurrentImageIndex(i => i === 0 ? listing.photos.length - 1 : i - 1)}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center hover:bg-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setCurrentImageIndex(i => i === listing.photos.length - 1 ? 0 : i + 1)}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center hover:bg-white"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
              {listing.photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentImageIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all ${i === currentImageIndex ? "bg-white w-4" : "bg-white/50"}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Genius Badge */}
        {geniusLevel && (
          <div className="absolute top-4 left-4 px-3 py-1.5 bg-amber-400 text-white font-bold rounded-lg flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            Genius {geniusLevel.discount}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title & Location */}
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                <MapPin className="w-4 h-4" />
                <span>{listing.city}, {listing.region}</span>
                {listing.rating && (
                  <>
                    <span className="text-slate-300">•</span>
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span className="font-medium text-slate-700">{listing.rating}</span>
                    <span>({listing.reviews} Bewertungen)</span>
                  </>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800">{listing.title}</h1>
              <p className="text-slate-500 mt-1">
                Gastgeber: {listing.host_name} • Max. {listing.max_guests} Gäste • {listing.property_type}
              </p>
            </div>

            {/* Genius Info */}
            {geniusLevel && (
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-400 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-amber-800">Genius Level {geniusLevel.level} Rabatt</p>
                    <p className="text-sm text-amber-700">Sie sparen {geniusLevel.discount} auf diese Unterkunft!</p>
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-3">Über diese Unterkunft</h2>
              <p className="text-slate-600 leading-relaxed">{listing.description}</p>
            </div>

            {/* Amenities */}
            {listing.amenities?.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-3">Ausstattung</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {listing.amenities.map((amenity, i) => {
                    const Icon = amenityIcons[amenity] || Check;
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                        <Icon className="w-5 h-5 text-rose-500" />
                        <span className="text-slate-700">{amenity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Location */}
            {listing.address && (
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-3">Standort</h2>
                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                  <MapPin className="w-5 h-5 text-rose-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-800">{listing.address}</p>
                    <p className="text-slate-500">{listing.city}, {listing.region}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Booking Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-2xl font-bold text-slate-800">{pricePerNight.toFixed(0)} €</span>
                <span className="text-slate-500">/ Nacht</span>
              </div>

              {/* Date Selection */}
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-sm font-medium text-slate-600 mb-1 block">Check-in</label>
                  <input
                    type="date"
                    value={checkin}
                    onChange={(e) => setCheckin(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 mb-1 block">Check-out</label>
                  <input
                    type="date"
                    value={checkout}
                    onChange={(e) => setCheckout(e.target.value)}
                    min={checkin || new Date().toISOString().split("T")[0]}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 mb-1 block">Gäste</label>
                  <div className="flex items-center justify-between px-4 py-3 border border-slate-200 rounded-xl">
                    <button 
                      onClick={() => setGuests(g => Math.max(1, g - 1))}
                      className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center hover:bg-slate-200"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-medium">{guests} {guests === 1 ? "Gast" : "Gäste"}</span>
                    <button 
                      onClick={() => setGuests(g => Math.min(listing.max_guests, g + 1))}
                      className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center hover:bg-slate-200"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Price Breakdown */}
              {price && (
                <div className="space-y-2 py-4 border-t border-slate-100">
                  <div className="flex justify-between text-slate-600">
                    <span>{price.pricePerNight.toFixed(0)} € x {price.nights} Nächte</span>
                    <span>{price.subtotal.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-4 h-4" />
                      Genius Rabatt ({price.discountPct}%)
                    </span>
                    <span>-{price.discount.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-slate-100">
                    <span>Gesamt</span>
                    <span>{price.total.toFixed(2)} €</span>
                  </div>
                </div>
              )}

              {/* Book Button */}
              <button
                onClick={handleBooking}
                disabled={!price || booking}
                className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold rounded-xl hover:from-rose-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {booking ? (
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                ) : (
                  <>
                    <Calendar className="w-5 h-5" />
                    Jetzt buchen
                  </>
                )}
              </button>

              {/* Trust Badges */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  <span>Kostenlose Stornierung bis 24h vorher</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  <span>Sofortige Bestätigung</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Success Modal */}
      {bookingResult && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Buchung bestätigt!</h2>
              <p className="text-slate-500 mt-2">Ihre Reservierung wurde erfolgreich erstellt.</p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-2 mb-6">
              <div className="flex justify-between">
                <span className="text-slate-500">Unterkunft</span>
                <span className="font-medium text-slate-800">{bookingResult.booking.listing}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Check-in</span>
                <span className="font-medium text-slate-800">{bookingResult.booking.checkin}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Check-out</span>
                <span className="font-medium text-slate-800">{bookingResult.booking.checkout}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nächte</span>
                <span className="font-medium text-slate-800">{bookingResult.booking.nights}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>Genius Rabatt</span>
                <span className="font-medium">{bookingResult.booking.genius_discount}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-slate-200">
                <span>Bezahlt</span>
                <span>{bookingResult.booking.final_price}</span>
              </div>
            </div>

            {bookingResult.level_up?.happened && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-center">
                <Sparkles className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="font-bold text-amber-800">{bookingResult.level_up.message}</p>
                <p className="text-sm text-amber-700">Nächste Buchung: {bookingResult.level_up.new_discount} Rabatt!</p>
              </div>
            )}

            <button
              onClick={() => { setBookingResult(null); navigate("/hotels"); }}
              className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900"
            >
              Fertig
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
