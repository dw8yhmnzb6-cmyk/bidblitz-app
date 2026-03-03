import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Heart, Share2, MapPin, Clock, Shield, Star,
  Phone, Mail, MessageCircle, ChevronLeft, ChevronRight,
  Crown, User, Calendar, Eye, Flag, CheckCircle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const MarketplaceListingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showPhone, setShowPhone] = useState(false);

  useEffect(() => {
    fetchListing();
  }, [id]);

  const fetchListing = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/market/listings/${id}`);
      if (response.ok) {
        const data = await response.json();
        setListing(data);
      } else {
        // Demo data
        setListing({
          id: id,
          title: 'Luxus Penthouse Dubai Marina',
          description: `Atemberaubendes 4-Zimmer Penthouse mit direktem Meerblick in der begehrten Dubai Marina. 

Diese exklusive Immobilie bietet:
• 280m² Wohnfläche auf zwei Ebenen
• Große Dachterrasse mit privatem Pool
• Hochwertige Markenküche von Bulthaup
• Smart Home System
• 3 Parkplätze in der Tiefgarage
• 24/7 Concierge Service

Die Wohnung ist komplett möbliert mit Designer-Möbeln und sofort bezugsfertig. Ideal als Investment oder Eigennutzung.

Lage: Direkt an der Marina Walk mit Zugang zu erstklassigen Restaurants, Geschäften und dem Strand.`,
          price: 2500000,
          currency: 'EUR',
          category: 'Immobilien',
          country: 'Dubai',
          city: 'Dubai Marina',
          images: [
            'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200',
            'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200',
            'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1200',
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200'
          ],
          is_premium: true,
          seller_name: 'Dubai Luxury Properties',
          seller_phone: '+971 50 123 4567',
          seller_email: 'contact@dubailuxury.ae',
          seller_verified: true,
          seller_rating: 4.9,
          seller_reviews: 127,
          views: 1847,
          created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          features: ['Pool', 'Meerblick', 'Möbliert', 'Parkplatz', 'Balkon', 'Smart Home']
        });
      }
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  const formatPrice = (price, currency = 'EUR') => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const nextImage = () => {
    if (listing?.images) {
      setCurrentImageIndex((prev) => (prev + 1) % listing.images.length);
    }
  };

  const prevImage = () => {
    if (listing?.images) {
      setCurrentImageIndex((prev) => (prev - 1 + listing.images.length) % listing.images.length);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Anzeige nicht gefunden</h2>
          <button 
            onClick={() => navigate('/marktplatz')}
            className="text-purple-400 hover:text-purple-300"
          >
            Zurück zum Marktplatz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-white hover:text-purple-400 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Zurück</span>
            </button>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsFavorite(!isFavorite)}
                className={`p-2.5 rounded-xl transition-all ${
                  isFavorite 
                    ? 'bg-red-500/20 text-red-500' 
                    : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
              >
                <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
              <button className="p-2.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-all">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-800">
              {listing.is_premium && (
                <div className="absolute top-4 left-4 z-10 bg-gradient-to-r from-yellow-500 to-amber-600 text-black text-sm font-bold px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
                  <Crown className="w-4 h-4" />
                  PREMIUM ANZEIGE
                </div>
              )}
              
              <div className="relative aspect-video">
                {listing.images && listing.images.length > 0 ? (
                  <>
                    <img
                      src={listing.images[currentImageIndex]}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                    />
                    
                    {listing.images.length > 1 && (
                      <>
                        <button 
                          onClick={prevImage}
                          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 hover:bg-black/70 backdrop-blur rounded-full flex items-center justify-center text-white transition-all"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button 
                          onClick={nextImage}
                          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 hover:bg-black/70 backdrop-blur rounded-full flex items-center justify-center text-white transition-all"
                        >
                          <ChevronRight className="w-6 h-6" />
                        </button>
                        
                        {/* Image Counter */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur px-4 py-2 rounded-full text-white text-sm">
                          {currentImageIndex + 1} / {listing.images.length}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                    <span className="text-slate-500">Kein Bild</span>
                  </div>
                )}
              </div>

              {/* Thumbnail Strip */}
              {listing.images && listing.images.length > 1 && (
                <div className="flex gap-2 p-4 overflow-x-auto">
                  {listing.images.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                        currentImageIndex === index 
                          ? 'border-purple-500' 
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title & Price */}
            <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                    {listing.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3 text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      {listing.city}, {listing.country}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      {formatDate(listing.created_at)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Eye className="w-4 h-4" />
                      {listing.views || 0} Aufrufe
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                    {formatPrice(listing.price, listing.currency)}
                  </p>
                </div>
              </div>

              {/* Features */}
              {listing.features && listing.features.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-700">
                  {listing.features.map((feature, index) => (
                    <span 
                      key={index}
                      className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-sm flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {feature}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
              <h2 className="text-xl font-bold text-white mb-4">Beschreibung</h2>
              <div className="text-slate-300 whitespace-pre-line leading-relaxed">
                {listing.description}
              </div>
            </div>
          </div>

          {/* Sidebar - Seller Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Seller Card */}
            <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700 sticky top-24">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{listing.seller_name}</h3>
                    {listing.seller_verified && (
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <CheckCircle className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </div>
                  {listing.seller_rating && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="text-white font-medium">{listing.seller_rating}</span>
                      <span className="text-slate-400">({listing.seller_reviews} Bewertungen)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Buttons */}
              <div className="space-y-3">
                <button 
                  onClick={() => setShowPhone(!showPhone)}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all"
                >
                  <Phone className="w-5 h-5" />
                  {showPhone && listing.seller_phone ? listing.seller_phone : 'Telefonnummer anzeigen'}
                </button>

                <button 
                  onClick={() => setShowContact(true)}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all"
                >
                  <MessageCircle className="w-5 h-5" />
                  Nachricht senden
                </button>

                {listing.seller_email && (
                  <a 
                    href={`mailto:${listing.seller_email}`}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all"
                  >
                    <Mail className="w-5 h-5" />
                    E-Mail senden
                  </a>
                )}
              </div>

              {/* Safety Tips */}
              <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <h4 className="text-blue-400 font-semibold mb-1">Sicherheitshinweis</h4>
                    <p className="text-slate-400 text-sm">
                      Treffen Sie sich an öffentlichen Orten und zahlen Sie nie im Voraus.
                    </p>
                  </div>
                </div>
              </div>

              {/* Report */}
              <button className="w-full mt-4 text-slate-400 hover:text-red-400 text-sm flex items-center justify-center gap-2 transition-colors">
                <Flag className="w-4 h-4" />
                Anzeige melden
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      {showContact && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Nachricht an Verkäufer</h3>
            <textarea
              className="w-full h-32 bg-slate-700 border border-slate-600 rounded-xl p-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none mb-4"
              placeholder="Ihre Nachricht..."
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setShowContact(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-semibold transition-all"
              >
                Abbrechen
              </button>
              <button className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 rounded-xl font-semibold transition-all">
                Senden
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceListingDetail;
