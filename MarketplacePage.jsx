import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, MapPin, Filter, Star, Crown, Clock, Heart, 
  ChevronRight, Sparkles, TrendingUp, Shield, X,
  Building2, Car, Laptop, Shirt, Sofa, Briefcase, MoreHorizontal
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Länder und Städte Konfiguration
const LOCATIONS = {
  'Alle': [],
  'Kosovo': ['Prishtina', 'Prizren', 'Peja', 'Mitrovica', 'Gjilan', 'Ferizaj'],
  'Deutschland': ['Berlin', 'München', 'Hamburg', 'Frankfurt', 'Köln', 'Stuttgart'],
  'Dubai': ['Dubai Marina', 'Downtown', 'JBR', 'Business Bay', 'Palm Jumeirah'],
  'Abu Dhabi': ['Corniche', 'Al Reem Island', 'Yas Island', 'Saadiyat']
};

// Kategorien mit Icons
const CATEGORIES = [
  { id: 'alle', name: 'Alle', icon: MoreHorizontal },
  { id: 'immobilien', name: 'Immobilien', icon: Building2 },
  { id: 'autos', name: 'Fahrzeuge', icon: Car },
  { id: 'elektronik', name: 'Elektronik', icon: Laptop },
  { id: 'mode', name: 'Mode', icon: Shirt },
  { id: 'moebel', name: 'Möbel', icon: Sofa },
  { id: 'jobs', name: 'Jobs', icon: Briefcase }
];

