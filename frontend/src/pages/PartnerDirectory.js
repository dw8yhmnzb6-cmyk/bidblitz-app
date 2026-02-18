/**
 * Partner Directory Page - Alle Partner durchsuchen
 * Mit Karte, Filter nach Stadt/Kategorie und Suche
 */
import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Search, MapPin, Star, Filter, Grid, Map as MapIcon, 
  ChevronDown, Loader2, Navigation, X, Ticket
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

// Lazy load PartnerMap for better performance
const PartnerMap = lazy(() => import('../components/PartnerMap'));

const API = process.env.REACT_APP_BACKEND_URL;

// Business type icons
const BUSINESS_ICONS = {
  restaurant: '🍕', bar: '🍺', cafe: '☕', gas_station: '⛽',
  cinema: '🎬', retail: '🛒', wellness: '💆', fitness: '🏋️',
  beauty: '💇', hotel: '🏨', entertainment: '🎯', supermarket: '🛍️',
  pharmacy: '💊', other: '🏪'
};

const BUSINESS_NAMES = {
  restaurant: 'Restaurant', bar: 'Bar & Club', cafe: 'Café', gas_station: 'Tankstelle',
  cinema: 'Kino', retail: 'Einzelhandel', wellness: 'Wellness & Spa', fitness: 'Fitness',
  beauty: 'Friseur & Beauty', hotel: 'Hotel', entertainment: 'Unterhaltung', 
  supermarket: 'Supermarkt', pharmacy: 'Apotheke', other: 'Sonstiges'
};

