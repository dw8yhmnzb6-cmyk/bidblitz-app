/**
 * Public Directory - Lokales Dienstleister-Verzeichnis
 * Benutzer können nach Ärzten, Handwerkern, etc. suchen
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, MapPin, Phone, Mail, Globe, Clock, Star, Heart,
  Filter, X, ChevronRight, Crown, Navigation, Share2, ArrowLeft
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function DirectoryPage({ onNavigate }) {
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] = useState(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [premiumOnly, setPremiumOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Favorites
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    loadCategories();
    loadCountries();
    loadListings();
    loadFavorites();
  }, []);

  useEffect(() => {
    loadListings();
  }, [selectedCategory, selectedCountry, selectedCity, premiumOnly, searchQuery]);

  const loadCategories = async () => {
    try {
      const res = await fetch(`${API}/api/directory/categories`);
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err) {}
  };

  const loadCountries = async () => {
    try {
      const res = await fetch(`${API}/api/directory/countries`);
      const data = await res.json();
      setCountries(data.countries || []);
    } catch (err) {}
  };

  const loadListings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedCountry) params.append('country', selectedCountry);
      if (selectedCity) params.append('city', selectedCity);
      if (searchQuery) params.append('search', searchQuery);
      if (premiumOnly) params.append('premium_only', 'true');
      
      const res = await fetch(`${API}/api/directory/listings?${params}`);
      const data = await res.json();
      setListings(data.listings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = async () => {
    try {
      const res = await fetch(`${API}/api/directory/favorites`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setFavorites(data.favorites?.map(f => f.listing_id) || []);
      }
    } catch (err) {}
  };

  const toggleFavorite = async (listingId) => {
    const isFav = favorites.includes(listingId);
    try {
      const method = isFav ? 'DELETE' : 'POST';
      const res = await fetch(`${API}/api/directory/favorites/${listingId}`, {
        method,
        credentials: 'include',
      });
      if (res.ok) {
        if (isFav) {
          setFavorites(favorites.filter(id => id !== listingId));
        } else {
          setFavorites([...favorites, listingId]);
        }
      }
    } catch (err) {}
  };

  const openListing = async (listingId) => {
    try {
      const res = await fetch(`${API}/api/directory/listings/${listingId}`);
      const data = await res.json();
      setSelectedListing(data);
    } catch (err) {}
  };

  const resetFilters = () => {
    setSelectedCategory('');
    setSelectedCountry('');
    setSelectedCity('');
    setPremiumOnly(false);
    setSearchQuery('');
  };

  const getCategoryInfo = (catId) => categories.find(c => c.id === catId);
  const getCountryInfo = (code) => countries.find(c => c.code === code);

  // Detail Modal
  if (selectedListing) {
    return (
      <div className="min-h-screen bg-[#050505] text-white pb-24">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedListing(null)}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors"
              >
                <ArrowLeft size={20} className="text-gray-400" />
              </button>
              <h1 className="text-lg font-bold flex-1">{selectedListing.business_name}</h1>
              <button
                onClick={() => toggleFavorite(selectedListing.listing_id)}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors"
              >
                <Heart
                  size={20}
                  className={favorites.includes(selectedListing.listing_id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* Premium Badge */}
          {selectedListing.is_premium && (
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl p-4 flex items-center gap-3">
              <Crown size={24} className="text-purple-400" />
              <div>
                <p className="font-bold text-white">Premium-Anbieter</p>
                <p className="text-xs text-gray-400">Verifiziert und empfohlen</p>
              </div>
            </div>
          )}

          {/* Category & Location */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{getCategoryInfo(selectedListing.category)?.icon}</span>
              <div>
                <p className="font-bold text-white">{getCategoryInfo(selectedListing.category)?.name}</p>
                <p className="text-sm text-gray-400 flex items-center gap-1">
                  <MapPin size={14} />
                  {selectedListing.city}, {getCountryInfo(selectedListing.country_code)?.flag} {getCountryInfo(selectedListing.country_code)?.name}
                </p>
              </div>
            </div>

            {/* Rating */}
            {selectedListing.rating > 0 && (
              <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                <div className="flex items-center gap-1">
                  <Star size={16} className="text-yellow-400 fill-yellow-400" />
                  <span className="font-bold">{selectedListing.rating.toFixed(1)}</span>
                </div>
                <span className="text-sm text-gray-400">
                  ({selectedListing.review_count} Bewertungen)
                </span>
              </div>
            )}
          </div>

          {/* Contact Info */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3">
            <h3 className="font-bold mb-3">Kontakt</h3>
            
            {/* Phone */}
            <a
              href={`tel:${selectedListing.phone}`}
              className="flex items-center gap-3 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl hover:bg-cyan-500/20 transition-colors"
            >
              <Phone size={20} className="text-cyan-400" />
              <div className="flex-1">
                <p className="text-sm text-gray-400">Telefon</p>
                <p className="font-medium">{selectedListing.phone}</p>
              </div>
              <ChevronRight size={16} className="text-gray-400" />
            </a>

            {/* Email */}
            {selectedListing.email && (
              <a
                href={`mailto:${selectedListing.email}`}
                className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                <Mail size={20} className="text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm text-gray-400">Email</p>
                  <p className="font-medium">{selectedListing.email}</p>
                </div>
              </a>
            )}

            {/* Website */}
            {selectedListing.website && (
              <a
                href={selectedListing.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                <Globe size={20} className="text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm text-gray-400">Website</p>
                  <p className="font-medium">{selectedListing.website}</p>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </a>
            )}

            {/* Address */}
            {selectedListing.address && (
              <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                <MapPin size={20} className="text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-400">Adresse</p>
                  <p className="font-medium">
                    {selectedListing.address}
                    {selectedListing.postal_code && `, ${selectedListing.postal_code}`}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    {selectedListing.city}, {getCountryInfo(selectedListing.country_code)?.name}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Opening Hours */}
          {selectedListing.opening_hours && (
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <h3 className="font-bold mb-2 flex items-center gap-2">
                <Clock size={18} className="text-cyan-400" />
                Öffnungszeiten
              </h3>
              <p className="text-gray-300">{selectedListing.opening_hours}</p>
            </div>
          )}

          {/* Description */}
          {selectedListing.description && (
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <h3 className="font-bold mb-2">Beschreibung</h3>
              <p className="text-gray-300 leading-relaxed">{selectedListing.description}</p>
            </div>
          )}

          {/* Reviews */}
          {selectedListing.reviews && selectedListing.reviews.length > 0 && (
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <h3 className="font-bold mb-3">Bewertungen ({selectedListing.reviews.length})</h3>
              <div className="space-y-3">
                {selectedListing.reviews.map((review) => (
                  <div key={review.review_id} className="bg-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={12}
                            className={i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-400">· {review.user_name}</span>
                    </div>
                    {review.comment && <p className="text-sm text-gray-300">{review.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${selectedListing.business_name} ${selectedListing.address || selectedListing.city}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl font-medium hover:bg-cyan-500/30 transition-colors"
            >
              <Navigation size={18} />
              Route
            </a>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: selectedListing.business_name,
                    text: `${selectedListing.business_name} - ${getCategoryInfo(selectedListing.category)?.name}`,
                    url: window.location.href,
                  });
                }
              }}
              className="flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/10 rounded-xl font-medium hover:bg-white/10 transition-colors"
            >
              <Share2 size={18} />
              Teilen
            </button>
          </div>
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
            <button onClick={() => onNavigate('/')} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Lokales Verzeichnis</h1>
              <p className="text-xs text-gray-400">{listings.length} Einträge</p>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 hover:bg-white/5 rounded-xl transition-colors relative"
            >
              <Filter size={20} className="text-gray-400" />
              {(selectedCategory || selectedCountry || selectedCity || premiumOnly) && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-cyan-400 rounded-full" />
              )}
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Suche nach Name, Beschreibung..."
              className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>

          {/* Filters Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-4 space-y-3">
                  {/* Category Filter */}
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
                  >
                    <option value="">Alle Kategorien</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>

                  {/* Country & City */}
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={selectedCountry}
                      onChange={(e) => setSelectedCountry(e.target.value)}
                      className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
                    >
                      <option value="">Alle Länder</option>
                      {countries.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.flag} {country.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      placeholder="Stadt..."
                      className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                    />
                  </div>

                  {/* Premium Toggle */}
                  <label className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                    <input
                      type="checkbox"
                      checked={premiumOnly}
                      onChange={(e) => setPremiumOnly(e.target.checked)}
                      className="w-5 h-5 rounded border-white/10 bg-white/5 text-cyan-500 focus:ring-cyan-500"
                    />
                    <Crown size={18} className="text-purple-400" />
                    <span className="flex-1 font-medium">Nur Premium-Anbieter</span>
                  </label>

                  {/* Reset Filters */}
                  {(selectedCategory || selectedCountry || selectedCity || premiumOnly) && (
                    <button
                      onClick={resetFilters}
                      className="w-full py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-medium hover:bg-red-500/20 transition-colors"
                    >
                      Filter zurücksetzen
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Listings */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Lade Einträge...</p>
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-12">
            <Search size={48} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Keine Einträge gefunden</p>
            <button
              onClick={resetFilters}
              className="mt-4 text-cyan-400 hover:underline text-sm"
            >
              Filter zurücksetzen
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {listings.map((listing) => (
              <motion.div
                key={listing.listing_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 rounded-2xl p-4 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => openListing(listing.listing_id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-white">{listing.business_name}</h3>
                      {listing.is_premium && <Crown size={16} className="text-purple-400" />}
                    </div>
                    <p className="text-sm text-gray-400 flex items-center gap-1">
                      {getCategoryInfo(listing.category)?.icon} {getCategoryInfo(listing.category)?.name}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(listing.listing_id);
                    }}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <Heart
                      size={18}
                      className={favorites.includes(listing.listing_id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}
                    />
                  </button>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <MapPin size={14} />
                    <span>{listing.city}, {getCountryInfo(listing.country_code)?.flag}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Phone size={14} />
                    <span>{listing.phone}</span>
                  </div>
                </div>

                {listing.rating > 0 && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1">
                      <Star size={14} className="text-yellow-400 fill-yellow-400" />
                      <span className="text-sm font-medium">{listing.rating.toFixed(1)}</span>
                    </div>
                    <span className="text-xs text-gray-500">({listing.review_count} Bewertungen)</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
