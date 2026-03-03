import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Heart, Share2, MapPin, Shield, Star,
  Phone, Mail, MessageCircle, ChevronLeft, ChevronRight,
  Crown, User, Calendar, Eye, Flag, CheckCircle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Demo Daten - KORRIGIERT: VAE als Land, funktionierende Bild-URLs
const DEMO_LISTINGS = {
  '1': {
    id: '1',
    title: 'Luxus Penthouse Dubai Marina',
    description: `Atemberaubendes 4-Zimmer Penthouse mit direktem Meerblick in der begehrten Dubai Marina.

Diese exklusive Immobilie bietet:
• 280m² Wohnfläche auf zwei Ebenen
• Große Dachterrasse mit privatem Pool
• Hochwertige Markenküche von Bulthaup
• Smart Home System
• 3 Parkplätze in der Tiefgarage
• 24/7 Concierge Service

Die Wohnung ist komplett möbliert mit Designer-Möbeln und sofort bezugsfertig.`,
    price: 2500000,
    currency: 'EUR',
    category: 'Immobilien',
    country: 'VAE',
    city: 'Dubai',
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
    features: ['Pool', 'Meerblick', 'Möbliert', 'Parkplatz', 'Balkon', 'Smart Home']
  },
  '2': {
    id: '2',
    title: 'Mercedes-AMG GT 63 S',
    description: `Luxuriöser Mercedes-AMG GT 63 S in perfektem Zustand.

Technische Daten:
• Baujahr: 2023
• Kilometerstand: 15.000 km
• Motor: 4.0L V8 Biturbo, 639 PS
• Getriebe: 9-Gang Automatik
• Antrieb: 4MATIC+

Ausstattung:
• AMG Performance Paket
• Carbon-Keramik Bremsen
• Panorama-Schiebedach
• Premium Sound System
• Vollständige Garantie bis 2026`,
    price: 165000,
    currency: 'EUR',
    category: 'Fahrzeuge',
    country: 'Deutschland',
    city: 'München',
    images: [
      'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1200',
      'https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=1200',
      'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=1200'
    ],
    is_premium: true,
    seller_name: 'Premium Cars München',
    seller_phone: '+49 89 123 4567',
    seller_email: 'info@premium-cars.de',
    seller_verified: true,
    seller_rating: 4.8,
    seller_reviews: 89,
    views: 2341,
    features: ['Automatik', 'Navigation', 'Leder', 'Sitzheizung', 'Parkassistent']
  },
  '3': {
    id: '3',
    title: 'Gaming PC RTX 4090',
    description: `High-End Gaming PC mit Top-Ausstattung.

Spezifikationen:
• CPU: Intel Core i9-13900K
• GPU: NVIDIA RTX 4090 24GB
• RAM: 64GB DDR5-6000
• SSD: 2TB NVMe Gen4
• Netzteil: 1000W 80+ Platinum
• Gehäuse: Lian Li O11 Dynamic

Perfekt für 4K Gaming, Content Creation und Streaming.
Alle Komponenten neu und originalverpackt.`,
    price: 3499,
    currency: 'EUR',
    category: 'Elektronik',
    country: 'Kosovo',
    city: 'Prishtina',
    images: [
      'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=1200',
      'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=1200'
    ],
    is_premium: false,
    seller_name: 'TechStore KS',
    seller_phone: '+383 44 123 456',
    seller_email: 'info@techstore.ks',
    seller_verified: true,
    seller_rating: 4.7,
    seller_reviews: 56,
    views: 892,
    features: ['RTX 4090', 'i9-13900K', '64GB RAM', '2TB SSD', 'RGB']
  },
  '4': {
    id: '4',
    title: 'iPhone 15 Pro Max 256GB',
    description: `Brandneues iPhone 15 Pro Max in Titan Schwarz.

• Speicher: 256GB
• Farbe: Titan Schwarz
• Zustand: Neu, versiegelt
• Mit Original-Rechnung
• 2 Jahre Garantie

Das neueste iPhone mit dem leistungsstarken A17 Pro Chip.`,
    price: 1299,
    currency: 'EUR',
    category: 'Elektronik',
    country: 'Kosovo',
    city: 'Prizren',
    images: [
      'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=1200',
      'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=1200'
    ],
    is_premium: false,
    seller_name: 'Mobile Shop Prizren',
    seller_phone: '+383 44 789 012',
    seller_email: 'mobileshop@gmail.com',
    seller_verified: false,
    seller_rating: 4.5,
    seller_reviews: 34,
    views: 567,
    features: ['256GB', 'Titan', 'Garantie', 'Original']
  },
  '5': {
    id: '5',
    title: 'Moderne 3-Zimmer Wohnung',
    description: `Wunderschöne Neubau-Wohnung in zentraler Lage von Prishtina.

Details:
• 85m² Wohnfläche
• 3 Zimmer + Küche + Bad
• Großer Balkon (12m²)
• Tiefgaragenstellplatz inklusive
• Baujahr: 2024
• Energieeffizienzklasse A

Ausstattung:
• Fußbodenheizung
• Hochwertige Einbauküche
• Eichenparkett
• Smart Home Ready

Perfekte Lage mit allen Annehmlichkeiten in der Nähe.`,
    price: 185000,
    currency: 'EUR',
    category: 'Immobilien',
    country: 'Kosovo',
    city: 'Prishtina',
    images: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200'
    ],
    is_premium: true,
    seller_name: 'Immo Kosovo',
    seller_phone: '+383 44 555 666',
    seller_email: 'info@immokosovo.com',
    seller_verified: true,
    seller_rating: 4.9,
    seller_reviews: 78,
    views: 1234,
    features: ['Balkon', 'Tiefgarage', 'Neubau', 'Fußbodenheizung', 'Einbauküche']
  },
  '6': {
    id: '6',
    title: 'BMW X5 M Competition',
    description: `BMW X5 M Competition in perfektem Zustand.

• Baujahr: 2024
• Kilometerstand: 5.000 km
• Motor: 4.4L V8, 625 PS
• Farbe: Carbon Schwarz Metallic

Vollausstattung inkl. M Paket, Panoramadach, Head-Up Display.`,
    price: 125000,
    currency: 'EUR',
    category: 'Fahrzeuge',
    country: 'Kosovo',
    city: 'Prishtina',
    images: [
      'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1200',
      'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=1200'
    ],
    is_premium: true,
    seller_name: 'Auto Center Prishtina',
    seller_phone: '+383 44 111 222',
    seller_email: 'autocenter@gmail.com',
    seller_verified: true,
    seller_rating: 4.6,
    seller_reviews: 42,
    views: 678,
    features: ['M Paket', 'Panorama', 'Head-Up', 'Leder', 'Navigation']
  },
  '7': {
    id: '7',
    title: 'Designer Sofa Set',
    description: `Elegantes italienisches Sofa-Set aus echtem Leder.

Set beinhaltet:
• 3-Sitzer Sofa
• 2-Sitzer Sofa  
• Sessel

Material: Premium italienisches Leder
Farbe: Cognac Braun
Zustand: Neuwertig (6 Monate alt)`,
    price: 4500,
    currency: 'EUR',
    category: 'Möbel',
    country: 'Kosovo',
    city: 'Prizren',
    images: [
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200',
      'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=1200'
    ],
    is_premium: false,
    seller_name: 'Möbel Prizren',
    seller_phone: '+383 44 333 444',
    seller_email: 'moebel.prizren@gmail.com',
    seller_verified: false,
    seller_rating: 4.3,
    seller_reviews: 21,
    views: 345,
    features: ['Echtleder', 'Italien', '3+2+1 Set', 'Neuwertig']
  },
  '8': {
    id: '8',
    title: 'Villa mit Meerblick Abu Dhabi',
    description: `Exklusive 5-Zimmer Villa auf Saadiyat Island.

Diese luxuriöse Villa bietet:
• 450m² Wohnfläche
• 5 Schlafzimmer, 6 Bäder
• Privater Infinity-Pool
• Direkter Strandzugang
• Golfplatz-Blick

Komplett möbliert mit italienischen Designer-Möbeln.`,
    price: 3200000,
    currency: 'EUR',
    category: 'Immobilien',
    country: 'VAE',
    city: 'Abu Dhabi',
    images: [
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200'
    ],
    is_premium: true,
    seller_name: 'Abu Dhabi Realty',
    seller_phone: '+971 2 123 4567',
    seller_email: 'sales@adrealty.ae',
    seller_verified: true,
    seller_rating: 4.8,
    seller_reviews: 95,
    views: 2156,
    features: ['Pool', 'Strand', 'Möbliert', '5 Zimmer', 'Golf']
  }
};

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
        // Demo-Daten basierend auf ID
        const demoListing = DEMO_LISTINGS[id];
        if (demoListing) {
          setListing({
            ...demoListing,
            created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
          });
        } else {
          setListing(null);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      const demoListing = DEMO_LISTINGS[id];
      if (demoListing) {
        setListing({
          ...demoListing,
          created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        });
      }
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
        <div className="text-center px-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Anzeige nicht gefunden</h2>
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
      <div className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => navigate('/marktplatz')}
              className="flex items-center gap-1.5 text-white hover:text-purple-400 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium text-sm sm:text-base">Zurück</span>
            </button>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsFavorite(!isFavorite)}
                className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all ${
                  isFavorite 
                    ? 'bg-red-500/20 text-red-500' 
                    : 'bg-slate-800 text-white'
                }`}
              >
                <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
              <button className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-800 text-white">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Image Gallery */}
            <div className="relative rounded-xl sm:rounded-2xl overflow-hidden bg-slate-800">
              {listing.is_premium && (
                <div className="absolute top-3 left-3 z-10 bg-gradient-to-r from-yellow-500 to-amber-600 text-black text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                  <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  PREMIUM
                </div>
              )}
              
              <div className="relative aspect-[4/3] sm:aspect-video">
                {listing.images && listing.images.length > 0 ? (
                  <>
                    <img
                      src={listing.images[currentImageIndex]}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200';
                      }}
                    />
                    
                    {listing.images.length > 1 && (
                      <>
                        <button 
                          onClick={prevImage}
                          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-black/50 hover:bg-black/70 backdrop-blur rounded-full flex items-center justify-center text-white"
                        >
                          <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                        <button 
                          onClick={nextImage}
                          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-black/50 hover:bg-black/70 backdrop-blur rounded-full flex items-center justify-center text-white"
                        >
                          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                        
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur px-3 py-1.5 rounded-full text-white text-xs sm:text-sm">
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
                <div className="flex gap-2 p-3 sm:p-4 overflow-x-auto">
                  {listing.images.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all ${
                        currentImageIndex === index 
                          ? 'border-purple-500' 
                          : 'border-transparent opacity-60'
                      }`}
                    >
                      <img 
                        src={img} 
                        alt="" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400';
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title & Price */}
            <div className="bg-slate-800/50 backdrop-blur rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-700">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
                <div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2">
                    {listing.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-slate-400 text-xs sm:text-sm">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {listing.city}, {listing.country}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {formatDate(listing.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {listing.views || 0} Aufrufe
                    </span>
                  </div>
                </div>
                <div className="sm:text-right">
                  <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
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
                      className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-xs sm:text-sm flex items-center gap-1"
                    >
                      <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      {feature}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="bg-slate-800/50 backdrop-blur rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-700">
              <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Beschreibung</h2>
              <div className="text-slate-300 text-sm sm:text-base whitespace-pre-line leading-relaxed">
                {listing.description}
              </div>
            </div>

            {/* Mobile: Seller Info */}
            <div className="lg:hidden">
              <SellerCard 
                listing={listing} 
                showPhone={showPhone}
                setShowPhone={setShowPhone}
                setShowContact={setShowContact}
              />
            </div>
          </div>

          {/* Desktop Sidebar */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-24">
              <SellerCard 
                listing={listing} 
                showPhone={showPhone}
                setShowPhone={setShowPhone}
                setShowContact={setShowContact}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      {showContact && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-4">Nachricht an Verkäufer</h3>
            <textarea
              className="w-full h-28 sm:h-32 bg-slate-700 border border-slate-600 rounded-lg sm:rounded-xl p-3 sm:p-4 text-white text-sm sm:text-base placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none mb-4"
              placeholder="Ihre Nachricht..."
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setShowContact(false)}
                className="flex-1 bg-slate-700 text-white py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold"
              >
                Abbrechen
              </button>
              <button className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold">
                Senden
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Seller Card Komponente
const SellerCard = ({ listing, showPhone, setShowPhone, setShowContact }) => (
  <div className="bg-slate-800/50 backdrop-blur rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-700">
    <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shrink-0">
        <User className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base sm:text-lg font-bold text-white truncate">{listing.seller_name}</h3>
          {listing.seller_verified && (
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
              <CheckCircle className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-white" />
            </div>
          )}
        </div>
        {listing.seller_rating && (
          <div className="flex items-center gap-1 text-xs sm:text-sm">
            <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-500 fill-yellow-500" />
            <span className="text-white font-medium">{listing.seller_rating}</span>
            <span className="text-slate-400">({listing.seller_reviews} Bewertungen)</span>
          </div>
        )}
      </div>
    </div>

    {/* Contact Buttons */}
    <div className="space-y-2 sm:space-y-3">
      <button 
        onClick={() => setShowPhone(!showPhone)}
        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 sm:py-4 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold flex items-center justify-center gap-2"
      >
        <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
        {showPhone && listing.seller_phone ? listing.seller_phone : 'Telefonnummer anzeigen'}
      </button>

      <button 
        onClick={() => setShowContact(true)}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 sm:py-4 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold flex items-center justify-center gap-2"
      >
        <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
        Nachricht senden
      </button>

      {listing.seller_email && (
        <a 
          href={`mailto:${listing.seller_email}`}
          className="w-full bg-slate-700 text-white py-3 sm:py-4 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold flex items-center justify-center gap-2"
        >
          <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
          E-Mail senden
        </a>
      )}
    </div>

    {/* Safety Tips */}
    <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg sm:rounded-xl">
      <div className="flex items-start gap-2 sm:gap-3">
        <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 mt-0.5 shrink-0" />
        <div>
          <h4 className="text-blue-400 text-sm sm:text-base font-semibold mb-1">Sicherheitshinweis</h4>
          <p className="text-slate-400 text-xs sm:text-sm">
            Treffen Sie sich an öffentlichen Orten und zahlen Sie nie im Voraus.
          </p>
        </div>
      </div>
    </div>

    {/* Report */}
    <button className="w-full mt-3 sm:mt-4 text-slate-400 hover:text-red-400 text-xs sm:text-sm flex items-center justify-center gap-1.5">
      <Flag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      Anzeige melden
    </button>
  </div>
);

export default MarketplaceListingDetail;
