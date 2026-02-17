/**
 * Restaurant Detail Page
 * Shows full restaurant info, reviews, and available vouchers
 */
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Star, MapPin, Clock, Phone, Globe, ArrowLeft, Ticket, 
  Heart, Share2, Award, ChevronRight, ThumbsUp, Camera,
  Utensils, TrendingUp, MessageSquare
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const translations = {
  de: {
    back: 'Zurück',
    vouchers: 'Verfügbare Gutscheine',
    reviews: 'Bewertungen',
    noReviews: 'Noch keine Bewertungen',
    beFirst: 'Sei der Erste, der eine Bewertung schreibt!',
    writeReview: 'Bewertung schreiben',
    helpful: 'Hilfreich',
    verifiedPurchase: 'Verifizierter Kauf',
    recommend: 'würden empfehlen',
    viewVoucher: 'Gutschein ansehen',
    worth: 'Wert',
    food: 'Essen',
    service: 'Service',
    ambiance: 'Ambiente',
    premium: 'Premium Partner',
    openNow: 'Jetzt geöffnet',
    closed: 'Geschlossen',
    photos: 'Fotos',
    about: 'Über uns',
    contact: 'Kontakt',
    features: 'Ausstattung',
    priceRange: 'Preisklasse',
    categories: 'Kategorien',
    notFound: 'Restaurant nicht gefunden',
    loading: 'Laden...'
  },
  en: {
    back: 'Back',
    vouchers: 'Available Vouchers',
    reviews: 'Reviews',
    noReviews: 'No reviews yet',
    beFirst: 'Be the first to write a review!',
    writeReview: 'Write Review',
    helpful: 'Helpful',
    verifiedPurchase: 'Verified Purchase',
    recommend: 'would recommend',
    viewVoucher: 'View Voucher',
    worth: 'Worth',
    food: 'Food',
    service: 'Service',
    ambiance: 'Ambiance',
    premium: 'Premium Partner',
    openNow: 'Open now',
    closed: 'Closed',
    photos: 'Photos',
    about: 'About',
    contact: 'Contact',
    features: 'Features',
    priceRange: 'Price Range',
    categories: 'Categories',
    notFound: 'Restaurant not found',
    loading: 'Loading...'
  }
};

const FEATURES_MAP = {
  outdoor_seating: { de: 'Außenbereich', en: 'Outdoor Seating', icon: '🌳' },
  wifi: { de: 'WLAN', en: 'WiFi', icon: '📶' },
  parking: { de: 'Parkplatz', en: 'Parking', icon: '🅿️' },
  wheelchair: { de: 'Barrierefrei', en: 'Wheelchair Access', icon: '♿' },
  delivery: { de: 'Lieferung', en: 'Delivery', icon: '🚚' },
  takeaway: { de: 'Zum Mitnehmen', en: 'Takeaway', icon: '📦' },
  reservations: { de: 'Reservierung', en: 'Reservations', icon: '📅' },
  kids_friendly: { de: 'Kinderfreundlich', en: 'Kids Friendly', icon: '👶' },
  vegetarian: { de: 'Vegetarische Optionen', en: 'Vegetarian Options', icon: '🥗' },
  halal: { de: 'Halal', en: 'Halal', icon: '☪️' },
};

