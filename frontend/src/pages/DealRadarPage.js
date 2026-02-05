import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Radar, Clock, TrendingDown, Activity, 
  AlertTriangle, Target, Zap, ArrowRight,
  RefreshCw, Bell, Settings
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Translations - All 6 languages
const translations = {
  de: {
    title: 'Schnäppchen-Radar',
    subtitle: 'Finde die besten Deals mit wenig Konkurrenz',
    bargains: 'Top Schnäppchen',
    lowActivity: 'Wenig Aktivität',
    endingSoon: 'Endet bald',
    priceHistory: 'Preishistorie',
    currentPrice: 'Aktuell',
    retailPrice: 'UVP',
    discount: 'Rabatt',
    bids: 'Gebote',
    timeLeft: 'Verbleibend',
    minutes: 'Min',
    seconds: 'Sek',
    lastBidder: 'Letzter Bieter',
    noOne: 'Noch niemand',
    bidNow: 'Jetzt bieten',
    view: 'Ansehen',
    refresh: 'Aktualisieren',
    lowActivityLabel: 'Wenig Gebote',
    endingSoonLabel: 'Endet bald',
    bargainScore: 'Deal-Score',
    settings: 'Einstellungen',
    avgPrice: 'Ø Preis',
    minPrice: 'Min',
    maxPrice: 'Max',
    soldTimes: 'verkauft',
    noBargains: 'Keine Schnäppchen gefunden',
    noBargainsDesc: 'Aktuell gibt es keine Auktionen mit wenig Aktivität',
    checkBack: 'Schau später wieder vorbei!',
    loading: 'Suche nach Deals...',
    howItWorks: 'Wie funktioniert der Schnäppchen-Radar?',
    step1: 'Wir scannen alle aktiven Auktionen nach Deals mit wenig Konkurrenz',
    step2: 'Auktionen mit wenigen Geboten und kurzer Restzeit werden markiert',
    step3: 'Greife schnell zu - diese Deals verschwinden in Sekunden!'
  },
  en: {
    title: 'Deal Radar',
    subtitle: 'Find the best deals with low competition',
    bargains: 'Top Bargains',
    lowActivity: 'Low Activity',
    endingSoon: 'Ending Soon',
    priceHistory: 'Price History',
    currentPrice: 'Current',
    retailPrice: 'RRP',
    discount: 'Discount',
    bids: 'Bids',
    timeLeft: 'Time Left',
    minutes: 'min',
    seconds: 'sec',
    lastBidder: 'Last Bidder',
    noOne: 'No one yet',
    bidNow: 'Bid Now',
    view: 'View',
    refresh: 'Refresh',
    lowActivityLabel: 'Low Bids',
    endingSoonLabel: 'Ending Soon',
    bargainScore: 'Deal Score',
    settings: 'Settings',
    avgPrice: 'Avg Price',
    minPrice: 'Min',
    maxPrice: 'Max',
    soldTimes: 'sold',
    noBargains: 'No bargains found',
    noBargainsDesc: 'Currently no auctions with low activity',
    checkBack: 'Check back later!',
    loading: 'Searching for deals...',
    howItWorks: 'How does the Deal Radar work?',
    step1: 'We scan all active auctions for deals with low competition',
    step2: 'Auctions with few bids and short remaining time are highlighted',
    step3: 'Act fast - these deals disappear in seconds!'
  },
  tr: {
    title: 'Fırsat Radarı',
    subtitle: 'Düşük rekabetli en iyi fırsatları bulun',
    bargains: 'En İyi Fırsatlar',
    lowActivity: 'Düşük Aktivite',
    endingSoon: 'Yakında Bitiyor',
    priceHistory: 'Fiyat Geçmişi',
    currentPrice: 'Mevcut',
    retailPrice: 'PBF',
    discount: 'İndirim',
    bids: 'Teklifler',
    timeLeft: 'Kalan Süre',
    minutes: 'dk',
    seconds: 'sn',
    lastBidder: 'Son Teklif Veren',
    noOne: 'Henüz kimse',
    bidNow: 'Şimdi Teklif Ver',
    view: 'Görüntüle',
    refresh: 'Yenile',
    lowActivityLabel: 'Az Teklif',
    endingSoonLabel: 'Yakında Bitiyor',
    bargainScore: 'Fırsat Puanı',
    settings: 'Ayarlar',
    avgPrice: 'Ort. Fiyat',
    minPrice: 'Min',
    maxPrice: 'Maks',
    soldTimes: 'satıldı',
    noBargains: 'Fırsat bulunamadı',
    noBargainsDesc: 'Şu anda düşük aktiviteli açık artırma yok',
    checkBack: 'Daha sonra tekrar kontrol edin!',
    loading: 'Fırsatlar aranıyor...',
    howItWorks: 'Fırsat Radarı nasıl çalışır?',
    step1: 'Düşük rekabetli fırsatlar için tüm aktif açık artırmaları tarıyoruz',
    step2: 'Az teklifli ve kısa süreli açık artırmalar işaretlenir',
    step3: 'Hızlı davranın - bu fırsatlar saniyeler içinde kaybolur!'
  },
  fr: {
    title: 'Radar des Bonnes Affaires',
    subtitle: 'Trouvez les meilleures offres avec peu de concurrence',
    bargains: 'Meilleures Affaires',
    lowActivity: 'Faible Activité',
    endingSoon: 'Se Termine Bientôt',
    priceHistory: 'Historique des Prix',
    currentPrice: 'Actuel',
    retailPrice: 'PVR',
    discount: 'Remise',
    bids: 'Enchères',
    timeLeft: 'Temps Restant',
    minutes: 'min',
    seconds: 'sec',
    lastBidder: 'Dernier Enchérisseur',
    noOne: 'Personne encore',
    bidNow: 'Enchérir',
    view: 'Voir',
    refresh: 'Actualiser',
    lowActivityLabel: 'Peu d\'Enchères',
    endingSoonLabel: 'Fin Proche',
    bargainScore: 'Score Affaire',
    settings: 'Paramètres',
    avgPrice: 'Prix Moy.',
    minPrice: 'Min',
    maxPrice: 'Max',
    soldTimes: 'vendu',
    noBargains: 'Aucune bonne affaire trouvée',
    noBargainsDesc: 'Actuellement aucune enchère avec peu d\'activité',
    checkBack: 'Revenez plus tard!',
    loading: 'Recherche d\'offres...',
    howItWorks: 'Comment fonctionne le Radar des Bonnes Affaires?',
    step1: 'Nous analysons toutes les enchères actives pour les offres avec peu de concurrence',
    step2: 'Les enchères avec peu d\'offres et un temps restant court sont mises en évidence',
    step3: 'Agissez vite - ces offres disparaissent en quelques secondes!'
  },
  es: {
    title: 'Radar de Ofertas',
    subtitle: 'Encuentra las mejores ofertas con poca competencia',
    bargains: 'Mejores Ofertas',
    lowActivity: 'Baja Actividad',
    endingSoon: 'Termina Pronto',
    priceHistory: 'Historial de Precios',
    currentPrice: 'Actual',
    retailPrice: 'PVP',
    discount: 'Descuento',
    bids: 'Pujas',
    timeLeft: 'Tiempo Restante',
    minutes: 'min',
    seconds: 'seg',
    lastBidder: 'Último Postor',
    noOne: 'Nadie aún',
    bidNow: 'Pujar Ahora',
    view: 'Ver',
    refresh: 'Actualizar',
    lowActivityLabel: 'Pocas Pujas',
    endingSoonLabel: 'Termina Pronto',
    bargainScore: 'Puntuación',
    settings: 'Ajustes',
    avgPrice: 'Precio Med.',
    minPrice: 'Mín',
    maxPrice: 'Máx',
    soldTimes: 'vendido',
    noBargains: 'No se encontraron ofertas',
    noBargainsDesc: 'Actualmente no hay subastas con poca actividad',
    checkBack: '¡Vuelve más tarde!',
    loading: 'Buscando ofertas...',
    howItWorks: '¿Cómo funciona el Radar de Ofertas?',
    step1: 'Escaneamos todas las subastas activas en busca de ofertas con poca competencia',
    step2: 'Las subastas con pocas pujas y poco tiempo restante se destacan',
    step3: '¡Actúa rápido - estas ofertas desaparecen en segundos!'
  },
  sq: {
    title: 'Radari i Ofertave',
    subtitle: 'Gjeni ofertat më të mira me konkurrencë të ulët',
    bargains: 'Ofertat Top',
    lowActivity: 'Aktivitet i Ulët',
    endingSoon: 'Përfundon Së Shpejti',
    priceHistory: 'Historia e Çmimeve',
    currentPrice: 'Aktual',
    retailPrice: 'ÇSH',
    discount: 'Zbritje',
    bids: 'Oferta',
    timeLeft: 'Koha e Mbetur',
    minutes: 'min',
    seconds: 'sek',
    lastBidder: 'Ofertuesi i Fundit',
    noOne: 'Askush ende',
    bidNow: 'Ofertohu Tani',
    view: 'Shiko',
    refresh: 'Rifresko',
    lowActivityLabel: 'Pak Oferta',
    endingSoonLabel: 'Përfundon Së Shpejti',
    bargainScore: 'Pikët e Ofertës',
    settings: 'Cilësimet',
    avgPrice: 'Çmimi Mes.',
    minPrice: 'Min',
    maxPrice: 'Maks',
    soldTimes: 'shitur',
    noBargains: 'Nuk u gjetën oferta',
    noBargainsDesc: 'Aktualisht nuk ka ankande me aktivitet të ulët',
    checkBack: 'Kthehuni më vonë!',
    loading: 'Duke kërkuar oferta...',
    howItWorks: 'Si funksionon Radari i Ofertave?',
    step1: 'Ne skanojmë të gjitha ankandat aktive për oferta me konkurrencë të ulët',
    step2: 'Ankandat me pak oferta dhe kohë të shkurtër të mbetur theksohen',
    step3: 'Veproni shpejt - këto oferta zhduken brenda sekondave!'
  }
};