const MarketplacePage = () => {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('Alle');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('alle');
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    fetchListings();
  }, [selectedCountry, selectedCity, selectedCategory]);

  const fetchListings = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/market/listings?`;
      if (selectedCountry !== 'Alle') url += `country=${selectedCountry}&`;
      if (selectedCity) url += `city=${selectedCity}&`;
      if (selectedCategory !== 'alle') url += `category=${selectedCategory}&`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      // Sort: Premium first, then by date
      const sorted = (data.listings || data || []).sort((a, b) => {
        if (a.is_premium && !b.is_premium) return -1;
        if (!a.is_premium && b.is_premium) return 1;
        return new Date(b.created_at) - new Date(a.created_at);
      });
      
      setListings(sorted);
    } catch (error) {
      console.error('Error fetching listings:', error);
      // Demo data
      setListings([
        {
          id: '1',
          title: 'Luxus Penthouse Dubai Marina',
          description: 'Atemberaubende 4-Zimmer Penthouse mit Meerblick, Pool, Gym. Komplett möbliert.',
          price: 2500000,
          currency: 'EUR',
          category: 'immobilien',
          country: 'Dubai',
          city: 'Dubai Marina',
          images: ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800'],
          is_premium: true,
          seller_name: 'Dubai Properties',
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          title: 'Mercedes-AMG GT 63 S',
          description: '2023, 15.000 km, Vollausstattung, Garantie bis 2026',
          price: 165000,
          currency: 'EUR',
          category: 'autos',
          country: 'Deutschland',
          city: 'München',
          images: ['https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800'],
          is_premium: true,
          seller_name: 'Premium Cars München',
          created_at: new Date().toISOString()
        },
        {
          id: '3',
          title: 'Gaming PC RTX 4090',
          description: 'High-End Gaming Setup, i9-13900K, 64GB RAM, 2TB NVMe',
          price: 3499,
          currency: 'EUR',
          category: 'elektronik',
          country: 'Kosovo',
          city: 'Prishtina',
          images: ['https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800'],
          is_premium: false,
          seller_name: 'TechStore KS',
          created_at: new Date().toISOString()
        },
        {
          id: '4',
          title: 'iPhone 15 Pro Max 256GB',
          description: 'Neu, versiegelt, mit Rechnung und Garantie',
          price: 1299,
          currency: 'EUR',
          category: 'elektronik',
          country: 'Kosovo',
          city: 'Prizren',
          images: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800'],
          is_premium: false,
          seller_name: 'Mobile Shop',
          created_at: new Date().toISOString()
        },
        {
          id: '5',
          title: 'Moderne 3-Zimmer Wohnung',
          description: 'Zentrale Lage, Balkon, Tiefgarage, Neubau 2024',
          price: 185000,
          currency: 'EUR',
          category: 'immobilien',
          country: 'Kosovo',
          city: 'Prishtina',
          images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800'],
          is_premium: true,
          seller_name: 'Immo Kosovo',
          created_at: new Date().toISOString()
        }
      ]);
    }
    setLoading(false);
  };

  const handleSearch = () => {
    // Filter listings by search query
    fetchListings();
  };

  const toggleFavorite = (id, e) => {
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const formatPrice = (price, currency = 'EUR') => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  const cities = LOCATIONS[selectedCountry] || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/50 via-slate-900 to-blue-900/50 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-yellow-400" />
                Marktplatz
              </h1>
              <p className="text-slate-400 mt-1">Kaufen & Verkaufen in deiner Region</p>
            </div>
            <button 
              onClick={() => navigate('/marketplace/create')}
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-purple-500/25 transition-all"
            >
              <span className="text-xl">+</span> Anzeige erstellen
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Was suchst du?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-12 pr-4 py-4 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <button 
                onClick={handleSearch}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold transition-all"
              >
                Suchen
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* Countries */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 text-slate-400 mr-2">
            <MapPin className="w-4 h-4" />
            <span className="text-sm font-medium">Land:</span>
          </div>
          {Object.keys(LOCATIONS).map(country => (
            <button
              key={country}
              onClick={() => {
                setSelectedCountry(country);
                setSelectedCity('');
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedCountry === country
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {country}
            </button>
          ))}
        </div>

        {/* Cities (only show if country selected) */}
        {cities.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-6 border-l-2 border-purple-500/50">
            <div className="flex items-center gap-2 text-slate-400 mr-2">
              <Building2 className="w-4 h-4" />
              <span className="text-sm font-medium">Stadt:</span>
            </div>
            <button
              onClick={() => setSelectedCity('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                !selectedCity
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              Alle Städte
            </button>
            {cities.map(city => (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedCity === city
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        )}

        {/* Categories */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 text-slate-400 mr-2">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Kategorie:</span>
          </div>
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  selectedCategory === cat.id
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Premium Banner */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-gradient-to-r from-yellow-600/20 via-amber-500/20 to-yellow-600/20 border border-yellow-500/30 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold flex items-center gap-2">
                  Premium Anzeigen
                  <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">TOP PLATZIERUNG</span>
                </h3>
                <p className="text-slate-400 text-sm">Mehr Sichtbarkeit, mehr Verkäufe - ab 9,99€/Monat</p>
              </div>
            </div>
            <button className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-black font-bold px-6 py-2.5 rounded-xl transition-all flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Jetzt upgraden
            </button>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="max-w-7xl mx-auto px-4 py-2">
        <p className="text-slate-400 text-sm">
          {listings.length} Anzeigen gefunden
          {selectedCountry !== 'Alle' && ` in ${selectedCountry}`}
          {selectedCity && ` - ${selectedCity}`}
        </p>
      </div>

      {/* Listings Grid */}
      <div className="max-w-7xl mx-auto px-4 py-4 pb-24">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-slate-800/50 rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map(listing => (
              <div
                key={listing.id}
                onClick={() => navigate(`/marketplace/${listing.id}`)}
                className={`group relative bg-slate-800/50 backdrop-blur rounded-2xl overflow-hidden border transition-all cursor-pointer hover:scale-[1.02] hover:shadow-2xl ${
                  listing.is_premium 
                    ? 'border-yellow-500/50 shadow-lg shadow-yellow-500/10' 
                    : 'border-slate-700 hover:border-purple-500/50'
                }`}
              >
                {/* Premium Badge */}
                {listing.is_premium && (
                  <div className="absolute top-3 left-3 z-10 bg-gradient-to-r from-yellow-500 to-amber-600 text-black text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                    <Crown className="w-3.5 h-3.5" />
                    PREMIUM
                  </div>
                )}

                {/* Favorite Button */}
                <button
                  onClick={(e) => toggleFavorite(listing.id, e)}
                  className="absolute top-3 right-3 z-10 w-10 h-10 bg-black/50 backdrop-blur rounded-full flex items-center justify-center transition-all hover:bg-black/70"
                >
                  <Heart className={`w-5 h-5 transition-colors ${
                    favorites.includes(listing.id) ? 'text-red-500 fill-red-500' : 'text-white'
                  }`} />
                </button>

                {/* Image */}
                <div className="relative h-48 overflow-hidden">
                  {listing.images && listing.images[0] ? (
                    <img
                      src={listing.images[0]}
                      alt={listing.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                      <Laptop className="w-16 h-16 text-slate-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-white text-lg line-clamp-1 group-hover:text-purple-400 transition-colors">
                      {listing.title}
                    </h3>
                  </div>

                  <p className="text-slate-400 text-sm line-clamp-2 mb-3">
                    {listing.description}
                  </p>

                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-lg flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {listing.city || listing.country}
                    </span>
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-lg">
                      {listing.category}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                    <div>
                      <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                        {formatPrice(listing.price, listing.currency)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-purple-400 text-sm font-medium">
                      Details
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && listings.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-slate-800 mx-auto mb-4 flex items-center justify-center">
              <Search className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Keine Anzeigen gefunden</h3>
            <p className="text-slate-400">Versuche andere Filter oder erstelle eine neue Anzeige</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplacePage;
