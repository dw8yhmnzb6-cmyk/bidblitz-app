import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { getMarketplaceTranslation } from '../i18n/marketplaceTranslations';
import { 
  Search, MapPin, Crown, Heart, 
  ChevronRight, Sparkles,
  Building2, Car, Laptop, Shirt, Sofa, Briefcase, MoreHorizontal
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Länder und Städte Konfiguration
const LOCATIONS = {
  'all': [],
  'kosovo': ['Prishtina', 'Prizren', 'Peja', 'Mitrovica', 'Gjilan', 'Ferizaj'],
  'germany': ['Berlin', 'München', 'Hamburg', 'Frankfurt', 'Köln', 'Stuttgart'],
  'uae': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah']
};

const LOCATION_NAMES = {
  de: { all: 'Alle', kosovo: 'Kosovo', germany: 'Deutschland', uae: 'VAE' },
  en: { all: 'All', kosovo: 'Kosovo', germany: 'Germany', uae: 'UAE' },
  sq: { all: 'Të gjitha', kosovo: 'Kosovë', germany: 'Gjermani', uae: 'EBA' },
  ar: { all: 'الكل', kosovo: 'كوسوفو', germany: 'ألمانيا', uae: 'الإمارات' },
  tr: { all: 'Tümü', kosovo: 'Kosova', germany: 'Almanya', uae: 'BAE' },
  fr: { all: 'Tous', kosovo: 'Kosovo', germany: 'Allemagne', uae: 'EAU' },
  it: { all: 'Tutti', kosovo: 'Kosovo', germany: 'Germania', uae: 'EAU' },
  es: { all: 'Todos', kosovo: 'Kosovo', germany: 'Alemania', uae: 'EAU' }
};

const DEMO_LISTINGS = [
  {
    id: '1',
    title: 'Luxus Penthouse Dubai Marina',
    description: 'Atemberaubende 4-Zimmer Penthouse mit Meerblick, Pool, Gym. Komplett möbliert.',
    price: 2500000,
    currency: 'EUR',
    category: 'immobilien',
    country: 'uae',
    city: 'Dubai',
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
    country: 'germany',
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
    country: 'kosovo',
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
    country: 'kosovo',
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
    country: 'kosovo',
    city: 'Prishtina',
    images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800'],
    is_premium: true,
    seller_name: 'Immo Kosovo',
    created_at: new Date().toISOString()
  },
  {
    id: '6',
    title: 'BMW X5 M Competition',
    description: '2024, 5.000 km, M Paket, Panoramadach',
    price: 125000,
    currency: 'EUR',
    category: 'autos',
    country: 'kosovo',
    city: 'Prishtina',
    images: ['https://images.unsplash.com/photo-1554626268-27c59b023e5e?w=800'],
    is_premium: true,
    seller_name: 'Auto Center Prishtina',
    created_at: new Date().toISOString()
  },
  {
    id: '7',
    title: 'Designer Sofa Set',
    description: 'Italienisches Leder, 3+2+1 Set, neuwertig',
    price: 4500,
    currency: 'EUR',
    category: 'moebel',
    country: 'kosovo',
    city: 'Prizren',
    images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800'],
    is_premium: false,
    seller_name: 'Möbel Prizren',
    created_at: new Date().toISOString()
  },
  {
    id: '8',
    title: 'Villa mit Meerblick Abu Dhabi',
    description: 'Exklusive 5-Zimmer Villa auf Saadiyat Island',
    price: 3200000,
    currency: 'EUR',
    category: 'immobilien',
    country: 'uae',
    city: 'Abu Dhabi',
    images: ['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800'],
    is_premium: true,
    seller_name: 'Abu Dhabi Realty',
    created_at: new Date().toISOString()
  }
];

const MarketplacePage = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = (key) => getMarketplaceTranslation(language, key);
  
  const [allListings, setAllListings] = useState(DEMO_LISTINGS);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('alle');
  const [favorites, setFavorites] = useState([]);

  // Get category translations
  const CATEGORIES = [
    { id: 'alle', name: t('all'), icon: MoreHorizontal },
    { id: 'immobilien', name: t('realEstate'), icon: Building2 },
    { id: 'autos', name: t('vehicles'), icon: Car },
    { id: 'elektronik', name: t('electronics'), icon: Laptop },
    { id: 'mode', name: t('fashion'), icon: Shirt },
    { id: 'moebel', name: t('furniture'), icon: Sofa },
    { id: 'jobs', name: t('jobs'), icon: Briefcase }
  ];

  // Get location name based on language
  const getLocationName = (key) => {
    const langCode = language === 'ae' ? 'ar' : language === 'xk' ? 'sq' : language === 'gb' ? 'en' : language;
    return LOCATION_NAMES[langCode]?.[key] || LOCATION_NAMES['en'][key] || key;
  };

  const filteredListings = useMemo(() => {
    let result = [...allListings];
    
    if (selectedCountry !== 'all') {
      result = result.filter(item => item.country === selectedCountry);
    }
    
    if (selectedCity) {
      result = result.filter(item => item.city === selectedCity);
    }
    
    if (selectedCategory !== 'alle') {
      result = result.filter(item => item.category === selectedCategory);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
      );
    }
    
    return result.sort((a, b) => {
      if (a.is_premium && !b.is_premium) return -1;
      if (!a.is_premium && b.is_premium) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [allListings, selectedCountry, selectedCity, selectedCategory, searchQuery]);

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/market/listings`);
      if (response.ok) {
        const data = await response.json();
        const listings = data.listings || data || [];
        if (listings.length > 0) {
          setAllListings(listings);
        }
      }
    } catch (error) {
      console.error('Error fetching listings:', error);
    }
    setLoading(false);
  };

  const handleListingClick = (listing) => {
    navigate(`/marketplace/${listing.id}`);
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

  const handleCountryChange = (country) => {
    setSelectedCountry(country);
    setSelectedCity('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/50 via-slate-900 to-blue-900/50 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 sm:w-8 sm:h-8 text-yellow-400" />
                {t('title')}
              </h1>
              <p className="text-slate-400 text-xs sm:text-base mt-1">{t('subtitle')}</p>
            </div>
            <button 
              onClick={() => navigate('/marketplace/create')}
              className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold flex items-center gap-1 sm:gap-2 shadow-lg"
            >
              <span className="text-lg">+</span> 
              <span className="hidden sm:inline">{t('createAd')}</span>
              <span className="sm:hidden">{t('new')}</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="flex gap-2 sm:gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
              <input
                type="text"
                placeholder={t('search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 sm:pl-12 pr-3 py-3 sm:py-4 bg-slate-800/80 border border-slate-700 rounded-lg sm:rounded-xl text-white text-sm sm:text-base placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button className="px-4 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold">
              {t('searchBtn')}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3">
        {/* Countries */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex items-center gap-1 text-slate-400 shrink-0">
            <MapPin className="w-4 h-4" />
            <span className="text-xs sm:text-sm font-medium">{t('country')}:</span>
          </div>
          {Object.keys(LOCATIONS).map(country => (
            <button
              key={country}
              onClick={() => handleCountryChange(country)}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                selectedCountry === country
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              {getLocationName(country)}
            </button>
          ))}
        </div>

        {/* Cities */}
        {cities.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide pl-2 border-l-2 border-purple-500/50">
            <div className="flex items-center gap-1 text-slate-400 shrink-0">
              <Building2 className="w-4 h-4" />
              <span className="text-xs sm:text-sm font-medium">{t('city')}:</span>
            </div>
            <button
              onClick={() => setSelectedCity('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                !selectedCity
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              {t('all')}
            </button>
            {cities.map(city => (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                  selectedCity === city
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        )}

        {/* Categories */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <span className="text-xs sm:text-sm font-medium text-slate-400 shrink-0">{t('category')}:</span>
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  selectedCategory === cat.id
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Premium Banner */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-4">
        <div className="bg-gradient-to-r from-yellow-600/20 via-amber-500/20 to-yellow-600/20 border border-yellow-500/30 rounded-xl sm:rounded-2xl p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shrink-0">
                <Crown className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white text-sm sm:text-base font-bold">{t('premium')}</h3>
                <p className="text-slate-400 text-xs sm:text-sm">{t('premiumPrice')}</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/vip')}
              className="bg-gradient-to-r from-yellow-500 to-amber-600 text-black text-xs sm:text-sm font-bold px-3 sm:px-6 py-2 rounded-lg sm:rounded-xl whitespace-nowrap"
            >
              {t('upgrade')}
            </button>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2">
        <p className="text-slate-400 text-xs sm:text-sm">
          {filteredListings.length} {t('listings')}
          {selectedCountry !== 'all' && ` ${t('in')} ${getLocationName(selectedCountry)}`}
          {selectedCity && ` - ${selectedCity}`}
        </p>
      </div>

      {/* Listings Grid */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 pb-24">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-slate-800/50 rounded-xl h-64 animate-pulse" />
            ))}
          </div>
        ) : filteredListings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredListings.map(listing => (
              <div
                key={listing.id}
                onClick={() => handleListingClick(listing)}
                className={`group relative bg-slate-800/50 backdrop-blur rounded-xl sm:rounded-2xl overflow-hidden border transition-all cursor-pointer active:scale-[0.98] ${
                  listing.is_premium 
                    ? 'border-yellow-500/50 shadow-lg shadow-yellow-500/10' 
                    : 'border-slate-700'
                }`}
              >
                {listing.is_premium && (
                  <div className="absolute top-2 left-2 z-10 bg-gradient-to-r from-yellow-500 to-amber-600 text-black text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    PREMIUM
                  </div>
                )}

                <button
                  onClick={(e) => toggleFavorite(listing.id, e)}
                  className="absolute top-2 right-2 z-10 w-8 h-8 bg-black/50 backdrop-blur rounded-full flex items-center justify-center"
                >
                  <Heart className={`w-4 h-4 ${
                    favorites.includes(listing.id) ? 'text-red-500 fill-red-500' : 'text-white'
                  }`} />
                </button>

                <div className="relative h-40 sm:h-48 overflow-hidden">
                  {listing.images && listing.images[0] ? (
                    <img
                      src={listing.images[0]}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                      <Laptop className="w-12 h-12 text-slate-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                </div>

                <div className="p-3 sm:p-4">
                  <h3 className="font-bold text-white text-sm sm:text-lg line-clamp-1 mb-1">
                    {listing.title}
                  </h3>

                  <p className="text-slate-400 text-xs sm:text-sm line-clamp-2 mb-2">
                    {listing.description}
                  </p>

                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] sm:text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {listing.city}, {getLocationName(listing.country)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                    <p className="text-lg sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                      {formatPrice(listing.price, listing.currency)}
                    </p>
                    <div className="flex items-center gap-1 text-purple-400 text-xs sm:text-sm font-medium">
                      {t('details')}
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 sm:py-16">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-800 mx-auto mb-4 flex items-center justify-center">
              <Search className="w-8 h-8 sm:w-10 sm:h-10 text-slate-600" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white mb-2">{t('noListings')}</h3>
            <p className="text-slate-400 text-sm">{t('tryOther')}</p>
          </div>
        )}
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default MarketplacePage;