export default function RestaurantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuth();
  const { language } = useLanguage();
  const t = translations[language] || translations.de;
  
  const [restaurant, setRestaurant] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    fetchRestaurantDetails();
  }, [id]);

  const fetchRestaurantDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/restaurants/${id}`);
      
      setRestaurant(response.data.restaurant);
      setVouchers(response.data.available_vouchers || []);
      setReviews(response.data.recent_reviews || []);
      setCategories(response.data.categories || []);
      setStats(response.data.stats || {});
    } catch (err) {
      console.error('Error fetching restaurant:', err);
      setError(t.notFound);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: restaurant?.restaurant_name,
          text: `Schau dir ${restaurant?.restaurant_name} auf BidBlitz an!`,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link kopiert!');
    }
  };

  const markHelpful = async (reviewId) => {
    if (!isAuthenticated) {
      toast.error('Bitte melden Sie sich an');
      return;
    }
    
    try {
      await axios.post(
        `${API}/api/restaurant-reviews/${reviewId}/helpful`,
        { helpful: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Danke für Ihr Feedback!');
      fetchRestaurantDetails();
    } catch (err) {
      toast.error('Bereits abgestimmt');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-48 bg-gray-200 rounded-xl" />
          <div className="h-8 bg-gray-200 rounded w-2/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-32 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Utensils className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">{t.notFound}</h2>
          <Button onClick={() => navigate(-1)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t.back}
          </Button>
        </div>
      </div>
    );
  }

  const priceRangeDisplay = restaurant.price_range 
    ? '€'.repeat(restaurant.price_range) 
    : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header Image */}
      <div className="relative h-56 bg-gradient-to-br from-amber-400 to-orange-500">
        {restaurant.cover_image ? (
          <img 
            src={restaurant.cover_image} 
            alt={restaurant.restaurant_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Utensils className="w-20 h-20 text-white/50" />
          </div>
        )}
        
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 p-2 bg-white/90 backdrop-blur rounded-full shadow-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        {/* Share Button */}
        <button
          onClick={handleShare}
          className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur rounded-full shadow-lg"
        >
          <Share2 className="w-5 h-5" />
        </button>
        
        {/* Premium Badge */}
        {restaurant.is_premium && (
          <div className="absolute bottom-4 left-4 bg-amber-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
            <Award className="w-4 h-4" />
            {t.premium}
          </div>
        )}
      </div>
      
      {/* Main Content */}
      <div className="px-4 -mt-6 relative">
        {/* Info Card */}
        <div className="bg-white rounded-2xl shadow-lg p-5 mb-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {restaurant.restaurant_name}
          </h1>
          
          {/* Rating & Reviews */}
          <div className="flex items-center gap-4 mb-4">
            {stats.avg_rating > 0 ? (
              <>
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 text-amber-500 fill-current" />
                  <span className="font-bold text-lg">{stats.avg_rating?.toFixed(1)}</span>
                </div>
                <span className="text-gray-500">
                  {stats.total_reviews} {t.reviews}
                </span>
                {stats.recommend_percent > 0 && (
                  <span className="text-green-600 text-sm flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    {stats.recommend_percent}% {t.recommend}
                  </span>
                )}
              </>
            ) : (
              <span className="text-gray-400">Neu</span>
            )}
          </div>
          
          {/* Categories */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map(cat => (
                <span 
                  key={cat.id}
                  className="px-3 py-1 rounded-full text-sm font-medium"
                  style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                >
                  {cat.icon} {cat.name}
                </span>
              ))}
            </div>
          )}
          
          {/* Quick Info */}
          <div className="space-y-2 text-gray-600 text-sm">
            {restaurant.address && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span>{restaurant.address}</span>
              </div>
            )}
            
            {restaurant.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <a href={`tel:${restaurant.phone}`} className="text-amber-600">
                  {restaurant.phone}
                </a>
              </div>
            )}
            
            {restaurant.opening_hours && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>{restaurant.opening_hours}</span>
              </div>
            )}
            
            {priceRangeDisplay && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-lg">{priceRangeDisplay}</span>
                <span className="text-gray-400">{t.priceRange}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {['info', 'vouchers', 'reviews'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab
                  ? 'bg-amber-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab === 'info' && t.about}
              {tab === 'vouchers' && `${t.vouchers} (${vouchers.length})`}
              {tab === 'reviews' && `${t.reviews} (${stats.total_reviews || 0})`}
            </button>
          ))}
        </div>
        
        {/* Tab Content */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            {/* Description */}
            {restaurant.description && (
              <div className="bg-white rounded-xl p-4">
                <h3 className="font-bold text-gray-800 mb-2">{t.about}</h3>
                <p className="text-gray-600">{restaurant.description}</p>
              </div>
            )}
            
            {/* Features */}
            {restaurant.features && restaurant.features.length > 0 && (
              <div className="bg-white rounded-xl p-4">
                <h3 className="font-bold text-gray-800 mb-3">{t.features}</h3>
                <div className="flex flex-wrap gap-2">
                  {restaurant.features.map(featureId => {
                    const feature = FEATURES_MAP[featureId];
                    if (!feature) return null;
                    return (
                      <span 
                        key={featureId}
                        className="px-3 py-1 bg-gray-100 rounded-full text-sm"
                      >
                        {feature.icon} {feature[language] || feature.de}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Gallery */}
            {restaurant.gallery_images && restaurant.gallery_images.length > 0 && (
              <div className="bg-white rounded-xl p-4">
                <h3 className="font-bold text-gray-800 mb-3">{t.photos}</h3>
                <div className="grid grid-cols-3 gap-2">
                  {restaurant.gallery_images.slice(0, 6).map((img, i) => (
                    <img 
                      key={i}
                      src={img}
                      alt={`${restaurant.restaurant_name} ${i + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'vouchers' && (
          <div className="space-y-3">
            {vouchers.length > 0 ? (
              vouchers.map(voucher => (
                <div key={voucher.id || voucher.code} className="bg-white rounded-xl p-4 border-l-4 border-green-500">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-gray-800">{voucher.name || 'Restaurant Gutschein'}</p>
                      <p className="text-sm text-gray-500">{voucher.description || 'Einlösbar bei diesem Restaurant'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">€{voucher.value || voucher.amount}</p>
                      <p className="text-xs text-gray-400">{t.worth}</p>
                    </div>
                  </div>
                  <Link to={`/vouchers`}>
                    <Button size="sm" className="w-full bg-green-500 hover:bg-green-600">
                      <Ticket className="w-4 h-4 mr-2" />
                      {t.viewVoucher}
                    </Button>
                  </Link>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-xl p-8 text-center">
                <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">Keine Gutscheine verfügbar</p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'reviews' && (
          <div className="space-y-3">
            {/* Write Review Button */}
            {isAuthenticated && (
              <Link to={`/write-review/${id}`}>
                <Button className="w-full bg-amber-500 hover:bg-amber-600 mb-4">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  {t.writeReview}
                </Button>
              </Link>
            )}
            
            {/* Rating Breakdown */}
            {stats.avg_rating > 0 && (
              <div className="bg-white rounded-xl p-4 mb-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  {stats.avg_food_rating > 0 && (
                    <div>
                      <p className="text-2xl font-bold text-gray-800">{stats.avg_food_rating?.toFixed(1)}</p>
                      <p className="text-xs text-gray-500">{t.food}</p>
                    </div>
                  )}
                  {stats.avg_service_rating > 0 && (
                    <div>
                      <p className="text-2xl font-bold text-gray-800">{stats.avg_service_rating?.toFixed(1)}</p>
                      <p className="text-xs text-gray-500">{t.service}</p>
                    </div>
                  )}
                  {stats.avg_ambiance_rating > 0 && (
                    <div>
                      <p className="text-2xl font-bold text-gray-800">{stats.avg_ambiance_rating?.toFixed(1)}</p>
                      <p className="text-xs text-gray-500">{t.ambiance}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Reviews List */}
            {reviews.length > 0 ? (
              reviews.map(review => (
                <div key={review.id} className="bg-white rounded-xl p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold">
                      {review.username?.charAt(0).toUpperCase() || 'A'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-800">{review.username}</p>
                        {review.is_verified && (
                          <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">
                            ✓ {t.verifiedPurchase}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className={`w-4 h-4 ${
                              i < review.rating 
                                ? 'text-amber-500 fill-current' 
                                : 'text-gray-300'
                            }`} 
                          />
                        ))}
                        <span className="text-xs text-gray-400 ml-2">
                          {new Date(review.created_at).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {review.title && (
                    <h4 className="font-bold text-gray-800 mb-1">{review.title}</h4>
                  )}
                  
                  {review.comment && (
                    <p className="text-gray-600 text-sm mb-3">{review.comment}</p>
                  )}
                  
                  {/* Review Photos */}
                  {review.photos && review.photos.length > 0 && (
                    <div className="flex gap-2 mb-3 overflow-x-auto">
                      {review.photos.map((photo, i) => (
                        <img 
                          key={i}
                          src={photo}
                          alt={`Review photo ${i + 1}`}
                          className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Helpful Button */}
                  <button
                    onClick={() => markHelpful(review.id)}
                    className="flex items-center gap-1 text-gray-500 hover:text-amber-500 text-sm"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    {t.helpful} ({review.helpful_count || 0})
                  </button>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-xl p-8 text-center">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 mb-1">{t.noReviews}</p>
                <p className="text-gray-400 text-sm">{t.beFirst}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
