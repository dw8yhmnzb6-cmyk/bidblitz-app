/**
 * Write Review Page
 * Allow users to write reviews for restaurants after voucher redemption
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Star, ArrowLeft, Camera, X, Send, Utensils,
  ThumbsUp, ThumbsDown
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const translations = {
  de: {
    title: 'Bewertung schreiben',
    restaurant: 'Restaurant',
    voucherCode: 'Gutschein-Code',
    overallRating: 'Gesamtbewertung',
    foodRating: 'Essen',
    serviceRating: 'Service',
    ambianceRating: 'Ambiente',
    reviewTitle: 'Titel (optional)',
    titlePlaceholder: 'z.B. Tolles Essen!',
    comment: 'Ihre Bewertung',
    commentPlaceholder: 'Was hat Ihnen gefallen? Was könnte besser sein?',
    recommend: 'Würden Sie dieses Restaurant empfehlen?',
    yes: 'Ja',
    no: 'Nein',
    addPhotos: 'Fotos hinzufügen',
    photosHelp: 'Fügen Sie Fotos hinzu für 3 Bonus-Gebote!',
    submit: 'Bewertung abgeben',
    submitting: 'Wird gesendet...',
    success: 'Danke für Ihre Bewertung!',
    bonusBids: 'Sie haben {bids} Bonus-Gebote erhalten!',
    selectRating: 'Bitte wählen Sie eine Bewertung',
    enterVoucher: 'Bitte geben Sie Ihren Gutschein-Code ein',
    back: 'Zurück',
    loginRequired: 'Bitte melden Sie sich an'
  },
  en: {
    title: 'Write Review',
    restaurant: 'Restaurant',
    voucherCode: 'Voucher Code',
    overallRating: 'Overall Rating',
    foodRating: 'Food',
    serviceRating: 'Service',
    ambianceRating: 'Ambiance',
    reviewTitle: 'Title (optional)',
    titlePlaceholder: 'e.g. Great food!',
    comment: 'Your Review',
    commentPlaceholder: 'What did you like? What could be better?',
    recommend: 'Would you recommend this restaurant?',
    yes: 'Yes',
    no: 'No',
    addPhotos: 'Add Photos',
    photosHelp: 'Add photos for 3 bonus bids!',
    submit: 'Submit Review',
    submitting: 'Submitting...',
    success: 'Thank you for your review!',
    bonusBids: 'You received {bids} bonus bids!',
    selectRating: 'Please select a rating',
    enterVoucher: 'Please enter your voucher code',
    back: 'Back',
    loginRequired: 'Please log in'
  }
};

const RATING_LABELS = {
  1: { de: 'Schlecht', en: 'Poor' },
  2: { de: 'Okay', en: 'Fair' },
  3: { de: 'Gut', en: 'Good' },
  4: { de: 'Sehr gut', en: 'Very Good' },
  5: { de: 'Ausgezeichnet', en: 'Excellent' }
};

export default function WriteReview() {
  const { id: restaurantId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuth();
  const { language } = useLanguage();
  const t = translations[language] || translations.de;
  
  const [voucherCode, setVoucherCode] = useState(searchParams.get('voucher') || '');
  const [rating, setRating] = useState(0);
  const [foodRating, setFoodRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [ambianceRating, setAmbianceRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState(true);
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [restaurant, setRestaurant] = useState(null);

  useEffect(() => {
    if (restaurantId) {
      fetchRestaurant();
    }
  }, [restaurantId]);

  const fetchRestaurant = async () => {
    try {
      const response = await axios.get(`${API}/api/restaurants/${restaurantId}`);
      setRestaurant(response.data.restaurant);
    } catch (err) {
      console.error('Error fetching restaurant:', err);
    }
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
      if (photos.length >= 5) {
        toast.error('Maximum 5 Fotos erlaubt');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotos(prev => [...prev, e.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (rating === 0) {
      toast.error(t.selectRating);
      return;
    }
    
    if (!voucherCode.trim()) {
      toast.error(t.enterVoucher);
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await axios.post(
        `${API}/api/restaurant-reviews/submit`,
        {
          restaurant_id: restaurantId,
          voucher_code: voucherCode.toUpperCase(),
          rating,
          title: title || null,
          comment: comment || null,
          food_rating: foodRating || null,
          service_rating: serviceRating || null,
          ambiance_rating: ambianceRating || null,
          would_recommend: wouldRecommend,
          photos
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(t.success);
      toast.success(t.bonusBids.replace('{bids}', response.data.bonus_bids));
      
      navigate(`/restaurant/${restaurantId}`);
    } catch (err) {
      console.error('Error submitting review:', err);
      toast.error(err.response?.data?.detail || 'Fehler beim Senden');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Star className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">{t.title}</h2>
          <p className="text-gray-500 mb-4">{t.loginRequired}</p>
          <Button onClick={() => navigate('/login')} className="bg-amber-500 hover:bg-amber-600">
            Anmelden
          </Button>
        </div>
      </div>
    );
  }

  const StarRating = ({ value, onChange, size = 'lg', label }) => (
    <div className="mb-4">
      {label && <p className="text-sm text-gray-600 mb-2">{label}</p>}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => size === 'lg' && setHoverRating(star)}
            onMouseLeave={() => size === 'lg' && setHoverRating(0)}
            className="focus:outline-none transition-transform hover:scale-110"
          >
            <Star
              className={`${size === 'lg' ? 'w-10 h-10' : 'w-6 h-6'} transition-colors ${
                star <= (size === 'lg' ? (hoverRating || value) : value)
                  ? 'text-amber-500 fill-current'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
        {size === 'lg' && (hoverRating || value) > 0 && (
          <span className="ml-3 text-gray-600 font-medium">
            {RATING_LABELS[hoverRating || value]?.[language] || RATING_LABELS[hoverRating || value]?.de}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-6 pb-20">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/80 hover:text-white mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          {t.back}
        </button>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        {restaurant && (
          <p className="text-amber-100 flex items-center gap-2 mt-2">
            <Utensils className="w-4 h-4" />
            {restaurant.restaurant_name}
          </p>
        )}
      </div>
      
      {/* Form */}
      <div className="px-4 -mt-12">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
          {/* Voucher Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.voucherCode} *
            </label>
            <Input
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
              placeholder="z.B. REST-ABC123"
              className="uppercase"
              required
            />
          </div>
          
          {/* Overall Rating */}
          <div className="bg-amber-50 rounded-xl p-4">
            <p className="font-bold text-gray-800 mb-3">{t.overallRating} *</p>
            <StarRating value={rating} onChange={setRating} size="lg" />
          </div>
          
          {/* Detailed Ratings */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <StarRating value={foodRating} onChange={setFoodRating} size="sm" />
              <p className="text-xs text-gray-500 mt-1">{t.foodRating}</p>
            </div>
            <div className="text-center">
              <StarRating value={serviceRating} onChange={setServiceRating} size="sm" />
              <p className="text-xs text-gray-500 mt-1">{t.serviceRating}</p>
            </div>
            <div className="text-center">
              <StarRating value={ambianceRating} onChange={setAmbianceRating} size="sm" />
              <p className="text-xs text-gray-500 mt-1">{t.ambianceRating}</p>
            </div>
          </div>
          
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.reviewTitle}
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.titlePlaceholder}
              maxLength={100}
            />
          </div>
          
          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.comment}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t.commentPlaceholder}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
              maxLength={1000}
            />
            <p className="text-xs text-gray-400 text-right mt-1">{comment.length}/1000</p>
          </div>
          
          {/* Would Recommend */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">{t.recommend}</p>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setWouldRecommend(true)}
                className={`flex-1 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                  wouldRecommend 
                    ? 'border-green-500 bg-green-50 text-green-700' 
                    : 'border-gray-200 text-gray-500'
                }`}
              >
                <ThumbsUp className="w-5 h-5" />
                {t.yes}
              </button>
              <button
                type="button"
                onClick={() => setWouldRecommend(false)}
                className={`flex-1 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                  !wouldRecommend 
                    ? 'border-red-500 bg-red-50 text-red-700' 
                    : 'border-gray-200 text-gray-500'
                }`}
              >
                <ThumbsDown className="w-5 h-5" />
                {t.no}
              </button>
            </div>
          </div>
          
          {/* Photos */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">{t.addPhotos}</p>
            <p className="text-xs text-amber-600 mb-3">📸 {t.photosHelp}</p>
            
            <div className="flex flex-wrap gap-2">
              {photos.map((photo, index) => (
                <div key={index} className="relative">
                  <img 
                    src={photo} 
                    alt={`Upload ${index + 1}`}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              
              {photos.length < 5 && (
                <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-amber-500 hover:bg-amber-50 transition-colors">
                  <Camera className="w-6 h-6 text-gray-400" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
          
          {/* Submit */}
          <Button
            type="submit"
            disabled={submitting || rating === 0}
            className="w-full bg-amber-500 hover:bg-amber-600 py-3 text-lg"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                {t.submitting}
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                {t.submit}
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
