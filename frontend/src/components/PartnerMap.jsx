/**
 * PartnerMap - Interaktive Karte mit allen Partnern
 * Features: OpenStreetMap/Leaflet, Kategoriefilter, Standortsuche, "In meiner Nähe"
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Search, Filter, Navigation, Store, Crown, X, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';
import 'leaflet/dist/leaflet.css';

const API = process.env.REACT_APP_BACKEND_URL;

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons
const createIcon = (color) => L.divIcon({
  className: 'custom-marker',
  html: `<div style="background: ${color}; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

const defaultIcon = createIcon('#f59e0b');
const premiumIcon = createIcon('#eab308');
const selectedIcon = createIcon('#ef4444');

// Component to handle map center changes
const MapController = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || 13);
    }
  }, [center, zoom, map]);
  return null;
};

const PartnerMap = ({ language = 'de' }) => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [mapCenter, setMapCenter] = useState([48.2082, 16.3738]); // Vienna default
  const [mapZoom, setMapZoom] = useState(12);
  const [userLocation, setUserLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const mapRef = useRef(null);

  const categories = [
    { id: 'all', label: 'Alle' },
    { id: 'restaurant', label: 'Restaurant' },
    { id: 'cafe', label: 'Café' },
    { id: 'retail', label: 'Einzelhandel' },
    { id: 'beauty', label: 'Beauty' },
    { id: 'fitness', label: 'Fitness' },
    { id: 'other', label: 'Sonstiges' }
  ];

  const t = (key) => {
    const translations = {
      de: {
        title: 'Partner-Karte',
        subtitle: 'Finde Partner in deiner Nähe',
        search: 'Partner oder Stadt suchen...',
        nearMe: 'In meiner Nähe',
        filter: 'Filter',
        allCategories: 'Alle Kategorien',
        allCities: 'Alle Städte',
        premium: 'Premium Partner',
        cashback: 'Cashback',
        directions: 'Route',
        noPartners: 'Keine Partner gefunden',
        loading: 'Laden...',
        locationError: 'Standort konnte nicht ermittelt werden',
        partners: 'Partner'
      },
      en: {
        title: 'Partner Map',
        subtitle: 'Find partners near you',
        search: 'Search partner or city...',
        nearMe: 'Near me',
        filter: 'Filter',
        allCategories: 'All Categories',
        allCities: 'All Cities',
        premium: 'Premium Partner',
        cashback: 'Cashback',
        directions: 'Directions',
        noPartners: 'No partners found',
        loading: 'Loading...',
        locationError: 'Could not get location',
        partners: 'Partners'
      },
      tr: {
        title: 'Partner Haritası',
        subtitle: 'Yakınındaki partnerleri bul',
        search: 'Partner veya şehir ara...',
        nearMe: 'Yakınımda',
        filter: 'Filtre',
        allCategories: 'Tüm Kategoriler',
        allCities: 'Tüm Şehirler',
        premium: 'Premium Partner',
        cashback: 'Cashback',
        directions: 'Yol Tarifi',
        noPartners: 'Partner bulunamadı',
        loading: 'Yükleniyor...',
        locationError: 'Konum alınamadı',
        partners: 'Partner'
      },
      fr: {
        title: 'Carte des Partenaires',
        subtitle: 'Trouvez des partenaires près de chez vous',
        search: 'Rechercher partenaire ou ville...',
        nearMe: 'Près de moi',
        filter: 'Filtrer',
        allCategories: 'Toutes les Catégories',
        allCities: 'Toutes les Villes',
        premium: 'Partenaire Premium',
        cashback: 'Cashback',
        directions: 'Itinéraire',
        noPartners: 'Aucun partenaire trouvé',
        loading: 'Chargement...',
        locationError: 'Impossible d\'obtenir la localisation',
        partners: 'Partenaires'
      },
      es: {
        title: 'Mapa de Socios',
        subtitle: 'Encuentra socios cerca de ti',
        search: 'Buscar socio o ciudad...',
        nearMe: 'Cerca de mí',
        filter: 'Filtrar',
        allCategories: 'Todas las Categorías',
        allCities: 'Todas las Ciudades',
        premium: 'Socio Premium',
        cashback: 'Cashback',
        directions: 'Direcciones',
        noPartners: 'No se encontraron socios',
        loading: 'Cargando...',
        locationError: 'No se pudo obtener la ubicación',
        partners: 'Socios'
      },
      ar: {
        title: 'خريطة الشركاء',
        subtitle: 'اعثر على شركاء بالقرب منك',
        search: 'ابحث عن شريك أو مدينة...',
        nearMe: 'بالقرب مني',
        filter: 'تصفية',
        allCategories: 'جميع الفئات',
        allCities: 'جميع المدن',
        premium: 'شريك مميز',
        cashback: 'استرداد نقدي',
        directions: 'الاتجاهات',
        noPartners: 'لم يتم العثور على شركاء',
        loading: 'جاري التحميل...',
        locationError: 'تعذر الحصول على الموقع',
        partners: 'شركاء'
      },
      it: {
        title: 'Mappa Partner',
        subtitle: 'Trova partner vicino a te',
        search: 'Cerca partner o città...',
        nearMe: 'Vicino a me',
        filter: 'Filtra',
        allCategories: 'Tutte le Categorie',
        allCities: 'Tutte le Città',
        premium: 'Partner Premium',
        cashback: 'Cashback',
        directions: 'Indicazioni',
        noPartners: 'Nessun partner trovato',
        loading: 'Caricamento...',
        locationError: 'Impossibile ottenere la posizione',
        partners: 'Partner'
      },
      pt: {
        title: 'Mapa de Parceiros',
        subtitle: 'Encontre parceiros perto de você',
        search: 'Buscar parceiro ou cidade...',
        nearMe: 'Perto de mim',
        filter: 'Filtrar',
        allCategories: 'Todas as Categorias',
        allCities: 'Todas as Cidades',
        premium: 'Parceiro Premium',
        cashback: 'Cashback',
        directions: 'Direções',
        noPartners: 'Nenhum parceiro encontrado',
        loading: 'Carregando...',
        locationError: 'Não foi possível obter a localização',
        partners: 'Parceiros'
      },
      nl: {
        title: 'Partnerkaart',
        subtitle: 'Vind partners bij jou in de buurt',
        search: 'Zoek partner of stad...',
        nearMe: 'Bij mij in de buurt',
        filter: 'Filter',
        allCategories: 'Alle Categorieën',
        allCities: 'Alle Steden',
        premium: 'Premium Partner',
        cashback: 'Cashback',
        directions: 'Route',
        noPartners: 'Geen partners gevonden',
        loading: 'Laden...',
        locationError: 'Kon locatie niet ophalen',
        partners: 'Partners'
      },
      pl: {
        title: 'Mapa Partnerów',
        subtitle: 'Znajdź partnerów w pobliżu',
        search: 'Szukaj partnera lub miasta...',
        nearMe: 'W pobliżu',
        filter: 'Filtr',
        allCategories: 'Wszystkie Kategorie',
        allCities: 'Wszystkie Miasta',
        premium: 'Partner Premium',
        cashback: 'Cashback',
        directions: 'Trasa',
        noPartners: 'Nie znaleziono partnerów',
        loading: 'Ładowanie...',
        locationError: 'Nie można uzyskać lokalizacji',
        partners: 'Partnerzy'
      },
      ru: {
        title: 'Карта Партнёров',
        subtitle: 'Найдите партнёров рядом',
        search: 'Искать партнёра или город...',
        nearMe: 'Рядом со мной',
        filter: 'Фильтр',
        allCategories: 'Все Категории',
        allCities: 'Все Города',
        premium: 'Премиум Партнёр',
        cashback: 'Кэшбэк',
        directions: 'Маршрут',
        noPartners: 'Партнёры не найдены',
        loading: 'Загрузка...',
        locationError: 'Не удалось получить местоположение',
        partners: 'Партнёры'
      },
      zh: {
        title: '合作伙伴地图',
        subtitle: '查找您附近的合作伙伴',
        search: '搜索合作伙伴或城市...',
        nearMe: '我附近',
        filter: '筛选',
        allCategories: '所有类别',
        allCities: '所有城市',
        premium: '优质合作伙伴',
        cashback: '返现',
        directions: '路线',
        noPartners: '未找到合作伙伴',
        loading: '加载中...',
        locationError: '无法获取位置',
        partners: '合作伙伴'
      },
      ja: {
        title: 'パートナーマップ',
        subtitle: 'お近くのパートナーを探す',
        search: 'パートナーまたは都市を検索...',
        nearMe: '近くで',
        filter: 'フィルター',
        allCategories: 'すべてのカテゴリー',
        allCities: 'すべての都市',
        premium: 'プレミアムパートナー',
        cashback: 'キャッシュバック',
        directions: 'ルート',
        noPartners: 'パートナーが見つかりません',
        loading: '読み込み中...',
        locationError: '位置情報を取得できません',
        partners: 'パートナー'
      },
      ko: {
        title: '파트너 지도',
        subtitle: '근처 파트너 찾기',
        search: '파트너 또는 도시 검색...',
        nearMe: '내 주변',
        filter: '필터',
        allCategories: '모든 카테고리',
        allCities: '모든 도시',
        premium: '프리미엄 파트너',
        cashback: '캐시백',
        directions: '길찾기',
        noPartners: '파트너를 찾을 수 없습니다',
        loading: '로딩 중...',
        locationError: '위치를 가져올 수 없습니다',
        partners: '파트너'
      }
    };
    return translations[language]?.[key] || translations.de[key] || key;
  };

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/api/partner-search/map`);
      if (response.ok) {
        const data = await response.json();
        setPartners(data.partners || []);
        
        // Set map center to first partner with coordinates
        const partnerWithCoords = (data.partners || []).find(p => p.latitude && p.longitude);
        if (partnerWithCoords) {
          setMapCenter([partnerWithCoords.latitude, partnerWithCoords.longitude]);
        }
      }
    } catch (error) {
      console.error('Error fetching partners:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const handleNearMe = () => {
    if (!navigator.geolocation) {
      toast.error(t('locationError'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        setMapCenter([latitude, longitude]);
        setMapZoom(14);
        toast.success('Standort gefunden!');
      },
      (error) => {
        toast.error(t('locationError'));
        console.error('Geolocation error:', error);
      }
    );
  };

  const filteredPartners = partners.filter(partner => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = partner.business_name?.toLowerCase().includes(query);
      const matchesCity = partner.city?.toLowerCase().includes(query);
      const matchesAddress = partner.address?.toLowerCase().includes(query);
      if (!matchesName && !matchesCity && !matchesAddress) return false;
    }
    
    // Category filter
    if (categoryFilter !== 'all' && partner.category !== categoryFilter) {
      return false;
    }
    
    // City filter
    if (cityFilter !== 'all' && partner.city !== cityFilter) {
      return false;
    }
    
    return true;
  });

  const cities = [...new Set(partners.map(p => p.city).filter(Boolean))].sort();

  const openDirections = (partner) => {
    const destination = encodeURIComponent(`${partner.address}, ${partner.city}`);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
  };

  return (
    <div className="h-[600px] flex flex-col bg-white rounded-xl overflow-hidden border border-gray-200" data-testid="partner-map">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-500" />
              {t('title')}
            </h2>
            <p className="text-gray-500 text-sm">{filteredPartners.length} {t('partners')}</p>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder={t('search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4" />
            </Button>
            <Button size="sm" onClick={handleNearMe} className="bg-amber-500 hover:bg-amber-600">
              <Navigation className="w-4 h-4 mr-1" />
              {t('nearMe')}
            </Button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 flex flex-wrap gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
            
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="all">{t('allCities')}</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            
            {(categoryFilter !== 'all' || cityFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setCategoryFilter('all'); setCityFilter('all'); }}
              >
                <X className="w-4 h-4 mr-1" />
                Reset
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: '100%', width: '100%' }}
            ref={mapRef}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapController center={mapCenter} zoom={mapZoom} />
            
            {/* User location marker */}
            {userLocation && (
              <Marker 
                position={userLocation}
                icon={L.divIcon({
                  className: 'user-marker',
                  html: '<div style="background: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(59,130,246,0.5);"></div>',
                  iconSize: [20, 20],
                  iconAnchor: [10, 10]
                })}
              >
                <Popup>Dein Standort</Popup>
              </Marker>
            )}
            
            {/* Partner markers */}
            {filteredPartners.map(partner => (
              partner.latitude && partner.longitude && (
                <Marker
                  key={partner.id}
                  position={[partner.latitude, partner.longitude]}
                  icon={
                    selectedPartner?.id === partner.id ? selectedIcon :
                    partner.is_premium ? premiumIcon : defaultIcon
                  }
                  eventHandlers={{
                    click: () => setSelectedPartner(partner)
                  }}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <div className="flex items-center gap-2 mb-2">
                        {partner.is_premium && <Crown className="w-4 h-4 text-yellow-500" />}
                        <span className="font-bold">{partner.business_name}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{partner.address}</p>
                      <p className="text-sm text-gray-500 mb-2">{partner.city}</p>
                      {partner.cashback_rate && (
                        <p className="text-sm text-green-600 font-medium mb-2">
                          {partner.cashback_rate}% Cashback
                        </p>
                      )}
                      <Button
                        size="sm"
                        className="w-full bg-amber-500 hover:bg-amber-600"
                        onClick={() => openDirections(partner)}
                      >
                        <Navigation className="w-4 h-4 mr-1" />
                        {t('directions')}
                      </Button>
                    </div>
                  </Popup>
                </Marker>
              )
            ))}
          </MapContainer>
        )}
      </div>

      {/* Partner List (Mobile) */}
      {selectedPartner && (
        <div className="sm:hidden p-4 border-t border-gray-100 bg-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                {selectedPartner.is_premium && <Crown className="w-4 h-4 text-yellow-500" />}
                <span className="font-bold">{selectedPartner.business_name}</span>
              </div>
              <p className="text-sm text-gray-600">{selectedPartner.address}, {selectedPartner.city}</p>
              {selectedPartner.cashback_rate && (
                <p className="text-sm text-green-600 font-medium">{selectedPartner.cashback_rate}% Cashback</p>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => openDirections(selectedPartner)}
              className="bg-amber-500"
            >
              <Navigation className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerMap;