// Timer display
const formatTime = (seconds) => {
  if (seconds <= 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// Bargain Card Component
const BargainCard = ({ bargain, t, onBid }) => {
  const [timeLeft, setTimeLeft] = useState(bargain.seconds_left);
  const navigate = useNavigate();
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  const isUrgent = timeLeft < 60;
  const isEnding = timeLeft < 300;
  
  return (
    <div 
      className={`bg-white rounded-xl border-2 shadow-lg ${
        isUrgent ? 'border-red-500 animate-pulse' : 
        isEnding ? 'border-orange-500' : 
        'border-cyan-400'
      } overflow-hidden hover:shadow-xl transition-all cursor-pointer`}
      onClick={() => navigate(`/auctions/${bargain.auction_id}`)}
      data-testid={`bargain-${bargain.auction_id}`}
    >
      {/* Badges */}
      <div className="flex items-center justify-between p-2 bg-gradient-to-r from-cyan-50 to-green-50">
        <div className="flex gap-1">
          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">
            -{bargain.discount_percent}%
          </span>
          {bargain.is_low_activity && (
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
              {t.lowActivityLabel}
            </span>
          )}
          {bargain.is_ending_soon && (
            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold">
              {t.endingSoonLabel}
            </span>
          )}
        </div>
        <span className={`font-mono text-sm font-bold px-2 py-0.5 rounded ${
          isUrgent ? 'bg-red-500 text-white' : 'bg-gray-700 text-white'
        }`}>
          {formatTime(timeLeft)}
        </span>
      </div>
      
      {/* Content */}
      <div className="p-3">
        <div className="flex gap-3">
          {/* Image */}
          <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-100">
            {bargain.product_image ? (
              <img 
                src={bargain.product_image} 
                alt="" 
                className="max-w-full max-h-full object-contain p-1"
              />
            ) : (
              <Target className="w-8 h-8 text-gray-400" />
            )}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-gray-800 font-bold text-sm line-clamp-2 mb-1">
              {bargain.product_name}
            </h3>
            <p className="text-gray-400 text-xs line-through">
              {t.retailPrice}: €{bargain.retail_price?.toLocaleString('de-DE')}
            </p>
            <p className="text-amber-600 font-bold text-lg">
              €{bargain.current_price?.toFixed(2).replace('.', ',')}
            </p>
            <p className="text-gray-500 text-[10px]">
              {bargain.total_bids} {t.bids} • {bargain.last_bidder || t.noOne}
            </p>
          </div>
        </div>
        
        {/* Action */}
        <Button 
          onClick={(e) => { e.stopPropagation(); onBid(bargain.auction_id); }}
          className="w-full mt-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white"
          size="sm"
        >
          <Zap className="w-4 h-4 mr-1" />
          {t.bidNow}
        </Button>
      </div>
    </div>
  );
};

// Price History Mini Component
const PriceHistoryMini = ({ productId, t }) => {
  const [history, setHistory] = useState(null);
  
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API}/api/deal-radar/price-history/${productId}`);
        setHistory(res.data);
      } catch (e) {
        console.error('Price history error:', e);
      }
    };
    if (productId) fetchHistory();
  }, [productId]);
  
  if (!history || history.total_sold === 0) return null;
  
  return (
    <div className="bg-gray-50 rounded-lg p-2 mt-2 border border-gray-100">
      <p className="text-[10px] text-gray-500 mb-1">{t.priceHistory} ({history.total_sold}x {t.soldTimes})</p>
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">{t.avgPrice}: <span className="text-gray-800 font-bold">€{history.avg_price}</span></span>
        <span className="text-green-600">{t.minPrice}: €{history.min_price}</span>
        <span className="text-red-600">{t.maxPrice}: €{history.max_price}</span>
      </div>
    </div>
  );
};

export default function DealRadarPage() {
  const { isAuthenticated, token } = useAuth();
  const { language, mappedLanguage } = useLanguage();
  const navigate = useNavigate();
  
  // Get mapped language for translation (handle language codes like 'xk' -> 'sq')
  const langCode = mappedLanguage || language || 'de';
  const t = translations[langCode] || translations[language] || translations.de;
  
  const [bargains, setBargains] = useState([]);
  const [lowActivity, setLowActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('bargains');
  
  const fetchData = useCallback(async () => {
    try {
      const [bargainsRes, lowActivityRes] = await Promise.all([
        axios.get(`${API}/api/deal-radar/bargains?limit=12`),
        axios.get(`${API}/api/deal-radar/low-activity?limit=8`)
      ]);
      setBargains(bargainsRes.data.bargains || []);
      setLowActivity(lowActivityRes.data.auctions || []);
    } catch (error) {
      console.error('Error fetching deals:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);
  
  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };
  
  const handleBid = async (auctionId) => {
    if (!isAuthenticated) {
      toast.error('Bitte anmelden um zu bieten');
      navigate('/login');
      return;
    }
    
    try {
      await axios.post(
        `${API}/api/auctions/${auctionId}/bid`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Gebot platziert!');
      fetchData(); // Refresh data
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Bieten');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black py-8 px-4 flex items-center justify-center">
        <div className="text-center">
          <Radar className="w-16 h-16 text-cyan-500 mx-auto mb-4 animate-spin" />
          <p className="text-gray-400">{t.loading}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black py-8 px-4" data-testid="deal-radar-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/20 border border-cyan-500/30 mb-4">
            <Radar className="w-5 h-5 text-cyan-400" />
            <span className="text-cyan-400 font-bold">RADAR</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{t.title}</h1>
          <p className="text-gray-400 text-lg">{t.subtitle}</p>
        </div>
        
        {/* Tabs */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <Button
            variant={activeTab === 'bargains' ? 'default' : 'outline'}
            onClick={() => setActiveTab('bargains')}
            className={activeTab === 'bargains' ? 'bg-cyan-500' : ''}
          >
            <TrendingDown className="w-4 h-4 mr-1" />
            {t.bargains} ({bargains.length})
          </Button>
          <Button
            variant={activeTab === 'lowActivity' ? 'default' : 'outline'}
            onClick={() => setActiveTab('lowActivity')}
            className={activeTab === 'lowActivity' ? 'bg-blue-500' : ''}
          >
            <Activity className="w-4 h-4 mr-1" />
            {t.lowActivity} ({lowActivity.length})
          </Button>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        {/* Content */}
        {activeTab === 'bargains' && (
          <>
            {bargains.length === 0 ? (
              <div className="bg-gray-800/50 rounded-xl p-12 text-center">
                <Radar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl text-white mb-2">{t.noBargains}</h3>
                <p className="text-gray-400 mb-4">{t.noBargainsDesc}</p>
                <p className="text-gray-500 text-sm">{t.checkBack}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {bargains.map(bargain => (
                  <BargainCard 
                    key={bargain.auction_id} 
                    bargain={bargain} 
                    t={t} 
                    onBid={handleBid}
                  />
                ))}
              </div>
            )}
          </>
        )}
        
        {activeTab === 'lowActivity' && (
          <>
            {lowActivity.length === 0 ? (
              <div className="bg-gray-800/50 rounded-xl p-12 text-center">
                <Activity className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl text-white mb-2">{t.noBargains}</h3>
                <p className="text-gray-400">{t.noBargainsDesc}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {lowActivity.map(auction => (
                  <BargainCard 
                    key={auction.auction_id} 
                    bargain={{
                      ...auction,
                      discount_percent: auction.retail_price > 0 
                        ? Math.round((1 - auction.current_price / auction.retail_price) * 100)
                        : 99,
                      is_low_activity: true,
                      is_ending_soon: auction.seconds_left < 300,
                      product_image: auction.product_image,
                      last_bidder: auction.last_bidder
                    }} 
                    t={t} 
                    onBid={handleBid}
                  />
                ))}
              </div>
            )}
          </>
        )}
        
        {/* Info Box */}
        <div className="mt-8 bg-gradient-to-r from-cyan-500/10 to-green-500/10 rounded-xl p-6 border border-cyan-500/20">
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            {t.howItWorks}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-300">
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold flex-shrink-0">1</span>
              <p>{t.step1}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold flex-shrink-0">2</span>
              <p>{t.step2}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold flex-shrink-0">3</span>
              <p>{t.step3}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
