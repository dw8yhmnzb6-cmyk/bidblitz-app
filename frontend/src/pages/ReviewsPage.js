import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { 
  Star, StarHalf, ThumbsUp, Camera, Video,
  CheckCircle, Gift, MessageSquare, User
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const ReviewsPage = () => {
  const { token, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [reviews, setReviews] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [stats, setStats] = useState({ average: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(null);
  const [formData, setFormData] = useState({
    rating: 5,
    title: '',
    content: '',
    would_recommend: true,
    delivery_rating: 5,
    product_quality_rating: 5
  });

  const texts = {
    de: {
      title: 'Gewinner-Bewertungen',
      subtitle: 'Echte Bewertungen von echten Gewinnern',
      verified: 'Verifizierter Kauf',
      helpful: 'Hilfreich',
      writeReview: 'Bewertung schreiben',
      pendingReviews: 'Ausstehende Bewertungen',
      pendingDesc: 'Bewerte deine gewonnenen Produkte und erhalte 2 Gratis-Gebote!',
      noReviews: 'Noch keine Bewertungen',
      rating: 'Bewertung',
      reviewTitle: 'Titel',
      reviewContent: 'Deine Erfahrung',
      wouldRecommend: 'Würdest du BidBlitz empfehlen?',
      deliveryRating: 'Lieferung',
      qualityRating: 'Produktqualität',
      submit: 'Bewertung absenden',
      thankYou: 'Danke für deine Bewertung! +2 Gebote',
      yes: 'Ja',
      no: 'Nein',
      wonFor: 'Gewonnen für',
      savedAmount: 'Ersparnis',
      allReviews: 'Alle Bewertungen',
      bonusHint: '+2 Gebote für jede Bewertung'
    },
    en: {
      title: 'Winner Reviews',
      subtitle: 'Real reviews from real winners',
      verified: 'Verified Purchase',
      helpful: 'Helpful',
      writeReview: 'Write Review',
      pendingReviews: 'Pending Reviews',
      pendingDesc: 'Review your won products and get 2 free bids!',
      noReviews: 'No reviews yet',
      rating: 'Rating',
      reviewTitle: 'Title',
      reviewContent: 'Your experience',
      wouldRecommend: 'Would you recommend BidBlitz?',
      deliveryRating: 'Delivery',
      qualityRating: 'Product Quality',
      submit: 'Submit Review',
      thankYou: 'Thanks for your review! +2 Bids',
      yes: 'Yes',
      no: 'No',
      wonFor: 'Won for',
      savedAmount: 'Saved',
      allReviews: 'All Reviews',
      bonusHint: '+2 Bids for each review'
    }
  };
  const t = texts[language] || texts.de;

  useEffect(() => {
    fetchData();
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      const [reviewsRes, pendingRes] = await Promise.all([
        axios.get(`${API}/api/reviews/public`),
        isAuthenticated ? axios.get(`${API}/api/reviews/my-pending`, {
          headers: { Authorization: `Bearer ${token}` }
        }) : Promise.resolve({ data: { pending: [] } })
      ]);
      
      setReviews(reviewsRes.data.reviews || []);
      setStats({
        average: reviewsRes.data.average_rating || 0,
        total: reviewsRes.data.total || 0
      });
      setPendingReviews(pendingRes.data.pending || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (auctionId) => {
    try {
      await axios.post(`${API}/api/reviews/create`, {
        auction_id: auctionId,
        ...formData
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(t.thankYou);
      setShowForm(null);
      setFormData({
        rating: 5,
        title: '',
        content: '',
        would_recommend: true,
        delivery_rating: 5,
        product_quality_rating: 5
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler');
    }
  };

  const handleHelpful = async (reviewId) => {
    if (!isAuthenticated) return;
    
    try {
      await axios.post(`${API}/api/reviews/helpful/${reviewId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Bereits abgestimmt');
    }
  };

  const StarRating = ({ rating, onRate, interactive = false }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => interactive && onRate && onRate(star)}
          className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}
          disabled={!interactive}
        >
          <Star 
            className={`w-6 h-6 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
          />
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4">
        <div className="max-w-4xl mx-auto animate-pulse space-y-6">
          <div className="h-12 bg-gray-800 rounded w-1/3 mx-auto"></div>
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-40 bg-gray-800 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="reviews-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/20 border border-yellow-500/30 mb-4">
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            <span className="text-yellow-400 font-bold">{t.verified}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-3">{t.title}</h1>
          <p className="text-gray-500 text-lg">{t.subtitle}</p>
          
          {/* Average Rating */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-4xl font-bold text-yellow-400">{stats.average.toFixed(1)}</span>
              <StarRating rating={Math.round(stats.average)} />
            </div>
            <span className="text-gray-500">({stats.total} {t.allReviews})</span>
          </div>
        </div>

        {/* Pending Reviews - Own products to review */}
        {pendingReviews.length > 0 && (
          <div className="mb-8">
            <div className="glass-card rounded-xl p-6 border border-green-500/30 bg-gradient-to-r from-green-500/10 to-emerald-500/10">
              <div className="flex items-center gap-2 mb-4">
                <Gift className="w-5 h-5 text-green-400" />
                <h2 className="text-lg font-bold text-gray-800">{t.pendingReviews}</h2>
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">{t.bonusHint}</span>
              </div>
              <p className="text-gray-500 text-sm mb-4">{t.pendingDesc}</p>
              
              <div className="space-y-3">
                {pendingReviews.map(item => (
                  <div key={item.auction_id} className="bg-white/5 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {item.product?.image_url ? (
                          <img src={item.product.image_url} alt="" className="w-12 h-12 rounded object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded bg-gray-700" />
                        )}
                        <div>
                          <h4 className="text-gray-800 font-medium">{item.product?.name}</h4>
                          <p className="text-sm text-green-400">{t.wonFor} €{item.final_price?.toFixed(2)}</p>
                        </div>
                      </div>
                      <Button 
                        onClick={() => setShowForm(showForm === item.auction_id ? null : item.auction_id)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-500"
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        {t.writeReview}
                      </Button>
                    </div>
                    
                    {/* Review Form */}
                    {showForm === item.auction_id && (
                      <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                        <div>
                          <label className="text-sm text-gray-500 block mb-2">{t.rating}</label>
                          <StarRating 
                            rating={formData.rating} 
                            onRate={(r) => setFormData({...formData, rating: r})}
                            interactive 
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm text-gray-500 block mb-1">{t.reviewTitle}</label>
                          <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({...formData, title: e.target.value})}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-gray-800"
                            placeholder="Super Erfahrung!"
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm text-gray-500 block mb-1">{t.reviewContent}</label>
                          <Textarea
                            value={formData.content}
                            onChange={(e) => setFormData({...formData, content: e.target.value})}
                            className="bg-white/5 border-white/10 text-gray-800"
                            placeholder="Erzähl uns von deiner Erfahrung..."
                            rows={3}
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm text-gray-500 block mb-1">{t.deliveryRating}</label>
                            <StarRating 
                              rating={formData.delivery_rating}
                              onRate={(r) => setFormData({...formData, delivery_rating: r})}
                              interactive
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-500 block mb-1">{t.qualityRating}</label>
                            <StarRating 
                              rating={formData.product_quality_rating}
                              onRate={(r) => setFormData({...formData, product_quality_rating: r})}
                              interactive
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-sm text-gray-500 block mb-2">{t.wouldRecommend}</label>
                          <div className="flex gap-3">
                            <Button
                              type="button"
                              variant={formData.would_recommend ? 'default' : 'outline'}
                              onClick={() => setFormData({...formData, would_recommend: true})}
                              className={formData.would_recommend ? 'bg-green-600' : ''}
                            >
                              {t.yes}
                            </Button>
                            <Button
                              type="button"
                              variant={!formData.would_recommend ? 'default' : 'outline'}
                              onClick={() => setFormData({...formData, would_recommend: false})}
                              className={!formData.would_recommend ? 'bg-red-600' : ''}
                            >
                              {t.no}
                            </Button>
                          </div>
                        </div>
                        
                        <Button 
                          onClick={() => handleSubmitReview(item.auction_id)}
                          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black"
                        >
                          {t.submit}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Public Reviews */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4">{t.allReviews}</h2>
          
          {reviews.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <Star className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500">{t.noReviews}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map(review => (
                <div key={review.id} className="glass-card rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    {/* Product Image */}
                    <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                      {review.product_image ? (
                        <img src={review.product_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                          <User className="w-8 h-8 text-gray-500" />
                        </div>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 mb-1">
                        <StarRating rating={review.rating} />
                        <span className="text-green-400 text-sm flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {t.verified}
                        </span>
                      </div>
                      
                      <h4 className="text-gray-800 font-bold">{review.title}</h4>
                      <p className="text-gray-500 text-sm">{review.product_name}</p>
                      
                      <p className="text-gray-600 mt-2">{review.content}</p>
                      
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>{review.user_name}</span>
                          <span>{new Date(review.created_at).toLocaleDateString()}</span>
                          {review.final_price > 0 && (
                            <span className="text-green-400">
                              {t.savedAmount}: €{(review.retail_price - review.final_price).toFixed(2)}
                            </span>
                          )}
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleHelpful(review.id)}
                          className="text-gray-500 hover:text-gray-800"
                        >
                          <ThumbsUp className="w-4 h-4 mr-1" />
                          {review.helpful_count || 0} {t.helpful}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewsPage;