export default function PartnerDirectory() {
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState([]);
  const [cities, setCities] = useState([]);
  const [businessTypes, setBusinessTypes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // grid or map
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyPartners, setNearbyPartners] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('rating'); // rating, name, distance

  // Fetch initial data
  useEffect(() => {
    fetchCities();
    fetchBusinessTypes();
    getUserLocation();
  }, []);

  // Fetch partners when filters change
  useEffect(() => {
    fetchPartners();
  }, [selectedCity, selectedType, sortBy]);

  const fetchCities = async () => {
    try {
      const response = await axios.get(`${API}/api/partner-search/cities`);
      setCities(response.data.cities || []);
    } catch (err) {
      console.error('Cities fetch error:', err);
    }
  };

  const fetchBusinessTypes = async () => {
    try {
      const response = await axios.get(`${API}/api/partner-search/business-types`);
      setBusinessTypes(response.data.business_types || []);
    } catch (err) {
      console.error('Business types fetch error:', err);
    }
  };

  const fetchPartners = async () => {
    try {
      setLoading(true);
      let url = `${API}/api/partner-search/by-city/${selectedCity || 'all'}`;
      const params = new URLSearchParams();
      if (selectedType) params.append('business_type', selectedType);
      params.append('sort_by', sortBy);
      params.append('limit', '50');
      
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await axios.get(url);
      setPartners(response.data.partners || []);
    } catch (err) {
      // Fallback: try to get all partners
      try {
        const fallbackRes = await axios.get(`${API}/api/partner-portal/public-list`);
        setPartners(fallbackRes.data.partners || []);
      } catch {
        setPartners([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          fetchNearbyPartners(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.log('Geolocation error:', error);
        }
      );
    }
  };

  const fetchNearbyPartners = async (lat, lng) => {
    try {
      const response = await axios.post(`${API}/api/partner-search/nearby`, {
        latitude: lat,
        longitude: lng,
        radius_km: 10,
        has_vouchers: false
      });
      setNearbyPartners(response.data.partners || []);
    } catch (err) {
      console.error('Nearby partners error:', err);
    }
  };

  // Filter partners by search query
  const filteredPartners = partners.filter(partner => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (partner.business_name || partner.name || '').toLowerCase().includes(query) ||
      (partner.city || '').toLowerCase().includes(query) ||
      (partner.address || '').toLowerCase().includes(query)
    );
  });

  // Use nearby partners if available and no filters
  const displayPartners = !selectedCity && !selectedType && nearbyPartners.length > 0 
    ? nearbyPartners 
    : filteredPartners;

  return (
    <div className="min-h-screen bg-gray-50" data-testid="partner-directory">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4">Partner entdecken</h1>
          <p className="text-lg opacity-90 mb-8">
            Finde Restaurants, Cafés, Wellness und mehr in deiner Nähe
          </p>
          
          {/* Search Bar */}
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[300px] relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Suche nach Name, Stadt oder Adresse..."
                className="pl-12 h-12 bg-white text-gray-800 border-0"
                data-testid="partner-search-input"
              />
            </div>
            <Button 
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
              className="h-12 bg-white/20 border-white/30 text-white hover:bg-white/30"
            >
              <Filter className="w-5 h-5 mr-2" />
              Filter
              {(selectedCity || selectedType) && (
                <span className="ml-2 bg-white text-amber-600 rounded-full w-5 h-5 text-xs flex items-center justify-center">
                  {(selectedCity ? 1 : 0) + (selectedType ? 1 : 0)}
                </span>
              )}
            </Button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-white/10 backdrop-blur rounded-xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* City Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2">Stadt</label>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-white text-gray-800"
                  >
                    <option value="">Alle Städte</option>
                    {cities.map((city) => (
                      <option key={city.name} value={city.name}>
                        {city.name} ({city.partner_count})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Type Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2">Kategorie</label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-white text-gray-800"
                  >
                    <option value="">Alle Kategorien</option>
                    {businessTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.icon} {type.name} ({type.count})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort */}
                <div>
                  <label className="block text-sm font-medium mb-2">Sortieren</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-white text-gray-800"
                  >
                    <option value="rating">Beste Bewertung</option>
                    <option value="name">Alphabetisch</option>
                    <option value="vouchers">Meiste Gutscheine</option>
                  </select>
                </div>
              </div>

              {/* Clear Filters */}
              {(selectedCity || selectedType) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 text-white hover:bg-white/20"
                  onClick={() => {
                    setSelectedCity('');
                    setSelectedType('');
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  Filter zurücksetzen
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
          <button
            onClick={() => setSelectedType('')}
            className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
              !selectedType 
                ? 'bg-amber-500 text-white' 
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Alle
          </button>
          {Object.entries(BUSINESS_ICONS).slice(0, 8).map(([type, icon]) => (
            <button
              key={type}
              onClick={() => setSelectedType(selectedType === type ? '' : type)}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                selectedType === type 
                  ? 'bg-amber-500 text-white' 
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {icon} {BUSINESS_NAMES[type]}
            </button>
          ))}
        </div>

        {/* View Toggle */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600">
            {loading ? 'Laden...' : `${displayPartners.length} Partner gefunden`}
            {nearbyPartners.length > 0 && !selectedCity && !selectedType && (
              <span className="ml-2 text-amber-600">
                <Navigation className="w-4 h-4 inline mr-1" />
                In deiner Nähe
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className={viewMode === 'grid' ? 'bg-amber-500 hover:bg-amber-600' : ''}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('map')}
              className={viewMode === 'map' ? 'bg-amber-500 hover:bg-amber-600' : ''}
            >
              <MapIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        )}

        {/* Grid View */}
        {!loading && viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayPartners.map((partner) => (
              <PartnerCard key={partner.id} partner={partner} />
            ))}
          </div>
        )}

        {/* Map View */}
        {!loading && viewMode === 'map' && (
          <Suspense fallback={
            <div className="h-96 bg-gray-100 rounded-xl flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-2" />
                <p className="text-gray-500">Karte wird geladen...</p>
              </div>
            </div>
          }>
            <PartnerMap 
              partners={displayPartners} 
              userLocation={userLocation}
            />
          </Suspense>
        )}

        {/* No Results */}
        {!loading && displayPartners.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Keine Partner gefunden</h3>
            <p className="text-gray-500 mb-4">
              Versuche es mit anderen Filtern oder einer anderen Suche
            </p>
            <Button 
              onClick={() => {
                setSearchQuery('');
                setSelectedCity('');
                setSelectedType('');
              }}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Filter zurücksetzen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Partner Card Component
function PartnerCard({ partner }) {
  const icon = BUSINESS_ICONS[partner.business_type] || '🏪';
  const typeName = BUSINESS_NAMES[partner.business_type] || 'Geschäft';
  
  return (
    <Link 
      to={`/p/${partner.id}`}
      className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 overflow-hidden group"
      data-testid={`partner-card-${partner.id}`}
    >
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-start gap-4">
          {/* Logo */}
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
            {partner.logo_url ? (
              <img 
                src={partner.logo_url} 
                alt={partner.business_name || partner.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl">{icon}</span>
            )}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                {icon} {typeName}
              </span>
            </div>
            <h3 className="font-bold text-gray-800 truncate group-hover:text-amber-600 transition-colors">
              {partner.business_name || partner.name}
            </h3>
            {(partner.address || partner.city) && (
              <p className="text-sm text-gray-500 truncate flex items-center gap-1">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                {partner.city || partner.address}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 flex items-center justify-between">
        {/* Rating */}
        <div className="flex items-center gap-1">
          {partner.average_rating > 0 ? (
            <>
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="font-bold text-gray-800">{partner.average_rating?.toFixed(1)}</span>
              <span className="text-sm text-gray-400">({partner.total_ratings || 0})</span>
            </>
          ) : (
            <span className="text-sm text-gray-400">Noch keine Bewertungen</span>
          )}
        </div>

        {/* Vouchers */}
        {partner.available_vouchers > 0 && (
          <div className="flex items-center gap-1 text-amber-600">
            <Ticket className="w-4 h-4" />
            <span className="text-sm font-medium">{partner.available_vouchers} Gutscheine</span>
          </div>
        )}

        {/* Distance */}
        {partner.distance_km && (
          <div className="flex items-center gap-1 text-gray-500">
            <Navigation className="w-4 h-4" />
            <span className="text-sm">{partner.distance_km} km</span>
          </div>
        )}
      </div>
    </Link>
  );
}
